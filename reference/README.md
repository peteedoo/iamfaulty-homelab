# Reference — Compose Files

## Live backups (as-of last sync)

| File | Source | Updated |
|------|--------|---------|
| `arr-stack-docker-compose.yml` | `~/homelab-data/arr-stack/docker-compose.yml` | 2026-05-26 — healthchecks, Radarr ulimits |
| `agent-stack-docker-compose.yml` | `~/homelab-agent-stack/docker-compose.yml` | 2026-05-26 — sync-server + caddy; **read before splitting OpenClaw** |
| `Caddyfile` | `~/homelab-agent-stack/caddy/Caddyfile` | 2026-05-26 — mostly `host.docker.internal` |

> These are **read-only backups** of pre-migration Mac layouts. Live source of truth: NAS `/volume3/homelab/compose/` (firewall-vm `/mnt/homelab/compose/`).

## Target compose (2026-07 remaining moves)

See [`target-compose/`](target-compose/) — homepage (firewall-vm), edge (edge SBC), proxy (caddy+sync after split).  
Runbooks: [`../ops/migration-2026-07-14/`](../ops/migration-2026-07-14/).
