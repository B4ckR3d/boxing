#!/usr/bin/env bash
#
# TFN — cron entry point for the ticket hold-expiry sweep.
#
#   crontab:  17 * * * *  /www/wwwroot/boxing/scripts/cron/expire-holds.sh
#
# Wraps `npm run ticketing:expire-holds` with the four things a bare cron line lacks:
#   1. a usable PATH            — cron inherits almost nothing, `npm` is usually not on it
#   2. overlap protection       — flock, so a slow sweep cannot run twice and double-release seats
#   3. a durable audit trail    — append-only log under storage/logs/, self-rotating
#   4. honest exit codes        — nonzero on failure so cron/aaPanel actually notifies someone
#
# Output discipline: writes everything to the log, and prints to stdout ONLY when something
# happened (seats released) or something broke. Silent runs stay silent, so an empty cron mail
# really means "nothing to report".
#
# Exit codes:  0 = ran (or skipped because a sweep was already running)
#              1 = npm/sweep failed        3 = ran but produced no parsable summary
#
set -uo pipefail

APP_DIR="${TFN_APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
if [ ! -d "$APP_DIR" ]; then
  echo "[expire-holds] FAILED: app dir not found: $APP_DIR" >&2
  exit 1
fi
cd "$APP_DIR" || { echo "[expire-holds] FAILED: cannot cd to $APP_DIR" >&2; exit 1; }

LOG_DIR="$APP_DIR/storage/logs"
LOG_FILE="$LOG_DIR/expire-holds.log"
LOCK_FILE="$APP_DIR/storage/expire-holds.lock"
MAX_LOG_BYTES="${TFN_LOG_MAX_BYTES:-2000000}"

mkdir -p "$LOG_DIR" || { echo "[expire-holds] FAILED: cannot create $LOG_DIR" >&2; exit 1; }

stamp() { date '+%Y-%m-%dT%H:%M:%S%z'; }
log() { printf '%s\n' "$*" >>"$LOG_FILE"; }

# --- rotate before appending (boring on purpose: keep the tail, drop the rest) -------------
if [ -f "$LOG_FILE" ]; then
  size=$(wc -c <"$LOG_FILE" 2>/dev/null | tr -d ' ')
  if [ "${size:-0}" -gt "$MAX_LOG_BYTES" ]; then
    tail -n 400 "$LOG_FILE" >"$LOG_FILE.tmp" && mv -f "$LOG_FILE.tmp" "$LOG_FILE"
    log "=== $(stamp) rotated (previous log exceeded ${MAX_LOG_BYTES} bytes) ==="
  fi
fi

# --- 1. PATH: cron gives you /usr/bin:/bin and nothing else --------------------------------
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  for candidate in "$HOME"/.nvm/versions/node/*/bin/node /opt/node/*/bin/node /usr/local/node/bin/node; do
    if [ -x "$candidate" ]; then
      export PATH="$(dirname "$candidate"):$PATH"
      break
    fi
  done
fi
if ! command -v node >/dev/null 2>&1; then
  log "$(stamp) FAILED: node not found on PATH ($PATH)"
  echo "[expire-holds] FAILED: node not found — set PATH or TFN_APP_DIR/node install dir" >&2
  exit 1
fi
if [ ! -x "$APP_DIR/node_modules/.bin/tsx" ]; then
  log "$(stamp) FAILED: node_modules/.bin/tsx missing (run npm install in $APP_DIR)"
  echo "[expire-holds] FAILED: tsx missing in $APP_DIR/node_modules — run npm install" >&2
  exit 1
fi

# --- 2. overlap protection ------------------------------------------------------------------
exec 9>"$LOCK_FILE"
if command -v flock >/dev/null 2>&1; then
  if ! flock -n 9; then
    log "$(stamp) skipped: a previous sweep still holds the lock"
    exit 0
  fi
else
  log "$(stamp) WARN: flock unavailable — running without overlap protection"
fi

# --- 3. run the sweep -----------------------------------------------------------------------
started_at=$(date +%s)
output=$(npm run --silent ticketing:expire-holds 2>&1)
rc=$?
elapsed=$(( $(date +%s) - started_at ))

log "$(stamp) exit=$rc elapsed=${elapsed}s node=$(command -v node)"
printf '%s\n' "$output" >>"$LOG_FILE"

if [ "$rc" -ne 0 ]; then
  echo "[expire-holds] FAILED (exit $rc) — see $LOG_FILE" >&2
  printf '%s\n' "$output" >&2
  exit "$rc"
fi

# --- 4. report only when there is something to report --------------------------------------
expired=$(printf '%s\n' "$output" | grep -oE 'expired=[0-9]+' | tail -1 | cut -d= -f2)
if [ -z "$expired" ]; then
  log "$(stamp) WARN: no 'expired=' summary in output — treating as failure"
  echo "[expire-holds] FAILED: sweep produced no parsable summary (exit 3) — see $LOG_FILE" >&2
  printf '%s\n' "$output" >&2
  exit 3
fi

if [ "$expired" -gt 0 ]; then
  printf '%s\n' "$output"
  exit 0
fi

exit 0
