# Runbook: Cloudflared Tunnel DNS Failure (Tailscale Conflict)

**Date:** 2026-05-23  
**Author:** peteedoo + Kimi CLI  
**Status:** RESOLVED  
**Severity:** HIGH — all public subdomains offline  
**Affected Services:** All `*.iamfaulty.com` subdomains routed through Cloudflare Tunnel

---

## 1. Symptoms

- `curl https://wiki.iamfaulty.com/` → timeout / 530 / 502
- `curl https://gitea.iamfaulty.com/` → timeout / 530 / 502
- `curl https://truth.iamfaulty.com/` → 530 (origin unreachable)
- Cloudflared log repeating:
  ```
  ERR Failed to fetch features, default to disable 
    error="lookup cfd-features.argotunnel.com on 100.64.0.2:53: 
    dial udp 100.64.0.2:53: i/o timeout"
  ERR edge discovery: error looking up Cloudflare edge IPs: the DNS query failed
    error="lookup _v2-origintunneld._tcp.argotunnel.com on 100.64.0.2:53: 
    read udp ... i/o timeout"
  ```

## 2. Root Cause

Tailscale's DNS resolver (`100.64.0.2`) was configured as the system-wide DNS. It resolved general domains (e.g. `google.com`) but **timed out on all Cloudflare Tunnel-specific lookups**:

| Domain | Via Tailscale DNS | Via 1.1.1.1 |
|--------|-------------------|-------------|
| `google.com` | ✅ 142ms | ✅ 4ms |
| `_v2-origintunneld._tcp.argotunnel.com` (SRV) | ❌ timeout | ✅ 4ms |
| `region1.v2.argotunnel.com` | ❌ timeout | ✅ 4ms |
| `cfd-features.argotunnel.com` | ❌ timeout | ✅ 4ms |

Cloudflared reads `/etc/resolv.conf` directly (not macOS's `scutil` resolver stack). On macOS, `/etc/resolv.conf` only contained:

```
nameserver 100.64.0.2
```

This meant cloudflared had **zero working DNS** for edge discovery.

### Why It Started Now

Unknown exact trigger. Possible causes:
- Tailscale MagicDNS update pushed a broken upstream
- Tailscale DNS forwarder temporarily degraded
- macOS DNS ordering changed after a Tailscale reconnect
- The issue was latent and only surfaced when cloudflared restarted (it had been running since ~Apr 16 with cached edge IPs)

## 3. Environment

| Component | Details |
|-----------|---------|
| Host | Mac mini M4 (`iamfaulty-mini`) |
| OS | macOS (darwin/arm64) |
| Tailscale | Active, `iamfaulty-mini-1.tailc0ac22.ts.net` |
| Tailscale DNS | `100.64.0.2` (MagicDNS enabled in console) |
| Cloudflared | v2026.3.0, installed via Homebrew |
| Tunnel ID | `3727ea81-b7a2-484c-8de9-3e55ab1a050c` |
| Reverse Proxy | Nginx Proxy Manager (`npm` container) on `0.0.0.0:80/443` |

## 4. Fix Applied

### 4.1 Migrated cloudflared from macOS process → Docker container

**Why:** Docker containers can use independent DNS (`--dns 1.1.1.1`) without affecting the host's Tailstack setup.

**Container:**
```bash
docker run -d \
  --name cloudflared \
  --restart unless-stopped \
  --dns 1.1.1.1 \
  --add-host="host.docker.internal:0.250.250.254" \
  --network truth-net \
  -v ~/.cloudflared:/etc/cloudflared:ro \
  -v /tmp/cloudflared-docker-config.yml:/etc/cloudflared/config.yml:ro \
  cloudflare/cloudflared:latest \
  tunnel --config /etc/cloudflared/config.yml run
```

**Key flags:**
- `--dns 1.1.1.1` → bypasses Tailscale DNS entirely
- `--add-host="host.docker.internal:0.250.250.254"` → restores Docker Desktop's host gateway mapping (normally provided by Docker's embedded DNS, which is bypassed by `--dns`)
- `--network truth-net` → shared network with `truth-site` container so `truth.iamfaulty.com` routes to `http://truth-site:80`

### 4.2 Config changes

