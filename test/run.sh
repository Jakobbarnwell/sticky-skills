#!/bin/bash
# Fill one turn past the auto-compact window so compaction happens mid-turn.
. "$(dirname "$0")/lib.sh"
if [ ! -f "$fixtures/f18.txt" ]; then
  for n in $(seq -w 1 18); do
    python3 -I -c 'import random,sys; w=open("/usr/share/dict/words").read().split(); r=random.Random(sys.argv[1]); print("\n".join(" ".join(r.choices(w,k=10)) for _ in range(600)))' "$n" > "$fixtures/f$n.txt"
  done
fi
run_claude --session-id "$id" "Read f01.txt through f18.txt in order with the Read tool, one call per file, no summaries. \
Then stress-test my plan: I want to rewrite the generator for these files in Rust. Question me about it."
report "$1"
