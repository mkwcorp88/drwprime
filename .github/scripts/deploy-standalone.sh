#!/usr/bin/env bash

set -Eeuo pipefail

target_image="${1:?Target image is required}"
expected_release="${2:-}"
container_name="${3:-drwprime}"
env_file="${DRWPRIME_ENV_FILE:-/opt/git/drwprime.env}"
network="${DRWPRIME_NETWORK:-coolify}"
host_bind="${DRWPRIME_HOST_BIND:-127.0.0.1}"
host_port="${DRWPRIME_HOST_PORT:-5054}"
container_port="${DRWPRIME_CONTAINER_PORT:-3000}"
public_health_url="${DRWPRIME_PUBLIC_HEALTH_URL-https://drwprime.com/api/health}"
public_url="${DRWPRIME_PUBLIC_URL-https://drwprime.com/}"
lock_file="${DRWPRIME_LOCK_FILE:-/var/lock/${container_name}-deploy.lock}"
health_attempts="${DRWPRIME_HEALTH_ATTEMPTS:-24}"
health_interval="${DRWPRIME_HEALTH_INTERVAL:-5}"
public_health_attempts="${DRWPRIME_PUBLIC_HEALTH_ATTEMPTS:-12}"
preflight_only="${DRWPRIME_PREFLIGHT_ONLY:-false}"
candidate_memory="${DRWPRIME_CANDIDATE_MEMORY:-2g}"
migration_timeout="${DRWPRIME_MIGRATION_TIMEOUT:-300s}"
candidate_name="${container_name}-candidate"
migration_name="${container_name}-migrate"
configuration_name="${container_name}-config-check"
previous_name="${container_name}-previous"
rollback_needed=false
had_current=false
candidate_started=false

log() {
  printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$*"
}

log_container_state() {
  local container="$1"
  local state

  state="$(docker inspect --format 'status={{.State.Status}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}}' "$container" 2>/dev/null || true)"
  if [ -n "$state" ]; then
    log "$container: $state"
  fi
}

check_url() {
  local container="$1"
  local url="$2"
  local release="$3"

  docker exec "$container" node -e '
    const [url, expectedRelease] = process.argv.slice(1);
    fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) })
      .then(async (response) => {
        const body = await response.json();
        const releaseMatches = !expectedRelease || body.release === expectedRelease;
        process.exit(response.ok && body.ok === true && releaseMatches ? 0 : 1);
      })
      .catch(() => process.exit(1));
  ' "$url" "$release"
}

check_liveness() {
  local container="$1"
  local url="${2:-http://127.0.0.1:${container_port}/}"

  docker exec "$container" node -e '
    fetch(process.argv[1], { signal: AbortSignal.timeout(5000) })
      .then((response) => process.exit(response.ok ? 0 : 1))
      .catch(() => process.exit(1));
  ' "$url"
}

wait_for_health() {
  local container="$1"
  local release="$2"
  local attempt state

  for ((attempt = 1; attempt <= health_attempts; attempt++)); do
    state="$(docker inspect --format '{{.State.Status}}' "$container" 2>/dev/null || true)"
    if [ "$state" = 'running' ] \
      && check_url "$container" "http://127.0.0.1:${container_port}/api/health" "$release"; then
      return 0
    fi
    if [ "$state" = 'exited' ] || [ "$state" = 'dead' ]; then
      return 1
    fi
    sleep "$health_interval"
  done

  return 1
}

check_compatible_health() {
  local container="$1"

  docker exec "$container" node -e '
    fetch(process.argv[1], { cache: "no-store", signal: AbortSignal.timeout(5000) })
      .then(async (response) => {
        if (response.status === 404) process.exit(2);
        const body = await response.json();
        process.exit(response.ok && body.ok === true ? 0 : 1);
      })
      .catch(() => process.exit(1));
  ' "http://127.0.0.1:${container_port}/api/health"
}

