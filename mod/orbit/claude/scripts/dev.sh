#!/usr/bin/env bash
#
# ╔══════════════════════════════════════════╗
# ║  CLAUDE-DEV — Fork & Deploy Dev Version ║
# ║  Creates, syncs, and runs claude-dev    ║
# ╚══════════════════════════════════════════╝
#
# Usage:
#   ./scripts/dev.sh fork       Create claude-dev fork from claude
#   ./scripts/dev.sh deploy     Deploy (start) the dev version
#   ./scripts/dev.sh sync       Sync claude → claude-dev + IPFS snapshot
#   ./scripts/dev.sh stop       Stop the dev version
#   ./scripts/dev.sh status     Show dev fork status
#   ./scripts/dev.sh diff       Show diff between claude and claude-dev

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ORBIT_DIR="$(cd "$CLAUDE_DIR/.." && pwd)"
DEV_DIR="$ORBIT_DIR/claude-dev"

# Dev ports (offset from prod: 8820→8830, 8821→8831)
DEV_API_PORT=8830
DEV_APP_PORT=8831

# ── Colors ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
AMBER='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "  ${GREEN}[✓]${NC} $1"; }
warn() { echo -e "  ${AMBER}[!]${NC} $1"; }
err()  { echo -e "  ${RED}[✕]${NC} $1"; }
info() { echo -e "  ${BLUE}[·]${NC} $1"; }

print_banner() {
    echo -e "${CYAN}"
    echo "  ╔══════════════════════════════════════╗"
    echo "  ║   CLAUDE-DEV // DEV FORK MANAGER     ║"
    echo "  ║   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   ║"
    echo "  ╚══════════════════════════════════════╝"
    echo -e "${NC}"
}

