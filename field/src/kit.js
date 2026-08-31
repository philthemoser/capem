/* ============================================================================
 * KIT DE MATERIAL IMPRESSO — CAPEM Campo
 *
 * Uma ferramenta, não uma demonstração. Um coordenador preenche uma vez, no
 * telemóvel, num prédio com pouca luz e sinal mau, e sai daqui com catorze
 * peças prontas a imprimir e a partilhar.
 *
 * Quatro decisões mandam em tudo o que está abaixo:
 *
 * 1. NÃO HÁ SERVIDOR. Tudo corre no browser. Nada para cair, nada para
 *    vazar, nada para pagar. O ficheiro funciona aberto de uma pen.
 *
 * 2. O PAPEL É O PRINCIPAL, NÃO O EXTRA. Numa enchente o ecrã falha: a
 *    bateria acaba, não há corrente para carregar, o telemóvel molha-se. O
 *    papel continua a funcionar, passa de mão em mão e lê-se à luz de um
 *    candeeiro. Por isso nenhuma peça depende de um QR ser lido — a morada,
 *    o horário e o telefone estão sempre lá como texto.
 *
 * 3. O "NÃO TRAGA" TEM O MESMO PESO QUE O "PRECISAMOS". Em 2024 a roupa
 *    chegou a 70% de tudo o que foi recolhido no país antes de os Correios
 *    suspenderem a recolha. Avisar duzentos vizinhos para pararem de mandar
 *    roupa evita mais caos do que qualquer lista de necessidades resolve.
 *
 * 4. MONO É O DESENHO CANÓNICO. O toner de cor é o primeiro a acabar e
 *    metade dos centros fotocopia. A cor é uma camada por cima; a forma —
 *    anel e barra para proibido, anel e visto para permitido — carrega o
 *    significado sozinha.
 * ==========================================================================*/

const MM = 96 / 25.4;   /* 1 mm em píxeis CSS */

/* ---------------------------------------------------------------------------
 * O piso da marca.
 *
 * O sistema desenhado diz: abaixo de 26 mm a marca deixa de se ler a dois
 * metros, e acima de dez itens deve paginar-se. Medimos, e a conta não fecha:
 * dez itens só dão 26 mm se o nome do centro couber numa linha. "Paróquia São
 * Sebastião" ocupa duas, o cabeçalho cresce cerca de 20 mm, e a nona marca cai
 * para 18 mm — um cartaz que parece cheio e não se lê do passeio.
 *
 * Por isso o limite não é um número: é o piso. O gerador mede a marca depois
 * de desenhar e vai tirando itens até ela subir acima de 26 mm, e diz ao
 * coordenador quantos ficaram de fora. Um centro com nome curto leva dez; um
 * com nome comprido leva oito. Truncar em silêncio a dez seria imprimir uma
 * promessa falsa em cem folhas.
 * -------------------------------------------------------------------------*/
const PISO_MM = 26;
let CAP_CARTAZ = 10;

/* ---------------------------------------------------------------------------
 * Estado
 * -------------------------------------------------------------------------*/
const vazio = () => ({
  nome: '', tipo: 'Ponto de arrecadação', endereco: '', horario: '',
  contato: '', link: '',
  precisa: ['agua', 'alimento', 'limpeza', 'higiene'],
  naoTraga: RECUSAS.slice(),
  setaTexto: 'DOAÇÕES', setaDir: 'direita',
  fechadoTexto: 'Fechado agora — abrimos amanhã',
  pausado: false, motivoPausa: 'Estamos cheios. Ligue antes de vir.',
  slug: '', codigo: '',
  mono: false, cortes: true,
  atualizado: ''
});

let S = vazio();

const TIPOS = ['Ponto de arrecadação', 'Abrigo', 'Abrigo e ponto de arrecadação',
  'Cozinha comunitária', 'Centro de distribuição'];

const DIRS = { cima: 0, direita: 90, baixo: 180, esquerda: 270 };

function salvar() {
  S.atualizado = agora();
  try { localStorage.setItem('capem.kit', JSON.stringify(S)); } catch (e) { /* janela anónima */ }
  render();
}

function carregar() {
  try {
    const raw = localStorage.getItem('capem.kit');
    if (raw) S = Object.assign(vazio(), JSON.parse(raw));
    /* Migração silenciosa da versão anterior, que só gerava um cartaz e
       guardava os itens como texto livre. Quem já tinha a lista preenchida
       não a perde — os itens que têm marca passam a ter marca. */
    else {
      const velho = localStorage.getItem('capem.cartaz');
      if (velho) migrar(JSON.parse(velho));
    }
  } catch (e) { /* ignora */ }
}

function migrar(v) {
  const porRotulo = {};
  Object.keys(ROTULO_BR).forEach(id => { porRotulo[norm(ROTULO_BR[id])] = id; });
  const conv = lista => (lista || []).map(t => porRotulo[norm(t)] || { texto: t });
  S = Object.assign(vazio(), {
    nome: v.nome || '', tipo: v.tipo || S.tipo, endereco: v.endereco || '',
    horario: v.horario || '', contato: v.contato || '', link: v.link || '',
    precisa: conv(v.precisa),
    naoTraga: v.naoTraga && v.naoTraga.length ? conv(v.naoTraga) : RECUSAS.slice()
  });
}

const norm = s => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

