import { useState } from 'react';
import type { Account, Favorite } from '@/shared/types';
import type { OpenTabInfo } from '@/shared/sessionStorage';
import { sanitizeConsolePathForFavorite } from '@/shared/consoleUrl';
import { chipColor } from '@/shared/colors';
import { findServiceById } from '@/shared/serviceCatalog';
import { send } from '@/shared/messages';
import { openOrFocusTab } from '@/shared/tabs';
import { ServiceIcon } from './ServiceIcon';
import { TabRow } from './TabRow';
import styles from './TabsSection.module.css';
import editStyles from './FavoritesEdit.module.css';

type Props = {
  favorites: Favorite[];
  accounts: Account[];
  openTabs: OpenTabInfo[];
  editing: boolean;
};

export function FavoritesView({ favorites, accounts, openTabs, editing }: Props) {
  if (favorites.length === 0) {
    return <div className={styles.empty}>No favorites yet</div>;
  }
  if (editing) {
    return <FavoritesEditList favorites={favorites} accounts={accounts} />;
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

type DropTarget = { id: string; before: boolean } | null;

function FavoritesEditList({
  favorites,
  accounts,
}: {
  favorites: Favorite[];
  accounts: Account[];
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const accountById = new Map(accounts.map((a) => [a.accountId, a]));

  function commitDrop(target: DropTarget) {
    if (!draggingId || !target) return;
    if (target.id === draggingId) return;
    const ids = favorites.map((f) => f.id).filter((id) => id !== draggingId);
    const idx = ids.indexOf(target.id);
    const insertAt = target.before ? idx : idx + 1;
    ids.splice(insertAt, 0, draggingId);
    void send({ type: 'REORDER_FAVORITES', ids });
  }

  function startRename(f: Favorite) {
    setRenamingId(f.id);
    setDraft(f.label);
  }

  function commitRename() {
    if (!renamingId) return;
    const next = draft.trim();
    const cur = favorites.find((f) => f.id === renamingId);
    if (next && cur && next !== cur.label) {
      void send({ type: 'UPDATE_FAVORITE', id: renamingId, patch: { label: next } });
    }
    setRenamingId(null);
  }

  function cancelRename() {
    setRenamingId(null);
  }

  function deleteFav(id: string) {
    void send({ type: 'DELETE_FAVORITE', id });
  }

  return (
    <div className={editStyles.list}>
      {favorites.map((f) => {
        const account = accountById.get(f.accountId);
        const color = chipColor(account?.color);
        const service = findServiceById(f.serviceId);
        const isDragging = draggingId === f.id;
        const indicator =
          dropTarget?.id === f.id
            ? dropTarget.before
              ? editStyles.dropBefore
              : editStyles.dropAfter
            : '';
        const isRenaming = renamingId === f.id;
        return (
          <div
            key={f.id}
            className={[
              editStyles.row,
              isDragging ? editStyles.dragging : '',
              indicator,
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ ['--row-color' as string]: color }}
            draggable={!isRenaming}
            onDragStart={(e) => {
              if (isRenaming) return;
              setDraggingId(f.id);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', f.id);
            }}
            onDragEnd={() => {
              setDraggingId(null);
              setDropTarget(null);
            }}
            onDragOver={(e) => {
              if (!draggingId || draggingId === f.id) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const before = e.clientY < rect.top + rect.height / 2;
              setDropTarget({ id: f.id, before });
            }}
            onDrop={(e) => {
              e.preventDefault();
              commitDrop(dropTarget);
              setDraggingId(null);
              setDropTarget(null);
            }}
          >
            <span className={editStyles.handle} aria-hidden>
              <GripIcon />
            </span>
            <span className={editStyles.stripe} aria-hidden />
            <ServiceIcon
              id={f.serviceId}
              name={service?.name ?? f.serviceId}
              fallbackBg={color}
              size={18}
            />
            {isRenaming ? (
              <input
                className={editStyles.input}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelRename();
                  }
                }}
                autoFocus
                onFocus={(e) => e.currentTarget.select()}
                spellCheck={false}
              />
            ) : (
              <button
                type="button"
                className={editStyles.label}
                title="Rename"
                onClick={() => startRename(f)}
              >
                {f.label}
              </button>
            )}
            <button
              type="button"
              className={editStyles.deleteBtn}
              title="Delete favorite"
              aria-label="Delete favorite"
              onClick={() => deleteFav(f.id)}
            >
              <CrossIcon />
            </button>
          </div>
        );
      })}
    </div>
  );
}

async function launchFavorite(f: Favorite, openTabs: OpenTabInfo[]): Promise<void> {
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

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="9" cy="5" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="15" cy="5" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="15" cy="19" r="1.5" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
    </svg>
  );
}
