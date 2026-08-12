#!/bin/bash
# Forge — Conductor profile
# Starts Forge as the Conductor's brain + UI on port 3110.
# Defaults to OpenRouter free tier (fast, no local GPU needed).
# Set CONDUCTOR_THINK_MODE=local to use the AI-Bridge instead.
# Workspace = conductor data dir (briefings, patrol log, learn.db, state, system-prompt.md)

set -euo pipefail

FORGE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$FORGE_DIR"

export FORGE_WORKSPACE="/Users/peteedoo/homelab-data/conductor"
export PORT="3110"

# Think mode: "bouncer" (default — scrubs PII via bouncer proxy), "free" (direct OpenRouter), "local" (AI-Bridge)
export CONDUCTOR_THINK_MODE="${CONDUCTOR_THINK_MODE:-bouncer}"

if [ "$CONDUCTOR_THINK_MODE" = "local" ]; then
  # Local mode — AI-Bridge (LiteLLM :4000) → AskJeevesAI
  export FORGE_PROVIDER="litellm"
  export FORGE_MODEL="${FORGE_MODEL:-gemma-fast}"
  export FORGE_BASE_URL="http://127.0.0.1:4000/v1"
  export FORGE_API_KEY="sk-local"
  PROVIDER_LABEL="local AI-Bridge (:4000)"

  # Check if AI-Bridge is up
  if ! curl -sf --max-time 3 http://127.0.0.1:4000/v1/models >/dev/null 2>&1; then
    echo "AI-Bridge (:4000) is down — local mode needs it. Start it or use CONDUCTOR_THINK_MODE=free." >&2
    exit 1
  fi
else
  # Free mode — OpenRouter free tier
  export FORGE_PROVIDER="openrouter"
  export FORGE_MODEL="${FORGE_MODEL:-openai/gpt-oss-20b:free}"

  # Load OpenRouter key from Hermes env if not set
  FORGE_API_KEY="${FORGE_API_KEY:-}"
  if [ -z "$FORGE_API_KEY" ] && [ -f "$HOME/.hermes/.env" ]; then
    FORGE_API_KEY=$(grep "^OPENROUTER_API_KEY=" "$HOME/.hermes/.env" | cut -d= -f2-)
  fi
  export FORGE_API_KEY

  if [ -z "$FORGE_API_KEY" ]; then
    echo "No OpenRouter key found. Set FORGE_API_KEY or OPENROUTER_API_KEY in ~/.hermes/.env" >&2
    exit 1
  fi
  PROVIDER_LABEL="OpenRouter free tier"
fi

# Check if conductor data dir exists
if [ ! -d "$FORGE_WORKSPACE" ]; then
  echo "Conductor data dir ($FORGE_WORKSPACE) missing. Run conductor.py first." >&2
  exit 1
fi

# Install deps if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Build client if needed
if [ ! -d "client/dist" ]; then
  echo "Building client..."
  npm run build
fi

echo "Starting Forge Conductor on http://localhost:3110"
echo "Workspace: $FORGE_WORKSPACE"
echo "Think mode: $CONDUCTOR_THINK_MODE"
echo "Model: $FORGE_MODEL (via $PROVIDER_LABEL)"
exec npm start
