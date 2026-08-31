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
 * Um item da lista é uma de três coisas:
 *   'agua'                        — uma entrada do catálogo, com a sua marca
 *   { id, q }                     — a mesma, com uma quantidade
 *   { texto, marca, q }           — escrito à mão; `marca` e `q` são opcionais
 *
 * Um item escrito à mão sem marca sai com a caixa genérica, que não diz nada a
 * quem não lê português. Por isso o formulário deixa escolher uma das 29 —
 * é melhor uma marca aproximada do que uma caixa que não significa nada.
 *
 * A QUANTIDADE É OPCIONAL E CURTA, e é assim de propósito.
 *
 * "200 cobertores" é muito mais accionável do que "cobertores" — e a
 * sobra é precisamente o problema que esta ferramenta existe para combater.
 * Mas um número envelhece mais depressa do que uma lista e parece mais
 * autoritário enquanto o faz: "200" impresso às 8h está errado ao meio-dia, e
 * um número exacto convida a mais confiança do que uma palavra sozinha.
 *
 * Daí: quem sabe escreve, quem não sabe deixa em branco e a peça fica como
 * hoje. Sem sistema de unidades — "200", "20 caixas" e "muitas" servem todos,
 * e o limite de caracteres é o que faz caber no cartaz.
 */
const MAX_Q = 12;

function item(v) {
  if (typeof v === 'string') return { id: v, rotulo: ROTULO_BR[v] || v, livre: false, q: '' };
  const q = String(v.q == null ? '' : v.q).trim().slice(0, MAX_Q);
  if (v.id) return { id: v.id, rotulo: ROTULO_BR[v.id] || v.id, livre: false, q };
  return { id: v.marca || 'caixa', rotulo: v.texto, livre: true, semMarca: !v.marca, q };
}

/** O id de um item, seja qual for a forma em que veio. */
const idDe = v => (typeof v === 'string' ? v : (v && v.id) || null);

/** Devolve o valor com a quantidade mudada, preservando a forma mais simples. */
function comQuantidade(v, q) {
  const limpo = String(q == null ? '' : q).trim().slice(0, MAX_Q);
  if (typeof v === 'string') return limpo ? { id: v, q: limpo } : v;
  const novo = { ...v, q: limpo };
  if (!limpo) delete novo.q;
  /* Sem quantidade, um item de catálogo volta a ser uma string: o estado
     guardado fica pequeno e legível, e as versões antigas continuam a lê-lo. */
  if (novo.id && !novo.q) return novo.id;
  return novo;
}