function agora() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} às ${p(d.getHours())}h${p(d.getMinutes())}`;
}

/* ---------------------------------------------------------------------------
 * O carimbo de data.
 *
 * Um cartaz colado numa porta é indistinguível de um cartaz colado há três
 * semanas. Sem data, um vizinho que passa não tem como saber se a lista ainda
 * vale, e o centro recebe hoje aquilo de que precisava no dia 4.
 *
 * A data também é honesta ao contrário: se o papel ficar duas semanas na
 * porta, é a data que denuncia. É isso que se quer — "esta lista é do dia 14,
 * ligue antes de vir" é uma informação útil, e o silêncio não é.
 *
 * É a versão barata da página de necessidades. Enquanto ela não existir, é o
 * que há; quando existir, o QR passa a fazer o mesmo em tempo real.
 * -------------------------------------------------------------------------*/
function dataCurta() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** O carimbo, para as peças que envelhecem. `classe` afina o tamanho. */
function carimbo(classe) {
  return `<div class="carimbo ${classe || ''}">Lista de ${dataCurta()}</div>`;
}

const esc = s => String(s == null ? '' : s)
  .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* Valores derivados, num sítio só. Nenhuma peça inventa os seus. */
const V = {
  nome: () => S.nome.trim() || 'Nome do centro',
  tipo: () => S.tipo || 'Ponto de arrecadação',
  end: () => S.endereco.trim(),
  hor: () => S.horario.trim(),
  tel: () => S.contato.trim(),
  link: () => S.link.trim(),
  precisa: () => S.precisa.map(item),
  nao: () => S.naoTraga.map(item),
  /* O cartaz não tem limite fixo de itens — tem um piso de marca. Ver
     ajustarCartaz(): CAP_CARTAZ é medido, não escolhido. */
  precisaCartaz: () => V.precisa().slice(0, CAP_CARTAZ),
  precisa10: () => V.precisa().slice(0, 10),
  precisa8: () => V.precisa().slice(0, 8),
  precisa6: () => V.precisa().slice(0, 6),
  precisa3: () => V.precisa().slice(0, 3)
};

/* ---------------------------------------------------------------------------
 * Blocos partilhados
 * -------------------------------------------------------------------------*/
/**
 * Um item numa grelha: marca por cima, palavra por baixo. Sem número.
 *
 * A QUANTIDADE NÃO ENTRA EM NADA DO QUE SAI DAQUI, e isso é uma regra e não
 * um esquecimento: um número só vive onde pode ser corrigido.
 *
 * O papel na porta não se corrige. Uma imagem posta no grupo às 8h continua a
 * circular dias depois. As duas congelariam "200 cobertores" muito depois de
 * isso ter deixado de ser verdade — e um número velho é pior do que nenhum,
 * porque parece exacto. As quantidades vivem só na página do centro, que é
 * reescrita a cada publicação; o papel e as imagens levam a lista e o link.
 */
function mi(it, prob, estilo) {
  const svg = prob ? svgProibido(it.id, estilo, AO_FUNDO) : svgIcone(it.id, estilo, AO_FUNDO);
  return `<div class="marca-item">${svg}<div class="rot">${esc(it.rotulo)}</div></div>`;
}

function qr(classe) {
  const l = V.link();
  if (!l) return '';
  const s = QR.svg(l, 200, { label: 'Lista atualizada de ' + V.nome() });
  return classe ? s.replace('class="qr"', `class="qr ${classe}"`) : s;
}

/** Marcas de corte a partir de posições em mm nas bordas da folha. */
function cortes(xs, ys, cruz) {
  let h = '<div class="cortes">';
  xs.forEach(x => { h += `<i class="v" style="top:0;left:${x}mm"></i><i class="v" style="bottom:0;left:${x}mm"></i>`; });
  ys.forEach(y => { h += `<i class="h" style="left:0;top:${y}mm"></i><i class="h" style="right:0;top:${y}mm"></i>`; });
  if (cruz) h += `<i class="cruz-v" style="left:${cruz[0]}mm;top:${cruz[1]}mm"></i><i class="cruz-h" style="left:${cruz[0]}mm;top:${cruz[1]}mm"></i>`;
  return h + '</div>';
}

/* ---------------------------------------------------------------------------
 * AS PEÇAS
 *
 * Cada uma declara o seu tamanho real e devolve o seu HTML. Quem lê isto a
 * seguir: as medidas vêm do sistema desenhado e não são para afinar a olho.
 * -------------------------------------------------------------------------*/
/* ---------------------------------------------------------------------------
 * A folha de instruções.
 *
 * Vem antes de tudo o resto de propósito. Quem monta um centro não está a
 * olhar para um ecrã: está com fita-cola na mão, no meio de um ginásio, a
 * decidir onde pregar o quê. Uma página de ajuda no site é lida uma vez e
 * esquecida; uma folha pregada na parede do fundo continua a responder à
 * pergunta durante duas semanas, e ao turno seguinte, e ao voluntário que
 * chegou hoje.
 *
 * Por isso a explicação deste kit é ela própria uma peça impressa.
 * -------------------------------------------------------------------------*/
const PASSOS = [
  { ic: 'cartaz', t: 'Cartaz de porta',
    d: 'Cole na entrada, à altura dos olhos. É a peça que faz mais diferença — se só imprimir uma, imprima esta.' },
  { ic: 'aberto', t: 'Sinal da mesa de triagem',
    d: 'Em cima da mesa onde recebe as doações, virado para quem chega. É ele que dá cobertura a quem tem de recusar.' },
  { ic: 'caixa', t: 'Etiquetas de caixa',
    d: 'Uma por caixa, colada de fora. A partir daí um voluntário novo separa sozinho, sem perguntar nada a ninguém.' },
  { ic: 'pessoa', t: 'Crachás e faixas de braço',
    d: 'Um por pessoa, no início do turno. O nome escreve-se à mão.' },
  { ic: 'seta', t: 'Setas e panfletos',
    d: 'Setas onde as pessoas se enganam no caminho. Panfletos para entregar na rua — uma folha dá quatro.' }
];

const ROTINA = [
  'Atualize a lista do dia e reimprima o cartaz de porta. A data no rodapé é o que diz ao vizinho se a lista ainda vale.',
  'Mande o post no grupo do WhatsApp. É por aí que a lista chega mais longe.',
  'Se o centro encher, marque “não estamos recebendo” e reimprima. Dizer que pare é mais útil do que não dizer nada.'
];

const PECAS = [

  /* ===== A FOLHA DE INSTRUÇÕES ========================================== */
  {
    id: 'instrucoes', fam: 0, titulo: 'Folha de instruções', fmt: 'A4 retrato · para a parede do fundo',
    w: 210, h: 297, un: 'mm',
    nota: 'Onde pregar o quê, e o que fazer todos os dias. Pregue-a onde a equipa passa — não é para o doador, é para quem está a trabalhar.',
    html: () => `<div class="folha f-instr">
      <div class="topo-c">
        <div class="tipo">${esc(V.nome())}</div>
        <div class="nome preta">COMO USAR ESTE KIT</div>
        <div class="sub">Pregue esta folha onde a equipa passa. Não é para o doador.</div>
      </div>

      <div class="bloco-i">
        <div class="h preta">1 · IMPRIMA E PREGUE</div>
        <ol class="passos">
          ${PASSOS.map(x => `<li>
            ${svgIcone(x.ic)}
            <div><b>${esc(x.t)}</b><span>${esc(x.d)}</span></div>
          </li>`).join('')}
        </ol>
      </div>

      <div class="dois-i">
        <div class="bloco-i">
          <div class="h preta">2 · TODOS OS DIAS</div>
          <ul class="rotina">${ROTINA.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        </div>
        <div class="bloco-i">
          <div class="h preta">3 · SE FALTAR TINTA</div>
          <p class="obs">Ligue <b>“ver a preto e branco”</b> antes de imprimir. Nada se perde: o proibido continua a ser o anel com a barra, o permitido continua a ser o visto. A cor nunca carrega sozinha o significado.</p>
          <p class="obs">Antes de imprimir cem folhas, imprima uma e leia-a a dois metros.</p>
        </div>
      </div>

      <div class="destaque">
        ${svgAnel()}
        <div>
          <b>A lista do “não traga” evita mais transtorno do que a do “precisamos” resolve.</b>
          <span>Nas enchentes de 2024 no Rio Grande do Sul, roupa usada chegou a 70% de tudo o que foi arrecadado no país. Mas são pessoas a tentar ajudar — por isso as peças agradecem antes de recusar.</span>
        </div>
      </div>

      <div class="pe">
        <div>CAPEM · ferramenta livre · github.com/philthemoser/capem</div>
        ${carimbo()}
      </div>
    </div>`
  },

  /* ===== FAMÍLIA 1 — ANUNCIAR (para fora) ================================ */
  {
    id: 'cartaz', fam: 1, titulo: 'Cartaz de porta', fmt: 'A4 retrato · 210 × 297 mm',
    w: 210, h: 297, un: 'mm',
    nota: 'O principal. Colado à entrada. Adapta-se sozinho de 3 a 10 itens.',
    html: () => {
      const l = V.link();
      return `<div class="folha f-cartaz">
        <div class="topo-c">
          <div class="tipo">${esc(V.tipo())}</div>
          <div class="nome preta">${esc(V.nome())}</div>
          ${V.hor() ? `<div class="horas">${svgIcone(S.pausado ? 'fechado' : 'aberto')}<span>${esc(V.hor())}</span></div>` : ''}
        </div>
        ${S.pausado ? `
        <div class="sec-pausa">
          ${svgIcone('fechado')}
          <div>
            <div class="h preta">NÃO ESTAMOS RECEBENDO AGORA</div>
            <div class="porque">${esc(S.motivoPausa || '')}</div>
          </div>
        </div>` : `
        <div class="sec-precisa">
          <div class="cabeca">${svgIcone('aberto', 'color:var(--permitido)')}<div class="h preta">PRECISAMOS HOJE</div></div>
          <div class="grade-precisa">${V.precisaCartaz().map(i => mi(i)).join('')}</div>
        </div>`}
        <div class="sec-nao">
          <div class="cabeca">
            ${svgAnel()}
            <div>
              <div class="h preta">POR FAVOR, NÃO TRAGA</div>
              <div class="porque">Não temos onde guardar — e obrigado por querer ajudar.</div>
            </div>
          </div>
          <div class="grade-nao">${V.nao().map(i => mi(i, true)).join('')}</div>
        </div>
        <div class="pe">
          <div class="dados">
            ${V.end() ? `<div class="lin">${svgIcone('pino')}<div class="end">${esc(V.end())}</div></div>` : ''}
            ${V.tel() ? `<div class="lin">${svgIcone('telefone')}<div class="tel">${esc(V.tel())}</div></div>` : ''}
            ${l ? `<div class="link">${esc(l)}</div>` : ''}
            ${carimbo()}
          </div>
          ${l ? `<div class="qr-bloco">${qr()}<div class="leg">extra, nunca essencial</div></div>` : ''}
        </div>
      </div>`;
    }
  },

  {
    id: 'placa', fam: 1, titulo: 'Placa de rua', fmt: 'A3 retrato · 297 × 420 mm',
    w: 297, h: 420, un: 'mm',
    nota: 'Legível de um carro a passar. Só o nome, três marcas e a seta — mais do que isso ninguém lê a 15 m.',
    html: () => `<div class="folha f-placa">
      <div class="topo-c">
        <div class="tipo">${esc(V.tipo())}</div>
        <div class="nome preta">${esc(V.nome())}</div>
      </div>
      <div class="tres">${V.precisa3().map(i => mi(i)).join('')}</div>
      <div class="seta-caixa">${svgIcone('seta', `transform:rotate(${DIRS[S.setaDir]}deg)`)}</div>
      <div class="pe">
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2mm">
          ${V.end() ? `<div class="end">${esc(V.end())}</div>` : ''}
          ${V.hor() ? `<div class="hor">${esc(V.hor())}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2mm">
          ${V.tel() ? `<div class="tel preta">${esc(V.tel())}</div>` : ''}
          ${carimbo('grande')}
        </div>
      </div>
    </div>`
  },

  {
    id: 'wa-post', fam: 1, titulo: 'Post de WhatsApp', fmt: '1080 × 1350 px',
    w: 1080, h: 1350, un: 'px', ecra: true,
    nota: 'O artefacto mais partilhado de todos. Sai como imagem, não como impressão.',
    html: () => waHTML('post')
  },

  {
    id: 'wa-status', fam: 1, titulo: 'Status de WhatsApp', fmt: '1080 × 1920 px',
    w: 1080, h: 1920, un: 'px', ecra: true,
    nota: 'Recorte diferente, muito usado no Brasil e quase sempre esquecido. Mesma informação — nunca um corte do post.',
    html: () => waHTML('status')
  },

  {
    id: 'panfleto', fam: 1, titulo: 'Panfleto', fmt: 'A6 · 4-up numa folha A4',
    w: 210, h: 297, un: 'mm',
    nota: 'Entregue na rua. Uma folha dá quatro, cortados com tesoura.',
    html: () => {
      const um = `<div class="pf">
        <div class="topo-c">
          <div class="tipo">${esc(V.tipo())}</div>
          <div class="nome preta">${esc(V.nome())}</div>
          ${V.hor() ? `<div class="horas">${esc(V.hor())}</div>` : ''}
        </div>
        <div class="corpo">
          <div class="h">Precisamos</div>
          <div class="g8">${V.precisa8().map(i => `<div>${svgIcone(i.id)}</div>`).join('')}</div>
        </div>
        <div style="flex:none;display:flex;flex-direction:column;gap:1.5mm">
          <div class="h nao">Não traga</div>
          <div class="recusas">${V.nao().map(i => svgProibido(i.id)).join('')}</div>
        </div>
        <div class="pe">
          <div class="dados">
            ${V.end() ? `<div class="end">${esc(V.end())}</div>` : ''}
            ${V.tel() ? `<div class="tel">${esc(V.tel())}</div>` : ''}
            ${carimbo('mini')}
          </div>
          ${qr()}
        </div>
      </div>`;
      return `<div class="folha f-panfleto">
        <div class="quadro">${um.repeat(4)}</div>
        ${cortes([105], [148.5], [105, 148.5])}
      </div>`;
    }
  },

  /* ===== FAMÍLIA 2 — OPERAR (dentro do centro) =========================== */
  {
    id: 'etiqueta', fam: 2, titulo: 'Etiquetas de caixa', fmt: 'A5 paisagem · 2-up em A4',
    w: 210, h: 297, un: 'mm', multi: true,
    nota: 'Um item, uma marca enorme, uma palavra. Colada na caixa, um voluntário separa sem perguntar. É aqui que uma folha barata resolve o gargalo verdadeiro.',
    folhas: () => {
      const itens = V.precisa10();
      const out = [];
      for (let i = 0; i < Math.max(itens.length, 1); i += 2) out.push(itens.slice(i, i + 2));
      return out.map(par => `<div class="folha f-etiqueta">
        <div class="quadro">${[0, 1].map(k => {
          const it = par[k];
          if (!it) return '<div class="et"></div>';
          return `<div class="et">
            <div class="caixa">${svgIcone(it.id)}<div class="palavra preta">${esc(it.rotulo)}</div></div>
            <div class="pe"><div class="centro">${esc(V.nome())}</div><div class="nota">só este item nesta caixa</div></div>
          </div>`;
        }).join('')}</div>
        ${cortes([], [148.5])}
      </div>`);
    }
  },

  {
    id: 'mesa', fam: 2, titulo: 'Sinal da mesa de triagem', fmt: 'A4 paisagem · 297 × 210 mm',
    w: 297, h: 210, un: 'mm',
    nota: 'Quem recusa uma doação deixa de estar sozinho: a decisão passa a ser da folha.',
    html: () => `<div class="folha f-mesa">
      <div class="topo-c">
        <div class="titulo preta">MESA DE TRIAGEM</div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:1mm;min-width:0">
          <div class="centro">${esc(V.nome())}</div>
          ${carimbo()}
        </div>
      </div>
      <div class="duas">
        <div class="lado lado-sim">
          <div class="cabeca">${svgIcone('aberto', 'color:var(--permitido)')}<div class="h preta">PODEMOS RECEBER</div></div>
          <div class="g3">${V.precisa6().map(i => mi(i)).join('')}</div>
        </div>
        <div class="fio-v"></div>
        <div class="lado lado-nao">
          <div class="cabeca">
            ${svgAnel()}
            <div class="h preta">NÃO PODEMOS</div>
          </div>
          <div class="g2">${V.nao().map(i => mi(i, true)).join('')}</div>
        </div>
      </div>
      <div class="protege">Quem está a recusar uma doação está a seguir esta folha. Não é uma decisão pessoal — e é para isso que ela está aqui.</div>
    </div>`
  },

  {
    id: 'seta', fam: 2, titulo: 'Seta de orientação', fmt: 'A4 retrato · seta rotativa',
    w: 210, h: 297, un: 'mm',
    nota: 'A seta roda em passos de 90°; o papel nunca se roda, senão o texto fica de lado.',
    html: () => `<div class="folha f-seta">
      <div class="palavra preta">${esc(S.setaTexto || 'DOAÇÕES')}</div>
      <div class="caixa">${svgIcone('seta', `transform:rotate(${DIRS[S.setaDir]}deg)`)}</div>
      <div class="pe"><div class="centro">${esc(V.nome())}</div><div class="nota">a seta roda, o papel não</div></div>
    </div>`
  },

  {
    id: 'horario', fam: 2, titulo: 'Cartão de horário', fmt: 'A5 retrato · 148 × 210 mm',
    w: 148, h: 210, un: 'mm',
    nota: 'Para a porta quando o centro está fechado. Sem isto, as pessoas deixam sacos à porta.',
    html: () => `<div class="folha f-horario">
      <div class="topo-c">
        <div class="tipo">${esc(V.tipo())}</div>
        <div class="nome preta">${esc(V.nome())}</div>
      </div>
      <div class="meio">
        ${svgIcone('fechado')}
        <div class="frase preta">${esc(S.fechadoTexto || 'Fechado agora')}</div>
      </div>
      <div class="pe">
        ${V.hor() ? `<div class="lin">${svgIcone('relogio')}<div class="hor">${esc(V.hor())}</div></div>` : ''}
        ${V.tel() ? `<div class="lin">${svgIcone('telefone')}<div class="tel">${esc(V.tel())}</div></div>` : ''}
        <div class="nota">Se for urgente, ligue — alguém responde.</div>
      </div>
    </div>`
  },

  /* ===== FAMÍLIA 3 — LEVAR (sai com a pessoa) ============================ */
  {
    id: 'cartao', fam: 3, titulo: 'Cartão de visita', fmt: '85 × 55 mm · 10-up em A4',
    w: 210, h: 297, un: 'mm',
    nota: 'Cabe na carteira. Sem marcas: a 85 mm o ícone competiria com o telefone, e o telefone ganha.',
    html: () => {
      const um = `<div class="cv">
        <div class="nome preta">${esc(V.nome())}</div>
        <div class="risco"></div>
        <div class="meio">
          ${V.end() ? `<div class="end">${esc(V.end())}</div>` : ''}
          ${V.hor() ? `<div class="hor">${esc(V.hor())}</div>` : ''}
        </div>
        <div class="pe">
          <div class="dados">
            ${V.tel() ? `<div class="tel">${esc(V.tel())}</div>` : ''}
            ${V.link() ? `<div class="link">${esc(V.link())}</div>` : ''}
          </div>
          ${qr()}
        </div>
      </div>`;
      return `<div class="folha f-cartao">
        <div class="quadro">${um.repeat(10)}</div>
        ${cortes([20, 105, 190], [11, 66, 121, 176, 231, 286])}
      </div>`;
    }
  },

  {
    id: 'tiras', fam: 3, titulo: 'Cartaz de tiras', fmt: 'A4 · 8 tiras para rasgar',
    w: 210, h: 297, un: 'mm',
    nota: 'O formato de sempre. Corte as tiras com tesoura antes de afixar — uma tira só se rasga se já tiver corte.',
    html: () => `<div class="folha f-tiras">
      <div class="topo-c">
        <div class="tipo">${esc(V.tipo())}</div>
        <div class="nome preta">${esc(V.nome())}</div>
        ${V.hor() ? `<div class="horas">${esc(V.hor())}</div>` : ''}
      </div>
      <div class="corpo">
        <div class="h preta">PRECISAMOS HOJE</div>
        <div class="g4">${V.precisa8().map(i => mi(i)).join('')}</div>
      </div>
      <div class="leve"><b>Leve o contacto</b>${carimbo()}</div>
      <div class="tiras">${Array.from({ length: 8 }, () =>
        `<div class="tira"><span>${esc(V.tel() || V.nome())}</span></div>`).join('')}</div>
    </div>`
  },

  {
    id: 'guiao', fam: 3, titulo: 'Cartão de guião do voluntário', fmt: 'A6 · 105 × 148,5 mm',
    w: 105, h: 148.5, un: 'mm',
    nota: 'O que dizer ao recusar uma doação, com jeito. A parte mais difícil do trabalho, feita por alguém no primeiro turno. Sem marcas e sem vermelho: é para ser lido, não visto.',
    html: () => {
      const falas = [
        '“Obrigado por ter vindo até aqui.”',
        '“Hoje não podemos receber isto — não temos onde guardar e molhado estraga-se.”',
        '“O que faz falta hoje está nesta folha.” <em>(aponte para o cartaz)</em>',
        '“Leve este cartão e ligue antes de voltar — assim não carrega em vão.”'
      ];
      return `<div class="folha f-guiao">
        <div class="topo-c">
          <div class="titulo preta">RECUSAR COM JEITO</div>
          <div class="sub">Quatro falas. Diga-as por esta ordem.</div>
        </div>
        <div class="falas">${falas.map((f, i) => `<div class="fala"><b>${i + 1}</b><p>${f}</p></div>`).join('')}</div>
        <div class="pe">
          <b>Se insistirem</b>
          <span>Chame a coordenação. A decisão é da folha, não é sua.</span>
        </div>
      </div>`;
    }
  },

  /* ===== IDENTIFICAÇÃO =================================================== */
  {
    id: 'cracha', fam: 4, titulo: 'Crachás', fmt: '90 × 60 mm · 8-up em A4',
    w: 210, h: 297, un: 'mm',
    nota: 'Imprima em papel comum e cole em cartão de caixa: aguenta um turno. O nome escreve-se à mão.',
    html: () => {
      const cells = Array.from({ length: 8 }, (_, i) => {
        const f = FUNCOES[i % FUNCOES.length];
        return `<div class="cr">
          <div class="esq"><div class="furo"></div>${svgIcone('pessoa')}</div>
          <div class="dir">
            <div class="funcao">${esc(f)}</div>
            <div class="linha-nome"><div class="risco"></div><span>nome</span></div>
            <div class="pe"><div class="centro">${esc(V.nome())}</div><div class="turno">turno ${String(i + 1).padStart(2, '0')}</div></div>
          </div>
        </div>`;
      }).join('');
      return `<div class="folha f-cracha">
        <div class="quadro">${cells}</div>
        ${cortes([15, 105, 195], [28.5, 88.5, 148.5, 208.5, 268.5])}
      </div>`;
    }
  },

  {
    id: 'faixa', fam: 4, titulo: 'Faixas de braço', fmt: '210 × 99 mm · 3-up em A4',
    w: 210, h: 297, un: 'mm',
    nota: 'Legível a 10 m, que é a distância a que alguém procura quem manda. Dobre a 25 mm de cada topo.',
    html: () => `<div class="folha f-faixa">
      <div class="quadro">${['COORDENAÇÃO', 'TRIAGEM', 'VOLUNTÁRIO'].map(f => `<div class="fx">
        ${svgIcone('pessoa')}
        <div class="dir"><div class="funcao preta">${esc(f)}</div><div class="centro">${esc(V.nome())}</div></div>
      </div>`).join('')}</div>
      ${cortes([], [99, 198])}
    </div>`
  }
];

