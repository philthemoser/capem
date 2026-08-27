#!/usr/bin/env node
/* Monta field/kit.html a partir de field/src/.
 *
 * Sem dependências e sem passo de compilação: o resultado é um ficheiro que
 * se abre com duplo clique, funciona de uma pen e não precisa de rede. Isso
 * não é minimalismo por gosto — é o requisito de uma ferramenta que tem de
 * funcionar num prédio sem corrente.
 *
 * O codificador de QR vem do protótipo (src/js/05-qr.js) por inclusão e não
 * por cópia, para não haver duas versões a divergir. As fontes vêm embutidas
 * em base64: sem elas, offline, todo o sistema tipográfico desaparece.
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'src');
const ler = f => fs.readFileSync(path.join(src, f), 'utf8');

const qr = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', '05-qr.js'), 'utf8');
const fontes = ler('fonts.css');
const css = ler('kit.css');
const tpl = ler('kit.template.html');

const js = [
  ['QR (de src/js/05-qr.js)', qr],
  ['ícones', ler('icones.js')],
  ['catálogo', ler('catalogo.js')],
  ['kit', ler('kit.js')]
].map(([nome, corpo]) => `/* ==== ${nome} ==== */\n${corpo}`).join('\n\n');

const out = tpl
  .replace('/*__FONTS__*/', () => fontes)
  .replace('/*__CSS__*/', () => css)
  .replace('/*__JS__*/', () => js);

const dest = path.join(__dirname, 'kit.html');
fs.writeFileSync(dest, out);
console.log(`field/kit.html  ${(Buffer.byteLength(out) / 1024).toFixed(1)} KB`);
