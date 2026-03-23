import io
import json
import os
import pytest
from unittest.mock import MagicMock, patch, mock_open


# Mock external deps before importing the module under test
import sys
import types

_mod_mock = types.ModuleType('mod')
sys.modules['mod'] = _mod_mock

_lhw3_mock = types.ModuleType('lighthouseweb3')
_lhw3_mock.Lighthouse = MagicMock()
sys.modules['lighthouseweb3'] = _lhw3_mock

from lighthouse.mod import LighthouseClient


# ── Fixtures ─────────────────────────────────────────────────────────


@pytest.fixture
def client():
    """Create a LighthouseClient with mocked SDK."""
    with patch.dict(os.environ, {'LIGHTHOUSE_TOKEN': 'test-token'}):
        c = LighthouseClient()
    c._lh = MagicMock()
    return c


# ── _resolve_cid ─────────────────────────────────────────────────────


class TestResolveCid:
    def test_strips_prefix(self, client):
        assert client._resolve_cid('lighthouse/QmABC123') == 'QmABC123'

    def test_no_prefix_passthrough(self, client):
        assert client._resolve_cid('QmABC123') == 'QmABC123'

    def test_other_prefix_passthrough(self, client):
        assert client._resolve_cid('ipfs/QmABC123') == 'ipfs/QmABC123'

    def test_empty_string(self, client):
        assert client._resolve_cid('') == ''


# ── _extract_cid ─────────────────────────────────────────────────────


class TestExtractCid:
    def test_dict_with_hash(self, client):
        assert client._extract_cid({'Hash': 'QmABC'}) == 'QmABC'

    def test_dict_with_cid(self, client):
        assert client._extract_cid({'cid': 'QmDEF'}) == 'QmDEF'

    def test_dict_with_nested_data(self, client):
        assert client._extract_cid({'data': {'Hash': 'QmNested'}}) == 'QmNested'

    def test_list_result(self, client):
        assert client._extract_cid([{'Hash': 'QmList'}]) == 'QmList'

    def test_tuple_result(self, client):
        assert client._extract_cid(({'Hash': 'QmTuple'},)) == 'QmTuple'

    def test_object_with_hash_attr(self, client):
        obj = MagicMock(spec=[])
        obj.Hash = 'QmAttr'
        assert client._extract_cid(obj) == 'QmAttr'

    def test_object_with_data_attr(self, client):
        inner = MagicMock(spec=[])
        inner.Hash = 'QmInner'
        obj = MagicMock(spec=[])
        obj.data = inner
        assert client._extract_cid(obj) == 'QmInner'

    def test_fallback_to_str(self, client):
        assert client._extract_cid(12345) == '12345'

    def test_empty_list(self, client):
        # Empty list falls through to str()
        result = client._extract_cid([])
        assert result == '[]'


# ── Upload methods ───────────────────────────────────────────────────


class TestUpload:
    def test_upload_file(self, client):
        client._lh.upload.return_value = {'Hash': 'QmFile'}
        cid = client.upload('/path/to/file.txt')
        assert cid == 'QmFile'
        client._lh.upload.assert_called_once_with('/path/to/file.txt', tag='')

    def test_upload_with_tag(self, client):
        client._lh.upload.return_value = {'Hash': 'QmTagged'}
        cid = client.upload('/path/to/file.txt', tag='my-tag')
        assert cid == 'QmTagged'
        client._lh.upload.assert_called_once_with('/path/to/file.txt', tag='my-tag')

    def test_upload_blob(self, client):
        client._lh.uploadBlob.return_value = {'Hash': 'QmBlob'}
        cid = client.upload_blob(b'hello bytes')
        assert cid == 'QmBlob'
        call_args = client._lh.uploadBlob.call_args
        buf = call_args[0][0]
        assert isinstance(buf, io.BytesIO)
        assert buf.getvalue() == b'hello bytes'
        assert call_args[0][1] == 'data.bin'

    def test_upload_blob_custom_filename(self, client):
        client._lh.uploadBlob.return_value = {'Hash': 'QmCustom'}
        cid = client.upload_blob(b'data', filename='custom.dat', tag='t')
        assert cid == 'QmCustom'
        call_args = client._lh.uploadBlob.call_args
        assert call_args[0][1] == 'custom.dat'
        assert call_args[1]['tag'] == 't'

    def test_put_json(self, client):
        client._lh.uploadBlob.return_value = {'Hash': 'QmJSON'}
        data = {'key': 'value', 'num': 42}
        cid = client.put(data)
        assert cid == 'QmJSON'
        call_args = client._lh.uploadBlob.call_args
        buf = call_args[0][0]
        assert json.loads(buf.getvalue()) == data
        assert call_args[0][1] == 'data.json'

    def test_add_is_put(self, client):
        assert client.add == client.put

    def test_put_text(self, client):
        client._lh.uploadBlob.return_value = {'Hash': 'QmText'}
        cid = client.put_text('hello world')
        assert cid == 'QmText'
        call_args = client._lh.uploadBlob.call_args
        buf = call_args[0][0]
        assert buf.getvalue() == b'hello world'
        assert call_args[0][1] == 'data.txt'

    def test_put_text_custom_filename(self, client):
        client._lh.uploadBlob.return_value = {'Hash': 'QmTxt'}
        client.put_text('content', filename='readme.md')
        call_args = client._lh.uploadBlob.call_args
        assert call_args[0][1] == 'readme.md'


