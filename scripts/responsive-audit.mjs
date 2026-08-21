/**
 * Audit responsive : parcourt chaque page à six largeurs et signale
 * les débordements horizontaux, les éléments plus larges que le
 * viewport et les cibles tactiles trop petites.
 *
 *   node scripts/responsive-audit.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const EMAIL = process.env.AUDIT_EMAIL ?? 'aamirelamiri@admin.com';
const PASSWORD = process.env.AUDIT_PASSWORD ?? '123456789';

const WIDTHS = [
  { name: 'mobile', width: 360, height: 780 },
  { name: 'mobile-l', width: 430, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'wide', width: 1920, height: 1080 },
];

const PAGES = [
  '/fr',
  '/fr/services',
  '/fr/contact',
  '/fr/login',
  '/fr/signup',
  '/fr/cart',
  '/fr/checkout',
  '/fr/wishlist',
  '/fr/account',
  '/fr/account/orders',
  '/fr/account/profile',
  '/fr/account/wallet',
  '/fr/admin',
  '/fr/admin/orders',
  '/fr/admin/customers',
  '/fr/admin/services',
  '/fr/admin/topups',
  '/fr/forgot-password',
  '/ar',
  '/ar/services',
  '/ar/account',
];

/** Les pages de détail ont besoin d'un identifiant réel. */
const DYNAMIC = [
  { probe: '/fr/services', link: 'a[href*="/services/"]' },
  { probe: '/fr/account/orders', link: 'a[href*="/account/orders/"]' },
  { probe: '/fr/admin/orders', link: 'a[href*="/admin/orders/"]' },
];

/** Rapporte ce qui dépasse : le document, puis les coupables. */
const probe = () => {
  const vw = document.documentElement.clientWidth;
  const overflow = document.documentElement.scrollWidth - vw;

  const wide = [];
  if (overflow > 1) {
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > vw + 1 || r.left < -1) {
        const style = getComputedStyle(el);
        if (style.position === 'fixed' && style.visibility === 'hidden') continue;
        wide.push(
          `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ').filter(Boolean).slice(0, 2).join('.')} ` +
            `[${Math.round(r.left)}→${Math.round(r.right)}]`
        );
      }
      if (wide.length >= 6) break;
    }
  }

  // Cibles tactiles : uniquement ce qui est visible et interactif.
  const small = [];
  for (const el of document.querySelectorAll('a, button, [role="button"], input[type="checkbox"]')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.height < 30 || r.width < 24) {
      small.push(
        `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ').filter(Boolean)[0] ?? ''} ` +
          `${Math.round(r.width)}x${Math.round(r.height)}`
      );
    }
    if (small.length >= 5) break;
  }

  return { overflow, wide, small, title: document.title };
};

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

// Connexion : les pages compte et admin sont sinon redirigées.
await page.goto(`${BASE}/fr/login`, { waitUntil: 'networkidle' });
// En développement l'hydratation arrive après `networkidle` : cliquer trop
// tôt déclenche la soumission native du formulaire (GET) au lieu du
// gestionnaire React, et la connexion échoue sans raison apparente.
await page.waitForTimeout(1500);
// Le formulaire de recherche de l'en-tête contient lui aussi un
// `button[type=submit]` : on cible explicitement le formulaire de connexion.
const loginForm = page.locator('form.tm-login-form');
await loginForm.locator('input[type="email"]').fill(EMAIL);
await loginForm.locator('input[type="password"]').fill(PASSWORD);
await loginForm.locator('button[type="submit"]').click();
await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });
await page.waitForLoadState('networkidle');
console.log(`signed in → ${page.url()}\n`);

// Résolution des routes dynamiques : on suit le premier lien trouvé.
for (const d of DYNAMIC) {
  try {
    await page.goto(`${BASE}${d.probe}`, { waitUntil: 'networkidle' });
    const href = await page.locator(d.link).first().getAttribute('href');
    if (href && !PAGES.includes(href)) PAGES.push(href);
  } catch {
    console.log(`(aucune page de détail trouvée pour ${d.probe})`);
  }
}

let issues = 0;

for (const path of PAGES) {
  const rows = [];

  for (const vp of WIDTHS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 45000 });
    } catch {
      rows.push(`  ${vp.name.padEnd(9)} LOAD TIMEOUT`);
      continue;
    }
    await page.waitForTimeout(180);

    const r = await page.evaluate(probe);
    const flags = [];
    if (r.overflow > 1) flags.push(`overflow +${r.overflow}px → ${r.wide.join(' | ')}`);
    if (vp.width <= 768 && r.small.length) flags.push(`tap<30px: ${r.small.join(' | ')}`);

    if (flags.length) {
      issues += 1;
      rows.push(`  ${vp.name.padEnd(9)} ${flags.join('\n             ')}`);
    }
  }

  if (rows.length) {
    console.log(`✗ ${path}`);
    console.log(rows.join('\n'));
  } else {
    console.log(`✓ ${path}`);
  }
}

console.log(`\n${issues} viewport(s) with issues`);
await browser.close();
