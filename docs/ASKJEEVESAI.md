# AskJeevesAI — Local LLM / ROCm Compute Node

AMD desktop used for local inference and agent experiments. Complements AnythingLLM / Forge on the Mac mini.

## Hardware

| Component | Spec |
|-----------|------|
| Hostname | `AskJeevesAI` |
| User | `peteedoo` |
| LAN IP | `192.168.68.55` (DHCP; confirm with `hostname -I`) |
| CPU | AMD Ryzen 5 7500X3D |
| Motherboard | Gigabyte B850M-C |
| GPU | PowerColor Radeon RX 9060 XT 16GB (`gfx1200`) |
| RAM | 16GB DDR5 (run EXPO = **Auto** for stability) |
| OS disk | ~1TB NVMe (`nvme0n1`) |
| Data disks | SATA `sda` ~1.4TB, `sdb` ~3.6TB (not yet standardized) |
| OS | Ubuntu 24.04.4 LTS (HWE kernel) |

## Software stack (verified)

- AMD ROCm 7.2.x via `amdgpu-install --usecase=graphics,rocm`
- User in `render` + `video` groups
- Ollama with GPU offload (VRAM occupancy rises when models load)
- zram recommended (`zram-tools`, ~50% RAM, `zstd`)
- OpenSSH enabled for admin from `iamfaulty-mini`

### Verify GPU

```bash
groups
rocminfo | grep -E "Marketing Name|Name:|Device Type"
rocm-smi
```

Expected: `AMD Radeon RX 9060 XT` / `gfx1200` as a GPU agent.

### SSH from Mac mini

```bash
ssh peteedoo@192.168.68.55
```

If host key changed after reinstall:

```bash
ssh-keygen -R 192.168.68.55
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

## Local organizer agent

Demo CodeAgent (smolagents + Ollama) that sorts files under `~/Organizer`.

Script: [`ops/askjeevesai/organize_agent.py`](../ops/askjeevesai/organize_agent.py)

```bash
# on AskJeevesAI
sudo apt install -y python3.12-venv
mkdir -p ~/local-agent && cd ~/local-agent
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip 'smolagents[litellm]'

# copy script from this repo, or recreate from ops/askjeevesai/organize_agent.py
python organize_agent.py
```

Sandbox: tools only allow `~/Organizer/inbox` and `~/Organizer/sorted`.

## Ops notes

- Prefer Ubuntu **24.04.4** (not 26.04) for ROCm Radeon support.
- Keep BIOS memory profile on **Auto** until the system is stable; enable EXPO later if needed.
- 450VA UPS may be undersized for full GPU load — watch for overload.
- SATA HDDs are fine for archives; keep hot models / OS on NVMe.
- Next: mount/format `sda`/`sdb`, optional Open WebUI, wire Forge → this host’s Ollama.
