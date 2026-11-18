#!/usr/bin/env bash
# Prenese (ali posodobi) avtorjeve Fusion skripte. Uporaba: sync.sh [ciljna mapa]  (privzeto /tmp/cali-kuhinja)
set -euo pipefail
CILJ="${1:-/tmp/cali-kuhinja}"
if [ -d "$CILJ/.git" ]; then
  git -C "$CILJ" pull --ff-only
else
  git clone --depth 1 https://github.com/andrazzz/cali-kuhinja "$CILJ"
fi
echo "Skripte: $CILJ/skripte"
