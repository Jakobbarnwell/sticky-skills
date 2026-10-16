#!/bin/sh
# SessionStart(compact): ask Claude Code to re-send the full skill listing.
printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"SessionStart","reloadSkills":true}}'
