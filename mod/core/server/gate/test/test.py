import mod as m 



class Test(m.mod('gate')):
    def test_user_role(self) -> bool:
        user = m.key('test').ss58_address
        user2role = self.user2role()
        role = user2role.get(user, None)
        self.rm_user_role(user)
        user2role = self.user2role()
        assert user not in user2role, f'Failed to remove user role for {user}'
        self.set_user_role(role or 'tester', user)
        user2role = self.user2role()
        assert user2role.get(user, None) == (role or 'tester'), f'Failed to set user role for {user}'
        return True
    


    def test_permissions(self):
        """
        test the permissions system
        """
        self.reset_roles()
        self.ensure_role_map()
        self.add_permission('admin', 'read')
        self.add_permission('admin', 'write')
        self.add_role('user', {'fns': ['read']})
        user2role = self.user2role()
        user2role['alice'] = 'admin'
        user2role['bob'] = 'user'
        self.store.put(self.user2role_path, user2role)
        return {'role2data': self.role2data(), 'user2role': self.user2role()}


    def test_delegations(self):
        """
        test the delegations system
        """
        self.update_delegations({})
        self.set_delegations('alice', ['bob'])
        self.set_delegations('charlie', ['dave'])
        delegations = self.delegations()
        assert delegations.get('alice', None) == ['bob'], 'Failed to set delegation for alice'
        assert delegations.get('charlie', None) == ['dave'], 'Failed to set delegation for charlie'
        self.rm_delegation('alice')
        delegations = self.delegations()
        assert 'alice' not in delegations, 'Failed to remove delegation for alice'
        return delegations

    def test_roles(self):
        """
        test the roles system
        """
        self.reset_roles()
        self.ensure_role_map()
        self.add_role('test', {'fns': ['*']})
        self.rm_role('test')
        assert 'test' not in self.role2data()
        return self.role2data()
