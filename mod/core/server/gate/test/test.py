import mod as m

class Test(m.mod('gate')):

    
    def test_user_role(self, role = 'test') -> bool:
        user = m.key('test').ss58_address
        self.add_user(user, role)
        assert self.is_user(user, role), f"User {user} is not in role"
        self.rm_user(user, role)
        assert not self.is_user(user, role), f"User {user} is still in"
        return True


    def test_roles(self):
        """
        test the roles system
        """
        key = m.key('test')
        self.add_role('test', fns=['test'], users=[key.address])
        self.rm_role('test')
        assert 'test' not in self.roles()
        return self.role2data()
