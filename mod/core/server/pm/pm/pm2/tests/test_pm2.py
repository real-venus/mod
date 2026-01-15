#!/usr/bin/env python3
"""Comprehensive test suite for PM2 - Process Manager 2"""

import os
import sys
import json
import time
import pytest
import tempfile
import shutil
from pathlib import Path

# Add parent directory to path to import pm2
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from pm2.pm2 import PM2
import mod as m


class TestPM2:
    """Full test suite for PM2 functionality"""

    @pytest.fixture(autouse=True)
    def setup_teardown(self):
        """Set up test environment before each test and clean up after"""
        # Create temporary directory for test storage
        self.test_dir = tempfile.mkdtemp(prefix="pm2_test_")
        self.pm2 = PM2(path=self.test_dir)
        
        # Create a simple test script
        self.test_script = os.path.join(self.test_dir, "test_script.py")
        with open(self.test_script, 'w') as f:
            f.write("""#!/usr/bin/env python3
import time
import sys
print('Test script started', flush=True)
for i in range(100):
    print(f'Running iteration {i}', flush=True)
    time.sleep(1)
""")
        
        yield
        
        # Clean up after each test
        try:
            self.pm2.kill_all()
        except:
            pass
        
        # Remove test directory
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)

    def test_initialization(self):
        """Test PM2 initialization"""
        assert self.pm2 is not None
        assert self.pm2.mod == 'mod'
        assert self.pm2.store is not None

    def test_start_process(self):
        """Test starting a PM2 process"""
        result = self.pm2.run(
            name="test_process",
            script=f"python3 {self.test_script}",
            interpreter="python3"
        )
        
        assert result['success'] is True
        assert result['status'] == 'started'
        assert result['name'] == 'test_process'
        
        # Verify process is running
        time.sleep(1)
        assert self.pm2.exists('test_process')
        
        # Clean up
        self.pm2.stop('test_process')

    def test_stop_process(self):
        """Test stopping a PM2 process"""
        # Start a process first
        start_result = self.pm2.run(
            name="test_stop",
            script=f"python3 {self.test_script}",
            interpreter="python3"
        )
        assert start_result['success'] is True
        
        # Give it a moment to start
        time.sleep(1)
        
        # Stop the process
        stop_result = self.pm2.stop('test_stop')
        assert stop_result['success'] is True
        assert stop_result['status'] == 'stopped'

    def test_restart_process(self):
        """Test restarting a PM2 process"""
        # Start a process
        self.pm2.run(
            name="test_restart",
            script=f"python3 {self.test_script}",
            interpreter="python3"
        )
        time.sleep(1)
        
        # Restart
        restart_result = self.pm2.restart('test_restart')
        assert restart_result['success'] is True
        assert restart_result['status'] == 'restarted'
        
        # Clean up
        self.pm2.stop('test_restart')

    def test_delete_process(self):
        """Test deleting a PM2 process"""
        # Start a process
        self.pm2.run(
            name="test_delete",
            script=f"python3 {self.test_script}",
            interpreter="python3"
        )
        time.sleep(1)
        
        # Delete it
        delete_result = self.pm2.delete('test_delete')
        assert delete_result['success'] is True
        assert delete_result['status'] == 'deleted'
        
        # Verify it's removed
        assert not self.pm2.exists('test_delete')

    def test_list_processes(self):
        """Test listing all PM2 processes"""
        # Start multiple processes
        self.pm2.run("proc1", script=f"python3 {self.test_script}", interpreter="python3")
        self.pm2.run("proc2", script=f"python3 {self.test_script}", interpreter="python3")
        time.sleep(1)
        
        # List processes
        processes = self.pm2.servers()
        assert len(processes) >= 2
        assert 'proc1' in processes
        assert 'proc2' in processes
        
        # Clean up
        self.pm2.kill_all()

    def test_process_exists(self):
        """Test checking if a process exists"""
        # Process doesn't exist yet
        assert not self.pm2.exists('test_exists')
        
        # Start process
        self.pm2.run(
            name="test_exists",
            script=f"python3 {self.test_script}",
            interpreter="python3"
        )
        time.sleep(1)
        
        # Now it exists
        assert self.pm2.exists('test_exists')
        
        # Clean up
        self.pm2.stop('test_exists')

    def test_logs(self):
        """Test retrieving PM2 process logs"""
        # Start a process
        self.pm2.run(
            name="test_logs",
            script=f"python3 {self.test_script}",
            interpreter="python3"
        )
        time.sleep(2)  # Let it write some logs
        
        # Get logs
        logs = self.pm2.logs('test_logs', lines=10)
        assert isinstance(logs, str)
        assert 'Test script started' in logs or len(logs) > 0
        
        # Clean up
        self.pm2.stop('test_logs')

    def test_stats(self):
        """Test getting PM2 process statistics"""
        # Start a process
        self.pm2.run(
            name="test_stats",
            script=f"python3 {self.test_script}",
            interpreter="python3"
        )
        time.sleep(1)
        
        # Get stats
        stats = self.pm2.stats(update=True)
        assert stats is not None
        assert len(stats) > 0
        
        # Clean up
        self.pm2.stop('test_stats')

    def test_kill_all(self):
        """Test stopping all PM2 processes"""
        # Start multiple processes
        self.pm2.run("kill1", script=f"python3 {self.test_script}", interpreter="python3")
        self.pm2.run("kill2", script=f"python3 {self.test_script}", interpreter="python3")
        self.pm2.run("kill3", script=f"python3 {self.test_script}", interpreter="python3")
        time.sleep(1)
        
        # Kill all
        result = self.pm2.kill_all()
        assert result['success'] is True
        
        # Verify all stopped
        time.sleep(1)
        for name in ['kill1', 'kill2', 'kill3']:
            assert not self.pm2.exists(name)

    def test_save_and_resurrect(self):
        """Test saving and resurrecting PM2 processes"""
        # Start a process
        self.pm2.run(
            name="test_resurrect",
            script=f"python3 {self.test_script}",
            interpreter="python3"
        )
        time.sleep(1)
        
        # Save
        save_result = self.pm2.save()
        assert save_result['success'] is True
        
        # Stop the process
        self.pm2.stop('test_resurrect')
        time.sleep(1)
        
        # Resurrect
        resurrect_result = self.pm2.resurrect()
        assert resurrect_result['success'] is True
        
        # Clean up
        time.sleep(1)
        self.pm2.stop('test_resurrect')

    def test_nonexistent_process_operations(self):
        """Test operations on nonexistent processes"""
        # Try to stop nonexistent process
        stop_result = self.pm2.stop('nonexistent')
        assert stop_result['success'] is False
        assert stop_result['status'] == 'not_found'
        
        # Try to restart nonexistent process
        restart_result = self.pm2.restart('nonexistent')
        assert restart_result['success'] is False
        assert restart_result['status'] == 'not_found'
        
        # Try to delete nonexistent process
        delete_result = self.pm2.delete('nonexistent')
        assert delete_result['success'] is False
        assert delete_result['status'] == 'not_found'

    def test_process_info(self):
        """Test getting detailed process info"""
        # Start a process
        self.pm2.run(
            name="test_info",
            script=f"python3 {self.test_script}",
            interpreter="python3"
        )
        time.sleep(1)
        
        # Get process info
        info = self.pm2.process_info('test_info')
        assert isinstance(info, dict)
        
        # Clean up
        self.pm2.stop('test_info')

    def test_reload_process(self):
        """Test reloading a PM2 process with zero-downtime"""
        # Start a process
        self.pm2.run(
            name="test_reload",
            script=f"python3 {self.test_script}",
            interpreter="python3"
        )
        time.sleep(1)
        
        # Reload
        reload_result = self.pm2.reload('test_reload')
        assert reload_result['success'] is True
        assert reload_result['status'] == 'reloaded'
        
        # Clean up
        self.pm2.stop('test_reload')

    def test_describe_process(self):
        """Test getting detailed description of a PM2 process"""
        # Start a process
        self.pm2.run(
            name="test_describe",
            script=f"python3 {self.test_script}",
            interpreter="python3"
        )
        time.sleep(1)
        
        # Describe it
        info = self.pm2.describe('test_describe')
        assert info['status'] == 'success'
        assert info['name'] == 'test_describe'
        
        # Clean up
        self.pm2.stop('test_describe')

    def test_flush_logs(self):
        """Test flushing PM2 logs"""
        # Start a process
        self.pm2.run(
            name="test_flush",
            script=f"python3 {self.test_script}",
            interpreter="python3"
        )
        time.sleep(1)
        
        # Flush logs
        flush_result = self.pm2.flush('test_flush')
        assert flush_result['success'] is True
        assert flush_result['status'] == 'flushed'
        
        # Clean up
        self.pm2.stop('test_flush')

    def test_params2cmd(self):
        """Test converting parameters to command string"""
        params = {
            'key': 'value',
            'flag': True,
            'number': 42,
            'list': [1, 2, 3],
            'dict': {'nested': 'value'}
        }
        
        cmd = self.pm2.params2cmd(params)
        assert isinstance(cmd, str)
        assert 'key=value' in cmd
        assert 'flag=1' in cmd
        assert 'number=42' in cmd

    def test_namespace(self):
        """Test getting namespace mapping of PM2 processes"""
        # Start a process
        self.pm2.run(
            name="test_namespace",
            script=f"python3 {self.test_script}",
            interpreter="python3"
        )
        time.sleep(1)
        
        # Get namespace
        namespace = self.pm2.namespace(update=True)
        assert isinstance(namespace, dict)
        assert 'test_namespace' in namespace
        assert namespace['test_namespace'] == 'pm2:test_namespace'
        
        # Clean up
        self.pm2.stop('test_namespace')

    def test_sync(self):
        """Test syncing PM2 process statistics"""
        result = self.pm2.sync()
        assert result['status'] == 'synced'
        assert result['success'] is True


if __name__ == '__main__':
    # Run the test suite
    pytest.main([__file__, '-v', '--tb=short'])
