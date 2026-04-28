import { getSession, sessionKey, setSession } from '@/shared/storage';
import type { SessionState } from '@/shared/types';

export async function getActiveSession(
  accountId: string,
  roleName: string,
): Promise<SessionState | undefined> {
  const s = await getSession();
  return s.sessions[sessionKey(accountId, roleName)];
}

export async function recordSession(
  accountId: string,
  roleName: string,
  state: Partial<SessionState> & { sessionSubdomain: string },
): Promise<void> {
  const s = await getSession();
  const k = sessionKey(accountId, roleName);
  const existing = s.sessions[k];
  s.sessions[k] = {
    sessionSubdomain: state.sessionSubdomain,
    expiresAt: state.expiresAt ?? existing?.expiresAt,
    tabIds: Array.from(new Set([...(existing?.tabIds ?? []), ...(state.tabIds ?? [])])),
  };
  await setSession({ sessions: s.sessions });
}

export async function attachTab(
  accountId: string,
  roleName: string,
  tabId: number,
): Promise<void> {
  const s = await getSession();
  const k = sessionKey(accountId, roleName);
  const existing = s.sessions[k];
  if (!existing) return;
  if (!existing.tabIds.includes(tabId)) {
    existing.tabIds = [...existing.tabIds, tabId];
    await setSession({ sessions: s.sessions });
  }
}

export async function detachTab(tabId: number): Promise<void> {
  const s = await getSession();
  let changed = false;
  for (const k of Object.keys(s.sessions)) {
    const before = s.sessions[k].tabIds.length;
    s.sessions[k].tabIds = s.sessions[k].tabIds.filter((id) => id !== tabId);
    if (s.sessions[k].tabIds.length !== before) changed = true;
  }
  if (changed) await setSession({ sessions: s.sessions });
}

export async function setBearer(token: string): Promise<void> {
  await setSession({ bearerToken: token, bearerCapturedAt: Date.now() });
}

export async function getBearer(): Promise<string | undefined> {
  return (await getSession()).bearerToken;
}
