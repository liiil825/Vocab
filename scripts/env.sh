#!/bin/bash
# Load environment variables from scripts/.env
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export $(grep -v '^#' "$SCRIPT_DIR/.env" | grep -v '^$' | xargs) || true
