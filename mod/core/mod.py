
import os
import sys
import json
import time
import glob
import shutil
import inspect
import logging
from typing import Any, Dict, List, Optional, Union
from functools import partial

import yaml

logger = logging.getLogger(__name__)

class Mod: 

    orbits = [ 'core',  'inner', 'outer']
    name = 'mod'
    orbit2depth = {
        'inner': 10,
        'outer': 5,
        'core': 10,
        # 'local': 4
        }

    # we are going to avoid these folders when listing files
    _avoid_folders = frozenset(['__pycache__', '.git', '.ipynb_checkpoints', 'node_modules', 'egg-info', 'private', '.venv', 'venv', '.env'])
    _default_file_types = ('py', 'json', 'sol')
    _default_anchor_names = ('agent', 'mod', 'block')
    lib_name = __file__.split('/')[-2] # mod/core/mod.py -> mod 

    def __init__(self, 
                  config = None,
                  **kwargs):
        """
        Initialize the mod by sycing with the config
        """
        if os.getcwd() in [os.path.expanduser('~'), '/']:
            raise ValueError(f'For your safety we do not allow syncing in the home directory {os.getcwd()}, please cd into a project directory like cd mod or cd mymod')
        
        
        self.paths = {}
        self.paths["mod"] = self.mod_path =os.path.dirname(os.path.dirname(__file__))
        self.paths["lib"]  = self.lib_path = os.path.dirname(self.paths["mod"]) # the path to the repo
        self.paths['orbit'] = {
            "inner": f'{self.mod_path}/orbit',
            "outer": f'{self.mod_path}/orbit/_outer',
            "core": self.mod_path + '/core',
            "local": os.getcwd()
        }

        # if any of the orbits do not exist create them
        for orbit, path in self.paths['orbit'].items():
            if not os.path.exists(path):
                os.makedirs(path, exist_ok=True)
        self.paths['home'] = self.homepath  = os.path.expanduser('~')
        self.paths = self.munch(self.paths)
        # Instance-level copy to avoid mutating class state (must be before self.config() which uses files())
        self.avoid_folders = set(self._avoid_folders)
        config = self.config()
        self.name  = config['name']
        self.storage_path = f'{self.homepath}/.{self.name}'
        self.port_range = config['port_range']
        self.expose = self.endpoints = config['expose']
        self.file_types = list(self._default_file_types)
        self.anchor_names = list(self._default_anchor_names) + [self.name]
        self.set_routes(self.routes())

    def get_ports(self, n: int = 3) -> list:
        port_range = self.get_port_range()
        used_ports = set(self.used_ports())
        available_ports = [p for p in range(port_range[0], port_range[1]) if p not in used_ports]
        if len(available_ports) < n:
            raise RuntimeError(f'Not enough available ports in range {port_range}, only {len(available_ports)} available')
        return available_ports[:n]

    def munch(self, d:dict) -> Any:
        from munch import Munch
        if isinstance(d, dict):
            for k,v in d.items():
                d[k] = self.munch(v)
            return Munch(d)
        elif isinstance(d, list):
            return [self.munch(i) for i in d]
        else:
            return d

    def get_port_range(self, port_range: list = None) -> list:
        if port_range is None:
            port_range = self.get('port_range', [])
        if isinstance(port_range, str):
            port_range = list(map(int, port_range.split('-')))
        if len(port_range) == 0:
            port_range = self.port_range
        port_range = list(port_range)
        if not isinstance(port_range, list) or len(port_range) < 2:
            raise ValueError('Port range must be a list of at least 2 integers')
        if not isinstance(port_range[0], int) or not isinstance(port_range[1], int):
            raise TypeError('Port range values must be integers')
        return port_range

    def set_routes(self, routes:dict, verbose=True):
        for mod, fns in routes.items():
            mod = self.import_mod(mod)
            for fn in fns: 
                if not hasattr(self, fn):
                    def partial_fn(mod, fn):
                        return partial(getattr(mod, fn))
                    setattr(self, fn, partial_fn(mod, fn))

    @property
    def shortcuts(self):
        shortcuts = self.config()['shortcuts']
        shortcuts[self.name] = 'mod'
        shortcuts = {k: v for k, v in shortcuts.items() if isinstance(v, str)}
        return shortcuts

    def app(self):
        if not self.server_exists('app'):
            return
        self.serve('api')
        return self.serve('app')

    _mod_cache = {}

    def addy(self, key=None):
        return self.fn('key/addy')(key)

    def add_fns(self, obj, add_fns = ['fns', 'schema', 'code', 'cid', 'edit', 'config', 'info']):
        for fn in add_fns:
            if not hasattr(obj, fn):
                setattr(obj, fn, partial(getattr(self, fn), obj=obj.__name__))
        # obj.mods = self.mods
        return obj
    def mod(self, 
                mod: str = 'mod', 
                params: dict = None,  
                cache=True, 
                verbose=False,
                update=False,
                add_fns = ['fns', 'schema', 'code'],
                **kwargs) -> str:
        """
        imports the mod core
        """
        t0 = self.time()
        mod = mod or self.name
        if mod in [self.name]:
            return Mod
        if not isinstance(mod, str):
            return mod
        name = self.get_name(mod)
        if name in self._mod_cache:
            return self._mod_cache[name]
        obj =  self.anchor_object(name)
        self._mod_cache[name] = obj
        delta = self.time() - t0
        self.print(f'mod({name} [{delta:.2f}s])', verbose=verbose)
        return obj

    def forward(self, fn:str='info', params:dict=None, auth=None) -> Any:
        params = params or {}
        # assert fn in self.endpoints, f'{fn} not in {self.endpoints}'
        if hasattr(self, fn):
            fn_obj = getattr(self, fn)
        else:
            fn_obj = self.fn(fn)
        return fn_obj(**params)

    def go(self, mod=None, **kwargs):
        path = self.dirpath(mod, relative=False)
        assert os.path.exists(self.abspath(path)), f'{path} does not exist'
        return self.cmd(f'code {path}', **kwargs)

    def about(self, mod = 'store', query='what is this?', *extra_query):
        """
        Ask a question about the mod
        """
        query = query + ' '.join(extra_query)
        return self.ask(f' {self.schema(mod)} {query}')

    def abspath(self,path:str=''):
        return os.path.abspath(os.path.expanduser(path))
        
    def filepath(self, obj=None) -> str:
        """
        get the file path of the mod
        """
        return inspect.getfile(self.mod(obj)) 

    fp = filepath

    def dockerfiles(self, mod=None):
        """
        get the dockerfiles of the mod
        """
        dirpath = self.dirpath(mod)
        dockerfiles = [f for f in os.listdir(dirpath) if f.startswith('Dockerfile')]
        return [os.path.join(dirpath, f) for f in dockerfiles]

    def vs(self, path = None):
        path = path or __file__
        path = os.path.abspath(path)
        return self.cmd(f'code {path}')

    def mod_class(self, obj=None) -> str:
        if obj is None:
            obj = self.__class__
        return obj.__name__

    def storage_dir(self, mod=None):
        mod = (mod or self.name).replace('/', '.')
        return os.path.abspath(os.path.expanduser(f'~/.{self.name}/{mod}'))
    
    def is_home(self, path:str = None) -> bool:
        """
        Check if the path is the home path
        """
        if path == None:
            path = self.pwd()
        return os.path.abspath(path) == os.path.abspath(self.homepath)

    def print(self,  *text:str,  **kwargs):
        return self.obj('mod.core.utils.print_console')(*text, **kwargs)

    def time(self, mode='float') -> float:
        import time
        t = time.time()
        if mode == 'int':
            return int(t * 1000)
        elif mode == 'float':
            return float(t)
        elif mode == 'iso':
            return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(t))
        elif 'date' in mode:
            return time.ctime(t)
        
    def pwd(self):
        return os.getcwd()

    def build(self, *args,   **kwargs):
        return self.fn(f'pm.docker/build')(*args, **kwargs)

    def is_mod_file(self, mod = None, exts=['py', 'rs', 'ts'], folder_filenames=['mod', 'agent', 'block',  'server']) -> bool:
        dirpath = self.dirpath(mod)
        try:
            filepath = self.filepath(mod)
        except Exception as e:
            self.print(f'Error getting filepath for {mod}: {e}', color='red', verbose=False)
            return False
        folder_filenames.append(mod.split('.')[-1]) # add the last part of the mod name to the folder filenames
        for ext in exts:
            for fn in folder_filenames:
                if filepath.endswith(f'/{fn}.{ext}'):
                    return False
                non_folder_name = mod.split('.')[-1]
                if filepath.endswith(f'/{non_folder_name}.{ext}'):
                    return True
        return bool(dirpath.split('/')[-1] != filepath.split('/')[-1].split('.')[0])
    
    is_file_mod = is_mod_file

    def loop(self):
        import asyncio
        return asyncio.get_event_loop()

    def get_key(self,key:str = None , **kwargs) -> None:
        return self.mod('key')().get_key(key, **kwargs)
        
    def key(self,key:str = None , **kwargs) -> None:
        return self.get_key(key, **kwargs)

    def keys(self,key:str = None , **kwargs) -> None:
        return self.get_key().keys(key, **kwargs)

    def key2address(self,key:str = None , **kwargs) -> None:
        return self.get_key().key2address(key, **kwargs)
    
    def folders(self,
            path:str = './',
            depth:Optional[int]=1,
            recursive:bool=True,
            search=None,
            include_hidden=False) -> List[str]:
        path = self.abspath(path)
        seen = set()
        result = []
        for entry in self.ls(path):
            if not self.filter_path(entry, include_hidden=include_hidden, search=search):
                continue
            if os.path.isdir(entry) and entry not in seen:
                seen.add(entry)
                result.append(entry)
                if depth > 1:
                    result.extend(self.folders(entry, depth=depth-1, search=search, include_hidden=include_hidden))
        return sorted(set(result))
            


    def files(self,
              path='./',
              search:str = None,
              include_hidden:bool = False,
              depth=10,
              **kwargs) -> List[str]:
        """
        Lists all files in the path, with single-pass filtering.
        """
        path = self.abspath(path)
        if not os.path.exists(path) and self.mod_exists(path):
            path = self.dirpath(path)
        if depth <= 0:
            return []
        result = []
        for entry in self.ls(path):
            if os.path.isdir(entry):
                result.extend(self.files(entry, search=search, include_hidden=include_hidden, depth=depth-1))
            elif os.path.isfile(entry) and self.filter_path(entry, include_hidden=include_hidden, search=search):
                result.append(entry)
        return sorted(result)

    def filter_path(self, path: str, include_hidden: bool = False, search: str = None) -> bool:
        if not include_hidden and '/.' in path:
            return False
        # Use set for O(1) lookups per folder segment
        parts = path.split('/')
        if self.avoid_folders and any(p in self.avoid_folders for p in parts):
            return False
        if search is not None and search not in path:
            return False
        return True

    def envs(self, key:str = None, **kwargs) -> None:
        return self.get_key(key, **kwargs).envs()

    def encrypt(self,data: Union[str, bytes], key: str = None, password: str = None, **kwargs ) -> bytes:
        return self.get_key(key).encrypt(data, password=password)
    def decrypt(self, data: Any,  password : str = None, key: str = None, **kwargs) -> bytes:
        return self.get_key(key).decrypt(data, password=password)
        
    def sign(self, data:dict  = None, key: str = None,  crypto_type=None, mode='str', **kwargs) -> bool:
        key = self.get_key(key, crypto_type=crypto_type)
        crypto = crypto_type or key.crypto_type
        signature =  key.sign(data, mode=mode, **kwargs)
        assert self.verify(data, signature=signature, address=key.address, crypto_type=crypto), "Invalid signature"
        return signature

    def size(self, mod) -> int:
        return len(str(self.content(mod)))

    def verify(self, data, signature=None, address=None, key=None, **kwargs ) -> bool:  
        key = self.get_key(key)
        return key.verify(data=data, signature=signature, address=address, **kwargs)

    def get_utils(self, search=None):
        utils = self.path2fns(self.paths["orbit"]["core"] + '/utils.py', tolist=True)
        if search != None:
            utils = [u for u in utils if search in u]
        return sorted(utils)
        
    def utils(self, search=None):
        return self.get_utils(search=search)

    def relpath(self, path:str = '~') -> str:
        path = os.path.abspath(os.path.expanduser(path))
        return path.replace(self.homepath, '~')

    def routes(self, obj=None):
        obj = obj or self
        routes = {}
        config = self.config()
        for util in self.get_utils():
            k = '.'.join(util.split('.')[:-1])
            v = util.split('.')[-1]
            routes[k] = routes.get(k , [])
            routes[k].append(v)
        return routes

    def set_config(self, config=None):
        if config is None:
            configs = self.config_paths(config)
            configs = sorted(configs, key=lambda x: len(x))
            if not configs:
                raise FileNotFoundError('No config file found')
            if configs[0].endswith('.json'):
                config = self.get_json(configs[0])
            elif configs[0].endswith(('.yaml', '.yml')):
                config = self.get_yaml(configs[0])
            else:
                raise ValueError(f'Unknown config format: {configs[0]}')
        return config

    

    def save_config(self, mod:str, config:dict):
        paths = self.config_paths(mod)
        if len(paths) == 0:
            path = self.dp(mod) + '/config.json'
        else:
            path = paths[0]
        
        assert path != None, 'No config path found'
        if path.endswith('.json'):
            with open(path, 'w') as f:
                json.dump(config, f, indent=4)
        elif path.endswith('.yaml') or path.endswith('.yml'):
            with open(path, 'w') as f:
                yaml.dump(config, f)
        return path

    def put_json(self, 
                 path:str, 
                 data:Dict, 
                 meta = None,
                 verbose: bool = False,
                 **kwargs) -> str:
        path = self.abspath(path + '.json' if not path.endswith('.json') else path)
        if isinstance(data, dict):
            data = json.dumps(data)
            self.put_text(path, data)
        return path

    def env(self, key: str = None) -> Union[str, dict, None]:
        """
        Get environment variable(s). If key is provided, returns that value.
        """
        if key is not None:
            return os.environ.get(key)
        return dict(os.environ)

    def rm(self, path: str, possible_extensions: list = None, avoid_paths: list = None) -> dict:
        """
        Remove a file or directory safely.
        """
        if possible_extensions is None:
            possible_extensions = ['json']
        if avoid_paths is None:
            avoid_paths = ['~', '/']
        path = self.abspath(path)
        safe_paths = set(map(self.abspath, avoid_paths))
        if path in safe_paths:
            raise PermissionError(f'Cannot remove protected path: {path}')
        if not os.path.exists(path):
            for ext in possible_extensions:
                candidate = f'{path}.{ext}'
                if os.path.exists(candidate):
                    path = candidate
                    break
            else:
                return {'success': False, 'message': f'{path} does not exist'}
        if os.path.isdir(path):
            shutil.rmtree(path)
        elif os.path.isfile(path):
            os.remove(path)
        if os.path.exists(path):
            raise OSError(f'Failed to remove {path}')
        return {'success': True, 'message': f'{path} removed'}
    
    def glob(self, path:str='./', depth:Optional[int]=4, recursive:bool=True, files_only:bool = True, include_hidden=False):
        path = self.abspath(path)
        if depth > 0:
            paths = []
            for path in self.ls(path):
                if os.path.isdir(path):
                    paths += self.glob(path, depth=depth-1)
                else:
                    paths.append(path)
        else:
            return []
        if files_only:
            paths =  list(filter(lambda f:os.path.isfile(f), paths))
        if not include_hidden: 
            paths = [ p for p in paths if '/.' not in p]
        return paths
    
    def get_json(self, path: str, default: Any = None, **kwargs) -> Any:
        path = self.abspath(path)
        if not path.endswith('.json'):
            path = path + '.json'
        if not os.path.exists(path):
            return default
        try:
            with open(path, 'r') as file:
                data = json.load(file)
        except (json.JSONDecodeError, IOError) as e:
            logger.warning(f'Error loading json from {path}: {e}')
            return default
        return data
    
    def get_path(self, 
                     path:str = None, 
                     extension:Optional[str]=None) -> str:
        '''
        Abspath except for when the path does not have a

        if you specify "abc" it will be resolved to the storage dir
        {storage_dir}/abc, in this case its ~/.mod
        leading / or ~ or . in which case it is appended to the storage dir
        '''
        storage_dir = self.storage_dir()
        if path == None :
            return storage_dir
        if path.startswith('/'):
            path = path
        elif path.startswith('~/') :
            path = os.path.expanduser(path)
        elif path.startswith('.'):
            path = os.path.abspath(path)
        else:
            if storage_dir not in path:
                path = os.path.join(storage_dir, path)
        if extension != None and not path.endswith(extension):
            path = path + '.' + extension
        return path

    def put_text(self, path:str, text:str, key=None, password=None) -> None:
        # Get the absolute path of the file
        path = self.abspath(path)
        dirpath = os.path.dirname(path)
        if not os.path.exists(dirpath):
            os.makedirs(dirpath, exist_ok=True)
        if not isinstance(text, str):
            text = self.python2str(text)
        if key != None:
            text = self.get_key(key).encrypt(text, password=password)
        # Write the text to the file
        with open(path, 'w') as file:
            file.write(text)
        # get size
        return {'success': True, 'path': f'{path}', 'size': len(text)*8}


    write = get_path
    
    def ls(self, path:str = './', 
           search = None,
           include_hidden = False, 
           depth=None,
           return_full_path:bool = True):
        """
        provides a list of files in the path 
        this path is relative to the mod path if you dont specifcy ./ or ~/ or /
        which means its based on the mod path
        """
        path = self.abspath(path)
        try:
            ls_files = os.listdir(path)
        except Exception as e:
            return []
        if return_full_path:
            ls_files = [os.path.abspath(os.path.join(path,f)) for f in ls_files]
        ls_files = sorted(ls_files)
        
        if search != None:
            ls_files = list(filter(lambda x: search in x, ls_files))

        return ls_files

    def put(self, 
            k: str, 
            v: Any,  
            encrypt: bool = False, 
            password: str = None, **kwargs) -> Any:
        '''
        Puts a value in the config
        '''
        k = self.get_path(k)
        encrypt = encrypt or password != None
        if encrypt or password != None:
            v = self.encrypt(v, password=password)
        data = {'data': v, 'encrypted': encrypt, 'timestamp': time.time()}    
        return self.put_json(k, data)

    def iscid(self, text: str) -> bool:
        '''
        Check if the text is an ipfs hash
        '''
        return isinstance(text, str) and (text.startswith('Qm') and len(text) == 46)
    
    def get(self,
            k:str, 
            default: Any=None, 
            max_age:str = None,
            update :bool = False,
            password : str = None,
            verbose = False,
            **kwargs) -> Any:
        
        '''
        Puts a value in sthe config, with the option to encrypt it
        Return the value
        
        '''
        
        if self.iscid(k):
            return self.fn('ipfs/get')(k)

        k = self.get_path(k)
        data = self.get_json(k, default=default, **kwargs)
        if password != None:
            assert data['encrypted'] , f'{k} is not encrypted'
            data['data'] = self.decrypt(data['data'], password=password)
        data = data or default
        if not isinstance(data, dict):
            return default
        if update:
            return default
        if max_age != None:
            # check if the data is expired
            timestamp = 0
            for k in ['timestamp', 'time']:
                if k in data:
                    timestamp = data[k]
                    break
            expired =  (time.time() - float(timestamp)) > max_age
            if expired:
                return default
        if isinstance(data, dict) and 'data' in data:
            return data['data']
        else: 
            return data

    def get_text(self, path: str, **kwargs ) -> str:
        # Get the absolute path of the file
        path = self.abspath(path)
        from .utils import get_text
        return get_text(path, **kwargs)

    def text(self, path: str = './', **kwargs ) -> str:
        # Get the absolute path of the file
        path = self.abspath(path)
        assert not self.homepath == path, f'Cannot read {path}'
        if os.path.isdir(path):
            return self.file2text(path)
        with open(path, 'r') as file:
            content = file.read()
        return content

    def sleep(self, period):
        time.sleep(period) 


    def fnschema(self, fn:str = '__init__', public=True, avoid_arguments = ['self', 'cls'],**kwargs)->dict:
        '''
        Get function schema of function in self
        ''' 
        fn_obj = self.fn(fn)
        if not callable(fn_obj):
            return {'fn_type': 'property', 'type': type(fn_obj).__name__}
        
        fn_signature = inspect.signature(fn_obj)

        schema = {'input': [], 'output': {}, 'docs': '', 'cost': 0, 'name': '',  'content': None}
        if public:
            schema['content'] = inspect.getsource(fn_obj)
        for i, (k,v) in enumerate(dict(fn_signature._parameters).items()):
            if k  in avoid_arguments:
                continue
            else:
                schema['input'].append({
                        'name': k,
                        'value': "_empty"  if v.default == inspect._empty else v.default, 
                        'type': '_empty' if v.default == inspect._empty else str(type(v.default)).split("'")[1] 
                })

        # OUTPUT SCHEMA
        schema['output'] = {
            'value': None,
            'type': str(fn_obj.__annotations__.get('return', None) if hasattr(fn_obj, '__annotations__') else None)
        }
        schema['docs'] = fn_obj.__doc__
        schema['cost'] = 0 if not hasattr(fn_obj, '__cost__') else fn_obj.__cost__ # attribute the cost to the function
        schema['name'] = fn_obj.__name__

        return schema

    def args(self, fn:str = '__init__', public=True, avoid_arguments = ['self', 'cls'],**kwargs)->dict:
        '''
        Get function schema of function in self
        '''   
        return self.fnschema(fn, public=public, avoid_arguments=avoid_arguments, **kwargs)['input']
    
    

    def schema(self, obj = None , search=None , public=True, return_mode='dict',  verbose=False, **kwargs)->dict:
        '''
        Get function schema of function in self
        '''   
        schema = {}
        obj = obj or 'mod'
        public = bool(public)
        if callable(obj) or (isinstance(obj, str) and '/' in obj):
            return self.fnschema(obj, public=public, **kwargs)

        print(f'Getting schema for mod {obj}')
        fns = self.fns(obj, search=search, **kwargs)
        obj = self.mod(obj)
        schema = {}
        for fn in fns:
            try:
                schema[fn] = self.fnschema(getattr(obj, fn), public=public,  **kwargs)
            except Exception as e:
                print(self.error(e)) if verbose else None
        if return_mode == 'list':
            return list(schema.values())
        elif return_mode == 'dict':
            return schema
        else: 
            raise Exception('Invalid return mode', return_mode)
        return schema

    def code(self, obj = None,  **kwargs) -> Union[str, Dict[str, str]]:

        if '/' in str(obj):
            obj = self.fn(obj)
        elif self.mod_exists(obj):
            obj = self.mod(obj)
        elif hasattr(self, obj):
            obj = getattr(self, obj)
        elif self.obj_exists(obj):
            obj = self.obj(obj)
        return  inspect.getsource(obj)
    
    def call(self,_fn: str = 'api/edit',  params: Dict[str, Any] = {}, timeout=30, wait=True,  **_kwargs): 
        params = {**params , **_kwargs} 
        params = { 'fn': _fn, 'params': params }
        token = self.fn('api/token')()
        return self.fn('client/call')('api/call', params=params, timeout=timeout, wait=wait,  token=token)

    def cache(self, path:str, max_age: int = 60, default=None, directory: str = '~/.mod/cache'):
        '''
        Cache the result of the function for a certain time
        '''
        def decorator(func):
            def wrapper(*args, **kwargs):
                # fn id string 
                fn_id = func.__module__ + '.' + func.__name__
                cache_path = self.abspath(f'{directory}/{fn_id}/{args}_{kwargs}')
                result = self.get(cache_path, default, max_age=max_age)
                if result is not None:
                    return result
                result = func(*args, **kwargs)
                self.put(cache_path, result)
                return result
            return wrapper
        return decorator

    def update(self):
        tree = self.tree(update=1)
        n = len(tree)
        return {'success': True, 'message': 'Mod tree updated', 'mods': n, 'orbits':self.paths['orbit'].toDict(), 'orbit2depth': self.orbit2depth}


    def key_address(self, key:str = None , **kwargs) -> str:
        return self.get_key(key).key2address(**kwargs).get(key, key)
    

    def mod_files(self, mod = 'store' , search=None, **kwargs) ->  List[str]:
        """
        Get the file paths for a given mod directory.
        """
        return self.files(self.dirpath(mod), search=search, **kwargs)

    def content(self, mod = None , ignore_folders = [], depth=10,   **kwargs) ->  Dict[str, str]:
        """
        get the content of the mod as a dict of file path to file content
        return a dict of file path to file content
        """
        mod = mod or 'mod'
        dirpath = self.abspath(self.dirpath(mod))
        files = self.files(dirpath, depth=depth)
        content = {}
        for k in files:
            try:
                content[k] = self.text(k)
            except Exception as e:
                content[k] = str(self.error(e))
        content = {k[len(dirpath+'/'):]:v for k,v in content.items()}
        content = {k:v for k,v in content.items() if not any(['/'+f+'/' in k for f in ignore_folders])}
        return dict(sorted(content.items(), key=lambda item: item[0]))

    def content_files(self, mod = 'store' , **kwargs) ->  Dict[str, str]:
        """
        get the content of the mod as a dict of file path to file content
        return a dict of file path to file content
        """
        return list(self.content(mod=mod, **kwargs).keys())
    cont = codemap = content

    def dir(self, obj=None, search=None, *args, **kwargs):
        obj = self.obj(obj)
        if search is not None:
            return [f for f in dir(obj) if search in f]
        return dir(obj)
    
    def fns(self, obj: Any = None,
                      search = None,
                      include_hidden = False,
                      include_children = False,
                      **kwargs) -> List[str]:
        '''
        Get a list of functions in a class (in text parsing)
        Args;
            obj: the class to get the functions from
            include_parents: whether to include the parent functions
            include_hidden:  whether to include hidden functions (starts and begins with "__")
        '''
        obj = self.mod(obj)()
        fns = dir(obj)
        fns = sorted(list(set(fns)))
        if search != None:
            fns = [f for f in fns if search in f]
        if not include_hidden: 
            fns = [f for f in fns if not f.startswith('__') and not f.startswith('_')]  
        return sorted(fns)
    
    def cid(self, mod=None , **kwargs) -> Union[str, Dict[str, str]]:
        """
        get the cid of the mod
        """
        return self.fn('api/put')(self.content(mod, **kwargs))

    def mods(self, search=None,  startswith=None, endswith=None, **kwargs)-> List[str]:  
        return list(self.tree(search=search, endswith=endswith, startswith=startswith , **kwargs).keys())

    am = ms = mods

    def core_mods(self, *args,  **kwargs) -> List[str]:
        return list(self.core_tree(*args,orbit='core', **kwargs).keys())
    cm = cmods = core_mods

    def local_mods(self) -> List[str]:
        return list(self.orbit('local').keys())
    lm = lmods = local_mods

    _api = None
    def info(self, 
            mod:str='mod',  # the mod to get the info of
            schema = False, # whether to include the schema of the mod
            key = None, # the key to sign the info with
            public=False,
            **kwargs):
        """
        Get the info of a mod, including its schema, key, cid, and code if specified.
        """
        if self._api == None:
            self._api = self.mod('api')()
        api = self._api         
        if not api.exists(mod, key=key):
            api.reg(mod=mod, key=key, public=public)
        return api.mod(mod=mod, schema=schema,  key=key,  **kwargs)

    card = info 

    def desc(self, mod='mod', **kwargs):
        return self.fn('desc/')(mod, **kwargs)
    
    def txs(self, **kwargs):
        return self.df(self.call('api/txs', df=0, **kwargs))

    def verify_info(self, info:Union[str, dict]=None, **kwargs) -> bool:
        """
        verify the info of the mod
        """
        if isinstance(info, str):
            info = self.info(info, **kwargs)
        signature = info.pop('signature')
        verify = self.verify(data=info, signature=signature, address=info['key'])  
        assert verify, f'Invalid signature {signature}'
        info['signature'] = signature
        return info

    def pwd2key(self, pwd, **kwargs) -> str:
        return self.mod('key')().str2key(pwd, **kwargs)

    _executors = {}
    
    def submit(self, 
                fn, 
                params = None,
                timeout:int = 40, 
                mod: str = None,
                mode:str='thread',
                max_workers : int = 100,
                ):
        executor = self.executor(mode=mode, max_workers=max_workers)
        if mode == 'thread':
            future = executor.submit(self.fn(fn), params=params, timeout=timeout)
        else:
            future =  executor.submit(self.fn(fn), *args, **kwargs)
        return future 

    future = fut = submit

    fnscache = {}
    modscache = {}
    def fn(self, fn:Union[callable, str], params:str=None, splitter='/', default_fn='forward', default_mod = 'mod') -> 'Callable':
        """
        Gets the function from a string or if its an attribute 
        """
        fn_name = fn if isinstance(fn, str) else fn.__name__
        if callable(fn):
            return fn
        elif hasattr(self, fn):
            fn_obj = getattr(self, fn)
        else:
            if fn.startswith('/'):
                mod_name = default_mod
                fn_name = fn[1:]
            elif fn.endswith('/'):
                mod_name = fn[:-1].split('/')[0] if '/' in fn[:-1] else fn[:-1]
                fn_name = default_fn
            elif '/' in fn:
                mod_name, fn_name = fn.split('/')
            elif self.mod_exists(fn):
                mod_name = fn
                fn_name = default_fn
            else:
                raise Exception(f'Function {fn} not found')

            if mod_name in self.modscache:
                mod = self.modscache[mod_name]
            else:
                mod = self.modscache[mod_name] = self.mod(mod_name)()
            fn_obj = getattr(mod, fn_name)

        if params:
            return fn_obj(**params)
        return fn_obj
    
    get_fn = fn

    def get_args(self, fn) -> List[str]:
        """
        get the arguments of a function
        params:
            fn: the function
        """        
        if not callable(fn):
            return []
        try:
            args = inspect.getfullargspec(fn).args
        except Exception as e:
            args = []
        return args

    def hosts(self):
        return self.fn('remote/hosts')()


    def host(self):
        return self.key().address

    def how(self, mod, query, *extra_query) : 
        code = self.code(mod)
        query = ' '.join([query, *extra_query])
        return self.fn('model.openrouter/')(f'query={query} code={code}')

    def client(self, *args, **kwargs) -> 'Client':
        """
        Get the client for the mod
        """
        return self.fn('client/client')( *args, **kwargs)
    
    def classes(self, path='./',  **kwargs):
        """
        Get the classes for each path inside the path variable
        """
        path2classes = self.path2classes(path=path,**kwargs)
        classes = []
        for k,v in path2classes.items():
            classes.extend(v)
        return classes  

    def mnemonic(self, words=24):
        """
        Generates a mnemonic phrase of the given length.
        """

        if words not in [12, 15, 18, 21, 24]:
            if words > 24 : 
                # tile to over 24
                tiles = words // 24 + 1
                mnemonic_tiles = [self.mnemonic(24) for _ in range(tiles)]
                mnemonic = ' '.join(mnemonic_tiles)
            if words < 24:
                # tile to under 12
                mnemonic = self.mnemonic(24)
            return ' '.join(mnemonic.split()[:words])
        return self.mod('key')().generate_mnemonic(words=words)

    
    def path2objectpath(self, path:str, **kwargs) -> str:
        """
        Converts a path to an object path (for instance ./foo/bar.py to foo.bar)
        """
        path = os.path.abspath(path)
        dir_prefixes  = [self.paths["lib"], os.getcwd()]
        for dir_prefix in dir_prefixes:
            if path.startswith(dir_prefix):
                path =   path[len(dir_prefix) + 1:].replace('/', '.')
                break
        if any([path.endswith(s) for s in ['.py']]):
            path = path[:-3]
        return path.replace('__init__.', '.')

    def path2name(self,
                    path:str , 
                    ignore_folder_names = ['mods', 'agents', 'src', 'mods'], 
                    possible_suffixes = ['_', '']):
    
        ignore_folder_names = [ f + s for f in ignore_folder_names for s in possible_suffixes]
        name = self.path2objectpath(path)
        name_chunks = []
        for chunk in name.split('.'):
            if chunk in ignore_folder_names:
                continue
            if chunk not in name_chunks:
                name_chunks += [chunk]
        if len(name_chunks) > 0:
            if name_chunks[0] == self.name:
                name_chunks = name_chunks[1:]
        else:
            return self.name
        return '.'.join(name_chunks)
    
    def path2classes(self, path='./', depth=4, tolist = False, **kwargs) :

        """
        Get the classes for each path inside the path variable
        params:
        - path: The path to search for classes
        - depth: The maximum depth to search
        - tolist: Whether to return a list of classes or a dict

        returns:
        - if tolist is True, returns a list of classes
        """
        class_suffix = ':', 
        class_prefix = 'class '
        path = self.abspath(path)
        path2classes = {}
        if os.path.isdir(path) and depth > 0:
            for p in self.ls(path):
                try:
                    for k,v in self.path2classes(p, depth=depth-1).items():
                        if len(v) > 0:
                            path2classes[k] = v
                except Exception as e:
                    pass
        elif os.path.isfile(path) and any([path.endswith(s) for s in ['.py']]):
            classes = []
            code = self.get_text(path)
            objectpath = self.path2objectpath(path)
            for line in code.split('\n'):
                if line.startswith(class_prefix) and line.strip().endswith(class_suffix):
                    new_class = line.split(class_prefix)[-1].split('(')[0].strip()
                    if new_class.endswith(class_suffix):
                        new_class = new_class[:-1]
                    if ' ' in new_class:
                        continue
                    classes += [new_class]
            if objectpath.startswith(path):
                objectpath = objectpath[len(path)+1:]
            objectpath = objectpath.replace('/', '.')
            path2classes =  {path:  [objectpath + '.' + cl for cl in classes]}
        if tolist:
            classes = []
            for k,v in path2classes.items():
                classes += v
            return classes
        return path2classes

    def path2fns(self, path = './', tolist=False,**kwargs):
        path2fns = {}
        fns = []
        path = os.path.abspath(path)
        if os.path.isdir(path):
            for p in glob.glob(path+'/**/**.py', recursive=True):
                for k,v in self.path2fns(p, tolist=False).items():
                    if len(v) > 0:
                        path2fns[k] = v
        else:
            code = self.get_text(path)
            path_prefix = self.path2objectpath(path)
            for line in code.split('\n'):
                if line.startswith('def ') or line.startswith('async def '):
                    fn = line.split('def ')[-1].split('(')[0].strip()
                    fns += [path_prefix + '.'+ fn]
            path2fns =  {path: fns}
        if tolist:
            fns = []
            for k,v in path2fns.items():
                fns += v
            return fns
        return path2fns

    def ensure_syspath(self):
        """
        Ensures that the path is in the sys.path
        """
        if not hasattr(self, 'ensure_syspath_flag'):
            self.ensure_syspath_flag = False
        if not self.ensure_syspath_flag:
            import sys
            paths = [self.pwd(), self.paths["lib"]]
            for path in paths:
                if path not in sys.path:
                    sys.path.append(path)
        return {'paths': sys.path, 'success': True}      
    obj_cache = {}
    def obj(self, key:str)-> Any:
        # add pwd to the sys.path if it is not already there
        self.ensure_syspath()
        if key in self.obj_cache:
            return self.obj_cache[key]
        else:
            from .utils import import_object
            try:
                obj  = import_object(key)
            except ValueError as e:
                obj = self.import_module(key)
            except AttributeError as e:
                obj = self.import_module(key)

        self.obj_cache[key] = obj
        return obj

    def obj_exists(self, path:str)-> Any:
        # better way to check if an object exists?
        try:
            self.obj(path)
            return True
        except Exception as e:
            return False

    def mod_exists(self, mod:str, **kwargs) -> bool:
        '''
        Returns true if the mod exists
        '''
        mod_exists = False
        try:
            mod = self.get_name(mod)
            search = self.search(mod)
            if len(search) > 0:
                mod_exists =  True
        except Exception as e:
            mod_exists =  False
        if not mod_exists:
            mod_path = os.path.join(self.paths["orbit"]["inner"], mod)
            mod_exists = os.path.exists(mod_path) and os.path.isdir(mod_path)
        return mod_exists

    def logs(self, mod, pm='pm2',  **kwargs):
        return self.fn(f'{pm}/logs')(mod, **kwargs)

    def cwd(self, mod=None):
        return self.dirpath(mod) if mod else os.getcwd() 

    def anchor_file(self, path, depth=4):

        """
        desc:
            get the tree of the mod
            get the path from the tree
            search for the anchor file in the path
            assume the potential anchor files can be in the last two folders 
            names like model/openrouter/model.py or model/openrouter/openrouter.py
            return the first anchor file found
            return None if no anchor file is found

        parms: 
            path : the path to search for the anchor file
            file_types : the file types to search for
        returns:
            the anchor file path if found
        """
        path = path.replace('/', '.')
        # IF FOR SOME REASON WE ARE SPECIFYING A PATH THAT IS A FILE (NOT IN THE TREE AS THE TREE ONLY HAS FOLDERS)
        path = self.dirpath(path)

        # this is rather nuanced, but it basically says that the anchor names are the anchor names plus the path chunks
        # removing the homepath prefix
        anchor_names =  self.anchor_names.copy() + path[len(self.homepath+'/'):].split('/')
        files = self.files(path, depth=depth)
        # sort the files by length, so that the shortest file is first
        files = sorted(files, key=lambda x: len(x))

        # filter files that are in the file types
        files = [f for f in files if any([f.endswith('.' + ft) for ft in self.file_types])]

        result = None
        if len(files) == 1:
            return files[0]
        
        result_options = []
        for file_type in self.file_types:
            for anchor_name in anchor_names:
                for f in files:
                    if f.endswith('/' + anchor_name + '.' + file_type):
                        return f
        if len(result_options) > 0:
            result_options = sorted(result_options, key=lambda x: len(x))
            result = result_options[0]
            return result
        file_relative = [ f[len(path)+1:] for f in files]
        if result is None:
            raise Exception(f'No anchor file found in {path} with anchor names {anchor_names} and file types {self.file_types} {file_relative}')
        return result
        
    def anchor_object(self, path):
        path = self.get_name(path)
        anchor_file = self.anchor_file(path)
        
        if anchor_file:
            classes =  self.classes(anchor_file)
            assert len(classes) > 0, f'No classes found in {anchor_file}'
            class_obj_path = classes[-1]
            return self.obj(class_obj_path)
        else: 
            raise Exception(f'No anchor file found in {path}, ')

    af = anchor_file
    ao = anchor_object

    def get_name(self, 
                name:Optional[str]=None, 
                avoid_terms = ['src', 'mods', '_mods', 'core', 'modules', '_exp', 'ext']) -> str:
        name = name or 'mod'
        if any([name.startswith(p) for p in ['.', '~', '/']]):
            name = self.path2name(name)

        avoid_terms.extend([self.paths["orbit"]['inner'].split('/')[-1], self.paths["orbit"]['outer'].split('/')[-1]])
        name = name.replace('/', '.')
        new_name = []
        for name_chunk in name.split('.'):
            if name_chunk not in avoid_terms:
                new_name.append(name_chunk)
        name = '.'.join(new_name)
        if len(name) == 0:
            return self.name
        return name.strip('.').lower()


    def kwargs2str(self, kwargs) -> str:
        kwargs.pop('self', None)
        kwargs.pop('cls', None)
        path_chunks = []
        for k,v in kwargs.items():
            path_chunks.append(f'{k}={v}')
        path = '_'.join(path_chunks)
        return path

    _tree_file_types = ['py']
    ignore_suffixes = ['/src', '/core']
    def process_path(self, x,  ) -> str:
        for k in self.ignore_suffixes: 
            if x.endswith(k):
                x = x[:-len(k)]
        x_list =  x.split('/')
        if len(x_list) >=2 :
            if len(x_list)>2:
                if x_list[-1] == x_list[-2]: 
                    x_list = x_list[:-1]
            if len(x_list) >=3 :
                if x_list[-1] in x_list[-3]:
                    x_list = x_list[:-2]
        x = '/'.join(x_list)
        return x   
    def is_in_file_types(self, f:str) -> bool:
        return any(f.endswith('.' + ft) for ft in self.file_types)
    
    tree_cache = {}
    def get_tree(self, 
                path:Optional[str]=None, 
                search:Optional[str]=None, 
                depth=1, 
                update=False,
                key = None, 
                local_cache = True,
                **kwargs) -> Dict[str, str]: 
        """
        get the tree of the mods in the path
        params: 
            
        """
        if key is not None:
            key_address = self.key_address(key)
            path = self.paths["orbit"]["outer"] + '/' + key_address
        else:
            path = path or self.paths.orbit.core
        relpath = self.hash(self.relpath(path))
        cache_path = self.abspath(f'~/.mod/tree/{relpath}/depth_{depth}.json')
        if update:
            tree = {}
        else:
            if local_cache:
                tree = self.tree_cache.get(cache_path, {})
            else:
                tree = self.get(cache_path, {}, update=update)
        if len(tree) == 0:
            paths = self.folders(path, depth=depth)
            for p in paths:
                name = self.get_name(p)
                p = self.process_path(p)
                if name in tree:
                    if len(p) < len(tree[name]):
                        tree[name] = p
                else:
                    tree[name] = p
            tree = dict(sorted(tree.items()))
            for k,v in self.shortcuts.items():
                if v in tree:
                    tree[k] = tree[v]
            # make all the trees relative to the homepath
            tree = {k: self.relpath(v) for k,v in tree.items()}
            if local_cache:
                self.tree_cache[cache_path] = tree
            else:
                self.put(cache_path, tree)

        tree = {k: self.abspath(v) for k,v in tree.items()}
        if search:
            tree = self.search(search=search, tree=tree, key=key, **kwargs)
        if key is not None:
            print(f'Filtering tree for key {key} with address {key_address}')
            tree = {k.replace(key_address.lower() + '.', ''):v for k,v in tree.items() }
        return tree

    def core_tree(self, search=None, depth=8,  **kwargs): 
        return self.get_tree(self.paths.orbit.core, search=search, depth=depth, **kwargs) 

    def orbit(self, orbit='core', search=None, depth=None,**kwargs): 
        if depth == None:
            depth = self.orbit2depth.get(orbit, 1)
        kwargs['depth'] = depth or kwargs.get('depth', self.orbit2depth.get(orbit, 1))
        return self.get_tree(self.paths["orbit"][orbit], search=search,**kwargs)

    @staticmethod
    def filter_fn(k, search):
        k_lower = k.lower()
        v = False
        if k_lower == search:
            v =  True
        if search in k_lower:
            v =  True
        elif k_lower.endswith('.' + search):
            v =  True
        elif k_lower.startswith(search + '.'):
            v =  True
        return v

    def search(self, search=None, tree=None, depth=2, max_depth=6 , key=None, orbit='all' ,**kwargs) -> Dict[str, str]:
        """
        search the tree for a mod
        """
        search = search.lower().replace('/', '.')  
        tree = tree or self.tree(depth=depth, orbit=orbit, key=key, **kwargs)
        if search == None:
            return tree
        if key is not None:
            key_address = self.key_address(key)
            tree = {k:v for k,v in tree.items() if k.startswith(key_address)}
        # 1 exact match
        tree_options = list(filter(lambda k: self.filter_fn(k, search), tree.keys()))
        if len(tree_options) >= 1:
            tree_options =  {k: tree[k] for k in tree_options}
            tree_options = list(dict(sorted(tree_options.items(), key=lambda item: len(item[0]))).keys())
            return {k: tree[k] for k in tree_options}
        elif depth < max_depth:
            return self.search(search=search, tree=None, depth=depth+1, max_depth=max_depth, orbit=orbit, **kwargs)
        else:
            return {}



    def tree(self, 
            search=None, 
            depth=None,
            orbit = 'all', 
            key=None,
            **kwargs):
        """
        get the full tree of the mods, local and core
        """
        tree = {}

        orbits = sorted(self.orbits, reverse=True) if orbit == 'all' else [orbit]
        for orbit in orbits:
            tree.update(self.orbit(orbit, search=search, depth=depth, key=key, **kwargs))
        tree = dict(sorted(tree.items(), key=lambda item: len(item[0])))
        return tree

    def dirpath(self, mod=None, relative=False, trials=4, key=None) -> str:
        """
        get the directory path of the mod
        """
        if mod == None or mod == self.name:
            return self.paths["lib"]
        if key is not None:
            return self.paths["orbit"]["outer"] + '/' + self.key_address(key) + '/' + mod.replace('.', '/')
        tree_options = list(self.search(search=mod).values())
        if len(tree_options) == 0:
            if trials > 0:
                self.tree(update=True)
                return self.dirpath(mod=mod, relative=relative, trials=trials-1)
            else:
                assert False, f'Mod {mod} not found in tree'
        dirpath = tree_options[0]
        if os.path.isfile(dirpath):
            dirpath = os.path.dirname(dirpath)
        assert os.path.exists(dirpath), f'Dirpath {dirpath} does not exist for mod {mod}'
        return  dirpath

    dp = dirpath

    def addpath(self, path, name=None, update=True):
        assert os.path.exists(path), f'Path {path} does not exist'
        path = self.abspath(path)
        name = name or path.split('/')[-1]
        dirpath = self.paths["orbit"]["inner"] + '/' + name.replace('.', '/')
        self.cmd(f'cp -r {path} {dirpath}')
        return {'name': name, 'path': dirpath, 'msg': 'Mod Created from path'}


    def addcid(self, name='churn',  cid='QmXUjBQRFa8DbY2GhD1Aq6a44EBYzgejmtwwnYYTfvnFW4'):
        api = self.mod('api')()
        file2text =  api.content(cid, expand=True)
        path = self.paths["orbit"]["inner"] + '/' + name.replace('.', '/')
        for k,v in file2text.items():
            new_path = path + '/' + k
            print(f'Creating {new_path} for mod {name}')
            self.put_text(new_path, v)
        self.tree(update=True)
        assert self.mod_exists(name), f'Mod {name} not found after creation from cid {cid}'
        return {'name': name, 'path': path, 'msg': 'Mod Created from cid', 'cid': cid}


    def new(self, name='test_base', base='base',  orbit='inner'):
        """
        make a new mod
        """
        dirpath = self.paths["orbit"][orbit] + '/' + name.replace('.', '/')
        if os.path.exists(dirpath):
            shutil.rmtree(dirpath)
        for k,v in self.content(base).items():
            new_path = dirpath + '/' +  k.replace(f'{base}/', f'/{name}/')
            self.put_text( new_path, v)
        files = self.files(dirpath)
        self.update()
        assert self.mod_exists(name), f'Mod {name} not found after creation'
        return {'name': name, 'path': dirpath, 'msg': 'Mod Created', 'base': base, 'cid': self.cid(name)}
    
    create = new = add = fork = new 

    def urls(self, *args, **kwargs):
        return self.fn('server/urls')(*args, **kwargs)

    def servers(self, *args,  pm='pm2', **kwargs):
        return self.fn(f'{pm}/servers')(*args, **kwargs)

    executor_cache = {}
    def executor(self,  max_workers=8, mode='thread', cache=True):
        path = "executor/" + mode + '/' + str(max_workers)
        if cache and path in self.executor_cache:
            return self.executor_cache[path]
        if mode == 'process':
            from concurrent.futures import ProcessPoolExecutor
            executor =  ProcessPoolExecutor(max_workers=max_workers)
        elif mode == 'thread':
            executor =  self.mod('executor')(max_workers=max_workers)
        else:
            raise ValueError(f"Unknown mode: {mode}. Use 'thread', 'process' or 'async'.")
        if cache:
            self.executor_cache[path] = executor
        return executor

    def server_exists(self, server:str = 'mod', pm='pm2', *args, **kwargs):
        return  self.fn(f'{pm}/exists')(server, *args, **kwargs)

    def ensure_server(self, server:str = 'mod', pm='pm2', *args, **kwargs):
        if not self.server_exists(server, pm=pm, *args, **kwargs):
            return self.serve(server, pm=pm, *args, **kwargs)
        return {'msg': f'Server {server} already running'}

    def namespace(self, *args, **kwargs):
        return self.fn('server/namespace')(*args, **kwargs)

    def epoch(self, *args, **kwargs):
        return self.fn('vali/epoch')(*args, **kwargs)

    def up(self, mod = 'mod'):
        return self.fn('pm.docker/up')(mod)
    def down(self, mod = 'mod'):
        return self.fn('pm.docker/down')(mod)

    def enter(self, image = 'mod'):
        return self.fn('pm.docker/enter')(image)

    def owner(self):
        return self.get_key().address
        
    def is_owner(self, address:str) -> bool:
        return address.lower() == self.owner().lower()

    def repo2path(self, search=None):
        repo2path = {}
        for p in self.ls('~/'): 
            if os.path.exists(p+'/.git'):
                r = p.split('/')[-1]
                if search == None or search in r:
                    repo2path[r] = p
        return dict(sorted(repo2path.items(), key=lambda x: x[0]))

    def repos(self, search=None):
        return list(self.repo2path(search=search).keys())

    def help(self, mod='mod', query:str = 'what is this', *extra_query, **kwargs):
        query = ' '.join(list(map(str, [query, *extra_query])))
        mod =  mod or mod
        context = self.context(path=self.paths.orbit.core)
        return self.mod('agent')().ask(f'given the code {self.code(mod)} and CONTEXT OF mod {context} anster wht following question: {query}', preprocess=False)
    
    def ask(self, *args, **kwargs):
        return self.fn("agent/")(*args, **kwargs) 
    a = ask

    def context(self, path=None):
        path = path or self.paths.orbit.core
        return self.code()

    def import_mod(self, mod:str):
        from importlib import import_module
        mod = mod.replace(f'{self.lib_name}.{self.lib_name}', self.lib_name)
        return import_module(mod)

    def kill(self, server:str = 'mod'):
        return self.fn('server/kill')(server)

    def kill_all(self):
        return self.fn('server/killall')()

    killall = kill_all

    _config_cache = {}
    def config(self, mod=None):
        """
        Returns the config file in the path
        """
        # if str(mod) in self._config_cache:
        #     return self._config_cache[str(mod)]
        configs = self.config_paths(mod=mod)
        if len(configs) == 0:
            return {}
        config =  self.get_json(configs[0])
        # self._config_cache[str(mod)] = config
        return config

    cfg = config

    def config_paths(self, mod=None, 
                modes=['yaml', 'json'], 
                search=None, 
                depth = 3,
                filename_options = ['config', 'cfg', 'mod', 'block',  'agent', 'mod', 'bloc', 'server']):
        """
        Returns a list of config files in the path
        """
        if mod == None:
            path = '/'.join(__file__.split('/')[:-3])
        else:
            path = self.dirpath(mod)
        def is_config_path(f):
            return any(f.endswith(f'/{name}.{m}') for name in filename_options for m in modes)
        configs =  [f for f in  self.files(path, depth=depth) if is_config_path(f)]
        if search != None:
            configs = [f for f in configs if search in f]
        return list(sorted(configs, key=lambda x: len(x)))

    def config_path(self, mod=None, **kwargs):
        configs = self.config_paths(mod=mod, **kwargs)
        if len(configs) == 0:
            return None
        return configs[0]

    cpath = cfgpath = config_path

    def serve(self, mod:str = 'mod', port:int=None, remote=True, **kwargs):
        fn = self.fn('server/serve')
        if isinstance(mod, str):
            return fn(mod, port=port, remote=remote, **kwargs)
        elif isinstance(mod, list):
            threads = []
            for m in mod:
                params = {'mod': m, 'port': port, 'remote': remote, **kwargs}
                t = self.thread(fn, params, timeout=timeout)
                threads.append(t)
            results = self.wait(threads, timeout=timeout)
            return results

    def exec(self, mod:str = 'mod', *args, **kwargs):
        return self.fn('pm.docker/exec')(mod, *args, **kwargs)




    def confirm(self, message:str = 'Are you sure?', suffix = ' (y/n): '):
        confirm = input(message + suffix)
        if confirm.lower() != 'y':
            raise KeyboardInterrupt('Operation cancelled by user')
        return True

    def push(self, comment, *extra_comment, mod=None, safety=False):
        import subprocess
        import shlex
        path = self.dp(mod, relative=True)
        comment = ' '.join([comment, *extra_comment])
        if not os.path.exists(path):
            raise FileNotFoundError(f'Path {path} does not exist')
        if safety:
            self.confirm(f'Are you sure you want to push to {path} with comment: {comment}?')
        subprocess.run(['git', 'add', '.'], cwd=path, check=True)
        subprocess.run(['git', 'commit', '-m', comment], cwd=path, check=True)
        subprocess.run(['git', 'push'], cwd=path, check=True)
        return {'msg': f'Pushed to {path} with comment: {comment}'}

    def get_mods_path(self, exp=True):
        return self.paths["orbit"]["inner"] if not exp else self.paths["orbit"]["outer"]

    def cpmod(self, from_mod:str = 'dev', to_mod:str = 'dev2', force=True):
        return self.fn('factory/cpmod')(from_mod=from_mod, to_mod=to_mod, force=force)

    
    def rmmod(self, mod:str = 'test'):
        return self.fn('factory/rmmod')(mod=mod)
    
    def address2key(self, *args, **kwargs):
        return self.fn('key/address2key')(*args, **kwargs)

    rm_mod = rmmod

    def token(self, *args, **kwargs):
        return self.fn('auth/token')(*args, **kwargs)

    def clone(self, mod, name):
        return self.fn('factory/clone')(mod=mod, name=name)
    def initialize(self, globals_input:dict):
        for fn in dir(self):
            if fn.startswith('_'):
                continue
            globals_input[fn] = getattr(self, fn)
        return globals_input

    def main(self, *args, **kwargs):
        """
        Main function to run the mod
        """
        from .cli.cli import Cli
        return Cli().forward()

    def hasattr(self, mod, k):
        """
        Check if the mod has the attribute
        """
        return hasattr(self.mod(mod)(), k)

    def hash(self, obj, mode='sha256', **kwargs):
        from mod.core.utils import hash
        return self.obj('mod.core.utils.hash')(obj, mode=mode, **kwargs)

    def test(self, mod = None,  **kwargs) ->  Dict[str, str]:
        return self.fn('tester/forward')( mod=mod,  **kwargs )

    def mergemods(self, from_mod:Any, to_mod:Any, fns:list):
        """
        Share functions from one mod to another
        1. from_mod: the mod to share from
        """
        for fn in fns:
            fn_obj = getattr(from_mod, fn)
            setattr(to_mod, fn, fn_obj)
        return to_mod

    def edit(self, *query, mod='app', base=None, timeout=60, wait=False, **kwargs):
        query = list(map(str, query))
        params = {'query': ' '.join(query), 'mod': mod, 'base': base}
        print(f'Editing {mod} with query: {params["query"]}')
        return self.call('api/edit',  params=params, wait=wait, timeout=timeout, **kwargs)
    
    def nfiles(self, mod=None, depth=3):
        path = self.dirpath(mod)
        return len(self.files(path, depth=depth))
        
    e = edit

    def reg(self, *args, **kwargs):
        return self.fn('api/reg')( *args, **kwargs)
    
    def readmes(self, mod=None, depth=3):
        path = self.dirpath(mod)
        readmes = []
        for f in self.files(path, depth=depth):
            if 'readme' in f.lower():
                readmes.append(f)
        return readmes
    
    def readme(self, mod=None, depth=3):
        readmes = self.readmes(mod=mod, depth=depth)
        if len(readmes) == 0:
            return None
        readme = readmes[0]
        return self.get_text(readme)

    def setback(self, *args, **kwargs):
        return self.fn('api/setback')( *args, **kwargs)

    def time2str(self, t:float=None, fmt:str='%Y-%m-%d %H:%M:%S') -> str:
        """
        Convert a timestamp to a string
        """
        t = t or time.time()
        return time.strftime(fmt, time.localtime(t))

    def tool(self, tool_name: str='cmd', *args, **kwargs) -> Any:
        return self.mod(tool_name)(*args, **kwargs).forward

    def setup(self):
        self.serve('ipfs') 
        self.serve('api')
        self.up('app')

    def pytest(self, mod='pypm'):
        return self.fn('tester/pytest')(mod)
    
