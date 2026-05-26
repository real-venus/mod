#!/bin/bash
# Re-extract the Claude Code OAuth token from the macOS Keychain into
# ~/.claude/.credentials.json so the bind-mounted container picks up the
# refreshed accessToken. Idempotent: skips the write if the token hasn't
# changed, so unnecessary inotify churn is avoided.
#
# Wired by ~/Library/LaunchAgents/com.mod.claude.creds-sync.plist (every 15m).
set -euo pipefail

CRED_FILE="$HOME/.claude/.credentials.json"

if ! NEW=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null); then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] keychain entry not found — skipping" >&2
    exit 0
fi

if [ -f "$CRED_FILE" ]; then
    OLD=$(cat "$CRED_FILE")
    if [ "$NEW" = "$OLD" ]; then
        exit 0
    fi
fi

mkdir -p "$(dirname "$CRED_FILE")"
printf '%s' "$NEW" > "$CRED_FILE"
chmod 600 "$CRED_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] credentials updated"
