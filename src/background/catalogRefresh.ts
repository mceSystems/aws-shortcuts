// Periodic catalog refresh from GitHub. jsDelivr edge cache primary,
// raw.githubusercontent.com fallback for tail-of-the-world reliability.
//
// Runs on:
//   - chrome.runtime.onInstalled (cold install / update)
//   - chrome.runtime.onStartup (Chrome cold start)
//   - chrome.alarms 'catalog-refresh' (every 24h)
//
// Writes Catalog payload to chrome.storage.local; popup catalogStore picks
// it up via storage.onChanged. Bundled JSON in the extension is fallback —
// remote always wins on successful fetch.
//
// Failure handling: keep last-known stored catalog. Never clear on error.
// Schema-validate before writing to prevent malformed remote from breaking
// the popup.

import type { Catalog } from '@/shared/types';
import { CATALOG_FETCHED_AT_KEY, CATALOG_STORAGE_KEY, validateCatalog } from '@/shared/catalogStore';

const REPO = 'netanel-mce/aws-shortcut';
const BRANCH = 'main';
const PATH = 'catalog/services.json';

const URLS = [
  `https://cdn.jsdelivr.net/gh/${REPO}@${BRANCH}/${PATH}`,
  `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${PATH}`,
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
  | { ok: true; updated: boolean; version: string; services: number; fetchedAt: number; source: string }
  | { ok: false; error: string };

export async function refreshCatalog(trigger: string): Promise<RefreshResult> {
  const errors: string[] = [];
  for (const url of URLS) {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) {
        const msg = `HTTP ${res.status} from ${url}`;
        console.warn(`[catalog] ${trigger} ${msg}`);
        errors.push(msg);
        continue;
      }
      const json = (await res.json()) as unknown;
      if (!validateCatalog(json)) {
        const msg = `invalid shape from ${url}`;
        console.warn(`[catalog] ${trigger} ${msg}`);
        errors.push(msg);
        continue;
      }
      const next = json as Catalog;
      const cur = await readStoredCatalog();
      const fetchedAt = Date.now();
      if (cur && cur.version === next.version) {
        console.log(`[catalog] ${trigger} version unchanged (${cur.version})`);
        await chrome.storage.local.set({ [CATALOG_FETCHED_AT_KEY]: fetchedAt });
        return { ok: true, updated: false, version: cur.version, services: cur.services.length, fetchedAt, source: url };
      }
      await chrome.storage.local.set({
        [CATALOG_STORAGE_KEY]: next,
        [CATALOG_FETCHED_AT_KEY]: fetchedAt,
      });
      console.log(`[catalog] ${trigger} updated → ${next.version} (${next.services.length} services)`);
      return { ok: true, updated: true, version: next.version, services: next.services.length, fetchedAt, source: url };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[catalog] ${trigger} fetch failed for ${url}:`, msg);
      errors.push(`${url}: ${msg}`);
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
