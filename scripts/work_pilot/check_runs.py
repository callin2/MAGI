"""Recheck recorded real work artifacts, never call a model."""
import json
from pathlib import Path
from evaluator import evaluate

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'experiments/recursive-work'


def check_run(case_path, workspace, output_path=None):
    case = json.loads(case_path.read_text())
    result = evaluate(case, workspace)
    if workspace.name.startswith('transfer-'):
        try:
            data = json.loads((workspace/'cases.json').read_text())
            records = data['cases']
            valid = data['schema_version'] == 1 and isinstance(records, list) and len(records) >= 6
            ids = [x['id'] for x in records]
            valid = valid and len(ids) == len(set(ids))
            for family in ('followup', 'dedup', 'recovery'):
                selected = [x for x in records if x['family'] == family]
                valid = valid and any(x['is_transfer'] is True for x in selected)
                valid = valid and any(x['is_transfer'] is False for x in selected)
            valid = valid and all(isinstance(x['goal'], str) and x['goal'].strip()
                                   and isinstance(x['acceptance'], list) and x['acceptance']
                                   and all(isinstance(a, str) and a.strip() for a in x['acceptance'])
                                   for x in records)
            result['checks'].append({'kind':'case_data_schema','passed':bool(valid),
                                      'detail':'three families, each experience + transfer, unique IDs'})
        except (OSError, ValueError, KeyError, TypeError) as exc:
            result['checks'].append({'kind':'case_data_schema','passed':False,'detail':str(exc)})
    result['passed'] = all(x['passed'] for x in result['checks'])
    calls_path = workspace/'calls.json'
    result['recorded_tool_calls'] = None
    result['call_log_format'] = 'missing'
    if calls_path.exists():
        text = calls_path.read_text()
        try:
            calls = json.loads(text)
            result['recorded_tool_calls'] = len(calls) if isinstance(calls, list) else None
            result['call_log_format'] = 'json-list' if isinstance(calls, list) else 'json-object'
        except json.JSONDecodeError:
            try:
                calls = [json.loads(line) for line in text.splitlines() if line.strip()]
                result['recorded_tool_calls'] = len(calls)
                result['call_log_format'] = 'jsonl'
            except json.JSONDecodeError:
                result['call_log_format'] = 'unparseable; count unknown'
    result['total_model_tokens'] = None
    result['human_time_saved'] = None
    destination = output_path or workspace/'evaluation.json'
    destination.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    return result


def main():
    results = []
    originals = []
    corrected_first = []
    initial = check_run(DATA/'cases/initial.json', DATA/'runs/initial')
    results.append(initial)
    for mode in ('G','F','L','E'):
        name = f'transfer-{mode}'
        snapshot = DATA/'first-attempt'/name
        originals.append(check_run(DATA/'cases'/f'{name}.json', snapshot,
                                   snapshot/'original-evaluation-recheck.json'))
        corrected_first.append(check_run(DATA/'recovery-cases'/f'{name}.json', snapshot,
                                         snapshot/'corrected-rubric-evaluation.json'))
        results.append(check_run(DATA/'recovery-cases'/f'{name}.json', DATA/'runs'/name))
    output = {'first_attempt_original_rubric':originals,
              'first_attempt_corrected_rubric':corrected_first,
              'runs':results, 'general_learning_efficacy':'not established',
              'model_cost_efficiency':'not measured',
              'scope':'actual document work and local tool actions; structural checks are not semantic proof'}
    (DATA/'results.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'first_attempt_after_rubric_fix':[
        {'run':r['case_id'],'passed':r['passed']} for r in corrected_first],
        'recovery': [{'run':r['case_id'],'passed':r['passed'],
                     'checks':f"{sum(x['passed'] for x in r['checks'])}/{len(r['checks'])}",
                     'recorded_tool_calls':r['recorded_tool_calls']} for r in results]},
        ensure_ascii=False,indent=2))
    return 0 if all(r['passed'] for r in results) else 1


if __name__=='__main__':
    raise SystemExit(main())
