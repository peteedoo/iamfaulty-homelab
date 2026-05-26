# Homelab API Reference

> **Living document.** When you add, remove, or change a service, update this file before pushing.
>
> **Rule:** No secrets in this doc. Reference `config.xml`, `.env`, or `settings.json` locations only.

## Quick Lookup

| Service | Container | Port | API Base | Auth | Where Creds Live |
|---------|-----------|------|----------|------|------------------|
| **Prowlarr** | prowlarr | `9696` | `/api/v1` | `X-Api-Key` header | `~/homelab-data/arr/prowlarr/config.xml` |
| **Sonarr** | sonarr | `8989` | `/api/v3` | `X-Api-Key` header | `~/homelab-data/arr/sonarr/config.xml` |
| **Radarr** | radarr | `7878` | `/api/v3` | `X-Api-Key` header | `~/homelab-data/arr/radarr/config.xml` |
| **Lidarr** | lidarr | `8686` | `/api/v1` | `X-Api-Key` header | `~/homelab-data/arr/lidarr/config.xml` |
| **Readarr** | readarr | `8787` | `/api/v1` | `X-Api-Key` header | `~/homelab-data/arr/readarr/config.xml` |
| **Mylar3** | mylar3 | `8090` | `/api` | `apikey` query param | Web UI → Settings |
| **qBittorrent** | qbittorrent | `8080` | `/api/v2` | Cookie + `X-API-Key` (optional) | Web UI → Options → Web UI |
| **Jellyfin** | jellyfin | `8096` | `/System`, `/Items`, `/Users` | `X-Emby-Token` header | Jellyfin Dashboard → Advanced → API Keys |
| **Jellyseerr** | jellyseerr | `5055` | `/api/v1` | `X-Api-Key` header | `~/homelab-data/arr/jellyseerr/settings.json` |
| **slskd** | slskd | `5030`* | `/api/v0` | Bearer token or basic auth | `~/homelab-data/arr/slskd/slskd.yml` |
| **MeTube** | metube | `8081` | — | None | — |
| **FlareSolverr** | flaresolverr | `8191` | `/v1` | None | — |
| **Portainer** | portainer | `9000` | `/api` | Bearer token | Web UI → My Account → Access tokens |
| **Gitea** | gitea | `3000` | `/api/v1` | `Authorization: token` header | Web UI → Settings → Applications → Generate Token |
| **NPM** | npm | `81` | `/api` | Bearer token | Web UI → Settings → Access Tokens |
| **Beszel** | beszel | `8089` | `/api` | Session cookie / JWT | Web UI login |
| **Beszel Agent** | beszel-agent | `45876` | — | SSH key pair | `~/.config/beszel/key.pub` → agent env |
| **Duplicati** | duplicati | `8200` | `/api/v1` | `X-API-KEY` header | Web UI → Settings → Access Token |
| **Watchtower** | watchtower | — | `/v1/update` | None (internal) | — |
| **Planka** | planka | `3333` | `/api` | Session cookie / JWT | Web UI login |
| **AnythingLLM** | anythingllm | `3001`* | `/api` | `Authorization: Bearer` header | Web UI → Settings → API Keys |
| **daily-brief** | daily-brief | `3003` | — | None | — |
| **dashboard** | dashboard | `3004` | — | None | — |
| **drip-api** | drip-api | `3006` | — | None | — |
| **board-dashboard** | board-dashboard | `3334` | — | None | — |
| **BookBounty** | bookbounty | `5000` | — | None | Web UI only |
| **Huntorr** | huntorr | `5002` | — | None | Web UI only |
| **homepage** | homepage | `3005` | — | None | Config-driven only |
| **openclaw-hub** | openclaw-hub | `18789` | `/api` | Varies by endpoint | `.env` in homelab-agent-stack |
| **sync-server** | sync-server | `3001` | — | API key | `homelab-agent-stack/.env` |
| **Dozzle** | dozzle | `8888` | `/api` | None (local) | — |
| **truth-site** | truth-site | `3008` | — | None | Static site |
| **portfolio** | portfolio | `3001` | — | None | Static site |

