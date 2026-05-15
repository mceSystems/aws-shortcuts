import type { Msg, MsgResponse } from '@/shared/messages';
import type { Account, Favorite, IdentityCenter, Recent } from '@/shared/types';
import { getSync, mutateLocal, mutateSync, rowKey } from '@/shared/storage';
import {
  getBearer,
  getBearers,
  getBearerTick,
  setBearer,
  getConsoleSessions,
  mutateConsoleSessions,
  mutateOpenTabs,
} from '@/shared/sessionStorage';
import { awsColorToHex } from '@/shared/colors';
import { buildPortalLaunchUrl, buildDirectConsoleUrl } from '@/shared/launcher';
import { MULTI_SESSION_HOST_RE, fullDedupeKey, parseConsoleUrl } from '@/shared/consoleUrl';
import { fetchAccounts } from './portal-api';
import { installCatalogRefresh, refreshCatalog } from './catalogRefresh';
import { bumpOpenCount } from '@/shared/openCounts';

installCatalogRefresh();

// ───── bearer capture ──────────────────────────────────────────────

const PORTAL_API_URLS = [
  'https://portal.sso.us-east-1.amazonaws.com/*',
  'https://portal.sso.us-east-2.amazonaws.com/*',
  'https://portal.sso.us-west-2.amazonaws.com/*',
  'https://portal.sso.eu-west-1.amazonaws.com/*',
  'https://portal.sso.eu-west-2.amazonaws.com/*',
  'https://portal.sso.eu-central-1.amazonaws.com/*',
  'https://portal.sso.eu-north-1.amazonaws.com/*',
  'https://portal.sso.ap-southeast-1.amazonaws.com/*',
  'https://portal.sso.ap-southeast-2.amazonaws.com/*',
  'https://portal.sso.ap-northeast-1.amazonaws.com/*',
  'https://portal.sso.ap-northeast-2.amazonaws.com/*',
  'https://portal.sso.ap-south-1.amazonaws.com/*',
  'https://portal.sso.ca-central-1.amazonaws.com/*',
  'https://portal.sso.sa-east-1.amazonaws.com/*',
];

chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    const auth = details.requestHeaders?.find(
      (h) => h.name.toLowerCase() === 'authorization',
    );
    if (!auth?.value?.startsWith('Bearer ')) return;
    const token = auth.value.slice('Bearer '.length);
    if (details.tabId < 0) return;
    void resolvePortalHostForTab(details.tabId).then((portalHost) => {
      if (!portalHost) return;
      void setBearer(token, portalHost);
    });
  },
  { urls: PORTAL_API_URLS },
  ['requestHeaders', 'extraHeaders'],
);

// Map a webRequest tabId to the configured IDC's portalHost. Bearer is bound
// to the SSO session that issued it, so cache by the portal that owns the tab,
// not the regional API origin (two IDCs in same region collide otherwise).
async function resolvePortalHostForTab(tabId: number): Promise<string | null> {
  let tabUrl: string | undefined;
  try {
    const tab = await chrome.tabs.get(tabId);
    tabUrl = tab.url;
  } catch {
    return null;
  }
  if (!tabUrl) return null;
  let hostname: string;
  try {
    hostname = new URL(tabUrl).hostname;
  } catch {
    return null;
  }
  const sync = await getSync();
  const idc = sync.identityCenters.find((i) => {
    try {
      return new URL(i.portalHost).hostname === hostname;
    } catch {
      return false;
    }
  });
  return idc?.portalHost ?? null;
}

chrome.runtime.onInstalled.addListener(() => {
  void refreshOriginRules();
  void harvestOpenTabs();
  void chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.warn('[aws-shortcut] sidePanel setPanelBehavior failed:', err));
});

chrome.runtime.onStartup.addListener(() => {
  void refreshOriginRules();
  void harvestOpenTabs();
  void chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});
});

// ───── console session lifecycle ───────────────────────────────────

chrome.tabs.onRemoved.addListener((tabId) => {
  void mutateConsoleSessions((cur) => {
    let mutated = false;
    const next = cur
      .map((s) => {
        if (!s.tabIds.includes(tabId)) return s;
        mutated = true;
        return { ...s, tabIds: s.tabIds.filter((t) => t !== tabId) };
      })
      .filter((s) => s.tabIds.length > 0);
    return mutated ? next : cur;
  });
  void mutateOpenTabs((cur) => {
    const closed = cur.find((t) => t.tabId === tabId);
    if (!closed) return cur;
    void recordRecent(closed);
    return cur.filter((t) => t.tabId !== tabId);
  });
});

const RECENTS_CAP = 50;

