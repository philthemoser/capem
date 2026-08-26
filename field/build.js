#!/usr/bin/env node
/* Monta field/cartaz.html a partir de field/src/.
 * Reaproveita o codificador de QR já verificado do protótipo, em vez de
 * manter uma segunda cópia que pode divergir. Sem dependências. */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'src');
const qr = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', '05-qr.js'), 'utf8');
const css = fs.readFileSync(path.join(src, 'cartaz.css'), 'utf8');
const js = fs.readFileSync(path.join(src, 'cartaz.js'), 'utf8');
const tpl = fs.readFileSync(path.join(src, 'cartaz.template.html'), 'utf8');

// O codificador usa esc() para o aria-label; cartaz.js define o seu próprio.
const bundle = `/* ==== QR (de src/js/05-qr.js) ==== */\n${qr}\n\n/* ==== cartaz ==== */\n${js}`;

const out = tpl.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => bundle);
const dest = path.join(__dirname, 'cartaz.html');
fs.writeFileSync(dest, out);
console.log(`field/cartaz.html  ${(Buffer.byteLength(out) / 1024).toFixed(1)} KB`);