# ── FORK: Create claude-dev from claude ───────────────────────────────
do_fork() {
    print_banner
    info "Forking claude → claude-dev..."

    if [ -d "$DEV_DIR" ]; then
        warn "claude-dev already exists at $DEV_DIR"
        read -p "  Overwrite? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            info "Aborted."
            return 1
        fi
        rm -rf "$DEV_DIR"
    fi

    # Copy the full module structure
    mkdir -p "$DEV_DIR"

    # Copy source directories
    for dir in claude api app scripts tests; do
        if [ -d "$CLAUDE_DIR/$dir" ]; then
            cp -r "$CLAUDE_DIR/$dir" "$DEV_DIR/$dir"
            log "Copied $dir/"
        fi
    done

    # Copy root files
    for f in requirements.txt Dockerfile; do
        if [ -f "$CLAUDE_DIR/$f" ]; then
            cp "$CLAUDE_DIR/$f" "$DEV_DIR/$f"
        fi
    done

    # Generate dev config.json (rewrite name, ports, URLs)
    python3 -c "
import json, os
src = '$CLAUDE_DIR/config.json'
dst = '$DEV_DIR/config.json'
with open(src) as f:
    cfg = json.load(f)
cfg['name'] = 'claude-dev'
cfg['description'] = 'DEV FORK — ' + cfg.get('description', '')
cfg['port'] = $DEV_API_PORT
cfg['urls'] = {
    'app': 'http://localhost:$DEV_APP_PORT',
    'api': 'http://localhost:$DEV_API_PORT'
}
cfg['fork_source'] = 'claude'
cfg['is_dev'] = True
with open(dst, 'w') as f:
    json.dump(cfg, f, indent=2)
print('  [✓] Generated dev config.json')
"

    # Generate dev start.sh
    cat > "$DEV_DIR/start.sh" << 'STARTEOF'
#!/bin/bash
cd "$(dirname "$0")"
bash stop.sh 2>/dev/null
bash api/start.sh &
API_PID=$!
bash app/start.sh &
APP_PID=$!
trap "kill $API_PID $APP_PID 2>/dev/null" EXIT
echo "DEV API:  http://localhost:8830"
echo "DEV App:  http://localhost:8831"
echo "Press Ctrl+C to stop."
wait
STARTEOF
    chmod +x "$DEV_DIR/start.sh"

    # Generate dev stop.sh
    cat > "$DEV_DIR/stop.sh" << 'STOPEOF'
#!/bin/bash
lsof -ti:8830 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:8831 2>/dev/null | xargs kill -9 2>/dev/null || true
pkill -f "claude-jobs 8830" 2>/dev/null || true
echo "claude-dev stopped."
STOPEOF
    chmod +x "$DEV_DIR/stop.sh"

    # Patch api/start.sh to use dev port
    if [ -f "$DEV_DIR/api/start.sh" ]; then
        sed -i '' "s/8820/$DEV_API_PORT/g" "$DEV_DIR/api/start.sh" 2>/dev/null || \
        sed -i "s/8820/$DEV_API_PORT/g" "$DEV_DIR/api/start.sh"
    fi

    # Patch scripts/start.sh to use dev ports
    if [ -f "$DEV_DIR/scripts/start.sh" ]; then
        sed -i '' "s/BACKEND_PORT=8820/BACKEND_PORT=$DEV_API_PORT/g; s/FRONTEND_PORT=8821/FRONTEND_PORT=$DEV_APP_PORT/g" \
            "$DEV_DIR/scripts/start.sh" 2>/dev/null || \
        sed -i "s/BACKEND_PORT=8820/BACKEND_PORT=$DEV_API_PORT/g; s/FRONTEND_PORT=8821/FRONTEND_PORT=$DEV_APP_PORT/g" \
            "$DEV_DIR/scripts/start.sh"
        # Update banner
        sed -i '' 's/CLAUDE JOBS/CLAUDE-DEV/g' "$DEV_DIR/scripts/start.sh" 2>/dev/null || \
        sed -i 's/CLAUDE JOBS/CLAUDE-DEV/g' "$DEV_DIR/scripts/start.sh"
    fi

    # Patch app to point at dev API port
    if [ -f "$DEV_DIR/app/src/app/page.tsx" ]; then
        sed -i '' "s/localhost:8820/localhost:$DEV_API_PORT/g" "$DEV_DIR/app/src/app/page.tsx" 2>/dev/null || \
        sed -i "s/localhost:8820/localhost:$DEV_API_PORT/g" "$DEV_DIR/app/src/app/page.tsx"
    fi

    # Generate dev docker-compose.yml
    cat > "$DEV_DIR/docker-compose.yml" << DEOF
networks:
  default:
    external: true
    name: modnet
services:
  claude-dev:
    container_name: claude-dev
    deploy: {}
    entrypoint: bash -c "m serve port=${DEV_API_PORT} key=claude-dev remote=0 mod=claude-dev"
    image: claude
    ports:
    - ${DEV_API_PORT}:${DEV_API_PORT}
    restart: unless-stopped
    shm_size: 100g
    volumes:
    - ~/mod:/root/mod
    - ~/.mod:/root/.mod
    - ~/mod/mod/_orbit/claude-dev:/root/mod/mod/_orbit/claude-dev
    working_dir: /root/mod/mod/_orbit/claude-dev
version: '3.8'
DEOF

    # Create .dev_meta tracking file
    python3 -c "
import json, time, hashlib, os

def hash_dir(path):
    h = hashlib.sha256()
    for root, dirs, files in os.walk(path):
        dirs[:] = [d for d in dirs if d not in ('node_modules', 'target', '.git', '__pycache__', '.next')]
        for f in sorted(files):
            fp = os.path.join(root, f)
            try:
                h.update(open(fp, 'rb').read())
            except:
                pass
    return h.hexdigest()[:16]

meta = {
    'created': time.strftime('%Y-%m-%d %H:%M:%S'),
    'source': 'claude',
    'source_hash': hash_dir('$CLAUDE_DIR'),
    'dev_hash': hash_dir('$DEV_DIR'),
    'syncs': []
}
with open('$DEV_DIR/.dev_meta.json', 'w') as f:
    json.dump(meta, f, indent=2)
print('  [✓] Created .dev_meta.json tracking file')
"

    # Init git in dev fork
    (cd "$DEV_DIR" && git init -q && git add -A && git commit -q -m "fork: initial claude-dev from claude")
    log "Initialized git repo in claude-dev"

    echo ""
    echo -e "  ${GREEN}${BOLD}═══════════════════════════════════════${NC}"
    echo -e "  ${GREEN}${BOLD}  CLAUDE-DEV FORKED SUCCESSFULLY${NC}"
    echo -e "  ${GREEN}${BOLD}═══════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${AMBER}Location${NC}  → ${BOLD}$DEV_DIR${NC}"
    echo -e "  ${AMBER}API Port${NC}  → ${BOLD}$DEV_API_PORT${NC}"
    echo -e "  ${AMBER}App Port${NC}  → ${BOLD}$DEV_APP_PORT${NC}"
    echo ""
    echo -e "  ${DIM}Deploy:  ./scripts/dev.sh deploy${NC}"
    echo -e "  ${DIM}Sync:    ./scripts/dev.sh sync${NC}"
    echo ""
}

