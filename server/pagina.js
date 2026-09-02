/* ============================================================================
 * AS PÁGINAS
 *
 * Mesmo sistema de desenho do papel: as mesmas fichas, as mesmas 29 marcas, a
 * mesma regra de que a cor nunca carrega sozinha o significado. Quem chega aqui
 * pelo QR do cartaz tem de reconhecer que é o mesmo centro.
 *
 * Duas diferenças em relação ao papel, ambas porque isto é um ecrã numa rua:
 *
 *   · o telefone é um link que liga, não um número para copiar;
 *   · a idade da lista é dita em voz alta. No papel a data é discreta porque
 *     o papel obviamente envelhece. Uma página web parece sempre nova, e essa
 *     é precisamente a mentira que aqui é perigosa.
 * ==========================================================================*/
const { svgIcone, svgProibido, svgAnel, item, ROTULO_BR, ICONES, GRUPOS, RECUSAS } = require('./compartilhado');
const { linkWhatsApp } = require('./avisos');
const B = require('./busca');
const SAC = require('./sacola');
const QR = require('./qr');

const esc = s => String(s == null ? '' : s)
  .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Um valor para dentro de um <script>.
 *
 * `JSON.stringify` sozinho NÃO chega: não escapa o `<`, por isso um item
 * publicado com "</script>" lá dentro fecha a etiqueta e o resto passa a ser
 * HTML. Foi exactamente isso que o teste do escapamento apanhou no minuto em
 * que este ficheiro ganhou o primeiro <script>.
 */
const paraScript = v => JSON.stringify(v)
  .replace(/</g, '\\u003C').replace(/>/g, '\\u003E')
  .replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

const DIA = 86400000;

/* ---------------------------------------------------------------------------
 * A idade da lista.
 *
 * Este é o coração da página. Uma lista de três semanas manda um vizinho
 * carregar cinco quilos de arroz até um centro que já não os quer, e a página
 * não tem como saber que está errada — só sabe quando foi tocada.
 *
 * Por isso o silêncio nunca é o estado apresentado. Ou a lista é de hoje, ou a
 * página diz há quantos dias não é mexida e manda ligar antes de sair de casa.
 * -------------------------------------------------------------------------*/
function idade(publicado) {
  if (!publicado) return { dias: null, nivel: 'nunca' };
  const dias = Math.floor((Date.now() - publicado) / DIA);
  if (dias <= 1) return { dias, nivel: 'fresca' };
  if (dias <= 6) return { dias, nivel: 'a-envelhecer' };
  return { dias, nivel: 'velha' };
}

function faixaIdade(pub) {
  const { dias, nivel } = idade(pub);
  if (nivel === 'fresca') return '';
  const txt = {
    nunca: 'Este centro ainda não publicou uma lista. Ligue antes de trazer o que quer que seja.',
    'a-envelhecer': `Esta lista foi atualizada há ${dias} dias. Ligue antes de vir, para não carregar em vão.`,
    velha: `Esta lista não é atualizada há ${dias} dias. Pode já não valer — ligue antes de trazer o que quer que seja.`
  }[nivel];
  return `<p class="idade ${nivel}">${esc(txt)}</p>`;
}

/** O anfitrião de um endereço, para a fonte se ler sem ocupar a página toda. */
function nomeDaFonte(u) {
  try { return new URL(u).host.replace(/^www\./, ''); } catch { return String(u).slice(0, 40); }
}

const dataCurta = ms => {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/* ---------------------------------------------------------------------------
 * Ligar e chegar
 *
 * Duas coisas que alguém com cobertores no carro quer fazer, e que até aqui
 * obrigavam a abrir a página do centro, copiar o endereço à mão e colá-lo noutro
 * aplicativo. Três passos de pé, na rua, para uma coisa que é um toque.
 *
 * O endereço vai como PROCURA e não como coordenada, porque coordenada é um
 * campo que ainda não existe em nenhum centro aprovado. Uma procura acerta quase
 * sempre e falha sem estragar nada — abre o mapa no bairro certo e a pessoa vê
 * onde é. O que a torna honesta é a fila de aprovação levar o mesmo link: o
 * endereço já é conferido à mão nesse momento, e conferir também para onde ele
 * aponta é um toque a mais numa coisa que já se está a fazer.
 *
 * Um link só, e não "Apple ou Google?". Este endereço abre o aplicativo nativo
 * no Android, o Google Maps ou a web no iPhone, e uma página no computador.
 * Perguntar qual à pessoa que está a tentar sair de casa é pior do que às vezes
 * abrir o que ela não usa.
 *
 * `geo:` seria mais correcto e é só Android — no iPhone não abre nada.
 * -------------------------------------------------------------------------*/
const linkMapa = (endereco, coords) => {
  const c = coordenadasValidas(coords);
  if (c) return `https://www.google.com/maps/search/?api=1&query=${c[0]},${c[1]}`;
  const e = String(endereco || '').trim();
  return e ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e)}` : '';
};

/**
 * Coordenadas, se as houver e se fizerem sentido.
 *
 * Devolve `null` a qualquer coisa que não seja um par de números dentro do
 * planeta. Um zero-zero é o Golfo da Guiné e é quase sempre um campo vazio que
 * passou por um `Number()` — mandar alguém para lá é pior do que não ter mapa.
 */
function coordenadasValidas(v) {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const [a, b] = v.map(Number);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a < -90 || a > 90 || b < -180 || b > 180) return null;
  if (a === 0 && b === 0) return null;
  return [a, b];
}

/** O telefone tal como um `tel:` o quer: dígitos e, quando muito, um `+`. */
const telDe = c => String(c || '').trim().replace(/[^\d+]/g, '');

/** As coordenadas de volta ao formato em que se colam. Vazio se não houver. */
const coordsTexto = v => {
  const c = coordenadasValidas(v);
  return c ? `${c[0]}, ${c[1]}` : '';
};

/* ---------------------------------------------------------------------------
 * Onde mais encontrar o centro — Instagram, Facebook, site
 *
 * Muitas paróquias e associações mantêm o Instagram mais atualizado do que
 * qualquer outra coisa que tenham, e quem está a decidir se atravessa a cidade
 * quer ver o sítio. Vale a pena.
 *
 * Três decisões que não são óbvias:
 *
 * 1. CHAMA-SE `perfil` E NÃO `link`. `dados.link` já existe e quer dizer outra
 *    coisa por completo — é o destino do QR, a própria página do centro, usada
 *    por todas as peças impressas. Reaproveitar o nome dava um bug silencioso
 *    e caro.
 *
 * 2. QUEM O PÕE É QUEM APROVA, não o coordenador. Um link que sai de uma página
 *    que leva a verificação feita à mão herda essa verificação: quem o segue
 *    acredita que o CAPEM conferiu. Um perfil que morre, muda de dono ou é
 *    invadido passa a fazê-lo com o nosso nome em cima. Conferir custa um toque
 *    no mesmo momento em que já se está a ligar para o telefone.
 *
 * 3. NÃO VAI PARA O PAPEL. Mesma regra das quantidades: um endereço que muda
 *    não se corrige numa folha que já saiu da impressora. A página do centro
 *    está impressa em todas as peças e leva lá o link.
 *
 * Sem logótipo: as 29 marcas são silhuetas cheias que se lêem a dois metros a
 * preto e branco, e um logótipo de marca comercial não pertence a esse conjunto.
 * A marca aqui é genérica e é o texto que diz qual é a casa.
 * -------------------------------------------------------------------------*/
const CASAS = [
  [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)facebook\.com$/, 'Facebook'],
  [/(^|\.)fb\.com$/, 'Facebook'],
  [/(^|\.)(chat\.)?whatsapp\.com$/, 'Grupo de WhatsApp'],
  [/(^|\.)youtube\.com$/, 'YouTube'],
  [/(^|\.)youtu\.be$/, 'YouTube'],
  [/(^|\.)tiktok\.com$/, 'TikTok'],
  [/(^|\.)x\.com$/, 'X'],
  [/(^|\.)twitter\.com$/, 'X']
];

/**
 * Devolve `{ href, rotulo, casa }`, ou `null` se não houver nada utilizável.
 *
 * Só http e https. Um `javascript:` guardado à mão na base de dados seria um
 * XSS com um clique, e a lista de esquemas permitidos é mais curta e mais
 * segura do que a lista dos proibidos.
 */
function lerPerfil(v) {
  const bruto = String(v || '').trim();
  if (!bruto) return null;
  let u;
  try { u = new URL(/^https?:\/\//i.test(bruto) ? bruto : 'https://' + bruto); }
  catch (e) { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const anfitriao = u.hostname.replace(/^www\./, '');
  const casa = (CASAS.find(([re]) => re.test(anfitriao)) || [])[1] || null;
  /* Sem casa conhecida, o rótulo é o próprio domínio: dizer "Site" e esconder
     para onde se vai é pior do que mostrar. */
  const rotulo = casa
    ? (casa === 'Instagram' && u.pathname.length > 1
        ? `Instagram — @${u.pathname.split('/').filter(Boolean)[0]}`
        : casa)
    : anfitriao;
  return { href: u.href, rotulo, casa };
}

/* Marca de elo. NÃO entra em field/src/icones.js de propósito: aquele conjunto
   é o das 29 marcas que vão para o papel, e este símbolo nunca é impresso.
   Pô-lo lá punha-o também no índice de marcas e na lista de onde um
   coordenador escolhe a marca de um item — "cobertor: elo" não quer dizer
   nada. Mesma geometria (64×64, silhueta cheia, evenodd) para não destoar. */
const svgElo = () => '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">'
  + '<path fill="currentColor" fill-rule="evenodd" d="M35 4 H60 V29 H50 V21 L31 40 L24 33 L43 14 H35 Z '
  + 'M4 16 H30 V26 H14 V50 H38 V34 H48 V60 H4 Z"/></svg>';

/* ---------------------------------------------------------------------------
 * NAVEGAÇÃO
 *
 * Faltava por completo, e isso é mais grave aqui do que num site normal: metade
 * de quem chega entra pelo QR de um cartaz, no meio de uma página qualquer, sem
 * ter passado pela entrada. Sem uma barra, a única forma de ir de um sítio ao
 * outro era escrever o endereço de cor.
 *
 * DUAS portas, e são as mesmas da entrada: quem chega tem alguma coisa para
 * dar, ou tem um centro para tratar. Não há uma terceira pessoa.
 *
 * Chegou a haver três destinos — ajudar, atualizar, imprimir — e o problema não
 * era o nome do meio: era misturar dois públicos na mesma fila. "Quero ajudar"
 * é para um vizinho com cobertores no carro; "atualizar" e "imprimir" são
 * tarefas de um coordenador, e uma delas é parte da outra.
 *
 * Duas portas também é a forma que aguenta o que falta construir. Do lado de
 * quem ajuda vêm o código do saco e, mais tarde, o donativo em dinheiro; do
 * lado do centro vem receber sacos à porta. Cada coisa nova entra pela porta a
 * que pertence, e o menu não cresce.
 *
 * O custo é um toque a mais para o coordenador que chegue sem link. Paga-se
 * porque ele quase nunca chega assim: a mensagem de aprovação leva o endereço
 * de /atualizar, e é essa a página que fica nos favoritos.
 *
 * A fila de aprovação não entra — quem a pode abrir sabe o endereço, e um link
 * que responde 404 a 99% das pessoas é ruído.
 *
 * As migalhas aparecem só onde há profundidade a sério (a página de um centro,
 * a lista aberta para editar). Numa página de primeiro nível seriam uma linha
 * que só repete o título.
 * -------------------------------------------------------------------------*/
const DESTINOS = [
  ['/centros', 'Quero ajudar'],
  ['/centro', 'Meu centro']
];

function nav(aqui, migalhas) {
  const links = DESTINOS.map(([href, txt]) => {
    const atual = href === aqui;
    return `<a href="${esc(href)}"${atual ? ' aria-current="page"' : ''}>${esc(txt)}</a>`;
  }).join('');

  /* `migalhas` é uma lista de [texto, href?]. O último não é link: é onde se
     está, e um link para a própria página só engana quem o segue. */
  const trilho = (migalhas && migalhas.length)
    ? `<nav class="migalhas" aria-label="Onde está">
        <a href="/">Início</a>${migalhas.map(([t, h], i) =>
          h && i < migalhas.length - 1
            ? `<span aria-hidden="true">›</span><a href="${esc(h)}">${esc(t)}</a>`
            : `<span aria-hidden="true">›</span><b>${esc(t)}</b>`).join('')}
      </nav>`
    : '';

  return `<nav class="nav-topo" aria-label="Principal">
  <a class="marca" href="/">CAPEM</a>
  <div class="nav-links">${links}</div>
</nav>${trilho}`;
}

/* ---------------------------------------------------------------------------
 * Molde comum
 * -------------------------------------------------------------------------*/
/* ---------------------------------------------------------------------------
 * O aviso do topo
 *
 * Uma faixa vermelha acima de tudo o resto, em todas as páginas servidas. Serve
 * para o que não cabe na lista de um centro e não espera pela próxima
 * publicação — uma ponte cortada, um bairro a evacuar, um ponto que deixou de
 * receber por hoje.
 *
 * Chega aqui por injecção e não por um `require('./db')`, pelo mesmo motivo que
 * a derivação das colunas: este ficheiro desenha páginas e não sabe onde é que
 * o estado mora. `server.js` liga as duas metades uma vez, no arranque; um
 * teste que só queira desenhar HTML não precisa de base de dados nenhuma.
 * -------------------------------------------------------------------------*/
let lerAviso = () => null;
const definirAviso = fn => { lerAviso = fn; };

function faixaAviso() {
  let a = null;
  /* Um aviso que rebente não pode levar a página com ele: sem faixa é uma
     página incompleta, com excepção é uma página em branco. */
  try { a = lerAviso(); } catch (e) { return ''; }
  if (!a || !a.texto) return '';
  return `<div class="aviso-global" role="region" aria-label="Aviso importante">
  ${svgAnel()}<p>${esc(a.texto)}</p>
</div>`;
}

function molde({ titulo, descricao, corpo, classe, aqui, migalhas }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descricao || '')}">
<meta name="color-scheme" content="light">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' fill='%2316130F'/><path fill='white' fill-rule='evenodd' d='M6 14 H58 V24 H6 Z M10 26 H54 V58 H10 Z M28 30 H36 V44 H28 Z'/></svg>">
<link rel="stylesheet" href="/fontes.css">
<style>${CSS}</style>
</head>
<body class="${classe || ''}">
${faixaAviso()}
${aqui === false ? '' : nav(aqui, migalhas)}
${corpo}
</body>
</html>`;
}

/* ---------------------------------------------------------------------------
 * Compartilhar
 *
 * O que se manda é o LINK e não uma imagem. Uma imagem de uma lista é o mesmo
 * problema do cartaz impresso — nasce velha e continua a circular meses depois
 * no WhatsApp de alguém. O link diz sempre o que o centro precisa hoje, e diz
 * também quando a lista já não é de hoje.
 * -------------------------------------------------------------------------*/
function textoCompartilharCentro(d, url) {
  const L = [];
  const precisa = (d.precisa || []).map(item);
  L.push(`*${String(d.nome || '').toUpperCase()}* — ${d.pausado
    ? 'NÃO está recebendo agora' : 'precisa hoje'}`);
  L.push('');
  if (!d.pausado && precisa.length) {
    precisa.slice(0, 10).forEach(i => L.push('• ' + i.rotulo + (i.q ? ` — ${i.q}` : '')));
    L.push('');
  }
  const nao = (d.naoTraga || []).map(item).map(i => i.rotulo);
  if (nao.length) { L.push('*NÃO TRAGA:* ' + nao.join(', ')); L.push(''); }
  if (d.endereco) L.push('📍 ' + d.endereco);
  if (d.horario) L.push('🕐 ' + d.horario);
  if (d.contato) L.push('📱 ' + d.contato);
  L.push('');
  L.push('Lista sempre atualizada: ' + url);
  return L.join('\n');
}

const linkCompartilhar = (d, url) =>
  'https://wa.me/?text=' + encodeURIComponent(textoCompartilharCentro(d, url));

/* ---------------------------------------------------------------------------
 * A página pública de um centro — o destino do QR
 * -------------------------------------------------------------------------*/
function paginaCentro(centro, base, urlCanonica) {
  const d = centro.dados || {};
  const precisa = (d.precisa || []).map(item);
  const nao = (d.naoTraga || []).map(item);
  const tel = (d.contato || '').trim();
  const telLink = telDe(tel);
  const mapa = linkMapa(d.endereco, d.coords);
  const perfil = lerPerfil(d.perfil);
  const url = urlCanonica || `${base}/${centro.slug}`;
  /* Um centro que nunca pediu esta página. Ver `/admin/encontrado` em
     server.js: entrou porque alguém o encontrou numa fonte pública durante uma
     emergência. Tudo o que serve para lá chegar — morada, telefone, horário,
     redes — fica igual ao de qualquer outro centro; o que muda é que não há
     lista de necessidades nenhuma, porque ninguém de lá disse o que precisa. */
  const semDono = d.origem === 'encontrado';

  const corpo = `
<main class="centro faixas">
  <header class="topo-c">
    <p class="tipo">${esc(d.tipo || 'Ponto de arrecadação')}</p>
    <h1>${esc(d.nome || centro.slug)}</h1>
    ${d.horario ? `<p class="horas">${svgIcone(
      /* A marca de "aberto" é um visto, e um visto ao lado do horário de uma
         página que diz logo abaixo que ninguém a confirmou é a página a
         contradizer-se em dois centímetros. Sem dono, o horário leva um
         relógio: diz a hora que encontrámos, não que ela está confirmada. */
      semDono ? 'relogio' : d.pausado ? 'fechado' : 'aberto'
    )}<span>${esc(d.horario)}</span></p>` : ''}
  </header>

  ${semDono ? '' : faixaIdade(centro.publicado)}

  ${semDono ? `
  <section class="sem-dono">
    <h2>${svgIcone('cartaz')}<span>Ninguém deste centro confirmou esta página</span></h2>
    <p>Nós montamos esta página com informações públicas, para a lista não deixar
      de fora um centro que ainda não conhece o CAPEM. <b>Ligue antes de vir</b> —
      o horário pode ter mudado, e não sabemos o que eles precisam hoje.</p>
    <p class="fonte">${d.fonte
      ? `Encontrado em <a href="${esc(d.fonte)}" target="_blank" rel="noopener nofollow ugc"
          >${esc(nomeDaFonte(d.fonte))}</a>`
      : 'Encontrado em fontes públicas'}${d.fonteEm ? ` · ${esc(dataCurta(d.fonteEm))}` : ''}</p>
    <a class="btn" href="/sou-daqui?c=${esc(centro.slug)}">Sou deste centro</a>
  </section>` : d.pausado ? `
  <section class="pausa">
    ${svgIcone('fechado')}
    <div>
      <h2>Não estamos recebendo agora</h2>
      ${d.motivoPausa ? `<p>${esc(d.motivoPausa)}</p>` : ''}
    </div>
  </section>` : `
  <section class="bloco-precisa">
    <h2>${svgIcone('aberto', 'color:var(--permitido)')}<span>Precisamos hoje</span></h2>
    ${precisa.length
      ? `<ul class="marcas">${precisa.map(i => `<li>${svgIcone(i.id)}
          <span>${esc(i.rotulo)}</span>
          ${i.q ? `<b class="q">${esc(i.q)}</b>` : ''}</li>`).join('')}</ul>`
      : '<p class="vazio">Este centro ainda não publicou uma lista. Ligue antes de vir.</p>'}
  </section>`}

  ${!semDono && d.sacolas && !d.pausado ? `
  <section class="bloco-sacola">
    <h2>${svgIcone('caixa')}<span>Vai trazer uma sacola?</span></h2>
    <p>Diga o que vai dentro antes de sair de casa e escreva o código na sacola.
      Na porta, um voluntário lê o código e já sabe o que tem — sem abrir.</p>
    <a class="btn btn-primario" href="/doar?c=${esc(centro.slug)}">Registrar uma sacola</a>
  </section>` : ''}

  ${semDono ? '' : `
  <section class="bloco-nao">
    <h2>${svgAnel()}<span>Por favor, não traga</span></h2>
    <p class="porque">Não temos onde guardar — e obrigado por querer ajudar.</p>
    <ul class="marcas">${nao.map(i => `<li>${svgProibido(i.id)}<span>${esc(i.rotulo)}</span></li>`).join('')}</ul>
  </section>`}

  <section class="contato">
    ${d.endereco ? `<p class="lin"><a href="${esc(mapa)}" target="_blank" rel="noopener"
      >${svgIcone('pino')}<span>${esc(d.endereco)}</span></a></p>` : ''}
    ${tel ? `<p class="lin"><a href="tel:${esc(telLink)}">${svgIcone('telefone')}<span>${esc(tel)}</span></a></p>` : ''}
    ${perfil ? `<p class="lin"><a href="${esc(perfil.href)}" target="_blank" rel="noopener nofollow ugc"
      >${svgElo()}<span>${esc(perfil.rotulo)}</span></a></p>` : ''}
    ${centro.publicado ? `<p class="carimbo">Lista de ${dataCurta(centro.publicado)}</p>` : ''}
  </section>

  ${d.endereco ? `<section class="ir">
    <a class="btn btn-ir" href="${esc(mapa)}" target="_blank" rel="noopener">
      ${svgIcone('pino')}<span>Como chegar</span></a>
    ${tel ? `<a class="btn btn-ir" href="tel:${esc(telLink)}">
      ${svgIcone('telefone')}<span>Ligar antes de vir</span></a>` : ''}
  </section>` : ''}

  ${semDono ? '' : `
  <section class="compartilhar">
    <a class="btn btn-wa" id="b-wa" href="${esc(linkCompartilhar(d, url))}" target="_blank" rel="noopener">
      Mandar esta lista no WhatsApp</a>
    <p class="nota-compartilhar">Mande o <b>link</b>, não uma imagem: a imagem fica velha,
      o link não.</p>
  </section>`}

  <footer class="pe">
    <p><b>Leve isso com você.</b> <a href="${esc(url)}">${esc(url.replace(/^https?:\/\//, ''))}</a></p>
    <p class="creditos">CAPEM · ferramenta livre para centros de apoio ·
      <a href="https://github.com/philthemoser/capem">o código é aberto</a></p>
  </footer>
</main>
<script>
/* Onde o sistema tiver folha de partilha, usa-se essa — o WhatsApp é a
   primeira coisa lá dentro, e ainda dá para mandar por outro lado. Onde não
   tiver, o link wa.me do href faz o mesmo. Sem script continua a funcionar. */
(function () {
  var b = document.getElementById('b-wa');
  if (!b || !navigator.share) return;
  var t = ${paraScript(textoCompartilharCentro(d, url))};
  b.addEventListener('click', function (e) {
    e.preventDefault();
    navigator.share({ text: t }).catch(function () { window.open(b.href, '_blank'); });
  });
})();
</script>`;

  const lista = precisa.slice(0, 6).map(i => i.rotulo).join(', ');
  return molde({
    migalhas: [['Centros de apoio', '/centros'], [d.nome || centro.slug]],
    titulo: `${d.nome || centro.slug} — o que precisamos hoje`,
    descricao: semDono
      ? `${d.nome || centro.slug} — ponto de arrecadação. Ligue antes de vir.`
      : d.pausado
        ? `${d.nome || centro.slug} não está recebendo doações agora.`
        : (lista ? `Precisamos hoje: ${lista}.` : 'Ponto de arrecadação.'),
    corpo
  });
}

