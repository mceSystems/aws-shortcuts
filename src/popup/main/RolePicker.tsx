import { useEffect, useRef } from 'react';
import type { Account } from '@/shared/types';
import { send } from '@/shared/messages';
import styles from './RolePicker.module.css';

type Props = {
  account: Account;
  onClose: () => void;
};

export function RolePicker({ account, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  async function pick(roleName: string) {
    await send({
      type: 'SET_ACCOUNT_DEFAULT_ROLE',
      accountId: account.accountId,
      roleName,
    });
    onClose();
  }

  const observed = new Set((account.observedRoles ?? []).map((o) => o.roleName));
  const dismissed = new Set(account.dismissedRoles ?? []);

  return (
    <div ref={ref} className={styles.popover} onClick={(e) => e.stopPropagation()}>
      <ul className={styles.list}>
        {account.roles.map((r) => {
          const isCurrent = account.defaultRoleName === r.name;
          const isObserved = observed.has(r.name);
          const isDismissed = dismissed.has(r.name);
          return (
            <li key={r.name}>
              <button
                type="button"
                className={[styles.row, isCurrent ? styles.current : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => pick(r.name)}
              >
                <span className={styles.role}>{r.name}</span>
                {isCurrent && <span className={styles.tagAccent}>default</span>}
                {!isCurrent && isObserved && <span className={styles.tag}>observed</span>}
                {!isCurrent && isDismissed && <span className={styles.tagMuted}>declined</span>}
              </button>
            </li>
          );
        })}
        {account.roles.length === 0 && (
          <li className={styles.empty}>No roles available</li>
        )}
      </ul>
    </div>
  );
}
