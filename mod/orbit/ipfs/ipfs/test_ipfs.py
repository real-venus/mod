"""Tests for IpfsClient — requires a running IPFS daemon on localhost:5001."""
import os
import json
import tempfile
from ipfs import IpfsClient

def test_connect():
    c = IpfsClient(autostart=False)
    assert c.url == 'http://127.0.0.1:5001/api/v0'
    assert c.connected is True

def test_id():
    c = IpfsClient(autostart=False)
    info = c.id()
    assert 'ID' in info
    assert 'AgentVersion' in info

def test_version():
    c = IpfsClient(autostart=False)
    v = c.version()
    assert 'Version' in v

def test_put_get():
    c = IpfsClient(autostart=False)
    data = {'test_key': 'test_value', 'num': 42}
    cid = c.put(data)
    assert isinstance(cid, str)
    assert cid.startswith('Qm')
    result = c.get(cid)
    assert result == data

def test_put_no_pin():
    c = IpfsClient(autostart=False)
    cid = c.cid({'ephemeral': True})
    assert isinstance(cid, str)
    assert cid.startswith('Qm')

def test_get_with_prefix():
    c = IpfsClient(autostart=False)
    cid = c.put({'prefixed': True})
    result = c.get(f'ipfs/{cid}')
    assert result == {'prefixed': True}

def test_add_file():
    c = IpfsClient(autostart=False)
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
        f.write('test file content')
        tmp = f.name
    try:
        result = c.add_file(tmp)
        assert 'Hash' in result
        assert 'Name' in result
        assert result['Name'] == os.path.basename(tmp)
    finally:
        os.unlink(tmp)

def test_add_file_not_found():
    c = IpfsClient(autostart=False)
    try:
        c.add_file('/nonexistent/file.txt')
        assert False, 'Should have raised FileNotFoundError'
    except FileNotFoundError:
        pass

def test_cat():
    c = IpfsClient(autostart=False)
    data = {'cat_test': True}
    cid = c.put(data)
    raw = c.cat(cid)
    assert json.loads(raw) == data

def test_get_file():
    c = IpfsClient(autostart=False)
    data = {'getfile': 'yes'}
    cid = c.put(data)
    raw = c.get_file(cid)
    assert json.loads(raw) == data

def test_pinned():
    c = IpfsClient(autostart=False)
    cid = c.put({'pintest': True})
    assert c.pinned(cid) is True

def test_pins():
    c = IpfsClient(autostart=False)
    pins = c.pins()
    assert 'Keys' in pins
    assert isinstance(pins['Keys'], dict)

def test_pins_filter():
    c = IpfsClient(autostart=False)
    cid = c.put({'filter_test': True})
    result = c.pins(cid=cid)
    assert cid in result

def test_pin_rm():
    c = IpfsClient(autostart=False)
    cid = c.put({'to_remove': True})
    assert c.pinned(cid) is True
    c.pin_rm(cid)
    assert c.pinned(cid) is False

def test_rm():
    c = IpfsClient(autostart=False)
    cid = c.put({'to_rm': True})
    result = c.rm(cid)
    assert result == {'Status': 'Removed'}

def test_iscid():
    c = IpfsClient(autostart=False)
    assert c.iscid('QmRjVUAuS7V2c8bKbXKN9eXzp2dMXW8jwYLCAFo9nHBSeb') is True
    assert c.iscid('notacid') is False
    assert c.iscid('') is False
    assert c.iscid(123) is False

def test_str():
    c = IpfsClient(autostart=False)
    s = str(c)
    assert 'IpfsClient' in s
    assert '5001' in s

def test_node_status():
    c = IpfsClient(autostart=False)
    status = c.node_status()
    assert status in ('online', 'offline')

def test_roundtrip():
    """Full integration test: add, get, pin, unpin."""
    c = IpfsClient(autostart=False)
    c.test()

if __name__ == '__main__':
    tests = [v for k, v in sorted(globals().items()) if k.startswith('test_')]
    for t in tests:
        try:
            t()
            print(f'  PASS  {t.__name__}')
        except Exception as e:
            print(f'  FAIL  {t.__name__}: {e}')
