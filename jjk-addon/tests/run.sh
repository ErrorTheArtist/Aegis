#!/usr/bin/env bash
# Mock tests for the gameplay scripts (no Minecraft needed): copies behavior_pack/scripts to a temp folder as .mjs,
# wires in the mock @minecraft/server and @minecraft/server-ui (tests/mock/), and runs every tests/test*.mjs.
#   ./tests/run.sh            all tests
#   ./tests/run.sh test2_moves   one test
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
for m in server server-ui; do
  mkdir -p "$tmp/node_modules/@minecraft/$m"
  cp "$here/mock/$m.mjs" "$tmp/node_modules/@minecraft/$m/index.mjs"
  echo "{\"name\":\"@minecraft/$m\",\"type\":\"module\",\"exports\":\"./index.mjs\"}" > "$tmp/node_modules/@minecraft/$m/package.json"
done
# (.mjs copies, so Node really parses them as ES modules: `node --check file.js` can miss syntax errors here)
for f in "$here/../behavior_pack/scripts/"*.js; do
  b=$(basename "$f" .js)
  sed -E 's#from "\./([a-z_0-9]+)\.js"#from "./\1.mjs"#' "$f" > "$tmp/$b.mjs"
  node --check "$tmp/$b.mjs"
done
cp "$here"/harness.mjs "$here"/test*.mjs "$tmp/"
fail=0
for t in "$tmp"/${1:-test*}.mjs; do
  out=$(node "$t" 2>&1) || true
  last=$(echo "$out" | tail -1)
  echo "$(basename "$t" .mjs): $last"
  if [ "$last" != "ALL OK" ]; then echo "$out" | grep -E "FAIL|Error" | head -20; fail=1; fi
done
exit $fail