const FAMILIAS = [
  { n: 0, nome: 'Comece por aqui', desc: 'Uma folha que explica o resto. Imprima-a primeiro e pregue-a na parede do fundo.' },
  { n: 1, nome: 'Família 1 · Anunciar', desc: 'Virado para fora. Se só imprimir uma coisa, imprima o cartaz de porta.' },
  { n: 2, nome: 'Família 2 · Operar', desc: 'Dentro do centro. Ninguém faz estas peças, e separar doações é o gargalo verdadeiro.' },
  { n: 3, nome: 'Família 3 · Levar', desc: 'Sai com a pessoa e volta amanhã sabendo o que trazer.' },
  { n: 4, nome: 'Identificação', desc: 'É isto que faz a recusa da mesa de triagem funcionar: um estranho a dizer não é uma discussão, um voluntário identificado é o centro a dizer não.' }
];

/* ---------------------------------------------------------------------------
 * WhatsApp em HTML (a versão de ecrã; o canvas desenha o mesmo)
 * -------------------------------------------------------------------------*/
function waHTML(qual) {
  const st = qual === 'status';
  return `<div class="folha f-wa ${st ? 'f-wa-status' : 'f-wa-post'}">
    ${st ? '<div class="zona zona-topo">zona da interface — nada aqui</div><div class="zona zona-base">zona da interface — nada aqui</div>' : ''}
    <div class="topo-c">
      <div class="tipo">${esc(V.tipo())}</div>
      <div class="nome preta">${esc(V.nome())}</div>
      ${V.hor() ? `<div class="horas">${esc(V.hor())}</div>` : ''}
    </div>
    <div class="sec-precisa">
      <div class="cabeca">${st ? '' : svgIcone('aberto', 'color:var(--permitido)')}<div class="h preta">PRECISAMOS HOJE</div></div>
      <div class="g-precisa">${V.precisa8().map(i => mi(i)).join('')}</div>
    </div>
    <div class="sec-nao">
      <div class="cabeca">${st ? '' : svgAnel()}<div class="h preta">NÃO TRAGA</div></div>
      <div class="g-nao">${V.nao().map(i => mi(i, true)).join('')}</div>
    </div>
    <div class="pe">
      <div class="dados">
        ${V.end() ? `<div class="end">${esc(V.end())}</div>` : ''}
        ${V.tel() ? `<div class="tel">${esc(V.tel())}</div>` : ''}
      </div>
      <div class="pe-dir">
        ${!st && V.link() ? `<div class="link">${esc(V.link())}</div>` : ''}
        ${carimbo('wa')}
      </div>
    </div>
  </div>`;
}

