/* Visits every screen in every language and both scenarios, and fails on any
 * console error, page error, or screen that renders empty. */
const { chromium } = require('playwright');
const path = require('path');

const ROUTES = [
  ['donor','donor-give'],['donor','donor-needs'],['donor','donor-impact'],
  ['intake','intake-scan'],['intake','intake-walkin'],['intake','intake-people'],
  ['gate','gate'],
  ['coord','coord-dash'],['coord','coord-match'],['coord','coord-needs'],
  ['coord','coord-people'],['coord','coord-whatsapp'],['coord','coord-offline'],
  ['inv','inv-stock'],['inv','inv-log'],['inv','inv-alerts'],
  ['vm','vm-roster'],['network','network'],['setup','setup'],['config','config'],
  ['training','training'],['about','about'],['about','about-data'],['about','about-questions']
];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  const url = 'file://' + path.join(__dirname, '..', 'index.html');
  await page.goto(url);
  await page.waitForTimeout(300);

  let checked = 0, empty = [];
  for (const scenario of ['tolima','rs']) {
    for (const lang of ['en','es','pt']) {
      await page.evaluate(([s,l]) => { Store.setScenario(s); Store.setLang(l, true); }, [scenario, lang]);
      for (const [role, screen] of ROUTES) {
        await page.evaluate(([r,sc]) => { location.hash = '#/' + r + '/' + sc; }, [role, screen]);
        await page.waitForTimeout(35);
        const info = await page.evaluate(() => {
          const m = document.getElementById('main');
          return { len: m ? m.innerHTML.length : 0, h1: m && m.querySelector('h1') ? m.querySelector('h1').textContent : null };
        });
        if (info.len < 400 || !info.h1) empty.push(`${scenario}/${lang} ${role}/${screen} (len ${info.len})`);
        checked++;
      }
    }
  }

  // Untranslated leakage: a raw key rendered on screen means a missing string
  await page.evaluate(() => { Store.setLang('pt', true); location.hash = '#/coord/coord-match'; });
  await page.waitForTimeout(120);
  const rawKeys = await page.evaluate(() =>
    (document.body.innerText.match(/\b[a-z]+\.[a-zA-Z0-9]+\.[a-zA-Z0-9]+/g) || [])
      .filter(s => !s.includes('capem.org') && !s.includes('docs/')));

  console.log(`checked ${checked} screen renders`);
  if (empty.length) console.log('EMPTY OR HEADERLESS:\n  ' + empty.join('\n  '));
  if (rawKeys.length) console.log('POSSIBLE RAW KEYS:\n  ' + [...new Set(rawKeys)].join('\n  '));
  if (errors.length) console.log('ERRORS:\n  ' + [...new Set(errors)].slice(0,20).join('\n  '));

  await browser.close();
  const fail = empty.length || errors.length;
  console.log(fail ? '\nFAIL' : '\nPASS — every screen renders in every language and scenario');
  process.exit(fail ? 1 : 0);
})();
