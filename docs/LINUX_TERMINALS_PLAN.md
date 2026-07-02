# Linux Terminals / Thin-Client Desktops — Design & Runbook

**Status:** Plan only — nothing built yet. This document is for review before implementation.
**Goal:** Run Linux centrally and turn cheap devices (Pis, old laptops, tablets, thin clients) into "terminal computers" that connect to those central Linux desktops.

---

## TL;DR

- **Full VMs are not the right path here.** There is no hypervisor (no Proxmox/ESXi), and the primary host (Mac mini M4) is **Apple Silicon / ARM64**, so it can't run x86 Linux VMs natively.
- **Containers are the right path.** Run a **browser-accessible Linux desktop** as a Docker container (`linuxserver/webtop`, which has ARM64 images). Each "terminal" becomes anything with a browser — no client software to install.
- **Recommended host: the UGREEN NAS** *if* its model supports Docker (UGOS Pro). Fallback: the Mac mini after disk cleanup. See [Host decision](#host-decision).
- **Access: both** — private over Tailscale by default, plus an optional public subdomain (`desktop.iamfaulty.com`) fronted by auth, using the existing Cloudflare Tunnel + NPM plumbing.

---

## Why containers, not VMs

| Constraint | Consequence |
|-----------|-------------|
| No hypervisor anywhere (searched: Proxmox/ESXi/LXC/KVM — none) | Can't spin a VM per terminal without new infra |
| Mac mini M4 is ARM64 (Apple Silicon) | Can't run x86 Linux VMs; **all images must be ARM64** |
| Mini SSD at **93%** (~17 GB free, per `AUDIT_REPORT_2026-05-26.md`) | Heavy desktop images (2–5 GB each) are risky on the mini as-is |
| Existing stack is Docker/OrbStack + Caddy/NPM + Cloudflare Tunnel + Tailscale | A new desktop slots into the **exact same pattern** as every other service |

A browser-based desktop container gives ~90% of what people actually want from "a Linux terminal computer" (a real XFCE/KDE desktop, apps, a terminal, a browser) at a fraction of the weight of a VM, and it clones in seconds.

---

## Host decision

> This is the one thing to confirm before building. It comes down to **which UGREEN model** you have.

**The repo documents the NAS only as "UGREEN NAS (`ILLMATIC`, `192.168.68.69`)" — the exact model isn't recorded.** UGOS Pro ships a Docker app on the DXP-series NASes; the Plus/Pro tiers additionally support full VMs. So:

```
Does the UGREEN model support the UGOS "Docker" app?
├─ YES  → HOST ON THE NAS  (recommended)
│         • Keeps graphical load off the mini's 93%-full SSD
│         • NAS has the storage headroom for desktop images + user data
│         • Desktops live next to the media/persistent share
└─ NO / unsure
          → HOST ON THE MAC MINI (fallback)
            • OrbStack is already running; fits the existing stack
            • BUT free disk first (see cleanup below) — desktop images are 2–5 GB
```

**Recommendation: prefer the NAS.** It has the storage and keeps desktops off the disk-pressured mini. Only fall back to the mini if the UGREEN model can't run Docker.

**To confirm the model:** UGOS → Control Panel → Info Center (or the sticker on the unit). Look for `DXP2800 / DXP4800 / DXP4800 Plus / DXP6800 Pro / DXP8800 Plus`, then check that the **Docker** app is installable. If you tell me the model, I'll finalize the host.

**If falling back to the mini, free space first** (from the audit — reclaims ~20 GB+):
```bash
docker image prune -a              # ~6.8 GB (47 images, orphans like us-app)
# clean ~/Downloads (7.9 GB), compact OrbStack VM disk via OrbStack settings
```

---

## Software choice

| Option | What it is | Fit here |
|--------|-----------|----------|
| **`linuxserver/webtop`** ✅ | Full XFCE/KDE/Mate desktop served in the browser (KasmVNC). ARM64 images. | **Primary pick.** Lightweight, one container = one desktop, matches the linuxserver.io images already in the stack. |
| Kasm Workstations | Full brokered VDI platform (spin desktops on demand, per-user) | Overkill to start; heavier; ARM support more limited. Revisit if you outgrow webtop. |
| Guacamole + separate desktops | Clientless RDP/VNC/SSH gateway | Good if you later add real VMs/hosts to reach; unnecessary for container-only desktops. |

Start with **webtop**. Each terminal is its own container (own home dir, own installed apps), independently clone-able.

---

## Architecture

```
                          ┌─────────────────────────────────────┐
  Thin clients            │   Host (UGREEN NAS  ◀recommended     │
  (browser only)          │        or Mac mini / OrbStack)       │
  ┌──────────┐            │                                      │
  │ Pi / old │            │   webtop-1  (XFCE desktop)  :3000     │
  │ laptop / │  ── LAN ──▶│   webtop-2  (clone)         :3010     │
  │ tablet   │            │   webtop-N  ...                       │
  └──────────┘            └───────────────┬──────────────────────┘
                                          │
        ┌─────────────────────────────────┴───────────────────────┐
        │                                                          │
   PRIVATE path                                          PUBLIC path (optional)
   Tailscale (already installed)                         Cloudflare Tunnel → NPM
   http://<tailscale-name>:3000                          desktop.iamfaulty.com
   No public exposure                                    + auth in front (required)
```

---

## Access design (both, as requested)

### 1. Private — Tailscale (default, most secure)
- You already run Tailscale on the mini. Reach the desktop at `http://<host-tailscale-name>:3000` from any device on the Tailnet.
- No public exposure, no extra auth strictly required (Tailnet is the perimeter). This is the **recommended day-to-day path**.

### 2. Public — `desktop.iamfaulty.com` (optional, convenient anywhere)
Follows the existing recipe in `ops/DNS.md` verbatim. **A public desktop MUST have auth in front — do not expose a root-capable desktop unauthenticated.**

- **cloudflared ingress** (`~/.cloudflared/config.yml`):
  ```yaml
  - hostname: desktop.iamfaulty.com
    service: http://localhost:80
  ```
- **Cloudflare DNS:** CNAME `desktop` → `3727ea81-b7a2-484c-8de9-3e55ab1a050c.cfargotunnel.com` (proxied).
- **NPM proxy host:** `desktop.iamfaulty.com` → forward `host.docker.internal:3000`, **Websockets ON** (required for KasmVNC), Let's Encrypt cert.
- **Auth (pick one, required for public):**
  - webtop built-in: set `CUSTOM_USER` + `PASSWORD` env (basic gate), **and/or**
  - an NPM Access List (HTTP basic auth) in front, **and/or**
  - Authelia/Cloudflare Access for real SSO. Recommended: at minimum NPM access list + webtop password; Cloudflare Access if you want MFA.

---

## Thin-client hardware (the "terminal computers")

Anything with a modern browser works. Best value → nicest:
- **Raspberry Pi 4/5** in kiosk mode — silent, ~$35–80, boots straight to the desktop URL.
- **Used thin clients** (Dell Wyse, HP t-series) — often $20–40, purpose-built.
- **Old laptops/PCs** — reuse what you have; the browser does all the work.
- **Tablets/phones** — for casual access.

Wired gigabit makes the remote desktop feel local; Wi-Fi is usable but can feel laggy for graphical work.

---

## Implementation runbook (ready to execute once host is confirmed)

> Conventions from `docs/AGENT_TRAINING.md`: `PUID=501 / PGID=20`, bind ports to localhost, no `network_mode: host`.

**Step 1 — Compose (one desktop).** Add to a new `~/homelab-data/webtop/docker-compose.yml` (mini) or the NAS Docker app:
```yaml
services:
  webtop:
    image: lscr.io/linuxserver/webtop:ubuntu-xfce   # ARM64 pulled automatically
    container_name: webtop
    security_opt:
      - seccomp:unconfined            # smoother desktop; drop if you want stricter
    environment:
      - PUID=501
      - PGID=20
      - TZ=America/New_York           # set your zone
      - TITLE=iamfaulty terminal
      # - CUSTOM_USER=you             # enable for public/auth
      # - PASSWORD=change-me
    volumes:
      - ~/homelab-data/webtop/config:/config
    ports:
      - "127.0.0.1:3000:3000"         # http GUI (localhost only; NPM/Tailscale front it)
    shm_size: "1gb"                    # browsers inside the desktop need shared mem
    restart: unless-stopped
    labels:
      - com.centurylinklabs.watchtower.enable=true
```

**Step 2 — Bring it up & test privately:** `docker compose up -d`, then browse `http://localhost:3000` on the host and `http://<tailscale-name>:3000` from another device.

**Step 3 — (Optional) publish** via the `ops/DNS.md` 3-step recipe above (cloudflared → Cloudflare DNS → NPM), with auth enabled.

**Step 4 — More terminals:** copy the service block, change `container_name`, host port (`3010`, `3020`, …), and config volume. Each is an independent desktop.

---

## Risks & constraints

- **Disk (mini path):** desktops + per-user data grow; the mini is already at 93%. Prefer the NAS, or clean up + monitor via Beszel (audit already recommends alerting >85%).
- **ARM64 only:** a few Linux apps ship x86-only and won't run inside an ARM desktop. Most mainstream apps are fine.
- **Performance:** browser-delivered desktops are great for terminals, coding, browsing, office; heavy 3D/GPU work is not the sweet spot (no GPU passthrough here).
- **Security:** never expose an unauthenticated desktop publicly. Private-over-Tailscale is the safe default; gate any public route.
- **Not persistent VMs:** these are containers — treat `/config` as the durable home; don't rely on state outside mounted volumes.

---

## Open decisions before I build

1. **UGREEN model?** → confirms NAS vs mini as host.
2. **Desktop flavor?** XFCE (light, recommended) vs KDE (heavier, prettier).
3. **How many terminals** to provision initially (1 to prove it, then clone).
4. **Public auth choice** if we expose it (NPM access list vs webtop password vs Cloudflare Access).

Answer #1 and #2 and I can move from plan to build.
