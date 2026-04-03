import pytest
import time
from unittest.mock import patch


class TestShare:
    def test_share_generates_token(self, proton):
        proton.add(email='user@proton.me', password='secret')
        result = proton.share(email='user@proton.me')
        assert result['status'] == 'shared'
        assert 'token' in result
        assert len(result['token']) > 20
        assert result['email'] == 'user@proton.me'

    def test_share_not_found(self, proton):
        result = proton.share(email='nope@proton.me')
        assert 'error' in result

    def test_share_custom_expiry(self, proton):
        proton.add(email='user@proton.me', password='pass')
        result = proton.share(email='user@proton.me', expires=60)
        assert result['expires_in'] == '60s'


class TestImportShare:
    def test_import_valid_token(self, proton):
        proton.add(email='user@proton.me', password='secret')
        shared = proton.share(email='user@proton.me')
        # Remove the original so we can see the import
        proton.remove(email='user@proton.me')
        assert proton.list() == []

        result = proton.import_share(token=shared['token'])
        assert result['status'] == 'imported'
        assert result['email'] == 'user@proton.me'
        accounts = proton.list(show_pass=True)
        assert len(accounts) == 1
        assert accounts[0]['password'] == 'secret'

    def test_import_invalid_token(self, proton):
        result = proton.import_share(token='bogus-token')
        assert 'error' in result

    def test_import_no_token(self, proton):
        result = proton.import_share()
        assert 'error' in result

    def test_import_expired_token(self, proton):
        proton.add(email='user@proton.me', password='pass')
        shared = proton.share(email='user@proton.me', expires=1)

        # Fast-forward time past expiry
        with patch('proton.mod.time') as mock_time:
            mock_time.time.return_value = time.time() + 10
            result = proton.import_share(token=shared['token'])
        assert 'error' in result
        assert 'expired' in result['error'].lower()

    def test_token_consumed_after_use(self, proton):
        proton.add(email='user@proton.me', password='pass')
        shared = proton.share(email='user@proton.me')
        proton.import_share(token=shared['token'])
        # Second use should fail
        result = proton.import_share(token=shared['token'])
        assert 'error' in result


class TestExport:
    def test_export_to_file(self, proton, tmp_path):
        proton.add(email='a@proton.me', password='p1')
        proton.add(email='b@proton.me', password='p2')
        out = str(tmp_path / 'export.json')
        result = proton.export(path=out)
        assert result['status'] == 'exported'
        assert result['count'] == 2

        import json
        with open(out) as f:
            data = json.load(f)
        assert len(data['accounts']) == 2

    def test_export_empty(self, proton, tmp_path):
        out = str(tmp_path / 'export.json')
        result = proton.export(path=out)
        assert result['count'] == 0


class TestInfo:
    def test_info_empty(self, proton):
        result = proton.info()
        assert result['total_accounts'] == 0
        assert result['active_shares'] == 0

    def test_info_with_accounts(self, proton):
        proton.add(email='a@proton.me', password='p1')
        proton.add(email='b@protonmail.com', password='p2')
        result = proton.info()
        assert result['total_accounts'] == 2
        assert 'proton.me' in result['domains']
        assert 'protonmail.com' in result['domains']

    def test_info_with_shares(self, proton):
        proton.add(email='a@proton.me', password='p1')
        proton.share(email='a@proton.me')
        result = proton.info()
        assert result['active_shares'] == 1
