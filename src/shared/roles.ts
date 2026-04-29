import type { RoleObservation } from './types';

export function pickRoleSuggestion(
  observed: RoleObservation[] | undefined,
  dismissed: string[] | undefined,
): { roleName: string; hits: number } | undefined {
  if (!observed || observed.length === 0) return undefined;
  const skip = new Set(dismissed ?? []);
  const candidates = observed
    .filter((o) => !skip.has(o.roleName))
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  if (candidates.length === 0) return undefined;
  return { roleName: candidates[0].roleName, hits: candidates[0].hits };
}
