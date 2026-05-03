// Icon resolution + encoding. Walks the vendor pack, applies a manual id →
// filename map plus heuristic name-based guesses, reads each matched file and
// returns base64 data URLs keyed by service id.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { ICON_MAP_PATH, ICONS_VENDOR_DIR } from './paths';
import { readJson } from './catalog';

const ICON_EXTS = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp']);

export function walkVendorIcons(dir: string = ICONS_VENDOR_DIR): Map<string, string> {
  const out = new Map<string, string>();
  if (!existsSync(dir)) return out;
  const stack: string[] = [dir];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const entry of readdirSync(cur, { withFileTypes: true })) {
      const full = join(cur, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && ICON_EXTS.has(extname(entry.name).toLowerCase())) {
        if (!out.has(entry.name)) out.set(entry.name, full);
      }
    }
  }
  return out;
}

function readIconMap(): Record<string, string> {
  if (!existsSync(ICON_MAP_PATH)) return {};
  const raw = readJson<Record<string, string>>(ICON_MAP_PATH);
  delete (raw as Record<string, unknown>)['$schema'];
  return raw;
}

/** Filename guesses for a service derived from id + display name. Heuristic
 *  fallback when icon-map.json doesn't have a manual entry. */
function guessFilenames(id: string, name: string): string[] {
  const cleanName = name.replace(/^(Amazon|AWS)\s+/i, '').replace(/[^A-Za-z0-9]/g, '');
  const fullName = name.replace(/[^A-Za-z0-9]/g, '');
  const idCap = id.replace(/^./, (c) => c.toUpperCase());
  const idUpper = id.toUpperCase();
  const firstWord = name.split(/\s+/)[0]?.replace(/[^A-Za-z0-9]/g, '');
  const guesses = new Set<string>();
  for (const stem of [cleanName, fullName, idCap, idUpper, firstWord]) {
    if (!stem) continue;
    for (const ext of ['png', 'svg']) {
      guesses.add(`${stem}.${ext}`);
    }
  }
  return [...guesses];
}

function mimeFor(filename: string): string {
  const ext = extname(filename).toLowerCase();
  switch (ext) {
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

export function fileToDataUrl(absPath: string): { dataUrl: string; bytes: number } {
  const buf = readFileSync(absPath);
  const mime = mimeFor(absPath);
  return { dataUrl: `data:${mime};base64,${buf.toString('base64')}`, bytes: buf.byteLength };
}

type ResolveResult = {
  matched: Map<string, { filename: string; absPath: string }>;
  missing: string[];
};

export function resolveIcons(
  services: { id: string; name: string }[],
  filenameToPath: Map<string, string> = walkVendorIcons(),
  manualMap: Record<string, string> = readIconMap(),
): ResolveResult {
  const matched = new Map<string, { filename: string; absPath: string }>();
  const missing: string[] = [];

  for (const svc of services) {
    let filename = manualMap[svc.id];
    let absPath = filename ? filenameToPath.get(filename) : undefined;
    if (!absPath) {
      for (const guess of guessFilenames(svc.id, svc.name)) {
        const got = filenameToPath.get(guess);
        if (got) {
          filename = guess;
          absPath = got;
          break;
        }
      }
    }
    if (filename && absPath) {
      matched.set(svc.id, { filename, absPath });
    } else {
      missing.push(svc.id);
    }
  }
  return { matched, missing };
}

export function summarizeVendor(filenameToPath: Map<string, string>): void {
  if (filenameToPath.size === 0) {
    console.warn(`[icons] vendor empty at ${ICONS_VENDOR_DIR} — call ensureIconsVendor() first`);
    return;
  }
  const sample = [...filenameToPath.values()].slice(0, 3).map((p) => relative(ICONS_VENDOR_DIR, p));
  const total = filenameToPath.size;
  const totalBytes = [...filenameToPath.values()]
    .slice(0, 50)
    .reduce((acc, p) => acc + statSync(p).size, 0);
  console.log(`[icons] vendor has ${total} files; sample: ${sample.join(', ')} (~${(totalBytes / 50 / 1024).toFixed(1)} KB avg)`);
}
