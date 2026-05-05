import { useState } from 'react';
import type { Account } from '@/shared/types';
import { send } from '@/shared/messages';
import { FavoritesView } from './FavoritesView';
import { OpenGroupedList } from './OpenGroupedList';
import { RecentList } from './RecentList';
import type { PendingFavorite } from './SaveFavoriteBanner';
import { useFavorites } from './useFavorites';
import { useOpenTabs } from './useOpenTabs';
import { useRecents } from './useRecents';
import styles from './TabsSection.module.css';

type Pill = 'favorites' | 'tabs';

type Props = {
  accounts: Account[];
  onRequestSaveFavorite?: (pending: PendingFavorite) => void;
  /** Header-only render for collapsed section: pill bar only, no body. */
  compact?: boolean;
  /** Controlled pill state (lifted into Main's persisted layout). */
  pill?: Pill;
  onPillChange?: (next: Pill) => void;
};

export function TabsSection({
  accounts,
  onRequestSaveFavorite,
  compact,
  pill: pillProp,
  onPillChange,
}: Props) {
  const [pillUncontrolled, setPillUncontrolled] = useState<Pill>('favorites');
  const pill = pillProp ?? pillUncontrolled;
  const setPill = (next: Pill) => {
    if (onPillChange) onPillChange(next);
    else setPillUncontrolled(next);
  };
  const [favoritesEditing, setFavoritesEditing] = useState(false);
  const { openTabs, removeLocally: removeOpenTabLocally } = useOpenTabs();
  const { recents } = useRecents();
  const { favorites } = useFavorites();

  if (compact) {
    return (
      <section className={styles.section}>
        <div className={styles.pillBar} data-compact-clickable="">
          <button
            type="button"
            className={[styles.pill, pill === 'favorites' ? styles.pillActive : '']
              .filter(Boolean)
              .join(' ')}
            onClick={() => setPill('favorites')}
          >
            <StarIcon />
            <span>Favorites</span>
            {favorites.length > 0 && <span className={styles.count}>{favorites.length}</span>}
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
      </section>
    );
  }

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
          {favorites.length > 0 && <span className={styles.count}>{favorites.length}</span>}
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

      {pill === 'favorites' && favorites.length > 0 && (
        <div className={styles.actionRow}>
          <span className={styles.subLabel}>{favorites.length} saved</span>
          <button
            type="button"
            className={styles.editBtn}
            aria-pressed={favoritesEditing}
            aria-label={favoritesEditing ? 'Done editing' : 'Edit favorites'}
            title={favoritesEditing ? 'Done' : 'Edit favorites'}
            onClick={() => setFavoritesEditing((v) => !v)}
          >
            {favoritesEditing ? <CheckIcon /> : <PencilIcon />}
          </button>
        </div>
      )}

      <div className={styles.body}>
        {pill === 'favorites' ? (
          <FavoritesView
            favorites={favorites}
            accounts={accounts}
            openTabs={openTabs}
            editing={favoritesEditing}
          />
        ) : (
          <>
            <div className={styles.subLabel}>Open</div>
            <OpenGroupedList
              openTabs={openTabs}
              accounts={accounts}
              onRequestSaveFavorite={onRequestSaveFavorite}
              onTabRemovedLocally={removeOpenTabLocally}
            />
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
            <RecentList
              recents={recents}
              openTabs={openTabs}
              accounts={accounts}
              onRequestSaveFavorite={onRequestSaveFavorite}
            />
          </>
        )}
      </div>
    </section>
  );
}

function PencilIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
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
