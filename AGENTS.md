# AGENTS.md

## Cursor Cloud specific instructions

This repo is mostly a homelab config collection (docker-compose files under
`_archive_stale_compose/`, `reference/`, `ops/`, plus docs). The only runnable
application with source code is **`forge/`** — a self-hosted, Cursor-like coding
agent. Environment setup and the dev workflow center on `forge/`.

### Forge app (`forge/`)

npm workspaces monorepo:
- `forge/server` — Express API, run in dev with `tsx watch` (port `3100`).
- `forge/client` — React + Vite + Monaco editor (port `5173`, proxies `/api` → `3100`).

Standard commands (see `forge/package.json` and the per-workspace `package.json`s):
- Dev (both services): `cd forge && npm run dev` — server on `:3100`, client on `:5173`.
- Build + typecheck: `cd forge && npm run build` (client `tsc -b && vite build`, server `tsc`).
- Production run: `cd forge && npm run build && npm start`.

Non-obvious notes:
- **No test suite and no ESLint config exist.** Treat `npm run build` (which
  runs `tsc`) as the lint/typecheck gate.
- **`FORGE_WORKSPACE`** sets the directory the file tree, editor read/write, and
  agent tools operate on. If unset, it defaults to the repo root, which produces
  a very large/deep file tree. For manual UI testing point it at a small folder,
  e.g. `FORGE_WORKSPACE=/tmp/forge-demo npm run dev`.
- **The AI chat/agent requires an external LLM provider.** Default provider is
  `ollama` (not installed here); cloud providers (`openai`, `anthropic`,
  `openrouter`, `anythingllm`) need `FORGE_API_KEY` (set in `forge/.env`, see
  `forge/.env.example`). Without a provider the chat panel errors, but the core
  editor (file tree + read/write/save via `/api/files/*`) works fully.
- Vite uses `strictPort: true` on `5173`; if that port is taken the client fails
  to start rather than picking another port.
- **Security: the API can run shell commands.** `/api/*` enforces a Host-header
  allowlist and CORS, and honors an optional `FORGE_AUTH_TOKEN` bearer token, but
  keep port `3100` bound to localhost and never expose it without a token. Note
  `FORGE_WORKSPACE` only sets the *default* root — do not add any request-body
  workspace override back.
