import pytest
import os
import json
from unittest.mock import Mock, patch, MagicMock
import pandas as pd
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

    @patch('pm2.os.system')
    def test_run_new_process(self, mock_system, pm2):
        """Test starting a new PM2 process"""
        mock_system.return_value = 0
        with patch.object(pm2, 'exists', return_value=False):
            result = pm2.run(name='test_app', script='python app.py')
            
            assert result['success'] is True
            assert result['status'] == 'started'
            assert result['name'] == 'test_app'
            mock_system.assert_called_once()

    @patch('pm2.os.system')
    def test_run_existing_process(self, mock_system, pm2):
        """Test running an existing process triggers restart"""
        with patch.object(pm2, 'exists', return_value=True):
            with patch.object(pm2, 'restart', return_value={'status': 'restarted'}) as mock_restart:
                result = pm2.run(name='test_app', script='python app.py')
                mock_restart.assert_called_once_with('test_app')

    @patch('pm2.os.system')
    def test_stop_existing_process(self, mock_system, pm2):
        """Test stopping an existing process"""
        mock_system.return_value = 0
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

    @patch('pm2.os.system')
    def test_restart_existing_process(self, mock_system, pm2):
        """Test restarting an existing process"""
        mock_system.return_value = 0
        with patch.object(pm2, 'exists', return_value=True):
            result = pm2.restart('test_app')
            
            assert result['success'] is True
            assert result['status'] == 'restarted'

    @patch('pm2.os.system')
    def test_kill_process(self, mock_system, pm2):
        """Test killing a process"""
        mock_system.return_value = 0
        with patch.object(pm2, 'exists', return_value=True):
            result = pm2.kill('test_app')
            
            assert result['success'] is True
            assert result['status'] == 'deleted'

    @patch('pm2.os.system')
    def test_kill_all(self, mock_system, pm2):
        """Test killing all processes"""
        mock_system.return_value = 0
        result = pm2.kill_all()
        
        assert result['success'] is True
        assert result['status'] == 'all_processes_killed'

    @patch('pm2.m.cmd')
    def test_ps(self, mock_cmd, pm2):
        """Test listing processes"""
        mock_processes = json.dumps([{'name': 'app1'}, {'name': 'app2'}])
        mock_cmd.return_value = mock_processes
        
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
        with patch.object(pm2, 'servers', return_value=['app1', 'app2']):
            assert pm2.exists('app1') is True
            assert pm2.exists('app3') is False

    @patch('pm2.m.cmd')
    def test_logs(self, mock_cmd, pm2):
        """Test getting logs"""
        mock_cmd.return_value = 'log output'
        result = pm2.logs('test_app', lines=50)
        
        assert result == 'log output'
        mock_cmd.assert_called_once()

    @patch('pm2.m.cmd')
    def test_stats(self, mock_cmd, pm2):
        """Test getting process statistics"""
        mock_processes = json.dumps([{
            'name': 'app1',
            'pid': 1234,
            'pm2_env': {'status': 'online', 'pm_uptime': 1000, 'restart_time': 0},
            'monit': {'cpu': 10, 'memory': 50000000}
        }])
        mock_cmd.return_value = mock_processes
        
        with patch.object(pm2.store, 'get', return_value=[]):
            with patch.object(pm2.store, 'put'):
                result = pm2.stats(update=True)
                
                assert isinstance(result, pd.DataFrame)
                assert len(result) == 1
                assert result.iloc[0]['name'] == 'app1'

    def test_params2cmd(self, pm2):
        """Test converting params to command string"""
        params = {
            'key': 'value',
            'flag': True,
            'disabled': False,
            'items': ['a', 'b', 'c'],
            'config': {'nested': 'value'}
        }
        
        result = pm2.params2cmd(params)
        
        assert 'key=value' in result
        assert 'flag=1' in result
        assert 'disabled=0' in result
        assert 'items=a,b,c' in result

    @patch('pm2.os.system')
    def test_save(self, mock_system, pm2):
        """Test saving PM2 process list"""
        mock_system.return_value = 0
        result = pm2.save()
        
        assert result['success'] is True
        assert result['status'] == 'saved'

    @patch('pm2.os.system')
    def test_resurrect(self, mock_system, pm2):
        """Test resurrecting saved processes"""
        mock_system.return_value = 0
        result = pm2.resurrect()
        
        assert result['success'] is True
        assert result['status'] == 'resurrected'

    @patch('pm2.os.system')
    def test_flush(self, mock_system, pm2):
        """Test flushing logs"""
        mock_system.return_value = 0
        result = pm2.flush('test_app')
        
        assert result['success'] is True
        assert result['status'] == 'flushed'

    @patch('pm2.os.system')
    def test_reload(self, mock_system, pm2):
        """Test reloading a process"""
        mock_system.return_value = 0
        with patch.object(pm2, 'exists', return_value=True):
            result = pm2.reload('test_app')
            
            assert result['success'] is True
            assert result['status'] == 'reloaded'

    @patch('pm2.m.cmd')
    def test_env(self, mock_cmd, pm2):
        """Test getting environment variables"""
        mock_processes = json.dumps([{
            'name': 'test_app',
            'pm2_env': {'env': {'VAR1': 'value1', 'VAR2': 'value2'}}
        }])
        mock_cmd.return_value = mock_processes
        
        result = pm2.env('test_app')
        
        assert result['VAR1'] == 'value1'
        assert result['VAR2'] == 'value2'

    def test_forward(self, pm2):
        """Test forward method for starting mod server"""
        with patch.object(pm2, 'run', return_value={'success': True}) as mock_run:
            with patch('pm2.m.dirpath', return_value='/path/to/mod'):
                result = pm2.forward(mod='api', key='test_key')
                
                mock_run.assert_called_once()
                call_args = mock_run.call_args[1]
                assert call_args['name'] == 'api'
                assert 'key=test_key' in call_args['script']
