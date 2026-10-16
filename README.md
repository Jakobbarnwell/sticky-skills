# Skill listing restore

After a compaction, auto or manual `/compact`, Claude Code (2.1.302) does not
re-send its list of available skills, so the model stops routing to skills it
has not used yet in the session
([#82017](https://github.com/anthropics/claude-code/issues/82017)).

`mod/` is a Claude Code mod that keeps every skill entry it sees and, after a
compaction, adds the list to the first message the engine injects, so the first
request after the compaction already carries it. It drops the engine's own
re-sent copy, passing on only entries that are new or changed. Subagents are
left alone: their own loop gets its own list.

If the engine injects nothing after a compaction, the list waits for the next
injected message, at the latest the next prompt's.

Codex is not affected: its compacted history keeps the developer message that
holds the skills.

## Tests

Each script takes the setup to test: `none`, `hook` (the `reloadSkills`
`SessionStart` hook from the issue, `test/reload-skills.sh`) or `mod`.

- `test/run.sh <setup>`: one turn that reads enough to auto-compact mid-turn at
  the global `CLAUDE_CODE_AUTO_COMPACT_WINDOW`.
- `test/manual-compact.sh <setup>`: one process, two `/compact`s between short
  turns, then a subagent.

`test/analyze.py` rebuilds every request from the transcript, counts the skill
lists and the skills they name, and fails unless each request after a
compaction carries exactly one full list. Its output lands in
`test/out/<session>.summary`, the claude output in `test/out/<session>.log`.

Results (Haiku 5.5, Claude Code 2.1.302; the auto runs without the mod and the
resume check ran on 2.1.301):

| Setup | Auto-compaction mid-turn | Manual `/compact` |
| --- | --- | --- |
| none | fails: no list after it | fails: no list after it |
| hook | fails: first request has no list | passes |
| mod | passes (resume too) | passes, twice in a row |
