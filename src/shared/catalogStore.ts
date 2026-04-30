// Catalog runtime store. Bundled JSON ships as bootstrap so the popup
// renders immediately on first install or when offline. The SW fetches the
// canonical copy from GitHub (jsDelivr CDN, raw fallback) on alarm /
// onInstalled / onStartup and writes it to chrome.storage.local. Remote
// always wins — bundled is only used until the first successful fetch lands.
//
// Subscribers (popup React tree) are notified via storage.onChanged so the
// UI re-renders when a fresh catalog arrives mid-session.

import type { Catalog, ServiceCatalogEntry } from './types';
import bundled from '@catalog/services.json';

const STORAGE_KEY = 'catalog';
const FETCHED_AT_KEY = 'catalogFetchedAt';

type Listener = (services: ServiceCatalogEntry[]) => void;

let snapshot: ServiceCatalogEntry[] = (bundled as Catalog).services;
let snapshotVersion: string = (bundled as Catalog).version;
const listeners = new Set<Listener>();
let initPromise: Promise<void> | null = null;

export function getServicesSnapshot(): ServiceCatalogEntry[] {
  return snapshot;
}

export function getCatalogVersion(): string {
  return snapshotVersion;
}

export function subscribeCatalog(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** One-shot init: hydrate from chrome.storage.local. Safe to await many times. */
export function initCatalogStore(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const got = await chrome.storage.local.get(STORAGE_KEY);
      const stored = got[STORAGE_KEY] as Catalog | undefined;
      if (stored && validateCatalog(stored) && shouldPreferStored(stored)) {
        adopt(stored);
      } else if (stored) {
        // Stored remote catalog is older than bundled — drop it so the next
        // chrome.storage.onChanged write doesn't downgrade us either.
        await chrome.storage.local.remove(STORAGE_KEY);
      }
    } catch {
      // ignore — keep bundled snapshot
    }
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[STORAGE_KEY]) return;
      const next = changes[STORAGE_KEY].newValue as Catalog | undefined;
      if (next && validateCatalog(next) && shouldPreferStored(next)) adopt(next);
    });
  })();
  return initPromise;
}

/** Stored catalog wins only if it's newer or has more entries than bundled. */
function shouldPreferStored(stored: Catalog): boolean {
  const b = bundled as Catalog;
  if (stored.services.length > b.services.length) return true;
  if (stored.services.length < b.services.length) return false;
  return stored.version >= b.version;
}

function adopt(c: Catalog): void {
  snapshot = c.services;
  snapshotVersion = c.version;
  for (const l of listeners) l(snapshot);
}

export function validateCatalog(value: unknown): value is Catalog {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.version !== 'string') return false;
  if (!Array.isArray(v.services)) return false;
  for (const entry of v.services) {
    if (!entry || typeof entry !== 'object') return false;
    const e = entry as Record<string, unknown>;
    if (typeof e.id !== 'string' || typeof e.name !== 'string' || typeof e.consolePath !== 'string') {
      return false;
    }
  }
  return true;
}

export const CATALOG_STORAGE_KEY = STORAGE_KEY;
export const CATALOG_FETCHED_AT_KEY = FETCHED_AT_KEY;

export type CatalogStatus = {
  version: string;
  services: number;
  fetchedAt: number | null;
  bundled: boolean;
};

export async function readCatalogStatus(): Promise<CatalogStatus> {
  const got = await chrome.storage.local.get([STORAGE_KEY, FETCHED_AT_KEY]);
  const stored = got[STORAGE_KEY] as Catalog | undefined;
  const fetchedAt = (got[FETCHED_AT_KEY] as number | undefined) ?? null;
  if (stored && validateCatalog(stored)) {
    return { version: stored.version, services: stored.services.length, fetchedAt, bundled: false };
  }
  const b = bundled as Catalog;
  return { version: b.version, services: b.services.length, fetchedAt: null, bundled: true };
}
