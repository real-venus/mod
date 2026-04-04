"""Tests for Tx transaction logging."""
import os
import json
from mod.core.tx.tx import Tx


class TestTxSave:
    def test_save_returns_hash_and_path(self, tmp_dir):
        tx = Tx(storage_path=tmp_dir)
        result = tx.save(fn='test_fn', params={'args': [1]}, result=42, client='addr1', token='tok1')
        assert 'hash' in result
        assert 'path' in result
        assert os.path.exists(result['path'])

    def test_save_creates_json_file(self, tmp_dir):
        tx = Tx(storage_path=tmp_dir)
        result = tx.save(fn='my_fn', params={}, result='ok', client='c', token='t')
        with open(result['path']) as f:
            data = json.load(f)
        assert data['fn'] == 'my_fn'
        assert data['result'] == 'ok'
        assert data['client'] == 'c'
        assert data['token'] == 't'
        assert 'timestamp' in data

    def test_save_non_serializable_result(self, tmp_dir):
        tx = Tx(storage_path=tmp_dir)
        result = tx.save(fn='fn', params={}, result=object(), client='c', token='t')
        with open(result['path']) as f:
            data = json.load(f)
        assert isinstance(data['result'], str)


class TestTxGet:
    def test_get_existing(self, tmp_dir):
        tx = Tx(storage_path=tmp_dir)
        saved = tx.save(fn='fn1', params={}, result=1, client='c', token='t')
        retrieved = tx.get(saved['hash'])
        assert retrieved['fn'] == 'fn1'
        assert retrieved['result'] == 1

    def test_get_nonexistent(self, tmp_dir):
        tx = Tx(storage_path=tmp_dir)
        assert tx.get('nonexistent_hash') is None


class TestTxList:
    def test_list_empty(self, tmp_dir):
        tx = Tx(storage_path=tmp_dir)
        assert tx.list() == []

    def test_list_returns_saved(self, tmp_dir):
        tx = Tx(storage_path=tmp_dir)
        tx.save(fn='alpha', params={}, result=1, client='c', token='t')
        tx.save(fn='beta', params={}, result=2, client='c', token='t')
        items = tx.list()
        assert len(items) == 2

    def test_list_search_filter(self, tmp_dir):
        tx = Tx(storage_path=tmp_dir)
        tx.save(fn='deploy_contract', params={}, result=1, client='c', token='t')
        tx.save(fn='get_balance', params={}, result=2, client='c', token='t')
        items = tx.list(search='deploy')
        assert len(items) == 1
        assert items[0]['fn'] == 'deploy_contract'

    def test_list_limit(self, tmp_dir):
        tx = Tx(storage_path=tmp_dir)
        for i in range(5):
            tx.save(fn=f'fn_{i}', params={}, result=i, client='c', token='t')
        items = tx.list(limit=3)
        assert len(items) == 3

    def test_list_sorted_by_timestamp(self, tmp_dir):
        tx = Tx(storage_path=tmp_dir)
        tx.save(fn='first', params={}, result=1, client='c', token='t')
        tx.save(fn='second', params={}, result=2, client='c', token='t')
        items = tx.list()
        assert items[0]['timestamp'] >= items[1]['timestamp']


class TestTxHash:
    def test_hash_deterministic(self, tmp_dir):
        tx = Tx(storage_path=tmp_dir)
        h = tx._hash({'a': 1, 'b': 2})
        assert h == tx._hash({'b': 2, 'a': 1})

    def test_hash_length(self, tmp_dir):
        tx = Tx(storage_path=tmp_dir)
        h = tx._hash({'x': 'test'})
        assert len(h) == 16
