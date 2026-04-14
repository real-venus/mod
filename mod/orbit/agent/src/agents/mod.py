"""
agents - agent registry

Auto-discovers agent modules in agents/ directory.
Each agent is a folder with mod.py containing an Agent class.
Create new agents locally or register on-chain via the registry module.

Usage:
    agents = Agents()
    agents.ls()                         # list all agent names
    agents.get("architect")             # get agent config
    agents.create("myagent", {...})     # create new agent locally
    agents.register("myagent", key=k)   # register on-chain
    agents.forward("architect")         # mod protocol entry point
"""
import os
import json
import importlib.util
from pathlib import Path
from typing import Dict, Any, List, Optional

try:
    import mod as m
except ImportError:
    m = None

AGENT_TEMPLATE = '''"""{name} agent - {description}"""


class Agent:
    name = "{label}"
    description = "{description}"
    icon = "{icon}"
    skills = {skills}
    model = {model}

    goal = """{goal}"""
'''


class Agents:
    description = "Agent registry - discover, load, create, and register agent personas"

    def __init__(self, **kwargs):
        self._dir = Path(__file__).parent
        self._cache = {}

    def ls(self) -> List[str]:
        """List available agent names"""
        return sorted([
            d.name for d in self._dir.iterdir()
            if d.is_dir() and not d.name.startswith("_") and (d / "mod.py").exists()
        ])

    def get(self, name: str) -> Dict[str, Any]:
        """Get an agent config by name"""
        if name in self._cache:
            return self._cache[name]
        mod_path = self._dir / name / "mod.py"
        if not mod_path.exists():
            raise KeyError(f"agent not found: {name}")
        spec = importlib.util.spec_from_file_location(f"agents.{name}", str(mod_path))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        cls = getattr(mod, "Agent", None)
        if cls is None:
            raise AttributeError(f"no Agent class in {name}/mod.py")
        config = {
            "name": getattr(cls, "name", name),
            "description": getattr(cls, "description", ""),
            "goal": getattr(cls, "goal", None),
            "icon": getattr(cls, "icon", ">_"),
            "skills": getattr(cls, "skills", None),
            "model": getattr(cls, "model", None),
            "cls": cls,
        }
        self._cache[name] = config
        return config

    def create(self, name: str, description: str = "", goal: str = "",
               icon: str = ">_", skills: list = None, model: str = None,
               key: str = None) -> Dict[str, Any]:
        """Create a new agent locally in agents/ directory.

        Args:
            name: agent slug (lowercase, no spaces)
            description: what this agent does
            goal: system prompt / goal for the agent
            icon: display icon
            skills: optional list of skill names to restrict to
            model: optional model override
            key: caller auth token (for permission check)
        """
        name = name.lower().replace(" ", "-").replace("_", "-")
        agent_dir = self._dir / name
        if agent_dir.exists():
            raise FileExistsError(f"agent already exists: {name}")

        agent_dir.mkdir(parents=True)
        label = name.replace("-", " ").title()
        content = AGENT_TEMPLATE.format(
            name=name,
            label=label,
            description=description or f"{label} agent",
            icon=icon,
            skills=repr(skills) if skills else "None",
            model=repr(model) if model else "None",
            goal=goal or f"You are a {label} agent.",
        )
        (agent_dir / "mod.py").write_text(content)

        # clear cache so new agent is discovered
        self._cache.pop(name, None)
        return self.get(name)

    def remove(self, name: str, key: str = None) -> Dict[str, Any]:
        """Remove a local agent."""
        agent_dir = self._dir / name
        if not agent_dir.exists():
            raise KeyError(f"agent not found: {name}")
        # don't allow removing built-in agents
        builtins = {"default", "architect", "reviewer", "debugger", "builder", "refactorer"}
        if name in builtins:
            raise PermissionError(f"cannot remove built-in agent: {name}")
        import shutil
        shutil.rmtree(agent_dir)
        self._cache.pop(name, None)
        return {"removed": name}

    def register(self, name: str, key: str = None,
                 backend: str = "offchain") -> Dict[str, Any]:
        """Register an agent on the registry (local offchain or on-chain EVM).

        Args:
            name: agent name (must exist locally)
            key: auth key/token for ownership
            backend: 'offchain' (default) or 'evm' for on-chain
        """
        if not m:
            raise RuntimeError("mod framework required for registry")

        config = self.get(name)
        data = {k: v for k, v in config.items() if k != "cls"}
        data["type"] = "agent"

        registry = m.mod("registry")()
        result = registry.register(
            name=f"agent.{name}",
            data=data,
            backend=backend,
        )
        return {"agent": name, "registry": result}

    def schema(self) -> Dict[str, Dict]:
        """Get schemas for all agents"""
        out = {}
        for name in self.ls():
            try:
                config = self.get(name)
                out[name] = {k: v for k, v in config.items() if k != "cls"}
            except Exception as e:
                out[name] = {"error": str(e)}
        return out

    def forward(self, name: str = None, **kwargs) -> Any:
        """Mod protocol entry point.

        forward()                           -> list all agents
        forward("architect")                -> get agent config
        forward(action="create", name=...)  -> create new agent
        forward(action="remove", name=...) -> remove agent
        forward(action="register", name=...)-> register on-chain
        """
        action = kwargs.get("action")

        if action == "create":
            return self.create(
                name=kwargs.get("name", name or ""),
                description=kwargs.get("description", ""),
                goal=kwargs.get("goal", ""),
                icon=kwargs.get("icon", ">_"),
                skills=kwargs.get("skills"),
                model=kwargs.get("model"),
                key=kwargs.get("key"),
            )
        if action == "remove":
            return self.remove(name=kwargs.get("name", name or ""), key=kwargs.get("key"))
        if action == "register":
            return self.register(
                name=kwargs.get("name", name or ""),
                key=kwargs.get("key"),
                backend=kwargs.get("backend", "offchain"),
            )

        if name is None:
            return {"agents": self.ls(), "total": len(self.ls()), "schemas": self.schema()}
        return {k: v for k, v in self.get(name).items() if k != "cls"}

    def chains(self) -> Dict[str, Any]:
        """Get chain presets from chains.json if it exists"""
        chains_path = self._dir / "chains.json"
        if chains_path.exists():
            with open(chains_path) as f:
                return json.load(f)
        return {}
