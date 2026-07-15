# iamfaulty-homelab

Self-hosted media and automation stack. **Compute is multi-node** (2026-07 migration): most containers run on **minifw**; edge/DNS targets **Pi 5**; the Mac mini keeps only agent/inference survivors so OrbStack can quit for Metal.

Active cutover docs: [`ops/migration-2026-07-14/README.md`](ops/migration-2026-07-14/README.md).

## Hardware

| Node | Role |
|------|------|
| Mac mini M4 (`iamfaulty-mini`) | **Survivors only:** iMessage bridge, OpenClaw, inference worker. Goal: OrbStack off → Metal inference. |
| minifw (`192.168.68.64`, Ubuntu, x86_64) | Arr stack + migrated apps (jellyfin, homepage, gitea, …). NFS: `/mnt/homelab` → NAS |
| AskJeevesAI (`192.168.68.55`) | Local LLM / ROCm inference (RX 9060 XT 16GB) — see [`docs/ASKJEEVESAI.md`](docs/ASKJEEVESAI.md) |
| UGREEN NAS (`ILLMATIC`, `192.168.68.69`) | Compose files (`/volume3/homelab/compose/`), media library. **Cannot host containers.** |
| Raspberry Pi 5 (8GB) | Edge cluster target: blocky (DNS), Home Assistant, NetAlertX, speedtest-tracker, uptime-kuma |
| Raspberry Pi 4 | Media center (Kodi) |
| Raspberry Pi 3B | (legacy HA OS — migrating toward Pi 5) |

## Stack (by destination)

### minifw — media & apps
| Service | Purpose |
|---------|---------|
| [Jellyfin](https://jellyfin.org) | Media server |
| Arr stack (Radarr, Sonarr, …) | Acquisition |
| [Homepage](https://gethomepage.dev) | Dashboard (**remaining move**) |
| [Gitea](https://gitea.io), [Dozzle](https://dozzle.dev), [Beszel](https://github.com/henrygd/beszel) | Git / logs / monitoring |
| [AnythingLLM](https://anythingllm.com), [Planka](https://planka.app) | LLM UI / kanban |
| Caddy + sync-server | Reverse proxy (**split carefully from OpenClaw**) |

### Pi 5 — edge
blocky (DNS — **move last**), Home Assistant, NetAlertX, speedtest-tracker, uptime-kuma.

### iamfaulty-mini — survivors
OpenClaw, iMessage bridge, inference worker.

## True Architecture

Live compose is **not** primarily this GitHub repo. Assembled from:

| Source | Location | What it runs |
|--------|----------|--------------|
| 1. NAS compose | `/volume3/homelab/compose/` (minifw: `/mnt/homelab/compose/`) | Apps / media / (soon) proxy |
| 2. Arr stack | minifw local or compose dir | qBit, Gluetun, Radarr, … |
| 3. Agent / OpenClaw | mini `~/openclaw/` after **split** | OpenClaw only |
| 4. Proxy | minifw after split | Caddy + sync-server |
| 5. Edge | Pi 5 `/opt/homelab/` | blocky + edge apps |

> Target compose copies for remaining moves: [`reference/target-compose/`](reference/target-compose/).  
> Quarantined arm64 leftovers: `/mnt/homelab/compose/_QUARANTINE-arm64-DELETE-AFTER-2026-09-01`.

## Mac → minifw landmines

1. `platform: linux/arm64` → `exec format error` on x86 — strip, re-pull.
2. `USER_UID=501` / `USER_GID=20` → Linux `1000:1000` — fix yaml **and** `chown -R 1000:1000` data.

See [`ops/migration-2026-07-14/MAC_TO_X86_CHECKLIST.md`](ops/migration-2026-07-14/MAC_TO_X86_CHECKLIST.md).

## Layout

```
/volume3/homelab/compose/     # NAS — compose (source of truth for files)
/mnt/homelab/                 # minifw NFS mount of the above
/opt/homelab/                 # Pi 5 edge compose + data (target)
~/openclaw/                   # mini — OpenClaw after agent-stack split
/volume3/homelab/media/       # media library
```

## Bringing stacks up

```bash
# minifw apps (example)
docker network create proxy 2>/dev/null || true
docker compose -f /mnt/homelab/compose/jellyfin/docker-compose.yml up -d
# …other stacks under /mnt/homelab/compose/

# Pi edge (non-DNS first; blocky last)
docker compose -f /opt/homelab/docker-compose.yml --profile apps up -d
docker compose -f /opt/homelab/docker-compose.yml --profile dns up -d

# mini survivors
bash ~/iamfaulty-homelab/ops/stack-up.sh
```

Details: [`ops/STARTUP.md`](ops/STARTUP.md).

## Domain

`iamfaulty.com` — Cloudflare tunnel + reverse proxy. After proxy moves to minifw, update upstreams; keep OpenClaw routes pointed at the **mini LAN IP**.

## Notes

- **API Reference:** [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md)
- **AskJeevesAI:** [`docs/ASKJEEVESAI.md`](docs/ASKJEEVESAI.md)
- **Migration status:** [`status-reports/2026-07-14-migration.md`](status-reports/2026-07-14-migration.md)
- VPN kill switch (Gluetun) remains required for qBittorrent on minifw.
