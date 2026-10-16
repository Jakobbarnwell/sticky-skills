import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { SkillEntries } from '../types'

const entries = atom({ plugin: 'skill-listing-restore', key: 'entries' } as const, {} as SkillEntries)

const HEADER = 'The following skills are available for use with the Skill tool:'

// The engine's listing is "- name: description" entries, descriptions sometimes
// running onto further lines, under a header line.
function parseListing(text: string): SkillEntries {
  const parsed: SkillEntries = {}
  let name: string | undefined
  for (const line of text.split('\n')) {
    const start = /^- ([^\s:]+(?::[^\s:]+)?): /.exec(line)
    if (start) {
      name = start[1]
      parsed[name] = line
    } else if (name !== undefined) {
      parsed[name] += '\n' + line
    }
  }
  for (const key of Object.keys(parsed)) parsed[key] = parsed[key].trimEnd()
  return parsed
}

const render = (list: SkillEntries) => [HEADER, '', ...Object.values(list)].join('\n')

// The engine sends the full skill listing once per process and only deltas
// after that, so a compaction drops the list for good. The mod keeps every
// entry the main loop has seen and puts the list back into the compacted
// conversation, right after the summary, so the next request carries it.
export const register: Register = on => {
  on('prompt.attachment', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined || e.type !== 'skill_listing' || result.text === null) return result

    const sent = parseListing(e.text)
    await update($, entries, known => ({ ...known, ...sent }))
    // Pass on only entries the conversation does not already hold as sent,
    // such as the copy the mod put back, which a resumed process cannot know.
    const held: SkillEntries = Object.assign({}, ...(await $.session.messages())
      .flatMap(m => m.text.split(HEADER).slice(1))
      .map(part => parseListing(part.split('</system-reminder>')[0])))
    const changed = Object.fromEntries(Object.entries(sent).filter(([n, entry]) => held[n] !== entry))
    const count = Object.keys(changed).length
    if (count === 0) return { text: null }
    return count === Object.keys(sent).length ? result : { text: render(changed) }
  })

  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined || e.trigger === 'precompute' || 'skip' in result) return result
    // Never let our bookkeeping fail the compaction itself.
    try {
      const all = await read($, entries)
      if (Object.keys(all).length === 0) return result
      const [summary, ...kept] = result.messages
      const listing = { role: 'user' as const, text: `<system-reminder>\n${render(all)}\n</system-reminder>`, toolUses: [] }
      return { ...result, messages: [summary, listing, ...kept] }
    } catch {
      return result
    }
  })
}
