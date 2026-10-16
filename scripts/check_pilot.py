#!/usr/bin/env python3
"""Validate and aggregate recorded pilot outputs. Does not invoke an AI model."""
import argparse
import collections
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / 'experiments' / 'pilot-001'


def read(name):
    return json.loads((RUN / name).read_text())


def validate_records(records, cases, required):
    assert len(records) == len(cases), 'wrong number of records'
    indexed = {record['id']: record for record in records}
    assert len(indexed) == len(records), 'duplicate case ID'
    assert set(indexed) == set(cases), 'case IDs mismatch'
    for case_id, record in indexed.items():
        assert record['action'] in cases[case_id]['actions'], f'invalid action: {case_id}'
        for field in required:
            assert field in record and record[field], f'missing field: {case_id}/{field}'
    return indexed


def aggregate():
    manifest = read('input-manifest.json')
    for name, expected in manifest['files'].items():
        assert hashlib.sha256((RUN / name).read_bytes()).hexdigest() == expected, f'input changed: {name}'
    cases = {case['id']: case for case in read('cases.json')}
    assert len(cases) == 6, 'case count changed'
    required = ['hypotheses', 'evidence', 'unknowns', 'next_observation', 'reconsider_when']
    independent = [validate_records(read(f'responses/{label}.json'), cases, required) for label in 'abc']
    for agent in independent:
        assert all(len(r['hypotheses']) >= 2 for r in agent.values()), 'hypotheses missing'
    coordinated = validate_records(read('responses/coordinator.json'), cases, [
        'accepted_hypothesis', 'rejected_or_unresolved', 'evidence_check',
        'next_observation', 'reconsider_when', 'limitations'])
    key = read('rubric.json')['binary_action_key']
    rows = []
    for case_id in cases:
        votes = [agent[case_id]['action'] for agent in independent]
        winner, count = collections.Counter(votes).most_common(1)[0]
        simple = winner if count >= 2 else 'TIE'
        rows.append({'id': case_id, 'independent': votes, 'single': votes[0],
                     'simple': simple, 'competition': coordinated[case_id]['action'],
                     'predeclared_action_key': key[case_id]['expected']})
    return {'status': 'paired exploratory; not equal budget; not an accuracy benchmark',
            'cases': rows,
            'action_key_agreement': {arm: sum(r[arm] == r['predeclared_action_key'] for r in rows)
                                     for arm in ['single', 'simple', 'competition']},
            'known_data_cases': ['K1', 'K2'],
            'interpretive_preference_cases': ['N1', 'N2', 'D1', 'D2'],
            'independent_unanimity_cases': sum(len(set(r['independent'])) == 1 for r in rows),
            'competition_action_changes_from_simple': sum(r['competition'] != r['simple'] for r in rows),
            'generation_batches': {'single': 1, 'simple': 3, 'competition': 4},
            'actual_tokens': None, 'actual_monetary_cost': None,
            'actual_per_arm_latency': None,
            'semantic_quality': 'manual non-blind review in docs/pilot-report.md; not automatically validated'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='check saved results without rewriting')
    args = parser.parse_args()
    result = aggregate()
    path = RUN / 'results.json'
    if args.check:
        assert json.loads(path.read_text()) == result, 'saved results differ'
    else:
        path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'validated': True, 'cases': len(result['cases']),
                      'action_key_agreement': result['action_key_agreement'],
                      'competition_action_changes': result['competition_action_changes_from_simple']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
