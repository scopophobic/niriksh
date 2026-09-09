#!/usr/bin/env bash
set -Eeuo pipefail

if [ "${EUID}" -ne 0 ]; then
  echo "Run this script with sudo." >&2
  exit 1
fi

IMAGE_TAG="${1:-}"
if [[ ! "$IMAGE_TAG" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: sudo $0 <40-character-git-sha>" >&2
  exit 1
fi

for required_file in deploy.env web.env api.env proxy.env; do
  if [ ! -s "/etc/niriksh/$required_file" ]; then
    echo "Missing /etc/niriksh/$required_file" >&2
    exit 1
  fi
done

set -a
# shellcheck disable=SC1091
source /etc/niriksh/deploy.env
set +a

: "${AWS_REGION:?AWS_REGION is required in /etc/niriksh/deploy.env}"
: "${ECR_REGISTRY:?ECR_REGISTRY is required in /etc/niriksh/deploy.env}"

export IMAGE_TAG
COMPOSE_FILE=/opt/niriksh/runtime/compose.production.yml
COMPOSE=(docker compose --env-file /etc/niriksh/deploy.env -f "$COMPOSE_FILE")

previous_tag=""
if docker inspect niriksh-web >/dev/null 2>&1; then
  previous_image="$(docker inspect --format '{{.Config.Image}}' niriksh-web)"
  previous_tag="${previous_image##*:}"
fi

aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

"${COMPOSE[@]}" pull
"${COMPOSE[@]}" up -d --remove-orphans

healthy=false
for _ in $(seq 1 30); do
  web_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' niriksh-web 2>/dev/null || true)"
  api_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' niriksh-api 2>/dev/null || true)"
  proxy_state="$(docker inspect --format '{{.State.Status}}' niriksh-proxy 2>/dev/null || true)"
  if [ "$web_health" = healthy ] && [ "$api_health" = healthy ] && [ "$proxy_state" = running ]; then
    healthy=true
    break
  fi
  sleep 5
done

if [ "$healthy" != true ]; then
  "${COMPOSE[@]}" ps
  "${COMPOSE[@]}" logs --tail=100
  if [[ "$previous_tag" =~ ^[0-9a-f]{40}$ ]] && [ "$previous_tag" != "$IMAGE_TAG" ]; then
    echo "Deployment unhealthy; rolling back to $previous_tag" >&2
    export IMAGE_TAG="$previous_tag"
    "${COMPOSE[@]}" up -d --remove-orphans
  fi
  exit 1
fi

"${COMPOSE[@]}" ps

# Compose only recreates a service when its own definition changes (image tag, env, etc.), so
# the proxy service (a pinned upstream image tag that never changes) is never touched by `up`
# just because the bind-mounted Caddyfile's content changed on disk. Worse, `caddy reload`
# alone does not fix this: install-ec2-runtime.sh's `install` replaces Caddyfile with a new
# inode at the same path, and Docker's single-file bind mount stays pinned to whichever inode
# existed when the container last (re)started -- so a live `caddy reload` faithfully reloads
# the *stale* file. Only recreating the mount namespace re-resolves the bind mount to the
# current file, so restart (not reload) unconditionally on every deploy.
"${COMPOSE[@]}" restart proxy

echo "--- TEMP DEBUG: recent POST webhook hits seen by Caddy ---"
"${COMPOSE[@]}" logs --tail=1000 proxy 2>&1 | grep -i '"method":"POST"' | grep -i "channels/whatsapp/webhook" || echo "(no POST webhook requests in the last 1000 proxy log lines)"
echo "--- TEMP DEBUG: last 300 api log lines (unfiltered) ---"
"${COMPOSE[@]}" logs --tail=300 api 2>&1
echo "--- END TEMP DEBUG ---"

docker image prune -af --filter "until=168h" >/dev/null
echo "Niriksh $IMAGE_TAG is healthy."
