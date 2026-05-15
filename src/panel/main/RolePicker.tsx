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
      type: 'SET_ACCOUNT_PREFERRED_ROLE',
      identityCenterId: account.identityCenterId,
      accountId: account.accountId,
      roleName,
    });
    onClose();
  }

  async function toggleLock() {
    await send({
      type: 'TOGGLE_ROLE_LOCK',
      identityCenterId: account.identityCenterId,
      accountId: account.accountId,
      locked: !account.roleLocked,
    });
  }

  const observed = new Set((account.observedRoles ?? []).map((o) => o.roleName));

  return (
    <div ref={ref} className={styles.popover} onClick={(e) => e.stopPropagation()}>
      <ul className={styles.list}>
        {account.roles.map((r) => {
          const isCurrent = account.preferredRoleName === r.name;
          const isObserved = observed.has(r.name);
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
                {isCurrent && account.roleLocked && (
                  <span className={styles.tagAccent}>locked</span>
                )}
                {isCurrent && !account.roleLocked && (
                  <span className={styles.tagAccent}>preferred</span>
                )}
                {!isCurrent && isObserved && (
                  <span className={styles.tag}>observed</span>
                )}
              </button>
            </li>
          );
        })}
        {account.roles.length === 0 && (
          <li className={styles.empty}>No roles available</li>
        )}
      </ul>
      <button
        type="button"
        className={[styles.lockBtn, account.roleLocked ? styles.lockBtnOn : '']
          .filter(Boolean)
          .join(' ')}
        onClick={toggleLock}
        title={
          account.roleLocked
            ? 'Locked — opens never auto-update preferred role'
            : 'Unlocked — opens with a different role overwrite preferred'
        }
      >
        <PinIcon filled={Boolean(account.roleLocked)} />
        <span>{account.roleLocked ? 'Locked' : 'Auto-update'}</span>
      </button>
    </div>
  );
}

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  );
}
