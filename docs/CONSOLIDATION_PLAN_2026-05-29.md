# iamfaulty-homelab — Deep Analysis & Consolidation Plan
**Date:** 2026-05-29
**Analyst:** Subagent audit
**Scope:** All Docker compose files, configs, and documentation across iamfaulty-homelab, homelab-data, homelab-agent-stack, and related directories.

---

## 1. EXECUTIVE SUMMARY

The iamfaulty-homelab is a 40+ container media/automation stack running on a Mac mini M4 via OrbStack. It is currently fragmented across **4 independent sources** with significant config drift, stale archives, security debt, and operational complexity. This document catalogs every service, identifies all issues, and proposes a consolidation plan.

**Current container count:** 40 running containers (from `docker ps`)
**Active compose files:** 15+ across 3 directory trees
**Networks:** 18 Docker networks (many orphaned/legacy)

---

## 2. HARDWARE & TOPOLOGY

| Node | Role | OS/Platform |
|------|------|-------------|
| Mac mini M4 (`iamfaulty-mini`) | Docker host, primary compute | macOS + OrbStack |
| UGREEN NAS (`ILLMATIC`, `192.168.68.69`) | Compose files, media library, persistent share | SMB |
| Raspberry Pi 5 | AdGuard Home, WireGuard | Linux |
| Raspberry Pi 4 | Media center (Kodi) | Linux |
| Raspberry Pi 3B | Home Assistant OS | HAOS |

**Storage layout:**
- `/Volumes/homelab/` — NAS mount (SMB), compose files source of truth
- `~/homelab-data/` — Local SSD, container configs/data volumes
- `~/homelab-agent-stack/` — Caddy reverse proxy + sync-server

---

## 3. COMPLETE SERVICE CATALOG

### 3.1 Media Stack (7 services)

| Service | Container | Image | Port | Network | Compose Source |
|---------|-----------|-------|------|---------|----------------|
| Jellyfin | jellyfin | `jellyfin/jellyfin:latest` | `8096` (0.0.0.0) | proxy + default | NAS `/Volumes/homelab/compose/jellyfin` |
| Jellyseerr | jellyseerr | `fallenbagel/jellyseerr:latest` | `5055` | proxy + default | `~/homelab-data/arr-stack/docker-compose.yml` |
| MeTube | metube | `ghcr.io/alexta69/metube:latest` | `8081` | default | `~/homelab-data/arr-stack/docker-compose.yml` |
| slskd | slskd | `slskd/slskd:latest` | `5030` (host) | host | `~/homelab-data/arr-stack/docker-compose.yml` |
| Soularr | soularr | `mrusse08/soularr:latest` | — | default | `~/homelab-data/arr-stack/docker-compose.yml` |
| qBittorrent | qbittorrent | `lscr.io/linuxserver/qbittorrent:latest` | `8080` | default | `~/homelab-data/arr-stack/docker-compose.yml` |
| BookBounty | bookbounty | `thewicklowwolf/bookbounty:latest` | `5000` | default | `~/homelab-data/arr-stack/docker-compose.yml` |
| Huntorr | huntorr | `thewicklowwolf/huntorr:latest` | `5002` | default | `~/homelab-data/arr-stack/docker-compose.yml` |

### 3.2 Arr Stack (10 services)

| Service | Container | Port | Network | Notes |
|---------|-----------|------|---------|-------|
| Prowlarr | prowlarr | `9696` | default | DNS: 1.1.1.1, 1.0.0.1 |
| Sonarr | sonarr | `8989` | default | |
| Radarr | radarr | `7878` | default | `ulimits.nofile: 65536` |
| Lidarr | lidarr | `8686` | default | `ulimits.nofile: 65536` |
| Mylar3 | mylar3 | `8090` | default | Comics manager |
| Readarr | readarr | `8787` | default | `0.4.0-develop` tag |
| FlareSolverr | flaresolverr | `8191` | default | Cloudflare bypass |
| slskd | slskd | `5030` (host) | host | Soulseek daemon |
| Soularr | soularr | — | default | Lidarr → slskd bridge |
| qBittorrent | qbittorrent | `8080` | default | Download client |

**All *arr apps use:** `PUID=501`, `PGID=20`, `TZ=America/Chicago`, `platform: linux/arm64`

### 3.3 Infrastructure (8 services)

