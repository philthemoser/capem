#!/usr/bin/env node
/* ============================================================================
 * GERA O MAPA. Corre-se à mão, quase nunca.
 *
 * Le um GeoJSON dos estados do Brasil e escreve `server/mapa.js`: um punhado de
 * caminhos SVG já projectados, prontos a colar numa página. O ficheiro gerado
 * vai para o repositório e é ele que o servidor usa — ninguem vai buscar nada a
 * lado nenhum em tempo de execucao. Duas razoes, e as duas sao regras da casa:
 * dependencias zero, e nada sobre quem visita chega a um terceiro. Um mapa de
 * telhas (OpenStreetMap e afins) manda o IP de cada visitante para o servidor
 * das telhas, e isso desfazia a frase que esta no rodape de todas as paginas.
 *
 * FONTE: click_that_hood (Code for America), ficheiro brazil-states.geojson,
 * licenca MIT, derivado de dados publicos do IBGE.
 * https://github.com/codeforgermany/click_that_hood
 *
 * Correr:  node tools/mapa-gerar.js caminho/para/brazil-states.geojson
 * ==========================================================================*/
const fs = require('node:fs');
const path = require('node:path');

/* Equirectangular. Uma projeccao a serio nao se justifica: isto e um desenho
   para se reconhecer a forma do pais e ver onde estao os pontos, e a latitude
   media do Brasil (-15 graus) da um cosseno de 0,97 — o erro de esticar e
   menor do que a espessura do traco. */
const projectar = ([lon, lat]) => [lon, -lat];

/* ---------------------------------------------------------------------------
 * Douglas-Peucker num ANEL FECHADO, que nao e o mesmo que numa linha.
 *
 * O algoritmo mede cada ponto contra a recta que une o primeiro ao ultimo. Num
 * anel esses dois sao o MESMO ponto: a recta tem comprimento zero, todas as
 * distancias dao zero, e o estado inteiro simplifica para dois pontos. E um
 * erro silencioso — nao rebenta, devolve um desenho vazio. Aconteceu aqui.
 *
 * A volta e cortar o anel em dois arcos pelo ponto mais afastado do primeiro,
 * simplificar cada arco como linha aberta, e voltar a coser.
 * -------------------------------------------------------------------------*/
function simplificarAnel(anel, tol) {
  const pts = anel.slice(0, -1);                 /* fora o ponto de fecho repetido */
  if (pts.length < 4) return anel;
  let oposto = 0, dmax = -1;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]);
    if (d > dmax) { dmax = d; oposto = i; }
  }
  const a = simplificar(pts.slice(0, oposto + 1), tol);
  const b = simplificar(pts.slice(oposto).concat([pts[0]]), tol);
  return a.slice(0, -1).concat(b);
}

/* Douglas-Peucker numa linha aberta. Escrito aqui em vez de vir de um pacote
   pelo mesmo motivo de sempre; sao vinte linhas. */
function simplificar(pts, tol) {
  if (pts.length < 3) return pts;
  let pior = 0, dmax = 0;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const dx = bx - ax, dy = by - ay;
  const norma = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / norma;
    if (d > dmax) { dmax = d; pior = i; }
  }
  if (dmax <= tol) return [pts[0], pts[pts.length - 1]];
  return simplificar(pts.slice(0, pior + 1), tol)
    .slice(0, -1)
    .concat(simplificar(pts.slice(pior), tol));
}

/* Area do anel, para deitar fora ilhas que a esta escala sao um pixel sujo. */
const area = a => Math.abs(a.reduce((s, p, i) => {
  const q = a[(i + 1) % a.length];
  return s + (p[0] * q[1] - q[0] * p[1]);
}, 0) / 2);

const TOLERANCIA = 0.055;     /* graus. Escolhido a olho contra o tamanho do ficheiro. */
const AREA_MINIMA = 0.06;     /* graus quadrados: abaixo disto e uma ilha ou um erro. */

const origem = process.argv[2];
if (!origem) { console.error('uso: node tools/mapa-gerar.js <brazil-states.geojson>'); process.exit(1); }
const geo = JSON.parse(fs.readFileSync(origem, 'utf8'));

let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
const estados = geo.features.map(f => {
  const g = f.geometry;
  const poligonos = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const aneis = [];
  poligonos.forEach(pol => {
    /* Só o anel exterior. Os buracos de um estado sao outro estado, e como se
       desenham todos por cima uns dos outros o buraco fica preenchido a
       mesma. */
    const bruto = pol[0].map(projectar);
    if (area(bruto) < AREA_MINIMA) return;
    const s = simplificarAnel(bruto, TOLERANCIA);
    if (s.length < 4) return;
    aneis.push(s);
  });
  aneis.forEach(a => a.forEach(([x, y]) => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }));
  return { sigla: f.properties.sigla, nome: f.properties.name, aneis };
}).filter(e => e.aneis.length);

/* Do grau para a caixa do SVG. 1000 de largura; a altura sai da forma. */
const LARGURA = 1000;
const k = LARGURA / (maxX - minX);
const ALTURA = Math.round((maxY - minY) * k);
const px = ([x, y]) => [
  Math.round((x - minX) * k * 10) / 10,
  Math.round((y - minY) * k * 10) / 10
];

const caminho = aneis => aneis.map(a =>
  'M' + a.map((p, i) => px(p).join(' ') + (i ? '' : '')).join('L') + 'Z').join('');

const linhas = estados.map(e =>
  `  ['${e.sigla}', '${e.nome.replace(/'/g, "\\'")}', '${caminho(e.aneis)}'],`).join('\n');

const saida = `/* ============================================================================
 * O MAPA DO BRASIL — gerado, não escrito à mão.
 *
 * NÃO EDITAR. Sai de \`node tools/mapa-gerar.js\`, que documenta a fonte e a
 * licença. Os caminhos já estão projectados para a caixa abaixo, portanto
 * desenhar é pôr isto dentro de um <svg viewBox> e mais nada — sem projecção
 * em tempo de execução, sem telhas, sem pedido nenhum a terceiros.
 *
 * Fonte: click_that_hood (Code for America), brazil-states.geojson, licença
 * MIT, derivado de dados públicos do IBGE.
 * Gerado com tolerância ${TOLERANCIA} graus.
 * ==========================================================================*/
const CAIXA = { largura: ${LARGURA}, altura: ${ALTURA} };

/* Os limites em graus, que é o que transforma uma coordenada de um centro num
   ponto dentro desta caixa. */
const LIMITES = { oesteLon: ${minX}, norteLat: ${-minY}, k: ${Math.round(k * 1e6) / 1e6} };

/** Uma coordenada [lat, lon] para [x, y] dentro da caixa. Fora do Brasil devolve null. */
function ponto(lat, lon) {
  const x = (lon - LIMITES.oesteLon) * LIMITES.k;
  const y = (LIMITES.norteLat - lat) * LIMITES.k;
  if (!(x >= 0 && x <= CAIXA.largura && y >= 0 && y <= CAIXA.altura)) return null;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

const ESTADOS = [
${linhas}
];

module.exports = { CAIXA, ESTADOS, ponto };
`;

const destino = path.join(__dirname, '..', 'server', 'mapa.js');
fs.writeFileSync(destino, saida);
console.log(`server/mapa.js — ${estados.length} estados, ${(saida.length / 1024).toFixed(1)} kB, caixa ${LARGURA}x${ALTURA}`);
