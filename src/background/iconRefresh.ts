// Icon refresh. Walks the catalog services, fetches each `iconUrl`,
// encodes the body as a data URL, and writes the result to
// chrome.storage.local[ICON_CACHE_KEY]. Only re-fetches when the source
// URL changed since the last cache write — repeated catalog refreshes
// without iconUrl edits are essentially free.

import type { Catalog } from '@/shared/types';
import { CATALOG_STORAGE_KEY, validateCatalog } from '@/shared/catalogStore';
import { ICON_CACHE_KEY, type IconCache } from '@/shared/iconCache';
import bundled from '@catalog/services.json';

const CONCURRENCY = 8;

export type IconRefreshResult = {
  fetched: number;
  reused: number;
  failed: number;
  total: number;
  bytes: number;
};

export async function refreshIcons(trigger: string): Promise<IconRefreshResult> {
  const got = await chrome.storage.local.get([CATALOG_STORAGE_KEY, ICON_CACHE_KEY]);
  const stored = got[CATALOG_STORAGE_KEY];
  // Fall back to the bundled catalog when storage hasn't been populated
  // yet (offline first install, or before the first successful CDN
  // refresh). Bundled already carries iconUrls thanks to merge-harvested,
  // so icons can populate as soon as network is available.
  const catalog: Catalog =
    stored && validateCatalog(stored) ? (stored as Catalog) : (bundled as Catalog);
  const cache: IconCache = (got[ICON_CACHE_KEY] as IconCache | undefined) ?? {};

  type Job = { id: string; url: string };
  const jobs: Job[] = [];
  const reusedIds = new Set<string>();
  for (const svc of catalog.services) {
    if (!svc.iconUrl) continue;
    const cached = cache[svc.id];
    if (cached && cached.url === svc.iconUrl && cached.dataUrl) {
      reusedIds.add(svc.id);
      continue;
    }
    jobs.push({ id: svc.id, url: svc.iconUrl });
  }

  // Drop cache entries for services that no longer have iconUrl or whose
  // service id was removed from the catalog.
  const validIds = new Set(catalog.services.filter((s) => s.iconUrl).map((s) => s.id));
  for (const id of Object.keys(cache)) {
    if (!validIds.has(id)) delete cache[id];
  }

  let fetched = 0;
  let failed = 0;
  let bytes = 0;

  // Simple p-limit-style worker pool.
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      try {
        const res = await fetch(job.url, { cache: 'no-cache' });
        if (!res.ok) {
          console.warn(`[icons] ${trigger} ${job.id}: HTTP ${res.status}`);
          failed++;
          continue;
        }
        const buf = await res.arrayBuffer();
        const mime = res.headers.get('content-type')?.split(';')[0]?.trim() ||
          guessMime(job.url);
        const dataUrl = `data:${mime};base64,${arrayBufferToBase64(buf)}`;
        cache[job.id] = { url: job.url, dataUrl, bytes: buf.byteLength };
        fetched++;
        bytes += buf.byteLength;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[icons] ${trigger} ${job.id} fetch failed:`, msg);
        failed++;
      }
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, Math.max(1, jobs.length)) }, () => worker());
  await Promise.all(workers);

  await chrome.storage.local.set({ [ICON_CACHE_KEY]: cache });

  const result: IconRefreshResult = {
    fetched,
    reused: reusedIds.size,
    failed,
    total: jobs.length + reusedIds.size,
    bytes: bytes + sumReusedBytes(cache, reusedIds),
  };
  console.log(
    `[icons] ${trigger} fetched=${result.fetched} reused=${result.reused} failed=${result.failed} total=${result.total} (${(result.bytes / 1024).toFixed(0)} KB)`,
  );
  return result;
}

function sumReusedBytes(cache: IconCache, reusedIds: Set<string>): number {
  let n = 0;
  for (const id of reusedIds) n += cache[id]?.bytes ?? 0;
  return n;
}

function guessMime(url: string): string {
  const ext = url.toLowerCase().split('?')[0].split('.').pop();
  switch (ext) {
    case 'svg':
      return 'image/svg+xml';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
