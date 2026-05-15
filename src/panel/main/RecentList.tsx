import { Fragment, useState } from 'react';
import type { Account, Recent } from '@/shared/types';
import type { OpenTabInfo } from '@/shared/sessionStorage';
import { send } from '@/shared/messages';
import { closePanelIfPrefSet } from '@/shared/closePanel';
import { openOrFocusTab } from '@/shared/tabs';
import { TabRow } from './TabRow';
import { buildRowPendingFavorite } from './buildRowPendingFavorite';
import { OpenInOtherPanel } from './OpenInOtherPanel';
import type { PendingFavorite } from './SaveFavoriteBanner';
import styles from './TabsSection.module.css';

type Props = {
  recents: Recent[];
  openTabs: OpenTabInfo[];
  accounts: Account[];
  onRequestSaveFavorite?: (pending: PendingFavorite) => void;
};

export function RecentList({ recents, openTabs, accounts, onRequestSaveFavorite }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const openKeys = new Set(openTabs.map((t) => t.dedupeKey).filter(Boolean));
  const filtered = recents.filter((r) => !openKeys.has(r.dedupeKey));

  if (filtered.length === 0) {
    return <div className={styles.empty}>No recently closed tabs.</div>;
  }
  const accountById = new Map(accounts.map((a) => [a.accountId, a]));
  return (
    <div className={styles.list}>
      {filtered.map((r) => {
        const expanded = expandedId === r.id;
        return (
          <Fragment key={r.id}>
            <TabRow
              serviceId={r.serviceId}
              consolePath={r.consolePath}
              account={accountById.get(r.accountId)}
              accountFallbackId={r.accountId}
              roleName={r.roleName}
              region={r.region}
              title={r.title}
              onClick={() => relaunch(r)}
              trailing={
                <>
                  {onRequestSaveFavorite && (
                    <SaveButton
                      onClick={() => {
                        const pending = buildRowPendingFavorite(r, accounts);
                        if (pending) onRequestSaveFavorite(pending);
                      }}
                    />
                  )}
                  <MoreButton
                    active={expanded}
                    onClick={() => setExpandedId(expanded ? null : r.id)}
                  />
                  <RelaunchIcon />
                </>
              }
            />
            {expanded && (
              <OpenInOtherPanel
                accounts={accounts}
                initialAccountId={r.accountId}
                initialRoleName={r.roleName}
                initialRegion={r.region}
                serviceId={r.serviceId}
                consolePath={r.consolePath}
                onClose={() => setExpandedId(null)}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

async function relaunch(r: Recent): Promise<void> {
  const res = await send({
    type: 'RESOLVE_LAUNCH_URL',
    identityCenterId: r.identityCenterId,
    accountId: r.accountId,
    roleName: r.roleName,
    region: r.region,
    consolePath: r.consolePath,
    serviceId: r.serviceId,
  });
  if (!res.ok || !res.url) {
    console.warn('[aws-shortcut/panel] relaunch failed', res);
    return;
  }
  await openOrFocusTab(res.url);
  void closePanelIfPrefSet();
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

function RelaunchIcon() {
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
      <path d="M14 3h7v7" />
      <path d="M21 3 11 13" />
      <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </svg>
  );
}
