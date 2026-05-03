// Runtime icon store. Catalog ships a sibling `icons.json` payload mapping
// service id → base64 data URL. The SW fetches it alongside services.json on
// every catalog refresh and writes to chrome.storage.local. Bundled fallback
// guarantees offline first-install icons.

import iconsBundled from '@catalog/icons.json';

export const ICONS_STORAGE_KEY = 'icons';

export type IconsMap = Record<string, string>;

let snapshot: IconsMap = iconsBundled as IconsMap;
const listeners = new Set<(icons: IconsMap) => void>();
let initPromise: Promise<void> | null = null;

export function getIcon(id: string): string | undefined {
  return snapshot[id];
}

export function getIconsSnapshot(): IconsMap {
  return snapshot;
}

export function subscribeIcons(listener: (icons: IconsMap) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function initIconStore(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const got = await chrome.storage.local.get(ICONS_STORAGE_KEY);
      const stored = got[ICONS_STORAGE_KEY] as IconsMap | undefined;
      if (stored && validateIcons(stored) && shouldPreferStored(stored)) {
        adopt(stored);
      } else if (stored) {
        await chrome.storage.local.remove(ICONS_STORAGE_KEY);
      }
    } catch {
      // keep bundled snapshot
    }
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[ICONS_STORAGE_KEY]) return;
      const next = changes[ICONS_STORAGE_KEY].newValue as IconsMap | undefined;
      if (next && validateIcons(next) && shouldPreferStored(next)) adopt(next);
    });
  })();
  return initPromise;
}

function shouldPreferStored(stored: IconsMap): boolean {
  return Object.keys(stored).length >= Object.keys(iconsBundled as IconsMap).length;
}

function adopt(m: IconsMap): void {
  snapshot = m;
  for (const l of listeners) l(snapshot);
}

export function validateIcons(value: unknown): value is IconsMap {
  if (!value || typeof value !== 'object') return false;
  for (const v of Object.values(value as Record<string, unknown>)) {
    if (typeof v !== 'string') return false;
    if (!v.startsWith('data:')) return false;
  }
  return true;
}
