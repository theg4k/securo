#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_BRANCH="fix/credit-card-statements"
ENV_FILE="${SECURO_ENV_FILE:-/etc/securo/securo.env}"
ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")/.." rev-parse --show-toplevel)"
MIN_FREE_KIB=1048576

if [[ "${EUID}" -eq 0 ]]; then
  echo "Run this as the deployment user; Docker commands use sudo." >&2
  exit 1
fi

if [[ "$(git -C "${ROOT}" branch --show-current)" != "${DEPLOY_BRANCH}" ]]; then
  echo "Expected branch ${DEPLOY_BRANCH} in ${ROOT}." >&2
  exit 1
fi

if [[ -n "$(git -C "${ROOT}" status --porcelain)" ]]; then
  echo "Refusing to deploy with local source changes in ${ROOT}." >&2
  exit 1
fi

if ! sudo -n test -r "${ENV_FILE}"; then
  echo "Missing or unreadable deployment environment file: ${ENV_FILE}" >&2
  exit 1
fi

git -C "${ROOT}" pull --ff-only origin "${DEPLOY_BRANCH}"

compose() {
  sudo -n docker compose \
    --project-name securo \
    --env-file "${ENV_FILE}" \
    --file "${ROOT}/docker-compose.prod.yml" \
    --file "${ROOT}/docker-compose.server.yml" \
    "$@"
}

check_disk_space() {
  local available_kib
  available_kib="$(df -Pk / | awk 'NR == 2 {print $4}')"
  if (( available_kib < MIN_FREE_KIB )); then
    echo "Only ${available_kib} KiB remain free on /; need at least 1 GiB. Stop and expand storage or free safe cache space before continuing." >&2
    exit 2
  fi
}

compose config --quiet
check_disk_space

# Build sequentially to limit peak RAM and disk use on the 2 GiB host.
compose build backend
check_disk_space
compose build frontend
check_disk_space

compose up -d --wait db redis
compose up -d --wait backend celery-worker celery-beat
compose up -d --wait frontend

curl --fail --silent --show-error --retry 30 --retry-delay 2 --retry-connrefused \
  http://127.0.0.1:3000/api/health >/dev/null

compose ps
df -h /
free -h
printf 'Securo deployed from %s at %s\n' "${DEPLOY_BRANCH}" "$(git -C "${ROOT}" rev-parse --short HEAD)"
