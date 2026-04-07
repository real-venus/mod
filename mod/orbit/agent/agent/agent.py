
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


class Agent:
    """
    Simplest agentic framework. Skills are modular tools the agent calls.

    Each skill is a directory in agent/skills/<name>/mod.py:
        class Skill:
            description = "..."
            def forward(self, **kwargs): ...
            def test(self): ...

    Agent loop: prompt LLM -> parse plan -> run skills -> repeat until done.

    Usage:
        agent = Agent()
        agent.forward("read main.py and fix the bug")
        agent.skills.ls()           # ['bash','edit','glob','grep','read','search','task','write']
        agent.skills.run("bash", command="ls")
    """

    goal = """
        You are an autonomous agent with access to skills.
        Use your skills to achieve the user's goal.
        Be efficient: read context before modifying, minimize redundant steps.
        Respond strictly in the structured JSON format within STEP anchors.
        One plan at a time, one step per plan iteration.
        When finished, use the finish tool.
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
        <STEP>{"tool": "finish", "params": {}}</STEP>
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
                steps: int = 10,
                skills: list = None,
                mod: str = None,
                safety: bool = False,
                save: bool = False,
                key: str = None,
                **kwargs) -> List[Dict[str, Any]]:
        """Run the agent loop: query -> LLM -> parse step -> execute skill -> repeat."""
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
        for step_i in range(steps):
            self.memory.update({'step': step_i, 'pwd': path})
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
        """Execute parsed steps using skills."""
        if safety and plan:
            confirm = input("Execute plan? (y/n): ")
            if confirm.lower() != 'y':
                raise Exception("Aborted by user")
        for i, step in enumerate(plan):
            name = step['tool'].lower()
            if name in ('finish', 'review'):
                print(f"[{i+1}/{len(plan)}] {name}")
                break
            try:
                # try local skill first, fall back to mod.tool
                if name in self.skills.ls():
                    result = self.run_skill(name, **step.get('params', {}))
                elif m:
                    result = m.tool(name)(**step.get('params', {}))
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
