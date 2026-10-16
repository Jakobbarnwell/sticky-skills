import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { SkillEntries } from '../types'

const entries = atom({ plugin: 'skill-listing-restore', key: 'entries' } as const, {} as SkillEntries)
const heldNames = atom({ plugin: 'skill-listing-restore', key: 'heldNames' } as const, [] as string[])

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

// The engine sends the full skill listing once per process and only deltas
// after that, so a compaction drops the list for good. The mod keeps every
// entry it has seen and, after a compaction, adds the list to the first message
// the engine injects (the deferred-tools or agent listing it re-sends right
// away), so the first request after the compaction already carries it.
export const register: Register = on => {
  // A module variable, not state: the engine renders a batch of attachments at
  // once, and only a synchronous check-and-clear lets exactly one claim it.
  let isPending = false

  on('prompt.attachment', async ($, e, next) => {
    const result = await next(e)

    if (e.type === 'skill_listing') {
      const sent = parseListing(e.text)
      const names = Object.keys(sent)
      if (names.length > 0) {
        await update($, entries, all => ({ ...all, ...sent }))
        // Already in context through us since the compaction: skip the engine's copy.
        const held = await read($, heldNames)
        if (held.length > 0 && names.every(n => held.includes(n))) return { text: null }
      }
      return result
    }

    if (!isPending || result.text === null) return result
    isPending = false
    const all = await read($, entries)
    const names = Object.keys(all)
    if (names.length === 0) return result

    await update($, heldNames, () => names)
    const listing = [HEADER, '', ...names.map(n => all[n])].join('\n')
    return { ...result, text: `${result.text}\n\n${listing}` }
  })

  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && !('skip' in result)) {
      isPending = true
      // Never let our bookkeeping fail the compaction itself.
      await update($, heldNames, () => []).catch(() => {})
    }
    return result
  })
}
