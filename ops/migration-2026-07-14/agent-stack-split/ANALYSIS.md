# Agent stack split — Caddy + sync-server vs OpenClaw

## Read this before touching the stack

`caddy` and `sync-server` live in the **same Compose project** as OpenClaw’s agent stack on the mini. A naive `docker compose down` or moving the whole project **will break agent routing** (`openclaw.iamfaulty.com`, catch-all → OpenClaw).

**Priority constraint:** OpenClaw **stays** on `arm-mini`. Caddy + sync-server **leave** so OrbStack can quit.

## What the tracked reference currently shows

`reference/agent-stack-docker-compose.yml` (as of last audit copy):

| Service | Image / build | Ports | Role |
|---------|---------------|-------|------|
| `sync-server` | build `./sync-server` | `127.0.0.1:13001:3001` | Sync API; Caddy routes `sync.iamfaulty.com` → `sync-server:3001` |
| `caddy` | `caddy:2-alpine` | `127.0.0.1:80` / `443` | Reverse proxy; most backends via `host.docker.internal` |

OpenClaw is **not** in that tracked YAML — but production may have added it to the **same project**. Treat the file on disk as truth:

```bash
# On mini — READ LIVE YAML FIRST
cat ~/homelab-agent-stack/docker-compose.yml
# or wherever the agent stack lives now
docker compose -f ~/homelab-agent-stack/docker-compose.yml config --services
docker compose -f ~/homelab-agent-stack/docker-compose.yml ps
```

Also read the live Caddyfile. Tracked copy: `reference/Caddyfile`. Critical OpenClaw-related routes:

```text
openclaw.iamfaulty.com  → host.docker.internal:18800
iamfaulty.com (root)    → host.docker.internal:18800
catch-all handle        → host.docker.internal:18800
sync.iamfaulty.com      → sync-server:3001
```

Most other routes still point at former Mac host ports (jellyfin, arr, homepage, …). Those backends are already (or soon) on **firewall-vm** — the Caddyfile must be rewritten to LAN IPs as part of this move, not left on `host.docker.internal`.

## Split procedure (safe)

### 1. Snapshot

```bash
cp -a ~/homelab-agent-stack ~/homelab-agent-stack.bak-$(date +%F)
docker compose -f ~/homelab-agent-stack/docker-compose.yml config > /tmp/agent-stack.resolved.yml
```

### 2. Extract OpenClaw into its own project on the mini

Create e.g. `~/openclaw/docker-compose.yml` containing **only** OpenClaw (and iMessage bridge / inference worker if they share this file). Do **not** include caddy or sync-server.

```bash
cd ~/openclaw && docker compose up -d
# Confirm OpenClaw still answers on :18800 (or its real port)
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18800/
```

### 3. Leave Caddy running (temporary) until proxy is relocated

Do **not** stop Caddy until either:

- a replacement proxy on **firewall-vm** is answering the same hostnames, **or**
- you intentionally accept downtime for `*.iamfaulty.com` local routing

### 4. Deploy proxy stack on firewall-vm

Use [`reference/target-compose/proxy/`](../../../reference/target-compose/proxy/):

- `docker-compose.yml` — caddy + sync-server only
- `Caddyfile` — backends use **LAN IPs** (`<lan-ip:firewall-vm>` for local firewall-vm containers, mini IP for OpenClaw, edge SBC IP for edge UIs)

Replace placeholders:

| Placeholder | Meaning |
|-------------|---------|
| `MINI_LAN_IP` | arm-mini Wi‑Fi/Ethernet address |
| `PI_LAN_IP` | edge SBC address |
| `<lan-ip:firewall-vm>` | firewall-vm LAN address |

Sync-server needs its build context (`sync-server/`) and `SYNC_TOKEN` — copy from the mini project, don’t invent a new secret mid-cutover unless you rotate clients.

### 5. Cut DNS / tunnel / client traffic to the new proxy

Depending on how traffic reaches Caddy today (local DNS → mini, Cloudflare tunnel → mini NPM/Caddy, etc.):

- Point tunnel / NPM upstream at **firewall-vm** where appropriate
- Or move cloudflared with the proxy (separate decision — not required for OrbStack quit if tunnel can target firewall-vm)

### 6. Stop Caddy + sync on mini; remove from agent compose

```bash
# Only after firewall-vm proxy is healthy and OpenClaw still reachable via new path
docker compose -f ~/homelab-agent-stack/docker-compose.yml stop caddy sync-server
# Edit YAML: delete caddy + sync-server services (OpenClaw already extracted)
docker compose -f ~/homelab-agent-stack/docker-compose.yml up -d   # leftover services only, if any
```

### 7. OrbStack quit

When mini containers are only: iMessage bridge, OpenClaw, inference worker → quit OrbStack (~3GB unified memory back).

## Failure modes

| Mistake | Result |
|---------|--------|
| `compose down` whole agent stack | OpenClaw + routing die together |
| Move Caddy without rewriting backends | All `host.docker.internal` routes point at firewall-vm itself → broken apps |
| Move Caddy before OpenClaw listen confirmed | Agents unreachable externally/locally |
| Change `SYNC_TOKEN` during cutover | Clients desync |

## Definition of done

- [ ] OpenClaw compose is standalone on mini
- [ ] Caddy + sync-server run on firewall-vm
- [ ] Caddyfile uses LAN IPs; OpenClaw routes → `MINI_LAN_IP:18800` (or real port)
- [ ] `sync.iamfaulty.com` healthy through new Caddy
- [ ] Mini docker ps matches survivors-only list
- [ ] OrbStack quit
