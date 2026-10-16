"""Rebuild each model request in a Claude Code transcript and count skill lists.

Each `api-request` keeps `keep` messages of the previous request and appends
the blobs named in `tail`. Prints compactions, Skill calls, and per request how
many copies of the skill listing the model saw, and how many skills they name.
"""
import json, re, sys

HEADER = 'The following skills are available for use with the Skill tool'
def strings(v):
    if isinstance(v, str): yield v
    elif isinstance(v, dict): yield from (s for x in v.values() for s in strings(x))
    elif isinstance(v, list): yield from (s for x in v for s in strings(x))

entries = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
blobs, messages, request = {}, [], 0
for i, e in enumerate(entries):
    t = e.get('type')
    if t == 'api-request-blob':
        blobs[e['hash']] = e['message']
    elif t == 'api-request':
        messages = messages[:e.get('keep', 0)] + [blobs.get(h, {'missing': h}) for h in e.get('tail', [])]
        request += 1
        lists = [part.split('</system-reminder>')[0] for s in strings(messages) for part in s.split(HEADER)[1:]]
        copies = len(lists)
        names = {n for part in lists for n in re.findall(r'^- ([\w:.-]+):', part, re.M)}
        missing = sum(1 for m in messages if 'missing' in m)
        print(f'{i:5} request {request:3}: {copies} skill list(s), {len(names)} skills' + (f', {missing} unrecorded message(s)' if missing else ''))
    elif e.get('subtype') == 'compact_boundary':
        print(f'{i:5} COMPACT {(e.get("compactMetadata") or {}).get("trigger")}')
    elif t == 'assistant':
        for c in e['message'].get('content', []):
            if c.get('type') == 'tool_use' and c.get('name') == 'Skill':
                print(f'{i:5} SKILL CALL {c["input"].get("skill")}')
