import { invariant } from '../factory/policy.mjs';
export function configuration(env = process.env) {
  const origin = env.FACTORY_ORIGIN || 'http://127.0.0.1:3000';
  invariant(/^https?:\/\//.test(origin) && new URL(origin).origin === origin, 'FACTORY_ORIGIN must be an origin without path.');
  if (env.NODE_ENV === 'production') invariant(origin.startsWith('https://'), 'Production requires HTTPS.');
  return { origin, owner: env.FACTORY_OWNER, databaseUrl: env.DATABASE_URL, sessionKey: env.SESSION_ENCRYPTION_KEY,
    port: Number(env.PORT || 3000), appId: env.GITHUB_APP_ID, privateKey: env.GITHUB_APP_PRIVATE_KEY,
    clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET, webhookSecret: env.GITHUB_WEBHOOK_SECRET,
    creationToken: env.GITHUB_REPOSITORY_CREATION_TOKEN, runnerRepository: env.FACTORY_RUNNER_REPOSITORY,
    model: env.OPENROUTER_MODEL || 'openrouter/free', key: env.OPENROUTER_API_KEY,
    image: env.FACTORY_BUILD_IMAGE, network: env.FACTORY_BUILD_NETWORK,
    bucket: env.ARTIFACT_BUCKET, endpoint: env.ARTIFACT_ENDPOINT, region: env.ARTIFACT_REGION,
    accessKey: env.ARTIFACT_ACCESS_KEY, secretKey: env.ARTIFACT_SECRET_KEY };
}
export function readiness(config) {
  return { authentication: Boolean(config.owner && config.clientId && config.clientSecret && config.sessionKey),
    github: Boolean(config.appId && config.privateKey), database: Boolean(config.databaseUrl),
    models: Boolean(config.key), runner: Boolean(config.runnerRepository), artifacts: config.bucket ? 'private object storage' : 'bounded PostgreSQL pilot storage',
    paidModels: false, deployment: 'Requires live hosted acceptance before operational use' };
}
