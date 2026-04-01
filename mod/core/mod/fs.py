"""FsMixin — path & file utilities extracted from Mod."""

import os
from typing import List, Optional


class FsMixin:

    def abspath(self, path: str = '') -> str:
        return os.path.abspath(os.path.expanduser(path))

    def relpath(self, path: str = '~') -> str:
        path = os.path.abspath(os.path.expanduser(path))
        return path.replace(self.homepath, '~')

    def pwd(self):
        return os.getcwd()

    def cwd(self, mod=None):
        return self.dirpath(mod) if mod else os.getcwd()

    def get_path(self, path: str = None, extension: Optional[str] = None) -> str:
        """Resolve path relative to storage dir (~/.mod) unless absolute."""
        storage_dir = self.storage_dir()
        if path is None:
            return storage_dir
        if path.startswith('/'):
            pass
        elif path.startswith('~/'):
            path = os.path.expanduser(path)
        elif path.startswith('.'):
            path = os.path.abspath(path)
        elif storage_dir not in path:
            path = os.path.join(storage_dir, path)
        if extension is not None and not path.endswith(extension):
            path = f'{path}.{extension}'
        return path

    def storage_dir(self, mod=None):
        mod = (mod or self.name).replace('/', '.')
        return self.abspath(f'~/.{self.name}/{mod}')

    def is_home(self, path: str = None) -> bool:
        if path is None:
            path = self.pwd()
        return os.path.abspath(path) == os.path.abspath(self.homepath)

    def filter_path(self, path, search=None, include_hidden=False):
        """Return True if path passes avoid-folder / hidden / search filters."""
        parts = path.replace('\\', '/').split('/')
        for part in parts:
            if part in self.avoid_folders:
                return False
            if not include_hidden and part.startswith('.') and part != '.':
                return False
        if search and search not in path:
            return False
        return True

    def _walk(self, path, depth=10, include_hidden=False):
        """Shared os.walk with depth-limiting and folder pruning."""
        avoid = self.avoid_folders
        for root, dirs, files in os.walk(path):
            rel = os.path.relpath(root, path)
            cur_depth = 0 if rel == '.' else rel.count(os.sep) + 1
            if cur_depth >= depth:
                dirs.clear()
                continue
            dirs[:] = sorted(
                d for d in dirs
                if d not in avoid and (include_hidden or not d.startswith('.'))
            )
            yield root, dirs, files

    def folders(self, path: str = './', depth: Optional[int] = 1,
                search=None, include_hidden=False, **kwargs) -> List[str]:
        path = self.abspath(path)
        result = []
        for root, dirs, _files in self._walk(path, depth, include_hidden):
            for d in dirs:
                full = os.path.join(root, d)
                if search is not None and search not in full:
                    continue
                result.append(full)
        return sorted(result)

    def files(self, path='./', search: str = None, include_hidden: bool = False,
              depth=10, **kwargs) -> List[str]:
        """List all files in path with depth-limiting and folder pruning."""
        path = self.abspath(path)
        if not os.path.exists(path) and self.mod_exists(path):
            path = self.dirpath(path)
        if depth <= 0:
            return []
        result = []
        for root, dirs, files in self._walk(path, depth, include_hidden):
            for f in files:
                if not include_hidden and f.startswith('.'):
                    continue
                full = os.path.join(root, f)
                if search is not None and search not in full:
                    continue
                result.append(full)
        return sorted(result)

    def glob(self, path: str = './', depth: Optional[int] = 4,
             files_only: bool = True, include_hidden=False, **kwargs):
        path = self.abspath(path)
        if depth <= 0:
            return []
        result = []
        for root, dirs, files in self._walk(path, depth, include_hidden):
            if not files_only:
                result.extend(os.path.join(root, d) for d in dirs)
            for f in files:
                if not include_hidden and f.startswith('.'):
                    continue
                result.append(os.path.join(root, f))
        return result

    def ls(self, path: str = './', search=None, include_hidden=False,
           depth=None, return_full_path: bool = True):
        """List directory entries (non-recursive)."""
        path = self.abspath(path)
        try:
            entries = os.scandir(path)
        except (OSError, PermissionError):
            return []
        ls_files = sorted(e.path if return_full_path else e.name for e in entries)
        if search is not None:
            ls_files = [f for f in ls_files if search in f]
        return ls_files