# ── DEPLOY: Start the dev fork ────────────────────────────────────────
do_deploy() {
    print_banner

    if [ ! -d "$DEV_DIR" ]; then
        err "claude-dev not found. Run: ./scripts/dev.sh fork"
        return 1
    fi

    info "Deploying claude-dev..."

    # Kill existing dev processes
    lsof -ti:$DEV_API_PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
    lsof -ti:$DEV_APP_PORT 2>/dev/null | xargs kill -9 2>/dev/null || true

    # Start via the scripts/start.sh if available, otherwise start.sh
    if [ -f "$DEV_DIR/scripts/start.sh" ]; then
        bash "$DEV_DIR/scripts/start.sh" &
    else
        bash "$DEV_DIR/start.sh" &
    fi

    echo ""
    echo -e "  ${GREEN}${BOLD}═══════════════════════════════════════${NC}"
    echo -e "  ${GREEN}${BOLD}  CLAUDE-DEV DEPLOYED${NC}"
    echo -e "  ${GREEN}${BOLD}═══════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${AMBER}DEV Frontend${NC}  → ${BOLD}http://localhost:$DEV_APP_PORT${NC}"
    echo -e "  ${BLUE}DEV Backend${NC}   → ${BOLD}http://localhost:$DEV_API_PORT${NC}"
    echo ""
}