\* slskd uses `network_mode: host`; port 5030 is on the host. AnythingLLM port may vary by compose config.

---

## Arr Stack

All *arr apps share the same auth pattern: `X-Api-Key` header.

### Prowlarr
- **Port:** `127.0.0.1:9696`
- **API:** `http://127.0.0.1:9696/api/v1`
- **Auth:** `X-Api-Key: <key>`
- **Key location:** `~/homelab-data/arr/prowlarr/config.xml` → `<ApiKey>`
- **Docs:** https://prowlarr.com/docs/api
- **Common endpoints:**
  - `GET /api/v1/indexer` — list indexers
  - `GET /api/v1/command` — running tasks
  - `POST /api/v1/command` — trigger sync (`{"name": "ApplicationIndexerSync"}`)

### Sonarr
- **Port:** `127.0.0.1:8989`
- **API:** `http://127.0.0.1:8989/api/v3`
- **Auth:** `X-Api-Key: <key>`
- **Key location:** `~/homelab-data/arr/sonarr/config.xml` → `<ApiKey>`
- **Docs:** https://sonarr.tv/docs/api
- **Common endpoints:**
  - `GET /api/v3/series` — all series
  - `POST /api/v3/command` — trigger searches, imports, etc.

### Radarr
- **Port:** `127.0.0.1:7878`
- **API:** `http://127.0.0.1:7878/api/v3`
- **Auth:** `X-Api-Key: <key>`
- **Key location:** `~/homelab-data/arr/radarr/config.xml` → `<ApiKey>`
- **Docs:** https://radarr.video/docs/api
- **Common endpoints:**
  - `GET /api/v3/movie` — all movies
  - `POST /api/v3/command` — trigger searches, imports, etc.

### Lidarr
- **Port:** `127.0.0.1:8686`
- **API:** `http://127.0.0.1:8686/api/v1`
- **Auth:** `X-Api-Key: <key>`
- **Key location:** `~/homelab-data/arr/lidarr/config.xml` → `<ApiKey>`
- **Docs:** https://lidarr.audio/docs/api

### Readarr
- **Port:** `127.0.0.1:8787`
- **API:** `http://127.0.0.1:8787/api/v1`
- **Auth:** `X-Api-Key: <key>`
- **Key location:** `~/homelab-data/arr/readarr/config.xml` → `<ApiKey>`
- **Docs:** https://readarr.com/docs/api

### Mylar3
- **Port:** `127.0.0.1:8090`
- **API:** `http://127.0.0.1:8090/api`
- **Auth:** `apikey=<key>` query parameter
- **Key location:** Web UI → Configuration → Web Interface → API Key
- **Note:** Uses query-param auth, not header auth like the *arr apps.

### qBittorrent
- **Port:** `127.0.0.1:8080`
- **API:** `http://127.0.0.1:8080/api/v2`
- **Auth:** Cookie-based login session (POST `/api/v2/auth/login`)
- **Alternative:** Enable "Bypass authentication for clients on localhost" and use no auth from the mini.
- **Docs:** https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-4.1)
- **Common endpoints:**
  - `POST /api/v2/auth/login` — login (returns cookie)
  - `GET /api/v2/torrents/info` — list torrents
  - `POST /api/v2/torrents/add` — add torrent

### FlareSolverr
- **Port:** `127.0.0.1:8191`
- **API:** `http://127.0.0.1:8191/v1`
- **Auth:** None
- **Docs:** https://github.com/FlareSolverr/FlareSolverr
- **Common endpoint:**
  - `POST /v1` — body: `{"cmd": "request.get", "url": "...", "maxTimeout": 60000}`

---

## Media Services

### Jellyfin
- **Port:** `0.0.0.0:8096` (LAN accessible)
- **API:** `http://127.0.0.1:8096`
- **Auth:** `X-Emby-Token: <key>` or `X-MediaBrowser-Token: <key>`
- **Key location:** Jellyfin Dashboard → Advanced → API Keys
- **Docs:** https://api.jellyfin.org
- **Common endpoints:**
  - `GET /System/Info` — server info
  - `GET /Users` — users
  - `GET /Items` — library items (requires `UserId`)

