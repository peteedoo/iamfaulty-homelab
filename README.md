# iamfaulty-homelab

Self-hosted media and automation stack. **Compute is multi-node** (2026-07 migration): most containers run on **firewall-vm**; edge/DNS targets **edge SBC**; the ARM mini PC keeps only agent/inference survivors so OrbStack can quit for Metal.

Active cutover docs: [`ops/migration-2026-07-14/README.md`](ops/migration-2026-07-14/README.md).

## Hardware

| Node | Role |
|------|------|
| Apple Silicon ARM mini PC (`arm-mini`) | **Survivors only:** iMessage bridge, OpenClaw, inference worker. Goal: OrbStack off → Metal inference. |
| firewall-vm (`<lan-ip:firewall-vm>`, Ubuntu, x86_64) | Arr stack + migrated apps (jellyfin, homepage, gitea, …). NFS: `/mnt/homelab` → NAS |
| gpu-node (`<lan-ip:gpu-node>`) | Local LLM / ROCm inference (16GB AMD RDNA 4 GPU) — see [`docs/GPU_NODE.md`](docs/GPU_NODE.md) |
| NAS | Compose files (`/volume3/homelab/compose/`), media library. **Cannot host containers.** |
| ARM SBC (edge) | Edge cluster target: blocky (DNS), Home Assistant, NetAlertX, speedtest-tracker, uptime-kuma |
| ARM SBC (media center) | Media center (Kodi) |
| ARM SBC (legacy) | (legacy HA OS — migrating toward edge SBC) |

## Stack (by destination)

### firewall-vm — media & apps
| Service | Purpose |
|---------|---------|
| [Jellyfin](https://jellyfin.org) | Media server |
| Arr stack (Radarr, Sonarr, …) | Acquisition |
| [Homepage](https://gethomepage.dev) | Dashboard (**remaining move**) |
| [Gitea](https://gitea.io), [Dozzle](https://dozzle.dev), [Beszel](https://github.com/henrygd/beszel) | Git / logs / monitoring |
| [AnythingLLM](https://anythingllm.com), [Planka](https://planka.app) | LLM UI / kanban |
| Caddy + sync-server | Reverse proxy (**split carefully from OpenClaw**) |

### edge SBC — edge
blocky (DNS — **move last**), Home Assistant, NetAlertX, speedtest-tracker, uptime-kuma.

### arm-mini — survivors
OpenClaw, iMessage bridge, inference worker.

## True Architecture

Live compose is **not** primarily this GitHub repo. Assembled from:

| Source | Location | What it runs |
|--------|----------|--------------|
| 1. NAS compose | `/volume3/homelab/compose/` (firewall-vm: `/mnt/homelab/compose/`) | Apps / media / (soon) proxy |
| 2. Arr stack | firewall-vm local or compose dir | download client, Radarr, … |
| 3. Agent / OpenClaw | mini `~/openclaw/` after **split** | OpenClaw only |
| 4. Proxy | firewall-vm after split | Caddy + sync-server |
| 5. Edge | edge SBC `/opt/homelab/` | blocky + edge apps |

> Target compose copies for remaining moves: [`reference/target-compose/`](reference/target-compose/).  
> Quarantined arm64 leftovers: `/mnt/homelab/compose/_QUARANTINE-arm64-DELETE-AFTER-2026-09-01`.

## Mac → firewall-vm landmines

1. `platform: linux/arm64` → `exec format error` on x86 — strip, re-pull.
2. `USER_UID=501` / `USER_GID=20` → Linux `1000:1000` — fix yaml **and** `chown -R 1000:1000` data.

See [`ops/migration-2026-07-14/MAC_TO_X86_CHECKLIST.md`](ops/migration-2026-07-14/MAC_TO_X86_CHECKLIST.md).

## Layout

```
/volume3/homelab/compose/     # NAS — compose (source of truth for files)
/mnt/homelab/                 # firewall-vm NFS mount of the above
/opt/homelab/                 # edge SBC compose + data (target)
~/openclaw/                   # mini — OpenClaw after agent-stack split
/volume3/homelab/media/       # media library
```

## Bringing stacks up

```bash
# firewall-vm apps (example)
docker network create proxy 2>/dev/null || true
docker compose -f /mnt/homelab/compose/jellyfin/docker-compose.yml up -d
# …other stacks under /mnt/homelab/compose/

# edge SBC (non-DNS first; blocky last)
docker compose -f /opt/homelab/docker-compose.yml --profile apps up -d
docker compose -f /opt/homelab/docker-compose.yml --profile dns up -d

# mini survivors
bash ~/iamfaulty-homelab/ops/stack-up.sh
```

Details: [`ops/STARTUP.md`](ops/STARTUP.md).

## Domain

`iamfaulty.com` — Cloudflare tunnel + reverse proxy. After proxy moves to firewall-vm, update upstreams; keep OpenClaw routes pointed at the **ARM mini PC's LAN address**.

## Notes

- **API Reference:** [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md)
- **gpu-node:** [`docs/GPU_NODE.md`](docs/GPU_NODE.md)
- **Migration status:** [`status-reports/2026-07-14-migration.md`](status-reports/2026-07-14-migration.md)
- A VPN kill switch fronts the download client on the firewall VM. (Client/VPN details intentionally omitted from public docs.)
