"""Container image builder for Targon applications."""

from __future__ import annotations

from pathlib import Path
from typing import Callable, Optional, Sequence, Union


class Image:
    """Build container images for Targon functions."""

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
        """Create a Debian slim-based image."""
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
        """Create an image from a Docker registry."""
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
        """Create an image from a Dockerfile."""
        img = cls()
        img._base = f"dockerfile:{path}"
        return img

    def pip_install(self, *packages: str, find_links: Optional[str] = None,
                    index_url: Optional[str] = None, extra_index_url: Optional[str] = None,
                    pre: bool = False, extra_options: Optional[str] = None) -> Image:
        """Add pip install command to the image."""
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
        """Install packages from requirements.txt file."""
        cmd = f"pip install -r {requirements_txt}"
        self._commands.append(cmd)
        return self

    def apt_install(self, *packages: str) -> Image:
        """Add apt-get install command to the image."""
        self._commands.append("apt-get install -y " + " ".join(packages))
        return self

    def run_commands(self, *commands: str) -> Image:
        """Add arbitrary commands to run during image build."""
        self._commands.extend(commands)
        return self

    def env(self, vars: dict[str, str]) -> Image:
        """Set environment variables in the image."""
        self._env.update(vars)
        return self

    def workdir(self, path: str) -> Image:
        """Set the working directory in the image."""
        self._workdir = path
        return self

    def dockerfile_commands(self, *commands: str, context_files: dict[str, str] = {}) -> Image:
        """Add raw Dockerfile commands."""
        self._commands.extend(commands)
        return self

    def add_local_file(self, local_path: str, remote_path: str, copy: bool = True) -> Image:
        """Copy a local file into the image."""
        self._local_files.append((local_path, remote_path))
        return self

    def add_local_dir(self, local_path: str, remote_path: str,
                      copy: bool = True, ignore: list[str] = []) -> Image:
        """Copy a local directory into the image."""
        self._local_dirs.append((local_path, remote_path, ignore))
        return self

    def entrypoint(self, entrypoint_commands: list[str]) -> Image:
        """Set the container entrypoint."""
        self._entrypoint = entrypoint_commands
        return self

    def cmd(self, cmd: list[str]) -> Image:
        """Set the default container command."""
        self._cmd = cmd
        return self

    def with_runtime(self, app_file: str, app_module_name: str = "app") -> Image:
        """Configure the runtime for the application."""
        return self
