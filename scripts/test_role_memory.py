"""Failure-oriented contract tests for #17; every operation starts a new process."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).with_name('role_memory.py')


class MemoryContract(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = str(Path(self.tmp.name) / 'state.sqlite')
        for state, role, project in [('r', 'R', 'p'), ('s', 'S', 'p'), ('x', 'R', 'q')]:
            self.call(op='state', id=state, role_id=role, role_version=1,
                      project=project, purpose='test', criteria='test')
            self.call(op='bind', id=state, agent_id=state, state_id=state, role_version=1, role_id=role, project=project)

    def tearDown(self):
        self.tmp.cleanup()

    def call(self, fails=False, **request):
        result = subprocess.run([sys.executable, str(SCRIPT), self.db],
                                input=json.dumps(request), text=True, capture_output=True)
        self.assertEqual(result.returncode, int(fails), result.stdout + result.stderr)
        return json.loads(result.stdout)

    def lesson(self, key='l', scope='role', kind='technical', rule='query first'):
        self.call(op='event', binding_id='r', scope=scope,
                  event={'id': key, 'observation': 'correction and test output'})
        lesson = dict(id=key, source_id=key, fact='failure', hypothesis='missing query',
                      rule=rule, conditions={'system': 'test'}, falsifier='query stale',
                      kind=kind, scope=scope, conflict_key='order')
        self.call(op='candidate', binding_id='r', lesson=lesson)
        return lesson

    def activate(self, key='l', fails=False):
        return self.call(fails=fails, op='activate', binding_id='r', lesson_id=key,
                         validation={'lesson_id': key, 'reference': 'test-fixture', 'tests': [
                             {'passed': True, 'case': 'replay'},
                             {'passed': True, 'case': 'different-context', 'counterexample': True}]})

    def query(self, binding='r', **extra):
        return self.call(op='query', binding_id=binding, state_id=binding,
                         context=extra.pop('context', {'system': 'test'}), task_id='new-task',
                         session_id='new-session', run_id='fresh-process', **extra)['receipt']

    def test_fresh_process_and_new_agent_inherit_role_but_not_private(self):
        self.lesson(); self.activate()
        self.lesson('secret', scope='private'); self.activate('secret')
        self.call(op='bind', id='r2', agent_id='new-agent', state_id='r', role_version=1, role_id='R', project='p')
        receipt = self.call(op='query', binding_id='r2', state_id='r', context={'system': 'test'},
                            task_id='t2', session_id='s2', run_id='r2')['receipt']
        self.assertEqual([x['id'] for x in receipt['knowledge']], ['l'])
        self.assertEqual(receipt['agent_id'], 'new-agent')
        self.assertEqual(len(self.query(mode='log')['knowledge']), 2)
        self.assertEqual(self.query(exclude_ids=['l', 'secret'])['knowledge'], [])
        self.call(fails=True, op='revoke', binding_id='r2', lesson_id='l', reason='not owner')
        self.call(fails=True, op='grant', binding_id='r2', lesson_id='l', target_state='s')

    def test_candidates_values_and_insufficient_evidence_not_applied(self):
        self.lesson()
        self.assertEqual(self.query()['knowledge'], [])
        self.call(fails=True, op='activate', binding_id='r', lesson_id='l',
                  validation={'lesson_id': 'l', 'reference': 'praise',
                              'tests': [{'passed': True}]})
        self.lesson('value', kind='value'); self.activate('value', fails=True)
        self.assertEqual(self.query()['knowledge'], [])

    def test_scope_grants_and_revocation(self):
        self.lesson(); self.activate()
        self.assertEqual(self.query('s')['knowledge'], [])
        self.call(fails=True, op='grant', binding_id='r', lesson_id='l', target_state='x')
        self.call(op='grant', binding_id='r', lesson_id='l', target_state='s')
        receipt = self.query('s')
        self.assertEqual(len(receipt['knowledge']), 1)
        self.call(fails=True, op='revoke', binding_id='s', lesson_id='l', reason='not owner')
        self.call(op='ungrant', binding_id='r', lesson_id='l', target_state='s')
        self.assertEqual(self.query('s')['knowledge'], [])
        self.assertEqual(len(self.query()['knowledge']), 1)
        self.call(op='revoke', binding_id='r', lesson_id='l', reason='counterexample')
        self.assertEqual(self.query()['knowledge'], [])
        self.call(fails=True, op='apply', binding_id='s', receipt_id=receipt['id'],
                  used_ids=['l'], output_ref='answer.json')

    def test_stale_receipt_context_change_and_unbinding(self):
        self.lesson(); self.activate()
        self.assertEqual(self.query(context={'system': 'other'})['knowledge'], [])
        receipt = self.query()
        self.call(op='apply', binding_id='r', receipt_id=receipt['id'],
                  used_ids=['l'], output_ref='answer.json')
        receipt = self.query()
        self.call(op='unbind', binding_id='r')
        self.call(fails=True, op='apply', binding_id='r', receipt_id=receipt['id'],
                  used_ids=['l'], output_ref='answer.json')
        self.call(fails=True, op='bind', id='r3', agent_id='r', state_id='r', role_version=2, role_id='R', project='p')

    def test_replacement_version_requires_new_grant_and_audit_snapshots(self):
        self.lesson(); self.activate()
        self.call(fails=True, op='bind', id='wrong', agent_id='s', state_id='r',
                  role_version=1, role_id='S', project='p')
        self.call(op='grant', binding_id='r', lesson_id='l', target_state='s')
        self.call(op='revoke', binding_id='r', lesson_id='l', reason='new evidence')
        new = dict(id='l2', source_id='l', fact='new', hypothesis='changed', rule='inspect first',
                   conditions={'system': 'test'}, falsifier='not test', kind='technical',
                   scope='role', conflict_key='order', replaces_id='l')
        self.call(op='candidate', binding_id='r', lesson=new); self.activate('l2')
        self.assertEqual(self.query('s')['knowledge'], [])
        self.assertEqual(self.query()['knowledge'][0]['version'], 2)
        import sqlite3
        db = sqlite3.connect(self.db)
        histories = [json.loads(row[0]) for row in db.execute('SELECT payload FROM history')]
        revoke = next(x for x in histories if x['request']['op'] == 'revoke')
        self.assertEqual(revoke['changes'][0]['before']['status'], 'active')
        self.assertEqual(revoke['changes'][0]['after']['status'], 'revoked')
        db.close()

    def test_conflict_held_instead_of_latest_wins(self):
        self.lesson(); self.activate()
        self.lesson('opposite', rule='skip query'); self.activate('opposite')
        receipt = self.query()
        self.assertEqual(receipt['knowledge'], [])
        self.assertEqual(set(receipt['conflicts']), {'l', 'opposite'})

    def test_no_cross_state_receipt_or_private_source_expansion(self):
        self.lesson(scope='private'); self.activate()
        self.call(fails=True, op='grant', binding_id='r', lesson_id='l', target_state='s')
        self.call(fails=True, op='candidate', binding_id='s', lesson=dict(
            id='stolen', source_id='l', fact='fact', hypothesis='cause', rule='rule',
            conditions={'system': 'test'}, falsifier='counter', kind='technical',
            scope='role', conflict_key='test'))
        receipt = self.query()
        self.call(fails=True, op='apply', binding_id='s', receipt_id=receipt['id'],
                  used_ids=['l'], output_ref='answer.json')


if __name__ == '__main__':
    unittest.main()
