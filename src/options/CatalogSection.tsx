import { useEffect, useState } from 'react';
import { CATALOG_FETCHED_AT_KEY, CATALOG_STORAGE_KEY, readCatalogStatus, type CatalogStatus } from '@/shared/catalogStore';
import { ICON_CACHE_KEY, type IconCache } from '@/shared/iconCache';
import { send } from '@/shared/messages';
import styles from './options.module.css';

type RefreshState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'ok'; updated: boolean; version: string; services: number; features: number; source: string }
  | { kind: 'error'; error: string };

type IconState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'ok'; fetched: number; reused: number; failed: number; total: number; bytes: number }
  | { kind: 'error'; error: string };

export function CatalogSection() {
  const [status, setStatus] = useState<CatalogStatus | null>(null);
  const [iconCount, setIconCount] = useState(0);
  const [iconBytes, setIconBytes] = useState(0);
  const [refresh, setRefresh] = useState<RefreshState>({ kind: 'idle' });
  const [iconRefresh, setIconRefresh] = useState<IconState>({ kind: 'idle' });

  useEffect(() => {
    void readCatalogStatus().then(setStatus);
    void readIconCacheStats().then(({ count, bytes }) => {
      setIconCount(count);
      setIconBytes(bytes);
    });
    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: chrome.storage.AreaName,
    ) => {
      if (area !== 'local') return;
      if (changes[CATALOG_STORAGE_KEY] || changes[CATALOG_FETCHED_AT_KEY]) {
        void readCatalogStatus().then(setStatus);
      }
      if (changes[ICON_CACHE_KEY]) {
        void readIconCacheStats().then(({ count, bytes }) => {
          setIconCount(count);
          setIconBytes(bytes);
        });
      }
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  async function onRefresh() {
    setRefresh({ kind: 'pending' });
    const res = await send({ type: 'REFRESH_CATALOG' });
    if (!res.ok) {
      setRefresh({ kind: 'error', error: res.error });
      return;
    }
    if (!res.catalog) {
      setRefresh({ kind: 'error', error: 'No catalog payload returned' });
      return;
    }
    setRefresh({
      kind: 'ok',
      updated: res.catalog.updated,
      version: res.catalog.version,
      services: res.catalog.services,
      features: res.catalog.features,
      source: res.catalog.source,
    });
  }

  async function onRefreshIcons() {
    setIconRefresh({ kind: 'pending' });
    const res = await send({ type: 'REFRESH_ICONS' });
    if (!res.ok) {
      setIconRefresh({ kind: 'error', error: res.error });
      return;
    }
    if (!res.icons) {
      setIconRefresh({ kind: 'error', error: 'No icons payload returned' });
      return;
    }
    setIconRefresh({ kind: 'ok', ...res.icons });
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Service Catalog</h2>
        <p className={styles.sectionHint}>
          List of AWS services + features used by search. Auto-refreshes daily from
          the public catalog repository; trigger manually below.
        </p>
      </div>

      <dl className={styles.statGrid}>
        <div className={styles.stat}>
          <dt className={styles.statLabel}>Version</dt>
          <dd className={styles.statValue}>
            {status?.version ?? '—'}
            {status?.bundled && <span className={styles.bundledTag}>bundled</span>}
          </dd>
        </div>
        <div className={styles.stat}>
          <dt className={styles.statLabel}>Services</dt>
          <dd className={styles.statValue}>{status?.services ?? '—'}</dd>
        </div>
        <div className={styles.stat}>
          <dt className={styles.statLabel}>Features</dt>
          <dd className={styles.statValue}>{status?.features ?? '—'}</dd>
        </div>
        <div className={styles.stat}>
          <dt className={styles.statLabel}>Icons cached</dt>
          <dd className={styles.statValue}>
            {iconCount}
            {iconBytes > 0 && (
              <span className={styles.bundledTag}>{(iconBytes / 1024).toFixed(0)} KB</span>
            )}
          </dd>
        </div>
        <div className={styles.stat}>
          <dt className={styles.statLabel}>Last fetched</dt>
          <dd className={styles.statValue}>{formatFetchedAt(status?.fetchedAt ?? null)}</dd>
        </div>
      </dl>

      <div className={styles.actionRow}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onRefresh}
          disabled={refresh.kind === 'pending'}
        >
          {refresh.kind === 'pending' ? 'Refreshing…' : 'Refresh now'}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onRefreshIcons}
          disabled={iconRefresh.kind === 'pending'}
          title="Re-fetch service icons from the public CDN into chrome.storage.local"
        >
          {iconRefresh.kind === 'pending' ? 'Updating icons…' : 'Update icons'}
        </button>
        {refresh.kind === 'ok' && (
          <span className={styles.successMsg}>
            {refresh.updated
              ? `Updated to ${refresh.version} (${refresh.services} services, ${refresh.features} features)`
              : `Already on ${refresh.version} — no changes`}
          </span>
        )}
        {refresh.kind === 'error' && (
          <span className={styles.errorMsg}>Failed: {refresh.error}</span>
        )}
        {iconRefresh.kind === 'ok' && (
          <span className={styles.successMsg}>
            Icons: fetched {iconRefresh.fetched}, reused {iconRefresh.reused}
            {iconRefresh.failed > 0 ? `, failed ${iconRefresh.failed}` : ''}
            {' '}({(iconRefresh.bytes / 1024).toFixed(0)} KB)
          </span>
        )}
        {iconRefresh.kind === 'error' && (
          <span className={styles.errorMsg}>Icons failed: {iconRefresh.error}</span>
        )}
      </div>
    </section>
  );
}

async function readIconCacheStats(): Promise<{ count: number; bytes: number }> {
  const got = await chrome.storage.local.get(ICON_CACHE_KEY);
  const cache = got[ICON_CACHE_KEY] as IconCache | undefined;
  if (!cache) return { count: 0, bytes: 0 };
  let bytes = 0;
  let count = 0;
  for (const entry of Object.values(cache)) {
    if (entry?.dataUrl) {
      count++;
      bytes += entry.bytes ?? 0;
    }
  }
  return { count, bytes };
}

function formatFetchedAt(ts: number | null): string {
  if (!ts) return 'never (using bundled snapshot)';
  const diffMs = Date.now() - ts;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(ts).toLocaleDateString();
}
