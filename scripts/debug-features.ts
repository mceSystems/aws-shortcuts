#!/usr/bin/env tsx
import { chromium } from 'playwright';
import { AUTH_STATE } from './lib/paths';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ storageState: AUTH_STATE });
  const page = await ctx.newPage();
  // Try a few well-known services with rich left-rail navigation.
  const targets = ['bedrock/home', 'ec2/home', 's3/home', 'lambda/home'];
  for (const path of targets) {
    const url = `https://us-east-1.console.aws.amazon.com/${path}`;
    console.log(`\n=== ${path} ===`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(4000);
    const stats = await page.evaluate(() => {
      const selectors = [
        'nav.awsui-side-navigation',
        '[data-testid*="navigation" i] nav',
        'nav[aria-label*="primary" i]',
        'nav[aria-label*="navigation" i]',
        'aside nav',
        'nav[aria-label]',
        'nav',
        '[data-testid*="side-nav"]',
        '[class*="side-navigation"]',
        '[class*="awsui-side"]',
      ];
      const matches = selectors.map((sel) => ({
        sel,
        count: document.querySelectorAll(sel).length,
        firstAnchorCount: document.querySelector(sel)?.querySelectorAll('a').length ?? 0,
      }));
      const allNavs = Array.from(document.querySelectorAll('nav')).map((n) => ({
        ariaLabel: n.getAttribute('aria-label'),
        cls: n.className.slice(0, 60),
        anchors: n.querySelectorAll('a').length,
      }));
      const allAnchorsInLeftHalf = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
        .filter((a) => a.getBoundingClientRect().left < 320)
        .slice(0, 10)
        .map((a) => `"${(a.textContent ?? '').trim().slice(0, 30)}" → ${a.getAttribute('href')?.slice(0, 50)}`);
      return { url: location.href, matches, allNavs, allAnchorsInLeftHalf };
    });
    console.log(JSON.stringify(stats, null, 2));
  }
  await browser.close();
}
main().catch(console.error);
