"""
agent server - FastAPI server for the agent module

Endpoints:
    GET  /health       - health check
    GET  /status       - module status
    GET  /skills       - list skills + schemas
    GET  /schema       - get skill schemas for LLM
    POST /forward      - mod protocol entry point
    POST /run          - run the full agent loop
    POST /skills/run   - run a single skill

Usage:
    uvicorn server:app --host 0.0.0.0 --port 50117 --reload
"""
import os
import sys
import json
from typing import Optional, List
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# resolve module from orbit root
agent_root = os.path.join(os.path.dirname(__file__), '..')
mod_root = os.path.join(agent_root, '..', '..', '..')
sys.path.insert(0, agent_root)
sys.path.insert(0, mod_root)

app = FastAPI(title="Agent API", version="3.0.0", description="Autonomous coding agent API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ── request models ───────────────────────────────────────────────────

class ForwardRequest(BaseModel):
    action: Optional[str] = None
    params: dict = {}
    key: Optional[str] = None  # caller key/address/token for permissions

class RunRequest(BaseModel):
    query: str
    model: str = "anthropic/claude-sonnet-4-5-20250929"
    steps: int = 10
    skills: Optional[List[str]] = None
    temperature: float = 0.0
    safety: bool = False
    agent: Optional[str] = None  # agent persona key (legacy)
    agent_type: Optional[str] = None  # agent persona key (mirrors claude module)
    chain: Optional[List[dict]] = None  # chain steps: [{agent, prompt}]
    key: Optional[str] = None  # caller key/address/token for permissions

class SkillRunRequest(BaseModel):
    name: str
    params: dict = {}
    key: Optional[str] = None  # caller key/address/token for permissions


# ── lazy mod singleton ───────────────────────────────────────────────

_mod = None
_agents_config = None

def get_mod():
    global _mod
    if _mod is None:
        from agent.mod import Mod
        _mod = Mod()
    return _mod

def get_agents_config():
    global _agents_config
    if _agents_config is None:
        agents_path = os.path.join(agent_root, 'agents.json')
        if os.path.exists(agents_path):
            with open(agents_path) as f:
                _agents_config = json.load(f)
        else:
            _agents_config = {"agents": {}, "chains": {}}
    return _agents_config

def reload_agents_config():
    global _agents_config
    _agents_config = None
    return get_agents_config()


# ── routes ───────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "agent", "version": "3.0.0"}

@app.get("/config")
def get_config():
    """Get module config.json (mirrors claude module pattern)"""
    config_path = os.path.join(agent_root, 'config.json')
    if not os.path.exists(config_path):
        return {"error": "config.json not found"}
    with open(config_path) as f:
        return json.load(f)

@app.get("/status")
def status():
    mod = get_mod()
    return mod.forward('status')

@app.post("/forward")
def forward(req: ForwardRequest):
    """Mod protocol entry point: dispatch any action"""
    mod = get_mod()
    try:
        result = mod.forward(action=req.action, key=req.key, **req.params)
        return {"action": req.action, "result": result}
    except PermissionError as e:
        return {"action": req.action, "error": str(e), "code": 403}
    except Exception as e:
        return {"action": req.action, "error": str(e)}

@app.get("/skills")
def list_skills():
    """List all available skills with their schemas"""
    mod = get_mod()
    return {"skills": mod.skills.ls(), "schemas": mod.skill_schema()}

@app.get("/schema")
def get_schema():
    """Get skill schemas for LLM tool descriptions"""
    mod = get_mod()
    return mod.skill_schema()

@app.post("/skills/run")
def run_skill(req: SkillRunRequest):
    """Run a single skill by name. Write skills are path-restricted for non-owners."""
    mod = get_mod()
    try:
        # enforce path restrictions for write skills
        if req.name in ('write', 'edit', 'patch'):
            allowed = mod.allowed_paths_for(req.key)
            fp = req.params.get('file_path', '')
            if fp and allowed is not None:
                from agent.agent import check_path_allowed
                if not check_path_allowed(fp, allowed):
                    return {"skill": req.name, "error": f"Permission denied: cannot write to {fp}", "code": 403}
        result = mod.run_skill(req.name, **req.params)
        return {"skill": req.name, "result": result}
    except KeyError:
        return {"skill": req.name, "error": f"unknown skill: {req.name}", "available": mod.skills.ls()}
    except Exception as e:
        return {"skill": req.name, "error": str(e)}

@app.get("/owner")
def get_owner():
    """Get module owner info"""
    mod = get_mod()
    return {"owner": mod._owner, "has_owner": bool(mod._owner)}

@app.get("/agents")
def list_agents():
    """List all agent personas and chains"""
    config = get_agents_config()
    return config

@app.post("/agents/reload")
def reload_agents():
    """Reload agents config from disk"""
    config = reload_agents_config()
    return config

@app.post("/run")
def run_agent(req: RunRequest):
    """Run the full agent loop with LLM. Supports agent persona and chain execution."""
    mod = get_mod()
    if mod.model is None:
        return {"error": "No LLM model configured. Set up model.openrouter or pass model param."}

    agents_config = get_agents_config()

    # resolve agent: agent_type takes priority over agent (mirrors claude module)
    resolved_agent = req.agent_type or req.agent

    # resolve agent goal and skills filter
    agent_goal = None
    agent_skills = req.skills
    if resolved_agent and resolved_agent in agents_config.get("agents", {}):
        agent_def = agents_config["agents"][resolved_agent]
        agent_goal = agent_def.get("goal")
        if agent_def.get("skills") and not req.skills:
            agent_skills = agent_def["skills"]

    # chain execution: run each step sequentially, feeding context forward
    if req.chain and len(req.chain) > 0:
        chain_results = []
        context = req.query
        for i, step in enumerate(req.chain):
            step_agent = step.get("agent", "default")
            step_prompt = step.get("prompt", "")
            # compose query: user query + step prompt + prior context
            if i == 0:
                step_query = f"{step_prompt}\n\nUser request: {context}" if step_prompt else context
            else:
                prev_summary = chain_results[-1].get("summary", "")
                step_query = f"{step_prompt}\n\nUser request: {context}\n\nPrevious step output: {prev_summary}" if step_prompt else context

            # resolve step agent
            step_goal = None
            step_skills = None
            if step_agent in agents_config.get("agents", {}):
                step_def = agents_config["agents"][step_agent]
                step_goal = step_def.get("goal")
                step_skills = step_def.get("skills")

            # swap goal temporarily
            original_goal = mod.goal
            if step_goal:
                mod.goal = step_goal
            try:
                result = mod.forward('run',
                    key=req.key,
                    query=step_query,
                    model=req.model,
                    steps=req.steps,
                    skills=step_skills,
                    temperature=req.temperature,
                    safety=req.safety,
                )
                # extract summary from finish step if present
                summary = ""
                if isinstance(result, list):
                    for s in result:
                        if isinstance(s, dict) and s.get("tool") == "finish":
                            summary = s.get("params", {}).get("summary", "")
                chain_results.append({
                    "step": i,
                    "agent": step_agent,
                    "prompt": step_prompt,
                    "result": result,
                    "summary": summary,
                })
            except Exception as e:
                chain_results.append({
                    "step": i,
                    "agent": step_agent,
                    "prompt": step_prompt,
                    "error": str(e),
                    "summary": f"Error: {e}",
                })
            finally:
                mod.goal = original_goal
        return {"query": req.query, "chain": True, "results": chain_results}

    # single agent run
    original_goal = mod.goal
    if agent_goal:
        mod.goal = agent_goal
    try:
        result = mod.forward('run',
            key=req.key,
            query=req.query,
            model=req.model,
            steps=req.steps,
            skills=agent_skills,
            temperature=req.temperature,
            safety=req.safety,
        )
        return {"query": req.query, "agent": resolved_agent, "agent_type": resolved_agent, "result": result}
    except PermissionError as e:
        return {"query": req.query, "error": str(e), "code": 403}
    except Exception as e:
        return {"query": req.query, "error": str(e)}
    finally:
        mod.goal = original_goal


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 50117))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
