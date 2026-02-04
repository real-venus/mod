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

class Registry:

    folder_path = '~/.mod/api/registry'
    def __init__(self ):

        self.store = m.mod('ipfs')()
        self.registry_path = self.path('registry.json')



    def path(self, path:str) -> str:
        """Get content from a specific path in IPFS.
        
        Args:
        """
        return self.folder_path + '/' + path

    def rm_mod(self, mod: m.Mod='store', key=None) -> bool:
        """Remove a mod Mod from IPFS.
        
        Args:
            mod: mod Mod object
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

    def reg_info(self, mod:dict):
        assert self.verify_mod(mod), "Mod verification failed"
        mod = self.get(mod) if isinstance(mod, str) else mod
        cid = mod['cid'] if 'cid' in mod else self.add(mod)
        registry = m.get(self.registry_path, {})
        registry[ mod['key']]  = registry.get( mod['key'], {})
        registry[ mod['key']][mod['name']] = cid
        m.put(self.registry_path, registry)
        print('Registered({key}, {mod}) -> {cid}'.format(key= mod['key'], mod=mod['name'], cid=cid))
        return cid
    

    def reg_git(self, 
                    url: str, 
                    name=None, 
                    signature = None, 
                    key=None, 
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
        key = self.key_address(key)
        assert self.is_git_url(url), f'Unsupported URL for reg_git: {url}'
        name = name or url.split('/')[-1].split('.git')[0] 
        # assert not m.mod_exists(mod), f'Mod {mod} already exists. Please choose a different mod name or deregister the existing mod first.'
        name = name.lower()
        dirpath = m.paths.orbit[orbit]
        modpath = os.path.join(dirpath, key ,name)
        if not os.path.exists(modpath):
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
    


    def setback(self, mod:str, cid:str , key=None , safety=True) -> Dict[str, Any]:
        """
        Setback a mod Mod to a previous CID in IPFS.
        Args:
            mod: mod Mod object
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
        self.reg_info(cid)
        return {
            'old_cid': mod['cid'],
            'new_cid': cid,
            'mod': mod
        }  


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


    def reg(self, 
                mod : Union[str, dict] = 'store', 
                key=None,  
                comment=None, 
                public= False,
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
        if self.is_ipfs_url(mod):
            return self.reg_ipfs(mod)
        elif self.is_git_url(mod):
            return self.reg_url(mod, key=key, comment=comment, public=public)
        info = self.get_info(mod=mod, key=key, comment=comment, public=public)
        info['cid'] = self.reg_info(info) 
        self.update()
        return info
    


    def is_git_url(self, url: str) -> bool:
        return 'github.com' in url or 'gitlab.com' in url


    def get_info(self, mod='store', key=None, comment=None, public=False) -> Dict[str, Any]:
        """
        Register mod Mod data in IPFS.
        """
        current_time = m.time()
        key = self.key_address(key)
        prev_info = self.mod(mod, key=key)
        content_cid = self.add_content(mod=mod, comment=comment)
        prev_content_cid = prev_info.get('content', None)
        if content_cid == str(prev_content_cid):
            prev_info.pop('cid', None)
            return prev_info  # No changes, return existing info
        return {
                'content': content_cid,
                'schema': self.add_schema(mod, public=public),
                'prev': prev_info.get('cid', None), # previous state
                'created':  prev_info.get('created', current_time),  # created timestamp
                'updated': current_time, 
                'name': prev_info.get('name', mod),  # mod name
                'key': prev_info.get('key', key),
                'url': self.get_url(mod),
            }
    


    def is_ipfs_url(self, url: str) -> bool:
        return url.startswith('ipfs://') or url.startswith('ipfs/') or self.valid_cid(url)
    
    def is_mod_url(self, url: str) -> bool:
        if self.is_git_url(url):
            return True
        if self.is_ipfs_url(url):
            return True
        return False
    

    def n(self, *args, **kwargs):
        return len(self.mods(*args, **kwargs))
    

    def get_url(self, url: str) -> str:
        url = m.namespace().get(url, None)
        return url


    def regall(self, key=None, depth=1,  comment=None, public=False) -> Dict[str, Any]:
        """
        Register all mods in the local environment to IPFS.
        Args:
            key: Key object or address string
            comment: Optional comment about the registration
        Returns:
            Dictionary with registration info for all mods
        """
        for mod in m.mods(depth=depth):
            self.reg(mod=mod, key=key, comment=comment, public=public)
        
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
    

    def timestamp2utc(self, timestamp:int) -> str:
        import datetime
        return datetime.datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')

    def versions(self, mod='app' , key=None, df=False, n=1000, update=False, max_age=2) -> List[Dict[str, Any]]:

        if self.valid_cid (mod):
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


    def exists(self, mod: m.Mod='store', key=None) -> bool:
        """
        Check if a mod Mod exists in IPFS.
        """
        return bool(self.cid(mod=mod, key=key))

    def verify_mod(self, mod: str = 'store', key=None) -> bool:
        assert 'signature' in mod, f'Mod {mod} has no signature'
        signature = mod.pop('signature', None)
        assert signature is not None, f'Mod {mod} has no signature'
        return self.key.verify(mod, signature=signature, address=mod['key'])

    def mod(self, mod='api', key=None, schema=False,  expand = False, **kwargs) -> Dict[str, Any]:
        """
        get the mod Mod from IPFS.
        """
        cid = self.cid(mod=mod, key=key)
        if cid:
            mod =  self.get(cid) 
        else:
            return {}
        mod['schema'] = self.get(mod['schema']) if schema else mod['schema']
        mod['content'] = self.content(mod['content'], expand=expand) if expand else mod['content']
        mod['cid'] = cid
        return mod

    def namespace(self, *args, **kwargs):
        mods = self.mods(*args, **kwargs)
        namespace = {}
        for mod in mods:
            url = mod.get('url', None)
            if url is not None:
                namespace[mod['name']] = url
        return namespace
