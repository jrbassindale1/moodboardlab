#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

NODE_MAJOR="$(node -p "parseInt(process.versions.node.split('.')[0], 10)")"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  echo "Error: Node.js 20+ is required for backend compatibility checks. Current: $(node -v)" >&2
  exit 1
fi

if rg -n "enableCrossPartitionQuery" azure-functions/src >/dev/null 2>&1; then
  echo "Error: deprecated Cosmos option 'enableCrossPartitionQuery' found in azure-functions/src." >&2
  echo "Remove it (SDK v4 enables cross-partition queries by default)." >&2
  exit 1
fi

npx tsc -p azure-functions/tsconfig.json --noEmit
echo "Azure Functions compatibility check passed."