async function recordRecent(t: {
  accountId: string;
  roleName: string;
  region: string;
  serviceId: string;
  consolePath: string;
  url: string;
  title: string;
}): Promise<void> {
  // Skip entries lacking the bits needed for a clean relaunch.
  if (!t.accountId || !t.serviceId || !t.consolePath) return;
  const dedupeKey = fullDedupeKey({
    accountId: t.accountId,
    roleName: t.roleName,
    region: t.region,
    consolePath: t.consolePath,
  });
  // Console tabs don't expose which Identity Center authorized them — resolve
  // by looking for the matching (accountId, role) row in our accounts table.
  // Fallback: any row with this accountId. Empty string if no row at all (rare).
  const sync = await getSync();
  const candidates = sync.accounts.filter((a) => a.accountId === t.accountId);
  const best = t.roleName
    ? candidates.find((a) => a.roles.some((r) => r.name === t.roleName))
    : undefined;
  const identityCenterId = best?.identityCenterId ?? candidates[0]?.identityCenterId ?? '';
  await mutateLocal((state) => {
    const list = state.recents;
    const now = Date.now();
    const idx = list.findIndex((r) => r.dedupeKey === dedupeKey);
    let next: Recent[];
    if (idx >= 0) {
      const existing = list[idx];
      const updated: Recent = {
        ...existing,
        // Latest variant wins for relaunch — most recent resource state.
        consolePath: t.consolePath,
        url: t.url,
        title: t.title || existing.title,
        roleName: t.roleName || existing.roleName,
        region: t.region || existing.region,
        identityCenterId: existing.identityCenterId || identityCenterId,
        hits: existing.hits + 1,
        ts: now,
      };
      next = [updated, ...list.slice(0, idx), ...list.slice(idx + 1)];
    } else {
      const fresh: Recent = {
        id: `r_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        identityCenterId,
        accountId: t.accountId,
        roleName: t.roleName,
        region: t.region,
        serviceId: t.serviceId,
        consolePath: t.consolePath,
        dedupeKey,
        url: t.url,
        title: t.title,
        ts: now,
        hits: 1,
      };
      next = [fresh, ...list];
    }
    if (next.length > RECENTS_CAP) next = next.slice(0, RECENTS_CAP);
    return { recents: next };
  });
}

// Track URL + title for every open multi-session console tab. Drives the
// Open list in the side panel.
chrome.tabs.onUpdated.addListener((_tabId, _changeInfo, tab) => {
  void upsertOpenTab(tab);
});

async function upsertOpenTab(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab?.id || !tab.url) return;
  const parsed = parseConsoleUrl(tab.url);
  if (!parsed?.isMultiSession || !parsed.accountId || !parsed.sessionSubdomain) {
    // Tab navigated away from a multi-session URL — drop any stale entry.
    await mutateOpenTabs((cur) => {
      if (!cur.some((t) => t.tabId === tab.id)) return cur;
      return cur.filter((t) => t.tabId !== tab.id);
    });
    return;
  }
  const sessions = await getConsoleSessions();
  const session = sessions.find(
    (s) => s.accountId === parsed.accountId && s.sessionSubdomain === parsed.sessionSubdomain,
  );
  await mutateOpenTabs((cur) => {
    const idx = cur.findIndex((t) => t.tabId === tab.id);
    const roleName = session?.roleName ?? cur[idx]?.roleName ?? '';
    const entry = {
      tabId: tab.id!,
      windowId: tab.windowId ?? -1,
      url: tab.url!,
      title: tab.title ?? '',
      accountId: parsed.accountId!,
      sessionSubdomain: parsed.sessionSubdomain!,
      region: parsed.region,
      serviceId: parsed.serviceId,
      consolePath: parsed.consolePath,
      dedupeKey: fullDedupeKey({
        accountId: parsed.accountId!,
        roleName,
        region: parsed.region,
        consolePath: parsed.consolePath,
      }),
      roleName,
      observedAt: Date.now(),
    };
    if (idx === -1) return [...cur, entry];
    const existing = cur[idx];
    if (sameOpenTab(existing, entry)) return cur;
    const next = [...cur];
    next[idx] = entry;
    return next;
  });
}

function sameOpenTab(
  a: { url: string; title: string; consolePath: string; region: string; roleName: string },
  b: { url: string; title: string; consolePath: string; region: string; roleName: string },
): boolean {
  return (
    a.url === b.url &&
    a.title === b.title &&
    a.consolePath === b.consolePath &&
    a.region === b.region &&
    a.roleName === b.roleName
  );
}

// Reactive expiry: if a tab navigates from a multi-session subdomain to the
// signin/portal hosts, the session is dead — drop it from the store.
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) return;
  const url = details.url;
  if (!/signin\.aws\.amazon\.com|awsapps\.com\/start/.test(url)) return;
  void mutateConsoleSessions((cur) => {
    if (!cur.some((s) => s.tabIds.includes(details.tabId))) return cur;
    return cur
      .map((s) => ({ ...s, tabIds: s.tabIds.filter((t) => t !== details.tabId) }))
      .filter((s) => s.tabIds.length > 0);
  });
});

async function harvestOpenTabs(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({
      url: ['https://*.console.aws.amazon.com/*'],
    });
    await Promise.all(tabs.map((t) => upsertOpenTab(t)));
    const consoleScript = chrome.runtime
      .getManifest()
      .content_scripts?.find((cs) =>
        cs.matches?.some((m) => m.includes('console.aws.amazon.com')),
      )
      ?.js?.[0];

    await Promise.all(
      tabs.map(async (tab) => {
        if (!tab.id) return;
        const tabId = tab.id;
        try {
          await chrome.tabs.sendMessage(tabId, { type: 'RESCAN_TAB' });
        } catch {
          if (!consoleScript) return;
          try {
            await chrome.scripting.executeScript({
              target: { tabId },
              files: [consoleScript],
            });
          } catch (injErr) {
            console.warn('[aws-shortcut] inject failed for tab', tabId, injErr);
          }
        }
      }),
    );
  } catch (e) {
    console.warn('[aws-shortcut] harvest failed', e);
  }
}

/** Self-healing reconcile: query Chrome for live tabs, drop any openTabs
 *  entries whose tabIds Chrome doesn't know about, and record them as
 *  recents. MV3 SW lifecycle can occasionally miss `tabs.onRemoved`
 *  events; this catches up regardless. */
async function reconcileOpenTabs(): Promise<void> {
  let liveIds: Set<number>;
  try {
    const tabs = await chrome.tabs.query({});
    liveIds = new Set(tabs.map((t) => t.id).filter((x): x is number => x != null));
  } catch (e) {
    console.warn('[aws-shortcut] reconcile: tabs.query failed', e);
    return;
  }
  await mutateOpenTabs(
    (cur) => {
      const stale = cur.filter((t) => !liveIds.has(t.tabId));
      if (stale.length === 0) return cur;
      for (const t of stale) void recordRecent(t);
      return cur.filter((t) => liveIds.has(t.tabId));
    },
    { skipSelfHeal: true },
  );
}

// Periodic safety net — even if every event-driven path fails, the
// alarm catches drift within ~30s.
const RECONCILE_ALARM = 'open-tabs-reconcile';
chrome.alarms.create(RECONCILE_ALARM, { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === RECONCILE_ALARM) void reconcileOpenTabs();
});

// Window close fires onRemoved for each tab, but MV3 SW can drop events
// when many fire at once. Trigger one explicit reconcile after the
// window dies to catch up.
chrome.windows.onRemoved.addListener(() => {
  void reconcileOpenTabs();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (changes.identityCenters) {
    void refreshOriginRules();
  }
  // Accounts list transitions empty → non-empty (first scan, sync from another
  // device, import). Trigger harvest so any console tabs already open re-emit
  // their cached color/role/region observations against the now-populated
  // accounts table.
  if (changes.accounts) {
    const oldLen = (changes.accounts.oldValue as Account[] | undefined)?.length ?? 0;
    const newLen = (changes.accounts.newValue as Account[] | undefined)?.length ?? 0;
    if (oldLen === 0 && newLen > 0) {
      void harvestOpenTabs();
    }
  }
});

// AWS portal API rejects requests with Origin: chrome-extension://...
// Rewrite Origin + Referer on extension-initiated calls so the server
// sees the same headers a normal portal page would send. With multiple
// Identity Centers we need one rule per IdC's portalHost. urlFilter is
// the same substring (`portal.sso.`) for every rule — DNR's regexFilter
// is too restricted to scope per-region exactly, so rules share the same
// match space; only the action (Origin value) differs. Highest-priority
// rule wins. Since both portals legitimately speak to portal.sso.*, and
// the request `initiatorDomains` is the extension only, the worst case
// is that we send a slightly-different `Origin` than the portal expected
// — both portals accept any *.awsapps.com Origin in practice.
const ORIGIN_RULE_BASE_ID = 1001;

async function refreshOriginRules(): Promise<void> {
  try {
    const sync = await getSync();
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const existingIds = existing
      .map((r) => r.id)
      .filter((id) => id >= ORIGIN_RULE_BASE_ID && id < ORIGIN_RULE_BASE_ID + 1000);
    if (sync.identityCenters.length === 0) {
      if (existingIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: existingIds,
        });
      }
      return;
    }
    const addRules = sync.identityCenters.map((idc, i) => ({
      id: ORIGIN_RULE_BASE_ID + i,
      priority: 1,
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
        requestHeaders: [
          {
            header: 'Origin',
            operation: chrome.declarativeNetRequest.HeaderOperation.SET,
            value: idc.portalHost,
          },
          {
            header: 'Referer',
            operation: chrome.declarativeNetRequest.HeaderOperation.SET,
            value: `${idc.portalHost}/start/`,
          },
        ],
      },
      condition: {
        urlFilter: 'portal.sso.',
        resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST],
        initiatorDomains: [chrome.runtime.id],
      },
    }));
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingIds,
      addRules,
    });
  } catch (e) {
    console.error('[aws-shortcut] failed to set origin rules', e);
  }
}

// ───── message hub ─────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg: Msg, sender, reply) => {
  lastSenderTabId = sender.tab?.id;
  void handle(msg)
    .then((res) => reply(res))
    .catch((err: Error) => reply({ ok: false, error: err.message } satisfies MsgResponse));
  return true;
});

async function handle(msg: Msg): Promise<MsgResponse> {
  switch (msg.type) {
    case 'GET_BEARER': {
      if (msg.portalHost) {
        const entry = await getBearer(msg.portalHost);
        return { ok: true, bearer: entry?.token };
      }
      const all = await getBearers();
      const first = Object.values(all)[0];
      return { ok: true, bearer: first?.token };
    }

    case 'SCAN_PORTAL': {
      return runScanPortal(msg.identityCenterId);
    }

    case 'SCAN_ALL': {
      const sync = await getSync();
      let lastErr: string | null = null;
      let aggregated: Account[] = [];
      for (const idc of sync.identityCenters) {
        const res = await runScanPortal(idc.id);
        if (!res.ok) {
          lastErr = res.error;
        } else if (res.accounts) {
          aggregated = aggregated.concat(res.accounts);
        }
      }
      if (lastErr && aggregated.length === 0) return { ok: false, error: lastErr };
      return { ok: true, accounts: aggregated };
    }

    case 'CAPTURE_AND_SCAN': {
      return captureAndScan(msg.identityCenterId);
    }

    case 'ADD_IDENTITY_CENTER': {
      await mutateSync((sync) => {
        if (sync.identityCenters.some((i) => i.id === msg.idc.id)) {
          // Duplicate id (same portalHost): keep the user-given name update.
          return {
            identityCenters: sync.identityCenters.map((i) =>
              i.id === msg.idc.id ? { ...i, ...msg.idc } : i,
            ),
          };
        }
        return { identityCenters: [...sync.identityCenters, msg.idc] };
      });
      return { ok: true };
    }

    case 'REMOVE_IDENTITY_CENTER': {
      await mutateSync((sync) => {
        if (!sync.identityCenters.some((i) => i.id === msg.id)) return null;
        const keptAccounts = sync.accounts.filter((a) => a.identityCenterId !== msg.id);
        const keptFavorites = sync.favorites.filter((f) => f.identityCenterId !== msg.id);
        const survivingKeys = new Set(
          keptAccounts.map((a) => rowKey(a.identityCenterId, a.accountId)),
        );
        return {
          identityCenters: sync.identityCenters.filter((i) => i.id !== msg.id),
          accounts: keptAccounts,
          favorites: keptFavorites,
          accountOrder: sync.accountOrder.filter((k) => survivingKeys.has(k)),
          hiddenAccountIds: sync.hiddenAccountIds.filter((k) => survivingKeys.has(k)),
        };
      });
      await mutateLocal((state) => ({
        recents: state.recents.filter((r) => r.identityCenterId !== msg.id),
      }));
      return { ok: true };
    }

    case 'RENAME_IDENTITY_CENTER': {
      const name = msg.name.trim();
      if (!name) return { ok: false, error: 'Name cannot be empty.' };
      await mutateSync((sync) => {
        if (!sync.identityCenters.some((i) => i.id === msg.id)) return null;
        return {
          identityCenters: sync.identityCenters.map((i) =>
            i.id === msg.id ? { ...i, name } : i,
          ),
        };
      });
      return { ok: true };
    }

    case 'ACCOUNT_COLOR_OBSERVED': {
      const hex = awsColorToHex(msg.colorName);
      if (!hex) return { ok: true };
      await mutateSync((sync) => {
        const next = sync.accounts.map((a) =>
          a.accountId === msg.accountId && a.color !== hex ? { ...a, color: hex } : a,
        );
        const changed = next.some((a, i) => a.color !== sync.accounts[i]?.color);
        return changed ? { accounts: next } : null;
      });
      return { ok: true };
    }

    case 'ACCOUNT_REGION_OBSERVED': {
      await mutateSync((sync) => {
        let mutated = false;
        const next = sync.accounts.map((a) => {
          if (a.accountId !== msg.accountId) return a;
          let updated = recordRegionObservation(a, msg.region);
          // Auto-adopt as preferred when none set yet and not locked.
          if (!updated.preferredRegion && !updated.regionLocked && msg.region) {
            updated = { ...updated, preferredRegion: msg.region };
          }
          if (updated !== a) mutated = true;
          return updated;
        });
        return mutated ? { accounts: next } : null;
      });
      return { ok: true };
    }

    case 'SET_ACCOUNT_PREFERRED_REGION': {
      await mutateSync((sync) => ({
        accounts: sync.accounts.map((a) =>
          a.identityCenterId === msg.identityCenterId && a.accountId === msg.accountId
            ? { ...a, preferredRegion: msg.region }
            : a,
        ),
      }));
      return { ok: true };
    }

    case 'TOGGLE_REGION_LOCK': {
      await mutateSync((sync) => ({
        accounts: sync.accounts.map((a) =>
          a.identityCenterId === msg.identityCenterId && a.accountId === msg.accountId
            ? { ...a, regionLocked: msg.locked }
            : a,
        ),
      }));
      return { ok: true };
    }

    case 'ACCOUNT_ROLE_OBSERVED': {
      await mutateSync((sync) => {
        let mutated = false;
        const next = sync.accounts.map((a) => {
          if (a.accountId !== msg.accountId) return a;
          let updated = recordRoleObservation(a, msg.roleName);
          // Auto-adopt as preferred when none set yet and not locked. Only if
          // the role is part of the account's roles list (recordRoleObservation
          // already enforces this for the observation itself).
          if (
            !updated.preferredRoleName &&
            !updated.roleLocked &&
            updated.roles.some((r) => r.name === msg.roleName)
          ) {
            updated = { ...updated, preferredRoleName: msg.roleName };
          }
          if (updated !== a) mutated = true;
          return updated;
        });
        return mutated ? { accounts: next } : null;
      });
      return { ok: true };
    }

    case 'SET_ACCOUNT_PREFERRED_ROLE': {
      await mutateSync((sync) => ({
        accounts: sync.accounts.map((a) =>
          a.identityCenterId === msg.identityCenterId && a.accountId === msg.accountId
            ? { ...a, preferredRoleName: msg.roleName }
            : a,
        ),
      }));
      return { ok: true };
    }

    case 'TOGGLE_ROLE_LOCK': {
      await mutateSync((sync) => ({
        accounts: sync.accounts.map((a) =>
          a.identityCenterId === msg.identityCenterId && a.accountId === msg.accountId
            ? { ...a, roleLocked: msg.locked }
            : a,
        ),
      }));
      return { ok: true };
    }

    case 'RESCAN_OPEN_TABS': {
      await harvestOpenTabs();
      return { ok: true };
    }

    case 'REORDER_ACCOUNTS': {
      await mutateSync((sync) => {
        const keys = new Set(sync.accounts.map((a) => rowKey(a.identityCenterId, a.accountId)));
        const visible = msg.visible.filter((k) => keys.has(k));
        const hidden = msg.hidden.filter((k) => keys.has(k));
        return { accountOrder: visible, hiddenAccountIds: hidden };
      });
      return { ok: true };
    }

    case 'SET_ACCOUNT_ALIAS': {
      const trimmed = msg.alias.trim();
      await mutateSync((sync) => ({
        accounts: sync.accounts.map((a) =>
          a.identityCenterId === msg.identityCenterId && a.accountId === msg.accountId
            ? { ...a, alias: trimmed || undefined }
            : a,
        ),
      }));
      return { ok: true };
    }

    case 'SESSION_OBSERVED': {
      const tabId = chromeTabIdFromCurrentMessage();
      // Stamp role on any openTabs entry sharing this (account, subdomain).
      await mutateOpenTabs((cur) => {
        let mutated = false;
        const next = cur.map((t) => {
          if (
            t.accountId === msg.accountId &&
            t.sessionSubdomain === msg.sessionSubdomain &&
            msg.roleName &&
            t.roleName !== msg.roleName
          ) {
            mutated = true;
            return {
              ...t,
              roleName: msg.roleName,
              dedupeKey: fullDedupeKey({
                accountId: t.accountId,
                roleName: msg.roleName,
                region: t.region,
                consolePath: t.consolePath,
              }),
            };
          }
          return t;
        });
        return mutated ? next : cur;
      });
      await mutateConsoleSessions((cur) => {
        const idx = cur.findIndex(
          (s) =>
            s.accountId === msg.accountId &&
            s.sessionSubdomain === msg.sessionSubdomain,
        );
        const now = Date.now();
        if (idx === -1) {
          return [
            ...cur,
            {
              accountId: msg.accountId,
              roleName: msg.roleName,
              sessionSubdomain: msg.sessionSubdomain,
              region: msg.region,
              tabIds: tabId !== undefined ? [tabId] : [],
              observedAt: now,
            },
          ];
        }
        const existing = cur[idx];
        const tabIds =
          tabId !== undefined && !existing.tabIds.includes(tabId)
            ? [...existing.tabIds, tabId]
            : existing.tabIds;
        const next = [...cur];
        next[idx] = {
          ...existing,
          roleName: msg.roleName || existing.roleName,
          region: msg.region || existing.region,
          tabIds,
          observedAt: now,
        };
        return next;
      });
      return { ok: true };
    }

    case 'RESOLVE_LAUNCH_URL': {
      return resolveLaunchUrl(msg);
    }

    case 'CLEAR_RECENTS': {
      await mutateLocal(() => ({ recents: [] }));
      return { ok: true };
    }

    case 'SAVE_FAVORITE': {
      await mutateSync((sync) => {
        // Replace if id matches (idempotent re-save).
        const idx = sync.favorites.findIndex((f) => f.id === msg.fav.id);
        const next: Favorite[] =
          idx === -1
            ? [...sync.favorites, msg.fav]
            : sync.favorites.map((f, i) => (i === idx ? msg.fav : f));
        return { favorites: next };
      });
      return { ok: true };
    }

    case 'UPDATE_FAVORITE': {
      await mutateSync((sync) => {
        let mutated = false;
        const next = sync.favorites.map((f) => {
          if (f.id !== msg.id) return f;
          mutated = true;
          return { ...f, ...msg.patch };
        });
        return mutated ? { favorites: next } : null;
      });
      return { ok: true };
    }

    case 'DELETE_FAVORITE': {
      await mutateSync((sync) => {
        if (!sync.favorites.some((f) => f.id === msg.id)) return null;
        return { favorites: sync.favorites.filter((f) => f.id !== msg.id) };
      });
      return { ok: true };
    }

    case 'REORDER_FAVORITES': {
      await mutateSync((sync) => {
        const byId = new Map(sync.favorites.map((f) => [f.id, f]));
        const reordered: Favorite[] = [];
        for (const id of msg.ids) {
          const f = byId.get(id);
          if (f) {
            reordered.push(f);
            byId.delete(id);
          }
        }
        // Append any missing entries (defensive — shouldn't happen).
        for (const f of byId.values()) reordered.push(f);
        return { favorites: reordered };
      });
      return { ok: true };
    }

    case 'REFRESH_CATALOG': {
      const result = await refreshCatalog('manual');
      if (!result.ok) return { ok: false, error: result.error };
      return {
        ok: true,
        catalog: {
          updated: result.updated,
          version: result.version,
          services: result.services,
          features: result.features,
          icons: result.icons,
          fetchedAt: result.fetchedAt,
          source: result.source,
        },
      };
    }

    case 'CLOSE_TAB': {
      try {
        await chrome.tabs.remove(msg.tabId);
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
      // Defensive: don't rely on tabs.onRemoved listener to fire — MV3 SW
      // lifecycle can drop events. Reconcile now so storage matches reality.
      await reconcileOpenTabs();
      return { ok: true };
    }

    case 'RECONCILE_OPEN_TABS': {
      await reconcileOpenTabs();
      return { ok: true };
    }
  }
}

let lastSenderTabId: number | undefined;

function chromeTabIdFromCurrentMessage(): number | undefined {
  return lastSenderTabId;
}

async function resolveLaunchUrl(input: {
  identityCenterId: string;
  accountId: string;
  roleName: string;
  region: string;
  consolePath: string;
  serviceId?: string;
  featurePath?: string;
}): Promise<MsgResponse> {
  if (input.serviceId) {
    void bumpOpenCount(input.serviceId, input.featurePath);
  }
  const sync = await getSync();
  // Resolve IdC by id; fallback to lookup by accountId+role (recents may have
  // empty identityCenterId if they were closed before the account was scanned).
  let idc: IdentityCenter | undefined = sync.identityCenters.find(
    (i) => i.id === input.identityCenterId,
  );
  if (!idc) {
    const candidates = sync.accounts.filter((a) => a.accountId === input.accountId);
    const best = candidates.find((a) => a.roles.some((r) => r.name === input.roleName))
      ?? candidates[0];
    idc = best
      ? sync.identityCenters.find((i) => i.id === best.identityCenterId)
      : undefined;
  }
  const portalHost = idc?.portalHost;
  if (!portalHost) {
    return { ok: false, error: 'No Identity Center configured for this account.' };
  }

  const sessions = await getConsoleSessions();
  let match = sessions.find(
    (s) => s.accountId === input.accountId && s.roleName === input.roleName,
  );

  // Real-time fallback: store may be empty on first click after install/reload
  // before harvest has propagated. Probe open tabs directly.
  if (!match) {
    match = await findLiveSessionFromOpenTabs(input.accountId, input.roleName);
  }

  if (match) {
    const direct = buildDirectConsoleUrl({
      accountId: input.accountId,
      sessionSubdomain: match.sessionSubdomain,
      region: input.region,
      consolePath: input.consolePath,
    });
    const live = await isSessionLive(direct);
    if (live) {
      return { ok: true, url: direct, mode: 'direct' };
    }
    // Cookie check failed → drop the stale session entry, fall through to portal.
    await mutateConsoleSessions((cur) =>
      cur.filter(
        (s) =>
          !(
            s.accountId === input.accountId &&
            s.sessionSubdomain === match.sessionSubdomain
          ),
      ),
    );
  }

  const portal = buildPortalLaunchUrl({
    portalHost,
    accountId: input.accountId,
    roleName: input.roleName,
    region: input.region,
    consolePath: input.consolePath,
  });
  return { ok: true, url: portal, mode: 'portal' };
}

// Pragmatic liveness check: if Chrome holds any non-expired cookies for the
// multi-session subdomain, treat the session as live. Specific session-cookie
// names vary across AWS console releases; presence-of-any is a stable signal.
async function isSessionLive(url: string): Promise<boolean> {
  try {
    const cookies = await chrome.cookies.getAll({ url });
    const now = Date.now() / 1000;
    const live = cookies.filter(
      (c) => !c.expirationDate || c.expirationDate > now,
    );
    return live.length > 0;
  } catch (e) {
    console.warn('[aws-shortcut/launch] cookie check failed', e);
    return false;
  }
}

async function runScanPortal(identityCenterId: string): Promise<MsgResponse> {
  const sync = await getSync();
  const idc = sync.identityCenters.find((i) => i.id === identityCenterId);
  if (!idc) {
    return { ok: false, error: 'Identity Center not found.' };
  }
  const apiOrigin = `https://portal.sso.${idc.region}.amazonaws.com`;
  // Bearer is bound to the SSO portal session — key by portalHost so two IDCs
  // in the same region don't overwrite each other's tokens.
  const bearer = (await getBearer(idc.portalHost))?.token;
  if (!bearer) {
    return {
      ok: false,
      error: 'No portal token captured yet. Open the portal tab once.',
    };
  }
  let merged: Account[] = [];
  await mutateSync(async (cur) => {
    const incoming = await fetchAccounts(apiOrigin, bearer!, idc.id);
    merged = mergeAccountsForIdc(cur.accounts, incoming, idc.id);
    const { accountOrder, hiddenAccountIds } = reconcileOrder(
      merged,
      cur.accountOrder,
      cur.hiddenAccountIds,
    );
    return { accounts: merged, accountOrder, hiddenAccountIds };
  });
  void harvestOpenTabs();
  return { ok: true, accounts: merged };
}

function reconcileOrder(
  accounts: Account[],
  prevOrder: string[],
  prevHidden: string[],
): { accountOrder: string[]; hiddenAccountIds: string[] } {
  const incomingKeys = new Set(
    accounts.map((a) => rowKey(a.identityCenterId, a.accountId)),
  );
  const visibleKept = prevOrder.filter((k) => incomingKeys.has(k));
  const hiddenKept = prevHidden.filter((k) => incomingKeys.has(k));
  const tracked = new Set([...visibleKept, ...hiddenKept]);
  const fresh = accounts
    .map((a) => rowKey(a.identityCenterId, a.accountId))
    .filter((k) => !tracked.has(k));
  return {
    accountOrder: [...visibleKept, ...fresh],
    hiddenAccountIds: hiddenKept,
  };
}

// Capture a fresh bearer + run the scan. Side-panel-mode: reloading any
// portal tab (focused or not) is safe — the panel doesn't close on focus
// shifts. Concurrent callers for the SAME IdC share an in-flight capture;
// different IdCs run independently.
const inFlightCaptures = new Map<string, Promise<MsgResponse>>();

function captureAndScan(identityCenterId: string): Promise<MsgResponse> {
  const cached = inFlightCaptures.get(identityCenterId);
  if (cached) return cached;
  const promise = runCaptureAndScan(identityCenterId).finally(() => {
    inFlightCaptures.delete(identityCenterId);
  });
  inFlightCaptures.set(identityCenterId, promise);
  return promise;
}

async function runCaptureAndScan(identityCenterId: string): Promise<MsgResponse> {
  const sync = await getSync();
  const idc = sync.identityCenters.find((i) => i.id === identityCenterId);
  if (!idc) {
    return { ok: false, error: 'Identity Center not found.' };
  }
  const tickBefore = await getBearerTick();
  const existing = await findPortalTab(idc.portalHost);

  if (existing) {
    try {
      await chrome.tabs.reload(existing.id!);
    } catch {
      await chrome.tabs.create({ url: idc.startUrl, active: true });
    }
  } else {
    await chrome.tabs.create({ url: idc.startUrl, active: true });
  }

  await waitForBearer(idc.portalHost, tickBefore);
  return await runScanPortal(identityCenterId);
}

async function findPortalTab(
  portalHost: string,
): Promise<chrome.tabs.Tab | undefined> {
  try {
    // Match the portal's hostname regardless of path (/start, /saml, /, etc.)
    // so we don't miss tabs that navigated past the initial /start/ entry.
    const tabs = await chrome.tabs.query({ url: ['https://*.awsapps.com/*'] });
    const host = new URL(portalHost).hostname;
    return tabs.find((t) => {
      if (!t.url) return false;
      try {
        return new URL(t.url).hostname === host;
      } catch {
        return false;
      }
    });
  } catch {
    return undefined;
  }
}

// Probe open tabs for a multi-session console tab matching `accountId` AND
// `roleName`. Subdomains are bound to (account, role) on AWS side, so a
// tab's subdomain is only safe to reuse when consoleSessions confirms its
// role matches. Without role confirmation, fall through to portal launch.
async function findLiveSessionFromOpenTabs(
  accountId: string,
  roleName: string,
): Promise<
  | {
      accountId: string;
      roleName: string;
      sessionSubdomain: string;
      region: string;
      tabIds: number[];
      observedAt: number;
    }
  | undefined
> {
  try {
    const tabs = await chrome.tabs.query({
      url: ['https://*.console.aws.amazon.com/*'],
    });
    const sessions = await getConsoleSessions();
    for (const tab of tabs) {
      if (!tab.url || tab.id === undefined) continue;
      let host: string;
      try {
        host = new URL(tab.url).hostname;
      } catch {
        continue;
      }
      const m = MULTI_SESSION_HOST_RE.exec(host);
      if (!m) continue;
      if (m[1] !== accountId) continue;
      const subdomain = m[2];
      const known = sessions.find(
        (s) => s.accountId === accountId && s.sessionSubdomain === subdomain,
      );
      if (!known || known.roleName !== roleName) continue;
      return {
        accountId,
        roleName,
        sessionSubdomain: subdomain,
        region: m[3],
        tabIds: [tab.id],
        observedAt: Date.now(),
      };
    }
  } catch (e) {
    console.warn('[aws-shortcut/launch] tab probe failed', e);
  }
  return undefined;
}

function waitForBearer(portalHost: string, tickBefore: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== 'session') return;
      const bearers = changes.bearers?.newValue as Record<string, { token: string }> | undefined;
      if (bearers && bearers[portalHost]) {
        chrome.storage.onChanged.removeListener(handler);
        resolve();
        return;
      }
      // Fallback: tick bumped but our portalHost key never appeared
      // (tab→IDC resolution missed, or unrelated IDC's tab fired). Let the
      // subsequent runScanPortal surface "No portal token captured yet" so
      // the user can retry rather than hanging forever.
      const tick = changes.bearerTick?.newValue as number | undefined;
      if (tick && tick > tickBefore) {
        chrome.storage.onChanged.removeListener(handler);
        resolve();
      }
    };
    chrome.storage.onChanged.addListener(handler);
  });
}

