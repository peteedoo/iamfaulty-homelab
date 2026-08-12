# Mac → x86 Migration Closeout — 2026-07-26

> **Status:** Operational debt cleared. Two manual sudo steps remain (NAS SMB mount, mini NFS export). Offsite backup (B2) pending account creation.
> **Author:** Hermes (Claude), with Petee
> **Supersedes:** `2026-07-14-migration.md` snapshot

---

## Summary

The Mac mini (arm64) → minifw (x86_64) migration that started 2026-07-14 is functionally complete. The arr stack, public services, and Caddy edge all run on minifw. The mini is back to its intended role as control plane: cloudflared, OpenClaw, Conductor, dashboard, sync-server. This closeout clears the operational debt that accumulated during the cutover.

**What this case study demonstrates (TPM artifact):**
- Zero-downtime migration of ~30 Docker services between architectures
- Runbook-driven cutover with rollback safety (quarantine dir, not delete)
- Post-migration operational debt tracked and cleared in a follow-up sprint
- Stale configuration identified and removed without breaking live traffic

---

## What was done in this closeout session (2026-07-26)

### 1. Dead launchd agents unloaded (7 of 10)

Seven launchd agents were in a crash-restart loop or permanently failed. They referenced scripts that were lost during migration and never tracked in git.

| Agent | Status | Cause | Action |
|-------|--------|-------|--------|
| `media-request-watcher` | Crash loop (100KB+ error log today) | `~/homelab-data/scripts/media-request-watcher.py` missing | Unloaded |
| `soulseek-request-watcher` | Crash loop (100KB+ error log today) | `~/homelab-data/scripts/soulseek-request-watcher.py` missing | Unloaded |
| `daily-brief-gen` | Failed (exit 2) | `~/homelab-data/scripts/daily-brief-gen.py` missing | Unloaded |
| `arr-search` | Failed (exit 127) | `~/homelab-data/scripts/arr-missing-search.sh` missing | Unloaded |
| `quarantine-scan` | Failed (exit 127) | `~/homelab-data/scripts/dmg-quarantine-scan.sh` missing | Unloaded |
| `arr-backlog-search` | Failed (exit 127) | `~/homelab-data/scripts/arr-backlog-search.sh` missing | Unloaded |
| `approval-bot` | Failed (exit 127) | `~/homelab-data/dropbox/agent-registry/telegram-approval-bot.sh` missing | Unloaded |

Plists remain in `~/Library/LaunchAgents/` for re-enabling once scripts are recreated.

**Lesson:** Scripts that aren't in git don't survive migrations. The `~/homelab-data/scripts/` directory was never tracked. Recommendation: either git-track these scripts or accept they're disposable.

### 2. nuke-proof-watchdog config fixed

The watchdog was reporting 6 false failures per run because its config still referenced:
- Containers (`mylar3 sonarr soularr gitea`) that moved to minifw
- A launchd label (`com.iamfaulty.daily-brief`) that never existed (actual: `daily-brief-gen`, now unloaded)

