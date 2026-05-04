import { useEffect, useState } from 'react';
import { send } from '@/shared/messages';
import { getSync } from '@/shared/storage';
import styles from '@/options/options.module.css';

type Status =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'ok'; added: number; total: number }
  | { kind: 'error'; message: string };

type Props = {
  onChangePortal: () => void;
};

export function PortalSection({ onChangePortal }: Props) {
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    void getSync().then((sync) => {
      setPortalUrl(sync.ssoConfig?.startUrl ?? null);
    });
  }, []);

  async function rescan() {
    setStatus({ kind: 'scanning' });
    const before = (await getSync()).accounts?.length ?? 0;
    const res = await send({ type: 'CAPTURE_AND_SCAN_VIA_BG_TAB' });
    if (!res.ok) {
      setStatus({
        kind: 'error',
        message: res.error ?? 'Scan failed.',
      });
      return;
    }
    const after = (await getSync()).accounts?.length ?? 0;
    setStatus({
      kind: 'ok',
      added: Math.max(0, after - before),
      total: after,
    });
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Portal connection</h2>
        <p className={styles.sectionHint}>
          The IAM Identity Center start URL the extension reads accounts and
          roles from.
        </p>
      </div>

      <dl className={styles.statGrid}>
        <div className={styles.stat} style={{ gridColumn: '1 / -1' }}>
          <dt className={styles.statLabel}>Current portal</dt>
          <dd
            className={styles.statValue}
            style={{ fontSize: 13, wordBreak: 'break-all' }}
          >
            {portalUrl ?? '—'}
          </dd>
        </div>
      </dl>

      <div className={styles.actionRow}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={rescan}
          disabled={status.kind === 'scanning' || !portalUrl}
        >
          {status.kind === 'scanning' ? 'Rescanning…' : 'Rescan portal'}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onChangePortal}
        >
          Change portal URL
        </button>
      </div>

      {status.kind === 'ok' && (
        <p className={styles.successMsg}>
          {status.added > 0
            ? `Added ${status.added} account${status.added === 1 ? '' : 's'} (${status.total} total).`
            : `Up to date — ${status.total} account${status.total === 1 ? '' : 's'}.`}
        </p>
      )}
      {status.kind === 'error' && (
        <p className={styles.errorMsg}>{status.message}</p>
      )}
    </section>
  );
}
