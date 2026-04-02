#!/bin/bash
set -e

# Get the project root directory (parent of scripts/)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# Load environment variables from root .env
# Export MiniMax vars for backend services (vocab-api, vocab-mcp)
# Vite will pick up VITE_ prefixed vars from web/.env
export $(grep -v '^#' "$SCRIPT_DIR/.env" | grep -v '^$' | xargs) || true

echo "Starting Vocab-Trainer development servers..."
echo ""

# Start services in parallel
trap 'kill 0' EXIT

echo "Starting API server..."
(cd packages/vocab-api && bun run src/server.ts) &

echo "Starting MCP server..."
(cd packages/vocab-mcp && bun run src/index.ts) &

echo "Starting Web frontend..."
(cd web && bun run dev --host) &

echo ""
echo "All servers started!"
echo "  - API: http://localhost:3099"
echo "  - Web: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all servers"

wait
