import test from 'node:test';import assert from 'node:assert/strict';import {sessions} from './solution.mjs';
test("empty",async()=>assert.deepEqual(await sessions({"gap_ms": 10, "lateness_ms": 0, "records": []}),{"watermark": null, "sessions": []}));
test("simple",async()=>assert.deepEqual(await sessions({"gap_ms": 10, "lateness_ms": 0, "records": [{"kind": "upsert", "id": "a", "rev": 1, "key": "x", "event_time": 0, "amount": 1}]}),{"watermark": null, "sessions": [{"key": "x", "start": 0, "end": 10, "total": 1, "count": 1, "ids": ["a"], "final": false}]}));
