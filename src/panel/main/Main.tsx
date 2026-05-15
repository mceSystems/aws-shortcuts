import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Header } from './Header';
import { AccountList, AccountsEditButton } from './AccountList';
import { ServiceSearch } from './ServiceSearch';
import { TabsSection } from './TabsSection';
import { SaveFavoriteBanner, type PendingFavorite } from './SaveFavoriteBanner';
import { useAccounts } from '../hooks/useAccounts';
import { send } from '@/shared/messages';
import { getSync, rowKey, setSync } from '@/shared/storage';
import { openOrFocusTab } from '@/shared/tabs';
import styles from './Main.module.css';

type Props = {
  onOpenSettings?: () => void;
};

type SectionId = 'account' | 'service' | 'favorites';
type FavoritesPill = 'favorites' | 'tabs';

type LayoutState = {
  order: SectionId[];
  weights: Record<SectionId, number>;
  collapsed: Record<SectionId, boolean>;
  favoritesPill: FavoritesPill;
};

const DEFAULT_LAYOUT: LayoutState = {
  order: ['account', 'service', 'favorites'],
  weights: { account: 2, service: 2, favorites: 1 },
  collapsed: { account: false, service: false, favorites: false },
  favoritesPill: 'favorites',
};

const LAYOUT_STORAGE_KEY = 'panel.section.layout.v2';
const MIN_SECTION_PX = 60;

export function Main({ onOpenSettings }: Props) {
  const {
    accounts,
    accountOrder,
    hiddenAccountIds,
    identityCenters,
    prefs,
    loaded,
  } = useAccounts();
  // selectedId is a composite row key (`${identityCenterId}:${accountId}`)
  // so the same accountId in two IdCs can be selected independently.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const initRef = useState({ done: false })[0];

  const [layout, setLayout] = useState<LayoutState>(loadLayout);
  const [pendingFavorite, setPendingFavorite] = useState<PendingFavorite | null>(null);
  const persistDebounce = useRef<number | null>(null);
  const persistLayout = useCallback((next: LayoutState) => {
    if (persistDebounce.current !== null) clearTimeout(persistDebounce.current);
    persistDebounce.current = window.setTimeout(() => saveLayout(next), 120);
  }, []);
  useEffect(() => persistLayout(layout), [layout, persistLayout]);

  // Restore last-selected account once accounts + prefs have loaded.
  useEffect(() => {
    if (!loaded || initRef.done) return;
    initRef.done = true;
    const last = prefs?.lastSelectedAccountId;
    if (
      last &&
      accounts.some((a) => rowKey(a.identityCenterId, a.accountId) === last)
    ) {
      setSelectedId(last);
    }
  }, [loaded, prefs, accounts, initRef]);

  function selectAccount(id: string | null) {
    setSelectedId(id);
    void persistLastSelected(id);
  }

  const selectedAccount = useMemo(
    () =>
      accounts.find((a) => rowKey(a.identityCenterId, a.accountId) === selectedId) ?? null,
    [accounts, selectedId],
  );

  const selectedIdentityCenter = useMemo(
    () =>
      selectedAccount
        ? identityCenters.find((i) => i.id === selectedAccount.identityCenterId) ?? null
        : null,
    [identityCenters, selectedAccount],
  );

  // Header "open portal" target: selected account's IdC, else first IdC.
  const headerPortal = selectedIdentityCenter ?? identityCenters[0];

  const sectionRefs = useRef<Record<SectionId, HTMLElement | null>>({
    account: null,
    service: null,
    favorites: null,
  });

  function toggleCollapsed(id: SectionId) {
    setLayout((cur) => ({
      ...cur,
      collapsed: { ...cur.collapsed, [id]: !cur.collapsed[id] },
    }));
  }

  function reorder(fromId: SectionId, toId: SectionId, before: boolean) {
    if (fromId === toId) return;
    setLayout((cur) => {
      const order = cur.order.filter((id) => id !== fromId);
      const toIdx = order.indexOf(toId);
      const insertAt = before ? toIdx : toIdx + 1;
      order.splice(insertAt, 0, fromId);
      return { ...cur, order };
    });
  }

  const sections: Record<
    SectionId,
    { label: string; render: (compact: boolean) => ReactNode; action?: ReactNode }
  > = useMemo(
    () => ({
      account: {
        label: 'Account',
        action:
          loaded && accounts.length > 0 ? (
            <AccountsEditButton
              editing={editing}
              onToggle={() => setEditing((v) => !v)}
            />
          ) : null,
        render: (compact) =>
          loaded ? (
            <AccountList
              accounts={accounts}
              accountOrder={accountOrder}
              hiddenAccountIds={hiddenAccountIds}
              selectedId={selectedId}
              onSelect={(id) => { if (id !== selectedId) selectAccount(id); }}
              editing={editing}
              compactSelected={compact}
            />
          ) : (
            <div className={styles.skeleton} />
          ),
      },
      service: {
        label: selectedAccount ? 'Features Explorer' : 'Pick an account first',
        render: (compact) => (
          <ServiceSearch
            account={selectedAccount}
            identityCenter={selectedIdentityCenter}
            onRequestSaveFavorite={setPendingFavorite}
            compact={compact}
          />
        ),
      },
      favorites: {
        label: 'Favorites',
        render: (compact) => (
          <TabsSection
            accounts={accounts}
            onRequestSaveFavorite={setPendingFavorite}
            compact={compact}
            pill={layout.favoritesPill}
            onPillChange={(p) => setLayout((cur) => ({ ...cur, favoritesPill: p }))}
          />
        ),
      },
    }),
    [
      loaded,
      accounts,
      accountOrder,
      hiddenAccountIds,
      identityCenters,
      selectedId,
      editing,
      selectedAccount,
      selectedIdentityCenter,
      layout.favoritesPill,
    ],
  );

  // Build the visible list. While editing accounts the panel hides Service and
  // Tabs to give the account list full focus.
  const visibleOrder = editing ? (['account'] as SectionId[]) : layout.order;
  const expandedIds = visibleOrder.filter((id) => !layout.collapsed[id]);

  return (
    <div className={styles.root}>
      <Header
        onSettings={onOpenSettings}
        onRefresh={() => {
          void send({ type: 'RESCAN_OPEN_TABS' });
        }}
        portalUrl={headerPortal?.startUrl}
        onOpenPortal={() => {
          if (headerPortal?.startUrl) {
            void openOrFocusTab(headerPortal.startUrl, {
              reuseUrlPrefix: headerPortal.startUrl,
            });
          }
        }}
      />

      {pendingFavorite && (
        <SaveFavoriteBanner
          pending={pendingFavorite}
          onClose={() => setPendingFavorite(null)}
        />
      )}

      <div className={styles.body}>
        {visibleOrder.map((id) => {
          const cfg = sections[id];
          const collapsed = layout.collapsed[id];
          const weight = layout.weights[id];
          const expandedIdx = expandedIds.indexOf(id);
          const nextExpanded = expandedIds[expandedIdx + 1];
          const showResizer = !editing && !collapsed && nextExpanded !== undefined;
          return (
            <Fragment key={id}>
              <Section
                id={id}
                label={cfg.label}
                action={cfg.action}
                collapsed={collapsed}
                weight={weight}
                onToggleCollapsed={() => toggleCollapsed(id)}
                onReorder={editing ? undefined : reorder}
                refSetter={(el) => {
                  sectionRefs.current[id] = el;
                }}
              >
                {cfg.render(collapsed)}
              </Section>
              {showResizer && (
                <Resizer
                  topId={id}
                  bottomId={nextExpanded}
                  layout={layout}
                  setLayout={setLayout}
                  refs={sectionRefs}
                />
              )}
            </Fragment>
          );
        })}
      </div>

    </div>
  );
}

