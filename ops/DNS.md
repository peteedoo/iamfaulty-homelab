# DNS — Reference

## Architecture

```
Browser → Cloudflare (proxied) → cloudflared tunnel → NPM (localhost:80) → container
```

All subdomains use the same tunnel (`3727ea81-b7a2-484c-8de9-3e55ab1a050c`).  
DNS lives in Cloudflare. NPM handles routing and SSL. Cloudflared connects the two.

---

## DNS resolvers on iamfaulty-mini

| Resolver | Address | Interface | Role |
|----------|---------|-----------|------|
| AdGuard Home | `192.168.68.90` | en0 (Wi-Fi) | Primary — handles all external DNS |
| Tailscale | `100.64.0.2` | utun5 | Tailscale peer names only |
| Cloudflare fallback | `1.1.1.1` | Wi-Fi (manual) | Backup if AdGuard is down |

Wi-Fi DNS is pinned manually:
```bash
sudo networksetup -setdnsservers Wi-Fi 192.168.68.90 1.1.1.1
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
ZONE_ID="2cface8cc11ef684192831a76e905a6c"
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "CNAME",
    "name": "newservice",
    "content": "3727ea81-b7a2-484c-8de9-3e55ab1a050c.cfargotunnel.com",
    "proxied": true
  }'
```

**3. Add proxy host in NPM** (`http://localhost:81`):
- Domain: `newservice.iamfaulty.com`
- Forward: `host.docker.internal` : `<port>`
- Websockets: on if needed
- SSL: save without SSL first, then edit and add Let's Encrypt cert

---

## Known issue — Tailscale DNS conflict

**Symptom:** `dig` times out on the mini. External devices resolve fine.

**Root cause:** Tailscale injects `100.64.0.2` as a system resolver via its network extension. When Tailscale's DNS daemon is unhealthy or not fully initialized, `100.64.0.2` goes unreachable but stays in the resolver list — blocking all DNS on the machine.

**What was tried (May 2026):**

| Fix | Result |
|-----|--------|
| `tailscale set --accept-dns=false` | Didn't remove 100.64.0.2 from resolver list |
| `networksetup -setdnsservers Wi-Fi 192.168.68.90 1.1.1.1` | Pinned correctly but Tailscale still intercepts |
| Uncheck "Use Tailscale DNS settings" in Tailscale prefs | Still injected via network extension |
| Set global nameserver in Tailscale admin panel | Didn't propagate in time |
| Quit Tailscale entirely | Cleared the resolver — DNS worked |

**Current state:** Tailscale DNS settings disabled in prefs. Wi-Fi DNS pinned to AdGuard + 1.1.1.1. If the issue recurs after Tailscale restarts, quit Tailscale and relaunch — the dead resolver entry clears.

**Long-term fix:** In the Tailscale admin panel (`tailscale.com/admin/dns`), set `192.168.68.90` as the global nameserver so Tailscale forwards to AdGuard instead of its own resolver.

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
