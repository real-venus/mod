#!/usr/bin/env python3
"""UnBit CLI — interact with the 1-bit agent API.

Usage:
  unbit serve                          Start the API server (port 8421)
  unbit health                         Check server + LLM status
  unbit models                         List available models
  unbit download [model]               Download a GGUF model
  unbit propose [--gen N] [--count N]  Generate token proposals
  unbit evaluate <proposals_json>      Evaluate tokens and allocate budget
  unbit simulate [--gen N] [--agents N] [--topk N]  Run evolutionary sim
  unbit results                        Get last simulation results

Environment:
  UNBIT_URL       API base URL (default: http://localhost:8421)
  UNBIT_BACKEND   LLM backend: llama_cpp, ollama (default: llama_cpp)
  UNBIT_LLM_URL   LLM server URL override
  UNBIT_MODEL     Model key (default: qwen-0.5b-q2)
"""

import json
import os
import sys
import urllib.request
import urllib.error

BASE_URL = os.environ.get("UNBIT_URL", "http://localhost:8421")


def _get(path: str) -> dict:
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def _post(path: str, data: dict) -> dict:
    url = f"{BASE_URL}{path}"
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read())


def _print_json(obj, indent=2):
    print(json.dumps(obj, indent=indent))


def _print_table(rows, headers):
    """Simple table printer."""
    widths = [len(h) for h in headers]
    for row in rows:
        for i, val in enumerate(row):
            widths[i] = max(widths[i], len(str(val)))

    fmt = "  ".join(f"{{:<{w}}}" for w in widths)
    print(fmt.format(*headers))
    print(fmt.format(*["-" * w for w in widths]))
    for row in rows:
        print(fmt.format(*[str(v) for v in row]))


def cmd_serve(args):
    """Start the UnBit API server."""
    port = 8421
    for i, a in enumerate(args):
        if a in ("--port", "-p") and i + 1 < len(args):
            port = int(args[i + 1])

    print(f"Starting UnBit API on port {port}...")
    print(f"  Backend: {os.environ.get('UNBIT_BACKEND', 'llama_cpp')}")
    print(f"  Model: {os.environ.get('UNBIT_MODEL', 'qwen-0.5b-q2')}")
    print(f"  Endpoints:")
    print(f"    GET  /health")
    print(f"    GET  /models")
    print(f"    POST /propose")
    print(f"    POST /evaluate")
    print(f"    POST /simulate")
    print()

    from .server import run
    run(port=port)


def cmd_health(args):
    """Check server and LLM status."""
    try:
        data = _get("/health")
        status = "OK" if data.get("llm_reachable") else "NO LLM"
        print(f"Server:   {data.get('status', '?')}")
        print(f"LLM:      {'reachable' if data.get('llm_reachable') else 'unreachable (will use random fallback)'}")
        print(f"Backend:  {data.get('backend', '?')}")
        print(f"Model:    {data.get('model', '?')}")
        print(f"LLM URL:  {data.get('base_url', '?')}")
    except urllib.error.URLError:
        print(f"ERROR: Cannot reach UnBit server at {BASE_URL}")
        print(f"  Start it with: unbit serve")
        sys.exit(1)


def cmd_models(args):
    """List available models."""
    try:
        models = _get("/models")
    except urllib.error.URLError:
        # Fallback: list locally without server
        from .models import list_models
        models = list_models()

    rows = []
    for m in models:
        status = "yes" if m.get("downloaded") else "no"
        rows.append([
            m["key"], f"{m.get('size_mb', '?')}MB",
            m.get("ctx", "?"), status, m.get("description", "")[:50]
        ])
    _print_table(rows, ["Model", "Size", "Ctx", "Downloaded", "Description"])


def cmd_download(args):
    """Download a model."""
    model = args[0] if args else "qwen-0.5b-q2"
    try:
        data = _post("/models/download", {"model": model})
        print(f"Downloaded: {data.get('path', '?')}")
    except urllib.error.URLError:
        # Fallback: download directly without server
        from .agent import UnBitAgent
        agent = UnBitAgent(model=model)
        path = agent.download_model(model)
        print(f"Downloaded: {path}")


def cmd_propose(args):
    """Generate token proposals."""
    gen = 0
    count = 3
    survivors = []

    i = 0
    while i < len(args):
        if args[i] in ("--gen", "-g") and i + 1 < len(args):
            gen = int(args[i + 1]); i += 2
        elif args[i] in ("--count", "-n") and i + 1 < len(args):
            count = int(args[i + 1]); i += 2
        elif args[i] == "--survivors" and i + 1 < len(args):
            survivors = json.loads(args[i + 1]); i += 2
        else:
            i += 1

    data = _post("/propose", {
        "survivors": survivors,
        "generation": gen,
        "count": count,
    })

    proposals = data.get("proposals", [])
    print(f"\n  {len(proposals)} token proposals (gen {gen}):\n")

    curve_names = ["LINEAR", "EXPONENTIAL", "SIGMOID", "FIXED"]
    rows = []
    for p in proposals:
        ct = curve_names[p.get("curve_type", 0)]
        rows.append([
            p.get("symbol", "?"),
            p.get("name", "?"),
            ct,
            p.get("curve_param", "?"),
            f"{p.get('buy_fee', 0)}bps",
            f"{p.get('sell_fee', 0)}bps",
        ])
    _print_table(rows, ["Symbol", "Name", "Curve", "Param", "BuyFee", "SellFee"])
    print()


