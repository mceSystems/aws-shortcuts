import { create } from 'zustand';
import type { Account, Favorite, Prefs, ServiceCatalogEntry } from '@/shared/types';
import { getLocal, getSync, setSync } from '@/shared/storage';

type Store = {
  accounts: Account[];
  favorites: Favorite[];
  catalog: ServiceCatalogEntry[];
  prefs: Prefs;
  selectedAccountIds: string[];
  selectedService?: ServiceCatalogEntry;
  selectedFeature?: string;

  loaded: boolean;
  load: () => Promise<void>;

  toggleAccount: (id: string, multi: boolean) => void;
  clearSelection: () => void;
  selectService: (svc: ServiceCatalogEntry | undefined) => void;
  selectFeature: (feature: string | undefined) => void;

  setAccountColor: (id: string, color: string) => Promise<void>;
  setAccountDefaultRole: (id: string, role: string) => Promise<void>;
  setAccountDefaultRegion: (id: string, region: string) => Promise<void>;
};

export const useStore = create<Store>((set, get) => ({
  accounts: [],
  favorites: [],
  catalog: [],
  prefs: {
    uiMode: 'popup',
    globalDefaultRegion: 'us-east-1',
    multiSessionVerified: false,
  },
  selectedAccountIds: [],
  selectedService: undefined,
  selectedFeature: undefined,
  loaded: false,

  async load() {
    const [sync, local] = await Promise.all([getSync(), getLocal()]);
    set({
      accounts: sync.accounts,
      favorites: sync.favorites,
      prefs: sync.prefs,
      catalog: local.serviceCatalog,
      loaded: true,
    });
  },

  toggleAccount(id, multi) {
    const cur = get().selectedAccountIds;
    if (!multi) {
      set({ selectedAccountIds: cur.includes(id) && cur.length === 1 ? [] : [id] });
      return;
    }
    set({
      selectedAccountIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    });
  },

  clearSelection() {
    set({ selectedAccountIds: [], selectedService: undefined, selectedFeature: undefined });
  },

  selectService(svc) {
    set({ selectedService: svc, selectedFeature: undefined });
  },

  selectFeature(feature) {
    set({ selectedFeature: feature });
  },

  async setAccountColor(id, color) {
    const accounts = get().accounts.map((a) => (a.accountId === id ? { ...a, color } : a));
    set({ accounts });
    await setSync({ accounts });
  },

  async setAccountDefaultRole(id, role) {
    const accounts = get().accounts.map((a) =>
      a.accountId === id ? { ...a, defaultRoleName: role } : a,
    );
    set({ accounts });
    await setSync({ accounts });
  },

  async setAccountDefaultRegion(id, region) {
    const accounts = get().accounts.map((a) =>
      a.accountId === id ? { ...a, defaultRegion: region } : a,
    );
    set({ accounts });
    await setSync({ accounts });
  },
}));
