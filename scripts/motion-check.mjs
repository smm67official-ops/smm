/**
 * Vérifie qu'aucun contenu ne reste invisible.
 *
 * Le système de mouvement masque les éléments avant leur entrée : un
 * élément annoté mais jamais animé disparaîtrait définitivement. On
 * déroule la page en entier puis on recense ce qui est encore à
 * `opacity: 0` ou `visibility: hidden`.
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3000';

const PAGES = [
  '/fr', '/fr/services', '/fr/contact', '/fr/login', '/fr/signup',
  '/fr/cart', '/fr/checkout', '/fr/wishlist', '/fr/account', '/fr/account/orders',
  '/fr/account/profile', '/fr/account/wallet', '/fr/admin', '/fr/admin/orders',
  '/fr/admin/customers', '/fr/admin/services', '/fr/admin/topups', '/ar', '/ar/account',
];

const browser = await chromium.launch();

for (const reduced of [false, true]) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/fr/login`, { waitUntil: 'networkidle' });
  const form = page.locator('form.tm-login-form');
  await form.locator('input[type="email"]').fill('admin@smm67.com');
  await form.locator('input[type="password"]').fill('Admin@2026!');
  await form.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.includes('/login'));

  console.log(`\n=== prefers-reduced-motion: ${reduced ? 'reduce' : 'no-preference'} ===`);
  let bad = 0;

  for (const path of PAGES) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });

    // Déroule la page pour déclencher toutes les révélations au scroll.
    await page.evaluate(async () => {
      const step = window.innerHeight * 0.8;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 90));
      }
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(700);

    const hidden = await page.evaluate(() => {
      const marked = document.querySelectorAll(
        '[data-motion], [data-reveal], [data-reveal-item], .tm-scrollanim'
      );
      const out = [];
      for (const el of marked) {
        const s = getComputedStyle(el);
        if (s.opacity !== '0' && s.visibility !== 'hidden') continue;
        // Un ancêtre volontairement masqué (menu fermé) n'est pas un défaut.
        if (el.offsetParent === null && s.position !== 'fixed') continue;
        out.push(
          `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ').filter(Boolean)[0] ?? ''}`
        );
      }
      return out;
    });

    if (hidden.length) {
      bad += 1;
      console.log(`✗ ${path} — ${hidden.length} hidden: ${hidden.slice(0, 5).join(', ')}`);
    } else {
      console.log(`✓ ${path}`);
    }
  }

  console.log(`${bad} page(s) with hidden content`);
  await context.close();
}

await browser.close();
