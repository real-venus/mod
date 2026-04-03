"""Off-chain registry backend using local JSON storage."""

import json
import os
import time
from ..base import RegistryBackend


class OffchainRegistry(RegistryBackend):
    """Local file-based registry. Zero external dependencies."""

    name = 'offchain'

    def __init__(self, storage_path: str = None, **kw):
        self.storage_dir = storage_path or os.path.expanduser('~/.mod/registry')
        os.makedirs(self.storage_dir, exist_ok=True)
        self.index_path = os.path.join(self.storage_dir, 'index.json')
        self._load_index()

    def _load_index(self):
        if os.path.exists(self.index_path):
            with open(self.index_path, 'r') as f:
                self._index = json.load(f)
        else:
            self._index = {'next_id': 1, 'mods': {}, 'user_mods': {}, 'name_map': {}}
            self._save_index()

    def _save_index(self):
        with open(self.index_path, 'w') as f:
            json.dump(self._index, f, indent=2)

    def register(self, name: str, data: str, owner: str = None, **kw) -> str:
        if not name:
            raise ValueError('Name is required')
        if not data:
            raise ValueError('Data is required')
        owner = owner or 'local'

        # Check name uniqueness per owner
        owner_names = self._index['name_map'].get(owner, {})
        if owner_names.get(name):
            raise ValueError(f'Name "{name}" already exists for owner {owner}')

        mod_id = str(self._index['next_id'])
        self._index['next_id'] += 1

        self._index['mods'][mod_id] = {
            'id': mod_id,
            'owner': owner,
            'name': name,
            'data': data,
            'created_at': time.time(),
            'updated_at': time.time(),
        }

        # Track user mods
        if owner not in self._index['user_mods']:
            self._index['user_mods'][owner] = []
        self._index['user_mods'][owner].append(mod_id)

        # Track name
        if owner not in self._index['name_map']:
            self._index['name_map'][owner] = {}
        self._index['name_map'][owner][name] = True

        self._save_index()
        return mod_id

    def update(self, mod_id: str, data: str, owner: str = None, **kw) -> bool:
        mod_id = str(mod_id)
        mod = self._index['mods'].get(mod_id)
        if not mod:
            raise ValueError(f'Mod {mod_id} does not exist')
        if owner and mod['owner'] != owner:
            raise PermissionError('Not mod owner')
        if not data:
            raise ValueError('Data is required')

        mod['data'] = data
        mod['updated_at'] = time.time()
        self._save_index()
        return True

    def remove(self, mod_id: str, owner: str = None, **kw) -> bool:
        mod_id = str(mod_id)
        mod = self._index['mods'].get(mod_id)
        if not mod:
            raise ValueError(f'Mod {mod_id} does not exist')
        if owner and mod['owner'] != owner:
            raise PermissionError('Not mod owner')

        mod_owner = mod['owner']
        mod_name = mod['name']

        # Remove from user_mods
        if mod_owner in self._index['user_mods']:
            self._index['user_mods'][mod_owner] = [
                m for m in self._index['user_mods'][mod_owner] if m != mod_id
            ]

        # Free name
        if mod_owner in self._index['name_map']:
            self._index['name_map'][mod_owner].pop(mod_name, None)

        # Delete mod
        del self._index['mods'][mod_id]
        self._save_index()
        return True

    def get(self, mod_id: str, **kw) -> dict:
        mod_id = str(mod_id)
        return self._index['mods'].get(mod_id)

    def get_user_mods(self, owner: str, **kw) -> list:
        mod_ids = self._index['user_mods'].get(owner, [])
        return [self._index['mods'][mid] for mid in mod_ids if mid in self._index['mods']]

    def is_name_taken(self, owner: str, name: str, **kw) -> bool:
        return bool(self._index['name_map'].get(owner, {}).get(name))

    def transfer(self, mod_id: str, new_owner: str, owner: str = None, **kw) -> bool:
        mod_id = str(mod_id)
        mod = self._index['mods'].get(mod_id)
        if not mod:
            raise ValueError(f'Mod {mod_id} does not exist')
        if owner and mod['owner'] != owner:
            raise PermissionError('Not mod owner')
        if not new_owner:
            raise ValueError('New owner is required')

        old_owner = mod['owner']
        mod_name = mod['name']

        # Check name uniqueness for new owner
        if self.is_name_taken(new_owner, mod_name):
            raise ValueError(f'Name "{mod_name}" already exists for new owner')

        # Remove from old owner
        if old_owner in self._index['user_mods']:
            self._index['user_mods'][old_owner] = [
                m for m in self._index['user_mods'][old_owner] if m != mod_id
            ]
        if old_owner in self._index['name_map']:
            self._index['name_map'][old_owner].pop(mod_name, None)

        # Add to new owner
        if new_owner not in self._index['user_mods']:
            self._index['user_mods'][new_owner] = []
        self._index['user_mods'][new_owner].append(mod_id)

        if new_owner not in self._index['name_map']:
            self._index['name_map'][new_owner] = {}
        self._index['name_map'][new_owner][mod_name] = True

        mod['owner'] = new_owner
        mod['updated_at'] = time.time()
        self._save_index()
        return True

    def list_all(self, **kw) -> list:
        return list(self._index['mods'].values())
