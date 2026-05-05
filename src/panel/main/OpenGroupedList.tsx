import { useEffect, useMemo, useRef, useState } from 'react';
import type { Account } from '@/shared/types';
import type { OpenTabInfo } from '@/shared/sessionStorage';
import { send } from '@/shared/messages';
import { chipColor } from '@/shared/colors';
import { OpenList } from './OpenList';
import type { PendingFavorite } from './SaveFavoriteBanner';
import styles from './OpenGroupedList.module.css';

type Props = {
  openTabs: OpenTabInfo[];
  accounts: Account[];
  onRequestSaveFavorite?: (pending: PendingFavorite) => void;
  /** Optimistic-update hook from useOpenTabs — drops the row immediately
   *  on close while we wait for the storage event to land. */
  onTabRemovedLocally?: (tabId: number) => void;
};

type Section = {
  group: chrome.tabGroups.TabGroup;
  account: Account | undefined;
  tabs: OpenTabInfo[];
};

export function OpenGroupedList({
  openTabs,
  accounts,
  onRequestSaveFavorite,
  onTabRemovedLocally,
}: Props) {
  const groups = useTabGroups();

  const accountById = useMemo(
    () => new Map(accounts.map((a) => [a.accountId, a])),
    [accounts],
  );

  // Build a section for each Chrome group whose title matches an account
  // label. Tabs inside that group's window with matching accountId go in.
  const { sections, ungrouped } = useMemo(() => {
    const labelToAccount = new Map<string, Account>();
    for (const a of accounts) {
      labelToAccount.set(a.alias || a.name || a.accountId, a);
    }
    const tabIdsClaimed = new Set<number>();
    const sections: Section[] = [];
    for (const g of groups) {
      const title = g.title ?? '';
      const account = labelToAccount.get(title);
      if (!account) continue;
      const tabs = openTabs.filter(
        (t) =>
          t.windowId === g.windowId &&
          t.accountId === account.accountId,
      );
      if (!tabs.length) continue;
      for (const t of tabs) tabIdsClaimed.add(t.tabId);
      sections.push({
        group: g,
        account,
        tabs: [...tabs].sort((a, b) => b.observedAt - a.observedAt),
      });
    }
    sections.sort((a, b) => {
      const an = a.account?.alias || a.account?.name || '';
      const bn = b.account?.alias || b.account?.name || '';
      return an.localeCompare(bn);
    });
    const ungrouped = openTabs
      .filter((t) => !tabIdsClaimed.has(t.tabId))
      .sort((a, b) => b.observedAt - a.observedAt);
    return { sections, ungrouped };
  }, [openTabs, groups, accounts]);

  if (!openTabs.length) {
    return <div className={styles.empty}>No AWS console tabs open.</div>;
  }

  return (
    <>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.toolbarBtn}
          title="Group AWS tabs by account"
          onClick={() => {
            void send({ type: 'GROUP_BY_ACCOUNT' });
          }}
        >
          Group by account
        </button>
      </div>
      {sections.map((s) => (
        <GroupSection
          key={s.group.id}
          section={s}
          accountById={accountById}
          accounts={accounts}
          onRequestSaveFavorite={onRequestSaveFavorite}
          onTabRemovedLocally={onTabRemovedLocally}
        />
      ))}
      {ungrouped.length > 0 && (
        <OpenList
          openTabs={ungrouped}
          accounts={accounts}
          onRequestSaveFavorite={onRequestSaveFavorite}
          onTabRemovedLocally={onTabRemovedLocally}
          hideEmpty
        />
      )}
    </>
  );
}

function GroupSection({
  section,
  accounts,
  onRequestSaveFavorite,
  onTabRemovedLocally,
}: {
  section: Section;
  accountById: Map<string, Account>;
  accounts: Account[];
  onRequestSaveFavorite?: (pending: PendingFavorite) => void;
  onTabRemovedLocally?: (tabId: number) => void;
}) {
  const { group, account, tabs } = section;
  const collapsed = group.collapsed === true;
  const [armed, setArmed] = useState(false);
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!armed) return;
    armTimerRef.current = setTimeout(() => setArmed(false), 3000);
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest(`[data-group-header="${group.id}"]`)) setArmed(false);
    };
    document.addEventListener('mousedown', onDocClick, true);
    return () => {
      if (armTimerRef.current) clearTimeout(armTimerRef.current);
      document.removeEventListener('mousedown', onDocClick, true);
    };
  }, [armed, group.id]);

  const color = chipColor(account?.color);
  const label = account?.alias || account?.name || account?.accountId || '';
  const count = tabs.length;

  function toggleCollapse() {
    void send({
      type: 'TOGGLE_GROUP_COLLAPSED',
      groupId: group.id,
      collapsed: !collapsed,
    });
  }

  function onCloseClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (count >= 3 && !armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    if (onTabRemovedLocally) {
      for (const t of tabs) onTabRemovedLocally(t.tabId);
    }
    void send({ type: 'CLOSE_GROUP', groupId: group.id });
  }

  return (
    <div className={styles.section}>
      <button
        type="button"
        className={styles.header}
        style={{ ['--header-color' as string]: color }}
        data-group-header={group.id}
        onClick={toggleCollapse}
        aria-expanded={!collapsed}
      >
        <span className={styles.headerStripe} />
        <span
          className={[
            styles.chevron,
            collapsed ? styles.chevronCollapsed : '',
          ].filter(Boolean).join(' ')}
          aria-hidden
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
               strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
        <span className={styles.headerTitle}>{label}</span>
        <span className={styles.headerCount}>{count}</span>
        {armed ? (
          <span
            role="button"
            tabIndex={0}
            className={styles.confirmPill}
            onClick={onCloseClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onCloseClick(e as unknown as React.MouseEvent);
              }
            }}
          >
            Confirm close {count} tabs ✕
          </span>
        ) : (
          <button
            type="button"
            className={styles.headerClose}
            title={`Close ${count} tab${count === 1 ? '' : 's'} in ${label}`}
            aria-label={`Close ${count} tabs in ${label}`}
            onClick={onCloseClick}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                 strokeLinejoin="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </button>
      {!collapsed && (
        <div className={styles.sectionBody}>
          <OpenList
            openTabs={tabs}
            accounts={accounts}
            onRequestSaveFavorite={onRequestSaveFavorite}
            onTabRemovedLocally={onTabRemovedLocally}
            hideEmpty
          />
        </div>
      )}
    </div>
  );
}

function useTabGroups(): chrome.tabGroups.TabGroup[] {
  const [groups, setGroups] = useState<chrome.tabGroups.TabGroup[]>([]);
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      if (typeof chrome === 'undefined' || !chrome.tabGroups) return;
      chrome.tabGroups.query({}).then((g) => {
        if (alive) setGroups(g);
      });
    };
    refresh();
    if (typeof chrome === 'undefined' || !chrome.tabGroups) return;
    chrome.tabGroups.onCreated.addListener(refresh);
    chrome.tabGroups.onUpdated.addListener(refresh);
    chrome.tabGroups.onRemoved.addListener(refresh);
    chrome.tabGroups.onMoved.addListener(refresh);
    return () => {
      alive = false;
      chrome.tabGroups.onCreated.removeListener(refresh);
      chrome.tabGroups.onUpdated.removeListener(refresh);
      chrome.tabGroups.onRemoved.removeListener(refresh);
      chrome.tabGroups.onMoved.removeListener(refresh);
    };
  }, []);
  return groups;
}
