import { getSync } from '@/shared/storage';
import type { Account } from '@/shared/types';
import { getActiveSession, recordSession } from './session-store';

export type ClickTarget = {
  accountId: string;
  roleName: string;
  region: string;
  service: string;
  feature?: string;
};

export function buildDeepLinkPath(service: string, feature?: string, region?: string): string {
  const regionParam = region ? `?region=${region}` : '';
  const featureFragment = feature ? `#${feature}` : '';
  return `/${service}/home${regionParam}${featureFragment}`;
}

export function buildPortalShortcutUrl(
  portalHost: string,
  target: ClickTarget,
  destinationConsoleUrl: string,
): string {
  const url = new URL(`${portalHost}/start/`);
  url.hash = `#/console?account_id=${target.accountId}&role_name=${target.roleName}&destination=${encodeURIComponent(destinationConsoleUrl)}`;
  return url.toString();
}

export function buildMultiSessionConsoleUrl(
  sessionSubdomain: string,
  region: string,
  deepLinkPath: string,
): string {
  return `https://${sessionSubdomain}.${region}.console.aws.amazon.com${deepLinkPath}`;
}

export function buildLegacyConsoleUrl(region: string, deepLinkPath: string): string {
  return `https://${region}.console.aws.amazon.com${deepLinkPath}`;
}

export async function resolveTargetUrl(target: ClickTarget): Promise<string> {
  const sync = await getSync();
  const portalHost = sync.ssoConfig?.startUrl?.replace(/\/start\/?#?\/?$/, '') ??
    'https://d-90679c71d5.awsapps.com';
  const deepLinkPath = buildDeepLinkPath(target.service, target.feature, target.region);

  const session = await getActiveSession(target.accountId, target.roleName);
  if (session && (!session.expiresAt || session.expiresAt > Date.now())) {
    return buildMultiSessionConsoleUrl(session.sessionSubdomain, target.region, deepLinkPath);
  }

  const fallbackConsole = buildLegacyConsoleUrl(target.region, deepLinkPath);
  return buildPortalShortcutUrl(portalHost, target, fallbackConsole);
}

export async function openTarget(target: ClickTarget): Promise<chrome.tabs.Tab> {
  const url = await resolveTargetUrl(target);
  const tab = await chrome.tabs.create({ url });
  return tab;
}

export async function openMany(
  targets: ClickTarget[],
): Promise<chrome.tabs.Tab[]> {
  const tabs: chrome.tabs.Tab[] = [];
  for (const t of targets) {
    tabs.push(await openTarget(t));
  }
  return tabs;
}

export function applyDefaults(account: Account, override?: { roleName?: string; region?: string }): {
  roleName: string;
  region: string;
} {
  return {
    roleName: override?.roleName ?? account.defaultRoleName ?? account.roles[0]?.name ?? '',
    region: override?.region ?? account.defaultRegion ?? '',
  };
}

const MULTI_SESSION_HOST_RE = /^([0-9]{12})-([a-z0-9]+)\.([a-z0-9-]+)\.console\.aws\.amazon\.com$/;

export function parseMultiSessionUrl(url: string): {
  accountId: string;
  sessionSubdomain: string;
  region: string;
} | undefined {
  try {
    const u = new URL(url);
    const m = MULTI_SESSION_HOST_RE.exec(u.hostname);
    if (!m) return undefined;
    return {
      accountId: m[1],
      sessionSubdomain: `${m[1]}-${m[2]}`,
      region: m[3],
    };
  } catch {
    return undefined;
  }
}

export async function maybeRecordFromTabUrl(tabId: number, url: string): Promise<void> {
  const parsed = parseMultiSessionUrl(url);
  if (!parsed) return;
  const sync = await getSync();
  const account = sync.accounts.find((a) => a.accountId === parsed.accountId);
  if (!account) return;
  const roleName = account.defaultRoleName ?? account.roles[0]?.name;
  if (!roleName) return;
  await recordSession(account.accountId, roleName, {
    sessionSubdomain: parsed.sessionSubdomain,
    tabIds: [tabId],
  });
}
