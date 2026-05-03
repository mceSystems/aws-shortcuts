import type { Account, Recent } from '@/shared/types';
import type { OpenTabInfo } from '@/shared/sessionStorage';
import { send } from '@/shared/messages';
import { openOrFocusTab } from '@/shared/tabs';
import { TabRow } from './TabRow';
import styles from './TabsSection.module.css';

type Props = {
  recents: Recent[];
  openTabs: OpenTabInfo[];
  accounts: Account[];
};

export function RecentList({ recents, openTabs, accounts }: Props) {
  const openKeys = new Set(openTabs.map((t) => t.dedupeKey).filter(Boolean));
  const filtered = recents.filter((r) => !openKeys.has(r.dedupeKey));

  if (filtered.length === 0) {
    return <div className={styles.empty}>No recently closed tabs.</div>;
  }
  const accountById = new Map(accounts.map((a) => [a.accountId, a]));
  return (
    <div className={styles.list}>
      {filtered.map((r) => (
        <TabRow
          key={r.id}
          serviceId={r.serviceId}
          consolePath={r.consolePath}
          account={accountById.get(r.accountId)}
          accountFallbackId={r.accountId}
          roleName={r.roleName}
          region={r.region}
          title={r.title}
          onClick={() => relaunch(r)}
          trailing={<RelaunchIcon />}
        />
      ))}
    </div>
  );
}

async function relaunch(r: Recent): Promise<void> {
  const res = await send({
    type: 'RESOLVE_LAUNCH_URL',
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