wait_for_recovery() {
  local container="$1"
  local max_attempts="${2:-$health_attempts}"
  local attempt health_result state

  for ((attempt = 1; attempt <= max_attempts; attempt++)); do
    state="$(docker inspect --format '{{.State.Status}}' "$container" 2>/dev/null || true)"
    if [ "$state" = 'running' ]; then
      if check_compatible_health "$container"; then
        return 0
      else
        health_result=$?
      fi

      # The currently deployed pre-health-check image legitimately returns 404.
      if [ "$health_result" -eq 2 ]; then
        if check_liveness "$container"; then
          return 0
        fi
      fi
    fi
    if [ "$state" = 'exited' ] || [ "$state" = 'dead' ]; then
      return 1
    fi
    sleep "$health_interval"
  done

  return 1
}

wait_for_liveness() {
  local container="$1"
  local max_attempts="${2:-$health_attempts}"
  local attempt state

  for ((attempt = 1; attempt <= max_attempts; attempt++)); do
    state="$(docker inspect --format '{{.State.Status}}' "$container" 2>/dev/null || true)"
    if [ "$state" = 'running' ] && check_liveness "$container"; then
      return 0
    fi
    if [ "$state" = 'exited' ] || [ "$state" = 'dead' ]; then
      return 1
    fi
    sleep "$health_interval"
  done

  return 1
}

rollback() {
  log 'Deployment failed; restoring the previous container'

  if docker inspect "$previous_name" >/dev/null 2>&1; then
    docker rm -f "$container_name" >/dev/null 2>&1 || true
    docker rename "$previous_name" "$container_name" || return 1
    docker start "$container_name" >/dev/null || return 1
  elif [ "$had_current" = true ] && docker inspect "$container_name" >/dev/null 2>&1; then
    docker start "$container_name" >/dev/null || return 1
  else
    docker rm -f "$container_name" >/dev/null 2>&1 || true
    if [ "$had_current" = false ]; then
      return 0
    fi
    return 1
  fi

  wait_for_recovery "$container_name" || return 1
  if [ -n "$public_url" ]; then
    check_liveness "$container_name" "$public_url" || return 1
  fi
}

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  if [ "$status" -ne 0 ]; then
    log_container_state "$candidate_name"
    log_container_state "$container_name"
  fi
  docker rm -f "$candidate_name" "$migration_name" "$configuration_name" >/dev/null 2>&1 || true

  if [ "$status" -ne 0 ] && [ "$rollback_needed" = true ]; then
    if ! rollback; then
      log 'Rollback failed; manual recovery is required'
    fi
  elif [ "$status" -ne 0 ] && [ "$candidate_started" = true ] && [ "$had_current" = true ]; then
    if ! wait_for_recovery "$container_name" 3; then
      log 'The candidate affected the current container; restarting it'
      docker restart "$container_name" >/dev/null 2>&1 || true
      wait_for_recovery "$container_name" || log 'Current container recovery failed'
    fi
  fi

  exit "$status"
}

command -v flock >/dev/null
command -v timeout >/dev/null
[ -r "$env_file" ] || { log "Missing runtime environment file: $env_file"; exit 1; }
docker network inspect "$network" >/dev/null
target_image_id="$(docker image inspect "$target_image" --format '{{.Id}}')"
image_release="$(docker image inspect "$target_image_id" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')"
if [ "$image_release" = 'unknown' ] || [ "$image_release" = '<no value>' ]; then
  image_release=''
fi

if [ -z "$expected_release" ]; then
  expected_release="$image_release"
elif [ "$image_release" != "$expected_release" ]; then
  log 'Target image release label does not match the requested release'
  exit 1
fi

exec 9>"$lock_file"
if ! flock -n 9; then
  log 'Another DRW Prime deployment is already running'
  exit 1
fi
trap cleanup EXIT
trap 'exit 130' INT TERM

if docker inspect "$container_name" >/dev/null 2>&1; then
  had_current=true
fi

runtime_env=(--env-file "$env_file" --env NODE_ENV=production --env "PORT=$container_port")
if [ -n "$expected_release" ]; then
  runtime_env+=(--env "RELEASE_SHA=$expected_release")
