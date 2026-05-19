# Homelab Startup — Reference

## How it works

On login, one LaunchAgent fires:

```
ai.iamfaulty.homelab-boot
  → /Users/peteedoo/iamfaulty-homelab/ops/stack-up.sh
  → logs to /tmp/stack-up.log
```

That's it. One agent, one script, no terminal windows. Everything runs silently in the background.

The script does three things in order:
1. Waits for OrbStack to be ready (polls, no UI)
2. Mounts the NAS via AppleScript volume command (no Finder window)
3. Brings up all 15 stacks in dependency order

---

## Stack startup order

```
portainer       # Docker UI — first so you can see what's happening
npm             # Reverse proxy — needed for external access
gitea           # Self-hosted Git
watchtower      # Auto-updates — early so it catches everything
duplicati       # Backups
jellyfin        # Media server
arr             # Full arr stack (qBit, Radarr, Sonarr, Lidarr, Prowlarr, Jellyseerr, Lidarr, Mylar3, slskd, soularr, MeTube)
homepage        # Dashboard
dozzle          # Log viewer
beszel          # System monitoring
daily-brief     # Morning briefing
anythingllm     # Local LLM
board           # Planka kanban
dashboard       # Custom stack status page
portfolio       # Static site
```

---

## Checking status

```bash
# Quick: are all containers running?
docker ps --format "table {{.Names}}\t{{.Status}}" | sort

# What happened at last boot?
cat /tmp/stack-up.log

# Any errors?
cat /tmp/stack-up.err
```

---

## Bringing the stack up manually

```bash
# Full stack
bash ~/iamfaulty-homelab/ops/stack-up.sh

# Single stack
docker compose -f /Volumes/homelab/compose/<stack>/docker-compose.yml up -d

# Just the arr stack
docker compose -f /Volumes/homelab/compose/arr/docker-compose.yml up -d
```

---

## Common failure scenarios

### Nothing is running after login

**Most likely cause:** OrbStack hadn't finished starting when the script ran, or the NAS wasn't mounted yet.

```bash
# Check OrbStack
orbctl status

# Check NAS mount
ls /Volumes/homelab/compose/

# Re-run the startup script manually
bash ~/iamfaulty-homelab/ops/stack-up.sh
```

### NAS isn't mounted

```bash
# Mount it
osascript -e 'mount volume "smb://ILLMATIC.local/homelab"'

# Verify
ls /Volumes/homelab/
```

### A specific container is down

```bash
# Check why
docker logs <container-name>

# Restart it
docker compose -f /Volumes/homelab/compose/<stack>/docker-compose.yml up -d
```

### proxy network missing (containers can't reach each other)

```bash
docker network create proxy
```

Then restart any container that depends on it.

### OrbStack shows containers but they aren't in a specific stack's view

OrbStack groups containers by compose project. If a stack was started with `docker compose up` from a different working directory than usual, it may appear ungrouped. It's still running — `docker ps` is the source of truth.

---

## What was cleaned up (May 2026)

**Problem:** Two LaunchAgents were fighting each other and both had incomplete stack lists.

| Agent | What it did | Status |
|-------|-------------|--------|
| `ai.iamfaulty.homelab-boot` | Ran `stack-up.sh` silently | **Kept** — updated to point at `ops/stack-up.sh` |
| `com.iamfaulty.stack-check` | Opened a Terminal window at login via osascript | **Disabled** — was the source of the popup terminal |

The old `stack-up.sh` (`homelab-data/bin/stack-up.sh`) was incomplete — it only started 7 of 15 stacks and used `open smb://` which opened Finder. The new script covers all stacks and mounts silently.

`stack-check.sh` still exists at `homelab-data/bin/stack-check.sh` if you want to run a health check manually. It was a good script — just shouldn't have been wired to open Terminal on every login.

---

## Files

| File | Purpose |
|------|---------|
| `ops/stack-up.sh` | The startup script — source of truth |
| `~/Library/LaunchAgents/ai.iamfaulty.homelab-boot.plist` | Fires `stack-up.sh` at login |
| `/Volumes/homelab/compose/` | All compose files (on NAS) |
| `~/homelab-data/` | Container config/data volumes (on mini SSD) |
| `/tmp/stack-up.log` | Runtime log from last boot |
| `~/homelab-data/bin/stack-check.sh` | Manual health check script |
