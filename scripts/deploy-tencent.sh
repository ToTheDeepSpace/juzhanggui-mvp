#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="${1:-main}"
SERVER_HOST="${TENCENT_SERVER_HOST:-ubuntu@175.27.166.150}"
SERVER_REMOTE="${TENCENT_GIT_REMOTE:-tencent}"
SSH_KEY="${TENCENT_SSH_KEY:-/Users/mima0000/.ssh/tencent_lighthouse_codex}"

cd "$ROOT_DIR"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit changes before deploying." >&2
  git status --short >&2
  exit 1
fi

if ! git push origin "$BRANCH"; then
  echo "origin push failed; retrying without local proxy env..." >&2
  HTTPS_PROXY= HTTP_PROXY= ALL_PROXY= git push origin "$BRANCH"
fi

export GIT_SSH_COMMAND="ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new"
git push "$SERVER_REMOTE" "$BRANCH"

ssh -i "$SSH_KEY" "$SERVER_HOST" "systemctl is-active jusichen.service"

curl -fsS https://jusichen.com/api/health >/dev/null
echo "JusiChen deployed to https://jusichen.com"
