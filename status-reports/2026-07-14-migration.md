# Homelab migration snapshot — 2026-07-14

## Goal

Strip all containers off **arm-mini** (Apple Silicon, 16GB) so OrbStack can quit. Freed unified memory → Metal inference.

## Hosts

| Node | Role |
|------|------|
| arm-mini | Survivors only: iMessage bridge, OpenClaw, inference worker |
| firewall-vm (`<lan-ip:firewall-vm>`) | Arr + migrated apps; NFS `/mnt/homelab` |
| NAS | Compose storage only — no containers |
| edge SBC (8GB) | Edge: blocky (DNS last), HA, netalertx, speedtest-tracker, uptime-kuma |

## Done

- Archived: plausible, drip, portainer, watchtower, novnc, flow-hub, filebrowser, 5 dashboards, 3 static sites
- On firewall-vm: jellyfin, shelfarr, audiobookshelf, sonobarr, duplicati, gitea, anythingllm, dozzle, beszel, planka
- Quarantine: `/mnt/homelab/compose/_QUARANTINE-arm64-DELETE-AFTER-2026-09-01`

## Left (repo runbooks ready)

1. homepage → firewall-vm  
2. Edge → edge SBC (non-DNS), then **blocky last**  
3. Split caddy + sync-server from OpenClaw compose; move proxy to firewall-vm  
4. OrbStack quit (~3GB)

See `ops/migration-2026-07-14/README.md` and `reference/target-compose/`.

## Standing Mac→x86 landmines

1. Strip `platform: linux/arm64` or expect `exec format error`
2. Fix `501:20` → `1000:1000` in yaml **and** `chown -R` data dirs