### Jellyseerr
- **Port:** `127.0.0.1:5055`
- **API:** `http://127.0.0.1:5055/api/v1`
- **Auth:** `X-Api-Key: <key>`
- **Key location:** `~/homelab-data/arr/jellyseerr/settings.json` → `"apiKey"`
- **Docs:** https://docs.jellyseerr.dev

### slskd
- **Port:** `5030` (host network — no Docker port mapping)
- **API:** `http://127.0.0.1:5030/api/v0`
- **Auth:** Bearer token or HTTP Basic Auth
- **Creds location:** `~/homelab-data/arr/slskd/slskd.yml` → `web: username / password`
- **Docs:** https://github.com/slskd/slskd/tree/master/docs
- **Note:** Runs in `network_mode: host`. The web UI and API are on port 5030 on the host directly.

### MeTube
- **Port:** `127.0.0.1:8081`
- **API:** Minimal REST API at `http://127.0.0.1:8081`
- **Auth:** None
- **Note:** Primarily a web UI. Has basic endpoints for adding downloads.

---

## Infrastructure

### Portainer
- **Port:** `127.0.0.1:9000`
- **API:** `http://127.0.0.1:9000/api`
- **Auth:** Bearer token in `Authorization: Bearer <jwt>` header
- **Key location:** Web UI → My Account → Access tokens
- **Docs:** https://docs.portainer.io/api/docs
- **Common endpoints:**
  - `GET /api/endpoints` — Docker endpoints
  - `GET /api/containers` — containers
  - `POST /api/stacks` — deploy stacks

### Gitea
- **Port:** `127.0.0.1:3000`
- **API:** `http://127.0.0.1:3000/api/v1`
- **Auth:** `Authorization: token <token>`
- **Key location:** Web UI → Settings → Applications → Generate Token
- **Docs:** https://docs.gitea.com/development/api-usage
- **Common endpoints:**
  - `GET /api/v1/user/repos` — repos
  - `GET /api/v1/user` — current user

### Nginx Proxy Manager (NPM)
- **Admin Port:** `127.0.0.1:81`
- **API:** `http://127.0.0.1:81/api`
- **Auth:** Bearer token
- **Key location:** Web UI → Settings → Access Tokens
- **Note:** The public proxy ports are 80/443. Admin API is on 81.

### Beszel
- **Hub Port:** `127.0.0.1:8089`
- **Hub API:** `http://127.0.0.1:8089/api`
- **Auth:** Session cookie / JWT
- **Key location:** Web UI login (no static API key by default)
- **Docs:** https://github.com/henrygd/beszel

### Beszel Agent
- **Port:** `45876` (host-bound, `0.0.0.0:45876`)
- **Protocol:** SSH-based metrics collection
- **Auth:** Ed25519 SSH key pair
- **Key location:** Hub reads `~/.config/beszel/key.pub`; agent env registers the public key
- **Note:** Not a REST API. The hub connects to agents over SSH on port 45876.

### Duplicati
- **Port:** `127.0.0.1:8200`
- **API:** `http://127.0.0.1:8200/api/v1`
- **Auth:** `X-API-KEY: <key>` header
- **Key location:** Web UI → Settings → Access Token
- **Docs:** https://duplicati.readthedocs.io/en/latest/07-other-command-line-utilities/#duplicati-server

### Watchtower
- **Container:** `watchtower`
- **API:** `http://watchtower:8080/v1/update` (internal Docker network only)
- **Auth:** None
- **Note:** HTTP API is disabled by default. Check compose for `WATCHTOWER_HTTP_API_TOKEN` if enabled.

### Caddy
- **Port:** No exposed ports (reverse proxy, binds 80/443 on host via NPM or directly)
- **Admin API:** `http://localhost:2019` (if enabled)
- **Auth:** None (localhost only)
- **Note:** Admin API is off by default in our Caddyfile.

---

## Apps & Custom Services

### Planka
- **Port:** `127.0.0.1:3333`
- **API:** `http://127.0.0.1:3333/api`
- **Auth:** Session cookie / JWT after login
- **Docs:** https://docs.planka.cloud/docs/API/

