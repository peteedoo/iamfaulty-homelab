#!/bin/bash
# Bring up the full iamfaulty homelab stack.
# Called by ai.iamfaulty.homelab-boot LaunchAgent on login.
# Runs silently — logs to /tmp/stack-up.log, no UI windows opened.

export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH
LOG=/tmp/stack-up.log
COMPOSE=/Volumes/homelab/compose

echo "=== stack-up: $(date) ===" >> "$LOG"

# Wait for OrbStack without opening its UI
until orbctl status 2>/dev/null | grep -q "Running"; do
  echo "Waiting for OrbStack..." >> "$LOG"
  sleep 3
done
echo "OrbStack ready." >> "$LOG"

# Mount NAS without opening Finder
if [ ! -d "$COMPOSE" ]; then
  echo "Mounting NAS..." >> "$LOG"
  /usr/bin/osascript -e 'mount volume "smb://ILLMATIC.local/homelab"' >> "$LOG" 2>&1
  for i in $(seq 1 30); do
    [ -d "$COMPOSE" ] && break
    sleep 2
  done
fi

if [ ! -d "$COMPOSE" ]; then
  echo "NAS not mounted after 60s — aborting." >> "$LOG"
  exit 1
fi
echo "NAS mounted." >> "$LOG"

# Ensure shared proxy network exists
docker network create proxy 2>/dev/null || true

# Bring up all stacks (order: infrastructure first, then media, then apps)
STACKS=(
  portainer
  npm
  gitea
  watchtower
  duplicati
  jellyfin
  arr
  homepage
  dozzle
  beszel
  daily-brief
  anythingllm
  board
  dashboard
  portfolio
)

for stack in "${STACKS[@]}"; do
  echo "Starting $stack..." >> "$LOG"
  docker compose -f "$COMPOSE/$stack/docker-compose.yml" up -d >> "$LOG" 2>&1 \
    && echo "  $stack: ok" >> "$LOG" \
    || echo "  $stack: FAILED" >> "$LOG"
done

echo "=== done: $(date) ===" >> "$LOG"
docker ps --format "table {{.Names}}\t{{.Status}}" >> "$LOG"
