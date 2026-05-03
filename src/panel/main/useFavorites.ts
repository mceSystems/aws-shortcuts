import { useEffect, useState } from 'react';
import type { Favorite } from '@/shared/types';
import { getSync } from '@/shared/storage';

const FAVORITES_KEY = 'favorites';

export function useFavorites(): { favorites: Favorite[]; loaded: boolean } {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    void getSync().then((sync) => {
      if (!alive) return;
      setFavorites(sync.favorites);
      setLoaded(true);
    });
    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: chrome.storage.AreaName,
    ) => {
      if (area !== 'sync' || !changes[FAVORITES_KEY]) return;
      setFavorites((changes[FAVORITES_KEY].newValue as Favorite[] | undefined) ?? []);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => {
      alive = false;
      chrome.storage.onChanged.removeListener(onChange);
    };
  }, []);

  return { favorites, loaded };
}