### AnythingLLM
- **Port:** varies; check compose for host mapping
- **API:** `/api`
- **Auth:** `Authorization: Bearer <api-key>`
- **Key location:** Web UI → Settings → API Keys
- **Docs:** https://docs.anythingllm.com/developer-api

### Dozzle
- **Port:** `127.0.0.1:8888`
- **API:** `http://127.0.0.1:8888/api`
- **Auth:** None (local only)
- **Note:** Primarily a log viewer. Has a lightweight events API for real-time logs.

### openclaw-hub
- **Port:** `18789` (public via Caddy) and `3000` (internal)
- **API:** varies by endpoint
- **Auth:** varies
- **Key location:** `homelab-agent-stack/.env`

### sync-server
- **Port:** Internal only (`3001`)
- **API:** FastAPI app
- **Auth:** API key in header
- **Key location:** `homelab-agent-stack/.env`

### Custom / Web-UI Only
These have no formal REST API:
- **BookBounty** (`5000`) — Web UI only
- **Huntorr** (`5002`) — Web UI only
- **daily-brief** (`3003`) — Static/script output
- **dashboard** (`3004`) — Custom status page
- **drip-api** (`3006`) — Custom API (document in its own repo)
- **drip-frontend** (`3007`) — Static frontend
- **board-dashboard** (`3334`) — Static dashboard
- **truth-site** (`3008`) — Static site
- **portfolio** (`3001`) — Static site
- **homepage** (`3005`) — Config-driven dashboard (no API)

---

## Public Domains (via Caddy / Cloudflare)

These are the public-facing URLs proxied through Caddy. Use these for external access; use `127.0.0.1` ports for internal scripting.

| Subdomain | Service | Internal Port |
|-----------|---------|---------------|
| `jellyfin.iamfaulty.com` | Jellyfin | 8096 |
| `qbittorrent.iamfaulty.com` | qBittorrent | 8080 |
| `sonarr.iamfaulty.com` | Sonarr | 8989 |
| `radarr.iamfaulty.com` | Radarr | 7878 |
| `lidarr.iamfaulty.com` | Lidarr | 8686 |
| `prowlarr.iamfaulty.com` | Prowlarr | 9696 |
| `jellyseerr.iamfaulty.com` | Jellyseerr | 5055 |
| `mylar3.iamfaulty.com` | Mylar3 | 8090 |
| `readarr.iamfaulty.com` | Readarr | 8787 |
| `bookbounty.iamfaulty.com` | BookBounty | 5000 |
| `huntorr.iamfaulty.com` | Huntorr | 5002 |
| `metube.iamfaulty.com` | MeTube | 8081 |
| `slskd.iamfaulty.com` | slskd | 5030 |
| `portainer.iamfaulty.com` | Portainer | 9000 |
| `homepage.iamfaulty.com` | Homepage | 3005 |
| `planka.iamfaulty.com` | Planka | 3333 |
| `dashboard.iamfaulty.com` | dashboard | 3004 |
| `board.iamfaulty.com` | board-dashboard | 3334 |
| `beszel.iamfaulty.com` | Beszel | 8089 |
| `gitea.iamfaulty.com` | Gitea | 3000 |
| `openclaw.iamfaulty.com` | openclaw-hub | 18789 |

---

## How to Update This Doc

1. Add/remove the service row in the **Quick Lookup** table.
2. Add/remove the detailed section in the appropriate category.
3. Update the **Public Domains** table if Caddy routes changed.
4. Commit with a message like: `docs(api): add X service to API_REFERENCE`.
5. Push to `main`.

---

## Troubleshooting

### "Authentication required" from localhost
Most *arr apps have `AuthenticationRequired: DisabledForLocalAddresses`. If you hit auth from `127.0.0.1`, check the config.xml.

### slskd network mode
slskd runs with `network_mode: host`. Its API is on `127.0.0.1:5030`, not inside the Docker bridge network.

### qBittorrent login
If qBittorrent returns `403 Forbidden` on API calls, you need to POST to `/api/v2/auth/login` first to get a session cookie, or enable "Bypass auth for localhost" in Web UI settings.
