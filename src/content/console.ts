// Content script for AWS console pages.
// Observes "Account colour", currently-active region (URL), and federated role.
// Sends ACCOUNT_COLOR_OBSERVED + ACCOUNT_REGION_OBSERVED + ACCOUNT_ROLE_OBSERVED.

const MULTI_SESSION_HOST = /^([0-9]{12})-([a-z0-9]+)\.([a-z0-9-]+)\.console\.aws\.amazon\.com$/;
const COLOR_LABEL_RE = /account\s+colou?r/i;
const KNOWN_COLORS = new Set([
  'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink',
]);
const ROLE_RE = /AWSReservedSSO_([A-Za-z0-9+=,.@_-]+?)_[a-f0-9]{16}/;

// AWS console multi-session band hex (approximate, refined from observation).
// The band's background-color is mapped to the nearest of these in RGB space.
const AWS_BAND_RGB: Record<string, [number, number, number]> = {
  red:    [0xDC, 0x26, 0x26],
  orange: [0xEA, 0x58, 0x0C],
  yellow: [0xEC, 0xC9, 0x4D],
  green:  [0x16, 0xA3, 0x4A],
  teal:   [0x0D, 0x94, 0x88],
  blue:   [0x25, 0x63, 0xEB],
  purple: [0x93, 0x33, 0xEA],
  pink:   [0xDB, 0x27, 0x77],
};

