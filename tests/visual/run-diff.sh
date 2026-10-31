#!/usr/bin/env bash
# Build + preview + captura 375/1024 + comparación pixel a pixel contra una carpeta de referencia.
# Uso: bash tests/visual/run-diff.sh [referencia=evidence/tests/visual/v2-tokens] [salida=/tmp/visual-out]
set -u
cd "$(dirname "$0")/../.."
REF="${1:-evidence/tests/visual/v2-tokens}"
OUT="${2:-${TMPDIR:-/tmp}/visual-out}"
PORT=4410
npm run build >/dev/null 2>&1 || { echo "BUILD FAILED"; npm run build 2>&1 | tail -20; exit 2; }
npx astro preview stop >/dev/null 2>&1
npx astro preview --port $PORT >/dev/null 2>&1 &
for i in $(seq 1 30); do curl -s -o /dev/null "http://localhost:$PORT/" && break; sleep 0.5; done
rm -rf "$OUT"
node tests/visual/capture.mjs "http://localhost:$PORT/" "$OUT/new" >/dev/null
node tests/visual/compare.mjs "$REF" "$OUT/new" "$OUT/diff2"
STATUS=$?
if [ $STATUS -ne 0 ]; then node tests/visual/locate-diff.mjs "$OUT" "http://localhost:$PORT/"; fi
npx astro preview stop >/dev/null 2>&1
exit $STATUS
