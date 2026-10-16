"""Verify frozen artifacts and score preserved responses; no model calls."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'experiments/role-learning/pilot'


def load(name):
    return json.loads((ROOT / name).read_text())


def main():
    manifest = load('manifest.json')
    for name, expected in manifest['sha256'].items():
        assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == expected, name
    for key, meta in load('input-manifest.json')['inputs'].items():
        assert hashlib.sha256((ROOT / f'inputs/{key}.md').read_bytes()).hexdigest() == meta['sha256']
    cases = {x['id']: x for x in load('cases.json')}
    result = {}
    for key in ['none-1', 'none-2', 'log-1', 'log-2', 'lesson-1', 'lesson-2',
                'ablation', 'revoked']:
        answers = load(f'responses/{key}.json')
        assert len(answers) == len(cases)
        assert {x['id'] for x in answers} == set(cases)
        details = []
        for answer in answers:
            case = cases[answer['id']]
            receipt = load(f"receipts/{key}-{case['id']}.json")
            assert hashlib.sha256(json.dumps(receipt['knowledge'], ensure_ascii=False,
                sort_keys=True).encode()).hexdigest() == receipt['input_sha256']
            assert set(answer['used_ids']).issubset({x['id'] for x in receipt['knowledge']})
            strict = all(answer.get(k) == v for k, v in case['expected'].items())
            # Secondary diagnostic only: not a retrospective replacement of strict scores.
            interpreted = dict(answer)
            for nested in ('required', 'required action fields'):
                interpreted.update(answer.get(nested, {}))
            semantic = all(interpreted.get(k) == v for k, v in case['expected'].items())
            details.append(dict(id=case['id'], strict_correct=strict,
                                secondary_semantic_correct=semantic,
                                need_clarification=answer['need_clarification'],
                                high_confidence_semantic_error=(not semantic and answer['confidence']>=0.8),
                                unsupported_used_ids=False))
        result[key] = dict(strict_correct=sum(x['strict_correct'] for x in details),
                           secondary_semantic_correct=sum(x['secondary_semantic_correct'] for x in details),
                           clarification_requests=sum(x['need_clarification'] for x in details),
                           cases=len(details), details=details)
    summary = {}
    for mode in ('none', 'log', 'lesson'):
        rows = [result[f'{mode}-{i}'] for i in (1,2)]
        summary[mode] = {metric:sum(r[metric] for r in rows) for metric in
                        ('strict_correct', 'secondary_semantic_correct', 'clarification_requests', 'cases')}
    all_results = dict(main=summary, runs=result, total_model_tokens=None,
                       total_model_cost=None, causal_generalization='not established')
    (ROOT / 'results.json').write_text(json.dumps(all_results, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
