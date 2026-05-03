import { useEffect, useMemo, useRef, useState } from 'react';
import type { Account, ServiceCatalogEntry, SsoConfig } from '@/shared/types';
import { type CatalogHit, rankCatalog } from '@/shared/serviceCatalog';
import { subscribeCatalog } from '@/shared/catalogStore';
import { OPEN_COUNTS_STORAGE_KEY } from '@/shared/openCounts';
import { send } from '@/shared/messages';
import { chipColor, NEUTRAL_COLOR } from '@/shared/colors';
import { ServiceIcon } from './ServiceIcon';
import styles from './ServiceSearch.module.css';

import type { PendingFavorite } from './SaveFavoriteBanner';

type Props = {
  account: Account | null;
  ssoConfig?: SsoConfig;
  onRequestSaveFavorite?: (pending: PendingFavorite) => void;
  /** Header-only render for collapsed section: input row only, no list/picker. */
  compact?: boolean;
};

export function ServiceSearch({ account, ssoConfig, onRequestSaveFavorite, compact }: Props) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [featureCursor, setFeatureCursor] = useState(0);
  const [pickedFeature, setPickedFeature] = useState<{
    serviceId: string;
    featureIdx: number | null;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const pickerListRef = useRef<HTMLUListElement>(null);
  const cursorSource = useRef<'mouse' | 'keyboard'>('keyboard');
  const [catalogTick, setCatalogTick] = useState(0);
  const [openCounts, setOpenCounts] = useState<Record<string, number>>({});
  const [blockedTick, setBlockedTick] = useState(0);

  useEffect(() => subscribeCatalog(() => setCatalogTick((t) => t + 1)), []);

  useEffect(() => {
    void chrome.storage.local.get(OPEN_COUNTS_STORAGE_KEY).then((got) => {
      setOpenCounts((got[OPEN_COUNTS_STORAGE_KEY] as Record<string, number>) ?? {});
    });
    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: chrome.storage.AreaName,
    ) => {
      if (area !== 'local' || !changes[OPEN_COUNTS_STORAGE_KEY]) return;
      setOpenCounts((changes[OPEN_COUNTS_STORAGE_KEY].newValue as Record<string, number>) ?? {});
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  const hits = useMemo(
    () => rankCatalog(query, { openCounts }),
    [query, catalogTick, openCounts],
  );

  useEffect(() => {
    setCursor(0);
  }, [query]);

  // Clamp cursor when hits shrink (e.g. openCounts re-rank changed length).
  useEffect(() => {
    if (cursor > hits.length - 1) setCursor(Math.max(0, hits.length - 1));
  }, [hits]);

  // Scroll active list row into view. Uses getBoundingClientRect deltas
  // because the list isn't its own offsetParent (no position: relative),
  // so offsetTop would be measured from <body> and produce wrong scroll
  // math. Skip mouse-driven moves so hover doesn't yank the row out from
  // under the pointer mid-click. Re-runs when picker closes so the list
  // ul (unmounted while picker showed) re-scrolls to preserved cursor.
  useEffect(() => {
    if (pickedFeature) return;
    if (cursorSource.current === 'mouse') return;
    scrollRowIntoView(listRef.current, cursor);
  }, [cursor, pickedFeature]);

  // Same scroll-into-view for picker mode.
  useEffect(() => {
    if (!pickedFeature) return;
    if (cursorSource.current === 'mouse') return;
    scrollRowIntoView(pickerListRef.current, featureCursor);
  }, [featureCursor, pickedFeature]);

  useEffect(() => {
    setPickedFeature(null);
    setQuery('');
  }, [account?.accountId]);

  // Initial focus. Two passes (sync + RAF) cover the case where the side
  // panel isn't yet activated when the first focus runs. Plus a few
  // delayed retries because Chrome side panels sometimes get window focus
  // 50-200ms after first paint.
  useEffect(() => {
    function tryFocus() {
      window.focus();
      inputRef.current?.focus();
    }
    tryFocus();
    requestAnimationFrame(tryFocus);
    const t1 = window.setTimeout(tryFocus, 50);
    const t2 = window.setTimeout(tryFocus, 200);
    const t3 = window.setTimeout(tryFocus, 500);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, [account?.accountId]);

  // Re-focus input on any signal that the panel regained user attention.
  //  - window 'focus' / visibilitychange: user clicked back into the panel
  //    after opening a tab or switching apps.
  //  - pointerenter on body: user moved the mouse over the panel; we use
  //    that as an implicit "panel has user attention" signal so arrow nav
  //    works without requiring an explicit click first.
  useEffect(() => {
    function refocus() {
      if (document.visibilityState !== 'visible') return;
      if (pickedFeature) return;
      window.focus();
      inputRef.current?.focus();
    }
    window.addEventListener('focus', refocus);
    document.addEventListener('visibilitychange', refocus);
    document.addEventListener('pointerenter', refocus);
    return () => {
      window.removeEventListener('focus', refocus);
      document.removeEventListener('visibilitychange', refocus);
      document.removeEventListener('pointerenter', refocus);
    };
  }, [pickedFeature]);

  const role = account?.preferredRoleName ?? '';
  const region = account?.preferredRegion ?? '';

  const missingAccount = !account;
  const missingRole = Boolean(account) && !role;
  const missingRegion = Boolean(account) && !region;
  const missingPortal = !ssoConfig?.portalHost;

  async function open(service: ServiceCatalogEntry, featurePath?: string) {
    if (!account || missingRole || missingRegion || missingPortal) {
      console.warn('[ServiceSearch] open blocked', {
        missingAccount: !account,
        missingRole,
        missingRegion,
        missingPortal,
      });
      setBlockedTick((t) => t + 1);
      return;
    }
    const res = await send({
      type: 'RESOLVE_LAUNCH_URL',
      accountId: account.accountId,
      roleName: role,
      region,
      consolePath: featurePath ?? service.consolePath,
      serviceId: service.id,
      featurePath: featurePath,
    });
    if (!res.ok || !res.url) return;
    void chrome.tabs.create({ url: res.url });
    // Close picker so the next time the panel is visible the search input is
    // mounted and can receive focus + typing.
    setPickedFeature(null);
    inputRef.current?.focus();
  }

  function activate(hit: CatalogHit): void {
    if (missingAccount) return;
    if (hit.kind === 'feature') {
      open(hit.service, hit.feature.path);
      return;
    }
    if (hit.service.features && hit.service.features.length > 0) {
      setPickedFeature({ serviceId: hit.service.id, featureIdx: null });
      return;
    }
    open(hit.service);
  }

  function buildPending(
    service: ServiceCatalogEntry,
    featurePath?: string,
    featureName?: string,
  ): PendingFavorite | null {
    if (!account || missingRole || missingRegion) return null;
    const consolePath = featurePath ?? service.consolePath;
    const accountLabel = account.alias || account.name;
    const labelParts = [accountLabel, service.name];
    if (featureName) labelParts.push(featureName);
    return {
      defaultLabel: labelParts.join(' · '),
      accountId: account.accountId,
      roleName: role,
      region,
      serviceId: service.id,
      featurePath,
      consolePath,
    };
  }

  function requestSave(hit: CatalogHit): void {
    if (!onRequestSaveFavorite) return;
    const featurePath = hit.kind === 'feature' ? hit.feature.path : undefined;
    const featureName = hit.kind === 'feature' ? hit.feature.name : undefined;
    const pending = buildPending(hit.service, featurePath, featureName);
    if (pending) onRequestSaveFavorite(pending);
  }

  function requestSaveFeature(featurePath?: string, featureName?: string): void {
    if (!onRequestSaveFavorite || !pickerService) return;
    const pending = buildPending(pickerService, featurePath, featureName);
    if (pending) onRequestSaveFavorite(pending);
  }

  useEffect(() => {
    setFeatureCursor(0);
  }, [pickedFeature?.serviceId]);

  const pickerService = pickedFeature
    ? hits.find((h) => h.service.id === pickedFeature.serviceId)?.service
    : undefined;
  const pickerFeatures = pickerService?.features ?? [];

  // Auto-close picker if its target disappeared (catalog refresh, query
  // changed, etc.). Lives in an effect so we don't setState during render.
  useEffect(() => {
    if (pickedFeature && !pickerService) setPickedFeature(null);
  }, [pickedFeature, pickerService]);

  // Mirror state into a ref so the window handler can attach once and read
  // current values without effect-thrash on every keypress.
  const stateRef = useRef({
    pickedFeature,
    pickerService,
    pickerFeatures,
    featureCursor,
    cursor,
    hits,
    activate,
    open,
    requestSave,
    requestSaveFeature,
  });
  stateRef.current = {
    pickedFeature,
    pickerService,
    pickerFeatures,
    featureCursor,
    cursor,
    hits,
    activate,
    open,
    requestSave,
    requestSaveFeature,
  };

  // Single window-level keyboard handler. Capture phase so nav keys
  // preventDefault before native input/autocomplete behavior. Attached once.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.isComposing) return;
      const ae = document.activeElement;
      const inField =
        ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement;
      const s = stateRef.current;

      if (s.pickedFeature && s.pickerService) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          cursorSource.current = 'keyboard';
          setFeatureCursor((c) => Math.min(c + 1, s.pickerFeatures.length));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          cursorSource.current = 'keyboard';
          setFeatureCursor((c) => Math.max(c - 1, 0));
        } else if (e.key === 'Home') {
          e.preventDefault();
          cursorSource.current = 'keyboard';
          setFeatureCursor(0);
        } else if (e.key === 'End') {
          e.preventDefault();
          cursorSource.current = 'keyboard';
          setFeatureCursor(s.pickerFeatures.length);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (e.shiftKey) {
            if (s.featureCursor === 0) {
              s.requestSaveFeature(undefined, undefined);
            } else {
              const f = s.pickerFeatures[s.featureCursor - 1];
              s.requestSaveFeature(f.path, f.name);
            }
          } else {
            if (s.featureCursor === 0) s.open(s.pickerService, undefined);
            else s.open(s.pickerService, s.pickerFeatures[s.featureCursor - 1].path);
          }
        } else if (e.key === 'Escape' || e.key === 'ArrowLeft') {
          // ArrowLeft is safe in picker — no input rendered, no caret to fight.
          e.preventDefault();
          setPickedFeature(null);
        }
        return;
      }

      // List mode. Type-from-anywhere: when focus drifted off the input,
      // any printable key brings it back and seeds the query. Manual
      // setQuery (rather than relying on event redispatch) because focusing
      // mid-keydown does not replay the event onto the new target.
      if (!inField) {
        const isPrintable =
          e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
        if (isPrintable) {
          e.preventDefault();
          inputRef.current?.focus();
          setQuery((q) => q + e.key);
          return;
        }
        if (e.key === 'Backspace') {
          e.preventDefault();
          inputRef.current?.focus();
          setQuery((q) => q.slice(0, -1));
          return;
        }
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        cursorSource.current = 'keyboard';
        setCursor((c) => Math.min(c + 1, s.hits.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        cursorSource.current = 'keyboard';
        setCursor((c) => Math.max(c - 1, 0));
      } else if ((e.key === 'Home' || e.key === 'End') && !inField) {
        // Only intercept Home/End when input is not focused, otherwise the
        // caret can't jump in the query string.
        e.preventDefault();
        cursorSource.current = 'keyboard';
        setCursor(e.key === 'Home' ? 0 : Math.max(0, s.hits.length - 1));
      } else if (e.key === 'ArrowRight') {
        // Drill into a service that has features. Hijacks caret-right
        // inside the input when the highlighted row is drillable; minor
        // tradeoff for keyboard-only navigation.
        const hit = s.hits[s.cursor];
        if (hit?.kind === 'service' && (hit.service.features?.length ?? 0) > 0) {
          e.preventDefault();
          setPickedFeature({ serviceId: hit.service.id, featureIdx: null });
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const hit = s.hits[s.cursor];
        if (!hit) return;
        if (e.shiftKey) {
          s.requestSave(hit);
        } else {
          s.activate(hit);
        }
      } else if (e.key === 'Escape') {
        if (inField) {
          setQuery('');
        } else {
          e.preventDefault();
          setQuery('');
        }
      }
      // ArrowLeft passes through in list mode so caret nav inside input works.
    }
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  if (pickedFeature && account && !compact) {
    if (!pickerService?.features) {
      // Auto-close handled by the effect above; render nothing this frame.
      return null;
    }
    return (
      <FeaturePicker
        account={account}
        service={pickerService}
        cursor={featureCursor}
        listRef={pickerListRef}
        onHover={(i) => {
          cursorSource.current = 'mouse';
          setFeatureCursor(i);
        }}
        onPick={(path) => open(pickerService, path)}
        onCancel={() => setPickedFeature(null)}
        onRequestSave={
          onRequestSaveFavorite && !missingRole && !missingRegion
            ? (path, name) => requestSaveFeature(path, name)
            : undefined
        }
      />
    );
  }

  const accountColor = account ? chipColor(account.color) : NEUTRAL_COLOR;
  const blocker =
    missingAccount
      ? null
      : missingPortal
        ? 'Configure portal in onboarding first.'
        : missingRole
          ? `No role set for ${account!.alias || account!.name}.`
          : missingRegion
            ? `No region set for ${account!.alias || account!.name}.`
            : null;

  if (compact) {
    return (
      <div className={styles.root}>
        <div className={styles.inputRow}>
          <span className={styles.icon} aria-hidden>
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            placeholder={
              account
                ? `Search services in ${account.alias || account.name}…`
                : 'Search services… (pick an account to open)'
            }
            value={query}
            readOnly
            tabIndex={-1}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.inputRow}>
        <span className={styles.icon} aria-hidden>
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          placeholder={
            account
              ? `Search services in ${account.alias || account.name}…`
              : 'Search services… (pick an account to open)'
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          name="aws-shortcut-search"
          autoFocus
        />
      </div>

      {blocker && (
        <div key={blockedTick} className={styles.blocker} data-flash={blockedTick > 0 ? 'true' : 'false'}>
          {blocker}
        </div>
      )}

      <ul ref={listRef} className={styles.results}>
        {hits.length === 0 && (
          <li className={styles.empty}>No matches for “{query}”.</li>
        )}
        {hits.map((hit, i) => {
          const key = hit.kind === 'service' ? hit.service.id : `${hit.service.id}::${hit.feature.path}`;
          const hasFeaturesPicker = hit.kind === 'service' && (hit.service.features?.length ?? 0) > 0;
          return (
            <li
              key={key}
              className={[styles.result, i === cursor ? styles.active : '']
                .filter(Boolean)
                .join(' ')}
              onMouseEnter={() => {
                cursorSource.current = 'mouse';
                setCursor(i);
              }}
              onClick={() => activate(hit)}
            >
              <ServiceIcon
                id={hit.service.id}
                name={hit.service.name}
                fallbackBg={accountColor}
              />
              {hit.kind === 'service' ? (
                <span className={styles.name}>{hit.service.name}</span>
              ) : (
                <span className={styles.name}>
                  <span className={styles.crumbParent}>{hit.service.name}</span>
                  <span className={styles.crumbSep}>›</span>
                  {hit.feature.name}
                </span>
              )}
              {onRequestSaveFavorite && account && !missingRole && !missingRegion && (
                <button
                  type="button"
                  className={styles.saveBtn}
                  title="Save as favorite (Shift+Enter)"
                  aria-label="Save as favorite"
                  onClick={(e) => {
                    e.stopPropagation();
                    requestSave(hit);
                  }}
                >
                  <SaveStarIcon />
                </button>
              )}
              {hasFeaturesPicker && (
                <span className={styles.chevron} aria-hidden>›</span>
              )}
            </li>
          );
        })}
      </ul>

      {missingAccount && (
        <div className={styles.hint}>Pick an account above to open services.</div>
      )}
    </div>
  );
}

function FeaturePicker({
  account,
  service,
  cursor,
  listRef,
  onHover,
  onPick,
  onCancel,
  onRequestSave,
}: {
  account: Account;
  service: ServiceCatalogEntry;
  cursor: number;
  listRef: React.RefObject<HTMLUListElement>;
  onHover: (i: number) => void;
  onPick: (path: string) => void;
  onCancel: () => void;
  onRequestSave?: (featurePath?: string, featureName?: string) => void;
}) {
  const features = service.features ?? [];

  return (
    <div className={styles.root}>
      <div className={styles.crumb}>
        <button type="button" className={styles.crumbBack} onClick={onCancel}>
          ← {service.name}
        </button>
        <span className={styles.crumbHint}>Pick a feature in {account.alias || account.name}</span>
      </div>
      <ul ref={listRef} className={styles.results}>
        <li
          className={[styles.result, cursor === 0 ? styles.active : '']
            .filter(Boolean)
            .join(' ')}
          onMouseEnter={() => onHover(0)}
          onClick={() => onPick(service.consolePath)}
        >
          <span className={styles.featureBullet} aria-hidden>›</span>
          <span className={styles.name}>{service.name} home</span>
          {onRequestSave && (
            <button
              type="button"
              className={styles.saveBtn}
              title="Save as favorite (Shift+Enter)"
              aria-label="Save as favorite"
              onClick={(e) => {
                e.stopPropagation();
                onRequestSave(undefined, undefined);
              }}
            >
              <SaveStarIcon />
            </button>
          )}
        </li>
        {features.map((f, i) => (
          <li
            key={f.path}
            className={[styles.result, cursor === i + 1 ? styles.active : '']
              .filter(Boolean)
              .join(' ')}
            onMouseEnter={() => onHover(i + 1)}
            onClick={() => onPick(f.path)}
          >
            <span className={styles.featureBullet} aria-hidden>›</span>
            <span className={styles.name}>{f.name}</span>
            {onRequestSave && (
              <button
                type="button"
                className={styles.saveBtn}
                title="Save as favorite (Shift+Enter)"
                aria-label="Save as favorite"
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestSave(f.path, f.name);
                }}
              >
                <SaveStarIcon />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function scrollRowIntoView(list: HTMLUListElement | null, index: number): void {
  if (!list) return;
  const active = list.children[index] as HTMLElement | undefined;
  if (!active) return;
  const listRect = list.getBoundingClientRect();
  const activeRect = active.getBoundingClientRect();
  if (activeRect.top < listRect.top) {
    list.scrollTop -= listRect.top - activeRect.top;
  } else if (activeRect.bottom > listRect.bottom) {
    list.scrollTop += activeRect.bottom - listRect.bottom;
  }
}

function SearchIcon() {
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
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function SaveStarIcon() {
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
      <path d="M12 2 15 8.5 22 9.3l-5.2 4.8L18.2 21 12 17.5 5.8 21l1.4-6.9L2 9.3 9 8.5z" />
    </svg>
  );
}
