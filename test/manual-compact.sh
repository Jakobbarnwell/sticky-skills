#!/bin/bash
# Run /compact twice between short turns of one process, then spawn a subagent;
# then resume the session in a new process.
. "$(dirname "$0")/lib.sh"
msg() { python3 -I -c 'import json,sys; print(json.dumps({"type":"user","message":{"role":"user","content":sys.argv[1]}}))' "$1"; }
{ msg "Say hi."; msg "/compact"; msg "Say ok."; msg "/compact"; msg "Use the Agent tool once to have a general-purpose subagent reply ok."; } |
  run_claude --session-id "$id" --input-format stream-json --output-format stream-json --verbose
run_claude --resume "$id" "Say resumed."
report "$1"
