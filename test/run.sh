#!/bin/bash
# Fill one turn past the auto-compact window so compaction happens mid-turn,
# then report what the transcript carries after it. Extra args go to claude.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
fixtures="$here/fixtures"; out="$here/out"
mkdir -p "$fixtures" "$out"
if [ ! -f "$fixtures/f18.txt" ]; then
  for n in $(seq -w 1 18); do
    python3 -I -c 'import random,sys; w=open("/usr/share/dict/words").read().split(); r=random.Random(sys.argv[1]); print("\n".join(" ".join(r.choices(w,k=10)) for _ in range(600)))' "$n" > "$fixtures/f$n.txt"
  done
fi
id=$(uuidgen | tr 'A-Z' 'a-z')
cd "$fixtures"
claude -p --model haiku --session-id "$id" "$@" \
  "Read f01.txt through f18.txt in order with the Read tool, one call per file, no summaries. \
Then stress-test my plan: I want to rewrite the generator for these files in Rust. Question me about it." \
  > "$out/$id.txt" 2>&1 || true
log=$(ls ~/.claude/projects/*/"$id".jsonl)
echo "session $id"; python3 -I "$here/analyze.py" "$log"