/* ---------------------------------------------------------------------------
 * IMAGEM PARA WHATSAPP — desenhada em canvas
 *
 * Porquê canvas e não uma fotografia do HTML: sem biblioteca externa, o
 * ficheiro continua a ser um só, e o resultado é igual em qualquer aparelho.
 * Fotografar o DOM (svg + foreignObject) falha no Safari e perde as fontes.
 *
 * As marcas são Path2D a partir do mesmo `d` que o SVG usa — uma só fonte de
 * verdade para o desenho, no ecrã e na imagem.
 * -------------------------------------------------------------------------*/
async function desenharCanvas(qual) {
  const st = qual === 'status';
  const W = 1080, H = st ? 1920 : 1350;
  const pad = st ? { t: 260, b: 380, x: 72 } : { t: 64, b: 64, x: 64 };
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');

  const preta = px => `400 ${px}px "Archivo Black", Archivo, sans-serif`;
  const arch = (px, w) => `${w} ${px}px Archivo, "Helvetica Neue", Arial, sans-serif`;
  const TINTA = '#16130F', VERM = S.mono ? '#16130F' : '#C8102E', VERDE = S.mono ? '#16130F' : '#007A33';
  const T2 = '#3B3831';

  await fontesProntas();

  c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);

  const x0 = pad.x, larg = W - pad.x * 2;
  let y = pad.t;
  const fio = (yy, esp) => { c.fillStyle = TINTA; c.fillRect(x0, yy, larg, esp); };

  /* --- cabeçalho --- */
  c.textBaseline = 'alphabetic';
  c.fillStyle = T2; c.font = arch(st ? 26 : 24, 700);
  y += st ? 26 : 24;
  espacado(c, V.tipo().toUpperCase(), x0, y, (st ? 26 : 24) * 0.18);
  y += st ? 10 : 8;

  const nomePx = st ? 120 : 104;
  c.fillStyle = TINTA; c.font = preta(nomePx);
  const linhasNome = quebrar(c, V.nome(), larg, 2);
  linhasNome.forEach(l => { y += nomePx * (st ? 0.9 : 0.92); c.fillText(l, x0, y); });

  if (V.hor()) {
    const hp = st ? 46 : 40;
    c.font = arch(hp, 800); c.fillStyle = TINTA;
    y += hp * 1.1 + (st ? 10 : 8);
    c.fillText(cortar(c, V.hor().toUpperCase(), larg), x0, y);
  }
  y += st ? 26 : 22;
  fio(y, st ? 12 : 10);
  y += st ? 12 : 10;

  /* --- rodapé medido primeiro: as secções ficam com o que sobra --- */
  const peAlt = medirPe(c, st);
  const peY = H - pad.b - peAlt;

  const dispon = peY - y - (st ? 12 : 10);
  const gapSec = st ? 12 : 10;
  const altPrecisa = (dispon - gapSec) * (st ? 1.6 : 1.8) / ((st ? 1.6 : 1.8) + 1);
  const altNao = dispon - gapSec - altPrecisa;

  y = secao(c, {
    y, alt: altPrecisa, x0, larg, st,
    titulo: 'PRECISAMOS HOJE', cor: TINTA, marca: st ? null : { id: 'aberto', cor: VERDE },
    itens: V.precisa8(), prob: false, minCol: st ? 200 : 190,
    gapX: st ? 26 : 22, gapY: st ? 22 : 18, rotPx: st ? 26 : 24,
    verm: VERM
  });

  y += gapSec;
  fio(y, st ? 12 : 10);
  y += st ? 12 : 10;

  secao(c, {
    y, alt: altNao, x0, larg, st,
    titulo: 'NÃO TRAGA', cor: VERM, marca: st ? null : { anel: true, cor: VERM },
    itens: V.nao(), prob: true, minCol: st ? 180 : 170,
    gapX: st ? 24 : 20, gapY: st ? 16 : 12, rotPx: st ? 24 : 22,
    verm: VERM
  });

  /* --- rodapé --- */
  fio(peY - (st ? 12 : 10), st ? 12 : 10);
  let fy = peY;
  if (V.end()) {
    const p = st ? 30 : 28;
    c.fillStyle = TINTA; c.font = arch(p, 700);
    fy += p; c.fillText(cortar(c, V.end(), larg), x0, fy); fy += p * 0.2 + 6;
  }
  if (V.tel()) {
    const p = st ? 52 : 44;
    c.fillStyle = TINTA; c.font = arch(p, 800);
    fy += p; c.fillText(cortar(c, V.tel(), larg), x0, fy);
  }
  if (!st && V.link()) {
    c.fillStyle = T2; c.font = '400 20px ui-monospace, monospace';
    c.textAlign = 'right';
    c.fillText(cortar(c, V.link(), larg * 0.45), x0 + larg, H - pad.b - 4);
    c.textAlign = 'left';
  }

  return cv;
}

function medirPe(c, st) {
  let h = st ? 26 : 22;
  if (V.end()) h += (st ? 30 : 28) * 1.2 + 6;
  if (V.tel()) h += (st ? 52 : 44) * 1.05;
  return Math.max(h, st ? 110 : 96);
}

/**
 * Uma secção: cabeça (marca + título) e uma grelha de itens.
 * A grelha replica `repeat(auto-fit, minmax(min, 1fr))` do CSS — o número de
 * colunas é o que cabe, e nunca mais do que há itens.
 */
function secao(c, o) {
  const cabPx = o.st ? 64 : 56;
  let y = o.y;

  if (o.marca) {
    const s = cabPx;
    if (o.marca.anel) desenharAnel(c, o.x0, y, s, o.marca.cor);
    else desenharPath(c, POR_ID[o.marca.id].d, o.x0, y, s, o.marca.cor);
    c.fillStyle = o.cor;
    c.font = `400 ${cabPx}px "Archivo Black", Archivo, sans-serif`;
    c.fillText(o.titulo, o.x0 + s + 16, y + cabPx * 0.78);
  } else {
    c.fillStyle = o.cor;
    c.font = `400 ${cabPx}px "Archivo Black", Archivo, sans-serif`;
    c.fillText(o.titulo, o.x0, y + cabPx * 0.78);
  }
  y += cabPx + (o.st ? 18 : 14);

  const n = o.itens.length;
  if (!n) return o.y + o.alt;
  const maxCols = Math.max(1, Math.floor((o.larg + o.gapX) / (o.minCol + o.gapX)));
  const cols = Math.min(maxCols, n);
  const rows = Math.ceil(n / cols);
  const cw = (o.larg - o.gapX * (cols - 1)) / cols;
  /* O fundo da secção é onde começa o fio seguinte. Sem esta folga o
     rótulo da última linha encosta ao fio e parece cortado. */
  const altGrelha = o.y + o.alt - y - (o.st ? 28 : 22);
  const ch = (altGrelha - o.gapY * (rows - 1)) / rows;

  o.itens.forEach((it, i) => {
    const cx = o.x0 + (i % cols) * (cw + o.gapX);
    const cy = y + Math.floor(i / cols) * (ch + o.gapY);

    /* O rótulo primeiro (fica em baixo), depois a marca no que sobra. */
    c.font = `700 ${o.rotPx}px Archivo, sans-serif`;
    const ls = quebrar(c, it.rotulo.toUpperCase(), cw, 2);
    const altRot = ls.length * o.rotPx * 1.05;
    const altIco = Math.max(20, ch - altRot - 8);
    const s = Math.min(altIco, cw);

    if (o.prob) desenharProibido(c, it.id, cx + (cw - s) / 2, cy, s, o.verm);
    else desenharPath(c, POR_ID[it.id] ? POR_ID[it.id].d : POR_ID.caixa.d, cx + (cw - s) / 2, cy, s, '#16130F');

    c.fillStyle = '#16130F';
    c.textAlign = 'center';
    let ty = cy + altIco + 8;
    ls.forEach(l => { ty += o.rotPx * 0.85; c.fillText(l, cx + cw / 2, ty); ty += o.rotPx * 0.2; });
    c.textAlign = 'left';
  });

  return o.y + o.alt;
}

/** Desenha um `d` de 64×64 em (x,y) com lado `s`. */
function desenharPath(c, d, x, y, s, cor) {
  c.save();
  c.translate(x, y); c.scale(s / 64, s / 64);
  c.fillStyle = cor;
  c.fill(new Path2D(d), 'evenodd');
  c.restore();
}

function desenharAnel(c, x, y, s, cor) {
  c.save();
  c.translate(x, y); c.scale(s / 64, s / 64);
  c.fillStyle = cor;
  c.fill(new Path2D(ANEL_D), 'evenodd');
  c.translate(32, 32); c.rotate(Math.PI / 4); c.translate(-32, -32);
  c.fillRect(BARRA.x, BARRA.y, BARRA.w, BARRA.h);
  c.restore();
}

function desenharProibido(c, id, x, y, s, verm) {
  const ic = POR_ID[id] || POR_ID.caixa;
  c.save();
  c.translate(x, y); c.scale(s / 64, s / 64);
  c.save();
  c.translate(9.6, 9.6); c.scale(0.7, 0.7);
  c.fillStyle = '#16130F';
  c.fill(new Path2D(ic.d), 'evenodd');
  c.restore();
  c.fillStyle = verm;
  c.fill(new Path2D(ANEL_D), 'evenodd');
  c.translate(32, 32); c.rotate(Math.PI / 4); c.translate(-32, -32);
  c.fillRect(BARRA.x, BARRA.y, BARRA.w, BARRA.h);
  c.restore();
}

