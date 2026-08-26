/* axe-core accessibility audit across representative screens, light and dark. */
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const EXE = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const axe = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const SCREENS = [['donor','donor-give'],['donor','donor-needs'],['intake','intake-scan'],
  ['intake','intake-people'],['gate','gate'],['coord','coord-dash'],['coord','coord-match'],
  ['coord','coord-needs'],['inv','inv-stock'],['vm','vm-roster'],['network','network'],
  ['setup','setup'],['config','config'],['training','training'],['about','about-data']];

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const all = {};
  for (const scheme of ['light','dark']) {
    const page = await browser.newPage({ viewport:{width:1280,height:900}, colorScheme: scheme });
    await page.goto('file://' + path.join(__dirname,'..','index.html'));
    await page.waitForTimeout(250);
    await page.addScriptTag({ content: axe });
    // landing first
    for (const [r,s] of [[null,null], ...SCREENS]) {
      if (r) { await page.evaluate(([a,b]) => location.hash='#/'+a+'/'+b, [r,s]); }
      else { await page.evaluate(() => location.hash = '#/'); }
      await page.waitForTimeout(90);
      const res = await page.evaluate(async () => await axe.run(document, {
        runOnly: { type:'tag', values:['wcag2a','wcag2aa','wcag21a','wcag21aa'] }
      }));
      res.violations.forEach(v => {
        const key = `${v.id} [${v.impact}]`;
        all[key] = all[key] || { desc: v.help, where: new Set(), nodes: new Set() };
        all[key].where.add(`${scheme}:${r||'landing'}/${s||''}`);
        v.nodes.slice(0,2).forEach(n => all[key].nodes.add(n.html.slice(0,110)));
      });
    }
    await page.close();
  }
  await browser.close();
  const keys = Object.keys(all);
  if (!keys.length) { console.log('PASS — no WCAG 2.1 A/AA violations across 16 screens, at both OS colour-scheme settings'); process.exit(0); }
  keys.sort();
  for (const k of keys) {
    console.log(`\n${k}  ${all[k].desc}`);
    console.log('  screens: ' + [...all[k].where].slice(0,4).join(', ') + ([...all[k].where].length>4?` (+${[...all[k].where].length-4})`:''));
    [...all[k].nodes].slice(0,2).forEach(n => console.log('  ' + n));
  }
  console.log(`\n${keys.length} distinct violation types`);
  process.exit(1);
})();
