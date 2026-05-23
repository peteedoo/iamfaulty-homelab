# Agent Stack Training: Homelab Infrastructure Operations

**Purpose:** Train AI agents on real-world homelab infrastructure diagnosis, repair, and evolution.  
**Derived from:** Live troubleshooting session covering Docker networking, SMB mounts, database corruption, DNS tunneling, and service mesh orchestration.  
**Audience:** AI agents operating in Docker-based homelab environments with Cloudflare tunneling, *arr stacks, and media servers.

---

## 1. Stack Architecture Overview

### 1.1 High-Level Topology

```
Internet
    |
Cloudflare Tunnel (cloudflared)
    |
Edge Proxy (Nginx Proxy Manager / Caddy)
    |--- wiki.*         (Cloudflare Pages / static site)
    |--- jellyfin.*     (media server)
    |--- qbit.*         (torrent client)
    |--- sonarr.*       (TV management)
    |--- radarr.*       (movie management)
    |--- lidarr.*       (music management)
    |--- prowlarr.*     (indexer aggregator)
    |--- gitea.*        (Git server)
    |--- ~20 other subdomains
    |
Docker Desktop (macOS / Linux host)
    |
    +-- Compose Stack: arr-services
    |   +-- qBittorrent     (torrent client)
    |   +-- Prowlarr        (indexer management)
    |   +-- Sonarr          (TV PVR)
    |   +-- Radarr          (movie PVR)
    |   +-- Lidarr          (music PVR)
    |   +-- Mylar3          (comic PVR)
    |   +-- Jellyseerr      (media request portal)
    |   +-- slskd           (Soulseek client)
    |   +-- soularr         (Soulseek automation)
    |   +-- metube          (YouTube downloader)
    |
    +-- Compose Stack: media-server
    |   +-- Jellyfin        (media streaming)
    |
    +-- Compose Stack: proxy
    |   +-- NPM / Caddy     (reverse proxy)
    |
NAS (SMB mount at /Volumes/homelab)
    +-- media/          (Movies, Music, Shows, Books)
    +-- compose/        (production Docker stacks)
    +-- wiki/           (knowledge base source)
    +-- backups/        (archives, skill zips)
```

### 1.2 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Docker Desktop on macOS | Host is Apple Silicon; Docker Desktop provides virtiofs for bind mounts |
| SMB for NAS storage | Centralized media library; multiple services read same dataset |
| Cloudflare Tunnel | No port forwarding; dynamic DNS; tunnel authentication |
| Nginx Proxy Manager | Web UI for reverse proxy management; easier than hand-editing Caddy |
| Prowlarr as indexer hub | Single point for indexer config; syncs to Sonarr/Radarr/Lidarr |
| linuxserver.io images | Consistent PUID/PGID pattern; well-maintained ARM64 builds |

---

## 2. The Problem Journey: A Chronology

### Phase 1: Symptom Discovery
**Initial complaint:** Lidarr not downloading music automatically.

**Agent diagnostic approach:**
1. Questionnaire method — systematically eliminated variables:
   - OS/version? Docker or native?
   - Download client running? Test connectivity?
   - Path mappings correct?
   - Indexers configured and tested?
   - Monitored items in queue?
   - Logs showing specific errors?

2. Live inspection revealed:
   - qBittorrent container running but Web UI not responding
   - Lidarr logs: `No available indexers`
   - Lidarr DB corruption error on startup
   - All indexers disabled in Lidarr
   - Download client configured for `localhost:8080` (unreachable from container)

### Phase 2: Root Cause Analysis

**Issue 1: qBittorrent Crash Loop**
- **Symptom:** Container running, port 8080 not listening, rapid restart in logs
- **Cause:** Stale `lockfile` + `ipc-socket` from previous container instance
- **Mechanism:** qBittorrent checks for lockfile on startup; finds stale one; exits immediately
- **Trigger:** Container recreation without proper cleanup of Unix domain sockets

**Issue 2: Lidarr Database Corruption**
- **Symptom:** `CorruptDatabaseException: file is not a database`
- **Cause:** SQLite `UPDATE` executed while application held WAL files open
- **Mechanism:** Lidarr uses WAL mode; writing while app is running corrupts the journal
- **Lesson:** Never run `sqlite3 ... "UPDATE ..."` on a live application database

