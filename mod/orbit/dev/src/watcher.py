"""
dev merkle watcher — background process.

Polls config.json mtimes across orbit/. When any change is detected
(or every `interval` seconds as a heartbeat), recomputes the deployment
merkle and pushes it on-chain if it differs from the last pushed root.

Started by `dev.watch()`. The watcher writes its state to
`/tmp/mod-dev-watch.json` so the parent can read status.

Run directly for foreground debugging:
    python3 watcher.py --interval 30 --push
"""
import argparse
import json
import os
import signal
import sys
import time
import traceback
from pathlib import Path

sys.path.insert(0, "/Users/broski/mod")
import mod as m

STATE_PATH = Path("/tmp/mod-dev-watch.json")
LOG_PATH = Path("/tmp/mod-dev-watch.log")
ORBIT_DIR = Path("/Users/broski/mod/mod/orbit")


def log(msg: str):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    try:
        with LOG_PATH.open("a") as f:
            f.write(line + "\n")
    except OSError:
        pass


def scan_mtimes() -> dict:
    """Return {module_name: max_mtime_in_module_tree} for fast change detection."""
    result = {}
    for mod_dir in ORBIT_DIR.iterdir():
        if not mod_dir.is_dir() or mod_dir.name.startswith("."):
            continue
        cfg = mod_dir / "config.json"
        if not cfg.exists():
            continue
        try:
            result[mod_dir.name] = int(cfg.stat().st_mtime)
        except OSError:
            continue
    return result


def write_state(state: dict):
    state["updated_at"] = int(time.time())
    STATE_PATH.write_text(json.dumps(state, indent=2))


def read_state() -> dict:
    if STATE_PATH.exists():
        try:
            return json.loads(STATE_PATH.read_text())
        except json.JSONDecodeError:
            pass
    return {}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--interval", type=int, default=30)
    parser.add_argument("--push", action="store_true", help="Push merkle on-chain when it changes")
    parser.add_argument("--modules", type=str, default="", help="Comma-separated module list; empty = all in DEFAULT_MODULES")
    args = parser.parse_args()

    dev = m.mod("dev")()
    modules = [s.strip() for s in args.modules.split(",") if s.strip()] or None

    log(f"watcher started: interval={args.interval}s push={args.push} modules={modules or 'default'}")
    write_state({"pid": os.getpid(), "interval": args.interval, "push": args.push, "modules": modules})

    last_mtimes = scan_mtimes()
    last_root = None
    stop = False

    def _sigterm(signum, frame):
        nonlocal stop
        log(f"received signal {signum}, shutting down")
        stop = True

    signal.signal(signal.SIGTERM, _sigterm)
    signal.signal(signal.SIGINT, _sigterm)

    while not stop:
        try:
            current_mtimes = scan_mtimes()
            changed = current_mtimes != last_mtimes
            current = dev.merkle(modules=modules)
            root = current.get("root")

            if root != last_root or changed:
                log(f"merkle changed: {last_root} → {root} (config changes: {sum(1 for k,v in current_mtimes.items() if last_mtimes.get(k) != v)})")
                state = read_state()
                state["last_root"] = root
                state["last_mtimes"] = current_mtimes
                state["leaf_count"] = len(current.get("leaves", []))

                if args.push:
                    try:
                        sync_result = dev.sync(push=True)
                        log(f"sync: {json.dumps({k: v for k, v in sync_result.items() if k != 'tx'})}")
                        state["last_sync"] = sync_result
                    except PermissionError as e:
                        log(f"sync skipped: {e}")
                        state["last_sync_error"] = str(e)
                    except Exception:
                        log(f"sync failed:\n{traceback.format_exc()}")
                        state["last_sync_error"] = traceback.format_exc()

                write_state(state)
                last_root = root
                last_mtimes = current_mtimes

            for _ in range(args.interval):
                if stop:
                    break
                time.sleep(1)
        except Exception:
            log(f"loop error:\n{traceback.format_exc()}")
            time.sleep(min(args.interval, 10))

    log("watcher stopped")


if __name__ == "__main__":
    main()
