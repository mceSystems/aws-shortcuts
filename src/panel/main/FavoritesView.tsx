import type { Account, Favorite } from '@/shared/types';
import { send } from '@/shared/messages';
import { openOrFocusTab } from '@/shared/tabs';
import { TabRow } from './TabRow';
import styles from './TabsSection.module.css';

type Props = {
  favorites: Favorite[];
  accounts: Account[];
};

export function FavoritesView({ favorites, accounts }: Props) {
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
          onClick={() => launchFavorite(f)}
          trailing={<LaunchIcon />}
        />
      ))}
    </div>
  );
}

async function launchFavorite(f: Favorite): Promise<void> {
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