| Service | Container | Image | Port | Network | Compose Source |
|---------|-----------|-------|------|---------|----------------|
| Nginx Proxy Manager | npm | `jc21/nginx-proxy-manager:latest` | `80`, `443`, `81` | default + proxy | NAS `/Volumes/homelab/compose/npm` |
| Portainer | portainer | `portainer/portainer-ce:latest` | `9000`, `9443` | default | NAS `/Volumes/homelab/compose/portainer` |
| Gitea | gitea | `gitea/gitea:latest` | `3000`, `2222` | default | NAS `/Volumes/homelab/compose/gitea` |
| Dozzle | dozzle | `amir20/dozzle:latest` | `8888` | proxy | NAS `/Volumes/homelab/compose/dozzle` |
| Beszel Hub | beszel | `henrygd/beszel:latest` | `8089` | proxy | NAS `/Volumes/homelab/compose/beszel` |
| Beszel Agent | beszel-agent | `henrygd/beszel-agent:latest` | `45876` | proxy | NAS `/Volumes/homelab/compose/beszel` |
| Watchtower | watchtower | `nickfedor/watchtower:latest` | — | default | NAS `/Volumes/homelab/compose/watchtower` |
| Duplicati | duplicati | `lscr.io/linuxserver/duplicati:latest` | `8200` | default | NAS `/Volumes/homelab/compose/duplicati` |

### 3.4 Custom Apps (10 services)

| Service | Container | Port | Network | Compose Source | Status |
|---------|-----------|------|---------|----------------|--------|
| daily-brief | daily-brief | `3003` | proxy | NAS `/Volumes/homelab/compose/daily-brief` | Running |
| dashboard | dashboard | `3004` | proxy | NAS `/Volumes/homelab/compose/dashboard` | Running (openclaw-hq:latest) |
| board (Planka) | planka | `3333` | — | NAS `/Volumes/homelab/compose/board` | Running + healthy |
| board-db | planka-db | `5432` (internal) | — | NAS `/Volumes/homelab/compose/board` | Running + healthy |
| board-dashboard | board-dashboard | `3334` | — | NAS `/Volumes/homelab/compose/board` | Running |
| portfolio | portfolio | `3001` | — | NAS `/Volumes/homelab/compose/portfolio` | Running |
| truth-site | truth-site | `3008` | — | `~/homelab-data/truth-site/docker-compose.yml` | Running |
| drip-api | drip-api | `3006` | — | `~/homelab-data/dripdrip/docker-compose.yml` | Running |
| drip-frontend | drip-frontend | `3007` | — | `~/homelab-data/dripdrip/docker-compose.yml` | Running |
| links-dashboard | links-dashboard | `3334` | stack-net | `~/homelab-data/links-dashboard/docker-compose.yml` | Running? Port conflict with board-dashboard |

### 3.5 Agent / Orchestration Stack (6 services)

| Service | Container | Port | Network | Compose Source |
|---------|-----------|------|---------|----------------|
| Caddy | caddy | `80`, `443` (127.0.0.1) | agent-stack | `~/homelab-agent-stack/docker-compose.yml` |
| sync-server | sync-server | `13001` (127.0.0.1) | agent-stack | `~/homelab-agent-stack/docker-compose.yml` |
| faulty-orchestrator | faulty-orchestrator | `8889` | agent-stack | `~/homelab-data/faulty-orchestrator/docker-compose.yml` |
| faulty-discord-bot | faulty-discord-bot | — | agent-stack | `~/homelab-data/faulty-orchestrator/docker-compose.yml` |
| faulty-telegram-bot | faulty-telegram-bot | — | agent-stack | `~/homelab-data/faulty-orchestrator/docker-compose.yml` |
| agent-network | agent-network | `8091` | default + proxy | `~/homelab-data/agent-network/docker-compose.yml` |

### 3.6 LLM / AI (1 service)

| Service | Container | Port | Notes |
|---------|-----------|------|-------|
| AnythingLLM | anythingllm | `3002` (0.0.0.0) | `mintplexlabs/anythingllm:latest`, healthy |

### 3.7 External / Other (3 services)

| Service | Container | Port | Notes |
|---------|-----------|------|-------|
| cloudflared | cloudflared | — | Docker container, tunnel ID `3727ea81-b7a2-484c-8de9-3e55ab1a050c` |
| stack-dashboard | stack-dashboard | `3336` | `~/homelab-data/stack-dashboard/docker-compose.yml` |
| Hermes Agent | hermes, hermes-dashboard | — | `~/.hermes/hermes-agent/docker-compose.yml`, `network_mode: host` |

---

## 4. NETWORK TOPOLOGY

### Active Networks (from `docker network ls`)

