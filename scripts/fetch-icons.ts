#!/usr/bin/env tsx
// One-shot fetcher: downloads awslabs/aws-icons-for-plantuml release tarball
// and extracts dist/ into vendor/aws-icons-source/. Idempotent: re-runs use
// cached tarball at .cache/aws-icons.tar.gz.
//
// Usage:
//   npm run icons:fetch           # default version
//   npm run icons:fetch -- 18.0   # specific tag
//   ICONS_VERSION=18.0 npm run icons:fetch

import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const VERSION = process.argv[2] ?? process.env.ICONS_VERSION ?? '18.0';
const TARBALL_URL = `https://github.com/awslabs/aws-icons-for-plantuml/archive/refs/tags/v${VERSION}.tar.gz`;
const CACHE_DIR = join(ROOT, '.cache');
const CACHE_FILE = join(CACHE_DIR, `aws-icons-${VERSION}.tar.gz`);
const VENDOR_DIR = join(ROOT, 'vendor/aws-icons-source');
const STRIP_PREFIX = `aws-icons-for-plantuml-${VERSION}`;

async function downloadIfMissing(): Promise<void> {
  if (existsSync(CACHE_FILE) && statSync(CACHE_FILE).size > 0) {
    console.log(`[fetch] cached: ${CACHE_FILE}`);
    return;
  }
  mkdirSync(CACHE_DIR, { recursive: true });
  console.log(`[fetch] GET ${TARBALL_URL}`);
  const res = await fetch(TARBALL_URL, { redirect: 'follow' });
  if (!res.ok || !res.body) {
    throw new Error(`download failed: HTTP ${res.status}`);
  }
  const tmp = `${CACHE_FILE}.partial`;
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(tmp));
  // Atomic move so a partial download never poisons the cache.
  const { renameSync } = await import('node:fs');
  renameSync(tmp, CACHE_FILE);
  const mb = (statSync(CACHE_FILE).size / 1024 / 1024).toFixed(1);
  console.log(`[fetch] saved ${mb} MB → ${CACHE_FILE}`);
}

function extract(): Promise<void> {
  // Wipe any prior dist to avoid stale icons from older versions.
  const distOut = join(VENDOR_DIR, 'dist');
  if (existsSync(distOut)) rmSync(distOut, { recursive: true, force: true });
  mkdirSync(VENDOR_DIR, { recursive: true });

  return new Promise((resolveP, reject) => {
    const proc = spawn(
      'tar',
      ['-xzf', CACHE_FILE, '-C', VENDOR_DIR, '--strip-components=1', `${STRIP_PREFIX}/dist`],
      { stdio: 'inherit' },
    );
    proc.on('close', (code) => {
      if (code === 0) resolveP();
      else reject(new Error(`tar exited ${code}`));
    });
    proc.on('error', reject);
  });
}

async function main(): Promise<void> {
  await downloadIfMissing();
  await extract();
  console.log(`[fetch] extracted → ${VENDOR_DIR}/dist/`);
  console.log(`[fetch] next: npm run icons:build`);
}

main().catch((err) => {
  console.error('[fetch] failed:', err.message ?? err);
  process.exit(1);
});
