/* ============================================================================
 * Auditoria de acessibilidade das páginas servidas.
 *
 * O `a11y.js` audita o protótipo, que é um ficheiro estático. Estas páginas —
 * as que um vizinho abre a partir do QR de um cartaz — não tinham auditoria
 * nenhuma, e passaram agora a ter selects e caixas de seleção, que é
 * exactamente onde isto costuma partir-se.
 *
 * Corre com e sem JavaScript: o formulário de filtros tem de continuar
 * utilizável quando o script não corre, porque é isso que ele promete.
 *
 * Correr: node tools/a11y-server.js
 * ==========================================================================*/
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const EXE = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const axe = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

process.env.CAPEM_ADMIN = 'a11y-'.repeat(4) + 'abcdef';
process.env.CAPEM_BASE = '';
const S = require(path.join(__dirname, '..', 'server', 'server.js'));

(async () => {
  const ficheiro = path.join(os.tmpdir(), `capem-a11y-${Date.now()}.db`);
  S.db.abrir(ficheiro);

  /* Centros que chegam para as páginas terem alguma coisa dentro: um a receber,
     um em pausa, um com a lista velha, e o suficiente para haver mais de uma
     página de resultados. */
  const fazer = (sl, d, dias) => {
    S.db.criar(sl, { tipo: 'Ponto de arrecadação', contato: '(51) 90000-0000',
      naoTraga: ['roupa-usada'], ...d });
    S.db.decidir(sl, 'aprovado');
    S.db.publicar(sl, S.db.ler(sl).dados);
    if (dias) {
      const c = new (require('node:sqlite').DatabaseSync)(ficheiro);
      c.prepare('UPDATE centros SET publicado=? WHERE slug=?')
        .run(Date.now() - dias * 86400000, sl);
      c.close();
    }
  };
  fazer('sao-sebastiao', { nome: 'Paróquia São Sebastião', endereco: 'Rua das Flores, 12 — Canoas/RS',
    horario: '8h às 18h', precisa: ['agua', 'cobertor', { id: 'arroz', q: '200 kg' }] });
  fazer('zona-norte', { nome: 'Ginásio Zona Norte', endereco: 'Av. Central, 900 — Canoas/RS',
    precisa: ['cobertor'], pausado: true, motivoPausa: 'Cheios até segunda.' });
  fazer('bela-vista', { nome: 'Centro Bela Vista', endereco: 'Rua Alta, 3 — Novo Hamburgo/RS',
    precisa: [{ texto: 'Ração para cães', marca: 'caixa' }] }, 20);
  fazer('fechou', { nome: 'Ponto que Encerrou', endereco: 'Rua Final, 1', precisa: [] });
  S.db.decidir('fechou', 'encerrado');
  for (let i = 0; i < 45; i++) {
    fazer('extra-' + i, { nome: 'Ponto ' + String(i).padStart(2, '0'),
      endereco: 'Rua Exemplo ' + i, precisa: ['agua'] });
  }

  const servidor = S.criarServidor();
  await new Promise(r => servidor.listen(0, r));
  const base = `http://127.0.0.1:${servidor.address().port}`;

  const PAGINAS = [
    ['entrada', '/'],
    ['lista', '/centros'],
    ['lista com procura', '/centros?q=cobertor'],
    ['lista filtrada e ordenada', '/centros?aceitando=1&recentes=1&ordem=nome'],
    ['lista, segunda página', '/centros?ordem=nome&p=2'],
    ['lista sem resultados', '/centros?q=zzzznada'],
    ['porta do centro', '/centro'],
    ['pedir página', '/novo'],
    ['entrada de atualização', '/atualizar'],
    ['pedir um código novo', '/pedir-codigo'],
    ['página de um centro', '/sao-sebastiao'],
    ['centro em pausa', '/zona-norte'],
    ['centro com lista velha', '/bela-vista'],
    ['centro encerrado', '/fechou'],
    ['fila de aprovação', '/admin?t=' + encodeURIComponent(process.env.CAPEM_ADMIN)]
  ];

  /* A lista aberta para edição só existe depois de um POST com o código certo,
     por isso o axe chega lá por um formulário e não por um endereço. */
  const CODIGO = S.db.novoCodigo();
  const hashDe = require('node:crypto').createHash('sha256')
    .update(CODIGO.replace('-', '')).digest('hex');
  {
    const c = new (require('node:sqlite').DatabaseSync)(ficheiro);
    c.prepare('UPDATE centros SET codigo_hash=? WHERE slug=?').run(hashDe, 'sao-sebastiao');
    c.close();
  }

  const browser = await chromium.launch({ executablePath: EXE });
  const todas = {};
  let n = 0;

  for (const esquema of ['light', 'dark']) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },   /* um telemóvel, que é o que isto é */
      colorScheme: esquema
    });
    const page = await ctx.newPage();
    for (const [nome, u] of [...PAGINAS, ['lista aberta para editar', null]]) {
      if (u) {
        await page.goto(base + u, { waitUntil: 'load' });
      } else {
        await page.goto(base + '/atualizar', { waitUntil: 'load' });
        await page.fill('#slug', 'sao-sebastiao');
        await page.fill('#codigo', CODIGO);
        await Promise.all([page.waitForLoadState('load'), page.click('button[type=submit]')]);
      }
      await page.addScriptTag({ content: axe });
      const res = await page.evaluate(async () => await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
      }));
      n++;
      res.violations.forEach(v => {
        const k = `${v.id} [${v.impact}]`;
        todas[k] = todas[k] || { ajuda: v.help, onde: new Set(), nos: new Set() };
        todas[k].onde.add(`${esquema}:${nome}`);
        v.nodes.slice(0, 2).forEach(x => todas[k].nos.add(x.html.slice(0, 120)));
      });
    }
    await ctx.close();
  }

  /* Sem JavaScript. O axe precisa de correr na página, por isso aqui não se
     mede acessibilidade — mede-se a promessa que o formulário faz: que os
     filtros continuam a funcionar quando o script não corre. Se isto falhar,
     a página passou a depender do script sem ninguém reparar. */
  const semJs = await browser.newContext({ viewport: { width: 390, height: 844 },
    javaScriptEnabled: false });
  const p2 = await semJs.newPage();
  await p2.goto(base + '/centros', { waitUntil: 'load' });
  const botao = await p2.isVisible('#aplicar');
  await p2.goto(base + '/centros?q=cobertor&aceitando=1&ordem=nome', { waitUntil: 'load' });
  const filtrou = (await p2.locator('.c-item').count()) === 1
    && await p2.inputValue('#q') === 'cobertor';

  /* E a actualização diária, que é a que mais precisa disto: um POST, um
     formulário, nenhum script. O telemóvel do coordenador é o pior aparelho da
     cadeia toda, e esta é a página que ele abre todos os dias. */
  await p2.goto(base + '/atualizar', { waitUntil: 'load' });
  await p2.fill('#slug', 'sao-sebastiao');
  await p2.fill('#codigo', CODIGO);
  await Promise.all([p2.waitForLoadState('load'), p2.click('button[type=submit]')]);
  const abriu = await p2.isVisible('.form-atualizar')
    && (await p2.locator('.item').count()) > 10;
  await p2.check('input[name=precisa][value=cobertor]');
  await p2.fill('input[name="q-cobertor"]', '20 caixas');
  await Promise.all([p2.waitForLoadState('load'),
    p2.click('.form-atualizar button[type=submit]')]);
  const publicou = await p2.isVisible('.feito');
  await semJs.close();
  await browser.close();

  if (!botao || !filtrou || !abriu || !publicou) {
    console.log('FALHA — sem JavaScript alguma coisa deixou de funcionar '
      + `(botão: ${botao}, filtrou: ${filtrou}, abriu a lista: ${abriu}, `
      + `publicou: ${publicou})`);
    servidor.close();
    process.exit(1);
  }
  servidor.close();
  try { fs.unlinkSync(ficheiro); } catch { /* já não existe */ }

  const chaves = Object.keys(todas);
  if (!chaves.length) {
    console.log(`PASS — nenhuma violação WCAG 2.1 A/AA em ${n} páginas ` +
      '(claro e escuro); sem JavaScript, os filtros e a atualização diária '
      + 'continuam a funcionar');
    process.exit(0);
  }
  chaves.forEach(k => {
    console.log(`\n${k}  ${todas[k].ajuda}`);
    console.log('  onde: ' + [...todas[k].onde].slice(0, 5).join(', '));
    [...todas[k].nos].forEach(x => console.log('  · ' + x));
  });
  console.log(`\nFALHA — ${chaves.length} violações`);
  process.exit(1);
})();