| Network | Driver | Used By | Status |
|---------|--------|---------|--------|
| `proxy` | bridge | npm, jellyfin, jellyseerr, dozzle, beszel, beszel-agent, daily-brief, dashboard, homepage, board-dashboard, agent-network | **Primary shared network** |
| `agent-stack` | bridge | caddy, sync-server, faulty-orchestrator, faulty-discord-bot, faulty-telegram-bot | Agent/orchestration mesh |
| `truth-net` | bridge | links-dashboard | Possibly stale |
| `arr-stack_default` | bridge | arr-stack containers | Live arr stack |
| `homelab-agent-stack_agent-stack` | bridge | caddy, sync-server | Live agent stack |
| `faulty-orchestrator_agent-stack` | bridge | faulty-orchestrator, bots | Live orchestrator |
| `anythingllm_default` | bridge | anythingllm | Orphaned? |
| `arr_default` | bridge | — | **ORPHANED** |
| `board_default` | bridge | — | **ORPHANED** |
| `duplicati_default` | bridge | — | **ORPHANED** |
| `gitea_default` | bridge | — | **ORPHANED** |
| `jellyfin_default` | bridge | — | **ORPHANED** |
| `npm_default` | bridge | — | **ORPHANED** |
| `portfolio_default` | bridge | — | **ORPHANED** |
| `portainer_default` | bridge | — | **ORPHANED** |
| `truth-site_default` | bridge | — | **ORPHANED** |
| `watchtower_default` | bridge | — | **ORPHANED** |

**Issue:** 10+ orphaned networks from previous container recreations. These consume resources and create confusion.

---

## 5. CONFIGURATION SOURCES — THE 4-SOURCE PROBLEM

The README correctly identifies that the live stack is assembled from 4 independent sources:

| Source | Location | What it runs | Trust Level |
|--------|----------|--------------|-------------|
| **1. Arr Stack** | `~/homelab-data/arr-stack/docker-compose.yml` | qBit, Gluetun (not in live), Radarr, Sonarr, Lidarr, Mylar3, Prowlarr, Readarr, Flaresolverr, Bookbounty, Huntorr, Soularr, slskd, metube, jellyseerr | **LIVE** |
| **2. Apps / Infra** | `/Volumes/homelab/compose/` (NAS Gitea repo) | Jellyfin, NPM, Portainer, Gitea, Planka, Homepage, Beszel, Duplicati, Watchtower, daily-brief, Dozzle, dashboard, board, portfolio, AnythingLLM | **LIVE** |
| **3. Agent Stack** | `~/homelab-agent-stack/docker-compose.yml` | Caddy (reverse proxy), sync-server | **LIVE** |
| **4. Truth Site** | `~/homelab-data/truth-site/docker-compose.yml` | Static site container | **LIVE** |
| **5. Orchestrator** | `~/homelab-data/faulty-orchestrator/docker-compose.yml` | faulty-orchestrator, discord-bot, telegram-bot | **LIVE** |
| **6. Dripdrip** | `~/homelab-data/dripdrip/docker-compose.yml` | drip-api, drip-frontend | **LIVE** |
| **7. Agent Network** | `~/homelab-data/agent-network/docker-compose.yml` | agent-network UI | **LIVE** |
| **8. Stack Dashboard** | `~/homelab-data/stack-dashboard/docker-compose.yml` | stack-dashboard | **LIVE** |
| **9. Links Dashboard** | `~/homelab-data/links-dashboard/docker-compose.yml` | links-dashboard | **LIVE?** |
| **10. Daily Brief** | `~/homelab-data/daily-brief/docker-compose.yml` | daily-brief (alt) | **STALE?** |
| **11. Pi3 DNS/VPN** | `~/homelab-data/pi3-dns-vpn/docker-compose.yml` | blocky, beszel-agent | **Pi3 only?** |
| **12. Hermes** | `~/.hermes/hermes-agent/docker-compose.yml` | hermes gateway, dashboard | **LIVE** |
| **13. us-app** | `~/homelab-data/us-app/docker-compose.yml` | us-app | **REMOVED** (container deleted) |
| **14. Archived apps** | `~/homelab-data/_ARCHIVED_2026-05-26/apps-docker-compose.yml` | Legacy monolithic compose | **ARCHIVED** |
| **15. Kimi OpenClaw** | `~/.kimi_openclaw/workspace/docker-compose.yml` | Gluetun + arr stack (alt config) | **STALE/EXPERIMENT** |
| **16. Downloads arr** | `~/Downloads/Kimi_Agent_Optimizing _arr Stack Configurations/docker-compose.yml` | Another arr stack variant | **STALE/EXPERIMENT** |

**Critical finding:** There are **16+ different compose files** for what should be a single coherent stack. This is a major operational risk.

---

## 6. ISSUES IDENTIFIED

### 6.1 Critical Issues

