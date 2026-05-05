import { useCallback, useEffect, useRef, useState } from 'react';
import { OPEN_TABS_KEY, getOpenTabs, type OpenTabInfo } from '@/shared/sessionStorage';
import { send } from '@/shared/messages';

export function useOpenTabs(): {
  openTabs: OpenTabInfo[];
  loaded: boolean;
  /** Optimistically remove a tab from the rendered list. Tracks the
   *  tabId in a graveyard set so any stale storage event delivered
   *  mid-close can't bring the row back. Cleared once Chrome confirms
   *  the tab is gone (via reconcile or after 5s). */
  removeLocally: (tabId: number) => void;
} {
  const [openTabs, setOpenTabsRaw] = useState<OpenTabInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Tabs the user just closed — filter them out of any incoming storage
  // delta so racey writes (SESSION_OBSERVED, upsertOpenTab from another
  // tab, harvest) cannot resurrect a row.
  const graveyardRef = useRef<Map<number, number>>(new Map()); // tabId → expireAt

  const apply = useCallback((next: OpenTabInfo[]) => {
    const grave = graveyardRef.current;
    if (grave.size === 0) {
      setOpenTabsRaw(next);
      return;
    }
    const now = Date.now();
    // Drop expired graveyard entries.
    for (const [tabId, exp] of grave) {
      if (exp <= now) grave.delete(tabId);
    }
    if (grave.size === 0) {
      setOpenTabsRaw(next);
      return;
    }
    setOpenTabsRaw(next.filter((t) => !grave.has(t.tabId)));
  }, []);

  useEffect(() => {
    let alive = true;
    void getOpenTabs().then((tabs) => {
      if (!alive) return;
      apply(tabs);
      setLoaded(true);
    });
    void send({ type: 'RECONCILE_OPEN_TABS' });

    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: chrome.storage.AreaName,
    ) => {
      if (area !== 'session' || !changes[OPEN_TABS_KEY]) return;
      const next = (changes[OPEN_TABS_KEY].newValue as OpenTabInfo[] | undefined) ?? [];
      // If a tab in the graveyard is no longer in the incoming list,
      // Chrome+SW have caught up — clear it.
      if (graveyardRef.current.size > 0) {
        const incomingIds = new Set(next.map((t) => t.tabId));
        for (const tabId of graveyardRef.current.keys()) {
          if (!incomingIds.has(tabId)) graveyardRef.current.delete(tabId);
        }
      }
      apply(next);
    };
    chrome.storage.onChanged.addListener(onChange);

    const onTabRemoved = (tabId: number) => {
      graveyardRef.current.set(tabId, Date.now() + 5000);
      setOpenTabsRaw((cur) => cur.filter((t) => t.tabId !== tabId));
      void send({ type: 'RECONCILE_OPEN_TABS' });
    };
    chrome.tabs?.onRemoved?.addListener(onTabRemoved);

    return () => {
      alive = false;
      chrome.storage.onChanged.removeListener(onChange);
      chrome.tabs?.onRemoved?.removeListener(onTabRemoved);
    };
  }, [apply]);

  const removeLocally = useCallback((tabId: number) => {
    graveyardRef.current.set(tabId, Date.now() + 5000);
    setOpenTabsRaw((cur) => cur.filter((t) => t.tabId !== tabId));
  }, []);

  return { openTabs, loaded, removeLocally };
}
