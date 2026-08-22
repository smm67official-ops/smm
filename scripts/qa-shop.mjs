/**
 * QA fonctionnelle : panier, favoris, commandes, services.
 *
 * Chaque scénario suit un parcours réel et vérifie l'état observable
 * (DOM + localStorage + base), pas seulement l'absence d'erreur.
 *
 *   node scripts/qa-shop.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const EMAIL = process.env.QA_EMAIL ?? 'aamirelamiri@admin.com';
const PASSWORD = process.env.QA_PASSWORD ?? '123456789';

let pass = 0;
let fail = 0;

const check = (label, ok, detail = '') => {
  if (ok) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
};

const basket = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('smm.basket') ?? '[]'));
const favorites = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('smm.favorites') ?? '[]'));

/** Ouvre une fiche service et remplit le formulaire de commande. */
async function addServiceToBasket(page, link, { index = 0 } = {}) {
  await page.goto(`${BASE}/fr/services`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const hrefs = await page.$$eval('a[href*="/services/"]', (as) =>
    as.map((a) => a.getAttribute('href')).filter((h) => /\/services\/[0-9a-f-]{36}$/.test(h ?? ''))
  );
  const href = hrefs[index];
  if (!href) throw new Error('aucune fiche service trouvée');

  await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  const linkField = page.locator('#order-link');
  if (await linkField.count()) await linkField.fill(link);

  await page.getByRole('button', { name: /panier|basket|السلة/i }).first().click();
  await page.waitForTimeout(500);
  return href;
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));

// ---------------------------------------------------------------------
console.log('\n== Connexion ==');
await page.goto(`${BASE}/fr/login`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
const form = page.locator('form.tm-login-form');
await form.locator('input[type="email"]').fill(EMAIL);
await form.locator('input[type="password"]').fill(PASSWORD);
await form.locator('button[type="submit"]').click();
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 });
check('connexion aboutie', !page.url().includes('/login'), page.url());

// ---------------------------------------------------------------------
console.log('\n== Panier : ajout ==');
await page.evaluate(() => localStorage.removeItem('smm.basket'));
await page.reload({ waitUntil: 'networkidle' });

const firstHref = await addServiceToBasket(page, 'https://instagram.com/qa-un');
let lines = await basket(page);
check('1 ligne après un ajout', lines.length === 1, `lignes=${lines.length}`);

console.log('\n== Panier : ajout du MÊME service, même lien ==');
await page.goto(`${BASE}${firstHref}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const lf = page.locator('#order-link');
if (await lf.count()) await lf.fill('https://instagram.com/qa-un');
await page.getByRole('button', { name: /panier|basket/i }).first().click();
await page.waitForTimeout(500);
lines = await basket(page);
check('pas de doublon en base locale', lines.length === 1, `lignes=${lines.length}`);
const noticeText = await page
  .locator('.tm-alert-success')
  .first()
  .textContent()
  .catch(() => null);
check(
  'le refus du doublon est signalé (pas un faux succès)',
  !noticeText || !/ajout|added/i.test(noticeText),
  `message affiché : ${JSON.stringify(noticeText)}`
);

console.log('\n== Panier : même service, lien DIFFÉRENT ==');
await page.goto(`${BASE}${firstHref}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
if (await lf.count()) await page.locator('#order-link').fill('https://instagram.com/qa-deux');
await page.getByRole('button', { name: /panier|basket/i }).first().click();
await page.waitForTimeout(500);
lines = await basket(page);
const twoLines = lines.length === 2;
check('2 lignes pour 2 liens distincts', twoLines, `lignes=${lines.length}`);

if (twoLines) {
  console.log('\n== Panier : quantité et suppression sur lignes jumelles ==');
  await page.goto(`${BASE}/fr/cart`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);

  const steppers = page.locator('.cx-stepper input');
  const before = await steppers.nth(0).inputValue();
  await steppers.nth(0).fill(String(Number(before) + Number(lines[0].min || 1)));
  await steppers.nth(0).dispatchEvent('change');
  await page.waitForTimeout(600);

  const after = await basket(page);
  check(
    'modifier une quantité ne touche que sa ligne',
    after[0].quantity !== after[1].quantity,
    `q1=${after[0].quantity} q2=${after[1].quantity}`
  );

  await page.locator('.cx-remove').first().click();
  await page.waitForTimeout(600);
  const afterRemove = await basket(page);
  check(
    'supprimer une ligne n’en supprime qu’une',
    afterRemove.length === 1,
    `restantes=${afterRemove.length}`
  );
}

console.log('\n== Panier : total affiché ==');
await page.goto(`${BASE}/fr/cart`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const shownTotal = await page
  .locator('.cx-sticky__total')
  .first()
  .textContent()
  .catch(() => null);
const stored = await basket(page);
const expected = stored.reduce((s, l) => s + (Number(l.rate) * Number(l.quantity)) / 1000, 0);
check(
  'total affiché = somme des lignes',
  shownTotal !== null && Math.abs(parseFloat(shownTotal.replace(/[^0-9.]/g, '')) - expected) < 0.01,
  `affiché=${shownTotal} attendu=${expected.toFixed(4)}`
);

// ---------------------------------------------------------------------
console.log('\n== Favoris ==');
await page.goto(`${BASE}/fr/services`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

const heart = page.locator('.tm-favorite-toggle').first();
await heart.click();
await page.waitForTimeout(1200);
let favs = await favorites(page);
check('favori ajouté', favs.length >= 1, `favoris=${favs.length}`);

const favCount = favs.length;
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1600);
favs = await favorites(page);
check('favori conservé après rechargement', favs.length === favCount, `favoris=${favs.length}`);

await page.goto(`${BASE}/fr/wishlist`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1400);
const rows = await page.locator('.tm-wishlist-table tbody tr').count();
check('la page favoris liste le service', rows >= 1, `lignes=${rows}`);

// Persistance réelle côté base : on vide le stockage local et on recharge.
await page.evaluate(() => localStorage.removeItem('smm.favorites'));
await page.goto(`${BASE}/fr/wishlist`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
const rowsAfter = await page.locator('.tm-wishlist-table tbody tr').count();
check(
  'favoris restitués depuis la base (stockage local vidé)',
  rowsAfter >= 1,
  `lignes=${rowsAfter}`
);

console.log('\n== Favoris : retrait ==');
const removeBtn = page.locator('.tm-wishlist-removeproduct').first();
if (await removeBtn.count()) {
  await removeBtn.click();
  await page.waitForTimeout(1200);
  const left = await page.locator('.tm-wishlist-table tbody tr').count();
  check('retrait effectif', left === rowsAfter - 1, `avant=${rowsAfter} après=${left}`);
}

// ---------------------------------------------------------------------
console.log('\n== Commandes ==');
await page.goto(`${BASE}/fr/account/orders`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const hasList = await page.locator('.cx-order, .cx-empty').count();
check('page commandes rendue (liste ou état vide)', hasList > 0);

// ---------------------------------------------------------------------
console.log('\n== États vides ==');
await page.evaluate(() => localStorage.setItem('smm.basket', '[]'));
await page.goto(`${BASE}/fr/cart`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
check('panier vide : état vide affiché', (await page.locator('.cx-empty').count()) > 0);
check(
  'panier vide : bouton vers la boutique',
  (await page.locator('.cx-empty a').count()) > 0
);

// ---------------------------------------------------------------------
console.log(`\nerreurs JS : ${errors.length ? errors.join(' | ') : 'aucune'}`);
console.log(`\n${pass} réussis, ${fail} échoués`);

await browser.close();
process.exit(fail > 0 ? 1 : 0);
