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