/** Texto com espaçamento entre letras — o canvas não tem letter-spacing fiável. */
function espacado(c, texto, x, y, esp) {
  let cx = x;
  for (const ch of String(texto)) { c.fillText(ch, cx, y); cx += c.measureText(ch).width + esp; }
}

function quebrar(c, texto, largura, maxLinhas) {
  const palavras = String(texto).split(/\s+/).filter(Boolean);
  const linhas = [];
  let linha = '';
  palavras.forEach(p => {
    const t = linha ? linha + ' ' + p : p;
    if (c.measureText(t).width > largura && linha) { linhas.push(linha); linha = p; }
    else linha = t;
  });
  if (linha) linhas.push(linha);
  const max = maxLinhas || 99;
  if (linhas.length <= max) return linhas;
  const corte = linhas.slice(0, max);
  corte[max - 1] = cortar(c, corte[max - 1] + ' ' + linhas.slice(max).join(' '), largura);
  return corte;
}

function cortar(c, texto, largura) {
  let t = String(texto);
  if (c.measureText(t).width <= largura) return t;
  while (t.length > 1 && c.measureText(t + '…').width > largura) t = t.slice(0, -1);
  return t + '…';
}

/* As fontes estão embutidas no ficheiro, mas o browser só as parseia quando
   alguém as usa. Sem esperar, o primeiro canvas sai em Helvetica. */
async function fontesProntas() {
  if (!document.fonts || !document.fonts.load) return;
  try {
    await Promise.all([
      document.fonts.load('400 104px "Archivo Black"'),
      document.fonts.load('700 24px Archivo'),
      document.fonts.load('800 44px Archivo')
    ]);
    await document.fonts.ready;
  } catch (e) { /* segue com a fonte de recurso */ }
}

/* ---------------------------------------------------------------------------
 * Formulário
 * -------------------------------------------------------------------------*/
