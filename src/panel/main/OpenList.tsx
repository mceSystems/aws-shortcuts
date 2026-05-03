import type { Account } from '@/shared/types';
import type { OpenTabInfo } from '@/shared/sessionStorage';
import { TabRow } from './TabRow';
import { buildRowPendingFavorite } from './buildRowPendingFavorite';
import type { PendingFavorite } from './SaveFavoriteBanner';
import styles from './TabsSection.module.css';

type Props = {
  openTabs: OpenTabInfo[];
  accounts: Account[];
  onRequestSaveFavorite?: (pending: PendingFavorite) => void;
};

export function OpenList({ openTabs, accounts, onRequestSaveFavorite }: Props) {
  if (openTabs.length === 0) {
    return <div className={styles.empty}>No AWS console tabs open.</div>;
  }
  const accountById = new Map(accounts.map((a) => [a.accountId, a]));
  // Most-recently observed first.
  const sorted = [...openTabs].sort((a, b) => b.observedAt - a.observedAt);
  return (
    <div className={styles.list}>
      {sorted.map((t) => (
        <TabRow
          key={t.tabId}
          serviceId={t.serviceId}
          consolePath={t.consolePath}
          account={accountById.get(t.accountId)}
          accountFallbackId={t.accountId}
          roleName={t.roleName}
          region={t.region}
          title={t.title}
          onClick={() => focusTab(t.tabId, t.windowId)}
          trailing={
            <>
              {onRequestSaveFavorite && (
                <SaveButton
                  onClick={() => {
                    const pending = buildRowPendingFavorite(t, accounts);
                    if (pending) onRequestSaveFavorite(pending);
                  }}
                />
              )}
              <FocusIcon />
            </>
          }
        />
      ))}
    </div>
  );
}

async function focusTab(tabId: number, windowId: number): Promise<void> {
  try {
    await chrome.tabs.update(tabId, { active: true });
    if (windowId !== -1) await chrome.windows.update(windowId, { focused: true });
  } catch (e) {
    console.warn('[aws-shortcut/panel] focus tab failed', e);
  }
}

function SaveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className={styles.rowSaveBtn}
      title="Save as favorite"
      aria-label="Save as favorite"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
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
        <path d="M12 2 15 8.5 22 9.3l-5.2 4.8L18.2 21 12 17.5 5.8 21l1.4-6.9L2 9.3 9 8.5z" />
      </svg>
    </button>
  );
}

function FocusIcon() {
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
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </svg>
  );
}
