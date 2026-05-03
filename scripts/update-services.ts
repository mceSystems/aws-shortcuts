#!/usr/bin/env tsx
// Refresh catalog/services.json. Cross-checks multiple sources:
//   1. AWS Console "View all services" page (Playwright + persisted SSO state)
//   2. botocore endpoints.json (for `global` flag)
//   3. catalog/overrides.json (aliases, exclude, popular, name/path overrides)
//
// Independent of features + icons. Preserves features[] from prior catalog
// (those are owned by update-features.ts). Bumps catalog version on any
// service set change.
//
// Flags:
//   --dry              report changes, don't write
//   --no-playwright    skip console scrape, only refresh global flags + overrides
//   --strict           drop services not present in console scrape
//
// Auth: run `npm run catalog:auth` once to capture SSO state at scripts/.auth/state.json.

import { existsSync } from 'node:fs';
import { readCatalog, readOverrides, sortServices, todayVersion, writeCatalog, type Service } from './lib/catalog';
import { diffServices, printSummary } from './lib/diff';
import { isGlobalService } from './lib/sources';
import { AUTH_STATE } from './lib/paths';

type Flags = { dry: boolean; noPlaywright: boolean; strict: boolean };

function parseFlags(): Flags {
  const argv = new Set(process.argv.slice(2));
  return {
    dry: argv.has('--dry'),
    noPlaywright: argv.has('--no-playwright'),
    strict: argv.has('--strict'),
  };
}

type ScrapedService = { id: string; name: string; consolePath: string };

async function scrapeConsoleServices(): Promise<ScrapedService[]> {
  // Lazy import so module load doesn't require playwright when running
  // --no-playwright. Playwright is a heavy devDep — kept optional.
  const { chromium } = await import('playwright').catch(() => {
    throw new Error('playwright not installed. Run: npm i -D playwright && npx playwright install chromium');
  });
  if (!existsSync(AUTH_STATE)) {
    throw new Error(`missing ${AUTH_STATE}. Run: npm run catalog:auth`);
  }
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: AUTH_STATE });
  const page = await ctx.newPage();
  try {
    await page.goto('https://us-east-1.console.aws.amazon.com/console/services', {
      waitUntil: 'networkidle',
      timeout: 60_000,
    });
    await page.waitForSelector('a[href*="console.aws.amazon.com"]', { timeout: 30_000 });
    // Force lazy sections to render by scrolling through the full page.
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(400);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // NB: page.evaluate body is serialized by Playwright. Inline all logic;
    // do NOT define inner named functions (esbuild's __name decorator breaks
    // when transferred to the browser context).
    const out = await page.evaluate(() => {
      const HOST_RE = /^https?:\/\/(?:[a-z0-9-]+\.)*console\.aws\.amazon\.com\/(.*)$/i;
      const SKIP_PATHS = new Set([
        'console/home',
        'console/services',
        'settings/home',
        'support/home',
      ]);
      const seen = new Map<string, { id: string; name: string; consolePath: string }>();
      const anchors = Array.from(
        document.querySelectorAll<HTMLAnchorElement>('a[href*="console.aws.amazon.com"]'),
      );
      for (const a of anchors) {
        if (!HOST_RE.test(a.href)) continue;
        const url = new URL(a.href);
        let path = url.pathname.replace(/^\//, '');
        if (url.hash && url.hash !== '#') path += url.hash;
        if (!path || SKIP_PATHS.has(path)) continue;

        // Cloudscape tile = anchor with heading <span> + tagline <span>.
        // textContent concatenates both. Prefer aria-label, fallback to first
        // child element's text, then truncated full text.
        const al = a.getAttribute('aria-label');
        let name = '';
        if (al && al.trim()) {
          name = al.trim();
        } else {
          const heading = a.querySelector('span, h3, h4, div');
          if (heading?.textContent) {
            const t = heading.textContent.trim().replace(/\s+/g, ' ');
            if (t && t.length < 60) name = t;
          }
          if (!name) {
            const full = (a.textContent ?? '').trim().replace(/\s+/g, ' ');
            name = full.length < 60 ? full : full.slice(0, 50);
          }
        }
        if (!name || name.length > 80) continue;

        const idRaw = path.split(/[/#?]/)[0];
        const id = idRaw.toLowerCase().replace(/^aws-?/, '').replace(/[^a-z0-9]/g, '');
        if (!id) continue;
        if (seen.has(id)) continue;
        seen.set(id, { id, name, consolePath: path });
      }
      return Array.from(seen.values());
    });
    return out;
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const flags = parseFlags();
  const cur = readCatalog();
  const overrides = readOverrides();
  const exclude = new Set(overrides.exclude ?? []);
  const aliasMap = overrides.aliases ?? {};
  const pathOverrides = overrides.consolePathOverrides ?? {};
  const nameOverrides = overrides.nameOverrides ?? {};
  const popularSet = new Set(overrides.popular ?? []);
  const globalOverrides = overrides.globalOverrides ?? {};

  let scraped: ScrapedService[] = [];
  if (!flags.noPlaywright) {
    console.log('[services] scraping console /console/services …');
    scraped = await scrapeConsoleServices();
    console.log(`[services] scraped ${scraped.length} services`);
    if (scraped.length < 30) {
      throw new Error(`only ${scraped.length} services scraped — selectors out of date?`);
    }
    if (scraped.length < 80) {
      console.warn(`[services] only ${scraped.length} services scraped — page may have lazy-loaded sections; existing catalog entries preserved`);
    }
  } else {
    console.log('[services] --no-playwright: skipping console scrape');
  }

  const scrapedById = new Map(scraped.map((s) => [s.id, s]));
  const curById = new Map(cur.services.map((s) => [s.id, s]));
  const allIds = new Set<string>([...curById.keys(), ...scrapedById.keys()]);

  console.log('[services] resolving global flags via botocore …');

  const out: Service[] = [];
  for (const id of allIds) {
    if (exclude.has(id)) continue;
    if (flags.strict && !scrapedById.has(id)) continue;

    const sc = scrapedById.get(id);
    const prev = curById.get(id);
    const name = nameOverrides[id] ?? sc?.name ?? prev?.name ?? id;
    const consolePath = pathOverrides[id] ?? sc?.consolePath ?? prev?.consolePath;
    if (!consolePath) {
      console.warn(`[services] ${id}: no consolePath, skipping`);
      continue;
    }

    const global =
      globalOverrides[id] !== undefined ? globalOverrides[id] : await isGlobalService(id);

    const entry: Service = { id, name, consolePath };
    if (popularSet.has(id)) entry.popular = true;
    if (global) entry.global = true;
    const aliases = aliasMap[id] ?? prev?.aliases;
    if (aliases?.length) entry.aliases = aliases;
    if (prev?.features?.length) entry.features = prev.features;
    out.push(entry);
  }

  const sorted = sortServices(out);
  const next = { schemaVersion: 3, version: todayVersion(), services: sorted };

  const diff = diffServices(cur.services, sorted);
  printSummary('services', diff);
  console.log(`[services] ${cur.services.length} → ${sorted.length} (version ${next.version})`);

  if (flags.dry) {
    console.log('[services] --dry: not writing');
    return;
  }
  writeCatalog(next);
  console.log('[services] wrote catalog/services.json');
}

main().catch((err) => {
  console.error('[services] failed:', err.message ?? err);
  process.exit(1);
});