#### ISSUE-001: Config Drift — 16+ Compose Files for One Stack
**Severity:** CRITICAL
**Impact:** Running `docker compose up` from the wrong directory starts duplicates or outdated services. No single source of truth.
**Evidence:**
- `~/homelab-data/arr-stack/docker-compose.yml` = live arr stack
- `iamfaulty-homelab/_archive_stale_compose/arr/docker-compose.yml` = stale archive (missing flaresolverr, readarr, bookbounty, huntorr)
- `~/.kimi_openclaw/workspace/docker-compose.yml` = experimental gluetun variant with PUID=1000
- `~/Downloads/Kimi_Agent_Optimizing _arr Stack Configurations/docker-compose.yml` = another variant with NFS volume

#### ISSUE-002: Port Conflicts
**Severity:** HIGH
**Impact:** Multiple services claim the same host port.
**Evidence:**
| Port | Service 1 | Service 2 | Conflict? |
|------|-----------|-----------|-----------|
| `3001` | portfolio (127.0.0.1) | sync-server internal | No — different scopes |
| `3334` | board-dashboard (127.0.0.1) | links-dashboard (0.0.0.0) | **YES** — links-dashboard binds 0.0.0.0:3334 |
| `8091` | agent-network | — | Caddy has commented route |

#### ISSUE-003: Missing Gluetun VPN
**Severity:** HIGH
**Impact:** The live arr stack does NOT include Gluetun. qBittorrent runs on bridge network with `127.0.0.1:8080` binding. The reference compose in `~/.kimi_openclaw/workspace/docker-compose.yml` has a full Gluetun setup with WireGuard credentials hardcoded.
**Evidence:** Live `arr-stack/docker-compose.yml` has no Gluetun service. qBittorrent uses `networks: - default` not `network_mode: service:gluetun`.
**Question:** Is the VPN kill switch intentionally removed, or is this a config drift issue?

#### ISSUE-004: Inconsistent Port Bindings
**Severity:** MEDIUM
**Impact:** Some services bind `127.0.0.1` (secure), others bind `0.0.0.0` (exposed to LAN).
**Evidence:**
- `0.0.0.0:8096` — Jellyfin (intentional for LAN clients)
- `0.0.0.0:3002` — AnythingLLM (intentional?)
- `0.0.0.0:3008` — truth-site (intentional?)
- `0.0.0.0:3004` — dashboard (openclaw-hq) — **should this be 127.0.0.1?**
- `127.0.0.1:XXXX` — Most other services (correct)

#### ISSUE-005: Orphaned Networks
**Severity:** MEDIUM
**Impact:** 10+ orphaned Docker networks consuming resources and causing confusion.
**Evidence:** `arr_default`, `board_default`, `duplicati_default`, `gitea_default`, `jellyfin_default`, `npm_default`, `portfolio_default`, `portainer_default`, `truth-site_default`, `watchtower_default`, `anythingllm_default`.

#### ISSUE-006: Caddy vs NPM Double Proxy
**Severity:** MEDIUM
**Impact:** Two reverse proxies (Caddy + NPM) create complexity. Caddy binds `127.0.0.1:80/443`, NPM binds `0.0.0.0:80/443`. Cloudflared tunnel points to `localhost:80` (NPM).
**Evidence:**
- Caddyfile has 20+ routes but many are commented out
- NPM is the actual edge proxy receiving Cloudflared traffic
- Caddy is used for internal `*.iamfaulty.com` resolution on the host
**Question:** Is Caddy necessary, or could NPM handle everything?

#### ISSUE-007: Missing Healthchecks
**Severity:** MEDIUM
**Impact:** Many services lack Docker healthchecks, delaying failure detection.
**Evidence:** Services WITHOUT healthchecks in live compose:
- gitea, portainer, npm, jellyfin (has in reference but not archive), duplicati, watchtower, beszel, dozzle, homepage, daily-brief, board, portfolio, truth-site, anythingllm, drip-api, drip-frontend, faulty-orchestrator, bots, agent-network, stack-dashboard, links-dashboard

#### ISSUE-008: Stale Archive Has Wrong Configs
**Severity:** MEDIUM
**Impact:** `iamfaulty-homelab/_archive_stale_compose/` is explicitly marked stale but still contains compose files that could be mistaken for live configs.
**Evidence:** README says "Do not use" but the files are still in the repo. The arr compose there is missing 5 services and has wrong PUID.

#### ISSUE-009: Cloudflared Config Drift
**Severity:** MEDIUM
**Impact:** `ops/cloudflared-config.yml` in the repo differs from `~/.cloudflared/config.yml` on disk.
**Evidence:**
- Repo version has: `home.iamfaulty.com → localhost:3004`, `jellyfin.iamfaulty.com → localhost:8096`, `overseerr.iamfaulty.com → localhost:5055`
- Live config (from runbook) uses Docker container with `--dns 1.1.1.1` and separate config at `/tmp/cloudflared-docker-config.yml`
- The repo config does NOT match the live Docker-based setup

