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
const { svgIcone, svgProibido, svgAnel, item, ROTULO_BR, ICONES } = require('./compartilhado');
const { linkWhatsApp } = require('./avisos');

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

const dataCurta = ms => {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/* ---------------------------------------------------------------------------
 * Molde comum
 * -------------------------------------------------------------------------*/
function molde({ titulo, descricao, corpo, classe }) {
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
${corpo}
</body>
</html>`;
}

/* ---------------------------------------------------------------------------
 * Partilhar
 *
 * O que se manda é o LINK e não uma imagem. Uma imagem de uma lista é o mesmo
 * problema do cartaz impresso — nasce velha e continua a circular meses depois
 * no WhatsApp de alguém. O link diz sempre o que o centro precisa hoje, e diz
 * também quando a lista já não é de hoje.
 * -------------------------------------------------------------------------*/
function textoPartilhaCentro(d, url) {
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

const linkPartilha = (d, url) =>
  'https://wa.me/?text=' + encodeURIComponent(textoPartilhaCentro(d, url));

/* ---------------------------------------------------------------------------
 * A página pública de um centro — o destino do QR
 * -------------------------------------------------------------------------*/
function paginaCentro(centro, base, urlCanonica) {
  const d = centro.dados || {};
  const precisa = (d.precisa || []).map(item);
  const nao = (d.naoTraga || []).map(item);
  const tel = (d.contato || '').trim();
  const telLink = tel.replace(/[^\d+]/g, '');
  const url = urlCanonica || `${base}/${centro.slug}`;

  const corpo = `
<main class="centro">
  <header class="topo-c">
    <p class="tipo">${esc(d.tipo || 'Ponto de arrecadação')}</p>
    <h1>${esc(d.nome || centro.slug)}</h1>
    ${d.horario ? `<p class="horas">${svgIcone(d.pausado ? 'fechado' : 'aberto')}<span>${esc(d.horario)}</span></p>` : ''}
  </header>

  ${faixaIdade(centro.publicado)}

  ${d.pausado ? `
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

  <section class="bloco-nao">
    <h2>${svgAnel()}<span>Por favor, não traga</span></h2>
    <p class="porque">Não temos onde guardar — e obrigado por querer ajudar.</p>
    <ul class="marcas">${nao.map(i => `<li>${svgProibido(i.id)}<span>${esc(i.rotulo)}</span></li>`).join('')}</ul>
  </section>

  <section class="contacto">
    ${d.endereco ? `<p class="lin">${svgIcone('pino')}<span>${esc(d.endereco)}</span></p>` : ''}
    ${tel ? `<p class="lin"><a href="tel:${esc(telLink)}">${svgIcone('telefone')}<span>${esc(tel)}</span></a></p>` : ''}
    ${centro.publicado ? `<p class="carimbo">Lista de ${dataCurta(centro.publicado)}</p>` : ''}
  </section>

  <section class="partilhar">
    <a class="btn btn-wa" id="b-wa" href="${esc(linkPartilha(d, url))}" target="_blank" rel="noopener">
      Mandar esta lista no WhatsApp</a>
    <p class="nota-partilha">Mande o <b>link</b>, não uma imagem: a imagem fica velha,
      o link não.</p>
  </section>

  <footer class="pe">
    <p><b>Leve isto consigo.</b> <a href="${esc(url)}">${esc(url.replace(/^https?:\/\//, ''))}</a></p>
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
  var t = ${paraScript(textoPartilhaCentro(d, url))};
  b.addEventListener('click', function (e) {
    e.preventDefault();
    navigator.share({ text: t }).catch(function () { window.open(b.href, '_blank'); });
  });
})();
</script>`;

  const lista = precisa.slice(0, 6).map(i => i.rotulo).join(', ');
  return molde({
    titulo: `${d.nome || centro.slug} — o que precisamos hoje`,
    descricao: d.pausado
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
        está à espera de ser verificado. Isso costuma demorar pouco.</p>
      <p>Se é o coordenador deste centro, pode ver como a página vai ficar juntando o
        seu código ao endereço:
        <code>?codigo=SEU-CODIGO</code></p>
    </main>`
  });
}

function paginaNaoExiste() {
  return molde({
    titulo: 'Página não encontrada',
    corpo: `<main class="aviso-pagina">
      <h1>Não encontrámos este centro</h1>
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
function paginaInicial({ contagem, base }) {
  return molde({
    titulo: 'CAPEM — centros de apoio',
    descricao: 'Veja o que os centros de apoio precisam hoje, ou peça a página do seu centro.',
    corpo: `
<main class="portas">
  <header>
    <p class="tipo">CAPEM · ferramenta livre</p>
    <h1>O que os centros precisam hoje</h1>
    <p class="entrada">Um cartaz impresso diz o que um centro precisava no dia em que
      foi impresso. Estas páginas dizem o que precisa hoje — e é para aqui que aponta
      o QR de todo o material do kit.</p>
  </header>

  <div class="duas-portas">
    <a class="porta" href="/centros">
      ${svgIcone('caixa')}
      <span class="porta-t">Quero ajudar</span>
      <span class="porta-d">Ver os centros e o que cada um precisa hoje.
        ${contagem.aprovado ? `${contagem.aprovado} ${contagem.aprovado === 1 ? 'centro' : 'centros'} no ar.` : ''}</span>
    </a>
    <a class="porta" href="/centro">
      ${svgIcone('cartaz')}
      <span class="porta-t">Sou de um centro</span>
      <span class="porta-d">Gere o material impresso e publique a lista de hoje.
        Peça a sua página se ainda não tiver.</span>
    </a>
  </div>

  <footer class="pe">
    <p class="creditos">Nada aqui recolhe dados de quem é atendido — só a morada,
      o horário e o telefone de um edifício.
      <a href="https://github.com/philthemoser/capem">O código é aberto.</a></p>
  </footer>
</main>`
  });
}

/* ---------------------------------------------------------------------------
 * A lista de centros
 *
 * Ordenada pela idade da lista e não pelo nome: um centro que publicou hoje é
 * útil, um que não toca na página há três semanas é uma viagem em vão à espera
 * de acontecer. Os velhos ficam no fim e dizem-no.
 *
 * As marcas aparecem aqui, pequenas, para se poder correr a lista com os olhos
 * e ver quem precisa de água sem ler uma palavra.
 * -------------------------------------------------------------------------*/
function paginaCentros({ centros, base }) {
  const ordem = { fresca: 0, 'a-envelhecer': 1, velha: 2, nunca: 3 };
  const linhas = centros
    .map(c => ({ c, i: idade(c.publicado) }))
    /* Primeiro pela idade da lista; dentro da mesma idade, quem está a receber
       antes de quem está em pausa. Um centro em pausa com lista de hoje é
       informação útil — "não vá lá" — mas esta página chama-se "quero ajudar",
       e o primeiro da lista tem de ser um sítio que aceita alguma coisa. */
    .sort((a, b) => ordem[a.i.nivel] - ordem[b.i.nivel] ||
      (!!(a.c.dados || {}).pausado - !!(b.c.dados || {}).pausado) ||
      String((a.c.dados || {}).nome).localeCompare(String((b.c.dados || {}).nome), 'pt'))
    .map(({ c, i }) => {
      const d = c.dados || {};
      const precisa = (d.precisa || []).map(item).slice(0, 8);
      const quando = { fresca: 'lista de hoje', 'a-envelhecer': `há ${i.dias} dias`,
        velha: `há ${i.dias} dias`, nunca: 'ainda sem lista' }[i.nivel];
      /* O que se procura é o nome ou o sítio, por isso é isso que o filtro vê. */
      const busca = [d.nome, d.endereco, d.tipo].join(' ').toLowerCase();
      return `<li class="c-item ${i.nivel}" data-busca="${esc(busca)}">
        <a href="${esc(c.url || base + '/' + c.slug)}">
          <span class="c-nome">${esc(d.nome || c.slug)}</span>
          <span class="c-morada">${esc(d.endereco || '')}</span>
          <span class="c-quando">${esc(quando)}</span>
          ${d.pausado
            ? `<span class="c-pausa">${svgIcone('fechado')} Não está recebendo agora</span>`
            : precisa.length
              ? `<span class="c-marcas">${precisa.map(x => svgIcone(x.id)).join('')}</span>`
              : ''}
        </a>
      </li>`;
    }).join('');

  return molde({
    titulo: 'Centros de apoio — o que precisam hoje',
    descricao: 'Lista dos centros de apoio e do que cada um precisa hoje.',
    corpo: `
<main class="lista-centros">
  <header>
    <p class="tipo"><a href="/">CAPEM</a></p>
    <h1>Centros de apoio</h1>
    <p class="entrada">Toque num centro para ver a lista completa, a morada e o
      telefone. <b>Ligue antes de vir</b> se a lista não for de hoje.</p>
  </header>

  ${centros.length ? `
  <div class="busca">
    <label class="sr-only" for="q">Procurar por nome ou lugar</label>
    <input id="q" type="search" placeholder="Procurar por nome ou lugar…" autocomplete="off">
  </div>
  <ul class="centros">${linhas}</ul>
  <p class="sem-resultado" id="sem-resultado" hidden>Nenhum centro com esse nome.</p>
  ` : `<p class="vazio">Ainda não há centros no ar. Se está a montar um,
        <a href="/novo">peça a página do seu centro</a>.</p>`}

  <footer class="pe">
    <p><b>Não encontrou o seu centro?</b> <a href="/novo">Peça a página aqui.</a></p>
  </footer>
</main>
<script>
/* Filtro no aparelho. A lista já veio toda: sem isto continua a funcionar,
   só sem a caixa de procura. Com dezenas de centros chega bem; com centenas,
   isto passa a ter de ser feito no servidor. */
(function () {
  var q = document.getElementById('q');
  if (!q) return;
  var itens = [].slice.call(document.querySelectorAll('.c-item'));
  var vazio = document.getElementById('sem-resultado');
  q.addEventListener('input', function () {
    var t = q.value.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var n = 0;
    itens.forEach(function (li) {
      var alvo = li.getAttribute('data-busca')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      var bate = !t || alvo.indexOf(t) >= 0;
      li.hidden = !bate;
      if (bate) n++;
    });
    vazio.hidden = n > 0;
  });
})();
</script>`
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
    titulo: 'Sou de um centro — CAPEM',
    descricao: 'Gere o material impresso do seu centro e publique a lista de hoje.',
    corpo: `
<main class="portas">
  <header>
    <p class="tipo"><a href="/">CAPEM</a></p>
    <h1>Sou de um centro</h1>
    <p class="entrada">Tudo o que um ponto de arrecadação precisa: o material para
      imprimir, e a lista de hoje que o QR desse material aponta.</p>
  </header>

  <div class="duas-portas">
    <a class="porta" href="/kit">
      ${svgIcone('cartaz')}
      <span class="porta-t">Material impresso</span>
      <span class="porta-d">Quinze peças a partir dos mesmos dados — cartaz de porta,
        etiquetas de caixa, panfletos, crachás. E o botão para publicar a lista de
        hoje, se já tiver página.</span>
    </a>
    <a class="porta" href="/novo">
      ${svgIcone('pino')}
      <span class="porta-t">Pedir a minha página</span>
      <span class="porta-d">Ainda não tem endereço na internet? Peça um — recebe o
        código na hora. É o que lhe deixa publicar todos os dias.</span>
    </a>
  </div>

  <footer class="pe">
    <p><b>Perdeu o código?</b> Não há como o recuperar — só emitir outro.
      <a href="/novo">Peça uma página nova</a> e diga-nos, para juntarmos as duas.</p>
  </footer>
</main>`
  });
}

/* ---------------------------------------------------------------------------
 * Pedir uma página
 * -------------------------------------------------------------------------*/
function paginaNovo({ erro }) {
  return molde({
    titulo: 'Pedir a página de um centro',
    corpo: `
<main class="inicial">
  <header>
    <p class="tipo"><a href="/">CAPEM</a></p>
    <h1>Pedir a página do seu centro</h1>
    <p class="entrada">Recebe um código na hora — é o que lhe deixa publicar a lista
      todos os dias, a partir do <a href="/kit">kit</a>. Cada pedido é verificado à
      mão antes de a página ir para o ar: um endereço errado numa emergência manda
      pessoas para o sítio errado.</p>
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

function paginaCodigo({ slug, codigo, base, url: urlCanonica }) {
  const url = urlCanonica || `${base}/${slug}`;
  return molde({
    titulo: 'Pedido recebido — guarde o código',
    corpo: `
<main class="inicial">
  <h1>Pedido recebido</h1>
  <p class="entrada">A página de <b>${esc(slug)}</b> fica no ar assim que for verificada.</p>

  <section class="codigo-caixa">
    <p class="rotulo">O seu código</p>
    <p class="codigo">${esc(codigo)}</p>
    <p class="dica"><b>Escreva-o num papel agora.</b> É o que lhe deixa publicar a lista
      todos os dias. Não é guardado em lado nenhum de onde se possa recuperar — se o
      perder, tem de pedir outro.</p>
  </section>

  <p>O endereço da sua página será:<br><code>${esc(url)}</code></p>
  <p><a class="btn" href="/kit">Ir para o kit e gerar o material impresso</a></p>
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

${quando} Quem lê o QR dos cartazes vê essa data, e a página já está a avisar que pode não valer.

Atualizar leva meio minuto: abra ${url.replace(/\/[^/]*$/, '')}/kit no telemóvel, marque o que precisam hoje e carregue em Publicar. O código é o mesmo de sempre.

Se o centro fechou ou parou de receber, diga só — marcamos a página e ninguém aparece à porta em vão.`;
}

function paginaAdmin({ pendentes, aprovados, parados, token, contagem, base, erro }) {
  const linha = c => {
    const d = c.dados || {};
    return `<article class="pedido">
      <h3>${esc(d.nome || c.slug)}</h3>
      <p class="meta">${esc(d.tipo || '')} · pedido em ${dataCurta(c.criado)}</p>
      <p>${svgIcone('pino')} ${esc(d.endereco || '—')}</p>
      <p>${svgIcone('telefone')} ${esc(d.contato || '—')}</p>
      <form method="POST" action="/admin/decidir">
        <input type="hidden" name="t" value="${esc(token)}">
        <input type="hidden" name="slug" value="${esc(c.slug)}">
        <label class="campo" for="s-${esc(c.slug)}">Endereço</label>
        <div class="linha-slug">
          <span>/</span>
          <input id="s-${esc(c.slug)}" name="novo_slug" type="text" value="${esc(c.slug)}"
            maxlength="48" autocomplete="off" spellcheck="false">
        </div>
        <p class="meta">Encurte-o se for longo de ditar ao telefone. O endereço
          antigo continua a responder.</p>
        <div class="botoes">
          <button class="btn btn-primario" name="decisao" value="aprovado">Aprovar</button>
          <button class="btn btn-recusar" name="decisao" value="recusado">Recusar</button>
        </div>
      </form>
    </article>`;
  };

  return molde({
    titulo: 'CAPEM — pedidos',
    corpo: `
<main class="admin">
  <h1>Pedidos</h1>
  <p class="entrada">${contagem.pendente} à espera · ${contagem.aprovado} no ar ·
    ${contagem.recusado} recusados</p>
  ${erro === 'ocupado' ? '<p class="erro-form">Esse endereço já está ocupado. Escolha outro.</p>' : ''}

  ${pendentes.length
    ? `<div class="pedidos">${pendentes.map(linha).join('')}</div>`
    : '<p class="vazio">Nada à espera.</p>'}

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
  ${aprovados.length ? `<ul class="lista-no-ar">${aprovados.map(c => {
    const { dias, nivel } = idade(c.publicado);
    const quando = nivel === 'nunca' ? 'nunca publicou' :
      dias <= 1 ? 'lista de hoje' : `há ${dias} dias`;
    return `<li class="${nivel}"><a href="${esc(c.url || base + '/' + c.slug)}">${esc((c.dados || {}).nome || c.slug)}</a>
      <span>${esc(quando)}</span></li>`;
  }).join('')}</ul>` : '<p class="vazio">Nenhum centro no ar.</p>'}
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
main{max-width:760px;margin:0 auto;padding:0 0 48px;background:var(--papel);
  min-height:100vh}
@media(min-width:800px){main{margin:24px auto;min-height:0;border:2px solid var(--tinta)}}

/* --- cabeçalho do centro --- */
.topo-c{padding:22px 20px 18px;border-bottom:6px solid var(--tinta)}
.topo-c .tipo{margin:0 0 6px;font:700 12px/1 var(--fonte);text-transform:uppercase;
  letter-spacing:.18em;color:var(--texto-2)}
.topo-c h1{margin:0;font:400 clamp(30px,8vw,52px)/0.94 var(--preta);letter-spacing:-.025em;
  text-wrap:balance}
.horas{display:flex;align-items:center;gap:9px;margin:12px 0 0;
  font:800 clamp(15px,4vw,20px)/1.1 var(--fonte);text-transform:uppercase}
.horas svg{width:24px;height:24px;flex:none}

/* --- a idade da lista --- */
.idade{margin:0;padding:14px 20px;font:600 15px/1.45 var(--fonte)}
.idade.a-envelhecer{background:var(--atencao);color:var(--tinta)}
.idade.velha,.idade.nunca{background:var(--proibido);color:#fff}

/* --- listas de marcas --- */
section{padding:20px}
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
.pausa{display:flex;align-items:center;gap:18px;padding:26px 20px}
.pausa svg{width:clamp(64px,18vw,110px);height:clamp(64px,18vw,110px);flex:none}
.pausa h2{margin:0;display:block;font-size:clamp(24px,6.5vw,38px);line-height:.98}
.pausa p{margin:8px 0 0;font:500 clamp(15px,4vw,18px)/1.35 var(--fonte);color:var(--texto-2)}

/* --- contacto --- */
.contacto{border-top:6px solid var(--tinta)}
.contacto .lin{display:flex;align-items:center;gap:11px;margin:0 0 10px}
.contacto .lin a{display:flex;align-items:center;gap:11px;text-decoration:none}
.contacto .lin svg{width:22px;height:22px;flex:none}
.contacto .lin span{font:700 clamp(17px,4.6vw,22px)/1.25 var(--fonte)}
.contacto .lin a span{text-decoration:underline;text-underline-offset:3px}
.carimbo{margin:16px 0 0;font:600 13px/1.2 var(--mono);color:var(--texto-2)}

/* --- partilhar --- */
.partilhar{border-top:6px solid var(--tinta)}
.btn-wa{background:#25D366;border-color:#0f7a3a;color:var(--tinta);font-weight:800;
  display:block;text-align:center;margin-top:0}
.nota-partilha{margin:10px 0 0;font:500 13px/1.45 var(--fonte);color:var(--texto-2)}

/* --- pé --- */
.pe{padding:20px;border-top:2px solid var(--tinta);
  font:500 13px/1.6 var(--fonte);color:var(--texto-2)}
.pe p{margin:0 0 6px}
.pe .creditos{color:var(--texto-3)}

/* --- as duas portas --- */
.portas,.lista-centros{padding:24px 20px}
.duas-portas{display:grid;gap:14px;margin:8px 0 28px}
@media(min-width:640px){.duas-portas{grid-template-columns:1fr 1fr;gap:18px}}
.porta{display:flex;flex-direction:column;gap:8px;padding:22px 20px;
  border:3px solid var(--tinta);text-decoration:none;background:var(--papel)}
.porta:hover{background:var(--claro)}
.porta svg{width:44px;height:44px}
.porta-t{font:400 clamp(22px,6vw,30px)/1 var(--preta);letter-spacing:-.02em}
.porta-d{font:500 14.5px/1.5 var(--fonte);color:var(--texto-2)}

/* --- lista de centros --- */
.busca{margin:0 0 18px}
input[type=search]{width:100%;padding:13px 14px;font:500 16px/1.3 var(--fonte);
  color:var(--tinta);background:var(--papel);border:2px solid var(--tinta);
  border-radius:0;-webkit-appearance:none}
.centros{list-style:none;margin:0;padding:0}
.c-item{border-top:2px solid var(--tinta)}
.c-item:last-child{border-bottom:2px solid var(--tinta)}
.c-item a{display:grid;gap:4px;padding:15px 0;text-decoration:none}
.c-nome{font:800 17px/1.25 var(--fonte)}
.c-morada{font:500 13.5px/1.4 var(--fonte);color:var(--texto-2)}
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
.sem-resultado{margin:18px 0;font:500 15px/1.5 var(--fonte);color:var(--texto-2)}
.erro-form{margin:0 0 16px;padding:12px 14px;background:var(--proibido);color:#fff;
  font:600 14px/1.45 var(--fonte)}
.btn.largo{width:100%;text-align:center}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;
  overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}

/* --- inicial, admin, avisos --- */
.inicial,.admin,.aviso-pagina{padding:24px 20px}
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
.lista-no-ar{list-style:none;margin:0;padding:0}
.lista-no-ar li{display:flex;justify-content:space-between;gap:12px;
  padding:11px 0;border-bottom:1px solid var(--tenue);font:600 15px/1.3 var(--fonte)}
.lista-no-ar span{font:500 13px/1.3 var(--mono);color:var(--texto-2);flex:none}
.lista-no-ar li.velha span,.lista-no-ar li.nunca span{color:var(--proibido);font-weight:700}
`;

module.exports = { molde, paginaCentro, paginaPendente, paginaNaoExiste,
                   paginaInicial, paginaCentros, paginaCentroEntrada, paginaNovo,
                   paginaCodigo, paginaAdmin, idade, esc, CSS };
