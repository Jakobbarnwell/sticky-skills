# Shared by the e2e scripts. $1 picks the setup under test: none, hook or mod.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(dirname "$here")"
fixtures="$here/fixtures"; out="$here/out"
mkdir -p "$fixtures" "$out"

case "${1-}" in
  none|hook|mod) ;;
  *) echo "usage: $0 none|hook|mod" >&2; exit 2 ;;
esac
# Every setup turns the installed mod off, so only the one under test runs.
settings=$(python3 -I -c '
import json, sys
setup, hook = sys.argv[1:]
s = {"enabledPlugins": {"skill-listing-restore@skill-listing-restore": False}}
if setup == "hook":
    s["hooks"] = {"SessionStart": [{"matcher": "compact", "hooks": [{"type": "command", "command": hook}]}]}
print(json.dumps(s))' "$1" "$here/reload-skills.sh")
setup=(--settings "$settings")
[ "$1" = mod ] && setup+=(--plugin-dir "$root/mod")
id=$(uuidgen | tr 'A-Z' 'a-z')

# Runs claude in the fixtures dir with the setup's flags, appending to out/<id>.log.
run_claude() {
  (cd "$fixtures" && claude -p --model haiku "${setup[@]}" "$@") >> "$out/$id.log" 2>&1 ||
    { echo "claude failed, see $out/$id.log" >&2; exit 1; }
}

# Writes the analysis to out/<id>.summary; fails if the check fails.
report() {
  echo "session $id ($1)"
  python3 -I "$here/analyze.py" ~/.claude/projects/*/"$id".jsonl | tee "$out/$id.summary"
}
