import fs from 'node:fs/promises';
import { Pool } from 'pg';
import { invariant, id, hash } from '../factory/policy.mjs';
import { checkAllowance } from '../factory/usage.mjs';
import { failure } from '../factory/recovery.mjs';

export class Store {
  constructor(pool) { this.pool = pool; }
  async migrate() { await this.pool.query(await fs.readFile(new URL('./migrations/001-factory.sql', import.meta.url), 'utf8')); }
  async transaction(fn) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Single-owner MVP: a DB lock serializes accounting and state changes across processes.
      await client.query("SELECT id FROM factory_locks WHERE id = 'transaction' FOR UPDATE");
      const result = await fn(new Store(client));
      await client.query('COMMIT'); return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async get(collection, key, owner) {
    const result = await this.pool.query('SELECT data FROM factory_records WHERE collection=$1 AND id=$2 AND owner=$3', [collection, key, owner]);
    invariant(result.rows.length === 1, 'Record not found.', 404); return result.rows[0].data;
  }
  async list(collection, owner) {
    return (await this.pool.query('SELECT data FROM factory_records WHERE collection=$1 AND owner=$2 ORDER BY updated_at DESC', [collection, owner])).rows.map(r => r.data);
  }
  async put(collection, record, owner) {
    invariant(record.id && owner, 'Record requires identity.');
    if (collection === 'runs') {
      const found = await this.pool.query('SELECT data FROM factory_records WHERE collection=$1 AND id=$2 AND owner=$3', [collection, record.id, owner]);
      const before = found.rows[0]?.data;
      const proof = r => hash({ verification: r?.verification, qa: r?.qa, reviewAttempts: r?.reviewAttempts?.length, pr: r?.pr, failure: r?.failure?.code });
      const changed = !before || ['status', 'stage', 'action', 'recoveryRunId', 'retryRunId'].some(k => before[k] !== record[k]) || proof(before) !== proof(record);
      const events = [...(before?.events || [])];
      if (changed) events.push({ id: id(), at: new Date().toISOString(), stage: record.stage || 'queued', status: record.status, action: record.action,
        fromStage: before?.stage, fromStatus: before?.status, recoveryOf: record.recoveryOf || record.retryOf, followUp: record.recoveryRunId || record.retryRunId,
        failureCode: record.failure?.code, evidence: record.artifacts?.map(a => a.id).slice(0, 20), qa: record.qa?.verdict, review: record.review?.verdict,
        reviewAttempt: record.reviewAttempts?.length });
      record = { ...record, events: events.slice(-160), omittedEvents: (before?.omittedEvents || 0) + Math.max(0, events.length - 160) };
    }
    // Never allow an upsert to overwrite a record belonging to another owner.
    await this.pool.query('INSERT INTO factory_records(collection,id,owner,data) VALUES($1,$2,$3,$4) ON CONFLICT(collection,id) DO UPDATE SET data=EXCLUDED.data,updated_at=now() WHERE factory_records.owner=EXCLUDED.owner', [collection, record.id, owner, JSON.stringify(record)]);
    return this.get(collection, record.id, owner);
  }
  async remove(collection, key, owner) { await this.pool.query('DELETE FROM factory_records WHERE collection=$1 AND id=$2 AND owner=$3', [collection, key, owner]); }
  async saveKnowledge(owner, record) {
    return this.transaction(async tx => {
      const records = (await tx.list('knowledge', owner)).filter(k => k.projectId === record.projectId);
      const prior = records.find(k => k.id === record.projectId);
      if (record.id === record.projectId && prior && prior.sha !== record.sha) await tx.put('knowledge', { ...prior, id: prior.projectId + (prior.status === 'proposed_in_pr' ? ':proposal:' : ':baseline:') + prior.sha, status: prior.status === 'proposed_in_pr' ? prior.status : 'historical_baseline' }, owner);
      await tx.put('knowledge', record, owner);
      const versions = (await tx.list('knowledge', owner)).filter(k => k.projectId === record.projectId && k.id !== record.projectId);
      for (const old of versions.slice(7)) await tx.remove('knowledge', old.id, owner);
      return record;
    });
  }
  async audit(owner, event, details) { await this.put('audit', { id: id(), at: new Date().toISOString(), event, details }, owner); }
  async reserve(owner, runId, stage, tokens, cost, model) {
    return this.transaction(async tx => {
      const run = await tx.get('runs', runId, owner);
      const entries = (await tx.list('usage', owner)).filter(e => e.runId === runId);
      try { checkAllowance(run, entries, tokens, cost, Date.now(), stage); }
      catch (error) { throw failure('ALLOWANCE_EXHAUSTED', error.message, error.status); }
      const entry = { id: id(), runId, projectId: run.projectId, stage, requestedModel: model, provider: 'openrouter',
        status: 'reserved', reservedTokens: tokens, reservedCost: cost, totalTokens: null, costUsd: null, startedAt: new Date().toISOString() };
      await tx.put('usage', entry, owner); return entry;
    });
  }
  async claim(owner, runId) {
    return this.transaction(async tx => {
      const run = await tx.get('runs', runId, owner);
      // An ambiguous/interrupted attempt is never automatically replayed.
      invariant(run.status === 'queued', 'Run is not queued (duplicate or stale delivery).', 409);
      const next = { ...run, status: 'running', workerClaimId: id(), workerFinishedAt: null, claimedAt: new Date().toISOString(), heartbeatAt: new Date().toISOString() };
      await tx.put('runs', next, owner); return next;
    });
  }
  async updateRun(owner, key, patch, workerClaimId) {
    return this.transaction(async tx => {
      const run = await tx.get('runs', key, owner);
      if (workerClaimId !== undefined && run.workerClaimId !== workerClaimId) return run;
      if (run.status === 'cancelled' && patch.status !== 'cancelled') {
        const readOnly = Object.fromEntries(['workerFinishedAt', 'pr', 'prState', 'ci', 'prReadError', 'publicationRead', 'provisionedBaseSha', 'artifacts', 'verification', 'verificationAttempts'].filter(k => k in patch).map(k => [k, patch[k]]));
        if (Object.keys(readOnly).length) return tx.put('runs', { ...run, ...readOnly }, owner);
        return run;
      }
      return tx.put('runs', { ...run, ...patch, updatedAt: new Date().toISOString() }, owner);
    });
  }
}
export async function openStore(url) {
  invariant(url, 'DATABASE_URL must be configured.', 503);
  const store = new Store(new Pool({ connectionString: url, max: 5 }));
  await store.migrate(); return store;
}