**Issue 3: Network Isolation**
- **Symptom:** Lidarr cannot reach qBittorrent despite both being "on the same machine"
- **Cause:** qBittorrent used `network_mode: host`; Lidarr on `default` bridge network
- **Mechanism:** `host` network containers share host stack; bridge containers get isolated IPs
- **Lesson:** `localhost` inside a bridge container means the container itself, not the host

**Issue 4: Permission Mismatch**
- **Symptom:** Potential file access issues (latent)
- **Cause:** Lidarr ran as PUID=1000; all other *arr apps ran as PUID=501
- **Mechanism:** Downloaded files owned by 501; Lidarr (1000) cannot move/rename them

**Issue 5: Indexer Disable Cascade**
- **Symptom:** All 12 indexers showing `enabled=False`
- **Cause:** Database restore from backup + `IndexerStatus` escalation levels
- **Mechanism:** Repeated indexer failures trigger automatic disable; restore preserved disabled state

**Issue 6: Metadata Storage Location**
- **Symptom:** User requested metadata saved to NAS, not local SSD
- **Cause:** Default Jellyfin metadata path inside `/config` (local bind mount)
- **Mechanism:** `/config/metadata` was on SSD; user wanted persistence on NAS

### Phase 3: Resolution Pattern

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Stop qBittorrent, remove stale lockfile/ipc-socket | `netstat -tlnp \| grep 8080` shows listener |
| 2 | Restore Lidarr DB from scheduled backup (May 17) | `PRAGMA integrity_check;` returns `ok` |
| 3 | Change qBittorrent from `host` to bridge + port mapping | Container reachable by name from Lidarr |
| 4 | Align Lidarr PUID to 501 | Matches all other services |
| 5 | Update Lidarr download client host: `localhost` → `qbittorrent` | API test returns `isValid: True` |
| 6 | Enable all indexers in DB (`EnableRss=1`, `EnableAutomaticSearch=1`, etc.) | API shows `enableRss: true` for all |
| 7 | Jellyfin: mount NAS metadata dir at `/config/metadata` | Metadata directory grows on NAS during scan |
| 8 | Force-recreate affected containers | `docker compose up -d --force-recreate` |

---

## 3. Diagnostic Methodology for Agents

### 3.1 The Layered Approach

When a service is broken, inspect in this order:

```
Layer 1: Is the container running?
  └─ docker ps --format "table {{.Names}}\t{{.Status}}"

Layer 2: Is the process listening?
  └─ docker exec <container> netstat -tlnp
  └─ docker logs --since 5m <container>

Layer 3: Is the network path clear?
  └─ docker exec <client> wget -qO- http://<target>:<port>/
  └─ docker network inspect <network>

Layer 4: Is configuration correct?
  └─ sqlite3 <db> "SELECT ... FROM ..."
  └─ cat <config>/config.xml
  └─ docker inspect <container> --format '{{json .Mounts}}'

Layer 5: Are permissions aligned?
  └─ ls -la <bind-mount-path>
  └─ Check PUID/PGID across compose files

Layer 6: Is external infrastructure healthy?
  └─ DNS resolution (dig, nslookup)
  └─ Tunnel status (cloudflared logs)
  └─ SMB mount status (df -h, ls)
```

### 3.2 The Questionnaire Pattern

For any "X is not working" report, always ask:

1. **Environment:** OS? Docker/native? Version? Recently restarted?
2. **Dependencies:** Is the downstream service running? Can they talk?
3. **Paths:** Host-to-container mappings correct? Permissions aligned?
4. **Config:** Any recent changes to credentials, API keys, URLs?
5. **Data:** Are items monitored/queued? Any error messages?
6. **Logs:** What do the last 20 lines say?
7. **Resources:** Disk space? Memory? CPU?
8. **Network:** Firewalls? DNS? Container network modes?

### 3.3 The "Change One Thing" Rule

When multiple issues exist simultaneously:
- Fix the **root cause first** (e.g., DB corruption prevents everything else)
- Verify each fix before proceeding
- Document what you changed — rollback is harder than roll-forward

---

## 4. Common Failure Modes & Signatures

### 4.1 Docker Networking

| Pattern | Symptom | Fix |
|---------|---------|-----|
| `network_mode: host` + bridge client | Client cannot reach service by `localhost` | Use host IP (`host.docker.internal`) or move service to bridge |
| `--dns 1.1.1.1` overrides Docker DNS | `host.docker.internal` fails to resolve | Add `--add-host="host.docker.internal:<gateway-ip>"` |
| Port not exposed | Connection refused from host | Add `ports: - "host:container"` mapping |
| Container name collision | `Conflict. Container name already in use` | `docker rm -f <name>` or use unique names |

