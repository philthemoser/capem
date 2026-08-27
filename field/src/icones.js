/* ============================================================================
 * CONJUNTO DE ÍCONES — 28 marcas
 *
 * Regras do sistema (não invente uma exceção, o conjunto perde a unidade):
 *   · viewBox 64×64, um único <path>, fill-rule="evenodd", currentColor
 *   · silhueta cheia, sem traço e sem fio fino
 *   · espessura mínima de membro 6 unidades (1,4 mm impresso a 15 mm)
 *   · margem óptica de 4 unidades em toda a volta, para alinhar em grelha
 *   · subcaminhos nunca se sobrepõem, excepto onde se quer um buraco —
 *     evenodd faz XOR, e é essa regra que deixa juntar mais vinte itens
 *     sem o conjunto derivar
 *
 * Impresso a 15 mm num panfleto e a 150 mm numa etiqueta de caixa, o mesmo
 * ficheiro. Por isso não há detalhe que só funcione grande.
 * ==========================================================================*/

/** Círculo como subcaminho fechado. Dois destes com evenodd dão um anel. */
const C = (x, y, r) => `M${x - r} ${y} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;

const ICONES = [
  /* ---- 16 necessidades ---- */
  { id: 'agua', rotulo: 'Água potável', cat: 'need',
    d: 'M32 4 L50 30 A18 18 0 1 1 14 30 Z' },
  { id: 'alimento', rotulo: 'Alimento não perecível', cat: 'need',
    d: 'M15 9 H49 V17 H15 Z M18 20 H46 V27 H18 Z M18 30 H46 V56 H18 Z' },
  { id: 'formula', rotulo: 'Fórmula infantil', cat: 'need',
    d: 'M27 4 A5 5 0 0 1 37 4 V11 H27 Z M24 13 H40 V19 H24 Z M21 21 H43 V50 A8 8 0 0 1 35 58 H29 A8 8 0 0 1 21 50 Z M25 29 H33 V32 H25 Z M25 38 H33 V41 H25 Z' },
  { id: 'racao', rotulo: 'Ração', cat: 'need',
    d: C(20, 15, 6) + ' ' + C(32, 11, 6) + ' ' + C(44, 15, 6) + ' M32 24 c8 0 13 5 13 9 0 4 -6 5 -13 5 -7 0 -13 -1 -13 -5 0 -4 5 -9 13 -9 Z M12 42 H52 L46 58 H18 Z' },
  { id: 'limpeza', rotulo: 'Kit de limpeza', cat: 'need',
    d: 'M26 6 H34 V12 H26 Z M20 14 H40 V58 H20 Z M42 16 H56 V24 H42 Z' },
  { id: 'alvejante', rotulo: 'Água sanitária', cat: 'need',
    d: 'M12 5 H25 V15 H12 Z M8 17 H50 V58 H8 Z M35 26 H44 V44 H35 Z' },
  { id: 'balde', rotulo: 'Balde', cat: 'need',
    d: 'M12 22 H52 L46 58 H18 Z M14 20 A18 18 0 0 1 50 20 H42 A10 10 0 0 0 22 20 Z' },
  { id: 'vassoura', rotulo: 'Vassoura', cat: 'need',
    d: 'M29 4 H35 V30 H29 Z M18 32 H46 V42 H18 Z M18 44 H24 V58 H18 Z M26 44 H32 V58 H26 Z M34 44 H40 V58 H34 Z M42 44 H48 V58 H42 Z' },
  { id: 'higiene', rotulo: 'Kit de higiene', cat: 'need',
    d: 'M4 32 H36 V40 H4 Z M36 30 H56 V40 H36 Z M37 18 H41 V30 H37 Z M43 16 H47 V30 H43 Z M49 18 H53 V30 H49 Z' },
  { id: 'sabao', rotulo: 'Sabão', cat: 'need',
    d: 'M10 40 H46 A5 5 0 0 1 46 56 H10 A5 5 0 0 1 10 40 Z M13 40 C10 30 16 25 21 27 C23 17 35 15 38 24 C47 22 51 32 46 40 Z' },
  { id: 'fralda', rotulo: 'Fraldas', cat: 'need',
    d: 'M4 10 H20 V22 H4 Z M44 10 H60 V22 H44 Z M8 22 H56 L50 34 C44 38 42 44 42 52 H22 C22 44 20 38 14 34 Z' },
  { id: 'absorvente', rotulo: 'Absorventes', cat: 'need',
    d: 'M22 10 H42 V54 H22 Z M14 22 H21 V40 H14 Z M43 22 H50 V40 H43 Z M30 18 H34 V46 H30 Z' },
  { id: 'colchonete', rotulo: 'Colchonete', cat: 'need',
    d: C(22, 32, 18) + ' ' + C(22, 32, 6) + ' M40 21 L62 25 V39 L40 43 Z' },
  { id: 'cobertor', rotulo: 'Cobertor', cat: 'need',
    d: 'M8 18 H56 V28 H8 Z M8 32 H56 V42 H8 Z M8 46 H56 V54 q-6 7 -12 0 q-6 7 -12 0 q-6 7 -12 0 q-6 7 -12 0 Z' },
  { id: 'botas', rotulo: 'Botas de borracha', cat: 'need',
    d: 'M12 5 H34 V14 H12 Z M15 16 H31 V36 H44 C50 36 54 41 54 50 H15 Z M12 52 H56 V58 H12 Z' },
  { id: 'primeiros-socorros', rotulo: 'Primeiros socorros', cat: 'need',
    d: 'M25 8 H39 V18 H25 Z M6 18 H58 V56 H6 Z M28 24 H36 V32 H44 V40 H36 V48 H28 V40 H20 V32 H28 Z' },

  /* ---- 4 recusas ---- */
  { id: 'roupa-usada', rotulo: 'Roupa usada', cat: 'refuse',
    d: 'M23 8 H41 L58 20 L50 32 L44 28 V56 H20 V28 L14 32 L6 20 Z' },
  { id: 'sacos-misturados', rotulo: 'Sacos misturados', cat: 'refuse',
    d: 'M16 4 L30 15 L23 18 Z M48 4 L34 15 L41 18 Z M26 19 H38 V24 H26 Z M20 24 H44 C54 32 57 46 51 57 H13 C7 46 10 32 20 24 Z' },
  { id: 'pereciveis', rotulo: 'Comida perecível', cat: 'refuse',
    d: 'M2 17 L19 32 L2 47 Z M19 32 C25 16 44 13 56 25 C58 27 58 37 56 39 C44 51 25 48 19 32 Z ' + C(46, 27, 3) },
  { id: 'moveis', rotulo: 'Móveis', cat: 'refuse',
    d: 'M12 10 H52 V30 H12 Z M6 32 H58 V44 H6 Z M10 46 H18 V58 H10 Z M46 46 H54 V58 H46 Z' },

  /* ---- 8 marcas utilitárias ---- */
  { id: 'seta', rotulo: 'Seta', cat: 'util',
    d: 'M32 4 L58 34 H44 V60 H20 V34 H6 Z' },
  { id: 'relogio', rotulo: 'Relógio', cat: 'util',
    d: C(32, 32, 29) + ' ' + C(32, 32, 22) + ' M29 14 H35 V30 H48 V36 H29 Z' },
  { id: 'pino', rotulo: 'Localização', cat: 'util',
    d: 'M32 3 A22 22 0 0 1 54 25 C54 40 32 61 32 61 C32 61 10 40 10 25 A22 22 0 0 1 32 3 Z ' + C(32, 25, 8) },
  { id: 'telefone', rotulo: 'Telefone', cat: 'util',
    d: 'M18 3 H46 A5 5 0 0 1 51 8 V56 A5 5 0 0 1 46 61 H18 A5 5 0 0 1 13 56 V8 A5 5 0 0 1 18 3 Z M19 13 H45 V47 H19 Z' },
  { id: 'aberto', rotulo: 'Aberto', cat: 'util',
    d: C(32, 32, 29) + ' M18 32 L27 42 L45 20 L52 27 L27 56 L11 38 Z' },
  { id: 'fechado', rotulo: 'Fechado', cat: 'util',
    d: C(32, 32, 29) + ' M12 27 H52 V37 H12 Z' },
  { id: 'pessoa', rotulo: 'Pessoa', cat: 'util',
    d: C(32, 16, 10) + ' M11 58 C11 42 20 33 32 33 C44 33 53 42 53 58 Z' },
  { id: 'caixa', rotulo: 'Caixa', cat: 'util',
    d: 'M6 14 H58 V24 H6 Z M10 26 H54 V58 H10 Z M28 30 H36 V44 H28 Z' }
];

const POR_ID = {};
ICONES.forEach(i => { POR_ID[i.id] = i; });

/* ---------------------------------------------------------------------------
 * O anel de proibição — ISO 7010.
 *
 * Anel de 7/64 do diâmetro, barra a 45° do canto superior esquerdo para o
 * inferior direito, como na norma. O item vai lá dentro a 70%, centrado.
 *
 * Isto é o que carrega o significado "não traga" quando o papel sai de uma
 * fotocopiadora sem toner de cor: em mono o vermelho passa a #16130F e a
 * forma — anel mais barra — continua a dizer a mesma coisa. Nenhuma peça
 * depende da cor para ser entendida.
 * -------------------------------------------------------------------------*/
const ANEL_D = 'M1 32 a31 31 0 1 0 62 0 a31 31 0 1 0 -62 0 Z M8 32 a24 24 0 1 0 48 0 a24 24 0 1 0 -48 0 Z';
const BARRA = { x: 7, y: 28.5, w: 50, h: 7, rot: 45 };

/* ---------------------------------------------------------------------------
 * Alinhamento dentro da caixa.
 *
 * Numa grelha de item + rótulo, a caixa do ícone estica para ocupar a altura
 * que sobra e a marca fica centrada nela. Com dez itens isso não se nota; com
 * quatro, a marca sobe para o meio de uma caixa alta e o rótulo fica lá em
 * baixo, sozinho — deixam de se ler como uma coisa só.
 *
 * `xMidYMax` encosta a marca ao fundo da caixa, imediatamente acima da sua
 * palavra. É a diferença entre uma grelha de símbolos e uma lista legível.
 * -------------------------------------------------------------------------*/
const AO_FUNDO = 'xMidYMax meet';

/** SVG de um ícone simples. `estilo` entra no atributo style do <svg>. */
function svgIcone(id, estilo, par) {
  const ic = POR_ID[id] || POR_ID.caixa;
  return `<svg viewBox="0 0 64 64"${par ? ` preserveAspectRatio="${par}"` : ''} style="${estilo || ''}" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="${ic.d}"/></svg>`;
}

/** Só o anel e a barra, sem item lá dentro — para os cabeçalhos "não traga". */
function svgAnel(estilo) {
  return `<svg viewBox="0 0 64 64" style="${estilo || ''}" aria-hidden="true" focusable="false">` +
    `<path fill="var(--proibido)" fill-rule="evenodd" d="${ANEL_D}"/>` +
    `<rect x="${BARRA.x}" y="${BARRA.y}" width="${BARRA.w}" height="${BARRA.h}" transform="rotate(${BARRA.rot} 32 32)" fill="var(--proibido)"/>` +
    `</svg>`;
}

/** SVG de um ícone dentro do anel de proibição. */
function svgProibido(id, estilo, par) {
  const ic = POR_ID[id] || POR_ID.caixa;
  return `<svg viewBox="0 0 64 64"${par ? ` preserveAspectRatio="${par}"` : ''} style="${estilo || ''}" aria-hidden="true" focusable="false">` +
    `<g transform="translate(9.6 9.6) scale(0.7)"><path fill="var(--tinta)" fill-rule="evenodd" d="${ic.d}"/></g>` +
    `<path fill="var(--proibido)" fill-rule="evenodd" d="${ANEL_D}"/>` +
    `<rect x="${BARRA.x}" y="${BARRA.y}" width="${BARRA.w}" height="${BARRA.h}" transform="rotate(${BARRA.rot} 32 32)" fill="var(--proibido)"/>` +
    `</svg>`;
}
