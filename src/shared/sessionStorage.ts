type SessionState = {
  bearerToken?: string;
  bearerCapturedAt?: number;
  bearerHost?: string;
};

export type ConsoleSessionInfo = {
  accountId: string;
  roleName: string;
  sessionSubdomain: string;
  region: string;
  tabIds: number[];
  observedAt: number;
};

export async function getSessionState(): Promise<SessionState> {
  const raw = await chrome.storage.session.get(['bearerToken', 'bearerCapturedAt', 'bearerHost']);
  return raw as SessionState;
}

export async function setBearer(token: string, host: string): Promise<void> {
  await chrome.storage.session.set({
    bearerToken: token,
    bearerCapturedAt: Date.now(),
    bearerHost: host,
  });
}

const SESSIONS_KEY = 'currentSessions';

export async function getConsoleSessions(): Promise<ConsoleSessionInfo[]> {
  const raw = await chrome.storage.session.get(SESSIONS_KEY);
  return ((raw as { currentSessions?: ConsoleSessionInfo[] }).currentSessions) ?? [];
}

export async function setConsoleSessions(next: ConsoleSessionInfo[]): Promise<void> {
  await chrome.storage.session.set({ [SESSIONS_KEY]: next });
}

let sessionMutateChain: Promise<void> = Promise.resolve();

/** Serialized read-modify-write for currentSessions. Multiple tabs may
 * report observations concurrently. */
export function mutateConsoleSessions(
  fn: (cur: ConsoleSessionInfo[]) => ConsoleSessionInfo[],
): Promise<void> {
  const next = sessionMutateChain.then(async () => {
    const cur = await getConsoleSessions();
    const updated = fn(cur);
    if (updated !== cur) await setConsoleSessions(updated);
  });
  sessionMutateChain = next.catch(() => {});
  return next;
}
