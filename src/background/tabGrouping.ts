// Tab-grouping module. Auto-groups AWS console tabs by account when
// `prefs.autoGroupByAccount` is on. Manual trigger via GROUP_BY_ACCOUNT
// message ignores sticky-skip and re-groups everything. Strategy A on
// SW boot: ungroup any saved-restored groups whose title matches an
// account label, so we never inherit dead groups across sessions.

import { getOpenTabs, type OpenTabInfo } from '@/shared/sessionStorage';
import {
  getSync,
  getStickySkip,
  setStickySkip,
  clearStickySkip,
} from '@/shared/storage';
import { awsColorToChromeGroupColor } from '@/shared/colors';

type Key = `${string}:${number}`; // `${accountId}:${windowId}`

const groupIdByKey = new Map<Key, number>();

export function installTabGrouping(): void {
  // Each registration guarded: if any chrome.* namespace is unavailable
  // (e.g. tabGroups perm not yet granted on update), skip that listener
  // without aborting the rest. Throw escaping this function would kill
  // module load and prevent critical openTabs sync from registering.
  try {
    if (chrome.tabGroups) {
      void ungroupRestoredGroups().then(() => scheduleAutoGroup());
    } else {
      console.warn(
        '[aws-shortcut/tabGrouping] chrome.tabGroups unavailable; grouping disabled',
      );
    }

    if (chrome.tabs?.onCreated) {
      chrome.tabs.onCreated.addListener(() => scheduleAutoGroup());
    }
    if (chrome.tabs?.onUpdated) {
      chrome.tabs.onUpdated.addListener((_tabId, change) => {
        if (change.url || change.status === 'complete') scheduleAutoGroup();
      });
    }
    if (chrome.tabs?.onRemoved) {
      chrome.tabs.onRemoved.addListener(() => scheduleAutoGroup());
    }
    if (chrome.tabGroups?.onRemoved) {
      chrome.tabGroups.onRemoved.addListener((g) => {
        void onGroupRemoved(g);
      });
    }
    if (chrome.windows?.onRemoved) {
      chrome.windows.onRemoved.addListener((wid) => {
        void onWindowRemoved(wid);
      });
    }
  } catch (e) {
    console.warn('[aws-shortcut/tabGrouping] install failed', e);
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleAutoGroup(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void runAutoGroup();
  }, 500);
}

async function runAutoGroup(): Promise<void> {
  const sync = await getSync();
  const prefs = sync.prefs ?? {};
  if (!prefs.autoGroupByAccount) return;
  await groupTabsByAccount({
    minTabs: prefs.groupMinTabs ?? 2,
    respectStickySkip: true,
  });
}

export async function groupTabsByAccount(opts: {
  minTabs: number;
  respectStickySkip: boolean;
}): Promise<void> {
  const openTabs = await getOpenTabs();
  const sticky = opts.respectStickySkip ? await getStickySkip() : {};
  const sync = await getSync();
  const accountById = new Map(sync.accounts.map((a) => [a.accountId, a]));

  const buckets = new Map<Key, OpenTabInfo[]>();
  for (const t of openTabs) {
    if (!t.accountId || t.windowId == null || t.windowId < 0) continue;
    if (sticky[t.accountId]?.[t.windowId]) continue;
    const key: Key = `${t.accountId}:${t.windowId}`;
    const arr = buckets.get(key) ?? [];
    arr.push(t);
    buckets.set(key, arr);
  }

  for (const [key, tabs] of buckets) {
    if (tabs.length < opts.minTabs) continue;
    const [accountId, windowIdStr] = key.split(':');
    const windowId = Number(windowIdStr);
    const account = accountById.get(accountId);
    const title = account?.alias || account?.name || accountId;
    const color = awsColorToChromeGroupColor(account?.color);

    const existingGroupId = await findExistingGroup(key, title, windowId);
    const tabIdsToGroup: number[] = [];
    for (const t of tabs) {
      if (t.tabId == null) continue;
      const live = await chrome.tabs.get(t.tabId).catch(() => null);
      if (!live) continue;
      if (existingGroupId != null && live.groupId === existingGroupId) continue;
      tabIdsToGroup.push(t.tabId);
    }

    let groupId: number | undefined;
    if (existingGroupId != null) {
      groupId = existingGroupId;
      if (tabIdsToGroup.length) {
        try {
          await chrome.tabs.group({ groupId, tabIds: tabIdsToGroup });
        } catch (e) {
          console.warn('[aws-shortcut/tabGrouping] tabs.group reuse failed', e);
        }
      }
    } else if (tabIdsToGroup.length) {
      try {
        groupId = await chrome.tabs.group({
          tabIds: tabIdsToGroup,
          createProperties: { windowId },
        });
      } catch (e) {
        console.warn('[aws-shortcut/tabGrouping] tabs.group create failed', e);
        continue;
      }
    } else {
      continue;
    }

    if (groupId == null) continue;
    try {
      await chrome.tabGroups.update(groupId, { title, color });
    } catch (e) {
      console.warn('[aws-shortcut/tabGrouping] group update failed', e);
    }
    groupIdByKey.set(key, groupId);
  }
}