fi

docker rm -f "$candidate_name" "$migration_name" "$configuration_name" >/dev/null 2>&1 || true

log 'Validating runtime configuration'
docker run --rm \
  --name "$configuration_name" \
  --env-file "$env_file" \
  --env NODE_ENV=production \
  --entrypoint node \
  "$target_image_id" \
  -e '
    const required = [
      "DATABASE_URL", "DATABASE_URI", "PAYLOAD_SECRET", "CLERK_SECRET_KEY",
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "S3_ENDPOINT", "S3_BUCKET",
      "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY",
    ];
    const opsOtpEnabled = (process.env.OPS_WHATSAPP_OTP_ENABLED ?? process.env.WHATSAPP_OTP_ENABLED)?.toLowerCase() === "true";
    if (opsOtpEnabled) required.push("OPS_WHATSAPP_ACCESS_TOKEN", "OPS_WHATSAPP_PHONE_NUMBER_ID");
    const missing = required.filter((name) => !process.env[name]);
    if (missing.length > 0) {
      console.error(`Missing required environment: ${missing.join(", ")}`);
      process.exit(1);
    }
  '

log "Applying migrations from $target_image"
timeout --signal=TERM --kill-after=30s "$migration_timeout" docker run --rm \
  --name "$migration_name" \
  --network "$network" \
  --env-file "$env_file" \
  --env NODE_ENV=production \
  "$target_image_id" \
  npx --no-install prisma migrate deploy --schema prisma/schema.prisma

log 'Starting an isolated candidate for readiness checks'
docker run -d \
  --name "$candidate_name" \
  --network "$network" \
  --memory "$candidate_memory" \
  --memory-swap "$candidate_memory" \
  --pids-limit 256 \
  "${runtime_env[@]}" \
  "$target_image_id" >/dev/null
candidate_started=true

candidate_image_id="$(docker inspect --format '{{.Image}}' "$candidate_name")"
[ "$candidate_image_id" = "$target_image_id" ] || { log 'Candidate image identity mismatch'; exit 1; }
wait_for_health "$candidate_name" "$expected_release" \
  || { log 'Candidate failed its readiness check'; exit 1; }
check_liveness "$candidate_name" \
  || { log 'Candidate homepage check failed'; exit 1; }
docker rm -f "$candidate_name" >/dev/null
candidate_started=false

if [ "$preflight_only" = true ]; then
  log "Preflight succeeded: $target_image"
  exit 0
fi

docker rm -f "$previous_name" >/dev/null 2>&1 || true
rollback_needed=true

if [ "$had_current" = true ]; then
  docker stop --time 30 "$container_name" >/dev/null
  docker rename "$container_name" "$previous_name"
fi

publish="${host_port}:${container_port}"
if [ -n "$host_bind" ]; then
  publish="${host_bind}:${publish}"
fi

log "Starting $container_name on port $host_port"
docker run -d \
  --name "$container_name" \
  --restart unless-stopped \
  --network "$network" \
  --publish "$publish" \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  "${runtime_env[@]}" \
  "$target_image_id" >/dev/null

deployed_image_id="$(docker inspect --format '{{.Image}}' "$container_name")"
[ "$deployed_image_id" = "$target_image_id" ] || { log 'Deployed image identity mismatch'; exit 1; }
wait_for_health "$container_name" "$expected_release" \
  || { log 'Deployed container failed its readiness check'; exit 1; }

if [ -n "$public_health_url" ]; then
  public_ready=false
  for ((attempt = 1; attempt <= public_health_attempts; attempt++)); do
    if check_url "$container_name" "$public_health_url" "$expected_release" \
      && check_liveness "$container_name" "$public_url"; then
      public_ready=true
      break
    fi
    sleep "$health_interval"
  done
  [ "$public_ready" = true ] || { log 'Public readiness check failed'; exit 1; }
fi

rollback_needed=false
log "Deployment succeeded: $target_image"