function montarForm() {
  const set = (id, v) => { const el = document.getElementById(id); if (el && el.value !== v) el.value = v; };
  set('f-slug', S.slug); set('f-codigo', S.codigo);
  set('f-nome', S.nome); set('f-tipo', S.tipo); set('f-endereco', S.endereco);
  set('f-horario', S.horario); set('f-contato', S.contato); set('f-link', S.link);
  set('f-seta-texto', S.setaTexto); set('f-seta-dir', S.setaDir);
  set('f-fechado', S.fechadoTexto);

  document.getElementById('grupos').innerHTML = GRUPOS.map(g => `
    <fieldset class="grupo">
      <legend>${esc(g.g)}</legend>
      <div class="chips">
        ${g.ids.map(id => {
          const on = S.precisa.some(v => idDe(v) === id);
          return `<button type="button" class="chip${on ? ' on' : ''}" aria-pressed="${on}"
            data-tog="${id}">${svgIcone(id)}<span>${esc(ROTULO_BR[id])}</span></button>`;
        }).join('')}
      </div>
    </fieldset>`).join('');

  const linhas = (lista, tipo) => lista.length ? lista.map((v, i) => {
    const it = item(v);
    return `<li class="${it.semMarca ? 'generico' : ''}">
      ${svgIcone(it.id)}
      <span>${esc(it.rotulo)}</span>
      ${tipo === 'precisa' ? `<input class="q" type="text" inputmode="numeric"
        value="${esc(it.q)}" maxlength="12" placeholder="qtd"
        data-q="${i}" aria-label="Quantidade de ${esc(it.rotulo)}">` : ''}
      <span class="li-acoes">
        ${it.livre ? `<button type="button" class="marca" data-marca="${i}" data-l="${tipo}"
          aria-label="Escolher marca para ${esc(it.rotulo)}"
          title="Escolher marca">${it.semMarca ? 'marca?' : 'marca'}</button>` : ''}
        ${tipo === 'precisa' ? `<button type="button" data-mv="${i}" data-d="-1" aria-label="Subir ${esc(it.rotulo)}" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" data-mv="${i}" data-d="1" aria-label="Descer ${esc(it.rotulo)}" ${i === lista.length - 1 ? 'disabled' : ''}>↓</button>` : ''}
        <button type="button" class="rm" data-rm="${i}" data-l="${tipo}" aria-label="Remover ${esc(it.rotulo)}">✕</button>
      </span></li>`;
  }).join('') : `<li class="vazio">Nada escolhido ainda.</li>`;

  document.getElementById('lista-precisa').innerHTML = linhas(S.precisa, 'precisa');
  document.getElementById('lista-nao').innerHTML = linhas(S.naoTraga, 'nao');

  const n = S.precisa.length;
  const av = document.getElementById('aviso-itens');
  av.hidden = n <= 10;
  document.getElementById('n-itens').textContent = n;

  const livres = S.precisa.filter(v => typeof v !== 'string').length;
  const al = document.getElementById('aviso-livres');
  al.hidden = !livres;
  document.getElementById('n-livres').textContent = livres;

  document.getElementById('b-mono').setAttribute('aria-pressed', String(!!S.mono));
  document.getElementById('b-cortes').setAttribute('aria-pressed', String(!!S.cortes));

  const pausa = document.getElementById('f-pausado');
  pausa.checked = !!S.pausado;
  document.getElementById('linha-motivo').hidden = !S.pausado;
  document.getElementById('bloco-precisa').classList.toggle('esmaecido', !!S.pausado);
}

/* ---------------------------------------------------------------------------
 * Peças no ecrã
 * -------------------------------------------------------------------------*/
function render() {
  const raiz = document.getElementById('pecas');
  raiz.innerHTML = FAMILIAS.map(f => {
    const lista = PECAS.filter(p => p.fam === f.n);
    /* A primeira peça de cada família manda: é a que se imprime se só se
       imprimir uma. Dar-lhe o mesmo tamanho das outras seria esconder isso. */
    const [primeira, ...resto] = lista;
    return `<section class="familia">
      <h2>${esc(f.nome)} <span class="conta">${lista.length}</span></h2>
      <p>${esc(f.desc)}</p>
      ${primeira ? cartao(primeira, true) : ''}
      ${resto.length ? `<div class="pecas">${resto.map(p => cartao(p)).join('')}</div>` : ''}
    </section>`;
  }).join('');

  document.body.classList.toggle('mono', !!S.mono);
  document.body.classList.toggle('sem-cortes', !S.cortes);
  escalar();
  ajustarCartaz();
}

/** A escala a que a folha está desenhada no ecrã. */
function escalaDe(folha) {
  return parseFloat(getComputedStyle(folha).getPropertyValue('--escala')) || 1;
}

/** A menor marca do cartaz, em milímetros de papel. */
function marcaMinima(raiz) {
  const f = raiz.querySelector('.folha');
  if (!f) return Infinity;
  const k = escalaDe(f);
  const svgs = [...raiz.querySelectorAll('.grade-precisa .marca-item svg')];
  if (!svgs.length) return Infinity;
  return Math.min(...svgs.map(s => s.getBoundingClientRect().height)) / k / MM;
}

/**
 * Tira itens do cartaz até a marca subir acima do piso.
 *
 * Custa alguns redesenhos de um elemento, uma vez por edição. É barato ao pé
 * do que evita: cem folhas impressas com marcas que ninguém lê a dois metros.
 */
function ajustarCartaz() {
  const peca = document.getElementById('peca-cartaz');
  if (!peca) return;
  const wrap = peca.querySelector('.folha-wrap');
  const total = S.precisa.length;
  const alvo = PECAS.find(x => x.id === 'cartaz');

  for (CAP_CARTAZ = Math.min(total, 10); CAP_CARTAZ >= 3; CAP_CARTAZ--) {
    wrap.innerHTML = alvo.html();
    escalar();
    if (marcaMinima(peca) >= PISO_MM || CAP_CARTAZ <= 3) break;
  }

  const cortados = Math.max(0, total - CAP_CARTAZ);
  const nota = peca.querySelector('p');
  if (nota) {
    nota.innerHTML = esc(alvo.nota) +
      (cortados
        ? ` <b>Só ${CAP_CARTAZ} dos ${total} itens cabem</b> sem a marca descer de ${PISO_MM}&nbsp;mm — ` +
          `os ${cortados} últimos ficam de fora deste cartaz. Ponha o mais urgente em primeiro, ` +
          `ou faça um segundo cartaz.`
        : '');
  }
}

function cartao(p, destaque) {
  const folhas = p.folhas ? p.folhas() : [p.html()];
  const classes = ['peca'];
  if (destaque) classes.push('destaque');
  /* "Larga" é sobre papel, não sobre píxeis: uma peça de papel mais larga do
     que A4 retrato fica ilegível numa coluna estreita e ocupa a linha toda.
     As peças de WhatsApp são altas e estreitas e cabem na grelha normal. */
  if (p.un === 'mm' && p.w > 210) classes.push('larga');

  /* Duas acções e não uma.
     Imprimir logo é o que se quer quando falta UMA peça — o cartaz caiu da
     porta, precisa de outro. A lista é para o resto do tempo: escolhem-se seis
     peças com calma e vão todas num trabalho de impressão só, o que poupa
     idas à impressora e, mais importante, evita ficar com metade do conjunto
     porque alguém foi interrompido a meio.
     As peças de WhatsApp não entram na lista: não são papel. */
  const naLista = LISTA.has(p.id);
  const acao = p.ecra
    ? `<button type="button" class="acao" data-img="${p.id}">Gerar imagem</button>`
    : `<button type="button" class="acao" data-print="${p.id}">Imprimir já</button>
       <button type="button" class="acao acao-lista${naLista ? ' dentro' : ''}"
         data-lista="${p.id}" aria-pressed="${naLista}">${
         naLista ? '✓ Na lista' : '+ Juntar à lista'}</button>`;

  /* Uma peça multi-folha — dez etiquetas de caixa são cinco folhas — mostra
     só a primeira. Todas ficam no DOM porque todas têm de sair na impressão;
     o que não pode acontecer é a galeria virar um rolo de dois metros por
     causa de uma peça que é sempre a mesma folha com outro item. */
  const chapas = folhas.map(h =>
    `<div class="folha-wrap" data-w="${p.w}" data-h="${p.h}" data-un="${p.un}">${h}</div>`).join('') +
    (folhas.length > 1
      ? `<div class="mais-folhas">${folhas.length - 1 === 1
          ? '+1 folha igual'
          : `+${folhas.length - 1} folhas iguais`}, com os outros itens</div>`
      : '');

  return `<article class="${classes.join(' ')}" id="peca-${p.id}" data-peca="${p.id}">
    <div class="peca-corpo">
      <div class="moldura">${chapas}</div>
      <div class="peca-txt">
        <header>
          <h3>${esc(p.titulo)}</h3>
          <span class="fmt">${esc(p.fmt)}${folhas.length > 1 ? ` · ${folhas.length} folhas` : ''}</span>
        </header>
        <p>${esc(p.nota)}</p>
        <div class="peca-acoes">${acao}</div>
      </div>
    </div>
  </article>`;
}

/**
 * Encolhe cada folha para caber na moldura, sem lhe tocar nas medidas.
 *
 * A folha continua a ter as medidas reais em milímetros — só é vista mais
 * pequena. É por isso que a impressão sai certa mesmo com a pré-visualização
 * encolhida, e é a razão de o `transform:scale()` existir aqui em vez de haver
 * duas medidas para a mesma peça.
 *
 * Duas armadilhas, ambas já pagas:
 *
 * 1. `clientWidth` INCLUI o padding. A moldura tem 8 px de cada lado, por isso
 *    medir assim desenhava todas as quinze peças 17 px mais largas do que a
 *    caixa que as segura — a folha passava por cima da moldura à direita e em
 *    baixo. Parecia um problema de A4 contra Letter e não era: era isto.
 * 2. Cabe na largura não é cabe. Encolher só pela largura dá molduras de
 *    alturas todas diferentes — um A3 retrato fica com o dobro da altura de um
 *    cartão. Agora usa-se o menor dos dois factores, e a folha é centrada no
 *    espaço que sobra: a grelha passa a ler-se como uma prateleira.
 */
function escalar() {
  document.querySelectorAll('.folha-wrap').forEach(w => {
    const un = w.dataset.un;
    const wpx = parseFloat(w.dataset.w) * (un === 'mm' ? MM : 1);
    const hpx = parseFloat(w.dataset.h) * (un === 'mm' ? MM : 1);

    const mold = w.parentElement;
    const cs = getComputedStyle(mold);
    const disp = (mold.clientWidth || w.clientWidth)
      - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
    if (!disp || disp <= 0) return;

    /* A altura da janela vem do CSS (--altura-previa). Sem ela — impressão, ou
       um browser que não a resolva — volta-se ao comportamento antigo de caber
       só pela largura, que nunca corta nada. */
    const alvo = parseFloat(cs.getPropertyValue('--altura-previa')) || 0;
    const k = alvo > 0 ? Math.min(disp / wpx, alvo / hpx) : disp / wpx;

    w.style.setProperty('--escala', k);
    w.style.width = disp + 'px';
    w.style.height = (alvo > 0 ? alvo : hpx * k) + 'px';
    /* Centrar o que sobra. Sem isto as folhas estreitas — o cartão de visita, a
       faixa de braço — encostavam à esquerda e a grelha ficava torta. */
    w.style.setProperty('--desvio', Math.max(0, (disp - wpx * k) / 2) + 'px');
    w.style.setProperty('--desvio-y',
      Math.max(0, ((alvo > 0 ? alvo : hpx * k) - hpx * k) / 2) + 'px');

    const f = w.querySelector('.folha');
    if (f) f.style.setProperty('--escala', k);
  });
}

/* ---------------------------------------------------------------------------
 * Imprimir uma peça
 *
 * O tamanho da página escreve-se antes de chamar print(), porque @page com
 * páginas nomeadas não é de confiança fora do Chrome — e este ficheiro tem
 * de sair certo do telemóvel de alguém sem saber qual é.
 * -------------------------------------------------------------------------*/
/* ---------------------------------------------------------------------------
 * A LISTA DE IMPRESSÃO
 *
 * Um carrinho, mas de papel. Escolhem-se as peças com calma e saem todas num
 * trabalho só.
 *
 * Vive na memória e não no localStorage de propósito: uma lista de impressão de
 * ontem que reaparece hoje faz alguém imprimir o que já tem na parede. O que
 * merece sobreviver a fechar o separador são os dados do centro, não uma
 * intenção de há dois dias.
 * -------------------------------------------------------------------------*/
const LISTA = new Set();

function alternarLista(id) {
  if (LISTA.has(id)) LISTA.delete(id); else LISTA.add(id);
  render();
  pintarLista();
}

/** A barra só existe quando há alguma coisa nela. Uma barra vazia é ruído. */
function pintarLista() {
  const b = document.getElementById('barra-lista');
  if (!b) return;
  const n = LISTA.size;
  b.hidden = n === 0;
  /* A barra é fixa e tapa o fim da página. Sem esta folga, a última peça da
     galeria fica escondida por baixo dela e parece que não existe. */
  document.body.style.paddingBottom = n ? (b.offsetHeight || 68) + 16 + 'px' : '';
  if (!n) return;
  const nomes = [...LISTA].map(id => (PECAS.find(x => x.id === id) || {}).titulo).filter(Boolean);
  const folhas = [...LISTA].reduce((t, id) => {
    const p = PECAS.find(x => x.id === id);
    return t + (p && p.folhas ? p.folhas().length : 1);
  }, 0);
  document.getElementById('lista-conta').textContent =
    `${n} ${n === 1 ? 'peça' : 'peças'} · ${folhas} ${folhas === 1 ? 'folha' : 'folhas'}`;
  document.getElementById('lista-nomes').textContent = nomes.join(' · ');
}

function imprimir(id) { imprimirVarias([id]); }

/* O conjunto inicial: o que um centro tem de ter na parede na primeira hora.
   Todas A4 retrato, por isso saem num único trabalho de impressão — o sinal
   da mesa é paisagem e por isso tem o seu próprio botão. */
const CONJUNTO_INICIAL = ['instrucoes', 'cartaz', 'etiqueta', 'panfleto'];

function imprimirVarias(ids) {
  const pecas = ids.map(id => PECAS.find(x => x.id === id)).filter(Boolean);
  if (!pecas.length || !validar()) return;

  /* Um trabalho de impressão tem um tamanho de página só. Misturar retrato e
     paisagem aqui daria uma peça cortada, e uma peça cortada é papel gasto. */
  const { w, h } = pecas[0];
  const misturado = pecas.some(p => p.w !== w || p.h !== h);
  if (misturado) {
    alert('Estas peças têm tamanhos de papel diferentes. Imprima-as uma a uma.');
    return;
  }

  let st = document.getElementById('pagina-css');
  if (!st) { st = document.createElement('style'); st.id = 'pagina-css'; document.head.appendChild(st); }
  st.textContent = `@page { size: ${w}mm ${h}mm; margin: 0 }`;

  document.querySelectorAll('.peca').forEach(el => el.classList.remove('a-imprimir'));
  pecas.forEach(p => document.getElementById('peca-' + p.id).classList.add('a-imprimir'));
  document.body.classList.add('imprimindo');

  const limpar = () => {
    document.body.classList.remove('imprimindo');
    document.querySelectorAll('.a-imprimir').forEach(el => el.classList.remove('a-imprimir'));
    window.removeEventListener('afterprint', limpar);
  };
  window.addEventListener('afterprint', limpar);
  window.print();
  setTimeout(limpar, 1500);
}

/* ---------------------------------------------------------------------------
 * Imagem: partilhar ou baixar
 * -------------------------------------------------------------------------*/
function nomeArquivo(sufixo) {
  const base = norm(S.nome || 'capem').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'capem';
  const d = new Date();
  return `${base}-${sufixo}-${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}.png`;
}

async function imagem(id, botao) {
  if (!validar()) return;
  const qual = id === 'wa-status' ? 'status' : 'post';
  const cv = await desenharCanvas(qual);
  cv.toBlob(async blob => {
    const arq = new File([blob], nomeArquivo(qual), { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [arq] })) {
      try { await navigator.share({ files: [arq], title: V.nome() }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nomeArquivo(qual);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    avisar(botao, 'Baixado');
  }, 'image/png');
}

function validar() {
  if (!S.nome.trim()) {
    alert('Escreva o nome do centro primeiro.');
    const el = document.getElementById('f-nome');
    el.focus(); el.scrollIntoView({ block: 'center' });
    return false;
  }
  return true;
}

function avisar(botao, msg) {
  const live = document.getElementById('live');
  if (live) live.textContent = msg;
  if (!botao) return;
  const antes = botao.textContent;
  botao.textContent = msg; botao.disabled = true;
  setTimeout(() => { botao.textContent = antes; botao.disabled = false; }, 2000);
}

/* ---------------------------------------------------------------------------
 * PUBLICAR
 *
 * O kit é o editor; a página web é o espelho. Não há um segundo formulário
 * algures — o coordenador aprende uma interface e não duas, e o papel na porta
 * e a página do QR não se podem contradizer porque saem do mesmo objecto.
 *
 * Isto é a única coisa neste ficheiro que fala com a rede, e é opcional: sem
 * sinal continua tudo a imprimir. Quando houver sinal, um toque.
 *
 * O servidor fica onde o ficheiro for aberto. Se o kit foi servido a partir do
 * servidor, é esse; se foi aberto de uma pen (file://), não há origem nenhuma e
 * o campo do endereço serve para a escrever.
 * -------------------------------------------------------------------------*/
/**
 * Onde fica o servidor, e qual é o endereço do centro.
 *
 * O campo do endereço aceita as duas coisas, porque as duas aparecem na vida
 * real:
 *
 *     canoas-ss                          só o nome, quando o kit veio do servidor
 *     capem.org/canoas-ss                colado da página do centro
 *     https://capem.org/canoas-ss        colado do browser
 *     canoas-ss.capem.org                se o servidor usar subdomínios
 *
 * Isto importa mais do que parece. Este ficheiro é aberto de uma pen, de um
 * anexo de e-mail, do GitHub Pages — sítios que não são o servidor. Confiar
 * só em `location.origin` fazia o kit tentar publicar no github.io e falhar
 * com um erro que não explicava nada. O endereço da página é a única coisa
 * que o coordenador tem sempre à mão: está no papel que imprimiu.
 */
function alvoPublicacao() {
  const bruto = (S.slug || '').trim();
  if (!bruto) return null;

  const origem = location.origin;
  const daPagina = (origem && origem !== 'null' && /^https?:/.test(origem)) ? origem : '';

  /* Sem ponto nem barra é só o nome: o servidor tem de ser de onde isto veio. */
  if (!/[./]/.test(bruto)) {
    return daPagina ? { base: daPagina, slug: bruto.toLowerCase() } : null;
  }

  let u;
  try { u = new URL(/^https?:\/\//.test(bruto) ? bruto : 'https://' + bruto); }
  catch (e) { return null; }

  const partes = u.pathname.split('/').filter(Boolean);
  if (partes.length) return { base: u.origin, slug: partes[partes.length - 1].toLowerCase() };

  /* Sem caminho, o nome está no subdomínio: canoas-ss.capem.org */
  const rotulos = u.hostname.split('.');
  if (rotulos.length < 3) return null;
  return {
    base: `${u.protocol}//${rotulos.slice(1).join('.')}${u.port ? ':' + u.port : ''}`,
    slug: rotulos[0].toLowerCase()
  };
}

function servidor() {
  const a = alvoPublicacao();
  if (a) return a.base;
  const o = location.origin;
  return (o && o !== 'null' && /^https?:/.test(o)) ? o : '';
}

function estadoPub(msg, tipo) {
  const el = document.getElementById('estado-pub');
  el.hidden = !msg;
  el.textContent = msg || '';
  el.className = 'estado-pub' + (tipo ? ' ' + tipo : '');
}

function estadoCarga(msg, tipo) {
  const el = document.getElementById('estado-carga');
  el.hidden = !msg;
  el.textContent = msg || '';
  el.className = 'estado-pub' + (tipo ? ' ' + tipo : '');
}

/**
 * Puxar os dados do próprio centro com o código.
 *
 * O código servia só para escrever, e isso obrigava o coordenador a preencher o
 * formulário todo outra vez em cada telemóvel novo — para depois o servidor
 * deitar fora o nome, a morada e o telefone, que não se mudam por aqui. Escrever
 * doze campos para que nove sejam ignorados não é só trabalho a mais: dá a
 * entender que se pode mudar o que foi verificado à mão.
 *
 * O que vem de lá é o que já está na página pública do centro. O código aqui não
 * está a destrancar um segredo, está a dizer *qual* centro.
 */
async function puxarDados(botao) {
  const codigo = (S.codigo || '').trim();
  const alvo = alvoPublicacao();
  if (!S.slug.trim() || !codigo) {
    estadoCarga('Escreva o endereço do centro e o código.', 'mau');
    return;
  }
  if (!alvo) {
    estadoCarga('Não percebemos esse endereço. Cole o endereço completo da página '
      + 'do seu centro — está impresso no rodapé do cartaz, algo como '
      + 'capem.org/canoas-ss.', 'mau');
    return;
  }
  const { base, slug } = alvo;
  const antes = botao.textContent;
  botao.disabled = true; botao.textContent = 'A puxar…';
  estadoCarga('');
  try {
    const r = await fetch(base + '/api/carregar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, codigo })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      estadoCarga({
        403: 'Código errado. Confira as letras — não há O nem I nem S no código.',
        404: 'Não encontrámos esse centro. Confira o endereço.',
        429: 'Demasiados pedidos. Espere um pouco.'
      }[r.status] || ('Não deu para puxar os dados' + (j.erro ? ': ' + j.erro : '.')), 'mau');
      return;
    }
    const d = j.dados || {};
    /* O que estava escrito aqui é substituído. É o que se pede a um botão com
       este nome — e o que está no servidor é o que saiu impresso da última vez,
       por isso é a versão que interessa. */
    ['nome', 'tipo', 'endereco', 'horario', 'contato', 'link'].forEach(k => {
      if (d[k] != null) S[k] = d[k];
    });
    if (Array.isArray(d.precisa)) S.precisa = d.precisa;
    if (Array.isArray(d.naoTraga)) S.naoTraga = d.naoTraga;
    S.pausado = !!d.pausado;
    S.motivoPausa = d.motivoPausa || '';
    /* Sem link não há QR. Se o centro ainda não tinha um, o endereço da própria
       página é a resposta certa e está mesmo aqui. */
    if (!String(S.link || '').trim() && j.url) S.link = j.url;
    salvar(); montarForm();

    const quantos = S.precisa.length;
    const idade = j.publicado
      ? Math.floor((Date.now() - j.publicado) / 86400000)
      : null;
    const quando = j.publicado
      ? (idade <= 0 ? 'publicada hoje'
        : idade === 1 ? 'publicada ontem'
        : `publicada há ${idade} dias`)
      : 'ainda sem lista publicada';
    estadoCarga(`${S.nome || slug} — ${quantos} ${quantos === 1 ? 'item' : 'itens'}, ${quando}. `
      + 'Confira a lista e publique quando estiver certa.', 'bom');
    if (j.estado !== 'aprovado') {
      estadoCarga(`${S.nome || slug} — dados carregados. A página fica no ar assim `
        + 'que o pedido for verificado.', 'bom');
    }
  } catch (e) {
    /* Distinguir os dois é o que evita mandar alguém procurar rede num ginásio
       por causa de um erro nosso. `fetch` só rejeita por causa da rede; tudo o
       resto que rebente aqui é código, e tem de dizer que é código.
       (Escrito depois de o catch ter engolido uma função que não existia e ter
       anunciado uma falha de ligação durante um teste em que a ligação estava
       perfeita.) */
    const rede = e instanceof TypeError;
    estadoCarga(rede
      ? 'Sem ligação ao servidor. Preencha à mão — a impressão funciona na '
        + 'mesma, e pode publicar mais tarde.'
      : 'Os dados vieram, mas alguma coisa correu mal a preenchê-los: '
        + (e && e.message ? e.message : e) + '. Confira o formulário antes de publicar.',
      'mau');
  } finally {
    botao.disabled = false; botao.textContent = antes;
  }
}

