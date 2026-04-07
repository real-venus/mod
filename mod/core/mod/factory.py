"""FactoryMixin — module creation, copying, forking, removal."""

import os
import json
import shutil
import subprocess
from typing import Any, List
from functools import partial


class FactoryMixin:

    # ── Branch Management ─────────────────────────────────────────────

    def init_mod_meta(self, dirpath, branch='main'):
        """Ensure {dirpath}/.mod/ exists with a default branch file."""
        mod_dir = os.path.join(dirpath, '.mod')
        os.makedirs(mod_dir, exist_ok=True)
        branch_file = os.path.join(mod_dir, 'branch')
        if not os.path.exists(branch_file):
            with open(branch_file, 'w') as f:
                f.write(branch)

    def branch(self, mod=None):
        """Read the current branch for a module. Defaults to 'main'."""
        dirpath = self.dirpath(mod) if mod else self.paths['lib']
        branch_file = os.path.join(dirpath, '.mod', 'branch')
        if os.path.exists(branch_file):
            with open(branch_file, 'r') as f:
                return f.read().strip()
        return 'main'

    def set_branch(self, mod=None, branch='main'):
        """Set the branch for a module."""
        dirpath = self.dirpath(mod) if mod else self.paths['lib']
        self.init_mod_meta(dirpath, branch=branch)
        branch_file = os.path.join(dirpath, '.mod', 'branch')
        with open(branch_file, 'w') as f:
            f.write(branch)
        return {'mod': mod or self.name, 'branch': branch}

    # ── Module Creation ───────────────────────────────────────────────

    def new(self, name='test_base', base='base', orbit='orbit'):
        """Create a new mod from a base template."""
        dirpath = self.paths['orbit'][orbit] + '/' + name.replace('.', '/')
        if os.path.exists(dirpath):
            shutil.rmtree(dirpath)
        for k, v in self.content(base).items():
            new_path = dirpath + '/' + k.replace(f'{base}/', f'/{name}/')
            self.put_text(new_path, v)
        self.init_mod_meta(dirpath)
        self.update()
        assert self.mod_exists(name), f'Mod {name} not found after creation'
        return {'name': name, 'path': dirpath, 'msg': 'Mod Created', 'base': base, 'cid': self.cid(name)}

    def addpath(self, path, name=None, update=True):
        assert os.path.exists(path), f'Path {path} does not exist'
        path = self.abspath(path)
        name = name or path.split('/')[-1]
        dirpath = self.paths['orbit']['orbit'] + '/' + name.replace('.', '/')
        self.cmd(f'cp -r {path} {dirpath}')
        self.init_mod_meta(dirpath)
        return {'name': name, 'path': dirpath, 'msg': 'Mod Created from path'}

    def addcid(self, name='churn', cid='QmXUjBQRFa8DbY2GhD1Aq6a44EBYzgejmtwwnYYTfvnFW4'):
        api = self.mod('api')()
        file2text = api.content(cid, expand=True)
        path = self.paths['orbit']['orbit'] + '/' + name.replace('.', '/')
        for k, v in file2text.items():
            print(f'Creating {path}/{k} for mod {name}')
            self.put_text(f'{path}/{k}', v)
        self.init_mod_meta(path)
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
        return self.paths['orbit']['orbit']

    def new_app(self, name='myapp', port=None, orbit='orbit', install=True, serve=True):
        """One-step: create a module app, configure, install, and serve.

        Usage:
            m.new_app('dashboard')
            # → Creates orbit/dashboard/ with Next.js app
            # → Sets owner, port, basePath
            # → Installs npm deps
            # → Starts the server via PM2
            # → Registers in app_namespace
        """
        # 1. Copy the appbase template (full directory tree, not just mod content)
        base_root = self.dirpath('appbase')            # orbit/appbase/
        target = self.paths['orbit'][orbit] + '/' + name.replace('.', '/')
        if os.path.exists(target):
            shutil.rmtree(target)
        shutil.copytree(base_root, target, ignore=shutil.ignore_patterns(
            'node_modules', '.next', '__pycache__', '_serve.sh',
        ))

        # 2. Rename inner module dir: target/appbase/ → target/{name}/
        old_inner = os.path.join(target, 'appbase')
        new_inner = os.path.join(target, name)
        if os.path.exists(old_inner):
            os.rename(old_inner, new_inner)

        # 3. Allocate port and fill mod.json with owner, name, port, basePath
        import mod
        owner = self.owner()
        port = port or mod.free_port()
        app_dir = os.path.join(target, 'app')
        mod_json_path = os.path.join(app_dir, 'app.json')
        config = {
            'name': name,
            'port': port,
            'basePath': f'/{name}',
            'owner': owner,
        }
        with open(mod_json_path, 'w') as f:
            json.dump(config, f, indent=2)

        # 4. Update next.config.js basePath
        next_config_path = os.path.join(app_dir, 'next.config.js')
        if os.path.exists(next_config_path):
            with open(next_config_path) as f:
                content = f.read()
            content = content.replace("'/appbase'", f"'/{name}'")
            with open(next_config_path, 'w') as f:
                f.write(content)

        # 5. Update package.json name
        pkg_path = os.path.join(app_dir, 'package.json')
        if os.path.exists(pkg_path):
            with open(pkg_path) as f:
                pkg = json.load(f)
            pkg['name'] = name
            with open(pkg_path, 'w') as f:
                json.dump(pkg, f, indent=2)

        # 6. Update template page and layout with module name
        for fpath in [
            os.path.join(app_dir, 'app', 'page.tsx'),
            os.path.join(app_dir, 'app', 'layout.tsx'),
        ]:
            if os.path.exists(fpath):
                with open(fpath) as f:
                    txt = f.read()
                txt = txt.replace('appbase', name)
                with open(fpath, 'w') as f:
                    f.write(txt)

        # 7. Init .mod/branch metadata
        self.init_mod_meta(target)

        # 8. Refresh the module tree so the new mod is discoverable
        self.update()

        # 8. Install npm deps
        if install:
            subprocess.run(['npm', 'install', '--prefer-offline'], cwd=app_dir,
                           capture_output=True, timeout=120)

        # 9. Register and serve
        if serve:
            ns = self.mod('server.namespace')()
            ns.reg_app(name, f'http://0.0.0.0:{port}', owner=owner, port=port, path=target)
            mod_obj = self.mod(name)()
            mod_obj.serve(port=port)

        return {
            'name': name,
            'port': port,
            'url': f'http://localhost:{port}/{name}',
            'owner': owner,
            'path': target,
            'app_dir': app_dir,
            'msg': 'App module created and serving',
        }

    def kill_app(self, name, key=None):
        """Kill a module app server. Owner only."""
        ns = self.mod('server.namespace')()
        address = self.key_address(key) if key else self.owner()
        if not ns.is_app_owner(name, address):
            return {'error': f'Not owner of {name}'}
        pm2 = self.mod('pm.pm2')()
        pm2.kill(name)
        ns.dereg_app(name)
        return {'status': 'killed', 'name': name}

    def edit_app(self, name, query='', key=None, **kwargs):
        """Edit a module app. Owner only."""
        ns = self.mod('server.namespace')()
        address = self.key_address(key) if key else self.owner()
        if not ns.is_app_owner(name, address):
            return {'error': f'Not owner of {name}'}
        return self.edit(name, query, **kwargs)

    # ── Aliases ──────────────────────────────────────────────────────────
    create = add = fork = new
