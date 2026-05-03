import { useEffect, useState } from 'react';
import type { Recent } from '@/shared/types';
import { getLocal } from '@/shared/storage';

const RECENTS_KEY = 'recents';

export function useRecents(): { recents: Recent[]; loaded: boolean } {
  const [recents, setRecents] = useState<Recent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    void getLocal().then((local) => {
      if (!alive) return;
      setRecents(local.recents);
      setLoaded(true);
    });
    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: chrome.storage.AreaName,
    ) => {
      if (area !== 'local' || !changes[RECENTS_KEY]) return;
      setRecents((changes[RECENTS_KEY].newValue as Recent[] | undefined) ?? []);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => {
      alive = false;
      chrome.storage.onChanged.removeListener(onChange);
    };
  }, []);

  return { recents, loaded };
}
