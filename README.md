# sticky-skills

The right skill at the right time, even after compaction.

After a compaction, auto or manual `/compact`, Claude Code (2.1.302) does not
re-send its list of available skills, so the model stops routing to skills it
has not used yet in the session
([#82017](https://github.com/anthropics/claude-code/issues/82017)).

`mod/` is a Claude Code mod that keeps every skill entry the main loop sees and,
in its `session.compact` hook, puts the list back into the compacted
conversation right after the summary, so the first request after a compaction,
mid-turn included, already carries it. When the engine later sends a listing,
the mod passes on only entries the conversation does not already hold, which
also covers a resumed session in a new process. Subagents and `precompute`
compactions are left alone.

Known limits: a skill removed mid-session stays in the list the mod puts back,
and a compaction that installs a precomputed summary is assumed to run the
`session.compact` hook like any other.

The list is the skills' names and descriptions only, as the engine sends it;
skill bodies still load when a skill is invoked.

Codex is not affected: its compacted history keeps the developer message that
holds the skills.

## Install

```sh
claude plugin marketplace add Jakobbarnwell/sticky-skills
claude plugin install sticky-skills@sticky-skills
```

User-installed mods don't run where an organization manages Claude
Code.

## Tests

Each script takes the setup to test: `none`, `hook` (the `reloadSkills`
`SessionStart` hook from the issue, `test/reload-skills.sh`) or `mod`; each
turns the installed mod off.

- `test/run.sh <setup>`: one turn that reads enough to auto-compact mid-turn at
  the global `CLAUDE_CODE_AUTO_COMPACT_WINDOW`.
- `test/manual-compact.sh <setup>`: one process, two `/compact`s between short
  turns, then a subagent; then a resume in a new process.

`test/analyze.py` rebuilds every request from the transcript, counts the skill
lists and the skills they name, and fails unless every request, the main
loop's and each subagent's, carries exactly one full list. Its output lands in
`test/out/<session>.summary`, the claude output in `test/out/<session>.log`.

Results (Haiku 5.5). The mod's runs used Claude Code 2.1.302, the auto runs
without it 2.1.301.

| Setup | Auto-compaction mid-turn | Manual `/compact`, subagent, resume |
| --- | --- | --- |
| none | fails: no list after it | fails: no list after it |
| hook | fails: first request has no list | passes |
| mod | passes, twice in one turn | passes |
