#!/bin/bash
set -euo pipefail

# Replit isolates Nix packages from the Node process namespace. This committed
# launcher enters the declared ClamAV environment, then re-verifies the exact
# governed scanner before forwarding either of the two supported operations.
readonly CLAMAV_PATH="/nix/store/j01wsla7rfrgjv3605l561mni4b4ka05-clamav-1.4.3/bin/clamscan"
readonly FRESHCLAM_PATH="/nix/store/j01wsla7rfrgjv3605l561mni4b4ka05-clamav-1.4.3/bin/freshclam"
readonly CLAMAV_VERSION="ClamAV 1.4.3"
readonly FRESHCLAM_CONFIG="/home/runner/workspace/artifacts/api-server/scripts/feedback-freshclam.conf"
readonly FRESHCLAM_CONFIG_SHA256="6ed4f546ac3efced17ff8ba320cbff2c98e44fe33303a1c9fa2741a9171b3492"
readonly DATABASE_ROOT="/tmp/bimlog-feedback-clamav"
readonly DATABASE_DIR="${DATABASE_ROOT}/database"
readonly DATABASE_READY="${DATABASE_DIR}/.bimlog-ready"
readonly DATABASE_LOCK="${DATABASE_ROOT}/update.lock"
readonly DATABASE_REFRESH_SECONDS=14400
readonly DATABASE_MAX_AGE_SECONDS=172800
readonly DATABASE_MAX_BYTES=536870912

case "${1-}" in
  --version)
    test "$#" -eq 1
    readonly OPERATION="version"
    ;;
  --stdout)
    test "$#" -eq 3
    test "${2-}" = "--no-summary"
    test "${3-}" = "-"
    readonly OPERATION="scan"
    ;;
  *)
    echo "Unsupported scanner operation" >&2
    exit 64
    ;;
esac

resolved="$(command -v clamscan)"
test "$resolved" = "$CLAMAV_PATH"
test "$(clamscan --version)" = "$CLAMAV_VERSION"
test "$(command -v freshclam)" = "$FRESHCLAM_PATH"
test -f "$FRESHCLAM_CONFIG"
test ! -L "$FRESHCLAM_CONFIG"
test "$(sha256sum "$FRESHCLAM_CONFIG" | awk '{print $1}')" = "$FRESHCLAM_CONFIG_SHA256"
test "$(freshclam --config-file="$FRESHCLAM_CONFIG" --version | cut -d/ -f1)" = "$CLAMAV_VERSION"

mkdir -p "$DATABASE_ROOT"
chmod 700 "$DATABASE_ROOT"

release_lock() {
  rm -f "${DATABASE_LOCK}/pid"
  rmdir "$DATABASE_LOCK" 2>/dev/null || true
}

acquire_lock() {
  local attempt owner lock_age
  for attempt in $(seq 1 180); do
    if mkdir -m 700 "$DATABASE_LOCK" 2>/dev/null; then
      printf '%s\n' "$$" > "${DATABASE_LOCK}/pid"
      return 0
    fi
    owner="$(cat "${DATABASE_LOCK}/pid" 2>/dev/null || true)"
    if [[ "$owner" =~ ^[1-9][0-9]*$ ]] && ! kill -0 "$owner" 2>/dev/null; then
      rm -f "${DATABASE_LOCK}/pid"
      rmdir "$DATABASE_LOCK" 2>/dev/null || true
      continue
    fi
    if test -z "$owner"; then
      lock_age="$(( $(date +%s) - $(stat -c %Y "$DATABASE_LOCK" 2>/dev/null || date +%s) ))"
      if test "$lock_age" -gt 10; then
        rmdir "$DATABASE_LOCK" 2>/dev/null || true
        continue
      fi
    fi
    sleep 1
  done
  echo "Scanner database lock timeout" >&2
  return 1
}

database_age() {
  local modified now
  modified="$(stat -c %Y "$DATABASE_READY" 2>/dev/null || printf 0)"
  now="$(date +%s)"
  printf '%s\n' "$((now - modified))"
}

validate_database() {
  test -d "$DATABASE_DIR" || return 1
  test -f "$DATABASE_READY" || return 1
  test -z "$(find "$DATABASE_DIR" -type l -print -quit 2>/dev/null)" || return 1
  test -n "$(find "$DATABASE_DIR" -maxdepth 1 -type f \( -name '*.cvd' -o -name '*.cld' -o -name '*.cud' -o -name '*.cbc' \) -print -quit 2>/dev/null)" || return 1
  local bytes
  bytes="$(du -sb "$DATABASE_DIR" 2>/dev/null | awk '{print $1}')" || return 1
  [[ "$bytes" =~ ^[0-9]+$ ]] || return 1
  test "$bytes" -gt 0 || return 1
  test "$bytes" -le "$DATABASE_MAX_BYTES" || return 1
  "$CLAMAV_PATH" --database="$DATABASE_DIR" --version >/dev/null 2>&1 || return 1
}

refresh_database() {
  local log="${DATABASE_ROOT}/freshclam.log"
  mkdir -p "$DATABASE_DIR"
  chmod 700 "$DATABASE_DIR"
  if ! "$FRESHCLAM_PATH" --config-file="$FRESHCLAM_CONFIG" --datadir="$DATABASE_DIR" --quiet >"$log" 2>&1; then
    rm -f "$log"
    return 1
  fi
  rm -f "$log"
  chmod -R go-rwx "$DATABASE_DIR"
  touch "$DATABASE_READY"
  validate_database
}

trap release_lock EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
acquire_lock
if validate_database; then
  age="$(database_age)"
  if test "$age" -gt "$DATABASE_REFRESH_SECONDS"; then
    if ! refresh_database; then
      if ! validate_database || test "$age" -gt "$DATABASE_MAX_AGE_SECONDS"; then
        echo "Scanner signatures exceeded their governed maximum age" >&2
        exit 70
      fi
    fi
  fi
else
  rm -rf "$DATABASE_DIR"
  if ! refresh_database; then
    echo "Scanner signatures are unavailable" >&2
    exit 70
  fi
fi

if test "$OPERATION" = "version"; then
  printf "%s\n" "$CLAMAV_VERSION"
else
  set +e
  "$CLAMAV_PATH" --database="$DATABASE_DIR" --stdout --no-summary -
  result="$?"
  set -e
  exit "$result"
fi