async function findExistingGroup(
  key: Key,
  title: string,
  windowId: number,
): Promise<number | undefined> {
  const cached = groupIdByKey.get(key);
  if (cached != null) {
    const live = await chrome.tabGroups.get(cached).catch(() => null);
    if (live && live.windowId === windowId) return cached;
    groupIdByKey.delete(key);
  }
  const groups = await chrome.tabGroups
    .query({ windowId, title })
    .catch(() => [] as chrome.tabGroups.TabGroup[]);
  return groups[0]?.id;
}

/** Strategy A: on SW boot, ungroup any tabs in groups whose title matches
 *  an AWS account label. Chrome may have restored a saved group from a
 *  previous session — we don't want to inherit it. Auto-group will
 *  reconstitute fresh state if enabled. */
async function ungroupRestoredGroups(): Promise<void> {
  let groups: chrome.tabGroups.TabGroup[];
  try {
    groups = await chrome.tabGroups.query({});
  } catch {
    return;
  }
  if (!groups.length) return;
  const accounts = (await getSync()).accounts;
  if (!accounts.length) return;
  const labels = new Set<string>();
  for (const a of accounts) {
    if (a.alias) labels.add(a.alias);
    if (a.name) labels.add(a.name);
    labels.add(a.accountId);
  }
  for (const g of groups) {
    if (!g.title || !labels.has(g.title)) continue;
    const tabs = await chrome.tabs.query({ groupId: g.id }).catch(() => []);
    const ids = tabs.map((t) => t.id).filter((x): x is number => x != null);
    if (!ids.length) continue;
    try {
      await chrome.tabs.ungroup(ids);
    } catch (e) {
      console.warn('[aws-shortcut/tabGrouping] startup ungroup failed', e);
    }
  }
  groupIdByKey.clear();
  // Also wipe any sticky-skip from prior session: with all groups gone,
  // sticky entries would gate the next auto-group cycle indefinitely.
  // Only do this on startup-cleanup, NOT on user-initiated un-group.
  await clearStickySkip();
}

async function onGroupRemoved(group: chrome.tabGroups.TabGroup): Promise<void> {
  const accounts = (await getSync()).accounts;
  const acc = accounts.find(
    (a) => (a.alias || a.name || a.accountId) === group.title,
  );
  for (const [k, gid] of groupIdByKey) {
    if (gid === group.id) groupIdByKey.delete(k);
  }
  if (!acc) return;
  // Distinguish user-ungroup vs natural empty-cleanup: if at least one
  // tab for this account still lives in the same window, the user
  // un-grouped → set sticky-skip so auto won't immediately re-group.
  const openTabs = await getOpenTabs();
  const stillThere = openTabs.some(
    (t) => t.accountId === acc.accountId && t.windowId === group.windowId,
  );
  if (stillThere) {
    await setStickySkip(acc.accountId, group.windowId, true);
  }
}

async function onWindowRemoved(windowId: number): Promise<void> {
  for (const [k] of groupIdByKey) {
    if (k.endsWith(`:${windowId}`)) groupIdByKey.delete(k);
  }
  await clearStickySkip({ windowId });
}
