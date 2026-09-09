#!/usr/bin/env bash

set -Eeuo pipefail

env_file="${AIDO_BROWSER_ENV_FILE:-/opt/git/drwprime.env}"
project_dir="${AIDO_BROWSER_PROJECT_DIR:-/opt/git/drwprime-work}"
job_script="${AIDO_BROWSER_JOB_SCRIPT:-${project_dir}/scripts/aido-browser-job.mjs}"

if [[ ! -r "$env_file" ]]; then
  printf '[AIDO BROWSER JOB] Missing environment file\n' >&2
  exit 1
fi
if [[ ! -r "$job_script" ]]; then
  printf '[AIDO BROWSER JOB] Missing job script\n' >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$env_file"
set +a

export AIDO_BROWSER_SESSION="${AIDO_BROWSER_SESSION:-drwprime-aido}"
export AIDO_BROWSER_PROFILE="${AIDO_BROWSER_PROFILE:-aido-production}"
export AIDO_BROWSER_SYNC_URL="${AIDO_BROWSER_SYNC_URL:-http://127.0.0.1:5054/api/internal/aido-browser-sync}"

exec /usr/bin/node "$job_script" --allow-review "$@"