/** Um centro ainda não aprovado. Existe, mas não está no ar. */
function paginaPendente(centro) {
  return molde({
    titulo: 'Página ainda não verificada',
    corpo: `<main class="aviso-pagina">
      <h1>Esta página ainda não está no ar</h1>
      <p>O pedido para <b>${esc((centro.dados || {}).nome || centro.slug)}</b> foi recebido e
        está aguardando verificação. Isso costuma demorar pouco.</p>
      <p>Se é o coordenador deste centro, pode ver como a página vai ficar juntando
        seu código ao endereço:
        <code>?codigo=SEU-CODIGO</code></p>
    </main>`
  });
}

function paginaNaoExiste() {
  return molde({
    titulo: 'Página não encontrada',
    corpo: `<main class="aviso-pagina">
      <h1>Não encontramos este centro</h1>
      <p>O endereço pode estar mal escrito, ou o centro pode ter fechado.</p>
      <p><a href="/">Ver o que é isto</a></p>
    </main>`
  });
}

/* ---------------------------------------------------------------------------
 * A entrada
 * -------------------------------------------------------------------------*/
/* ---------------------------------------------------------------------------
 * A entrada — duas portas e nada mais
 *
 * Quem chega aqui é uma de duas pessoas, e não há uma terceira: ou tem alguma
 * coisa para dar, ou está a montar um centro. Um formulário na página de
 * entrada obrigava a primeira a passar por cima da segunda para chegar ao que
 * queria, e é a primeira que aparece às centenas.
 * -------------------------------------------------------------------------*/
function paginaInicial({ contagem, base, emergencias }) {
  const emgs = emergencias || [];

  /* Enquanto houver uma resposta só, isto não aparece — e não aparecer é o
     comportamento certo, não uma funcionalidade por acabar. Uma barra com um
     único botão só faz alguém perguntar-se o que é aquilo. */
  const barraEmg = emgs.length > 1 ? `
  <section class="emg-inicial">
    <h2>Respostas em curso</h2>
    <ul class="emergencias">
      ${emgs.map(e => `<li><a class="emg" href="/centros?e=${encodeURIComponent(e.slug)}"
        >${esc(e.nome)} <span class="emg-n">${e.n} ${e.n === 1 ? 'centro' : 'centros'}</span></a></li>`).join('')}
    </ul>
  </section>` : '';

  return molde({
    aqui: false,
    titulo: 'CAPEM — centros de apoio',
    descricao: 'Veja o que os centros de apoio precisam hoje, ou peça a página do seu centro.',
    corpo: `
<main class="portas">
  <header>
    <p class="tipo">CAPEM · ferramenta livre</p>
    <h1>O que os centros precisam hoje</h1>
    <p class="entrada">Quando uma emergência acontece, igrejas, escolas e ginásios
      viram pontos de arrecadação de um dia para o outro — e passam a receber o
      que as pessoas têm, não o que falta. Aqui cada centro mantém, todo dia, uma
      lista do que precisa e do que já não cabe. Quem quer ajudar vê a lista
      antes de sair de casa.</p>
    <p class="entrada">É uma ferramenta livre, feita para qualquer centro em
      qualquer emergência. Não é de nenhuma prefeitura nem de nenhuma
      organização.</p>
  </header>

  ${barraEmg}

  <div class="duas-portas">
    <a class="porta" href="/centros">
      ${svgIcone('caixa')}
      <span class="porta-t">Quero ajudar</span>
      <span class="porta-d">Ver os centros e o que cada um precisa hoje — e ligar
        ou traçar a rota sem sair da lista.
        ${contagem.aprovado ? `${contagem.aprovado} ${contagem.aprovado === 1 ? 'centro' : 'centros'} no ar.` : ''}</span>
    </a>
    <a class="porta" href="/centro">
      ${svgIcone('cartaz')}
      <span class="porta-t">Meu centro</span>
      <span class="porta-d">Publique a lista de hoje, gere o material impresso,
        ou peça sua página, se ainda não tiver.</span>
    </a>
  </div>

  <footer class="pe">
    <p class="creditos">Nada aqui coleta dados de quem é atendido — só o endereço,
      o horário e o telefone de um prédio.
      <a href="https://github.com/philthemoser/capem">O código é aberto.</a></p>
  </footer>
</main>`
  });
}

/* ---------------------------------------------------------------------------
 * A lista de centros
 *
 * Ordenada, por omissão, pela idade da lista e não pelo nome: um centro que
 * publicou hoje é útil, um que não toca na página há três semanas é uma viagem
 * em vão à espera de acontecer. Os velhos ficam no fim e dizem-no.
 *
 * As marcas aparecem aqui, pequenas, para se poder correr a lista com os olhos
 * e ver quem precisa de água sem ler uma palavra.
 *
 * A ordem, os filtros, a procura e a página vêm todos do endereço, e o servidor
 * só desenha o que já está escolhido. Antes esta página mandava todos os
 * centros para o telemóvel e filtrava-os lá — com mil centros eram 1,6 MB.
 *
 * O formulário é um `<form method="get">` a sério: funciona com o JavaScript
 * desligado, com o JavaScript por carregar, e no browser de dez anos que
 * alguém tem no bolso. Com JavaScript, o botão "filtrar" desaparece e as
 * escolhas aplicam-se sozinhas — é um acabamento, nunca o mecanismo.
 * -------------------------------------------------------------------------*/
function paginaCentros({ centros, base, consulta, total, paginas, emergencias, semDono, comSacolas }) {
  const c = consulta || B.lerConsulta();
  const ts = B.termos(c.q);
  const emgs = emergencias || [];
  const linhas = centros.map(x => {
    const d = x.dados || {};
    const i = idade(x.publicado);
    /* Se alguém procurou "cobertor", a marca do cobertor tem de ser a primeira
       que se vê — senão a lista responde sem mostrar a resposta. */
    const precisa = B.realcar((d.precisa || []).map(item), ts).slice(0, 8);
    /* Um centro que nós acrescentámos nunca publicou nada, e nunca vai publicar
       enquanto não tiver quem publique. "ainda sem lista" leria-se como
       negligência de alguém; a verdade é mais simples e diz-se em três
       palavras. */
    const sd = d.origem === 'encontrado';
    const quando = sd ? 'sem lista publicada'
      : { fresca: 'lista de hoje', 'a-envelhecer': `há ${i.dias} dias`,
          velha: `há ${i.dias} dias`, nunca: 'ainda sem lista' }[i.nivel];
    const nome = d.nome || x.slug;
    const tel = telDe(d.contato);
    const mapa = linkMapa(d.endereco, d.coords);
    const c2 = coordenadasValidas(d.coords);

    /* As duas acções ficam FORA do link do cartão, e não por preguiça: um <a>
       dentro de outro <a> não é HTML válido, o axe reprova-o, e o que acontece
       na prática é pior do que a regra — um toque na beira do botão segue o
       cartão e leva a pessoa para outra página. O truque de esticar o link com
       um ::after e deixar os botões por cima resolve-o no papel e traz de volta
       a família de bugs que a linha `[hidden]{display:none!important}` está no
       topo de todas as folhas para evitar: um elemento invisível a comer
       toques. Já mordeu duas vezes. Uma linha a mais no HTML é mais barata.

       O nome do centro vai no rótulo de cada acção porque numa lista de
       quarenta, "Ligar" quarenta vezes seguidas não diz a um leitor de ecrã
       para onde se está a ligar. */
    const acoes = (tel || mapa) ? `
      <div class="c-acoes">
        ${tel ? `<a class="c-acao" href="tel:${esc(tel)}"
          aria-label="Ligar para ${esc(nome)}">${svgIcone('telefone')}<span>Ligar</span></a>` : ''}
        ${mapa ? `<a class="c-acao" href="${esc(mapa)}" target="_blank" rel="noopener"
          aria-label="Como chegar a ${esc(nome)}${c2 ? '' : ' — procura pelo endereço'}"
          >${svgIcone('pino')}<span>Como chegar</span></a>` : ''}
      </div>` : '';

    return `<li class="c-item ${sd ? 'sem-dono' : i.nivel}"${c2 ? ` data-lat="${c2[0]}" data-lon="${c2[1]}"` : ''}>
      <a class="c-cartao" href="${esc(x.url || base + '/' + x.slug)}">
        <span class="c-nome">${esc(nome)}</span>
        <span class="c-endereco">${esc(d.endereco || '')}</span>
        <span class="c-quando">${esc(quando)}<span class="c-perto" hidden></span></span>
        ${d.pausado
          ? `<span class="c-pausa">${svgIcone('fechado')} Não está recebendo agora</span>`
          : precisa.length
            ? `<span class="c-marcas">${precisa.map(y => svgIcone(y.id)).join('')}</span>`
            : ''}
        ${!d.pausado && d.sacolas
          ? '<span class="c-sacolas">lê códigos de sacola</span>' : ''}
      </a>
      ${acoes}
    </li>`;
  }).join('');

  const opcoes = Object.entries(B.ORDENS).map(([v, r]) =>
    `<option value="${esc(v)}"${v === c.ordem ? ' selected' : ''}>${esc(r)}</option>`).join('');

  /* As emergências só aparecem quando há mais do que uma. Com uma resposta a
     acontecer — que é o caso hoje e provavelmente por muito tempo — uma barra
     com um único botão só faz o utilizador perguntar-se o que é aquilo. Com
     duas ao mesmo tempo, misturá-las na mesma lista manda alguém atravessar um
     estado; aí a barra deixa de ser decoração. */
  const barraEmg = emgs.length > 1 ? `
  <nav class="emergencias" aria-label="Emergência">
    <a class="emg${c.emergencia ? '' : ' atual'}"
      href="${esc(B.comoEndereco(c, { emergencia: '', pagina: 1 }))}">Todas</a>
    ${emgs.map(e => `<a class="emg${e.slug === c.emergencia ? ' atual' : ''}"
      href="${esc(B.comoEndereco(c, { emergencia: e.slug, pagina: 1 }))}"
      >${esc(e.nome)} <span class="emg-n">${e.n}</span></a>`).join('')}
  </nav>` : '';

  /* Quantos centros desta página trazem coordenadas. Sem nenhuma, não se
     oferece ordenar por distância — um botão que pede a localização e não
     consegue fazer nada com ela é pior do que não haver botão. */
  const comCoords = centros.filter(x => coordenadasValidas((x.dados || {}).coords)).length;

  /* Quantos resultados, e por causa de quê. Uma lista filtrada que não diz que
     está filtrada faz alguém concluir que o seu bairro não tem centro nenhum. */
  const filtrada = !!(c.q || c.aceitando || c.recentes || c.semLista);
  const conta = total === 1 ? '1 centro' : `${total} centros`;
  const resumo = c.semLista
    ? `${conta} ${total === 1 ? 'sem lista publicada' : 'sem lista publicada'}`
    : filtrada
      ? `${conta} ${total === 1 ? 'encontrado' : 'encontrados'}${c.q ? ` para “${esc(c.q)}”` : ''}`
      : `${conta} no ar`;

  /* Quem procura "cobertor" nunca encontra um centro sem dono: o texto de busca
     é feito das necessidades e eles não têm nenhuma. Responder como se não
     existissem manda alguém passar à porta de um ginásio aberto. Não se
     inventa uma necessidade que ninguém publicou — diz-se que estão lá. */
  const nota = (c.q && !c.semLista && semDono) ? `
  <p class="nota-sem-lista">${semDono === 1
      ? '1 centro na lista ainda não publicou o que precisa'
      : `${semDono} centros na lista ainda não publicaram o que precisam`} —
    esta procura não alcança nenhum deles.
    <a href="${esc(B.comoEndereco(c, { q: '', semLista: true, pagina: 1 }))}">Ver ${semDono === 1 ? 'esse centro' : 'esses centros'}</a>.</p>` : '';

  const paginacao = paginas > 1 ? `
  <nav class="paginas" aria-label="Páginas de resultados">
    ${c.pagina > 1
      ? `<a class="pg" rel="prev" href="${esc(B.comoEndereco(c, { pagina: c.pagina - 1 }))}">← anteriores</a>`
      : '<span class="pg vazia">← anteriores</span>'}
    <span class="pg-conta">página ${c.pagina} de ${paginas}</span>
    ${c.pagina < paginas
      ? `<a class="pg" rel="next" href="${esc(B.comoEndereco(c, { pagina: c.pagina + 1 }))}">seguintes →</a>`
      : '<span class="pg vazia">seguintes →</span>'}
  </nav>` : '';

  return molde({
    aqui: '/centros',
    titulo: 'Centros de apoio — o que precisam hoje',
    descricao: 'Lista dos centros de apoio e do que cada um precisa hoje.',
    corpo: `
<main class="lista-centros">
  <header>
    <h1>Centros de apoio</h1>
    <p class="entrada">Procure pelo nome do centro, pelo lugar, ou pelo que
      quer doar — escreva <b>cobertor</b> e veja quem está pedindo cobertores.
      <b>Ligue antes de vir</b> se a lista não for de hoje.</p>
  </header>

  ${comSacolas ? `
  <a class="entrada-sacola" href="/doar">
    ${svgIcone('caixa')}
    <span>
      <b>Vou levar doações</b>
      <span>Diga o que vai na sacola antes de sair de casa e receba um código
        para escrever nela. Na porta, o voluntário lê o código e já sabe o que
        tem dentro — sem abrir a sacola.</span>
    </span>
  </a>` : ''}

  ${barraEmg}

  <form class="procura" method="get" action="/centros" role="search">
    ${c.emergencia ? `<input type="hidden" name="e" value="${esc(c.emergencia)}">` : ''}
    <div class="linha-q">
      <label class="sr-only" for="q">Procurar por nome, lugar ou item</label>
      <input id="q" name="q" type="search" value="${esc(c.q)}"
        placeholder="cobertor, água, Canoas…" autocomplete="off" maxlength="80">
      <button class="btn" type="submit">Procurar</button>
    </div>

    <div class="opcoes">
      <label class="campo-ordem">
        <span>Ordenar</span>
        <select name="ordem">${opcoes}</select>
      </label>
      <label class="caixa">
        <input type="checkbox" name="aceitando" value="1"${c.aceitando ? ' checked' : ''}>
        <span>Só quem está recebendo</span>
      </label>
      <label class="caixa">
        <input type="checkbox" name="recentes" value="1"${c.recentes ? ' checked' : ''}>
        <span>Só listas da última semana</span>
      </label>
      <button class="btn secundario" type="submit" id="aplicar">Aplicar</button>
    </div>
  </form>

  <p class="resumo" role="status">${resumo}${
    (filtrada || c.semLista) ? ` · <a href="${esc(B.comoEndereco(c, { q: '', aceitando: false, recentes: false, semLista: false, pagina: 1 }))}">ver todos</a>` : ''}</p>
  ${nota}

  ${comCoords ? `
  <div class="perto-barra" id="perto-barra" hidden>
    <button type="button" class="btn" id="b-perto">${svgIcone('pino')}<span>Ordenar pelo mais perto de mim</span></button>
    <p class="perto-nota" id="perto-nota" role="status"></p>
  </div>` : ''}

  ${centros.length
    ? `<ul class="centros">${linhas}</ul>${paginacao}`
    : total === 0 && filtrada
      ? `<p class="sem-resultado">Nenhum centro com isso. Tente uma palavra só
          — "agua" em vez de "água mineral" — ou <a href="/centros">veja todos</a>.</p>`
      : `<p class="vazio">Ainda não há centros no ar. Se você está montando um,
          <a href="/novo">peça a página do seu centro</a>.</p>`}

  <footer class="pe">
    <p><b>Não encontrou seu centro?</b> <a href="/novo">Peça a página aqui.</a></p>
  </footer>
</main>
<script>
/* Acabamento, não mecanismo: sem isto o formulário continua a funcionar com o
   botão "Aplicar". Com isto, escolher uma ordem ou marcar uma caixa aplica-se
   sozinho e o botão sai da frente. */
(function () {
  var f = document.querySelector('.procura');
  if (!f) return;
  var b = document.getElementById('aplicar');
  if (b) b.hidden = true;
  [].slice.call(f.querySelectorAll('select,input[type=checkbox]'))
    .forEach(function (el) {
      el.addEventListener('change', function () {
        /* Uma escolha nova recomeça na primeira página: ficar na página 7 de
           uma lista que agora tem duas é uma página vazia sem explicação. */
        var p = f.querySelector('input[name=p]');
        if (p) p.remove();
        f.submit();
      });
    });
})();

/* ---------------------------------------------------------------------------
 * O mais perto de mim
 *
 * ISTO CORRE TODO NO APARELHO. A localização de quem procura nunca vai para o
 * servidor, nem num parâmetro, nem num pedido, nem num registo — o servidor
 * mandou as coordenadas dos centros desta página e é o browser que faz as
 * contas e reordena as linhas que já cá estão. Não é um pormenor de
 * implementação: é a única versão desta funcionalidade compatível com uma
 * ferramenta cujo rodapé diz que não recolhe dados sobre pessoas. Se alguém
 * um dia a mudar para ordenar em SQL, é essa frase que deixa de ser verdade.
 *
 * Duas consequências honestas, ditas na própria página:
 *
 * · Ordena os que estão NESTA página. Com mais de quarenta centros, o mais
 *   perto pode estar na página seguinte. Com uma dúzia — que é onde isto vai
 *   estar durante muito tempo — não acontece; quando acontecer, a ordenação
 *   passa a precisar do servidor e a decisão de privacidade volta à mesa.
 * · Centros sem coordenadas não desaparecem: vão para o fim, com a ordem que
 *   já tinham. Sumir com um centro por causa de um campo que quem aprova não
 *   preencheu seria transformar uma falha nossa numa viagem que não se faz.
 *
 * Sem JavaScript e sem permissão, a lista fica na ordem de sempre. O botão
 * está escondido no HTML e só este script o mostra — um botão que abre uma
 * caixa de permissões e não faz nada a seguir é pior do que nenhum botão.
 * -------------------------------------------------------------------------*/
(function () {
  var barra = document.getElementById('perto-barra');
  var bot = document.getElementById('b-perto');
  var nota = document.getElementById('perto-nota');
  var ul = document.querySelector('ul.centros');
  if (!barra || !bot || !ul || !navigator.geolocation) return;
  barra.hidden = false;

  /* Distância em linha recta, em km. Não é a distância de carro, e a página
     não a chama isso: com um rio pelo meio — que é o caso de metade das
     enchentes — o carro faz muito mais. Serve para ordenar, não para navegar. */
  function km(a, b, c, d) {
    var R = 6371, r = Math.PI / 180;
    var dl = (c - a) * r, dg = (d - b) * r;
    var s = Math.sin(dl / 2) * Math.sin(dl / 2)
      + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dg / 2) * Math.sin(dg / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  bot.addEventListener('click', function () {
    bot.disabled = true;
    nota.textContent = 'Pedindo sua localização…';
    navigator.geolocation.getCurrentPosition(function (pos) {
      var la = pos.coords.latitude, lo = pos.coords.longitude;
      var itens = [].slice.call(ul.children);
      var comDist = 0;

      itens.forEach(function (li, i) {
        var a = parseFloat(li.getAttribute('data-lat'));
        var o = parseFloat(li.getAttribute('data-lon'));
        /* A ordem original é o desempate, para os que não têm coordenadas
           ficarem entre si exactamente como estavam. */
        li._ord = i;
        if (isFinite(a) && isFinite(o)) {
          li._d = km(la, lo, a, o);
          comDist++;
          var marca = li.querySelector('.c-perto');
          if (marca) {
            marca.textContent = li._d < 1
              ? Math.round(li._d * 1000) + ' m em linha reta'
              : li._d.toFixed(li._d < 10 ? 1 : 0) + ' km em linha reta';
            marca.hidden = false;
          }
        } else { li._d = Infinity; }
      });

      itens.sort(function (x, y) {
        if (x._d !== y._d) return x._d - y._d;
        return x._ord - y._ord;
      }).forEach(function (li) { ul.appendChild(li); });

      var sem = itens.length - comDist;
      nota.textContent = 'Ordenado do mais perto ao mais longe, em linha reta — '
        + 'a viagem de carro é sempre maior.'
        + (sem ? ' ' + sem + (sem === 1
            ? ' centro ainda não tem localização exata e ficou no fim.'
            : ' centros ainda não têm localização exata e ficaram no fim.') : '')
        + ' Sua localização não saiu deste aparelho.';
      bot.hidden = true;
    }, function (e) {
      bot.disabled = false;
      nota.textContent = e && e.code === 1
        ? 'Sem a localização não dá para ordenar por distância — a lista continua '
          + 'pela mais útil primeiro. Você pode procurar pelo nome do seu bairro.'
        : 'Não conseguimos sua localização agora. A lista continua pela mais útil primeiro.';
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  });
})();
</script>`
  });
}

