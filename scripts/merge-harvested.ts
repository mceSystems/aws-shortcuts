#!/usr/bin/env tsx
// Merge tool: takes catalog/harvested.raw.json (downloaded from extension's
// HarvestSection) + catalog/overrides.json + current catalog/services.json
// and produces a new catalog/services.json with bumped version.
//
// Merge rules (highest priority last wins):
//   1. Harvested data — id, name, consolePath, features
//   2. consolePathOverrides — fix wrong paths
//   3. nameOverrides — fix display names
//   4. aliases — added from overrides.json (never harvested)
//   5. exclude — drop these ids entirely
//
// Existing services in catalog/services.json are preserved when not present
// in harvested data (e.g. you harvested with a limited account that lacks
// some services). Use --strict to drop those instead.
//
// Usage:
//   npm run catalog:merge                  # merge + write
//   npm run catalog:merge -- --dry         # show diff, no write
//   npm run catalog:merge -- --strict      # drop non-harvested services

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const HARVEST_PATH = join(ROOT, 'catalog/harvested.raw.json');
const SERVICES_PATH = join(ROOT, 'catalog/services.json');
const OVERRIDES_PATH = join(ROOT, 'catalog/overrides.json');
const ICON_MAP_PATH = join(ROOT, 'scripts/icon-map.json');
const ICON_VENDOR_DIR = join(ROOT, 'vendor/aws-icons-source/dist');
const ICONS_VERSION = process.env.ICONS_VERSION ?? '18.0';
const ICON_CDN_BASE = `https://cdn.jsdelivr.net/gh/awslabs/aws-icons-for-plantuml@v${ICONS_VERSION}/dist`;

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry');
const STRICT = args.has('--strict');

type Feature = { name: string; path: string };
type Service = {
  id: string;
  name: string;
  consolePath: string;
  popular?: boolean;
  aliases?: string[];
  features?: Feature[];
  iconUrl?: string;
};
type Catalog = { schemaVersion: number; version: string; services: Service[] };

type HarvestedService = { id: string; name: string; consolePath: string; iconUrl?: string };
type HarvestedFile = {
  harvestedAt: string;
  services: HarvestedService[];
  features?: Record<string, Feature[]>;
};
type Overrides = {
  aliases?: Record<string, string[]>;
  consolePathOverrides?: Record<string, string>;
  nameOverrides?: Record<string, string>;
  exclude?: string[];
  /** Curated "popular" service ids — bumped in default order + slight match bonus. */
  popular?: string[];
};

function readJson<T>(p: string): T {
  return JSON.parse(readFileSync(p, 'utf8')) as T;
}

const ICON_EXTS = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp']);

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

/** Walk vendor icons dir. Returns filename → relative path within dist/. */
function walkIcons(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!existsSync(dir)) return out;
  const stack: string[] = [dir];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const entry of readdirSync(cur, { withFileTypes: true })) {
      const full = join(cur, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && ICON_EXTS.has(extOf(entry.name))) {
        if (out.has(entry.name)) continue; // first match wins, like build-icons.ts
        out.set(entry.name, relative(dir, full));
      }
    }
  }
  return out;
}

/** Generate filename guesses for a service. Many AWS icon filenames
 *  follow `<ServiceName>.png` with spaces / "Amazon "/"AWS " stripped, so
 *  derive a few common variants from the service's id and display name.
 *  Caller looks each up in the filenameToRel walker map. */
function guessIconFilenames(id: string, name: string): string[] {
  const cleanName = name
    .replace(/^(Amazon|AWS)\s+/i, '')
    .replace(/[^A-Za-z0-9]/g, '');
  const fullName = name.replace(/[^A-Za-z0-9]/g, '');
  const idCap = id.replace(/^./, (c) => c.toUpperCase());
  const idUpper = id.toUpperCase();
  const firstWord = name.split(/\s+/)[0]?.replace(/[^A-Za-z0-9]/g, '');
  const guesses = new Set<string>();
  for (const stem of [cleanName, fullName, idCap, idUpper, firstWord]) {
    if (!stem) continue;
    guesses.add(`${stem}.png`);
    guesses.add(`${stem}.svg`);
  }
  return [...guesses];
}

function buildIconUrlMap(services: { id: string; name: string }[]): {
  urls: Map<string, string>;
  matched: number;
  unmatched: string[];
} {
  const filenameToRel = walkIcons(ICON_VENDOR_DIR);
  if (filenameToRel.size === 0) {
    console.warn('[merge] vendor icons not found — run `npm run icons:fetch`');
    return { urls: new Map(), matched: 0, unmatched: services.map((s) => s.id) };
  }

  // Manual map wins. Start from icon-map.json so curated names like
  // "SimpleStorageService.png" for s3 take precedence over heuristic guesses.
  const manual: Record<string, string> = existsSync(ICON_MAP_PATH)
    ? readJson<Record<string, string>>(ICON_MAP_PATH)
    : {};
  delete (manual as Record<string, unknown>)['$schema'];

  const urls = new Map<string, string>();
  const unmatched: string[] = [];

  for (const svc of services) {
    let filename = manual[svc.id];
    if (!filename || !filenameToRel.has(filename)) {
      // Fall back to heuristic guesses derived from id + display name.
      for (const g of guessIconFilenames(svc.id, svc.name)) {
        if (filenameToRel.has(g)) {
          filename = g;
          break;
        }
      }
    }
    const rel = filename ? filenameToRel.get(filename) : undefined;
    if (!rel) {
      unmatched.push(`${svc.id} (${svc.name})`);
      continue;
    }
    urls.set(svc.id, `${ICON_CDN_BASE}/${rel.split('\\').join('/')}`);
  }

  return { urls, matched: urls.size, unmatched };
}