### 4.2 SQLite / Application Databases

| Pattern | Symptom | Fix |
|---------|---------|-----|
| Writing to live WAL-mode DB | `database disk image is malformed` | Stop app first, then modify; or restore from backup |
| Stale WAL files after crash | App refuses to start | Remove `.db-shm` and `.db-wal` files |
| Schema mismatch after restore | `no such column` errors | Check `.schema <table>` before writing queries |

### 4.3 Linuxserver.io Containers

| Pattern | Symptom | Fix |
|---------|---------|-----|
| Stale lockfile | Process starts then exits immediately | Remove `lockfile`, `ipc-socket`, `*.pid` from config dir |
| PUID mismatch | Permission denied on shared volumes | Standardize PUID/PGID across all services in stack |
| s6 service down file | Service won't auto-start | Check `/run/s6-rc/servicedirs/svc-*/down` |

### 4.4 SMB / Network Storage

| Pattern | Symptom | Fix |
|---------|---------|-----|
| SMB mount frozen | `Too many open files` in containers | Reboot host to clear macOS SMB client state |
| virtiofs inode caching | Host sees new dir, container sees old | Force-recreate container (`--force-recreate`) |
| Large file operations over SMB | Timeouts on `find`, `cp`, `rm` | Use `rsync` in background; rename instead of delete |

### 4.5 Cloudflare Tunnel

| Pattern | Symptom | Fix |
|---------|---------|-----|
| Tailscale DNS hijacking | `lookup argotunnel.com: i/o timeout` | Run cloudflared in Docker with `--dns 1.1.1.1` |
| Missing DNS record | `530` error from Cloudflare | `cloudflared tunnel route dns <tunnel-id> <hostname>` |
| Tunnel not connecting | `ERR edge discovery: DNS query failed` | Add `edge-ip-version: auto` to config |

---

## 5. Agent Training Scenarios

### Scenario A: "My *arr app can't reach the download client"

**Setup:** qBittorrent on `network_mode: host`, Sonarr on `default` bridge.

**Agent tasks:**
1. Verify both containers are running (`docker ps`)
2. Check if qBittorrent is listening (`docker exec qbittorrent netstat -tlnp`)
3. Test reachability from Sonarr (`docker exec sonarr wget qbittorrent:8080`)
4. Identify network mismatch
5. Propose fix: either add qBittorrent to bridge network, or use host IP

**Key concept:** `network_mode: host` containers do NOT participate in Docker's internal DNS. Bridge containers cannot reach them by container name.

### Scenario B: "App says database is corrupt after I fixed something"

**Setup:** Agent ran `sqlite3 live.db "UPDATE ..."` while app was running.

**Agent tasks:**
1. Recognize WAL-mode corruption signature
2. Stop the application
3. Locate scheduled backups (`Backups/scheduled/*.zip`)
4. Restore from most recent valid backup
5. Re-apply configuration changes while app is STOPPED
6. Remove stale WAL files before restart

**Key concept:** Never write to a SQLite database while the owning application is active with WAL enabled.

### Scenario C: "All my indexers/shows/movies disappeared"

**Setup:** Restored database from old backup; indexers show as disabled.

**Agent tasks:**
1. Check indexer table in DB (`PRAGMA table_info(Indexers)`)
2. Verify `EnableRss`, `EnableAutomaticSearch`, `EnableInteractiveSearch` columns
3. Bulk-enable: `UPDATE Indexers SET EnableRss=1, EnableAutomaticSearch=1, EnableInteractiveSearch=1`
4. Check `IndexerStatus` table for `DisabledTill` dates
5. Trigger Prowlarr sync or RSS sync from *arr app

**Key concept:** "Enabled" in the UI may map to multiple database columns, not a single boolean.

### Scenario D: "I want metadata on NAS, not local SSD"

**Setup:** Jellyfin config on local SSD, metadata growing to hundreds of MB.

**Agent tasks:**
1. Identify metadata path inside container (`/config/metadata`)
2. Create NAS directory for metadata
3. Add bind mount in compose: `<nas-path>:/config/metadata`
4. Be aware of virtiofs inode caching — rename old dir, create new empty dir, force-recreate container
5. Optionally: delete old local metadata, let app rescan and regenerate on NAS

