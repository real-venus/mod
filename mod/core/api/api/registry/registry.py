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

    def key_address(self, key=None):
        """Get the key address for the registry"""
        return key or m.key_address()

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

    def cid(self, name):
        """Get content ID for a module"""
        return m.hash(name)

    def list(self, orbit='outer', key=None):
        """List all modules in the registry"""
        key = self.key_address(key)
        path = m.paths["orbit"][orbit] + '/'+ key
        if os.path.exists(path):
            return os.listdir(path)
        return []

    def get(self, name, orbit='outer', key=None):
        """Get a module from the registry"""
        key = self.key_address(key)
        dirpath = m.paths["orbit"][orbit] + '/'+ key+ '/'+ name.replace('.', '/')
        if os.path.exists(dirpath):
            return m.content(dirpath)
        return None

    def delete(self, name, orbit='outer', key=None):
        """Delete a module from the registry"""
        key = self.key_address(key)
        dirpath = m.paths["orbit"][orbit] + '/'+ key+ '/'+ name.replace('.', '/')
        if os.path.exists(dirpath):
            shutil.rmtree(dirpath)
            return {'name': name, 'msg': 'Mod Deleted', 'path': dirpath}
        return {'name': name, 'msg': 'Mod Not Found', 'path': dirpath}

    def update(self, name, content, orbit='outer', key=None):
        """Update a module in the registry"""
        key = self.key_address(key)
        dirpath = m.paths["orbit"][orbit] + '/'+ key+ '/'+ name.replace('.', '/')
        for k,v in content.items():
            filepath = dirpath + '/' + k
            m.put_text(filepath, v)
        return {'name': name, 'msg': 'Mod Updated', 'path': dirpath}
