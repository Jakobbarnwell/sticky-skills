# Shared by the test scripts. $1 picks the setup under test: none, hook or mod.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(dirname "$here")"
fixtures="$here/fixtures"
out="$here/out"
mkdir -p "$fixtures" "$out"

case "${1-}" in
  none|hook|mod) ;;
  *) echo "usage: $0 none|hook|mod" >&2; exit 2 ;;
esac

# Every setup turns an installed sticky-skills off, so only the setup under test runs.
settings=$(python3 -I - "$1" "$here/reload-skills.sh" <<'PY'
import json, sys

setup, hook = sys.argv[1:]
settings = {'enabledPlugins': {'sticky-skills@sticky-skills': False}}
if setup == 'hook':
    on_compact = {'matcher': 'compact', 'hooks': [{'type': 'command', 'command': hook}]}
    settings['hooks'] = {'SessionStart': [on_compact]}
print(json.dumps(settings))
PY
)
flags=(--settings "$settings")
if [ "$1" = mod ]; then flags+=(--plugin-dir "$root/mod"); fi

id=$(uuidgen | tr 'A-Z' 'a-z')

# Runs claude in the fixtures folder, logging to out/<id>.log.
run_claude() {
  (cd "$fixtures" && claude -p --model haiku "${flags[@]}" "$@") >> "$out/$id.log" 2>&1 ||
    { echo "claude failed, see $out/$id.log" >&2; exit 1; }
}

# Checks the session and saves the result to out/<id>.summary.
report() {
  echo "session $id ($1)"
  python3 -I "$here/analyze.py" ~/.claude/projects/*/"$id".jsonl | tee "$out/$id.summary"
}
