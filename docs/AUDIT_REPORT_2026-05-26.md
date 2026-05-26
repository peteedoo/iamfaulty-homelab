# Homelab Stack Audit Report — 2026-05-26

> **Status:** In progress. Items marked ✅ are fixed. Items marked ⚠️ need attention or user decision.

---

## Critical Security Findings

### 1. Home Directory is a Git Repo (FIXED — MONITOR)
**Finding:** The entire `/Users/peteedoo` directory is initialized as a git repository. It had only a 1-line `.gitignore` (`.smbdelete*`), meaning any new file in the home directory could accidentally be committed.

**Risk:** API keys, SSH keys, cloud credentials, and container configs could be committed to git history.

**Fix applied:** Added a comprehensive `.gitignore` to `~/.gitignore` that ignores:
- All `.env` files, `config.xml`, `settings.json`
- SSH keys, `.docker/`, `.aws/`, cloud credentials
- Arr stack configs, AI framework credentials
- Node modules, Python venvs, build artifacts
- Database files, backup files, temp files

**Action needed:**
- ⚠️ Consider whether the home directory should be a git repo at all. If not, run `rm -rf ~/.git` and move tracked files (`PORTFOLIO.md`, `homelab-data/docs/`, etc.) into `iamfaulty-homelab` or a separate notes repo.
- ⚠️ Verify no secrets were ever committed: `git -C ~ log --all --name-only` (already checked — only docs were found, no secrets).

---

## Fixes Applied Today

### ✅ Config File Permissions
**Finding:** All arr app `config.xml` files, `.env` files, and `slskd.yml` were world-readable (`644`).

**Files fixed:**
- `~/homelab-data/arr/{prowlarr,radarr,readarr,lidarr,sonarr}/config.xml`
- `~/homelab-data/arr/jellyseerr/settings.json`
- `~/homelab-data/arr-stack/.env`
- `~/homelab-data/faulty-orchestrator/.env`
- `~/homelab-data/bin/.dj-engine.env`
- `~/homelab-data/nas-compose-mirror/*/.env` (some were `777` — now `600`)

### ✅ Cloudflared Tunnel (Down for 2 Days)
**Finding:** The `cloudflared` container was `Exited (127)` for 2 days. External access to `*.iamfaulty.com` was completely broken.

**Root cause:** The container was originally created with a temp file mount (`/tmp/cloudflared-docker-config.yml:/etc/cloudflared/config.yml:ro`). After macOS cleaned up `/tmp`, the mount broke and the container could never restart.

**Fix:** Removed the broken container and recreated it with a proper directory mount:
```bash
docker run -d --name cloudflared --restart unless-stopped \
  -v /Users/peteedoo/.cloudflared:/Users/peteedoo/.cloudflared:ro \
  cloudflare/cloudflared:latest tunnel --config /Users/peteedoo/.cloudflared/config.yml run
```
**Note:** The config.yml uses macOS absolute paths (`/Users/peteedoo/.cloudflared/...`), so the container mount must preserve that exact path.

### ✅ slskd Default Password
**Finding:** `slskd.yml` had the literal default password `changeme123` for web UI authentication.

**Fix:** Changed to a secure random password. The config was updated and the container was restarted.

