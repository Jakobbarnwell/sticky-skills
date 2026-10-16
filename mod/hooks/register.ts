import { atom, read, update } from 'claude-code'
import type { Register, SessionMessage } from 'claude-code'

import type { SkillEntries } from '../types'

// Claude Code sends the full skill list once per process and only changes after
// that, so a compaction loses it. This mod remembers every entry it sees and
// puts the full list back right after the compaction summary.

const remembered = atom({ plugin: 'sticky-skills', key: 'entries' } as const, {} as SkillEntries)

const HEADER = 'The following skills are available for use with the Skill tool:'
const LIST_START = `<system-reminder>\n${HEADER}`
const LIST_END = '</system-reminder>'

/** Splits a list into its `- name: description` entries, keyed by name. */
function parseEntries(list: string): SkillEntries {
  const entries: SkillEntries = {}
  let current: string | undefined
  for (const line of list.split('\n')) {
    const name = /^- ([^\s:]+(?::[^\s:]+)?): /.exec(line)?.[1]
    if (name !== undefined) {
      current = name
      entries[name] = line
    } else if (current !== undefined) {
      entries[current] += '\n' + line
    }
  }
  for (const name in entries) entries[name] = entries[name].trimEnd()
  return entries
}

function formatList(entries: SkillEntries): string {
  return [HEADER, '', ...Object.values(entries)].join('\n')
}

/** Every entry of the skill lists already in the conversation. */
function listedEntries(messages: SessionMessage[]): SkillEntries {
  const lists = messages.flatMap(message =>
    message.text
      .split(LIST_START)
      .slice(1)
      .map(rest => parseEntries(rest.split(LIST_END)[0])),
  )
  return Object.assign({}, ...lists)
}

export const register: Register = on => {
  on('prompt.attachment', async ($, e, next) => {
    const result = await next(e)
    // Subagents get their own full list, so only the main conversation needs help.
    if (e.agentId !== undefined || e.type !== 'skill_listing' || result.text === null) return result

    const sent = parseEntries(e.text)
    await update($, remembered, known => ({ ...known, ...sent }))

    // A resumed session starts a new process, which re-sends the full list even
    // though the conversation may already hold it. Pass on only what's new.
    const listed = listedEntries(await $.session.messages())
    const unlisted = Object.fromEntries(Object.entries(sent).filter(([name, entry]) => listed[name] !== entry))
    const count = Object.keys(unlisted).length
    if (count === 0) return { text: null }
    if (count === Object.keys(sent).length) return result
    return { text: formatList(unlisted) }
  })

  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    // A precompute only drafts a summary ahead of time; the real compaction comes later.
    if (e.agentId !== undefined || e.trigger === 'precompute' || 'skip' in result) return result

    // If restoring fails, the compaction still goes through, just without the list.
    try {
      const entries = await read($, remembered)
      if (Object.keys(entries).length === 0) return result

      const [summary, ...rest] = result.messages
      const text = `<system-reminder>\n${formatList(entries)}\n${LIST_END}`
      const list = { role: 'user' as const, text, toolUses: [] }
      return { ...result, messages: [summary, list, ...rest] }
    } catch {
      return result
    }
  })
}