# ── Download methods ─────────────────────────────────────────────────


class TestDownload:
    def test_cat_bytes(self, client):
        client._lh.download.return_value = b'raw bytes'
        result = client.cat('QmABC')
        assert result == b'raw bytes'

    def test_cat_tuple_bytes(self, client):
        client._lh.download.return_value = (b'tuple bytes', 'extra')
        result = client.cat('QmABC')
        assert result == b'tuple bytes'

    def test_cat_tuple_string(self, client):
        client._lh.download.return_value = ('string data', 'extra')
        result = client.cat('QmABC')
        assert result == b'string data'

    def test_cat_string_fallback(self, client):
        client._lh.download.return_value = 'plain string'
        result = client.cat('QmABC')
        assert result == b'plain string'

    def test_cat_strips_prefix(self, client):
        client._lh.download.return_value = b'data'
        client.cat('lighthouse/QmABC')
        client._lh.download.assert_called_once_with('QmABC')

    def test_get_json(self, client):
        data = {'key': 'value'}
        client._lh.download.return_value = json.dumps(data).encode()
        result = client.get('QmABC')
        assert result == data

    def test_download_to_file(self, client, tmp_path):
        output = str(tmp_path / 'out.bin')
        client.download('QmABC', output)
        client._lh.downloadBlob.assert_called_once()
        assert os.path.exists(output)

    def test_download_creates_dirs(self, client, tmp_path):
        output = str(tmp_path / 'nested' / 'dir' / 'out.bin')
        client.download('QmABC', output)
        assert os.path.isdir(os.path.dirname(output))

    def test_get_url(self, client):
        url = client.get_url('QmABC')
        assert url == 'https://gateway.lighthouse.storage/ipfs/QmABC'

    def test_get_url_strips_prefix(self, client):
        url = client.get_url('lighthouse/QmABC')
        assert url == 'https://gateway.lighthouse.storage/ipfs/QmABC'


# ── Info & Status ────────────────────────────────────────────────────


class TestInfoStatus:
    def test_info(self, client):
        client._lh.getFileInfo.return_value = {'name': 'test.txt', 'size': 100}
        result = client.info('QmABC')
        assert result == {'name': 'test.txt', 'size': 100}
        client._lh.getFileInfo.assert_called_once_with('QmABC')

    def test_deal_status(self, client):
        client._lh.getDealStatus.return_value = {'status': 'active'}
        result = client.deal_status('QmABC')
        assert result == {'status': 'active'}

    def test_uploads(self, client):
        client._lh.getUploads.return_value = [{'cid': 'Qm1'}, {'cid': 'Qm2'}]
        result = client.uploads()
        assert len(result) == 2
        client._lh.getUploads.assert_called_once_with(lastKey=None)

    def test_uploads_pagination(self, client):
        client._lh.getUploads.return_value = []
        client.uploads(last_key='abc123')
        client._lh.getUploads.assert_called_once_with(lastKey='abc123')

    def test_balance(self, client):
        client._lh.getBalance.return_value = {'used': 1000, 'limit': 5000}
        result = client.balance()
        assert result == {'used': 1000, 'limit': 5000}


