import { createHash, randomUUID } from 'node:crypto';
import { parse } from '@babel/parser';

export const id = () => randomUUID();
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
export const hash = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(canonical(value))).digest('hex');
export function invariant(condition, message, status = 400) {
  if (!condition) throw Object.assign(new Error(message), { status });
}
export function repoName(value) {
  invariant(typeof value === 'string' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value), 'Use owner/repository.');
  return value;
}
export function safePath(value) {
  invariant(typeof value === 'string' && value.length < 240 && !/[\\:*?"<>|]/.test(value) && [...value].every(c => c.charCodeAt(0) >= 32), 'Invalid repository path.');
  const parts = value.split('/');
  invariant(parts.every(p => p && p !== '.' && p !== '..' && !/[. ]$/.test(p)), 'Invalid repository path.');
  invariant(!parts.some(p => /^\.git$/i.test(p) || /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(p)), 'Protected repository path.');
  invariant(!parts.some(p => /^(\.env(?:\..*)?|\.factory-runtime|node_modules)$/i.test(p) && p !== '.env.example'), 'Secret/runtime path denied.');
  return value;
}
export const textFile = (entry) => entry?.encoding === 'base64' ? null : entry?.content;
export function validateBundle(files) {
  invariant(files && typeof files === 'object' && !Array.isArray(files), 'Invalid file bundle.');
  invariant(Object.keys(files).length <= 3000, 'Repository exceeds 3000-file MVP limit.');
  let bytes = 0;
  for (const [path, entry] of Object.entries(files)) {
    safePath(path);
    invariant(entry && ['utf-8', 'base64'].includes(entry.encoding) && typeof entry.content === 'string', 'Invalid file encoding.');
    bytes += Buffer.byteLength(entry.content);
  }
  invariant(bytes <= 30_000_000, 'Repository exceeds 30 MB MVP limit.');
  return files;
}
export function protectedFile(path) {
  return /(^|\/)(AGENTS\.md|package(-lock)?\.json|.*lock.*|.*config\.[^/]+|Dockerfile|compose\.ya?ml|factory.*\.ps1)$/.test(path)
    || /^(agents|scripts|schemas|\.github)\//.test(path);
}
export const baselineFile = path => /(-snapshots\/|(?:^|\/)(snapshots|__snapshots__|visual-baselines|screenshots)\/)/i.test(path);
export function changedFiles(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(p => JSON.stringify(before[p]) !== JSON.stringify(after[p])).sort();
}
export function validatePlan(plan, baseSha) {
  invariant(plan && typeof plan.title === 'string' && plan.title.length > 0 && plan.title.length <= 200, 'Plan needs a title.');
  invariant(plan.baseSha === baseSha, 'Plan base commit is stale.', 409);
  invariant(['FAST_EXACT', 'FAST', 'STANDARD'].includes(plan.profile), 'Invalid profile.');
  for (const key of ['files', 'infrastructure', 'criteria', 'milestones', 'risks']) invariant(Array.isArray(plan[key]) && plan[key].length <= 100 && plan[key].every(v => typeof v === 'string' && v.length <= 3000), `Plan missing or invalid ${key}.`);
  invariant(plan.reasons === undefined || (Array.isArray(plan.reasons) && plan.reasons.every(v => typeof v === 'string')), 'Invalid classification reasons.');
  invariant(plan.files.length > 0 && plan.files.length <= 100 && plan.criteria.length > 0 && plan.milestones.length > 0, 'Plan needs bounded scope and acceptance criteria.');
  plan.files.forEach(safePath);
  plan.infrastructure.forEach(p => invariant(plan.files.includes(p), 'Infrastructure authorization must name an in-scope file.'));
  invariant(plan.files.every(p => !baselineFile(p)), 'Baseline changes require a separate explicit visual approval; unsupported in MVP.');
  invariant(plan.files.every(p => !protectedFile(p) || plan.infrastructure.includes(p)), 'Protected file lacks exact infrastructure authorization.');
  if (plan.profile === 'FAST') invariant(plan.files.length <= 3 && plan.files.every(p => /\.md$/.test(p) && !protectedFile(p)), 'FAST is limited to small documentation-only changes.');
  return plan;
}
export function validatePatch(before, patch, plan) {
  invariant(patch && typeof patch === 'object' && !Array.isArray(patch), 'Builder must return a file map.');
  const after = structuredClone(before);
  for (const [path, content] of Object.entries(patch)) {
    safePath(path);
    invariant(plan.files.includes(path), `Out-of-scope file: ${path}`);
    invariant(!baselineFile(path), `Protected baseline: ${path}`);
    invariant(!protectedFile(path) || plan.infrastructure.includes(path), `Infrastructure not authorized: ${path}`);
    invariant(typeof content === 'string' && content.length <= 1_000_000, 'Only bounded text file writes are supported.');
    // Existing assertions are immutable in the hosted MVP. Add coverage in new files.
    invariant(!before[path] || !/(^|\/)(tests?|__tests__)\/|\.(spec|test)\.[cm]?[jt]sx?$/.test(path), `Existing tests are protected: ${path}`);
    after[path] = { encoding: 'utf-8', content };
  }
  invariant(changedFiles(before, after).length > 0, 'Builder produced no change.');
  return validateBundle(after);
}

function displayOnlyReplacement(content, oldText, newText) {
  // Parse JSX and require EVERY textual occurrence to be visible text or aria-label.
  let tree;
  try { tree = parse(content, { sourceType: 'unambiguous', plugins: ['jsx', 'typescript'] }); } catch { return false; }
  const allowed = [];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'JSXText') allowed.push([node.start, node.end]);
    if (node.type === 'JSXAttribute' && node.name?.name === 'aria-label' && node.value?.type === 'StringLiteral') allowed.push([node.value.start + 1, node.value.end - 1]);
    for (const v of Object.values(node)) if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v);
  }
  walk(tree);
  let start = 0, found = false;
  while ((start = content.indexOf(oldText, start)) !== -1) {
    found = true;
    if (!allowed.some(([a, b]) => start >= a && start + oldText.length <= b)) return false;
    start += oldText.length;
  }
  if (/[<>{}"'&\r\n]/.test(oldText + newText)) return false;
  return found;
}
export function classify(request, files, baseSha) {
  invariant(typeof request === 'string' && request.trim().length > 0 && request.length <= 12000, 'Request must contain 1–12000 characters.');
  const exact = /^Replace (?:the )?(?:visible )?(?:text|label) "([^"\r\n]+)" with "([^"\r\n]+)"[.]?$/i.exec(request.trim());
  if (exact && exact[1] !== exact[2]) {
    const paths = Object.keys(files).filter(p => textFile(files[p])?.includes(exact[1]));
    if (paths.length && paths.length <= 3 && paths.every(p => /^src\/.+\.[jt]sx$/.test(p) && displayOnlyReplacement(textFile(files[p]), exact[1], exact[2]))) {
      return { title: request, profile: 'FAST_EXACT', baseSha, files: paths, infrastructure: [],
        exact: { oldText: exact[1], newText: exact[2] }, criteria: ['Replace all authorized visible occurrences; retain behavior and layout.'],
        milestones: ['Exact edit, full deterministic regression, protected-file and release checks.'], risks: [],
        reasons: ['Literal copy-only edit verified against JSX syntax and all occurrence files.'] };
    }
  }
  return { profile: 'STANDARD', reasons: ['Scope or behavior needs explicit planning; conservative default.'] };
}
export function applyExact(files, plan) {
  const verified = classify(plan.title, files, plan.baseSha);
  invariant(verified.profile === 'FAST_EXACT' && hash(verified.files) === hash(plan.files) && hash(verified.exact) === hash(plan.exact), 'Exact replacement no longer matches approved scope.');
  return validatePatch(files, Object.fromEntries(plan.files.map(p => [p, textFile(files[p]).replaceAll(plan.exact.oldText, plan.exact.newText)])), plan);
}
export function discover(files, sha) {
  let pkg;
  try { pkg = JSON.parse(textFile(files['package.json']) || '{}'); } catch { pkg = {}; }
  const tests = Object.keys(files).filter(p => /\.(spec|test)\.[cm]?[jt]sx?$/.test(p));
  const supported = Boolean(pkg.scripts?.build && files['package-lock.json'] && (pkg.devDependencies?.['@playwright/test'] || pkg.dependencies?.['@playwright/test']));
  return { sha, supported, stack: pkg.dependencies?.react ? 'React / JavaScript or TypeScript' : 'JavaScript / TypeScript (inferred)',
    commands: [['npm', 'ci'], ['npm', 'run', 'build'], ['npx', '--no-install', 'playwright', 'test']], tests,
    unknowns: [...(!supported ? ['Requires package-lock.json, build script and an installed @playwright/test dependency.'] : []),
      ...(tests.length ? [] : ['No automated test files detected.']), 'Product intent and architecture inferred from repository evidence need owner review.'],
    documents: Object.keys(files).filter(p => /(^README\.md$|^AGENTS\.md$|^docs\/.*\.md$|^changes\/.*\.md$)/.test(p)) };
}
export function context(files, request, documents = []) {
  const terms = request.toLowerCase().match(/[a-z]{4,}/g) || [];
  const ranked = Object.entries(files).filter(([p, f]) => textFile(f) != null && !/lock|\.svg$/.test(p)).map(([p, f]) => ({
    path: p, content: textFile(f), score: (p === 'AGENTS.md' || p === 'package.json' || /^docs\//.test(p) ? 100 : 0) + terms.filter(t => p.toLowerCase().includes(t) || f.content.toLowerCase().includes(t)).length,
  })).sort((a, b) => b.score - a.score);
  let remaining = 45000;
  const selected = [];
  for (const f of ranked) {
    if (remaining <= 0) break;
    const content = f.content.slice(0, Math.min(remaining, 9000)); remaining -= content.length;
    selected.push({ path: f.path, content, truncated: content.length < f.content.length });
  }
  return { documents, files: selected, inventory: Object.keys(files), omitted: ranked.length - selected.length };
}