/**
 * Confirmar o encerramento.
 *
 * Um ecrã só para isto, e não uma caixa de seleção ao lado das outras: encerrar
 * tira o centro da lista pública e não é o mesmo que a pausa que está três
 * secções acima. As duas coisas parecem-se o suficiente para se trocarem, e
 * trocá-las custa a um centro real ficar invisível numa manhã de trabalho.
 *
 * Diz o que vai acontecer e o que NÃO vai, e a saída é maior do que a entrada.
 */
function paginaConfirmarEncerrar({ centro, url }) {
  const d = centro.dados || {};
  return molde({
    aqui: '/centro',
    migalhas: [['Meu centro', '/centro'], ['Atualizar a lista', '/atualizar'],
               ['Encerrar']],
    titulo: `Encerrar ${d.nome || centro.slug}?`,
    corpo: `
<main class="entrar">
  <header>
    <h1>Encerrar ${esc(d.nome || centro.slug)}?</h1>
  </header>

  <div class="aviso-caixa">
    <p><b>O que acontece:</b></p>
    <p>O centro sai da lista pública e deixa de aparecer nas buscas. Quem abrir
      o endereço — pelo QR de um cartaz, por exemplo — vê que o ponto fechou e é
      mandado para os centros que estão abertos.</p>
    <p><b>O que não acontece:</b> o endereço não desaparece, e os cartazes já
      impressos não passam a apontar para o nada.</p>
    <p><b>Para voltar atrás</b> é preciso falar connosco. Do seu lado não há
      como reabrir.</p>
  </div>

  <p class="entrada">Se o centro só parou por uns dias, <a href="/atualizar">volte
    atrás</a> e marque <b>não estamos recebendo</b>. É reversível e mantém o
    centro na lista.</p>

  <form method="post" action="/atualizar">
    <input type="hidden" name="slug" value="${esc(centro.slug)}">
    ${centro.codigoDado ? `<input type="hidden" name="codigo" value="${esc(centro.codigoDado)}">` : ''}
    <input type="hidden" name="encerrar" value="confirmar">
    <button class="btn btn-recusar largo" type="submit">Sim, o centro fechou</button>
  </form>

  <p><a class="btn btn-primario largo" href="/atualizar">Não, voltar à lista</a></p>
</main>`
  });
}

/**
 * A página de um centro que fechou.
 *
 * Continua a responder, e tem de continuar: há cartazes com este endereço
 * colados em portas e postes, e um QR já impresso não se corrige. O que não
 * pode é continuar a mostrar uma lista de necessidades — mandaria alguém
 * carregar cinco quilos de arroz até uma porta fechada, que é exactamente a
 * falha que esta ferramenta existe para evitar.
 *
 * Por isso diz o que aconteceu, em voz alta, e manda a pessoa para os outros
 * centros. O endereço e o telefone ficam: quem vai a caminho pode ligar.
 */
function paginaEncerrado({ centro, base }) {
  const d = centro.dados || {};
  return molde({
    aqui: false,
    classe: 'mono-ok',
    titulo: `${d.nome || centro.slug} — encerrado`,
    descricao: 'Este ponto de arrecadação encerrou.',
    corpo: `
<main class="centro faixas">
  <header class="topo-c">
    <p class="tipo">${esc(d.tipo || 'Ponto de arrecadação')}</p>
    <h1>${esc(d.nome || centro.slug)}</h1>
  </header>

  <p class="idade velha">Este ponto de arrecadação <b>encerrou</b>. Não traga
    nada para aqui.</p>

  <section class="fechou">
    ${svgProibido('caixa')}
    <p>O centro avisou que fechou${centro.decidido
      ? ` em ${dataCurta(centro.decidido)}` : ''}. A página fica no ar porque há
      cartazes impressos com este endereço — mas a lista que estava aqui já não
      vale.</p>
    <a class="btn btn-primario largo" href="/centros">Ver os centros que estão abertos</a>
  </section>

  ${d.endereco || d.contato ? `
  <section class="contato">
    <h2>Se você já está a caminho</h2>
    ${d.endereco ? `<p class="lin">${svgIcone('pino')}<span>${esc(d.endereco)}</span></p>` : ''}
    ${d.contato ? `<p class="lin">${svgIcone('telefone')}<a href="tel:${esc(String(d.contato).replace(/[^+\d]/g, ''))}"><span>${esc(d.contato)}</span></a></p>` : ''}
    <p class="porque">O telefone pode já não atender. Ligue antes de sair.</p>
  </section>` : ''}
</main>`
  });
}

/* ---------------------------------------------------------------------------
 * PEDIR UM CÓDIGO NOVO
 *
 * Esta página não emite nada. Manda um recado.
 *
 * O código é o que deixa escrever na página de um centro, por isso não pode ser
 * um formulário a decidir quem o recebe — bastava saber o nome de um centro,
 * que está numa lista pública, para tomar conta dele. A verificação é um
 * telefonema para o número que foi conferido à mão na aprovação, e o código
 * novo vai para ESSE número e não para quem o pediu. Quem se fizer passar por
 * um coordenador consegue, no máximo, que o centro receba um código novo.
 *
 * O que isto resolve é o dead end: até aqui a página dizia "fale com quem
 * aprovou o seu centro" sem dizer como, a alguém que provavelmente nunca soube
 * quem foi.
 * -------------------------------------------------------------------------*/
function paginaPedirCodigo({ erro, feito, slug, nome }) {
  return molde({
    aqui: '/centro',
    migalhas: [['Meu centro', '/centro'], ['Atualizar a lista', '/atualizar'],
               ['Pedir um código novo']],
    titulo: 'Pedir um código novo — CAPEM',
    descricao: 'Peça um código novo para seu centro.',
    corpo: `
<main class="entrar">
  <header>
    <h1>Pedir um código novo</h1>
  </header>

  ${feito ? `<p class="feito">Pedido enviado${nome ? ` para <b>${esc(nome)}</b>` : ''}.
    Vamos ligar para o telefone do centro para confirmar, e o código novo segue
    para esse mesmo número. Se ninguém ligar até amanhã, tente outra vez.</p>` : ''}
  ${erro ? `<p class="erro-form">${esc(erro)}</p>` : ''}

  ${feito ? '' : `
  <p class="entrada">Escreva o endereço da página do seu centro. Não precisa
    saber o código — é isso que você está pedindo.</p>

  <form method="post" action="/pedir-codigo">
    <label class="campo" for="slug">Endereço da sua página</label>
    <input id="slug" name="slug" type="text" value="${esc(slug || '')}"
      placeholder="canoas-ss" autocomplete="off" spellcheck="false"
      inputmode="url" maxlength="60" required>
    <p class="ajuda">Só o nome — a parte depois da barra. Está no rodapé de
      todas as peças que imprimiu.</p>

    <label class="campo" for="nota">Quem é, e o que aconteceu (opcional)</label>
    <input id="nota" name="nota" type="text" maxlength="140" autocomplete="off"
      placeholder="Sou a Ana, da cozinha. O papel com o código molhou.">
    <p class="ajuda">Ajuda a saber com quem falar quando ligarmos.</p>

    <button class="btn btn-primario largo" type="submit">Pedir</button>
  </form>

  <div class="aviso-caixa">
    <p><b>Como funciona, para não haver surpresas:</b></p>
    <p>Ligamos para o telefone que está na página do centro — o mesmo que foi
      conferido quando o centro foi aprovado. O código novo vai para esse
      número, e não para quem fez este pedido.</p>
    <p>Assim que for emitido, <b>o código antigo deixa de funcionar</b>. Se
      alguém ainda o tiver escrito num papel, esse papel deixa de valer.</p>
  </div>`}

  <footer class="pe">
    <p><a href="/atualizar">Voltar</a> — se afinal encontrou o código.</p>
  </footer>
</main>`
  });
}

/* ---------------------------------------------------------------------------
 * A ACTUALIZAÇÃO DIÁRIA
 *
 * A página que um coordenador abre todas as manhãs, e a única cujo êxito se
 * mede em segundos. Tudo o resto neste projecto existe para que esta seja
 * usada: uma lista que não é tocada envelhece, e uma lista velha manda um
 * vizinho carregar cinco quilos de arroz até um centro que já não os quer.
 *
 * Por isso NÃO é o kit. O kit é a ferramenta de montar um centro — quinze peças,
 * fontes embutidas, 273 KB. Abri-lo para trocar dois itens é atravessar uma
 * gráfica para escrever um recado. Esta página são 30 KB, abre com uma barra de
 * rede, e mostra exactamente uma coisa: o que precisamos hoje.
 *
 * Três decisões que valem a pena:
 *
 *   · **O nome, a endereco e o telefone aparecem, mas não se editam.** Foram
 *     verificados à mão e a publicação já os ignorava; mostrá-los apagados diz
 *     isso sem uma frase de explicação, e evita que alguém escreva por cima à
 *     espera que mude.
 *   · **Formulário normal, sem JavaScript obrigatório.** Um POST, um redirect.
 *     O telemóvel do coordenador é o pior aparelho da cadeia toda.
 *   · **A idade da lista está no topo, a dizer-se em voz alta.** É a única
 *     razão para ele estar aqui, e a única coisa que a página sabe melhor do
 *     que ele.
 * -------------------------------------------------------------------------*/
/* ---------------------------------------------------------------------------
 * "Sou deste centro"
 *
 * O caminho de volta de uma página que nós criámos sem falar com ninguém.
 *
 * Não entrega nada, e é preciso dizer porquê: os nomes dos centros estão numa
 * lista pública, por isso um formulário que emitisse o código bastaria saber um
 * nome para tomar conta da página de uma paróquia. A verificação é o telefonema
 * — a mesma que já é para todos os outros — e é a única que existe.
 * -------------------------------------------------------------------------*/
function paginaSouDaqui({ centro, erro }) {
  const d = centro.dados || {};
  const nome = d.nome || centro.slug;
  return molde({
    migalhas: [['Centros de apoio', '/centros'], [nome, '/' + centro.slug], ['Sou deste centro']],
    titulo: `Sou deste centro — ${nome}`,
    descricao: 'Assuma a página do seu centro e publique o que ele precisa hoje.',
    corpo: `
<main class="entrar">
  <header>
    <h1>Sou deste centro</h1>
    <p class="entrada">A página de <b>${esc(nome)}</b> foi montada por nós, com
      informações públicas, para o centro não ficar de fora da lista. Quem é da
      casa pode assumir a página e publicar o que falta lá hoje.</p>
  </header>

  ${erro ? `<p class="erro" role="alert">${esc(erro)}</p>` : ''}

  <form method="POST" action="/sou-daqui">
    <input type="hidden" name="slug" value="${esc(centro.slug)}">
    <label class="campo" for="sd-nome">Seu nome</label>
    <input id="sd-nome" name="nome" type="text" maxlength="80" required autocomplete="name">

    <label class="campo" for="sd-contato">Telefone</label>
    <input id="sd-contato" name="contato" type="tel" maxlength="40" required
      autocomplete="tel" inputmode="tel">
    <p class="ajuda">Vamos ligar para este número antes de entregar o código. É a
      única conferência que existe, e não há formulário que a faça.</p>

    <label class="campo" for="sd-papel">O que você faz lá (opcional)</label>
    <input id="sd-papel" name="papel" type="text" maxlength="60" autocomplete="off"
      placeholder="coordeno a triagem">

    <button class="btn btn-primario">Enviar</button>
  </form>

  <section class="pedir">
    <h2>Enquanto isso</h2>
    <p class="dica">O material impresso nunca precisou de código nenhum, só do
      nome do centro. Se estão recebendo doações hoje, imprima já:
      <a href="/kit?slug=${esc(centro.slug)}">cartazes, placas e crachás</a>.</p>
  </section>
</main>`
  });
}

function paginaSouDaquiRecebido({ centro, base }) {
  const d = centro.dados || {};
  const nome = d.nome || centro.slug;
  return molde({
    migalhas: [['Centros de apoio', '/centros'], [nome, '/' + centro.slug], ['Sou deste centro']],
    titulo: 'Recebemos seu pedido',
    corpo: `
<main class="entrar">
  <header>
    <h1>Recebemos</h1>
    <p class="entrada">Vamos ligar para conferir que você é mesmo de
      <b>${esc(nome)}</b>. Depois disso o código de publicação vai para o telefone
      que você deixou — e a partir daí a página deixa de dizer que ninguém a
      confirmou.</p>
  </header>

  <div class="aviso-caixa">
    <p><b>A página continua no ar</b> como está, com endereço e telefone. Nada
      some enquanto esperamos.</p>
    <p>Se alguma informação estiver errada, diga no telefonema: nome, endereço e
      telefone só mudam com uma pessoa do outro lado.</p>
  </div>

  <section class="pedir">
    <h2>Não espere por nós para começar</h2>
    <p class="dica">Imprima o material hoje — nunca precisou de código:
      <a href="/kit?slug=${esc(centro.slug)}">cartazes, placas e crachás</a>.</p>
  </section>
</main>`
  });
}

/* ===========================================================================
 * SACOLAS — o doador em casa, e o voluntário na porta
 *
 * A ideia inteira: a doação é descrita ANTES de sair de casa, e a porta passa a
 * ser uma leitura em vez de um interrogatório. O código descodifica-se sozinho,
 * por isso funciona sem rede; o servidor acrescenta a hora e nunca é a
 * condição para haver resposta.
 * ========================================================================= */

/** Os dezasseis itens, agrupados como no catálogo — sem os quatro que afogam. */
function gradeDeItens(escolhidos) {
  const on = new Set(escolhidos || []);
  return GRUPOS.map(g => {
    const ids = g.ids.filter(id => SAC.ITENS.indexOf(id) >= 0);
    if (!ids.length) return '';
    return `<fieldset class="grupo">
      <legend>${esc(g.g)}</legend>
      <div class="itens">
        ${ids.map(id => `<label class="item${on.has(id) ? ' ligado' : ''}">
          <input type="checkbox" name="itens" value="${esc(id)}"${on.has(id) ? ' checked' : ''}>
          ${svgIcone(id)}
          <span class="it-nome">${esc(ROTULO_BR[id] || id)}</span>
        </label>`).join('')}
      </div>
    </fieldset>`;
  }).join('');
}

function paginaDoar({ erro, escolhidos, centro }) {
  const naoTraga = RECUSAS.map(id => `<li>${svgProibido(id)}<span>${esc(ROTULO_BR[id] || id)}</span></li>`).join('');
  return molde({
    aqui: '/centros',
    migalhas: [['Centros de apoio', '/centros'], ['Registrar uma sacola']],
    titulo: 'Registrar uma sacola — CAPEM',
    descricao: 'Diga o que vai dentro antes de sair de casa e receba um código para escrever na sacola.',
    corpo: `
<main class="doar">
  <header>
    <h1>Registrar uma sacola</h1>
    <p class="entrada">Diga o que vai dentro antes de sair de casa. Você recebe um
      código curto para escrever na sacola com caneta. Na porta, o voluntário lê o
      código e já sabe o que tem dentro — sem abrir a sacola e sem fila parada.</p>
    ${centro ? `<p class="dica">Você veio da página de <b>${esc(centro)}</b>. O código
      não fica preso a nenhum centro: se mudar de ideias no caminho, vale igual.</p>` : ''}
  </header>

  ${erro ? `<p class="erro-form" role="alert">${esc(erro)}</p>` : ''}

  <form method="post" action="/doar" class="form-atualizar">
    <h2>O que vai nesta sacola?</h2>
    <p class="ajuda">Uma categoria por sacola. É isso que deixa a sacola ir direto
      para a prateleira, em vez de ser aberta e espalhada no chão. Se levar coisas
      de categorias diferentes, registre uma sacola de cada vez.</p>
    ${gradeDeItens(escolhidos)}

    <h2>Quantas sacolas iguais a esta?</h2>
    <p class="ajuda">O mesmo código serve para todas as sacolas com o mesmo
      conteúdo. Acima de oito volumes, ligue para o centro antes de sair: uma
      carga que chega sem aviso ocupa a porta, o corredor e o pátio.</p>
    <label class="campo" for="volumes">Volumes</label>
    <input id="volumes" name="volumes" type="number" value="1" min="1" max="8" inputmode="numeric">

    <label class="caixa"><input type="checkbox" name="outros" value="1">
      <span>Tem alguma coisa que não está na lista</span></label>
    <p class="ajuda">O código guarda que existe, não o quê — escreva num papel e
      ponha dentro da sacola. Um código que levasse texto livre deixaria de caber
      numa etiqueta escrita à mão.</p>

    <button class="btn btn-primario largo" type="submit">Registrar e gerar o código</button>
  </form>

  <section class="bloco-nao">
    <h2>${svgAnel()}<span>Por favor, não traga</span></h2>
    <p class="porque">Roupa usada foi 70% de tudo que chegou ao Rio Grande do Sul em
      2024. Triar é o trabalho que mais consome voluntário, e o que sobra apodrece
      no pátio. Recusar aqui não custa nada; recusar na porta custa sua viagem.</p>
    <ul class="marcas">${naoTraga}</ul>
  </section>

  <p class="ajuda">O registro guarda o que vai dentro da sacola e mais nada.
    Não pedimos quem você é, e não temos como saber.</p>
</main>`
  });
}

