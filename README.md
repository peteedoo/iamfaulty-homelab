# iamfaulty-homelab

Self-hosted media and automation stack running on a Mac mini M4 via OrbStack. All compose files live on the NAS; container data lives on the mini's local SSD.

## Hardware

| Node | Role |
|------|------|
| Mac mini M4 (`iamfaulty-mini`) | Docker host, primary compute |
| UGREEN NAS (`ILLMATIC`, `192.168.68.69`) | Compose files, media library, persistent share |
| Raspberry Pi 5 | AdGuard Home, WireGuard |
| Raspberry Pi 4 | Media center (Kodi) |
| Raspberry Pi 3B | Home Assistant OS |

## Stack

### Media
| Service | Purpose |
|---------|---------|
| [Jellyfin](https://jellyfin.org) | Media server — movies, shows, music |
| [Jellyseerr](https://github.com/Fallenbagel/jellyseerr) | Request management UI |
| [MeTube](https://github.com/alexta69/metube) | yt-dlp web frontend |
| [slskd](https://github.com/slskd/slskd) | Soulseek daemon |

### Arr Stack
| Service | Purpose |
|---------|---------|
| Radarr | Movie collection manager |
| Sonarr | TV collection manager |
| Lidarr | Music collection manager |
| Mylar3 | Comics collection manager |
| Prowlarr | Indexer manager |
| qBittorrent | Torrent client (routed through Gluetun VPN) |
| Gluetun | WireGuard VPN kill switch |
| Soularr | Lidarr → slskd bridge |

### Infrastructure
| Service | Purpose |
|---------|---------|
| [Nginx Proxy Manager](https://nginxproxymanager.com) | Reverse proxy + SSL |
| [Portainer](https://portainer.io) | Docker management UI |
| [Gitea](https://gitea.io) | Self-hosted Git |
| [Dozzle](https://dozzle.dev) | Container log viewer |
| [Beszel](https://github.com/henrygd/beszel) | System monitoring |
| [Watchtower](https://github.com/containrrr/watchtower) | Automatic image updates |
| [Duplicati](https://duplicati.com) | Backup to Backblaze B2 |
| [Homepage](https://gethomepage.dev) | Dashboard |

### Apps
| Service | Purpose |
|---------|---------|
| [AnythingLLM](https://anythingllm.com) | Local LLM interface |
| [Planka](https://planka.app) | Kanban board |
| Portfolio | Static site (nginx) |
| daily-brief | Custom morning briefing script |
| dashboard | Custom stack status page |

## Layout

```
/Volumes/homelab/compose/    # NAS — compose files (source of truth)
~/homelab-data/              # Mini local SSD — container config/data volumes
/Volumes/homelab/media/      # NAS — media library (Jellyfin)
```

## Bringing the stack up

```bash
# Arr stack (media acquisition)
docker compose -f /Volumes/homelab/compose/arr/docker-compose.yml up -d

# Everything else
for stack in jellyfin npm portainer gitea portfolio watchtower duplicati \
             homepage dozzle daily-brief beszel anythingllm board dashboard; do
  docker compose -f /Volumes/homelab/compose/$stack/docker-compose.yml up -d
done
```

> The NAS must be mounted before starting any stack. OrbStack handles the Docker runtime on macOS.

## Domain

`iamfaulty.com` — proxied through Nginx Proxy Manager with Cloudflare tunnel for external access.

## Notes

- Compose files are the source of truth and live on the NAS, not in this repo. This repo tracks the configs that are harder to reconstruct: env files, NPM proxy host exports, AdGuard config, and operational notes.
- **API Reference:** See [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) for every service endpoint, auth method, and where to find credentials.
- VPN kill switch (Gluetun) is required for qBittorrent. If the tunnel is down, downloads stop — by design.
- Jellyfin media path is `/Volumes/homelab/media` mounted read-only inside the container.
