#!/bin/bash
# Bring up survivor containers on iamfaulty-mini after OrbStack migration.
# Most stacks now run on minifw (192.168.68.64) or Pi 5.
# Called by ai.iamfaulty.homelab-boot LaunchAgent on login (if still used).
#
# Expected survivors only: iMessage bridge, OpenClaw, inference worker.
# Do NOT start homepage, arr, jellyfin, edge DNS, or caddy here.

export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH
LOG=/tmp/stack-up.log

echo "=== stack-up (mini survivors): $(date) ===" >> "$LOG"

# Wait for OrbStack only while it is still required for OpenClaw/bridge/worker.
# Once those run outside Docker / OrbStack is quit, disable this LaunchAgent.
if command -v orbctl >/dev/null 2>&1; then
  until orbctl status 2>/dev/null | grep -q "Running"; do
    echo "Waiting for OrbStack..." >> "$LOG"
    sleep 3
  done
  echo "OrbStack ready." >> "$LOG"
fi

# OpenClaw — standalone compose after agent-stack split
OPENCLAW_COMPOSE="${OPENCLAW_COMPOSE:-$HOME/openclaw/docker-compose.yml}"
if [ -f "$OPENCLAW_COMPOSE" ]; then
  echo "Starting openclaw..." >> "$LOG"
  docker compose -f "$OPENCLAW_COMPOSE" up -d >> "$LOG" 2>&1 \
    && echo "  openclaw: ok" >> "$LOG" \
    || echo "  openclaw: FAILED" >> "$LOG"
else
  echo "WARN: $OPENCLAW_COMPOSE missing — split agent stack first." >> "$LOG"
fi

# Optional: iMessage bridge / inference worker compose paths (set if used)
for extra in \
  "${IMESSAGE_BRIDGE_COMPOSE:-}" \
  "${INFERENCE_WORKER_COMPOSE:-}"; do
  [ -n "$extra" ] && [ -f "$extra" ] || continue
  name=$(basename "$(dirname "$extra")")
  echo "Starting $name..." >> "$LOG"
  docker compose -f "$extra" up -d >> "$LOG" 2>&1 \
    && echo "  $name: ok" >> "$LOG" \
    || echo "  $name: FAILED" >> "$LOG"
done

echo "=== done: $(date) ===" >> "$LOG"
docker ps --format "table {{.Names}}\t{{.Status}}" >> "$LOG" 2>/dev/null || true
