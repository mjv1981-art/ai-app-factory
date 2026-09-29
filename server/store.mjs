import fs from 'node:fs/promises';
import { Pool } from 'pg';
import { invariant, id } from '../factory/policy.mjs';
import { checkAllowance } from '../factory/usage.mjs';

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
    // Never allow an upsert to overwrite a record belonging to another owner.
    await this.pool.query('INSERT INTO factory_records(collection,id,owner,data) VALUES($1,$2,$3,$4) ON CONFLICT(collection,id) DO UPDATE SET data=EXCLUDED.data,updated_at=now() WHERE factory_records.owner=EXCLUDED.owner', [collection, record.id, owner, JSON.stringify(record)]);
    return this.get(collection, record.id, owner);
  }
  async remove(collection, key, owner) { await this.pool.query('DELETE FROM factory_records WHERE collection=$1 AND id=$2 AND owner=$3', [collection, key, owner]); }
  async audit(owner, event, details) { await this.put('audit', { id: id(), at: new Date().toISOString(), event, details }, owner); }
  async reserve(owner, runId, stage, tokens, cost, model) {
    return this.transaction(async tx => {
      const run = await tx.get('runs', runId, owner);
      const entries = (await tx.list('usage', owner)).filter(e => e.runId === runId);
      checkAllowance(run, entries, tokens, cost, Date.now(), stage);
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
      const next = { ...run, status: 'running', claimedAt: new Date().toISOString(), heartbeatAt: new Date().toISOString() };
      await tx.put('runs', next, owner); return next;
    });
  }
  async updateRun(owner, key, patch) {
    return this.transaction(async tx => {
      const run = await tx.get('runs', key, owner);
      if (run.status === 'cancelled' && patch.status !== 'cancelled') return run;
      return tx.put('runs', { ...run, ...patch, updatedAt: new Date().toISOString() }, owner);
    });
  }
}
export async function openStore(url) {
  invariant(url, 'DATABASE_URL must be configured.', 503);
  const store = new Store(new Pool({ connectionString: url, max: 5 }));
  await store.migrate(); return store;
}
