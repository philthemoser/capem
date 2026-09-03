#!/usr/bin/env node
/* ============================================================================
 * A GOTEIRA
 *
 * Todas as páginas servidas têm de afastar o conteúdo da beira do ecrã pela
 * mesma distância. Parece cosmético e não é: as duas páginas que um
 * coordenador mais abre ao telemóvel — `/atualizar` e `/pedir-codigo` —
 * estiveram encostadas à borda porque a goteira era posta classe a classe e a
 * classe delas nunca a recebeu. Não havia como isso ser apanhado: cada página
 * estava certa em relação a si própria.
 *
 * Este teste mede o mesmo elemento em todas as páginas e compara-as umas com
 * as outras. É o único ângulo de onde o erro se vê.
 *
 * Correr: node tools/goteira.js
 * ==========================================================================*/
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const EXE = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
/* ---------------------------------------------------------------------------
 * A crase dentro do CSS.
 *
 * A folha de estilos vive num template literal em `pagina.js`. Uma crase num
 * comentário lá dentro fecha o literal e o servidor deixa de arrancar — com um
 * erro que aponta para o comentário e não diz porquê. Aconteceu quatro vezes,
 * sempre a escrever um comentário sobre um selector.
 *
 * Custa três linhas verificar e poupa a quinta.
 * -------------------------------------------------------------------------*/
function crasesNoCss() {
  const fonte = fs.readFileSync(path.join(__dirname, '..', 'server', 'pagina.js'), 'utf8');
  const i = fonte.indexOf('const CSS = ' + '`');
  if (i < 0) return ['não encontrei o bloco CSS em pagina.js'];
  const corpo = fonte.slice(i + 13, fonte.indexOf('\n`;', i));
  const linhas = [];
  corpo.split('\n').forEach((l, n) => {
    if (l.includes('`') || l.includes('${')) linhas.push(`  linha ${n + 1}: ${l.trim().slice(0, 70)}`);
  });
  return linhas;
}

/* ---------------------------------------------------------------------------
 * A ORDEM DO :hover E DO :active.
 *
 * `.btn:hover` e `.btn:active` têm a mesma especificidade e, com rato, acertam
 * os dois no mesmo elemento durante uma pressão — quem carrega está também por
 * cima. Ganha a última que estiver escrita na folha. Com o :active escrito
 * primeiro, carregar não mexia nada: o botão só se levantava ao passar o rato,
 * e a animação parecia estar no sítio errado. É a velha ordem LVHA.
 *
 * Porque é que isto precisa de um teste em vez de um comentário: num telemóvel
 * não há :hover, portanto quem escreve a regra ao telemóvel vê a pressão a
 * funcionar e não vê erro nenhum. O erro só existe para quem tem rato, que é
 * quase sempre outra pessoa. Um browser também não ajuda aqui — a folha está
 * certa em relação a si própria; o que está errado é a ordem.
 *
 * A regra: qualquer regra de :hover que mexa no `transform` tem de vir ANTES
 * da regra de :active do mesmo elemento. A excepção escrita é `:hover:not(
 * :active)`, que já diz explicitamente que não se aplica durante a pressão e
 * por isso pode vir depois — é assim que o bloco do prefers-reduced-motion
 * apaga o levantar sem apagar o carregar.
 * -------------------------------------------------------------------------*/
