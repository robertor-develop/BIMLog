#!/bin/bash
set -euo pipefail

# Replit isolates Nix packages from the Node process namespace. This committed
# launcher enters the declared ClamAV environment, then re-verifies the exact
# governed scanner before forwarding either of the two supported operations.
readonly CLAMAV_PATH="/nix/store/j01wsla7rfrgjv3605l561mni4b4ka05-clamav-1.4.3/bin/clamscan"
readonly CLAMAV_VERSION="ClamAV 1.4.3"

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

if test "$OPERATION" = "version"; then
  printf "%s\n" "$CLAMAV_VERSION"
else
  exec clamscan --stdout --no-summary -
fi
