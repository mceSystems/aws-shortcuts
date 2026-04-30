// Catalog harvester. Developer-only: scrapes the AWS console DOM in a
// dedicated tab and returns service / feature metadata. Used by the
// HarvestSection in the Settings page (dev builds only) to seed
// catalog/services.json without hand-curating every service.
//
// All scraping runs via chrome.scripting.executeScript so we can iterate
// selectors without redeploying a content script. AWS regenerates Cloudscape
// markup occasionally — when this breaks, update SELECTORS below.

import type { HarvestedFeature, HarvestedService, HarvestProgress } from '@/shared/messages';
import { getConsoleSessions, type ConsoleSessionInfo } from '@/shared/sessionStorage';
import { getSync } from '@/shared/storage';
import { buildPortalLaunchUrl } from '@/shared/launcher';

/** Build a session-bound console URL. AWS sets cookies per multi-session
 * subdomain; bare console.aws.amazon.com goes to signin without a session. */
function sessionUrl(session: ConsoleSessionInfo, path = 'console/home'): string {
  return `https://${session.accountId}-${session.sessionSubdomain}.${session.region}.console.aws.amazon.com/${path}?region=${session.region}`;
}

async function pickLiveSession(): Promise<ConsoleSessionInfo> {
  const existing = await getConsoleSessions();
  if (existing.length > 0) return existing[0];
  return await bootstrapSession();
}

/** No live session in store. Launch one via the SSO portal using the first
 * configured account, wait for the content script to emit SESSION_OBSERVED. */
async function bootstrapSession(): Promise<ConsoleSessionInfo> {
  const sync = await getSync();
  const portalHost = sync.ssoConfig?.portalHost;
  if (!portalHost) {
    throw new Error('no SSO portal configured — finish onboarding first');
  }
  const account = sync.accounts.find((a) => a.preferredRoleName && a.preferredRegion);
  if (!account) {
    throw new Error('no account with preferred role + region — open a service via popup first');
  }
  const launchUrl = buildPortalLaunchUrl({
    portalHost,
    accountId: account.accountId,
    roleName: account.preferredRoleName,
    region: account.preferredRegion,
    consolePath: 'console/home',
  });
  const tab = await chrome.tabs.create({ url: launchUrl, active: false });
  if (!tab.id) throw new Error('failed to open SSO launch tab');
  try {
    return await waitForSession(tab.id, 30_000);
  } finally {
    // Close the bootstrap tab — its session is now in store + we'll open
    // a fresh harvest tab with the multi-session subdomain.
    try {
      await chrome.tabs.remove(tab.id);
    } catch {
      // ignore
    }
  }
}

function waitForSession(tabId: number, timeoutMs: number): Promise<ConsoleSessionInfo> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const poll = setInterval(async () => {
      try {
        const sessions = await getConsoleSessions();
        const match = sessions.find((s) => s.tabIds.includes(tabId)) ?? sessions[0];
        if (match) {
          clearInterval(poll);
          resolve(match);
          return;
        }
        if (Date.now() - start > timeoutMs) {
          clearInterval(poll);
          reject(new Error('SSO bootstrap timed out — sign in to the SSO portal first'));
        }
      } catch {
        // keep polling
      }
    }, 600);
  });
}

let cancelled = false;
let running: 'services' | 'features' | null = null;

export function cancelHarvest(): void {
  cancelled = true;
}
function checkCancel(): void {
  if (cancelled) throw new Error('cancelled');
}
function resetCancel(): void {
  cancelled = false;
}
function assertNotRunning(phase: 'services' | 'features'): void {
  if (running) throw new Error(`harvest busy: ${running}. Click Cancel and retry.`);
  running = phase;
}
function clearRunning(): void {
  running = null;
}

function emit(progress: HarvestProgress): void {
  void chrome.runtime.sendMessage(progress).catch(() => {
    // Options page may have closed; ignore.
  });
}

type WaitedTab = { tabId: number; created: boolean };

