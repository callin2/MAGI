#!/usr/bin/env python3
"""Small SQLite/JSON adapter for #17; not an agent framework or OS sandbox.

One operation per fresh process: python3 scripts/role_memory.py DB < request.json
Model reflection and validation evidence are external, not invented here.
"""
import hashlib
import json
import sqlite3
import sys
from datetime import datetime, timezone
from uuid import uuid4


def now():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def encoded(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


class Store:
    def __init__(self, path):
        self.changes = []
        self.db = sqlite3.connect(path, timeout=10)
        self.db.executescript('''
          CREATE TABLE IF NOT EXISTS items(kind TEXT, id TEXT, data TEXT,
            PRIMARY KEY(kind,id));
          CREATE TABLE IF NOT EXISTS meta(id INTEGER PRIMARY KEY, rev INTEGER);
          INSERT OR IGNORE INTO meta VALUES(1,0);
          CREATE TABLE IF NOT EXISTS history(seq INTEGER PRIMARY KEY,
            at TEXT, operation TEXT, payload TEXT);
        ''')

    def get(self, kind, key):
        row = self.db.execute('SELECT data FROM items WHERE kind=? AND id=?',
                              (kind, key)).fetchone()
        if not row:
            raise ValueError(f'unknown {kind}: {key}')
        return json.loads(row[0])

    def all(self, kind):
        return [json.loads(r[0]) for r in self.db.execute(
            'SELECT data FROM items WHERE kind=? ORDER BY id', (kind,))]

    def put(self, kind, key, value, create=False):
        row = self.db.execute('SELECT data FROM items WHERE kind=? AND id=?', (kind, key)).fetchone()
        before = json.loads(row[0]) if row else None
        verb = 'INSERT' if create else 'INSERT OR REPLACE'
        self.db.execute(f'{verb} INTO items VALUES(?,?,?)', (kind, key, encoded(value)))
        self.changes.append({'kind': kind, 'id': key, 'before': before, 'after': value.copy()})

    def rev(self):
        return self.db.execute('SELECT rev FROM meta WHERE id=1').fetchone()[0]

    def actor(self, request):
        binding = self.get('binding', request['binding_id'])
        state = self.get('state', binding['state_id'])
        if not binding['active'] or not state['active']:
            raise ValueError('inactive binding/state')
        if request.get('state_id', state['id']) != state['id']:
            raise ValueError('state mismatch')
        if binding['role_version'] != state['role_version']:
            raise ValueError('role version mismatch')
        if binding['role_id'] != state['role_id'] or binding['project'] != state['project']:
            raise ValueError('role/project mismatch')
        return binding, state

    def owner(self, request, lesson):
        binding, state = self.actor(request)
        if lesson['state_id'] != state['id']:
            raise ValueError('not owner state')
        if lesson['owner'] != binding['agent_id']:
            raise ValueError('not lesson owner')
        return binding, state

    def operate(self, r):
        op = r['op']
        self.changes = []
        self.db.execute('BEGIN IMMEDIATE')
        try:
            result, changed = self._operate(r)
            if changed:
                self.db.execute('UPDATE meta SET rev=rev+1 WHERE id=1')
                self.db.execute('INSERT INTO history(at,operation,payload) VALUES(?,?,?)',
                                (now(), op, encoded({'request': r, 'changes': self.changes})))
            result['revision'] = self.rev()
            self.db.commit()
            return result
        except Exception:
            self.db.rollback()
            raise

    def _operate(self, r):
        op = r['op']
        if op == 'state':
            required = ('id', 'role_id', 'role_version', 'project', 'purpose', 'criteria')
            state = {key: r[key] for key in required}
            state['active'] = True
            self.put('state', state['id'], state, create=True)
            return {'state': state}, True
        if op == 'bind':
            state = self.get('state', r['state_id'])
            if (not state['active'] or r['role_version'] != state['role_version']
                    or r['role_id'] != state['role_id'] or r['project'] != state['project']):
                raise ValueError('state/role unavailable')
            binding = {key: r[key] for key in ('id', 'agent_id', 'state_id', 'role_version', 'role_id', 'project')}
            binding['active'] = True
            self.put('binding', binding['id'], binding, create=True)
            return {'binding': binding}, True
        if op == 'unbind':
            binding, _ = self.actor(r)
            binding['active'] = False
            self.put('binding', binding['id'], binding)
            return {'unbound': binding['id']}, True
        if op == 'event':
            binding, state = self.actor(r)
            if r['scope'] not in ('private', 'role'):
                raise ValueError('invalid scope')
            event = dict(r['event'], state_id=state['id'], owner=binding['agent_id'],
                         scope=r['scope'])
            if not event.get('id') or not event.get('observation'):
                raise ValueError('event requires observation')
            self.put('event', event['id'], event, create=True)
            return {'event_id': event['id']}, True
        if op == 'candidate':
            binding, state = self.actor(r)
            candidate = r['lesson'].copy()
            required = ('id', 'source_id', 'fact', 'hypothesis', 'rule', 'conditions',
                        'falsifier', 'kind', 'scope', 'conflict_key')
            if any(not candidate.get(key) for key in required):
                raise ValueError('missing candidate field')
            event = self.get('event', candidate['source_id'])
            if event['state_id'] != state['id']:
                raise ValueError('source state mismatch')
            if event['scope'] == 'private' and (event['owner'] != binding['agent_id']
                                               or candidate['scope'] != 'private'):
                raise ValueError('private source cannot expand')
            if candidate['scope'] not in ('private', 'role'):
                raise ValueError('invalid scope')
            if candidate['kind'] not in ('technical', 'value'):
                raise ValueError('invalid kind')
            version = 1
            if candidate.get('replaces_id'):
                prior = self.get('lesson', candidate['replaces_id'])
                self.owner(r, prior)
                if prior['status'] != 'revoked' or prior['conflict_key'] != candidate['conflict_key']:
                    raise ValueError('replacement requires revoked matching prior')
                version = prior['version'] + 1
            candidate.update(state_id=state['id'], owner=binding['agent_id'],
                             version=version, status='candidate', grants=[])
            self.put('lesson', candidate['id'], candidate, create=True)
            return {'candidate_id': candidate['id']}, True
        if op in ('activate', 'hold', 'reject', 'revoke', 'grant', 'ungrant'):
            lesson = self.get('lesson', r['lesson_id'])
            _, source = self.owner(r, lesson)
            if op == 'activate':
                checks = r['validation']
                if lesson['status'] not in ('candidate', 'held'):
                    raise ValueError('invalid activation transition')
                if lesson['kind'] != 'technical':
                    raise ValueError('new value decision held for human')
                if checks.get('lesson_id') != lesson['id'] or not checks.get('reference'):
                    raise ValueError('validation identity/reference missing')
                tests = checks.get('tests', [])
                if len(tests) < 2 or not all(t.get('passed') is True for t in tests):
                    raise ValueError('insufficient validation')
                if not any(t.get('counterexample') is True for t in tests):
                    raise ValueError('counterexample check missing')
                lesson.update(status='active', validation=checks)
            elif op in ('hold', 'reject', 'revoke'):
                if not r.get('reason'):
                    raise ValueError('reason required')
                if op == 'revoke' and lesson['status'] != 'active':
                    raise ValueError('can only revoke active lesson')
                if op != 'revoke' and lesson['status'] not in ('candidate', 'held'):
                    raise ValueError('invalid candidate transition')
                lesson.update(status={'hold': 'held', 'reject': 'rejected',
                                      'revoke': 'revoked'}[op], reason=r['reason'])
            else:
                target = self.get('state', r['target_state'])
                if target['project'] != source['project'] or not target['active']:
                    raise ValueError('cross-project/inactive grant refused')
                if lesson['scope'] != 'role' or lesson['status'] != 'active':
                    raise ValueError('only active role lesson can share')
                grant = {'state_id': r['target_state'], 'version': lesson['version']}
                if op == 'grant' and grant not in lesson['grants']:
                    lesson['grants'].append(grant)
                if op == 'ungrant':
                    lesson['grants'] = [x for x in lesson['grants'] if x['state_id'] != r['target_state']]
            self.put('lesson', lesson['id'], lesson)
            return {'lesson_id': lesson['id'], 'status': lesson['status']}, True
        if op == 'query':
            binding, state = self.actor(r)
            context = r['context']
            lessons = []
            for lesson in self.all('lesson'):
                local = lesson['state_id'] == state['id']
                visible = local or any(g['state_id'] == state['id'] and g['version'] == lesson['version']
                                       for g in lesson['grants'])
                if lesson['scope'] == 'private':
                    visible = local and lesson['owner'] == binding['agent_id']
                if lesson['status'] != 'active' or not visible:
                    continue
                if all(context.get(k) == v for k, v in lesson['conditions'].items()):
                    lessons.append(lesson)
            conflicts = []
            for key in {x['conflict_key'] for x in lessons}:
                group = [x for x in lessons if x['conflict_key'] == key]
                if len({x['rule'] for x in group}) > 1:
                    conflicts.extend(x['id'] for x in group)
            lessons = [x for x in lessons if x['id'] not in conflicts
                       and x['id'] not in r.get('exclude_ids', [])]
            mode = r.get('mode', 'lesson')
            if mode not in ('none', 'log', 'lesson'):
                raise ValueError('invalid mode')
            events = [e for e in self.all('event') if e['state_id'] == state['id']
                      and (e['scope'] == 'role' or e['owner'] == binding['agent_id'])]
            knowledge = lessons if mode == 'lesson' else events if mode == 'log' else []
            receipt = dict(id=str(uuid4()), at=now(), binding_id=binding['id'],
                           agent_id=binding['agent_id'], role_id=state['role_id'],
                           role_version=state['role_version'], state_id=state['id'],
                           revision=self.rev(), task_id=r['task_id'],
                           session_id=r['session_id'], run_id=r['run_id'], mode=mode,
                           context=context, knowledge=knowledge, conflicts=conflicts,
                           excluded_ids=r.get('exclude_ids', []))
            receipt['input_sha256'] = hashlib.sha256(encoded(knowledge).encode()).hexdigest()
            self.put('receipt', receipt['id'], receipt, create=True)
            return {'receipt': receipt}, False
        if op == 'apply':
            receipt = self.get('receipt', r['receipt_id'])
            binding, _ = self.actor({'binding_id': receipt['binding_id']})
            if binding['id'] != r['binding_id']:
                raise ValueError('receipt binding mismatch')
            if receipt['revision'] != self.rev():
                raise ValueError('stale receipt: requery in a clean run')
            available = {x['id'] for x in receipt['knowledge']}
            if not set(r['used_ids']).issubset(available):
                raise ValueError('unknown application id')
            application = dict(r, at=now(), evidence_class='model-output-not-causal-proof')
            if not r.get('output_ref'):
                raise ValueError('output evidence required')
            self.put('application', receipt['id'], application, create=True)
            return {'applied_receipt': receipt['id']}, False
        raise ValueError(f'unknown operation: {op}')


def main():
    try:
        result = Store(sys.argv[1]).operate(json.load(sys.stdin))
        print(encoded(result))
    except (ValueError, KeyError, sqlite3.Error) as exc:
        print(encoded({'error': str(exc)}))
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
