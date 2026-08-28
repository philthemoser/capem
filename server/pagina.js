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

const esc = s => String(s == null ? '' : s)
  .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
 * A página pública de um centro — o destino do QR
 * -------------------------------------------------------------------------*/
function paginaCentro(centro, base) {
  const d = centro.dados || {};
  const precisa = (d.precisa || []).map(item);
  const nao = (d.naoTraga || []).map(item);
  const tel = (d.contato || '').trim();
  const telLink = tel.replace(/[^\d+]/g, '');
  const url = `${base}/${centro.slug}`;

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
      ? `<ul class="marcas">${precisa.map(i => `<li>${svgIcone(i.id)}<span>${esc(i.rotulo)}</span></li>`).join('')}</ul>`
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

  <footer class="pe">
    <p><b>Leve isto consigo.</b> <a href="${esc(url)}">${esc(url.replace(/^https?:\/\//, ''))}</a></p>
    <p class="creditos">CAPEM · ferramenta livre para centros de apoio ·
      <a href="https://github.com/philthemoser/capem">o código é aberto</a></p>
  </footer>
</main>`;

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
function paginaInicial({ contagem, base }) {
  return molde({
    titulo: 'CAPEM — página de necessidades',
    descricao: 'Cada centro de apoio tem uma página com a lista do dia. Atualiza-se pelo telemóvel.',
    corpo: `
<main class="inicial">
  <header>
    <p class="tipo">CAPEM · ferramenta livre</p>
    <h1>A lista de hoje, num endereço que não envelhece</h1>
    <p class="entrada">Um cartaz impresso diz o que o centro precisava no dia em que foi
      impresso. Esta página diz o que precisa hoje — e o QR de todas as peças do kit
      aponta para ela. O coordenador atualiza pelo telemóvel, com um código; quem
      abre o link vê a versão de hoje.</p>
  </header>

  <section class="passos-i">
    <ol>
      <li><b>Peça a página do seu centro.</b> Preencha o formulário aqui em baixo.
        Recebe já um código — guarde-o, é o que lhe deixa publicar.</li>
      <li><b>Gere o material impresso.</b> O <a href="/kit">kit</a> faz quinze peças a
        partir dos mesmos dados: cartaz de porta, etiquetas de caixa, panfletos, crachás.</li>
      <li><b>Publique todos os dias.</b> No fim do kit há um botão para enviar a lista
        do dia para esta página. O papel na porta continua a valer porque o QR aponta
        para aqui.</li>
    </ol>
  </section>

  <section class="pedir">
    <h2>Pedir a página de um centro</h2>
    <p class="dica">Cada pedido é verificado à mão antes de a página ir para o ar —
      um endereço errado numa emergência manda pessoas para o sítio errado.</p>
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

      <button type="submit" class="btn btn-primario">Pedir a página</button>
    </form>
  </section>

  <footer class="pe">
    <p>${contagem.aprovado} ${contagem.aprovado === 1 ? 'centro' : 'centros'} no ar.</p>
    <p class="creditos">Nada aqui recolhe dados de quem é atendido — só a morada,
      o horário e o telefone de um edifício.
      <a href="https://github.com/philthemoser/capem">O código é aberto.</a></p>
  </footer>
</main>`
  });
}

function paginaCodigo({ slug, codigo, base }) {
  const url = `${base}/${slug}`;
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
function paginaAdmin({ pendentes, aprovados, token, contagem, base }) {
  const linha = c => {
    const d = c.dados || {};
    return `<article class="pedido">
      <h3>${esc(d.nome || c.slug)}</h3>
      <p class="meta">${esc(d.tipo || '')} · pedido em ${dataCurta(c.criado)}</p>
      <p>${svgIcone('pino')} ${esc(d.endereco || '—')}</p>
      <p>${svgIcone('telefone')} ${esc(d.contato || '—')}</p>
      <p class="meta">/${esc(c.slug)}</p>
      <form method="POST" action="/admin/decidir">
        <input type="hidden" name="t" value="${esc(token)}">
        <input type="hidden" name="slug" value="${esc(c.slug)}">
        <button class="btn btn-primario" name="decisao" value="aprovado">Aprovar</button>
        <button class="btn btn-recusar" name="decisao" value="recusado">Recusar</button>
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

  ${pendentes.length
    ? `<div class="pedidos">${pendentes.map(linha).join('')}</div>`
    : '<p class="vazio">Nada à espera.</p>'}

  <h2>No ar</h2>
  ${aprovados.length ? `<ul class="lista-no-ar">${aprovados.map(c => {
    const { dias, nivel } = idade(c.publicado);
    const quando = nivel === 'nunca' ? 'nunca publicou' :
      dias <= 1 ? 'lista de hoje' : `há ${dias} dias`;
    return `<li class="${nivel}"><a href="${esc(base)}/${esc(c.slug)}">${esc((c.dados || {}).nome || c.slug)}</a>
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

/* --- pé --- */
.pe{padding:20px;border-top:2px solid var(--tinta);
  font:500 13px/1.6 var(--fonte);color:var(--texto-2)}
.pe p{margin:0 0 6px}
.pe .creditos{color:var(--texto-3)}

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
.pedido form{display:flex;gap:10px;margin-top:8px}
.pedido .btn{flex:1;margin-top:6px;text-align:center}
.lista-no-ar{list-style:none;margin:0;padding:0}
.lista-no-ar li{display:flex;justify-content:space-between;gap:12px;
  padding:11px 0;border-bottom:1px solid var(--tenue);font:600 15px/1.3 var(--fonte)}
.lista-no-ar span{font:500 13px/1.3 var(--mono);color:var(--texto-2);flex:none}
.lista-no-ar li.velha span,.lista-no-ar li.nunca span{color:var(--proibido);font-weight:700}
`;

module.exports = { molde, paginaCentro, paginaPendente, paginaNaoExiste,
                   paginaInicial, paginaCodigo, paginaAdmin, idade, esc, CSS };
