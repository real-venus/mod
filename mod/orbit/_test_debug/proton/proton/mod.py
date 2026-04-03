import mod as m
import json
import time
import os
import secrets
import hashlib
from typing import Optional, List, Dict, Any
from pathlib import Path


STORE_KEY = 'proton/accounts'


class Mod:
    description = """
    ProtonMail account manager - create, store, and share
    encrypted ProtonMail login credentials locally.
    """

    def __init__(self):
        self.store_path = Path.home() / '.mod' / 'proton'
        self.store_path.mkdir(parents=True, exist_ok=True)
        self.accounts_file = self.store_path / 'accounts.json'
        self.shares_file = self.store_path / 'shares.json'

    # ── helpers ──────────────────────────────────────────

    def _load_accounts(self, password: str = None) -> dict:
        """Load the encrypted accounts store."""
        try:
            data = m.get(STORE_KEY, password=password)
            if isinstance(data, dict) and 'accounts' in data:
                return data
        except Exception:
            pass
        return {'accounts': {}, 'meta': {'created': time.time()}}

    def _save_accounts(self, data: dict, password: str = None):
        """Save the accounts store (optionally encrypted)."""
        data['meta'] = data.get('meta', {})
        data['meta']['updated'] = time.time()
        m.put(STORE_KEY, data, password=password)

    def _load_shares(self) -> dict:
        """Load share tokens."""
        if self.shares_file.exists():
            with open(self.shares_file) as f:
                return json.load(f)
        return {}

    def _save_shares(self, shares: dict):
        with open(self.shares_file, 'w') as f:
            json.dump(shares, f, indent=2)

    def _gen_id(self) -> str:
        return secrets.token_hex(4)

    def _mask(self, password: str) -> str:
        if len(password) <= 4:
            return '****'
        return password[:2] + '*' * (len(password) - 4) + password[-2:]

    # ── core API ─────────────────────────────────────────

    def forward(self, action: str = 'list', **kwargs) -> Any:
        """
        Entry point. Routes to actions:
          list    - list all accounts
          add     - add a new account
          remove  - remove an account
          get     - get credentials for an account
          update  - update an account
          share   - generate a share token
          import  - import from a share token
          export  - export accounts to file
        """
        actions = {
            'list':    self.list,
            'ls':      self.list,
            'add':     self.add,
            'remove':  self.remove,
            'rm':      self.remove,
            'get':     self.get,
            'update':  self.update,
            'share':   self.share,
            'import':  self.import_share,
            'export':  self.export,
            'info':    self.info,
        }
        fn = actions.get(action)
        if fn is None:
            return f"Unknown action '{action}'. Available: {', '.join(actions.keys())}"
        return fn(**kwargs)

    def add(self,
            email: str = None,
            password: str = None,
            recovery: str = None,
            label: str = None,
            notes: str = None,
            master: str = None,
            **kwargs) -> dict:
        """
        Add a ProtonMail account.

        Args:
            email:    ProtonMail email address
            password: Account password
            recovery: Recovery email or phone (optional)
            label:    Friendly label (optional, defaults to email username)
            notes:    Any notes (optional)
            master:   Master password to encrypt the store (optional)
        """
        if not email:
            return {'error': 'email is required'}
        if not password:
            return {'error': 'password is required'}

        data = self._load_accounts(password=master)
        aid = self._gen_id()

        account = {
            'id': aid,
            'email': email,
            'password': password,
            'recovery': recovery,
            'label': label or email.split('@')[0],
            'notes': notes,
            'created': time.time(),
            'updated': time.time(),
            'tags': kwargs.get('tags', []),
        }

        data['accounts'][aid] = account
        self._save_accounts(data, password=master)

        return {
            'status': 'added',
            'id': aid,
            'email': email,
            'label': account['label'],
        }

    def list(self, master: str = None, show_pass: bool = False, **kwargs) -> List[dict]:
        """
        List all stored ProtonMail accounts.

        Args:
            master:    Master password if store is encrypted
            show_pass: Show passwords in output (default False)
        """
        data = self._load_accounts(password=master)
        accounts = []
        for aid, acct in data['accounts'].items():
            entry = {
                'id': acct['id'],
                'label': acct.get('label', ''),
                'email': acct['email'],
                'recovery': acct.get('recovery', ''),
                'notes': acct.get('notes', ''),
                'created': acct.get('created'),
                'tags': acct.get('tags', []),
            }
            if show_pass:
                entry['password'] = acct['password']
            else:
                entry['password'] = self._mask(acct['password'])
            accounts.append(entry)
        return accounts

    def get(self, id: str = None, email: str = None,
            master: str = None, **kwargs) -> dict:
        """
        Get full credentials for an account by id or email.
        """
        data = self._load_accounts(password=master)
        for aid, acct in data['accounts'].items():
            if (id and aid == id) or (email and acct['email'] == email):
                return {
                    'id': acct['id'],
                    'email': acct['email'],
                    'password': acct['password'],
                    'recovery': acct.get('recovery'),
                    'label': acct.get('label'),
                    'notes': acct.get('notes'),
                    'tags': acct.get('tags', []),
                    'created': acct.get('created'),
                    'updated': acct.get('updated'),
                }
        return {'error': f'Account not found (id={id}, email={email})'}

    def remove(self, id: str = None, email: str = None,
               master: str = None, **kwargs) -> dict:
        """Remove an account by id or email."""
        data = self._load_accounts(password=master)
        target = None
        for aid, acct in data['accounts'].items():
            if (id and aid == id) or (email and acct['email'] == email):
                target = aid
                break
        if not target:
            return {'error': 'Account not found'}
        removed = data['accounts'].pop(target)
        self._save_accounts(data, password=master)
        return {'status': 'removed', 'email': removed['email'], 'id': target}

    def update(self, id: str = None, email: str = None,
               master: str = None, **kwargs) -> dict:
        """
        Update an account's fields. Pass any field as kwarg:
          password, recovery, label, notes, tags
        """
        data = self._load_accounts(password=master)
        target = None
        for aid, acct in data['accounts'].items():
            if (id and aid == id) or (email and acct['email'] == email):
                target = aid
                break
        if not target:
            return {'error': 'Account not found'}

        updatable = ['password', 'recovery', 'label', 'notes', 'tags', 'email']
        updated_fields = []
        for field in updatable:
            if field in kwargs and kwargs[field] is not None:
                data['accounts'][target][field] = kwargs[field]
                updated_fields.append(field)

        data['accounts'][target]['updated'] = time.time()
        self._save_accounts(data, password=master)
        return {
            'status': 'updated',
            'id': target,
            'fields': updated_fields,
        }

    # ── sharing ──────────────────────────────────────────

    def share(self, id: str = None, email: str = None,
              master: str = None, expires: int = 3600,
              **kwargs) -> dict:
        """
        Generate a share token for an account.
        The token can be used by others to import the credentials.

        Args:
            id/email: Account to share
            master:   Master password if store is encrypted
            expires:  Token expiry in seconds (default 1 hour)
        """
        data = self._load_accounts(password=master)
        target = None
        for aid, acct in data['accounts'].items():
            if (id and aid == id) or (email and acct['email'] == email):
                target = acct
                break
        if not target:
            return {'error': 'Account not found'}

        token = secrets.token_urlsafe(32)
        shares = self._load_shares()
        shares[token] = {
            'account': {
                'email': target['email'],
                'password': target['password'],
                'recovery': target.get('recovery'),
                'label': target.get('label'),
                'notes': target.get('notes'),
            },
            'created': time.time(),
            'expires': time.time() + expires,
        }
        self._save_shares(shares)

        return {
            'status': 'shared',
            'token': token,
            'email': target['email'],
            'expires_in': f'{expires}s',
        }

    def import_share(self, token: str = None,
                     master: str = None, **kwargs) -> dict:
        """
        Import an account from a share token.

        Args:
            token:  The share token string
            master: Master password for your store
        """
        if not token:
            return {'error': 'token is required'}

        shares = self._load_shares()
        share = shares.get(token)
        if not share:
            return {'error': 'Invalid or expired token'}

        if time.time() > share['expires']:
            shares.pop(token, None)
            self._save_shares(shares)
            return {'error': 'Token has expired'}

        acct = share['account']
        result = self.add(
            email=acct['email'],
            password=acct['password'],
            recovery=acct.get('recovery'),
            label=acct.get('label'),
            notes=acct.get('notes'),
            master=master,
        )

        # consume the token
        shares.pop(token, None)
        self._save_shares(shares)

        result['status'] = 'imported'
        return result

    def export(self, master: str = None, path: str = None, **kwargs) -> dict:
        """
        Export all accounts to a JSON file.

        Args:
            master: Master password if store is encrypted
            path:   Output file path (default: ~/proton_export.json)
        """
        data = self._load_accounts(password=master)
        out = path or str(Path.home() / 'proton_export.json')
        export_data = {
            'exported': time.time(),
            'count': len(data['accounts']),
            'accounts': list(data['accounts'].values()),
        }
        with open(out, 'w') as f:
            json.dump(export_data, f, indent=2)
        return {'status': 'exported', 'path': out, 'count': export_data['count']}

    def info(self, master: str = None, **kwargs) -> dict:
        """Show store info and stats."""
        data = self._load_accounts(password=master)
        shares = self._load_shares()
        active_shares = sum(1 for s in shares.values() if time.time() < s['expires'])
        domains = {}
        for acct in data['accounts'].values():
            domain = acct['email'].split('@')[-1] if '@' in acct['email'] else 'unknown'
            domains[domain] = domains.get(domain, 0) + 1

        return {
            'total_accounts': len(data['accounts']),
            'domains': domains,
            'active_shares': active_shares,
            'store_path': str(self.store_path),
            'encrypted': bool(master),
        }