#### ISSUE-010: PUID Inconsistency in Experiments
**Severity:** LOW
**Impact:** The Kimi OpenClaw and Downloads variants use `PUID=1000` instead of `PUID=501`, which would cause permission mismatches if ever activated.
**Evidence:** `~/.kimi_openclaw/workspace/docker-compose.yml` and `~/Downloads/.../docker-compose.yml` both use `PUID=1000`.

#### ISSUE-011: board-dashboard vs links-dashboard Port Collision
**Severity:** HIGH
**Impact:** Both services attempt to use port 3334. board-dashboard binds `127.0.0.1:3334`, links-dashboard binds `0.0.0.0:3334`.
**Evidence:**
- `board/docker-compose.yml`: `127.0.0.1:3334:8000`
- `links-dashboard/docker-compose.yml`: `3334:3334` (no host IP = 0.0.0.0)
**Result:** links-dashboard would win on 0.0.0.0 but board-dashboard is the one actually running.

#### ISSUE-012: Missing `.env.example` Files
**Severity:** LOW
**Impact:** No documentation of required environment variables for most stacks.
**Evidence:** Only a few stacks have `.env` files. None have `.env.example` templates in the repo.

#### ISSUE-013: Daily Brief Duplicate
**Severity:** LOW
**Impact:** Two daily-brief compose files exist with different ports.
**Evidence:**
- NAS `/Volumes/homelab/compose/daily-brief/docker-compose.yml`: port `3003`
- `~/homelab-data/daily-brief/docker-compose.yml`: port `3337`

#### ISSUE-014: Agent Network Stale / Commented in Caddy
**Severity:** LOW
**Impact:** `agent-network` container runs on port `8091` but Caddy has the route commented out.
**Evidence:** Caddyfile line 95-98: `# @agents host agents.iamfaulty.com` is commented.

#### ISSUE-015: us-app Container Removed but Compose Remains
**Severity:** LOW
**Impact:** `~/homelab-data/us-app/docker-compose.yml` exists but container was removed in audit 2026-05-26.
**Evidence:** AUDIT_REPORT says "us-app — exited container, image built 2 days ago, no longer needed" and "Removed".

---

## 7. SECURITY FINDINGS

| Finding | Status | Details |
|---------|--------|---------|
| Home directory is a git repo | PARTIALLY FIXED | Comprehensive `.gitignore` added, but `~/.git` still exists |
| Config files world-readable | FIXED | Permissions set to 600 for `.env`, `config.xml`, `slskd.yml` |
| slskd default password | FIXED | Changed from `changeme123` |
| Cloudflared temp mount broken | FIXED | Recreated with proper directory mount |
| `apps-docker-compose.yml` insecure | ARCHIVED | Hardcoded `planka-secret-key-change-me`, `POSTGRES_HOST_AUTH_METHOD=trust`, no localhost bindings |
| WireGuard private key in compose | **EXPOSED** | `~/.kimi_openclaw/workspace/docker-compose.yml` contains `WIREGUARD_PRIVATE_KEY=kwnKtJ5OlFrymtKThJtUOT6VO0PiewKWUj9N9s6xW4s=` |

**CRITICAL:** The WireGuard private key in `~/.kimi_openclaw/workspace/docker-compose.yml` is a live credential. Even though this is an experimental file, the key should be rotated if it was ever used.

---

## 8. CONSOLIDATION PLAN

### Phase 1: Immediate (This Week)

#### 8.1.1 Unify Compose Files into a Single Monorepo
**Goal:** One directory tree, one `docker-compose.yml` per logical stack, all tracked in `iamfaulty-homelab`.

**Proposed structure:**
```
iamfaulty-homelab/
├── compose/
│   ├── 01-infra/                 # portainer, npm, watchtower, duplicati
│   ├── 02-monitoring/            # beszel, beszel-agent, dozzle
│   ├── 03-media/                 # jellyfin, jellyseerr, metube
│   ├── 04-arr/                   # qbittorrent, prowlarr, sonarr, radarr, lidarr, mylar3, readarr, flaresolverr, bookbounty, huntorr, slskd, soularr
│   ├── 05-apps/                  # gitea, planka, homepage, daily-brief, dashboard, board-dashboard, portfolio
│   ├── 06-agent/                 # caddy, sync-server
│   ├── 07-orchestrator/          # faulty-orchestrator, discord-bot, telegram-bot
│   ├── 08-custom/                # drip-api, drip-frontend, truth-site, agent-network, stack-dashboard, links-dashboard
│   └── 09-llm/                   # anythingllm
├── configs/                      # Caddyfile, cloudflared-config.yml, etc.
├── scripts/                      # stack-up.sh, disk-alert.sh, caddy-route-check.sh
├── docs/                         # API_REFERENCE.md, AGENT_TRAINING.md, runbooks
└── .env.example                  # Master env template
```

