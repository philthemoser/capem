#!/usr/bin/env node
/* ============================================================================
 * Testes do kit de material impresso (field/kit.html)
 *
 * O que estes testes existem para apanhar, por ordem de importância:
 *
 * 1. TRANSBORDO. Uma peça cujo conteúdo não cabe na folha é papel gasto e
 *    uma pessoa a olhar para uma lista cortada ao meio. É a única falha
 *    aqui que custa dinheiro a quem não o tem, e é invisível no ecrã se a
 *    folha estiver encolhida.
 * 2. MEDIDAS REAIS. Uma peça tem de medir em píxeis exactamente o que diz
 *    medir em milímetros. Se isto derivar, todas as marcas de corte mentem.
 * 3. MONO. A promessa é que a peça funciona sem toner de cor. Se algum
 *    elemento continuar vermelho ou verde em modo mono, a promessa é falsa.
 * 4. O PISO DO ÍCONE. Abaixo de 26 mm a marca deixa de se ler a dois metros
 *    e o cartaz passa a ser texto com decoração.
 *
 * Correr: node tools/kit-test.js
 * ==========================================================================*/
const { chromium } = require('playwright');
const path = require('path');
const EXE = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const MM = 96 / 25.4;
let passou = 0, falhou = 0;
const ok = (nome, cond, extra) => {
  if (cond) { passou++; console.log(`  ok   ${nome}`); }
  else { falhou++; console.log(`  FALHA ${nome}${extra ? '  → ' + extra : ''}`); }
};

const CENTRO = {
  '#f-nome': 'Paróquia São Sebastião',
  '#f-endereco': 'R. Bento Gonçalves, 412 — Centro, Canoas/RS',
  '#f-horario': 'Todos os dias, 8h às 20h',
  '#f-contato': '(51) 99612-0044',
  '#f-link': 'capem.org/canoas-sao-sebastiao'
};

