const fs = require('fs');
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
const src = fs.readFileSync(__dirname + '/../src/js/05-qr.js','utf8');
eval(src.replace(/^const QR =/m,'globalThis.QR ='));
const tests = JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const out = {};
for (const t of tests) {
  const m = QR.encode(t);
  out[t] = m ? m.map(r=>r.join('')).join('\n') : null;
}
console.log(JSON.stringify(out));