**Action items:**
1. Move all live compose files from `~/homelab-data/` and `/Volumes/homelab/compose/` into `iamfaulty-homelab/compose/`
2. Update `stack-up.sh` to use the new paths
3. Create symlinks from old locations to new ones (or update LaunchAgent)
4. Delete `_archive_stale_compose/` entirely (it's already marked stale)
5. Delete `~/homelab-data/_ARCHIVED_2026-05-26/`
6. Delete `~/.kimi_openclaw/workspace/docker-compose.yml` (or move to archive with secrets redacted)
7. Delete `~/Downloads/Kimi_Agent_Optimizing _arr Stack Configurations/` (or archive)

#### 8.1.2 Fix Port Conflicts
- [ ] Change `links-dashboard` port from `3334` to `3335` (or remove if unused)
- [ ] Verify no other port collisions exist

#### 8.1.3 Clean Orphaned Networks
```bash
docker network prune -f
# Or selectively:
docker network rm arr_default board_default duplicati_default gitea_default jellyfin_default npm_default portfolio_default portainer_default truth-site_default watchtower_default anythingllm_default
```

#### 8.1.4 Rotate Exposed WireGuard Key
- [ ] If the key in `~/.kimi_openclaw/workspace/docker-compose.yml` was ever used, rotate it in NordVPN
- [ ] Delete or redact the file

### Phase 2: Short Term (Next 2 Weeks)

#### 8.2.1 Decide on VPN Strategy
**Options:**
- **A:** Add Gluetun back to the arr stack (use the Kimi OpenClaw config as reference but with env vars)
- **B:** Keep qBittorrent on bridge without VPN (current state) — document why
- **C:** Use host-level VPN (Tailscale already running)

**Recommendation:** Option A with proper env-based secrets. The `network_mode: service:gluetun` pattern is well-documented and provides a true kill switch.

#### 8.2.2 Standardize Healthchecks
Add healthchecks to all services that support them:
- gitea: `wget --spider -q http://localhost:3000`
- portainer: `wget --spider -q http://localhost:9000`
- npm: `wget --spider -q http://localhost:81`
- jellyfin: `wget --spider -q http://localhost:8096`
- duplicati: `wget --spider -q http://localhost:8200`
- watchtower: internal API if enabled
- beszel: `wget --spider -q http://localhost:8090`
- dozzle: `wget --spider -q http://localhost:8080`
- homepage: `wget --spider -q http://localhost:3000`
- planka: `wget --spider -q http://localhost:1337`

#### 8.2.3 Add `.env.example` to Every Stack
Create `.env.example` files documenting all required variables.

#### 8.2.4 Resolve Caddy vs NPM Redundancy
**Options:**
- **A:** Keep both — Caddy for internal host resolution, NPM for external edge proxy
- **B:** Remove Caddy, use NPM for everything (NPM can route to `host.docker.internal`)
- **C:** Remove NPM, use Caddy for everything (Caddy can do SSL termination too)

**Recommendation:** Option A for now — Caddy is lightweight and useful for internal DNS. But document the architecture clearly.

#### 8.2.5 Fix Caddyfile Stale Routes
The Caddyfile in `reference/Caddyfile` has some routes already commented. Verify and clean:
- [ ] Remove commented routes for permanently deleted services (bazarr, us, agents, board, mounts)
- [ ] Verify `openclaw.iamfaulty.com` points to correct target
- [ ] Add `agent-network` route if it should be exposed

### Phase 3: Long Term (Next Month)

#### 8.3.1 Migrate to Docker Compose Profiles
Use Docker Compose profiles to group services:
```yaml
services:
  qbittorrent:
    profiles: ["arr", "media"]
  jellyfin:
    profiles: ["media"]
  npm:
    profiles: ["infra"]
```
This allows starting subsets: `docker compose --profile arr up -d`

#### 8.3.2 Implement GitOps for NAS Compose
The NAS `/Volumes/homelab/compose/` is described as a Gitea repo. Ensure:
- [ ] The NAS repo is the actual source of truth
- [ ] `iamfaulty-homelab` repo mirrors it (or vice versa)
- [ ] Automated sync or single source of truth established

#### 8.3.3 Add Monitoring & Alerting
- [ ] Beszel disk alert at 85% (currently at 93%)
- [ ] Container health alert via Beszel or custom script
- [ ] Cloudflared tunnel health check (from runbook)

#### 8.3.4 Document the "Holy Grail" Verification
The AGENT_TRAINING.md has a 10-item verification checklist. Implement it:
- [ ] All containers healthy
- [ ] All subdomain endpoints respond
- [ ] *arr apps can reach download client
- [ ] Indexers sync without errors
- [ ] Media scans complete without SMB timeouts
- [ ] Metadata writes to intended location
- [ ] Cloudflared tunnel maintains 4+ edge connections
- [ ] No database corruption errors
- [ ] Git repo reflects running state
- [ ] Backups are being created automatically

---

## 9. SERVICE DEPENDENCY MAP

```
Internet
    |
Cloudflare Tunnel (cloudflared) — tunnel ID 3727ea81-b7a2-484c-8de9-3e55ab1a050c
    |
NPM (0.0.0.0:80/443)  ←—— OR ——→  Caddy (127.0.0.1:80/443) [internal only]
    |                                    |
    |                                    ├── jellyfin.iamfaulty.com → host.docker.internal:8096
    |                                    ├── qbit.iamfaulty.com → host.docker.internal:8080
    |                                    ├── sonarr.iamfaulty.com → host.docker.internal:8989
    |                                    ├── radarr.iamfaulty.com → host.docker.internal:7878
    |                                    ├── lidarr.iamfaulty.com → host.docker.internal:8686
    |                                    ├── prowlarr.iamfaulty.com → host.docker.internal:9696
    |                                    ├── jellyseerr.iamfaulty.com → host.docker.internal:5055
    |                                    ├── mylar.iamfaulty.com → host.docker.internal:8090
    |                                    ├── readarr.iamfaulty.com → host.docker.internal:8787
    |                                    ├── bookbounty.iamfaulty.com → host.docker.internal:5000
    |                                    ├── huntorr.iamfaulty.com → host.docker.internal:5002
    |                                    ├── metube.iamfaulty.com → host.docker.internal:8081
    |                                    ├── slskd.iamfaulty.com → host.docker.internal:5030
    |                                    ├── portainer.iamfaulty.com → host.docker.internal:9000
    |                                    ├── homepage.iamfaulty.com → host.docker.internal:3005
    |                                    ├── planka.iamfaulty.com → host.docker.internal:3333
    |                                    ├── status.iamfaulty.com → host.docker.internal:3004
    |                                    ├── links.iamfaulty.com → host.docker.internal:3334
    |                                    ├── beszel.iamfaulty.com → host.docker.internal:8089
    |                                    ├── git.iamfaulty.com → host.docker.internal:3000
    |                                    ├── sync.iamfaulty.com → sync-server:3001
    |                                    ├── truth.iamfaulty.com → host.docker.internal:3008
    |                                    ├── root / openclaw → host.docker.internal:18800
    |                                    └── fallback → host.docker.internal:18800
    |
    ├── jellyfin.iamfaulty.com → host.docker.internal:8096
    ├── request.iamfaulty.com → localhost:80 (NPM internal)
    ├── openclaw.iamfaulty.com → localhost:80 (NPM internal)
    ├── gitea.iamfaulty.com → localhost:80 (NPM internal)
    ├── plex.iamfaulty.com → localhost:32400
    ├── overseerr.iamfaulty.com → localhost:5055
    └── home.iamfaulty.com → localhost:3004

NAS (SMB /Volumes/homelab)
    ├── media/          → Jellyfin, arr apps
    ├── compose/        → Live compose files (source of truth)
    ├── wiki/           → Knowledge base
    └── backups/        → Duplicati targets

Local SSD (~/homelab-data)
    ├── arr/            → *arr app configs
    ├── jellyfin/       → Jellyfin config + cache
    ├── gitea/          → Gitea data
    ├── npm/            → NPM data + certs
    ├── portainer/      → Portainer data
    ├── planka/         → Planka data
    ├── duplicati/      → Duplicati config
    ├── anythingllm/    → LLM storage
    ├── slskd/          → Soulseek config
    ├── faulty-orchestrator/ → Orchestrator + bots
    └── ...
```

---

## 10. FILE INVENTORY

### 10.1 iamfaulty-homelab repo (33 files, excluding .git)

| Path | Type | Status |
|------|------|--------|
| `README.md` | Documentation | Current |
| `.gitignore` | Config | Current |
| `docs/AGENT_TRAINING.md` | Documentation | Current |
| `docs/API_REFERENCE.md` | Documentation | Current |
| `docs/AUDIT_REPORT_2026-05-26.md` | Documentation | Current |
| `ops/STARTUP.md` | Documentation | Current |
| `ops/DNS.md` | Documentation | Current |
| `ops/stack-up.sh` | Script | Current |
| `ops/caddy-route-check.sh` | Script | Current |
| `ops/disk-alert.sh` | Script | Current |
| `ops/cloudflared-config.yml` | Config | **STALE** (doesn't match live Docker setup) |
| `ops/runbooks/2026-05-23-cloudflared-tailscale-dns-fix.md` | Runbook | Current |
| `reference/README.md` | Documentation | Current |
| `reference/arr-stack-docker-compose.yml` | Backup | Current (matches live) |
| `reference/agent-stack-docker-compose.yml` | Backup | Current (matches live) |
| `reference/Caddyfile` | Backup | Current (matches live) |
| `status-reports/2026-05-19-openclaw-summary.md` | Report | Current |
| `_archive_stale_compose/README.md` | Documentation | Stale (marked) |
| `_archive_stale_compose/anythingllm/docker-compose.yml` | Archive | Stale |
| `_archive_stale_compose/arr/docker-compose.yml` | Archive | Stale (missing services) |
| `_archive_stale_compose/beszel/docker-compose.yml` | Archive | Stale |
| `_archive_stale_compose/board/docker-compose.yml` | Archive | Stale |
| `_archive_stale_compose/daily-brief/docker-compose.yml` | Archive | Stale |
| `_archive_stale_compose/dashboard/docker-compose.yml` | Archive | Stale |
| `_archive_stale_compose/dozzle/docker-compose.yml` | Archive | Stale |
| `_archive_stale_compose/duplicati/docker-compose.yml` | Archive | Stale |
| `_archive_stale_compose/gitea/docker-compose.yml` | Archive | Stale |
| `_archive_stale_compose/homepage/docker-compose.yml` | Archive | Stale |
| `_archive_stale_compose/jellyfin/docker-compose.yml` | Archive | Stale |
| `_archive_stale_compose/npm/docker-compose.yml` | Archive | Stale |
| `_archive_stale_compose/portainer/docker-compose.yml` | Archive | Stale |
| `_archive_stale_compose/portfolio/docker-compose.yml` | Archive | Stale |
| `_archive_stale_compose/watchtower/docker-compose.yml` | Archive | Stale |

### 10.2 Live compose files outside repo (15 files)

| Path | Services | Status |
|------|----------|--------|
| `~/homelab-data/arr-stack/docker-compose.yml` | Full arr stack | **LIVE** |
| `~/homelab-agent-stack/docker-compose.yml` | Caddy, sync-server | **LIVE** |
| `~/homelab-data/truth-site/docker-compose.yml` | truth-site | **LIVE** |
| `~/homelab-data/faulty-orchestrator/docker-compose.yml` | orchestrator, bots | **LIVE** |
| `~/homelab-data/dripdrip/docker-compose.yml` | drip-api | **LIVE** |
| `~/homelab-data/dripdrip/docker-compose.ollama.yml` | drip-api + ollama | **LIVE/ALT** |
| `~/homelab-data/agent-network/docker-compose.yml` | agent-network | **LIVE** |
| `~/homelab-data/stack-dashboard/docker-compose.yml` | stack-dashboard | **LIVE** |
| `~/homelab-data/links-dashboard/docker-compose.yml` | links-dashboard | **LIVE?** |
| `~/homelab-data/daily-brief/docker-compose.yml` | daily-brief (alt) | **STALE?** |
| `~/homelab-data/pi3-dns-vpn/docker-compose.yml` | blocky, beszel-agent | **Pi3 only** |
| `~/homelab-data/us-app/docker-compose.yml` | us-app | **REMOVED** |
| `~/.hermes/hermes-agent/docker-compose.yml` | hermes gateway, dashboard | **LIVE** |
| `~/.kimi_openclaw/workspace/docker-compose.yml` | gluetun + arr (alt) | **STALE/EXPERIMENT** |
| `~/Downloads/Kimi_Agent_Optimizing _arr Stack Configurations/docker-compose.yml` | arr (alt) | **STALE/EXPERIMENT** |

---

## 11. RECOMMENDATIONS SUMMARY

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| P0 | Consolidate all compose files into `iamfaulty-homelab/compose/` | High | Critical |
| P0 | Fix port conflict: links-dashboard vs board-dashboard | Low | High |
| P0 | Rotate exposed WireGuard key | Low | Critical |
| P1 | Clean orphaned Docker networks | Low | Medium |
| P1 | Decide on VPN strategy (Gluetun yes/no) | Medium | High |
| P1 | Update `ops/cloudflared-config.yml` to match live setup | Low | Medium |
| P2 | Add healthchecks to all services | Medium | Medium |
| P2 | Add `.env.example` to all stacks | Low | Medium |
| P2 | Document Caddy vs NPM architecture decision | Low | Medium |
| P3 | Implement Docker Compose profiles | Medium | Medium |
| P3 | Set up automated health monitoring | Medium | Medium |
| P3 | Complete "Holy Grail" verification checklist | Medium | High |

---

*End of Consolidation Plan*