async function openHarvestTab(url: string, active = false): Promise<WaitedTab> {
  const tab = await chrome.tabs.create({ url, active });
  if (!tab.id) throw new Error('tab not created');
  await waitForTabReady(tab.id);
  return { tabId: tab.id, created: true };
}

async function navigateTab(tabId: number, url: string): Promise<void> {
  await chrome.tabs.update(tabId, { url });
  await waitForTabReady(tabId);
}

function waitForTabReady(tabId: number, timeoutMs = 30_000, settleMs = 800): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('tab load timeout'));
    }, timeoutMs);
    const listener = (id: number, info: chrome.tabs.TabChangeInfo) => {
      if (id !== tabId || info.status !== 'complete') return;
      clearTimeout(t);
      chrome.tabs.onUpdated.removeListener(listener);
      // SPA hydration window. Cloudscape/React app installs nav nodes after
      // 'complete' fires; without this delay scrape sees an empty shell.
      setTimeout(resolve, settleMs);
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function closeTab(tabId: number): Promise<void> {
  try {
    await chrome.tabs.remove(tabId);
  } catch {
    // ignore
  }
}

// ───── service harvest ───────────────────────────────────────────────

export type HarvestServicesOptions = { debug?: boolean };

export async function harvestServices(opts: HarvestServicesOptions = {}): Promise<HarvestedService[]> {
  assertNotRunning('services');
  resetCancel();
  try {
    return await runHarvestServices(opts);
  } finally {
    clearRunning();
  }
}

async function runHarvestServices(opts: HarvestServicesOptions): Promise<HarvestedService[]> {
  emit({ type: 'HARVEST_PROGRESS', phase: 'services', done: 0, total: 1, current: 'opening console' });
  const session = await pickLiveSession();
  const { tabId } = await openHarvestTab(sessionUrl(session), opts.debug === true);
  try {
    const checks = await chrome.scripting.executeScript({
      target: { tabId },
      func: assertSignedIn,
    });
    if (!checks[0]?.result) {
      throw new Error('not signed in to AWS console — open a service via popup first');
    }

    if (opts.debug) {
      emit({ type: 'HARVEST_PROGRESS', phase: 'services', done: 0, total: 1, current: 'debug mode — open Services menu manually, scraper runs in 12s' });
      await new Promise((r) => setTimeout(r, 12_000));
    }

    emit({ type: 'HARVEST_PROGRESS', phase: 'services', done: 0, total: 1, current: 'scraping services' });
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: scrapeServicesInTab,
    });
    const payload = result as { services: HarvestedService[]; debug: ScraperDebug } | null;
    if (!payload) {
      throw new Error('no result returned from scraper');
    }
    console.log('[harvest/services] debug:', payload.debug);
    if (payload.services.length < 5) {
      throw new Error(
        `scraped ${payload.services.length} services. Selectors out of date. Tried: ` +
          payload.debug.triggersTried.join(', ') +
          `. Anchors found: ${payload.debug.anchorCount}. Try debug mode (visible tab, manual click).`,
      );
    }
    emit({ type: 'HARVEST_PROGRESS', phase: 'services', done: 1, total: 1 });
    return payload.services;
  } finally {
    if (!opts.debug) await closeTab(tabId);
  }
}

type ScraperDebug = {
  triggersTried: string[];
  triggerHit: string | null;
  anchorCount: number;
  sample: string[];
  currentUrl: string;
  buttonsSample: string[];
  filterStats: Record<string, number>;
  candidates: string[];
  uniqueIds: string[];
};

// Runs in tab context. Cannot reference outer scope (executeScript
// serializes the function).
function assertSignedIn(): boolean {
  return /console\.aws\.amazon\.com/.test(location.host) && !/signin\.aws/.test(location.host);
}

