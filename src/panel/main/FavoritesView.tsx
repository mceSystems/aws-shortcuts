import type { Account, Favorite } from '@/shared/types';
import type { OpenTabInfo } from '@/shared/sessionStorage';
import { sanitizeConsolePathForFavorite } from '@/shared/consoleUrl';
import { send } from '@/shared/messages';
import { openOrFocusTab } from '@/shared/tabs';
import { TabRow } from './TabRow';
import styles from './TabsSection.module.css';

type Props = {
  favorites: Favorite[];
  accounts: Account[];
  openTabs: OpenTabInfo[];
};

export function FavoritesView({ favorites, accounts, openTabs }: Props) {
  if (favorites.length === 0) {
    return <div className={styles.empty}>No favorites yet</div>;
  }
  const accountById = new Map(accounts.map((a) => [a.accountId, a]));
  return (
    <div className={styles.list}>
      {favorites.map((f) => (
        <TabRow
          key={f.id}
          serviceId={f.serviceId}
          consolePath={f.consolePath}
          account={accountById.get(f.accountId)}
          accountFallbackId={f.accountId}
          roleName={f.roleName}
          region={f.region}
          label={f.label}
          onClick={() => launchFavorite(f, openTabs)}
          trailing={<LaunchIcon />}
        />
      ))}
    </div>
  );
}

async function launchFavorite(f: Favorite, openTabs: OpenTabInfo[]): Promise<void> {
  // Already open in this account/role/region with the exact same path?
  // Focus the last-observed tab instead of spawning a duplicate.
  const match = findExactOpenMatch(f, openTabs);
  if (match) {
    try {
      await chrome.tabs.update(match.tabId, { active: true });
      if (match.windowId !== -1) {
        await chrome.windows.update(match.windowId, { focused: true });
      }
      return;
    } catch (e) {
      console.warn('[aws-shortcut/panel] focus existing tab failed; falling through', e);
    }
  }
  const res = await send({
    type: 'RESOLVE_LAUNCH_URL',
    accountId: f.accountId,
    roleName: f.roleName,
    region: f.region,
    consolePath: f.consolePath,
    serviceId: f.serviceId,
    featurePath: f.featurePath,
  });
  if (!res.ok || !res.url) {
    console.warn('[aws-shortcut/panel] launch favorite failed', res);
    return;
  }
  await openOrFocusTab(res.url);
}

function findExactOpenMatch(f: Favorite, openTabs: OpenTabInfo[]): OpenTabInfo | undefined {
  let best: OpenTabInfo | undefined;
  for (const t of openTabs) {
    if (t.accountId !== f.accountId) continue;
    if (t.roleName !== f.roleName) continue;
    if (t.region !== f.region) continue;
    if (sanitizeConsolePathForFavorite(t.consolePath) !== f.consolePath) continue;
    if (!best || t.observedAt > best.observedAt) best = t;
  }
  return best;
}

function LaunchIcon() {
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
