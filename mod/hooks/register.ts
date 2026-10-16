import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { SkillEntries } from '../types'

const entries = atom({ plugin: 'skill-listing-restore', key: 'entries' } as const, {} as SkillEntries)
const resent = atom({ plugin: 'skill-listing-restore', key: 'resent' } as const, {} as SkillEntries)

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
// entry the main loop has seen and, after a compaction, adds the list to the
// first message the engine injects there (usually the deferred-tools or agent
// listing it re-sends right away), so the first request already carries it.
export const register: Register = on => {
  // A module variable, not state: the engine renders a batch of attachments at
  // once, and only a synchronous check-and-clear lets exactly one claim it.
  let listingOwed = false

  on('prompt.attachment', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined || result.text === null) return result

    const isOwed = listingOwed
    listingOwed = false

    if (e.type === 'skill_listing') {
      const sent = parseListing(e.text)
      const all = await update($, entries, known => ({ ...known, ...sent }))
      if (isOwed) {
        await update($, resent, () => all)
        return { text: render(all) }
      }
      // Pass on only what differs from the copy the mod put back in context.
      const shown = await read($, resent)
      if (Object.keys(shown).length === 0) return result
      const changed = Object.fromEntries(Object.entries(sent).filter(([n, entry]) => shown[n] !== entry))
      if (Object.keys(changed).length === 0) return { text: null }
      await update($, resent, known => ({ ...known, ...changed }))
      return { text: render(changed) }
    }

    if (!isOwed) return result
    const all = await read($, entries)
    if (Object.keys(all).length === 0) return result
    await update($, resent, () => all)
    return { text: `${result.text}\n\n${render(all)}` }
  })

  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && !('skip' in result)) {
      listingOwed = true
      // Never let our bookkeeping fail the compaction itself.
      await update($, resent, () => ({})).catch(() => {})
    }
    return result
  })
}
