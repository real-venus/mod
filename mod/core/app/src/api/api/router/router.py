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

class Router:
    threads = {}
    cid2future = {}

    folder_path = m.abspath('~/.mod/api/router')
    def __init__(self, store='ipfs', key=None, auth='auth.v0'):
        self.store = store
        self.key = m.key(key )
        self.calls_path = self.path('calls')
        self.auth = m.mod(auth)()
        self.threads['sync'] = m.thread(self.sync_loop)

        
    def path(self, path:str) -> str:
        """Get content from a specific path in IPFS.
        
        Args:
        """
        return self.folder_path + '/' + path

    def call(self , 
                fn: str = 'api/edit',  
                params: Dict[str, Any] = {}, 
                token = None, 
                wait=False,
                key = None,
                return_cid = False,
                timeout=1000, **extra_params) -> Any:
        """
        Call a function from a mod Mod in IPFS.
        Args:
            mod: mod Mod object
            fn: Function name to call
            params: Parameters for the function call
            key: Key object or address string
        Returns:
            Result of the function call
        """
        task = self.task_data( fn=fn, params=params, timeout=timeout)
        if token == None:
            token = self.auth.token(data=task, key=self.key)
        task['key'] =  self.auth.verify(token)['key']
        task['token'] = token
        task['cid'] = self.store.put(task)
        m.put(self.task_path(task), task)
        future =  m.submit(self.run_task, params=task ,  timeout=timeout)
        self.cid2future[task['cid']] = future
        if wait:
            result =  future.result()
            if return_cid:
                return result
            return self.store.get(self.store.get(result).get('result', None))
        return task


    def task_path(self, data): 
        path = f'{self.calls_path}/{data["fn"]}/{data["time"]}.json'
        return m.relpath(path)

    def _clear_calls(self):
        shutil.rmtree(self.calls_path) if os.path.exists(self.calls_path) else None
        assert len(self.call_paths()) == 0, "Failed to clear call paths"
        return True
    

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
                        call['result'] = self.store.get(call['result'])
                    except:
                        pass
                if 'params' in call:
                    try:
                        call['params'] = self.store.get(call['params'])
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


    def call_paths(self):
        return glob.glob(self.calls_path+'/**/*.json', recursive=True)

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
        return {
            'fn': fn,
            'params': params,
            'time': time,
            'cost': cost, 
            'key': self.key.address,
        }


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

    
    def sync_loop(self, sync_interval=5):
        while True:
            time.sleep(sync_interval)
            self.sync()

    def wait_for_task(self, task, wait_frequency=0.2):
        task_path =  self.task_path(task)
        print(f'Waiting for task {task_path} status={task.get("status","pending")}')
        while task.get('status', '') != 'success':
            time.sleep(wait_frequency)
            task = self.store.get(task_path, default={})
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
            params =  self.store.get(task['params'])
        assert isinstance(params, dict)
        m.put(path, task)
        # avoid recursion
        assert not task['fn'].endswith('/call'), "Function name cannot end with '/call'"
        try:
            mod_name , fn_name = task['fn'].split('/', 1)
            if mod_name in m.servers():
                result = m.fn('client/call')(fn=task['fn'], params=params, timeout=task['timeout'])
            else:
                assert mod in m.config('api').get('expose_mods', []), f'Mod {mod_name} is not exposed via the API'
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
        task['result'] = self.store.put(result)
        task['delta'] = m.time() - task['time']
        task['owner'] = self.key.address
        task['request_cid'] = m.copy(task['cid'])
        task['owner_token'] = self.auth.token(data=task, key=self.key)
        task['cid'] = self.store.put(task)
        m.put(path, task)
        return task['cid']
        

    @property
    def store(self):
        if not hasattr(self, '_store'):
            self._store = m.mod(self._store_path)()
        return self._store
    
    @store.setter
    def store(self, store):
        # set the store mod
        if isinstance(store, str):
            self._store_path = store
        else: 
            self._store = store
        return {'store': self._store_path}
    

    def task_data(self , 
                fn: str = 'store/ls',  
                params: Dict[str, Any] = {}, 
                cost = 1,
                timeout=1000,
                ) -> Dict[str, Any]:

        if self.store.valid_cid(fn):
            task = self.store.get(fn)
            fn = task['fn']
            params = task['params']
        else:
            fn = fn + '/info' if '/' not in fn else fn
        if isinstance(params, dict):
            params = self.store.put(params)
        return  {
            'fn': fn,
            'params': params,       
            'timeout': timeout,  
            'status': 'pending',
            'time': m.time(), 
            'cost': cost,
        }
