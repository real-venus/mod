from typing import *
from flask import Flask, request, Response
from flask_cors import CORS
import os
import hashlib
import os
import pandas as pd
import json
import inspect
from functools import partial
import time
import mod as m
print = m.print

class Server:
    
    tag_divider = '::' # the divider to use for tags in mod names, e.g. 'mod::tag1' and 'mod::tag2' will be two servers with the same mod but different tags
    # helper functions that are always exposed are always exposed [WARNING: HELPER FNS SHOULD BE CAREFULLY CHOSEN TO AVOID SECURITY RISKS]
    
    def __init__(
        self,
        path = '~/.mod/server', # the path to store the server data
        pm = 'pm.pm2', # the process manager to use
        registry = 'server.registry',
        timeout = 300):
        self.store = m.mod('store')(path)
        self.pm = self.set_pm(pm)
        self.registry = m.mod(registry)()
        self.timeout = timeout

    def kill(self, name):
        self.pm.kill(name)
        self.registry.dereg(name)
        return {'status': 'killed', 'name': name}
    
    def kill_all(self):
        servers = self.servers()
        for server in servers:
            self.kill(server)
        return {'status': 'killed all', 'servers': servers}
    
    killall = kill_all
    
    
    def namespace(self, search: Optional[str] = None,  **kwargs) -> Dict[str, str]:
        """
        Get the namespace of registered servers, optionally filtered by a search string.
        """
        return self.registry.namespace(search=search, **kwargs)

    def set_pm(self,  pm: str):
        if pm != None:
            self.pm = m.mod(pm)()
        return self.pm

    def logs(self, name: str, pm=None, **kwargs) -> str:
        self.set_pm(pm)
        return self.pm.logs(name, **kwargs)

    def forward(self, **request: dict):
        """
        runt the function
        """
        return self.gate.forwrd(**request)

    def get_port(self, port:Optional[int]=None, mod:Union[str, 'Module', Any]=None) -> int:
        if port == None: 
            config = m.config(mod)
            if config != None and 'port' in config:
                port = config['port']
            else:
                port  = mod.port if hasattr(mod, 'port') else None
        port = port or m.free_port()
        return port

    def servers(self, search=None,  **kwargs) -> List[str]:
        return list(self.namespace(search=search, **kwargs).keys())

    def urls(self, search=None,  **kwargs) -> List[str]:
        return list(self.namespace(search=search, **kwargs).values())   

    def mods(self, 
                search=None, 
                max_age=None, 
                update=False, 
                features=['name', 'url', 'key'], 
                timeout=24, 
                path = 'mods.json',
                **kwargs):

        def module_filter(m: dict) -> bool:
            """Filter function to gate if a mod contains the required features."""
            return isinstance(m, dict) and all(feature in m for feature in features )    
        mods = self.store.get(path, None, max_age=max_age, update=update)
        if mods == None :
            names = list(self.namespace().keys())
            print(f'Fetching info for servers: {names}', color='green')
            futures  = [m.submit(m.call, {"fn":name + '/info'}, timeout=timeout, mode='thread') for name in names]
            mods =  m.wait(futures, timeout=timeout)
            mods = list(filter(module_filter, mods))
            self.store.put(path, mods)
        else:
            mods = list(filter(module_filter, mods))

        if search != None:
            mods = [m for m in mods if search in m['name']]
       
        return mods

    def n(self, search=None, **kwargs):
        return len(self.mods(search=search, **kwargs))

    def exists(self, name:str, **kwargs) -> bool:
        """gate if the server exists"""
        return bool(name in self.servers(**kwargs))

    def call(self, fn , params=None, **kwargs): 
        return self.fn('client/forward')(fn, params, **kwargs)

    def wait_for_server(self, name:str, max_time:int=10, trial_backoff:int=0.5, network:str='local',  max_age:int=20):
        # wait for the server to start
        t0 = m.time()
        while m.time() - t0 < max_time:
            namespace = self.namespace(network=network)
            if name in namespace:
                try:
                    return  m.fn('client/call')(namespace[name]+'/info')
                except Exception as e:
                    print(f'Error calling server {name} at {namespace[name]}: {m.detailed_error(e)}', color='red')
            m.sleep(trial_backoff)
        raise Exception(f'Failed to start {name} after {trials} trials')

    def prepare_server(self, mod, fn_options = ['ensure_env']):
        mod_obj = m.mod(mod)
        for fn in fn_options:
            if hasattr(mod_obj, fn):
                print(f'Preparing server: running {fn}()', color='green')
                getattr(mod_obj, fn)()
                break
        return True
    
    def set_mod(self, name, mod):
        if mod == None:
            return
        setattr(self, name, mod)

    def get_fns(self, mod):
        config = m.config(mod)
        if config != None and 'fns' in config:
            return config['fns']
        mod_obj = m.mod(mod)
        fns = [fn for fn in dir(mod_obj) if not fn.startswith('_') and callable(getattr(mod_obj, fn))]
        return fns

    def serve(self,
              mod: Union[str, 'Module', Any] = None, # the mod in either a string
              params:Optional[dict] = None,  # kwargs for the mod
              port :Optional[int] = None, # name of the server if None, it will be the mod name
              fns = None, # list of fns to serve, if none, it will be the endpoints of the mod
              key = None, # the key for the server
              remote = False, # whether to run the server remotely
              pm = None,
              run_mode:str='flask',
              paywall = None, # optional x402 payment gate instance
              **extra_params

              ):
        
        self.set_pm(pm)
        mod = mod or m.name
        port = self.get_port(port, mod=mod)
        params = {**(params or {}), **extra_params}
        if remote:
            return self.pm.forward(mod=mod, params=params, port=port, key=key)
        
        name = mod
        if  self.tag_divider in mod:
            mod = mod.split(self.tag_divider)[0]
    
        self.mod = m.mod(mod)(**(params or {}))
        self.key = m.key(key)
        fns = fns or self.get_fns(mod)
        
        def get_info(mod, **kwargs):
            info = m.info(mod, **kwargs)
            info['key'] = self.key.address
            info['fns'] = fns
            return info
        
        self.mod.info = get_info(mod)
        self.gate = m.mod('gate')(mod=self.mod, paywall=paywall)
        self.app = Flask(__name__)
        CORS(self.app)

        @self.app.route("/<path:fn>", methods=['POST'])
        def server_fn(fn):
            try:
                headers = dict(request.headers)
                params = request.get_json()
                result = self.gate.forward(fn=fn, headers=headers, params=params, mod=self.mod)
                print(f'RESULT>>>>>>>\n {result}', color='green')
            except Exception as e:
                result = m.detailed_error(e)
                m.print(f'Error in server function {fn}: {result} {e}', color='red')
            return result

        self.registry.reg(name, f'http://0.0.0.0:{port}')
        if run_mode == 'flask':
            self.app.run(
                host="0.0.0.0",
                port=port,
                debug=False,
            )
        else:
            raise Exception(f'Unknown run_mode: {run_mode}. Only "flask" is supported.')


