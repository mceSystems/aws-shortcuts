import { useState, type ReactNode } from 'react';
import { Header } from './Header';
import { AccountList } from './AccountList';
import { SuggestionQueue } from './SuggestionQueue';
import { useAccounts } from '../hooks/useAccounts';
import { send } from '@/shared/messages';
import styles from './Main.module.css';

type Props = {
  onOpenSettings?: () => void;
  onWipe?: () => void;
};

export function Main({ onOpenSettings, onWipe }: Props) {
  const { accounts, loaded } = useAccounts();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className={styles.root}>
      <Header
        onSettings={onOpenSettings}
        onRefresh={() => {
          void send({ type: 'RESCAN_OPEN_TABS' });
        }}
        onPalette={() => {
          // cmd+k overlay coming next
        }}
      />

      <div className={styles.body}>
        {loaded && <SuggestionQueue accounts={accounts} />}

        <Section label="Account">
          {loaded ? (
            <AccountList
              accounts={accounts}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
            />
          ) : (
            <div className={styles.skeleton} />
          )}
        </Section>

        <Section label={selectedId ? 'Service' : 'Pick an account first'}>
          <div className={styles.placeholder}>Service search · coming next</div>
        </Section>

        <Section label="Favorites">
          <div className={styles.placeholder}>No favorites yet</div>
        </Section>
      </div>

      {onWipe && (
        <div className={styles.devRow}>
          <span className={styles.devLabel}>DEV</span>
          <button type="button" className={styles.devBtn} onClick={onWipe}>
            Wipe storage
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionLabel}>{label}</div>
      {children}
    </section>
  );
}
