#!/usr/bin/env tsx
// Refresh per-service features (left-rail nav scrape) for ids already in
// catalog/services.json. Resumable via .cache/features-checkpoint.json.
//
// Flags:
//   --dry              report counts, don't write
//   --filter <ids>     comma-separated subset
//   --force            ignore checkpoint, rescrape every target
//   --max-age-days <n> skip ids whose checkpoint is fresher than n (default 7)
//
// Auth: requires scripts/.auth/state.json from `npm run catalog:auth`.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { readCatalog, todayVersion, writeCatalog, type Feature, type Service } from './lib/catalog';
import { AUTH_STATE, FEATURES_CHECKPOINT } from './lib/paths';

type Flags = { dry: boolean; filter: Set<string> | null; force: boolean; maxAgeMs: number };

function parseFlags(): Flags {
  const argv = process.argv.slice(2);
  const flags: Flags = {
    dry: false,
    filter: null,
    force: false,
    maxAgeMs: 7 * 24 * 60 * 60 * 1000,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry') flags.dry = true;
    else if (a === '--force') flags.force = true;
    else if (a === '--filter') flags.filter = new Set(argv[++i]?.split(',').filter(Boolean) ?? []);
    else if (a === '--max-age-days') flags.maxAgeMs = Number(argv[++i] ?? '7') * 24 * 60 * 60 * 1000;
  }
  return flags;
}

type Checkpoint = Record<string, { fetchedAt: number; count: number }>;

function readCheckpoint(): Checkpoint {
  if (!existsSync(FEATURES_CHECKPOINT)) return {};
  try {
    return JSON.parse(readFileSync(FEATURES_CHECKPOINT, 'utf8')) as Checkpoint;
  } catch {
    return {};
  }
}

function writeCheckpoint(cp: Checkpoint): void {
  mkdirSync(dirname(FEATURES_CHECKPOINT), { recursive: true });
  writeFileSync(FEATURES_CHECKPOINT, JSON.stringify(cp, null, 2) + '\n');
}

function cleanFeatures(raw: Feature[]): Feature[] {
  const NOISE = /^(getting started|what'?s new|settings|home|documentation|pricing|faqs?)$/i;
  const seen = new Set<string>();
  const out: Feature[] = [];
  for (const f of raw) {
    const name = (f.name || '').trim();
    if (!name || /^\d+$/.test(name) || name.length > 60 || NOISE.test(name)) continue;
    if (!f.path || seen.has(f.path)) continue;
    seen.add(f.path);
    out.push({ name, path: f.path });
  }
  return out;
}

// Single browser shared across all service nav scrapes — opening one
// chromium per service was the dominant cost.
let sharedBrowser: import('playwright').Browser | null = null;
let sharedCtx: import('playwright').BrowserContext | null = null;
let sharedPage: import('playwright').Page | null = null;

async function ensureBrowser(): Promise<import('playwright').Page> {
  if (sharedPage) return sharedPage;
  const { chromium } = await import('playwright').catch(() => {
    throw new Error('playwright not installed. Run: npm i -D playwright && npx playwright install chromium');
  });
  if (!existsSync(AUTH_STATE)) {
    throw new Error(`missing ${AUTH_STATE}. Run: npm run catalog:auth`);
  }
  sharedBrowser = await chromium.launch({ headless: true });
  sharedCtx = await sharedBrowser.newContext({ storageState: AUTH_STATE });
  sharedPage = await sharedCtx.newPage();
  return sharedPage;
}

async function closeBrowser(): Promise<void> {
  if (sharedBrowser) {
    await sharedBrowser.close().catch(() => {});
    sharedBrowser = null;
    sharedCtx = null;
    sharedPage = null;
  }
}

async function scrapeServiceFeatures(consolePath: string, _isGlobal: boolean): Promise<Feature[]> {
  const page = await ensureBrowser();
  // Always us-east-1 — global services AND most regional services render
  // identical left-rail nav there. Saves the hop.
  const url = `https://us-east-1.console.aws.amazon.com/${consolePath}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  // Cloudscape side nav class hashes change per build; aria-label is stable.
  // Cap wait at 6s — services without left-rail (KMS, ECR, …) fail fast.
  const navHandle = await page
    .waitForSelector('nav[aria-label="Side navigation"]', { timeout: 6_000 })
    .catch(() => null);
  if (!navHandle) return [];

  const features = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Side navigation"]');
    if (!nav) return [];
    const HOST = location.host;
    const out: { name: string; path: string }[] = [];
    const seen = new Set<string>();
    for (const a of Array.from(nav.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
      const href = a.href;
      let path = '';
      try {
        const u = new URL(href);
        if (u.host !== HOST && !u.host.endsWith('console.aws.amazon.com')) continue;
        path = u.pathname.replace(/^\//, '') + (u.hash || '');
      } catch {
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
  });
  return cleanFeatures(features as Feature[]);
}

async function main(): Promise<void> {
  const flags = parseFlags();
  const catalog = readCatalog();
  const checkpoint = readCheckpoint();

  const targets: Service[] = catalog.services.filter((s) => {
    if (flags.filter && !flags.filter.has(s.id)) return false;
    if (flags.force) return true;
    const cp = checkpoint[s.id];
    if (!cp) return true;
    return Date.now() - cp.fetchedAt > flags.maxAgeMs;
  });

  console.log(`[features] ${targets.length} targets (skipped ${catalog.services.length - targets.length} fresh)`);

  let updated = 0;
  let totalFeatures = 0;
  let failed = 0;
  for (let i = 0; i < targets.length; i++) {
    const svc = targets[i];
    process.stdout.write(`[features] [${i + 1}/${targets.length}] ${svc.id} … `);
    try {
      const features = await scrapeServiceFeatures(svc.consolePath, svc.global === true);
      // Only overwrite when scrape returned data. Empty result = either
      // service has no left-rail nav (legit) or selector miss (bug); either
      // way, prior features are more trustworthy than wiping to undefined.
      if (features.length > 0) {
        svc.features = features;
        updated++;
      }
      checkpoint[svc.id] = { fetchedAt: Date.now(), count: features.length };
      totalFeatures += features.length;
      process.stdout.write(`${features.length} features\n`);
      // Throttle so AWS doesn't rate-limit aggressive nav.
      await new Promise((r) => setTimeout(r, 150));
    } catch (err) {
      failed++;
      process.stdout.write(`failed (${err instanceof Error ? err.message : String(err)})\n`);
    }
    // Checkpoint after every service so a crash is resumable.
    if (!flags.dry) writeCheckpoint(checkpoint);
  }

  await closeBrowser();
  console.log(`[features] updated ${updated}, ${totalFeatures} features total, ${failed} failed`);

  if (flags.dry) {
    console.log('[features] --dry: not writing services.json');
    return;
  }
  catalog.version = todayVersion();
  writeCatalog(catalog);
  console.log('[features] wrote catalog/services.json');
}

main().catch(async (err) => {
  await closeBrowser();
  console.error('[features] failed:', err.message ?? err);
  process.exit(1);
});
