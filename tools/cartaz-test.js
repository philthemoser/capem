/* Drives the poster generator: fills it in, checks the poster renders,
 * the PNG is produced, the WhatsApp text is right, and nothing overflows. */
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const EXE = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'OK   ' : 'FAIL ') + n + (d ? '  — ' + d : '')); };

(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const url = 'file://' + path.join(__dirname, '..', 'field', 'cartaz.html');
  const errs = [];

  const p = await b.newPage({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 });
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto(url); await p.waitForTimeout(250);

  check('loads with an empty poster', await p.isVisible('#cartaz'));

  // Fill it in the way a coordinator would
  await p.fill('#f-nome', 'Paróquia São José');
  await p.selectOption('#f-tipo', 'Abrigo e ponto de arrecadação');
  await p.fill('#f-endereco', 'Rua das Acácias, 240 — Canoas');
  await p.fill('#f-horario', 'Todos os dias, 8h às 20h');
  await p.fill('#f-contato', '(51) 99999-0000');
  await p.waitForTimeout(120);

  for (const item of ['Água potável', 'Kit de limpeza', 'Colchonete', 'Fralda infantil', 'Bota de borracha']) {
    await p.click(`.chip:text-is("${item}")`);
  }
  await p.fill('#f-livre', 'Ração para cavalos');
  await p.click('.linha-add button');
  await p.waitForTimeout(150);

  const escolhidos = await p.$$eval('#lista-precisa li', els => els.map(e => e.querySelector('span').textContent.trim()));
  check('items add to the list in order', escolhidos.length === 6 && escolhidos[5] === 'Ração para cavalos', escolhidos.join(', '));

  await p.click('#lista-precisa li:nth-child(3) button[aria-label^="Subir"]');
  await p.waitForTimeout(120);
  const depois = await p.$$eval('#lista-precisa li span:first-child', els => els.map(e => e.textContent.trim()));
  check('reordering works', depois[1] === 'Colchonete', depois.slice(0, 3).join(' > '));

  const naoTraga = await p.$$eval('#lista-nao li span:first-child', els => els.map(e => e.textContent.trim()));
  check('"do not bring" is pre-filled', naoTraga.includes('Roupa usada'), naoTraga.join(', '));

  const posterText = await p.textContent('#cartaz');
  check('poster shows the centre name', posterText.includes('Paróquia São José'));
  check('poster shows the "do not bring" block', posterText.includes('NÃO TRAGA') || posterText.toLowerCase().includes('não traga'));
  check('poster stamps an update time', /Atualizado \d{2}\/\d{2}/.test(posterText), posterText.match(/Atualizado[^\n]*/)?.[0]);

  // Persistence across a reload — the thing that makes daily updates viable
  await p.reload(); await p.waitForTimeout(300);
  check('reopens with everything still filled in',
        (await p.inputValue('#f-nome')) === 'Paróquia São José'
        && (await p.$$('#lista-precisa li')).length === 6);

  // The PNG
  const png = await p.evaluate(() => new Promise(res => {
    const cv = desenharCanvas();
    cv.toBlob(bl => { const r = new FileReader(); r.onload = () => res({ w: cv.width, h: cv.height, len: bl.size, data: r.result }); r.readAsDataURL(bl); }, 'image/png');
  }));
  check('produces a 1080x1350 PNG', png.w === 1080 && png.h === 1350 && png.len > 12000,
        `${png.w}x${png.h}, ${(png.len / 1024).toFixed(0)} KB`);
  fs.writeFileSync(path.join(__dirname, '..', 'field', 'exemplo.png'),
                   Buffer.from(png.data.split(',')[1], 'base64'));

  // WhatsApp text
  const wa = await p.evaluate(() => textoWhatsApp());
  check('WhatsApp text names the centre', wa.includes('PARÓQUIA SÃO JOSÉ'));
  check('WhatsApp text lists the needs', wa.includes('• Água potável'));
  check('WhatsApp text carries the "do not bring" line', wa.includes('NÃO TRAGA') && wa.includes('Roupa usada'));
  check('WhatsApp text is short enough to actually send', wa.length < 900, wa.length + ' chars');

  // QR appears only when a link is given
  check('no QR without a link', !(await p.$('#cartaz .c-qr')));
  await p.fill('#f-link', 'https://capem.org/c/sao-jose'); await p.waitForTimeout(200);
  check('QR appears once a link is given', !!(await p.$('#cartaz .c-qr svg')));

  // Layout
  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('no horizontal overflow on a phone', over <= 1, over + 'px');

  const d = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  await d.goto(url); await d.waitForTimeout(400);
  await d.screenshot({ path: path.join(__dirname, '..', 'field', 'tela.png') });
  const overD = await d.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('no horizontal overflow on desktop', overD <= 1, overD + 'px');

  check('no runtime errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
