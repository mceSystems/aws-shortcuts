import { Fragment, useState } from 'react';
import type { Account } from '@/shared/types';
import type { OpenTabInfo } from '@/shared/sessionStorage';
import { TabRow } from './TabRow';
import { buildRowPendingFavorite } from './buildRowPendingFavorite';
import { OpenInOtherPanel } from './OpenInOtherPanel';
import type { PendingFavorite } from './SaveFavoriteBanner';
import styles from './TabsSection.module.css';

type Props = {
  openTabs: OpenTabInfo[];
  accounts: Account[];
  onRequestSaveFavorite?: (pending: PendingFavorite) => void;
};

export function OpenList({ openTabs, accounts, onRequestSaveFavorite }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (openTabs.length === 0) {
    return <div className={styles.empty}>No AWS console tabs open.</div>;
  }
  const accountById = new Map(accounts.map((a) => [a.accountId, a]));
  const sorted = [...openTabs].sort((a, b) => b.observedAt - a.observedAt);
  return (
    <div className={styles.list}>
      {sorted.map((t) => {
        const rowId = String(t.tabId);
        const expanded = expandedId === rowId;
        return (
          <Fragment key={rowId}>
            <TabRow
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
                  <MoreButton
                    active={expanded}
                    onClick={() => setExpandedId(expanded ? null : rowId)}
                  />
                  <FocusIcon />
                </>
              }
            />
            {expanded && (
              <OpenInOtherPanel
                accounts={accounts}
                initialAccountId={t.accountId}
                initialRoleName={t.roleName}
                initialRegion={t.region}
                serviceId={t.serviceId}
                consolePath={t.consolePath}
                onClose={() => setExpandedId(null)}
              />
            )}
          </Fragment>
        );
      })}
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

function MoreButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={[styles.rowSaveBtn, active ? styles.rowSaveBtnActive : ''].filter(Boolean).join(' ')}
      title="Open in another account/role/region"
      aria-label="Open in another account/role/region"
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <circle cx="5" cy="12" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="19" cy="12" r="1.5" />
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
