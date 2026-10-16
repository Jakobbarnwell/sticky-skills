"""Rebuild each model request in a Claude Code transcript and count skill lists.

Each `api-request` keeps `keep` messages of the previous request and appends
the blobs named in `tail`. Prints compactions, Skill calls, and per request how
many copies of the skill listing the model saw and how many skills they name.

Exits non-zero unless the main loop compacted, at least one request follows
each compaction, and every request, the main loop's and each subagent's,
carries exactly one list naming at least as many skills as its first did.
"""
import glob, json, re, sys
from collections import namedtuple

HEADER = 'The following skills are available for use with the Skill tool'

def strings(v):
    if isinstance(v, str): yield v
    elif isinstance(v, dict): yield from (s for x in v.values() for s in strings(x))
    elif isinstance(v, list): yield from (s for x in v for s in strings(x))

Analysis = namedtuple('Analysis', 'compactions failures awaiting_request')

def analyze(path):
    """Prints the transcript's events; answers its compaction count, the
    requests lacking one full list, and whether the last compaction still
    awaits a request."""
    blobs, messages, request = {}, [], 0
    initial_skills, compactions, awaiting_request, failures = None, 0, False, []
    for i, r in enumerate(json.loads(l) for l in open(path) if l.strip()):
        t = r.get('type')
        if t == 'api-request-blob':
            blobs[r['hash']] = r['message']
        elif t == 'api-request':
            messages = messages[:r.get('keep', 0)] + [blobs.get(h, {'missing': h}) for h in r.get('tail', [])]
            request += 1
            awaiting_request = False
            lists = [part.split('</system-reminder>')[0] for s in strings(messages) for part in s.split(HEADER)[1:]]
            names = {n for part in lists for n in re.findall(r'^- ([\w:.-]+):', part, re.M)}
            missing = sum(1 for m in messages if 'missing' in m)
            print(f'{i:5} request {request:3}: {len(lists)} skill list(s), {len(names)} skills' + (f', {missing} unrecorded message(s)' if missing else ''))
            if initial_skills is None:
                initial_skills = len(names)
            if len(lists) != 1 or len(names) < initial_skills:
                failures.append(request)
        elif r.get('subtype') == 'compact_boundary':
            compactions += 1
            awaiting_request = True
            print(f'{i:5} COMPACT {(r.get("compactMetadata") or {}).get("trigger")}')
        elif t == 'assistant':
            for c in r['message'].get('content', []):
                if c.get('type') == 'tool_use' and c.get('name') == 'Skill':
                    print(f'{i:5} SKILL CALL {c["input"].get("skill")}')
    return Analysis(compactions, failures, awaiting_request)

main = sys.argv[1]
compactions, failures, awaiting_request = analyze(main)
problems = []
if compactions == 0:
    problems.append('no compaction happened')
if awaiting_request:
    problems.append('no request after the last compaction')
if failures:
    problems.append(f'main requests {failures} lack exactly one full skill list')
for sub in sorted(glob.glob(main.removesuffix('.jsonl') + '/subagents/*.jsonl')):
    print(f'subagent {sub.rsplit("/", 1)[1]}')
    if (sub_failures := analyze(sub).failures):
        problems.append(f'subagent requests {sub_failures} lack exactly one full skill list')
print('FAIL: ' + '; '.join(problems) if problems else 'PASS')
sys.exit(1 if problems else 0)
