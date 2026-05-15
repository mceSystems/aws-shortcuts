import { useEffect, useRef, useState } from 'react';
import { AWS_REGIONS } from '@/shared/regions';
import type { Account } from '@/shared/types';
import { send } from '@/shared/messages';
import styles from './RegionPicker.module.css';

type Props = {
  account: Account;
  onClose: () => void;
};

export function RegionPicker({ account, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');

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

  async function pick(region: string) {
    await send({
      type: 'SET_ACCOUNT_PREFERRED_REGION',
      identityCenterId: account.identityCenterId,
      accountId: account.accountId,
      region,
    });
    onClose();
  }

  async function toggleLock() {
    await send({
      type: 'TOGGLE_REGION_LOCK',
      identityCenterId: account.identityCenterId,
      accountId: account.accountId,
      locked: !account.regionLocked,
    });
  }

  const observed = new Set((account.observedRegions ?? []).map((o) => o.region));

  const filtered = AWS_REGIONS.filter((r) =>
    query ? r.toLowerCase().includes(query.toLowerCase()) : true,
  );

  return (
    <div ref={ref} className={styles.popover} onClick={(e) => e.stopPropagation()}>
      <input
        type="text"
        autoFocus
        className={styles.search}
        placeholder="Filter region…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className={styles.list}>
        {filtered.map((r) => {
          const isCurrent = account.preferredRegion === r;
          const isObserved = observed.has(r);
          return (
            <li key={r}>
              <button
                type="button"
                className={[
                  styles.row,
                  isCurrent ? styles.current : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => pick(r)}
              >
                <span className={styles.region}>{r}</span>
                {isCurrent && account.regionLocked && (
                  <span className={styles.tagAccent}>locked</span>
                )}
                {isCurrent && !account.regionLocked && (
                  <span className={styles.tagAccent}>preferred</span>
                )}
                {!isCurrent && isObserved && (
                  <span className={styles.tag}>observed</span>
                )}
              </button>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className={styles.empty}>No match</li>
        )}
      </ul>
      <button
        type="button"
        className={[styles.lockBtn, account.regionLocked ? styles.lockBtnOn : '']
          .filter(Boolean)
          .join(' ')}
        onClick={toggleLock}
        title={
          account.regionLocked
            ? 'Locked — opens never auto-update preferred region'
            : 'Unlocked — opens with a different region overwrite preferred'
        }
      >
        <PinIcon filled={Boolean(account.regionLocked)} />
        <span>{account.regionLocked ? 'Locked' : 'Auto-update'}</span>
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
