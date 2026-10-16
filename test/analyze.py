"""Check that every model request in a Claude Code session carried the skill list.

Usage: analyze.py <session transcript .jsonl>

Rebuilds each request the model received from the transcript and prints, per
request, how many skill lists it held and how many skills they named. Also
prints compactions and Skill calls, then PASS or FAIL.

It passes only if the session compacted, a request followed each compaction,
and every request, in the main conversation and in each subagent, held exactly
one list naming at least as many skills as its first request did.
"""
import glob
import json
import re
import sys
from collections import namedtuple

HEADER = 'The following skills are available for use with the Skill tool'
ENTRY = re.compile(r'^- ([\w:.-]+):', re.MULTILINE)

Analysis = namedtuple('Analysis', 'compactions bad_requests awaiting_request')


def harness_texts(messages):
    """The text blocks Claude Code wrote, which is where it puts the skill list.

    Tool output and the model's replies can quote a list without being one.
    """
    for message in messages:
        if message.get('role') not in ('system', 'user'):
            continue
        content = message['content']
        if isinstance(content, str):
            yield content
        else:
            yield from (block['text'] for block in content if block.get('type') == 'text')


def skill_lists(messages):
    """The text of each skill list in the messages, up to its closing tag."""
    return [
        part.split('</system-reminder>')[0]
        for text in harness_texts(messages)
        for part in text.split(HEADER)[1:]
    ]


def analyze(path):
    # Each `api-request` keeps the first `keep` messages of the previous
    # request and appends the `api-request-blob`s its `tail` names.
    blobs, messages = {}, []
    requests, compactions, first_count = 0, 0, None
    awaiting_request, bad_requests = False, []

    records = (json.loads(line) for line in open(path) if line.strip())
    for i, record in enumerate(records):
        kind = record.get('type')

        if kind == 'api-request-blob':
            blobs[record['hash']] = record['message']

        elif kind == 'api-request':
            tail = [blobs.get(h, {'missing': h}) for h in record.get('tail', [])]
            messages = messages[:record.get('keep', 0)] + tail
            requests += 1
            awaiting_request = False

            lists = skill_lists(messages)
            names = {name for text in lists for name in ENTRY.findall(text)}
            unrecorded = sum('missing' in m for m in messages)
            line = f'{i:5} request {requests:3}: {len(lists)} skill list(s), {len(names)} skills'
            if unrecorded:
                line += f', {unrecorded} unrecorded message(s)'
            print(line)

            if first_count is None:
                first_count = len(names)
            if len(lists) != 1 or len(names) < first_count:
                bad_requests.append(requests)

        elif record.get('subtype') == 'compact_boundary':
            compactions += 1
            awaiting_request = True
            trigger = (record.get('compactMetadata') or {}).get('trigger')
            print(f'{i:5} COMPACT {trigger}')

        elif kind == 'assistant':
            for block in record['message'].get('content', []):
                if block.get('type') == 'tool_use' and block.get('name') == 'Skill':
                    print(f'{i:5} SKILL CALL {block["input"].get("skill")}')

    return Analysis(compactions, bad_requests, awaiting_request)


def main(path):
    problems = []
    main_conversation = analyze(path)
    if main_conversation.compactions == 0:
        problems.append('no compaction happened')
    if main_conversation.awaiting_request:
        problems.append('no request after the last compaction')
    if main_conversation.bad_requests:
        problems.append(f'main requests {main_conversation.bad_requests} lack exactly one full skill list')

    for subagent in sorted(glob.glob(path.removesuffix('.jsonl') + '/subagents/*.jsonl')):
        print(f'subagent {subagent.rsplit("/", 1)[1]}')
        bad = analyze(subagent).bad_requests
        if bad:
            problems.append(f'subagent requests {bad} lack exactly one full skill list')

    print('FAIL: ' + '; '.join(problems) if problems else 'PASS')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1]))
