import type {
  SyncSchema,
  LocalSchema,
  SessionSchema,
  Prefs,
} from './types';

const DEFAULT_PREFS: Prefs = {
  uiMode: 'popup',
  globalDefaultRegion: 'us-east-1',
  multiSessionVerified: false,
};

const DEFAULT_SYNC: SyncSchema = {
  accounts: [],
  favorites: [],
  prefs: DEFAULT_PREFS,
};

const DEFAULT_LOCAL: LocalSchema = {
  serviceCatalog: [],
};

const DEFAULT_SESSION: SessionSchema = {
  sessions: {},
};

export async function getSync(): Promise<SyncSchema> {
  const raw = await chrome.storage.sync.get(null);
  return { ...DEFAULT_SYNC, ...(raw as Partial<SyncSchema>) };
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

export async function getSession(): Promise<SessionSchema> {
  const raw = await chrome.storage.session.get(null);
  return { ...DEFAULT_SESSION, ...(raw as Partial<SessionSchema>) };
}

export async function setSession(patch: Partial<SessionSchema>): Promise<void> {
  await chrome.storage.session.set(patch);
}

export function sessionKey(accountId: string, roleName: string): string {
  return `${accountId}::${roleName}`;
}
