import { PGlite } from '@electric-sql/pglite';
import { Store } from '../../server/store.mjs';

// Real PostgreSQL semantics in-process for deterministic tests; not a hosted DB claim.
export async function database() {
  const db = new PGlite();
  let tail = Promise.resolve();
  const pool = {
    query: (sql, args) => db.query(sql, args),
    connect: async () => {
      let release;
      const previous = tail; tail = new Promise(r => { release = r }); await previous;
      return { query: (sql, args) => db.query(sql, args), release };
    },
    end: () => db.close(),
  };
  // PGlite exec accepts multi-statement migrations; pg Pool.query does so natively.
  const store = new Store(pool);
  const { readFile } = await import('node:fs/promises');
  await db.exec(await readFile(new URL('../../server/migrations/001-factory.sql', import.meta.url), 'utf8'));
  return store;
}
