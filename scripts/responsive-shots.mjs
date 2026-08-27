/** Captures de contrôle : mobile 390 et desktop 1440, pages clés. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const OUT = process.argv[3] ?? './.shots';
mkdirSync(OUT, { recursive: true });

const SHOTS = [
  { path: '/fr', name: 'home' },
  { path: '/fr/services', name: 'services' },
  { path: '/fr/account', name: 'account' },
  { path: '/fr/account/orders', name: 'orders' },
  { path: '/fr/cart', name: 'cart' },
  { path: '/fr/admin', name: 'admin' },
  { path: '/fr/admin/orders', name: 'admin-orders' },
  { path: '/fr/admin/customers', name: 'admin-customers' },
];

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(`${BASE}/fr/login`, { waitUntil: 'networkidle' });
const form = page.locator('form.tm-login-form');
await form.locator('input[type="email"]').fill('admin@smm67.com');
await form.locator('input[type="password"]').fill('Admin@2026!');
await form.locator('button[type="submit"]').click();
await page.waitForURL((u) => !u.pathname.includes('/login'));

for (const vp of [
  { key: 'm', width: 390, height: 844 },
  { key: 'd', width: 1440, height: 900 },
]) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  for (const shot of SHOTS) {
    await page.goto(`${BASE}${shot.path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/${shot.name}-${vp.key}.png` });
    console.log(`${OUT}/${shot.name}-${vp.key}.png`);
  }
}

await browser.close();
