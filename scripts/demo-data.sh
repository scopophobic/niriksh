#!/bin/sh
set -eu

action="${1:-seed}"
case "$action" in
  seed|reset) ;;
  *) echo "Usage: ./scripts/demo-data.sh [seed|reset]" >&2; exit 2 ;;
esac

docker compose exec -T api python -m app.demo "$action"
