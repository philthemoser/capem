/* ============================================================================
 * PROCURAR, FILTRAR, ORDENAR
 *
 * A página `/centros` era a única que crescia mal: desenhava todos os centros e
 * filtrava-os no telemóvel. Com mil centros eram 1,6 MB de HTML e 41 páginas
 * por segundo — e ninguém numa rua, com uma barra de rede, espera por isso.
 *
 * Este ficheiro é a metade que decide *o que* conta como resposta. O `db.js`
 * traduz isto para SQL e o `pagina.js` desenha o resultado; nenhum dos dois
 * sabe as regras que estão aqui.
 *
 * A regra que interessa: quem procura escreve o que quer DAR, não o nome de um
 * centro. "cobertor" tem de encontrar quem pediu cobertores. Por isso o texto
 * indexado de um centro inclui a lista de necessidades — os rótulos do
 * catálogo e o que foi escrito à mão — e não só o nome e a morada.
 * ==========================================================================*/
const { item } = require('./compartilhado');

/**
 * Sem acentos, sem maiúsculas, sem pontuação.
 *
 * Quem escreve num telemóvel molhado não escreve "Paróquia": escreve "paroquia".
 * As duas formas têm de ser a mesma palavra dos dois lados da comparação.
 */
const normalizar = s => String(s == null ? '' : s)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

/**
 * O texto que representa um centro na procura.
 *
 * Guardado numa coluna própria e recalculado a cada publicação. Podia ser
 * calculado a cada pedido a partir do JSON — e era isso que tornava a página
 * lenta.
 */
function textoDeBusca(dados) {
  const d = dados || {};
  const rotulos = (d.precisa || []).map(v => { try { return item(v).rotulo; } catch { return ''; } });
  return normalizar([d.nome, d.endereco, d.tipo, d.cidade, ...rotulos].join(' '));
}

/** O nome pelo qual se ordena. O SQLite não sabe português; sem acentos, sabe. */
const nomeDeOrdem = dados => normalizar((dados || {}).nome);

/**
 * Os termos de uma procura.
 *
 * Divide-se por espaços e exigem-se **todos** — "canoas cobertor" é um centro
 * em Canoas que precisa de cobertores, não a soma dos dois conjuntos. É o que
 * as pessoas esperam de uma caixa de procura, e é o que torna útil escrever
 * mais uma palavra em vez de menos.
 */
const termos = q => normalizar(q).split(' ').filter(Boolean).slice(0, 6);

/* ---------------------------------------------------------------------------
 * As ordens possíveis, e porquê estas três.
 *
 * `uteis` é a de sempre e continua a ser a predefinida: primeiro pela idade da
 * lista, e dentro da mesma idade quem está a receber antes de quem está em
 * pausa. Esta página chama-se "quero ajudar" — o primeiro da lista tem de ser
 * um sítio que aceita alguma coisa.
 * -------------------------------------------------------------------------*/
const ORDENS = {
  uteis: 'mais úteis primeiro',
  recentes: 'atualizados há menos tempo',
  nome: 'por nome'
};
const ORDEM_PREDEFINIDA = 'uteis';

const POR_PAGINA = 40;

/** Lê os parâmetros do endereço, sem confiar em nada do que lá vem. */
function lerConsulta(params) {
  const p = params || new URLSearchParams();
  const num = (v, min, max, resq) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= min && n <= max ? n : resq;
  };
  return {
    q: String(p.get('q') || '').slice(0, 80),
    ordem: ORDENS[p.get('ordem')] ? p.get('ordem') : ORDEM_PREDEFINIDA,
    aceitando: p.get('aceitando') === '1',
    recentes: p.get('recentes') === '1',
    emergencia: String(p.get('e') || '').slice(0, 60),
    /* Só os centros que ainda não têm quem publique. Existe para a linha que
       aparece numa procura por necessidade — "cobertor" nunca encontra estes,
       porque o texto de busca é feito das necessidades e eles não têm nenhuma.
       Sem esta página, a procura responde como se eles não existissem. */
    semLista: p.get('semlista') === '1',
    pagina: num(p.get('p'), 1, 10000, 1),
    porPagina: POR_PAGINA
  };
}

/** Reconstrói o endereço com uma alteração — para os links de página e de ordem. */
function comoEndereco(c, mudanca = {}) {
  const v = { ...c, ...mudanca };
  const p = new URLSearchParams();
  if (v.q) p.set('q', v.q);
  if (v.ordem && v.ordem !== ORDEM_PREDEFINIDA) p.set('ordem', v.ordem);
  if (v.aceitando) p.set('aceitando', '1');
  if (v.recentes) p.set('recentes', '1');
  if (v.emergencia) p.set('e', v.emergencia);
  if (v.semLista) p.set('semlista', '1');
  if (v.pagina > 1) p.set('p', String(v.pagina));
  const s = p.toString();
  return '/centros' + (s ? '?' + s : '');
}

/**
 * Põe à frente as necessidades que explicam o resultado.
 *
 * Se alguém procurou "cobertor" e um centro aparece por causa disso, a marca do
 * cobertor tem de ser a primeira das oito que se veem — senão a lista responde
 * sem mostrar a resposta.
 */
function realcar(precisa, ts) {
  if (!ts.length) return precisa;
  const bate = i => ts.some(t => normalizar(i.rotulo).includes(t));
  return [...precisa].sort((a, b) => (bate(b) ? 1 : 0) - (bate(a) ? 1 : 0));
}

module.exports = { normalizar, textoDeBusca, nomeDeOrdem, termos, realcar,
                   lerConsulta, comoEndereco, ORDENS, ORDEM_PREDEFINIDA, POR_PAGINA };
