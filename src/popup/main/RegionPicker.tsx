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
      type: 'SET_ACCOUNT_DEFAULT_REGION',
      accountId: account.accountId,
      region,
    });
    onClose();
  }

  const observed = new Set((account.observedRegions ?? []).map((o) => o.region));
  const dismissed = new Set(account.dismissedRegions ?? []);

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
          const isCurrent = account.defaultRegion === r;
          const isObserved = observed.has(r);
          const isDismissed = dismissed.has(r);
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
                {isCurrent && <span className={styles.tagAccent}>default</span>}
                {!isCurrent && isObserved && <span className={styles.tag}>observed</span>}
                {!isCurrent && isDismissed && <span className={styles.tagMuted}>declined</span>}
              </button>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className={styles.empty}>No match</li>
        )}
      </ul>
    </div>
  );
}
