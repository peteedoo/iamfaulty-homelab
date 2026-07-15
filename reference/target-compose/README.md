# Target compose — post Mac→minifw / Pi migration

These are **intended** compose files for the remaining 2026-07-14 cutover steps.
They are not live until copied onto the NAS (`/mnt/homelab/compose/`) or Pi (`/opt/homelab/`).

| Path | Deploy to | Host |
|------|-----------|------|
| `homepage/` | `/mnt/homelab/compose/homepage/` | minifw `192.168.68.64` |
| `edge-pi5/` | `/opt/homelab/` (or similar) | Pi 5 |
| `minifw-proxy/` | `/mnt/homelab/compose/proxy/` (or keep name `agent-proxy`) | minifw |

Runbooks: `ops/migration-2026-07-14/`.

## Always

- No `platform: linux/arm64` on minifw (x86).
- No `PUID=501` / `PGID=20` on Linux — use `1000:1000` (+ `chown`).
- Pi is aarch64 — prefer multi-arch tags; never pin `amd64` there.
