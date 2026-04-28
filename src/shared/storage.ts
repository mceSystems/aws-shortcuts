import type { Account, Favorite, Prefs, Recent, SsoConfig } from './types';

export type SyncSchema = {
  ssoConfig?: SsoConfig;
  accounts: Account[];
  favorites: Favorite[];
  prefs: Prefs;
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
};

const DEFAULT_LOCAL: LocalSchema = {
  recents: [],
};

const SYNC_KEYS: (keyof SyncSchema)[] = ['ssoConfig', 'accounts', 'favorites', 'prefs'];

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

export async function getLocal(): Promise<LocalSchema> {
  const raw = await chrome.storage.local.get(null);
  return { ...DEFAULT_LOCAL, ...(raw as Partial<LocalSchema>) };
}

export async function setLocal(patch: Partial<LocalSchema>): Promise<void> {
  await chrome.storage.local.set(patch);
}
