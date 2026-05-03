import { useState } from 'react';
import type { Account } from '@/shared/types';
import { send } from '@/shared/messages';
import { OpenList } from './OpenList';
import { RecentList } from './RecentList';
import { useOpenTabs } from './useOpenTabs';
import { useRecents } from './useRecents';
import styles from './TabsSection.module.css';

type Pill = 'favorites' | 'tabs';

type Props = {
  accounts: Account[];
};

export function TabsSection({ accounts }: Props) {
  const [pill, setPill] = useState<Pill>('favorites');
  const { openTabs } = useOpenTabs();
  const { recents } = useRecents();

  return (
    <section className={styles.section}>
      <div className={styles.pillBar}>
        <button
          type="button"
          className={[styles.pill, pill === 'favorites' ? styles.pillActive : '']
            .filter(Boolean)
            .join(' ')}
          onClick={() => setPill('favorites')}
        >
          <StarIcon />
          <span>Favorites</span>
        </button>
        <button
          type="button"
          className={[styles.pill, pill === 'tabs' ? styles.pillActive : '']
            .filter(Boolean)
            .join(' ')}
          onClick={() => setPill('tabs')}
        >
          <TabsIcon />
          <span>Tabs</span>
          {openTabs.length > 0 && <span className={styles.count}>{openTabs.length}</span>}
        </button>
      </div>

      <div className={styles.body}>
        {pill === 'favorites' ? (
          <div className={styles.empty}>No favorites yet</div>
        ) : (
          <>
            <div className={styles.subLabel}>Open</div>
            <OpenList openTabs={openTabs} accounts={accounts} />
            <div className={styles.subLabelRow}>
              <span className={styles.subLabel}>Recently closed</span>
              {recents.length > 0 && (
                <button
                  type="button"
                  className={styles.clearBtn}
                  title="Clear recently closed"
                  onClick={() => {
                    void send({ type: 'CLEAR_RECENTS' });
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            <RecentList recents={recents} openTabs={openTabs} accounts={accounts} />
          </>
        )}
      </div>
    </section>
  );
}

function StarIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2 15 8.5 22 9.3l-5.2 4.8L18.2 21 12 17.5 5.8 21l1.4-6.9L2 9.3 9 8.5z" />
    </svg>
  );
}

function TabsIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="6" width="14" height="14" rx="2" />
      <path d="M7 6V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2" />
    </svg>
  );
}
