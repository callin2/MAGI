import test from 'node:test';import assert from 'node:assert/strict';import {aggregate} from './solution.mjs';
test("empty",async()=>assert.deepEqual(await aggregate({"window_ms": 10, "lateness_ms": 0, "records": []}),{"watermark": null, "windows": []}));
test("simple",async()=>assert.deepEqual(await aggregate({"window_ms": 10, "lateness_ms": 0, "records": [{"kind": "upsert", "id": "a", "rev": 1, "key": "x", "event_time": 1, "amount": 3}]}),{"watermark": null, "windows": [{"key": "x", "start": 0, "end": 10, "total": 3, "count": 1, "final": false}]}));
