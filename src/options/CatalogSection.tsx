import { useEffect, useState } from 'react';
import {
  CATALOG_FETCHED_AT_KEY,
  CATALOG_STORAGE_KEY,
  readCatalogStatus,
  type CatalogStatus,
} from '@/shared/catalogStore';
import { ICONS_STORAGE_KEY } from '@/shared/iconStore';
import { send } from '@/shared/messages';
import styles from './options.module.css';

type RefreshState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | {
      kind: 'ok';
      updated: boolean;
      version: string;
      services: number;
      features: number;
      icons: number;
      source: string;
    }
  | { kind: 'error'; error: string };

export function CatalogSection() {
  const [status, setStatus] = useState<CatalogStatus | null>(null);
  const [refresh, setRefresh] = useState<RefreshState>({ kind: 'idle' });

  useEffect(() => {
    void readCatalogStatus().then(setStatus);
    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: chrome.storage.AreaName,
    ) => {
      if (area !== 'local') return;
      if (
        changes[CATALOG_STORAGE_KEY] ||
        changes[CATALOG_FETCHED_AT_KEY] ||
        changes[ICONS_STORAGE_KEY]
      ) {
        void readCatalogStatus().then(setStatus);
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
      icons: res.catalog.icons,
      source: res.catalog.source,
    });
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Service Catalog</h2>
        <p className={styles.sectionHint}>
          Services + features + icons used by search. Auto-refreshes daily from
          the public catalog repository.
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
          <dt className={styles.statLabel}>Icons</dt>
          <dd className={styles.statValue}>{status?.icons ?? '—'}</dd>
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
        {refresh.kind === 'ok' && (
          <span className={styles.successMsg}>
            {refresh.updated
              ? `Updated to ${refresh.version} (${refresh.services} services, ${refresh.features} features, ${refresh.icons} icons)`
              : `Already on ${refresh.version} — no changes`}
          </span>
        )}
        {refresh.kind === 'error' && (
          <span className={styles.errorMsg}>Failed: {refresh.error}</span>
        )}
      </div>
    </section>
  );
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
