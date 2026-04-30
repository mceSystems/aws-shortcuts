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

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const HARVEST_PATH = join(ROOT, 'catalog/harvested.raw.json');
const SERVICES_PATH = join(ROOT, 'catalog/services.json');
const OVERRIDES_PATH = join(ROOT, 'catalog/overrides.json');

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry');
const STRICT = args.has('--strict');

type Feature = { name: string; path: string };
type Service = {
  id: string;
  name: string;
  consolePath: string;
  aliases?: string[];
  features?: Feature[];
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
};

function readJson<T>(p: string): T {
  return JSON.parse(readFileSync(p, 'utf8')) as T;
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
    if (aliases?.length) entry.aliases = aliases;
    if (features?.length) entry.features = features;
    out.push(entry);
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
