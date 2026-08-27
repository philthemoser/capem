/* ============================================================================
 * CATÁLOGO
 *
 * Uma decisão que parece pequena e não é: o catálogo é ancorado nas marcas,
 * não no contrário. Só entram itens que têm um símbolo.
 *
 * A razão é a promessa do sistema — "toda a peça funciona com o texto
 * ignorado". Um item sem marca imprime uma caixa genérica, e duas caixas
 * genéricas lado a lado não dizem nada a quem não lê português. Por isso o
 * item livre existe (a realidade não cabe em dezasseis marcas) mas o
 * formulário avisa, em vez de deixar o cartaz degradar-se em silêncio.
 * ==========================================================================*/

const GRUPOS = [
  { g: 'Água e alimento', ids: ['agua', 'alimento', 'formula', 'racao'] },
  { g: 'Limpeza', ids: ['limpeza', 'alvejante', 'balde', 'vassoura'] },
  { g: 'Higiene', ids: ['higiene', 'sabao', 'fralda', 'absorvente'] },
  { g: 'Dormir', ids: ['colchonete', 'cobertor'] },
  { g: 'Proteção e saúde', ids: ['botas', 'primeiros-socorros'] }
];

/* Rótulos do Brasil. O conjunto de ícones veio com português europeu;
   o que vai na parede tem de ser o que a pessoa diz. */
const ROTULO_BR = {
  agua: 'Água potável',
  alimento: 'Alimento não perecível',
  formula: 'Fórmula infantil',
  racao: 'Ração para animais',
  limpeza: 'Kit de limpeza',
  alvejante: 'Água sanitária',
  balde: 'Balde',
  vassoura: 'Vassoura',
  higiene: 'Kit de higiene',
  sabao: 'Sabão',
  fralda: 'Fraldas',
  absorvente: 'Absorventes',
  colchonete: 'Colchonete',
  cobertor: 'Cobertor',
  botas: 'Botas de borracha',
  'primeiros-socorros': 'Primeiros socorros',
  'roupa-usada': 'Roupa usada',
  'sacos-misturados': 'Sacos misturados',
  pereciveis: 'Alimento perecível',
  moveis: 'Móveis'
};

/* Os quatro que afogam um centro. Pré-preenchidos, editáveis. */
const RECUSAS = ['roupa-usada', 'sacos-misturados', 'pereciveis', 'moveis'];

/* As funções que aparecem nos crachás e nas faixas de braço. */
const FUNCOES = ['COORDENAÇÃO', 'TRIAGEM', 'ENTREGA', 'COZINHA', 'VOLUNTÁRIO'];

/**
 * Um item da lista é uma de duas coisas:
 *   'agua'                        — uma entrada do catálogo, com a sua marca
 *   { texto, marca }              — escrito à mão; `marca` é opcional
 *
 * Um item escrito à mão sem marca sai com a caixa genérica, que não diz nada a
 * quem não lê português. Por isso o formulário deixa escolher uma das 29 —
 * é melhor uma marca aproximada do que uma caixa que não significa nada.
 */
function item(v) {
  if (typeof v === 'string') return { id: v, rotulo: ROTULO_BR[v] || v, livre: false };
  return { id: v.marca || 'caixa', rotulo: v.texto, livre: true, semMarca: !v.marca };
}
