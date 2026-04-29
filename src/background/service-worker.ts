import type { Msg, MsgResponse } from '@/shared/messages';
import type { Account } from '@/shared/types';
import { getSync, setSync } from '@/shared/storage';
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
});

chrome.runtime.onStartup.addListener(() => {
  void refreshOriginRule();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.ssoConfig) {
    void refreshOriginRule();
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
      const sync = await getSync();
      const portalHost = sync.ssoConfig?.portalHost;
      if (!portalHost) {
        return { ok: false, error: 'No portal configured. Complete step 1 first.' };
      }
      const session = await getSessionState();
      if (!session.bearerToken) {
        return {
          ok: false,
          error: 'No portal token captured yet. Open the portal tab once.',
        };
      }
      const apiHost = session.bearerHost ?? `https://portal.sso.${sync.ssoConfig?.region ?? 'us-east-1'}.amazonaws.com`;
      const accounts = await fetchAccounts(apiHost, session.bearerToken);
      const merged = mergeAccounts(sync.accounts, accounts);
      await setSync({ accounts: merged });
      return { ok: true, accounts: merged };
    }

    case 'ACCOUNT_COLOR_OBSERVED': {
      const hex = awsColorToHex(msg.colorName);
      if (!hex) return { ok: true };
      const sync = await getSync();
      const next = sync.accounts.map((a) =>
        a.accountId === msg.accountId && a.color !== hex ? { ...a, color: hex } : a,
      );
      const changed = next.some(
        (a, i) => a.color !== sync.accounts[i]?.color,
      );
      if (changed) await setSync({ accounts: next });
      return { ok: true };
    }

    case 'ACCOUNT_REGION_OBSERVED': {
      const sync = await getSync();
      let mutated = false;
      const next = sync.accounts.map((a) => {
        if (a.accountId !== msg.accountId) return a;
        const updated = recordRegionObservation(a, msg.region);
        if (updated !== a) mutated = true;
        return updated;
      });
      if (mutated) await setSync({ accounts: next });
      return { ok: true };
    }

    case 'SET_ACCOUNT_DEFAULT_REGION': {
      const sync = await getSync();
      const next = sync.accounts.map((a) =>
        a.accountId === msg.accountId
          ? { ...a, defaultRegion: msg.region }
          : a,
      );
      await setSync({ accounts: next });
      return { ok: true };
    }

    case 'DISMISS_REGION_SUGGESTION': {
      const sync = await getSync();
      const next = sync.accounts.map((a) => {
        if (a.accountId !== msg.accountId) return a;
        const dismissed = a.dismissedRegions ?? [];
        if (dismissed.includes(msg.region)) return a;
        return { ...a, dismissedRegions: [...dismissed, msg.region] };
      });
      await setSync({ accounts: next });
      return { ok: true };
    }

    case 'ACCOUNT_ROLE_OBSERVED': {
      const sync = await getSync();
      let mutated = false;
      const next = sync.accounts.map((a) => {
        if (a.accountId !== msg.accountId) return a;
        const updated = recordRoleObservation(a, msg.roleName);
        if (updated !== a) mutated = true;
        return updated;
      });
      if (mutated) await setSync({ accounts: next });
      return { ok: true };
    }

    case 'SET_ACCOUNT_DEFAULT_ROLE': {
      const sync = await getSync();
      const next = sync.accounts.map((a) =>
        a.accountId === msg.accountId
          ? { ...a, defaultRoleName: msg.roleName }
          : a,
      );
      await setSync({ accounts: next });
      return { ok: true };
    }

    case 'DISMISS_ROLE_SUGGESTION': {
      const sync = await getSync();
      const next = sync.accounts.map((a) => {
        if (a.accountId !== msg.accountId) return a;
        const dismissed = a.dismissedRoles ?? [];
        if (dismissed.includes(msg.roleName)) return a;
        return { ...a, dismissedRoles: [...dismissed, msg.roleName] };
      });
      await setSync({ accounts: next });
      return { ok: true };
    }
  }
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
