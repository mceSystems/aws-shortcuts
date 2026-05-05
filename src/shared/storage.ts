import type { Account, Favorite, Prefs, Recent, SsoConfig } from './types';

export type SyncSchema = {
  ssoConfig?: SsoConfig;
  accounts: Account[];
  favorites: Favorite[];
  prefs: Prefs;
  /** Visible accountIds in display order. New accounts append. */
  accountOrder: string[];
  /** Hidden accountIds in display order (within the hidden section). */
  hiddenAccountIds: string[];
};

export type LocalSchema = {
  recents: Recent[];
};

const DEFAULT_PREFS: Prefs = {
  uiMode: 'popup',
  multiSessionVerified: false,
};

const DEFAULT_SYNC: SyncSchema = {
  accounts: [],
  favorites: [],
  prefs: DEFAULT_PREFS,
  accountOrder: [],
  hiddenAccountIds: [],
};

const DEFAULT_LOCAL: LocalSchema = {
  recents: [],
};

const SYNC_KEYS: (keyof SyncSchema)[] = [
  'ssoConfig',
  'accounts',
  'favorites',
  'prefs',
  'accountOrder',
  'hiddenAccountIds',
];

export async function getSync(): Promise<SyncSchema> {
  const raw = await chrome.storage.sync.get(SYNC_KEYS);
  return { ...DEFAULT_SYNC, ...(raw as Partial<SyncSchema>) };
}

export async function getSsoConfig(): Promise<SsoConfig | undefined> {
  const raw = await chrome.storage.sync.get('ssoConfig');
  return (raw as { ssoConfig?: SsoConfig }).ssoConfig;
}

export async function setSync(patch: Partial<SyncSchema>): Promise<void> {
  await chrome.storage.sync.set(patch);
}

// Serialized read-modify-write. Prevents racing concurrent observation
// handlers from clobbering each other's writes when multiple tabs report
// at once. Each call waits for the previous mutation to finish.
let mutationChain: Promise<void> = Promise.resolve();

export function mutateSync(
  fn: (state: SyncSchema) => Partial<SyncSchema> | null | Promise<Partial<SyncSchema> | null>,
): Promise<void> {
  const next = mutationChain.then(async () => {
    const cur = await getSync();
    const patch = await fn(cur);
    if (patch) await setSync(patch);
  });
  mutationChain = next.catch(() => {});
  return next;
}

export async function getLocal(): Promise<LocalSchema> {
  const raw = await chrome.storage.local.get(null);
  return { ...DEFAULT_LOCAL, ...(raw as Partial<LocalSchema>) };
}

export async function setLocal(patch: Partial<LocalSchema>): Promise<void> {
  await chrome.storage.local.set(patch);
}

let localMutateChain: Promise<void> = Promise.resolve();

/** Serialized read-modify-write for chrome.storage.local. Multiple events
 *  (e.g. several tabs closing at once) can race otherwise. */
export function mutateLocal(
  fn: (state: LocalSchema) => Partial<LocalSchema> | null | Promise<Partial<LocalSchema> | null>,
): Promise<void> {
  const next = localMutateChain.then(async () => {
    const cur = await getLocal();
    const patch = await fn(cur);
    if (patch) await setLocal(patch);
  });
  localMutateChain = next.catch(() => {});
  return next;
}

// ───── tab-grouping sticky-skip (chrome.storage.local) ─────────────
// Persisted across SW restarts. Tracks {accountId, windowId} pairs the
// user explicitly un-grouped — auto-group must skip these until cleared
// via the manual "Group by account" button.

const STICKY_KEY = 'tabGroupingSticky';
type StickyMap = Record<string, Record<number, true>>;

export async function getStickySkip(): Promise<StickyMap> {
  const out = await chrome.storage.local.get(STICKY_KEY);
  return ((out as { tabGroupingSticky?: StickyMap }).tabGroupingSticky) ?? {};
}

export async function setStickySkip(
  accountId: string,
  windowId: number,
  on: boolean,
): Promise<void> {
  const cur = await getStickySkip();
  const acc = { ...(cur[accountId] ?? {}) };
  if (on) acc[windowId] = true;
  else delete acc[windowId];
  if (Object.keys(acc).length) cur[accountId] = acc;
  else delete cur[accountId];
  await chrome.storage.local.set({ [STICKY_KEY]: cur });
}

export async function clearStickySkip(filter?: { windowId?: number }): Promise<void> {
  if (!filter) {
    await chrome.storage.local.remove(STICKY_KEY);
    return;
  }
  const cur = await getStickySkip();
  let mutated = false;
  for (const accId of Object.keys(cur)) {
    if (filter.windowId != null && cur[accId][filter.windowId]) {
      delete cur[accId][filter.windowId];
      mutated = true;
      if (Object.keys(cur[accId]).length === 0) delete cur[accId];
    }
  }
  if (mutated) await chrome.storage.local.set({ [STICKY_KEY]: cur });
}