def cmd_evaluate(args):
    """Evaluate tokens and allocate budget."""
    budget = 10000
    proposals_json = None

    i = 0
    while i < len(args):
        if args[i] in ("--budget", "-b") and i + 1 < len(args):
            budget = int(args[i + 1]); i += 2
        elif proposals_json is None:
            proposals_json = args[i]; i += 1
        else:
            i += 1

    if not proposals_json:
        print("Usage: unbit evaluate '<json array of proposals>' [--budget N]")
        sys.exit(1)

    proposals = json.loads(proposals_json)
    data = _post("/evaluate", {"proposals": proposals, "budget": budget})

    alloc = data.get("allocations", {})
    print(f"\n  Investment allocations (budget={budget}):\n")
    rows = [[sym, amt, f"{amt * 100 / budget:.1f}%"] for sym, amt in sorted(alloc.items(), key=lambda x: -x[1])]
    _print_table(rows, ["Symbol", "Amount", "Share"])
    print()


def cmd_simulate(args):
    """Run evolutionary simulation."""
    generations = 5
    agents = 6
    topk = 2

    i = 0
    while i < len(args):
        if args[i] in ("--gen", "-g") and i + 1 < len(args):
            generations = int(args[i + 1]); i += 2
        elif args[i] in ("--agents", "-a") and i + 1 < len(args):
            agents = int(args[i + 1]); i += 2
        elif args[i] in ("--topk", "-k") and i + 1 < len(args):
            topk = int(args[i + 1]); i += 2
        else:
            i += 1

    print(f"\n  Running {generations}-gen simulation ({agents} agents/gen, top-{topk} survive)...\n")

    data = _post("/simulate", {
        "generations": generations,
        "agents_per_gen": agents,
        "top_k": topk,
    })

    curve_names = ["LINEAR", "EXPONENTIAL", "SIGMOID", "FIXED"]

    for gen_result in data.get("results", []):
        gen = gen_result["generation"]
        print(f"  === Generation {gen} ===")
        for s in gen_result.get("survivors", []):
            ct = curve_names[s.get("curve_type", 0)]
            print(f"    * {s.get('symbol', '?'):8s} {ct:12s} fees={s.get('buy_fee',0)}/{s.get('sell_fee',0)}bps  fitness={s.get('fitness',0)}")
        for e in gen_result.get("eliminated", []):
            print(f"      {e.get('symbol', '?'):8s} {'':12s} fitness={e.get('fitness',0)}  (eliminated)")
        print()

    print("  === FINAL WINNERS ===")
    for i, w in enumerate(data.get("winners", [])):
        ct = curve_names[w.get("curve_type", 0)]
        print(f"  #{i+1} {w.get('symbol', '?')} ({w.get('name', '?')})")
        print(f"     Curve: {ct} | Param: {w.get('curve_param', '?')}")
        print(f"     Fees: buy={w.get('buy_fee', 0)}bps sell={w.get('sell_fee', 0)}bps")
        print(f"     Fitness: {w.get('fitness', 0)}")
    print()


def cmd_results(args):
    """Get last simulation results."""
    try:
        data = _get("/simulate/results")
        _print_json(data)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print("No simulation results yet. Run: unbit simulate")
        else:
            raise


COMMANDS = {
    "serve": cmd_serve,
    "health": cmd_health,
    "models": cmd_models,
    "download": cmd_download,
    "propose": cmd_propose,
    "evaluate": cmd_evaluate,
    "simulate": cmd_simulate,
    "results": cmd_results,
}


def main(argv=None):
    args = argv if argv is not None else sys.argv[1:]

    if not args or args[0] in ("-h", "--help", "help"):
        print(__doc__)
        print("Commands:")
        for name, fn in COMMANDS.items():
            print(f"  {name:12s}  {fn.__doc__ or ''}")
        print()
        sys.exit(0)

    cmd_name = args[0]
    cmd_args = args[1:]

    if cmd_name not in COMMANDS:
        print(f"Unknown command: {cmd_name}")
        print(f"Available: {', '.join(COMMANDS.keys())}")
        sys.exit(1)

    COMMANDS[cmd_name](cmd_args)


if __name__ == "__main__":
    main()
