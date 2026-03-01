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
    folder_path = m.abspath('~/.mod/api')
    threads = {}

    def __init__(self,  key=None, store = 'ipfs', auth='auth.base'):
        self.store = m.mod(store)()
        self.key = m.key(key)
        self.auth = m.mod(auth)()
        self.registry_path = self.path('registry.json')
        self.client = m.mod('server.client')()
        



    @property
    def router(self):
        if not hasattr(self, '_router'):
            self._router = m.mod('router')()
        return self._router
    
    def call( self, fn = 'chain/balances', params = {}, **kwargs):
        return self.router.call(fn, params, **kwargs)
    

    def token(self, update=False, max_age=3600):
        path = self.path('token.txt')
        token = m.get(path, None, update=update, max_age=max_age)
        if token == None:
            token = self.auth.token()
            m.put(path, token)
        return token 


    
    def txs(self,  *args, **kwargs):
        return self.router.txs(*args,  **kwargs)

    @property
    def config(self):
        return m.config('api')

    def addy(self, key=None):
        return self.key.address or m.addy(key)


    def exists(self, mod: m.Mod='store', key=None) -> bool:
        """
        Check if a mod Mod exists in IPFS.
        """
        return bool(self.cid(mod=mod, key=key))



    def mod(self, mod='api', key=None, schema=False, expand=False, update=False, **kwargs) -> Dict[str, Any]:
        """
        get the mod Mod from IPFS.
        """
        cid = self.cid(mod=mod, key=key)
  
        if not cid:
            return {}
        mod_info = self.get(cid)
        if mod_info['name'].startswith(mod_info['key'].lower()+'.'):
            mod_info['name'] = mod_info['name'][len(mod_info['key'].lower())+1:]
        mod_info['schema'] = self.get(mod_info['schema']) if schema else mod_info['schema']
        mod_info['content'] = self.content(mod_info['content'], expand=expand) if expand else mod_info['content']
        mod_info['cid'] = cid
        return mod_info

    def root(self,  encrypt=True, update=True, **kwargs) -> str:
        path = self.path('root_cid.json')
        root_cid = m.get(path, None, update=update)
        if root_cid == None:
            registry = self.registry()
            if encrypt:
                registry = self.key.encrypt(registry)
            root_cid = self.put(registry)
            m.put(path, root_cid)
        return root_cid
    
    def get_root(self,  decrypt=True, **kwargs) -> Dict[str, Any]:
        path = self.path('root_cid.json')
        root_cid = m.get(path, None)
        assert root_cid is not None, "Root CID not found. Please generate it first."
        registry = self.get(root_cid)
        if decrypt:
            registry = self.key.decrypt(registry)
        return registry

    def content(self, mod, key=None, expand=False, depth=None, h=False) -> Dict[str, Any]:
        """Get the content of a mod Mod from IPFS.
        
        Args:
            mod: mod Mod object
            
        Returns:
            Content dictionary
        """
        try:
            if self.store.valid_cid(mod):
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
                return key.lower()
            else:
                return m.key(key).address.lower()
        else:
            return (key or m.key()).address.lower()

    def cid(self, mod, key=None, default=None) -> str:
        return  self.registry().get(self.key_address(key), {}).get(mod, default)
    
    def reg_info(self, mod:dict):
        mod = self.get(mod) if isinstance(mod, str) else mod
        cid = mod['cid'] if 'cid' in mod else self.put(mod)
        registry = m.get(self.registry_path, {})
        registry[ mod['key']]  = registry.get( mod['key'], {})
        registry[ mod['key']][mod['name']] = cid
        m.put(self.registry_path, registry)
        print('Registered({key}, {mod}) -> {cid}'.format(key= mod['key'], mod=mod['name'], cid=cid))
        return cid

    def put(self, data):
        return self.store.put(data)
    add = put
    
    def get(self, cid: str) -> Any:
        return self.store.get(cid)

    def add_content(self, mod: str='store', comment=None) -> Dict[str, str]:        
        file2cid = {}
        mod = mod.lower()
        content = m.content(mod)
        for file,content in content.items():
            cid = self.put(content)
            file2cid[file] = cid
        return self.put({'data': self.put(file2cid), 'comment': comment})
    
    def wrap(self, mod: str):
        return m.fn('wrap/forward')(mod)
    
    def add_schema(self, mod: str='store', public=True) -> str:
        schema = self.wrap(mod)
        return self.put(schema)

    def get_url(self, url: str) -> str:
        url = m.namespace().get(url, None)
        return url

    def is_git_url(self, url: str) -> bool:
        return 'github.com' in url or 'gitlab.com' in url or ('/' in url and len(url.split('/')) == 2)

    def reg_git(self,
                    url: str,
                    name=None,
                    key=None,
                    comment=None,
                    token=None) -> Dict[str, Any]:

        """
        Register a mod Mod from a URL in IPFS.
        Args:
            url: URL to fetch mod data from
            name: Optional custom name for the module
            signature: Optional signature for verification
            key: Key object or address string
            comment: Optional comment about the registration
            token: Authentication token for verification
        Returns:
            Dictionary with registration info
        """
        # Verify token if provided

        if token:
            verified_data = self.auth.verify(token)
            key = verified_data['key']
        else:
            key = self.key_address(key)

        print(f"Registering mod from URL: {url} with key: {key} and name: {name}")
        assert self.is_git_url(url), f'Unsupported URL for reg_git: {url}'
        name = name or url.split('/')[-1].split('.git')[0]
        # assert not m.mod_exists(mod), f'Mod {mod} already exists. Please choose a different mod name or deregister the existing mod first.'
        name = name.lower()
        if self.is_owner(key):
            orbit='inner'
        else:
            orbit = 'outer'
        dirpath = m.paths.orbit[orbit]
        modpath = os.path.join(dirpath, key ,name)
        if os.path.exists(modpath):
            shutil.rmtree(modpath)
        git_cmd = f'git clone --single-branch {url} {modpath}'
        os.makedirs(dirpath, exist_ok=True)
        os.system(git_cmd)
        info = self.get_info(mod=name, key=key, comment=comment)
        return self.reg_info(info)

    def reg_ipfs(self, cid: str) -> Dict[str, Any]:
        """
        Register a mod Mod from an IPFS CID.
        Args:
            cid: IPFS CID
        Returns:
            Dictionary with registration info
        """
        mod_info = self.get(cid)
        name = mod_info['name']
        content = self.get(mod_info['content'])
        modpath = self.paths['orbits']['outer'] + '/' + mod_info['key'] + '/' + mod_info['name']
        for file, file_cid in content['data'].items():
            file_content = self.get(file_cid)
            filepath = os.path.join(modpath, file)
            m.put_text(filepath, file_content)
        return self.reg_info(mod_info)

    def get_info(self, mod='store',  key=None, name=None,  comment=None, public=False) -> Dict[str, Any]:
        """
        Register mod Mod data in IPFS.
        """
        current_time = m.time()
        key = self.key_address(key)
        prev_info = self.mod(mod, key=key)
        return {
                'content':  self.add_content(mod=mod, comment=comment),
                'schema':  self.add_schema(mod=mod, public=public),
                'prev': prev_info.get('cid', None), # previous state
                'created':  prev_info.get('created', current_time),  # created timestamp
                'updated': current_time, 
                'name': name or prev_info.get('name', mod),  # mod name
                'key': prev_info.get('key', key),
                'url': self.get_url(mod),
            }
    


    def is_ipfs_url(self, url: str) -> bool:
        return url.startswith('ipfs://') or url.startswith('ipfs/') or self.store.valid_cid(url)
    
    def is_mod_url(self, url: str) -> bool:
        if self.is_git_url(url):
            return True
        if self.is_ipfs_url(url):
            return True
        return False
    

    def reg(self,
                mod : Union[str, dict] = 'store',
                key=None,
                comment=None,
                public= True,
                token=None,
                name=None,
                ) -> Dict[str, Any]:
        """
        Register or update a mod Mod in IPFS.
        Args:
            mod:  Mod str
            key: Key object or address string
            comment: Optional comment about the registration
            update: Whether to force update from IPFS
            token: Authentication token for verification
            name: Optional custom name for the module
        Returns:
            Dictionary with registration info

        """
        # Verify token if provided

        # Handle URL-based registration
        if self.is_ipfs_url(mod):
            return self.reg_ipfs(mod)
        elif self.is_git_url(mod):
            return self.reg_git(mod, key=key, comment=comment, name=name)
        if token:
            key = self.auth.verify(token)['key']
        # Use custom name if provided
        info = self.get_info(mod=mod, key=key, comment=comment, public=public, name=name)
        info['cid'] = self.reg_info(info)
        self.update()
        return info

    def update(self): 
        self.mods(update=1)

    def anchor_file(self, mod:str, key=None) -> Dict[str, Any]:
        mod_info = self.mod(mod, key=key)
        if not mod_info:
            return None
        content = mod_info.get('content', {})
        content = self.get(content)
        assert 'data' in content, f"Content for mod {mod} is missing 'data' field."
        file2content = self.get(content['data'])
        file_name_options = ['mod.py', 'server.py', mod_info['name']+'.py']
        for file_path, file_content in file2content.items():
            if any(opt in file_path for opt in file_name_options):
                return file_path
        return None
            
    def reg_payload(self, mod: str = 'store', key=None, comment=None) -> Dict[str, Any]:
        """
        Generate registration payload without executing registration.
        
        Args:
            mod: Mod str
            key: Key object or address string
            comment: Optional comment about the registration
            
        Returns:
            Dictionary with registration payload ready to be signed
        """
        info = self.get_info(mod=mod, key=key, comment=comment)
        return info


    def path(self, path:str) -> str:
        """Get content from a specific path in IPFS.
        
        Args:
        """
        return self.folder_path + '/' + path

    def mods(self, search:str=None,  key='all', n:int=None, page:int=None, page_size=10, **kwargs) -> List[Dict[str, Any]]:
        """
        List all registered mods in IPFS.
        Returns:
            List of mod info dicts
        """

        registry = self.registry()
        mods = []
        if key != 'all':
            registry = {key.lower(): registry.get(key.lower(), {})}
        for user_key, user_mods in registry.items():
            for mod_name in user_mods.keys():
                mods.append(self.mod(mod_name, key=user_key, **kwargs))
            mods = [item for item in mods if isinstance(item, dict) and 'name' in item]

        if search != None:
            mods = [item for item in mods if search in item['name']]
        if page != None and page_size != None:
            start = page * page_size
            end = start + page_size
            mods = mods[start:end]
        if n != None:
            mods = mods[:n]
        return mods

    @property
    def chain(self):
        if not hasattr(self, '_chain'):
            self._chain = m.mod('chain')()
            self._chain.name = 'chain'
            sync_fns = ['balance']
            for fn_name in sync_fns:
                setattr(self, fn_name, getattr(self._chain, fn_name))
        return self._chain


    def timestamp2utc(self, timestamp:int) -> str:
        import datetime
        return datetime.datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')

    def versions(self, mod='app' , key=None, df=False, n=1000, update=True, max_age=None) -> List[Dict[str, Any]]:

        if self.store.valid_cid(mod):
            mod_info = self.get(mod)
            mod = mod_info['name']
            key = mod_info['key']
        key_address = self.key_address(key)
        cache_path = self.path(f'versions/{key_address}/{mod}.json')
        result = m.get(cache_path, None, update=update, max_age=max_age)
        if result is None:
            cid = self.cid(mod=mod, key=key)
            result = []
            current_n = 0

            if cid != None:
                while current_n < n:
                    info = self.get(cid)
                    content = self.get(info['content'])
                    prev_cid = info.get('prev', None)
                    result.append({
                        'cid': cid,
                        'data': content['data'],
                        'comment': content.get('comment', ''),
                        'updated': self.timestamp2utc(info['updated']),
                        'created': self.timestamp2utc(info.get('created', info['updated'])),
                    })
                    if prev_cid == None:
                        break
                    else:
                        cid = prev_cid
                    current_n += 1
            if len(result) > 0:
                result = m.df(result)
                result.sort_values('updated', ascending=False, inplace=True)
                result = result[:n]
                if not df:
                    result = result.to_dict(orient='records')
            m.put(cache_path, result)
        if n != None:
            result = result[:n]

        return result

    v = versions

    def regall(self, key=None, depth=1, comment=None, public=False, timeout=30) -> Dict[str, Any]:
        """
        Register all mods in the local environment to IPFS.
        Args:
            key: Key object or address string
            comment: Optional comment about the registration
        Returns:
            Dictionary with registration info for all mods
        """
        results = []
        for mod_name in m.mods(depth=depth):
            try:
                result = self.reg(mod=mod_name, key=key, comment=comment, public=public)
                print(f"Registered mod: {result['name']} with CID: {result['cid']}")
                results.append(result)
            except Exception as e:
                print(f"Error registering mod: {str(e)}")
        return results

    def registry(self,  key='all', update=False) -> Dict[str, str]:
        """
        Get the mod registry from IPFS.
        """
        registry =  m.get(self.registry_path, {}, update=update)
        # lowercase the registry keys
        registry = {k.lower(): v for k, v in registry.items()}
        if key != 'all':
            registry = registry.get(self.key_address(key).lower(), {})
        return registry
            
    def _clear(self) -> bool:
        m.put(self.registry_path, {})
        self.store._rm_all_pins()
        return {'status': 'registry cleared'}

    def schema(self, mod: m.Mod='store', key=None) -> Dict[str, Any]:
        """Get the schema of a mod from IPFS.

        Args:
            mod: mod name string or dict
        Returns:
            Schema dictionary
        """
        fn = None
        if not isinstance(mod, dict):
            if '/' in mod:
                fn = mod.split('/')[-1]
                mod = mod.replace('/' + fn, '')
            mod_info = self.mod(mod, key=key, schema=False)
        else:
            assert 'schema' in mod, "Mod dictionary must contain 'schema' key"
            mod_info = mod

        schema = self.get(mod_info['schema'])
        if fn is not None:
            schema = schema.get(fn, {})

        return schema

    def setback(self, mod:str, cid:str, key=None, safety=True) -> Dict[str, Any]:
        """
        Setback a mod Mod to a previous CID in IPFS.
        Args:
            mod: mod Mod name
            cid: Target CID to setback to
            key: Key object or address string
        """
        mod_info = self.mod(mod, key=key)
        old_content = self.content(mod_info['cid'], expand=1)
        new_content = self.content(cid, expand=1)
        print(cid, new_content)
        dirpath = m.dp(mod_info['name'])
        add_dp_to_file = lambda f: os.path.join(dirpath, f)
        delete_files = [add_dp_to_file(f) for f in old_content.keys() if f not in new_content.keys()]
        new_content = {add_dp_to_file(k): v for k, v in new_content.items()}

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

        for k, v in new_content.items():
            m.put_text(k, self.get(v))

        for file_path in delete_files:
            m.rm(file_path)
        self.reg_info(cid)
        return {
            'old_cid': mod_info['cid'],
            'new_cid': cid,
            'mod': mod_info
        }  

    def rm_mod(self, mod: m.Mod='store', key=None) -> bool:
        """Remove a mod from IPFS.

        Args:
            mod: mod name string
        Returns:
            True if removal was successful, False otherwise
        """
        registry = self.registry()
        key = self.key_address(key)
        mod_info = self.mod(mod, key=key)
        if not mod_info:
            return False
        mod_cid = mod_info.get('cid')
        if mod_cid:
            content_info_cid = mod_info.get('content')
            if content_info_cid and isinstance(content_info_cid, str):
                content_data = self.get(content_info_cid)
                if isinstance(content_data, dict) and 'data' in content_data:
                    content_map = self.get(content_data['data'])
                    if isinstance(content_map, dict):
                        for file_key, file_cid in content_map.items():
                            self.store.rm(file_cid)
                self.store.rm(content_info_cid)
            schema_cid = mod_info.get('schema')
            if schema_cid and isinstance(schema_cid, str):
                self.store.rm(schema_cid)
            self.store.rm(mod_cid)
        if key in registry and mod in registry[key]:
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



    def user(self, key: str = None, update=False, expand=False) -> Dict[str, Any]:
        """Get information about a specific user in IPFS.
        
        Args:
            user_address: Address of the user
        Returns:
            Dictionary with user information
        """
        key = self.key_address(key)
        user_path = self.path(f'users/{key}_expand={expand}.json')
        user = m.get( user_path, None, update=update)
        if user == None:
            user = { 
                'key': key,
                'balance': 0,
                'mods': [self.get(_cid) for _cid in self.registry().get(key, {}).values()]
            }
            user['mods'] = self.put(user['mods'])
            user['n'] = len(user['mods'])
            m.put( user_path, user)
        if expand:
            user['mods'] = self.get(user['mods'])
        return user


    def fork(self, mod:str, key=None, comment=None, public=False) -> Dict[str, Any]:
        """
        Fork a mod Mod in IPFS by creating a new registration with the same content but a different name.
        Args:
            mod: Name of the mod to fork
            new_mod: Name of the new forked mod
            key: Key object or address string
            comment: Optional comment about the fork
        Returns:
            Dictionary with registration info for the new forked mod
        """
        
        oriignal_path = m.dp(mod)
        key_address = self.key_address(key)
        new_path = m.paths.orbit['outer'] + '/' + key_address + '/' + mod
        if os.path.exists(new_path):
            shutil.rmtree(new_path)
        shutil.copytree(oriignal_path, new_path)
        return self.reg(mod=key_address+'.'+mod, key=key, comment=comment, public=public)
    
    def edit(self, query:str = 'make the readme better', mod='app',  key=None,   steps=20, **kwargs) -> Dict[str, Any]:
        m.fn('dev/forward')( query=query, mod=mod, safety=False, key=key, steps=steps, **kwargs)
        return self.reg(mod=mod, key=key, comment=query)

    def files(self, mod='store', search=None, **kwargs):
        files =  list(self.content(mod, expand=True, **kwargs).keys())
        if search != None:
            files = [f for f in files if search in f]
        return files

    def __delete__(self):
        for k,thread in self.threads.items():
            print(f'Killing {k}')
            thread.kill()
        del self.thread

    def namespace(self, *args, **kwargs):
        return m.fn('server/namespace')()

    def n(self, *args, **kwargs):
        return len(self.mods(*args, **kwargs))

    def new(self, name='base2', base='base', key=None, orbit='outer', update=True):
        """
        make a new mod
        """
        key = self.key_address(key)
        if key == self.key.address:
            orbit = 'inner'
        name = name or base.split('/')[-1]
        dirpath = m.paths["orbit"][orbit] + '/'+ key+ '/'+ name.replace('.', '/')
        print(f'Creating new mod {name} at {dirpath} from base {base}')
        for k,v in m.content(base).items():
            new_path = dirpath + '/' +  k.replace(base, name)
            m.put_text( new_path, v)
        print(m.orbit())
        m.orbit(orbit, update=True)
        return {'name': name, 'path': dirpath, 'msg': 'Mod Created', 'base': base, 'cid': self.cid(name)}

    def dp(self, path:str, key=None) -> str:
        key = self.key_address(key)
        if key != self.key.address:
            path = key + '/' + path
        return m.dp(path)

    def is_owner(self, address:str):
        return m.key() == address or self.key.address == address
    

    def balance(self, address:str=None, token:str='market'):
        """Get balance for a specific address and token.

        Args:
            address: Address to query
            token: Token symbol (default 'market')

        Returns:
            Balance as float
        """
        return self.chain.balance(address, token)

    def get_balances(self, address:str=None, tokens:list=None):
        """Get balances for multiple tokens for a single address.

        Args:
            address: Address to query (uses server key if None)
            tokens: List of token symbols (default ['ETH', 'USDC', 'USDT', 'MARKET'])

        Returns:
            Dictionary mapping token symbols to balances
        """
        
        return self.chain.balances(address=address, tokens=tokens)

    def balances(self, token:str='market', from_block:int=0, to_block:int=None, weeks:int=2):
        """Get all user balances for a specific token by scanning Transfer events.

        Args:
            token: Token symbol (default 'market')
            from_block: Starting block to scan for holders (default: calculated from weeks)
            to_block: Ending block to scan (default: latest)
            weeks: Number of weeks to look back (default: 2)

        Returns:
            Dictionary mapping all holder addresses to their balances
        """
        return self.chain.balances(token=token, from_block=from_block, to_block=to_block, weeks=weeks)

    def scan_holders(self, token:str='market', weeks:int=2, from_block:int=0, to_block:int=None):
        """Scan blockchain for all token holders over a time period.

        Args:
            token: Token symbol to scan (default 'market')
            weeks: Number of weeks to look back (default: 2)
            from_block: Starting block (default: calculated from weeks)
            to_block: Ending block (default: latest)

        Returns:
            Dictionary with holder data including:
            - holders: Dict mapping addresses to balances
            - total_holders: Number of unique holders
            - from_block: Starting block scanned
            - to_block: Ending block scanned
        """
        holders = self.chain.scan_token_holders(
            token=token,
            from_block=from_block,
            to_block=to_block,
            weeks=weeks
        )

        return {
            'holders': holders,
            'total_holders': len(holders),
            'token': token.upper(),
            'weeks': weeks
        }

    def credit(self, stable_amount:float, payment_token:str='usdt'):
        """Buy stable tokens with whitelisted payment token using server-side key.

        Args:
            stable_amount: Amount of stable tokens to buy
            payment_token: Payment token symbol (default 'usdt')

        Returns:
            Transaction hash
        """
        return self.chain.credit(stable_amount=stable_amount, payment_token=payment_token)

    def register(self, mod:str=None):
        """Register a mod on-chain using server-side key.

        Args:
            mod: Mod name or identifier

        Returns:
            Registration info
        """
        if mod:
            return self.chain.reg(name=mod)
        return {'error': 'mod parameter required'}

    def build_transaction(self, to:str, data:str='0x', value:int=0, gas:int=None):
        """Build a raw transaction for client-side signing.

        Args:
            to: Recipient address
            data: Transaction data (hex string)
            value: ETH value in wei
            gas: Gas limit (auto-estimated if None)

        Returns:
            Unsigned transaction dictionary
        """
        return self.chain.build_transaction(to=to, data=data, value=value, gas=gas)

    def send_raw_transaction(self, signed_tx:str):
        """Send a pre-signed raw transaction.

        Args:
            signed_tx: Signed transaction hex string

        Returns:
            Transaction hash
        """
        return self.chain.send_raw_transaction(signed_tx)

    def encode_function_call(self, contract:str, function:str, args:list):
        """Encode a contract function call for transaction data.

        Args:
            contract: Contract name (e.g., 'market')
            function: Function name (e.g., 'transfer')
            args: List of function arguments

        Returns:
            Encoded data as hex string
        """
        return self.chain.encode_function_call(contract, function, args)
    

    def graduate(self, mod:str, key=None, comment=None, public=False) -> Dict[str, Any]:
        """
        Graduate a mod from the 'outer' orbit to the 'inner' orbit by re-registering it under the server's key.
        Args:
            mod: Name of the mod to graduate
            key: Key object or address string (if None, uses server key)
            comment: Optional comment about the graduation
            public: Whether the mod should be public (default False)

        Returns:
            Dictionary with registration info for the graduated mod
        """
        key = self.key_address(key)
        if key != self.key.address:
            print(f"Graduating mod {mod} from key {key} to server key {self.key.address}")
            return self.reg(mod=mod, key=self.key.address, comment=comment, public=public)
        else:
            print(f"Mod {mod} is already under the server key. No graduation needed.")
            return self.mod(mod, key=key)