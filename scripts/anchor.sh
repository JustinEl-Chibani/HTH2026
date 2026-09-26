#!/usr/bin/env bash
# Runs Anchor inside WSL on a native Linux copy of the Rust workspace (building on /mnt/c is very
# slow), then copies the generated IDL + TS types back into web/lib/idl.
# Usage: bash scripts/anchor.sh build|test|deploy [extra anchor args]
set -euo pipefail
REPO_WIN="$(cd "$(dirname "$0")/.." && { pwd -W 2>/dev/null || pwd; })"
CMD="${1:-build}"; shift || true
EXTRA="$*"
run_wsl() {
  if grep -qi microsoft /proc/version 2>/dev/null; then bash -lc "$1"; else wsl.exe -e bash -lc "$1"; fi
}
REPO_LINUX="$(run_wsl "wslpath -a '$REPO_WIN'" | tr -d '\r')"
BUILD=~/pym-build
run_wsl "set -euo pipefail
  BUILD=\$HOME/pym-build
  mkdir -p \$BUILD/target/deploy
  rsync -a --delete --exclude target --exclude .anchor --exclude test-ledger \
    '$REPO_LINUX/Anchor.toml' '$REPO_LINUX/Cargo.toml' '$REPO_LINUX/rust-toolchain.toml' '$REPO_LINUX/programs' \$BUILD/
  [ -f \$BUILD/Cargo.lock ] || true
  cp '$REPO_LINUX/keys/put_your_money-keypair.json' \$BUILD/target/deploy/put_your_money-keypair.json
  cd \$BUILD
  case '$CMD' in
    build)  anchor build $EXTRA || exit 1 ;;
    test)   anchor build $EXTRA || exit 1; cargo test -p put_your_money -- --test-threads=4 || exit 1 ;;
    deploy) anchor build $EXTRA || exit 1; anchor deploy --provider.cluster devnet || exit 1 ;;
    *) anchor $CMD $EXTRA ;;
  esac
  mkdir -p '$REPO_LINUX/web/lib/idl'
  cp target/idl/put_your_money.json '$REPO_LINUX/web/lib/idl/put_your_money.json'
  cp target/types/put_your_money.ts '$REPO_LINUX/web/lib/idl/put_your_money.ts'
  [ -f Cargo.lock ] && cp Cargo.lock '$REPO_LINUX/Cargo.lock' || true
  echo 'anchor.sh: IDL + types copied to web/lib/idl'
"
