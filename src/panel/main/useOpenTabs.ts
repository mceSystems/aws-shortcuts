import { useEffect, useState } from 'react';
import { OPEN_TABS_KEY, getOpenTabs, type OpenTabInfo } from '@/shared/sessionStorage';

export function useOpenTabs(): { openTabs: OpenTabInfo[]; loaded: boolean } {
  const [openTabs, setOpenTabs] = useState<OpenTabInfo[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    void getOpenTabs().then((tabs) => {
      if (!alive) return;
      setOpenTabs(tabs);
      setLoaded(true);
    });
    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: chrome.storage.AreaName,
    ) => {
      if (area !== 'session' || !changes[OPEN_TABS_KEY]) return;
      setOpenTabs((changes[OPEN_TABS_KEY].newValue as OpenTabInfo[] | undefined) ?? []);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => {
      alive = false;
      chrome.storage.onChanged.removeListener(onChange);
    };
  }, []);

  return { openTabs, loaded };
}
