import { useState } from 'react';
import type { Account, IdentityCenter } from '@/shared/types';
import { chipColor } from '@/shared/colors';
import { send } from '@/shared/messages';
import { RegionPicker } from './RegionPicker';
import { RolePicker } from './RolePicker';
import styles from './AccountRow.module.css';

type Props = {
  account: Account;
  identityCenter?: IdentityCenter;
  /** Show the Identity Center name badge. Caller passes true when there
   *  are multiple IdCs configured — hides badge in single-IdC installs. */
  showIdcBadge?: boolean;
  selected: boolean;
  live?: boolean;
  compact?: boolean;
  onClick: () => void;
};

export function AccountRow({
  account,
  identityCenter,
  showIdcBadge,
  selected,
  live,
  compact,
  onClick,
}: Props) {
  const role = account.preferredRoleName || 'set role';
  const region = account.preferredRegion || 'set region';
  const isNeutral = !account.color;
  const [openPicker, setOpenPicker] = useState<'region' | 'role' | null>(null);
  const [aliasDraft, setAliasDraft] = useState<string | null>(null);

  function handleRowClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest(`.${styles.regionBtn}`)) return;
    if (target.closest(`.${styles.roleBtn}`)) return;
    if (target.closest(`.${styles.nameInput}`)) return;
    onClick();
  }

  function commitAlias() {
    if (aliasDraft === null) return;
    const next = aliasDraft.trim();
    if (next !== (account.alias ?? '')) {
      void send({
        type: 'SET_ACCOUNT_ALIAS',
        identityCenterId: account.identityCenterId,
        accountId: account.accountId,
        alias: next,
      });
    }
    setAliasDraft(null);
  }

  const displayName = account.alias || account.name;

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
      {compact ? (
        <input
          type="text"
          className={styles.nameInput}
          value={aliasDraft ?? displayName}
          placeholder={account.name}
          onClick={(e) => e.stopPropagation()}
          onFocus={() => {
            if (aliasDraft === null) setAliasDraft(account.alias ?? '');
          }}
          onChange={(e) => setAliasDraft(e.target.value)}
          onBlur={commitAlias}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setAliasDraft(null);
              (e.target as HTMLInputElement).blur();
            }
          }}
          spellCheck={false}
        />
      ) : (
        <span className={styles.name} title={account.name}>{displayName}</span>
      )}
      {!compact && showIdcBadge && identityCenter && (
        <span className={styles.idcBadge} title={identityCenter.startUrl}>
          {identityCenter.name}
        </span>
      )}
      {!compact && (
        <>
          <button
            type="button"
            className={[
              styles.roleBtn,
              account.preferredRoleName ? '' : styles.roleBtnEmpty,
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
              account.preferredRegion ? '' : styles.regionBtnEmpty,
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
