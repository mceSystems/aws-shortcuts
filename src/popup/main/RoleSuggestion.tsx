import { send } from '@/shared/messages';
import type { Account } from '@/shared/types';
import { pickRoleSuggestion } from '@/shared/roles';
import { chipColor } from '@/shared/colors';
import styles from './RegionSuggestion.module.css';

type Props = { accounts: Account[] };

export function RoleSuggestion({ accounts }: Props) {
  const candidate = accounts
    .filter((a) => !a.defaultRoleName)
    .map((a) => {
      const pick = pickRoleSuggestion(a.observedRoles, a.dismissedRoles);
      return pick ? { account: a, ...pick } : null;
    })
    .filter((x): x is { account: Account; roleName: string; hits: number } => Boolean(x))
    .sort((a, b) => b.hits - a.hits)[0];

  if (!candidate) return null;

  async function accept() {
    await send({
      type: 'SET_ACCOUNT_DEFAULT_ROLE',
      accountId: candidate.account.accountId,
      roleName: candidate.roleName,
    });
  }

  async function dismiss() {
    await send({
      type: 'DISMISS_ROLE_SUGGESTION',
      accountId: candidate.account.accountId,
      roleName: candidate.roleName,
    });
  }

  return (
    <div
      className={styles.banner}
      style={{ ['--banner-color' as string]: chipColor(candidate.account.color) }}
    >
      <span className={styles.dot} />
      <div className={styles.text}>
        <span className={styles.title}>
          Set <strong>{candidate.roleName}</strong> as default for{' '}
          <strong>{candidate.account.name}</strong>?
        </span>
        <span className={styles.sub}>
          Seen {candidate.hits} {candidate.hits === 1 ? 'visit' : 'visits'}
        </span>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.dismiss} onClick={dismiss}>
          Not this one
        </button>
        <button type="button" className={styles.accept} onClick={accept}>
          Set default
        </button>
      </div>
    </div>
  );
}