(() => {
  const match = MULTI_SESSION_HOST.exec(location.hostname);
  if (!match) return;
  const accountId = match[1];
  const hostRegion = match[3];

  let lastReported: string | null = null;
  let lastRegion: string | null = null;
  let lastRole: string | null = null;

  function reportRegion(region: string): void {
    if (!region || region === lastRegion) return;
    lastRegion = region;
    void chrome.runtime.sendMessage({
      type: 'ACCOUNT_REGION_OBSERVED',
      accountId,
      region,
    });
  }

  function regionFromUrl(): string {
    try {
      const params = new URLSearchParams(location.search);
      const queryRegion = params.get('region');
      if (queryRegion) return queryRegion;
    } catch {
      // ignore
    }
    return hostRegion;
  }

  reportRegion(regionFromUrl());

  // SPA navigation: AWS console uses pushState/replaceState. Patch both to
  // dispatch a custom event we can listen for, plus catch back/forward via
  // popstate. No polling.
  patchHistoryForUrlChange();
  const onUrlChange = () => reportRegion(regionFromUrl());
  window.addEventListener('aws-shortcut:urlchange', onUrlChange);
  window.addEventListener('popstate', onUrlChange);

  // Allow background to ask us to re-scan on demand (e.g. user clicks refresh
  // in the popup, or extension boot harvesting existing tabs).
  chrome.runtime.onMessage.addListener((msg: { type?: string }, _sender, reply) => {
    if (msg?.type === 'RESCAN_TAB') {
      // Reset caches so a forced re-scan re-emits even if values match.
      lastReported = null;
      lastRole = null;
      lastRegion = null;
      reportRegion(regionFromUrl());
      tryScrape();
      reply?.({ ok: true });
      return true;
    }
    return false;
  });

  function tryScrape(): void {
    const fromBand = findColorFromBand();
    const fromText = fromBand ? null : findColorName();
    const color = fromBand ?? fromText;
    const role = findRoleName();
    console.log('[aws-shortcut/cs]', accountId, {
      colorBand: fromBand,
      colorText: fromText,
      role,
      url: location.href,
    });
    if (color && color !== lastReported) {
      lastReported = color;
      void chrome.runtime.sendMessage({
        type: 'ACCOUNT_COLOR_OBSERVED',
        accountId,
        colorName: color,
      });
    }
    if (role && role !== lastRole) {
      lastRole = role;
      void chrome.runtime.sendMessage({
        type: 'ACCOUNT_ROLE_OBSERVED',
        accountId,
        roleName: role,
      });
    }
  }

  function findColorFromBand(): string | null {
    // The multi-session band at the top of the console always renders
    // "<account-name> (<account-id>)" with a colored background when a color
    // is assigned. Find the smallest element matching that pattern + check
    // its own background-color (no walk-up — that picks up unrelated nearby
    // colors). If the band's bg is neutral/transparent, the account has no
    // assigned color → return null.
    const accountText = `(${accountId})`;
    const candidates = document.querySelectorAll<HTMLElement>('span, div, header, section');
    let best: { el: HTMLElement; depth: number } | null = null;
    candidates.forEach((el) => {
      if (!el.textContent?.includes(accountText)) return;
      if (el.children.length > 4) return;
      const depth = elementDepth(el);
      if (!best || depth > best.depth) best = { el, depth };
    });
    if (!best) return null;
    const bestEl: HTMLElement = (best as { el: HTMLElement; depth: number }).el;
    // Read the band element's own bg + at most one ancestor up (sometimes the
    // bg sits on the immediate parent strip, not the text span).
    const direct = readSaturatedBg(bestEl);
    if (direct) return nearestAwsColorName(direct);
    if (bestEl.parentElement) {
      const up = readSaturatedBg(bestEl.parentElement);
      if (up) return nearestAwsColorName(up);
    }
    return null;
  }

  function readSaturatedBg(el: HTMLElement): [number, number, number] | null {
    const rgb = parseRgb(getComputedStyle(el).backgroundColor);
    if (!rgb) return null;
    if (isNeutralRgb(rgb)) return null;
    if (saturation(rgb) < 0.35) return null;
    return rgb;
  }

  function elementDepth(el: HTMLElement): number {
    let d = 0;
    let cursor: HTMLElement | null = el;
    while (cursor) {
      d++;
      cursor = cursor.parentElement;
    }
    return d;
  }

  function parseRgb(value: string): [number, number, number] | null {
    // Accept "rgb(r, g, b)" and "rgba(r, g, b, a)".
    const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
    if (!m) return null;
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  }

  function isNeutralRgb([r, g, b]: [number, number, number]): boolean {
    // Treat near-greyscale or near-black/near-white as "no color".
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max - min < 50) return true;       // wide greyscale tolerance for tinted bgs
    if (max < 64) return true;             // near-black / dark theme bg
    if (min > 220) return true;            // near-white
    return false;
  }

  function saturation([r, g, b]: [number, number, number]): number {
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    if (max === 0) return 0;
    return (max - min) / max;
  }

  function nearestAwsColorName(rgb: [number, number, number]): string {
    let bestName = '';
    let bestDist = Infinity;
    for (const [name, target] of Object.entries(AWS_BAND_RGB)) {
      const d =
        Math.pow(rgb[0] - target[0], 2) +
        Math.pow(rgb[1] - target[1], 2) +
        Math.pow(rgb[2] - target[2], 2);
      if (d < bestDist) {
        bestDist = d;
        bestName = name;
      }
    }
    return bestName;
  }

  function findRoleName(): string | null {
    // Doc order puts the Current session panel BEFORE "other active session"
    // panels. Use the first match in the body — naturally picks the current
    // account's role.
    const m = ROLE_RE.exec(document.body?.textContent ?? '');
    return m?.[1] ?? null;
  }

  function findColorName(): string | null {
    // Walker over text nodes. For each "Account colour" label, scan ONLY the
    // small surrounding container (label + value pair). Skip anything bigger
    // — bigger scope picks up other accounts' colors in the multi-session
    // sidebar OR random text in the document body. Doc order naturally puts
    // the Current session panel before "1 other active session" panels.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim();
      if (!text || !COLOR_LABEL_RE.test(text)) continue;
      const color = readNearbyColor(node);
      if (color) return color;
    }
    return null;
  }

  function readNearbyColor(labelNode: Node): string | null {
    // Walk up at most 4 levels. Return the first level where matchColor finds
    // something. This bounds scope to the current label/value cluster while
    // tolerating different layout depths.
    let el: HTMLElement | null = labelNode.parentElement;
    let hops = 0;
    while (el && hops < 4) {
      const found = matchColor(el.textContent ?? '');
      if (found) return found;
      el = el.parentElement;
      hops++;
    }
    return null;
  }

  function matchColor(text: string): string | null {
    const lower = text.toLowerCase();
    for (const c of KNOWN_COLORS) {
      if (new RegExp(`\\b${c}\\b`).test(lower)) return c;
    }
    return null;
  }

  // Initial pass + observe DOM changes (sidebar opens on click, band loads
  // late in some flows). MutationObserver is cheap; no timeout — runs as
  // long as the tab lives.
  tryScrape();
  const observer = new MutationObserver(() => tryScrape());
  observer.observe(document.body, { childList: true, subtree: true });
})();

function patchHistoryForUrlChange(): void {
  const w = window as unknown as { __awsShortcutHistoryPatched?: boolean };
  if (w.__awsShortcutHistoryPatched) return;
  w.__awsShortcutHistoryPatched = true;
  const fire = () => window.dispatchEvent(new Event('aws-shortcut:urlchange'));
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function (...args: Parameters<typeof origPush>) {
    const ret = origPush.apply(this, args);
    fire();
    return ret;
  };
  history.replaceState = function (...args: Parameters<typeof origReplace>) {
    const ret = origReplace.apply(this, args);
    fire();
    return ret;
  };
}
