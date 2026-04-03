"""UnBit API Server — FastAPI service for 1-bit quantized LLM agents.

Endpoints:
  GET  /health              — server + model status
  GET  /models              — list available GGUF models
  POST /models/download     — download a model
  POST /propose             — agent proposes a token
  POST /evaluate            — agent evaluates tokens and allocates budget
  POST /simulate            — run N-generation evolutionary simulation
  GET  /simulate/results    — get last simulation results
"""

import json
import os
import random
import time
from typing import List, Optional

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
except ImportError:
    raise ImportError("pip install fastapi uvicorn  — required for unbit server")

from .agent import UnBitAgent, UnBitCreatorAgent, UnBitInvestorAgent
from .models import MODELS, DEFAULT_MODEL, list_models, get_model_path, MODELS_DIR

app = FastAPI(title="UnBit", description="1-bit quantized LLM agents for tokenomics", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared agent instance
_agent: Optional[UnBitAgent] = None
_last_simulation: Optional[dict] = None


def get_agent() -> UnBitAgent:
    global _agent
    if _agent is None:
        backend = os.environ.get("UNBIT_BACKEND", "llama_cpp")
        base_url = os.environ.get("UNBIT_LLM_URL")
        model = os.environ.get("UNBIT_MODEL", DEFAULT_MODEL)
        _agent = UnBitAgent(backend=backend, base_url=base_url, model=model)
    return _agent


# --- Request / Response models ---

class ProposeRequest(BaseModel):
    survivors: List[dict] = []
    generation: int = 0
    count: int = 3

class EvaluateRequest(BaseModel):
    proposals: List[dict]
    budget: int = 10000

class SimulateRequest(BaseModel):
    generations: int = 5
    agents_per_gen: int = 6
    top_k: int = 2

class DownloadRequest(BaseModel):
    model: str = DEFAULT_MODEL


# --- Endpoints ---

@app.get("/health")
def health():
    agent = get_agent()
    # Check if LLM backend is reachable
    llm_ok = False
    try:
        resp = agent._call("ping", max_tokens=5)
        llm_ok = len(resp) > 0
    except Exception:
        pass

    return {
        "status": "ok",
        "backend": agent.backend,
        "base_url": agent.base_url,
        "model": agent.model_key,
        "llm_reachable": llm_ok,
        "models_dir": str(MODELS_DIR),
    }


@app.get("/models")
def get_models():
    return list_models()


@app.post("/models/download")
def download_model(req: DownloadRequest):
    agent = get_agent()
    try:
        path = agent.download_model(req.model)
        return {"model": req.model, "path": str(path), "downloaded": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/propose")
def propose_tokens(req: ProposeRequest):
    creator = UnBitCreatorAgent(
        backend=get_agent().backend,
        base_url=get_agent().base_url,
        model=get_agent().model_key,
    )
    proposals = creator.forward(
        survivors=req.survivors,
        generation=req.generation,
        count=req.count,
    )
    return {"proposals": proposals, "count": len(proposals)}


@app.post("/evaluate")
def evaluate_tokens(req: EvaluateRequest):
    investor = UnBitInvestorAgent(
        backend=get_agent().backend,
        base_url=get_agent().base_url,
        model=get_agent().model_key,
    )
    allocations = investor.forward(
        proposals=req.proposals,
        budget=req.budget,
    )
    return {"allocations": allocations, "budget": req.budget}


@app.post("/simulate")
def simulate(req: SimulateRequest):
    global _last_simulation
    agent = get_agent()

    results = []
    survivors = []

    for gen in range(req.generations):
        # Phase 1: Propose tokens
        creator = UnBitCreatorAgent(
            backend=agent.backend, base_url=agent.base_url, model=agent.model_key
        )

        proposals = []
        # Mutate survivors
        for s in survivors:
            mutated = _mutate(s)
            proposals.append(mutated)

        # Generate new proposals
        remaining = req.agents_per_gen - len(proposals)
        if remaining > 0:
            new = creator.forward(survivors=survivors, generation=gen, count=remaining)
            proposals.extend(new)

        # Fill if needed
        while len(proposals) < req.agents_per_gen:
            proposals.append(agent._random_token())
        proposals = proposals[:req.agents_per_gen]

        # Phase 2: Evaluate
        investor = UnBitInvestorAgent(
            backend=agent.backend, base_url=agent.base_url, model=agent.model_key
        )
        allocations = investor.forward(proposals=proposals, budget=10000)

        # Phase 3: Score
        for p in proposals:
            p["fitness"] = allocations.get(p.get("symbol", ""), 0)
        proposals.sort(key=lambda x: x.get("fitness", 0), reverse=True)

        # Phase 4: Select
        survivors = proposals[:req.top_k]
        eliminated = proposals[req.top_k:]

        results.append({
            "generation": gen + 1,
            "survivors": [
                {k: v for k, v in s.items() if k != "metadata"}
                for s in survivors
            ],
            "eliminated": [
                {"symbol": e.get("symbol"), "name": e.get("name"), "fitness": e.get("fitness", 0)}
                for e in eliminated
            ],
        })

    _last_simulation = {
        "generations": len(results),
        "results": results,
        "winners": [
            {k: v for k, v in s.items() if k != "metadata"}
            for s in survivors
        ],
        "timestamp": time.time(),
    }

    return _last_simulation


@app.get("/simulate/results")
def get_simulation_results():
    if _last_simulation is None:
        raise HTTPException(status_code=404, detail="No simulation run yet. POST /simulate first.")
    return _last_simulation


def _mutate(parent: dict) -> dict:
    """Mutate a surviving token's parameters."""
    curve_param = int(parent.get("curve_param", 1000000000000000))
    buy_fee = int(parent.get("buy_fee", 100))
    sell_fee = int(parent.get("sell_fee", 100))

    curve_param = max(1, int(curve_param * random.uniform(0.8, 1.2)))
    buy_fee = max(0, min(1000, buy_fee + random.randint(-50, 50)))
    sell_fee = max(0, min(1000, sell_fee + random.randint(-50, 50)))

    return {
        "name": f"{parent.get('name', 'Token')}v{random.randint(2, 99)}",
        "symbol": f"{parent.get('symbol', 'T')}{random.randint(2, 9)}",
        "curve_type": parent.get("curve_type", 0),
        "curve_param": str(curve_param),
        "buy_fee": buy_fee,
        "sell_fee": sell_fee,
        "burn_bps": parent.get("burn_bps", 5000),
        "metadata": json.dumps({"parent": parent.get("symbol", ""), "mutated": True}),
    }


def run(host: str = "0.0.0.0", port: int = 8421):
    """Start the UnBit API server."""
    import uvicorn
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    run()
