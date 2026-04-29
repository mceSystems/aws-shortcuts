import { useEffect, useState } from 'react';
import { getSync } from '@/shared/storage';
import type { Account } from '@/shared/types';

export function useAccounts(): { accounts: Account[]; loaded: boolean } {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getSync().then((sync) => {
      if (cancelled) return;
      setAccounts(sync.accounts);
      setLoaded(true);
    });
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === 'sync' && changes.accounts) {
        setAccounts((changes.accounts.newValue as Account[]) ?? []);
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(handler);
    };
  }, []);

  return { accounts, loaded };
}
