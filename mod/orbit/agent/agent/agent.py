
import os
import json
from typing import Dict, List, Optional, Any
from pathlib import Path

try:
    import mod as m
    print = m.print
except ImportError:
    m = None

from .skills.mod import Skills


# ── path sandboxing ────────────────────────────────────────────────

WRITE_SKILLS = ('write', 'edit', 'patch')

def check_path_allowed(file_path: str, allowed_paths: list) -> bool:
    """Return True if path is within allowed paths, or if allowed_paths is None (unrestricted)."""
    if allowed_paths is None:
        return True
    resolved = str(Path(file_path).expanduser().resolve())
    return any(resolved.startswith(str(Path(ap).resolve())) for ap in allowed_paths)


class Agent:
    """
    World-class coding agent. 21 skills for autonomous software engineering.

    Skills: bash, read, write, edit, glob, grep, search, task,
            fetch, patch, think, git, test, lint, symbols, diff,
            tree, todo, context, debug, refactor

    Agent loop: query -> context gather -> LLM -> parse plan -> execute -> reflect -> repeat

    Usage:
        agent = Agent()
        agent.forward("read main.py and fix the bug")
        agent.skills.ls()
        agent.skills.run("bash", command="ls")
    """

    goal = """You are an elite autonomous coding agent. You write production-quality code.

CORE PRINCIPLES:
- Read before you write. Always understand existing code before modifying it.
- Think before you act. Use the think tool to reason through complex problems.
- Verify after you change. Run tests or read back files to confirm your edits.
- Be precise. Use edit/patch for surgical changes, not full file rewrites.
- Be efficient. Minimize redundant operations. Gather context first, then act.

WORKFLOW:
1. UNDERSTAND: Use context, tree, read, grep, symbols to understand the codebase
2. PLAN: Use think to reason through your approach before coding
3. IMPLEMENT: Use edit, patch, write to make changes
4. VERIFY: Use test, lint, diff, read to verify changes are correct
5. FINISH: Use finish when the task is complete

RULES:
- One step per iteration. Choose the single best action.
- Never guess file contents. Always read first.
- When you encounter an error, use debug to analyze it, then fix the root cause.
- Use git to check status and create commits when appropriate.
- Use todo to track multi-step tasks.
- Prefer edit/patch over write for existing files.
- If stuck, use think to reflect on what went wrong and try a different approach.
"""

    anchors = {
        'plan': ['<PLAN>', '</PLAN>'],
        'tool': ['<STEP>', '</STEP>'],
    }

    output_format = """
        Respond with exactly ONE step per iteration inside anchors.
        The params must be valid JSON.
        <PLAN>
        <STEP>{"tool": "<skill_name>", "params": {...}}</STEP>
        </PLAN>
        When finished:
        <PLAN>
        <STEP>{"tool": "finish", "params": {"summary": "what you accomplished"}}</STEP>
        </PLAN>
    """

    def __init__(self,
                 model: str = 'model.openrouter',
                 memory: str = 'agent.memory',
                 goal: str = None,
                 skills: list = None,
                 **kwargs):
        self.skills = Skills()
        self.memory = m.mod(memory)() if m else __import__('agent.memory.memory', fromlist=['Memory']).Memory()
        self.model = m.mod(model)() if m else None
        if goal:
            self.goal = goal
        self._skill_names = skills  # optional filter

    # ── skill interface ──────────────────────────────────────────────

    def skill(self, name: str):
        """Get a skill instance"""
        return self.skills.get(name)

    def run_skill(self, name: str, **params):
        """Run a skill by name"""
        return self.skills.run(name, **params)

    def skill_schema(self, names: List[str] = None) -> Dict[str, Dict]:
        """Get LLM-friendly schemas for skills"""
        return self.skills.schema(names or self._skill_names)

    # ── memory ───────────────────────────────────────────────────────

    def init_memory(self, **kwargs):
        kwargs['goal'] = self.goal
        kwargs['output_format'] = self.output_format
        for k, v in kwargs.items():
            self.memory.add(k, v)
            if m and k.startswith('fork') and v is not None:
                self.memory.add(f'fork({k})', m.fn('select_files')(path=m.dp(v), query=kwargs.get('query', '')))

    # ── main loop ────────────────────────────────────────────────────

    def forward(self,
                query: str = 'help me with this',
                *extra_text,
                model: Optional[str] = 'anthropic/claude-sonnet-4-5-20250929',
                path: str = None,
                temperature: float = 0.0,
                max_tokens: int = 100000,
                steps: int = 25,
                skills: list = None,
                mod: str = None,
                safety: bool = False,
                save: bool = False,
                key: str = None,
                allowed_paths: list = None,
                **kwargs) -> List[Dict[str, Any]]:
        """Run the agent loop: query -> LLM -> parse step -> execute skill -> repeat.

        Args:
            allowed_paths: list of allowed write paths, or None for unrestricted (owner).
                           Non-owners are restricted to their portal directory.
        """
        self._allowed_paths = allowed_paths
        query = query + ' ' + ' '.join(extra_text) if extra_text else query
        path = path or (m.dp(mod) if m and mod else os.getcwd())
        self.init_memory(
            query=query,
            tools=self.skill_schema(skills),
            path=path,
            steps=steps,
            **kwargs
        )
        history = []
        consecutive_errors = 0
        for step_i in range(steps):
            self.memory.update({'step': step_i, 'pwd': path})
            # inject recovery hint after repeated errors
            if consecutive_errors >= 3:
                self.memory.add('hint', 'Multiple errors in a row. Use think to reflect on what is going wrong and try a different approach.')
                consecutive_errors = 0
            output = self.model.forward(
                str(self.memory.get()),
                stream=True,
                model=model,
                max_tokens=max_tokens,
                temperature=temperature
            )
            plan = self.plan(output, safety=safety)
            history.append(plan)
            self.memory.add('history', history)
            if plan and plan[-1]['tool'].lower() == 'finish':
                print('Agent finished')
                break
            # track consecutive errors for recovery
            if plan and any(s.get('error') for s in plan):
                consecutive_errors += 1
            else:
                consecutive_errors = 0
        if save and m and mod:
            return m.fn('api/reg')(mod=mod, key=key, comment=query)
        return history[-1] if history else []

    # ── plan parsing & execution ─────────────────────────────────────

    def plan(self, output: str, safety: bool = False) -> list:
        """Parse LLM output into steps and execute them."""
        steps = self.parse_steps(output)
        steps = self.run_plan(steps, safety=safety)
        return steps

    def parse_steps(self, output: str) -> list:
        """Stream LLM output and extract steps from anchors."""
        text = ''
        plan = []
        for ch in output:
            text += ch
            print(ch, end='')
            if self.anchors['tool'][0] in text and self.anchors['tool'][1] in text:
                step = self._extract_step(text)
                if step:
                    plan.append(step)
                text = text.split(self.anchors['tool'][-1])[-1]
        return plan

    def _extract_step(self, text: str) -> Optional[dict]:
        """Extract a single step JSON from between STEP anchors."""
        try:
            raw = text.split(self.anchors['tool'][0])[1].split(self.anchors['tool'][1])[0]
            print(f"STEP: {raw}")
            try:
                step = json.loads(raw)
            except json.JSONDecodeError:
                if m:
                    fixed = m.tool('fix_json')(raw)
                    step = json.loads(fixed) if isinstance(fixed, str) else fixed
                else:
                    raise
            if 'tool' in step and 'params' in step:
                return step
        except Exception as e:
            print(f"Step parse error: {e}")
        return None

    def run_plan(self, plan: List[Dict[str, Any]], safety: bool = False) -> List[Dict[str, Any]]:
        """Execute parsed steps using skills. Enforces path sandboxing via _allowed_paths."""
        if safety and plan:
            confirm = input("Execute plan? (y/n): ")
            if confirm.lower() != 'y':
                raise Exception("Aborted by user")
        allowed = getattr(self, '_allowed_paths', None)
        for i, step in enumerate(plan):
            name = step['tool'].lower()
            params = step.get('params', {})
            if name in ('finish', 'review'):
                print(f"[{i+1}/{len(plan)}] {name}")
                break

            # ── path sandboxing for write-capable skills ──
            if allowed is not None:
                if name in WRITE_SKILLS:
                    fp = params.get('file_path', '')
                    if fp and not check_path_allowed(fp, allowed):
                        plan[i]['error'] = f"Permission denied: cannot write to {fp}. Restricted to {allowed}"
                        print(f"[{i+1}/{len(plan)}] {name} -> blocked (path)")
                        continue
                if name == 'bash':
                    # force cwd into portal and block path-escaping commands
                    params['cwd'] = allowed[0]
                if name == 'git':
                    params['cwd'] = params.get('cwd') or allowed[0]

            try:
                # try local skill first, fall back to mod.tool
                if name in self.skills.ls():
                    result = self.run_skill(name, **params)
                elif m:
                    result = m.tool(name)(**params)
                else:
                    result = {"error": f"unknown skill: {name}"}
                plan[i]['result'] = result
                print(f"[{i+1}/{len(plan)}] {name} -> done")
            except Exception as e:
                plan[i]['error'] = str(e)
                print(f"[{i+1}/{len(plan)}] {name} -> error: {e}")
        return plan


# backwards compat
Dev = Agent