async function publicar(botao) {
  const codigo = (S.codigo || '').trim();
  const alvo = alvoPublicacao();
  if (!S.slug.trim() || !codigo) {
    estadoPub('Escreva o endereço do centro e o código.', 'mau');
    return;
  }
  if (!alvo) {
    estadoPub('Não percebemos esse endereço. Cole o endereço completo da página '
      + 'do seu centro — está impresso no rodapé do cartaz, algo como '
      + 'capem.org/canoas-ss. A impressão continua a funcionar sem isto.', 'mau');
    return;
  }
  const { base, slug } = alvo;

  const antes = botao.textContent;
  botao.disabled = true; botao.textContent = 'A publicar…';
  estadoPub('');
  try {
    const r = await fetch(base + '/api/publicar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, codigo, dados: {
        horario: S.horario, link: S.link,
        precisa: S.precisa, naoTraga: S.naoTraga,
        pausado: S.pausado, motivoPausa: S.motivoPausa
      } })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      estadoPub({
        403: 'Código errado. Confira as letras — não há O nem I nem S no código.',
        404: 'Não encontrámos esse centro. Confira o endereço.',
        429: 'Demasiados envios. Espere um pouco.'
      }[r.status] || ('Não deu para publicar' + (j.erro ? ': ' + j.erro : '.')), 'mau');
    } else if (j.estado !== 'aprovado') {
      estadoPub('Publicado. A página fica no ar assim que o pedido for verificado.', 'bom');
    } else {
      estadoPub('Publicado — ' + j.url, 'bom');
    }
    /* Fecha o círculo: o QR de todas as peças passa a apontar para a página
       que acabou de ser publicada. Sem isto o coordenador teria de copiar o
       endereço à mão para o campo do link, e a peça mais provável de ficar
       sem QR seria justamente a que mais precisa dele. */
    if (r.ok && j.url && !S.link.trim()) {
      S.link = j.url;
      salvar(); montarForm();
    }
    /* Publicar e depois não contar a ninguém não serve de nada. O momento em
       que se carrega em Publicar é o único em que o coordenador tem a lista
       fresca na cabeça e o telemóvel na mão. */
    if (r.ok && j.url) mostrarPartilha(j.url);
  } catch (e) {
    /* Sem sinal não é um erro nesta ferramenta: é o estado normal metade do
       tempo. Por isso a mensagem não pede desculpa, diz o que fazer. */
    estadoPub('Sem ligação ao servidor. O papel continua a sair; publique quando '
      + 'houver sinal.', 'mau');
  }
  botao.disabled = false; botao.textContent = antes;
}

/**
 * Um toque para mandar a lista de hoje para os grupos.
 *
 * `navigator.share` abre a folha do sistema, onde o WhatsApp é a primeira
 * coisa. Onde não existir — desktop, browsers antigos — cai para um link
 * wa.me, que faz o mesmo com mais um toque. Sem API, sem número, sem custo.
 */
function textoPartilha(url) {
  const L = [];
  L.push(`*${V.nome().toUpperCase()}* — ${S.pausado ? 'NÃO estamos recebendo agora' : 'precisamos hoje'}`);
  L.push('');
  if (!S.pausado && S.precisa.length) {
    V.precisa10().forEach(i => L.push('• ' + i.rotulo));
    L.push('');
  }
  L.push('*NÃO TRAGA:* ' + V.nao().map(i => i.rotulo).join(', '));
  L.push('');
  if (V.end()) L.push('📍 ' + V.end());
  if (V.tel()) L.push('📱 ' + V.tel());
  L.push('');
  L.push('Lista sempre atualizada: ' + url);
  return L.join('\n');
}

