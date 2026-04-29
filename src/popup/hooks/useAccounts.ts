import { useEffect, useState } from 'react';
import { getSync } from '@/shared/storage';
import type { Account } from '@/shared/types';

type State = {
  accounts: Account[];
  accountOrder: string[];
  hiddenAccountIds: string[];
  loaded: boolean;
};

export function useAccounts(): State {
  const [state, setState] = useState<State>({
    accounts: [],
    accountOrder: [],
    hiddenAccountIds: [],
    loaded: false,
  });

  useEffect(() => {
    let cancelled = false;
    void getSync().then((sync) => {
      if (cancelled) return;
      setState({
        accounts: sync.accounts,
        accountOrder: sync.accountOrder,
        hiddenAccountIds: sync.hiddenAccountIds,
        loaded: true,
      });
    });
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== 'sync') return;
      setState((prev) => ({
        ...prev,
        accounts: (changes.accounts?.newValue as Account[]) ?? prev.accounts,
        accountOrder: (changes.accountOrder?.newValue as string[]) ?? prev.accountOrder,
        hiddenAccountIds:
          (changes.hiddenAccountIds?.newValue as string[]) ?? prev.hiddenAccountIds,
      }));
    };
    chrome.storage.onChanged.addListener(handler);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(handler);
    };
  }, []);

  return state;
}
