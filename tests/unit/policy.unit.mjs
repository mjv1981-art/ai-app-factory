import test from 'node:test';
import assert from 'node:assert/strict';
import { safePath, classify, applyExact, validatePlan, validatePatch, discover, context, hash } from '../../factory/policy.mjs';
import { checkAllowance, usageFrom, totals, defaultLimits } from '../../factory/usage.mjs';
import { encrypt, decrypt, verifyWebhook } from '../../server/auth.mjs';
import { dockerArgs } from '../../worker/sandbox.mjs';
import { previewDocument } from '../../server/preview.mjs';
const file = content => ({ encoding: 'utf-8', content });
const files = { 'src/App.jsx': file('export default () => <h1>Hello world</h1>') };

test('visible exact edits bypass models and retain narrow scope', () => {
  const plan = classify('Replace text "Hello world" with "Welcome aboard"', files, 'abc');
  assert.equal(plan.profile, 'FAST_EXACT');
  assert.equal(applyExact(files, plan)['src/App.jsx'].content, 'export default () => <h1>Welcome aboard</h1>');
  assert.equal(classify('Replace text "Hello world" with "x" and change the layout', files, 'abc').profile, 'STANDARD');
});
test('code, test assertions, markup and mismatched occurrence sets cannot take exact path', () => {
  for (const candidate of [
    { 'src/App.jsx': file('const name="Hello world"; export default () => <h1>{name}</h1>') },
    { ...files, 'tests/home.spec.js': file('expect(text).toBe("Hello world")') },
    { ...files, 'docs/PRODUCT.md': file('Hello world') },
  ]) assert.equal(classify('Replace text "Hello world" with "New text"', candidate, 'abc').profile, 'STANDARD');
  assert.equal(classify('Replace text "Hello world" with "<script>"', files, 'abc').profile, 'STANDARD');
  const plan = classify('Replace text "Hello world" with "New text"', files, 'abc');
  assert.throws(() => applyExact({ ...files, 'src/Other.jsx': file('<p>Hello world</p>') }, plan));
});
test('repository path validation denies traversal, alternate streams, secrets and reserved names', () => {
  for (const value of ['../secret', '/tmp/a', 'a\\b', '.git/config', 'a/.git/config', 'a/../../x', '.env', 'x/CON.txt', 'x:y', 'a//b', 'a./x']) assert.throws(() => safePath(value), value);
  assert.equal(safePath('src/App.tsx'), 'src/App.tsx');
});
test('plan and patch protect exact scope, infrastructure, golden images and existing tests', () => {
  const plan = { title: 'Change', profile: 'STANDARD', baseSha: 'a', files: ['src/App.jsx'], infrastructure: [], criteria: ['works'], milestones: ['implement'], risks: [] };
  validatePlan(plan, 'a');
  assert.throws(() => validatePlan(plan, 'b'));
  assert.throws(() => validatePlan({ ...plan, files: ['package.json'] }, 'a'));
  assert.throws(() => validatePatch(files, { 'src/Other.jsx': 'bad' }, plan));
  assert.throws(() => validatePatch({ 'tests/a.spec.js': file('assert') }, { 'tests/a.spec.js': 'skip' }, { ...plan, files: ['tests/a.spec.js'] }));
  assert.throws(() => validatePlan({ ...plan, files: ['tests/a-snapshots/page.png'] }, 'a'));
});
test('unknown usage is not zero; cached and reasoning counters are not added twice', () => {
  const usage = usageFrom({ usage: { prompt_tokens: 100, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 50 }, completion_tokens_details: { reasoning_tokens: 10 }, cost: 0 } });
  assert.equal(usage.totalTokens, 120); assert.equal(usage.costUsd, 0);
  const unknown = usageFrom({}); assert.equal(unknown.totalTokens, null); assert.equal(unknown.costUsd, null);
  assert.deepEqual(totals([{ ...usage }, { ...unknown, reservedTokens: 500 }]), { reportedTokens: 120, reservedTokens: 500, knownCostUsd: 0, unknownUsage: 1, unknownCost: 1 });
});
test('limits stop before calls including unknown prior usage, cancellation and timeouts', () => {
  const run = { status: 'running', createdAt: new Date().toISOString(), limits: { ...defaultLimits, tokens: 1000 } };
  const entries = [{ reservedTokens: 800, reservedCost: 0, totalTokens: null, costUsd: null }];
  assert.throws(() => checkAllowance(run, entries, 300, 0));
  assert.throws(() => checkAllowance({ ...run, status: 'cancelled' }, [], 1, 0));
  assert.throws(() => checkAllowance(run, [], 1, 1));
  assert.throws(() => checkAllowance(run, [], 1, 0, Date.now() + 3600000));
});
test('session encryption authenticates ciphertext and webhook signatures are mandatory', () => {
  const key = 'a'.repeat(64), encrypted = encrypt('private-token', key);
  assert.equal(decrypt(encrypted, key), 'private-token');
  assert.throws(() => decrypt(encrypted, 'b'.repeat(64)));
  assert.throws(() => verifyWebhook(Buffer.from('{}'), 'forged', 'secret'));
});
test('sandbox has no application secrets, privilege or host networking', () => {
  const args = dockerArgs({ name: 'test', root: '/tmp/test', network: 'none', image: 'factory-build:local', args: ['npm', 'run', 'build'] });
  assert.ok(args.includes('--read-only')); assert.ok(args.includes('--cap-drop=ALL'));
  assert.ok(!args.some(a => /DATABASE_URL|OPENROUTER|GITHUB_TOKEN|privileged/.test(a)));
});
test('baseline reports compatibility and bounded context preserves provenance', () => {
  assert.equal(discover(files, 'abc').supported, false);
  const result = context({ ...files, 'docs/DECISIONS.md': file('Use local state') }, 'state');
  assert.equal(result.files[0].path, 'docs/DECISIONS.md'); assert.ok(result.inventory.includes('src/App.jsx'));
  assert.notEqual(hash({ sha: 'a' }), hash({ sha: 'b' }));
});
test('static preview embeds assets with network-disabled CSP', () => {
  const encode = s => Buffer.from(s).toString('base64');
  const html = previewDocument({ 'dist/index.html': encode('<script type="module" src="/assets/app.js"></script>'), 'dist/assets/app.js': encode('document.body.textContent="Preview";') });
  assert.ok(html.includes('data:text/javascript;base64,')); assert.ok(html.includes("connect-src 'none'"));
});
