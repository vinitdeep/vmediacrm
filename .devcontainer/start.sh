#!/usr/bin/env bash
# Starts the demo server in the background (Codespaces runs this on every start).
cd "$(dirname "$0")/.."
if [ -n "$CODESPACE_NAME" ]; then
  export PGHL_BASE_URL="https://${CODESPACE_NAME}-4700.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
  export PGHL_BEHIND_PROXY=1
fi
export PGHL_DATA_DIR=./demo-data
[ -d dist-server ] || npm run build
nohup npm start > /tmp/vmedia-crm.log 2>&1 &
echo "V Media CRM starting on port 4700 – log: /tmp/vmedia-crm.log"
