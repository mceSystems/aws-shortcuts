import type { Account, Role } from '@/shared/types';

const PORTAL_HOST_DEFAULT = 'https://portal.sso.us-east-1.amazonaws.com';

type AppInstance = {
  id: string;
  name: string;
  description?: string;
  applicationId?: string;
  applicationName?: string;
  searchMetadata?: { AccountId?: string; AccountName?: string; AccountEmail?: string };
};

type Profile = {
  id: string;
  name: string;
  description?: string;
  protocol?: string;
  url?: string;
};

async function call<T>(
  portalHost: string,
  path: string,
  bearer: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${portalHost}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json, text/plain, */*',
      Authorization: `Bearer ${bearer}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Portal API ${path} → ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export async function listAppInstances(
  bearer: string,
  portalHost: string = PORTAL_HOST_DEFAULT,
): Promise<AppInstance[]> {
  const data = await call<{ result: AppInstance[] }>(
    portalHost,
    '/instance/appinstances',
    bearer,
  );
  return data.result ?? [];
}

export async function listProfiles(
  bearer: string,
  appInstanceId: string,
  portalHost: string = PORTAL_HOST_DEFAULT,
): Promise<Profile[]> {
  const data = await call<{ result: Profile[] }>(
    portalHost,
    `/instance/appinstance/${appInstanceId}/profiles`,
    bearer,
    { method: 'POST' },
  );
  return data.result ?? [];
}

export async function fetchAccounts(
  bearer: string,
  portalHost?: string,
): Promise<Account[]> {
  const apps = await listAppInstances(bearer, portalHost);
  const accountApps = apps.filter((a) => a.searchMetadata?.AccountId);
  const accounts: Account[] = [];
  for (const app of accountApps) {
    const accountId = app.searchMetadata!.AccountId!;
    const profiles = await listProfiles(bearer, app.id, portalHost);
    const roles: Role[] = profiles.map((p) => ({ name: p.name }));
    accounts.push({
      accountId,
      name: app.searchMetadata?.AccountName ?? app.name,
      email: app.searchMetadata?.AccountEmail,
      appInstanceId: app.id,
      roles,
      defaultRoleName: roles[0]?.name ?? '',
      defaultRegion: '',
      color: '',
    });
  }
  return accounts;
}
