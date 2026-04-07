"""
appify - turn any folder into a mod server + app

Usage:
    import mod as m
    appify = m.mod('appify')()

    # scaffold a full mod+server+app from any folder
    appify.forward('/path/to/my/project')

    # just generate the mod.py wrapper
    appify.modify('/path/to/my/project')

    # just generate the app
    appify.appify('/path/to/my/project')

    # serve an appified project
    appify.serve('/path/to/my/project')
"""
import os
import json
import inspect
import importlib
import importlib.util
import subprocess
import shutil

import mod as m


class Mod:
    description = "Turn any folder into a mod.py server module + Next.js app"

    def __init__(self, **kwargs):
        self._dir = os.path.dirname(__file__)

    # ── main entry ────────────────────────────────────────────────────

    def forward(self, path, name=None, api_port=None, app_port=None,
                serve=False, install=True):
        """
        Full pipeline: scan folder → generate mod.py + server + app.

        Args:
            path:      folder to appify
            name:      module name (defaults to folder name)
            api_port:  API port (auto-allocated if None)
            app_port:  App port (auto-allocated if None)
            serve:     start servers after generation
            install:   install npm deps for app
        """
        path = os.path.abspath(os.path.expanduser(path))
        assert os.path.isdir(path), f'Not a directory: {path}'
        name = name or os.path.basename(path)
        api_port = api_port or m.free_port()
        app_port = app_port or m.free_port()

        scan = self.scan(path)
        mod_result = self.modify(path, name=name, scan=scan)
        server_result = self.serverify(path, name=name, port=api_port, scan=scan)
        app_result = self.appify(path, name=name, api_port=api_port,
                                 app_port=app_port, scan=scan, install=install)
        config_result = self.configify(path, name=name, api_port=api_port,
                                       app_port=app_port, scan=scan)

        # init .mod metadata
        mod_dir = os.path.join(path, '.mod')
        os.makedirs(mod_dir, exist_ok=True)
        branch_file = os.path.join(mod_dir, 'branch')
        if not os.path.exists(branch_file):
            with open(branch_file, 'w') as f:
                f.write('main')

        result = {
            'name': name, 'path': path,
            'api_port': api_port, 'app_port': app_port,
            'scan': scan, 'mod': mod_result,
            'server': server_result, 'app': app_result,
            'config': config_result,
        }

        if serve:
            result['serve'] = self.serve(path, name=name,
                                         api_port=api_port, app_port=app_port)

        return result

    # ── scan ──────────────────────────────────────────────────────────

    def scan(self, path):
        """
        Scan a folder and discover python classes, functions, and files.
        Returns a dict describing what's in the folder.
        """
        path = os.path.abspath(os.path.expanduser(path))
        result = {
            'path': path,
            'name': os.path.basename(path),
            'python_files': [],
            'classes': {},
            'functions': {},
            'has_mod': False,
            'has_server': False,
            'has_app': False,
            'has_config': False,
            'files': [],
        }

        for root, dirs, files in os.walk(path):
            # skip hidden/build dirs
            dirs[:] = [d for d in dirs if not d.startswith('.')
                       and d not in ('node_modules', '__pycache__', '.next', 'venv', '.venv')]
            rel_root = os.path.relpath(root, path)

            for f in files:
                rel = os.path.join(rel_root, f) if rel_root != '.' else f
                result['files'].append(rel)

                if f == 'mod.py':
                    result['has_mod'] = True
                if f == 'server.py':
                    result['has_server'] = True
                if f == 'config.json':
                    result['has_config'] = True
                if f == 'package.json' and 'next' in open(os.path.join(root, f)).read():
                    result['has_app'] = True

                if f.endswith('.py') and not f.startswith('_'):
                    result['python_files'].append(rel)
                    try:
                        cls_fns = self._scan_python_file(os.path.join(root, f))
                        for cls_name, methods in cls_fns['classes'].items():
                            result['classes'][f'{rel}:{cls_name}'] = methods
                        for fn_info in cls_fns['functions']:
                            result['functions'][f'{rel}:{fn_info["name"]}'] = fn_info
                    except Exception:
                        pass

        return result

    def _scan_python_file(self, filepath):
        """Extract classes and top-level functions from a python file via AST."""
        import ast
        with open(filepath) as f:
            tree = ast.parse(f.read())

        classes = {}
        functions = []

        for node in ast.iter_child_nodes(tree):
            if isinstance(node, ast.ClassDef):
                methods = []
                for item in node.body:
                    if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        if not item.name.startswith('_'):
                            args = [a.arg for a in item.args.args if a.arg != 'self']
                            methods.append({'name': item.name, 'args': args,
                                            'line': item.lineno})
                classes[node.name] = methods
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                if not node.name.startswith('_'):
                    args = [a.arg for a in node.args.args]
                    functions.append({'name': node.name, 'args': args,
                                      'line': node.lineno})

        return {'classes': classes, 'functions': functions}

    # ── modify: generate mod.py ───────────────────────────────────────

    def modify(self, path, name=None, scan=None):
        """
        Generate a mod.py that wraps all discoverable classes/functions
        in the folder into a single Mod class.
        """
        path = os.path.abspath(os.path.expanduser(path))
        name = name or os.path.basename(path)
        scan = scan or self.scan(path)

        if scan['has_mod']:
            return {'status': 'skipped', 'reason': 'mod.py already exists'}

        imports = []
        methods = []
        init_lines = []

        for key, class_methods in scan['classes'].items():
            rel_file, cls_name = key.split(':')
            module_path = rel_file.replace('/', '.').replace('.py', '')

            imports.append(f'from {module_path} import {cls_name}')
            var_name = f'_{cls_name.lower()}'
            init_lines.append(f'        self.{var_name} = {cls_name}()')

            for method in class_methods:
                mname = method['name']
                args_str = ', '.join(method['args'])
                params = f', {args_str}' if args_str else ''
                kwargs = ', '.join(f'{a}={a}' for a in method['args'])
                kwpass = f', {kwargs}' if kwargs else ''
                methods.append(
                    f'    def {mname}(self{params}, **kw):\n'
                    f'        return self.{var_name}.{mname}({kwargs}{"," if kwargs else ""} **kw)\n'
                )

        # standalone functions
        for key in scan['functions']:
            rel_file, fn_name = key.split(':')
            module_path = rel_file.replace('/', '.').replace('.py', '')
            imports.append(f'from {module_path} import {fn_name}')
            methods.append(
                f'    def {fn_name}(self, *args, **kw):\n'
                f'        return {fn_name}(*args, **kw)\n'
            )

        # build mod.py
        import_block = '\n'.join(sorted(set(imports)))
        init_block = '\n'.join(init_lines) if init_lines else '        pass'
        method_block = '\n'.join(methods) if methods else '    pass\n'

        all_fns = []
        for class_methods in scan['classes'].values():
            all_fns.extend(m['name'] for m in class_methods)
        all_fns.extend(k.split(':')[1] for k in scan['functions'])

        fns_list = ', '.join(f"'{f}'" for f in all_fns)

        content = f'''"""
{name} - auto-generated mod wrapper by appify
"""
import os
import subprocess

{import_block}


class Mod:
    description = "{name} module"
    fns = [{fns_list}]

    def __init__(self, **kwargs):
        self._dir = os.path.dirname(os.path.dirname(__file__))
{init_block}

{method_block}

    def serve(self, api_port=None, app_port=None, dev=True):
        """Start API server and/or Next.js app"""
        results = {{}}
        server_dir = os.path.join(self._dir, 'server')
        app_dir = os.path.join(self._dir, 'app')

        if os.path.exists(server_dir):
            port = api_port or 8000
            cmd = f'uvicorn server:app --host 0.0.0.0 --port {{port}}'
            if dev:
                cmd += ' --reload'
            script = os.path.join(server_dir, '_serve.sh')
            with open(script, 'w') as f:
                f.write(f'#!/bin/bash\\ncd {{server_dir}}\\n{{cmd}}\\n')
            os.chmod(script, 0o755)
            try:
                import mod as m
                pm2 = m.mod('pm.pm2')()
                pm_name = '{name}-api'
                if pm2.exists(pm_name):
                    pm2.kill(pm_name, remove_script=False)
                pm2.start_script(name=pm_name, script_path=script, cwd=server_dir, interpreter='bash')
                results['api'] = {{'status': 'running', 'port': port, 'manager': 'pm2'}}
            except Exception:
                proc = subprocess.Popen(['bash', script], cwd=server_dir)
                results['api'] = {{'status': 'running', 'port': port, 'pid': proc.pid}}

        if os.path.exists(app_dir):
            port = app_port or 3000
            if not os.path.exists(os.path.join(app_dir, 'node_modules')):
                subprocess.run(['npm', 'install'], cwd=app_dir, capture_output=True)
            cmd = f'npm run {{"dev" if dev else "start"}} -- -p {{port}}'
            script = os.path.join(app_dir, '_serve.sh')
            with open(script, 'w') as f:
                api_url = f'http://localhost:{{api_port or 8000}}'
                f.write(f'#!/bin/bash\\ncd {{app_dir}}\\nexport NEXT_PUBLIC_API_URL={{api_url}}\\n{{cmd}}\\n')
            os.chmod(script, 0o755)
            try:
                import mod as m
                pm2 = m.mod('pm.pm2')()
                pm_name = '{name}-app'
                if pm2.exists(pm_name):
                    pm2.kill(pm_name, remove_script=False)
                pm2.start_script(name=pm_name, script_path=script, cwd=app_dir, interpreter='bash')
                results['app'] = {{'status': 'running', 'port': port, 'manager': 'pm2'}}
            except Exception:
                proc = subprocess.Popen(['bash', script], cwd=app_dir)
                results['app'] = {{'status': 'running', 'port': port, 'pid': proc.pid}}

        return results

    def test(self):
        return {{'fns': self.fns, 'status': 'ok'}}
'''

        mod_dir = os.path.join(path, name)
        os.makedirs(mod_dir, exist_ok=True)
        mod_path = os.path.join(mod_dir, 'mod.py')
        with open(mod_path, 'w') as f:
            f.write(content)

        # ensure __init__.py
        init_path = os.path.join(mod_dir, '__init__.py')
        if not os.path.exists(init_path):
            with open(init_path, 'w') as f:
                f.write('')

        return {'status': 'created', 'path': mod_path, 'fns': all_fns}

    # ── serverify: generate server/ ───────────────────────────────────

    def serverify(self, path, name=None, port=8000, scan=None):
        """
        Generate a FastAPI server.py that exposes all mod functions as endpoints.
        """
        path = os.path.abspath(os.path.expanduser(path))
        name = name or os.path.basename(path)
        scan = scan or self.scan(path)

        server_dir = os.path.join(path, 'server')
        os.makedirs(server_dir, exist_ok=True)

        if scan['has_server']:
            return {'status': 'skipped', 'reason': 'server/ already exists'}

        # collect all public fns
        all_fns = []
        for class_methods in scan['classes'].values():
            all_fns.extend(m['name'] for m in class_methods)
        all_fns.extend(k.split(':')[1] for k in scan['functions'])

        # build dynamic routes
        routes = []
        for fn_name in all_fns:
            routes.append(f'''
@app.post("/{fn_name}")
def route_{fn_name}(req: dict = {{}}):
    mod = get_mod()
    result = mod.{fn_name}(**req)
    return {{"result": result}}
''')

        route_block = '\n'.join(routes)

        content = f'''"""
{name} server - auto-generated by appify
"""
import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

app = FastAPI(title="{name} API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_mod = None

def get_mod():
    global _mod
    if _mod is None:
        from {name}.mod import Mod
        _mod = Mod()
    return _mod


@app.get("/health")
def health():
    return {{"status": "ok", "module": "{name}"}}

@app.get("/schema")
def schema():
    mod = get_mod()
    return {{"fns": mod.fns}}

@app.post("/forward")
def forward(req: dict = {{}}):
    """Generic endpoint - call any function by name"""
    fn = req.pop("fn", None)
    if fn is None:
        return {{"error": "missing fn"}}
    mod = get_mod()
    if not hasattr(mod, fn):
        return {{"error": f"unknown fn: {{fn}}"}}
    result = getattr(mod, fn)(**req)
    return {{"result": result}}
{route_block}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", {port}))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
'''

        server_path = os.path.join(server_dir, 'server.py')
        with open(server_path, 'w') as f:
            f.write(content)

        return {'status': 'created', 'path': server_path,
                'port': port, 'endpoints': [f'/{fn}' for fn in all_fns]}

    # ── appify: generate Next.js app ──────────────────────────────────

    def appify(self, path, name=None, api_port=8000, app_port=3000,
               scan=None, install=True):
        """
        Generate a Next.js app with a UI that calls all mod endpoints.
        """
        path = os.path.abspath(os.path.expanduser(path))
        name = name or os.path.basename(path)
        scan = scan or self.scan(path)

        app_dir = os.path.join(path, 'app')

        if scan['has_app']:
            return {'status': 'skipped', 'reason': 'app/ already exists'}

        os.makedirs(os.path.join(app_dir, 'app'), exist_ok=True)

        # collect fns for UI
        all_fns = []
        fn_details = []
        for class_methods in scan['classes'].values():
            for method in class_methods:
                all_fns.append(method['name'])
                fn_details.append(method)
        for key in scan['functions']:
            fn_name = key.split(':')[1]
            all_fns.append(fn_name)
            fn_details.append({'name': fn_name, 'args': []})

        # build fn buttons/forms for page.tsx
        fn_cards = []
        for fn in fn_details:
            args_inputs = ''
            args_json = ''
            if fn['args']:
                inputs = []
                json_parts = []
                for arg in fn['args']:
                    inputs.append(
                        f'            <input\n'
                        f'              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"\n'
                        f'              placeholder="{arg}"\n'
                        f'              id="{fn["name"]}_{arg}"\n'
                        f'            />'
                    )
                    json_parts.append(
                        f'        {arg}: (document.getElementById("{fn["name"]}_{arg}") as HTMLInputElement)?.value || ""'
                    )
                args_inputs = '\n'.join(inputs)
                args_json = ',\n'.join(json_parts)

            fn_cards.append(f'''
        <div key="{fn['name']}" className="glass rounded-lg p-4">
          <h3 className="text-sm font-mono text-blue-400 mb-2">{fn['name']}</h3>
{args_inputs}
          <button
            className="mt-2 w-full bg-blue-600 hover:bg-blue-500 text-white rounded px-3 py-2 text-sm font-mono transition"
            onClick={{async () => {{
              setLoading('{fn["name"]}')
              try {{
                const body = {{
{args_json}
                }}
                const res = await fetch(`${{API_URL}}/{fn['name']}`, {{
                  method: 'POST',
                  headers: {{ 'Content-Type': 'application/json' }},
                  body: JSON.stringify(body),
                }})
                const data = await res.json()
                setResult({{ fn: '{fn["name"]}', ...data }})
              }} catch (e: any) {{
                setResult({{ fn: '{fn["name"]}', error: e.message }})
              }}
              setLoading(null)
            }}}}
          >
            {fn['name']}
          </button>
        </div>''')

        fn_cards_block = '\n'.join(fn_cards) if fn_cards else '''
        <div className="glass rounded-lg p-4 text-zinc-500">
          No functions discovered. Add Python files to generate endpoints.
        </div>'''

        # package.json
        pkg = {
            'name': name,
            'version': '1.0.0',
            'scripts': {
                'dev': f'next dev -p {app_port}',
                'build': 'next build',
                'start': f'next start -p {app_port}',
            },
            'dependencies': {
                'next': '14.0.4',
                'react': '^18.2.0',
                'react-dom': '^18.2.0',
            },
            'devDependencies': {
                'typescript': '^5.3.3',
                '@types/node': '^20.10.0',
                '@types/react': '^18.2.0',
                'tailwindcss': '^3.3.6',
                'postcss': '^8.4.32',
                'autoprefixer': '^10.4.16',
            }
        }
        with open(os.path.join(app_dir, 'package.json'), 'w') as f:
            json.dump(pkg, f, indent=2)

        # tsconfig.json
        tsconfig = {
            'compilerOptions': {
                'target': 'es2017',
                'lib': ['dom', 'dom.iterable', 'esnext'],
                'allowJs': True, 'skipLibCheck': True, 'strict': True,
                'noEmit': True, 'esModuleInterop': True,
                'module': 'esnext', 'moduleResolution': 'bundler',
                'resolveJsonModule': True, 'isolatedModules': True,
                'jsx': 'preserve', 'incremental': True,
                'plugins': [{'name': 'next'}],
                'paths': {'@/*': ['./*']},
            },
            'include': ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
            'exclude': ['node_modules'],
        }
        with open(os.path.join(app_dir, 'tsconfig.json'), 'w') as f:
            json.dump(tsconfig, f, indent=2)

        # next.config.js
        with open(os.path.join(app_dir, 'next.config.js'), 'w') as f:
            f.write('/** @type {import("next").NextConfig} */\n'
                    'const nextConfig = {\n'
                    '  reactStrictMode: true,\n'
                    '  output: "standalone",\n'
                    '}\n'
                    'module.exports = nextConfig\n')

        # postcss.config.js
        with open(os.path.join(app_dir, 'postcss.config.js'), 'w') as f:
            f.write('module.exports = {\n'
                    '  plugins: { tailwindcss: {}, autoprefixer: {} },\n'
                    '}\n')

        # tailwind.config.ts
        with open(os.path.join(app_dir, 'tailwind.config.ts'), 'w') as f:
            f.write('import type { Config } from "tailwindcss"\n\n'
                    'const config: Config = {\n'
                    '  content: ["./app/**/*.{js,ts,jsx,tsx}"],\n'
                    '  theme: { extend: {} },\n'
                    '  plugins: [],\n'
                    '}\n'
                    'export default config\n')

        # app/globals.css
        with open(os.path.join(app_dir, 'app', 'globals.css'), 'w') as f:
            f.write('@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n'
                    ':root { --bg: #0a0a0a; --fg: #ededed; --accent: #3b82f6; }\n'
                    'body { background: var(--bg); color: var(--fg); '
                    'font-family: system-ui, -apple-system, sans-serif; }\n'
                    '.glass { background: rgba(255,255,255,0.05); '
                    'backdrop-filter: blur(10px); '
                    'border: 1px solid rgba(255,255,255,0.1); }\n')

        # app/config.ts
        with open(os.path.join(app_dir, 'app', 'config.ts'), 'w') as f:
            f.write(f'export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:{api_port}"\n')

        # app/layout.tsx
        with open(os.path.join(app_dir, 'app', 'layout.tsx'), 'w') as f:
            f.write(f'''import type {{ Metadata }} from "next"
import "./globals.css"

export const metadata: Metadata = {{
  title: "{name}",
  description: "{name} - powered by mod",
}}

export default function RootLayout({{ children }}: {{ children: React.ReactNode }}) {{
  return (
    <html lang="en">
      <body>{{children}}</body>
    </html>
  )
}}
''')

        # app/page.tsx
        with open(os.path.join(app_dir, 'app', 'page.tsx'), 'w') as f:
            f.write(f'''"use client"
import {{ useState, useEffect }} from "react"
import {{ API_URL }} from "./config"

export default function Home() {{
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [health, setHealth] = useState<any>(null)

  useEffect(() => {{
    fetch(`${{API_URL}}/health`).then(r => r.json()).then(setHealth).catch(() => null)
  }}, [])

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-mono font-bold">{name}</h1>
        <div className={{`text-xs font-mono px-2 py-1 rounded ${{health ? "bg-green-900 text-green-400" : "bg-red-900 text-red-400"}}`}}>
          {{health ? "connected" : "offline"}}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
{fn_cards_block}
      </div>

      {{result && (
        <div className="glass rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-mono text-zinc-400">result: {{result.fn}}</h2>
            <button onClick={{() => setResult(null)}} className="text-zinc-500 hover:text-white text-xs">clear</button>
          </div>
          <pre className="text-sm font-mono text-green-400 whitespace-pre-wrap overflow-auto max-h-96">
            {{JSON.stringify(result, null, 2)}}
          </pre>
        </div>
      )}}
    </main>
  )
}}
''')

        result = {'status': 'created', 'path': app_dir,
                  'port': app_port, 'fns': all_fns}

        if install:
            try:
                subprocess.run(['npm', 'install', '--prefer-offline'],
                               cwd=app_dir, capture_output=True, timeout=120)
                result['installed'] = True
            except Exception as e:
                result['installed'] = False
                result['install_error'] = str(e)

        return result

    # ── configify: generate config.json ───────────────────────────────

    def configify(self, path, name=None, api_port=8000, app_port=3000, scan=None):
        """Generate config.json for the module."""
        path = os.path.abspath(os.path.expanduser(path))
        name = name or os.path.basename(path)
        scan = scan or self.scan(path)

        config_path = os.path.join(path, 'config.json')
        if scan['has_config']:
            return {'status': 'skipped', 'reason': 'config.json already exists'}

        all_fns = []
        for class_methods in scan['classes'].values():
            all_fns.extend(cm['name'] for cm in class_methods)
        all_fns.extend(k.split(':')[1] for k in scan['functions'])

        config = {
            'name': name,
            'version': '1.0.0',
            'description': f'{name} module',
            'fns': all_fns,
            'server': {
                'port': api_port,
                'entrypoint': f'uvicorn server.server:app --host 0.0.0.0 --port {api_port}',
            },
            'app': {
                'port': app_port,
                'framework': 'nextjs',
            }
        }

        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)

        return {'status': 'created', 'path': config_path}

    # ── serve ─────────────────────────────────────────────────────────

    def serve(self, path, name=None, api_port=None, app_port=None, dev=True):
        """Start the API server and Next.js app for an appified folder."""
        path = os.path.abspath(os.path.expanduser(path))
        name = name or os.path.basename(path)
        results = {}

        # load config for ports
        config_path = os.path.join(path, 'config.json')
        if os.path.exists(config_path):
            with open(config_path) as f:
                cfg = json.load(f)
            api_port = api_port or cfg.get('server', {}).get('port', 8000)
            app_port = app_port or cfg.get('app', {}).get('port', 3000)
        api_port = api_port or 8000
        app_port = app_port or 3000

        server_dir = os.path.join(path, 'server')
        app_dir = os.path.join(path, 'app')

        if os.path.exists(server_dir):
            cmd = f'uvicorn server:app --host 0.0.0.0 --port {api_port}'
            if dev:
                cmd += ' --reload'
            script = os.path.join(server_dir, '_serve.sh')
            with open(script, 'w') as f:
                f.write(f'#!/bin/bash\ncd {server_dir}\n{cmd}\n')
            os.chmod(script, 0o755)
            try:
                pm2 = m.mod('pm.pm2')()
                pm_name = f'{name}-api'
                if pm2.exists(pm_name):
                    pm2.kill(pm_name, remove_script=False)
                pm2.start_script(name=pm_name, script_path=script,
                                 cwd=server_dir, interpreter='bash')
                results['api'] = {'status': 'running', 'port': api_port, 'manager': 'pm2'}
            except Exception:
                proc = subprocess.Popen(['bash', script], cwd=server_dir)
                results['api'] = {'status': 'running', 'port': api_port, 'pid': proc.pid}

        if os.path.exists(app_dir):
            if not os.path.exists(os.path.join(app_dir, 'node_modules')):
                subprocess.run(['npm', 'install'], cwd=app_dir, capture_output=True)
            cmd = f'npm run {"dev" if dev else "start"} -- -p {app_port}'
            script = os.path.join(app_dir, '_serve.sh')
            with open(script, 'w') as f:
                f.write(f'#!/bin/bash\ncd {app_dir}\n'
                        f'export NEXT_PUBLIC_API_URL=http://localhost:{api_port}\n'
                        f'{cmd}\n')
            os.chmod(script, 0o755)
            try:
                pm2 = m.mod('pm.pm2')()
                pm_name = f'{name}-app'
                if pm2.exists(pm_name):
                    pm2.kill(pm_name, remove_script=False)
                pm2.start_script(name=pm_name, script_path=script,
                                 cwd=app_dir, interpreter='bash')
                results['app'] = {'status': 'running', 'port': app_port, 'manager': 'pm2'}
            except Exception:
                proc = subprocess.Popen(['bash', script], cwd=app_dir)
                results['app'] = {'status': 'running', 'port': app_port, 'pid': proc.pid}

        return results

    def kill(self, path=None, name=None):
        """Stop services for an appified folder."""
        name = name or os.path.basename(os.path.abspath(path or '.'))
        results = {}
        try:
            pm2 = m.mod('pm.pm2')()
            for svc in ('api', 'app'):
                pm_name = f'{name}-{svc}'
                if pm2.exists(pm_name):
                    pm2.kill(pm_name)
                    results[svc] = 'killed'
        except Exception as e:
            results['error'] = str(e)
        return results

    def test(self, path=None):
        """Test appify by scanning a temp folder."""
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            # create a sample python file
            with open(os.path.join(tmp, 'calculator.py'), 'w') as f:
                f.write('class Calculator:\n'
                        '    def add(self, a, b):\n'
                        '        return a + b\n'
                        '    def multiply(self, a, b):\n'
                        '        return a * b\n')

            scan = self.scan(tmp)
            assert len(scan['classes']) > 0, 'should discover classes'
            assert len(scan['python_files']) > 0, 'should find python files'

            mod_result = self.modify(tmp, name='calculator', scan=scan)
            assert mod_result['status'] == 'created'

            server_result = self.serverify(tmp, name='calculator', scan=scan)
            assert server_result['status'] == 'created'

            return {
                'success': True,
                'scan': scan,
                'mod': mod_result,
                'server': server_result,
            }
