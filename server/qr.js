/* ============================================================================
 * O CODIFICADOR DE QR, PARTILHADO COM O PROTÓTIPO
 *
 * `src/js/05-qr.js` é um ficheiro de browser — declara `const QR = (...)()` e
 * não exporta nada, porque é concatenado dentro de um <script>. É o mesmo
 * codificador que o kit imprime e que foi verificado contra o encoder de
 * referência em Python (tools/verify-qr.js), por isso lê-se e avalia-se uma
 * vez, em vez de haver uma segunda cópia no servidor.
 *
 * Mesma troca que em compartilhado.js: uma fonte de verdade vale um
 * `new Function`. Duas cópias divergem, e um QR que diverge é um QR que leva a
 * pessoa ao sítio errado com a sacola na mão.
 *
 * O ficheiro usa `esc` para o rótulo acessível do <svg>; como lá dentro não há
 * nenhum, entra por aqui.
 * ==========================================================================*/
const fs = require('node:fs');
const path = require('node:path');

const fonte = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'js', '05-qr.js'), 'utf8');

const escapar = `function esc(s){return String(s).replace(/[&<>"']/g,function(c){
  return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}`;

const QR = new Function(escapar + '\n' + fonte + '\nreturn QR;')();

if (typeof QR.svg !== 'function') {
  throw new Error('src/js/05-qr.js perdeu o svg() — o QR da sacola deixaria de existir');
}

module.exports = QR;
