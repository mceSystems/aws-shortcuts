import type { Account, Role } from '@/shared/types';

type AppInstance = {
  id: string;
  name: string;
  description?: string;
  applicationId?: string;
  applicationName?: string;
  searchMetadata?: {
    AccountId?: string;
    AccountName?: string;
    AccountEmail?: string;
  };
};

type Profile = {
  id: string;
  name: string;
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
    const body = await res.text().catch(() => '');
    throw new Error(`Portal API ${path} → ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export async function listAppInstances(
  portalHost: string,
  bearer: string,
): Promise<AppInstance[]> {
  const data = await call<{ result: AppInstance[] }>(
    portalHost,
    '/instance/appinstances',
    bearer,
  );
  return data.result ?? [];
}

export async function listProfiles(
  portalHost: string,
  bearer: string,
  appInstanceId: string,
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
  portalHost: string,
  bearer: string,
): Promise<Account[]> {
  const apps = await listAppInstances(portalHost, bearer);
  const out: Account[] = [];
  for (const app of apps) {
    const accountId = app.searchMetadata?.AccountId;
    if (!accountId) continue;
    const profiles = await listProfiles(portalHost, bearer, app.id);
    const roles: Role[] = profiles.map((p) => ({ name: p.name }));
    out.push({
      accountId,
      name: app.searchMetadata?.AccountName ?? app.name,
      email: app.searchMetadata?.AccountEmail,
      appInstanceId: app.id,
      roles,
      // mergeAccounts auto-fills preferredRoleName for single-role accounts.
      preferredRoleName: '',
      preferredRegion: '',
      color: '',
    });
  }
  return out;
}
