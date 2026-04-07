
import os
import json
from typing import Dict, List, Optional, Any
import mod as m
print = m.print


class Suggest:
    """
    Analyzes orbit modules and generates suggestions via the agent.
    Reads module source, config, and structure — then uses the agent
    to propose improvements, fixes, or new features.
    """

    goal = """
        You are a module reviewer and advisor for the mod framework.
        Your job is to analyze orbit modules and produce actionable suggestions.
        Categories: bugs, performance, security, structure, features, docs.
        Be specific — reference file paths and line numbers.
        Keep suggestions concise and ranked by priority.
        Output each suggestion as JSON with: category, priority (1-5), title, description, file, diff (optional).
        When finished, use the finish tool with your suggestions in params.
    """

    tools = ['cmd', 'read_file', 'grep']

    def __init__(self, model: str = 'model.openrouter', **kwargs):
        self.agent = m.mod('agent')(
            goal=self.goal,
            tools=self.tools,
        )

    def forward(self,
                mod: str = None,
                path: str = None,
                query: str = None,
                focus: str = None,
                model: str = 'anthropic/claude-sonnet-4-5-20250929',
                steps: int = 5,
                safety: bool = False,
                **kwargs) -> Dict[str, Any]:
        """
        Generate suggestions for a target module.

        Args:
            mod: module name (e.g. 'tester', 'claude')
            path: explicit path to module directory
            query: specific question or area to focus on
            focus: category filter (bugs, performance, security, structure, features, docs)
            model: LLM model to use
            steps: max agent steps
            safety: require user confirmation before tool execution
        """
        path = path or m.dp(mod) if mod else path
        if not path:
            return {'error': 'provide mod or path'}

        context = self._gather_context(path, mod)
        prompt = self._build_prompt(context, query=query, focus=focus)

        result = self.agent.forward(
            query=prompt,
            path=path,
            mod=mod,
            model=model,
            steps=steps,
            safety=safety,
            **kwargs
        )

        suggestions = self._extract_suggestions(result)
        return {
            'mod': mod or os.path.basename(path),
            'path': path,
            'focus': focus,
            'suggestions': suggestions,
            'raw': result,
        }

    def _gather_context(self, path: str, mod: str = None) -> dict:
        """Read module files to build context for the agent."""
        context = {'path': path, 'mod': mod, 'files': {}, 'config': None}

        # read config.json if exists
        config_path = os.path.join(path, 'config.json')
        if os.path.exists(config_path):
            try:
                with open(config_path) as f:
                    context['config'] = json.load(f)
            except Exception:
                pass

        # read python source files (cap at 10 files, 500 lines each)
        py_files = []
        for root, dirs, files in os.walk(path):
            for fname in files:
                if fname.endswith('.py') and not fname.startswith('__'):
                    py_files.append(os.path.join(root, fname))
            if len(py_files) >= 10:
                break

        for fpath in py_files[:10]:
            try:
                with open(fpath) as f:
                    lines = f.readlines()[:500]
                    context['files'][os.path.relpath(fpath, path)] = ''.join(lines)
            except Exception:
                pass

        # list all files for structure overview
        all_files = []
        for root, dirs, files in os.walk(path):
            for fname in files:
                all_files.append(os.path.relpath(os.path.join(root, fname), path))
        context['structure'] = all_files[:50]

        return context

    def _build_prompt(self, context: dict, query: str = None, focus: str = None) -> str:
        """Build the analysis prompt from gathered context."""
        parts = [f"Analyze the module at {context['path']}"]

        if query:
            parts.append(f"Focus on: {query}")
        if focus:
            parts.append(f"Category filter: {focus}")

        if context['config']:
            parts.append(f"\nconfig.json:\n{json.dumps(context['config'], indent=2)}")

        parts.append(f"\nFile structure: {context['structure']}")

        for relpath, content in context['files'].items():
            parts.append(f"\n--- {relpath} ---\n{content}")

        parts.append(
            "\nProvide suggestions as a list. Each suggestion must have: "
            "category, priority (1=critical, 5=nice-to-have), title, description. "
            "Include file path and optional diff when relevant."
        )
        return '\n'.join(parts)

    def _extract_suggestions(self, result: list) -> list:
        """Pull structured suggestions from agent output."""
        suggestions = []
        if not result:
            return suggestions

        for step in result:
            if not isinstance(step, dict):
                continue
            # check finish step params for suggestions
            if step.get('tool', '').lower() == 'finish':
                params = step.get('params', {})
                if isinstance(params, dict):
                    if 'suggestions' in params:
                        s = params['suggestions']
                        if isinstance(s, list):
                            suggestions.extend(s)
                        else:
                            suggestions.append(s)
                    elif params:
                        suggestions.append(params)
            # check result fields
            if 'result' in step and isinstance(step['result'], dict):
                if 'suggestions' in step['result']:
                    suggestions.extend(step['result']['suggestions'])

        return suggestions

    def batch(self,
              mods: List[str] = None,
              focus: str = None,
              model: str = 'anthropic/claude-sonnet-4-5-20250929',
              **kwargs) -> List[Dict[str, Any]]:
        """
        Run suggestions on multiple modules at once.

        Args:
            mods: list of module names
            focus: category filter
            model: LLM model
        """
        mods = mods or []
        results = []
        for mod_name in mods:
            try:
                result = self.forward(mod=mod_name, focus=focus, model=model, **kwargs)
                results.append(result)
                print(f"[suggest] {mod_name}: {len(result.get('suggestions', []))} suggestions", color='cyan')
            except Exception as e:
                results.append({'mod': mod_name, 'error': str(e)})
                print(f"[suggest] {mod_name}: error - {e}", color='red')
        return results

    def test(self):
        """Test with the tester module."""
        result = self.forward(mod='tester', steps=3)
        assert 'suggestions' in result
        assert 'mod' in result
        return {'passed': True, 'result': result}
