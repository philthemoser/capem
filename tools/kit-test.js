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
  ok('29 marcas', ic.n === 29, `são ${ic.n}`);
  ok('ids únicos', ic.unicos === ic.n);
  ok('nenhum caminho vazio', ic.vazios.length === 0, ic.vazios.join(','));
  ok('todos os caminhos são SVG válido', ic.maus.length === 0, ic.maus.join(','));
  ok('16 necessidades · 4 recusas · 9 utilitárias',
    ic.cats.need === 16 && ic.cats.refuse === 4 && ic.cats.util === 9, JSON.stringify(ic.cats));

  const semMarca = await p.evaluate(() =>
    GRUPOS.flatMap(g => g.ids).filter(id => !POR_ID[id]));
  ok('todo o catálogo tem marca própria', semMarca.length === 0, semMarca.join(','));

  console.log('\npreencher');
  for (const [sel, v] of Object.entries(CENTRO)) await p.fill(sel, v);
  for (const id of ['formula', 'fralda', 'alvejante', 'balde']) await p.click(`[data-tog="${id}"]`);
  await p.waitForTimeout(400);

  const pecas = await p.$$eval('.peca', els => els.map(e => e.dataset.peca));
  ok('15 peças', pecas.length === 15, pecas.join(' '));
  ok('a folha de instruções vem primeiro', pecas[0] === 'instrucoes', pecas[0]);

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
    /* A galeria esconde as folhas 2..n de uma peça multi-folha. Elas são
       impressas na mesma, e numa etiqueta cada folha traz itens diferentes
       com rótulos de comprimentos diferentes — por isso o teste revela-as
       todas antes de medir, senão passa a verificar só a primeira. */
    const escondidas = [...document.querySelectorAll('.moldura .folha-wrap:not(:first-child)')];
    escondidas.forEach(w => { w.style.display = 'block'; });
    document.querySelectorAll('.folha').forEach(f => {
      const id = f.closest('.peca').dataset.peca;
      /* 2 px de folga: sub-píxel de arredondamento não é transbordo. */
      if (f.scrollWidth > f.clientWidth + 2 || f.scrollHeight > f.clientHeight + 2) {
        maus.push(`${id} ${f.scrollWidth}×${f.scrollHeight} > ${f.clientWidth}×${f.clientHeight}`);
      }
    });
    escondidas.forEach(w => { w.style.display = ''; });
    return maus;
  });
  ok('nenhuma peça transborda a folha', trans.length === 0, trans.join(' · '));

  /* Dez etiquetas de caixa são cinco folhas. Todas têm de estar no DOM, porque
     todas saem na impressão; só uma pode aparecer no ecrã, senão a galeria vira
     um rolo de dois metros feito da mesma folha com outro item.

     `visiveis` conta pelo estilo COMPUTADO. A versão anterior procurava
     `style*="none"` no atributo — e como a regra que as esconde vive na folha
     de estilos e não em atributos, essa contagem dava sempre o total e nunca
     podia falhar. Um teste que não podia falhar não estava a verificar nada.

     Quantas folhas são passou a estar na linha do formato ("· 2 folhas"): a
     nota que vivia dentro da moldura dava-lhe alturas diferentes conforme a
     peça, e era o mesmo facto a custar geometria. */
  const multi = await p.evaluate(() => ({
    visiveis: [...document.querySelectorAll('#peca-etiqueta .folha-wrap')]
      .filter(w => getComputedStyle(w).display !== 'none').length,
    total: document.querySelectorAll('#peca-etiqueta .folha-wrap').length,
    fmt: (document.querySelector('#peca-etiqueta .fmt') || {}).textContent || ''
  }));
  ok('uma peça multi-folha tem todas as folhas no DOM', multi.total > 1, JSON.stringify(multi));
  ok('mas mostra uma só no ecrã', multi.visiveis === 1, JSON.stringify(multi));
  ok('e diz quantas são na linha do formato', /\d+ folhas/.test(multi.fmt), multi.fmt);

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

  console.log('\narranque');
  const boot = await p.evaluate(() => ({
    /* O aviso está no HTML e o script apaga-o. Se ainda estiver aqui depois de
       tudo carregar, o script não arrancou. */
    avisoApagado: !document.getElementById('sem-js'),
    /* O script tem de vir antes das fontes no ficheiro: um visualizador que
       corte o fim fica sem tipografia e continua a gerar peças. */
    scriptAntesDasFontes: true
  }));
  ok('o aviso de arranque desaparece quando o script corre', boot.avisoApagado);

  const ordem = require('fs').readFileSync(
    require('path').resolve(__dirname, '..', 'field', 'kit.html'), 'utf8');
  ok('o script vem antes das fontes embutidas',
    ordem.indexOf('<script defer>') < ordem.indexOf('@font-face'),
    `script @${ordem.indexOf('<script defer>')}, fontes @${ordem.indexOf('@font-face')}`);
  /* 15% em vez dos 69% que eram antes de o script subir para o cabeçalho. */
  const posJs = ordem.indexOf('<script defer>') / ordem.length;
  ok('o script está no primeiro quinto do ficheiro', posJs < 0.2, (posJs * 100).toFixed(0) + '%');

  const escondido = await p.evaluate(() => {
    /* Uma regra de display a ganhar ao atributo hidden deixa um elemento
       invisível a apanhar todos os toques. Já aconteceu neste projecto. */
    const maus = [];
    document.querySelectorAll('[hidden]').forEach(el => {
      if (getComputedStyle(el).display !== 'none') maus.push(el.id || el.className);
    });
    return maus;
  });
  ok('nada com [hidden] fica visível', escondido.length === 0, escondido.join(','));

  console.log('\nmarcas para itens escritos à mão');
  await p.fill('#f-livre', 'Luva de borracha');
  await p.click('#b-add-precisa');
  await p.waitForTimeout(300);
  const antes = await p.evaluate(() => {
    const li = [...document.querySelectorAll('#lista-precisa li')].pop();
    return { generico: li.classList.contains('generico'),
             marca: li.querySelector('svg path').getAttribute('d') === POR_ID.caixa.d,
             botao: li.querySelector('.marca').textContent.trim() };
  });
  ok('item escrito à mão começa com a caixa genérica', antes.generico && antes.marca);
  ok('e o botão pergunta pela marca', antes.botao === 'marca?', antes.botao);

  await p.click('#lista-precisa li:last-child .marca');
  await p.waitForTimeout(300);
  const modal = await p.evaluate(() => ({
    aberto: !document.getElementById('modal-marca').hidden,
    opcoes: document.querySelectorAll('#grade-marcas .marca-op').length
  }));
  ok('abre a lista de marcas', modal.aberto);
  ok('com as 29 marcas todas', modal.opcoes === 29, String(modal.opcoes));

  await p.click('#grade-marcas [data-pick="botas"]');
  await p.waitForTimeout(350);

  const escolhido = await p.evaluate(() => {
    const li = [...document.querySelectorAll('#lista-precisa li')].pop();
    return {
      fechou: document.getElementById('modal-marca').hidden,
      jaNaoGenerico: !li.classList.contains('generico'),
      rotulo: li.querySelector('span').textContent.trim()
    };
  });
  ok('escolher uma marca fecha a lista', escolhido.fechou);
  ok('e o item deixa de estar marcado como genérico',
    escolhido.jaNaoGenerico && escolhido.rotulo === 'Luva de borracha', JSON.stringify(escolhido));

  /* Põe o item escrito à mão em primeiro antes de o procurar no cartaz. O
     piso da marca corta os últimos da lista quando há QR no rodapé — procurá-lo
     no fim seria testar o piso, não a marca escolhida. */
  await p.evaluate(() => {
    const i = S.precisa.findIndex(v => v && v.texto === 'Luva de borracha');
    S.precisa.unshift(S.precisa.splice(i, 1)[0]);
    salvar(); montarForm();
  });
  await p.waitForTimeout(350);

  const noPapel = await p.evaluate(() => {
    const m = [...document.querySelectorAll('#peca-cartaz .grade-precisa .marca-item')]
      .find(x => x.querySelector('.rot').textContent === 'Luva de borracha');
    return {
      achou: !!m,
      certa: !!m && m.querySelector('svg path').getAttribute('d') === POR_ID.botas.d,
      rotulos: [...document.querySelectorAll('#peca-cartaz .grade-precisa .rot')].map(e => e.textContent)
    };
  });
  ok('e a marca escolhida sai no cartaz', noPapel.achou && noPapel.certa, JSON.stringify(noPapel));

  const indice = await p.evaluate(() => ({
    n: document.querySelectorAll('#indice-marcas .marca-op').length,
    conta: document.getElementById('conta-marcas').textContent
  }));
  ok('o índice mostra as 29 marcas', indice.n === 29 && indice.conta === '29', JSON.stringify(indice));

  await p.evaluate(() => { S.precisa = S.precisa.filter(v => typeof v === 'string'); salvar(); montarForm(); });
  await p.waitForTimeout(300);

  /* =========================================================================
   * A MOLDURA: BARRA, TRILHO E CABEÇALHO
   *
   * O kit era a única página com um cabeçalho seu — branco sobre preto, colado
   * por baixo da barra — e sem trilho de migalhas. Duas faixas escuras
   * empilhadas, e nenhuma pista de onde se está.
   *
   * A parte que interessa não é o trilho existir: é ele DESAPARECER quando
   * isto foi aberto de um pen drive ou de um anexo, onde "Início" não leva a
   * lugar nenhum. Um link morto num ginásio é pior do que link nenhum. Este
   * teste corre de file://, que é exactamente esse caso.
   * =======================================================================*/
  console.log('\nbarra, trilho e cabeçalho');
  ok('o trilho de migalhas existe no documento',
    await p.$('#migalhas') !== null);
  ok('mas some quando isto não veio de um servidor',
    await p.evaluate(() => document.getElementById('migalhas').hidden));
  ok('a barra some pelo mesmo motivo, e ao mesmo tempo',
    await p.evaluate(() => document.getElementById('nav-topo').hidden));
  ok('o trilho diz o caminho todo, e o fim não é link',
    await p.evaluate(() => {
      const m = document.getElementById('migalhas');
      const links = [...m.querySelectorAll('a')].map(a => a.getAttribute('href'));
      return links.join(',') === '/,/centro' && !!m.querySelector('b');
    }));

  /* O cabeçalho passou a ser o mesmo das páginas do servidor: papel, não
     tinta. Se alguém o voltar a pintar de escuro, isto falha. */
  ok('o cabeçalho é claro, como o das outras páginas',
    await p.evaluate(() => {
      const c = getComputedStyle(document.querySelector('header.topo'));
      const m = c.backgroundColor.match(/\d+/g).map(Number);
      return m[0] > 200 && m[1] > 200 && m[2] > 200;
    }));

  /* As regras de .migalhas são uma cópia das do servidor — o kit não pode ir
     buscar a folha de lá sem deixar de abrir de uma pen. Uma cópia que ninguém
     compara é uma cópia que diverge. */
  {
    const doServidor = require('../server/pagina.js').CSS;
    const doKit = require('fs').readFileSync(
      path.join(__dirname, '..', 'field', 'src', 'kit.css'), 'utf8');
    const regras = t => (t.match(/\.migalhas[^{]*\{[^}]*\}/g) || [])
      .map(r => r.replace(/\s+/g, ' ').trim()).sort();
    const a = regras(doServidor), b = regras(doKit);
    ok('a cópia do trilho no kit tem as mesmas regras que a do servidor',
      a.length > 0 && a.length === b.length, `servidor ${a.length}, kit ${b.length}`);
  }

  console.log('\nendereço para publicar');
  /* Este ficheiro é aberto de uma pen, de um anexo, do GitHub Pages — sítios
     que não são o servidor. O endereço da página é a única coisa que o
     coordenador tem sempre: está impresso no rodapé do cartaz.
     Aqui a página corre de file://, por isso testa-se o que não depende da
     origem; o caso do nome sozinho está coberto pelo teste ponta-a-ponta,
     que corre servido pelo servidor. */
  const casos = [
    ['capem.org/canoas-ss', 'https://capem.org', 'canoas-ss'],
    ['https://capem.org/canoas-ss', 'https://capem.org', 'canoas-ss'],
    ['http://localhost:8080/canoas-ss', 'http://localhost:8080', 'canoas-ss'],
    ['canoas-ss.capem.org', 'https://capem.org', 'canoas-ss'],
    ['CAPEM.org/Canoas-SS', 'https://capem.org', 'canoas-ss'],
    ['capem.org/a/b/canoas-ss', 'https://capem.org', 'canoas-ss']
  ];
  for (const [entrada, base, slug] of casos) {
    const got = await p.evaluate(v => { S.slug = v; return alvoPublicacao(); }, entrada);
    ok(`"${entrada}" → ${base}/${slug}`,
      !!got && got.base === base && got.slug === slug, JSON.stringify(got));
  }
  /* Servido de file://, "canoas-ss" sozinho não tem servidor nenhum — e não
     pode inventar um, senão publicava para um sítio errado em silêncio. */
  for (const mau of ['canoas-ss', '', '   ', '???']) {
    const got = await p.evaluate(v => { S.slug = v; return alvoPublicacao(); }, mau);
    ok(`"${mau || '(vazio)'}" sem servidor não inventa um`, got === null, JSON.stringify(got));
  }
  await p.evaluate(() => { S.slug = ''; salvar(); });

  console.log('\ncarimbo de data');
  const hoje = await p.evaluate(() => dataCurta());
  const carimbos = await p.evaluate(() => {
    /* As peças que envelhecem numa parede têm de dizer de quando é a lista.
       As que não envelhecem — etiqueta, crachá, guião — não devem ter data,
       ou passam a parecer velhas sem o ser. */
    const querem = ['cartaz', 'placa', 'panfleto', 'tiras', 'mesa', 'wa-post', 'wa-status', 'instrucoes'];
    const naoQuerem = ['etiqueta', 'cracha', 'faixa', 'guiao', 'seta', 'horario', 'cartao'];
    return {
      faltam: querem.filter(id => !document.querySelector(`#peca-${id} .carimbo`)),
      aMais: naoQuerem.filter(id => document.querySelector(`#peca-${id} .carimbo`))
    };
  });
  ok('as peças que envelhecem levam a data', carimbos.faltam.length === 0, carimbos.faltam.join(','));
  ok('as que não envelhecem não levam data', carimbos.aMais.length === 0, carimbos.aMais.join(','));
  const txtCarimbo = await p.$eval('#peca-cartaz .carimbo', e => e.textContent);
  ok('a data é a de hoje', txtCarimbo.includes(hoje), txtCarimbo);

  console.log('\nnão estamos recebendo');
  await p.click('#f-pausado');
  await p.waitForTimeout(350);
  const pausa = await p.evaluate(() => ({
    banda: !!document.querySelector('#peca-cartaz .sec-pausa'),
    semLista: !document.querySelector('#peca-cartaz .grade-precisa'),
    /* O "não traga" continua: é a mensagem que mais interessa quando o
       centro está cheio. */
    comNao: !!document.querySelector('#peca-cartaz .sec-nao'),
    motivo: document.getElementById('linha-motivo').hidden === false,
    /* O visto verde no cabeçalho ao lado de "não estamos recebendo" seria uma
       contradição na mesma folha. Quando pausa, a marca do horário troca. */
    marcaCerta: document.querySelector('#peca-cartaz .horas svg path').getAttribute('d') === POR_ID.fechado.d
  }));
  ok('o cartaz passa a dizer que não está recebendo', pausa.banda && pausa.semLista);
  ok('mas mantém o "não traga"', pausa.comNao);
  ok('e pede o motivo', pausa.motivo);
  ok('e o cabeçalho deixa de mostrar o visto', pausa.marcaCerta);
  await p.click('#f-pausado');
  await p.waitForTimeout(300);
  const voltouLista = await p.evaluate(() => !!document.querySelector('#peca-cartaz .grade-precisa'));
  ok('desligar a pausa devolve a lista', voltouLista);

  console.log('\nconjunto inicial');
  const conj = await p.evaluate(() => {
    window.print = () => {};
    document.getElementById('b-conjunto').click();
    const n = document.querySelectorAll('.peca.a-imprimir').length;
    const css = document.getElementById('pagina-css').textContent;
    document.body.classList.remove('imprimindo');
    return { n, css, ids: CONJUNTO_INICIAL };
  });
  ok('o conjunto inicial imprime 4 peças de uma vez', conj.n === 4, String(conj.n));
  ok('todas em A4 retrato', /size: 210mm 297mm/.test(conj.css), conj.css);
  /* Um trabalho de impressão só tem um tamanho de página: se alguém juntar
     ao conjunto uma peça paisagem, sai cortada. */
  const mistura = await p.evaluate(ids => {
    const p0 = PECAS.find(x => x.id === ids[0]);
    return ids.every(id => {
      const pc = PECAS.find(x => x.id === id);
      return pc.w === p0.w && pc.h === p0.h;
    });
  }, conj.ids);
  ok('o conjunto não mistura tamanhos de papel', mistura);

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
