#!/bin/bash
# Run /compact twice between short turns, then a subagent, all in one process.
# Then resume the session in a new process.
. "$(dirname "$0")/lib.sh"

message() {
  python3 -I -c 'import json, sys; print(json.dumps({"type": "user", "message": {"role": "user", "content": sys.argv[1]}}))' "$1"
}

{
  message "Say hi."
  message "/compact"
  message "Say ok."
  message "/compact"
  message "Use the Agent tool once to have a general-purpose subagent reply ok."
} | run_claude --session-id "$id" --input-format stream-json --output-format stream-json --verbose

run_claude --resume "$id" "Say resumed."
report "$1"
