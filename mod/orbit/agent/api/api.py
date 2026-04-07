"""
agent api - FastAPI server for the agent module

Endpoints:
    GET  /health       - health check
    GET  /skills       - list skills + schemas
    POST /skills/run   - run a single skill
    POST /run          - run the full agent loop
    GET  /schema       - get skill schemas for LLM
    GET  /status       - check service status

Usage:
    uvicorn api.api:app --host 0.0.0.0 --port 50117 --reload
"""
import os
import sys
from typing import Optional, List
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# resolve agent module from orbit root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

app = FastAPI(title="Agent API", version="2.0.0", description="Simplest agentic framework API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ── request models ───────────────────────────────────────────────────

class RunRequest(BaseModel):
    query: str
    model: str = "anthropic/claude-sonnet-4-5-20250929"
    steps: int = 10
    skills: Optional[List[str]] = None
    temperature: float = 0.0
    safety: bool = False

class SkillRunRequest(BaseModel):
    name: str
    params: dict = {}


# ── lazy agent singleton ─────────────────────────────────────────────

_agent = None

def get_agent():
    global _agent
    if _agent is None:
        from agent.skills.mod import Skills
        from agent.memory.memory import Memory
        from agent.agent import Agent
        agent = Agent.__new__(Agent)
        agent.skills = Skills()
        agent.memory = Memory()
        agent.model = None
        agent._skill_names = None
        agent.goal = Agent.goal
        agent.output_format = Agent.output_format
        agent.anchors = Agent.anchors
        # try loading model via mod framework
        try:
            import mod as m
            agent.model = m.mod('model.openrouter')()
        except Exception:
            pass
        _agent = agent
    return _agent


# ── routes ───────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "module": "agent", "version": "2.0.0"}

@app.get("/skills")
def list_skills():
    """List all available skills with their schemas"""
    a = get_agent()
    return {"skills": a.skills.ls(), "schemas": a.skill_schema()}

@app.post("/skills/run")
def run_skill(req: SkillRunRequest):
    """Run a single skill by name"""
    a = get_agent()
    try:
        result = a.run_skill(req.name, **req.params)
        return {"skill": req.name, "result": result}
    except KeyError:
        return {"skill": req.name, "error": f"unknown skill: {req.name}", "available": a.skills.ls()}
    except Exception as e:
        return {"skill": req.name, "error": str(e)}

@app.post("/run")
def run_agent(req: RunRequest):
    """Run the full agent loop with LLM"""
    a = get_agent()
    if a.model is None:
        return {"error": "No LLM model configured. Set up model.openrouter or pass model param."}
    try:
        result = a.forward(
            query=req.query,
            model=req.model,
            steps=req.steps,
            skills=req.skills,
            temperature=req.temperature,
            safety=req.safety,
        )
        return {"query": req.query, "result": result}
    except Exception as e:
        return {"query": req.query, "error": str(e)}

@app.get("/schema")
def get_schema():
    """Get skill schemas for LLM tool descriptions"""
    a = get_agent()
    return a.skill_schema()

@app.get("/status")
def get_status():
    """Get agent status"""
    a = get_agent()
    return {
        "skills": a.skills.ls(),
        "model": a.model is not None,
        "memory_keys": a.memory.keys(),
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 50117))
    uvicorn.run("api.api:app", host="0.0.0.0", port=port, reload=True)
