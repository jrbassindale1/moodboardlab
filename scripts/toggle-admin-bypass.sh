#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Toggle staging admin bypass settings on Azure Functions.

Usage:
  bash scripts/toggle-admin-bypass.sh on [--env-file path]
  bash scripts/toggle-admin-bypass.sh off [--env-file path]
  bash scripts/toggle-admin-bypass.sh status [--env-file path]

Required env vars (from env file or shell):
  AZURE_FUNCTION_APP_NAME
  AZURE_RESOURCE_GROUP

Required for "on":
  ADMIN_BYPASS_KEY
  ADMIN_BYPASS_ALLOWED_ORIGINS

Example:
  cp scripts/admin-bypass.env.example scripts/admin-bypass.env
  # edit scripts/admin-bypass.env
  bash scripts/toggle-admin-bypass.sh on
EOF
}

ACTION="${1:-}"
if [[ -z "$ACTION" ]]; then
  usage
  exit 1
fi
shift || true

ENV_FILE="scripts/admin-bypass.env"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! command -v az >/dev/null 2>&1; then
  echo "Azure CLI not found. Install: https://learn.microsoft.com/cli/azure/install-azure-cli" >&2
  exit 1
fi

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

: "${AZURE_FUNCTION_APP_NAME:?Missing AZURE_FUNCTION_APP_NAME}"
: "${AZURE_RESOURCE_GROUP:?Missing AZURE_RESOURCE_GROUP}"

case "$ACTION" in
  on)
    : "${ADMIN_BYPASS_KEY:?Missing ADMIN_BYPASS_KEY for action=on}"
    : "${ADMIN_BYPASS_ALLOWED_ORIGINS:?Missing ADMIN_BYPASS_ALLOWED_ORIGINS for action=on}"
    az functionapp config appsettings set \
      --name "$AZURE_FUNCTION_APP_NAME" \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --settings \
        ADMIN_BYPASS_ENABLED=true \
        "ADMIN_BYPASS_KEY=$ADMIN_BYPASS_KEY" \
        "ADMIN_BYPASS_ALLOWED_ORIGINS=$ADMIN_BYPASS_ALLOWED_ORIGINS" \
      >/dev/null
    echo "Admin bypass ENABLED for app '$AZURE_FUNCTION_APP_NAME'."
    ;;
  off)
    az functionapp config appsettings set \
      --name "$AZURE_FUNCTION_APP_NAME" \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --settings ADMIN_BYPASS_ENABLED=false \
      >/dev/null
    echo "Admin bypass DISABLED for app '$AZURE_FUNCTION_APP_NAME'."
    ;;
  status)
    az functionapp config appsettings list \
      --name "$AZURE_FUNCTION_APP_NAME" \
      --resource-group "$AZURE_RESOURCE_GROUP" \
      --query "[?name=='ADMIN_BYPASS_ENABLED' || name=='ADMIN_BYPASS_ALLOWED_ORIGINS'].{name:name,value:value}" \
      -o table
    ;;
  *)
    echo "Unknown action: $ACTION" >&2
    usage
    exit 1
    ;;
esac
