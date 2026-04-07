
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
        self.agent = m.mod('agent')(
            goal=self.goal,
            tools=self.tools,
        )

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
        parts = [f"""You are generating a mod.py class file to interface the folder at {path} as a module in the mod protocol.

The mod protocol pattern:
- Every module has a `class Mod` (or class named after the module) in a mod.py file
- The class uses `import mod as m` to access framework utilities
- Key interface: `forward()` as main entry, plus domain-specific methods
- Common attributes: `description`, `fns` (list of public method names)
- `__init__` takes **kwargs, sets `self._dir = os.path.dirname(__file__)`
- Include a `test()` method that validates basic functionality
- Include `info()` that returns module metadata
- If the project has a server component, include `serve()` method

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
