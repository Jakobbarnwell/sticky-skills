/** Each skill's listing entry as the engine last sent it, keyed by name. */
export type SkillEntries = Record<string, string>

declare module 'claude-code' {
  interface PluginState {
    'skill-listing-restore': {
      entries: SkillEntries
      /** The skill names the mod re-sent since the last compaction. */
      heldNames: string[]
    }
  }
}
