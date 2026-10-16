"""Rebuild each model request in a Claude Code transcript and count skill lists.

Each `api-request` keeps `keep` messages of the previous request and appends
the blobs named in `tail`. Prints compactions, Skill calls, and per request how
many copies of the skill listing the model saw and how many skills they name.

Exits non-zero unless every request after a compaction carries exactly one
list naming at least as many skills as the first request did, and at
least one request follows each compaction.
"""
import json, re, sys

HEADER = 'The following skills are available for use with the Skill tool'

def strings(v):
    if isinstance(v, str): yield v
    elif isinstance(v, dict): yield from (s for x in v.values() for s in strings(x))
    elif isinstance(v, list): yield from (s for x in v for s in strings(x))

records = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
blobs, messages, request = {}, [], 0
initial_skills, compacted, uncovered, failures = None, False, False, []
for i, r in enumerate(records):
    t = r.get('type')
    if t == 'api-request-blob':
        blobs[r['hash']] = r['message']
    elif t == 'api-request':
        messages = messages[:r.get('keep', 0)] + [blobs.get(h, {'missing': h}) for h in r.get('tail', [])]
        request += 1
        uncovered = False
        lists = [part.split('</system-reminder>')[0] for s in strings(messages) for part in s.split(HEADER)[1:]]
        names = {n for part in lists for n in re.findall(r'^- ([\w:.-]+):', part, re.M)}
        missing = sum(1 for m in messages if 'missing' in m)
        print(f'{i:5} request {request:3}: {len(lists)} skill list(s), {len(names)} skills' + (f', {missing} unrecorded message(s)' if missing else ''))
        if initial_skills is None:
            initial_skills = len(names)
        elif compacted and (len(lists) != 1 or len(names) < initial_skills):
            failures.append(request)
    elif r.get('subtype') == 'compact_boundary':
        compacted, uncovered = True, True
        print(f'{i:5} COMPACT {(r.get("compactMetadata") or {}).get("trigger")}')
    elif t == 'assistant':
        for c in r['message'].get('content', []):
            if c.get('type') == 'tool_use' and c.get('name') == 'Skill':
                print(f'{i:5} SKILL CALL {c["input"].get("skill")}')

if not compacted:
    sys.exit('FAIL: no compaction happened')
if uncovered:
    sys.exit('FAIL: no request after the last compaction')
if failures:
    sys.exit(f'FAIL: requests {failures} lack exactly one full skill list')
print('PASS')