function mostrarPartilha(url) {
  const caixa = document.getElementById('pos-publicar');
  caixa.hidden = false;
  caixa.querySelector('.pos-url').textContent = url.replace(/^https?:\/\//, '');
}

async function partilharLista(botao) {
  const url = (S.link || '').trim();
  if (!url) return;
  const texto = textoPartilha(url);
  if (navigator.share) {
    try { await navigator.share({ text: texto }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
  avisar(botao, 'A abrir o WhatsApp');
}

/* ---------------------------------------------------------------------------
 * Texto para colar no grupo. Nenhuma integração, nenhum custo, nenhum
 * cadastro na Meta — e chega ao mesmo sítio.
 * -------------------------------------------------------------------------*/
function textoWhatsApp() {
  const L = [];
  L.push(`*${V.nome().toUpperCase()}*`);
  L.push(V.tipo());
  L.push('');
  if (S.precisa.length) {
    L.push('*PRECISAMOS HOJE:*');
    V.precisa10().forEach(i => L.push('• ' + i.rotulo));
    L.push('');
  }
  L.push('*POR FAVOR, NÃO TRAGA:* ' + V.nao().map(i => i.rotulo).join(', '));
  L.push('Não temos onde guardar — e obrigado por querer ajudar. 🙏');
  L.push('');
  if (V.end()) L.push('📍 ' + V.end());
  if (V.hor()) L.push('🕐 ' + V.hor());
  if (V.tel()) L.push('📱 ' + V.tel());
  if (V.link()) L.push('🔗 ' + V.link());
  L.push('');
  L.push('_Atualizado ' + (S.atualizado || agora()) + '_');
  return L.join('\n');
}

function copiarTexto(botao) {
  const t = textoWhatsApp();
  const ok = () => avisar(botao, 'Copiado');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(ok).catch(() => fallbackCopia(t, ok));
  } else fallbackCopia(t, ok);
}

function fallbackCopia(texto, ok) {
  const ta = document.createElement('textarea');
  ta.value = texto; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); ok(); } catch (e) { alert(texto); }
  ta.remove();
}

/* ---------------------------------------------------------------------------
 * Ligações
 * -------------------------------------------------------------------------*/
function alternar(id) {
  /* Comparar por id e não por valor: assim que um item ganha quantidade
     deixa de ser a string 'agua' e passa a { id:'agua', q:'200' }. */
  const i = S.precisa.findIndex(v => idDe(v) === id);
  if (i >= 0) S.precisa.splice(i, 1); else S.precisa.push(id);
  salvar(); montarForm();
}

function mudarQuantidade(lista, i, q) {
  const arr = S[lista === 'precisa' ? 'precisa' : 'naoTraga'];
  if (!arr[i]) return;
  arr[i] = comQuantidade(arr[i], q);
  salvar();
}
function remover(lista, i) { S[lista === 'precisa' ? 'precisa' : 'naoTraga'].splice(i, 1); salvar(); montarForm(); }
function mover(i, d) {
  const j = i + d;
  if (j < 0 || j >= S.precisa.length) return;
  [S.precisa[i], S.precisa[j]] = [S.precisa[j], S.precisa[i]];
  salvar(); montarForm();
}
function addLivre(campoId, lista) {
  const el = document.getElementById(campoId);
  const v = el.value.trim();
  if (!v) return;
  S[lista].push({ texto: v });
  el.value = '';
  salvar(); montarForm();
}
/* ---------------------------------------------------------------------------
 * Escolher a marca de um item escrito à mão.
 *
 * Vinte e nove marcas não são muitas para escolher de uma lista, e são muito
 * melhores do que uma caixa genérica: "Luva de borracha" com a marca das botas
 * diz "equipamento de borracha para os pés e mãos" a quem não lê a palavra.
 * Aproximado é melhor do que mudo.
 * -------------------------------------------------------------------------*/
let marcaAlvo = null;

function gradeMarcas(onclick) {
  const grupo = (titulo, cat) => `
    <div class="grupo-marcas">
      <h4>${esc(titulo)}</h4>
      <div class="marcas">${ICONES.filter(i => i.cat === cat).map(i => `
        <button type="button" class="marca-op"${onclick ? ` data-pick="${i.id}"` : ' disabled'}>
          ${svgIcone(i.id)}<span>${esc(ROTULO_BR[i.id] || i.rotulo)}</span>
        </button>`).join('')}</div>
    </div>`;
  return grupo('O que se precisa', 'need') +
         grupo('O que não se aceita', 'refuse') +
         grupo('Marcas de serviço', 'util');
}

function abrirMarcas(lista, i) {
  marcaAlvo = { lista, i };
  const it = item(S[lista][i]);
  document.getElementById('modal-item').textContent = `Marca para “${it.rotulo}”`;
  document.getElementById('grade-marcas').innerHTML = gradeMarcas(true);
  const m = document.getElementById('modal-marca');
  m.hidden = false;
  document.body.classList.add('com-modal');
  m.querySelector('.marca-op').focus();
}

function fecharMarcas() {
  document.getElementById('modal-marca').hidden = true;
  document.body.classList.remove('com-modal');
  marcaAlvo = null;
}

function escolherMarca(id) {
  if (!marcaAlvo) return;
  const v = S[marcaAlvo.lista][marcaAlvo.i];
  if (v && typeof v === 'object') v.marca = id;
  fecharMarcas();
  salvar(); montarForm();
}

function limparTudo() {
  if (!confirm('Apagar tudo e começar de novo?')) return;
  S = vazio(); salvar(); montarForm();
}

function iniciar() {
  mostrarNav();
  carregar();

  document.getElementById('f-tipo').innerHTML =
    TIPOS.map(t => `<option>${esc(t)}</option>`).join('');
  document.getElementById('f-seta-dir').innerHTML =
    Object.keys(DIRS).map(d => `<option value="${d}">para ${d === 'cima' ? 'cima' : d === 'baixo' ? 'baixo' : 'a ' + d}</option>`).join('');

  montarForm();
  render();

  [['f-nome', 'nome'], ['f-tipo', 'tipo'], ['f-endereco', 'endereco'],
   ['f-horario', 'horario'], ['f-contato', 'contato'], ['f-link', 'link'],
   ['f-seta-texto', 'setaTexto'], ['f-seta-dir', 'setaDir'], ['f-fechado', 'fechadoTexto'],
   ['f-motivo', 'motivoPausa'], ['f-slug', 'slug'], ['f-codigo', 'codigo']
  ].forEach(([id, k]) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => { S[k] = el.value; salvar(); });
  });

  /* 'change' e não 'input': redesenhar quinze peças a cada tecla numa lista
     de dez itens tornava o campo lento no telemóvel. */
  document.addEventListener('change', e => {
    const t = e.target.closest('[data-q]');
    if (t) mudarQuantidade('precisa', +t.dataset.q, t.value);
  });

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-tog],[data-rm],[data-mv],[data-print],[data-img],[data-marca],[data-pick],[data-lista]');
    if (!t) return;
    if (t.dataset.pick) escolherMarca(t.dataset.pick);
    else if (t.dataset.marca) abrirMarcas(t.dataset.l === 'precisa' ? 'precisa' : 'naoTraga', +t.dataset.marca);
    else if (t.dataset.tog) alternar(t.dataset.tog);
    else if (t.dataset.rm) remover(t.dataset.l, +t.dataset.rm);
    else if (t.dataset.mv) mover(+t.dataset.mv, +t.dataset.d);
    else if (t.dataset.print) imprimir(t.dataset.print);
    else if (t.dataset.lista) alternarLista(t.dataset.lista);
    else if (t.dataset.img) imagem(t.dataset.img, t);
  });

  document.getElementById('b-publicar')
    .addEventListener('click', e => publicar(e.currentTarget));
  document.getElementById('b-carregar')
    .addEventListener('click', e => puxarDados(e.currentTarget));
  document.getElementById('b-partilhar')
    .addEventListener('click', e => partilharLista(e.currentTarget));
  /* Se o kit foi servido pelo servidor, o pedido de página é lá; se foi aberto
     de uma pen, o link não sabe para onde ir e é escondido em vez de mentir. */
  const lp = document.getElementById('link-pedir');
  if (servidor()) lp.href = servidor() + '/';
  else lp.closest('p').hidden = true;

  document.getElementById('b-fechar-marca').addEventListener('click', fecharMarcas);
  document.getElementById('modal-marca').addEventListener('click', e => {
    if (e.target.id === 'modal-marca') fecharMarcas();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.getElementById('modal-marca').hidden) fecharMarcas();
  });

  document.getElementById('indice-marcas').innerHTML = gradeMarcas(false);
  document.getElementById('conta-marcas').textContent = ICONES.length;

  document.getElementById('b-add-precisa').addEventListener('click', () => addLivre('f-livre', 'precisa'));
  document.getElementById('b-add-nao').addEventListener('click', () => addLivre('f-nao-livre', 'naoTraga'));
  document.getElementById('b-limpar').addEventListener('click', limparTudo);
  document.getElementById('b-texto').addEventListener('click', e => copiarTexto(e.currentTarget));
  document.getElementById('f-pausado').addEventListener('change', e => {
    S.pausado = e.currentTarget.checked; salvar(); montarForm();
  });
  document.getElementById('b-conjunto').addEventListener('click', () => imprimirVarias(CONJUNTO_INICIAL));
  document.getElementById('b-lista-imprimir')
    .addEventListener('click', () => imprimirVarias([...LISTA]));
  document.getElementById('b-lista-limpar')
    .addEventListener('click', () => { LISTA.clear(); render(); pintarLista(); });
  document.getElementById('b-mono').addEventListener('click', () => { S.mono = !S.mono; salvar(); montarForm(); });
  document.getElementById('b-cortes').addEventListener('click', () => { S.cortes = !S.cortes; salvar(); montarForm(); });

  ['f-livre', 'f-nao-livre'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addLivre(id, id === 'f-livre' ? 'precisa' : 'naoTraga'); }
    });
  });

  let t = null;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(escalar, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(escalar);
}

/* ---------------------------------------------------------------------------
 * Arranque.
 *
 * Duas redes de segurança, porque esta ferramenta vai ser aberta em sítios que
 * não escolhemos: de uma pen, de um anexo de e-mail, de dentro de um leitor de
 * ficheiros que talvez não corra scripts.
 *
 * 1. O aviso #sem-js está no HTML e é apagado aqui. Se o script não correr,
 *    fica na tela a dizer o que fazer — em vez de um formulário morto que
 *    parece só estranho.
 * 2. Se iniciar() rebentar, o aviso fica e mostra o erro. Alguém num ginásio
 *    não consegue abrir uma consola; o erro tem de estar na página.
 * -------------------------------------------------------------------------*/
/**
 * A barra de navegação só aparece se isto veio de um servidor.
 *
 * O kit corre de uma pen, de um anexo de e-mail e do GitHub Pages, e nesses
 * sítios `/centros` não existe. Um link que não leva a lado nenhum, no meio de
 * um ginásio, é pior do que não haver link — quem o segue conclui que a
 * ferramenta está partida.
 */
function mostrarNav() {
  const n = document.getElementById('nav-topo');
  if (!n) return;
  const o = location.origin;
  n.hidden = !(o && o !== 'null' && /^https?:/.test(o));
}

function arrancar() {
  try {
    iniciar();
    const aviso = document.getElementById('sem-js');
    if (aviso) aviso.remove();
  } catch (e) {
    const aviso = document.getElementById('sem-js');
    if (!aviso) return;
    aviso.querySelector('b').textContent = 'Esta página teve um erro.';
    const pre = document.getElementById('sem-js-erro');
    pre.hidden = false;
    pre.textContent = (e && (e.stack || e.message)) || String(e);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
else arrancar();
