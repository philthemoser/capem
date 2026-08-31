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
    const actual = href === aqui;
    return `<a href="${esc(href)}"${actual ? ' aria-current="page"' : ''}>${esc(txt)}</a>`;
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
${aqui === false ? '' : nav(aqui, migalhas)}
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
<main class="centro faixas">
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

  <section class="contato">
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
    migalhas: [['Centros de apoio', '/centros'], [d.nome || centro.slug]],
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
    aqui: false,
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
      <span class="porta-t">Meu centro</span>
      <span class="porta-d">Publique a lista de hoje, gere o material impresso,
        ou peça a sua página se ainda não tiver.</span>
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
function paginaCentros({ centros, base, consulta, total, paginas }) {
  const c = consulta || B.lerConsulta();
  const ts = B.termos(c.q);
  const linhas = centros.map(x => {
    const d = x.dados || {};
    const i = idade(x.publicado);
    /* Se alguém procurou "cobertor", a marca do cobertor tem de ser a primeira
       que se vê — senão a lista responde sem mostrar a resposta. */
    const precisa = B.realcar((d.precisa || []).map(item), ts).slice(0, 8);
    const quando = { fresca: 'lista de hoje', 'a-envelhecer': `há ${i.dias} dias`,
      velha: `há ${i.dias} dias`, nunca: 'ainda sem lista' }[i.nivel];
    return `<li class="c-item ${i.nivel}">
      <a href="${esc(x.url || base + '/' + x.slug)}">
        <span class="c-nome">${esc(d.nome || x.slug)}</span>
        <span class="c-endereco">${esc(d.endereco || '')}</span>
        <span class="c-quando">${esc(quando)}</span>
        ${d.pausado
          ? `<span class="c-pausa">${svgIcone('fechado')} Não está recebendo agora</span>`
          : precisa.length
            ? `<span class="c-marcas">${precisa.map(y => svgIcone(y.id)).join('')}</span>`
            : ''}
      </a>
    </li>`;
  }).join('');

  const opcoes = Object.entries(B.ORDENS).map(([v, r]) =>
    `<option value="${esc(v)}"${v === c.ordem ? ' selected' : ''}>${esc(r)}</option>`).join('');

  /* Quantos resultados, e por causa de quê. Uma lista filtrada que não diz que
     está filtrada faz alguém concluir que o seu bairro não tem centro nenhum. */
  const filtrada = !!(c.q || c.aceitando || c.recentes);
  const conta = total === 1 ? '1 centro' : `${total} centros`;
  const resumo = filtrada
    ? `${conta} ${total === 1 ? 'encontrado' : 'encontrados'}${c.q ? ` para “${esc(c.q)}”` : ''}`
    : `${conta} no ar`;

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

  <form class="procura" method="get" action="/centros" role="search">
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
    filtrada ? ` · <a href="/centros">ver todos</a>` : ''}</p>

  ${centros.length
    ? `<ul class="centros">${linhas}</ul>${paginacao}`
    : total === 0 && filtrada
      ? `<p class="sem-resultado">Nenhum centro com isso. Tente uma palavra só
          — "agua" em vez de "água mineral" — ou <a href="/centros">veja todos</a>.</p>`
      : `<p class="vazio">Ainda não há centros no ar. Se você está montando um,
          <a href="/novo">peça a página do seu centro</a>.</p>`}

  <footer class="pe">
    <p><b>Não encontrou o seu centro?</b> <a href="/novo">Peça a página aqui.</a></p>
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
    <input type="hidden" name="codigo" value="${esc(centro.codigoDado || '')}">
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
    descricao: 'Peça um código novo para o seu centro.',
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
  <p class="entrada">Escreva o endereço da página do seu centro. Não precisa de
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
      placeholder="Sou a Ana, da cozinha. O papel com o código molhou-se.">
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
    <p class="ajuda">Só o nome chega — a parte depois da barra. Está no rodapé
      de todas as peças que imprimiu.</p>

    <label class="campo" for="codigo">Código</label>
    <input id="codigo" name="codigo" type="text" placeholder="ABCD-2345"
      autocomplete="off" spellcheck="false" maxlength="20" required>
    <p class="ajuda">Oito letras e números. Não há O, nem I, nem S — se parecer
      um desses, é zero, um ou cinco.</p>

    <button class="btn btn-primario largo" type="submit">Ver a minha lista</button>
  </form>

  <footer class="pe">
    <p><b>Ainda não tem página?</b> <a href="/novo">Peça uma aqui.</a></p>
    <p><b>Perdeu o código?</b> Não há como recuperá-lo — só emitir outro.
      <a href="/pedir-codigo">Peça um código novo aqui.</a></p>
    <p><b>Quer imprimir material novo?</b> <a href="/kit">O kit está aqui</a> —
      e puxa os seus dados com o mesmo código, sem escrever tudo outra vez.</p>
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
function paginaAtualizar({ centro, url, erro, feito }) {
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
    <p class="endereco">${esc(d.endereco || '')}${d.contato ? ' · ' + esc(d.contato) : ''}</p>
  </header>

  ${feito ? `<p class="feito">Publicado. A sua página já mostra esta lista.
    <a href="${esc(url)}">Ver a página</a></p>` : ''}
  ${erro ? `<p class="erro-form">${esc(erro)}</p>` : ''}
  ${faixaIdade(centro.publicado)}
  ${i.nivel === 'fresca' && !feito
    ? '<p class="idade fresca-ok">A sua lista é de hoje. Se nada mudou, não precisa fazer nada.</p>'
    : ''}

  <form method="post" action="/atualizar" class="form-atualizar">
    <input type="hidden" name="slug" value="${esc(centro.slug)}">
    <input type="hidden" name="codigo" value="${esc(centro.codigoDado || '')}">
    <input type="hidden" name="publicar" value="1">

    <section class="bloco-a">
      <h2>Estamos recebendo?</h2>
      <label class="caixa grande">
        <input type="checkbox" name="pausado" value="1"${d.pausado ? ' checked' : ''}>
        <span>Não estamos recebendo agora</span>
      </label>
      <p class="ajuda">A página passa a dizer isso em vez da lista. Um centro
        cheio que não consegue pedir para parar continua a receber.</p>
      <label class="campo" for="motivo">Porquê (opcional)</label>
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
        caixa genérica — use com conta, porque não diz nada a quem não lê
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
        transtorno. Nas enchentes de 2024, roupa chegou a 70% de tudo o que foi
        arrecadado no país.</p>
    </section>

    <section class="bloco-a">
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
      porta. O endereço continua a responder, porque há cartazes impressos.</p>
    <form method="post" action="/atualizar">
      <input type="hidden" name="slug" value="${esc(centro.slug)}">
      <input type="hidden" name="codigo" value="${esc(centro.codigoDado || '')}">
      <input type="hidden" name="encerrar" value="pedir">
      <button class="btn btn-recusar" type="submit">Encerrar o centro</button>
    </form>
  </section>

  <footer class="pe">
    <p><b>O nome, o endereço e o telefone não mudam aqui.</b> Foram conferidos
      à mão quando o centro foi aprovado. Se estiverem errados, fale com quem
      aprovou — mudá-los sem ninguém ver tirava o valor à verificação.</p>
    <p><a href="${esc(url)}">Ver a minha página</a> · <a href="/kit">Imprimir material novo</a></p>
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
    <p class="entrada">Tudo o que um ponto de arrecadação precisa. A lista de
      hoje é a que se faz todos os dias — as outras fazem-se uma vez.</p>
  </header>

  <div class="duas-portas">
    <!-- Primeiro de propósito. É o que se faz TODOS OS DIAS; o kit é o que se
         faz uma vez. A ordem da página tem de ser a ordem da vida real. -->
    <a class="porta" href="/atualizar">
      ${svgIcone('relogio')}
      <span class="porta-t">Atualizar a lista</span>
      <span class="porta-d">Trinta segundos, com o seu código. O que precisam hoje,
        o que já não precisam, e se pararam de receber. É isto que impede o papel
        colado na porta de ficar velho.</span>
    </a>
    <a class="porta" href="/kit">
      ${svgIcone('cartaz')}
      <span class="porta-t">Material impresso</span>
      <span class="porta-d">Quinze peças a partir dos mesmos dados — cartaz de porta,
        etiquetas de caixa, panfletos, crachás. Com o seu código, preenche-se
        sozinho.</span>
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
    <p class="entrada">Recebe um código na hora — é o que lhe deixa publicar a lista
      todos os dias, a partir do <a href="/kit">kit</a>. Cada pedido é verificado à
      mão antes de a página ir para o ar: um endereço errado numa emergência manda
      pessoas para o lugar errado.</p>
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
    'Com este código atualiza-se a lista do que o centro precisa hoje, em:',
    `${base}/atualizar`,
    '',
    'Guarde esta mensagem. Quem estiver de turno vai precisar dela — o código',
    'não se recupera, só se pede outro.'
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
    <p class="dica"><b>Esta é a única vez que ele aparece.</b> Guarda-se apenas
      o resumo criptográfico — nem nós o conseguimos ler outra vez. Se esta
      página se fechar antes de o mandar, emita outro na fila.</p>
  </section>

  <div class="guardar-codigo">
    ${waDirecto
      ? `<a class="btn btn-wa largo" href="${esc(waDirecto)}" target="_blank" rel="noopener">
           Mandar para ${esc(contato)}</a>
         <p class="ajuda">É o telefone que está na página do centro — o que foi
           conferido na aprovação. A mensagem leva o endereço, o código, e onde
           se atualiza${reemitido ? '' : ', e deixa o seu contato salvo no celular do centro'}.</p>`
      : `<p class="erro-form">Este centro não tem um telefone utilizável, por
           isso não há para onde mandar. Ligue-lhe de outra forma — sem o
           código, a página fica no ar e ninguém a pode atualizar.</p>`}
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
      preenche-se sozinho e os QR passam a apontar para a sua página.</p>
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

function paginaAdmin({ pendentes, aprovados, encerrados, parados, token, contagem, base, erro }) {
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
    aqui: false,
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
    </li>`;
  }).join('')}</ul>` : '<p class="vazio">Nenhum centro no ar.</p>'}

  ${encerrados && encerrados.length ? `
  <h2>Encerrados <span class="conta-n">${encerrados.length}</span></h2>
  <p class="entrada">Fecharam-se a si próprios. A página de cada um continua a
    responder e diz que fechou — há cartazes impressos com esses endereços.
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
.carimbo{margin:16px 0 0;font:600 13px/1.2 var(--mono);color:var(--texto-2)}

/* --- partilhar --- */
.partilhar{border-top:6px solid var(--tinta)}
.btn-wa{background:#25D366;border-color:#0f7a3a;color:var(--tinta);font-weight:800;
  display:block;text-align:center;margin-top:0}
.nota-partilha{margin:10px 0 0;font:500 13px/1.45 var(--fonte);color:var(--texto-2)}

/* --- pé --- */
/* Sem goteira própria: numa página com goteira somava-se à do main e dava
   40 px. As páginas em faixas devolvem-lha na regra ao pé de main.faixas. */
.pe{padding:20px 0 0;border-top:2px solid var(--tinta);
  font:500 13px/1.6 var(--fonte);color:var(--texto-2)}
.pe p{margin:0 0 6px}
.pe .creditos{color:var(--texto-3)}

/* --- as duas portas --- */
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
.centros{list-style:none;margin:0;padding:0}
.c-item{border-top:2px solid var(--tinta)}
.c-item:last-child{border-bottom:2px solid var(--tinta)}
.c-item a{display:grid;gap:4px;padding:15px 0;text-decoration:none}
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
.lista-no-ar li{display:flex;justify-content:space-between;gap:12px;
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
                   paginaEncerrado, paginaConfirmarEncerrar,
                   paginaCodigo, paginaAdmin, idade, esc, CSS };
