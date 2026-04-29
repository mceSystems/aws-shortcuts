import type { Msg, MsgResponse } from '@/shared/messages';
import type { Account } from '@/shared/types';
import { getSync, mutateSync } from '@/shared/storage';
import { getSessionState, setBearer } from '@/shared/sessionStorage';
import { awsColorToHex } from '@/shared/colors';
import { fetchAccounts } from './portal-api';

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
  console.log('[aws-shortcut] installed');
  void refreshOriginRule();
  void harvestOpenTabs();
});

chrome.runtime.onStartup.addListener(() => {
  void refreshOriginRule();
  void harvestOpenTabs();
});

async function harvestOpenTabs(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({
      url: ['https://*.console.aws.amazon.com/*'],
    });
    console.log('[aws-shortcut] harvest: matched', tabs.length, 'console tabs');
    const consoleScript = chrome.runtime
      .getManifest()
      .content_scripts?.find((cs) =>
        cs.matches?.some((m) => m.includes('console.aws.amazon.com')),
      )
      ?.js?.[0];
    console.log('[aws-shortcut] harvest: script path', consoleScript);

    await Promise.all(
      tabs.map(async (tab) => {
        if (!tab.id) return;
        const tabId = tab.id;
        try {
          await chrome.tabs.sendMessage(tabId, { type: 'RESCAN_TAB' });
          console.log('[aws-shortcut] sendMessage ok for tab', tabId, tab.url);
        } catch (msgErr) {
          console.log('[aws-shortcut] sendMessage failed for tab', tabId, msgErr);
          if (!consoleScript) return;
          try {
            await chrome.scripting.executeScript({
              target: { tabId },
              files: [consoleScript],
            });
            console.log('[aws-shortcut] injected into tab', tabId);
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

chrome.runtime.onMessage.addListener((msg: Msg, _sender, reply) => {
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
          const updated = recordRegionObservation(a, msg.region);
          if (updated !== a) mutated = true;
          return updated;
        });
        return mutated ? { accounts: next } : null;
      });
      return { ok: true };
    }

    case 'SET_ACCOUNT_DEFAULT_REGION': {
      await mutateSync((sync) => ({
        accounts: sync.accounts.map((a) =>
          a.accountId === msg.accountId
            ? { ...a, defaultRegion: msg.region }
            : a,
        ),
      }));
      return { ok: true };
    }

    case 'DISMISS_REGION_SUGGESTION': {
      await mutateSync((sync) => ({
        accounts: sync.accounts.map((a) => {
          if (a.accountId !== msg.accountId) return a;
          const dismissed = a.dismissedRegions ?? [];
          if (dismissed.includes(msg.region)) return a;
          return { ...a, dismissedRegions: [...dismissed, msg.region] };
        }),
      }));
      return { ok: true };
    }

    case 'ACCOUNT_ROLE_OBSERVED': {
      await mutateSync((sync) => {
        let mutated = false;
        const next = sync.accounts.map((a) => {
          if (a.accountId !== msg.accountId) return a;
          const updated = recordRoleObservation(a, msg.roleName);
          if (updated !== a) mutated = true;
          return updated;
        });
        return mutated ? { accounts: next } : null;
      });
      return { ok: true };
    }

    case 'SET_ACCOUNT_DEFAULT_ROLE': {
      await mutateSync((sync) => ({
        accounts: sync.accounts.map((a) =>
          a.accountId === msg.accountId
            ? { ...a, defaultRoleName: msg.roleName }
            : a,
        ),
      }));
      return { ok: true };
    }

    case 'DISMISS_ROLE_SUGGESTION': {
      await mutateSync((sync) => ({
        accounts: sync.accounts.map((a) => {
          if (a.accountId !== msg.accountId) return a;
          const dismissed = a.dismissedRoles ?? [];
          if (dismissed.includes(msg.roleName)) return a;
          return { ...a, dismissedRoles: [...dismissed, msg.roleName] };
        }),
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
  if (inFlightCapture) {
    console.log('[aws-shortcut/bg-tab] coalescing into in-flight capture');
    return inFlightCapture;
  }
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
  const branch = existing && !userIsOnPortal ? 'reload' : 'open-new';
  console.log(
    '[aws-shortcut/bg-tab] decision',
    'existingUrl=', existing?.url ?? 'none',
    'existingId=', existing?.id ?? 'none',
    'focusedTabId=', focusedTabId ?? 'none',
    'userIsOnPortal=', userIsOnPortal,
    'branch=', branch,
  );

  let openedTabId: number | undefined;
  if (existing && !userIsOnPortal) {
    try {
      await chrome.tabs.reload(existing.id!);
    } catch {
      // Reload failed (tab vanished?); fall back to opening a new bg tab.
      const tab = await chrome.tabs.create({ url: startUrl, active: false });
      openedTabId = tab.id;
    }
  } else {
    const tab = await chrome.tabs.create({ url: startUrl, active: false });
    openedTabId = tab.id;
  }

  try {
    await waitForBearer(beforeCapturedAt);
    return await runScanPortal();
  } finally {
    console.log('[aws-shortcut/bg-tab] finally openedTabId=', openedTabId ?? 'none');
    if (openedTabId !== undefined) {
      try {
        await chrome.tabs.remove(openedTabId);
        console.log('[aws-shortcut/bg-tab] removed tab', openedTabId);
      } catch (e) {
        console.warn('[aws-shortcut/bg-tab] tabs.remove failed', e);
      }
    } else {
      console.log('[aws-shortcut/bg-tab] no openedTabId — branch was reload, skipping close');
    }
  }
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
      // Preserve user-set default if still valid; clear otherwise.
      const carriedDefault = prev.defaultRoleName && roleNames.has(prev.defaultRoleName)
        ? prev.defaultRoleName
        : autoSingleRole;
      return {
        ...inc,
        defaultRoleName: carriedDefault,
        observedRoles: prev.observedRoles?.filter((o) => roleNames.has(o.roleName)),
        dismissedRoles: prev.dismissedRoles?.filter((r) => roleNames.has(r)),
        defaultRegion: prev.defaultRegion,
        observedRegions: prev.observedRegions,
        dismissedRegions: prev.dismissedRegions,
        color: prev.color,
      };
    }
    // Neutral by default; populated by content-script observations.
    return {
      ...inc,
      defaultRoleName: autoSingleRole,
      color: '',
    };
  });
}

export {};