function paginaSacolaCriada({ sacola, base, centros }) {
  const d = SAC.descodificar(sacola.codigo);
  const lista = d.ids.map(id => ROTULO_BR[id] || id).join(', ');
  const url = `${base}/balcao?c=${d.codigo.replace('-', '')}`;
  return molde({
    migalhas: [['Centros de apoio', '/centros'], ['Registrar uma sacola']],
    titulo: `Sacola ${d.codigo} — CAPEM`,
    corpo: `
<main class="doar">
  <header>
    <h1>Pronto. Agora escreva.</h1>
  </header>

  <section class="caneta">
    <h2>Escreva o código na sacola, com caneta</h2>
    <p>Papel molha, celular fica sem bateria, tela quebra. Sete letras escritas na
      própria sacola chegam ao centro em qualquer um desses dias.</p>
  </section>

  <div class="codigo-caixa">
    <p class="rotulo">Sacola · ${d.volumes} ${d.volumes === 1 ? 'volume' : 'volumes'}</p>
    <p class="codigo">${esc(d.codigo)}</p>
    <p class="cc-itens">${esc(lista)}${d.outros ? ' + o que estiver escrito no papel dentro' : ''}</p>
  </div>

  <section class="qr-sacola">
    ${QR.svg(url, 132, { label: `QR da sacola ${d.codigo}` })}
    <p>Quem tiver celular na porta pode ler o QR em vez de digitar — ele abre a
      página de leitura já com o código preenchido. O que está escrito na sacola
      continua sendo o que vale.</p>
    <p class="qr-endereco">Se o QR não ler, o endereço é
      <b>${esc(url.replace(/^https?:\/\//, ''))}</b> — ou <b>${esc(base.replace(/^https?:\/\//, ''))}/balcao</b>
      e o código à mão.</p>
  </section>

  <h2>Onde entregar</h2>
  ${centros && centros.length ? `
  <p class="ajuda">Estes centros leem códigos de sacola. O código não fica preso a
    nenhum deles — pode entregar em qualquer lugar.</p>
  <ul class="centros">${centros.map(c => {
    const dd = c.dados || {};
    return `<li class="c-item"><a class="c-cartao" href="${esc(c.url || base + '/' + c.slug)}">
      <span class="c-nome">${esc(dd.nome || c.slug)}</span>
      <span class="c-endereco">${esc(dd.endereco || '')}</span>
    </a></li>`;
  }).join('')}</ul>` : `
  <p class="ajuda">Nenhum centro perto de você lê códigos de sacola ainda — é novo,
    e eles ligam quando querem. O código continua valendo: na porta, o voluntário
    pode ler pelo celular. Veja a lista completa e ligue antes de vir.</p>`}
  <p><a class="btn largo" href="/centros">Ver todos os centros</a></p>

  <p><a class="btn largo" href="/doar">Registrar outra sacola</a></p>
  <p><a class="btn largo" href="/minhas-sacolas">Minhas sacolas</a></p>
</main>
<script>
/* O histórico do doador vive NESTE aparelho e em mais lado nenhum, para o
   servidor não ter de saber de quem são as sacolas. Sem JavaScript nada disto
   acontece — e não faz falta: o código está no ecrã, em letras grandes, e a
   instrução é escrevê-lo na sacola. */
(function () {
  try {
    var k = 'capem.sacolas';
    var v = JSON.parse(localStorage.getItem(k) || '[]');
    if (v.indexOf(${paraScript(d.codigo)}) < 0) v.unshift(${paraScript(d.codigo)});
    localStorage.setItem(k, JSON.stringify(v.slice(0, 60)));
  } catch (e) { /* modo privado, armazenamento cheio: perde-se o histórico e mais nada */ }
})();
</script>`
  });
}

function paginaMinhasSacolas() {
  return molde({
    migalhas: [['Minhas sacolas']],
    titulo: 'Minhas sacolas — CAPEM',
    corpo: `
<main class="doar">
  <header>
    <h1>Minhas sacolas</h1>
    <p class="entrada">Ficam guardadas neste aparelho. Não sabemos que são suas —
      só este celular sabe. Limpar os dados do navegador apaga esta lista e mais
      nada: as sacolas continuam valendo.</p>
  </header>
  <div id="lista"><p class="ajuda">Carregando…</p></div>
  <noscript><p class="erro-form">Esta página precisa de JavaScript, porque a lista
    está guardada no seu próprio aparelho. O código escrito na sacola funciona sem
    ela.</p></noscript>
  <p><a class="btn largo" href="/doar">Registrar uma sacola</a></p>
</main>
<script>
(function () {
  var alvo = document.getElementById('lista');
  var v = [];
  try { v = JSON.parse(localStorage.getItem('capem.sacolas') || '[]'); } catch (e) {}
  if (!v.length) {
    alvo.innerHTML = '<p class="ajuda">Nenhuma sacola registrada neste aparelho ainda.</p>';
    return;
  }
  fetch('/api/sacolas', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigos: v.slice(0, 60) }) })
    .then(function (r) { return r.json(); })
    .then(function (linhas) {
      alvo.innerHTML = linhas.map(function (x) {
        var quando = x.recebida
          ? '<span class="selo-bom">Recebida ' + x.quando + '</span>' +
            (x.centro ? ' <span class="c-endereco">' + x.centro + '</span>' : '')
          : '<span class="selo-espera">Ainda não entregue</span>';
        return '<div class="sacola-linha"><p class="codigo-pequeno">' + x.codigo + '</p>' +
               '<p class="cc-itens">' + x.itens + '</p><p>' + quando + '</p></div>';
      }).join('');
    })
    .catch(function () {
      alvo.innerHTML = '<p class="ajuda">Não deu para conferir agora. Os códigos ' +
        'escritos nas sacolas continuam valendo.</p>';
    });
})();
</script>`
  });
}

/* --- o balcão ------------------------------------------------------------ */
function paginaBalcao({ codigo, erro }) {
  return molde({
    aqui: '/balcao',
    migalhas: [['Balcão']],
    titulo: 'Ler uma sacola — CAPEM',
    descricao: 'Digite o código escrito na sacola e veja o que tem dentro.',
    corpo: `
<main class="balcao">
  <header>
    <h1>Ler uma sacola</h1>
    <p class="entrada">Sete letras escritas na sacola. Digite e o que tem dentro
      aparece. <b>Qualquer pessoa pode ler</b> — não precisa de cadastro, nem de
      código de centro, nem que o centro esteja na lista.</p>
  </header>

  ${erro ? `<p class="erro-form" role="alert">${esc(erro)}</p>` : ''}

  <form method="post" action="/balcao" class="entrar">
    <label class="campo" for="c">Código da sacola</label>
    <input id="c" name="c" type="text" value="${esc(codigo || '')}" maxlength="9"
      placeholder="ABC-2345" autocomplete="off" spellcheck="false"
      autocapitalize="characters" required>
    <p class="ajuda">Sem I, sem O e sem S; sem 0, sem 1 e sem 5. Essas letras se
      confundem quando alguém escreve com caneta numa sacola molhada, por isso
      não entram em nenhum código.</p>
    <button class="btn btn-primario largo" type="submit">Ler</button>
  </form>
</main>`
  });
}

function paginaBalcaoSacola({ sacola, centros, erro }) {
  const d = sacola.decodificada;
  const linhas = d.ids.map(id => `<div class="linha-item">${svgIcone(id)}
      <b>${esc(ROTULO_BR[id] || id)}</b></div>`).join('');
  const jaRecebida = sacola.linha && sacola.linha.recebida;
  return molde({
    aqui: '/balcao',
    migalhas: [['Balcão', '/balcao'], [d.codigo]],
    titulo: `Sacola ${d.codigo} — CAPEM`,
    corpo: `
<main class="balcao">
  <header>
    <h1>O que tem dentro</h1>
  </header>

  ${erro ? `<p class="erro-form" role="alert">${esc(erro)}</p>` : ''}

  <div class="achado">
    <p class="codigo">${esc(d.codigo)}</p>
    <p class="a-sub">${d.volumes} ${d.volumes === 1 ? 'volume' : 'volumes'} ·
      ${sacola.linha
        ? (jaRecebida
            ? `recebida em ${esc(dataCurta(sacola.linha.recebida))}${sacola.linha.centro ? ' · ' + esc(sacola.linha.centro) : ''}`
            : 'registrada, ainda não recebida')
        : 'não confirmada'}</p>
    ${linhas}
    ${d.outros ? `<div class="linha-item">${svgIcone('caixa')}
      <b>Tem coisa fora da lista — o papel dentro da sacola diz o quê</b></div>` : ''}
  </div>

  ${!sacola.linha ? `<p class="idade velha">Este código não consta como registrado.
    Ou foi digitado errado, ou a sacola foi descrita sem internet. <b>Receba pelo
    que se vê</b> — um código que não confere nunca deve parar uma doação na
    porta.</p>` : ''}

  ${jaRecebida ? `<p class="idade fresca-ok">Esta sacola já foi recebida. A primeira
    porta é a porta: confirmar outra vez não muda nada.</p>` : `
  <form method="post" action="/balcao/receber" class="entrar">
    <input type="hidden" name="c" value="${esc(d.codigo)}">
    <input type="hidden" name="lat" id="lat" value="">
    <input type="hidden" name="lon" id="lon" value="">
    <h2>Onde você está?</h2>
    <p class="ajuda" id="perto-diz">O celular pode dizer em qual centro você está.
      Se não quiser dar a localização, escolha na lista — funciona igual.</p>
    <p><button class="btn" type="button" id="b-perto">Usar minha localização</button></p>
    <label class="campo" for="centro">Centro</label>
    <select id="centro" name="centro">
      <option value="">Aqui não está na lista</option>
      ${(centros || []).map(c => `<option value="${esc(c.slug)}">${esc((c.dados || {}).nome || c.slug)}</option>`).join('')}
    </select>
    <button class="btn btn-primario largo" type="submit">Recebida aqui</button>
  </form>
  <p><a class="btn largo" href="/balcao">Não é para aqui — ler outra</a></p>`}
</main>
${jaRecebida ? '' : `<script>
/* A localização é finalização, nunca mecanismo: sem JavaScript a lista de
   centros continua a ser um formulário que funciona. O que o script faz é
   preencher dois campos escondidos, e o servidor resolve as coordenadas para um
   centro e DEITA-AS FORA no mesmo pedido — nunca ficam guardadas, nem numa
   linha, nem num log. Ver o comentário em /balcao/receber. */
(function () {
  var b = document.getElementById('b-perto');
  if (!b || !navigator.geolocation) return;
  b.addEventListener('click', function () {
    var diz = document.getElementById('perto-diz');
    diz.textContent = 'Procurando…';
    navigator.geolocation.getCurrentPosition(function (p) {
      document.getElementById('lat').value = p.coords.latitude;
      document.getElementById('lon').value = p.coords.longitude;
      diz.textContent = 'Localização pronta. Confirme o centro abaixo antes de salvar.';
      b.disabled = true;
    }, function () {
      diz.textContent = 'Não deu para pegar a localização. Escolha o centro na lista.';
    }, { enableHighAccuracy: true, timeout: 8000 });
  });
})();
</script>`}`
  });
}

function paginaBalcaoRecebida({ sacola, nomeCentro }) {
  const d = sacola.decodificada;
  return molde({
    aqui: '/balcao',
    migalhas: [['Balcão', '/balcao'], [d.codigo]],
    titulo: `Recebida — ${d.codigo}`,
    corpo: `
<main class="balcao">
  <header>
    <h1>Recebida</h1>
  </header>
  <div class="achado">
    <p class="codigo">${esc(d.codigo)}</p>
    <p class="a-sub">${d.volumes} ${d.volumes === 1 ? 'volume' : 'volumes'}${
      nomeCentro ? ' · ' + esc(nomeCentro) : ' · centro não informado'}</p>
    ${d.ids.map(id => `<div class="linha-item">${svgIcone(id)}
      <b>${esc(ROTULO_BR[id] || id)}</b></div>`).join('')}
  </div>
  <p class="ajuda">Quem registrou esta sacola vê esta hora no próprio celular.
    Até este toque ela existia sozinha, sem centro.</p>
  <p><a class="btn btn-primario largo" href="/balcao">Ler a próxima</a></p>
</main>`
  });
}

function paginaAtualizarEntrada({ erro, slug }) {
  return molde({
    aqui: '/centro',
    migalhas: [['Meu centro', '/centro'], ['Atualizar a lista']],
    titulo: 'Atualizar a lista — CAPEM',
    descricao: 'Atualize a lista de necessidades do seu centro.',
    corpo: `
<main class="entrar">
  <header>
    <h1>Atualizar a lista de hoje</h1>
    <p class="entrada">Trinta segundos. Escreva o endereço da sua página e o
      código que recebeu — o mesmo que está no papel colado ao lado do
      computador.</p>
  </header>

  ${erro ? `<p class="erro-form">${esc(erro)}</p>` : ''}

  <form method="post" action="/atualizar">
    <label class="campo" for="slug">Endereço da sua página</label>
    <input id="slug" name="slug" type="text" value="${esc(slug || '')}"
      placeholder="canoas-ss" autocomplete="off" spellcheck="false"
      inputmode="url" maxlength="60" required>
    <p class="ajuda">Só o nome basta — a parte depois da barra. Está no rodapé
      de todas as peças que imprimiu.</p>

    <label class="campo" for="codigo">Código</label>
    <input id="codigo" name="codigo" type="text" placeholder="ABCD-2345"
      autocomplete="off" spellcheck="false" maxlength="20" required>
    <p class="ajuda">Oito letras e números. Não há O, nem I, nem S — se parecer
      um desses, é zero, um ou cinco.</p>

    <button class="btn btn-primario largo" type="submit">Ver minha lista</button>
  </form>

  <footer class="pe">
    <p><b>Ainda não tem página?</b> <a href="/novo">Peça uma aqui.</a></p>
    <p><b>Perdeu o código?</b> Não há como recuperá-lo — só emitir outro.
      <a href="/pedir-codigo">Peça um código novo aqui.</a></p>
    <p><b>Quer imprimir material novo?</b> <a href="/kit">O kit está aqui</a> —
      e puxa seus dados com o mesmo código, sem escrever tudo outra vez.</p>
  </footer>
</main>`
  });
}

/**
 * A lista, aberta para edição.
 *
 * O estado vem todo do servidor a cada carregamento: não há nada guardado no
 * aparelho, o que significa que funciona igual no telemóvel do coordenador, no
 * computador da secretaria e no telemóvel de quem o está a substituir hoje.
 */
function paginaAtualizar({ centro, url, erro, feito, sessao }) {
  const d = centro.dados || {};
  const i = idade(centro.publicado);
  const escolhidos = new Map();
  (d.precisa || []).forEach(v => { const x = item(v); if (!x.livre) escolhidos.set(x.id, x.q || ''); });
  const livres = (d.precisa || []).map(item).filter(x => x.livre);
  const naoTraga = new Set((d.naoTraga || []).map(v => item(v).id));

  const grupos = GRUPOS.map(g => `
    <fieldset class="grupo">
      <legend>${esc(g.g)}</legend>
      <div class="itens">
        ${g.ids.map(id => {
          const on = escolhidos.has(id);
          return `<label class="item${on ? ' ligado' : ''}">
            <input type="checkbox" name="precisa" value="${esc(id)}"${on ? ' checked' : ''}>
            ${svgIcone(id)}
            <span class="it-nome">${esc(ROTULO_BR[id] || id)}</span>
            <input class="it-q" type="text" name="q-${esc(id)}" value="${esc(escolhidos.get(id) || '')}"
              placeholder="quantos?" maxlength="12" autocomplete="off"
              aria-label="Quantidade de ${esc(ROTULO_BR[id] || id)}">
          </label>`;
        }).join('')}
      </div>
    </fieldset>`).join('');

  return molde({
    aqui: '/centro',
    migalhas: [['Meu centro', '/centro'], ['Atualizar a lista', '/atualizar'],
               [d.nome || centro.slug]],
    titulo: `Atualizar — ${d.nome || centro.slug}`,
    descricao: 'Atualize a lista de necessidades do seu centro.',
    corpo: `
<main class="atualizar faixas">
  <header class="topo-c">
    <h1>${esc(d.nome || centro.slug)}</h1>
    <p class="endereco">${d.endereco
      ? `<a href="${esc(linkMapa(d.endereco, d.coords))}" target="_blank" rel="noopener">${esc(d.endereco)}</a>`
      : ''}${d.contato ? ' · ' + esc(d.contato) : ''}</p>
    ${d.endereco ? `<p class="ajuda conferir">Toque no endereço para ver onde ele cai no
      mapa — é o mesmo link que aparece na lista de centros. Se cair no lugar
      errado, fale com quem aprovou seu centro.</p>` : ''}
  </header>

  ${sessao ? `
  <div class="barra-sessao">
    <p>Você entrou como <b>${esc(d.nome || centro.slug)}</b>. Fica aberto por
      doze horas neste aparelho.</p>
    <a class="btn secundario" href="/atualizar/sair">Sair</a>
  </div>` : ''}

  ${feito ? `<p class="feito">Publicado. Sua página já mostra esta lista.
    <a href="${esc(url)}">Ver a página</a></p>` : ''}
  ${erro ? `<p class="erro-form">${esc(erro)}</p>` : ''}
  ${faixaIdade(centro.publicado)}
  ${i.nivel === 'fresca' && !feito
    ? '<p class="idade fresca-ok">Sua lista é de hoje. Se nada mudou, não precisa fazer nada.</p>'
    : ''}

  <form method="post" action="/atualizar" class="form-atualizar">
    <input type="hidden" name="slug" value="${esc(centro.slug)}">
    <!-- A chave só volta ao HTML quando não houve como abrir sessão (cookies
         desligados). Com sessão, este campo não existe: um campo escondido põe
         o código no DOM, no botão de voltar e no ver-código-fonte do telemóvel
         emprestado, e um cookie HttpOnly não se lê. -->
    ${centro.codigoDado ? `<input type="hidden" name="codigo" value="${esc(centro.codigoDado)}">` : ''}
    <input type="hidden" name="publicar" value="1">

    <section class="bloco-a">
      <h2>Estamos recebendo?</h2>
      <label class="caixa grande">
        <input type="checkbox" name="pausado" value="1"${d.pausado ? ' checked' : ''}>
        <span>Não estamos recebendo agora</span>
      </label>
      <p class="ajuda">A página passa a dizer isso em vez da lista. Um centro
        cheio que não consegue pedir para parar continua recebendo.</p>
      <label class="campo" for="motivo">Motivo (opcional)</label>
      <input id="motivo" name="motivoPausa" type="text" value="${esc(d.motivoPausa || '')}"
        placeholder="Estamos cheios. Ligue antes de vir." maxlength="140" autocomplete="off">
    </section>

    <section class="bloco-a">
      <h2>Precisamos hoje</h2>
      <p class="ajuda">Toque para ligar e desligar. A quantidade é opcional —
        cabe <b>200</b>, <b>500 L</b>, <b>20 caixas</b>. Ela só aparece aqui na
        página, nunca no papel: um número impresso não se corrige.</p>
      ${grupos}
    </section>

    <section class="bloco-a">
      <h2>Outros itens</h2>
      <p class="ajuda">Um por linha. O que não está no catálogo sai com uma
        caixa genérica — use com moderação, porque não diz nada a quem não lê
        português.</p>
      <label class="sr-only" for="livres">Outros itens, um por linha</label>
      <textarea id="livres" name="livres" rows="3" maxlength="600"
        placeholder="Ração para cães&#10;Carregador de celular">${esc(livres.map(x => x.rotulo + (x.q ? ' | ' + x.q : '')).join('\n'))}</textarea>
      <p class="ajuda">Para pôr quantidade, escreva <b>Ração para cães | 20 kg</b>.</p>
    </section>

    <section class="bloco-a">
      <h2>Por favor, não traga</h2>
      <div class="itens recusas">
        ${RECUSAS.map(id => {
          const on = naoTraga.has(id);
          return `<label class="item${on ? ' ligado' : ''}">
            <input type="checkbox" name="naoTraga" value="${esc(id)}"${on ? ' checked' : ''}>
            ${svgProibido(id)}
            <span class="it-nome">${esc(ROTULO_BR[id] || id)}</span>
          </label>`;
        }).join('')}
      </div>
      <p class="ajuda">É a parte que quase ninguém desenha e a que mais evita
        transtorno. Nas enchentes de 2024, roupa chegou a 70% de tudo que foi
        arrecadado no país.</p>
    </section>

    <section class="bloco-a">
      <h2>Sacolas com código</h2>
      <label class="caixa"><input type="checkbox" name="sacolas" value="1"${d.sacolas ? ' checked' : ''}>
        <span>Aceitamos sacolas registradas em casa</span></label>
      <p class="ajuda">Quem doa descreve a sacola antes de sair de casa e escreve um
        código nela; na porta, um voluntário lê o código e vê o que tem dentro sem
        abrir a sacola. Não precisa de código de centro nem de cadastro. Marque só
        se alguém aí vai fazer isso — senão a página promete a um doador uma coisa
        que ninguém faz.</p>
      <p class="ajuda"><a href="/balcao" target="_blank" rel="noopener">Abrir o balcão
        de leitura</a> — é essa a página que fica no celular de quem está na porta.
        É pública: pode mandar o endereço para qualquer voluntário.</p>

      <h2>Horário</h2>
      <label class="sr-only" for="horario">Horário</label>
      <input id="horario" name="horario" type="text" value="${esc(d.horario || '')}"
        placeholder="Todos os dias, 8h às 20h" maxlength="80" autocomplete="off">
    </section>

    <button class="btn btn-primario largo" type="submit">Publicar a lista de hoje</button>
    <p class="ajuda">Depois de publicar, mande o link no grupo — é por aí que a
      lista chega mais longe, e um link nunca fica velho como uma imagem.</p>
  </form>

  <section class="bloco-a encerrar">
    <h2>O centro fechou de vez?</h2>
    <p class="ajuda">Se for só por hoje ou por uns dias, use <b>não estamos
      recebendo</b> lá em cima — é reversível e mantém o centro na lista.</p>
    <p class="ajuda">Encerrar é para quando o ponto acabou. A página sai da
      lista e passa a dizer que fechou, para ninguém aparecer com coisas à
      porta. O endereço continua respondendo, porque há cartazes impressos.</p>
    <form method="post" action="/atualizar">
      <input type="hidden" name="slug" value="${esc(centro.slug)}">
      ${centro.codigoDado ? `<input type="hidden" name="codigo" value="${esc(centro.codigoDado)}">` : ''}
      <input type="hidden" name="encerrar" value="pedir">
      <button class="btn btn-recusar" type="submit">Encerrar o centro</button>
    </form>
  </section>

  <footer class="pe">
    <p><b>O nome, o endereço e o telefone não mudam aqui.</b> Foram conferidos
      à mão quando o centro foi aprovado. Se estiverem errados, fale com quem
      aprovou — mudá-los sem ninguém ver tiraria o valor da verificação.</p>
    <p><a href="${esc(url)}">Ver minha página</a> ·
      <a href="/kit?slug=${encodeURIComponent(centro.slug)}">Imprimir material novo</a></p>
    <p class="ajuda">O kit abre já com o endereço do seu centro. O código não vai
      no link — ele ficaria no histórico do navegador, e o computador da
      secretaria é de todo mundo que faz turno. Escreva o código lá.</p>
  </footer>
</main>`
  });
}

