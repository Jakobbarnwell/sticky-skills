/** Each skill's list entry as Claude Code last sent it, keyed by name. */
export type SkillEntries = Record<string, string>

declare module 'claude-code' {
  interface PluginState {
    'sticky-skills': {
      entries: SkillEntries
    }
  }
}
