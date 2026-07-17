# Target compose — post Mac→firewall-vm / edge-SBC migration

These are **intended** compose files for the remaining 2026-07-14 cutover steps.
They are not live until copied onto the NAS (`/mnt/homelab/compose/`) or Pi (`/opt/homelab/`).

| Path | Deploy to | Host |
|------|-----------|------|
| `homepage/` | `/mnt/homelab/compose/homepage/` | firewall-vm `<lan-ip:firewall-vm>` |
| `edge-sbc/` | `/opt/homelab/` (or similar) | edge SBC |
| `proxy/` | `/mnt/homelab/compose/proxy/` (or keep name `agent-proxy`) | firewall-vm |

Runbooks: `ops/migration-2026-07-14/`.

## Always

- No `platform: linux/arm64` on firewall-vm (x86).
- No `PUID=501` / `PGID=20` on Linux — use `1000:1000` (+ `chown`).
- Pi is aarch64 — prefer multi-arch tags; never pin `amd64` there.
