#!/bin/bash
# Read enough in one turn that Claude Code auto-compacts in the middle of it.
. "$(dirname "$0")/lib.sh"

# 18 files of random dictionary words, the same on every run.
python3 -I - "$fixtures" <<'PY'
import random, sys
from pathlib import Path

words = Path('/usr/share/dict/words').read_text().split()
for n in range(1, 19):
    rng = random.Random(f'{n:02}')
    lines = (' '.join(rng.choices(words, k=10)) for _ in range(600))
    Path(sys.argv[1], f'f{n:02}.txt').write_text('\n'.join(lines) + '\n')
PY

run_claude --session-id "$id" "Read f01.txt through f18.txt in order with the Read tool, one call per file, no summaries. \
Then stress-test my plan: I want to rewrite the generator for these files in Rust. Question me about it."
report "$1"
