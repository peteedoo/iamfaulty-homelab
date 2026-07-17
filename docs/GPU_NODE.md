# gpu-node — Local LLM / ROCm Compute Node

AMD desktop used for local inference and agent experiments. Complements AnythingLLM / Forge on the ARM mini PC.

## Hardware

| Component | Spec |
|-----------|------|
| Hostname | `gpu-node` |
| User | `peteedoo` |
| LAN IP | `<lan-ip:gpu-node>` (DHCP; confirm with `hostname -I`) |
| CPU | AMD Ryzen 5 (desktop class) |
| Motherboard | mATX AM5 board |
| GPU | AMD Radeon RX (RDNA 4), 16GB |
| RAM | 16GB DDR5 (run EXPO = **Auto** for stability) |
| OS disk | ~1TB NVMe (`nvme0n1`) |
| Data disks | SATA `sda` ~1.4TB, `sdb` ~3.6TB (not yet standardized) |
| OS | Ubuntu 24.04.4 LTS (HWE kernel) |

## Software stack (verified)

- AMD ROCm 7.2.x via `amdgpu-install --usecase=graphics,rocm`
- User in `render` + `video` groups
- Ollama with GPU offload (VRAM occupancy rises when models load)
- zram recommended (`zram-tools`, ~50% RAM, `zstd`)
- OpenSSH enabled for admin from `arm-mini`

### Verify GPU

```bash
groups
rocminfo | grep -E "Marketing Name|Name:|Device Type"
rocm-smi
```

Expected: `AMD Radeon RX (RDNA 4)` / `gfx12xx` as a GPU agent.

### SSH from ARM mini PC

```bash
ssh peteedoo@<lan-ip:gpu-node>
```

If host key changed after reinstall:

```bash
ssh-keygen -R <lan-ip:gpu-node>
```

## Models that fit this box

With **16GB VRAM + 16GB system RAM**:

| Model | Notes |
|-------|--------|
| `llama3.1:8b-instruct-q4_K_M` | Good daily chat |
| `qwen2.5:7b-instruct-q4_K_M` | Better for agents / tool use |
| `qwen2.5-coder:7b` | Coding |
| 30B+ | Avoid for now |

```bash
ollama pull qwen2.5:7b-instruct-q4_K_M
ollama run llama3.1:8b-instruct-q4_K_M
```

While generating, confirm GPU use:

```bash
watch -n 1 rocm-smi
```

## Cheatsheet

Daily commands, OpenClaw wiring, and repo list: [`GPU_NODE_CHEATSHEET.md`](GPU_NODE_CHEATSHEET.md).

## OpenClaw

Yes — OpenClaw can use this host’s Ollama (native `/api/chat`, not `/v1`).

- Run OpenClaw **on gpu-node** with `http://127.0.0.1:11434`, or
- Point existing `openclaw-hub` / mini OpenClaw at `http://<lan-ip:gpu-node>:11434` after binding Ollama to `0.0.0.0`

See the cheatsheet for exact onboard commands. Avoid running two OpenClaw instances against the same Telegram bot.

## Local organizer agent

Demo CodeAgent (smolagents + Ollama) that sorts files under `~/Organizer`.

Script: [`ops/gpu-node/organize_agent.py`](../ops/gpu-node/organize_agent.py)

```bash
# on gpu-node
sudo apt install -y python3.12-venv
mkdir -p ~/local-agent && cd ~/local-agent
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip 'smolagents[litellm]'

# copy script from this repo, or recreate from ops/gpu-node/organize_agent.py
python organize_agent.py
```

Sandbox: tools only allow `~/Organizer/inbox` and `~/Organizer/sorted`.

## Ops notes

- Prefer Ubuntu **24.04.4** (not 26.04) for ROCm Radeon support.
- Keep BIOS memory profile on **Auto** until the system is stable; enable EXPO later if needed.
- 450VA UPS may be undersized for full GPU load — watch for overload.
- SATA HDDs are fine for archives; keep hot models / OS on NVMe.
- Next: mount/format `sda`/`sdb`, optional Open WebUI, wire Forge → this host’s Ollama.
