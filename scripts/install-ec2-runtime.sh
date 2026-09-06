#!/usr/bin/env bash
set -Eeuo pipefail

if [ "${EUID}" -ne 0 ]; then
  echo "Run this script with sudo." >&2
  exit 1
fi

REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
install -d -m 0755 /opt/niriksh/runtime /etc/niriksh
install -m 0644 "$REPOSITORY_ROOT/deploy/ec2/compose.production.yml" /opt/niriksh/runtime/compose.production.yml
install -m 0644 "$REPOSITORY_ROOT/deploy/ec2/Caddyfile" /opt/niriksh/runtime/Caddyfile
install -m 0755 "$REPOSITORY_ROOT/deploy/ec2/deploy.sh" /opt/niriksh/runtime/deploy.sh

echo "Installed the EC2 runtime files in /opt/niriksh/runtime."
