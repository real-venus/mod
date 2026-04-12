
import os
import ast
import json
import subprocess
from typing import Dict, List, Optional, Any
import mod as m
print = m.print


class Modify:
    """
    Applies suggestions to orbit modules via the agent.
    Works with the suggest module — takes suggestions and executes
    modifications through the agent's tool-calling loop.
    Also converts arbitrary folders into mod protocol modules via Claude CLI.
    """

    goal = """
        You are a code modifier for the mod framework.
        You receive a suggestion with a target module and you apply it precisely.
        Read the target file first, understand the context, then make the edit.
        Make minimal, focused changes — do not refactor unrelated code.
        Preserve existing style and patterns.
        When finished, use the finish tool with a summary of what changed.
    """

    tools = ['cmd', 'read_file', 'write_file', 'edit_file']

    _avoid = frozenset({
        '__pycache__', '.git', 'node_modules', '.next', 'venv',
        '.venv', 'target', '.mod', '.history', 'dist', 'build',
    })

    def __init__(self, model: str = 'model.openrouter', **kwargs):
        self._agent = None

    @property
    def agent(self):
        if self._agent is None:
            self._agent = m.mod('agent')(
                goal=self.goal,
                skills=self.tools,
            )
        return self._agent

    def forward(self,
                mod: str = None,
                path: str = None,
                suggestion: dict = None,
                query: str = None,
                model: str = 'anthropic/claude-sonnet-4-5-20250929',
                steps: int = 5,
                safety: bool = True,
                **kwargs) -> Dict[str, Any]:
        """
        Apply a modification to a target module.

        Args:
            mod: module name
            path: explicit path to module directory
            suggestion: a suggestion dict from the suggest module (has title, description, file, etc.)
            query: freeform modification instruction (alternative to suggestion)
            model: LLM model to use
            steps: max agent steps
            safety: require user confirmation (default True for modifications)
        """
        path = path or m.dp(mod) if mod else path
        if not path:
            return {'error': 'provide mod or path'}

        prompt = self._build_prompt(path, mod, suggestion=suggestion, query=query)

        result = self.agent.forward(
            query=prompt,
            path=path,
            mod=mod,
            model=model,
            steps=steps,
            safety=safety,
            **kwargs
        )

        return {
            'mod': mod or os.path.basename(path),
            'path': path,
            'suggestion': suggestion,
            'result': result,
            'applied': self._check_applied(result),
        }

    def apply_suggestions(self,
                          mod: str = None,
                          path: str = None,
                          suggestions: list = None,
                          model: str = 'anthropic/claude-sonnet-4-5-20250929',
                          safety: bool = True,
                          max_apply: int = 5,
                          **kwargs) -> List[Dict[str, Any]]:
        """
        Apply multiple suggestions from the suggest module.

        Args:
            mod: module name
            path: explicit path
            suggestions: list of suggestion dicts from suggest module
            model: LLM model
            safety: require confirmation per suggestion
            max_apply: max suggestions to apply in one batch
        """
        suggestions = suggestions or []
        results = []
        for i, suggestion in enumerate(suggestions[:max_apply]):
            print(f"[modify] Applying {i+1}/{len(suggestions)}: {suggestion.get('title', 'untitled')}", color='cyan')
            result = self.forward(
                mod=mod,
                path=path,
                suggestion=suggestion,
                model=model,
                safety=safety,
                **kwargs
            )
            results.append(result)
        return results

    def suggest_and_apply(self,
                          mod: str = None,
                          path: str = None,
                          focus: str = None,
                          model: str = 'anthropic/claude-sonnet-4-5-20250929',
                          safety: bool = True,
                          max_apply: int = 3,
                          **kwargs) -> Dict[str, Any]:
        """
        Run suggest on a module, then apply the top suggestions.

        Args:
            mod: module name
            path: explicit path
            focus: suggestion category filter
            model: LLM model
            safety: require confirmation
            max_apply: max suggestions to apply
        """
        suggest = m.mod('suggest')()
        suggest_result = suggest.forward(mod=mod, path=path, focus=focus, model=model)
        suggestions = suggest_result.get('suggestions', [])

        # sort by priority if available
        suggestions = sorted(suggestions, key=lambda s: s.get('priority', 5) if isinstance(s, dict) else 5)

        applied = []
        if suggestions:
            applied = self.apply_suggestions(
                mod=mod,
                path=path,
                suggestions=suggestions[:max_apply],
                model=model,
                safety=safety,
                **kwargs
            )

        return {
            'mod': mod or os.path.basename(path or ''),
            'suggestions': suggestions,
            'applied': applied,
            'total_suggestions': len(suggestions),
            'total_applied': len(applied),
        }

    def modify_folder(self,
                      path: str,
                      name: str = None,
                      model: str = 'sonnet',
                      description: str = None,
                      background: bool = False,
                      **kwargs) -> Dict[str, Any]:
        """
        Turn any folder into a mod protocol module by generating a mod.py class file.

        Uses Claude CLI to analyze the folder contents and produce an intelligent
        mod.py that wraps the folder's functionality into the standard mod interface.

        Args:
            path: folder path to convert
            name: module name (defaults to folder basename)
            model: claude model to use
            description: optional description override
            background: if True, submit as background job via claude module
        """
        path = os.path.abspath(os.path.expanduser(path))
        if not os.path.isdir(path):
            return {'error': f'Not a directory: {path}'}

        name = name or os.path.basename(path.rstrip('/'))
        scan = self._scan_folder(path)

        # determine anchor placement: orbit pattern uses <name>/<name>/mod.py
        # if folder already has a <name>/ subdir, put mod.py there
        # otherwise create the subdir
        anchor_dir = os.path.join(path, name)
        anchor_path = os.path.join(anchor_dir, 'mod.py')

        # check if mod.py already exists at either location
        if os.path.exists(anchor_path):
            return {'status': 'skipped', 'reason': f'mod.py already exists at {anchor_path}'}
        flat_anchor = os.path.join(path, 'mod.py')
        if os.path.exists(flat_anchor):
            return {'status': 'skipped', 'reason': f'mod.py already exists at {flat_anchor}'}

        prompt = self._build_modpy_prompt(path, name, scan, description)

        print(f"[modify] Generating mod.py for {name} at {path}", color='cyan')

        if background:
            claude = m.mod('claude')()
            return claude.forward(
                prompt,
                path=path,
                model=f'anthropic/claude-{model}',
                background=True,
                **kwargs
            )

        # run claude CLI directly
        result = self._run_claude(prompt, path=path, model=model)

        if os.path.exists(anchor_path) or os.path.exists(flat_anchor):
            final_path = anchor_path if os.path.exists(anchor_path) else flat_anchor
            print(f"[modify] Created mod.py at {final_path}", color='green')
            return {
                'status': 'created',
                'name': name,
                'path': final_path,
                'scan': scan,
            }

        return {
            'status': 'attempted',
            'name': name,
            'path': path,
            'scan': scan,
            'output': result,
        }

    def _scan_folder(self, path: str) -> Dict[str, Any]:
        """Scan a folder to understand its contents for mod.py generation."""
        scan = {
            'files': [],
            'python_files': [],
            'classes': {},
            'functions': {},
            'has_readme': False,
            'has_package_json': False,
            'has_requirements': False,
            'has_pyproject': False,
            'has_cargo': False,
            'readme_text': '',
            'project_type': 'generic',
        }

        for root, dirs, files in os.walk(path):
            dirs[:] = [d for d in dirs if d not in self._avoid and not d.startswith('.')]
            rel_root = os.path.relpath(root, path)

            for f in files:
                rel = os.path.join(rel_root, f) if rel_root != '.' else f
                scan['files'].append(rel)

                if f.lower().startswith('readme'):
                    scan['has_readme'] = True
                    try:
                        with open(os.path.join(root, f)) as fh:
                            scan['readme_text'] = fh.read()[:2000]
                    except Exception:
                        pass
                elif f == 'package.json':
                    scan['has_package_json'] = True
                    scan['project_type'] = 'node'
                elif f == 'requirements.txt':
                    scan['has_requirements'] = True
                    scan['project_type'] = 'python'
                elif f == 'pyproject.toml':
                    scan['has_pyproject'] = True
                    scan['project_type'] = 'python'
                elif f == 'Cargo.toml':
                    scan['has_cargo'] = True
                    scan['project_type'] = 'rust'

                if f.endswith('.py') and not f.startswith('_'):
                    scan['python_files'].append(rel)
                    try:
                        self._extract_python(os.path.join(root, f), rel, scan)
                    except Exception:
                        pass

        return scan

    def _extract_python(self, filepath: str, rel: str, scan: dict):
        """Extract classes and functions from a python file via AST."""
        with open(filepath) as f:
            tree = ast.parse(f.read())
        for node in ast.iter_child_nodes(tree):
            if isinstance(node, ast.ClassDef):
                methods = []
                for item in node.body:
                    if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        if not item.name.startswith('_'):
                            args = [a.arg for a in item.args.args if a.arg != 'self']
                            methods.append({'name': item.name, 'args': args})
                scan['classes'][f'{rel}:{node.name}'] = methods
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                if not node.name.startswith('_'):
                    args = [a.arg for a in node.args.args]
                    scan['functions'][f'{rel}:{node.name}'] = {'name': node.name, 'args': args}

    def _build_modpy_prompt(self, path: str, name: str, scan: dict,
                            description: str = None) -> str:
        """Build the Claude prompt for generating mod.py."""
        # Load protocol reference from skill.md
        skill_path = os.path.join(os.path.dirname(__file__), '..', 'skill.md')
        protocol_text = ''
        if os.path.exists(skill_path):
            with open(skill_path) as f:
                protocol_text = f.read()

        parts = [f"""You are generating a mod.py class file to interface the folder at {path} as a module in the mod protocol.

{"## Mod Protocol Reference\n" + protocol_text if protocol_text else '''The mod protocol pattern:
- Every module has a `class Mod` in a mod.py file
- The class uses `import mod as m` to access framework utilities
- Key interface: `forward()` as main entry, plus domain-specific methods
- `__init__` takes **kwargs, sets `self._dir = os.path.dirname(__file__)`
- Include `test()`, `health()`, and `serve()` if server components exist
'''}

Module name: {name}
Target directory: {path}
"""]

        if description:
            parts.append(f"Description: {description}")

        if scan['readme_text']:
            parts.append(f"\nREADME content (first 2000 chars):\n{scan['readme_text']}")

        parts.append(f"\nProject type: {scan['project_type']}")
        parts.append(f"Total files: {len(scan['files'])}")

        if scan['python_files']:
            parts.append(f"\nPython files found: {', '.join(scan['python_files'][:20])}")

        if scan['classes']:
            parts.append("\nDiscovered classes:")
            for key, methods in list(scan['classes'].items())[:10]:
                method_names = [m['name'] for m in methods]
                parts.append(f"  {key}: {', '.join(method_names)}")

        if scan['functions']:
            parts.append("\nDiscovered functions:")
            for key in list(scan['functions'].keys())[:10]:
                parts.append(f"  {key}")

        parts.append(f"""
INSTRUCTIONS:
1. Create the directory {os.path.join(path, name)} if it doesn't exist
2. Write a mod.py file at {os.path.join(path, name, 'mod.py')}
3. The mod.py should:
   - Import and wrap the folder's existing functionality into a clean Mod class
   - Have a `forward()` method as the main entry point
   - Expose discovered classes/functions as methods on the Mod class
   - Include `description` and `fns` attributes
   - Include `info()` and `test()` methods
   - If there's a server/API component, include `serve()`
   - Use `import mod as m` for framework access where needed
   - Keep it clean and minimal — don't over-engineer
4. Also create a config.json at {path}/config.json with module metadata (name, version, description, fns list)
5. If the folder has no Python code, create a simpler mod.py that provides file listing, readme access, and basic project management (install, build, etc. based on project type)
""")

        return '\n'.join(parts)

    def _run_claude(self, prompt: str, path: str = None,
                    model: str = 'sonnet') -> str:
        """Run Claude CLI directly."""
        result = subprocess.run(
            ['which', 'claude'], capture_output=True, text=True
        )
        if result.returncode != 0:
            raise RuntimeError("claude CLI not found")
        claude = result.stdout.strip()

        cmd = [claude, '--print', '--model', model, '--output-format', 'text',
               '--dangerously-skip-permissions', prompt]
        proc = subprocess.run(
            cmd, cwd=path, capture_output=True, text=True,
            env=os.environ.copy(), timeout=300
        )
        if proc.returncode != 0:
            raise RuntimeError(f"Claude CLI error: {proc.stderr}")
        return proc.stdout

    def _build_prompt(self, path: str, mod: str = None,
                      suggestion: dict = None, query: str = None) -> str:
        """Build the modification prompt."""
        parts = [f"Modify the module at {path}"]

        if suggestion:
            parts.append(f"\nSuggestion to apply:")
            parts.append(f"  Title: {suggestion.get('title', 'N/A')}")
            parts.append(f"  Category: {suggestion.get('category', 'N/A')}")
            parts.append(f"  Priority: {suggestion.get('priority', 'N/A')}")
            parts.append(f"  Description: {suggestion.get('description', 'N/A')}")
            if suggestion.get('file'):
                parts.append(f"  Target file: {suggestion['file']}")
            if suggestion.get('diff'):
                parts.append(f"  Suggested diff:\n{suggestion['diff']}")
        elif query:
            parts.append(f"\nInstruction: {query}")

        parts.append(
            "\nRead the target file first, then make minimal focused changes. "
            "Finish with a summary of what you changed."
        )
        return '\n'.join(parts)

    def _check_applied(self, result: list) -> bool:
        """Check if the agent successfully applied a change."""
        if not result:
            return False
        for step in result:
            if isinstance(step, dict) and step.get('error'):
                return False
        return True

    def ensure_serve(self, mod: str = None, fix: bool = True) -> Dict[str, Any]:
        """
        Ensure modules with scripts/start.sh have a serve() method in their mod.py.

        Scans orbit modules (or a specific one) for start.sh without serve in fns.
        If fix=True, injects a serve() method into the module's mod.py and adds
        'serve' to config.json fns.

        References the mod protocol skill.md for compliance.
        """
        orbit_dir = os.path.dirname(m.dp('modify'))
        results = {'has_serve': [], 'added': [], 'skipped': [], 'errors': []}

        if mod:
            modules = [mod]
        else:
            modules = sorted(os.listdir(orbit_dir)) if os.path.isdir(orbit_dir) else []

        # Load protocol reference
        skill_path = os.path.join(os.path.dirname(__file__), '..', 'skill.md')
        protocol_ref = ''
        if os.path.exists(skill_path):
            with open(skill_path) as f:
                protocol_ref = f.read()

        for name in modules:
            if mod:
                mod_dir = m.dp(name)
            else:
                mod_dir = os.path.join(orbit_dir, name)

            if not os.path.isdir(mod_dir):
                continue

            # Check for start.sh
            start_sh = os.path.join(mod_dir, 'scripts', 'start.sh')
            if not os.path.exists(start_sh):
                results['skipped'].append({'name': name, 'reason': 'no scripts/start.sh'})
                continue

            # Check config.json for serve in fns
            cfg_path = os.path.join(mod_dir, 'config.json')
            cfg = {}
            if os.path.exists(cfg_path):
                try:
                    with open(cfg_path) as f:
                        cfg = json.load(f)
                except Exception:
                    pass

            fns = cfg.get('fns', [])
            if 'serve' in fns:
                results['has_serve'].append({'name': name})
                continue

            if not fix:
                results['added'].append({'name': name, 'status': 'needs_serve'})
                continue

            # Find the module's mod.py
            mod_py = os.path.join(mod_dir, name, 'mod.py')
            if not os.path.exists(mod_py):
                # Try flat layout
                mod_py = os.path.join(mod_dir, 'mod.py')
            if not os.path.exists(mod_py):
                results['skipped'].append({'name': name, 'reason': 'no mod.py found'})
                continue

            # Read ports from config
            port = cfg.get('port')
            app_port = cfg.get('app_port')
            mod_name = cfg.get('name', name)

            # Generate serve() method
            serve_code = self._generate_serve(mod_name, port, app_port)

            try:
                # Inject serve() into mod.py
                with open(mod_py) as f:
                    content = f.read()

                if 'def serve(' in content:
                    results['has_serve'].append({'name': name, 'note': 'serve exists in code but not in fns'})
                    # Just add to fns
                    if cfg and 'serve' not in fns:
                        fns.append('serve')
                        cfg['fns'] = fns
                        with open(cfg_path, 'w') as f:
                            json.dump(cfg, f, indent=2)
                            f.write('\n')
                    continue

                # Find the last method in the class to append after
                # Insert before the last line of the file (or before if __name__)
                lines = content.rstrip().split('\n')
                insert_idx = len(lines)

                # Find a good insertion point: before if __name__ or at end
                for i, line in enumerate(lines):
                    if line.strip().startswith('if __name__'):
                        insert_idx = i
                        break

                lines.insert(insert_idx, serve_code)
                with open(mod_py, 'w') as f:
                    f.write('\n'.join(lines) + '\n')

                # Add serve to config fns
                if cfg:
                    if 'serve' not in fns:
                        fns.append('serve')
                        cfg['fns'] = fns
                    with open(cfg_path, 'w') as f:
                        json.dump(cfg, f, indent=2)
                        f.write('\n')

                results['added'].append({'name': name, 'mod_py': mod_py, 'status': 'added'})
                print(f'[modify] Added serve() to {name}', color='green')

            except Exception as e:
                results['errors'].append({'name': name, 'error': str(e)})

        print(f'[modify] ensure_serve: {len(results["has_serve"])} have serve, '
              f'{len(results["added"])} added, {len(results["skipped"])} skipped',
              color='cyan')
        return results

    def _generate_serve(self, name: str, port: int = None, app_port: int = None) -> str:
        """Generate a serve() method body following mod protocol."""
        return f'''
    def serve(self, api_port=None, app_port=None):
        """Start API server and app from config."""
        import subprocess
        from pathlib import Path

        config = getattr(self, '_config', {{}})
        api_port = api_port or config.get('port') or {port or 'None'}
        app_port = app_port or config.get('app_port') or {app_port or 'None'}
        root = os.path.join(os.path.dirname(__file__), '..')
        log_dir = Path(f'/tmp/{name}')
        log_dir.mkdir(parents=True, exist_ok=True)

        for p in [api_port, app_port]:
            if p:
                subprocess.run(f'lsof -ti:{{p}} | xargs kill -9', shell=True, capture_output=True)

        results = {{}}

        server_dir = os.path.join(root, 'server')
        if os.path.exists(os.path.join(server_dir, 'server.py')) and api_port:
            env = os.environ.copy()
            env['PYTHONPATH'] = os.path.join(root, '..', '..', '..')
            subprocess.Popen(
                ['python3', '-m', 'uvicorn', 'server:app',
                 '--host', '0.0.0.0', '--port', str(api_port), '--reload'],
                cwd=server_dir, env=env,
                stdout=open(log_dir / 'api.log', 'w'),
                stderr=subprocess.STDOUT,
            )
            results['api'] = f'http://localhost:{{api_port}}'

        app_dir = os.path.join(root, 'app')
        if os.path.exists(os.path.join(app_dir, 'package.json')) and app_port:
            subprocess.Popen(
                ['npx', 'next', 'dev', '-p', str(app_port)],
                cwd=app_dir,
                stdout=open(log_dir / 'app.log', 'w'),
                stderr=subprocess.STDOUT,
            )
            results['app'] = f'http://localhost:{{app_port}}'

        return results
'''

    def ensure_urls(self, mod: str = None, fix: bool = True, host: str = 'localhost') -> Dict[str, Any]:
        """
        Ensure modules have compliant urls map in config.json (mod protocol).

        Scans all orbit modules (or a specific one) that have port/app_port
        and ensures they have a proper urls: {api, app} map.

        Args:
            mod: specific module name to check (None = all orbit modules)
            fix: if True, write missing urls into config.json
            host: hostname for generated URLs (default: localhost)

        Returns:
            dict with compliant, fixed, and skipped module lists
        """
        orbit_dir = os.path.dirname(m.dp('modify'))
        results = {'compliant': [], 'fixed': [], 'skipped': [], 'errors': []}

        if mod:
            modules = [mod]
        else:
            modules = sorted(os.listdir(orbit_dir)) if os.path.isdir(orbit_dir) else []

        for name in modules:
            if mod:
                mod_dir = m.dp(name)
            else:
                mod_dir = os.path.join(orbit_dir, name)

            cfg_path = os.path.join(mod_dir, 'config.json')
            if not os.path.exists(cfg_path):
                results['skipped'].append({'name': name, 'reason': 'no config.json'})
                continue

            try:
                with open(cfg_path) as f:
                    cfg = json.load(f)
            except Exception as e:
                results['errors'].append({'name': name, 'error': str(e)})
                continue

            port = cfg.get('port')
            app_port = cfg.get('app_port')

            # Skip modules without any port defined
            if not port and not app_port:
                results['skipped'].append({'name': name, 'reason': 'no port'})
                continue

            urls = cfg.get('urls', {})
            has_api = isinstance(urls, dict) and urls.get('api')
            has_app = isinstance(urls, dict) and urls.get('app')

            if has_api and has_app:
                results['compliant'].append({
                    'name': name,
                    'urls': urls,
                })
                continue

            # Needs fixing
            if not fix:
                results['fixed'].append({
                    'name': name,
                    'status': 'needs_fix',
                    'port': port,
                    'app_port': app_port,
                })
                continue

            # Build urls map from ports
            new_urls = {}
            if port:
                new_urls['api'] = f'http://{host}:{port}'
            if app_port:
                new_urls['app'] = f'http://{host}:{app_port}'
            elif port:
                # Default app port = api port + 1 if not specified
                new_urls['app'] = f'http://{host}:{int(port) + 1}'

            cfg['urls'] = new_urls
            try:
                with open(cfg_path, 'w') as f:
                    json.dump(cfg, f, indent=2)
                    f.write('\n')
                results['fixed'].append({
                    'name': name,
                    'urls': new_urls,
                    'status': 'fixed',
                })
                print(f'[modify] Fixed urls for {name}: {new_urls}', color='green')
            except Exception as e:
                results['errors'].append({'name': name, 'error': str(e)})

        total = len(results['compliant']) + len(results['fixed'])
        print(f'[modify] ensure_urls: {len(results["compliant"])} compliant, '
              f'{len(results["fixed"])} fixed, {len(results["skipped"])} skipped',
              color='cyan')
        return results

    def test(self):
        """Test with a dry suggestion."""
        result = self.forward(
            mod='tester',
            query='add a docstring to the Test class',
            steps=3,
            safety=False
        )
        assert 'result' in result
        return {'passed': True, 'result': result}
