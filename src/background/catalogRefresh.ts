// Periodic catalog refresh from GitHub. Single operation refreshes both
// services.json + icons.json in parallel. jsDelivr edge cache primary,
// raw.githubusercontent.com fallback for tail-of-the-world reliability.
//
// Runs on:
//   - chrome.runtime.onInstalled (cold install / update)
//   - chrome.runtime.onStartup (Chrome cold start)
//   - chrome.alarms 'catalog-refresh' (every 24h)
//
// Writes both Catalog + IconsMap to chrome.storage.local atomically.
// Subscribers (catalogStore, iconStore) pick up via storage.onChanged.
// Bundled JSON is fallback — remote always wins on successful fetch.
//
// Failure handling: keep last-known stored payloads. Never clear on error.
// Schema-validate before writing to prevent malformed remote from breaking
// the panel.

import type { Catalog } from '@/shared/types';
import { CATALOG_FETCHED_AT_KEY, CATALOG_STORAGE_KEY, validateCatalog } from '@/shared/catalogStore';
import { ICONS_STORAGE_KEY, validateIcons, type IconsMap } from '@/shared/iconStore';

const REPO = 'netanel-mce/aws-shortcut';
const BRANCH = 'main';

type Source = { label: string; services: string; icons: string };

const SOURCES: Source[] = [
  {
    label: 'jsdelivr',
    services: `https://cdn.jsdelivr.net/gh/${REPO}@${BRANCH}/catalog/services.json`,
    icons: `https://cdn.jsdelivr.net/gh/${REPO}@${BRANCH}/catalog/icons.json`,
  },
  {
    label: 'raw.githubusercontent',
    services: `https://raw.githubusercontent.com/${REPO}/${BRANCH}/catalog/services.json`,
    icons: `https://raw.githubusercontent.com/${REPO}/${BRANCH}/catalog/icons.json`,
  },
];

const ALARM_NAME = 'catalog-refresh';
const PERIOD_MIN = 60 * 24; // 24h

export function installCatalogRefresh(): void {
  chrome.runtime.onInstalled.addListener(() => {
    void ensureAlarm();
    void refreshCatalog('onInstalled');
  });
  chrome.runtime.onStartup.addListener(() => {
    void ensureAlarm();
    void refreshCatalog('onStartup');
  });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== ALARM_NAME) return;
    void refreshCatalog('alarm');
  });
}

async function ensureAlarm(): Promise<void> {
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (existing) return;
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: PERIOD_MIN });
}

export type RefreshResult =
  | {
      ok: true;
      updated: boolean;
      version: string;
      services: number;
      features: number;
      icons: number;
      fetchedAt: number;
      source: string;
    }
  | { ok: false; error: string };

function countFeatures(c: Catalog): number {
  let n = 0;
  for (const s of c.services) n += s.features?.length ?? 0;
  return n;
}

export async function refreshCatalog(trigger: string): Promise<RefreshResult> {
  const errors: string[] = [];
  for (const source of SOURCES) {
    try {
      const [svcRes, iconsRes] = await Promise.all([
        fetch(source.services, { cache: 'no-cache' }),
        fetch(source.icons, { cache: 'no-cache' }),
      ]);
      if (!svcRes.ok) {
        errors.push(`HTTP ${svcRes.status} from ${source.services}`);
        continue;
      }
      if (!iconsRes.ok) {
        errors.push(`HTTP ${iconsRes.status} from ${source.icons}`);
        continue;
      }
      const [svcJson, iconsJson] = await Promise.all([svcRes.json(), iconsRes.json()]);
      if (!validateCatalog(svcJson)) {
        errors.push(`invalid services shape from ${source.services}`);
        continue;
      }
      if (!validateIcons(iconsJson)) {
        errors.push(`invalid icons shape from ${source.icons}`);
        continue;
      }
      const next = svcJson as Catalog;
      const icons = iconsJson as IconsMap;
      const cur = await readStoredCatalog();
      const fetchedAt = Date.now();

      // Don't downgrade — protects against the dev-time hazard where the
      // public repo lags a locally-merged catalog.
      if (cur && next.services.length < cur.services.length && next.version < cur.version) {
        console.warn(
          `[catalog] ${trigger} remote (${next.version}, ${next.services.length}) older than stored (${cur.version}, ${cur.services.length}); skipping`,
        );
        await chrome.storage.local.set({ [CATALOG_FETCHED_AT_KEY]: fetchedAt });
        return {
          ok: true,
          updated: false,
          version: cur.version,
          services: cur.services.length,
          features: countFeatures(cur),
          icons: Object.keys(icons).length,
          fetchedAt,
          source: source.label,
        };
      }

      await chrome.storage.local.set({
        [CATALOG_STORAGE_KEY]: next,
        [ICONS_STORAGE_KEY]: icons,
        [CATALOG_FETCHED_AT_KEY]: fetchedAt,
      });
      const updated = !cur || cur.version !== next.version;
      console.log(
        `[catalog] ${trigger} ${updated ? 'updated → ' : 'refreshed '}${next.version} (${next.services.length} services, ${countFeatures(next)} features, ${Object.keys(icons).length} icons) via ${source.label}`,
      );
      return {
        ok: true,
        updated,
        version: next.version,
        services: next.services.length,
        features: countFeatures(next),
        icons: Object.keys(icons).length,
        fetchedAt,
        source: source.label,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[catalog] ${trigger} fetch failed for ${source.label}:`, msg);
      errors.push(`${source.label}: ${msg}`);
    }
  }
  console.warn(`[catalog] ${trigger} all sources failed; keeping prior catalog`);
  return { ok: false, error: errors.join('; ') || 'all sources failed' };
}

async function readStoredCatalog(): Promise<Catalog | null> {
  const got = await chrome.storage.local.get(CATALOG_STORAGE_KEY);
  const stored = got[CATALOG_STORAGE_KEY];
  return stored && validateCatalog(stored) ? (stored as Catalog) : null;
}