function ordemDoPressionar() {
  /* Os comentários saem primeiro. Sem isto, o selector apanhado é o comentário
     que está por cima dele mais o selector, e nenhuma regra é reconhecida — o
     teste passava sempre, que é a única maneira de um teste destes ser pior do
     que não existir. */
  const fonte = fs.readFileSync(path.join(__dirname, '..', 'server', 'pagina.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
  /* Cada regra: o selector e o corpo entre chavetas. As regras dentro de um
     @media entram na mesma, porque o corpo delas não tem chavetas e é o
     interior que casa primeiro. */
  const regras = [...fonte.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(m => ({ sel: m[1].trim().replace(/\s+/g, ' '), corpo: m[2], em: m.index }));
  const queixas = [];
  for (const alvo of ['.btn', '.porta']) {
    const doAlvo = s => s.split(',').some(p => p.trim().startsWith(alvo + ':'));

    const activo = regras.find(r => doAlvo(r.sel) && /:active/.test(r.sel) && /transform:/.test(r.corpo));
    if (!activo) { queixas.push(`  ${alvo}: não há regra :active com transform — o botão não desce ao ser carregado.`); continue; }

    regras.filter(r => doAlvo(r.sel) && /:hover/.test(r.sel) && !/:hover:not\(:active\)/.test(r.sel))
      .filter(r => /transform:/.test(r.corpo) && r.em > activo.em)
      .forEach(r => queixas.push(
        `  ${alvo}: "${r.sel}" mexe no transform e está escrita DEPOIS de "${activo.sel}".\n` +
        '     Com rato, ganha esta, e a pressão fica invisível. Mova-a para cima\n' +
        '     do :active, ou escreva-a como :hover:not(:active).'));
  }
  return queixas;
}


/* Antes de `require`, e não dentro do teste: se houver uma crase, `pagina.js`
   nem chega a compilar, e um teste que não arranca não explica nada. */
{
  const mas = crasesNoCss();
  if (mas.length) {
    console.log('FALHA — crase ou interpolação dentro do CSS de pagina.js.');
    console.log('Fecha o template literal e o servidor deixa de arrancar.');
    console.log('Escreva o selector sem crases:\n');
    mas.forEach(l => console.log(l));
    process.exit(1);
  }
  const ordem = ordemDoPressionar();
  if (ordem.length) {
    console.log('FALHA — o :hover está a tapar o :active.\n');
    ordem.forEach(l => console.log(l));
    process.exit(1);
  }
}

process.env.CAPEM_ADMIN = 'goteira-'.repeat(2) + 'abcdefgh';
process.env.CAPEM_BASE = '';
const S = require(path.join(__dirname, '..', 'server', 'server.js'));

const LARGURA = 390;

(async () => {
  const ficheiro = path.join(os.tmpdir(), `capem-goteira-${Date.now()}.db`);
  S.db.abrir(ficheiro);
  S.db.criar('canoas-ss', { nome: 'Paróquia São Sebastião', tipo: 'Ponto de arrecadação',
    endereco: 'R. Bento Gonçalves, 412 — Canoas/RS', contato: '(51) 99612-0044',
    horario: '8h às 20h', precisa: ['agua', 'cobertor'], naoTraga: ['roupa-usada'] });
  S.db.decidir('canoas-ss', 'aprovado');
  S.db.publicar('canoas-ss', S.db.ler('canoas-ss').dados);
  const codigo = S.db.novoCodigoPara('canoas-ss');

  const servidor = S.criarServidor();
  await new Promise(r => servidor.listen(0, r));
  const base = `http://127.0.0.1:${servidor.address().port}`;

  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: LARGURA, height: 900 } });

  const PAGINAS = [
    ['entrada', '/'], ['lista', '/centros'], ['meu centro', '/centro'],
    ['pedir página', '/novo'], ['atualizar', '/atualizar'],
    ['pedir código', '/pedir-codigo'], ['página do centro', '/canoas-ss'],
    ['fila', '/admin?t=' + encodeURIComponent(process.env.CAPEM_ADMIN)],
    ['lista aberta', null]
  ];

  /* ---------------------------------------------------------------------------
   * A SOMBRA QUE ENCOSTA AO VIZINHO.
   *
   * Um botão tem 2 px de moldura e 5 px de sombra da mesma tinta; uma porta tem
   * 3 e 5. Em baixo são sete ou oito pixels de preto seguidos. Se o espaço até
   * ao objecto seguinte for menor do que isso, o olho junta as duas coisas numa
   * barra e a sombra deixa de pertencer ao seu próprio botão — foi o que se viu
   * nas portas do /centro com 14 px de intervalo, e nos dois botões de "como
   * chegar" com 10 px.
   *
   * Isto não se vê a olhar para uma página: cada uma está certa em relação a si
   * própria, e o intervalo foi escolhido antes de existir sombra. Vê-se a medir
   * o papel que sobra DEPOIS de descontar a sombra, que é o que esta função faz
   * — nas duas direcções, porque em ecrã largo as coisas ficam lado a lado e a
   * sombra vai para a direita.
   *
   * O mínimo é 12 px de papel. Não é um número sagrado: é mais do que a barra
   * preta tem de altura, e foi o que resolveu os dois casos reais.
   * -------------------------------------------------------------------------*/
  const PAPEL_MINIMO = 12;
  /* Corre dentro do browser, por isso recebe o mínimo em vez de o fechar: o que
     Playwright leva para lá é o texto da função, sem o que estava à volta. */
  function vizinhosApertados(minimo) {
    const sombra = e => {
      const m = getComputedStyle(e).boxShadow.match(/(-?\d+(?:\.\d+)?)px (-?\d+(?:\.\d+)?)px/);
      return m ? { x: +m[1], y: +m[2] } : null;
    };
    const alvos = [...document.querySelectorAll('.btn,.porta')].filter(e => e.offsetParent !== null);
    const queixas = [];
    for (const a of alvos) {
      const s = sombra(a);
      if (!s || (!s.x && !s.y)) continue;          /* sem sombra, sem problema */
      const ra = a.getBoundingClientRect();
      for (const c of alvos) {
        if (c === a) continue;
        const rc = c.getBoundingClientRect();
        const cruzaX = Math.max(ra.left, rc.left) < Math.min(ra.right, rc.right);
        const cruzaY = Math.max(ra.top, rc.top) < Math.min(ra.bottom, rc.bottom);
        const nome = (t, papel) => `${t} ${Math.round(papel)} px de papel · ` +
          `${a.className.trim()} → ${c.className.trim()}`;
        if (rc.top >= ra.bottom - 1 && cruzaX && rc.top - ra.bottom - s.y < minimo)
          queixas.push(nome('por baixo:', rc.top - ra.bottom - s.y));
        if (rc.left >= ra.right - 1 && cruzaY && rc.left - ra.right - s.x < minimo)
          queixas.push(nome('à direita:', rc.left - ra.right - s.x));
      }
    }
    return queixas;
  }

  const apertados = [];
  const medidas = [];
  for (const [nome, u] of PAGINAS) {
    if (u) {
      await page.goto(base + u, { waitUntil: 'load' });
    } else {
      await page.goto(base + '/atualizar', { waitUntil: 'load' });
      await page.fill('#slug', 'canoas-ss');
      await page.fill('#codigo', codigo);
      await Promise.all([page.waitForLoadState('load'), page.click('button[type=submit]')]);
    }
    apertados.push(...(await page.evaluate(vizinhosApertados, PAPEL_MINIMO))
      .map(t => `  ${LARGURA} px · ${nome}: ${t}`));
    medidas.push({ nome, ...await page.evaluate(() => {
      const L = e => (e ? Math.round(e.getBoundingClientRect().left) : null);
      return {
        h1: L(document.querySelector('main h1')),
        texto: L(document.querySelector('main p')),
        /* O primeiro campo que NÃO está dentro de um cartão.
           A goteira é a distância da beira do ecrã ao conteúdo da PÁGINA. Um
           campo dentro de um cartão está afastado pela margem do cartão, e isso
           é igual em todos os cartões de todas as páginas — medi-lo aqui não
           dizia nada sobre a goteira e dizia 43 em vez de 20 assim que uma
           página pusesse um formulário dentro de um. Foi o que aconteceu quando
           a entrada do coordenador passou para dentro das portas do /centro.
           Sem nenhum campo solto, fica `null`, que este teste já tolera — as
           medidas do h1 e do primeiro parágrafo continuam a guardar a porta. */
        campo: L([...document.querySelectorAll('main input:not([type=hidden]),main textarea')]
          .find(e => !e.closest('.porta, .pedido, .sacola, .achado')) || null)
      };
    }) });
  }
  /* Segunda passagem, num ecrã largo. Metade destes pares só existe aí: o
     "como chegar" e o "ligar" ficam lado a lado a partir dos 520 px, e a sombra
     passa a ir contra o vizinho da direita em vez de contra o de baixo. Num
     telemóvel estão empilhados e o problema não aparece. */
  const LARGA = 900;
  const larga = await browser.newPage({ viewport: { width: LARGA, height: 1200 } });
  for (const [nome, u] of PAGINAS) {
    if (!u) continue;                     /* a lista aberta precisa de entrar, e a
                                             medida do vizinho não depende dela */
    await larga.goto(base + u, { waitUntil: 'load' });
    apertados.push(...(await larga.evaluate(vizinhosApertados, PAPEL_MINIMO))
      .map(t => `  ${LARGA} px · ${nome}: ${t}`));
  }
  await larga.close();

  await browser.close();
  servidor.close();
  try { fs.unlinkSync(ficheiro); } catch { /* já não existe */ }

  if (apertados.length) {
    console.log('FALHA — uma sombra encosta ao objecto seguinte.\n');
    [...new Set(apertados)].forEach(l => console.log(l));
    console.log(`\n  Menos de ${PAPEL_MINIMO} px de papel entre a ponta da sombra e o vizinho.`);
    console.log('  Aumente o intervalo do contentor — a sombra ocupa 5 px do que lá estava.');
    process.exit(1);
  }

  const valores = medidas.flatMap(m => [m.h1, m.texto, m.campo].filter(v => v !== null));
  const distintos = [...new Set(valores)];
  if (distintos.length === 1) {
    console.log(`PASS — as ${medidas.length} páginas afastam-se ${distintos[0]} px da beira, todas iguais;`
      + ' nenhuma sombra encosta ao vizinho');
    process.exit(0);
  }
  console.log('FALHA — a goteira não é a mesma em todas as páginas:\n');
  medidas.forEach(m => console.log(
    `  ${m.nome.padEnd(18)} h1:${String(m.h1).padStart(4)}  texto:${String(m.texto).padStart(4)}  campo:${String(m.campo).padStart(4)}`));
  console.log(`\n  valores distintos: ${distintos.join(', ')}`);
  console.log('  Uma página nova escolhe entre os dois modelos do topo do CSS:');
  console.log('  com goteira (nada a fazer) ou main.faixas (cada faixa põe a sua).');
  process.exit(1);
})();
