import pytest
import os
import json
from unittest.mock import Mock, patch, MagicMock
import pandas as pd
import subprocess
from pm2 import PM2


class TestPM2:
    """Test suite for PM2 class"""

    @pytest.fixture
    def pm2(self):
        """Create PM2 instance for testing"""
        with patch('pm2.m.mod'):
            return PM2()

    def test_init(self, pm2):
        """Test PM2 initialization"""
        assert pm2.mod == 'mod'
        assert pm2.store is not None

    @patch('pm2.subprocess.run')
    def test_forward_creates_script(self, mock_run, pm2):
        """Test forward method creates serve script"""
        mock_run.return_value = Mock(returncode=0, stdout='', stderr='')
        with patch.object(pm2, 'exists', return_value=False):
            with patch('pm2.m.dirpath', return_value='/path/to/mod'):
                result = pm2.forward(mod='test_mod', port=8000)
                
                assert result['success'] is True
                assert result['status'] == 'started'

    @patch('pm2.subprocess.run')
    def test_stop_existing_process(self, mock_run, pm2):
        """Test stopping an existing process"""
        mock_run.return_value = Mock(returncode=0, stdout='', stderr='')
        with patch.object(pm2, 'exists', return_value=True):
            result = pm2.stop('test_app')
            
            assert result['success'] is True
            assert result['status'] == 'stopped'
            assert result['name'] == 'test_app'

    def test_stop_nonexistent_process(self, pm2):
        """Test stopping a non-existent process"""
        with patch.object(pm2, 'exists', return_value=False):
            result = pm2.stop('nonexistent')
            
            assert result['success'] is False
            assert result['status'] == 'not_found'

    @patch('pm2.subprocess.run')
    def test_restart_existing_process(self, mock_run, pm2):
        """Test restarting an existing process"""
        mock_run.return_value = Mock(returncode=0, stdout='', stderr='')
        with patch.object(pm2, 'exists', return_value=True):
            result = pm2.restart('test_app')
            
            assert result['success'] is True
            assert result['status'] == 'restarted'

    @patch('pm2.subprocess.run')
    def test_kill_process(self, mock_run, pm2):
        """Test killing a process"""
        mock_run.return_value = Mock(returncode=0, stdout='', stderr='')
        with patch.object(pm2, 'exists', return_value=True):
            with patch.object(pm2.registry, 'dereg'):
                result = pm2.kill('test_app')
                
                assert result['success'] is True
                assert result['status'] == 'deleted'

    @patch('pm2.subprocess.run')
    def test_kill_all(self, mock_run, pm2):
        """Test killing all processes"""
        mock_run.return_value = Mock(returncode=0, stdout='', stderr='')
        with patch.object(pm2, 'servers', return_value=[]):
            result = pm2.kill_all()
            
            assert result['success'] is True
            assert result['status'] == 'all_processes_killed'

    @patch('pm2.subprocess.run')
    def test_ps(self, mock_run, pm2):
        """Test listing processes"""
        mock_processes = json.dumps([{'name': 'app1'}, {'name': 'app2'}])
        mock_run.return_value = Mock(returncode=0, stdout=mock_processes, stderr='')
        
        result = pm2.ps()
        
        assert len(result) == 2
        assert 'app1' in result
        assert 'app2' in result

    def test_servers_with_search(self, pm2):
        """Test listing servers with search filter"""
        with patch.object(pm2, 'ps', return_value=['api_server', 'web_server', 'worker']):
            result = pm2.servers(search='server')
            
            assert len(result) == 2
            assert 'api_server' in result
            assert 'web_server' in result
            assert 'worker' not in result

    def test_exists(self, pm2):
        """Test checking if process exists"""
        with patch.object(pm2, 'ps', return_value=['app1', 'app2']):
            assert pm2.exists('app1') is True
            assert pm2.exists('app3') is False

    @patch('pm2.m.cmd')
    def test_logs(self, mock_cmd, pm2):
        """Test getting logs"""
        mock_cmd.return_value = 'log output'
        result = pm2.logs('test_app', lines=50)
        
        assert result == 'log output'
        mock_cmd.assert_called_once()

    @patch('pm2.subprocess.run')
    def test_stats(self, mock_run, pm2):
        """Test getting process statistics"""
        mock_processes = json.dumps([{
            'name': 'app1',
            'pid': 1234,
            'pm2_env': {'status': 'online', 'pm_uptime': 1000, 'restart_time': 0},
            'monit': {'cpu': 10, 'memory': 50000000}
        }])
        mock_run.return_value = Mock(returncode=0, stdout=mock_processes, stderr='')
        
        with patch.object(pm2.store, 'get', return_value=[]):
            with patch.object(pm2.store, 'put'):
                result = pm2.stats(update=True)
                
                assert isinstance(result, pd.DataFrame)
                assert len(result) == 1
                assert result.iloc[0]['name'] == 'app1'

    @patch('pm2.subprocess.run')
    def test_save(self, mock_run, pm2):
        """Test saving PM2 process list"""
        mock_run.return_value = Mock(returncode=0, stdout='', stderr='')
        result = pm2.save()
        
        assert result['success'] is True
        assert result['status'] == 'saved'

    @patch('pm2.subprocess.run')
    def test_resurrect(self, mock_run, pm2):
        """Test resurrecting saved processes"""
        mock_run.return_value = Mock(returncode=0, stdout='', stderr='')
        result = pm2.resurrect()
        
        assert result['success'] is True
        assert result['status'] == 'resurrected'

    @patch('pm2.subprocess.run')
    def test_flush(self, mock_run, pm2):
        """Test flushing logs"""
        mock_run.return_value = Mock(returncode=0, stdout='', stderr='')
        result = pm2.flush('test_app')
        
        assert result['success'] is True
        assert result['status'] == 'flushed'

    def test_create_serve_script(self, pm2):
        """Test serve script creation"""
        with patch('builtins.open', create=True) as mock_open:
            with patch('os.chmod'):
                script_path = pm2.create_serve_script(
                    name='test_mod',
                    mod='test_mod',
                    port=8000,
                    key='test_key'
                )
                
                assert 'test_mod_serve.py' in script_path
                mock_open.assert_called_once()

    @patch('pm2.subprocess.run')
    def test_start_script(self, mock_run, pm2):
        """Test starting a script with PM2"""
        mock_run.return_value = Mock(returncode=0, stdout='Started', stderr='')
        with patch.object(pm2, 'exists', return_value=False):
            with patch('os.path.exists', return_value=True):
                result = pm2.start_script(
                    name='test_app',
                    script_path='/path/to/script.py',
                    cwd='/path/to'
                )
                
                assert result['success'] is True
                assert result['status'] == 'started'