(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const erros = [];
  p.on('pageerror', e => erros.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text()); });

  await p.goto('file://' + path.resolve(__dirname, '..', 'field', 'kit.html'));

  console.log('\nconjunto de ícones');
  const ic = await p.evaluate(() => ({
    n: ICONES.length,
    unicos: new Set(ICONES.map(i => i.id)).size,
    vazios: ICONES.filter(i => !i.d || i.d.length < 10).map(i => i.id),
    /* Um `d` inválido não lança em SVG — falha em silêncio e desenha nada.
       Path2D lança, e é por isso que a verificação passa por aqui. */
    maus: ICONES.filter(i => { try { new Path2D(i.d); return false; } catch (e) { return true; } }).map(i => i.id),
    cats: { need: ICONES.filter(i => i.cat === 'need').length,
            refuse: ICONES.filter(i => i.cat === 'refuse').length,
            util: ICONES.filter(i => i.cat === 'util').length }
  }));
  ok('28 marcas', ic.n === 28, `são ${ic.n}`);
  ok('ids únicos', ic.unicos === ic.n);
  ok('nenhum caminho vazio', ic.vazios.length === 0, ic.vazios.join(','));
  ok('todos os caminhos são SVG válido', ic.maus.length === 0, ic.maus.join(','));
  ok('16 necessidades · 4 recusas · 8 utilitárias',
    ic.cats.need === 16 && ic.cats.refuse === 4 && ic.cats.util === 8, JSON.stringify(ic.cats));

  const semMarca = await p.evaluate(() =>
    GRUPOS.flatMap(g => g.ids).filter(id => !POR_ID[id]));
  ok('todo o catálogo tem marca própria', semMarca.length === 0, semMarca.join(','));

  console.log('\npreencher');
  for (const [sel, v] of Object.entries(CENTRO)) await p.fill(sel, v);
  for (const id of ['formula', 'fralda', 'alvejante', 'balde']) await p.click(`[data-tog="${id}"]`);
  await p.waitForTimeout(400);

  const pecas = await p.$$eval('.peca', els => els.map(e => e.dataset.peca));
  ok('14 peças', pecas.length === 14, pecas.join(' '));

  console.log('\nmedidas reais');
  const med = await p.evaluate(MM => PECAS.map(pc => {
    const el = document.querySelector(`#peca-${pc.id} .folha`);
    const esperado = { w: pc.w * (pc.un === 'mm' ? MM : 1), h: pc.h * (pc.un === 'mm' ? MM : 1) };
    return { id: pc.id, w: el.offsetWidth, h: el.offsetHeight, ew: esperado.w, eh: esperado.h };
  }), MM);
  med.forEach(m => ok(`${m.id} mede o que diz medir`,
    Math.abs(m.w - m.ew) < 1.5 && Math.abs(m.h - m.eh) < 1.5,
    `${m.w}×${m.h} ≠ ${m.ew.toFixed(0)}×${m.eh.toFixed(0)}`));

  console.log('\ntransbordo (o teste que salva papel)');
  const trans = await p.evaluate(() => {
    const maus = [];
    document.querySelectorAll('.folha').forEach(f => {
      const id = f.closest('.peca').dataset.peca;
      /* 2 px de folga: sub-píxel de arredondamento não é transbordo. */
      if (f.scrollWidth > f.clientWidth + 2 || f.scrollHeight > f.clientHeight + 2) {
        maus.push(`${id} ${f.scrollWidth}×${f.scrollHeight} > ${f.clientWidth}×${f.clientHeight}`);
      }
    });
    return maus;
  });
  ok('nenhuma peça transborda a folha', trans.length === 0, trans.join(' · '));

  console.log('\npiso do ícone');
  const NOMES = [
    ['Paróquia São Sebastião', 'nome de duas linhas'],
    ['Ginásio Central', 'nome de uma linha']
  ];
  for (const [nome, desc] of NOMES) {
    await p.fill('#f-nome', nome);
    for (const n of [3, 8, 10]) {
      await p.evaluate(k => {
        S.precisa = ['agua', 'alimento', 'formula', 'racao', 'limpeza', 'alvejante',
          'balde', 'vassoura', 'higiene', 'sabao'].slice(0, k);
        salvar();
      }, n);
      await p.waitForTimeout(250);
      const r = await p.evaluate(MM => {
        const peca = document.getElementById('peca-cartaz');
        const f = peca.querySelector('.folha');
        const k = parseFloat(getComputedStyle(f).getPropertyValue('--escala')) || 1;
        const s = [...peca.querySelectorAll('.grade-precisa .marca-item svg')];
        return {
          mostra: s.length,
          min: Math.min(...s.map(x => x.getBoundingClientRect().height)) / k / MM,
          aviso: /Só \d+ dos \d+ itens cabem/.test(peca.querySelector('p').textContent)
        };
      }, MM);
      /* O que se garante não é o número de itens — é o piso da marca. */
      ok(`${desc}, ${n} pedidos: marca ≥ 26 mm`, r.min >= 25.5, r.min.toFixed(1) + ' mm');
      ok(`${desc}, ${n} pedidos: mostra ${r.mostra} e avisa quando corta`,
        r.mostra === n ? !r.aviso : (r.aviso && r.mostra < n),
        `mostra ${r.mostra}, aviso ${r.aviso}`);
    }
  }
  await p.fill('#f-nome', CENTRO['#f-nome']);
  await p.waitForTimeout(250);

  console.log('\nmodo mono');
  await p.click('#b-mono');
  await p.waitForTimeout(300);
  const cores = await p.evaluate(() => {
    const maus = [];
    document.querySelectorAll('.folha *').forEach(el => {
      const cs = getComputedStyle(el);
      [cs.color, cs.fill, cs.backgroundColor, cs.borderTopColor].forEach(c => {
        const m = /rgba?\((\d+), ?(\d+), ?(\d+)/.exec(c || '');
        if (!m) return;
        const [r, g, bl] = [+m[1], +m[2], +m[3]];
        const cinza = Math.abs(r - g) < 12 && Math.abs(g - bl) < 12 && Math.abs(r - bl) < 12;
        if (!cinza) maus.push(`${el.closest('.peca').dataset.peca}: ${c}`);
      });
    });
    return [...new Set(maus)];
  });
  ok('em mono nada fica colorido', cores.length === 0, cores.slice(0, 4).join(' · '));
  await p.click('#b-mono');
  await p.waitForTimeout(200);

  console.log('\nmarcas de corte');
  const cortes = await p.evaluate(() =>
    ['panfleto', 'etiqueta', 'cartao', 'cracha', 'faixa'].map(id => ({
      id, n: document.querySelectorAll(`#peca-${id} .cortes i`).length
    })));
  cortes.forEach(c => ok(`${c.id} traz marcas de corte`, c.n > 0, 'nenhuma'));
  await p.click('#b-cortes');
  await p.waitForTimeout(200);
  const escondidas = await p.evaluate(() =>
    getComputedStyle(document.querySelector('#peca-panfleto .cortes')).display);
  ok('marcas de corte desligam', escondidas === 'none', escondidas);
  await p.click('#b-cortes');

  console.log('\nimposição');
  const imp = await p.evaluate(() => ({
    panfleto: document.querySelectorAll('#peca-panfleto .pf').length,
    cartao: document.querySelectorAll('#peca-cartao .cv').length,
    cracha: document.querySelectorAll('#peca-cracha .cr').length,
    faixa: document.querySelectorAll('#peca-faixa .fx').length,
    tiras: document.querySelectorAll('#peca-tiras .tira').length
  }));
  ok('panfleto 4-up', imp.panfleto === 4, String(imp.panfleto));
  ok('cartão de visita 10-up', imp.cartao === 10, String(imp.cartao));
  ok('crachá 8-up', imp.cracha === 8, String(imp.cracha));
  ok('faixa de braço 3-up', imp.faixa === 3, String(imp.faixa));
  ok('cartaz de tiras com 8 tiras', imp.tiras === 8, String(imp.tiras));

  console.log('\netiquetas: uma folha por cada dois itens');
  await p.evaluate(() => { S.precisa = ['agua', 'alimento', 'limpeza']; salvar(); montarForm(); });
  await p.waitForTimeout(250);
  const folhasEt = await p.evaluate(() => document.querySelectorAll('#peca-etiqueta .folha').length);
  ok('3 itens → 2 folhas de etiquetas', folhasEt === 2, String(folhasEt));

  console.log('\nitem livre');
  await p.fill('#f-livre', 'Ventilador');
  await p.click('#b-add-precisa');
  await p.waitForTimeout(250);
  const livre = await p.evaluate(() => ({
    aviso: !document.getElementById('aviso-livres').hidden,
    n: document.getElementById('n-livres').textContent,
    noCartaz: [...document.querySelectorAll('#peca-cartaz .grade-precisa .rot')].some(e => e.textContent === 'Ventilador')
  }));
  ok('item sem marca avisa', livre.aviso && livre.n === '1');
  ok('item sem marca continua a sair no cartaz', livre.noCartaz);

  console.log('\nQR');
  const qrs = await p.evaluate(() => ({
    com: document.querySelectorAll('.folha svg.qr').length,
    modulos: (document.querySelector('.folha svg.qr path').getAttribute('d').match(/M/g) || []).length
  }));
  ok('QR presente quando há link', qrs.com > 0, String(qrs.com));
  ok('QR tem módulos a sério', qrs.modulos > 80, String(qrs.modulos));
  await p.fill('#f-link', '');
  await p.waitForTimeout(250);
  const semQr = await p.evaluate(() => document.querySelectorAll('.folha svg.qr').length);
  ok('sem link não sobra caixa de QR vazia', semQr === 0, String(semQr));
  await p.fill('#f-link', CENTRO['#f-link']);
  await p.waitForTimeout(250);

  console.log('\nimagem para WhatsApp');
  for (const q of ['post', 'status']) {
    const r = await p.evaluate(async qual => {
      const cv = await desenharCanvas(qual);
      const c = cv.getContext('2d');
      const d = c.getImageData(0, 0, cv.width, cv.height).data;
      let tinta = 0;
      for (let i = 0; i < d.length; i += 4 * 37) if (d[i] < 200) tinta++;
      return { w: cv.width, h: cv.height, cobertura: tinta / (d.length / (4 * 37)) };
    }, q);
    ok(`${q} tem ${q === 'post' ? '1080×1350' : '1080×1920'}`,
      r.w === 1080 && r.h === (q === 'post' ? 1350 : 1920), `${r.w}×${r.h}`);
    /* Nem branco (não desenhou) nem escuro (fundo cheio gasta toner e é
       exactamente o que o sistema proíbe). */
    ok(`${q} tem conteúdo e não é um fundo cheio`,
      r.cobertura > 0.02 && r.cobertura < 0.4, (r.cobertura * 100).toFixed(1) + '%');
  }

  console.log('\nguardar no aparelho');
  const guardado = await p.evaluate(() => {
    const raw = localStorage.getItem('capem.kit');
    return raw ? JSON.parse(raw).nome : null;
  });
  ok('estado fica guardado', guardado === CENTRO['#f-nome'], String(guardado));

  await p.reload();
  await p.waitForTimeout(500);
  const voltou = await p.inputValue('#f-nome');
  ok('estado volta depois de recarregar', voltou === CENTRO['#f-nome'], voltou);

  console.log('\nimpressão');
  await p.evaluate(() => { window.print = () => {}; imprimir('cartaz'); });
  const css = await p.evaluate(() => {
    const el = document.getElementById('pagina-css');
    return el ? el.textContent : '';
  });
  ok('o tamanho da página é escrito antes de imprimir', /size: 210mm 297mm/.test(css), css);
  await p.evaluate(() => { window.print = () => {}; imprimir('mesa'); });
  const css2 = await p.evaluate(() => document.getElementById('pagina-css').textContent);
  ok('A4 paisagem sai como paisagem', /size: 297mm 210mm/.test(css2), css2);

  console.log('\nsem erros de JavaScript');
  ok('nenhum erro na consola', erros.length === 0, erros.slice(0, 3).join(' | '));

  await b.close();
  console.log(`\n${passou} passaram · ${falhou} falharam\n`);
  process.exit(falhou ? 1 : 0);
})();
