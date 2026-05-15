import type { Account, Favorite, IdentityCenter, Prefs, Recent, SsoConfig } from './types';

export type SyncSchema = {
  identityCenters: IdentityCenter[];
  accounts: Account[];
  favorites: Favorite[];
  prefs: Prefs;
  /** Visible row keys in display order. Row key = `${identityCenterId}:${accountId}`. */
  accountOrder: string[];
  /** Hidden row keys in display order. Row key = `${identityCenterId}:${accountId}`. */
  hiddenAccountIds: string[];
};

export type LocalSchema = {
  recents: Recent[];
};

const DEFAULT_PREFS: Prefs = {
  multiSessionVerified: false,
};

const DEFAULT_SYNC: SyncSchema = {
  identityCenters: [],
  accounts: [],
  favorites: [],
  prefs: DEFAULT_PREFS,
  accountOrder: [],
  hiddenAccountIds: [],
};

const DEFAULT_LOCAL: LocalSchema = {
  recents: [],
};

const SYNC_KEYS: (keyof SyncSchema | 'ssoConfig')[] = [
  'identityCenters',
  'ssoConfig',
  'accounts',
  'favorites',
  'prefs',
  'accountOrder',
  'hiddenAccountIds',
];

/** Build a deterministic IdC id from its portal host. Same host always
 *  yields the same id, so re-adding a portal merges into existing rows. */
export function identityCenterIdFromHost(portalHost: string): string {
  try {
    return new URL(portalHost).hostname.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  } catch {
    return portalHost.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  }
}

export function rowKey(identityCenterId: string, accountId: string): string {
  return `${identityCenterId}:${accountId}`;
}

function legacySsoConfigToIdc(cfg: SsoConfig): IdentityCenter {
  const id = identityCenterIdFromHost(cfg.portalHost);
  let name = id;
  try {
    name = new URL(cfg.portalHost).hostname;
  } catch {
    // fall through
  }
  return {
    id,
    name,
    startUrl: cfg.startUrl,
    portalHost: cfg.portalHost,
    region: cfg.region,
  };
}

/** Read raw sync storage and apply legacy-shape migration if needed.
 *  Returns the post-migration schema and the migrated patch (if any) so
 *  callers that want to persist can. Most callers should use `getSync`. */
async function readAndMigrate(): Promise<SyncSchema> {
  const raw = (await chrome.storage.sync.get(SYNC_KEYS)) as Record<string, unknown>;
  const existingIdcs = (raw.identityCenters as IdentityCenter[] | undefined) ?? [];
  const ssoConfig = raw.ssoConfig as SsoConfig | undefined;
  let identityCenters = existingIdcs;
  let accounts = (raw.accounts as Account[] | undefined) ?? [];
  let favorites = (raw.favorites as Favorite[] | undefined) ?? [];
  let accountOrder = (raw.accountOrder as string[] | undefined) ?? [];
  let hiddenAccountIds = (raw.hiddenAccountIds as string[] | undefined) ?? [];
  let migrationPatch: Partial<SyncSchema> | null = null;

  // Legacy → identityCenters[] migration. Triggered when:
  //  - identityCenters is empty (or missing)
  //  - ssoConfig exists (legacy single-portal install)
  // Stamps existing accounts/favorites with the legacy IdC id so they
  // appear in the UI right after update without re-onboarding.
  if (identityCenters.length === 0 && ssoConfig) {
    const idc = legacySsoConfigToIdc(ssoConfig);
    identityCenters = [idc];
    accounts = accounts.map((a) =>
      a.identityCenterId ? a : { ...a, identityCenterId: idc.id },
    );
    favorites = favorites.map((f) =>
      f.identityCenterId ? f : { ...f, identityCenterId: idc.id },
    );
    // accountOrder + hiddenAccountIds previously held bare accountIds. Rewrite
    // to composite row keys so AccountList lookup matches the new scheme.
    accountOrder = accountOrder.map((k) =>
      k.includes(':') ? k : rowKey(idc.id, k),
    );
    hiddenAccountIds = hiddenAccountIds.map((k) =>
      k.includes(':') ? k : rowKey(idc.id, k),
    );
    migrationPatch = {
      identityCenters,
      accounts,
      favorites,
      accountOrder,
      hiddenAccountIds,
    };
  }

  if (migrationPatch) {
    await chrome.storage.sync.set(migrationPatch);
    await chrome.storage.sync.remove('ssoConfig');
  }

  return {
    identityCenters,
    accounts,
    favorites,
    prefs: { ...DEFAULT_PREFS, ...((raw.prefs as Prefs | undefined) ?? {}) },
    accountOrder,
    hiddenAccountIds,
  };
}

export async function getSync(): Promise<SyncSchema> {
  return { ...DEFAULT_SYNC, ...(await readAndMigrate()) };
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
