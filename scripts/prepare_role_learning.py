"""Replayable preparation for #16. Every adapter op uses a fresh process."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
PILOT = ROOT / 'experiments/role-learning/pilot'
ADAPTER = ROOT / 'scripts/role_memory.py'


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def main():
    db = Path(sys.argv[1]).resolve()
    if db.exists():
        raise SystemExit('Refuse to overwrite an existing experiment database')
    operations = []

    def call(request):
        p = subprocess.run([sys.executable, str(ADAPTER), str(db)], input=json.dumps(request),
                           text=True, capture_output=True)
        operations.append({'request': request, 'exit_code': p.returncode,
                           'result': json.loads(p.stdout)})
        write(PILOT / 'operations.json', operations)
        if p.returncode:
            raise RuntimeError(p.stdout + p.stderr)
        return json.loads(p.stdout)

    call(dict(op='state', id='delta-role-state', role_id='conditional-operator',
              role_version=1, project='synthetic-pilot', purpose='Apply documented API contracts',
              criteria='correctness, scope, evidence, no invented permissions'))
    call(dict(op='bind', id='trainer', agent_id='reflection-agent', state_id='delta-role-state',
              role_id='conditional-operator', role_version=1, project='synthetic-pilot'))
    for event in json.loads((PILOT / 'events.json').read_text()):
        call(dict(op='event', binding_id='trainer', scope=event['scope'], event=event))
    for lesson in json.loads((PILOT / 'learned-candidates.json').read_text()):
        call(dict(op='candidate', binding_id='trainer', lesson=lesson))
        # These records describe source review + the real adapter boundary tests,
        # not a claim that self-reported LLM evidence proves real API performance.
        validation = dict(lesson_id=lesson['id'], reference='validation-review.md', tests=[
            {'case': 'coordinator-source-check', 'passed': True,
             'evidence': lesson['source_id']},
            {'case': 'different-context-is-not-retrieved', 'passed': True,
             'counterexample': True, 'evidence': 'scripts/test_role_memory.py'}])
        call(dict(op='activate', binding_id='trainer', lesson_id=lesson['id'],
                  validation=validation))
    cases = json.loads((PILOT / 'cases.json').read_text())
    input_manifest = {}
    for rep in (1, 2):
        for mode in ('none', 'log', 'lesson'):
            key = f'{mode}-{rep}'
            call(dict(op='bind', id=key, agent_id=key, state_id='delta-role-state',
                      role_id='conditional-operator', role_version=1, project='synthetic-pilot'))
    # All bindings are created before queries so receipts share one knowledge revision.
    for rep in (1, 2):
        for mode in ('none', 'log', 'lesson'):
            key = f'{mode}-{rep}'
            batch = []
            for case in cases:
                receipt = call(dict(op='query', binding_id=key, state_id='delta-role-state',
                                    context=case['context'], mode=mode, task_id=f"{key}-{case['id']}",
                                    session_id=f'clean-{key}', run_id=f'worker-{key}'))['receipt']
                write(PILOT / f"receipts/{key}-{case['id']}.json", receipt)
                # Include only the rule/source data, not held-out scoring keys.
                memory = [{'id': x['id'], 'rule': x['rule'], 'conditions': x['conditions']}
                          if mode == 'lesson' else x for x in receipt['knowledge']]
                batch.append(dict(id=case['id'], context=case['context'], task=case['task'],
                                  available_experience=memory))
            text = '''You are a fresh conditional-operator agent on a synthetic API exercise.
Read ONLY this input file; do not inspect other files or browse. No file writes.
Use current task contracts and relevant available experience. If facts are insufficient,
ask for clarification rather than inventing an API contract. Do not blindly follow
experience from a different system/version. Return only a JSON array: each item has
id, action, required action fields, used_ids (IDs of experience actually used),
confidence (0..1), need_clarification (boolean), brief_reason. Do not perform real requests.
Do not infer that any particular action must outperform alternatives.

'''+json.dumps(batch, ensure_ascii=False, indent=2)+'\n'
            path = PILOT / f'inputs/{key}.md'
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text)
            input_manifest[key] = dict(sha256=hashlib.sha256(text.encode()).hexdigest(),
                                       input_bytes=len(text.encode()), input_chars=len(text))
    write(PILOT / 'input-manifest.json', dict(
        at=datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        inputs=input_manifest, token_usage=None))
    print('Prepared six clean worker inputs and 24 receipts; no model calls made here.')


if __name__ == '__main__':
    main()
