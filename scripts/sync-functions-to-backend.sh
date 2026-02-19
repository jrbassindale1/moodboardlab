#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR/azure-functions/src"
TARGET_REPO="${FUNCTIONS_REPO_PATH:-../moodboardlab-functions}"
TARGET_REPO_RESOLVED=""
DRY_RUN=false
INCLUDE_INDEX=false
RUN_BUILD=true

usage() {
  cat <<USAGE
Usage: bash scripts/sync-functions-to-backend.sh [options]

Options:
  --target <path>     Path to backend repo (default: FUNCTIONS_REPO_PATH or ../moodboardlab-functions)
  --dry-run           Show what would change without writing files
  --include-index     Also sync src/index.ts (off by default)
  --no-build          Skip 'npm run build' in backend repo after sync
  --help              Show this help text
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET_REPO="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --include-index)
      INCLUDE_INDEX=true
      shift
      ;;
    --no-build)
      RUN_BUILD=false
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "$TARGET_REPO" = /* ]]; then
  TARGET_REPO_RESOLVED="$TARGET_REPO"
else
  TARGET_REPO_RESOLVED="$(cd "$ROOT_DIR" && cd "$TARGET_REPO" && pwd)"
fi

TARGET_SRC_DIR="$TARGET_REPO_RESOLVED/src"
TARGET_FUNCTIONS_DIR="$TARGET_SRC_DIR/functions"
TARGET_SHARED_DIR="$TARGET_SRC_DIR/shared"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Source directory not found: $SOURCE_DIR" >&2
  exit 1
fi
if [[ ! -d "$TARGET_REPO_RESOLVED" ]]; then
  echo "Target repo not found: $TARGET_REPO_RESOLVED" >&2
  exit 1
fi
if [[ ! -d "$TARGET_SRC_DIR" ]]; then
  echo "Target src directory not found: $TARGET_SRC_DIR" >&2
  exit 1
fi
if [[ ! -d "$TARGET_FUNCTIONS_DIR" || ! -d "$TARGET_SHARED_DIR" ]]; then
  echo "Target src/functions or src/shared missing in: $TARGET_SRC_DIR" >&2
  exit 1
fi

RSYNC_OPTS=(-r -v -c --exclude '.DS_Store')
if [[ "$DRY_RUN" == true ]]; then
  RSYNC_OPTS+=(--dry-run --itemize-changes)
fi

echo "Sync source: $SOURCE_DIR"
echo "Sync target: $TARGET_REPO_RESOLVED"

printf '\nSyncing src/functions ...\n'
rsync "${RSYNC_OPTS[@]}" "$SOURCE_DIR/functions/" "$TARGET_FUNCTIONS_DIR/"

printf '\nSyncing src/shared ...\n'
rsync "${RSYNC_OPTS[@]}" "$SOURCE_DIR/shared/" "$TARGET_SHARED_DIR/"

if [[ "$INCLUDE_INDEX" == true ]]; then
  printf '\nSyncing src/index.ts ...\n'
  rsync "${RSYNC_OPTS[@]}" "$SOURCE_DIR/index.ts" "$TARGET_SRC_DIR/index.ts"
else
  printf '\nSkipping src/index.ts (use --include-index to sync it).\n'
fi

if [[ "$DRY_RUN" == true ]]; then
  printf '\nDry run complete.\n'
  exit 0
fi

printf '\nSync complete.\n'

if [[ "$RUN_BUILD" == true ]]; then
  echo "Running backend build in $TARGET_REPO_RESOLVED ..."
  (
    cd "$TARGET_REPO_RESOLVED"
    npm run build
  )
fi

printf '\nDone. Check backend repo status with:\n'
echo "  cd $TARGET_REPO_RESOLVED && git status --short"
