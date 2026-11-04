#!/usr/bin/env bash
# Starts the demo server in the background (Codespaces runs this on every start).
cd "$(dirname "$0")/.."
if [ -n "$CODESPACE_NAME" ]; then
  export PGHL_BASE_URL="https://${CODESPACE_NAME}-4700.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
  export PGHL_BEHIND_PROXY=1
fi
export PGHL_DATA_DIR=./demo-data
# Public try-it instance: the demo login is published, so lock it down – no outbound traffic,
# no password/user/API-key/backup/provider changes, "fictional data only" banner, nightly reset.
export PGHL_DEMO_MODE=1
export PGHL_TIMEZONE="${PGHL_TIMEZONE:-Asia/Kolkata}"
[ -d dist-server ] || npm run build
# setsid: a plain background job is killed when the postStartCommand shell exits
setsid nohup npm start > /tmp/vmedia-crm.log 2>&1 < /dev/null &
sleep 2
echo "V Media CRM starting on port 4700 – log: /tmp/vmedia-crm.log"
