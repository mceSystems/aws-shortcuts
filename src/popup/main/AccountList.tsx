import type { Account } from '@/shared/types';
import { AccountRow } from './AccountRow';
import styles from './AccountList.module.css';

type Props = {
  accounts: Account[];
  selectedId: string | null;
  onSelect: (accountId: string) => void;
};

export function AccountList({ accounts, selectedId, onSelect }: Props) {
  if (accounts.length === 0) {
    return (
      <div className={styles.empty}>
        No accounts yet. Re-run the wizard from settings.
      </div>
    );
  }
  return (
    <div className={styles.list}>
      {accounts.map((a) => (
        <AccountRow
          key={a.accountId}
          account={a}
          selected={selectedId === a.accountId}
          onClick={() => onSelect(a.accountId)}
        />
      ))}
    </div>
  );
}
