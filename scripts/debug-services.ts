#!/usr/bin/env tsx
import { chromium } from 'playwright';
import { AUTH_STATE } from './lib/paths';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ storageState: AUTH_STATE });
  const page = await ctx.newPage();
  await page.goto('https://us-east-1.console.aws.amazon.com/console/services', {
    waitUntil: 'networkidle',
    timeout: 60_000,
  });
  await page.waitForTimeout(3000);
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
  }
  const stats = await page.evaluate(() => {
    const a1 = document.querySelectorAll('a[href*="console.aws.amazon.com"]').length;
    const a2 = document.querySelectorAll('a[href]').length;
    const a3 = document.querySelectorAll('main a').length;
    const headings = Array.from(document.querySelectorAll('h2, h3'))
      .slice(0, 30)
      .map((h) => (h.textContent ?? '').trim().slice(0, 40));
    const sample = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('a[href*="console.aws.amazon.com"]'),
    )
      .slice(0, 30)
      .map((a) => `"${(a.textContent ?? '').trim().slice(0, 30)}" → ${a.href.slice(0, 80)}`);
    return { a1, a2, a3, headings, sample, url: location.href };
  });
  console.log(JSON.stringify(stats, null, 2));
  await page.screenshot({ path: '/tmp/services-page.png', fullPage: true });
  console.log('screenshot: /tmp/services-page.png');
  await page.waitForTimeout(2000);
  await browser.close();
}
main().catch(console.error);
