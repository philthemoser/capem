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
    medidas.push({ nome, ...await page.evaluate(() => {
      const L = e => (e ? Math.round(e.getBoundingClientRect().left) : null);
      return {
        h1: L(document.querySelector('main h1')),
        texto: L(document.querySelector('main p')),
        campo: L(document.querySelector('main input:not([type=hidden]),main textarea'))
      };
    }) });
  }
  await browser.close();
  servidor.close();
  try { fs.unlinkSync(ficheiro); } catch { /* já não existe */ }

  const valores = medidas.flatMap(m => [m.h1, m.texto, m.campo].filter(v => v !== null));
  const distintos = [...new Set(valores)];
  if (distintos.length === 1) {
    console.log(`PASS — as ${medidas.length} páginas afastam-se ${distintos[0]} px da beira, todas iguais`);
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
