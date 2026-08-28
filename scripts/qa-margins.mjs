/**
 * QA des marges et du widget WhatsApp.
 *
 * Deux niveaux :
 *  - la formule seule, en mémoire, sans base ni serveur (tests 1 à 2) ;
 *  - le comportement réel, contre la base et l'interface (tests 3 à 6).
 *
 *   node --env-file=.env.local scripts/qa-margins.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const EMAIL = process.env.QA_EMAIL ?? 'admin@smm67.com';
const PASSWORD = process.env.QA_PASSWORD ?? 'Admin@2026!';

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

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

// --- La formule, isolée ---------------------------------------------
// Recopiée volontairement plutôt qu'importée : le test vérifie le
// RÉSULTAT ATTENDU du cahier des charges, pas que le code est égal à
// lui-même. Une dérive dans src/lib/pricing.ts doit faire échouer ceci.
const effective = (custom, global) => (custom === null || custom === undefined ? global : custom);
const price = (cost, margin) => Math.round(cost * (1 + margin / 100) * 1e5) / 1e5;

console.log('\n== Formule ==');
check('global 20 %, sans marge propre, coût 100 -> 120', price(100, effective(null, 20)) === 120,
  String(price(100, effective(null, 20))));
check('global 20 %, marge propre 35 %, coût 100 -> 135', price(100, effective(35, 20)) === 135,
  String(price(100, effective(35, 20))));
check('marge 0 % -> prix = coût', price(100, effective(0, 20)) === 100, String(price(100, effective(0, 20))));
check('une marge propre de 0 n\'est PAS confondue avec « absente »',
  price(100, effective(0, 20)) !== price(100, effective(null, 20)));

// --- Contre la base et l'interface -----------------------------------
const rest = async (path, init) => {
  const r = await fetch(`${SUPABASE}/rest/v1/${path}`, { ...init, headers });
  const text = await r.text();
  return { ok: r.ok, status: r.status, json: text ? JSON.parse(text) : null };
};

if (!SUPABASE || !KEY) {
  console.log('\nClés Supabase absentes — lancez avec: node --env-file=.env.local');
  process.exit(1);
}

const settings = await rest('app_settings?select=global_service_margin');
if (!settings.ok) {
  console.log(`\nMigration 011 non appliquée (${settings.status}) — tests de bout en bout ignorés.`);
  console.log(`\n${pass} réussis, ${fail} échoués`);
  process.exit(fail > 0 ? 1 : 0);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

await page.goto(`${BASE}/fr/login`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
const form = page.locator('form.tm-login-form');
await form.locator('input[type="email"]').fill(EMAIL);
await form.locator('input[type="password"]').fill(PASSWORD);
await form.locator('button[type="submit"]').click();
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 });

/** Appelle une route d'administration avec la session du navigateur. */
const api = (path, init) =>
  page.evaluate(
    async ([p, i]) => {
      const r = await fetch(p, i);
      return { ok: r.ok, status: r.status, body: await r.json().catch(() => null) };
    },
    [path, init]
  );

const sample = await rest('services?select=id,provider_rate,rate,margin_mode,custom_margin&limit=3&order=created_at');
const [A, B, C] = sample.json ?? [];

console.log('\n== Test 3 : appliquer 20 % à tous ==');
let res = await api('/api/admin/services/apply-global-margin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ margin: 20, reset_custom_margins: true }),
});
check('application acceptée', res.ok, JSON.stringify(res.body).slice(0, 120));

let rows = await rest('services?select=margin_mode,custom_margin&margin_mode=eq.custom');
check('plus aucune marge individuelle', (rows.json ?? []).length === 0, `restantes=${(rows.json ?? []).length}`);

let after = await rest(`services?select=provider_rate,rate&id=eq.${A.id}`);
let row = after.json[0];
check('prix recalculé à 20 %', Math.abs(Number(row.rate) - price(Number(row.provider_rate), 20)) < 1e-5,
  `${row.rate} vs ${price(Number(row.provider_rate), 20)}`);

