/** Each skill's listing entry as the engine last sent it, keyed by name. */
export type SkillEntries = Record<string, string>

declare module 'claude-code' {
  interface PluginState {
    'skill-listing-restore': {
      entries: SkillEntries
      /** The entries the mod put back in context since the last compaction. */
      resent: SkillEntries
    }
  }
}
