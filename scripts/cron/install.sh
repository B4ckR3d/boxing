#!/usr/bin/env bash
#
# TFN — install / inspect / remove the hold-expiry cron entry.
#
#   ./scripts/cron/install.sh             # install (hourly at :17) for the current user
#   ./scripts/cron/install.sh print       # show the exact crontab line, change nothing
#   ./scripts/cron/install.sh status      # show the installed line + last log lines
#   ./scripts/cron/install.sh uninstall   # remove the managed line, leave nothing behind
#
# Optional: TFN_CRON_SCHEDULE="17 * * * *" ./scripts/cron/install.sh
#
# Idempotent by construction: every managed line carries the TAG marker, so install first strips
# the tag and then appends exactly one line. Running it twice never duplicates the job.
# For aaPanel: paste the `print` output into Cron → Add Task (type: Shell Script).
#
set -uo pipefail

TAG="# TFN-EXPIRE-HOLDS"
APP_DIR="${TFN_APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SCRIPT="$APP_DIR/scripts/cron/expire-holds.sh"
LOG_FILE="$APP_DIR/storage/logs/expire-holds.log"
SCHEDULE="${TFN_CRON_SCHEDULE:-17 * * * *}"
ACTION="${1:-install}"

cron_line() { printf '%s %s %s\n' "$SCHEDULE" "$SCRIPT" "$TAG"; }

case "$ACTION" in
  print)
    echo "$(cron_line)"
    exit 0
    ;;

  status)
    echo "app dir : $APP_DIR"
    echo "script  : $SCRIPT $([ -x "$SCRIPT" ] && echo '(executable)' || echo '(NOT executable — chmod +x)')"
    echo "schedule: $SCHEDULE"
    echo
    echo "installed line(s):"
    crontab -l 2>/dev/null | grep -F "$TAG" || echo "  (none — job is not scheduled)"
    echo
    if [ -f "$LOG_FILE" ]; then
      echo "last runs in $LOG_FILE:"
      grep -E 'exit=' "$LOG_FILE" | tail -5
    else
      echo "no log yet at $LOG_FILE (job has never run)"
    fi
    exit 0
    ;;

  install|uninstall)
    if ! command -v crontab >/dev/null 2>&1; then
      echo "crontab not found — this box has no cron client. Use a systemd timer instead:" >&2
      echo "  systemctl --user  (or /etc/systemd/system/tfn-expire-holds.{service,timer})" >&2
      echo "  ExecStart=$SCRIPT" >&2
      exit 1
    fi

    if [ ! -x "$SCRIPT" ]; then
      echo "refusing: $SCRIPT is not executable — run: chmod +x \"$SCRIPT\"" >&2
      exit 1
    fi

    current=$(crontab -l 2>/dev/null | grep -vF "$TAG" | grep -v '^$')
    if [ "$ACTION" = "install" ]; then
      {
        [ -n "$current" ] && printf '%s\n' "$current"
        cron_line
      } | crontab -
      echo "installed: $(cron_line)"
      echo "first run lands within the hour; verify with: ./scripts/cron/install.sh status"
    else
      if [ -z "$current" ]; then
        crontab -r 2>/dev/null || true
      else
        printf '%s\n' "$current" | crontab -
      fi
      echo "removed: $TAG (no other crontab entries touched)"
    fi
    exit 0
    ;;

  *)
    echo "usage: $0 [install|print|status|uninstall]" >&2
    exit 2
    ;;
esac
