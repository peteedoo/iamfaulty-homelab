# Edge cluster → edge SBC

Target services (~363MB combined): **homeassistant**, **netalertx**, **speedtest-tracker**, **uptime-kuma**, **blocky**.

> **blocky is LAN DNS — move LAST.** Bring the other four up, prove stable, then cut DNS.

## Order

1. Create Pi data dirs + copy configs from mini/NAS
2. Deploy non-DNS services from [`reference/target-compose/edge-sbc/docker-compose.yml`](../../../reference/target-compose/edge-sbc/docker-compose.yml)
3. Point any reverse-proxy / homepage widgets at the Pi LAN IP
4. Deploy **blocky** (same compose, profile `dns` — or uncomment ports)
5. Parallel-run: temporarily point one test client at Pi `:53`
6. Flip router DHCP DNS / static clients → Pi
7. Only then stop blocky on the mini

## Pre-flight on edge SBC

```bash
# Docker + compose plugin present
docker version
# Disable systemd-resolved stub if it holds :53 (common on Ubuntu; check your Pi OS)
# If host uses NetworkManager, ensure nothing else binds 53 before blocky cutover.
sudo mkdir -p /opt/homelab/{homeassistant,netalertx,speedtest-tracker,uptime-kuma,blocky}
# Copy configs from current host (prefer root rsync + chown where the image needs it)
```

Ownership notes:

| Service | Typical UID | Notes |
|---------|-------------|-------|
| homeassistant | image default | Follow HA docs; often not 1000 |
| uptime-kuma | node user in image | Named volume or chown per image |
| speedtest-tracker | often `PUID/PGID` | Set **1000:1000** on Linux |
| netalertx | often `20211` or host | Prefer official compose; **host network** |
| blocky | root/unprivileged ok | Needs host **53/tcp+udp** |

Pi is **aarch64** — multi-arch images are fine. Do **not** pin `platform: linux/amd64`.

## Non-DNS first

```bash
cd /opt/homelab   # or where you placed the compose
docker compose --profile apps up -d
docker compose ps
```

Verify:

- [ ] Home Assistant UI
- [ ] Uptime Kuma UI
- [ ] Speedtest Tracker UI
- [ ] NetAlertX scanning (host network)

## blocky LAST

```bash
# From a laptop still on old DNS:
dig @<CURRENT_BLOCKY_IP> google.com +short

# Start blocky on Pi (do not stop old blocky yet)
docker compose --profile dns up -d blocky
dig @<PI_LAN_IP> google.com +short
dig @<PI_LAN_IP> iamfaulty.com +short   # if you have local records

# Point ONE client at Pi DNS, browse for 10–15 min
# Then flip DHCP option 6 (or ISP router DNS) to Pi
# Finally stop blocky on mini
```

Rollback: leave old blocky running until DHCP flip is confirmed. DHCP clients may take a lease renew to switch — keep old DNS up for one lease period if possible.

## After success on mini

Stop/remove edge containers only after Pi is authoritative for DNS and dashboards.

Update [`ops/DNS.md`](../../DNS.md): primary resolver becomes the **edge SBC LAN IP** (replace AdGuard `<lan-ip:adguard>` references if that IP retires).