console.log('\n== Test 4 : B passe en marge propre 35 % ==');
res = await api(`/api/admin/services/${B.id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ margin_mode: 'custom', custom_margin: 35 }),
});
check('marge propre enregistrée', res.ok, JSON.stringify(res.body).slice(0, 120));

after = await rest(`services?select=provider_rate,rate,margin_mode,custom_margin&id=eq.${B.id}`);
row = after.json[0];
check('B = 35 % custom', row.margin_mode === 'custom' && Number(row.custom_margin) === 35);
check('prix de B recalculé à 35 %', Math.abs(Number(row.rate) - price(Number(row.provider_rate), 35)) < 1e-5,
  `${row.rate} vs ${price(Number(row.provider_rate), 35)}`);

after = await rest(`services?select=margin_mode&id=eq.${A.id}`);
check('A reste en global', after.json[0].margin_mode === 'global');

console.log('\n== Test 5 : global 25 %, sans réinitialiser ==');
res = await api('/api/admin/services/apply-global-margin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ margin: 25, reset_custom_margins: false }),
});
check('application acceptée', res.ok);

after = await rest(`services?select=provider_rate,rate,margin_mode,custom_margin&id=in.(${A.id},${B.id})`);
const a25 = after.json.find((r) => r.margin_mode === 'global');
const b35 = after.json.find((r) => r.margin_mode === 'custom');
check('sans marge propre -> 25 %', Math.abs(Number(a25.rate) - price(Number(a25.provider_rate), 25)) < 1e-5);
check('avec marge propre -> reste à 35 %', Math.abs(Number(b35.rate) - price(Number(b35.provider_rate), 35)) < 1e-5);

console.log('\n== Test 6 : « appliquer à tous » efface les exceptions ==');
res = await api('/api/admin/services/apply-global-margin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ margin: 25, reset_custom_margins: true }),
});
rows = await rest('services?select=id&margin_mode=eq.custom');
check('B a perdu son override', (rows.json ?? []).length === 0, `restantes=${(rows.json ?? []).length}`);

after = await rest(`services?select=provider_rate,rate&id=eq.${B.id}`);
row = after.json[0];
check('B suit désormais le global', Math.abs(Number(row.rate) - price(Number(row.provider_rate), 25)) < 1e-5);

console.log('\n== Validation ==');
for (const [label, margin] of [['négative', -20], ['texte', 'abc'], ['nulle', null], ['hors bornes', 5000]]) {
  const r = await api('/api/admin/services/apply-global-margin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ margin }),
  });
  check(`marge ${label} refusée`, !r.ok, `statut ${r.status}`);
}

console.log('\n== Widget WhatsApp ==');
const setWidget = (body) =>
  api('/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

await setWidget({ whatsapp_enabled: true, whatsapp_position: 'bottom-right', whatsapp_greeting: '' });
await page.goto(`${BASE}/fr`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
check('widget visible quand activé', (await page.locator('.wa-widget').count()) === 1);

const href = await page.locator('.wa-widget a').first().getAttribute('href').catch(() => '');
const active = await rest('whatsapp_numbers?select=number&is_active=eq.true');
const activeNumber = active.json?.[0]?.number;
check('le widget utilise le numéro actif', (href ?? '').includes(activeNumber ?? 'xxx'), href ?? '');

check('placé à droite', (await page.locator('.wa-widget--bottom-right').count()) === 1);

await setWidget({ whatsapp_position: 'bottom-left' });
await page.goto(`${BASE}/fr/services`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
check('position appliquée sans redéploiement', (await page.locator('.wa-widget--bottom-left').count()) === 1);

await page.goto(`${BASE}/fr/admin`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
check('absent du back-office', (await page.locator('.wa-widget').count()) === 0);

await setWidget({ whatsapp_enabled: false });
await page.goto(`${BASE}/fr`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
check('widget masqué quand désactivé', (await page.locator('.wa-widget').count()) === 0);

// Mobile
await setWidget({ whatsapp_enabled: true, whatsapp_position: 'bottom-right' });
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const mp = await mobile.newPage();
await mp.goto(`${BASE}/fr`, { waitUntil: 'domcontentloaded' });
await mp.waitForTimeout(2500);
const box = await mp.locator('.wa-widget__button').boundingBox().catch(() => null);
check('visible sur mobile', box !== null, box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'absent');
check(
  'ne recouvre pas la barre de navigation basse',
  box !== null && box.y + box.height < 844 - 56,
  box ? `bas du bouton à ${Math.round(box.y + box.height)}px` : ''
);
await mobile.close();

await browser.close();

console.log(`\n${pass} réussis, ${fail} échoués`);
process.exit(fail > 0 ? 1 : 0);
