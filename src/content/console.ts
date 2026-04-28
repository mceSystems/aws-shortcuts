import { send } from '@/shared/messages';

const MULTI_SESSION_HOST_RE = /^([0-9]{12})-([a-z0-9]+)\.([a-z0-9-]+)\.console\.aws\.amazon\.com$/;

(() => {
  reportSubdomain();
  scheduleFavoritesScrape();

  function reportSubdomain(): void {
    const m = MULTI_SESSION_HOST_RE.exec(location.hostname);
    if (!m) return;
    const [, accountId, , region] = m;
    void chrome.storage.session
      .get('accounts')
      .then(() => {
        // Background tab listener already records subdomain; this is a backstop
        // for when the tab was opened outside the extension.
        void send({
          type: 'CONSOLE_SUBDOMAIN_OBSERVED',
          accountId,
          roleName: '',
          sessionSubdomain: `${m[1]}-${m[2]}`,
          tabId: -1,
        });
      })
      .catch(() => {});
    void region; // reserved for future region capture
  }

  function scheduleFavoritesScrape(): void {
    const tries = [500, 1500, 4000];
    for (const t of tries) {
      window.setTimeout(scrapeFavorites, t);
    }
  }

  function scrapeFavorites(): void {
    const m = MULTI_SESSION_HOST_RE.exec(location.hostname);
    if (!m) return;
    const accountId = m[1];
    const services = readFavoritesBar();
    if (services.length === 0) return;
    void send({ type: 'CONSOLE_FAVORITES_SCRAPED', accountId, services });
  }

  function readFavoritesBar(): string[] {
    // AWS console favorites bar selectors are unstable across releases.
    // Try a few known anchor patterns; fail silent.
    const candidates: string[] = [];
    const selectors = [
      '[data-testid="favorite-service-link"]',
      '[data-testid="awsc-nav-favorite-link"]',
      'a[data-favorite="true"]',
    ];
    for (const sel of selectors) {
      const nodes = document.querySelectorAll<HTMLAnchorElement>(sel);
      nodes.forEach((n) => {
        const label = n.textContent?.trim();
        if (label) candidates.push(label);
      });
      if (candidates.length > 0) break;
    }
    return Array.from(new Set(candidates));
  }
})();
