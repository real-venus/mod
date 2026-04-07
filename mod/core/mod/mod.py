"""
Mod — the core class, composed from focused mixins.

    core/mod/
    ├── __init__.py   ← re-exports Mod
    ├── mod.py        ← this file (Mod: resolve + introspect + config + key + storage)
    ├── fs.py         ← FsMixin  (path & file utilities)
    ├── deploy.py     ← DeployMixin  (server, docker, deploy)
    ├── factory.py    ← FactoryMixin  (new, fork, clone, rm)
    └── tx.py         ← Tx  (transaction logging)
"""

import os
import sys
import glob as globmod
import json
import time
import logging
import inspect
import subprocess
from typing import Any, Dict, List, Optional, Union
from functools import partial

import yaml

from .fs import FsMixin
from .deploy import DeployMixin
from .factory import FactoryMixin

logger = logging.getLogger(__name__)


class Mod(FsMixin, DeployMixin, FactoryMixin):

    # ── Class Constants ──────────────────────────────────────────────────
    name = 'mod'

    _avoid_folders = frozenset([
        '__pycache__', '.git', '.ipynb_checkpoints', 'node_modules',
        'egg-info', 'private', '.venv', 'venv', '.env', '.mod'
    ])
    _default_file_types = ('py', 'json', 'sol')
    _default_anchor_names = ('agent', 'mod', 'block')
    lib_name = __file__.split('/')[-3]   # core/mod/__init__.py → 'core'

    # ── Caches (class-level) ─────────────────────────────────────────────
    _mod_cache = {}
    _config_cache = {}
    obj_cache = {}
    modscache = {}
    executor_cache = {}

    # ── Init & Config ────────────────────────────────────────────────────

    def __init__(self, config=None, **kwargs):
        if os.getcwd() in [os.path.expanduser('~'), '/']:
            raise ValueError(
                f'Cannot sync in home directory {os.getcwd()}, '
                'please cd into a project directory'
            )

        self.paths = {}
        # core/mod/__init__.py → dirname x3 = mod/core → dirname = mod → dirname = lib
        self.paths['mod'] = self.mod_path = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        self.paths['lib'] = self.lib_path = os.path.dirname(self.paths['mod'])
        self.paths['orbit'] = {
            'orbit': f'{self.mod_path}/orbit',
            'core': f'{self.mod_path}/core',
            'portal': f'{self.mod_path}/portal',
            'local': os.getcwd(),
        }

        for path in self.paths['orbit'].values():
            os.makedirs(path, exist_ok=True)

        self.paths['home'] = self.homepath = os.path.expanduser('~')
        self.paths = self.munch(self.paths)
        self.avoid_folders = set(self._avoid_folders)

        config = self.config()
        self.name = config['name']
        self.storage_path = f'{self.homepath}/.{self.name}'
        self.port_range = config['port_range']
        self.expose = self.endpoints = config['expose']
        self.file_types = list(self._default_file_types)
        self.anchor_names = list(self._default_anchor_names) + [self.name]

        from ..tree import Tree
        self._tree = Tree(self)
        self.set_routes(self.routes())

    # ── Config ───────────────────────────────────────────────────────────

    def config(self, mod=None):
        """Returns the config for a mod (or root config if mod is None)."""
        configs = self.config_paths(mod=mod)
        if not configs:
            return {}
        return self.get_json(configs[0])

    def config_paths(self, mod=None, modes=['yaml', 'json'], search=None,
                     depth=3, filename_options=['config', 'cfg', 'mod', 'block', 'agent', 'bloc', 'server']):
        path = '/'.join(__file__.split('/')[:-4]) if mod is None else self.dirpath(mod)

        def is_config(f):
            return any(f.endswith(f'/{name}.{m}') for name in filename_options for m in modes)

        configs = [f for f in self.files(path, depth=depth) if is_config(f)]
        if search is not None:
            configs = [f for f in configs if search in f]
        return sorted(configs, key=len)

    def config_path(self, mod=None, **kwargs):
        configs = self.config_paths(mod=mod, **kwargs)
        return configs[0] if configs else None

    def set_config(self, config=None):
        if config is None:
            configs = sorted(self.config_paths(config), key=len)
            if not configs:
                raise FileNotFoundError('No config file found')
            if configs[0].endswith('.json'):
                config = self.get_json(configs[0])
            elif configs[0].endswith(('.yaml', '.yml')):
                config = self.get_yaml(configs[0])
            else:
                raise ValueError(f'Unknown config format: {configs[0]}')
        return config

    def save_config(self, mod: str, config: dict):
        paths = self.config_paths(mod)
        path = paths[0] if paths else self.dp(mod) + '/config.json'
        assert path is not None, 'No config path found'
        if path.endswith('.json'):
            with open(path, 'w') as f:
                json.dump(config, f, indent=4)
        elif path.endswith(('.yaml', '.yml')):
            with open(path, 'w') as f:
                yaml.dump(config, f)
        return path

    @property
    def shortcuts(self):
        shortcuts = self.config()['shortcuts']
        shortcuts[self.name] = 'mod'
        return {k: v for k, v in shortcuts.items() if isinstance(v, str)}

    def set_routes(self, routes: dict, verbose=True):
        for mod, fns in routes.items():
            mod = self.import_mod(mod)
            for fn in fns:
                if not hasattr(self, fn):
                    def partial_fn(mod, fn):
                        return partial(getattr(mod, fn))
                    setattr(self, fn, partial_fn(mod, fn))

    def routes(self, obj=None):
        routes = {}
        for util in self.get_utils():
            k = '.'.join(util.split('.')[:-1])
            v = util.split('.')[-1]
            routes.setdefault(k, []).append(v)
        return routes

    # ── Resolve (module resolution, anchor discovery, object import) ───

    def mod(self, mod: str = 'mod', params: dict = None, cache=True,
            verbose=False, update=False, **kwargs):
        """Import and return a mod class."""
        t0 = self.time()
        mod = mod or self.name
        if mod == self.name:
            from . import Mod
            return Mod
        if not isinstance(mod, str):
            return mod
        name = self.get_name(mod)
        if name in self._mod_cache:
            return self._mod_cache[name]
        obj = self.anchor_object(name)
        self._mod_cache[name] = obj
        self.print(f'mod({name} [{self.time() - t0:.2f}s])', verbose=verbose)
        return obj

    def fn(self, fn: Union[callable, str], params: str = None,
           default_fn='forward', default_mod='mod') -> 'Callable':
        """Resolve a function from 'mod/fn' string notation."""
        if callable(fn):
            return fn
        if hasattr(self, fn):
            fn_obj = getattr(self, fn)
        else:
            if fn.startswith('/'):
                mod_name, fn_name = default_mod, fn[1:]
            elif fn.endswith('/'):
                mod_name = fn[:-1].split('/')[0] if '/' in fn[:-1] else fn[:-1]
                fn_name = default_fn
            elif '/' in fn:
                mod_name, fn_name = fn.split('/')
            elif self.mod_exists(fn):
                mod_name, fn_name = fn, default_fn
            else:
                raise Exception(f'Function {fn} not found')

            if mod_name not in self.modscache:
                self.modscache[mod_name] = self.mod(mod_name)()
            fn_obj = getattr(self.modscache[mod_name], fn_name)

        return fn_obj(**params) if params else fn_obj

    def mod_exists(self, mod: str, **kwargs) -> bool:
        try:
            name = self.get_name(mod)
            if self.search(name):
                return True
        except Exception:
            pass
        mod_path = os.path.join(self.paths['orbit']['orbit'], mod)
        return os.path.exists(mod_path) and os.path.isdir(mod_path)

    def get_name(self, name: Optional[str] = None,
                 avoid_terms=['src', 'mods', '_mods', 'core', 'modules', '_exp', 'ext']) -> str:
        name = name or 'mod'
        if any(name.startswith(p) for p in ['.', '~', '/']):
            name = self.path2name(name)
        avoid_terms = avoid_terms + [
            self.paths['orbit']['orbit'].split('/')[-1],
        ]
        name = name.replace('/', '.')
        new_name = [c for c in name.split('.') if c not in avoid_terms]
        if not new_name:
            return self.name
        if new_name[0] == self.name:
            new_name = new_name[1:]
        return '.'.join(new_name).strip('.').lower() or self.name

    def dirpath(self, mod=None, update=False, trials=4, key=None, **kwargs) -> str:
        """Get the directory path of a mod."""
        if mod is None or mod == self.name:
            return self.paths['lib']
        tree_options = list(self.search(search=mod, update=update).values())
        if not tree_options:
            if trials > 0:
                return self.dirpath(mod=mod, update=True, trials=trials - 1, key=key)
            assert False, f'Mod {mod} not found in tree'
        dirpath = tree_options[0]
        if not os.path.exists(dirpath) and trials > 0:
            return self.dirpath(mod=mod, update=True, trials=trials - 1, key=key)
        assert os.path.exists(dirpath), f'Dirpath {dirpath} does not exist for mod {mod}'
        return dirpath

    def filepath(self, obj=None) -> str:
        return inspect.getfile(self.mod(obj))

    def anchor_file(self, path, depth=4):
        """Find the anchor file (mod.py, agent.py, etc.) in a mod directory."""
        path = path.replace('/', '.')
        path = self.dirpath(path)
        anchor_names = self.anchor_names.copy() + path[len(self.homepath + '/'):].split('/')
        files = sorted(self.files(path, depth=depth), key=len)
        files = [f for f in files if any(f.endswith('.' + ft) for ft in self.file_types)]

        if len(files) == 1:
            return files[0]

        result_options = []
        for ft in self.file_types:
            for anchor in anchor_names:
                for f in files:
                    if f.endswith(f'/{anchor}.{ft}'):
                        result_options.append(f)

        if result_options:
            return sorted(result_options, key=len)[0]

        file_relative = [f[len(path) + 1:] for f in files]
        raise Exception(
            f'No anchor file found in {path} with anchor names '
            f'{anchor_names} and file types {self.file_types} {file_relative}'
        )

    def anchor_object(self, path):
        path = self.get_name(path)
        anchor_file = self.anchor_file(path)
        if not anchor_file:
            raise Exception(f'No anchor file found in {path}')
        classes = self.classes(anchor_file)
        assert classes, f'No classes found in {anchor_file}'
        return self.obj(classes[-1])

    def has_anchor(self, path) -> bool:
        """Fast check if a path has a valid anchor file."""
        path = self.abspath(path)
        if not os.path.isdir(path):
            return False
        path_parts = path.rstrip('/').split('/')
        anchor_names = list(self._default_anchor_names) + [path_parts[-1]]
        return any(
            os.path.isfile(os.path.join(path, f'{name}.{ft}'))
            for ft in self.file_types for name in anchor_names
        )

    def ensure_syspath(self):
        if not getattr(self, '_syspath_done', False):
            for path in [self.pwd(), self.paths['lib']]:
                if path not in sys.path:
                    sys.path.append(path)
            self._syspath_done = True

    def obj(self, key: str) -> Any:
        self.ensure_syspath()
        if key in self.obj_cache:
            return self.obj_cache[key]
        from importlib import import_module as _imp
        try:
            parts = key.replace('/', '.').replace('::', '.').rsplit('.', 1)
            obj = getattr(_imp(parts[0]), parts[1])
        except (ValueError, AttributeError):
            obj = self.import_module(key)
        self.obj_cache[key] = obj
        return obj

    def obj_exists(self, path: str) -> bool:
        try:
            self.obj(path)
            return True
        except Exception:
            return False

    def import_mod(self, mod: str):
        from importlib import import_module
        mod = mod.replace(f'{self.lib_name}.{self.lib_name}', self.lib_name)
        return import_module(mod)

    # ── Introspect (code inspection, schema, content analysis) ────────

    def code(self, obj=None, **kwargs) -> Union[str, Dict[str, str]]:
        if '/' in str(obj):
            obj = self.fn(obj)
        elif self.mod_exists(obj):
            obj = self.mod(obj)
        elif hasattr(self, obj):
            obj = getattr(self, obj)
        elif self.obj_exists(obj):
            obj = self.obj(obj)
        return inspect.getsource(obj)

    def content(self, mod=None, ignore_folders=[], depth=10, **kwargs) -> Dict[str, str]:
        """Get mod content as {relative_path: file_text}."""
        mod = mod or 'mod'
        dirpath = self.abspath(self.dirpath(mod))
        files = self.files(dirpath, depth=depth)
        content = {}
        for k in files:
            try:
                content[k] = self.text(k)
            except Exception as e:
                content[k] = str(self.error(e))
        prefix = dirpath + '/'
        content = {k[len(prefix):]: v for k, v in content.items()}
        if ignore_folders:
            content = {k: v for k, v in content.items()
                       if not any(f'/{f}/' in k for f in ignore_folders)}
        return dict(sorted(content.items()))

    def content_files(self, mod='store', **kwargs) -> List[str]:
        return list(self.content(mod=mod, **kwargs).keys())

    def size(self, mod) -> int:
        return len(str(self.content(mod)))

    def mod_files(self, mod='store', search=None, **kwargs) -> List[str]:
        return self.files(self.dirpath(mod), search=search, **kwargs)

    def nfiles(self, mod=None, depth=2):
        return len(self.files(self.dirpath(mod), depth=depth))

    def fns(self, obj: Any = None, search=None, include_hidden=False, **kwargs) -> List[str]:
        """Get list of public functions on a mod."""
        obj = self.mod(obj)()
        fns = sorted(set(dir(obj)))
        if search is not None:
            fns = [f for f in fns if search in f]
        if not include_hidden:
            fns = [f for f in fns if not f.startswith('_')]
        return sorted(fns)

    def fnschema(self, fn: str = '__init__', public=True,
                 avoid_arguments=['self', 'cls'], **kwargs) -> dict:
        """Get function schema including input/output types."""
        fn_obj = self.fn(fn)
        if not callable(fn_obj):
            return {'fn_type': 'property', 'type': type(fn_obj).__name__}

        sig = inspect.signature(fn_obj)
        schema = {'input': [], 'output': {}, 'docs': '', 'cost': 0, 'name': '', 'content': None}
        if public:
            schema['content'] = inspect.getsource(fn_obj)

        for k, v in sig._parameters.items():
            if k in avoid_arguments:
                continue
            schema['input'].append({
                'name': k,
                'value': '_empty' if v.default == inspect._empty else v.default,
                'type': '_empty' if v.default == inspect._empty else type(v.default).__name__,
            })

        schema['output'] = {
            'value': None,
            'type': str(getattr(fn_obj, '__annotations__', {}).get('return', None)),
        }
        schema['docs'] = fn_obj.__doc__
        schema['cost'] = getattr(fn_obj, '__cost__', 0)
        schema['name'] = fn_obj.__name__
        return schema

    def args(self, fn: str = '__init__', **kwargs) -> list:
        return self.fnschema(fn, **kwargs)['input']

    def schema(self, obj=None, search=None, public=True,
               return_mode='dict', verbose=False, **kwargs) -> dict:
        """Get schema for all functions on a mod."""
        obj = obj or 'mod'
        public = bool(public)
        if callable(obj) or (isinstance(obj, str) and '/' in obj):
            return self.fnschema(obj, public=public, **kwargs)

        print(f'Getting schema for mod {obj}')
        fns = self.fns(obj, search=search, **kwargs)
        mod_obj = self.mod(obj)
        schema = {}
        for fn in fns:
            try:
                schema[fn] = self.fnschema(getattr(mod_obj, fn), public=public, **kwargs)
            except Exception as e:
                if verbose:
                    print(self.error(e))
        if return_mode == 'list':
            return list(schema.values())
        elif return_mode == 'dict':
            return schema
        raise Exception('Invalid return mode', return_mode)

    def get_args(self, fn) -> List[str]:
        if not callable(fn):
            return []
        try:
            return inspect.getfullargspec(fn).args
        except Exception:
            return []

    def classes(self, path='./', **kwargs):
        path2classes = self.path2classes(path=path, **kwargs)
        classes = []
        for v in path2classes.values():
            classes.extend(v)
        return classes

    def path2classes(self, path='./', depth=4, tolist=False, **kwargs):
        """Get classes defined in Python files under path."""
        class_suffix = ':'
        class_prefix = 'class '
        path = self.abspath(path)
        path2classes = {}

        if os.path.isdir(path) and depth > 0:
            for p in self.ls(path):
                try:
                    for k, v in self.path2classes(p, depth=depth - 1).items():
                        if v:
                            path2classes[k] = v
                except Exception:
                    pass
        elif os.path.isfile(path) and path.endswith('.py'):
            classes = []
            code = self.get_text(path)
            objectpath = self.path2objectpath(path)
            for line in code.split('\n'):
                if line.startswith(class_prefix) and line.strip().endswith(class_suffix):
                    new_class = line.split(class_prefix)[-1].split('(')[0].strip()
                    if new_class.endswith(class_suffix):
                        new_class = new_class[:-1]
                    if ' ' not in new_class:
                        classes.append(new_class)
            if objectpath.startswith(path):
                objectpath = objectpath[len(path) + 1:]
            objectpath = objectpath.replace('/', '.')
            path2classes = {path: [objectpath + '.' + cl for cl in classes]}

        if tolist:
            return [cl for v in path2classes.values() for cl in v]
        return path2classes

    def path2fns(self, path='./', tolist=False, **kwargs):
        path2fns = {}
        path = os.path.abspath(path)
        if os.path.isdir(path):
            for p in globmod.glob(path + '/**/**.py', recursive=True):
                for k, v in self.path2fns(p, tolist=False).items():
                    if v:
                        path2fns[k] = v
        else:
            fns = []
            code = self.get_text(path) or ''
            path_prefix = self.path2objectpath(path)
            for line in code.split('\n'):
                if line.startswith('def ') or line.startswith('async def '):
                    fn = line.split('def ')[-1].split('(')[0].strip()
                    fns.append(f'{path_prefix}.{fn}')
            path2fns = {path: fns}
        if tolist:
            return [fn for v in path2fns.values() for fn in v]
        return path2fns

    def path2objectpath(self, path: str, **kwargs) -> str:
        """Convert filesystem path to Python object path (foo/bar.py -> foo.bar)."""
        path = os.path.abspath(path)
        for prefix in [self.paths['lib'], os.getcwd()]:
            if path.startswith(prefix):
                path = path[len(prefix) + 1:].replace('/', '.')
                break
        if path.endswith('.py'):
            path = path[:-3]
        return path.replace('__init__.', '.')

    def path2name(self, path: str,
                  ignore_folder_names=['mods', 'agents', 'src'],
                  possible_suffixes=['_', '']):
        ignore_set = {f + s for f in ignore_folder_names for s in possible_suffixes}
        name = self.path2objectpath(path)
        name_chunks = []
        for chunk in name.split('.'):
            if chunk not in ignore_set and chunk not in name_chunks:
                name_chunks.append(chunk)
        if name_chunks and name_chunks[0] == self.name:
            name_chunks = name_chunks[1:]
        return '.'.join(name_chunks) if name_chunks else self.name

    def is_in_file_types(self, f: str) -> bool:
        return any(f.endswith('.' + ft) for ft in self.file_types)

    def is_mod_file(self, mod=None, exts=['py', 'rs', 'ts'],
                    folder_filenames=['mod', 'agent', 'block', 'server']) -> bool:
        dirpath = self.dirpath(mod)
        try:
            fp = self.filepath(mod)
        except Exception as e:
            self.print(f'Error getting filepath for {mod}: {e}', color='red', verbose=False)
            return False
        folder_filenames.append(mod.split('.')[-1])
        for ext in exts:
            for fn in folder_filenames:
                if fp.endswith(f'/{fn}.{ext}'):
                    return False
                if fp.endswith(f'/{mod.split(".")[-1]}.{ext}'):
                    return True
        return dirpath.split('/')[-1] != fp.split('/')[-1].split('.')[0]

    # ── Tree & Search (delegated to core.tree) ───────────────────────────

    def tree(self, *args, **kwargs):
        return self._tree.tree(*args, **kwargs)

    def get_tree(self, *args, **kwargs):
        return self._tree.get_tree(*args, **kwargs)

    def core_tree(self, *args, **kwargs):
        return self._tree.core_tree(*args, **kwargs)

    def orbit(self, *args, **kwargs):
        return self._tree.orbit(*args, **kwargs)

    def operational_tree(self, *args, **kwargs):
        return self._tree.operational_tree(*args, **kwargs)

    @staticmethod
    def filter_fn(k, search):
        from ..tree import Tree
        return Tree.filter_fn(k, search)

    def search(self, *args, **kwargs):
        return self._tree.search(*args, **kwargs)

    def process_path(self, x):
        return self._tree.process_path(x)

    # ── Key & Crypto ─────────────────────────────────────────────────────

    def get_key(self, key: str = None, **kwargs):
        return self.mod('key')().get_key(key, **kwargs)

    def key(self, key: str = None, **kwargs):
        return self.get_key(key, **kwargs)

    def keys(self, key: str = None, **kwargs):
        return self.get_key().keys(key, **kwargs)

    def key2address(self, key: str = None, **kwargs):
        return self.get_key().key2address(key, **kwargs)

    def key_address(self, key: str = None, **kwargs) -> str:
        return self.get_key(key).key2address(**kwargs).get(key, key)

    def address2key(self, *args, **kwargs):
        return self.fn('key/address2key')(*args, **kwargs)

    def addy(self, key=None):
        return self.fn('key/addy')(key)

    def envs(self, key: str = None, **kwargs):
        return self.get_key(key, **kwargs).envs()

    def encrypt(self, data: Union[str, bytes], key: str = None, password: str = None, **kwargs) -> bytes:
        return self.get_key(key).encrypt(data, password=password)

    def decrypt(self, data: Any, password: str = None, key: str = None, **kwargs) -> bytes:
        return self.get_key(key).decrypt(data, password=password)

    def sign(self, data: dict = None, key: str = None, crypto_type=None, mode='str', **kwargs) -> bool:
        key = self.get_key(key, crypto_type=crypto_type)
        crypto = crypto_type or key.crypto_type
        signature = key.sign(data, mode=mode, **kwargs)
        assert self.verify(data, signature=signature, address=key.address, crypto_type=crypto), 'Invalid signature'
        return signature

    def verify(self, data, signature=None, address=None, key=None, **kwargs) -> bool:
        return self.get_key(key).verify(data=data, signature=signature, address=address, **kwargs)

    def owner(self):
        return self.get_key().address

    def is_owner(self, address: str) -> bool:
        return address.lower() == self.owner().lower()

    def mnemonic(self, words=24):
        if words not in [12, 15, 18, 21, 24]:
            if words > 24:
                tiles = words // 24 + 1
                mnemonic = ' '.join(self.mnemonic(24) for _ in range(tiles))
            else:
                mnemonic = self.mnemonic(24)
            return ' '.join(mnemonic.split()[:words])
        return self.mod('key')().generate_mnemonic(words=words)

    def pwd2key(self, pwd, **kwargs) -> str:
        return self.mod('key')().str2key(pwd, **kwargs)

    # ── Storage (get/put) ────────────────────────────────────────────────

    def get(self, k: str, default: Any = None, max_age: str = None,
            fs = 'localfs',
            update: bool = False, password: str = None, verbose=False, **kwargs) -> Any:
        if self.iscid(k):
            if '/' in k:
                fs = k.split('/')[0]
            return self.fn(f'{fs}/get')(k)
        k = self.get_path(k)
        data = self.get_json(k, default=default, **kwargs)
        if password is not None:
            assert data['encrypted'], f'{k} is not encrypted'
            data['data'] = self.decrypt(data['data'], password=password)
        data = data or default
        if not isinstance(data, dict):
            return default
        if update:
            return default
        if max_age is not None:
            timestamp = data.get('timestamp', data.get('time', 0))
            if (time.time() - float(timestamp)) > max_age:
                return default
        return data.get('data', data)

    def put(self, k: str, v: Any, encrypt: bool = False, password: str = None, **kwargs) -> Any:
        k = self.get_path(k)
        encrypt = encrypt or password is not None
        if encrypt:
            v = self.encrypt(v, password=password)
        data = {'data': v, 'encrypted': encrypt, 'timestamp': time.time()}
        return self.put_json(k, data)

    def get_json(self, path: str, default: Any = None, **kwargs) -> Any:
        path = self.abspath(path)
        if not path.endswith('.json'):
            path += '.json'
        if not os.path.exists(path):
            return default
        try:
            with open(path, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logger.warning(f'Error loading json from {path}: {e}')
            return default

    def put_json(self, path: str, data: Dict, **kwargs) -> str:
        path = self.abspath(path if path.endswith('.json') else path + '.json')
        if isinstance(data, dict):
            self.put_text(path, json.dumps(data))
        return path

    def get_text(self, path: str, default=None, **kwargs) -> str:
        path = self.abspath(path)
        try:
            with open(path, 'r') as f:
                return f.read()
        except Exception:
            return default

    def put_text(self, path: str, text: str, key=None, password=None):
        path = self.abspath(path)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        if not isinstance(text, str):
            text = self.python2str(text)
        if key is not None:
            text = self.get_key(key).encrypt(text, password=password)
        with open(path, 'w') as f:
            f.write(text)
        return {'success': True, 'path': path, 'size': len(text) * 8}

    def text(self, path: str = './', **kwargs) -> str:
        path = self.abspath(path)
        assert self.homepath != path, f'Cannot read {path}'
        if os.path.isdir(path):
            return self.file2text(path)
        with open(path, 'r') as f:
            return f.read()

    fs = 'localfs'
    def iscid(self, text: str) -> bool:
        if not isinstance(text, str):
            return False
        return (text.startswith('Qm') and len(text) == 46) or (text.startswith(self.fs) and len(text) == 59) or text.startswith(self.fs)

    def env(self, key: str = None) -> Union[str, dict, None]:
        if key is not None:
            return os.environ.get(key)
        return dict(os.environ)

    def rm(self, path: str, possible_extensions=None, avoid_paths=None) -> dict:
        possible_extensions = possible_extensions or ['json']
        avoid_paths = avoid_paths or ['~', '/']
        path = self.abspath(path)
        if path in set(map(self.abspath, avoid_paths)):
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
            import shutil
            shutil.rmtree(path)
        elif os.path.isfile(path):
            os.remove(path)
        if os.path.exists(path):
            raise OSError(f'Failed to remove {path}')
        return {'success': True, 'message': f'{path} removed'}

    # ── CLI & Misc ───────────────────────────────────────────────────────

    def main(self, *args, **kwargs):
        from ..cli.cli import Cli
        return Cli().forward()

    def forward(self, fn: str = 'info', params: dict = None, auth=None) -> Any:
        params = params or {}
        fn_obj = getattr(self, fn) if hasattr(self, fn) else self.fn(fn)
        return fn_obj(**params)

    def call(self, _fn: str = 'api/forward', params: Dict[str, Any] = {},
             timeout=30, wait=True, **_kwargs):
        if '/' not in _fn:
            _fn = _fn + '/forward'
        fn_obj = self.fn(_fn)
        return fn_obj(**{**params, **_kwargs})

    def ask(self, *args, **kwargs):
        return self.fn('agent/')(*args, **kwargs)

    def about(self, mod='store', query='what is this?', *extra_query):
        query = query + ' '.join(extra_query)
        return self.ask(f' {self.schema(mod)} {query}')

    def how(self, mod, query, *extra_query):
        code = self.code(mod)
        query = ' '.join([query, *extra_query])
        return self.fn('model.openrouter/')(f'query={query} code={code}')

    def help(self, mod='mod', query: str = 'what is this', *extra_query, **kwargs):
        query = ' '.join(map(str, [query, *extra_query]))
        context = self.code()
        return self.mod('agent')().ask(
            f'given the code {self.code(mod)} and CONTEXT OF mod {context} '
            f'answer the following question: {query}',
            preprocess=False,
        )

    def context(self, path=None):
        return self.code()

    def edit(self, *query, mod='app', base=None, timeout=60, wait=False, **kwargs):
        query_str = ' '.join(map(str, query))
        params = {'query': query_str, 'mod': mod, 'base': base}
        print(f'Editing {mod} with query: {query_str}')
        return self.call('api/edit', params=params, wait=wait, timeout=timeout, **kwargs)

    def desc(self, mod='mod', **kwargs):
        return self.fn('desc/')(mod, **kwargs)

    def test(self, mod=None, **kwargs) -> Dict[str, str]:
        return self.fn('tester/forward')(mod=mod, **kwargs)

    def pytest(self, mod='pypm'):
        return self.fn('tester/pytest')(mod)

    # ── Info & Registry ──────────────────────────────────────────────────

    _api = None

    def info(self, mod: str = 'mod', schema=False, key=None, public=False, **kwargs):
        if self._api is None:
            self._api = self.mod('api')()
        if not self._api.exists(mod, key=key):
            self._api.reg(mod=mod, key=key, public=public)
        return self._api.mod(mod=mod, schema=schema, key=key, **kwargs)

    def verify_info(self, info: Union[str, dict] = None, **kwargs) -> bool:
        if isinstance(info, str):
            info = self.info(info, **kwargs)
        signature = info.pop('signature')
        assert self.verify(data=info, signature=signature, address=info['key']), 'Invalid signature'
        info['signature'] = signature
        return info

    def cid(self, mod=None, **kwargs) -> Union[str, Dict[str, str]]:
        return self.fn('api/put')(self.content(mod, **kwargs))

    def reg(self, *args, **kwargs):
        return self.fn('api/reg')(*args, **kwargs)

    def setback(self, *args, **kwargs):
        return self.fn('api/setback')(*args, **kwargs)

    def txs(self, **kwargs):
        return self.df(self.call('api/txs', df=0, **kwargs))

    def token(self, *args, **kwargs):
        return self.fn('auth/token')(*args, **kwargs)

    # ── Module Listing ───────────────────────────────────────────────────

    def mods(self, search=None, startswith=None, endswith=None, **kwargs) -> List[str]:
        return list(self.tree(search=search, endswith=endswith, startswith=startswith, **kwargs).keys())

    def core_mods(self, *args, **kwargs) -> List[str]:
        return list(self.core_tree(*args, orbit='core', **kwargs).keys())

    def local_mods(self) -> List[str]:
        return list(self.orbit('local').keys())

    # ── Utilities ────────────────────────────────────────────────────────

    def munch(self, d: dict) -> Any:
        from ..config import Config
        return Config.from_dict(d)

    def print(self, *text: str, **kwargs):
        return self.obj('mod.core.utils.print_console')(*text, **kwargs)

    def time(self, mode='float') -> float:
        t = time.time()
        if mode == 'int':
            return int(t * 1000)
        elif mode == 'float':
            return float(t)
        elif mode == 'iso':
            return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(t))
        elif 'date' in mode:
            return time.ctime(t)

    def time2str(self, t: float = None, fmt: str = '%Y-%m-%d %H:%M:%S') -> str:
        t = t or time.time()
        return time.strftime(fmt, time.localtime(t))

    def sleep(self, period):
        time.sleep(period)

    def hash(self, obj, mode='sha256', **kwargs):
        return self.obj('mod.core.utils.hash')(obj, mode=mode, **kwargs)

    def get_utils(self, search=None):
        utils = self.path2fns(self.paths['orbit']['core'] + '/utils.py', tolist=True)
        if search is not None:
            utils = [u for u in utils if search in u]
        return sorted(utils)

    def utils(self, search=None):
        return self.get_utils(search=search)

    def kwargs2str(self, kwargs) -> str:
        kwargs.pop('self', None)
        kwargs.pop('cls', None)
        return '_'.join(f'{k}={v}' for k, v in kwargs.items())

    def loop(self):
        import asyncio
        return asyncio.get_event_loop()

    def confirm(self, message: str = 'Are you sure?', suffix=' (y/n): '):
        if input(message + suffix).lower() != 'y':
            raise KeyboardInterrupt('Operation cancelled by user')
        return True

    def mod_class(self, obj=None) -> str:
        return (obj or self.__class__).__name__

    def dir(self, obj=None, search=None, *args, **kwargs):
        obj = self.obj(obj)
        result = dir(obj)
        return [f for f in result if search in f] if search is not None else result

    def hasattr(self, mod, k):
        return hasattr(self.mod(mod)(), k)

    def readmes(self, mod=None, depth=2):
        return [f for f in self.files(self.dirpath(mod), depth=depth) if 'readme' in f.lower()]

    def readme(self, mod=None, depth=3):
        readmes = self.readmes(mod=mod, depth=depth)
        return self.get_text(readmes[0]) if readmes else None

    def client(self, *args, **kwargs):
        return self.fn('client/client')(*args, **kwargs)

    def host(self):
        return self.key().address

    def hosts(self):
        return self.fn('remote/hosts')()

    def repo2path(self, search=None):
        repo2path = {}
        for p in self.ls('~/'):
            if os.path.exists(p + '/.git'):
                r = p.split('/')[-1]
                if search is None or search in r:
                    repo2path[r] = p
        return dict(sorted(repo2path.items()))

    def repos(self, search=None):
        return list(self.repo2path(search=search).keys())

    def go(self, mod=None, **kwargs):
        path = self.dirpath(mod, relative=False)
        assert os.path.exists(self.abspath(path)), f'{path} does not exist'
        return self.cmd(f'code {path}', **kwargs)

    def vs(self, path=None):
        path = os.path.abspath(path or __file__)
        return self.cmd(f'code {path}')

    def push(self, comment, *extra_comment, mod=None, safety=False):
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

    def tool(self, tool_name: str = 'cmd', *args, **kwargs) -> Any:
        return self.mod(tool_name)(*args, **kwargs).forward

    def initialize(self, globals_input: dict):
        for fn in dir(self):
            if not fn.startswith('_'):
                globals_input[fn] = getattr(self, fn)
        return globals_input

    def cache(self, path: str, max_age: int = 60, default=None, directory: str = '~/.mod/cache'):
        def decorator(func):
            def wrapper(*args, **kwargs):
                fn_id = f'{func.__module__}.{func.__name__}'
                cache_path = self.abspath(f'{directory}/{fn_id}/{args}_{kwargs}')
                result = self.get(cache_path, default, max_age=max_age)
                if result is not None:
                    return result
                result = func(*args, **kwargs)
                self.put(cache_path, result)
                return result
            return wrapper
        return decorator

    def executor(self, max_workers=8, mode='thread', cache=True):
        path = f'executor/{mode}/{max_workers}'
        if cache and path in self.executor_cache:
            return self.executor_cache[path]
        if mode == 'process':
            from concurrent.futures import ProcessPoolExecutor
            executor = ProcessPoolExecutor(max_workers=max_workers)
        elif mode == 'thread':
            executor = self.mod('executor')(max_workers=max_workers)
        else:
            raise ValueError(f"Unknown mode: {mode}. Use 'thread' or 'process'.")
        if cache:
            self.executor_cache[path] = executor
        return executor

    def submit(self, fn, params=None, timeout: int = 40, mod: str = None,
               mode: str = 'thread', max_workers: int = 100):
        executor = self.executor(mode=mode, max_workers=max_workers)
        return executor.submit(self.fn(fn), params=params, timeout=timeout)

    def epoch(self, *args, **kwargs):
        return self.fn('vali/epoch')(*args, **kwargs)

    # ── Aliases ──────────────────────────────────────────────────────────
    fp = filepath
    dp = dirpath
    af = anchor_file
    ao = anchor_object
    cfg = config
    cpath = cfgpath = config_path
    cont = codemap = content
    get_fn = fn
    am = ms = mods
    cm = cmods = core_mods
    lm = lmods = local_mods
    a = ask
    e = edit
    card = info
    killall = DeployMixin.kill_all
    rm_mod = FactoryMixin.rmmod
    is_file_mod = is_mod_file
    future = fut = submit


def main():
    return Mod().main()