function recordRoleObservation(account: Account, roleName: string): Account {
  if (!roleName) return account;
  if (!account.roles.some((r) => r.name === roleName)) return account;
  const observed = [...(account.observedRoles ?? [])];
  const idx = observed.findIndex((o) => o.roleName === roleName);
  const now = Date.now();
  if (idx >= 0) {
    observed[idx] = {
      roleName,
      hits: observed[idx].hits + 1,
      lastSeenAt: now,
    };
  } else {
    observed.push({ roleName, hits: 1, lastSeenAt: now });
  }
  if (sameRoleObservations(account.observedRoles, observed)) return account;
  return { ...account, observedRoles: observed };
}

function sameRoleObservations(
  a: Account['observedRoles'] | undefined,
  b: Account['observedRoles'] | undefined,
): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x.roleName !== y.roleName || x.hits !== y.hits || x.lastSeenAt !== y.lastSeenAt) {
      return false;
    }
  }
  return true;
}

function recordRegionObservation(account: Account, region: string): Account {
  if (!region) return account;
  const observed = [...(account.observedRegions ?? [])];
  const idx = observed.findIndex((o) => o.region === region);
  const now = Date.now();
  if (idx >= 0) {
    observed[idx] = {
      region,
      hits: observed[idx].hits + 1,
      lastSeenAt: now,
    };
  } else {
    observed.push({ region, hits: 1, lastSeenAt: now });
  }
  if (sameObservations(account.observedRegions, observed)) return account;
  return { ...account, observedRegions: observed };
}