**Key concept:** Docker Desktop's virtiofs caches directory inodes. Renaming a bind-mounted directory and creating a new one with the same name may show stale contents until container recreation.

### Scenario E: "Tunnel was working, now all subdomains return 530"

**Setup:** cloudflared running on host via launchd; Tailscale DNS active.

**Agent tasks:**
1. Check cloudflared logs for DNS timeout errors
2. Test DNS resolution: `dig @100.64.0.2 argotunnel.com` vs `dig @1.1.1.1 argotunnel.com`
3. Identify Tailscale DNS failure on SRV records
4. Migrate cloudflared to Docker container with `--dns 1.1.1.1`
5. Preserve `host.docker.internal` access with `--add-host`
6. Update all ingress rules to use `host.docker.internal` or container names

**Key concept:** Tailscale's MagicDNS may fail on specific record types (SRV). Isolating cloudflared's DNS prevents cascade failures.

---

## 6. Essential Commands Reference

### Docker Diagnostics
```bash
# Container health
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Process and port inspection
docker exec <container> ps aux
docker exec <container> netstat -tlnp

# Mount verification
docker inspect <container> --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}'

# Network connectivity between containers
docker exec <client> wget -qO- http://<target>:<port>/

# Force recreate (clears virtiofs cache)
docker compose up -d --force-recreate <service>
```

### SQLite Operations
```bash
# Check integrity
sqlite3 <db> "PRAGMA integrity_check;"

# View schema
sqlite3 <db> ".schema <table>"

# Safe read (WAL mode, app running)
sqlite3 <db> "SELECT * FROM <table> LIMIT 5;"

# UNSAFE write (app running) — AVOID
sqlite3 <db> "UPDATE ..."  # ← CORRUPTION RISK

# Safe write workflow
# 1. docker stop <app>
# 2. sqlite3 <db> "UPDATE ..."
# 3. rm -f <db>-shm <db>-wal <db>.pid
# 4. docker start <app>
```

### Network Verification
```bash
# DNS resolution test
dig @<resolver> <domain> +short
dig @<resolver> _v2-origintunneld._tcp.argotunnel.com SRV

# Tailscale DNS status
scutil --dns | grep -A2 "nameserver"

# SMB mount check
df -h | grep <mount-point>
ls <mount-point>/
```

### Cloudflare Tunnel
```bash
# Create DNS route
cloudflared tunnel route dns <tunnel-id> <hostname>

# Check tunnel status (Docker)
docker logs cloudflared | grep -i "registered tunnel connection"

# Config with DNS bypass
cat > config.yml << EOF
tunnel: <id>
credentials-file: /etc/cloudflared/<id>.json
protocol: http2
edge-ip-version: auto
ingress:
  - hostname: <subdomain>.<domain>
    service: http://host.docker.internal:<port>
  - service: http_status:404
EOF
```

---

## 7. Configuration Patterns

### 7.1 Standardized *arr Stack Compose

```yaml
services:
  qbittorrent:
    image: lscr.io/linuxserver/qbittorrent:latest
    container_name: qbittorrent
    platform: linux/arm64
    restart: unless-stopped
    # AVOID: network_mode: host (breaks inter-container DNS)
    ports:
      - "127.0.0.1:8080:8080"
    environment:
      - PUID=501        # <-- STANDARDIZE THIS
      - PGID=20         # <-- AND THIS
      - TZ=America/Chicago
      - WEBUI_PORT=8080
    volumes:
      - ./qbittorrent:/config
      - /nas/media:/data
    networks:
      - default

  lidarr:
    image: lscr.io/linuxserver/lidarr:latest
    container_name: lidarr
    platform: linux/arm64
    restart: unless-stopped
    environment:
      - PUID=501        # <-- MATCH QBittorrent
      - PGID=20
      - TZ=America/Chicago
    ports:
      - "127.0.0.1:8686:8686"
    volumes:
      - ./lidarr:/config
      - /nas/media:/data:delegated
    networks:
      - default

networks:
  default:
    driver: bridge
```

### 7.2 Metadata Separation Pattern

When you want config local (fast) but metadata remote (large/persistent):

