# Homelab migration — 2026-07-14

> **Priority:** Strip containers off `arm-mini` (Apple Silicon, 16GB) so OrbStack can quit.
> Freed unified memory goes to Metal inference.

This package is the operator runbook for the **remaining** moves. Live compose still lives on the NAS (`/volume3/homelab/compose/` / `/mnt/homelab/compose/`). Copies under `reference/target-compose/` are the **intended post-move** files — copy them to the NAS before `up -d`.

## Boxes (target)

| Node | IP / arch | Role after cutover |
|------|-----------|--------------------|
| **arm-mini** | Apple Silicon, 16GB, arm64 | **ONLY** iMessage bridge, OpenClaw, inference worker. OrbStack off. |
| **firewall-vm** | `<lan-ip:firewall-vm>`, Ubuntu 26.04, 15GB, x86_64 | Arr stack + migrated apps (incl. homepage, eventually caddy/sync) |
| **NAS** | LAN storage | Compose at `/volume3/homelab/compose/`. **Cannot** host containers. |
| **edge SBC** | 8GB, aarch64 | Edge cluster: blocky, homeassistant, netalertx, speedtest-tracker, uptime-kuma |

NFS on firewall-vm: `/mnt/homelab` → `<lan-ip:nas>:/volume3/homelab` (fstab).

## Two bugs that bite EVERY Mac → firewall-vm move

1. **`platform: linux/arm64`** pinned in compose → `exec format error` on x86.  
   **Fix:** strip the key, `docker compose pull`, recreate.
2. **`USER_UID=501` / `USER_GID=20`** (macOS) → Linux user is `1000:1000` → permission denied.  
   **Fix:** yaml **and** `sudo chown -R 1000:1000 <data-dir>`.  
   `rsync` as non-root also scrambles ownership — prefer `rsync -a --chown=1000:1000` as root, or chown after.

Checklist helper: [`MAC_TO_X86_CHECKLIST.md`](MAC_TO_X86_CHECKLIST.md).

## Done

| Action | Services |
|--------|----------|
| Archived | plausible, drip, portainer, watchtower, novnc, flow-hub, filebrowser, 5 dashboards, 3 static sites |
| → firewall-vm | jellyfin, shelfarr, audiobookshelf, sonobarr, duplicati, gitea, anythingllm, dozzle, beszel, planka |
| Quarantine | `/mnt/homelab/compose/_QUARANTINE-arm64-DELETE-AFTER-2026-09-01` |

## Left (execute in this order)

| # | Move | Est. RAM | Notes | Runbook |
|---|------|----------|-------|---------|
| 1 | **homepage → firewall-vm** | small | Apply UID/platform fixes | [`homepage/MIGRATE.md`](homepage/MIGRATE.md) |
| 2 | **Edge → edge SBC** (non-DNS first) | ~363MB total | homeassistant, netalertx, speedtest-tracker, uptime-kuma | [`edge-sbc/MIGRATE.md`](edge-sbc/MIGRATE.md) |
| 3 | **blocky → edge SBC** | (in edge) | **LAST** — LAN DNS. Flip DHCP/clients only after healthy dig. | same |
| 4 | **caddy + sync-server** | — | Same compose project as OpenClaw. **Read YAML first.** Split before moving. | [`agent-stack-split/ANALYSIS.md`](agent-stack-split/ANALYSIS.md) |
| 5 | **OrbStack quit** | **~3GB back** | Confirm only bridge / OpenClaw / inference remain | below |

## OrbStack quit gate

On the mini, after steps 1–4:

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
# Expected survivors only: iMessage bridge, OpenClaw, inference worker
# Then quit OrbStack (menubar → Quit, or orbctl stop / quit).
```

If anything else is still listed, do not quit — identify and migrate or archive first.

## Where files go

| Artifact | Path |
|----------|------|
| This runbook | `ops/migration-2026-07-14/` |
| Target compose (homepage) | `reference/target-compose/homepage/` |
| Target compose (edge) | `reference/target-compose/edge-sbc/` |
| Target compose (proxy after split) | `reference/target-compose/proxy/` |
| Status snapshot | `status-reports/2026-07-14-migration.md` |

Live deploys: copy into `/mnt/homelab/compose/<stack>/` (or Pi local data) — do not treat this GitHub repo as the runtime mount.