/* ---------------------------------------------------------------------------
 * A porta de quem gere um centro
 *
 * Faltava. Quem já tinha página não tinha por onde entrar a partir da
 * entrada — tinha de saber escrever /kit de cor. Um coordenador que perdeu o
 * caminho para a sua própria ferramenta não a usa.
 * -------------------------------------------------------------------------*/
function paginaCentroEntrada({ base }) {
  return molde({
    aqui: '/centro',
    titulo: 'Meu centro — CAPEM',
    descricao: 'Gere o material impresso do seu centro e publique a lista de hoje.',
    corpo: `
<main class="portas">
  <header>
    <h1>Meu centro</h1>
    <p class="entrada">Tudo que um ponto de arrecadação precisa. A lista de
      hoje é a que se faz todos os dias — as outras, uma vez só.</p>
    <p class="entrada">Um cartaz impresso diz o que o centro precisava no dia em
      que saiu da impressora. Por isso o QR de todas as peças aponta para sua
      página: o papel fica na porta e a lista continua sendo a de hoje.</p>
  </header>

  <div class="duas-portas">
    <!-- Primeiro de propósito. É o que se faz TODOS OS DIAS; o kit é o que se
         faz uma vez. A ordem da página tem de ser a ordem da vida real. -->
    <a class="porta" href="/atualizar">
      ${svgIcone('relogio')}
      <span class="porta-t">Atualizar a lista</span>
      <span class="porta-d">Trinta segundos, com seu código. O que precisam hoje,
        o que já não precisam, e se pararam de receber. É isto que impede o papel
        colado na porta de ficar velho.</span>
    </a>
    <a class="porta" href="/kit">
      ${svgIcone('cartaz')}
      <span class="porta-t">Material impresso</span>
      <span class="porta-d">Quinze peças a partir dos mesmos dados — cartaz de porta,
        etiquetas de caixa, panfletos, crachás. Com seu código, se preenche
        sozinho.</span>
    </a>
    <a class="porta" href="/novo">
      ${svgIcone('pino')}
      <span class="porta-t">Pedir minha página</span>
      <span class="porta-d">Ainda não tem endereço na internet? Peça um. A gente
        confere os dados e liga — o código do centro chega depois, por WhatsApp.</span>
    </a>
  </div>

  <footer class="pe">
    <p><b>Perdeu o código?</b> Não há como o recuperar — só emitir outro.
      <a href="/pedir-codigo">Peça um código novo aqui</a>; não crie uma página
      nova, senão ficam duas do mesmo centro e os cartazes apontam para a errada.</p>
  </footer>
</main>`
  });
}

/* ---------------------------------------------------------------------------
 * Pedir uma página
 * -------------------------------------------------------------------------*/
function paginaNovo({ erro }) {
  return molde({
    aqui: '/centro',
    migalhas: [['Meu centro', '/centro'], ['Pedir a página']],
    titulo: 'Pedir a página de um centro',
    corpo: `
<main class="inicial">
  <header>
    <h1>Pedir a página do seu centro</h1>
    <p class="entrada">Cada pedido é conferido à mão antes de a página ir para o
      ar: um endereço errado numa emergência manda pessoas para o lugar errado.
      Depois disso o <b>código do centro</b> chega por WhatsApp — é com ele que
      você publica a lista todos os dias, a partir do <a href="/kit">kit</a>.
      Para imprimir não precisa esperar: o kit só precisa do nome.</p>
  </header>

  ${erro ? `<p class="erro-form">${esc(erro)}</p>` : ''}

  <form method="POST" action="/pedir">
    <label class="campo" for="nome">Nome do centro</label>
    <input id="nome" name="nome" type="text" required maxlength="80" placeholder="Paróquia São Sebastião">

    <label class="campo" for="tipo">O que é</label>
    <select id="tipo" name="tipo">
      <option>Ponto de arrecadação</option>
      <option>Abrigo</option>
      <option>Abrigo e ponto de arrecadação</option>
      <option>Cozinha comunitária</option>
      <option>Centro de distribuição</option>
    </select>

    <label class="campo" for="endereco">Endereço</label>
    <input id="endereco" name="endereco" type="text" required maxlength="140" placeholder="R. Bento Gonçalves, 412 — Centro, Canoas/RS">

    <label class="campo" for="horario">Horário</label>
    <input id="horario" name="horario" type="text" maxlength="80" placeholder="Todos os dias, 8h às 20h">

    <label class="campo" for="contato">Telefone</label>
    <input id="contato" name="contato" type="text" required maxlength="40" placeholder="(51) 99612-0044">

    <button type="submit" class="btn btn-primario largo">Pedir a página</button>
  </form>
</main>`
  });
}

/**
 * O texto que leva o código para o WhatsApp.
 *
 * O código aparece UMA vez, nesta página, e depois não há como o recuperar —
 * só emitir outro. "Escreva-o num papel agora" é bom conselho e é o que resiste
 * a ficar sem bateria, mas um papel num ginásio perde-se, e quem entra ao turno
 * seguinte não estava aqui quando ele apareceu no ecrã.
 *
 * Mandar por WhatsApp resolve isso sem infra-estrutura nenhuma: sem servidor de
 * e-mail, sem domínio com SPF e DKIM, sem caixa de spam, e sem guardar aqui
 * mais um dado pessoal de ninguém. Vai para o telemóvel que a pessoa já tem na
 * mão, e para o grupo do centro, que é onde o turno seguinte o vai procurar.
 *
 * A mensagem tem de se explicar sozinha daqui a uma semana, fora de contexto,
 * a alguém que não pediu a página — por isso diz o que é, para que serve e
 * onde se usa, e não só oito caracteres soltos.
 */
function textoCodigo(nome, slug, codigo, base, url) {
  return [
    '*CAPEM — código do centro*',
    '',
    `Centro: ${nome || slug}`,
    `Página: ${url}`,
    '',
    `Código: ${codigo}`,
    '',
    'Com este código você atualiza a lista do que o centro precisa hoje, em:',
    `${base}/atualizar`,
    '',
    'Guarde esta mensagem. Quem estiver no turno vai precisar dela — o código',
    'não dá para recuperar; só pedir outro.'
  ].join('\n');
}

/**
 * O ecrã do código, do lado de quem aprova.
 *
 * Duas situações, o mesmo ecrã: um centro acabado de aprovar, e um centro a
 * quem se emite um código novo. Nos dois casos o código aparece UMA vez e o
 * destino certo é o telefone que foi verificado à mão — não "escolha um
 * contato", não quem quer que tenha preenchido um formulário.
 *
 * Esta página não existe do lado público. O código deixou de nascer no pedido:
 * antes, quem soubesse o nome de uma paróquia recebia na hora uma chave de
 * escrita para uma página com esse nome, e a aprovação travava a página mas não
 * a chave. Agora verifica-se primeiro e a chave vai a seguir, para o número
 * conferido.
 */
function paginaCodigo({ slug, codigo, base, url: urlCanonica, nome, contato,
                        reemitido, voltar }) {
  const url = urlCanonica || `${base}/${slug}`;
  const txt = reemitido
    ? textoCodigo(nome, slug, codigo, base, url)
    : textoAprovado({ nome }, url, base, codigo);
  const waDirecto = linkWhatsApp(contato, txt);
  const waOutro = 'https://wa.me/?text=' + encodeURIComponent(txt);

  return molde({
    aqui: false,
    titulo: reemitido ? 'Código novo emitido' : 'Centro aprovado — mande o código',
    corpo: `
<main class="inicial">
  <h1>${reemitido ? 'Código novo' : 'Está no ar'}</h1>
  ${reemitido
    ? `<p class="entrada"><b>${esc(nome || slug)}</b>.
        <b>O código anterior deixou de funcionar</b> — se estava perdido, podia
        estar perdido para alguém.</p>`
    : `<p class="entrada">A página de <b>${esc(nome || slug)}</b> está no ar.
        Falta a única coisa que esta tela pode fazer e mais ninguém: mandar o
        código a quem o vai usar.</p>`}

  <section class="codigo-caixa">
    <p class="rotulo">Código do centro</p>
    <p class="codigo">${esc(codigo)}</p>
    <p class="dica"><b>Esta é a única vez que ele aparece.</b> Guardamos apenas
      o resumo criptográfico — nem nós conseguimos ler de novo. Se esta
      página fechar antes de você mandar, emita outro na fila.</p>
  </section>

  <div class="guardar-codigo">
    ${waDirecto
      ? `<a class="btn btn-wa largo" href="${esc(waDirecto)}" target="_blank" rel="noopener">
           Mandar para ${esc(contato)}</a>
         <p class="ajuda">É o telefone que está na página do centro — o que foi
           conferido na aprovação. A mensagem leva o endereço, o código, e onde
           se atualiza${reemitido ? '' : ', e deixa seu contato salvo no celular do centro'}.</p>`
      : `<p class="erro-form">Este centro não tem um telefone utilizável, por
           isso não há para onde mandar. Ligue para o centro de outra forma — sem o
           código, a página fica no ar e ninguém consegue atualizar.</p>`}
    <a class="btn largo" href="${esc(waOutro)}" target="_blank" rel="noopener">
      Mandar para outro número</a>
  </div>

  <p>O endereço da página:<br><code>${esc(url)}</code></p>
  <p><a class="btn" href="${esc(voltar || '/')}">Voltar aos pedidos</a></p>
</main>`
  });
}

/**
 * O que quem pede uma página vê agora: nada de código.
 *
 * É mais honesto do que o ecrã anterior — nada está no ar ainda — e é o que
 * torna possível verificar antes de entregar a chave. Em troca, esta página tem
 * de deixar claro que o silêncio não é rejeição, e que há trabalho útil para
 * fazer entretanto.
 */
function paginaPedidoRecebido({ slug, url, base }) {
  return molde({
    aqui: '/centro',
    migalhas: [['Meu centro', '/centro'], ['Pedido recebido']],
    titulo: 'Pedido recebido — CAPEM',
    corpo: `
<main class="inicial">
  <h1>Pedido recebido</h1>
  <p class="entrada">Vamos conferir os dados e ligar para o telefone que
    escreveu. Quando a página ficar no ar, mandamos por WhatsApp o endereço e o
    <b>código do centro</b> — é o código que deixa publicar a lista todos os
    dias.</p>

  <section class="codigo-caixa">
    <p class="rotulo">O endereço será</p>
    <p class="codigo endereco-previsto">${esc(url)}</p>
    <p class="dica">Ainda não abre. Fica a funcionar quando o pedido for
      verificado.</p>
  </section>

  <div class="aviso-caixa">
    <p><b>Entretanto, imprima o material.</b> Não precisa de código nenhum para
      isso — só do nome do centro. Cartaz de porta, etiquetas de caixa,
      panfletos: quinze peças a partir dos mesmos dados.</p>
    <p>Deixe o campo do link em branco por agora. Quando tiver o código, o kit
      se preenche sozinho e os QR passam a apontar para sua página.</p>
  </div>

  <p><a class="btn btn-primario largo" href="/kit">Ir para o kit e imprimir</a></p>

  <footer class="pe">
    <p>Se ninguém ligar em 24 horas, ligue para nós — ou peça outra vez. Um centro
      parado esperando uma verificação é o pior lugar para esta ferramenta
      falhar.</p>
  </footer>
</main>`
  });
}

/* ---------------------------------------------------------------------------
 * A fila de aprovação
 *
 * Uma tabela e dois botões. Isto é aberto num telemóvel, provavelmente de pé —
 * por isso os botões são grandes e a decisão é de um toque.
 * -------------------------------------------------------------------------*/
/* ---------------------------------------------------------------------------
 * A mensagem do empurrão.
 *
 * Escrita para ser lida por alguém a montar um ginásio, não por um cliente.
 * Nomeia o centro, diz há quantos dias, dá o endereço, e não pede nada além
 * de trinta segundos. Sem "esperamos que esteja tudo bem".
 * -------------------------------------------------------------------------*/
function textoEmpurrao(centro, url) {
  const d = centro.dados || {};
  const { dias, nivel } = idade(centro.publicado);
  const quando = nivel === 'nunca'
    ? 'A página do seu centro já está no ar, mas ainda não tem lista.'
    : `A lista do seu centro está com ${dias} dias.`;
  return `Olá! Aqui é do CAPEM.

${quando} Quem lê o QR dos cartazes vê essa data, e a página já está avisando que pode não valer.

Atualizar leva meio minuto: abra ${url.replace(/\/[^/]*$/, '')}/kit no celular, marque o que precisam hoje e clique em Publicar. O código é o mesmo de sempre.

Se o centro fechou ou parou de receber, diga só — marcamos a página e ninguém aparece à porta em vão.`;
}

/**
 * O aviso de que a página ficou no ar.
 *
 * A aprovação era silenciosa: o coordenador pedia a página, recebia o código, e
 * depois nada lhe dizia que já estava no ar — tinha de ir espreitar o endereço
 * de vez em quando. Um passo do processo que só o administrador via.
 *
 * Manda-se à mão, do telemóvel de quem aprova, e isso é metade do valor: o
 * centro fica com um contato humano guardado. Quando o código se perder — e
 * vai perder-se — há para onde ligar que não depende de encontrar a página
 * certa num site.
 */
function textoAprovado(d, url, base, codigo) {
  return [
    'Olá! Aqui é do CAPEM.',
    '',
    `A página do *${d.nome || ''}* já está no ar:`,
    url,
    '',
    'É este endereço que o QR das peças impressas abre, e é esta a lista que os vizinhos veem.',
    '',
    `*Código do centro: ${codigo}*`,
    '',
    `Para atualizar o que precisam hoje: ${base}/atualizar`,
    'Escreva o endereço da página e este código. Leva meio minuto, e é o que impede o papel colado na porta de ficar velho.',
    '',
    'Guarde esta mensagem — e escreva o código também num papel, para o dia em que a bateria acabar. Quem estiver de turno vai precisar dele.',
    '',
    'Salve também este contato. Se perder o código, ou precisar de alguma coisa, é por aqui.'
  ].join('\n');
}

/* ---------------------------------------------------------------------------
 * Quanto tempo falta, dito em português e não em milissegundos.
 * -------------------------------------------------------------------------*/
function daqui(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return 'menos de um minuto';
  if (m < 60) return `${m} ${m === 1 ? 'minuto' : 'minutos'}`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} ${h === 1 ? 'hora' : 'horas'}`;
  const d = Math.round(h / 24);
  return `${d} ${d === 1 ? 'dia' : 'dias'}`;
}

const desde = ms => daqui(Date.now() - ms);

/* Os canais têm nomes internos em `avisos.js` e um deles é "consola", que é
   de Portugal. O nome da chave fica; o que chega ao ecrã é traduzido. */
const CANAL_BR = { consola: 'console' };

/**
 * O selector de emergência.
 *
 * Uma caixa de texto dava vinte grafias do mesmo acontecimento e partia a lista
 * em três. Uma emergência desactivada continua a aparecer se for a do centro
 * que se está a editar — senão guardar uma correcção de coordenadas tirava-o
 * calado da emergência a que pertence.
 */
function escolherEmergencia(id, actual, emergencias) {
  const lista = (emergencias || []).filter(e => e.ativa || e.slug === actual);
  return `<select id="${esc(id)}" name="emergencia">
    <option value=""${actual ? '' : ' selected'}>— nenhuma —</option>
    ${lista.map(e => `<option value="${esc(e.slug)}"${e.slug === actual ? ' selected' : ''}
      >${esc(e.nome)}${e.ativa ? '' : ' (arquivada)'}</option>`).join('')}
  </select>`;
}

function paginaAdmin({ pendentes, aprovados, encerrados, parados, reivindicados,
                       token, contagem, base,
                       erro, feito, saude, avisoActivo, emergencias, canais }) {
  const linha = c => {
    const d = c.dados || {};
    const s = esc(c.slug);
    const mapa = linkMapa(d.endereco, d.coords);
    return `<article class="pedido">
      <h3>${esc(d.nome || c.slug)}</h3>
      <p class="meta">${esc(d.tipo || '')} · pedido em ${dataCurta(c.criado)}</p>
      <p>${svgIcone('pino')} ${d.endereco
        ? `<a href="${esc(mapa)}" target="_blank" rel="noopener">${esc(d.endereco)}</a>`
        : '—'}</p>
      <p>${svgIcone('telefone')} ${esc(d.contato || '—')}</p>
      ${d.endereco ? `<p class="meta conferir">Abra o endereço antes de aprovar. É o
        mesmo link que vai aparecer no botão <b>Como chegar</b> de todo mundo:
        se ele cair na rua errada, cai na rua errada para todos.</p>` : ''}
      <form method="POST" action="/admin/decidir">
        <input type="hidden" name="t" value="${esc(token)}">
        <input type="hidden" name="slug" value="${s}">
        <!-- Diz ao servidor que ESTE formulário traz os campos conferidos. Sem
             esta marca ele não lhes toca — o botão "Reabrir" lá em baixo também
             faz POST para /admin/decidir com decisao=aprovado, e sem a marca
             apagava as coordenadas, a emergência e o perfil de um centro que
             estava só a reabrir. -->
        <input type="hidden" name="verificados" value="1">
        <label class="campo" for="s-${s}">Endereço</label>
        <div class="linha-slug">
          <span>/</span>
          <input id="s-${s}" name="novo_slug" type="text" value="${s}"
            maxlength="48" autocomplete="off" spellcheck="false">
        </div>
        <p class="meta">Encurte se for longo de ditar ao telefone. O endereço
          antigo continua respondendo.</p>

        <label class="campo" for="c-${s}">Coordenadas (opcional)</label>
        <input id="c-${s}" name="coords" type="text" value="${esc(coordsTexto(d.coords))}"
          placeholder="-29.9177, -51.1839" maxlength="48" autocomplete="off" spellcheck="false"
          inputmode="text">
        <p class="meta">No mapa que acabou de abrir: toque e segure no lugar certo,
          copie o par de números e cole aqui. Faz o pino cair no lugar exato em vez
          de uma procura pelo texto do endereço — e é o que permite ordenar a
          lista pelo que está mais perto de quem procura. Em branco funciona
          do mesmo jeito.</p>

        <label class="campo" for="e-${s}">Emergência</label>
        ${escolherEmergencia(`e-${c.slug}`, d.emergencia || '', emergencias)}
        <p class="meta">A que resposta este centro pertence. Enquanto houver só
          uma, não aparece em lugar nenhum — serve para o dia em que houver duas
          ao mesmo tempo e a lista não puder misturá-las. Você cria uma lá
          embaixo, em <b>Emergências</b>.</p>

        <label class="campo" for="p-${s}">Instagram ou site (opcional)</label>
        <input id="p-${s}" name="perfil" type="text" value="${esc(d.perfil || '')}"
          placeholder="instagram.com/paroquiasaosebastiao" maxlength="140"
          autocomplete="off" spellcheck="false" inputmode="url">
        <p class="meta">Abra antes de colar. Este link sai de uma página que leva
          sua verificação, e quem o seguir vai achar que você conferiu.</p>

        <div class="botoes">
          <button class="btn btn-primario" name="decisao" value="aprovado">Aprovar</button>
          <button class="btn btn-recusar" name="decisao" value="recusado">Recusar</button>
        </div>
      </form>
    </article>`;
  };

  const S = saude || {};
  const emgs = emergencias || [];

  /* Quatro números que a ferramenta não sabia dizer sobre si própria. Cada
     linha só aparece quando há alguma coisa a apontar: uma lista de zeros
     ensina a não ler a secção. */
  const faltas = [
    S.semCoords ? [`${S.semCoords} sem coordenadas`,
      'não entram na ordem por distância — corrija em Corrigir mapa, aqui embaixo'] : null,
    S.semPerfil ? [`${S.semPerfil} sem Instagram ou site`,
      'menos uma forma de alguém confirmar que o centro é real'] : null,
    S.nuncaPublicou ? [`${S.nuncaPublicou} nunca publicou uma lista`,
      'a página está no ar e não diz o que o centro precisa'] : null,
    S.parados ? [`${S.parados} sem publicar há mais de ${S.diasParado} dias`,
      'a página já avisa quem a lê; ninguém avisa quem a devia atualizar'] : null
  ].filter(Boolean);

  return molde({
    aqui: null,
    titulo: 'CAPEM — administração',
    corpo: `
