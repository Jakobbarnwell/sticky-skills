#!/bin/bash
# Run /compact twice between turns of one process, then report what each request
# carries. Extra args go to claude and must use absolute paths.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
out="$here/out"; work="$here/fixtures"
mkdir -p "$out" "$work"
id=$(uuidgen | tr 'A-Z' 'a-z')
msg() { python3 -I -c 'import json,sys; print(json.dumps({"type":"user","message":{"role":"user","content":sys.argv[1]}}))' "$1"; }
cd "$work"
{ msg "Say hi."; msg "/compact"; msg "Say ok."; msg "/compact"; msg "Say done."; } |
  claude -p --model haiku --session-id "$id" --input-format stream-json --output-format stream-json --verbose "$@" \
  > "$out/$id.jsonl" 2>&1 || true
log=$(ls ~/.claude/projects/*/"$id".jsonl)
echo "session $id"; python3 -I "$here/analyze.py" "$log"
