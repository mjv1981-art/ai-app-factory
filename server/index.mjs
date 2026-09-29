import http from 'node:http';
import { configuration } from './config.mjs';
import { openStore } from './store.mjs';
import { GitHub } from './github.mjs';
import { Auth } from './auth.mjs';
import { Artifacts } from './artifacts.mjs';
import { FactoryService } from './service.mjs';
import { createHandler } from './http.mjs';

const config = configuration();
const store = await openStore(config.databaseUrl);
const github = new GitHub(config);
const artifacts = new Artifacts(store, config);
const service = new FactoryService({ store, github, artifacts, owner: config.owner });
const server = http.createServer(createHandler({ service, auth: new Auth(store, config, github), config, store, artifacts }));
server.requestTimeout = 60000;
server.listen(config.port, '0.0.0.0', () => console.log(`Factory listening on ${config.port}`));
