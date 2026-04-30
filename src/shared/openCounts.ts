// Per-user open counts. Bumped by the SW each time a service or feature is
// launched via RESOLVE_LAUNCH_URL. Read by the popup ranker to bias the
// service search toward the user's actual usage.
//
// Stored in chrome.storage.local. Keys:
//   openCounts: Record<string, number>      // serviceId or `${serviceId}::${featurePath}`
//   lastOpenedAt: Record<string, number>    // ms epoch (for future recency decay)
//
// Service-level counts are tracked separately from feature-level so that
// opening a deep link still bumps the parent service's overall rank.

const COUNTS_KEY = 'openCounts';
const LAST_AT_KEY = 'lastOpenedAt';

export type OpenCountSnapshot = {
  counts: Record<string, number>;
  lastOpenedAt: Record<string, number>;
};

export function featureKey(serviceId: string, featurePath: string): string {
  return `${serviceId}::${featurePath}`;
}

export async function readOpenCounts(): Promise<OpenCountSnapshot> {
  const got = await chrome.storage.local.get([COUNTS_KEY, LAST_AT_KEY]);
  return {
    counts: (got[COUNTS_KEY] as Record<string, number> | undefined) ?? {},
    lastOpenedAt: (got[LAST_AT_KEY] as Record<string, number> | undefined) ?? {},
  };
}

export async function bumpOpenCount(serviceId: string, featurePath?: string): Promise<void> {
  const snap = await readOpenCounts();
  const now = Date.now();
  const incr = (key: string) => {
    snap.counts[key] = (snap.counts[key] ?? 0) + 1;
    snap.lastOpenedAt[key] = now;
  };
  incr(serviceId);
  if (featurePath) incr(featureKey(serviceId, featurePath));
  await chrome.storage.local.set({
    [COUNTS_KEY]: snap.counts,
    [LAST_AT_KEY]: snap.lastOpenedAt,
  });
}

export async function clearOpenCounts(): Promise<void> {
  await chrome.storage.local.remove([COUNTS_KEY, LAST_AT_KEY]);
}

export const OPEN_COUNTS_STORAGE_KEY = COUNTS_KEY;
export const OPEN_LAST_AT_STORAGE_KEY = LAST_AT_KEY;