async function scrapeServicesInTab(): Promise<{
  services: { id: string; name: string; consolePath: string; iconUrl?: string }[];
  debug: { triggersTried: string[]; triggerHit: string | null; anchorCount: number; sample: string[] };
}> {
  function sleep(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
  }
  async function waitFor<T>(check: () => T | null | undefined, timeoutMs = 6000): Promise<T | null> {
    const start = Date.now();
    let v = check();
    while (!v && Date.now() - start < timeoutMs) {
      await sleep(150);
      v = check();
    }
    return v ?? null;
  }
  function visible(el: Element): boolean {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  const debug: {
    triggersTried: string[];
    triggerHit: string | null;
    anchorCount: number;
    sample: string[];
    currentUrl: string;
    buttonsSample: string[];
    filterStats: Record<string, number>;
    candidates: string[];
    uniqueIds: string[];
  } = {
    triggersTried: [],
    triggerHit: null,
    anchorCount: 0,
    sample: [],
    currentUrl: location.href,
    buttonsSample: [],
    filterStats: { totalAnchors: 0, skippedHost: 0, skippedPath: 0, skippedName: 0, skippedNameRegex: 0, skippedId: 0, dedupedSamePath: 0, passed: 0 },
    candidates: [],
    uniqueIds: [],
  };

  // Strategy 1: explicit data-testid / aria-label selectors known across
  // recent AWS console redesigns.
  // 2026-04 console: trigger lives at [data-testid="aws-services-list-button"].
  const cssSelectors = [
    '[data-testid="aws-services-list-button"]',
    '[data-testid="awsc-nav-services-menu-button"]',
    '[data-testid*="services-list" i]',
    '[data-testid*="services-menu" i]',
    '[data-testid*="services" i][role="button"]',
    '[data-testid*="services" i] button',
    'button[aria-label="Services" i]',
    'button[aria-label*="services" i]',
    'a[aria-label*="services" i]',
  ];

  // Wait up to 10s for the SPA to install the chrome before searching for
  // a trigger. /console/home is a heavy hydrate; without this gate scrape
  // sees an empty shell when run too fast after `tab complete`.
  const trigger = await waitFor<HTMLElement>(() => {
    for (const sel of cssSelectors) {
      debug.triggersTried.push(sel);
      try {
        const el = document.querySelector<HTMLElement>(sel);
        if (el && visible(el)) {
          debug.triggerHit = sel;
          return el;
        }
      } catch {
        // ignore unsupported selector
      }
    }
    // Strategy 2: text-based search — any visible button/link in the
    // header whose accessible name matches /^services/i.
    debug.triggersTried.push('text:Services');
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>('header button, header a, nav button, nav a, [role="button"]'),
    );
    for (const el of candidates) {
      if (!visible(el)) continue;
      const label = (el.getAttribute('aria-label') || el.textContent || '').trim();
      if (/^services$/i.test(label) || /^services\b/i.test(label)) {
        debug.triggerHit = `text:Services (${el.tagName})`;
        return el;
      }
    }
    return null;
  }, 10_000);

  if (trigger) {
    trigger.click();
    // Wait for menu items to render. Trigger clicks may animate.
    await waitFor(() => document.querySelectorAll('a[href*="console.aws.amazon.com"]').length > 30, 8000);
  }

  // Sometimes there's a "View all services" / "All services" link inside
  // the panel that expands the full list. Click if visible.
  const viewAll = Array.from(document.querySelectorAll<HTMLElement>('a, button'))
    .find((el) => visible(el) && /^(view all services|all aws services|all services)$/i.test((el.textContent || '').trim()));
  if (viewAll) {
    viewAll.click();
    await waitFor(() => document.querySelectorAll('a[href*="console.aws.amazon.com"]').length > 50, 5000);
  }

  // Service-name extraction. Anchors render as a 2-row tile:
  //   <a><span>EC2</span><span>Virtual Servers in the Cloud</span></a>
  // textContent concatenates without whitespace. Prefer aria-label or the
  // first child element's text; fall back to truncated textContent.
  function extractName(a: HTMLAnchorElement): string | null {
    const al = a.getAttribute('aria-label');
    if (al) return al.trim();
    const child = a.querySelector('span, div, h3, h4');
    if (child?.textContent) {
      const t = child.textContent.trim();
      if (t && t.length < 60) return t;
    }
    const full = (a.textContent ?? '').trim().replace(/\s+/g, ' ');
    if (!full) return null;
    return full.slice(0, 80);
  }

  // Match any number of subdomain levels: bare console.aws.amazon.com,
  // <region>.console.aws.amazon.com, AND multi-session
  // <accountId>-<sub>.<region>.console.aws.amazon.com.
  const HOST_RE = /^https?:\/\/(?:[a-z0-9-]+\.)*console\.aws\.amazon\.com\/(.*)$/i;
  const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="console.aws.amazon.com"]'));
  debug.anchorCount = anchors.length;
  debug.sample = anchors.slice(0, 5).map((a) => `${(a.textContent || '').trim().slice(0, 30)} → ${a.href}`);
  // Snapshot any header/nav buttons so we can update selectors when AWS
  // redesigns the chrome.
  debug.buttonsSample = Array.from(
    document.querySelectorAll<HTMLElement>('header button, header a, nav button, nav a'),
  )
    .slice(0, 12)
    .map((el) => {
      const lbl = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40);
      const tid = el.getAttribute('data-testid') || '';
      return `${el.tagName}[${tid}] "${lbl}"`;
    });

  const seen = new Map<string, { id: string; name: string; consolePath: string; iconUrl?: string }>();

  debug.filterStats.totalAnchors = anchors.length;
  for (const a of anchors) {
    const href = a.href;
    if (!HOST_RE.test(href)) {
      debug.filterStats.skippedHost++;
      continue;
    }
    const url = new URL(href);
    let path = url.pathname.replace(/^\//, '');
    if (url.hash) path += url.hash;
    if (!path || path === 'console/home') {
      debug.filterStats.skippedPath++;
      continue;
    }

    const name = extractName(a);
    if (!name) {
      debug.filterStats.skippedName++;
      continue;
    }
    if (/^(home|sign out|console home|search|copy|edit|delete|close|next|back|recently visited|favourites|favorites|all applications|view details)$/i.test(name)) {
      debug.filterStats.skippedNameRegex++;
      continue;
    }

    const idRaw = path.split(/[/#?]/)[0];
    if (!idRaw) {
      debug.filterStats.skippedId++;
      continue;
    }
    const id = idRaw
      .toLowerCase()
      .replace(/^aws-?/, '')
      .replace(/[^a-z0-9]/g, '');
    if (!id) {
      debug.filterStats.skippedId++;
      continue;
    }

    if (debug.candidates.length < 30) {
      debug.candidates.push(`${id} | ${name} | ${path}`);
    }

    if (seen.has(id)) {
      debug.filterStats.dedupedSamePath++;
      const cur = seen.get(id)!;
      if (path.length < cur.consolePath.length) {
        seen.set(id, { ...cur, consolePath: path, name: cur.name || name });
      }
      continue;
    }

    debug.filterStats.passed++;

    let iconUrl: string | undefined;
    const img = a.querySelector('img');
    if (img?.src) iconUrl = img.src;
    if (!iconUrl) {
      const svg = a.querySelector('svg');
      if (svg) {
        const ser = new XMLSerializer().serializeToString(svg);
        iconUrl = `data:image/svg+xml;utf8,${encodeURIComponent(ser)}`;
      }
    }

    seen.set(id, { id, name, consolePath: path, iconUrl });
  }
  debug.uniqueIds = Array.from(seen.keys()).sort();

  return {
    services: Array.from(seen.values()).sort((x, y) => x.name.localeCompare(y.name)),
    debug,
  };
}

// ───── feature harvest ───────────────────────────────────────────────

const FEATURE_THROTTLE_MS = 100;

type FeatureHarvestInput = { id: string; consolePath: string };

export async function harvestFeatures(
  input: FeatureHarvestInput[],
): Promise<{ features: Record<string, HarvestedFeature[]>; skipped: { id: string; reason: string }[] }> {
  assertNotRunning('features');
  resetCancel();
  try {
    return await runHarvestFeatures(input);
  } finally {
    clearRunning();
  }
}

async function runHarvestFeatures(
  input: FeatureHarvestInput[],
): Promise<{ features: Record<string, HarvestedFeature[]>; skipped: { id: string; reason: string }[] }> {
  const session = await pickLiveSession();
  const tab = await openHarvestTab(sessionUrl(session));
  const features: Record<string, HarvestedFeature[]> = {};
  const skipped: { id: string; reason: string }[] = [];
  try {
    let done = 0;
    let featuresCount = 0;
    for (const svc of input) {
      checkCancel();
      done++;
      emit({
        type: 'HARVEST_PROGRESS',
        phase: 'features',
        done,
        total: input.length,
        current: svc.id,
        featuresCount,
      });
      try {
        const url = sessionUrl(session, svc.consolePath);
        await navigateTab(tab.tabId, url);
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: tab.tabId },
          func: scrapeFeaturesInTab,
        });
        if (Array.isArray(result) && result.length > 0) {
          features[svc.id] = result as HarvestedFeature[];
          featuresCount += result.length;
          // Persist incrementally so a crash / cancel keeps progress.
          void chrome.storage.local.set({ harvestedFeatures: features });
        } else {
          skipped.push({ id: svc.id, reason: 'no features detected' });
        }
      } catch (err) {
        skipped.push({ id: svc.id, reason: err instanceof Error ? err.message : String(err) });
      }
      if (FEATURE_THROTTLE_MS > 0) {
        await new Promise((r) => setTimeout(r, FEATURE_THROTTLE_MS));
      }
    }
    emit({
      type: 'HARVEST_PROGRESS',
      phase: 'features',
      done,
      total: input.length,
      featuresCount,
    });
  } finally {
    await closeTab(tab.tabId);
  }
  return { features, skipped };
}

