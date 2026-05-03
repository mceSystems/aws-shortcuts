import type { Msg, MsgResponse } from '@/shared/messages';
import type { Account, Favorite, Recent } from '@/shared/types';
import { getSync, mutateLocal, mutateSync } from '@/shared/storage';
import {
  getSessionState,
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
    const host = new URL(details.url).origin;
    void setBearer(token, host);
  },
  { urls: PORTAL_API_URLS },
  ['requestHeaders', 'extraHeaders'],
);

chrome.runtime.onInstalled.addListener(() => {
  void refreshOriginRule();
  void harvestOpenTabs();
  void chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.warn('[aws-shortcut] sidePanel setPanelBehavior failed:', err));
});

chrome.runtime.onStartup.addListener(() => {
  void refreshOriginRule();
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
        hits: existing.hits + 1,
        ts: now,
      };
      next = [updated, ...list.slice(0, idx), ...list.slice(idx + 1)];
    } else {
      const fresh: Recent = {
        id: `r_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
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

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (changes.ssoConfig) {
    void refreshOriginRule();
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
// sees the same headers a normal portal page would send.
const ORIGIN_RULE_ID = 1001;

async function refreshOriginRule(): Promise<void> {
  try {
    const sync = await getSync();
    const portalHost = sync.ssoConfig?.portalHost;
    if (!portalHost) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [ORIGIN_RULE_ID],
      });
      return;
    }
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [ORIGIN_RULE_ID],
      addRules: [
        {
          id: ORIGIN_RULE_ID,
          priority: 1,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders: [
              {
                header: 'Origin',
                operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                value: portalHost,
              },
              {
                header: 'Referer',
                operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                value: `${portalHost}/start/`,
              },
            ],
          },
          condition: {
            urlFilter: 'portal.sso.',
            resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST],
            initiatorDomains: [chrome.runtime.id],
          },
        },
      ],
    });
  } catch (e) {
    console.error('[aws-shortcut] failed to set origin rule', e);
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
      const s = await getSessionState();
      return { ok: true, bearer: s.bearerToken };
    }

    case 'SCAN_PORTAL': {
      return runScanPortal();
    }

    case 'CAPTURE_AND_SCAN_VIA_BG_TAB': {
      return captureAndScanViaBgTab();
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
          a.accountId === msg.accountId
            ? { ...a, preferredRegion: msg.region }
            : a,
        ),
      }));
      return { ok: true };
    }

    case 'TOGGLE_REGION_LOCK': {
      await mutateSync((sync) => ({
        accounts: sync.accounts.map((a) =>
          a.accountId === msg.accountId
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
          a.accountId === msg.accountId
            ? { ...a, preferredRoleName: msg.roleName }
            : a,
        ),
      }));
      return { ok: true };
    }

    case 'TOGGLE_ROLE_LOCK': {
      await mutateSync((sync) => ({
        accounts: sync.accounts.map((a) =>
          a.accountId === msg.accountId
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
        const ids = new Set(sync.accounts.map((a) => a.accountId));
        const visible = msg.visible.filter((id) => ids.has(id));
        const hidden = msg.hidden.filter((id) => ids.has(id));
        return { accountOrder: visible, hiddenAccountIds: hidden };
      });
      return { ok: true };
    }

    case 'SET_ACCOUNT_ALIAS': {
      const trimmed = msg.alias.trim();
      await mutateSync((sync) => ({
        accounts: sync.accounts.map((a) =>
          a.accountId === msg.accountId
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
  }
}

let lastSenderTabId: number | undefined;

function chromeTabIdFromCurrentMessage(): number | undefined {
  return lastSenderTabId;
}

async function resolveLaunchUrl(input: {
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
  const portalHost = sync.ssoConfig?.portalHost;
  if (!portalHost) {
    return { ok: false, error: 'No portal configured.' };
  }

  const sessions = await getConsoleSessions();
  let match = sessions.find(
    (s) => s.accountId === input.accountId && s.roleName === input.roleName,
  );

  // Real-time fallback: store may be empty on first click after install/reload
  // before harvest has propagated. Probe open tabs directly.
  if (!match) {
    match = await findLiveSessionFromOpenTabs(input.accountId);
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

async function runScanPortal(): Promise<MsgResponse> {
  const session = await getSessionState();
  if (!session.bearerToken) {
    return {
      ok: false,
      error: 'No portal token captured yet. Open the portal tab once.',
    };
  }
  let merged: Account[] = [];
  let scanError: string | null = null;
  await mutateSync(async (sync) => {
    const portalHost = sync.ssoConfig?.portalHost;
    if (!portalHost) {
      scanError = 'No portal configured. Complete step 1 first.';
      return null;
    }
    const apiHost =
      session.bearerHost ??
      `https://portal.sso.${sync.ssoConfig?.region ?? 'us-east-1'}.amazonaws.com`;
    const accounts = await fetchAccounts(apiHost, session.bearerToken!);
    merged = mergeAccounts(sync.accounts, accounts);
    const { accountOrder, hiddenAccountIds } = reconcileOrder(
      merged,
      sync.accountOrder,
      sync.hiddenAccountIds,
    );
    return { accounts: merged, accountOrder, hiddenAccountIds };
  });
  if (scanError) return { ok: false, error: scanError };
  void harvestOpenTabs();
  return { ok: true, accounts: merged };
}

