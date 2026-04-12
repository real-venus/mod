# Mod Protocol

Standard interface for orbit modules. Every module follows this structure to be discoverable, servable, and composable.

## Config (config.json)

Every module has a `config.json` at its root:

```json
{
  "name": "mymod",
  "version": "1.0.0",
  "description": "What this module does",
  "port": 8840,
  "app_port": 8841,
  "urls": {
    "api": "http://localhost:8840",
    "app": "http://localhost:8841"
  },
  "fns": ["health", "status", "serve", "test"]
}
```

Required fields: `name`, `fns`
Port convention: `port` = API, `app_port` = frontend. `urls` map is auto-generated from ports.

## Module Class (mod.py)

Located at `<name>/<name>/mod.py`. Must export a class (typically `Mod`):

```python
import os
import mod as m

class Mod:
    def __init__(self, config=None, **kwargs):
        self._dir = os.path.dirname(__file__)
        self._root = os.path.join(self._dir, '..')
        self._config = config or {}

    def health(self):
        return {'status': 'ok', 'name': self._config.get('name', 'mymod')}

    def serve(self, api_port=None, app_port=None):
        """Start API server and app from config urls."""
        import subprocess
        from pathlib import Path

        config = self._config
        api_port = api_port or config.get('port')
        app_port = app_port or config.get('app_port')
        log_dir = Path(f'/tmp/{config.get("name", "mod")}')
        log_dir.mkdir(parents=True, exist_ok=True)

        # Kill existing
        for p in [api_port, app_port]:
            if p:
                subprocess.run(f'lsof -ti:{p} | xargs kill -9', shell=True,
                               capture_output=True)

        results = {}

        # API server (FastAPI + uvicorn)
        server_dir = os.path.join(self._root, 'server')
        if os.path.exists(os.path.join(server_dir, 'server.py')) and api_port:
            env = os.environ.copy()
            env['PYTHONPATH'] = os.path.join(self._root, '..', '..', '..')
            subprocess.Popen(
                ['python3', '-m', 'uvicorn', 'server:app',
                 '--host', '0.0.0.0', '--port', str(api_port), '--reload'],
                cwd=server_dir, env=env,
                stdout=open(log_dir / 'api.log', 'w'),
                stderr=subprocess.STDOUT,
            )
            results['api'] = f'http://localhost:{api_port}'

        # App (Next.js)
        app_dir = os.path.join(self._root, 'app')
        if os.path.exists(os.path.join(app_dir, 'package.json')) and app_port:
            subprocess.Popen(
                ['npx', 'next', 'dev', '-p', str(app_port)],
                cwd=app_dir,
                stdout=open(log_dir / 'app.log', 'w'),
                stderr=subprocess.STDOUT,
            )
            results['app'] = f'http://localhost:{app_port}'

        return results

    def test(self):
        return {'passed': True}
```

## Start Script (scripts/start.sh)

Optional shell script at `scripts/start.sh` that starts both API and app:

```bash
#!/bin/bash
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="$DIR/config.json"
API_PORT=$(python3 -c "import json; print(json.load(open('$CONFIG')).get('port', 8080))")
APP_PORT=$(python3 -c "import json; print(json.load(open('$CONFIG')).get('app_port', 3000))")

lsof -ti:$API_PORT | xargs kill -9 2>/dev/null || true
cd "$DIR" && python3 -m uvicorn server:app --host 0.0.0.0 --port "$API_PORT" --app-dir server --reload &
cd "$DIR/app" && npx next dev -p "$APP_PORT" &
wait
```

## Server (server/server.py)

Auto-routing FastAPI server. Reads `fns` from config.json, generates `POST /{fn}` routes:

```python
POST /{fn}  ->  Mod.{fn}(**body)  ->  { result: ... }
GET  /       ->  { name, fns, urls, status }
GET  /health ->  health check
```

## Serve Protocol

The core server (`m.serve(mod)`) checks: `if 'serve' in m.fns(mod)` — if the module has its own `serve()` function, it delegates to it. Otherwise it uses the generic Flask router.

Modules with a `scripts/start.sh` but no `serve` in their fns should have a `serve()` method generated that:
1. Reads `port` and `app_port` from config.json
2. Starts the API server (uvicorn) if `server/server.py` exists
3. Starts the app (next dev) if `app/package.json` exists
4. Logs to `/tmp/{name}/`

## Compliance Checklist

A compliant module has:
- [x] `config.json` with `name`, `fns`
- [x] `urls: {api, app}` map if it has ports
- [x] `serve` in `fns` if it has `scripts/start.sh` or server/app components
- [x] `<name>/<name>/mod.py` with a class exposing the fns
- [x] `health()` and `test()` methods
