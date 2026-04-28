import { getSync, setSync } from '@/shared/storage';
import { nextDefaultColor } from '@/shared/colors';
import type { Msg } from '@/shared/messages';
import { fetchAccounts } from './portal-api';
import {
  applyDefaults,
  maybeRecordFromTabUrl,
  openMany,
  openTarget,
} from './federation';
import { detachTab, getBearer, setBearer } from './session-store';

const PORTAL_API_HOST_PATTERN = 'https://portal.sso.*.amazonaws.com/*';

chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    const auth = details.requestHeaders?.find(
      (h) => h.name.toLowerCase() === 'authorization',
    );
    if (auth?.value?.startsWith('Bearer ')) {
      const token = auth.value.slice('Bearer '.length);
      void setBearer(token);
    }
  },
  { urls: [PORTAL_API_HOST_PATTERN] },
  ['requestHeaders', 'extraHeaders'],
);

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    void maybeRecordFromTabUrl(tabId, changeInfo.url);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void detachTab(tabId);
});

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg: Msg, _sender, reply) => {
  void handleMessage(msg)
    .then((res) => reply({ ok: true, ...res }))
    .catch((err: Error) => reply({ ok: false, error: err.message }));
  return true;
});

async function handleMessage(msg: Msg): Promise<Record<string, unknown>> {
  switch (msg.type) {
    case 'PORTAL_BEARER_CAPTURED':
      await setBearer(msg.token);
      if (msg.portalHost) {
        const sync = await getSync();
        const portalHost = msg.portalHost;
        const startUrl = `${portalHost.replace(/\/$/, '')}/start/`;
        await setSync({
          ssoConfig: {
            startUrl,
            portalHost,
            region: sync.ssoConfig?.region ?? 'us-east-1',
          },
        });
      }
      return {};

    case 'PORTAL_SCAN_REQUEST': {
      const bearer = await getBearer();
      if (!bearer) throw new Error('No bearer token captured. Open AWS portal first.');
      const accounts = await fetchAccounts(bearer);
      const sync = await getSync();
      const merged = mergeAccounts(sync.accounts, accounts, sync.prefs.globalDefaultRegion);
      await setSync({ accounts: merged });
      return { accounts: merged };
    }

    case 'OPEN_TARGET': {
      const sync = await getSync();
      const account = sync.accounts.find((a) => a.accountId === msg.favorite.accountId);
      if (!account) throw new Error(`Unknown account ${msg.favorite.accountId}`);
      const tab = await openTarget({
        accountId: msg.favorite.accountId,
        roleName: msg.favorite.roleName || account.defaultRoleName,
        region: msg.favorite.region || account.defaultRegion || sync.prefs.globalDefaultRegion,
        service: msg.favorite.service,
        feature: msg.favorite.feature,
      });
      return { tabId: tab.id };
    }

    case 'OPEN_COMPOSED': {
      const sync = await getSync();
      const targets = msg.accountIds.map((id) => {
        const account = sync.accounts.find((a) => a.accountId === id);
        if (!account) throw new Error(`Unknown account ${id}`);
        const { roleName, region } = applyDefaults(account, {
          roleName: msg.roleOverride,
          region: msg.regionOverride,
        });
        return {
          accountId: account.accountId,
          roleName,
          region: region || sync.prefs.globalDefaultRegion,
          service: msg.service,
          feature: msg.feature,
        };
      });
      const tabs = await openMany(targets);
      return { tabIds: tabs.map((t) => t.id) };
    }

    case 'CONSOLE_FAVORITES_SCRAPED': {
      // Stub: merge into a future favorites store keyed by accountId.
      // For v1 we just log; UI surfaces favorites from sync.favorites that user added explicitly.
      console.log('Favorites scraped', msg);
      return {};
    }

    case 'CONSOLE_SUBDOMAIN_OBSERVED':
      // Handled in tabs.onUpdated; included for explicit content-script flows.
      return {};

    default:
      throw new Error(`Unknown message type: ${(msg as { type: string }).type}`);
  }
}

function mergeAccounts(
  existing: Awaited<ReturnType<typeof getSync>>['accounts'],
  incoming: Awaited<ReturnType<typeof getSync>>['accounts'],
  globalDefaultRegion: string,
): Awaited<ReturnType<typeof getSync>>['accounts'] {
  const usedColors = existing.map((a) => a.color).filter(Boolean);
  return incoming.map((inc) => {
    const prev = existing.find((a) => a.accountId === inc.accountId);
    if (prev) {
      return {
        ...inc,
        defaultRoleName: prev.defaultRoleName || inc.defaultRoleName,
        defaultRegion: prev.defaultRegion || globalDefaultRegion,
        color: prev.color,
      };
    }
    const color = nextDefaultColor(usedColors);
    usedColors.push(color);
    return {
      ...inc,
      defaultRegion: globalDefaultRegion,
      color,
    };
  });
}
