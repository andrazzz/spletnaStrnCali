#!/usr/bin/env bash
# Zažene e2e teste strani. Uporaba: bash tests/e2e/zazeni.sh
set -euo pipefail
cd "$(dirname "$0")"
exec node --test --test-timeout=120000 ./*.test.js