# ── SYNC: Pull changes from claude → claude-dev + IPFS track ─────────
do_sync() {
    print_banner

    if [ ! -d "$DEV_DIR" ]; then
        err "claude-dev not found. Run: ./scripts/dev.sh fork"
        return 1
    fi

    info "Syncing claude → claude-dev..."

    # Files/dirs to sync (source code only, not node_modules/target/build artifacts)
    SYNC_DIRS="claude api/src api/Cargo.toml api/Cargo.lock"
    SYNC_FILES="config.json requirements.txt"

    # Sync source directories
    for item in $SYNC_DIRS; do
        src="$CLAUDE_DIR/$item"
        dst="$DEV_DIR/$item"
        if [ -e "$src" ]; then
            if [ -d "$src" ]; then
                rsync -a --delete \
                    --exclude='node_modules' \
                    --exclude='target' \
                    --exclude='.next' \
                    --exclude='__pycache__' \
                    "$src/" "$dst/"
            else
                cp "$src" "$dst"
            fi
            log "Synced $item"
        fi
    done

    # Sync app source (but not node_modules/.next)
    rsync -a --delete \
        --exclude='node_modules' \
        --exclude='.next' \
        --exclude='__pycache__' \
        "$CLAUDE_DIR/app/src/" "$DEV_DIR/app/src/"
    log "Synced app/src/"

    # Re-apply dev port patches after sync
    if [ -f "$DEV_DIR/app/src/app/page.tsx" ]; then
        sed -i '' "s/localhost:8820/localhost:$DEV_API_PORT/g" "$DEV_DIR/app/src/app/page.tsx" 2>/dev/null || \
        sed -i "s/localhost:8820/localhost:$DEV_API_PORT/g" "$DEV_DIR/app/src/app/page.tsx"
    fi

    # Re-generate dev config (keep dev ports/name but update everything else from source)
    python3 -c "
import json
src_cfg = json.load(open('$CLAUDE_DIR/config.json'))
dev_cfg = json.load(open('$DEV_DIR/config.json'))
# Merge: take source schema/fns/endpoints but keep dev identity
src_cfg['name'] = 'claude-dev'
src_cfg['description'] = 'DEV FORK — ' + src_cfg.get('description', '').replace('DEV FORK — ', '')
src_cfg['port'] = $DEV_API_PORT
src_cfg['urls'] = {'app': 'http://localhost:$DEV_APP_PORT', 'api': 'http://localhost:$DEV_API_PORT'}
src_cfg['fork_source'] = 'claude'
src_cfg['is_dev'] = True
with open('$DEV_DIR/config.json', 'w') as f:
    json.dump(src_cfg, f, indent=2)
"
    log "Regenerated dev config.json"

    # IPFS snapshot of the sync state
    info "Storing sync snapshot to IPFS..."
    SYNC_CID=$(python3 -c "
import sys, os
sys.path.insert(0, '$CLAUDE_DIR')
os.chdir('$CLAUDE_DIR')
try:
    import mod as m
    ipfs = m.mod('ipfs')()
    import json, time, hashlib

    def hash_dir(path):
        h = hashlib.sha256()
        for root, dirs, files in os.walk(path):
            dirs[:] = [d for d in dirs if d not in ('node_modules', 'target', '.git', '__pycache__', '.next')]
            for f in sorted(files):
                fp = os.path.join(root, f)
                try:
                    h.update(open(fp, 'rb').read())
                except:
                    pass
        return h.hexdigest()

    snapshot = {
        'type': 'dev_sync',
        'source': 'claude',
        'target': 'claude-dev',
        'timestamp': time.time(),
        'date': time.strftime('%Y-%m-%d %H:%M:%S'),
        'source_hash': hash_dir('$CLAUDE_DIR'),
        'dev_hash': hash_dir('$DEV_DIR'),
    }

    # Include key source files
    import glob as g
    files = {}
    for pattern in ['claude/*.py', 'config.json', 'api/src/*.rs', 'api/Cargo.toml']:
        for fp in g.glob(os.path.join('$CLAUDE_DIR', pattern)):
            try:
                rel = os.path.relpath(fp, '$CLAUDE_DIR')
                files[rel] = open(fp).read()
            except:
                pass
    snapshot['files'] = files
    snapshot['file_count'] = len(files)

    cid = ipfs.put(snapshot)
    print(cid)
except Exception as e:
    print(f'IPFS_ERROR:{e}', file=sys.stderr)
    print('none')
" 2>/dev/null)

    if [ "$SYNC_CID" != "none" ] && [ -n "$SYNC_CID" ]; then
        log "IPFS sync snapshot: $SYNC_CID"

        # Update .dev_meta.json
        python3 -c "
import json, time
meta_path = '$DEV_DIR/.dev_meta.json'
try:
    meta = json.load(open(meta_path))
except:
    meta = {'created': time.strftime('%Y-%m-%d %H:%M:%S'), 'source': 'claude', 'syncs': []}
meta['last_sync'] = time.strftime('%Y-%m-%d %H:%M:%S')
meta['last_sync_cid'] = '$SYNC_CID'
meta['syncs'].append({
    'date': time.strftime('%Y-%m-%d %H:%M:%S'),
    'cid': '$SYNC_CID',
    'gateway': 'https://ipfs.io/ipfs/$SYNC_CID'
})
# Keep last 50 syncs
meta['syncs'] = meta['syncs'][-50:]
with open(meta_path, 'w') as f:
    json.dump(meta, f, indent=2)
"
    else
        warn "IPFS not available — sync completed without snapshot"
    fi

    # Git commit in dev fork
    (cd "$DEV_DIR" && git add -A && git commit -q -m "sync: from claude @ $(date '+%Y-%m-%d %H:%M')" 2>/dev/null) || true
    log "Git commit in claude-dev"

    echo ""
    echo -e "  ${GREEN}${BOLD}═══════════════════════════════════════${NC}"
    echo -e "  ${GREEN}${BOLD}  SYNC COMPLETE${NC}"
    echo -e "  ${GREEN}${BOLD}═══════════════════════════════════════${NC}"
    echo ""
    if [ "$SYNC_CID" != "none" ] && [ -n "$SYNC_CID" ]; then
        echo -e "  ${AMBER}IPFS CID${NC}  → ${BOLD}$SYNC_CID${NC}"
        echo -e "  ${DIM}Gateway${NC}   → https://ipfs.io/ipfs/$SYNC_CID"
    fi
    echo -e "  ${DIM}Dev dir${NC}   → $DEV_DIR"
    echo ""
}

# ── STOP: Stop the dev fork ───────────────────────────────────────────
do_stop() {
    print_banner
    info "Stopping claude-dev..."
    lsof -ti:$DEV_API_PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
    lsof -ti:$DEV_APP_PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
    pkill -f "claude-jobs $DEV_API_PORT" 2>/dev/null || true
    log "claude-dev stopped."
}

# ── STATUS: Show dev fork info ────────────────────────────────────────
do_status() {
    print_banner

    if [ ! -d "$DEV_DIR" ]; then
        err "claude-dev not found. Run: ./scripts/dev.sh fork"
        return 1
    fi

    echo -e "  ${BOLD}Location:${NC}  $DEV_DIR"

    # Check if running
    API_RUNNING=$(lsof -ti:$DEV_API_PORT 2>/dev/null)
    APP_RUNNING=$(lsof -ti:$DEV_APP_PORT 2>/dev/null)

    if [ -n "$API_RUNNING" ]; then
        echo -e "  ${GREEN}API:${NC}       running on :$DEV_API_PORT (PID $API_RUNNING)"
    else
        echo -e "  ${RED}API:${NC}       not running"
    fi

    if [ -n "$APP_RUNNING" ]; then
        echo -e "  ${GREEN}App:${NC}       running on :$DEV_APP_PORT (PID $APP_RUNNING)"
    else
        echo -e "  ${RED}App:${NC}       not running"
    fi

    # Show meta
    if [ -f "$DEV_DIR/.dev_meta.json" ]; then
        echo ""
        python3 -c "
import json
meta = json.load(open('$DEV_DIR/.dev_meta.json'))
print(f'  Created:    {meta.get(\"created\", \"unknown\")}')
print(f'  Source:     {meta.get(\"source\", \"unknown\")}')
print(f'  Last sync:  {meta.get(\"last_sync\", \"never\")}')
if meta.get('last_sync_cid'):
    print(f'  Sync CID:   {meta[\"last_sync_cid\"]}')
print(f'  Total syncs: {len(meta.get(\"syncs\", []))}')
"
    fi

    # Show git status
    echo ""
    echo -e "  ${BOLD}Git:${NC}"
    (cd "$DEV_DIR" && git log --oneline -5 2>/dev/null | while read line; do
        echo "    $line"
    done)
    echo ""
}

# ── DIFF: Show diff between claude and claude-dev ─────────────────────
do_diff() {
    print_banner

    if [ ! -d "$DEV_DIR" ]; then
        err "claude-dev not found. Run: ./scripts/dev.sh fork"
        return 1
    fi

    info "Comparing claude vs claude-dev..."
    echo ""

    # Diff key source dirs
    for dir in claude api/src app/src; do
        if [ -d "$CLAUDE_DIR/$dir" ] && [ -d "$DEV_DIR/$dir" ]; then
            CHANGES=$(diff -rq "$CLAUDE_DIR/$dir" "$DEV_DIR/$dir" \
                --exclude='node_modules' --exclude='target' --exclude='.next' \
                --exclude='__pycache__' --exclude='.git' 2>/dev/null | head -20)
            if [ -n "$CHANGES" ]; then
                echo -e "  ${AMBER}$dir/:${NC}"
                echo "$CHANGES" | while read line; do
                    echo "    $line"
                done
                echo ""
            else
                echo -e "  ${GREEN}$dir/:${NC} identical"
            fi
        fi
    done
}

# ── Main dispatcher ───────────────────────────────────────────────────
case "${1:-help}" in
    fork)    do_fork ;;
    deploy)  do_deploy ;;
    sync)    do_sync ;;
    stop)    do_stop ;;
    status)  do_status ;;
    diff)    do_diff ;;
    help|*)
        print_banner
        echo "  Usage: $0 <command>"
        echo ""
        echo "  Commands:"
        echo "    fork      Create claude-dev fork from claude"
        echo "    deploy    Deploy (start) the dev version"
        echo "    sync      Sync claude → claude-dev + IPFS snapshot"
        echo "    stop      Stop the dev version"
        echo "    status    Show dev fork status & sync history"
        echo "    diff      Show diff between claude and claude-dev"
        echo ""
        ;;
esac