async function persistLastSelected(accountId: string | null): Promise<void> {
  const sync = await getSync();
  await setSync({
    prefs: { ...sync.prefs, lastSelectedAccountId: accountId ?? undefined },
  });
}

function loadLayout(): LayoutState {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<LayoutState>;
    return {
      order: sanitizeOrder(parsed.order),
      weights: { ...DEFAULT_LAYOUT.weights, ...(parsed.weights ?? {}) },
      collapsed: { ...DEFAULT_LAYOUT.collapsed, ...(parsed.collapsed ?? {}) },
      favoritesPill: parsed.favoritesPill ?? DEFAULT_LAYOUT.favoritesPill,
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function saveLayout(state: LayoutState): void {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / disabled storage
  }
}

function sanitizeOrder(order: SectionId[] | undefined): SectionId[] {
  const all: SectionId[] = ['account', 'service', 'favorites'];
  if (!order) return DEFAULT_LAYOUT.order;
  const seen = new Set<SectionId>();
  const cleaned = order.filter((id): id is SectionId => {
    if (!all.includes(id)) return false;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  for (const id of all) if (!seen.has(id)) cleaned.push(id);
  return cleaned;
}

function Section({
  id,
  label,
  action,
  children,
  collapsed,
  weight,
  onToggleCollapsed,
  onReorder,
  refSetter,
}: {
  id: SectionId;
  label: string;
  action?: ReactNode;
  children: ReactNode;
  collapsed: boolean;
  weight: number;
  onToggleCollapsed: () => void;
  onReorder?: (fromId: SectionId, toId: SectionId, before: boolean) => void;
  refSetter: (el: HTMLElement | null) => void;
}) {
  const [dropHint, setDropHint] = useState<'before' | 'after' | null>(null);

  const style: CSSProperties = collapsed
    ? { flex: '0 0 auto' }
    : { flex: `${weight} 1 0` };

  const draggable = onReorder !== undefined;

  return (
    <section
      ref={refSetter}
      className={[
        styles.section,
        !collapsed ? styles.sectionGrow : '',
        dropHint === 'before' ? styles.dropBefore : '',
        dropHint === 'after' ? styles.dropAfter : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      onDragOver={
        draggable
          ? (e) => {
              const types = Array.from(e.dataTransfer.types);
              if (!types.includes('application/x-section-id')) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              const rect = e.currentTarget.getBoundingClientRect();
              setDropHint(e.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
            }
          : undefined
      }
      onDragLeave={draggable ? () => setDropHint(null) : undefined}
      onDrop={
        draggable
          ? (e) => {
              const fromId = e.dataTransfer.getData('application/x-section-id') as SectionId;
              if (!fromId) return;
              e.preventDefault();
              onReorder?.(fromId, id, dropHint !== 'after');
              setDropHint(null);
            }
          : undefined
      }
    >
      <div
        className={[styles.sectionLabel, collapsed ? styles.sectionLabelCollapsed : '']
          .filter(Boolean)
          .join(' ')}
        draggable={draggable}
        onDragStart={
          draggable
            ? (e) => {
                e.dataTransfer.setData('application/x-section-id', id);
                e.dataTransfer.effectAllowed = 'move';
              }
            : undefined
        }
        onClick={collapsed ? onToggleCollapsed : undefined}
        role={collapsed ? 'button' : undefined}
        tabIndex={collapsed ? 0 : undefined}
        onKeyDown={
          collapsed
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggleCollapsed();
                }
              }
            : undefined
        }
      >
        <button
          type="button"
          className={styles.sectionToggle}
          aria-expanded={!collapsed}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapsed();
          }}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <span
            className={[styles.sectionCaret, !collapsed ? styles.sectionCaretOpen : '']
              .filter(Boolean)
              .join(' ')}
            aria-hidden
          >
            ›
          </span>
          <span>{label}</span>
        </button>
        <span className={styles.sectionLine} />
        {!collapsed && action}
        {draggable && (
          <span className={styles.sectionGrip} aria-hidden title="Drag to reorder">
            <GripIcon />
          </span>
        )}
      </div>
      {collapsed ? (
        <div
          className={styles.collapsedBody}
          onClick={onToggleCollapsed}
          // `inert` removes the collapsed subtree from focus + a11y tree
          // without the aria-hidden-with-focused-descendant warning Chrome
          // emits. Cast: React 18 JSX types don't include `inert` yet.
          {...({ inert: '' } as Record<string, string>)}
        >
          {children}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function Resizer({
  topId,
  bottomId,
  layout,
  setLayout,
  refs,
}: {
  topId: SectionId;
  bottomId: SectionId;
  layout: LayoutState;
  setLayout: (fn: (cur: LayoutState) => LayoutState) => void;
  refs: React.MutableRefObject<Record<SectionId, HTMLElement | null>>;
}) {
  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    const top = refs.current[topId];
    const bottom = refs.current[bottomId];
    if (!top || !bottom) return;
    const startY = e.clientY;
    const topH = top.offsetHeight;
    const bottomH = bottom.offsetHeight;
    const totalH = topH + bottomH;
    const wTop = layout.weights[topId];
    const wBottom = layout.weights[bottomId];
    const wTotal = wTop + wBottom;

    function onMove(m: MouseEvent) {
      const dy = m.clientY - startY;
      const newTopH = Math.max(MIN_SECTION_PX, Math.min(totalH - MIN_SECTION_PX, topH + dy));
      const newWTop = (newTopH / totalH) * wTotal;
      const newWBottom = wTotal - newWTop;
      setLayout((cur) => ({
        ...cur,
        weights: { ...cur.weights, [topId]: newWTop, [bottomId]: newWBottom },
      }));
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (styles.resizingBody) document.body.classList.remove(styles.resizingBody);
    }
    if (styles.resizingBody) document.body.classList.add(styles.resizingBody);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  return (
    <div
      className={styles.resizer}
      role="separator"
      aria-orientation="horizontal"
      onMouseDown={onMouseDown}
    >
      <span className={styles.resizerHandle} />
    </div>
  );
}

function GripIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="9" cy="5" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="15" cy="5" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="15" cy="19" r="1.5" />
    </svg>
  );
}

