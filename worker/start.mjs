import { configuration } from '../server/config.mjs';
import { openStore } from '../server/store.mjs';
import { GitHub } from '../server/github.mjs';
import { Artifacts } from '../server/artifacts.mjs';
import { OpenRouter } from '../factory/provider.mjs';
import { Sandbox } from './sandbox.mjs';
import { Engine } from './engine.mjs';
import { invariant } from '../factory/policy.mjs';

const config = configuration();
const runId = process.env.FACTORY_RUN_ID;
invariant(/^[a-f0-9-]{36}$/.test(runId || ''), 'FACTORY_RUN_ID must be a run UUID.');
const store = await openStore(config.databaseUrl);
const github = new GitHub(config);
const artifacts = new Artifacts(store, config);
const provider = new OpenRouter({ ...config, store });
const sandbox = new Sandbox(config);
try { await new Engine({ store, github, artifacts, provider, sandbox, owner: config.owner }).execute(runId); }
finally { await store.pool.end(); }
