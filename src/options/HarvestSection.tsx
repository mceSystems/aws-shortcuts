import { useEffect, useState } from 'react';
import type { HarvestProgress, HarvestedFeature, HarvestedService } from '@/shared/messages';
import { send } from '@/shared/messages';
import styles from './options.module.css';

type Phase = 'idle' | 'services' | 'features' | 'done';

type LocalState = {
  services?: HarvestedService[];
  features?: Record<string, HarvestedFeature[]>;
  skipped?: { id: string; reason: string }[];
};

export function HarvestSection() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<HarvestProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<LocalState>({});

  // Load any prior harvested data on mount.
  useEffect(() => {
    void chrome.storage.local
      .get(['harvestedServices', 'harvestedFeatures'])
      .then((got: Record<string, unknown>) => {
        setState({
          services: got.harvestedServices as HarvestedService[] | undefined,
          features: got.harvestedFeatures as Record<string, HarvestedFeature[]> | undefined,
        });
      });
  }, []);

  // Subscribe to progress events from the SW.
  useEffect(() => {
    const listener = (msg: HarvestProgress) => {
      if (msg?.type === 'HARVEST_PROGRESS') setProgress(msg);
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  // Refresh persisted state when chrome.storage.local mutates (incremental
  // feature harvest writes after each service).
  useEffect(() => {
    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: chrome.storage.AreaName,
    ) => {
      if (area !== 'local') return;
      if (changes.harvestedFeatures || changes.harvestedServices) {
        void chrome.storage.local
          .get(['harvestedServices', 'harvestedFeatures'])
          .then((got: Record<string, unknown>) => {
            setState((prev) => ({
              ...prev,
              services: got.harvestedServices as HarvestedService[] | undefined,
              features: got.harvestedFeatures as Record<string, HarvestedFeature[]> | undefined,
            }));
          });
      }
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  async function onHarvestServices(debug = false) {
    setPhase('services');
    setError(null);
    setProgress(null);
    const res = await send({ type: 'HARVEST_SERVICES', debug });
    if (!res.ok) {
      setError(res.error);
      setPhase('idle');
      return;
    }
    setState((s) => ({ ...s, services: res.harvest?.services }));
    setPhase('done');
  }

  async function onHarvestFeatures() {
    if (!state.services?.length) {
      setError('Run service harvest first.');
      return;
    }
    setPhase('features');
    setError(null);
    setProgress(null);
    const res = await send({ type: 'HARVEST_FEATURES' });
    if (!res.ok) {
      setError(res.error);
      setPhase('idle');
      return;
    }
    setState((s) => ({ ...s, features: res.harvest?.features, skipped: res.harvest?.skipped }));
    setPhase('done');
  }

  async function onCancel() {
    await send({ type: 'HARVEST_CANCEL' });
  }

  function onDownload() {
    if (!state.services) return;
    const payload = {
      harvestedAt: new Date().toISOString(),
      services: state.services,
      features: state.features ?? {},
      skipped: state.skipped ?? [],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'harvested.raw.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function onClear() {
    await chrome.storage.local.remove(['harvestedServices', 'harvestedFeatures']);
    setState({});
    setPhase('idle');
  }

  const busy = phase === 'services' || phase === 'features';
  const persistedFeatureCount = state.features
    ? Object.values(state.features).reduce((sum, arr) => sum + arr.length, 0)
    : 0;
  // Prefer live progress count during a running feature harvest; otherwise
  // fall back to the persisted total from chrome.storage.local.
  const featureCount = busy && progress?.phase === 'features' && progress.featuresCount != null
    ? progress.featuresCount
    : persistedFeatureCount;

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Catalog Harvest <span className={styles.devTag}>dev-only</span></h2>
        <p className={styles.sectionHint}>
          Scrape AWS console for the full service + feature list. Output downloads
          as JSON; merge into <code>catalog/services.json</code> via{' '}
          <code>npm run catalog:merge</code>.
        </p>
      </div>

      <dl className={styles.statGrid}>
        <div className={styles.stat}>
          <dt className={styles.statLabel}>Harvested services</dt>
          <dd className={styles.statValue}>{state.services?.length ?? 0}</dd>
        </div>
        <div className={styles.stat}>
          <dt className={styles.statLabel}>Harvested features</dt>
          <dd className={styles.statValue}>{featureCount}</dd>
        </div>
        <div className={styles.stat}>
          <dt className={styles.statLabel}>Status</dt>
          <dd className={styles.statValue}>
            {busy ? `${phase} (${progress?.done ?? 0}/${progress?.total ?? '?'})` : phase}
          </dd>
        </div>
      </dl>

      {progress?.current && busy && (
        <div className={styles.progressMsg}>
          {progress.phase}: {progress.current}
        </div>
      )}

      <div className={styles.actionRow}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => onHarvestServices(false)}
          disabled={busy}
        >
          {phase === 'services' ? 'Harvesting…' : 'Harvest services'}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => onHarvestServices(true)}
          disabled={busy}
          title="Opens visible tab; you click Services menu manually, scraper runs after 12s"
        >
          Harvest (debug, manual)
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onHarvestFeatures}
          disabled={busy || !state.services?.length}
        >
          {phase === 'features' ? 'Harvesting…' : 'Harvest features'}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onDownload}
          disabled={busy || !state.services?.length}
        >
          Download JSON
        </button>
        {busy ? (
          <button type="button" className={styles.dangerButton} onClick={onCancel}>
            Cancel
          </button>
        ) : (
          <button
            type="button"
            className={styles.dangerButton}
            onClick={onClear}
            disabled={!state.services?.length && !state.features}
          >
            Clear
          </button>
        )}
      </div>

      {error && <div className={styles.errorMsg}>{error}</div>}

      {state.skipped && state.skipped.length > 0 && (
        <details className={styles.skipped}>
          <summary>{state.skipped.length} services skipped</summary>
          <ul className={styles.skippedList}>
            {state.skipped.map((s) => (
              <li key={s.id}>
                <code>{s.id}</code> — {s.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
