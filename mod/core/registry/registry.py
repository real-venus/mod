import os
import shutil
from typing import Optional, Dict, Any, List, Union
import mod as m


class Registry:
    """
    Module registry — manages registration, lookup, versioning, and content
    for mod modules stored via CID-based content addressing.
    """

    folder_path = m.abspath('~/.mod/api')

    def __init__(self, key=None, store=None):
        store = store or m.config('api').get('store', 'localfs')
        self.store = m.mod(store)()
        self.key = m.key(key)
        self.registry_path = self.path('registry.json')

    def path(self, path: str) -> str:
        return self.folder_path + '/' + path

    # --- Key helpers ---

    def key_address(self, key=None):
        key = key or 'mod'
        if isinstance(key, str):
            if self.key.valid_ss58_address(key):
                return key.lower()
            else:
                return m.key(key).address.lower()
        else:
            return (key or m.key()).address.lower()

    def is_owner(self, address: str):
        return m.key() == address or self.key.address == address

    # --- Store wrappers ---

    def put(self, data):
        return self.store.put(data)

    def get(self, cid: str) -> Any:
        return self.store.get(cid)

    # --- Registry CRUD ---

    def registry(self, key='all', update=False) -> Dict[str, str]:
        """Get the mod registry."""
        registry = m.get(self.registry_path, {}, update=update)
        registry = {k.lower(): v for k, v in registry.items()}
        if key != 'all':
            registry = registry.get(self.key_address(key).lower(), {})
        return registry

    def cid(self, mod, key=None, default=None) -> str:
        return self.registry().get(self.key_address(key), {}).get(mod, default)

    def exists(self, mod='store', key=None) -> bool:
        """Check if a module exists in the store."""
        return bool(self.cid(mod=mod, key=key))

    def mod(self, mod='api', key=None, schema=False, expand=False, update=False, **kwargs) -> Dict[str, Any]:
        """Get a module's metadata from the store."""
        cid = self.cid(mod=mod, key=key)
        if not cid:
            return {}
        mod_info = self.get(cid)
        if mod_info['name'].startswith(mod_info['key'].lower() + '.'):
            mod_info['name'] = mod_info['name'][len(mod_info['key'].lower()) + 1:]
        mod_info['schema'] = self.get(mod_info['schema']) if schema else mod_info['schema']
        mod_info['content'] = self.content(mod_info['content'], expand=expand) if expand else mod_info['content']
        mod_info['cid'] = cid
        # Enrich with live URL data from config.json if not already present
        if not mod_info.get('url') or (isinstance(mod_info.get('url'), str)):
            live_url = self.get_url(mod_info['name'])
            if live_url:
                mod_info['url'] = live_url
        return mod_info

    def mods(self, search: str = None, key='all', n: int = None, page: int = None, page_size=10, **kwargs) -> List[Dict[str, Any]]:
        """List all registered mods."""
        registry = self.registry()
        # Build list of (mod_name, user_key) pairs first (cheap), dedup by lowered key
        entries = []
        seen = set()
        if key != 'all':
            registry = {key.lower(): registry.get(key.lower(), {})}
        for user_key, user_mods in registry.items():
            for mod_name in user_mods.keys():
                dedup_key = (mod_name.lower(), user_key.lower())
                if dedup_key not in seen:
                    seen.add(dedup_key)
                    entries.append((mod_name, user_key))
        # Filter by search BEFORE loading full mod info (expensive)
        if search is not None:
            search_lower = search.lower()
            entries = [(name, k) for name, k in entries if search_lower in name.lower()]
        # Paginate BEFORE loading full mod info
        if page is not None and page_size is not None:
            start = page * page_size
            end = start + page_size
            entries = entries[start:end]
        if n is not None:
            entries = entries[:n]
        # Now load full mod info only for the slice we need
        mods = []
        for mod_name, user_key in entries:
            info = self.mod(mod_name, key=user_key, **kwargs)
            if isinstance(info, dict) and 'name' in info:
                mods.append(info)
        return mods

    def n(self, *args, **kwargs):
        return len(self.mods(*args, **kwargs))

    # --- Content ---

    def content(self, mod, key=None, expand=False, depth=None, h=False) -> Dict[str, Any]:
        """Get the content of a module from the store."""
        try:
            if self.store.valid_cid(mod):
                data = self.get(mod)
                if isinstance(data, dict) and 'content' in data:
                    content = self.get(data['content'])['data']
                else:
                    content = self.get(mod)['data']
            else:
                mod_info = self.mod(mod, key=key)
                if not mod_info:
                    raise KeyError(f"Module '{mod}' not found in registry")
                content = self.get(mod_info['content'])['data']
            if expand:
                content = self.get(content)
            if h:
                return self.hc(content)
        except Exception as e:
            err = m.detailed_error(e)
            m.print(f"[content] Error: {err['error']}", color='red')
            m.print(f"  File: {err['file_name']}:{err['line_no']}", color='red')
            m.print(f"  Line: {err['line_text']}", color='red')
            raise
        return content

    def add_content(self, mod: str = 'store', comment=None) -> Dict[str, str]:
        file2cid = {}
        mod = mod.lower()
        content = m.content(mod)
        error_keys = {'error', 'file_name', 'line_no', 'line_text', 'success', 'traceback'}
        if isinstance(content, dict) and len(content) > 0:
            content_keys = set(content.keys())
            if len(content_keys & error_keys) >= 3:
                raise ValueError(f"Module '{mod}' content returned an error: {content.get('error', 'unknown')}")
        for file, file_content in content.items():
            cid = self.put(file_content)
            file2cid[file] = cid
        return self.put({'data': self.put(file2cid), 'comment': comment})

    def add_schema(self, mod: str = 'store', public=True) -> str:
        schema = m.schema(mod)
        return self.put(schema)

    def files(self, mod='store', search=None, **kwargs):
        files = list(self.content(mod, expand=True, **kwargs).keys())
        if search is not None:
            files = [f for f in files if search in f]
        return files

    # --- Hierarchical content helpers ---

    def hc(self, content: Dict[str, Any], flatten=False) -> Dict[str, Any]:
        """Get a human-readable version of the content dictionary."""
        new_dict = {}
        for file, cid in content.items():
            subfiles = file.split('/')
            self.dict_put(subfiles, cid, new_dict)
        return self.get_folder_cid(new_dict)

    def sort_recursive_dict(self, d: Dict[str, Any]) -> Dict[str, Any]:
        sorted_dict = {}
        for key in sorted(d.keys()):
            if isinstance(d[key], dict):
                sorted_dict[key] = self.sort_recursive_dict(d[key])
            else:
                sorted_dict[key] = d[key]
        return sorted_dict

    def get_folder_cid(self, folder_content: dict) -> str:
        is_single_depth_dict = lambda v: all(isinstance(v, str) for v in folder_content.values())
        new_folder_content = {}
        for file, content in folder_content.items():
            if isinstance(content, dict) and len(content) > 0:
                if is_single_depth_dict(content):
                    new_folder_content[file + '/'] = self.put(content)
                else:
                    new_folder_content[file + '/'] = self.put(self.get_folder_cid(content))
            else:
                new_folder_content[file] = content
        return new_folder_content

    def dict_put(self, k_list, v, d: Dict[str, Any]):
        if len(k_list) == 0:
            return v
        key = k_list[0]
        if key not in d:
            d[key] = {}
        d[key] = self.dict_put(k_list[1:], v, d[key])
        return d

    # --- Registration ---

    def reg_info(self, mod: dict):
        mod = self.get(mod) if isinstance(mod, str) else mod
        cid = mod['cid'] if 'cid' in mod else self.put(mod)
        registry = m.get(self.registry_path, {})
        key = mod['key'].lower()
        # Deduplicate: remove any differently-cased versions of this key
        for existing_key in list(registry.keys()):
            if existing_key.lower() == key and existing_key != key:
                registry[key] = {**registry.pop(existing_key), **registry.get(key, {})}
        registry[key] = registry.get(key, {})
        registry[key][mod['name']] = cid
        m.put(self.registry_path, registry)
        print('Registered({key}, {mod}) -> {cid}'.format(key=key, mod=mod['name'], cid=cid))
        return cid

    def get_info(self, mod='store', key=None, name=None, comment=None, public=False) -> Dict[str, Any]:
        """Build registration info for a module."""
        current_time = m.time()
        key = self.key_address(key)
        prev_info = self.mod(mod, key=key)
        return {
            'content': self.add_content(mod=mod, comment=comment),
            'schema': self.add_schema(mod=mod, public=public),
            'prev': prev_info.get('cid', None),
            'created': prev_info.get('created', current_time),
            'updated': current_time,
            'name': name or prev_info.get('name', mod),
            'key': prev_info.get('key', key),
            'url': self.get_url(mod),
        }

    def get_url(self, mod_name: str):
        """Get URL(s) for a module. Returns {api, app} dict or a string."""
        # Check the module's config.json for urls/url
        try:
            cfg = m.config(mod_name)
            if isinstance(cfg, dict):
                # config.json uses 'urls' key with {api, app}
                if 'urls' in cfg and isinstance(cfg['urls'], dict):
                    return cfg['urls']
                # or 'url' key with {api, app} or string
                if 'url' in cfg:
                    return cfg['url']
        except Exception:
            pass
        # Fall back to namespace server registry
        ns_url = m.namespace().get(mod_name, None)
        return ns_url

    def is_git_url(self, url: str) -> bool:
        return 'github.com' in url or 'gitlab.com' in url or ('/' in url and len(url.split('/')) == 2)

    def is_cid_url(self, url: str) -> bool:
        return self.store.valid_cid(url)

    def reg_git(self, url: str, name=None, key=None, comment=None, token=None) -> Dict[str, Any]:
        """Register a module from a git URL."""
        if token:
            verified_data = m.mod('auth.base')().verify(token)
            key = verified_data['key']
        else:
            key = self.key_address(key)

        print(f"Registering mod from URL: {url} with key: {key} and name: {name}")
        assert self.is_git_url(url), f'Unsupported URL for reg_git: {url}'
        name = name or url.split('/')[-1].split('.git')[0]
        name = name.lower()
        if self.is_owner(key):
            orbit = 'orbit'
        else:
            orbit = 'portal'
        dirpath = m.paths['orbit'][orbit]
        modpath = os.path.join(dirpath, key, name)
        if os.path.exists(modpath):
            shutil.rmtree(modpath)
        git_cmd = f'git clone --single-branch {url} {modpath}'
        os.makedirs(dirpath, exist_ok=True)
        os.system(git_cmd)
        # Init .mod/branch metadata
        mod_meta = os.path.join(modpath, '.mod')
        os.makedirs(mod_meta, exist_ok=True)
        with open(os.path.join(mod_meta, 'branch'), 'w') as f:
            f.write('main')
        info = self.get_info(mod=name, key=key, comment=comment)
        return self.reg_info(info)

    def reg_cid(self, cid: str) -> Dict[str, Any]:
        """Register a module from a CID."""
        mod_info = self.get(cid)
        name = mod_info['name']
        content = self.get(mod_info['content'])
        orbit = 'orbit' if self.is_owner(mod_info['key']) else 'portal'
        modpath = m.paths['orbit'][orbit] + '/' + mod_info['key'] + '/' + mod_info['name']
        for file, file_cid in content['data'].items():
            file_content = self.get(file_cid)
            filepath = os.path.join(modpath, file)
            m.put_text(filepath, file_content)
        # Init .mod/branch metadata
        mod_meta = os.path.join(modpath, '.mod')
        os.makedirs(mod_meta, exist_ok=True)
        with open(os.path.join(mod_meta, 'branch'), 'w') as f:
            f.write('main')
        return self.reg_info(mod_info)

    def reg(self, mod: Union[str, dict] = 'store', key=None, comment=None, public=True, token=None, name=None) -> Dict[str, Any]:
        """Register or update a module in the store."""
        if self.is_cid_url(mod):
            return self.reg_cid(mod)
        elif self.is_git_url(mod):
            return self.reg_git(mod, key=key, comment=comment, name=name)
        if token:
            key = m.mod('auth.base')().verify(token)['key']
        info = self.get_info(mod=mod, key=key, comment=comment, public=public, name=name)
        info['cid'] = self.reg_info(info)
        self.update()
        return info

    def update(self):
        self.mods(update=1)

    def rm_mod(self, mod='store', key=None) -> bool:
        """Remove a mod from the store."""
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

    # --- Schema ---

    def schema(self, mod='store', key=None) -> Dict[str, Any]:
        """Get the schema of a mod."""
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

    # --- Versioning ---

    def timestamp2utc(self, timestamp: int) -> str:
        import datetime
        return datetime.datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')

    def versions(self, mod='app', key=None, df=False, n=1000, update=True, max_age=None) -> List[Dict[str, Any]]:
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
            if cid is not None:
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
                    if prev_cid is None:
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
        if n is not None:
            result = result[:n]
        return result

    v = versions

    def anchor_file(self, mod: str, key=None) -> Dict[str, Any]:
        mod_info = self.mod(mod, key=key)
        if not mod_info:
            return None
        content = mod_info.get('content', {})
        content = self.get(content)
        assert 'data' in content, f"Content for mod {mod} is missing 'data' field."
        file2content = self.get(content['data'])
        file_name_options = ['mod.py', 'server.py', mod_info['name'] + '.py']
        for file_path, file_content in file2content.items():
            if any(opt in file_path for opt in file_name_options):
                return file_path
        return None

    def setback(self, mod: str, cid: str, key=None, safety=True) -> Dict[str, Any]:
        """Setback a module to a previous CID."""
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

    # --- Users ---

    def user_keys(self, key=None) -> List[str]:
        """List all unique users who have registered mods."""
        return list(self.registry().keys())

    def users(self, search=None, update=False, **kwargs) -> List[Dict[str, Any]]:
        """List all users who have registered mods."""
        path = self.path('users')
        users = m.get(path, update=update)
        if users is None:
            user_keys = self.user_keys()
            users = []
            for user_key in user_keys:
                if search and search not in user_key:
                    continue
                users.append(self.user(user_key, update=update))
            m.put(path, users)
        return users

    def user(self, key: str = None, update=False, expand=False) -> Dict[str, Any]:
        """Get information about a specific user."""
        key = self.key_address(key)
        user_path = self.path(f'users/{key}_expand={expand}.json')
        user = m.get(user_path, None, update=update)
        if user is None:
            user = {
                'key': key,
                'balance': 0,
                'mods': [self.get(_cid) for _cid in self.registry().get(key, {}).values()]
            }
            user['mods'] = self.put(user['mods'])
            user['n'] = len(user['mods'])
            m.put(user_path, user)
        if expand:
            user['mods'] = self.get(user['mods'])
        return user

    # --- Bulk registration ---

    def regall(self, key=None, depth=1, comment=None, public=False, timeout=30) -> Dict[str, Any]:
        """Register all mods in the local environment."""
        results = []
        for mod_name in m.mods(depth=depth):
            try:
                result = self.reg(mod=mod_name, key=key, comment=comment, public=public)
                print(f"Registered mod: {result['name']} with CID: {result['cid']}")
                results.append(result)
            except Exception as e:
                print(f"Error registering mod: {str(e)}")
        return results

    def reg_payload(self, mod: str = 'store', key=None, comment=None) -> Dict[str, Any]:
        """Generate registration payload without executing registration."""
        info = self.get_info(mod=mod, key=key, comment=comment)
        return info

    def _clear(self) -> bool:
        m.put(self.registry_path, {})
        self.store.gc(aggressive=True)
        return {'status': 'registry cleared'}

    def root(self, encrypt=True, update=True, **kwargs) -> str:
        path = self.path('root_cid.json')
        root_cid = m.get(path, None, update=update)
        if root_cid is None:
            registry = self.registry()
            if encrypt:
                registry = self.key.encrypt(registry)
            root_cid = self.put(registry)
            m.put(path, root_cid)
        return root_cid

    def get_root(self, decrypt=True, **kwargs) -> Dict[str, Any]:
        path = self.path('root_cid.json')
        root_cid = m.get(path, None)
        assert root_cid is not None, "Root CID not found. Please generate it first."
        registry = self.get(root_cid)
        if decrypt:
            registry = self.key.decrypt(registry)
        return registry

    def dp(self, path: str, key=None) -> str:
        key = self.key_address(key)
        if key != self.key.address:
            path = key + '/' + path
        return m.dp(path)
