// Runtime icon cache. Service catalog ships an `iconUrl` (public CDN) per
// service; the SW fetches each one after a catalog refresh and stores the
// bytes as a data URL in chrome.storage.local under ICON_CACHE_KEY. The
// panel reads this map at boot and on storage.onChanged.
//
// Format: { [serviceId]: { url: string; dataUrl: string; bytes: number } }
//   url     — source we fetched from. Used to decide whether to re-fetch
//             when the catalog updates the iconUrl for a service.
//   dataUrl — `data:image/png;base64,...` (or whichever MIME the source
//             served). Suitable for direct <img src=...>.
//   bytes   — raw byte count of the fetched payload, for size diagnostics.

export const ICON_CACHE_KEY = 'iconCache';

export type IconCacheEntry = {
  url: string;
  dataUrl: string;
  bytes: number;
};

export type IconCache = Record<string, IconCacheEntry>;

let snapshot: IconCache = {};
const listeners = new Set<(cache: IconCache) => void>();
let initPromise: Promise<void> | null = null;

export function getIconCacheSnapshot(): IconCache {
  return snapshot;
}

export function getCachedIconUrl(id: string): string | undefined {
  return snapshot[id]?.dataUrl;
}

export function subscribeIconCache(listener: (cache: IconCache) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function initIconCacheStore(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const got = await chrome.storage.local.get(ICON_CACHE_KEY);
      const stored = got[ICON_CACHE_KEY] as IconCache | undefined;
      if (stored && typeof stored === 'object') {
        snapshot = stored;
      }
    } catch {
      // ignore — empty cache is fine
    }
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[ICON_CACHE_KEY]) return;
      const next = changes[ICON_CACHE_KEY].newValue as IconCache | undefined;
      snapshot = next && typeof next === 'object' ? next : {};
      for (const l of listeners) l(snapshot);
    });
  })();
  return initPromise;
}
