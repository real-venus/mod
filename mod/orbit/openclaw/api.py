"""OpenClaw FastAPI server — exposes all Mod methods as REST endpoints."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from mod import Mod

app = FastAPI(title="OpenClaw API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

oc = Mod()


@app.exception_handler(Exception)
async def catch_all(request, exc):
    return JSONResponse(status_code=200, content={"status": "error", "error": str(exc)})


class AgentCreate(BaseModel):
    name: str
    model: str = "claude"
    thinking: str = "medium"


class SendMessage(BaseModel):
    message: str
    agent: Optional[str] = None
    thinking: Optional[str] = None
    model: Optional[str] = None


class ImportAgent(BaseModel):
    source: str
    name: Optional[str] = None


class ExportAgent(BaseModel):
    name: str
    dest: Optional[str] = None


class ConfigSet(BaseModel):
    key: str
    value: Optional[str] = None


class GatewayAction(BaseModel):
    action: str = "status"
    port: Optional[int] = None


# ── endpoints ──────────────────────────────────────────────────────────────


@app.get("/status")
def status():
    return oc.status()


@app.get("/agents")
def agents():
    return {"agents": oc.agents()}


@app.post("/agent")
def create_agent(body: AgentCreate):
    return oc.agent(name=body.name, model=body.model, thinking=body.thinking)


@app.post("/send")
def send(body: SendMessage):
    kwargs = {}
    if body.thinking:
        kwargs["thinking"] = body.thinking
    if body.model:
        kwargs["model"] = body.model
    return oc.send(message=body.message, agent=body.agent, **kwargs)


@app.post("/import")
def import_agent(body: ImportAgent):
    return oc.import_agent(source=body.source, name=body.name)


@app.post("/export")
def export_agent(body: ExportAgent):
    return oc.export_agent(name=body.name, dest=body.dest)


@app.post("/setup")
def setup(build: bool = True):
    return oc.setup(build=build)


@app.post("/kill")
def kill(remove: bool = False):
    return oc.kill(remove=remove)


@app.post("/restart")
def restart():
    return oc.restart()


@app.post("/gateway")
def gateway(body: GatewayAction):
    return oc.gateway(action=body.action, port=body.port)


@app.get("/config")
def config_get(key: Optional[str] = None):
    return oc.config(key=key)


@app.post("/config")
def config_set(body: ConfigSet):
    return oc.config(key=body.key, value=body.value)


@app.get("/logs")
def logs(lines: int = 100):
    return {"logs": oc.logs(lines=lines)}


@app.get("/test")
def test():
    return oc.test()
