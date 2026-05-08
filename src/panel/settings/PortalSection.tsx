import { useEffect, useState } from 'react';
import { send } from '@/shared/messages';
import { getSync } from '@/shared/storage';
import styles from '@/options/options.module.css';

type Status =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | {
      kind: 'ok';
      accountsAdded: number;
      accountsTotal: number;
      rolesAdded: number;
      rolesTotal: number;
    }
  | { kind: 'error'; message: string };

function countRoles(accounts: { roles: { name: string }[] }[]): number {
  return accounts.reduce((sum, a) => sum + a.roles.length, 0);
}

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
    const beforeSync = await getSync();
    const accountsBefore = beforeSync.accounts?.length ?? 0;
    const rolesBefore = countRoles(beforeSync.accounts ?? []);

    const res = await send({ type: 'CAPTURE_AND_SCAN' });
    if (!res.ok) {
      setStatus({
        kind: 'error',
        message: res.error ?? 'Scan failed.',
      });
      return;
    }

    const afterSync = await getSync();
    const accountsAfter = afterSync.accounts?.length ?? 0;
    const rolesAfter = countRoles(afterSync.accounts ?? []);
    setStatus({
      kind: 'ok',
      accountsAdded: Math.max(0, accountsAfter - accountsBefore),
      accountsTotal: accountsAfter,
      rolesAdded: Math.max(0, rolesAfter - rolesBefore),
      rolesTotal: rolesAfter,
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
          {(() => {
            const a = `${status.accountsTotal} account${status.accountsTotal === 1 ? '' : 's'}`;
            const r = `${status.rolesTotal} role${status.rolesTotal === 1 ? '' : 's'}`;
            const noChanges = status.accountsAdded === 0 && status.rolesAdded === 0;
            if (noChanges) return `Up to date — ${a}, ${r}.`;
            const parts: string[] = [];
            if (status.accountsAdded > 0) {
              parts.push(`${status.accountsAdded} new account${status.accountsAdded === 1 ? '' : 's'}`);
            }
            if (status.rolesAdded > 0) {
              parts.push(`${status.rolesAdded} new role${status.rolesAdded === 1 ? '' : 's'}`);
            }
            return `Added ${parts.join(' + ')} (${a}, ${r}).`;
          })()}
        </p>
      )}
      {status.kind === 'error' && (
        <p className={styles.errorMsg}>{status.message}</p>
      )}
    </section>
  );
}
