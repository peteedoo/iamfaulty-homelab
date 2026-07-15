# Homelab migration snapshot — 2026-07-14

## Goal

Strip all containers off **iamfaulty-mini** (M4, 16GB) so OrbStack can quit. Freed unified memory → Metal inference.

## Hosts

| Node | Role |
|------|------|
| iamfaulty-mini | Survivors only: iMessage bridge, OpenClaw, inference worker |
| minifw (`192.168.68.64`) | Arr + migrated apps; NFS `/mnt/homelab` |
| ILLMATIC (`192.168.68.69`) | Compose storage only — no containers |
| Pi 5 (8GB) | Edge: blocky (DNS last), HA, netalertx, speedtest-tracker, uptime-kuma |

## Done

- Archived: plausible, drip, portainer, watchtower, novnc, flow-hub, filebrowser, 5 dashboards, 3 static sites
- On minifw: jellyfin, shelfarr, audiobookshelf, sonobarr, duplicati, gitea, anythingllm, dozzle, beszel, planka
- Quarantine: `/mnt/homelab/compose/_QUARANTINE-arm64-DELETE-AFTER-2026-09-01`

## Left (repo runbooks ready)

1. homepage → minifw  
2. Edge → Pi 5 (non-DNS), then **blocky last**  
3. Split caddy + sync-server from OpenClaw compose; move proxy to minifw  
4. OrbStack quit (~3GB)

See `ops/migration-2026-07-14/README.md` and `reference/target-compose/`.

## Standing Mac→x86 landmines

1. Strip `platform: linux/arm64` or expect `exec format error`
2. Fix `501:20` → `1000:1000` in yaml **and** `chown -R` data dirs