**`~/.cloudflared/config.yml`** — added:
```yaml
protocol: http2
edge-ip-version: auto
```

**`~/.cloudflared/config.yml`** — added ingress rule:
```yaml
  - hostname: truth.iamfaulty.com
    service: http://localhost:80
```

*(Note: the Docker container uses a separate bind-mounted config at `/tmp/cloudflared-docker-config.yml` with `host.docker.internal` instead of `localhost` for host-routed services.)*

### 4.3 DNS record created

```bash
cloudflared tunnel route dns 3727ea81-b7a2-484c-8de9-3e55ab1a050c truth.iamfaulty.com
```

Result: CNAME `truth.iamfaulty.com` → `<tunnel-id>.cfargotunnel.com`

### 4.4 Launchd service disabled

```bash
launchctl unload ~/Library/LaunchAgents/com.iamfaulty.cloudflared.plist
```

The plist was also modified to add `GODEBUG=netdns=cgo` as a fallback experiment, but the Docker approach proved more reliable.

## 5. Verification

```bash
# Test truth subdomain
curl -s -o /dev/null -w "%{http_code}" https://truth.iamfaulty.com/
# → 200

# Test existing wiki
curl -s -o /dev/null -w "%{http_code}" https://wiki.iamfaulty.com/
# → 200

# Test gitea
curl -s -o /dev/null -w "%{http_code}" https://gitea.iamfaulty.com/
# → 200

# Test openclaw hub
curl -s -o /dev/null -w "%{http_code}" https://openclaw.iamfaulty.com/
# → 200
```

Tunnel connections (4 active edges):
```
connIndex=0 ip=198.41.200.53  location=slc01
connIndex=1 ip=198.41.192.77  location=den03
connIndex=2 ip=198.41.192.7   location=den03
connIndex=3 ip=198.41.200.193 location=slc01
```

## 6. Rollback Plan

If the Docker container fails:

```bash
# Stop Docker cloudflared
docker rm -f cloudflared

# Re-enable launchd service
launchctl load ~/Library/LaunchAgents/com.iamfaulty.cloudflared.plist

# If DNS is still broken on macOS, temporarily fix /etc/resolv.conf
# (auto-generated — changes will be lost on reboot/network change)
sudo rm /etc/resolv.conf
sudo bash -c 'echo "nameserver 1.1.1.1" > /etc/resolv.conf'
```

## 7. Prevention

### 7.1 Monitor tunnel health

Add to Beszel or daily-brief:
```bash
#!/bin/bash
for host in wiki iamfaulty gitea truth; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://${host}.iamfaulty.com/")
  if [ "$code" != "200" ] && [ "$code" != "302" ]; then
    echo "ALERT: ${host}.iamfaulty.com returned HTTP $code"
  fi
done
```

### 7.2 Monitor cloudflared DNS specifically

```bash
# If this times out, the tunnel will fail soon
dig @100.64.0.2 _v2-origintunneld._tcp.argotunnel.com SRV +timeout=5
```

### 7.3 Consider long-term fix

**Option A:** Configure Tailscale admin console to use `1.1.1.1` as upstream DNS instead of the default. This fixes the root cause without needing Docker workarounds.

**Option B:** Keep the Docker setup. It's actually more robust — isolated DNS, restartable without affecting macOS system state, and version-pinned via image tags.

**Option C:** Run a local DNS forwarder (dnsmasq/unbound) on macOS that forwards `*.argotunnel.com` to `1.1.1.1` and everything else to Tailscale.

## 8. Related Artifacts

| Artifact | Path |
|----------|------|
| This runbook | `~/iamfaulty-homelab/ops/runbooks/2026-05-23-cloudflared-tailscale-dns-fix.md` |
| Live truth site | `~/homelab-data/truth-site/index.html` |
| Truth site compose | `~/homelab-data/truth-site/docker-compose.yml` |
| Cloudflared config | `~/.cloudflared/config.yml` |
| Cloudflared Docker config | `/tmp/cloudflared-docker-config.yml` |
| Launchd plist | `~/Library/LaunchAgents/com.iamfaulty.cloudflared.plist` |
| Master index source | `~/MASTER_AI_JOURNEY_INDEX.md` |

---

*Last updated: 2026-05-23*
