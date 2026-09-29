import { invariant } from './policy.mjs';

export const defaultLimits = Object.freeze({ tokens: 180000, calls: 12, stageTokens: 60000, stageCalls: 3, seconds: 1800, costUsd: 0, maxOutput: 6000 });
export function reservation(messages, limits = defaultLimits) {
  // A UTF-8 byte bound is conservative across tokenizers; actual usage is authoritative.
  return Buffer.byteLength(JSON.stringify(messages)) + limits.maxOutput + 512;
}
export function checkAllowance(run, entries, tokens, costUsd, now = Date.now(), stage) {
  const limits = { ...defaultLimits, ...run.limits };
  invariant(run.status !== 'cancelled', 'Run cancelled.', 409);
  invariant(now - new Date(run.createdAt).getTime() < limits.seconds * 1000, 'Run time allowance exhausted.', 409);
  const used = entries.reduce((n, e) => n + (e.totalTokens ?? e.reservedTokens), 0);
  const spent = entries.reduce((n, e) => n + (e.costUsd ?? e.reservedCost), 0);
  const sameStage = entries.filter(e => e.stage === stage);
  invariant(entries.length < limits.calls && sameStage.length < limits.stageCalls, 'Call allowance exhausted.', 409);
  invariant(tokens <= limits.stageTokens && used + tokens <= limits.tokens && sameStage.reduce((n, e) => n + (e.totalTokens ?? e.reservedTokens), 0) + tokens <= limits.stageTokens, 'Token allowance exhausted.', 409);
  invariant(spent + costUsd <= limits.costUsd, 'Cost allowance exhausted.', 409);
}
export function usageFrom(data) {
  const u = data?.usage;
  const number = v => Number.isFinite(v) && v >= 0 ? v : null;
  const input = number(u?.prompt_tokens), output = number(u?.completion_tokens);
  return { inputTokens: input, outputTokens: output, cachedTokens: number(u?.prompt_tokens_details?.cached_tokens),
    reasoningTokens: number(u?.completion_tokens_details?.reasoning_tokens),
    totalTokens: number(u?.total_tokens) ?? (input !== null && output !== null ? input + output : null),
    costUsd: number(u?.cost), actualModel: data?.model || null, provider: data?.provider || 'openrouter', generationId: data?.id || null };
}
export function totals(entries) {
  return { reportedTokens: entries.reduce((n, e) => n + (e.totalTokens ?? 0), 0),
    reservedTokens: entries.filter(e => e.totalTokens == null).reduce((n, e) => n + e.reservedTokens, 0),
    knownCostUsd: entries.reduce((n, e) => n + (e.costUsd ?? 0), 0),
    unknownUsage: entries.filter(e => e.totalTokens == null).length, unknownCost: entries.filter(e => e.costUsd == null).length };
}
