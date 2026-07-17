# DNS — Reference

## Architecture

```
Browser → Cloudflare (proxied) → cloudflared tunnel → reverse proxy → container
```

All subdomains use the same tunnel (`<redacted>`).  
DNS lives in Cloudflare. Local reverse proxy (Caddy / NPM) handles routing. Cloudflared connects the two.

> **2026-07 migration:** LAN ad-blocking DNS is moving from the mini/OrbStack **blocky** instance to **edge SBC**. Move blocky **last** in the edge cluster — see [`migration-2026-07-14/edge-sbc/MIGRATE.md`](migration-2026-07-14/edge-sbc/MIGRATE.md). After cutover, point DHCP / clients at `PI_LAN_IP`, not the old resolver.

---

## DNS resolvers (LAN)

| Resolver | Address | Role | Status |
|----------|---------|------|--------|
| blocky (target: edge SBC) | `PI_LAN_IP` | Primary LAN DNS / ad-block | **Pending move — do last** |
| AdGuard Home (legacy) | `<lan-ip:adguard>` | Prior primary on LAN | Retire when blocky on Pi is authoritative |
| Tailscale | `100.64.0.2` | Tailscale peer names only | Avoid as general resolver |
| Cloudflare fallback | `1.1.1.1` | Backup if local DNS is down | OK |

Mini Wi-Fi (until OrbStack/DNS cutover finishes) can still pin manually:
```bash
sudo networksetup -setdnsservers Wi-Fi <CURRENT_DNS_IP> 1.1.1.1
```

---

## Adding a new subdomain

**1. Add to cloudflared ingress** (`~/.cloudflared/config.yml`):
```yaml
- hostname: newservice.iamfaulty.com
  service: http://localhost:80
```
Then reload cloudflared:
```bash
launchctl unload ~/Library/LaunchAgents/com.iamfaulty.cloudflared.plist
launchctl load ~/Library/LaunchAgents/com.iamfaulty.cloudflared.plist
```

**2. Add DNS record in Cloudflare:**
```bash
ZONE_ID="<redacted>"
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "CNAME",
    "name": "newservice",
    "content": "<redacted>.cfargotunnel.com",
    "proxied": true
  }'
```

**3. Add proxy host in NPM** (`http://localhost:81`):
- Domain: `newservice.iamfaulty.com`
- Forward: `host.docker.internal` : `<port>`
- Websockets: on if needed
- SSL: request Let's Encrypt cert — do **not** enable Force SSL
- Advanced: do **not** enable Trust Upstream Forwarded Proto Headers (cloudflared doesn't pass it)

> Cloudflare terminates SSL. NPM always receives HTTP from the tunnel. Force SSL causes
> an infinite redirect loop — Cloudflare sends HTTP, NPM redirects to HTTPS, repeat.

---

## Known issue — Tailscale DNS conflict

**Symptom:** `dig` times out on the mini. External devices resolve fine.

**Root cause:** Tailscale injects `100.64.0.2` as a system resolver via its network extension. When Tailscale's DNS daemon is unhealthy or not fully initialized, `100.64.0.2` goes unreachable but stays in the resolver list — blocking all DNS on the machine.

**What was tried (May 2026):**

| Fix | Result |
|-----|--------|
| `tailscale set --accept-dns=false` | Didn't remove 100.64.0.2 from resolver list |
| `networksetup -setdnsservers Wi-Fi <lan-ip:adguard> 1.1.1.1` | Pinned correctly but Tailscale still intercepts |
| Uncheck "Use Tailscale DNS settings" in Tailscale prefs | Still injected via network extension |
| Set global nameserver in Tailscale admin panel | Didn't propagate in time |
| Quit Tailscale entirely | Cleared the resolver — DNS worked |

**Current state:** Tailscale DNS settings disabled in prefs. Wi-Fi DNS pinned to AdGuard + 1.1.1.1. If the issue recurs after Tailscale restarts, quit Tailscale and relaunch — the dead resolver entry clears.

**Long-term fix:** In the Tailscale admin panel (`tailscale.com/admin/dns`), set the **current LAN DNS** (edge SBC blocky after cutover, or AdGuard `<lan-ip:adguard>` until then) as the global nameserver so Tailscale forwards there instead of its own resolver.

---

## Tunnel ingress (current)

```yaml
- hostname: home.iamfaulty.com       → localhost:3004
- hostname: iamfaulty.com            → localhost:80  (NPM)
- hostname: www.iamfaulty.com        → localhost:80  (NPM)
- hostname: gitea.iamfaulty.com      → localhost:80  (NPM)
- hostname: jellyfin.iamfaulty.com   → localhost:8096
- hostname: request.iamfaulty.com    → localhost:80  (NPM)
- hostname: openclaw.iamfaulty.com   → localhost:80  (NPM)
- hostname: plex.iamfaulty.com       → localhost:32400
- hostname: overseerr.iamfaulty.com  → localhost:5055
- catch-all                          → http_status:404
```