```yaml
services:
  jellyfin:
    image: jellyfin/jellyfin:latest
    volumes:
      - ./jellyfin/config:/config          # DB, settings, plugins (local SSD)
      - ./jellyfin/cache:/cache            # Transcodes (local SSD)
      - /nas/media:/media:ro               # Media library (NAS)
      - /nas/jellyfin-meta:/config/metadata # Metadata (NAS)
```

**Critical:** After changing a bind mount target, force-recreate the container:
```bash
docker compose up -d --force-recreate jellyfin
```

### 7.3 Cloudflared in Docker (DNS-Isolated)

```bash
docker run -d \
  --name cloudflared \
  --restart unless-stopped \
  --dns 1.1.1.1 \
  --add-host="host.docker.internal:<gateway-ip>" \
  -v /path/to/creds:/etc/cloudflared:ro \
  -v /path/to/config.yml:/etc/cloudflared/config.yml:ro \
  cloudflare/cloudflared:latest \
  tunnel --config /etc/cloudflared/config.yml run
```

---

## 8. Anti-Patterns Checklist

| Anti-Pattern | Why It's Bad | What To Do Instead |
|-------------|-------------|-------------------|
| Mixing `host` and `bridge` networks for inter-dependent services | Services cannot resolve each other by name | Put all inter-dependent services on the same bridge network |
| Writing to SQLite DB while app is running | Corrupts WAL journal, destroys database | Stop app → write → clear WAL → start app |
| Inconsistent PUID/PGID across stack | Permission denied on shared volumes | Define standard IDs in `.env`, reference everywhere |
| Deleting large directories over SMB | Timeouts, partial deletes, resource busy | Rename old dir, create new empty dir, let background job clean |
| Editing live config without backup | One mistake = hours of recovery | Commit to git before changes; use scheduled DB backups |
| Assuming `localhost` = host machine | Inside container, `localhost` = container itself | Use explicit hostnames, host IPs, or shared networks |
| Ignoring container labels for compose source | May edit wrong file, changes don't apply | Always `docker inspect` to find `com.docker.compose.project` |

---

## 9. Meta-Lessons for AI Agents

### 9.1 The Environment Is Not What It Seems

- **The documented stack ≠ the running stack.** Check `docker inspect` labels to find the actual compose file location.
- **The config file ≠ the runtime config.** Apps cache config in memory; DB changes may require restart.
- **The host path ≠ the container path.** virtiofs, SMB, and bind mounts introduce abstraction layers.

### 9.2 Debugging Is Archaeology

- Start from the **symptom** (Lidarr not downloading)
- Work backward through **layers** (app → container → network → host → external)
- At each layer, ask: "What should be true here? Is it actually true?"
- Use **binary search:** test the middle layer first to eliminate half the problem space

### 9.3 The Fix Often Creates New Problems

- Changing qBittorrent network mode fixed Lidarr connectivity but broke cloudflared routing
- Moving metadata to NAS fixed storage but triggered virtiofs caching issues
- Restoring DB from backup fixed corruption but restored old disabled states

**Rule:** After every fix, verify the full service mesh, not just the component you touched.

### 9.4 Users Say "Yes" to Proposals They Don't Fully Understand

When you say "I recommend X, Y, Z," and the user says "yes," they may not anticipate:
- Service downtime during recreation
- Database restore losing recent config changes
- Network changes breaking external access

**Rule:** Before executing multi-step fixes, summarize: "This will restart X, Y, Z. You'll lose A, B. Is that okay?"

### 9.5 Document Everything as You Go

- Every config change
- Every command executed
- Every error encountered and its resolution
- The final working state

**Why:** The next agent (or you, 4 days later) will need to understand what happened.

---

## 10. Verification Checklist for "Holy Grail" Status

Before declaring a configuration canonical, verify for **4 consecutive days**:

- [ ] All containers healthy (`docker ps` shows no restarts)
- [ ] All subdomain endpoints respond (200/302)
- [ ] *arr apps can reach download client (test button passes)
- [ ] Indexers sync without errors (Prowlarr health check)
- [ ] Media scans complete without SMB timeouts
- [ ] Metadata writes to intended location (NAS or local)
- [ ] Cloudflared tunnel maintains 4+ edge connections
- [ ] No database corruption errors in logs
- [ ] Git repo reflects running state (`diff` is empty)
- [ ] Backups are being created automatically

If all pass: tag the commit. If any fail: open a new troubleshooting session.

---

*Document version: 1.0  
Training session: 2026-05-23  
Tag candidate: `v1.0-holy-grail` (pending 4-day verification)*
