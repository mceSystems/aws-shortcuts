import { send } from '@/shared/messages';

(() => {
  const portalHost = location.origin;
  const captured = (window as unknown as { __awsShortcutBearerCaptured?: boolean });
  if (captured.__awsShortcutBearerCaptured) return;
  captured.__awsShortcutBearerCaptured = true;

  patchXhr();
  patchFetch();

  function patchXhr(): void {
    const orig = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function (name: string, value: string) {
      if (name.toLowerCase() === 'authorization' && value.startsWith('Bearer ')) {
        const token = value.slice('Bearer '.length);
        void send({ type: 'PORTAL_BEARER_CAPTURED', token, portalHost });
      }
      return orig.call(this, name, value);
    };
  }

  function patchFetch(): void {
    const origFetch = window.fetch;
    window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      try {
        const headers = init?.headers;
        if (headers) {
          const auth = readAuthHeader(headers);
          if (auth) {
            void send({
              type: 'PORTAL_BEARER_CAPTURED',
              token: auth,
              portalHost,
            });
          }
        }
      } catch {
        // ignore
      }
      return origFetch.call(this, input, init);
    };
  }

  function readAuthHeader(headers: HeadersInit): string | undefined {
    let raw: string | undefined;
    if (headers instanceof Headers) {
      raw = headers.get('authorization') ?? undefined;
    } else if (Array.isArray(headers)) {
      const found = headers.find((h) => h[0].toLowerCase() === 'authorization');
      raw = found?.[1];
    } else {
      const obj = headers as Record<string, string>;
      const key = Object.keys(obj).find((k) => k.toLowerCase() === 'authorization');
      raw = key ? obj[key] : undefined;
    }
    if (raw?.startsWith('Bearer ')) return raw.slice('Bearer '.length);
    return undefined;
  }
})();