<main class="admin">
  <h1>Administração</h1>
  <p class="entrada">${contagem.pendente} aguardando · ${contagem.aprovado} no ar ·
    ${contagem.recusado} recusados · ${contagem.encerrado || 0} encerrados</p>
  ${erro === 'ocupado' ? '<p class="erro-form">Esse endereço já está ocupado. Escolha outro.</p>' : ''}
  ${erro === 'emergencia' ? '<p class="erro-form">Esse nome de emergência não dá um endereço utilizável. Use letras e números.</p>' : ''}
  ${feito ? `<p class="feito">${esc(feito)}</p>` : ''}

  <!-- Ver o site sem perder a sessão.
       Abrem noutro separador de propósito: sair daqui para conferir uma página
       e ter de voltar ao Telegram para reentrar é o género de atrito que faz
       ninguém conferir nada. -->
  <section class="bloco-admin">
    <h2>Ver o site</h2>
    <p class="entrada">Abrem numa aba nova — esta fica aberta.</p>
    <div class="atalhos">
      <a class="btn" href="/" target="_blank" rel="noopener">Entrada</a>
      <a class="btn" href="/centros" target="_blank" rel="noopener">Centros</a>
      <a class="btn" href="/centro" target="_blank" rel="noopener">Meu centro</a>
      <a class="btn" href="/kit" target="_blank" rel="noopener">Kit</a>
      <a class="btn" href="/novo" target="_blank" rel="noopener">Pedir página</a>
      <a class="btn" href="/atualizar" target="_blank" rel="noopener">Atualizar</a>
    </div>
  </section>

  <!-- O que a ferramenta não sabia dizer sobre si própria. -->
  <section class="bloco-admin">
    <h2>Como está o site</h2>
    ${faltas.length
      ? `<ul class="saude">${faltas.map(([o, porque]) =>
          `<li><b>${esc(o)}</b><span>${esc(porque)}</span></li>`).join('')}</ul>`
      : '<p class="tudo-bem">Nada por preencher: todos os centros no ar têm coordenadas, perfil e uma lista publicada.</p>'}
    <p class="meta">Avisos por: <b>${esc((canais || [])
      .map(c => CANAL_BR[c] || c).join(', ') || '—')}</b>${
      (canais || []).includes('telegram') ? '' : ' — sem Telegram, um pedido novo só fica no log da máquina'}</p>
    <form method="POST" action="/admin/testar-aviso" class="em-linha">
      <input type="hidden" name="t" value="${esc(token)}">
      <button class="btn pequeno">Enviar um aviso de teste</button>
    </form>
  </section>

  <!-- A faixa vermelha. -->
  <section class="bloco-admin">
    <h2>Aviso no topo do site</h2>
    ${avisoActivo ? `
      <div class="aviso-estado">
        <p><b>ATIVO</b> — aparece em todas as páginas${avisoActivo.desde
          ? `, há ${esc(desde(avisoActivo.desde))}` : ''}.</p>
        <p>${avisoActivo.ate
          ? `Sai sozinho daqui a <b>${esc(daqui(avisoActivo.ate - Date.now()))}</b>.`
          : '<b>Não expira.</b> Sai só quando você o tirar — e um aviso que ninguém tira deixa de ser lido.'}</p>
        <blockquote>${esc(avisoActivo.texto)}</blockquote>
      </div>
      <form method="POST" action="/admin/aviso" class="em-linha">
        <input type="hidden" name="t" value="${esc(token)}">
        <input type="hidden" name="apagar" value="1">
        <button class="btn btn-recusar pequeno">Tirar o aviso agora</button>
      </form>
      <hr class="fio">
      <p class="meta">Para trocar o texto, escreva um novo — substitui o que está lá.</p>
    ` : '<p class="entrada">Nenhum aviso no ar. As páginas estão limpas.</p>'}

    <form method="POST" action="/admin/aviso">
      <input type="hidden" name="t" value="${esc(token)}">
      <label class="campo" for="av-texto">Mensagem</label>
      <input id="av-texto" name="texto" type="text" maxlength="180" autocomplete="off"
        placeholder="Não traga doações a Canoas hoje: a ponte da BR-386 está fechada.">
      <p class="meta">Uma frase. É o primeiro que todo mundo lê, antes do nome
        do centro que veio procurar — por isso serve para o que muda a decisão de
        sair de casa, e não para recados.</p>
      <label class="campo" for="av-prazo">Quanto tempo fica</label>
      <select id="av-prazo" name="prazo">
        <option value="6">6 horas</option>
        <option value="24" selected>24 horas</option>
        <option value="72">3 dias</option>
        <option value="0">até eu tirar</option>
      </select>
      <p class="meta">Sai sozinho no fim do prazo. É de propósito: uma faixa
        vermelha que sobrevive ao motivo vira papel de parede, e a emergência
        seguinte não é lida por ninguém.</p>
      <button class="btn btn-primario">Ver como fica</button>
    </form>
  </section>

  <!-- As emergências. -->
  <section class="bloco-admin">
    <h2>Emergências</h2>
    <p class="entrada">A que resposta cada centro pertence. Com uma só, nada
      disto aparece no site — a lista de centros continua simples. Com duas,
      a lista deixa de as misturar, porque misturá-las manda alguém atravessar
      um estado.</p>

    ${emgs.length ? `<ul class="emg-admin">${emgs.map(e => `
      <li${e.ativa ? '' : ' class="arquivada"'}>
        <form method="POST" action="/admin/emergencia" class="emg-linha">
          <input type="hidden" name="t" value="${esc(token)}">
          <input type="hidden" name="slug" value="${esc(e.slug)}">
          <label class="sr-only" for="en-${esc(e.slug)}">Nome de ${esc(e.nome)}</label>
          <input id="en-${esc(e.slug)}" name="nome" type="text" value="${esc(e.nome)}"
            maxlength="60" autocomplete="off">
          <span class="emg-meta">/${esc(e.slug)} · ${e.n} ${e.n === 1 ? 'centro' : 'centros'}${
            e.ativa ? '' : ' · arquivada'}</span>
          <div class="emg-acoes">
            <button class="btn pequeno" name="accao" value="renomear">Guardar nome</button>
            <button class="btn pequeno" name="accao" value="${e.ativa ? 'arquivar' : 'ativar'}"
              >${e.ativa ? 'Arquivar' : 'Reativar'}</button>
            <button class="btn pequeno btn-recusar" name="accao" value="apagar">Apagar</button>
          </div>
        </form>
      </li>`).join('')}</ul>
      <p class="meta">O nome muda à vontade; o endereço (<code>/centros?e=…</code>)
        nunca muda, porque alguém já pode ter compartilhado o link.
        <b>Arquivar</b> some das escolhas de novos centros e mantém os que já
        estão lá. <b>Apagar</b> solta os centros — nenhum centro é apagado, nunca.</p>`
      : '<p class="vazio">Nenhuma emergência ainda.</p>'}

    <form method="POST" action="/admin/emergencia">
      <input type="hidden" name="t" value="${esc(token)}">
      <input type="hidden" name="accao" value="criar">
      <label class="campo" for="emg-nova">Nova emergência</label>
      <input id="emg-nova" name="nome" type="text" maxlength="60" autocomplete="off"
        placeholder="Enchentes RS 2026">
      <button class="btn">Criar</button>
    </form>
  </section>

  <!-- A base de dados inteira, num ficheiro. -->
  <section class="bloco-admin">
    <h2>Cópia de segurança</h2>
    <p class="entrada">Todo o estado do CAPEM é <b>um arquivo só</b>. Não há
      cópia automática nenhuma: se ele sumir, some junto todos os centros. Baixe
      uma cópia antes de qualquer mudança arriscada, e guarde longe deste
      servidor.</p>
    <form method="POST" action="/admin/backup">
      <input type="hidden" name="t" value="${esc(token)}">
      <button class="btn">Baixar a base de dados</button>
    </form>
  </section>

  <section class="bloco-admin">
    <h2>Acrescentar um centro que não pediu página</h2>
    <p class="entrada">A lista vale mais no primeiro dia de uma cheia do que em
      qualquer outro, e no primeiro dia quase nenhum centro ouviu falar do CAPEM.
      Uma lista feita só de quem já nos conhece manda alguém com cobertores no
      carro passar à porta de um ginásio aberto para ir a outro mais longe.</p>
    <p class="entrada">O centro entra <b>no ar na hora</b>, sem código e
      <b>sem lista de necessidades</b> — ninguém de lá disse o que precisa, e
      inventar isso seria pôr palavras na boca de quem não falou. A página diz de
      onde vieram as informações e oferece a quem for da casa assumi-la.</p>
    <form method="POST" action="/admin/encontrado">
      <input type="hidden" name="t" value="${esc(token)}">
      <label class="campo" for="en-nome">Nome</label>
      <input id="en-nome" name="nome" type="text" maxlength="80" required autocomplete="off">

      <label class="campo" for="en-endereco">Endereço</label>
      <input id="en-endereco" name="endereco" type="text" maxlength="140" required autocomplete="off">

      <label class="campo" for="en-contato">Telefone</label>
      <input id="en-contato" name="contato" type="tel" maxlength="40" autocomplete="off" inputmode="tel">

      <label class="campo" for="en-tipo">Tipo</label>
      <input id="en-tipo" name="tipo" type="text" maxlength="60" autocomplete="off"
        placeholder="Paróquia · Escola · Ginásio">

      <label class="campo" for="en-horario">Horário</label>
      <input id="en-horario" name="horario" type="text" maxlength="80" autocomplete="off"
        placeholder="8h às 18h">

      <label class="campo" for="en-fonte">De onde veio isto</label>
      <input id="en-fonte" name="fonte" type="text" maxlength="200" required
        autocomplete="off" spellcheck="false" inputmode="url"
        placeholder="prefeitura.rs.gov.br/... ou instagram.com/...">
      <p class="meta">Vai <b>à vista na página</b>, com a data de hoje. Confira em
        duas fontes antes de acrescentar: uma fonte só é boato, e mandar quarenta
        pessoas a uma porta fechada é pior do que não listar o centro.</p>

      <label class="campo" for="en-coords">Coordenadas (opcional)</label>
      <input id="en-coords" name="coords" type="text" maxlength="48" autocomplete="off"
        spellcheck="false" placeholder="-29.9177, -51.1839">

      <label class="campo" for="en-perfil">Instagram ou site (opcional)</label>
      <input id="en-perfil" name="perfil" type="text" maxlength="140" autocomplete="off"
        spellcheck="false" inputmode="url">

      <label class="campo" for="en-emergencia">Emergência</label>
      ${escolherEmergencia('en-emergencia', '', emergencias)}

      <label class="campo" for="en-slug">Endereço da página (opcional)</label>
      <div class="linha-slug"><span>/</span>
        <input id="en-slug" name="novo_slug" type="text" maxlength="48"
          autocomplete="off" spellcheck="false" placeholder="canoas-ss"></div>

      <button class="btn btn-primario">Acrescentar e pôr no ar</button>
    </form>
  </section>

  ${reivindicados && reivindicados.length ? `
  <h2 class="risco">Querem assumir a página <span class="conta-n">${reivindicados.length}</span></h2>
  <p class="entrada">Estas pessoas dizem ser da casa de um centro que
    <b>nós</b> acrescentámos. <b>Ligue primeiro.</b> Entregar o código é dar
    acesso de escrita a uma página pública, e o nome de um centro está numa
    lista que qualquer pessoa lê — o telefonema é a única conferência que
    existe.</p>
  <div class="pedidos">${reivindicados.map(c => {
    const d = c.dados || {};
    const r = d.reivindicacao || {};
    const wa = linkWhatsApp(r.contato, `Oi! Aqui é do CAPEM, sobre a página de ${d.nome || c.slug}.`);
    return `<article class="pedido">
      <h3>${esc(d.nome || c.slug)}</h3>
      <p class="meta">${esc(r.nome || '')}${r.papel ? ` · ${esc(r.papel)}` : ''} ·
        pediu em ${esc(dataCurta(r.em || Date.now()))}</p>
      <p>${svgIcone('telefone')} ${esc(r.contato || '—')}</p>
      <p class="meta">Telefone que estava na página: ${esc(d.contato || '—')}</p>
      <div class="botoes">
        ${wa ? `<a class="btn btn-wa" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
        <a class="btn" href="${esc(c.url || base + '/' + c.slug)}" target="_blank" rel="noopener">Ver</a>
      </div>
      <form method="POST" action="/admin/entregar">
        <input type="hidden" name="t" value="${esc(token)}">
        <input type="hidden" name="slug" value="${esc(c.slug)}">
        <button class="btn btn-primario">Entregar o código</button>
      </form>
      <p class="meta">Emite o código, tira o aviso de "ninguém confirmou" da
        página e devolve as quatro recusas. Só depois do telefonema.</p>
    </article>`;
  }).join('')}</div>` : ''}

  <h2 class="risco">Pedidos aguardando</h2>
  ${pendentes.length
    ? `<div class="pedidos">${pendentes.map(linha).join('')}</div>`
    : '<p class="vazio">Nada aguardando.</p>'}

  ${parados && parados.length ? `
  <h2>Precisam de um empurrão <span class="conta-n">${parados.length}</span></h2>
  <p class="entrada">Estes não publicam há dias. A página deles já avisa quem a lê —
    mas ninguém avisa quem a devia atualizar. Um toque abre o WhatsApp com a
    mensagem escrita.</p>
  <div class="pedidos">${parados.map(c => {
    const d = c.dados || {};
    const { dias, nivel } = idade(c.publicado);
    const wa = linkWhatsApp(d.contato, textoEmpurrao(c, c.url || base + '/' + c.slug));
    return `<article class="pedido parado">
      <h3>${esc(d.nome || c.slug)}</h3>
      <p class="meta ${nivel}">${nivel === 'nunca' ? 'nunca publicou' : `há ${dias} dias`}
        · ${esc(d.contato || 'sem telefone')}</p>
      <div class="botoes">
        ${wa ? `<a class="btn btn-wa" href="${esc(wa)}" target="_blank" rel="noopener">
          Empurrar no WhatsApp</a>` : '<span class="meta">sem telefone utilizável</span>'}
        <a class="btn" href="${esc(c.url || base + '/' + c.slug)}" target="_blank" rel="noopener">Ver</a>
      </div>
    </article>`;
  }).join('')}</div>` : ''}

  <h2>No ar</h2>
  <p class="entrada">Se alguém ligar a dizer que perdeu o código, emita outro
    aqui — <b>depois de confirmar ao telefone que é mesmo do centro</b>. O número
    está no cartão do pedido. Emitir um código é dar acesso de escrita
    à página; essa confirmação é a única que existe, e não há formulário que a
    faça por si.</p>
  ${aprovados.length ? `<ul class="lista-no-ar">${aprovados.map(c => {
    const { dias, nivel } = idade(c.publicado);
    const quando = nivel === 'nunca' ? 'nunca publicou' :
      dias <= 1 ? 'lista de hoje' : `há ${dias} dias`;
    return `<li class="${nivel}">
      <div class="na-txt">
        <a href="${esc(c.url || base + '/' + c.slug)}">${esc((c.dados || {}).nome || c.slug)}</a>
        <span>${esc(quando)}</span>
      </div>
      <form method="POST" action="/admin/recodigo" class="na-form">
        <input type="hidden" name="t" value="${esc(token)}">
        <input type="hidden" name="slug" value="${esc(c.slug)}">
        <button class="btn pequeno">Código novo</button>
      </form>
      <!-- Corrigir depois de aprovar.
           Sem isto, uma coordenada colada com um dígito a menos ficava errada
           para sempre — e este projecto tem uma regra sobre números que só
           podem viver onde se corrigem. Nome, morada e telefone continuam de
           fora: mudá-los é refazer a verificação, e isso é um telefonema. -->
      <details class="na-editar">
        <summary>Corrigir mapa, emergência ou perfil</summary>
        <form method="POST" action="/admin/verificados">
          <input type="hidden" name="t" value="${esc(token)}">
          <input type="hidden" name="slug" value="${esc(c.slug)}">
          <label class="campo" for="ec-${esc(c.slug)}">Coordenadas</label>
          <input id="ec-${esc(c.slug)}" name="coords" type="text"
            value="${esc(coordsTexto((c.dados || {}).coords))}"
            placeholder="-29.9177, -51.1839" maxlength="48" autocomplete="off" spellcheck="false">
          ${(c.dados || {}).endereco ? `<p class="meta"><a href="${esc(linkMapa((c.dados || {}).endereco, (c.dados || {}).coords))}"
            target="_blank" rel="noopener">Ver onde isto cai agora</a></p>` : ''}
          <label class="campo" for="ee-${esc(c.slug)}">Emergência</label>
          ${escolherEmergencia(`ee-${c.slug}`, (c.dados || {}).emergencia || '', emergencias)}
          <label class="campo" for="ep-${esc(c.slug)}">Instagram ou site</label>
          <input id="ep-${esc(c.slug)}" name="perfil" type="text"
            value="${esc((c.dados || {}).perfil || '')}" maxlength="140"
            autocomplete="off" spellcheck="false" inputmode="url">
          <p class="meta">Deixar em branco apaga. Guardar não republica a lista:
            a idade da página é da lista do centro, não das nossas correções.</p>
          <button class="btn pequeno">Guardar</button>
        </form>
      </details>
    </li>`;
  }).join('')}</ul>` : '<p class="vazio">Nenhum centro no ar.</p>'}

  ${encerrados && encerrados.length ? `
  <h2>Encerrados <span class="conta-n">${encerrados.length}</span></h2>
  <p class="entrada">Eles mesmos se fecharam. A página de cada um continua
    respondendo e diz que fechou — há cartazes impressos com esses endereços.
    <b>Reabrir só se faz aqui</b>: um código que ainda ande num celular não
    pode desfazer isto sozinho.</p>
  <ul class="lista-no-ar">${encerrados.map(c => `
    <li>
      <div class="na-txt">
        <a href="${esc(c.url || base + '/' + c.slug)}">${esc((c.dados || {}).nome || c.slug)}</a>
        <span>${c.decidido ? 'fechou em ' + dataCurta(c.decidido) : 'encerrado'}</span>
      </div>
      <form method="POST" action="/admin/decidir" class="na-form">
        <input type="hidden" name="t" value="${esc(token)}">
        <input type="hidden" name="slug" value="${esc(c.slug)}">
        <input type="hidden" name="novo_slug" value="">
        <button class="btn pequeno" name="decisao" value="aprovado">Reabrir</button>
      </form>
    </li>`).join('')}</ul>` : ''}
</main>`
  });
}

