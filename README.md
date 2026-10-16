# Skill listing restore

After a compaction (auto or manual `/compact`), Claude Code (2.1.301) does not re-send its list of
available skills, so the model stops routing to skills it has not used yet in
the session ([#82017](https://github.com/anthropics/claude-code/issues/82017)).

- `mod/`: a Claude Code mod that keeps every skill entry it sees and, after a
  compaction, adds the list to the first message the engine injects, so the
  first request after the compaction already carries it. It drops the engine's
  own re-sent copy when that copy adds nothing.
- `hook/`: the alternative from the issue, a `SessionStart` (`compact`) hook
  returning `reloadSkills: true`.
- `test/run.sh [claude args]`: one turn that reads enough to auto-compact
  mid-turn (at the global `CLAUDE_CODE_AUTO_COMPACT_WINDOW`), then
  `test/analyze.py` rebuilds every request and counts skill lists and the
  skills they name.
- `test/manual-compact.sh [claude args]`: one process, two `/compact`s between
  short turns.

Results (Haiku 5.5, mid-turn auto-compaction and two manual compactions):

| Setup | Requests after a compaction carrying the list |
| --- | --- |
| nothing | none |
| `reloadSkills` hook | all but the first |
| mod | all, one full copy each (resume included) |

Run either script with `--plugin-dir "$PWD/mod"` or
`--settings "$PWD/test/hook-settings.json"`.