function sameObservations(
  a: Account['observedRegions'] | undefined,
  b: Account['observedRegions'] | undefined,
): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x.region !== y.region || x.hits !== y.hits || x.lastSeenAt !== y.lastSeenAt) {
      return false;
    }
  }
  return true;
}

/** Merge a fresh scan of one IdC into the existing accounts list. Other
 *  IdCs' rows are preserved untouched. Returns the full accounts list. */
function mergeAccountsForIdc(
  existing: Account[],
  incoming: Account[],
  identityCenterId: string,
): Account[] {
  const other = existing.filter((a) => a.identityCenterId !== identityCenterId);
  const previousForIdc = existing.filter((a) => a.identityCenterId === identityCenterId);
  const updated = incoming.map((inc) => {
    const prev = previousForIdc.find((a) => a.accountId === inc.accountId);
    const roleNames = new Set(inc.roles.map((r) => r.name));
    // Single-role accounts auto-set; we know the full set, no ambiguity.
    const autoSingleRole =
      inc.roles.length === 1 ? inc.roles[0]?.name ?? '' : '';

    if (prev) {
      // Migration: support legacy field names from earlier builds.
      const prevAny = prev as unknown as {
        preferredRoleName?: string;
        defaultRoleName?: string;
        preferredRegion?: string;
        defaultRegion?: string;
        roleLocked?: boolean;
        regionLocked?: boolean;
      };
      const prevPreferredRole = prevAny.preferredRoleName ?? prevAny.defaultRoleName ?? '';
      const carriedRole = prevPreferredRole && roleNames.has(prevPreferredRole)
        ? prevPreferredRole
        : autoSingleRole;
      return {
        ...inc,
        alias: prev.alias,
        preferredRoleName: carriedRole,
        roleLocked: prevAny.roleLocked,
        observedRoles: prev.observedRoles?.filter((o) => roleNames.has(o.roleName)),
        preferredRegion: prevAny.preferredRegion ?? prevAny.defaultRegion ?? '',
        regionLocked: prevAny.regionLocked,
        observedRegions: prev.observedRegions,
        color: prev.color,
      };
    }
    // Neutral by default; populated by content-script observations.
    return {
      ...inc,
      preferredRoleName: autoSingleRole,
      preferredRegion: '',
      color: '',
    };
  });
  return [...other, ...updated];
}

export {};
