/* Verifies that every t() key used in source exists in STRINGS, that every
 * STRINGS row has all three languages, and reports unused keys. */
const fs = require('fs');
const dir = __dirname + '/../src/js/';
eval(fs.readFileSync(dir + '00-i18n.js', 'utf8').replace('const STRINGS', 'globalThis.STRINGS'));

const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
const used = new Set(), prefixes = new Set();
for (const f of files) {
  const src = fs.readFileSync(dir + f, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*'([^']+)'\s*\)/g)) used.add(m[1]);
  for (const m of src.matchAll(/\bt\(\s*'([^']+)'\s*,/g)) used.add(m[1]);
  for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z.]*\.)'\s*\+/g)) prefixes.add(m[1]);
}

let bad = 0;
const missing = [...used].filter(k => !STRINGS[k] && !k.endsWith('.'));
if (missing.length) { bad += missing.length; console.log('MISSING (' + missing.length + '):\n  ' + missing.join('\n  ')); }

const short = Object.entries(STRINGS).filter(([, v]) => !Array.isArray(v) || v.length !== 3 || v.some(x => !x));
if (short.length) { bad += short.length; console.log('INCOMPLETE ROWS:\n  ' + short.map(([k]) => k).join('\n  ')); }

// Keys reachable via a dynamic prefix count as used.
const dynamicUsed = Object.keys(STRINGS).filter(k => [...prefixes].some(p => k.startsWith(p)));
// A key may also be assembled by concatenation (e.g. 'land.loop' + n + 't').
// Treat it as used if its longest literal stem appears anywhere in source.
const allSrc = files.map(f => fs.readFileSync(dir + f, 'utf8')).join('\n');
const assembled = k => {
  const stem = k.replace(/[0-9]+[a-z]*$/, '').replace(/[A-Z][a-zA-Z]*Sub$/, '');
  return stem.length > 6 && allSrc.includes("'" + stem);
};
const unused = Object.keys(STRINGS)
  .filter(k => !used.has(k) && !dynamicUsed.includes(k) && !assembled(k));
if (unused.length) console.log('UNUSED (' + unused.length + '):\n  ' + unused.join('\n  '));

// Untranslated: identical across all three (fine for OK, codes, proper nouns)
const same = Object.entries(STRINGS).filter(([, v]) => v[0] === v[1] && v[1] === v[2]);

console.log(`\n${Object.keys(STRINGS).length} keys · ${used.size} used directly · ${dynamicUsed.length} via prefix`);
console.log(`${same.length} identical across languages (check these are intentional)`);
console.log(bad ? '\nFAIL' : '\nPASS — every key used exists, every row has 3 languages');
process.exit(bad ? 1 : 0);
