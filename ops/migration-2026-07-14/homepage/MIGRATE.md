# homepage → firewall-vm

## Why

Dashboard still on OrbStack. Move to firewall-vm with the rest of the apps stack so the mini can shed another container before OrbStack quit.

## Current (stale Mac archive)

See `_archive_stale_compose/homepage/docker-compose.yml`:

- `PUID: "501"` / `PGID: "20"` — **will break on Linux**
- `127.0.0.1:3005:3000`
- docker.sock + `./config`
- external network `proxy`

## Target compose

Copy [`reference/target-compose/homepage/docker-compose.yml`](../../../reference/target-compose/homepage/docker-compose.yml) to:

```text
/mnt/homelab/compose/homepage/docker-compose.yml
```

Changes vs Mac copy:

| Item | Old | New |
|------|-----|-----|
| PUID/PGID | 501/20 | **1000/1000** |
| platform | (none in archive; still verify live) | **must not pin arm64** |
| config volume | `./config` (NAS-relative ok) | same; **chown 1000:1000** |
| ports | `127.0.0.1:3005:3000` | keep if Caddy/NPM on same host; else bind as needed for firewall-vm proxy |

## Steps

```bash
# 1) On mini: stop homepage
docker compose -f /Volumes/homelab/compose/homepage/docker-compose.yml down

# 2) On firewall-vm: ensure compose yaml is the target (UID 1000), then:
sudo chown -R 1000:1000 /mnt/homelab/compose/homepage/config   # or actual data path
docker network create proxy 2>/dev/null || true
cd /mnt/homelab/compose/homepage
grep -n platform docker-compose.yml || true
docker compose pull
docker compose up -d
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3005/
```

## Proxy / DNS follow-ups

- If **Caddy** still on mini and proxies `homepage.iamfaulty.com` → `host.docker.internal:3005`, update that route to **firewall-vm** (`<lan-ip:firewall-vm>:3005`) **before** or **as** homepage moves.
- Homepage widgets that scrape docker.sock only see **local** containers on firewall-vm — remote hosts need Agent / API widgets (Beszel/Dozzle already on firewall-vm help).

## Verify

- [ ] `docker compose ps` healthy on firewall-vm
- [ ] UI loads on `:3005`
- [ ] Services listed / widgets that must work still work
- [ ] Mini no longer has a `homepage` container