async function scrapeFeaturesInTab(): Promise<{ name: string; path: string }[]> {
  function sleep(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
  }
  async function waitFor<T>(check: () => T | null | undefined, timeoutMs = 4000): Promise<T | null> {
    const start = Date.now();
    let v = check();
    while (!v && Date.now() - start < timeoutMs) {
      await sleep(120);
      v = check();
    }
    return v ?? null;
  }

  const containerSelectors = [
    'nav.awsui-side-navigation',
    '[data-testid*="navigation" i] nav',
    'nav[aria-label*="primary" i]',
    'nav[aria-label*="navigation" i]',
    'aside nav',
    'nav[aria-label]',
  ];

  // Cap at 4s — fail fast for services with no left rail (KMS, ECR, etc).
  const nav = await waitFor(() => {
    for (const sel of containerSelectors) {
      const el = document.querySelector(sel);
      if (el && el.querySelectorAll('a').length >= 3) return el;
    }
    return null;
  });
  if (!nav) return [];

  const HOST = location.host; // e.g. us-east-1.console.aws.amazon.com
  const out: { name: string; path: string }[] = [];
  const seen = new Set<string>();
  const anchors = Array.from(nav.querySelectorAll<HTMLAnchorElement>('a[href]'));
  for (const a of anchors) {
    const href = a.href;
    let path = '';
    try {
      const u = new URL(href);
      if (u.host !== HOST && !u.host.endsWith('console.aws.amazon.com')) continue;
      path = u.pathname.replace(/^\//, '') + (u.hash || '');
    } catch {
      // Relative path
      if (href.startsWith('/')) path = href.slice(1);
      else if (href.startsWith('#')) path = location.pathname.replace(/^\//, '') + href;
      else continue;
    }
    if (!path) continue;
    const name = (a.textContent ?? '').trim().replace(/\s+/g, ' ');
    if (!name || name.length > 60) continue;
    if (seen.has(path)) continue;
    seen.add(path);
    out.push({ name, path });
  }
  return out;
}
