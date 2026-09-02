/* ============================================================================
 * O CÓDIGO DE UMA SACOLA
 *
 * Sete caracteres, escritos `XXX-XXXX`. A frente é a descrição — que itens do
 * catálogo vão dentro, se há alguma coisa fora da lista, quantos volumes
 * iguais — e o resto é um número de série atribuído pelo servidor.
 *
 * POR QUE A DESCRIÇÃO VAI DENTRO DO NÚMERO. Na porta de um ginásio não há
 * rede. Um código que só fosse uma chave para uma linha da base de dados não
 * diria nada a um voluntário sem sinal; este descodifica-se sozinho e diz o
 * que tem dentro. O servidor acrescenta — a hora do registo, o papel escrito à
 * mão — e nunca é a condição para haver resposta.
 *
 * POR QUE HÁ UM NÚMERO DE SÉRIE. Sem ele, duas pessoas que embalem a mesma
 * coisa recebem o mesmo código, e "recebida às 09:14" passa a querer dizer
 * *uma* sacola como a sua. Com ele, quer dizer a sua.
 *
 * O QUE ISSO CUSTOU. Com seis caracteres, o espaço que sobrava era uma soma de
 * controlo: um erro de digitação falhava alto, umas 694 vezes em 695. A série
 * gasta esse espaço, portanto o código já não se verifica a si próprio — e é a
 * troca certa, porque a verificação mudou para um sítio mais forte:
 *
 *   · Com rede, é exacta. De 21.870.000.000 códigos possíveis só existem os
 *     que foram emitidos, por isso um código mal escrito é desconhecido, e não
 *     "provavelmente errado".
 *   · A futura aplicação offline deve levar a LISTA, não uma soma de controlo.
 *     Um aparelho que sincronizou hoje de manhã sabe quais existem — outra vez
 *     exacto. Os bits de controlo só teriam ajudado um aparelho que nunca
 *     sincronizou.
 *   · Frio e sem rede é o único caso fraco. A descrição descodifica na mesma, e
 *     o ecrã TEM de dizer que não confirmou nada, em vez de mostrar aquilo como
 *     se tivesse lido.
 *
 * Este ficheiro não depende de nada e não fala com a base de dados, para poder
 * ser servido tal e qual ao navegador no dia em que houver uma aplicação
 * offline. Uma função, dois sítios; nunca duas cópias.
 * ==========================================================================*/

/* O mesmo alfabeto do código de um centro: sem I, O e S, sem 0, 1 e 5. Um
   código destes dita-se ao telefone e escreve-se com caneta numa sacola
   molhada — as letras que se confundem não entram, nas duas metades de cada
   par. */
const ALFABETO = 'ABCDEFGHJKLMNPQRTUVWXYZ2346789';

/* ---------------------------------------------------------------------------
 * A ORDEM DESTA LISTA É UM FORMATO DE DADOS. NÃO SE REORDENA.
 *
 * Cada posição é um bit dentro do código. Trocar dois itens de sítio não
 * rebenta nada: passa a descodificar cobertores como sabão em todas as sacolas
 * que já foram registadas, em silêncio, para sempre. Acrescentar no FIM é
 * seguro até dezasseis; passar disso muda o tamanho do código e é outra
 * decisão.
 *
 * Está aqui em vez de vir do catálogo justamente por isso: o catálogo é uma
 * lista de coisas que um centro pede, e alguém há-de reordená-lo um dia por uma
 * razão perfeitamente boa. Há um teste que compara esta lista com uma
 * impressão digital, para essa alteração parar a compilação em vez de estragar
 * códigos.
 * -------------------------------------------------------------------------*/
const ITENS = Object.freeze([
  'agua', 'alimento', 'formula', 'racao',
  'limpeza', 'alvejante', 'balde', 'vassoura',
  'higiene', 'sabao', 'fralda', 'absorvente',
  'colchonete', 'cobertor', 'botas', 'primeiros-socorros'
]);

const BITS_ITENS = 16;      /* 0..15  — que itens vão dentro */
const BIT_OUTROS = 16;      /* 16     — há coisa fora da lista; o papel dentro diz o quê */
const BITS_VOLUMES = 17;    /* 17..19 — quantos volumes iguais levam este código (1..8) */
const MAX_VOLUMES = 8;
const DESCRICOES = Math.pow(2, 20);

/* Quantos números de série cabem por descrição: 30^7 / 2^20 = 20.856.
   Duas sacolas embaladas exactamente da mesma maneira têm 20.856 códigos
   diferentes à disposição, e as três primeiras letras iguais — porque a
   descrição é que é igual. */
const SERIAIS = Math.floor(Math.pow(30, 7) / DESCRICOES);

/** A descrição como um número. `volumes` fora de 1..8 é cortado, nunca rejeitado. */
function descrever(ids, outros, volumes) {
  let mascara = 0;
  (ids || []).forEach(id => {
    const i = ITENS.indexOf(id);
    if (i >= 0) mascara |= (1 << i);
  });
  const v = Math.max(1, Math.min(MAX_VOLUMES, parseInt(volumes, 10) || 1));
  return mascara | (outros ? 1 << BIT_OUTROS : 0) | ((v - 1) << BITS_VOLUMES);
}

/** Formatado como se escreve à mão: três, um traço, quatro. */
const formatar = s => s.slice(0, 3) + '-' + s.slice(3);

function codificar(ids, outros, volumes, serie) {
  const n = descrever(ids, outros, volumes);
  let total = n * SERIAIS + (((parseInt(serie, 10) || 0) % SERIAIS + SERIAIS) % SERIAIS);
  let s = '';
  for (let i = 0; i < 7; i++) { s = ALFABETO[total % 30] + s; total = Math.floor(total / 30); }
  return formatar(s);
}

/**
 * O contrário. Devolve `null` para qualquer coisa que não seja um código —
 * nunca lança, porque isto corre com o que uma pessoa digitou à pressa.
 *
 * Um código que descodifica NÃO É um código que existe. Sem soma de controlo,
 * quase todas as sete letras dão uma descrição possível; quem sabe se aquela
 * sacola foi mesmo registada é o servidor. Ver o comentário no topo.
 */
function descodificar(texto) {
  const s = String(texto == null ? '' : texto).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length !== 7) return null;
  let total = 0;
  for (const c of s) {
    const i = ALFABETO.indexOf(c);
    if (i < 0) return null;
    total = total * 30 + i;
  }
  const n = Math.floor(total / SERIAIS);
  if (n >= DESCRICOES) return null;
  const ids = ITENS.filter((_, i) => n & (1 << i));
  const outros = !!(n & (1 << BIT_OUTROS));
  if (!ids.length && !outros) return null;   /* uma sacola vazia não é uma sacola */
  return {
    codigo: formatar(s),
    ids,
    outros,
    volumes: ((n >> BITS_VOLUMES) & (MAX_VOLUMES - 1)) + 1,
    descricao: n,
    serie: total % SERIAIS
  };
}

/** As letras que um código nunca tem, para a mensagem de erro poder dizê-lo. */
const FORA = 'IOS015';

module.exports = { ALFABETO, ITENS, SERIAIS, MAX_VOLUMES, DESCRICOES, FORA,
                   descrever, codificar, descodificar, formatar };