function todayVersion(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

function sortServices(services: Service[]): Service[] {
  return [...services].sort((a, b) => a.name.localeCompare(b.name));
}

/** Strip noise from harvested feature lists:
 *  - empty / numeric-only names ("0", "12") — filter-state badges.
 *  - long descriptions accidentally captured (>60 chars).
 *  - duplicates by path.
 *  - "Getting Started" / "What's new" / "Settings" — not actionable features. */
function cleanFeatures(features: Feature[]): Feature[] {
  const NOISE_NAMES = /^(getting started|what'?s new|settings|home|documentation|pricing|faqs?)$/i;
  const seen = new Set<string>();
  const out: Feature[] = [];
  for (const f of features) {
    const name = (f.name || '').trim();
    if (!name) continue;
    if (/^\d+$/.test(name)) continue;
    if (name.length > 60) continue;
    if (NOISE_NAMES.test(name)) continue;
    if (!f.path) continue;
    if (seen.has(f.path)) continue;
    seen.add(f.path);
    out.push({ name, path: f.path });
  }
  return out;
}

function main(): void {
  if (!existsSync(HARVEST_PATH)) {
    console.error(`[merge] missing ${HARVEST_PATH}`);
    console.error('[merge] hint: open extension Settings → Harvest services + Download JSON, then move ~/Downloads/harvested.raw.json into catalog/');
    process.exit(1);
  }
  const harvested = readJson<HarvestedFile>(HARVEST_PATH);
  const overrides = existsSync(OVERRIDES_PATH) ? readJson<Overrides>(OVERRIDES_PATH) : {};
  const current = existsSync(SERVICES_PATH)
    ? readJson<Catalog>(SERVICES_PATH)
    : { schemaVersion: 2, version: '1970.01.01', services: [] };

  // Strip $schema doc field if present.
  delete (overrides as Record<string, unknown>)['$schema'];

  const currentById = new Map(current.services.map((s) => [s.id, s]));
  const harvestedById = new Map(harvested.services.map((s) => [s.id, s]));

  const exclude = new Set(overrides.exclude ?? []);
  const aliasMap = overrides.aliases ?? {};
  const pathOverrides = overrides.consolePathOverrides ?? {};
  const nameOverrides = overrides.nameOverrides ?? {};
  const popularSet = new Set(overrides.popular ?? []);

  const out: Service[] = [];
  const ids = new Set<string>([...currentById.keys(), ...harvestedById.keys()]);

  for (const id of ids) {
    if (exclude.has(id)) continue;

    const cur = currentById.get(id);
    const hv = harvestedById.get(id);

    if (STRICT && !hv) continue;

    const name = nameOverrides[id] ?? hv?.name ?? cur?.name ?? id;
    const consolePath = pathOverrides[id] ?? hv?.consolePath ?? cur?.consolePath;
    if (!consolePath) {
      console.warn(`[merge] ${id}: no consolePath, skipping`);
      continue;
    }

    const harvestedRaw = harvested.features?.[id];
    const cleanedHarvested = harvestedRaw ? cleanFeatures(harvestedRaw) : null;
    const features = cleanedHarvested && cleanedHarvested.length > 0
      ? cleanedHarvested
      : cur?.features;

    const aliases = aliasMap[id] ?? cur?.aliases;

    const entry: Service = {
      id,
      name,
      consolePath,
    };
    if (popularSet.has(id)) entry.popular = true;
    if (aliases?.length) entry.aliases = aliases;
    if (features?.length) entry.features = features;
    out.push(entry);
  }

  // Resolve icon URLs after the service list is final so we can iterate
  // across the full population (manual map + heuristic guess from name).
  const iconResult = buildIconUrlMap(out.map((s) => ({ id: s.id, name: s.name })));
  for (const s of out) {
    const url = iconResult.urls.get(s.id);
    if (url) s.iconUrl = url;
  }

  const sorted = sortServices(out);
  const next: Catalog = {
    schemaVersion: 2,
    version: todayVersion(),
    services: sorted,
  };

  // Diff summary.
  const beforeIds = new Set(current.services.map((s) => s.id));
  const afterIds = new Set(sorted.map((s) => s.id));
  const added = [...afterIds].filter((id) => !beforeIds.has(id));
  const removed = [...beforeIds].filter((id) => !afterIds.has(id));

  let pathChanged = 0;
  let featuresChanged = 0;
  for (const s of sorted) {
    const prev = currentById.get(s.id);
    if (!prev) continue;
    if (prev.consolePath !== s.consolePath) pathChanged++;
    if (JSON.stringify(prev.features ?? []) !== JSON.stringify(s.features ?? [])) featuresChanged++;
  }

  console.log(`[merge] services: ${current.services.length} → ${sorted.length}`);
  console.log(`[merge] added (${added.length}): ${added.slice(0, 12).join(', ')}${added.length > 12 ? '…' : ''}`);
  console.log(`[merge] removed (${removed.length}): ${removed.join(', ')}`);
  console.log(`[merge] consolePath changes: ${pathChanged}`);
  console.log(`[merge] features changes: ${featuresChanged}`);
  console.log(`[merge] icons matched: ${iconResult.matched}/${sorted.length}`);
  if (iconResult.unmatched.length) {
    console.log(`[merge] icons unmatched (${iconResult.unmatched.length}):`);
    for (const m of iconResult.unmatched) console.log(`  - ${m}`);
  }
  console.log(`[merge] new version: ${next.version}`);

  if (DRY) {
    console.log('[merge] --dry: not writing');
    return;
  }
  writeFileSync(SERVICES_PATH, JSON.stringify(next, null, 2) + '\n');
  console.log(`[merge] wrote ${SERVICES_PATH}`);
  console.log('[merge] next: review with `git diff catalog/services.json`, then commit');
}

main();
