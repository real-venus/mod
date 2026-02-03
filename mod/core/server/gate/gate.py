from typing import *
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
import os
import hashlib
import os
import pandas as pd
import json
import inspect
import asyncio
import time
import mod as m

print = m.print

class Gate:

    def __init__(self, path = '~/.mod/server', auth='auth.v0',mod='api', **_kwargs):
        """
        Initialize the Gate class
        params:
            path: the path to store the gate data
            auth: the auth module to use
        """
        self.store = m.mod('store')(path)
        self.auth = m.mod(auth)()
        self.roles_path = self.store.get_path('roles')
        if len(self.roles()) < 2:
            self.ensure_role_map()
        self.set_mod(mod=mod)
    

    def forward(self, fn:str, request, mod:Any=None) -> dict:
        """
        process the request
        """
        mod = mod or self.mod
        assert not isinstance(fn, str) or fn != '', "Function name cannot be empty"
        print(f'Gate forwarding request to function: {fn}', color='green')
        info = mod.info()
        headers = dict(request.headers)
        headers = self.auth.verify(headers)
        role = self.get_role(headers['key'])

        assert role, f"Role for key {headers['key']} not found"
        if  bool(role == 'owner'):
            print(f'ATTENTION: owner({headers["key"]}) is calling {fn}', color='green')
        else:
            assert fn in info['fns'], f"Function {fn} not in fns={info['fns']}"
        params = asyncio.run(request.json())
        params = json.loads(params) if isinstance(params, str) else params
        self.print_request({'fn': fn, 'params': params, 'client': headers.get('key', ''), 'time': time.strftime('%Y-%m-%d %H:%M:%S', time.localtime())})
        fn_obj = self.get_fn_obj(fn, mod=mod)
        result = fn_obj(**params) if callable(fn_obj) else fn_obj
        if self.is_generator(result):
            def generator_wrapper(generator):
                for item in generator:
                    yield item
            return  EventSourceResponse(generator_wrapper(result))
        else:
            return result


    def get_role(self, user:str) -> str:
        """
        get the role for a user
        """
        role2data = self.role2data()
        for role, data in role2data.items():
            if 'users' in data and user.lower() in data['users']:
                return role
        return None

    def is_generator(self, obj):
        """
        Is this shiz a generator dawg?
        """
        if not callable(obj):
            result = inspect.isgenerator(obj)
        else:
            result =  inspect.isgeneratorfunction(obj)
        return result

    def set_mod(self, mod:Any=None):
        if isinstance(mod, str):
            mod = m.mod(mod)()
        elif mod is None:
            mod = m.mod('mod')()
        elif not hasattr(mod, 'info'):
            mod = m.mod('mod')(mod)
        self.mod = mod 
        return self.mod

    def print_request(self, request: Request):
        """
        print the request nicely
        """
        fn = request.get('fn', '')
        params = request['params'] if 'params' in request else {}
        client = request['client']['key'] if 'client' in request and 'key' in request['client'] else ''
        right_buffer = '>'*64
        left_buffer = '<'*64
        print(right_buffer, color='blue')
        print(f"""Request\t""" , color='blue')
        print(left_buffer)
        print_params = {'fn': fn, 'params': params, 'client': client,'time': time.strftime('%Y-%m-%d %H:%M:%S', time.localtime())}
        # side ways dataframe where each param is a row
        df = pd.DataFrame(print_params.items(), columns=['param', 'value'])
        print(df.to_string(index=False), color='blue')
        print(right_buffer, color='blue')

    def get_fn_obj(self, fn:str, mod:Any) -> Any:
        if not hasattr(self, '_obj_cache'):
            self._obj_cache = {}
        if '/' in fn:
            if fn in self._obj_cache:
                fn_obj = self._obj_cache[fn]
                print(f'Using cached function object for {fn}', color='green')
            else:
                temp_mod = fn.split('/')[0]
                fn = '/'.join(fn.split('/')[1:])
                if hasattr(self.mod, temp_mod):
                    mod_obj = getattr(mod, temp_mod)
                    fn_obj = getattr(mod_obj, fn)
                else: 
                    if m.mod_exists(temp_mod):
                        mod_obj = m.mod(temp_mod)()
                        fn_obj = getattr(mod_obj, fn)
                self._obj_cache[fn] = fn_obj
        else:
            fn_obj = getattr(self.mod, fn) # get the function object from the mod
        return fn_obj

    def add_user_max(self, max_users:int= 100):
        """
        gate if the address is usersed
        """
        self.store.put('user_max' , max_users)
        return self.user_max()

    def user_max(self,default:bool = 100) -> int:
        """
        gate if the address is usersed
        """
        return self.store.get('user_max' , default)

    def add_user(self, user:str, role='public', update:bool = False ):
        """
        gate if the address is usersed
        """
        role_data = self.role_data(role)
        role_data['users'] = list(map(lambda x:x.lower(), set(role_data.get('users', []) + [user])))
        self.save_role_data(role, role_data)
        if self.is_user(user, role): 
            return {'status': 'success', 'message': f'User {user} added to role {role}'}
        return self.role_data(role)

    def owner_key(self) -> str:
        if not hasattr(self, 'owner_address'):
            self.owner_address = m.key().ss58_address
        return self.owner_address


    def user2role(self) -> Dict[str, str]:
        """
        preprocess if the address is usersed
        """
        role2data = self.role2data()
        user2role = {}
        for role, data in role2data.items():
            if 'users' in data:
                for user in data['users']:
                    user2role[user] = role
        return user2role

    def users(self, role:str = None, update:bool = False):
        """
        preprocess if the address is usersed
        """
        role_data = self.role_data(role)
        return role_data.get('users', [])

    def users_path(self, role:str) -> str:
        """
        preprocess if the address is usersed
        """
        return f'users/{role}'

    def resolve_role(self, role='public'): 
        return role or 'public'

    def reset_roles(self):
        """
        reset the roles
        """
        self.store.rm(self.roles_path)
        return self.ensure_role_map()

    def rm_user(self, user:str, role = None, update:bool = False):
        """
        preprocess if the address is usersed
        """
        role_data = self.role_data(role)
        users = role_data.get('users', [])
        if user in users:
            users.remove(user)
        role_data['users'] = users
        self.save_role_data(role, role_data)
        assert not self.is_user(user, role), f"Failed to remove user {user} from role {role}"
        return self.role_data(role)

    def is_user(self,  user:str, role = None) -> bool:
        """
        preprocess if the address is usersed
        """
        role = self.resolve_role(role)
        return user in self.users(role)

    role2data_path = 'role2data'

    def role_data(self, role:str = None) -> Dict[str, Any]:
        """
        get the role to data mapping
        """
        role = self.resolve_role(role)
        role_data  =  self.store.get(self.role_data_path(role), {})
        role_data['users'] = list(map(lambda x:x.lower(), role_data.get('users', [])))
        return role_data
    
    def roles(self) -> List[str]:
        """
        get the roles
        """
        if not os.path.exists(self.roles_path):
            os.makedirs(self.roles_path)
        return list(map(lambda x: x.split('.json')[0], os.listdir(self.roles_path)))

    def save_role_data(self, role:str, data:dict):
        """
        save the role data
        """
        role = self.resolve_role(role)
        self.store.put(self.role_data_path(role), data)
        return data

    def role_data_path(self, role:str) -> str:
        """
        get the role data path
        """
        role = self.resolve_role(role)
        return self.roles_path + '/' + role

    def add_role(self, role:str = 'owner',  users:List[str] = None, fns:dict = []):
        """
        add a role
        """
        role_data = self.role_data()
        role_data['users'] = users or []
        if isinstance(fns, str):
            fns = [fns]
        if  role == 'owner':
            fns = ['*']
            role_data['users'].append(self.owner_key())
        else:
            assert '*' not in fns, "Only owner role can have '*' permission"
        role_data['fns'] = fns
        return self.save_role_data(role, role_data)

    def rm_role(self, role:str):
        return self.store.rm(self.role_data_path(role))
        
    def role2data(self) -> Dict[str, Any]:
        roles = self.roles()
        role2data = {}
        for role in roles:
            role2data[role] = self.role_data(role)
        return role2data

    def add_permission(self, role:str, fn:str):
        """
        add a permission to a role
        """
        role2data = self.role2data()
        if role not in role2data:
            role2data[role] = {'fns': []}
        if 'fns' not in role2data[role]:
            role2data[role]['fns'] = []
        if fn not in role2data[role]['fns']:
            role2data[role]['fns'].append(fn)
        self.store.put(self.role2data_path, role2data)
        return role2data

    def delegations(self):
        """
        get the delegations
        """
        return self.store.get('delegations', {})

    def update_delegations(self, delegations:dict):
        """
        update the delegations
        """
        self.store.put('delegations', delegations)
        return delegations

    def set_delegations(self, delegator:str, delegatees:List[str]):
        """
        set a delegation
        """
        delegations = self.delegations()
        delegations[delegator] = delegatees
        self.store.put('delegations', delegations)
        return delegations

    def rm_delegation(self, delegator:str):
        """
        remove a delegation
        """
        delegations = self.delegations()
        if delegator in delegations:
            del delegations[delegator]
        self.store.put('delegations', delegations)
        return delegations
 

    ensure_roles = ['owner', 'public']
    def ensure_role_map(self):
        """
        ensure that the owner role exists
        """
        role2data = self.role2data()
        for role in self.ensure_roles:
            if role not in role2data:
                self.add_role(role=role)