### ✅ Caddyfile Stale Routes
**Finding:** Multiple dead routes in `homelab-agent-stack/caddy/Caddyfile` pointing to non-existent services:
- `bazarr.iamfaulty.com` → 6767 (Bazarr not running)
- `us.iamfaulty.com` → 3009 (container removed)
- `agents.iamfaulty.com` → 8091 (no service)
- `openclaw.iamfaulty.com` → 18800 (wrong port, should be `openclaw-hub:18789`)
- `truth.iamfaulty.com` → `/srv/truth` (directory doesn't exist in Caddy container)
- `board.iamfaulty.com` and `mounts.iamfaulty.com` → 3335 (no listener)

**Fix:**
- Commented out bazarr, us, agents, board, mounts routes
- Fixed openclaw to proxy to `openclaw-hub:18789`
- Fixed truth to reverse proxy to `host.docker.internal:3008` (truth-site container)
- Reloaded Caddy config (validated successfully)

### ✅ Abandoned Containers Removed
- `us-app` — exited container, image built 2 days ago, no longer needed
- `anythingllm` — was in "Created" state but not running. Started successfully.

### ✅ Docker Cleanup
- Pruned orphaned networks (`us-app_default`, `arr_default`, `anythingllm_default`)
- Pruned Docker build cache: **reclaimed 33.14 GB**
- Removed stale images

---

## Remaining Issues

### ⚠️ 1. openclaw-hub Unhealthy
**Status:** Running but marked `unhealthy`

**Symptoms:**
- Telegram bot in a restart loop: `Conflict: terminated by other getUpdates request; make sure that only one bot instance is running`
- Heartbeat failing: `EACCES: permission denied, mkdir '/Users'`
- Healthcheck failing (32 consecutive failures)

**Likely causes:**
1. **Telegram bot conflict:** Another instance of the same bot token is running somewhere (another container, another machine, or a previous container that didn't shut down cleanly).
2. **Permission error:** The container is trying to create `/Users` inside the container. This is likely a volume mount or path configuration issue in the OpenClaw setup.

**Action needed:**
- Check if another OpenClaw container or process is running elsewhere
- Verify the Telegram bot token isn't being used by another instance
- Check OpenClaw's volume mounts and environment variables
- **Cannot fix without more context on OpenClaw's intended setup**

### ⚠️ 2. SSD at 93% Capacity
**Status:** `/System/Volumes/Data` (where home directory lives) is 93% full

**Breakdown of large consumers:**
| Location | Size | Notes |
|----------|------|-------|
| OrbStack VM (`data.img.raw`) | 17 GB | Docker runtime VM disk |
| Claude vm_bundles | 12 GB | AI agent VM bundles |
| Downloads | 7.9 GB | User downloads |
| Docker images (after prune) | 32 GB | 47 images, 6.8 GB reclaimable |
| Library/Caches | 5.2 GB | App caches |
| homelab-data | 10 GB | Container configs, media metadata |
| .nexo | 3.6 GB | Nexo AI framework |
| AnythingLLM image | 5 GB | Single container image |
| us-app image (orphaned) | 2.5 GB | Container was removed, image remains |

**Action needed:**
- Clean up `~/Downloads` (7.9 GB)
- Remove orphaned Docker images: `docker image prune -a` (would reclaim ~6.8 GB)
- Consider moving large AI model caches to NAS if possible
- OrbStack VM disk may need compaction via OrbStack settings

### ⚠️ 3. Outdated/Insecure Compose File (`homelab-data/apps/docker-compose.yml`)
**Finding:** This file is a monolithic compose that duplicates services already managed by `iamfaulty-homelab/compose/`. It has **worse security**:
- Planka `SECRET_KEY=planka-secret-key-change-me` (hardcoded default)
- Planka DB `POSTGRES_HOST_AUTH_METHOD=trust` (passwordless connections)
- No localhost bindings on ports (exposes directly to LAN)
- `board` service uses hardcoded `demo@demo.demo` / `demo` credentials

**Current state:** The running containers match the `iamfaulty-homelab` versions (localhost bindings, secure secrets), not this file. This file appears to be legacy.

**Action needed:**
- **Recommend archiving or deleting** `homelab-data/apps/docker-compose.yml` to prevent accidental use
- Migrate any unique services from this file into `iamfaulty-homelab/compose/` if needed

### ⚠️ 4. Missing `.env.example` for Board Stack
**Finding:** `iamfaulty-homelab/compose/board/` has no `.env.example` file.

**Action needed:** Create `.env.example` documenting required variables:
- `PLANKA_DB_PASSWORD`
- `PLANKA_SECRET_KEY`
- `PLANKA_BASE_URL`
- `PLANKA_ADMIN_EMAIL`
- `PLANKA_ADMIN_PASSWORD`
- `PLANKA_ADMIN_NAME`
- `PLANKA_ADMIN_USERNAME`

### ⚠️ 5. Config Drift: `homelab-data` vs `iamfaulty-homelab`
**Finding:** There are two parallel configuration trees:
1. `~/homelab-data/` — local SSD, live container data, some compose files
2. `~/iamfaulty-homelab/compose/` — git-tracked, NAS-mounted, brought up by `stack-up.sh`

**Examples of drift:**
- `homelab-data/arr-stack/docker-compose.yml` has FlareSolverr, Readarr, BookBounty, Huntorr, slskd, soularr, metube
- `iamfaulty-homelab/compose/arr/docker-compose.yml` lacks those services
- `homelab-data/apps/docker-compose.yml` is a legacy monolithic file
- `homelab-data/nas-compose-mirror/` appears to be a mirror but may be stale

**Risk:** Running `docker compose up` from the wrong directory could start duplicate or outdated services.

**Action needed:**
- Decide which directory is the source of truth for each service
- Remove or archive outdated compose files
- Update `stack-up.sh` if new services need to be added to the boot sequence

---

## Health Check Summary

| Service | Status | Notes |
|---------|--------|-------|
| cloudflared | ✅ Up | Tunnel restored, external access working |
| slskd | ✅ Up (healthy) | Password fixed |
| anythingllm | ✅ Up (healthy) | Was Created, now running |
| openclaw-hub | ⚠️ Up (unhealthy) | Telegram conflict + permission error |
| jellyfin | ✅ Up (healthy) | |
| metube | ✅ Up (healthy) | |
| homepage | ✅ Up (healthy) | |
| planka | ✅ Up (healthy) | |
| planka-db | ✅ Up (healthy) | |
| watchtower | ✅ Up (healthy) | |
| beszel | ✅ Up | |
| All *arr apps | ✅ Up | Radarr ulimits applied |

---

## Recommendations

### Immediate (This Week)
1. **Resolve openclaw-hub health** — Check for duplicate Telegram bot instances
2. **Free disk space** — Clean Downloads, prune Docker images, check OrbStack VM compaction
3. **Archive `homelab-data/apps/docker-compose.yml`** — It's insecure and duplicates current services

### Short Term (Next 2 Weeks)
4. **Consolidate compose files** — Decide on single source of truth per service
5. **Add `.env.example` to all compose directories** — board, arr, daily-brief, etc.
6. **Review Caddy routes quarterly** — Comment out or remove services that are permanently gone

### Long Term
7. **Consider removing home directory git repo** — Move docs into `iamfaulty-homelab` or a dedicated notes repo
8. **Set up automated disk monitoring** — Beszel can alert when disk > 85%
9. **Add healthchecks to all compose files** — Currently only some services have them
