# Mac → minifw (x86) checklist

Print this. Tick every box on **every** Mac→minifw service move.

## Before `rsync` / pull

- [ ] Open the live `docker-compose.yml` on the NAS / mini
- [ ] Search for `platform:` — if `linux/arm64` (or any arm pin), **delete the line**
- [ ] Search for `501`, `USER_UID`, `PUID`, `PGID`, `USER_GID`, `user:`
  - Replace macOS IDs (`501` / `20`) with Linux (`1000` / `1000`)
  - Prefer env vars `PUID=1000` `PGID=1000` or `user: "1000:1000"` matching the image docs
- [ ] Rewrite volume host paths: `/Users/...` and `/Volumes/homelab/...` → minifw paths (`/mnt/homelab/...`, `/opt/homelab-data/...`, etc.)
- [ ] Drop macOS-only mount tricks (`osascript`, OrbStack socket paths) — use Linux docker socket `/var/run/docker.sock`

## Data copy

```bash
# On minifw, as root (or with sudo) — preserve + force Linux ownership
sudo rsync -aHAX --info=progress2 \
  --chown=1000:1000 \
  /path/from/ \
  /path/to/

# Always verify after any non-root rsync
sudo chown -R 1000:1000 /path/to/
```

## Bring up

```bash
cd /mnt/homelab/compose/<stack>
# confirm no arm platform pin
grep -n platform docker-compose.yml || echo 'no platform pin — good'

docker compose pull
docker compose up -d
docker compose ps
docker compose logs --tail=80
```

## If you see these errors

| Symptom | Cause | Fix |
|---------|-------|-----|
| `exec format error` | arm64 image / `platform: linux/arm64` on x86 | Strip platform, `compose pull --policy always`, recreate |
| `Permission denied` on config/DB | UID 501 leftovers | Fix yaml + `chown -R 1000:1000` data dir |
| Image pulls linux/arm64 anyway | digest / cache from mini | `docker compose pull` on **minifw**; prune old images |

## After cutover on mini

```bash
docker compose -f <old-path> down
# optional: docker image prune
```
