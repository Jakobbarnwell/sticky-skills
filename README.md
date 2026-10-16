# sticky-skills

**Compaction wipes Claude Code's skill list. sticky-skills puts it back.**

![sticky-skills](assets/poster.jpg)

Claude picks a skill by reading the list of available skills: each one's name
and description. Claude Code sends that list once per session. After a
compaction, auto or `/compact`, it's gone, so Claude stops reaching for skills
it hasn't used yet. In one real session, 50 skills were listed before
`/compact` and 3 after
([anthropics/claude-code#82017](https://github.com/anthropics/claude-code/issues/82017)).

sticky-skills is a Claude Code mod that puts the full list back right after the
compaction summary, so the right skill stays findable at the right time.

## Install

```sh
claude plugin marketplace add Jakobbarnwell/sticky-skills
claude plugin install sticky-skills@sticky-skills
```

Takes effect in new sessions. Mods you install yourself don't run where an
organization manages Claude Code.

## Why not the `reloadSkills` hook?

The workaround in the issue, a `SessionStart` hook returning
`reloadSkills: true`, re-sends the list with the next message. When Claude
compacts in the middle of a turn, the first request after it still goes out
without the list. sticky-skills writes the list into the compacted
conversation itself, so no request misses it.

| | Auto-compaction mid-turn | `/compact`, subagent, resume |
| --- | --- | --- |
| Claude Code alone | no list after it | no list after it |
| `reloadSkills` hook | first request has no list | list on every request |
| sticky-skills | list on every request | list on every request |

## How it works

- It records each skill entry Claude Code sends, then adds the full list as a
  message right after the compaction summary.
- When Claude Code later sends a listing of its own, only entries the
  conversation doesn't already hold go through, so the list never appears
  twice, including in a resumed session.
- Subagents keep their own list and are left alone.
- It's the same list Claude Code sends: names and descriptions only. Skill
  bodies still load only when a skill is used.

Limits: a skill removed mid-session stays in the restored list until the
session ends. Codex doesn't need this: its compacted history keeps the skills.

## Tests

End-to-end, against real Claude Code sessions (Haiku 5.5, Claude Code 2.1.301 and 2.1.302).
Each script takes the setup to test, `none`, `hook` or `mod`, and turns an
installed sticky-skills off:

- `test/run.sh <setup>` reads enough files in one turn to auto-compact mid-turn.
- `test/manual-compact.sh <setup>` runs two `/compact`s, a subagent, then a
  resume in a new process.

`test/analyze.py` rebuilds every request from the session transcript and fails
unless each one, main loop and subagents, carries exactly one full skill list.
Results land in `test/out/<session>.summary`.

## License

MIT
