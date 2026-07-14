# AskJeevesAI Cheatsheet

Quick commands for the AMD LLM box (`AskJeevesAI`, usually `192.168.68.55`). Full notes: [`ASKJEEVESAI.md`](ASKJEEVESAI.md).

## SSH

```bash
# from iamfaulty-mini
ssh peteedoo@192.168.68.55

# if host key changed after reinstall
ssh-keygen -R 192.168.68.55
```

## Health checks

```bash
hostname -I
free -h
swapon --show
groups                    # need: render video
rocminfo | grep -E "Marketing Name|gfx1200"
rocm-smi
ollama --version
ollama list
ollama ps
```

## Ollama

```bash
# chat
ollama run llama3.1:8b-instruct-q4_K_M

# pull models that fit 16GB VRAM
ollama pull llama3.1:8b-instruct-q4_K_M
ollama pull qwen2.5:7b-instruct-q4_K_M
ollama pull qwen2.5-coder:7b

# API smoke test
curl http://127.0.0.1:11434/api/tags

# watch GPU while generating (other SSH session)
watch -n 1 rocm-smi
```

### Expose Ollama on LAN (for OpenClaw / Forge / mini)

```bash
sudo mkdir -p /etc/systemd/system/ollama.service.d
sudo tee /etc/systemd/system/ollama.service.d/override.conf <<'EOF'
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
EOF
sudo systemctl daemon-reload
sudo systemctl restart ollama

# from Mac mini
curl http://192.168.68.55:11434/api/tags
```

Firewall if needed:

```bash
sudo ufw allow from 192.168.68.0/24 to any port 11434 proto tcp
sudo ufw reload
```

## Local organizer agent

```bash
cd ~/local-agent && source .venv/bin/activate
# script: ops/askjeevesai/organize_agent.py in this repo
python organize_agent.py
find ~/Organizer -type f | sort
```

## OpenClaw + this GPU box

**Yes.** OpenClaw supports Ollama natively (`/api/chat`, not `/v1`).

Two patterns:

| Pattern | Where OpenClaw runs | Ollama URL |
|---------|---------------------|------------|
| A — local on AskJeevesAI | AskJeevesAI | `http://127.0.0.1:11434` |
| B — existing hub on mini/agent-stack | Mac mini / openclaw-hub | `http://192.168.68.55:11434` |

### Pattern A (on AskJeevesAI)

```bash
# Node 22+ recommended
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g openclaw@latest

openclaw onboard
# pick Ollama → Local only → http://127.0.0.1:11434
# model: qwen2.5:7b-instruct-q4_K_M (or coder for code work)

openclaw models list --provider ollama
openclaw models set ollama/qwen2.5:7b-instruct-q4_K_M
```

Gateway UI is typically `http://127.0.0.1:18789`.

### Pattern B (point existing OpenClaw at AskJeevesAI)

1. Expose Ollama on LAN (commands above).
2. In OpenClaw config / onboard, set Ollama `baseUrl` to:

```text
http://192.168.68.55:11434
```

**Do not** append `/v1` — that breaks tool calling.

Non-interactive example:

```bash
openclaw onboard --non-interactive \
  --auth-choice ollama \
  --custom-base-url "http://192.168.68.55:11434" \
  --custom-model-id "qwen2.5:7b-instruct-q4_K_M" \
  --accept-risk
```

Your homelab already has `openclaw.iamfaulty.com` / hub on port `18789` (see `docs/API_REFERENCE.md`). Prefer fixing that hub to use AskJeevesAI as the model backend rather than running two conflicting Telegram bots.

## Repos / projects worth cloning

| Repo | Why |
|------|-----|
| [openclaw/openclaw](https://github.com/openclaw/openclaw) | Your agent runtime — Ollama provider docs included |
| [ollama/ollama](https://github.com/ollama/ollama) | Local model server (already installed) |
| [ggml-org/llama.cpp](https://github.com/ggml-org/llama.cpp) | Faster/leaner inference; HIP/ROCm builds for AMD |
| [huggingface/smolagents](https://github.com/huggingface/smolagents) | Lightweight CodeAgent (organizer demo) |
| [open-webui/open-webui](https://github.com/open-webui/open-webui) | ChatGPT-style UI on top of Ollama |
| [vllm-project/vllm](https://github.com/vllm-project/vllm) | Higher-throughput serving (ROCm builds; heavier than Ollama) |
| [peteedoo/iamfaulty-homelab](https://github.com/peteedoo/iamfaulty-homelab) `forge/` | Your Cursor-like UI; point provider at this host’s Ollama |

### HF model browsing (GGUF / local)

- https://huggingface.co/models?apps=llama.cpp&sort=trending  
- Prefer 7B–14B Q4/Q5 for this card

## Model size rule of thumb

| Fit | Examples |
|-----|----------|
| Comfortable | 7B–8B Q4/Q5 |
| Tight OK | 12B–14B Q4 |
| Skip for now | 30B+, huge context |

## BIOS / hardware reminders

- Memory profile: **Auto** (not EXPO) until stable
- OS + models: NVMe
- Archives: SATA HDDs
- Watch the small UPS under GPU load
