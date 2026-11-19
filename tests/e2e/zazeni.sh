#!/usr/bin/env bash
# Zažene e2e teste strani. Uporaba: bash tests/e2e/zazeni.sh
set -euo pipefail
cd "$(dirname "$0")"
# Datoteke tečejo zaporedoma: vsaka zažene svoj SwiftShader brskalnik z več 3D pogledi, vzporedno si krade procesor in časovne omejitve ne držijo.
exec node --test --test-concurrency=1 --test-timeout=120000 ./*.test.js
