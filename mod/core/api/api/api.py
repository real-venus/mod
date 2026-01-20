import requests
import os
import json
from typing import Optional, Dict, Any, List, Union
from pathlib import Path
import time
import glob
import datetime
import inspect
import shutil
import mod as m

class  Api:

    # fam
    port = 8000
    sync_interval = 0.1
    sync_delay = 3
    protocal = 'mod'
    folder_path = m.abspath('~/.mod/api')
    threads = {}

    def __init__(self, store = 'ipfs', chain='chain', key=None, auth='auth.v0'):
        self.set_store(store)
        self.key = m.key(key)
        self.model = m.mod('model.openrouter')()
        self.registry_path = self.path('registry.json')
        self.executor = m.mod('executor')()
        self.calls_path = self.path('calls')
        self.auth = m.mod(auth)()
        self.config = m.config('api')
        # self.threads['update'] = m.thread(self.update_loop)
        if 'sync' not in self.threads:
            self.threads['sync'] = m.thread(self.sync_loop)
    @property
    def store(self):
        if not hasattr(self, '_store'):
            self._store = m.mod(self._store_path)()
        return self._store

    def addy(self, key=None):
        return self.key.address or m.addy(key)

    def set_store(self, store):
        # set the store mod
        self._store_path = store
        return {'store': self._store_path}
            
    def valid_cid (self, cid: str) -> bool:
        """Check if a given string is a valid IPFS CID.
        
        Args:
            cid: IPFS CID string
        Returns:
            True if valid, False otherwise
        """
        if isinstance(cid, str) and len(cid) > 0:
            try:
                self.get(cid)
                return True
            except:
                return False
        return False

    def exists(self, mod: m.Mod='store', key=None) -> bool:
        """
        Check if a mod Mod exists in IPFS.
        """
        return bool(self.cid(mod=mod, key=key))

    def verify_mod(self, mod: str = 'store', key=None) -> bool:
        mod =  self.mod(mod=mod, key=key) if isinstance(mod, str) else mod
        signature = mod.pop('signature', None)
        assert signature is not None, f'Mod {mod} has no signature'
        return self.key.verify(mod, signature=signature, address=mod['key'])

    def mod(self, mod: m.Mod='store', key=None, schema=False, content=False, public=True,  expand = False, fns=None,**kwargs) -> Dict[str, Any]:
        """
        get the mod Mod from IPFS.
        """
        cid = self.cid(mod=mod, key=key, default=mod)
        mod =  self.get(cid) if cid else None
        if mod == None:
            raise Exception(f'Mod {mod} not found for key {key}')
        if schema:
            mod['schema'] = self.get(mod['schema'])
        if fns is not None:
            mod['fns'] =fns
        mod['name'] = mod['name'].split('/')[0]
        mod['public'] = mod.get('public', public)
        if content:
            mod['content'] = self.content(mod['content'], expand=1)
        mod['cid'] = cid
        mod['protocal'] = mod.get('protocal', self.protocal)

        if 'version' not in mod:
            # get the txs and set the version to the length of the txs
            txs = self.txs(mod=mod['name'], key=mod['key'], df=0)
            mod['version'] = len(txs) if txs is not None else 0
        return mod

    devmode = True

    def task_data(self , 
                fn: str = 'store/ls',  
                params: Dict[str, Any] = {}, 
                cost = 1,
                timeout=1000,
                ) -> Dict[str, Any]:

        if self.valid_cid (fn):
            task = self.get(fn)
            fn = task['fn']
            params = task['params']
        else:
            fn = fn + '/info' if '/' not in fn else fn
        if isinstance(params, dict):
            params = self.put(params)
        return  {
            'fn': fn,
            'params': params,       
            'timeout': timeout,  
            'status': 'pending',
            'time': m.time(), 
            'cost': cost,
        }



    pdata_args = ['time', 'cost', 'cid', 'owner', 'key']
    pdiv = '|'
    def proof_data(self, data='hey', time_type='int', cost=None, key=None, owner=None):
        time_stamp = m.time(time_type)
        if isinstance(data, dict) and 'cost' in data:
            cost = data['cost']
        cost = cost or 0
        key = self.key_address(key)
        data_cid = self.put(data)
        proof_data = {
            'time': time_stamp,
            'cost': cost,
            'cid': data_cid,
            'key': key,
            'owner': owner or self.key.address
        }
        return self.pdiv.join([str(proof_data[k]) for k in self.pdata_args])

 
    def test_proof(self):
        return self.verify_proof(self.proof())
        
    cid2future = {}


    def resolve_fn(self, fn: str):
        fn = self.get_fn(fn)
        mod_name, fn_name = fn.split('/', 1)
        mod = self.mod(mod_name)
        fn_obj = getattr(m.mod(mod), fn_name)
        return fn_obj

    def call(self , 
                fn: str = 'api/edit',  
                params: Dict[str, Any] = {}, 
                cost = 1,
                token = None, 
                wait=False,
                return_cid = False,
                timeout=1000, **extra_params) -> Any:
        """
        Call a function from a mod Mod in IPFS.
        Args:
            mod: Commune Mod object
            fn: Function name to call
            params: Parameters for the function call
            key: Key object or address string
        Returns:
            Result of the function call
        """
        task = self.task_data( fn=fn, params=params, timeout=timeout)
        if self.devmode and token == None:
            token = self.auth.token(data=task, key=self.key)
        task['key'] =  self.auth.verify(token)['key']
        task['token'] = token
        task['cid'] = self.put(task)
        m.put(self.task_path(task), task)
        future =  m.submit(self.run_task, params=task ,  timeout=timeout)
        self.cid2future[task['cid']] = future
        if wait:
            result =  future.result()
            if return_cid:
                return result
            else: 
                return self.get(self.get(result).get('result'))
            return result
        return task

    def root(self, key=None , public=True, update=True, **kwargs) -> str:
        path = self.path('root_cid.json')
        root_cid = m.get(path, None, update=update)
        if root_cid == None:
            registry = self.registry(key)
            if not public:
                registry = self.key.encrypt(registry)
            if update:
                cid = self.put(registry)
                m.put(path, {'cid': cid})
                return cid
            root_cid = self.put(registry)
            m.put(path, root_cid)
        return root_cid

    def kill_task(self, cid: str) -> bool:
        """
        Kill a running task by its CID.
        """
        future = self.cid2future.get(cid, None)
        if future is not None:
            print(f'Kill({cid})')    
            future.cancel()
            del self.cid2future[cid]
            return True
        return False

    def tasks(self) -> bool:
        return list(self.cid2future.keys())

    def run_task(self, **task:dict) -> Any:
        """
        Send the function call request to the appropriate mod Mod and function.
        """
        task['status'] = 'running'
        assert '/' in task['fn'], "Function name must be in the format 'mod/fn'"
        mod, fn =  task['fn'].split('/', 1)
        path = self.task_path(task)
        if isinstance(task['params'], str):
            params =  self.get(task['params'])
        assert isinstance(params, dict)
        m.put(path, task)
        # avoid recursion
        assert not task['fn'].endswith('/call'), "Function name cannot end with '/call'"
        try:
            mod_name , fn_name = task['fn'].split('/', 1)
            if mod_name in self.servers():
                result = m.fn('client/call')(fn=task['fn'], params=params, timeout=task['timeout'])
            else:
                assert mod in self.config.get('expose_mods', []), f'Mod {mod_name} is not exposed via the API'
                allowed_fns = self.get_fns(mod)
                assert fn_name in allowed_fns, f'Function {fn_name} not allowed in mod {mod_name}. Allowed functions: {allowed_fns}'
                result = m.fn(fn_name)(**params)
            task['status'] = 'success'
        except Exception as e:
            result = m.detailed_error(e)
            task['status'] = 'error'
        if self.is_generator(result):
            task['result'] = []
            for item in result:
                task['result'].append(item)
                print(item, end='')
                m.put(path, task)
        else:
            task['result'] = result
        task['result'] = self.put(result)
        task['delta'] = m.time() - task['time']
        task['owner'] = self.key.address
        task['request_cid'] = m.copy(task['cid'])
        task['owner_token'] = self.auth.token(data=task, key=self.key)
        task['cid'] = self.put(task)
        m.put(path, task)
        return task['cid']
        
    def task_path(self, data): 
        path = f'{self.calls_path}/{data["fn"]}/{data["time"]}.json'
        return m.relpath(path)

    def _clear_calls(self):
        shutil.rmtree(self.calls_path) if os.path.exists(self.calls_path) else None
        assert len(self.call_paths()) == 0, "Failed to clear call paths"
        return True

    def call_paths(self):
        return glob.glob(self.calls_path+'/**/*.json', recursive=True)

    def txs(self, key=None, mod=None, df=1, features=['fn', 'status', 'cid' ], n=10, page=0, expand=1) -> List[Dict[str, Any]]:
        paths = self.call_paths()
        calls = []

        filter_fn = lambda p : (True if mod is None else mod in p) and (True if key is None else key in p)
        paths = list(filter(filter_fn, paths))
        for path in paths:
            call = m.get(path)
            if expand:
                if 'result' in call:
                    try:
                        call['result'] = self.get(call['result'])
                    except:
                        pass
                if 'params' in call:
                    try:
                        call['params'] = self.get(call['params'])
                    except:
                        pass
            if call != None:
                calls.append(call)
    
        calls = sorted(calls, key=lambda x: x['time'], reverse=True)
        
        if page > 0:
            start = page * n
            end = start + n
            calls = calls[start:end]
        else: 
            calls = calls[:n]

        
        if len(calls) == 0:
            return calls
        else:
            if df:
                calls = m.df(calls)
                calls.sort_values('time', ascending=False, inplace=True)
                calls['time'] = calls['time'].apply(lambda x: datetime.datetime.fromtimestamp(x).strftime('%Y-%m-%d %H:%M:%S'))
                calls = calls[:n]
                return calls[features]
            else:

                # remove all of the json non-serializable items
                txs = []
                for call in calls:
                    try:
                        json.loads(json.dumps(call))
                        txs.append(call)
                    except:
                        continue    
                return txs
    
    h = txs

    def reset_calls(self):
        for path in self.call_paths():
            print(f'Removing call path: {path}')
            m.rm(path)
        for future in self.cid2future.values():
            print(f'Cancelling future -> {future}')
            future.cancel()
        self.cid2future = {}
        assert len(self.call_paths()) == 0, "Failed to reset all call paths"
        return True


    def find_path_with_time(self, timestamp: float) -> Optional[str]:
        call_paths = self.call_paths()
        optional_paths = []
        for path in call_paths:
            try:
                call = m.get(path)
                if abs(call['time'] - timestamp) < 1e-3:
                    optional_paths.append(path)
            except:
                continue
        if len(optional_paths) > 0:
            return optional_paths[0]
        else: 
            return None
        return None

    def _clear_call_paths(self):
        for cid in self.cid2future.keys():
            print(f'Removing call path: {cid}')
            future = self.cid2future[cid]
            future.cancel()
        self.cid2future = {}

    def is_generator(self, obj):
        """
        Is this shiz a generator dawg?
        """
        if not callable(obj):
            result = inspect.isgenerator(obj)
        else:
            result =  inspect.isgeneratorfunction(obj)
        return result

    def call_data(self, fn: str = 'models', params: Dict[str, Any] = {}, time = None, cost = 0, **kwargs) -> Dict[str, Any]:

        payload = {
            'fn': fn,
            'params': params,
            'time': time,
            'cost': cost, 
            'key': self.key.address,
        }

        return payload

    def verify_call_data(self, payload: Dict[str, Any], signature: str, address=None) -> bool:
        return m.verify(payload, signature, address,  mode='str')

    def test_call(self, mod: m.Mod='openrouter', fn: str='models', params: Dict[str, Any]={}, key=None, **kwargs) -> Any:
        key = m.key(key)
        time = m.time()
        cost = 0
        payload = self.call_data(mod=mod, fn=fn, params=params, time=time, cost=cost, **kwargs)
        signature = key.sign(payload, mode='str')
        assert self.verify_call_data(payload, signature, key.address), "Payload verification failed"
        return self.call(fn= mod + '/' + fn, params=params, time=time, cost=cost, signature=signature, **kwargs)

    def content(self, mod, key=None, expand=False, depth=None, h=False) -> Dict[str, Any]:
        """Get the content of a mod Mod from IPFS.
        
        Args:
            mod: Commune Mod object
            
        Returns:
            Content dictionary
        """
        try:
            if self.valid_cid (mod):
                data = self.get(mod)
                if isinstance(data, dict) and 'content' in data:
                    content = self.get(data['content'])['data']
                else:
                    content = self.get(mod)['data']
            else:
                content = self.get(self.mod(mod, key=key)['content'])['data']
            if expand: 
                content = self.get(content)
            if h: # heirarichal content
                return self.hc(content)
        except Exception as e:
            return m.detailed_error(e)
        return content

    def hc(self, content:Dict[str, Any], flatten=False) -> Dict[str, Any]:
        """Get a human-readable version of the content dictionary.
        
        Args:
            content: Content dictionary
        Returns:
            Human-readable content dictionary
        """

        new_dict = {}
        for file, cid in content.items():
            subfiles = file.split('/')
            self.dict_put(subfiles, cid, new_dict)
        return self.get_folder_cid(new_dict)

    def sort_recursive_dict(self, d:Dict[str, Any]) -> Dict[str, Any]:
        """Recursively sort a nested dictionary by keys.
        
        Args:
            d: Dictionary to sort
        Returns:
            Sorted dictionary
        """
        sorted_dict = {}
        for key in sorted(d.keys()):
            if isinstance(d[key], dict):
                sorted_dict[key] = self.sort_recursive_dict(d[key])
            else:
                sorted_dict[key] = d[key]
        return sorted_dict


    def get_folder_cid(self, folder_content: dict) -> str:
        """Get the CID of a folder in IPFS.
        
        Args:
            folder_path: Path to the folder
        Returns:
            CID of the folder
        """
        is_single_depth_dict = lambda v: all(isinstance(v, str) for v in folder_content.values())
        new_folder_content = {}
        for file, content in folder_content.items():
            if isinstance(content, dict)  and len(content) > 0:
                if is_single_depth_dict(content):
                    new_folder_content[file+'/'] = self.put(content)
                else:
                    new_folder_content[file+'/'] = self.put(self.get_folder_cid(content))
            else:
                new_folder_content[file] = content
        return new_folder_content

    def dict_put(self,  k_list, v, d:Dict[str, Any]):
        """Put a value into a nested dictionary using a list of keys."""
        if len(k_list) == 0:
            return v
        key = k_list[0]
        if key not in d:
            d[key] = {}
        d[key] = self.dict_put(k_list[1:], v, d[key])
        return d
        
    # Register or update a mod in IPFS
    def key_address(self, key=None):
        key = key or 'mod'
        if isinstance(key, str):
            if self.key.valid_ss58_address(key):
                return key
            else:
                return m.key(key).address
        else:
            return (key or m.key()).address

    def cid(self, mod, key=None, default=None) -> str:
        return  self.registry().get(self.key_address(key), {}).get(mod, default)
    
    def update_registry(self, info:dict):
        if isinstance(info, str):
            info = self.get(info)
        if 'cid' in info:
            cid = info['cid']
        else:
            cid = self.add(info)
        registry = m.get(self.registry_path, {})
        mod = info['name']
        key = info['key']
        if key not in registry:
            registry[key] = {}
        registry[key][mod] = cid
        print('Registered({key}, {mod}) -> {cid}'.format(key=key, mod=mod, cid=cid))
        m.put(self.registry_path, registry)
        return cid

    def put(self, data):
        return self.store.add(data)
    add = put
    
    def get(self, cid: str) -> Any:
        return self.store.get(cid)

    def add_content(self, mod: str='store', comment=None) -> Dict[str, str]:        
        file2cid = {}
        mod = mod.lower()
        content = m.content(mod)
        for file,content in content.items():
            cid = self.add(content)
            file2cid[file] = cid
        return self.add({'data': self.add(file2cid), 'comment': comment})
    
    def add_schema(self, mod: str='store', public=False) -> str:
        try:
            return self.add(m.schema(mod, public=public))
        except Exception as e:
            return self.add({})

    def get_url(self, url: str) -> str:
        url = m.namespace().get(url, None)
        return url

    def reg_url(self, 
                    url: str, 
                    mod=None, 
                    signature = None, 
                    key=None, 
                    collateral=0.0,
                    comment=None, 
                    orbit='outer',
                    payload = False,
                    external = True) -> Dict[str, Any]:

        """
        Register a mod Mod from a URL in IPFS.
        Args:
            url: URL to fetch mod data from
            mod:  Mod str
            signature: Optional signature for verification
            key: Key object or address string
            comment: Optional comment about the registration
        Returns:
            Dictionary with registration info
        """
        if 'github.com' in url or 'gitlab.com' in url:
            mod = url.split('/')[-1].split('.git')[0] 
            # assert not m.mod_exists(mod), f'Mod {mod} already exists. Please choose a different mod name or deregister the existing mod first.'
            mod = mod.lower()
            dirpath = m.paths.orbit[orbit]
            modpath = os.path.join(dirpath, mod)
            if not os.path.exists(modpath):
                git_cmd = f'git clone --single-branch {url} {modpath}'
                os.makedirs(dirpath, exist_ok=True)
                os.system(git_cmd)
        elif self.valid_cid (url):
            self.get(url)
        else:
            raise ValueError(f'Unsupported URL for reg_from_url: {url}')
        m.tree(update=1)
        info = self.get_info(mod=mod, key=key, comment=comment, collateral=collateral)
        if payload:
            return info
        if signature == None:
            key = m.key(key)
            info['key'] = key.address
            info['signature'] = key.sign(info, mode='str')
        return self.reg_from_info(info)

    def reg_from_info(self, info: Dict[str, Any]) -> Dict[str, Any]:
        assert 'signature' in info, "Info must contain a signature for verification"
        assert self.verify_mod(info), "Mod verification failed"
        self.update_registry(info)
        return info

    def get_info(self, mod='store', key=None, comment=None, collateral=0.0, public=False, protocal='mod') -> Dict[str, Any]:
        """
        Register mod Mod data in IPFS.
        """
        current_time = m.time()
        key = self.key_address(key)
        prev_cid = self.cid(mod=mod, key=key)
        prev_info = self.mod(prev_cid, key=key) if prev_cid else {}
        content_cid = self.add_content(mod=mod, comment=comment)
        prev_content_cid = prev_info.get('content', None)
        if content_cid == str(prev_content_cid):
            prev_info.pop('cid', None)
            prev_info['collateral'] = collateral
            prev_info['protocal'] =  prev_info.get('protocal', protocal)
            return prev_info  # No changes, return existing info
        else:
            info = {
                'content': content_cid,
                'schema': self.add_schema(mod, public=public),
                'prev': prev_cid, # previous state
                'created':  prev_info.get('created', current_time),  # created timestamp
                'updated': current_time, 
                'name': prev_info.get('name', mod),  # mod name
                'collateral': collateral,
                'key': prev_info.get('key', key),
                'url': self.get_url(mod),
                'protocal': protocal,
            }
        return info

    def reg(self, 
                mod : Union[str, dict] = 'store', 
                key=None,  
                comment=None, 
                signature=None, 
                public= False,
                update=False, 
                protocal='mod'
                ) -> Dict[str, Any]:
        """
        Register or update a mod Mod in IPFS.
        Args:
            mod:  Mod str
            key: Key object or address string
            comment: Optional comment about the registration
            update: Whether to force update from IPFS
        Returns:
            Dictionary with registration info

        """
        if isinstance(mod, dict):
            return self.reg_from_info(mod)
        else:
            info = self.get_info(mod=mod, key=key, protocal=protocal, comment=comment, public=public)
            info['cid'] = self.update_registry(info) 
        return info


    def update_loop(self, sync_interval=10):
        while True:
            m.sleep(sync_interval)
            try:
                self.update()
            except Exception as e :
                print(m.detailed_error(e))

    def update(self): 
        self.mods(update=1)
    def reg_payload(self, mod: str = 'store', key=None, comment=None, collateral=0.0, protocal='mod') -> Dict[str, Any]:
        """
        Generate registration payload without executing registration.
        
        Args:
            mod: Mod str
            key: Key object or address string
            comment: Optional comment about the registration
            collateral: Collateral amount
            protocal: Protocol type
            
        Returns:
            Dictionary with registration payload ready to be signed
        """
        info = self.get_info(mod=mod, key=key, comment=comment, collateral=collateral, protocal=protocal)
        return info
 

    def sync_loop(self):
        while True:
            time.sleep(self.sync_interval)
            self.sync()

    def sync(self):
        n_tasks = len(list(self.cid2future.values()))
        if n_tasks == 0:
            return True
        else:
            print(f"Syncing {n_tasks} tasks...")
            future2path = {future: path for path, future in self.cid2future.items()}
        # check completed futures
        for future in m.as_completed(future2path.keys(), timeout=10):
            path = future2path.pop(future)
            try:
                print(f"Result({path})")
                result = future.result()
            except Exception as e:
                print(f"Error in future for path {path}: {e}")
                pass
            # remove from cid2future
            self.cid2future.pop(path, None)

    def time_since_last_sync(self) -> int:
        return m.time() - self.last_sync

    def path(self, path:str) -> str:
        """Get content from a specific path in IPFS.
        
        Args:
        """
        return self.folder_path + '/' + path

    def mods(self, search:str=None, network:str=None, key=None, update:bool=False, n:int=None, page:int=None,  **kwargs) -> List[str]:
        """
        List all registered mods in IPFS.
        Returns:
            List of mod names
        """
  

        registry = self.registry()
        key = self.key_address(key)
        if key != 'all':
            mods =  [self.mod(k, key=key) for k in registry.get(key, {}).keys()]
        else:
            mods = []
            for user_key, user_mods in registry.items():
                for mod in user_mods.keys():
                    mods.append(self.mod(mod, key=user_key))  
        mods = [m for m in mods if isinstance(m, dict) and 'name' in m]
        # only include the last part of the name
        mods = [{**m, 'name': m['name'].split('.')[-1]} for m in mods]
        if search != None:
            mods = [m for m in mods if search in m['name']]
        if network != None:
            mods = [m for m in mods if m.get('network', 'local') == network]
        if page != None and n != None:
            start = page * n
            end = start + n
            mods = mods[start:end]
        return mods

    @property
    def chain(self):
        if not hasattr(self, '_chain'):
            self._chain = m.mod('chain')()
            self._chain.name = 'chain'
            sync_fns = ['balances', 'balance']
            for fn_name in sync_fns:
                setattr(self, fn_name, getattr(self._chain, fn_name))
        return self._chain


    def timestamp2utc(self, timestamp:int) -> str:
        import datetime
        return datetime.datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')

    def versions(self, mod='app' , key=None, df=False, n=4, update=False, max_age=2) -> List[Dict[str, Any]]:

        if self.valid_cid (mod):
            mod_info = self.get(mod)
            mod = mod_info['name']
            key = mod_info['key']
        key_address = self.key_address(key)
        cache_path = self.path(f'versions/{key_address}/{mod}.json')
        result = m.get(cache_path, None, update=update, max_age=max_age)
        if result is None:
            cid = self.cid(key=key, mod=mod)
            result = []   
            current_n = 0

            if cid != None:
                while current_n < n:
                    info = self.mod(cid, key=key)
                    content =  self.get(info['content'])
                    prev_cid = info.get('prev', None)
                    result.append({'cid': info['cid'], 'comment':  content.get('comment', ''), 'updated': self.timestamp2utc(info['updated']) })
                    if prev_cid == None:
                        break
                    else:
                        cid = prev_cid
                    current_n += 1
            if len(result) > 0:
                result =  m.df(result)
                result.sort_values('updated', ascending=False, inplace=True)
                result = result[:n]
                if not df:
                    result = result.to_dict(orient='records')
            m.put(cache_path, result)
        if n != None:
            result = result[:n]

        return result

    v = versions

    def regall(self, key=None, comment=None, public=False, protocal='mod') -> Dict[str, Any]:
        """
        Register all mods in the local environment to IPFS.
        Args:
            key: Key object or address string
            comment: Optional comment about the registration
        Returns:
            Dictionary with registration info for all mods
        """
        for mod in m.mods(depth=1):
            self.reg(mod=mod, key=key, comment=comment, public=public, protocal=protocal)
        
    def registry(self,  key='all', update=False) -> Dict[str, str]:
        """
        Get the mod registry from IPFS.
        """
        registry =  m.get(self.registry_path, {}, update=update)
        if key != 'all':
            registry = registry.get(self.key_address(key), {})
        return registry
            
    def _clear(self) -> bool:
        m.put(self.registry_path, {})
        self.store._rm_all_pins()
        return {'status': 'registry cleared'}

    def schema(self, mod: m.Mod='store', key=None) -> Dict[str, Any]:
        """Get the schema of a mod Mod from IPFS.
        
        Args:
            mod: Commune Mod object
        Returns:
            Schema dictionary
        """
        fn = None
        if not isinstance(mod, dict):
            if '/' in mod:
                fn = mod.split('/')[-1]
                mod = mod.replace('/' + fn, '')
            mod  = self.mod(mod, key=key, schema=False)
        else:
            assert 'schema' in mod, "Mod dictionary must contain 'schema' key"
        
        schema =  self.get(mod['schema'])
        if fn is not None:
            schema = schema.get(fn, {})
        return schema

    def setback(self, mod:str, cid:str , key=None , safety=True) -> Dict[str, Any]:
        """
        Setback a mod Mod to a previous CID in IPFS.
        Args:
            mod: Commune Mod object
            cid: Target CID to setback to
            key: Key object or address string
        """
        mod = self.mod(mod, key=key)
        old_content = self.content(mod['cid'], expand=1)
        new_content = self.content(cid, expand=1)
        print(cid, new_content)
        dirpath = m.dp(mod['name'])
        add_dp_to_file = lambda f: os.path.join(dirpath, f)
        delete_files = [add_dp_to_file(f) for f in old_content.keys() if f not in new_content.keys()]
        new_content = { add_dp_to_file(k) : v for k, v in new_content.items()}

        # filter the new content that cant 
        write_files = list(new_content.keys())

        print(f"Setback will overwrite the current mod at {mod} with content from CID {cid}.")
        m.print(f"old_content: {old_content}")
        m.print(f"new content: {new_content}")
        m.print(f"Files to be written: {write_files}")
        m.print(f"Files to be deleted: {delete_files}")
        if safety:
            input_prompt = input(f"Setback will overwrite the current mod at {mod}. Press y to continue...")
            if input_prompt != 'y':
                return {'status': 'setback aborted by user'}
            else: 
                m.print("Proceeding with setback...", color="green")

        for k,v in new_content.items():
            m.put_text(k, self.get(v))

        for file in delete_files:
            m.rm(file)
        self.update_registry(cid)
        return {
            'old_cid': mod['cid'],
            'new_cid': cid,
            'mod': mod
        }  

    def rm_mod(self, mod: m.Mod='store', key=None) -> bool:
        """Remove a mod Mod from IPFS.
        
        Args:
            mod: Commune Mod object
        Returns:
            True if removal was successful, False otherwise
        """
        registry = self.registry()
        key = self.key_address(key)
        versions = self.versions(mod, key=key)
        for info in versions:
            cid = info['cid']
            content_info_cid = info['content']
            content_cid = self.get(content_info_cid)['data']
            schema_cid = info['schema']
            content_map = self.get(content_cid)
            for file, file_cid in content_map.items():
                self.store.rm(file_cid)
            self.store.rm(content_info_cid)
            self.store.rm(schema_cid)
            self.store.rm(cid)
        del registry[key][mod]
        m.put(self.registry_path, registry)
        return True      

    def user_keys(self, key=None) -> List[str]:
        """
        List all unique users who have registered mods in IPFS.
        """
        return list(self.registry().keys())

    def users(self, search=None, update=False,**kwargs) -> List[Dict[str, Any]]:
        """List all users who have registered mods in IPFS.
        
        Args:
            search: Optional search term to filter users
        Returns:
            List of user information dictionaries
        """
        path = self.path('users')
        users = m.get(path,  update=update)
        if users == None:
            user_keys = self.user_keys()
            users = []
            for user_key in user_keys:
                if search and search not in user_key:
                    continue
                users.append(self.user(user_key, update=update))
            m.put(path, users)
        
        return users

    def user_mods(self, key: str = None, update=False) -> List[str]:
        """List all mods registered by a specific user in IPFS.
        
        Args:
            user_address: Address of the user
        Returns:
            List of mod names   
        """

        path = self.path('users/' + self.key_address(key) + '/mods.json')
        mods = m.get( path,  update=update)
        if mods != None:
            return mods
        key = self.key_address(key)
        registry = self.registry(key)
        mods = []
        for mod in list(registry.keys()):
            info = self.mod(mod, key=key)
            if info != None:
                mods.append(info)
        m.put( path, mods)
        return mods


    def path(self, path:str) -> str:
        """Get content from a specific path in IPFS.
        
        Args:
        """
        return self.folder_path + '/' + path

    def user(self, address: str = None, update=False) -> Dict[str, Any]:
        """Get information about a specific user in IPFS.
        
        Args:
            user_address: Address of the user
        Returns:
            Dictionary with user information
        """
        address = self.key_address(address)
        path = self.path('users/' + address)
        mods = self.user_mods(address, update=update)
        user = { 
            'key': address,
            'mods': mods,
            'balance': 0,
        }
        return user
        
    user = user

    def edit(self, query:str = 'make the readme better', mod='app',  key=None,  api=None, **kwargs) -> Dict[str, Any]:
        if api != None:
            return self.call('api/edit', {'mod': mod, 'query': query}, api=api, key=key)
        m.fn('dev/forward')( query=query, mod=mod, safety=False, **kwargs)
        return self.reg(mod=mod, key=key, comment=query)

    def files(self, mod='store', search=None, **kwargs):
        files =  list(self.content(mod, expand=True, **kwargs).keys())
        if search != None:
            files = [f for f in files if search in f]
        return files

    def hardware(self) -> Dict[str, Any]:
        hardware =  m.hardware() 
        return hardware

    def __delete__(self):
        for k,thread in self.threads.items():
            print(f'Killing {k}')
            thread.kill()
        del self.threads

    def stats(self):
        return m.df(self.mods())[['name', 'key', 'created', 'updated', 'collateral', 'network', 'cid']]

    def syncenv(self):
        if not self.server_exists('ipfs'):
            m.serve('ipfs')
            m.print("IPFS node is running", color="green")

    def servers(self, *args, **kwargs) -> List[Dict[str, Any]]:
        return m.servers(*args, **kwargs)

    def server_exists(self, name: str) -> bool:
        return name in self.servers()

    def namespace(self, *args, **kwargs):
        mods = self.mods(*args, **kwargs)
        namespace = {}
        for mod in mods:
            url = mod.get('url', None)
            if url is not None:
                namespace[mod['name']] = url
        return namespace

    def n(self, *args, **kwargs):
        return len(self.mods(*args, **kwargs))

    def new(self, name='base2', base='base', key=None, orbit='outer', update=True):
        """
        make a new mod
        """
        key = self.key_address(key)
        name = name or path.split('/')[-1]
        dirpath = m.paths["orbit"][orbit] + '/'+ key+ '/'+ name.replace('.', '/')
        print(f'Creating new mod {name} at {dirpath} from base {base}')
        for k,v in m.content(base).items():
            new_path = dirpath + '/' +  k.replace(base, name)
            m.put_text( new_path, v)
        print(m.orbit())
        m.orbit(orbit, update=True)
        return {'name': name, 'path': dirpath, 'msg': 'Mod Created', 'base': base, 'cid': self.cid(name)}

    def is_owner(self, address:str):
        return m.is_owner(address)


    token_keys = ['owner', 'cost', 'time', 'data']
    token_divider = '::'
    def token_data(self, cost=0, time=None, data=None, to=None) -> Dict[str, Any]:
        token_data = {
            'owner': to or m.owner(),
            'cost': cost or 0,
            'time': int(m.time('int')),
            'data': json.dumps(data)
        }
        return self.token_divider.join([str(token_data[k]) for k in self.token_keys])
    
    def token(self, cost=0, time=None, data=None, to=None, signature=None) -> Dict[str, Any]:
        token_data = self.token_data(cost=cost, time=time, data=data, to=to)
        signature = self.key.sign(token_data, mode='str')
        return token_data + self.token_divider + signature

    def token2data(self, token: str) -> Dict[str, Any]:
        token_chunks = token.split(self.token_divider)
        assert len(token_chunks) == len(self.token_keys) + 1, "Invalid token format"
        token_data_chunks = token_chunks[:-1]
        token_dict = {k: v for k, v in zip(self.token_keys, token_data_chunks)}
        token_dict['cost'] = float(token_dict['cost'])
        token_dict['time'] = int(token_dict['time'])
        try:
            token_dict['data'] = json.loads(token_dict['data'])
        except:
            pass
        return token_dict
        
    def verify_token(self, token: str) -> bool:
        token_chunks = token.split(self.token_divider)
        assert len(token_chunks) == len(self.token_keys) + 1, "Invalid token format"
        token_data_chunks = token_chunks[:-1]
        signature = token_chunks[-1]
        token_data = self.token_divider.join(token_data_chunks)
        token_dict = {k: v for k, v in zip(self.token_keys, token_data_chunks)}
        owner = token_dict['owner']
        return m.verify(token_data, signature=signature, address=owner, mode='str')

    def test_token(self, cost=0, time=None, data=None, to=None) -> bool:
        token = self.token(cost=cost, time=time, data=data, to=to)
        assert self.verify_token(token)
        return {'token': token, 'status': 'valid', 'token_data': self.token2data(token)}

    def wait_for_task(self, task, wait_frequency=0.2):
        task_path =  self.task_path(task)
        print(f'Waiting for task {task_path} status={task.get("status","pending")}')
        while task.get('status', '') != 'success':
            time.sleep(wait_frequency)
            task = self.get(task_path, default={})
            if task.get('status', '') == 'error':
                raise Exception(f'Task {task_path} failed with error: {task.get("result","unknown error")}   ')
        return task
        


    def get_fns(self, 
                mod:str, 
                helper_fns:List[str]=['info', 'forward'],
                fn_attributes = ['endpoints',  'fns', 'expose',  'exposed', 'functions', 'fns', 'expose_fns']):
        fns = []
        config = m.config(mod) or {}

        mod_obj = m.mod(mod)
        for fa in fn_attributes:
            if fa in config: 
                fns = config[fa]
            if hasattr(mod_obj, fa) and isinstance(getattr(mod_obj, fa), list):
                fns = getattr(mod_obj, fa) 
            if len(fns) > 0:
                break
        fns =  list(set(fns + helper_fns))
        return fns
