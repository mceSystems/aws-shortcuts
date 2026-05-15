/** Per-host bearer cache. Keyed by portal API origin
 *  (e.g. `https://portal.sso.us-east-1.amazonaws.com`).
 *  Multiple Identity Centers may share an origin (same region) — that's fine,
 *  whichever bearer captured most recently wins for that origin. */
export type BearerEntry = {
  token: string;
  capturedAt: number;
};

export type Bearers = Record<string /* portalApiOrigin */, BearerEntry>;

const BEARERS_KEY = 'bearers';
/** Monotonic counter bumped on every `setBearer`. Lets callers (ScanStep,
 *  service-worker captureAndScan) wait for *any* new bearer to land without
 *  caring which origin produced it. */
const BEARER_TICK_KEY = 'bearerTick';

export async function getBearers(): Promise<Bearers> {
  const raw = await chrome.storage.session.get(BEARERS_KEY);
  return ((raw as { bearers?: Bearers }).bearers) ?? {};
}

export async function getBearer(portalApiOrigin: string): Promise<BearerEntry | undefined> {
  const all = await getBearers();
  return all[portalApiOrigin];
}

export async function getBearerTick(): Promise<number> {
  const raw = await chrome.storage.session.get(BEARER_TICK_KEY);
  return ((raw as { bearerTick?: number }).bearerTick) ?? 0;
}

export async function setBearer(token: string, host: string): Promise<void> {
  const all = await getBearers();
  const next: Bearers = {
    ...all,
    [host]: { token, capturedAt: Date.now() },
  };
  const tick = await getBearerTick();
  await chrome.storage.session.set({
    [BEARERS_KEY]: next,
    [BEARER_TICK_KEY]: tick + 1,
  });
}

export type ConsoleSessionInfo = {
  accountId: string;
  roleName: string;
  sessionSubdomain: string;
  region: string;
  tabIds: number[];
  observedAt: number;
};

const SESSIONS_KEY = 'currentSessions';

export async function getConsoleSessions(): Promise<ConsoleSessionInfo[]> {
  const raw = await chrome.storage.session.get(SESSIONS_KEY);
  return ((raw as { currentSessions?: ConsoleSessionInfo[] }).currentSessions) ?? [];
}

export async function setConsoleSessions(next: ConsoleSessionInfo[]): Promise<void> {
  await chrome.storage.session.set({ [SESSIONS_KEY]: next });
}

let sessionMutateChain: Promise<void> = Promise.resolve();

/** Serialized read-modify-write for currentSessions. Multiple tabs may
 * report observations concurrently. */
export function mutateConsoleSessions(
  fn: (cur: ConsoleSessionInfo[]) => ConsoleSessionInfo[],
): Promise<void> {
  const next = sessionMutateChain.then(async () => {
    const cur = await getConsoleSessions();
    const updated = fn(cur);
    if (updated !== cur) await setConsoleSessions(updated);
  });
  sessionMutateChain = next.catch(() => {});
  return next;
}

// ───── live open-tab tracker ───────────────────────────────────────
// Per-tab snapshot of open AWS console tabs. Distinct from
// currentSessions (which is keyed by accountId + sessionSubdomain) —
// the UI needs URL+title per tab to render the Open list.

export type OpenTabInfo = {
  tabId: number;
  windowId: number;
  url: string;
  title: string;
  accountId: string;
  sessionSubdomain: string;
  region: string;
  serviceId: string;
  consolePath: string;
  /** Stable key for matching open vs recent. See dedupeKeyFromConsolePath. */
  dedupeKey: string;
  /** Joined from currentSessions when known; '' until SESSION_OBSERVED arrives. */
  roleName: string;
  observedAt: number;
};

export const OPEN_TABS_KEY = 'openTabs';

export async function getOpenTabs(): Promise<OpenTabInfo[]> {
  const raw = await chrome.storage.session.get(OPEN_TABS_KEY);
  return ((raw as { openTabs?: OpenTabInfo[] }).openTabs) ?? [];
}

export async function setOpenTabs(next: OpenTabInfo[]): Promise<void> {
  await chrome.storage.session.set({ [OPEN_TABS_KEY]: next });
}

let openTabsMutateChain: Promise<void> = Promise.resolve();

export function mutateOpenTabs(
  fn: (cur: OpenTabInfo[]) => OpenTabInfo[],
  opts: { skipSelfHeal?: boolean } = {},
): Promise<void> {
  const next = openTabsMutateChain.then(async () => {
    const cur = await getOpenTabs();
    const updated = fn(cur);
    if (updated === cur) return;
    // Self-heal: every write filters out tabIds Chrome no longer has.
    // MV3 SW occasionally drops `tabs.onRemoved` events; without this,
    // handlers like SESSION_OBSERVED, upsertOpenTab, and harvest would
    // happily write back stale entries that another race had failed to
    // clean up. One cheap chrome.tabs.query per write is the price.
    // Callers that already filtered against a known-live id set (e.g.
    // reconcileOpenTabs) pass `skipSelfHeal` so we don't query twice.
    const reconciled = opts.skipSelfHeal ? updated : await filterToLiveTabs(updated);
    await setOpenTabs(reconciled);
  });
  openTabsMutateChain = next.catch(() => {});
  return next;
}

async function filterToLiveTabs(list: OpenTabInfo[]): Promise<OpenTabInfo[]> {
  if (list.length === 0) return list;
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) return list;
  try {
    const tabs = await chrome.tabs.query({});
    const liveIds = new Set<number>(
      tabs.map((t) => t.id).filter((x): x is number => x != null),
    );
    const cleaned = list.filter((t) => liveIds.has(t.tabId));
    return cleaned.length === list.length ? list : cleaned;
  } catch {
    return list;
  }
}
