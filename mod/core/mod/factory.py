"""FactoryMixin — module creation, copying, forking, removal."""

import os
import shutil
from typing import Any, List
from functools import partial


class FactoryMixin:

    def new(self, name='test_base', base='base', orbit='inner'):
        """Create a new mod from a base template."""
        dirpath = self.paths['orbit'][orbit] + '/' + name.replace('.', '/')
        if os.path.exists(dirpath):
            shutil.rmtree(dirpath)
        for k, v in self.content(base).items():
            new_path = dirpath + '/' + k.replace(f'{base}/', f'/{name}/')
            self.put_text(new_path, v)
        self.update()
        assert self.mod_exists(name), f'Mod {name} not found after creation'
        return {'name': name, 'path': dirpath, 'msg': 'Mod Created', 'base': base, 'cid': self.cid(name)}

    def addpath(self, path, name=None, update=True):
        assert os.path.exists(path), f'Path {path} does not exist'
        path = self.abspath(path)
        name = name or path.split('/')[-1]
        dirpath = self.paths['orbit']['inner'] + '/' + name.replace('.', '/')
        self.cmd(f'cp -r {path} {dirpath}')
        return {'name': name, 'path': dirpath, 'msg': 'Mod Created from path'}

    def addcid(self, name='churn', cid='QmXUjBQRFa8DbY2GhD1Aq6a44EBYzgejmtwwnYYTfvnFW4'):
        api = self.mod('api')()
        file2text = api.content(cid, expand=True)
        path = self.paths['orbit']['inner'] + '/' + name.replace('.', '/')
        for k, v in file2text.items():
            print(f'Creating {path}/{k} for mod {name}')
            self.put_text(f'{path}/{k}', v)
        self.tree(update=True)
        assert self.mod_exists(name), f'Mod {name} not found after creation from cid {cid}'
        return {'name': name, 'path': path, 'msg': 'Mod Created from cid', 'cid': cid}

    def update(self):
        tree = self.tree(update=1)
        return {
            'success': True, 'message': 'Mod tree updated',
            'mods': len(tree), 'orbits': self.paths['orbit'].to_dict(),
            'orbit2depth': self._tree.orbit2depth,
        }

    def cpmod(self, from_mod: str = 'dev', to_mod: str = 'dev2', force=True):
        return self.fn('factory/cpmod')(from_mod=from_mod, to_mod=to_mod, force=force)

    def rmmod(self, mod: str = 'test'):
        return self.fn('factory/rmmod')(mod=mod)

    def clone(self, mod, name):
        return self.fn('factory/clone')(mod=mod, name=name)

    def mergemods(self, from_mod: Any, to_mod: Any, fns: list):
        for fn in fns:
            setattr(to_mod, fn, getattr(from_mod, fn))
        return to_mod

    def add_fns(self, obj, add_fns=['fns', 'schema', 'code', 'cid', 'edit', 'config', 'info']):
        for fn in add_fns:
            if not hasattr(obj, fn):
                setattr(obj, fn, partial(getattr(self, fn), obj=obj.__name__))
        return obj

    def get_mods_path(self, exp=True):
        return self.paths['orbit']['outer'] if exp else self.paths['orbit']['inner']

    # ── Aliases ──────────────────────────────────────────────────────────
    create = add = fork = new
