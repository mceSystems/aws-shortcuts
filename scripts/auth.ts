#!/usr/bin/env tsx
// One-time interactive SSO login capture. Opens a Chromium window pointed at
// the SSO start URL; sign in manually + click any account/role. Polls all
// open tabs for a console.aws.amazon.com URL; once any tab matches, saves
// storage state and closes the browser.
//
// Usage:
//   npm run catalog:auth -- https://your-org.awsapps.com/start

import { mkdirSync } from 'node:fs';
import { AUTH_DIR, AUTH_STATE } from './lib/paths';

const POLL_INTERVAL_MS = 1000;
const TIMEOUT_MS = 10 * 60 * 1000;

async function main(): Promise<void> {
  const startUrl = process.argv[2];
  if (!startUrl) {
    console.error('usage: npm run catalog:auth -- <SSO start URL>');
    process.exit(1);
  }

  const { chromium } = await import('playwright').catch(() => {
    throw new Error('playwright not installed. Run: npm i -D playwright && npx playwright install chromium');
  });

  mkdirSync(AUTH_DIR, { recursive: true });

  console.log('[auth] launching Chromium.');
  console.log('[auth] sign in to SSO, then click any account/role to open the AWS console.');
  console.log('[auth] state auto-saves once any tab reaches console.aws.amazon.com.');

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(startUrl);

  const start = Date.now();
  const isConsole = (url: string) => /^https?:\/\/[^/]*console\.aws\.amazon\.com/i.test(url);

  while (Date.now() - start < TIMEOUT_MS) {
    if (!browser.isConnected()) {
      console.error('[auth] browser closed before reaching console.aws.amazon.com — re-run.');
      process.exit(1);
    }
    const pages = ctx.pages();
    const hit = pages.find((p) => isConsole(p.url()));
    if (hit) {
      console.log(`[auth] caught console nav: ${hit.url().slice(0, 80)}`);
      await ctx.storageState({ path: AUTH_STATE });
      console.log(`[auth] saved state → ${AUTH_STATE}`);
      await browser.close().catch(() => {});
      return;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  console.error('[auth] timed out — no console.aws.amazon.com nav within 10 min');
  await browser.close().catch(() => {});
  process.exit(1);
}

main().catch((err) => {
  console.error('[auth] failed:', err.message ?? err);
  process.exit(1);
});
