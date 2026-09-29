import test from 'node:test';
import assert from 'node:assert/strict';
import { database } from './support.mjs';
import { id, hash } from '../../factory/policy.mjs';
import { defaultLimits } from '../../factory/usage.mjs';
import { FactoryService } from '../../server/service.mjs';
import { OpenRouter } from '../../factory/provider.mjs';

test('database enforces owner isolation, concurrent reservations and duplicate dispatch claims', async () => {
  const store = await database();
  try {
    const run = { id: id(), projectId: 'p', status: 'queued', createdAt: new Date().toISOString(), limits: { ...defaultLimits, tokens: 1000 } };
    await store.put('runs', run, 'owner');
    await assert.rejects(store.get('runs', run.id, 'other'));
    await assert.rejects(store.put('runs', { ...run, status: 'hijacked' }, 'other'));
    const results = await Promise.allSettled([store.reserve('owner', run.id, 'builder', 700, 0, 'free'), store.reserve('owner', run.id, 'builder', 700, 0, 'free')]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    await store.claim('owner', run.id); await assert.rejects(store.claim('owner', run.id));
    await store.updateRun('owner', run.id, { status: 'cancelled' });
    await store.updateRun('owner', run.id, { status: 'completed' });
    assert.equal((await store.get('runs', run.id, 'owner')).status, 'cancelled');
  } finally { await store.pool.end(); }
});
test('approval is bound to both plan revision and current repository base', async () => {
  const store = await database();
  try {
    let sha = 'a';
    const service = new FactoryService({ store, owner: 'owner', github: { currentSha: async () => sha } });
    const plan = { title: 'Change', baseSha: 'a' }, run = { id: id(), projectId: 'p', kind: 'enhancement', plan, planHash: hash(plan), status: 'awaiting_approval', branch: 'main' };
    await store.put('projects', { id: 'p', repository: 'owner/app' }, 'owner'); await store.put('runs', run, 'owner');
    await assert.rejects(service.approve(run.id, 'wrong'));
    sha = 'b'; await assert.rejects(service.approve(run.id, run.planHash));
    sha = 'a'; await service.approve(run.id, run.planHash);
    assert.equal((await store.get('runs', run.id, 'owner')).approvedHash, run.planHash);
    await assert.rejects(service.approve(run.id, run.planHash));
  } finally { await store.pool.end(); }
});
test('provider failures preserve unknown reservations and never silently retry paid calls', async () => {
  const store = await database();
  try {
    const run = { id: id(), projectId: 'p', status: 'running', createdAt: new Date().toISOString(), limits: defaultLimits };
    await store.put('runs', run, 'owner');
    let calls = 0;
    const provider = new OpenRouter({ store, owner: 'owner', key: 'test', fetcher: async url => {
      if (url.endsWith('/models')) return { ok: true, json: async () => ({ data: [{ id: 'openrouter/free', pricing: { prompt: '0', completion: '0' }, context_length: 200000 }] }) };
      calls++; throw new Error('Network interrupted');
    } });
    await assert.rejects(provider.json(run, 'builder', 'Return JSON', {})); assert.equal(calls, 1);
    const usage = await store.list('usage', 'owner'); assert.equal(usage.length, 1); assert.equal(usage[0].status, 'uncertain'); assert.equal(usage[0].totalTokens, null);
    provider.model = 'paid/model'; await assert.rejects(provider.json(run, 'builder', 'Return JSON', {})); assert.equal(calls, 1);
  } finally { await store.pool.end(); }
});
