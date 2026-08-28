/* ============================================================================
 * O CÓDIGO QUE O PAPEL E A PÁGINA PARTILHAM
 *
 * As 29 marcas e o catálogo vivem em field/src/. São ficheiros de browser —
 * declaram `const ICONES = [...]` e não exportam nada, porque são concatenados
 * dentro de um <script>.
 *
 * Em vez de os duplicar aqui (duas cópias divergem, e no dia em que
 * divergirem o cartaz na porta e a página do QR passam a dizer coisas
 * diferentes sobre o mesmo centro), lê-se o texto e avalia-se uma vez.
 *
 * É deliberado que isto pareça um truque: a alternativa era transformar dois
 * ficheiros que funcionam num sistema de módulos para agradar ao servidor.
 * Uma fonte de verdade vale um `new Function`.
 * ==========================================================================*/
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'field', 'src');
const ler = f => fs.readFileSync(path.join(SRC, f), 'utf8');

const EXPORTA = [
  'ICONES', 'POR_ID', 'ANEL_D', 'BARRA', 'AO_FUNDO',
  'svgIcone', 'svgProibido', 'svgAnel',
  'GRUPOS', 'ROTULO_BR', 'RECUSAS', 'FUNCOES', 'item'
];

const corpo = ler('icones.js') + '\n' + ler('catalogo.js') +
  '\nreturn {' + EXPORTA.join(',') + '};';

const partilhado = new Function(corpo)();

/* Se um destes ficheiros for renomeado ou refeito, isto rebenta ao arrancar o
   servidor em vez de servir páginas sem marcas — que é a falha silenciosa que
   custaria mais. */
EXPORTA.forEach(n => {
  if (partilhado[n] === undefined) {
    throw new Error(`field/src perdeu "${n}" — o servidor e o papel deixariam de concordar`);
  }
});

module.exports = partilhado;
