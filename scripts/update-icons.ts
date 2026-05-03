#!/usr/bin/env tsx
// Refresh catalog/icons.json from the awslabs/aws-icons-for-plantuml vendor
// pack. Independent of services + features updates: only writes icons.json.
//
// Pipeline:
//   1. Ensure vendor pack present (download tarball if missing).
//   2. Read services.json to get the set of ids needing icons.
//   3. Resolve each id → filename via icon-map.json (manual) → heuristic guess.
//   4. Read each matched file, base64-encode, build IconsMap.
//   5. Validate coverage threshold.
//   6. Write catalog/icons.json (sorted keys for stable diffs).
//
// Flags:
//   --dry              report changes, don't write
//   --filter <ids>     comma-separated ids; only process those
//   --force            ignore stale-cache hints (currently a no-op; reserved)
//   --threshold <n>    minimum coverage percentage (default 80)

import { existsSync } from 'node:fs';
import { ensureIconsVendor } from './lib/cache';
import { readCatalog, readIcons, writeIcons, type IconsMap } from './lib/catalog';
import { fileToDataUrl, resolveIcons, summarizeVendor, walkVendorIcons } from './lib/icons';
import { ICONS_PATH, ICONS_VENDOR_DIR } from './lib/paths';

type Flags = {
  dry: boolean;
  force: boolean;
  filter: Set<string> | null;
  threshold: number;
};

function parseFlags(): Flags {
  const argv = process.argv.slice(2);
  const flags: Flags = { dry: false, force: false, filter: null, threshold: 80 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry') flags.dry = true;
    else if (a === '--force') flags.force = true;
    else if (a === '--filter') flags.filter = new Set(argv[++i]?.split(',').filter(Boolean) ?? []);
    else if (a === '--threshold') flags.threshold = Number(argv[++i] ?? '80');
  }
  return flags;
}

async function main(): Promise<void> {
  const flags = parseFlags();

  await ensureIconsVendor();
  if (!existsSync(ICONS_VENDOR_DIR)) {
    console.error(`[icons] vendor still missing after ensureIconsVendor: ${ICONS_VENDOR_DIR}`);
    process.exit(1);
  }
  const vendor = walkVendorIcons();
  summarizeVendor(vendor);

  const catalog = readCatalog();
  const targets = flags.filter
    ? catalog.services.filter((s) => flags.filter!.has(s.id))
    : catalog.services;

  if (!targets.length) {
    console.error('[icons] no targets — nothing to do');
    process.exit(1);
  }

  const { matched, missing } = resolveIcons(targets, vendor);
  console.log(`[icons] matched ${matched.size}/${targets.length} (missing: ${missing.length})`);
  if (missing.length) {
    console.log(`[icons] missing ids: ${missing.slice(0, 30).join(', ')}${missing.length > 30 ? '…' : ''}`);
    console.log(`[icons] add manual entries to scripts/icon-map.json to resolve`);
  }

  const coverage = (matched.size / targets.length) * 100;
  if (coverage < flags.threshold) {
    console.error(`[icons] coverage ${coverage.toFixed(1)}% < threshold ${flags.threshold}%`);
    process.exit(1);
  }

  // Merge: keep prior entries for ids outside filter; replace within filter.
  const prior = readIcons();
  const out: IconsMap = flags.filter ? { ...prior } : {};
  let totalBytes = 0;
  let oversized = 0;
  for (const [id, { absPath }] of matched) {
    const { dataUrl, bytes } = fileToDataUrl(absPath);
    if (bytes > 200 * 1024) oversized++;
    out[id] = dataUrl;
    totalBytes += bytes;
  }

  // Drop prior entries for ids no longer in catalog (when running unfiltered).
  if (!flags.filter) {
    const valid = new Set(catalog.services.map((s) => s.id));
    for (const id of Object.keys(out)) if (!valid.has(id)) delete out[id];
  }

  console.log(`[icons] total ${(totalBytes / 1024).toFixed(0)} KB across ${matched.size} icons`);
  if (oversized) console.warn(`[icons] ${oversized} icons > 200 KB — possible wrong file picked`);

  if (flags.dry) {
    console.log(`[icons] --dry: not writing ${ICONS_PATH}`);
    return;
  }

  writeIcons(out);
  console.log(`[icons] wrote ${ICONS_PATH} (${Object.keys(out).length} entries)`);
}

main().catch((err) => {
  console.error('[icons] failed:', err);
  process.exit(1);
});
