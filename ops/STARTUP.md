# Homelab Startup — Reference (post 2026-07 migration)

## Architecture after cutover

| Host | What starts here |
|------|------------------|
| **firewall-vm** (`<lan-ip:firewall-vm>`) | Arr, jellyfin, homepage, gitea, apps, caddy + sync-server |
| **edge SBC** | Edge cluster (blocky DNS last, Home Assistant, NetAlertX, …) |
| **arm-mini** | OpenClaw, iMessage bridge, inference worker only — then **OrbStack quit** |

NAS compose: `/mnt/homelab/compose/` on firewall-vm (NFS to NAS).  
Migration runbooks: [`migration-2026-07-14/README.md`](migration-2026-07-14/README.md).

---

## Mini survivors (LaunchAgent)

On login (while OrbStack still required for survivors):

```
ai.iamfaulty.homelab-boot
  → ops/stack-up.sh
  → logs to /tmp/stack-up.log
```

`stack-up.sh` now starts **only** OpenClaw (and optional bridge/worker compose paths).  
It no longer loops the old 15 Mac OrbStack stacks.

After OrbStack is quit permanently, **disable** the LaunchAgent.

---

## firewall-vm bring-up (manual / systemd)

```bash
# Shared proxy network
docker network create proxy 2>/dev/null || true

# Typical app order (adjust to what lives under /mnt/homelab/compose)
for stack in gitea duplicati jellyfin arr homepage dozzle beszel anythingllm planka proxy; do
  [ -f "/mnt/homelab/compose/$stack/docker-compose.yml" ] || continue
  docker compose -f "/mnt/homelab/compose/$stack/docker-compose.yml" up -d
done
```

Mac→x86 reminders: strip `platform: linux/arm64`; UID `1000:1000` + `chown`.

---

## edge SBC edge

```bash
cd /opt/homelab
docker compose --profile apps up -d    # HA, kuma, speedtest, netalertx
# blocky LAST — see migration-2026-07-14/edge-sbc/MIGRATE.md
docker compose --profile dns up -d
```

---

## Checking status

```bash
# Mini — should be survivors only before OrbStack quit
docker ps --format "table {{.Names}}\t{{.Status}}" | sort

# firewall-vm
ssh firewall-vm 'docker ps --format "table {{.Names}}\t{{.Status}}" | sort'

cat /tmp/stack-up.log
```

---

## Common failure scenarios

### exec format error after a Mac→firewall-vm move

`platform: linux/arm64` left in compose. Strip it, `docker compose pull`, recreate.

### Permission denied on config volumes

Still `PUID=501` / files owned by 501. Fix yaml to `1000:1000` and `chown -R 1000:1000` the data dir.

### Agents dead after touching agent stack

Caddy/sync share(d) a compose project with OpenClaw. Read YAML first; split before `down`. See [`migration-2026-07-14/agent-stack-split/ANALYSIS.md`](migration-2026-07-14/agent-stack-split/ANALYSIS.md).

### LAN DNS broken

blocky moved too early or DHCP flipped before Pi dig worked. Keep old resolver until `dig @PI` succeeds; blocky is **last** in the edge move.

---

## Files

| File | Purpose |
|------|---------|
| `ops/stack-up.sh` | Mini survivors only |
| `ops/migration-2026-07-14/` | Remaining cutover runbooks |
| `reference/target-compose/` | Intended compose for homepage / edge / firewall-vm proxy |
| `/mnt/homelab/compose/` | Live compose on NAS (via firewall-vm NFS) |
