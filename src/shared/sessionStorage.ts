type SessionState = {
  bearerToken?: string;
  bearerCapturedAt?: number;
  bearerHost?: string;
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
