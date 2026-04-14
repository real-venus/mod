import json
import os
from typing import Any, Optional
from pathlib import Path


class Memory:
    """Agent memory: working state, conversation history, file tracking, persistent context."""

    def __init__(self):
        self.memory = {}
        self._files_read = set()    # track which files the agent has read
        self._files_written = set() # track which files the agent has modified
        self._errors = []           # recent errors for pattern detection

    def add(self, k: str, v: Any = None):
        if isinstance(k, dict):
            self.memory.update(k)
        else:
            self.memory[k] = v
        return self.memory

    def clear(self):
        self.memory = {}
        self._files_read.clear()
        self._files_written.clear()
        self._errors.clear()
        return self.memory

    def get(self, key=None):
        return self.memory.get(key, None) if key is not None else self.memory

    def keys(self):
        return list(self.memory.keys())

    def rm(self, key):
        if key in self.memory:
            del self.memory[key]
        return self.memory

    def update(self, data: dict):
        assert isinstance(data, dict), 'Data must be a dictionary'
        self.memory.update(data)
        return self.memory

    # ── file tracking ────────────────────────────────────────────────

    def track_read(self, file_path: str):
        """Record that a file was read"""
        self._files_read.add(file_path)

    def track_write(self, file_path: str):
        """Record that a file was modified"""
        self._files_written.add(file_path)

    def get_files_read(self):
        return list(self._files_read)

    def get_files_written(self):
        return list(self._files_written)

    # ── error tracking ───────────────────────────────────────────────

    def track_error(self, error: str):
        """Record an error for pattern detection"""
        self._errors.append(error)
        if len(self._errors) > 20:
            self._errors = self._errors[-20:]

    def get_errors(self):
        return list(self._errors)

    # ── persistent memory (save/load to disk) ────────────────────────

    def save(self, path: str = None):
        """Save memory state to disk"""
        path = path or os.path.join(os.getcwd(), '.agent_memory.json')
        data = {
            'memory': {k: v for k, v in self.memory.items()
                       if k not in ('tools', 'goal', 'output_format')},
            'files_read': list(self._files_read),
            'files_written': list(self._files_written),
        }
        try:
            Path(path).write_text(json.dumps(data, default=str, indent=2))
            return True
        except Exception:
            return False

    def load(self, path: str = None):
        """Load memory state from disk"""
        path = path or os.path.join(os.getcwd(), '.agent_memory.json')
        try:
            data = json.loads(Path(path).read_text())
            self.memory.update(data.get('memory', {}))
            self._files_read.update(data.get('files_read', []))
            self._files_written.update(data.get('files_written', []))
            return True
        except Exception:
            return False

    # ── context summary ──────────────────────────────────────────────

    def summary(self) -> dict:
        """Get a compact summary of current memory state"""
        return {
            'keys': self.keys(),
            'step': self.get('step'),
            'files_read': len(self._files_read),
            'files_written': len(self._files_written),
            'errors': len(self._errors),
            'history_length': len(self.get('history') or []),
        }

    def test(self):
        self.add('test1', 'This is a test memory item one.')
        self.add('test2', 'This is a test memory item two.')
        assert self.get('test1') == 'This is a test memory item one.'
        assert self.keys() == ['test1', 'test2']
        self.rm('test1')
        assert self.get('test1') is None
        self.clear()
        assert self.memory == {}
        # test file tracking
        self.track_read('/tmp/test.py')
        assert '/tmp/test.py' in self.get_files_read()
        self.track_write('/tmp/out.py')
        assert '/tmp/out.py' in self.get_files_written()
        # test error tracking
        self.track_error('test error')
        assert len(self.get_errors()) == 1
        self.clear()
        return True