from __future__ import annotations

import asyncio
import functools
import inspect
import sys
from pathlib import Path
from typing import Any, Callable, Optional, Sequence, Union


class Compute:
    CPU_SMALL = "cpu-small"
    CPU_MEDIUM = "cpu-medium"
    CPU_LARGE = "cpu-large"
    CPU_XL = "cpu-xl"
    H200_SMALL = "h200-small"
    H200_MEDIUM = "h200-medium"
    H200_LARGE = "h200-large"
    H200_XL = "h200-xl"


class Image:
    def __init__(self):
        self._commands: list[str] = []
        self._python_version: Optional[str] = None
        self._base: Optional[str] = None
        self._env: dict[str, str] = {}
        self._workdir: Optional[str] = None
        self._entrypoint: Optional[list[str]] = None
        self._cmd: Optional[list[str]] = None
        self._local_files: list[tuple[str, str]] = []
        self._local_dirs: list[tuple[str, str, list]] = []

    @classmethod
    def debian_slim(cls, python_version: Optional[str] = None) -> Image:
        img = cls()
        img._base = "debian:slim"
        img._python_version = python_version or "3.11"
        return img

    @classmethod
    def from_registry(
        cls,
        tag: str,
        setup_dockerfile_commands: list[str] = [],
        force_build: bool = False,
        add_python: Optional[str] = None,
    ) -> Image:
        img = cls()
        img._base = tag
        img._commands.extend(setup_dockerfile_commands)
        if add_python:
            img._python_version = add_python
        return img

    @classmethod
    def from_dockerfile(
        cls,
        path: Union[str, Path],
        context_dir: Optional[Union[Path, str]] = None,
        ignore: Union[Sequence[str], Callable[[Path], bool]] = [],
    ) -> Image:
        img = cls()
        img._base = f"dockerfile:{path}"
        return img

    def pip_install(self, *packages: str, find_links: Optional[str] = None,
                    index_url: Optional[str] = None, extra_index_url: Optional[str] = None,
                    pre: bool = False, extra_options: Optional[str] = None) -> Image:
        cmd = "pip install " + " ".join(packages)
        if find_links:
            cmd += f" --find-links {find_links}"
        if index_url:
            cmd += f" --index-url {index_url}"
        if extra_index_url:
            cmd += f" --extra-index-url {extra_index_url}"
        if pre:
            cmd += " --pre"
        if extra_options:
            cmd += f" {extra_options}"
        self._commands.append(cmd)
        return self

    def pip_install_from_requirements(self, requirements_txt: str, **kwargs) -> Image:
        cmd = f"pip install -r {requirements_txt}"
        self._commands.append(cmd)
        return self

    def apt_install(self, *packages: str) -> Image:
        self._commands.append("apt-get install -y " + " ".join(packages))
        return self

    def run_commands(self, *commands: str) -> Image:
        self._commands.extend(commands)
        return self

    def env(self, vars: dict[str, str]) -> Image:
        self._env.update(vars)
        return self

    def workdir(self, path: str) -> Image:
        self._workdir = path
        return self

    def dockerfile_commands(self, *commands: str, context_files: dict[str, str] = {}) -> Image:
        self._commands.extend(commands)
        return self

    def add_local_file(self, local_path: str, remote_path: str, copy: bool = True) -> Image:
        self._local_files.append((local_path, remote_path))
        return self

    def add_local_dir(self, local_path: str, remote_path: str,
                      copy: bool = True, ignore: list[str] = []) -> Image:
        self._local_dirs.append((local_path, remote_path, ignore))
        return self

    def entrypoint(self, entrypoint_commands: list[str]) -> Image:
        self._entrypoint = entrypoint_commands
        return self

    def cmd(self, cmd: list[str]) -> Image:
        self._cmd = cmd
        return self

    def with_runtime(self, app_file: str, app_module_name: str = "app") -> Image:
        return self


class Function:
    def __init__(self, fn: Callable, image: Optional[Image], resource: str,
                 min_replicas: int, max_replicas: int, timeout: int):
        self._fn = fn
        self._image = image
        self._resource = resource
        self._min_replicas = min_replicas
        self._max_replicas = max_replicas
        self._timeout = timeout
        functools.update_wrapper(self, fn)

    def __call__(self, *args, **kwargs):
        return self._fn(*args, **kwargs)

    async def remote(self, *args, **kwargs):
        return self._fn(*args, **kwargs)

    def local(self, *args, **kwargs):
        return self._fn(*args, **kwargs)


class App:
    def __init__(self, name: str, image: Optional[Image] = None,
                 project_name: str = "default"):
        self.name = name
        self.image = image
        self.project_name = project_name
        self.app_id: Optional[str] = None
        self._functions: list[Function] = []
        self._entrypoints: list[Callable] = []

    def function(
        self,
        *,
        image: Optional[Image] = None,
        resource: str = Compute.CPU_SMALL,
        min_replicas: int = 1,
        max_replicas: int = 3,
        timeout: int = 300,
        **kwargs,
    ):
        def decorator(fn: Callable) -> Function:
            func = Function(
                fn=fn,
                image=image or self.image,
                resource=resource,
                min_replicas=min_replicas,
                max_replicas=max_replicas,
                timeout=timeout,
            )
            self._functions.append(func)
            return func
        return decorator

    class _RunContext:
        def __init__(self, app: App):
            self._app = app

        async def __aenter__(self):
            return self._app

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            return False

    def run(self):
        return self._RunContext(self)

    def local_entrypoint(self):
        def decorator(fn: Callable) -> Callable:
            self._entrypoints.append(fn)

            @functools.wraps(fn)
            def wrapper(*args, **kwargs):
                return fn(*args, **kwargs)
            return wrapper
        return decorator

    def deploy(self):
        self.app_id = f"{self.project_name}-{self.name}"
        return self.app_id

    def serve(self):
        self.app_id = f"{self.project_name}-{self.name}"
        return self.app_id
