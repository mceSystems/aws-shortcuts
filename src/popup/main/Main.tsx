import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Header } from './Header';
import { AccountList, AccountsEditButton } from './AccountList';
import { ServiceSearch } from './ServiceSearch';
import { useAccounts } from '../hooks/useAccounts';
import { send } from '@/shared/messages';
import { getSync, setSync } from '@/shared/storage';
import styles from './Main.module.css';

type Props = {
  onOpenSettings?: () => void;
  onWipe?: () => void;
};

export function Main({ onOpenSettings, onWipe }: Props) {
  const { accounts, accountOrder, hiddenAccountIds, ssoConfig, prefs, loaded } = useAccounts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const initRef = useState({ done: false })[0];

  // Restore last-selected account once accounts + prefs have loaded.
  useEffect(() => {
    if (!loaded || initRef.done) return;
    initRef.done = true;
    const last = prefs?.lastSelectedAccountId;
    if (last && accounts.some((a) => a.accountId === last)) {
      setSelectedId(last);
    }
  }, [loaded, prefs, accounts, initRef]);

  function selectAccount(id: string | null) {
    setSelectedId(id);
    void persistLastSelected(id);
  }

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.accountId === selectedId) ?? null,
    [accounts, selectedId],
  );

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
        portalUrl={ssoConfig?.startUrl}
        onOpenPortal={() => {
          if (ssoConfig?.startUrl) {
            void chrome.tabs.create({ url: ssoConfig.startUrl });
          }
        }}
      />

      <div className={styles.body}>
        {!editing && (
          <Section label={selectedAccount ? 'Service' : 'Pick an account first'}>
            <ServiceSearch account={selectedAccount} ssoConfig={ssoConfig} />
          </Section>
        )}

        <Section
          label="Account"
          action={
            loaded && accounts.length > 0 ? (
              <AccountsEditButton
                editing={editing}
                onToggle={() => setEditing((v) => !v)}
              />
            ) : null
          }
          /* Account section always grows + scrolls so all accounts are
           * reachable, while header + service search stay pinned above. */
          grow
        >
          {loaded ? (
            <AccountList
              accounts={accounts}
              accountOrder={accountOrder}
              hiddenAccountIds={hiddenAccountIds}
              selectedId={selectedId}
              onSelect={(id) => selectAccount(id === selectedId ? null : id)}
              editing={editing}
            />
          ) : (
            <div className={styles.skeleton} />
          )}
        </Section>

        {!editing && (
          <Section label="Favorites">
            <div className={styles.placeholder}>No favorites yet</div>
          </Section>
        )}
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

async function persistLastSelected(accountId: string | null): Promise<void> {
  const sync = await getSync();
  await setSync({
    prefs: { ...sync.prefs, lastSelectedAccountId: accountId ?? undefined },
  });
}

function Section({
  label,
  action,
  children,
  grow,
}: {
  label: string;
  action?: ReactNode;
  children: ReactNode;
  grow?: boolean;
}) {
  return (
    <section className={[styles.section, grow ? styles.sectionGrow : ''].filter(Boolean).join(' ')}>
      <div className={styles.sectionLabel}>
        <span>{label}</span>
        <span className={styles.sectionLine} />
        {action}
      </div>
      {children}
    </section>
  );
}
