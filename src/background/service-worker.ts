import type { Msg, MsgResponse } from '@/shared/messages';
import type { Account } from '@/shared/types';
import { getSync, setSync } from '@/shared/storage';
import { getSessionState, setBearer } from '@/shared/sessionStorage';
import { nextColor } from '@/shared/colors';
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
  }
}

function mergeAccounts(existing: Account[], incoming: Account[]): Account[] {
  const usedColors = existing.map((a) => a.color).filter(Boolean);
  return incoming.map((inc) => {
    const prev = existing.find((a) => a.accountId === inc.accountId);
    if (prev) {
      return {
        ...inc,
        defaultRoleName: prev.defaultRoleName || inc.defaultRoleName,
        defaultRegion: prev.defaultRegion,
        color: prev.color,
      };
    }
    const color = nextColor(usedColors);
    usedColors.push(color);
    return { ...inc, color };
  });
}

export {};
