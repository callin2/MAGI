#!/usr/bin/env python3
"""Validate recorded open-ended pilot-002 artifacts. No model invocation or truth scoring."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / 'experiments' / 'pilot-002'
DIMENSIONS = ['grounding', 'value_conflict', 'hypothesis_quality', 'conditional_recommendation',
              'dissent_preservation', 'revision_conditions']


def read(name):
    return json.loads((RUN / name).read_text())


def check_records(records, case_ids, source_ids):
    assert len(records) == len(case_ids), 'wrong record count'
    assert {r['id'] for r in records} == case_ids, 'missing or duplicate cases'
    fields = ['recommendation', 'competing_hypotheses', 'source_ids', 'factual_limits',
              'value_conflict', 'strongest_objection', 'discriminating_observation',
              'would_change_if', 'irreducible_disagreement']
    for record in records:
        assert all(record.get(f) for f in fields), f'missing field: {record["id"]}'
        assert len(record['competing_hypotheses']) >= 2, 'hypotheses missing'
        assert set(record['source_ids']) <= source_ids, 'unknown source reference'


def aggregate():
    for path, expected in read('input-manifest.json')['files'].items():
        assert hashlib.sha256((RUN / path).read_bytes()).hexdigest() == expected, f'input changed: {path}'
    pack = read('evidence-pack.json')
    ids = {c['id'] for c in pack['cases']}
    source_ids = {s['id'] for s in pack['sources']}
    metadata = read('execution-metadata.json')
    for actor in ['a', 'b', 'c', 'neutral', 'coordinator']:
        check_records(read(f'responses/{actor}.json'), ids, source_ids)
        assert hashlib.sha256((RUN / f'responses/{actor}.json').read_bytes()).hexdigest() == metadata['responses_sha256'][actor]
    for row in read('responses/coordinator.json'):
        assert set(row['positions_preserved']) == {'A', 'B', 'C'}
        assert row['corrections'] and row['decision_authority']
    assessment = read('assessment-input.json')
    assert hashlib.sha256((RUN / 'assessment-input.json').read_bytes()).hexdigest() == metadata['assessment_input_sha256']
    mapping = read('assessment-mapping.json')
    assert set(mapping) == set(assessment['candidates'])
    for label, actor in mapping.items():
        expected = read(f'responses/{actor}.json')
        for row in expected:
            row.pop('lens', None)
        assert assessment['candidates'][label] == expected, 'anonymous package differs from source'
    ratings = []
    for judge_id in ['j1', 'j2']:
        assert hashlib.sha256((RUN / f'assessments/{judge_id}.json').read_bytes()).hexdigest() == metadata['assessments_sha256'][judge_id], 'assessment changed'
        judge = read(f'assessments/{judge_id}.json')
        assert judge['evaluator'].lower() == judge_id
        pairs = {(row['candidate'], row['id']) for row in judge['assessments']}
        assert len(judge['assessments']) == 2 * len(ids)
        assert pairs == {(candidate, case_id) for candidate in mapping for case_id in ids}
        for row in judge['assessments']:
            assert set(row['scores']) == set(DIMENSIONS)
            assert all(v is None or (type(v) is int and 0 <= v <= 2) for v in row['scores'].values())
            ratings.append({'judge': judge['evaluator'], 'case': row['id'],
                            'method': mapping[row['candidate']], 'scores': row['scores'],
                            'display_total': sum(v for v in row['scores'].values() if v is not None),
                            'unrated': sum(v is None for v in row['scores'].values())})
    disagreements = []
    for case_id in sorted(ids):
        for actor in ['neutral', 'coordinator']:
            selected = [r for r in ratings if r['case'] == case_id and r['method'] == actor]
            for dimension in DIMENSIONS:
                if selected[0]['scores'][dimension] != selected[1]['scores'][dimension]:
                    disagreements.append({'case': case_id, 'method': actor, 'dimension': dimension,
                                          'scores': [r['scores'][dimension] for r in selected]})
    return {'status': 'descriptive subjective ratings, no answer key, not equal budget',
            'case_count': len(ids), 'ratings': ratings, 'judge_disagreements': disagreements,
            'generation_batches': {'neutral': 1, 'lens_responses': 3, 'coordination': 1, 'judges': 2},
            'actual_token_cost': None, 'real_world_outcomes': 'not observed',
            'semantic_limits': 'See docs/pilot-002-report.md; schema checks do not verify truth or disagreement preservation.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    result = aggregate()
    p = RUN / 'results.json'
    if args.check:
        assert read('results.json') == result, 'stored aggregation mismatch'
    else:
        p.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'validated': True, 'cases': result['case_count'],
                      'rating_records': len(result['ratings']),
                      'judge_disagreement_count': len(result['judge_disagreements'])}))


if __name__ == '__main__':
    main()
