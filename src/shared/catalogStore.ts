// Catalog runtime store. Bundled JSON ships as bootstrap so the panel renders
// immediately on first install or when offline. The SW fetches the canonical
// copies (services.json + icons.json) from GitHub via jsDelivr → raw fallback,
// writes both to chrome.storage.local in a single transaction. Remote always
// wins after the first successful fetch; bundled is only the boot snapshot.

import type { Catalog, ServiceCatalogEntry } from './types';
import bundled from '@catalog/services.json';
import { ICONS_STORAGE_KEY } from './iconStore';

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

export function initCatalogStore(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const got = await chrome.storage.local.get(STORAGE_KEY);
      const stored = got[STORAGE_KEY] as Catalog | undefined;
      if (stored && validateCatalog(stored) && shouldPreferStored(stored)) {
        adopt(stored);
      } else if (stored) {
        await chrome.storage.local.remove(STORAGE_KEY);
      }
    } catch {
      // keep bundled snapshot
    }
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[STORAGE_KEY]) return;
      const next = changes[STORAGE_KEY].newValue as Catalog | undefined;
      if (next && validateCatalog(next) && shouldPreferStored(next)) adopt(next);
    });
  })();
  return initPromise;
}

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
  features: number;
  icons: number;
  fetchedAt: number | null;
  bundled: boolean;
};

function countFeatures(c: Catalog): number {
  let n = 0;
  for (const s of c.services) n += s.features?.length ?? 0;
  return n;
}

export async function readCatalogStatus(): Promise<CatalogStatus> {
  const got = await chrome.storage.local.get([STORAGE_KEY, FETCHED_AT_KEY, ICONS_STORAGE_KEY]);
  const stored = got[STORAGE_KEY] as Catalog | undefined;
  const fetchedAt = (got[FETCHED_AT_KEY] as number | undefined) ?? null;
  const icons = got[ICONS_STORAGE_KEY] as Record<string, string> | undefined;
  const iconCount = icons ? Object.keys(icons).length : 0;
  if (stored && validateCatalog(stored)) {
    return {
      version: stored.version,
      services: stored.services.length,
      features: countFeatures(stored),
      icons: iconCount,
      fetchedAt,
      bundled: false,
    };
  }
  const b = bundled as Catalog;
  return {
    version: b.version,
    services: b.services.length,
    features: countFeatures(b),
    icons: iconCount,
    fetchedAt: null,
    bundled: true,
  };
}
