#!/usr/bin/env node
/* ============================================================================
 * Build: src/ -> index.html
 *
 * Concatenation, nothing more. No dependencies, no transpiler, no bundler
 * config to rot. `node build.js` and you are done.
 *
 * Why a single output file: the people this is built for open it on a phone
 * with an unreliable connection, or from a USB stick in a building with no
 * connection at all. One self-contained file works in both cases and in
 * fifteen years' time. Source stays split so it can be read and reviewed.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const OUT = path.join(__dirname, 'index.html');

const template = fs.readFileSync(path.join(SRC, 'index.template.html'), 'utf8');
const styles = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8');

// Files load in filename order; the numeric prefixes are the dependency order.
const jsDir = path.join(SRC, 'js');
const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).sort();

const scripts = jsFiles.map(f => {
  const body = fs.readFileSync(path.join(jsDir, f), 'utf8');
  return `\n/* ==== src/js/${f} ${'='.repeat(Math.max(0, 60 - f.length))} */\n${body}`;
}).join('\n');

const html = template
  .replace('/*__STYLES__*/', () => styles)
  .replace('/*__SCRIPTS__*/', () => scripts);

fs.writeFileSync(OUT, html);

const kb = n => (n / 1024).toFixed(1) + ' KB';
console.log(`built index.html  ${kb(Buffer.byteLength(html))}`);
console.log(`  styles          ${kb(Buffer.byteLength(styles))}`);
jsFiles.forEach(f => {
  console.log(`  ${f.padEnd(16)}${kb(fs.statSync(path.join(jsDir, f)).size)}`);
});