# ── Tags ─────────────────────────────────────────────────────────────


class TestTags:
    def test_tagged(self, client):
        client._lh.getTagged.return_value = [{'cid': 'Qm1', 'tag': 'v1'}]
        result = client.tagged('v1')
        assert len(result) == 1
        client._lh.getTagged.assert_called_once_with('v1')


# ── IPNS ─────────────────────────────────────────────────────────────


class TestIPNS:
    def test_keygen(self, client):
        client._lh.generateKey.return_value = {'keyName': 'test-key'}
        result = client.ipns_keygen()
        assert result == {'keyName': 'test-key'}

    def test_publish(self, client):
        client._lh.publishRecord.return_value = {'Name': 'k2...'}
        result = client.ipns_publish('QmABC', 'my-key')
        assert result == {'Name': 'k2...'}
        client._lh.publishRecord.assert_called_once_with('QmABC', 'my-key')

    def test_publish_strips_prefix(self, client):
        client._lh.publishRecord.return_value = {}
        client.ipns_publish('lighthouse/QmABC', 'my-key')
        client._lh.publishRecord.assert_called_once_with('QmABC', 'my-key')

    def test_keys(self, client):
        client._lh.getAllKeys.return_value = [{'keyName': 'k1'}, {'keyName': 'k2'}]
        result = client.ipns_keys()
        assert len(result) == 2

    def test_remove(self, client):
        client._lh.removeKey.return_value = {'removed': True}
        result = client.ipns_remove('old-key')
        assert result == {'removed': True}
        client._lh.removeKey.assert_called_once_with('old-key')


# ── Wallet (static methods) ─────────────────────────────────────────


class TestWallet:
    def test_create_wallet(self):
        _lhw3_mock.Lighthouse.createWallet.return_value = {'address': '0x123'}
        result = LighthouseClient.create_wallet('password123')
        _lhw3_mock.Lighthouse.createWallet.assert_called_once_with('password123')
        assert result == {'address': '0x123'}
        _lhw3_mock.Lighthouse.reset_mock()

    def test_get_api_key(self):
        _lhw3_mock.Lighthouse.getApiKey.return_value = {'apiKey': 'abc'}
        result = LighthouseClient.get_api_key('0xpub', 'sig123')
        _lhw3_mock.Lighthouse.getApiKey.assert_called_once_with('0xpub', 'sig123')
        assert result == {'apiKey': 'abc'}
        _lhw3_mock.Lighthouse.reset_mock()


# ── Constructor & misc ───────────────────────────────────────────────


class TestInit:
    def test_token_from_param(self):
        c = LighthouseClient(token='explicit-token')
        assert c.token == 'explicit-token'

    def test_token_from_env(self):
        with patch.dict(os.environ, {'LIGHTHOUSE_TOKEN': 'env-token'}):
            c = LighthouseClient()
        assert c.token == 'env-token'

    def test_token_default_empty(self):
        with patch.dict(os.environ, {}, clear=True):
            os.environ.pop('LIGHTHOUSE_TOKEN', None)
            c = LighthouseClient()
        assert c.token == ''

    def test_str(self, client):
        assert 'gateway.lighthouse.storage' in str(client)

    def test_repr(self, client):
        assert repr(client) == str(client)

    def test_lazy_sdk_init(self):
        c = LighthouseClient(token='test')
        assert c._lh is None

    def test_lh_property_initializes(self):
        _lhw3_mock.Lighthouse.reset_mock()
        _lhw3_mock.Lighthouse.return_value = MagicMock()
        c = LighthouseClient(token='test')
        _ = c.lh
        _lhw3_mock.Lighthouse.assert_called_once_with(token='test')
        assert c._lh is not None
        _lhw3_mock.Lighthouse.reset_mock()

    def test_class_attributes(self):
        assert LighthouseClient.prefix == 'lighthouse'
        assert 'upload' in LighthouseClient.endpoints
        assert 'put' in LighthouseClient.endpoints
        assert 'get' in LighthouseClient.endpoints
