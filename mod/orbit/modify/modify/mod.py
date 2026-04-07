
import os
import json
from typing import Dict, List, Optional, Any
import mod as m
print = m.print


class Modify:
    """
    Applies suggestions to orbit modules via the agent.
    Works with the suggest module — takes suggestions and executes
    modifications through the agent's tool-calling loop.
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
