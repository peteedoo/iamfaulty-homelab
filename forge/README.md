# Forge

A self-hosted, Cursor-like coding agent. Chat with an AI that can read your files, edit code, search the codebase, and run terminal commands — with an interface you actually want to use.

Hate the ChatGPT website? Use GPT-4o here instead. Prefer Claude or a local model? Switch in one click.

```
┌─────────────┬──────────────────────┬─────────────┐
│  File Tree  │   Monaco Editor      │  Agent Chat │
│             │                      │             │
│  src/       │   your code here     │  You: fix   │
│  lib/       │                      │  the bug    │
│  ...        │                      │             │
└─────────────┴──────────────────────┴─────────────┘
```

## Why Forge?

- **Any model** — OpenAI (ChatGPT), Anthropic, Ollama (local), OpenRouter, or your homelab AnythingLLM
- **Real agent tools** — read/write files, grep, run commands
- **Your machine** — workspace stays on your SSD, not someone else's cloud
- **Cursor vibes** — dark UI, file tree, Monaco editor, streaming chat

## Quick Start

### Prerequisites

- Node.js 20+
- [Ollama](https://ollama.com) (recommended for local models)

```bash
# Pull a coding model
ollama pull qwen2.5-coder:7b
```

### Run locally

```bash
cd forge
npm install
npm run dev
```

Open http://localhost:5173 (dev) or http://localhost:3100 (production).

Set your workspace:

```bash
FORGE_WORKSPACE=/path/to/your/project npm run dev
```

### Environment

Copy `.env.example` to `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `FORGE_WORKSPACE` | parent dir | Project root the agent can access |
| `FORGE_PROVIDER` | `ollama` | `ollama`, `openai`, `anthropic`, `openrouter`, `anythingllm` |
| `FORGE_MODEL` | `qwen2.5-coder:7b` | Model name |
| `FORGE_API_KEY` | — | Required for cloud providers |
| `FORGE_BASE_URL` | `http://127.0.0.1:11434` | Ollama or AnythingLLM URL |
| `PORT` | `3100` | Server port |

## Providers

| Provider | Key needed | Best for |
|----------|------------|----------|
| **OpenAI** | Yes | GPT-4o, o3-mini — ChatGPT models, better UI |
| **Ollama** | No | Local/private, M4 Mac mini |
| **Anthropic** | Yes | Claude Sonnet/Haiku |
| **OpenRouter** | Yes | Mix of models, one API |
| **AnythingLLM** | Yes | Your existing homelab LLM stack |

### Homelab integration

Point Forge at your existing AnythingLLM:

```bash
FORGE_PROVIDER=anythingllm
FORGE_BASE_URL=http://127.0.0.1:3002
FORGE_MODEL=your-workspace-slug
FORGE_API_KEY=your-api-key
```

## Docker

```bash
cd forge
docker compose up -d
```

Runs on port `3100`. Mount your project:

```yaml
volumes:
  - /path/to/project:/workspace
environment:
  - FORGE_WORKSPACE=/workspace
```

## Agent Tools

| Tool | What it does |
|------|--------------|
| `read_file` | Read file with line numbers |
| `write_file` | Create or overwrite files |
| `search_files` | Regex search across codebase |
| `list_directory` | List folder contents |
| `run_command` | Run shell commands in workspace |

## Architecture

```
forge/
├── client/          # React + Vite + Monaco editor
├── server/          # Express + agent loop + providers
└── docker-compose.yml
```

The agent loop streams responses over SSE, executes tool calls, and feeds results back until the task is done (max 25 turns).

## Production build

```bash
npm run build
npm start
```

Serves the built client from the Express server on port 3100.

## Security notes

- The agent can run shell commands and write files — only point it at workspaces you trust
- Path traversal is blocked (files must stay inside `FORGE_WORKSPACE`)
- Destructive commands (`rm -rf /`, etc.) are blocked

## License

MIT