/* ---------------------------------------------------------------------------
 * Um ecrã de confirmação, partilhado.
 *
 * Serve o que muda o site inteiro ou o que sai do servidor: publicar a faixa
 * vermelha, apagar uma emergência, levar a base de dados para fora. Não é uma
 * caixa de "tem a certeza?" a que se responde sem ler — mostra exactamente o
 * que vai acontecer, e é escrito para ser lido em dois segundos.
 *
 * `detalhe` é HTML já composto por quem chama: a pré-visualização real da
 * faixa, a contagem de centros afectados. Ver uma coisa é melhor do que ler
 * uma descrição dela.
 * -------------------------------------------------------------------------*/
function paginaConfirmar({ titulo, aviso, detalhe, accao, campos, botao, perigo, voltar }) {
  return molde({
    aqui: false,
    titulo: `${titulo} — CAPEM`,
    corpo: `
<main class="admin confirmar">
  <h1>${esc(titulo)}</h1>
  ${aviso ? `<p class="entrada">${aviso}</p>` : ''}
  ${detalhe || ''}
  <form method="POST" action="${esc(accao)}" class="conf-form">
    ${Object.entries(campos || {}).map(([k, v]) =>
      `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('')}
    <input type="hidden" name="confirmar" value="1">
    <div class="botoes">
      <button class="btn ${perigo ? 'btn-recusar' : 'btn-primario'}">${esc(botao)}</button>
      <a class="btn" href="${esc(voltar)}">Cancelar</a>
    </div>
  </form>
</main>`
  });
}

/* ---------------------------------------------------------------------------
 * Folha de estilo. As mesmas fichas do papel.
 * -------------------------------------------------------------------------*/
const CSS = `
:root{
  --tinta:#16130F; --proibido:#C8102E; --permitido:#007A33; --atencao:#F2C500;
  --fio:#B8B4AE; --papel:#FFF; --texto-2:#3B3831; --texto-3:#6E6A63;
  --tenue:#E4E2DD; --fundo:#DEDCD7; --claro:#F4F3F0;
  /* A goteira: a distância entre o texto e a beira do ecrã. Um valor só, em
     vez dos seis 20px espalhados que havia — e que uma página não tinha. */
  --goteira:20px;
  --fonte:Archivo,'Helvetica Neue',Helvetica,Arial,sans-serif;
  --preta:'Archivo Black',Archivo,'Helvetica Neue',Helvetica,Arial,sans-serif;
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  color-scheme:light;
}
*{box-sizing:border-box}
[hidden]{display:none!important}
html,body{margin:0;padding:0;background:var(--fundo);color:var(--tinta);
  font-family:var(--fonte);-webkit-text-size-adjust:100%}
svg{display:block}
a{color:var(--tinta)}
/* ---------------------------------------------------------------------------
 * DOIS MODELOS DE PÁGINA, e só dois. Escolha-se um.
 *
 * A) COM GOTEIRA (o normal). O main afasta o conteúdo das beiras e nada lá
 *    dentro volta a afastá-lo. É o que quase todas as páginas querem.
 *
 * B) EM FAIXAS (main.faixas). O main não tem goteira nenhuma, para as faixas
 *    — cabeçalho do centro, aviso de idade, blocos com risco em cima —
 *    poderem atravessar o ecrã de beira a beira com o seu próprio traço. Cada
 *    faixa põe a goteira por dentro.
 *
 * A goteira vive no main e é o modelo B que a tira, e não ao contrário. Antes
 * era ao contrário: o main não tinha goteira e cada classe de página punha a
 * sua, o que quer dizer que uma classe que se esquecesse ficava colada à beira
 * do ecrã. Foi o que aconteceu a .entrar — as duas páginas que um coordenador
 * mais abre ao telemóvel, encostadas à borda, sem ninguém dar por isso.
 *
 * Com o modelo A por omissão, esquecer-se dá o comportamento certo.
 * -------------------------------------------------------------------------*/
main{max-width:760px;margin:0 auto;padding:24px var(--goteira) 48px;
  background:var(--papel);min-height:100vh}
main.faixas{padding:0 0 48px}
main.faixas .pe{padding-left:var(--goteira);padding-right:var(--goteira)}
@media(min-width:800px){main{margin:24px auto;min-height:0;border:2px solid var(--tinta)}}

/* --- cabeçalho do centro --- */
.topo-c{padding:22px var(--goteira) 18px;border-bottom:6px solid var(--tinta)}
.topo-c .tipo{margin:0 0 6px;font:700 12px/1 var(--fonte);text-transform:uppercase;
  letter-spacing:.18em;color:var(--texto-2)}
.topo-c h1{margin:0;font:400 clamp(30px,8vw,52px)/0.94 var(--preta);letter-spacing:-.025em;
  text-wrap:balance}
.horas{display:flex;align-items:center;gap:9px;margin:12px 0 0;
  font:800 clamp(15px,4vw,20px)/1.1 var(--fonte);text-transform:uppercase}
.horas svg{width:24px;height:24px;flex:none}

/* --- a idade da lista --- */
.idade{margin:0;padding:14px var(--goteira);font:600 15px/1.45 var(--fonte)}
.idade.a-envelhecer{background:var(--atencao);color:var(--tinta)}
.idade.velha,.idade.nunca{background:var(--proibido);color:#fff}

/* --- listas de marcas --- */
/* Só nas páginas em faixas. Era um selector de elemento solto — cada secção de
   cada página levava 20 px — e numa página com goteira isso somava-se à do
   main. Sobreviveu porque quase todas as secções têm uma classe com padding
   próprio que o tapava. */
main.faixas > section{padding:20px var(--goteira)}
section h2{display:flex;align-items:center;gap:12px;margin:0 0 4px;
  font:400 clamp(22px,6vw,32px)/1 var(--preta);letter-spacing:-.02em}
section h2 svg{width:clamp(28px,7vw,40px);height:clamp(28px,7vw,40px);flex:none}
.bloco-nao{border-top:6px solid var(--tinta)}
.bloco-nao h2{color:var(--proibido)}
.porque{margin:0 0 14px;font:500 14px/1.4 var(--fonte);color:var(--texto-2)}
.marcas{list-style:none;margin:14px 0 0;padding:0;display:grid;
  grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:16px 12px}
.marcas li{display:flex;flex-direction:column;align-items:center;
  justify-content:flex-end;gap:7px;min-width:0}
.marcas svg{width:100%;max-width:74px;aspect-ratio:1}
.marcas span{font:700 12px/1.2 var(--fonte);text-align:center;text-transform:uppercase;
  overflow-wrap:anywhere}
/* A quantidade só existe aqui. O papel e as imagens não a levam: um número
   impresso não se corrige, e "200" às 8h está errado ao meio-dia. Esta página
   é reescrita a cada publicação, por isso é o único sítio onde um número pode
   ser verdade. */
.marcas .q{display:block;margin-top:3px;font:800 15px/1 var(--fonte);
  padding:3px 6px;border:2px solid var(--tinta)}
.vazio{margin:8px 0 0;font:500 15px/1.5 var(--fonte);color:var(--texto-2)}

/* --- pausa --- */
.pausa{display:flex;align-items:center;gap:18px;padding:26px var(--goteira)}
.pausa svg{width:clamp(64px,18vw,110px);height:clamp(64px,18vw,110px);flex:none}
.pausa h2{margin:0;display:block;font-size:clamp(24px,6.5vw,38px);line-height:.98}
.pausa p{margin:8px 0 0;font:500 clamp(15px,4vw,18px)/1.35 var(--fonte);color:var(--texto-2)}

/* --- contato --- */
.contato{border-top:6px solid var(--tinta)}
.contato .lin{display:flex;align-items:center;gap:11px;margin:0 0 10px}
.contato .lin a{display:flex;align-items:center;gap:11px;text-decoration:none}
.contato .lin svg{width:22px;height:22px;flex:none}
.contato .lin span{font:700 clamp(17px,4.6vw,22px)/1.25 var(--fonte)}
.contato .lin a span{text-decoration:underline;text-underline-offset:3px}
/* O perfil é o único link daqui que sai do CAPEM. Fica mais pequeno do que o
   endereço e o telefone de propósito: é o menos urgente dos três. */
.contato .lin a[rel~=ugc] span{font-size:clamp(15px,3.8vw,17px);font-weight:600}
.carimbo{margin:16px 0 0;font:600 13px/1.2 var(--mono);color:var(--texto-2)}

/* --- chegar e ligar ---
   Duas coisas que alguém faz de pé, na rua, com uma mão. Lado a lado no
   telemóvel largo e empilhados no estreito, sempre com 52 px de altura. */
.ir{display:grid;gap:10px;padding:0 var(--goteira) 4px}
@media(min-width:520px){.ir{grid-template-columns:1fr 1fr}}
.btn-ir{display:flex;align-items:center;justify-content:center;gap:10px;
  min-height:52px;margin:0;font-weight:800;text-align:center}
.btn-ir svg{width:22px;height:22px;flex:none}

/* --- compartilhar --- */
.compartilhar{border-top:6px solid var(--tinta)}
.btn-wa{background:#25D366;border-color:#0f7a3a;color:var(--tinta);font-weight:800;
  display:block;text-align:center;margin-top:0}
.nota-compartilhar{margin:10px 0 0;font:500 13px/1.45 var(--fonte);color:var(--texto-2)}

/* --- pé --- */
/* Sem goteira própria: numa página com goteira somava-se à do main e dava
   40 px. As páginas em faixas devolvem-lha na regra ao pé de main.faixas. */
.pe{padding:20px 0 0;border-top:2px solid var(--tinta);
  font:500 13px/1.6 var(--fonte);color:var(--texto-2)}
.pe p{margin:0 0 6px}
.pe .creditos{color:var(--texto-3)}

/* --- as duas portas --- */
/* As respostas em curso, na entrada. Só existem no HTML quando há mais de uma. */
.emg-inicial{margin:0 0 24px;padding:16px 0 0;border-top:2px solid var(--tinta)}
.emg-inicial h2{margin:0 0 12px;font-size:clamp(18px,4.5vw,22px)}
.emg-inicial .emergencias{list-style:none;margin:0;padding:0;
  display:flex;flex-wrap:wrap;gap:8px}
.emg-inicial .emg{min-height:46px}

/* Corrigir um centro que já está no ar. Fechado por omissão: é a excepção,
   não a tarefa do dia. */
.na-editar{flex-basis:100%;margin-top:8px}
.na-editar summary{font:600 12px/1.4 var(--mono);color:var(--texto-2);cursor:pointer;
  padding:6px 0}
/* Sem enchimento lateral: os campos aqui dentro alinham com a goteira da
   página, como os de todos os outros formulários. */
.na-editar form{margin:6px 0 4px;padding:12px 0;background:var(--claro)}
.na-editar .campo{margin-top:8px}
.na-editar input{width:100%}

.duas-portas{display:grid;gap:14px;margin:8px 0 28px}
/* Chamava-se "duas portas" e passaram a ser três quando a actualização diária
   ganhou a sua. auto-fit em vez de dois fixos, para não ficar uma órfã. */
@media(min-width:640px){.duas-portas{grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px}}
.porta{display:flex;flex-direction:column;gap:8px;padding:22px 20px;
  border:3px solid var(--tinta);text-decoration:none;background:var(--papel)}
.porta:hover{background:var(--claro)}
.porta svg{width:44px;height:44px}
.porta-t{font:400 clamp(22px,6vw,30px)/1 var(--preta);letter-spacing:-.02em}
.porta-d{font:500 14.5px/1.5 var(--fonte);color:var(--texto-2)}

/* --- lista de centros --- */
/* A procura e os filtros. Alvos grandes: isto usa-se de pé, com uma mão, num
   telemóvel molhado. Nada aqui desce abaixo dos 44 px de altura tocável. */
.procura{margin:0 0 16px}
.linha-q{display:flex;gap:8px}
input[type=search]{flex:1;min-width:0;padding:13px 14px;font:500 16px/1.3 var(--fonte);
  color:var(--tinta);background:var(--papel);border:2px solid var(--tinta);
  border-radius:0;-webkit-appearance:none}
.linha-q .btn{flex:none;margin-top:0}
.opcoes .btn{margin-top:0}
.btn.secundario{padding:11px 14px;font-size:12.5px}
.opcoes{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin-top:12px}
.campo-ordem{display:flex;align-items:center;gap:7px;
  font:600 13px/1.2 var(--fonte);color:var(--texto-2)}
.campo-ordem select{padding:9px 10px;font:600 14px/1.2 var(--fonte);
  color:var(--tinta);background:var(--papel);border:2px solid var(--tinta);border-radius:0}
/* A caixa é maior do que a predefinição do sistema de propósito: uma caixa de
   13 px falha-se com o polegar, e uma pessoa que falha um filtro conclui que a
   ferramenta não funciona. */
.caixa{display:flex;align-items:center;gap:8px;min-height:44px;
  font:600 14px/1.25 var(--fonte);cursor:pointer}
.caixa input{width:22px;height:22px;flex:none;accent-color:var(--tinta);margin:0}
.resumo{margin:0 0 10px;font:600 13px/1.4 var(--mono);color:var(--texto-2)}
.resumo a{color:var(--texto-2)}
/* Páginas. Só existem porque a lista deixou de vir toda de uma vez — e é isso
   que faz a diferença entre 1,6 MB e 40 KB no telemóvel de quem vai ajudar. */
.paginas{display:flex;align-items:center;justify-content:space-between;gap:10px;
  margin:18px 0 0;font:600 13px/1.2 var(--fonte)}
.pg{padding:12px 4px;text-decoration:none;border-bottom:2px solid var(--tinta)}
/* Quando não há página anterior, o lugar dela fica lá mas vazio: um rótulo
   cinzento que não é clicável falha o contraste E mente sobre ser um link. */
.pg.vazia{visibility:hidden}
.pg-conta{font:600 12px/1.2 var(--mono);color:var(--texto-2)}
/* --- a barra de emergências ---
   Só existe no HTML quando há mais de uma. Ver o comentário em paginaCentros. */
.emergencias{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px}
.emg{display:inline-flex;align-items:center;gap:7px;min-height:40px;padding:0 13px;
  border:2px solid var(--tinta);background:var(--papel);color:var(--tinta);
  font:700 13px/1 var(--fonte);text-decoration:none}
.emg.atual{background:var(--tinta);color:var(--papel)}
.emg-n{font:700 11px/1 var(--mono);opacity:.7}

/* --- o mais perto de mim ---
   Escondido no HTML e mostrado pelo script: sem geolocalização o botão abriria
   uma caixa de permissões para não fazer nada a seguir. */
.perto-barra{margin:0 0 14px}
#b-perto{display:inline-flex;align-items:center;gap:9px;min-height:46px}
#b-perto svg{width:20px;height:20px;flex:none}
.perto-nota{margin:8px 0 0;font:500 13px/1.5 var(--fonte);color:var(--texto-2);max-width:60ch}

.centros{list-style:none;margin:0;padding:0}
.c-item{border-top:2px solid var(--tinta)}
.c-item:last-child{border-bottom:2px solid var(--tinta)}
/* Era ".c-item a", o que passou a apanhar também os botões de ligar e de
   chegar assim que eles existiram — e transformava cada um numa grelha.
   (Sem crases neste bloco: é um literal de template. Ver tools/goteira.js.) */
.c-cartao{display:grid;gap:4px;padding:15px 0 12px;text-decoration:none}
.c-nome{font:800 17px/1.25 var(--fonte)}
.c-endereco{font:500 13.5px/1.4 var(--fonte);color:var(--texto-2)}
.c-quando{font:600 12px/1.2 var(--mono);color:var(--texto-2)}
/* Um centro que não toca na página há semanas é uma viagem em vão à espera de
   acontecer. Fica no fim da lista e diz-se em vermelho. */
.c-item.velha .c-quando,.c-item.nunca .c-quando{color:var(--proibido);font-weight:700}
.c-item.velha .c-nome,.c-item.nunca .c-nome{color:var(--texto-2)}
.c-marcas{display:flex;flex-wrap:wrap;gap:7px;margin-top:5px}
.c-marcas svg{width:26px;height:26px;flex:none}
.c-pausa{display:flex;align-items:center;gap:7px;margin-top:5px;
  font:700 13px/1.2 var(--fonte);color:var(--proibido)}
.c-pausa svg{width:20px;height:20px;flex:none}

/* --- ligar e chegar, na própria lista ---
   Alvos de 44 px, que é o mínimo para um polegar, e a lista usa-se de pé.
   Ficam por baixo do cartão e não dentro dele: ver o comentário no HTML. */
.c-acoes{display:flex;gap:8px;padding:0 0 14px;flex-wrap:wrap}
.c-acao{display:inline-flex;align-items:center;gap:7px;min-height:44px;
  padding:0 14px;border:2px solid var(--tinta);background:var(--papel);
  font:700 13px/1 var(--fonte);color:var(--tinta);text-decoration:none}
.c-acao svg{width:19px;height:19px;flex:none}
.c-acao:hover,.c-acao:focus-visible{background:var(--tinta);color:var(--papel)}
/* A marca herda a cor do texto, por isso inverte-se com ele. */
.c-acao:hover svg,.c-acao:focus-visible svg{color:var(--papel)}
/* Um centro parado continua a poder ser telefonado — é a única coisa útil a
   fazer com ele — mas os botões não competem com o aviso vermelho. */
.c-item .c-pausa~.c-acoes,.c-item.velha .c-acoes,.c-item.nunca .c-acoes{opacity:.75}

/* A distância só existe depois de alguém dar a localização, e é escrita pelo
   script. Sem permissão nunca aparece — ver o comentário em paginaCentros. */
.c-perto{margin-left:8px;font:700 12px/1.2 var(--mono);color:var(--tinta)}
.c-perto::before{content:"· "}

.sem-resultado{margin:18px 0;font:500 15px/1.5 var(--fonte);color:var(--texto-2)}
.erro-form{margin:0 0 16px;padding:12px 14px;background:var(--proibido);color:#fff;
  font:600 14px/1.45 var(--fonte)}

/* --- navegação ---
   Faltava por completo. Metade de quem chega entra pelo QR de um cartaz, no
   meio de uma página qualquer: sem barra, ir de um sítio ao outro era escrever
   o endereço de cor. */
.nav-topo{position:sticky;top:0;z-index:40;display:flex;align-items:center;
  gap:8px 16px;flex-wrap:wrap;padding:10px var(--goteira);
  background:var(--tinta);color:var(--papel)}
.nav-topo .marca{font:400 20px/1 var(--preta);letter-spacing:-.01em;
  color:var(--papel);text-decoration:none;flex:none}
.nav-links{display:flex;flex-wrap:wrap;gap:4px 14px;min-width:0}
.nav-links a{font:600 13px/1.2 var(--fonte);color:var(--fio);text-decoration:none;
  padding:8px 0;white-space:nowrap}
.nav-links a:hover{color:var(--papel)}
/* A página actual sublinhada e não só mais clara: a cor sozinha nunca carrega
   significado neste projecto, no ecrã como no papel. */
.nav-links a[aria-current=page]{color:var(--papel);
  box-shadow:inset 0 -3px 0 var(--papel)}
.migalhas{display:flex;flex-wrap:wrap;align-items:center;gap:6px;
  max-width:760px;margin:0 auto;padding:10px var(--goteira);
  font:600 12px/1.3 var(--mono);color:var(--texto-2);background:var(--papel)}
.migalhas a{color:var(--texto-2)}
.migalhas b{color:var(--tinta);font-weight:700}
@media(min-width:800px){.migalhas{padding:14px var(--goteira) 0}}

/* --- centros sem dono ---
   Uma faixa e não um cartão: isto atravessa a página porque é a primeira coisa
   que muda o sentido de tudo o que está por baixo. Traço a cheio à esquerda,
   como o aviso de idade — a mesma família de "leia isto antes de acreditar no
   resto". Sem vermelho: não é um erro nem um perigo, é uma página honesta
   sobre o que não sabe. */
.sem-dono{padding:18px var(--goteira);background:var(--claro);
  border-left:8px solid var(--tinta);border-bottom:1px solid var(--tenue)}
.sem-dono h2{display:flex;align-items:center;gap:10px;margin:0 0 8px;
  font-size:clamp(17px,4.6vw,21px)}
.sem-dono h2 svg{width:26px;height:26px;flex:none}
.sem-dono p{margin:0 0 8px;font:500 15px/1.55 var(--fonte);color:var(--texto-2)}
.sem-dono b{color:var(--tinta)}
.sem-dono .fonte{font:600 13px/1.5 var(--mono);color:var(--texto-3);word-break:break-word}
.sem-dono .btn{margin-top:6px}
/* Na lista: a mesma palavra sem cor de alarme. Um centro sem dono não está
   atrasado — não tem quem publique, e isso não é culpa dele. */
.c-item.sem-dono .c-quando{color:var(--texto-3)}
/* O convite na página do próprio centro. Faixa como as outras desta página, e
   só quando o centro marcou que lê códigos. */
.bloco-sacola{padding:18px var(--goteira);background:var(--claro);
  border-bottom:1px solid var(--tenue)}
.bloco-sacola h2{display:flex;align-items:center;gap:10px;margin:0 0 8px;
  font-size:clamp(17px,4.6vw,21px)}
.bloco-sacola h2 svg{width:26px;height:26px;flex:none}
.bloco-sacola p{margin:0 0 12px;font:500 14.5px/1.55 var(--fonte);color:var(--texto-2)}
.bloco-sacola .btn{margin:0}

/* A entrada para registar uma sacola, no topo de "Quero ajudar". Só aparece
   quando há pelo menos um centro que lê códigos: oferecê-la com zero seria
   prometer a um doador uma coisa que ninguém do outro lado faz — o mesmo erro
   que a opção por centro existe para evitar, um andar acima. */
.entrada-sacola{display:flex;gap:14px;align-items:flex-start;margin:0 0 18px;
  padding:16px;border:3px solid var(--tinta);background:var(--claro);
  text-decoration:none;color:var(--tinta)}
.entrada-sacola svg{width:34px;height:34px;flex:none;margin-top:2px}
.entrada-sacola > span{display:block}
.entrada-sacola b{display:block;font:800 17px/1.25 var(--fonte);margin-bottom:4px}
.entrada-sacola span span{font:500 13.5px/1.5 var(--fonte);color:var(--texto-2)}

/* O selo de quem aceita sacolas registadas. Texto e não marca nova: as 29 são
   itens e utilitários, e inventar uma trigésima para um estado de ecrã é o
   mesmo erro que pôr lá o elo do perfil. */
.c-sacolas{display:inline-block;margin-top:4px;padding:3px 7px;border:1px solid var(--fio);
  font:700 10.5px/1.4 var(--fonte);text-transform:uppercase;letter-spacing:.08em;
  color:var(--texto-2)}
.nota-sem-lista{margin:0 0 14px;padding:11px 13px;background:var(--claro);
  border-left:6px solid var(--tinta);font:500 13.5px/1.55 var(--fonte);color:var(--texto-2)}
.nota-sem-lista a{color:var(--tinta)}

/* --- a barra de sessão ---
   O preço de trocar o campo escondido por um cookie é que "fechar o separador"
   deixou de ser sair. Isto repõe-no: diz em que centro se está e tem a porta à
   vista. Nem alarme nem decoração — é uma barra de estado. */
.barra-sessao{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;
  margin:0;padding:12px var(--goteira);background:var(--claro);
  border-bottom:1px solid var(--tenue)}
.barra-sessao p{margin:0;flex:1 1 12em;font:500 13.5px/1.45 var(--fonte);color:var(--texto-2)}
.barra-sessao b{color:var(--tinta)}
.barra-sessao .btn{margin:0;flex:none}

/* --- sacolas --- */
.caneta{margin:0 0 18px;padding:16px var(--goteira);background:var(--tinta);color:var(--papel)}
.caneta h2{margin:0 0 6px;font-size:clamp(16px,4.4vw,19px);color:var(--papel)}
.caneta p{margin:0;font:500 14.5px/1.55 var(--fonte);color:#D9D5CE}
.codigo-caixa .cc-itens{margin:6px 0 0;font:500 14px/1.5 var(--fonte);color:var(--texto-2)}
.codigo-pequeno{margin:0 0 4px;font:700 20px/1 var(--mono);letter-spacing:.08em}
.qr-sacola{display:flex;flex-wrap:wrap;align-items:center;gap:16px;margin:0 0 22px}
.qr-sacola svg{width:132px;height:132px;flex:none;border:1px solid var(--tenue)}
.qr-sacola p{margin:0;flex:1 1 14em;font:500 13.5px/1.55 var(--fonte);color:var(--texto-2)}
/* O endereço por escrito, debaixo do QR. Um QR que não lê — ecrã rachado, sol a
   bater, impressão fraca — deixa o voluntário sem nada se o endereço só existir
   dentro dos pixéis. */
.qr-endereco{margin-top:8px!important;font-size:12.5px!important;word-break:break-all}
.qr-endereco b{font-family:var(--mono);font-weight:700}
.achado{border:3px solid var(--tinta);background:var(--papel);padding:16px;margin:0 0 18px}
.achado .codigo{margin:0}
.achado .a-sub{margin:4px 0 10px;font:600 13px/1.45 var(--mono);color:var(--texto-2)}
.linha-item{display:flex;align-items:center;gap:12px;padding:11px 0;
  border-top:1px solid var(--tenue)}
.linha-item svg{width:34px;height:34px;flex:none}
.linha-item b{font:700 15.5px/1.3 var(--fonte)}
.sacola-linha{border:2px solid var(--tinta);padding:12px 14px;margin:0 0 10px}
.sacola-linha p{margin:0 0 4px}
.sacola-linha p:last-child{margin-bottom:0}
.selo-bom{display:inline-block;padding:5px 9px;background:var(--permitido);color:#fff;
  font:800 11.5px/1 var(--fonte);text-transform:uppercase;letter-spacing:.08em}
.selo-espera{display:inline-block;padding:5px 9px;background:var(--tenue);color:var(--texto-2);
  font:800 11.5px/1 var(--fonte);text-transform:uppercase;letter-spacing:.08em}
.doar .bloco-nao,.doar .marcas{margin-top:0}
.balcao select,.doar select{width:100%;padding:12px;font:600 15px/1.2 var(--fonte);
  color:var(--tinta);background:var(--papel);border:2px solid var(--tinta);border-radius:0}

/* --- actualização diária ---
   Alvos grandes e poucos por linha. Isto usa-se de manhã, de pé, com uma mão,
   por alguém que tem outras dezassete coisas para fazer. */
.entrar form{margin:0 0 8px}
.feito{margin:0 0 16px;padding:12px 14px;background:var(--permitido);color:#fff;
  font:700 14px/1.45 var(--fonte)}
.feito a{color:#fff}
.idade.fresca-ok{background:var(--claro);color:var(--texto-2);
  border-left:6px solid var(--permitido)}
.atualizar .endereco{margin:6px 0 0;font:500 13.5px/1.4 var(--fonte);color:var(--texto-2)}
.bloco-a{padding:18px var(--goteira);border-top:6px solid var(--tinta)}
.bloco-a h2{margin:0 0 10px}
/* Mais específico do que ".btn.largo{width:100%}", que de outro modo ganha e
   soma 100% à margem de 20 px — o botão saía 20 px fora do ecrã e a página
   passava a deslizar de lado. */
.form-atualizar > .btn.largo{margin:18px var(--goteira) 0;
  width:calc(100% - var(--goteira) * 2);box-sizing:border-box}
.form-atualizar .ajuda{padding:0 var(--goteira)}
.bloco-a .ajuda{padding:0}
.grupo{margin:0 0 14px;padding:0;border:0}
.grupo legend{padding:0;font:700 11px/1 var(--fonte);text-transform:uppercase;
  letter-spacing:.16em;color:var(--texto-2)}
.itens{display:grid;gap:8px;margin-top:8px}
@media(min-width:560px){.itens{grid-template-columns:1fr 1fr}}
/* O item inteiro é a área tocável, não só a caixa. Uma caixa de 13 px falha-se
   com o polegar, e quem falha um toque três vezes desiste da ferramenta. */
.item{display:flex;align-items:center;gap:10px;min-height:52px;padding:8px 10px;
  border:2px solid var(--fio);background:var(--papel);cursor:pointer}
.item.ligado,.item:has(input:checked){border-color:var(--tinta);border-width:3px;padding:7px 9px}
.item input[type=checkbox]{width:22px;height:22px;flex:none;accent-color:var(--tinta);margin:0}
.item svg{width:30px;height:30px;flex:none}
.it-nome{flex:1;min-width:0;font:600 14px/1.25 var(--fonte)}
/* ".item .it-q" e não ".it-q" sozinho: existe um input[type=text]{width:100%}
   mais acima, e um selector de atributo ganha a uma classe. Com a regra fraca
   a caixa da quantidade ficava com 326 px, empurrava o nome do item para zero
   e a linha passava a ser um quadrado sem legenda. */
/* 96 px porque "20 caixas" tem de caber à vista e não só na base de dados. */
.item .it-q{width:96px;flex:none;padding:8px;font:600 14px/1.2 var(--mono);
  color:var(--tinta);background:var(--papel);border:2px solid var(--fio);
  border-radius:0;box-sizing:border-box}
.item:has(input:checked) .it-q{border-color:var(--tinta)}
.recusas .it-nome{color:var(--proibido)}
.caixa.grande{min-height:52px;font:700 15px/1.25 var(--fonte)}
textarea{width:100%;padding:12px;font:500 15px/1.45 var(--fonte);color:var(--tinta);
  background:var(--papel);border:2px solid var(--tinta);border-radius:0;
  -webkit-appearance:none;box-sizing:border-box;resize:vertical}
.btn.largo{width:100%;text-align:center}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;
  overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}

/* --- a faixa de aviso, no topo de tudo ---
   Vermelha, larga, e acima da barra de navegação: se estiver por baixo, o
   primeiro toque de quem chega pelo QR de um cartaz passa-lhe ao lado.
   Não sai no papel — um aviso que expira daqui a um dia impresso numa folha
   que fica na porta um mês é a mentira que este projecto anda a evitar. */
.aviso-global{display:flex;align-items:flex-start;gap:12px;
  padding:14px var(--goteira);background:var(--proibido);color:#fff}
.aviso-global svg{width:26px;height:26px;flex:none;margin-top:1px}
.aviso-global svg path,.aviso-global svg rect{fill:#fff}
.aviso-global p{margin:0;font:700 15px/1.45 var(--fonte);max-width:60ch}
@media print{.aviso-global{display:none !important}}

/* --- os blocos da administração ---
   Uma página que passou de uma fila de aprovação a um painel. Cada bloco é uma
   tarefa fechada, com risco em cima, para se correr a página com os olhos. */
.bloco-admin{margin:0 0 28px;padding:16px 0 0;border-top:4px solid var(--tinta)}
.bloco-admin h2{margin:0 0 8px;font-size:clamp(18px,4.5vw,22px)}
.bloco-admin .entrada{margin-bottom:12px}
.bloco-admin form{margin:0 0 4px}
.bloco-admin form.em-linha{display:inline-block;margin:8px 8px 0 0}
.atalhos{display:flex;flex-wrap:wrap;gap:8px}
.atalhos .btn{margin:0}
h2.risco{margin-top:8px;padding-top:16px;border-top:4px solid var(--tinta)}
.fio{border:0;border-top:1px solid var(--tenue);margin:14px 0}

/* O que falta preencher. Só aparece o que tem alguma coisa a apontar. */
.saude{list-style:none;margin:0 0 10px;padding:0}
.saude li{padding:9px 0;border-bottom:1px solid var(--tenue)}
.saude b{display:block;font:800 15px/1.3 var(--fonte);color:var(--proibido)}
.saude span{font:500 13px/1.45 var(--fonte);color:var(--texto-2)}
.tudo-bem{margin:0 0 10px;padding:11px 12px;background:var(--claro);
  border-left:6px solid var(--permitido);font:600 14px/1.45 var(--fonte)}

/* O estado da faixa vermelha, visto de dentro. */
.aviso-estado{padding:12px;margin:0 0 10px;background:var(--claro);
  border-left:6px solid var(--proibido)}
.aviso-estado p{margin:0 0 6px;font:500 14px/1.45 var(--fonte)}
.aviso-estado blockquote{margin:8px 0 0;padding:10px 12px;background:var(--papel);
  border:2px solid var(--tinta);font:700 15px/1.4 var(--fonte)}

/* As emergências. */
.emg-admin{list-style:none;margin:0 0 12px;padding:0}
.emg-admin li{padding:11px 0;border-bottom:1px solid var(--tenue)}
.emg-admin li.arquivada{opacity:.6}
.emg-linha{display:grid;gap:7px;margin:0}
.emg-meta{font:600 12px/1.3 var(--mono);color:var(--texto-2)}
.emg-acoes{display:flex;flex-wrap:wrap;gap:6px}

/* O ecrã de confirmação. */
.confirmar .conf-form{margin-top:18px}
.confirmar .previa{margin:14px 0;border:2px dashed var(--fio);padding:0}
.confirmar .previa .aviso-global{padding:14px 16px}

/* --- inicial, admin, avisos --- */
.inicial h1,.admin h1,.aviso-pagina h1{margin:0 0 10px;
  font:400 clamp(26px,7vw,42px)/1.02 var(--preta);letter-spacing:-.025em;text-wrap:balance}
.inicial .tipo{margin:0 0 8px;font:700 12px/1 var(--fonte);text-transform:uppercase;
  letter-spacing:.18em;color:var(--texto-2)}
.entrada{margin:0 0 20px;font:500 16px/1.55 var(--fonte);color:var(--texto-2);max-width:60ch}
.passos-i ol{margin:0 0 26px;padding-left:20px}
.passos-i li{margin-bottom:10px;font:500 15px/1.5 var(--fonte);color:var(--texto-2)}
.passos-i b{color:var(--tinta)}
.pedir{padding:20px 0 0;border-top:2px solid var(--tinta)}
.pedir h2{font-size:clamp(20px,5vw,26px);margin-bottom:6px}
.dica{margin:0 0 16px;font:500 14px/1.5 var(--fonte);color:var(--texto-2);max-width:60ch}
.campo{display:block;margin:14px 0 5px;font:700 11.5px/1 var(--fonte);
  text-transform:uppercase;letter-spacing:.1em;color:var(--texto-2)}
input[type=text],select{width:100%;padding:12px;font:500 16px/1.3 var(--fonte);
  color:var(--tinta);background:var(--papel);border:2px solid var(--tinta);border-radius:0}
input:focus-visible,select:focus-visible,button:focus-visible,a:focus-visible{
  outline:3px solid var(--proibido);outline-offset:2px}
.btn{display:inline-block;margin-top:18px;padding:14px 18px;
  font:700 13.5px/1 var(--fonte);text-transform:uppercase;letter-spacing:.05em;
  background:var(--papel);color:var(--tinta);border:2px solid var(--tinta);
  cursor:pointer;text-decoration:none}
.btn-primario{background:var(--tinta);color:var(--papel)}
.btn-recusar{border-color:var(--proibido);color:var(--proibido)}
/* O bloco de guardar o código, logo a seguir à caixa que o mostra: é o momento
   em que a pessoa ainda o tem no ecrã, e o único em que o pode mandar. */
/* O que vai acontecer a seguir, dito antes de se carregar no botão: haverá um
   telefonema, e o código antigo morre. As duas coisas surpreendem se não forem
   ditas, e uma delas estraga um papel que alguém guardou. */
.aviso-caixa{margin:22px var(--goteira);padding:16px;background:var(--claro);
  border-left:6px solid var(--tinta)}
.aviso-caixa p{margin:0 0 8px;font:500 14px/1.5 var(--fonte);color:var(--texto-2)}
.aviso-caixa p:last-child{margin-bottom:0}
.aviso-caixa b{color:var(--tinta)}
.guardar-codigo{margin:0 0 22px}
.guardar-codigo .ajuda{margin-top:10px}
.codigo-caixa{padding:18px;margin:0 0 20px;border:3px solid var(--tinta);background:var(--claro)}
.codigo-caixa .rotulo{margin:0;font:700 11px/1 var(--fonte);text-transform:uppercase;
  letter-spacing:.16em;color:var(--texto-2)}
.codigo{margin:8px 0 12px;font:400 clamp(30px,9vw,46px)/1 var(--preta);letter-spacing:.06em}
code{font:600 14px/1.5 var(--mono);word-break:break-all}
.pedidos{display:grid;gap:14px;margin-bottom:28px}
.pedido{padding:16px;border:2px solid var(--tinta)}
.pedido h3{margin:0 0 4px;font:800 18px/1.2 var(--fonte)}
.pedido p{display:flex;align-items:center;gap:8px;margin:0 0 6px;
  font:500 14px/1.4 var(--fonte)}
.pedido svg{width:17px;height:17px;flex:none}
.pedido .meta{font:500 12px/1.3 var(--mono);color:var(--texto-2)}
.pedido form{margin-top:10px}
.pedido .campo{margin:10px 0 4px}
.linha-slug{display:flex;align-items:center;gap:6px}
.linha-slug span{font:600 16px/1 var(--mono);color:var(--texto-2)}
.linha-slug input{flex:1;min-width:0;font-family:var(--mono);font-size:15px}
.pedido.parado{border-color:var(--proibido)}
.pedido .meta.velha,.pedido .meta.nunca{color:var(--proibido);font-weight:700}
.btn-wa{background:#25D366;border-color:#0f7a3a;color:var(--tinta);font-weight:800}
.conta-n{font:600 12px/1 var(--mono);padding:3px 6px;background:var(--proibido);color:#fff}
.pedido .botoes{display:flex;gap:10px;margin-top:12px;flex-wrap:wrap}
.pedido .botoes .btn{text-decoration:none;display:flex;align-items:center;justify-content:center}
.pedido .btn{flex:1;margin-top:0;text-align:center}
/* O endereço que ainda não abre, na página de pedido recebido: mesmo lugar de
   destaque do código, sem o peso tipográfico de um segredo. */
.endereco-previsto{font-size:clamp(15px,4.5vw,22px);word-break:break-all}
/* A secção de um centro que fechou. Vermelha e com a marca proibida: é a mesma
   gramática do "não traga", e quem chega aqui vem com coisas no carro. */
/* O botão de encerrar é vermelho e está no fim, depois de tudo o que se faz
   todos os dias. Não é escondido — é preciso — mas também não compete com o
   botão de publicar. */
.encerrar{border-top-color:var(--proibido)}
.encerrar .btn{margin-top:12px}
.fechou{display:flex;flex-direction:column;align-items:flex-start;gap:14px}
.fechou svg{width:52px;height:52px;color:var(--proibido)}
.fechou p{margin:0;font:500 15px/1.5 var(--fonte);color:var(--texto-2)}
.lista-no-ar{list-style:none;margin:0;padding:0}
/* flex-wrap por causa do bloco de correção: sem ele o "details" ficava
   espremido na mesma linha, empurrado para a direita, e os campos lá dentro
   começavam a 262 px da beira em vez dos 20 px de toda a gente — que é
   exactamente o que tools/goteira.js existe para apanhar. */
.lista-no-ar li{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;
  padding:11px 0;border-bottom:1px solid var(--tenue);font:600 15px/1.3 var(--fonte)}
.lista-no-ar span{font:500 13px/1.3 var(--mono);color:var(--texto-2);flex:none}
.lista-no-ar li.velha span,.lista-no-ar li.nunca span{color:var(--proibido);font-weight:700}
.na-txt{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;min-width:0}
.na-form{flex:none;margin:0}
/* Discreto de propósito: é uma acção rara e destrutiva — invalida o código que
   está em uso — e não pode competir com o nome do centro pela atenção de quem
   corre esta lista à procura de quem parou de publicar. */
.btn.pequeno{margin-top:0;padding:8px 10px;font-size:11px;
  border-color:var(--fio);color:var(--texto-2)}
.btn.pequeno:hover{border-color:var(--tinta);color:var(--tinta)}
`;

module.exports = { molde, paginaCentro, paginaPendente, paginaNaoExiste,
                   paginaInicial, paginaCentros, paginaCentroEntrada, paginaNovo,
                   paginaAtualizarEntrada, paginaAtualizar, textoCodigo,
                   paginaPedirCodigo, paginaPedidoRecebido, textoAprovado,
                   paginaSouDaqui, paginaSouDaquiRecebido,
                   paginaDoar, paginaSacolaCriada, paginaMinhasSacolas,
                   paginaBalcao, paginaBalcaoSacola, paginaBalcaoRecebida,
                   paginaEncerrado, paginaConfirmarEncerrar,
                   paginaCodigo, paginaAdmin, paginaConfirmar,
                   definirAviso, idade, esc, CSS };
