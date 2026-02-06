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


    def __init__(self, store='ipfs', key=None, auth='auth.v0', chain='chain'):
        self.store = store
        self.key = m.key(key )
        self.calls_path = self.path('calls')
        self.chain = m.mod(chain)()
        self.auth = m.mod(auth)()
        self.threads['sync'] = m.thread(self.sync_loop)

    def get(self, cid: str) -> Dict[str, Any]:
        return self.store.get(cid)
    
    def put(self, data: Dict[str, Any]) -> str:
        return self.store.put(data)


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
                owner = None,
                return_cid = False,
                timeout=1000, 
                **extra_params) -> Any:
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
        task['key'] =  self.auth.verify(token)['key']
        task['token'] = token
        mod_name = '/'.join(fn.split('/')[:-1]) if '/' in fn else fn
        task['owner'] = owner or m.info(mod_name)['key'] 
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

    def call_paths(self, max_age= None):
        paths =  glob.glob(self.calls_path+'/**/*.json', recursive=True)
        if max_age is not None:
            current_time = time.time()
            filtered_paths = []
            for path in paths:
                file_mod_time = os.path.getmtime(path)
                if (current_time - file_mod_time) <= max_age:
                    filtered_paths.append(path)
            paths = filtered_paths
        return paths

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


    last_time_sync = 0

    def sync_info(self):
        fns = ['sync_tasks', 'sync_ious']
        sync_info = {}
        for fn in fns:
            last_time = m.get(self.path('last_time_' + fn)) or 0
            sync_info[fn] = {
                'last_time': last_time,
                'since_last': int(m.time() - last_time),
                'interval': self.intervals.get(fn, None),
                'count': self.sync_counts.get(fn, 0),
            }
        return sync_info
    

    def n_tasks(self):
        return len(list(self.cid2future.values()))
    
            
    def sync_tasks(self):
        self.last_time_sync = m.time()
        n_tasks = self.n_tasks()
        if n_tasks == 0:
            return True
        else:
            future2path = {future: path for path, future in self.cid2future.items()}

        for future in m.as_completed(future2path.keys(), timeout=10):
            path = future2path.pop(future)
            try:
                print(f"Result({path})")
            except Exception as e:
                print(f"Error in future for path {path}: {e}")
                pass
            # remove from cid2future
            self.cid2future.pop(path, None)

    intervals = {
        'sync_loop': 1,
        'sync_tasks': 5,
        'sync_ious': 10,
    }
    sync_counts = {}
    def sync_loop(self):



        def cansync(name: str, interval:int=10) -> bool:
            current_time = m.time()
            interval = self.intervals.get(name, interval)
            path = self.path('last_time_' + name)
            last_time = float(m.get(path, 0))
            time_lapsed = current_time - last_time
            result = bool(time_lapsed > interval)
            if result:
                m.put(path, current_time)
            print(f'Can sync {name}? {result} (time lapsed: {time_lapsed:.2f}s, interval: {interval}s)')
            return result
    
        while True:
            print('running loop')
            time.sleep(self.intervals['sync_loop'])
            fns = ['sync_tasks', 'sync_ious']
            for fn in fns:
                if cansync(fn):
                    try:
                        print(f'running {fn}')
                        getattr(self, fn)()
                        self.sync_counts[fn] = self.sync_counts.get(fn, 0) + 1
                    except Exception as e:
                        print(f'Error in sync_loop for {fn}: {e}')
                        continue
                    

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
    
    def is_tx_settled(self, tx):
        return 'payment_hash' in tx
    
    def ious(self, cost_only=False):
        ious  = {}
        for tx in self.txs(df=0):
            if tx['status'] != 'success':
                continue
            if not 'owner' in tx or tx['owner'] is None:
                continue
            if self.is_tx_settled(tx):
                continue
            if 'cid' not in tx:
                tx['cid'] = self.store.put(tx)
            cid = tx['cid']
            tx = self.get(cid)

            # from and to 
            
            if not tx['key'] in ious:
                ious[tx['key']] = {}
            if not tx['owner'] in ious[tx['key']]:
                ious[tx['key']][tx['owner']] = []
            tx['cid'] = cid
            print(f'Adding IOU tx: client={tx["key"]} provider={tx["owner"]} cost={tx["cost"]} cid={cid}')
            ious[tx['key']][tx['owner']] += [tx]

        if cost_only:
            for client in ious.keys():
                for owner in ious[client].keys():
                    total_cost = sum([tx['cost'] for tx in ious[client][owner]])
                    ious[client][owner] = total_cost
        return ious
    

    def update_tx(self, tx, new_data: dict):
        tx_data = self.get(tx['cid'])
        tx_data.update(new_data)
        if not 'path' in tx:
            tx['path'] = self.task_path(tx)
        tx_data['cid'] = self.store.put(tx_data)
        m.put(tx['path'], tx_data)
        return tx_data

    def sync_ious(self):
        for client, prov2txs in  self.ious().items():
            for prov, txs in prov2txs.items():
                amount = sum([tx['cost'] for tx in txs])
                payment_hash = self.chain.debit(client, prov, amount)
                print(f'Syncing IOU: Debiting {amount} from {client} to {prov} for {len(txs)} txs --> tx: {payment_hash}')
                for tx in txs:
                    self.update_tx(tx, {'payment_hash': payment_hash})
                    print(f'Synced tx: {tx["cid"]}')

        return True
    

