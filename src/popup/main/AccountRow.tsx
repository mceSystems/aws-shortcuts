import { useState } from 'react';
import type { Account } from '@/shared/types';
import { chipColor } from '@/shared/colors';
import { RegionPicker } from './RegionPicker';
import { RolePicker } from './RolePicker';
import styles from './AccountRow.module.css';

type Props = {
  account: Account;
  selected: boolean;
  live?: boolean;
  compact?: boolean;
  onClick: () => void;
};

export function AccountRow({ account, selected, live, compact, onClick }: Props) {
  const role = account.defaultRoleName || 'set role';
  const region = account.defaultRegion || 'set region';
  const isNeutral = !account.color;
  const [openPicker, setOpenPicker] = useState<'region' | 'role' | null>(null);

  function handleRowClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest(`.${styles.regionBtn}`)) return;
    if (target.closest(`.${styles.roleBtn}`)) return;
    onClick();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={[
        styles.row,
        selected ? styles.selected : '',
        isNeutral ? styles.neutral : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ ['--row-color' as string]: chipColor(account.color) }}
      onClick={handleRowClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <span className={styles.stripe} />
      <span className={styles.dot} />
      <span className={styles.name}>{account.name}</span>
      {!compact && (
        <>
          <button
            type="button"
            className={[
              styles.roleBtn,
              account.defaultRoleName ? '' : styles.roleBtnEmpty,
            ]
              .filter(Boolean)
              .join(' ')}
            title={role}
            onClick={(e) => {
              e.stopPropagation();
              setOpenPicker((v) => (v === 'role' ? null : 'role'));
            }}
          >
            {role}
            <span className={styles.caret}>▾</span>
          </button>
          <button
            type="button"
            className={[
              styles.regionBtn,
              account.defaultRegion ? '' : styles.regionBtnEmpty,
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={(e) => {
              e.stopPropagation();
              setOpenPicker((v) => (v === 'region' ? null : 'region'));
            }}
          >
            {region}
            <span className={styles.caret}>▾</span>
          </button>
          <span
            className={styles.live}
            aria-label={live ? 'session live' : ''}
            data-live={live ? 'true' : 'false'}
          />
          {openPicker === 'role' && (
            <RolePicker account={account} onClose={() => setOpenPicker(null)} />
          )}
          {openPicker === 'region' && (
            <RegionPicker account={account} onClose={() => setOpenPicker(null)} />
          )}
        </>
      )}
    </div>
  );
}
