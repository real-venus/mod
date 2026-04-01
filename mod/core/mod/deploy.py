"""DeployMixin — server, docker, and deployment operations."""

import os
import json
import subprocess


class DeployMixin:

    # ── Server & Deploy ──────────────────────────────────────────────────

    def serve(self, mod: str = 'mod', port: int = None, remote=True, **kwargs):
        fn = self.fn('server/serve')
        if isinstance(mod, str):
            return fn(mod, port=port, remote=remote, **kwargs)
        elif isinstance(mod, list):
            threads = []
            for m in mod:
                params = {'mod': m, 'port': port, 'remote': remote, **kwargs}
                t = self.thread(fn, params)
                threads.append(t)
            return self.wait(threads)

    def servers(self, *args, pm='pm2', **kwargs):
        return self.fn(f'{pm}/servers')(*args, **kwargs)

    def server_exists(self, server: str = 'mod', pm='pm2', *args, **kwargs):
        return self.fn(f'{pm}/exists')(server, *args, **kwargs)

    def ensure_server(self, server: str = 'mod', pm='pm2', *args, **kwargs):
        if not self.server_exists(server, pm=pm, *args, **kwargs):
            return self.serve(server, pm=pm, *args, **kwargs)
        return {'msg': f'Server {server} already running'}

    def kill(self, server: str = 'mod'):
        return self.fn('server/kill')(server)

    def kill_all(self):
        return self.fn('server/killall')()

    def urls(self, *args, **kwargs):
        return self.fn('server/urls')(*args, **kwargs)

    def namespace(self, *args, **kwargs):
        return self.fn('server/namespace')(*args, **kwargs)

    def logs(self, mod, pm='pm2', **kwargs):
        return self.fn(f'{pm}/logs')(mod, **kwargs)

    def app(self):
        if not self.server_exists('app'):
            return
        self.serve('api')
        return self.serve('app')

    def setup(self):
        self.serve('ipfs')
        self.serve('api')
        self.up('app')

    def get_ports(self, n: int = 3) -> list:
        port_range = self.get_port_range()
        used_ports = set(self.used_ports())
        available = [p for p in range(port_range[0], port_range[1]) if p not in used_ports]
        if len(available) < n:
            raise RuntimeError(f'Not enough available ports in range {port_range}')
        return available[:n]

    def get_port_range(self, port_range: list = None) -> list:
        if port_range is None:
            port_range = self.get('port_range', [])
        if isinstance(port_range, str):
            port_range = list(map(int, port_range.split('-')))
        if not port_range:
            port_range = self.port_range
        port_range = list(port_range)
        if len(port_range) < 2:
            raise ValueError('Port range must be a list of at least 2 integers')
        if not isinstance(port_range[0], int) or not isinstance(port_range[1], int):
            raise TypeError('Port range values must be integers')
        return port_range

    # ── Docker ───────────────────────────────────────────────────────────

    def up(self, mod='mod'):
        return self.fn('pm.docker/up')(mod)

    def down(self, mod='mod'):
        return self.fn('pm.docker/down')(mod)

    def enter(self, image='mod'):
        return self.fn('pm.docker/enter')(image)

    def build(self, *args, **kwargs):
        return self.fn('pm.docker/build')(*args, **kwargs)

    def exec(self, mod: str = 'mod', *args, **kwargs):
        return self.fn('pm.docker/exec')(mod, *args, **kwargs)

    def dockerfiles(self, mod=None):
        dirpath = self.dirpath(mod)
        return [os.path.join(dirpath, f) for f in os.listdir(dirpath) if f.startswith('Dockerfile')]

    # ── Start & Deploy ───────────────────────────────────────────────────

    def start(self, mod=None):
        """Find and execute the closest start.sh script."""
        path = self.abspath(self.dirpath(mod) if mod else os.getcwd())
        start_script = None

        for root, dirs, files in os.walk(path):
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ('node_modules', '__pycache__', '.git')]
            if 'start.sh' in files:
                start_script = os.path.join(root, 'start.sh')
                break

        if start_script is None:
            current = os.path.dirname(path)
            while True:
                candidate = os.path.join(current, 'start.sh')
                if os.path.isfile(candidate):
                    start_script = candidate
                    break
                parent = os.path.dirname(current)
                if parent == current:
                    break
                current = parent

        if start_script is None:
            raise FileNotFoundError(f'No start.sh found in or above {path}')

        os.chmod(start_script, os.stat(start_script).st_mode | 0o755)
        mod_dir = self.abspath(self.dirpath(mod) if mod else self.dirpath())
        self.print(f'Running {start_script} in {mod_dir}')
        return self.cmd(f'bash {start_script}', cwd=mod_dir, verbose=True)

    def _pm2_running(self):
        """Get set of running PM2 process names."""
        try:
            result = subprocess.run(['pm2', 'jlist'], capture_output=True, text=True, timeout=10)
            procs = json.loads(result.stdout) if result.stdout.strip() else []
            return {p['name'] for p in procs if p.get('pm2_env', {}).get('status') == 'online'}
        except Exception:
            return set()

    def _find_start_script(self, mod):
        """Find start.sh for a module."""
        path = self.abspath(self.dirpath(mod))
        for root, dirs, files in os.walk(path):
            dirs[:] = [d for d in dirs if not d.startswith('.')
                       and d not in ('node_modules', '__pycache__', '.git', 'target', '.next', 'venv', '.venv')]
            if 'start.sh' in files:
                return os.path.join(root, 'start.sh')
        return None

    def _detect_mod_type(self, mod):
        """Detect module type based on its files."""
        path = self.abspath(self.dirpath(mod))
        info = {
            'path': path, 'name': mod,
            'has_python': False, 'has_node': False, 'has_rust': False,
            'has_docker': False, 'has_app': False, 'has_requirements': False,
            'has_mod_py': False, 'python_module': None,
        }
        skip_dirs = {'node_modules', '__pycache__', '.git', 'target', '.next', 'venv', '.venv'}
        for root, dirs, files in os.walk(path):
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in skip_dirs]
            rel = os.path.relpath(root, path)
            if (0 if rel == '.' else rel.count(os.sep) + 1) > 2:
                continue
            for f in files:
                if f == 'requirements.txt':
                    info['has_requirements'] = info['has_python'] = True
                elif f == 'package.json':
                    info['has_node'] = True
                    if os.path.basename(root) in ('app', '') or rel == '.':
                        info['has_app'] = True
                elif f == 'Cargo.toml':
                    info['has_rust'] = True
                elif f in ('docker-compose.yml', 'Dockerfile'):
                    info['has_docker'] = True
                elif f == 'mod.py':
                    info['has_mod_py'] = info['has_python'] = True
                    info['python_module'] = os.path.basename(root)
        return info

    def create_start_script(self, mod):
        """Auto-generate a start.sh script for a module."""
        info = self._detect_mod_type(mod)
        path, mod_name = info['path'], info['name'].split('.')[-1]
        lines = [
            '#!/bin/bash',
            f'# Auto-generated start script for {mod_name}',
            'DIR="$(cd "$(dirname "$0")" && pwd)"',
            'cd "$DIR"', '',
        ]

        if info['has_docker'] and os.path.isfile(os.path.join(path, 'docker-compose.yml')):
            lines += [f'echo "Starting {mod_name} via docker-compose..."', 'docker-compose up -d']
        elif info['has_rust']:
            lines += [
                f'if [ ! -f "target/release/{mod_name}" ]; then',
                f'    echo "Building {mod_name}..."', '    cargo build --release', 'fi', '',
                f'echo "Starting {mod_name}..."', f'exec ./target/release/{mod_name}',
            ]
        elif info['has_python'] and info['has_node'] and info['has_app']:
            lines += ['if [ -f "requirements.txt" ]; then', '    pip3 install -r requirements.txt -q', 'fi', '']
            if info['has_mod_py'] and info['python_module']:
                lines += [f'python3 -m {info["python_module"]}.mod &', 'SERVER_PID=$!', '']
            lines += [
                'cd "$DIR/app"',
                'if [ ! -d "node_modules" ]; then', '    npm install', 'fi',
                'npm run dev &', 'APP_PID=$!', '',
                f'echo "{mod_name} started"',
                'trap "kill $SERVER_PID $APP_PID 2>/dev/null" EXIT', 'wait',
            ]
        elif info['has_node']:
            lines += [
                'if [ ! -d "node_modules" ]; then', '    npm install', 'fi', '',
                f'echo "Starting {mod_name}..."', 'npm run dev',
            ]
        elif info['has_python']:
            if info['has_requirements']:
                lines += ['if [ -f "requirements.txt" ]; then', '    pip3 install -r requirements.txt -q', 'fi', '']
            if info['has_mod_py'] and info['python_module']:
                lines += [f'echo "Starting {mod_name}..."', f'python3 -m {info["python_module"]}.mod']
            else:
                lines += [f'echo "Starting {mod_name}..."', f'python3 -c "import mod; mod.Mod().serve(\'{mod_name}\')"']
        else:
            lines += [f'echo "Starting {mod_name}..."', f'python3 -c "import mod; mod.Mod().serve(\'{mod_name}\')"']

        scripts_dir = os.path.join(path, 'scripts')
        script_path = os.path.join(scripts_dir if os.path.isdir(scripts_dir) else path, 'start.sh')
        with open(script_path, 'w') as f:
            f.write('\n'.join(lines) + '\n')
        os.chmod(script_path, os.stat(script_path).st_mode | 0o755)
        self.print(f'Created {script_path}')
        return script_path

    def off_mods(self, search=None, orbit='inner'):
        """List modules not currently running in PM2."""
        running = self._pm2_running()
        return [m for m in self.mods(search=search, orbit=orbit) if m not in running]

    def deploy(self, mod=None, search=None, orbit='inner', create=True):
        """Deploy modules by running their start scripts."""
        if mod:
            mods_to_deploy = [mod]
        else:
            mods_to_deploy = self.off_mods(search=search, orbit=orbit)
            if not search and not mod:
                self.print(f'{len(mods_to_deploy)} modules are off:')
                for m in sorted(mods_to_deploy):
                    has_script = 'Y' if self._find_start_script(m) else 'N'
                    self.print(f'  [{has_script}] {m}')
                return mods_to_deploy

        results = {}
        for mod_name in mods_to_deploy:
            script = self._find_start_script(mod_name)
            if script is None:
                if create:
                    self.print(f'No start.sh for {mod_name}, creating one...')
                    script = self.create_start_script(mod_name)
                else:
                    results[mod_name] = 'skipped'
                    continue
            try:
                self.print(f'Deploying {mod_name}...')
                mod_dir = self.abspath(self.dirpath(mod_name))
                os.chmod(script, os.stat(script).st_mode | 0o755)
                self.cmd(f'bash {script}', cwd=mod_dir, verbose=True)
                results[mod_name] = 'deployed'
            except Exception as e:
                self.print(f'Failed to deploy {mod_name}: {e}')
                results[mod_name] = f'error: {e}'
        return results