function reconcileOrder(
  accounts: Account[],
  prevOrder: string[],
  prevHidden: string[],
): { accountOrder: string[]; hiddenAccountIds: string[] } {
  const incomingIds = new Set(accounts.map((a) => a.accountId));
  const visibleKept = prevOrder.filter((id) => incomingIds.has(id));
  const hiddenKept = prevHidden.filter((id) => incomingIds.has(id));
  const tracked = new Set([...visibleKept, ...hiddenKept]);
  const fresh = accounts
    .map((a) => a.accountId)
    .filter((id) => !tracked.has(id));
  return {
    accountOrder: [...visibleKept, ...fresh],
    hiddenAccountIds: hiddenKept,
  };
}

// Capture a fresh bearer + run the scan, without breaking the user's flow.
//
// - If a portal tab exists AND is not the user's currently focused tab,
//   reload it in place (no focus shift, popup survives). Don't close it after.
// - Otherwise (no portal tab, or the user IS on the portal right now), open
//   a new background tab, wait for the bearer, then close it after scan.
//   Reloading the user's focused tab would steal focus and auto-close the
//   popup, so we leave it alone.
//
// Concurrent callers share the same in-flight capture — strict-mode double
// mounts and storage-onChanged retries used to spin up multiple tabs.
let inFlightCapture: Promise<MsgResponse> | null = null;

function captureAndScanViaBgTab(): Promise<MsgResponse> {
  if (inFlightCapture) return inFlightCapture;
  inFlightCapture = runCaptureAndScan().finally(() => {
    inFlightCapture = null;
  });
  return inFlightCapture;
}

async function runCaptureAndScan(): Promise<MsgResponse> {
  const sync = await getSync();
  const startUrl = sync.ssoConfig?.startUrl;
  const portalHost = sync.ssoConfig?.portalHost;
  if (!startUrl || !portalHost) {
    return { ok: false, error: 'No portal configured. Complete step 1 first.' };
  }

  const beforeCapturedAt = (await getSessionState()).bearerCapturedAt ?? 0;
  const existing = await findPortalTab(portalHost);
  const focusedTabId = await getFocusedTabId();
  const userIsOnPortal = existing?.id !== undefined && existing.id === focusedTabId;

  // Side-panel-only policy: focus tabs (no hidden bg open), and never
  // auto-close a tab we created. The user keeps control of their tabs.
  if (existing && !userIsOnPortal) {
    try {
      await chrome.tabs.reload(existing.id!);
    } catch {
      // Reload failed (tab vanished?); open a fresh portal tab.
      await chrome.tabs.create({ url: startUrl, active: true });
    }
  } else if (!existing) {
    await chrome.tabs.create({ url: startUrl, active: true });
  }

  await waitForBearer(beforeCapturedAt);
  return await runScanPortal();
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

// Probe open tabs for a multi-session console tab matching `accountId`. Used
// as a real-time fallback when our session store hasn't been populated yet.
async function findLiveSessionFromOpenTabs(
  accountId: string,
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
      return {
        accountId,
        roleName: '',
        sessionSubdomain: m[2],
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

async function getFocusedTabId(): Promise<number | undefined> {
  try {
    // Filter to normal browser windows so the popup / devtools window doesn't
    // get returned as the "focused" window from a service worker context.
    const win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
    const tabs = await chrome.tabs.query({ active: true, windowId: win.id });
    return tabs[0]?.id;
  } catch {
    return undefined;
  }
}

function waitForBearer(after: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== 'session') return;
      const next = changes.bearerCapturedAt?.newValue as number | undefined;
      if (next && next > after) {
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

function mergeAccounts(existing: Account[], incoming: Account[]): Account[] {
  return incoming.map((inc) => {
    const prev = existing.find((a) => a.accountId === inc.accountId);
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
}

export {};
