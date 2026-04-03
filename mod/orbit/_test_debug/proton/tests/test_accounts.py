import pytest
import time


class TestAddAccount:
    def test_add_basic(self, proton):
        result = proton.add(email='alice@proton.me', password='pass123')
        assert result['status'] == 'added'
        assert result['email'] == 'alice@proton.me'
        assert result['label'] == 'alice'
        assert 'id' in result

    def test_add_with_label(self, proton):
        result = proton.add(email='bob@proton.me', password='pass', label='work')
        assert result['label'] == 'work'

    def test_add_with_all_fields(self, proton):
        result = proton.add(
            email='carol@proton.me',
            password='secret',
            recovery='backup@gmail.com',
            label='personal',
            notes='main account',
            tags=['personal', 'primary'],
        )
        assert result['status'] == 'added'
        creds = proton.get(email='carol@proton.me')
        assert creds['recovery'] == 'backup@gmail.com'
        assert creds['notes'] == 'main account'
        assert 'personal' in creds['tags']

    def test_add_missing_email(self, proton):
        result = proton.add(password='pass')
        assert 'error' in result

    def test_add_missing_password(self, proton):
        result = proton.add(email='x@proton.me')
        assert 'error' in result

    def test_add_multiple(self, proton):
        proton.add(email='a@proton.me', password='p1')
        proton.add(email='b@proton.me', password='p2')
        proton.add(email='c@proton.me', password='p3')
        accounts = proton.list()
        assert len(accounts) == 3


class TestListAccounts:
    def test_list_empty(self, proton):
        result = proton.list()
        assert result == []

    def test_list_masks_passwords(self, proton):
        proton.add(email='user@proton.me', password='secretpass')
        accounts = proton.list()
        assert len(accounts) == 1
        assert accounts[0]['password'] != 'secretpass'
        assert '*' in accounts[0]['password']

    def test_list_show_pass(self, proton):
        proton.add(email='user@proton.me', password='secretpass')
        accounts = proton.list(show_pass=True)
        assert accounts[0]['password'] == 'secretpass'

    def test_list_fields(self, proton):
        proton.add(email='user@proton.me', password='pass', label='test', notes='note')
        acct = proton.list()[0]
        assert acct['email'] == 'user@proton.me'
        assert acct['label'] == 'test'
        assert acct['notes'] == 'note'
        assert 'id' in acct
        assert 'created' in acct


class TestGetAccount:
    def test_get_by_email(self, proton):
        proton.add(email='user@proton.me', password='secret')
        result = proton.get(email='user@proton.me')
        assert result['email'] == 'user@proton.me'
        assert result['password'] == 'secret'

    def test_get_by_id(self, proton):
        added = proton.add(email='user@proton.me', password='secret')
        result = proton.get(id=added['id'])
        assert result['email'] == 'user@proton.me'

    def test_get_not_found(self, proton):
        result = proton.get(email='nope@proton.me')
        assert 'error' in result


class TestRemoveAccount:
    def test_remove_by_email(self, proton):
        proton.add(email='user@proton.me', password='pass')
        result = proton.remove(email='user@proton.me')
        assert result['status'] == 'removed'
        assert proton.list() == []

    def test_remove_by_id(self, proton):
        added = proton.add(email='user@proton.me', password='pass')
        result = proton.remove(id=added['id'])
        assert result['status'] == 'removed'

    def test_remove_not_found(self, proton):
        result = proton.remove(email='nope@proton.me')
        assert 'error' in result

    def test_remove_only_target(self, proton):
        proton.add(email='keep@proton.me', password='p1')
        proton.add(email='drop@proton.me', password='p2')
        proton.remove(email='drop@proton.me')
        accounts = proton.list()
        assert len(accounts) == 1
        assert accounts[0]['email'] == 'keep@proton.me'


class TestUpdateAccount:
    def test_update_password(self, proton):
        proton.add(email='user@proton.me', password='old')
        result = proton.update(email='user@proton.me', password='new')
        assert result['status'] == 'updated'
        assert 'password' in result['fields']
        creds = proton.get(email='user@proton.me')
        assert creds['password'] == 'new'

    def test_update_multiple_fields(self, proton):
        proton.add(email='user@proton.me', password='pass')
        result = proton.update(
            email='user@proton.me',
            label='updated',
            notes='new notes',
            recovery='new@gmail.com',
        )
        assert set(result['fields']) == {'label', 'notes', 'recovery'}

    def test_update_not_found(self, proton):
        result = proton.update(email='nope@proton.me', password='x')
        assert 'error' in result


class TestForward:
    def test_forward_list(self, proton):
        result = proton.forward(action='list')
        assert isinstance(result, list)

    def test_forward_aliases(self, proton):
        assert isinstance(proton.forward(action='ls'), list)

    def test_forward_unknown(self, proton):
        result = proton.forward(action='unknown')
        assert 'Unknown action' in result

    def test_forward_add(self, proton):
        result = proton.forward(action='add', email='x@proton.me', password='p')
        assert result['status'] == 'added'