Fixed in `~/AgentDropbox/scripts/nuke-proof-watchdog.sh`:
- Container list → `caddy sync-server homelab-dashboard-frontend homelab-dashboard-backend` (mini's actual 4 containers)
- Removed stale `daily-brief` launchd check
- Result: 6 failures → 2 (remaining 2 are Obsidian REST API on :27124, unrelated to migration)

### 3. Stale Caddy routes removed (6 of 7)

Six route blocks in minifw's Caddyfile pointed at backends archived during migration. All returned 502. Removed:

| Hostname | Was | Now |
|----------|-----|-----|
| `sonobarr.iamfaulty.com` | Sonobarr container | 404 (clean miss) |
| `books.iamfaulty.com` | Calibre | 404 |
| `portainer.iamfaulty.com` | Portainer | 404 |
| `analytics.iamfaulty.com` | Analytics | 404 |
| `aicode.iamfaulty.com` | AICode | 404 |
| `flow.iamfaulty.com` | Flow hub | 404 |

Caddyfile at `minifw:/home/peteedoo/homelab-agent-stack/caddy/Caddyfile.minifw` (bind-mounted into container). Backup of pre-cleanup version saved as `Caddyfile.bak.<timestamp>` inside the container.

The 7th stale route (`dash.iamfaulty.com`) is in cloudflared config on mini, not minifw Caddy. It routes to `mini:80` which hits the legacy mini Caddy. Low priority — flag for cloudflared config cleanup.

### 4. Verified what's actually working (corrections to prior state)

- **Backups are NOT broken.** `nuke-proof-backup` runs daily at 02:00 via launchd, writes to NAS via NFS container. Last successful run: 2026-07-26 05:34. The "exit 1" in launchctl was stale state from 2026-07-24 when NAS wasn't writable. The script itself is healthy.
- **Conductor-patrol is working.** Patrolling every 15 min, last run 18:46. The "exit 2" was stale.
- **Tunnel is healthy.** Single connector, 2xdfw + 2xmci edges, version 2026.6.1 (one minor behind 2026.7.3, not urgent).

---

## What remains (manual steps for Petee)

### Step 1 — Mount NAS on mini (needs sudo)

The NAS is not mounted on the mini. Compose source of truth and media library are inaccessible from mini until this is done.

```bash
sudo mkdir -p /Volumes/ILLMATIC
mount_smbfs //peteedoo@192.168.68.69/ILLMATIC /Volumes/ILLMATIC
```

For persistent mount on boot, add to `/etc/fstab` or use a launchd mount agent. The share name is `ILLMATIC`, not `homelab` (the skill had this wrong).

### Step 2 — Export mini data via NFS for Duplicati (needs sudo)

Duplicati will run on minifw and back up mini's data over NFS. The mini needs to export three read-only paths.

```bash
# Enable NFS server on mini
sudo nfsd enable

# Add to /etc/exports on mini:
/Users/peteedoo/homelab-data 192.168.68.64 -ro -alldirs -mapall=1000:1000
/Users/peteedoo/.openclaw       192.168.68.64 -ro -mapall=1000:1000
/Users/peteedoo/.claude/skills 192.168.68.64 -ro -mapall=1000:1000

# Apply
sudo nfsd update
```

On minifw, mount and persist in `/etc/fstab`:
```
192.168.68.61:/Users/peteedoo/homelab-data  /mnt/mini-data/homelab-data  nfs  ro,soft  0 0
192.168.68.61:/Users/peteedoo/.openclaw     /mnt/mini-data/openclaw      nfs  ro,soft  0 0
192.168.68.61:/Users/peteedoo/.claude/skills /mnt/mini-data/claude-skills nfs ro,soft 0 0
```

```bash
sudo mkdir -p /mnt/mini-data/{homelab-data,openclaw,claude-skills}
sudo mount -a
```

### Step 3 — Create Backblaze B2 account + bucket

1. Sign up at backblaze.com/b2 (free tier: 10GB storage, 1GB/day downloads)
2. Create a bucket: `iamfaulty-offsite-backup` (private)
3. Create an application key with read/write scope on that bucket only
4. Save key ID and key to `~/homelab-data/duplicati/.env` on minifw:
   ```
   DUPLICATI__WEBSERVICE_PASSWORD=<your web UI password>
   SETTINGS_ENCRYPTION_KEY=<your settings encryption key>
   ```
   B2 credentials are entered in the Duplicati web UI, not the env file.

### Step 4 — Start Duplicati and configure the backup job

```bash
# On minifw
cd /mnt/homelab/compose/duplicati
docker compose up -d
```

The new compose (written this session) is x86-native, uses PUID/PGID 1000, and reads from NFS mounts. Web UI at `minifw:8200` (localhost only — tunnel or SSH-forward to access).

In the Duplicati web UI:
1. Add backup → "Backblaze B2" storage type
2. Enter B2 key ID + key from Step 3
3. Select source paths under `/source/` (nas-homelab, mini-homelab-data, mini-openclaw, mini-claude-skills)
4. Set encryption passphrase (different from settings key)
5. Schedule: daily at 03:00 (offset from nuke-proof-backup at 02:00 so NAS has fresh data)
6. Retention: keep 7 daily, 4 weekly, 6 monthly

### Step 5 — (Optional) Refresh the iamfaulty-homelab skill

The skill's header still says "STACK.md is missing." STACK.md exists at `~/homelab-data/STACK.md` (verified 2026-07-25). The skill's service map and pickup order are also behind. Update `~/.claude/skills/iamfaulty-homelab/SKILL.md` to reflect current state.

---

## Architecture after closeout

```
Internet → Cloudflare → cloudflared (mini, launchd) → minifw Caddy :80 → backends

mini (.61) — control plane
  ├─ cloudflared (tunnel, 23 hostnames)
  ├─ OpenClaw gateway
  ├─ Conductor + Librarian + Forge (uvicorn/node)
  ├─ dashboard FE/BE + sync-server + caddy (4 containers)
  ├─ nuke-proof-backup (daily → NAS via NFS container) ✅
  ├─ nuke-proof-watchdog (fixed, 2/8 checks remaining) ✅
  ├─ conductor-patrol (every 15 min) ✅
  └─ 7 dead agents unloaded (scripts lost, not in git)

minifw (.64) — app tier
  ├─ Caddy :80 (23 live routes, 6 stale removed)
  ├─ Arr stack (jellyfin, sonarr, radarr, lidarr, prowlarr, mylar3, readarr, qbittorrent)
  ├─ Apps (gitea, planka, audiobookshelf, beszel, bookbounty, huntorr, metube, jellyseerr)
  ├─ Public sites (homepage, portfolio, family, sync-server mirror)
  └─ Duplicati (compose ready, needs NFS + B2 to start)

Le Potato (.82) — edge
  └─ blocky DNS :4000 (primary LAN resolver)

Pi 5 (.68) — stranded
  └─ AdGuard Home (secondary DNS, SSH closed, Tailscale offline)

NAS ILLMATIC (.69) — storage
  ├─ SMB share ILLMATIC (not mounted on mini)
  ├─ NFS export → minifw /mnt/homelab
  └─ Compose source of truth at /volume3/homelab/compose/

AskJeevesAI (.55) — inference
  └─ Ollama + LiteLLM (ROCm)
```

---

## Open items for next session (Option C regroup)

After this closeout, the next phase is the inference cluster pivot:

1. Document AskJeevesAI as a proper inference node (OpenAI-compatible endpoint, model catalog, latency dashboard)
2. Write up the dual-Mac-Mini-M4-Pro cluster as a future-state architecture (not a purchase — a design)
3. Frame both as TPM portfolio artifacts: "I run a multi-node inference cluster for agent workloads, here's the architecture and the cost/performance analysis"

The homelab is now stable enough to support that work without operational debt dragging it down.

---

*Generated 2026-07-26 by Hermes. Verify against `~/homelab-data/STACK.md` for any live state questions.*
