#!/bin/bash
# Run /compact twice between short turns of one process, then spawn a subagent.
. "$(dirname "$0")/lib.sh"
msg() { python3 -I -c 'import json,sys; print(json.dumps({"type":"user","message":{"role":"user","content":sys.argv[1]}}))' "$1"; }
{ msg "Say hi."; msg "/compact"; msg "Say ok."; msg "/compact"; msg "Use the Agent tool once to have a general-purpose subagent reply ok."; } |
  run_claude --input-format stream-json --output-format stream-json --verbose
report "$1"
