#!/bin/bash
# Caddy route review script
# Checks that all reverse_proxy targets in the Caddyfile are reachable

CADDYFILE="${1:-$HOME/homelab-agent-stack/caddy/Caddyfile}"

echo "=== Caddy Route Review ==="
echo "Caddyfile: $CADDYFILE"
echo ""

# Extract host:port targets from reverse_proxy lines
# Handles both "reverse_proxy host:port" and "reverse_proxy host" (default port 80)
grep -E '^\s*reverse_proxy\s+' "$CADDYFILE" | while read -r line; do
  target=$(echo "$line" | awk '{print $2}')
  # Skip file_server and named upstreams
  if echo "$target" | grep -qE '^[0-9]+\.|^host\.docker\.internal|^localhost'; then
    host=$(echo "$target" | cut -d: -f1)
    port=$(echo "$target" | cut -s -d: -f2)
    [ -z "$port" ] && port=80

    # Map host.docker.internal to 127.0.0.1 for host-side testing
    test_host="$host"
    [ "$host" = "host.docker.internal" ] && test_host="127.0.0.1"

    # Try to connect
    if nc -z -w 2 "$test_host" "$port" 2>/dev/null; then
      echo "✅ $target"
    else
      echo "❌ $target (unreachable from host)"
    fi
  fi
done

echo ""
echo "=== File server routes ==="
grep -B1 'file_server' "$CADDYFILE" | grep -E '^\S+\.iamfaulty\.com' | while read -r host; do
  echo "📁 $host"
done
