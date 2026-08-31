#!/usr/bin/env node
/* ============================================================================
 * CAPEM — servidor das páginas de necessidades
 *
 * Um ficheiro, sem dependências, só módulos que vêm dentro do Node. Corre num
 * VPS de quatro euros, no Fly, no Railway ou no seu portátil, e não usa nada
 * que pertença a uma nuvem em particular — a decisão de onde alojar isto pode
 * ser tomada depois sem reescrever nada.
 *
 *   node server/server.js
 *
 * Variáveis:
 *   CAPEM_ADMIN   obrigatória — o segredo que abre /admin
 *   CAPEM_BASE    o endereço público (ex.: https://capem.org). Serve para os
 *                 QR codes e os links; sem ele deduz-se de cada pedido
 *   CAPEM_DOMINIO o domínio de topo (ex.: capem.org). Só é preciso para que
 *                 centro.capem.org funcione — ver "Subdomínios" mais abaixo
 *   CAPEM_ESTILO  'caminho' (por omissão) ou 'subdominio': qual das duas
 *                 formas é a canónica, a que vai impressa e para o QR
 *   PORT          por omissão 8080
 *   CAPEM_DB      caminho do ficheiro SQLite
 *
 * Avisos (todos opcionais — ver server/avisos.js):
 *   CAPEM_TELEGRAM_TOKEN + CAPEM_TELEGRAM_CHAT
 *   CAPEM_NTFY          um endereço ntfy.sh
 *   CAPEM_WEBHOOK       um POST com JSON, para tudo o resto
 *   CAPEM_PAIS          indicativo do país para os links wa.me (55)
 *
 * O QUE ESTE SERVIDOR NÃO GUARDA: nada sobre quem é atendido. Só a morada, o
 * horário e o telefone de um edifício, que é informação que o centro já quer
 * ver colada na porta. Isso mantém a posição de proteção de dados simples,
 * ao contrário do protótipo — ver docs/data-protection.md.
 * ==========================================================================*/
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const db = require('./db');
const P = require('./pagina');
const A = require('./avisos');
const B = require('./busca');

const PORTA = Number(process.env.PORT || 8080);
const ADMIN = process.env.CAPEM_ADMIN || '';
const BASE = (process.env.CAPEM_BASE || `http://localhost:${PORTA}`).replace(/\/+$/, '');
const FICHEIRO_DB = process.env.CAPEM_DB || path.join(__dirname, 'capem.db');

const RAIZ = path.join(__dirname, '..');

/* Como o armazenamento deriva as colunas de procura. O `db.js` guarda e lê; as
   regras de o que conta como uma correspondência estão no `busca.js`, e é aqui
   que as duas metades se ligam — uma vez, no arranque. */
db.definirDerivacao(d => ({
  busca: B.textoDeBusca(d),
  nome_ord: B.nomeDeOrdem(d),
  pausado: !!(d && d.pausado)
}));

/* Falhar ao arrancar é melhor do que servir uma fila de aprovação aberta ao
   mundo. Um servidor que arranca sempre é um servidor que um dia arranca mal. */
if (!ADMIN || ADMIN.length < 16) {
  console.error('CAPEM_ADMIN em falta ou curta demais (mínimo 16 caracteres).');
  console.error('Ex.:  CAPEM_ADMIN=$(node -e "console.log(require(\'crypto\').randomBytes(24).toString(\'hex\'))") node server/server.js');
  process.exit(1);
}

/* ---------------------------------------------------------------------------
 * Utilitários
 * -------------------------------------------------------------------------*/
/* O tamanho máximo de uma quantidade, vindo do catálogo para não haver dois
   números diferentes a dizer a mesma coisa. Era 8, o que cortava "20 caixas"
   — que é literalmente o exemplo que o texto de ajuda dá. */
const { MAX_Q } = require('./compartilhado');

const LIMITES = { nome: 80, tipo: 60, endereco: 140, horario: 80, contato: 40, link: 140, motivoPausa: 140 };

const texto = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);

/**
 * Um slug legível, porque vai ser lido em voz alta ao telefone.
 *
 * `recurso` é o que sai quando não resta nada de utilizável. Ao criar um
 * centro isso é aceitável — "centro-2" é um endereço como outro qualquer. Ao
 * renomear NÃO é: um campo vazio ou um punhado de pontuação passaria a
 * renomear um centro para "centro" sem ninguém ter pedido nada. Quem renomeia
 * passa '' e trata o vazio como "não mexer".
 */
function fazerSlug(nome, recurso = 'centro') {
  return String(nome || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 48) || recurso;
}

function slugLivre(nome) {
  const base = fazerSlug(nome);
  if (!db.existe(base)) return base;
  for (let i = 2; i < 200; i++) if (!db.existe(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${Date.now().toString(36)}`;
}

/* Trava simples por IP. Não é uma defesa a sério — é o suficiente para que um
   script aborrecido não encha a fila de aprovação enquanto ninguém olha. */
const tentativas = new Map();
function demasiado(ip, limite, janela) {
  const agora = Date.now();
  const t = (tentativas.get(ip) || []).filter(x => agora - x < janela);
  t.push(agora);
  tentativas.set(ip, t);
  if (tentativas.size > 5000) tentativas.clear();
  return t.length > limite;
}

function corpo(req, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let n = 0; const pedacos = [];
    req.on('data', c => {
      n += c.length;
      if (n > maxBytes) { reject(new Error('corpo grande demais')); req.destroy(); return; }
      pedacos.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(pedacos).toString('utf8')));
    req.on('error', reject);
  });
}

const responder = (res, cod, corpoHtml, tipo = 'text/html; charset=utf-8', extra = {}) => {
  res.writeHead(cod, {
    'Content-Type': tipo,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...extra
  });
  res.end(corpoHtml);
};

const json = (res, cod, obj) =>
  responder(res, cod, JSON.stringify(obj), 'application/json; charset=utf-8',
    { 'Access-Control-Allow-Origin': '*' });

const paraOndeIr = (res, url) => { res.writeHead(303, { Location: url }); res.end(); };

/* 301 e não 302: um QR fotografado e reenviado no WhatsApp fica a apontar
   para a forma não canónica durante meses. Vale a pena que os browsers e os
   motores de busca aprendam qual é a boa. */
const redireccionar = (res, url, cod = 301) => {
  res.writeHead(cod, { Location: url, 'Cache-Control': 'public, max-age=3600' });
  res.end();
};

const ipDe = req => (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  || req.socket.remoteAddress || '?';

/* ---------------------------------------------------------------------------
 * SUBDOMÍNIOS
 *
 * As duas formas funcionam sempre:
 *
 *     capem.org/canoas-sao-sebastiao       (caminho)
 *     canoas-sao-sebastiao.capem.org       (subdomínio)
 *
 * `CAPEM_ESTILO` decide qual delas é a canónica — a que sai impressa, a que
 * entra no QR, e para a qual a outra redireciona. A outra continua a
 * responder, porque um endereço já impresso não se corrige.
 *
 * Duas coisas a saber antes de escolher `subdominio`:
 *
 *   1. Precisa de DNS wildcard (*.capem.org) e de um certificado wildcard, o
 *      que obriga a validação DNS-01 e a guardar credenciais do fornecedor de
 *      DNS no servidor. Se esse certificado falhar a renovação, caem todos os
 *      centros ao mesmo tempo. Com caminhos há um certificado só, e o modo de
 *      falhar é o mais conhecido que existe.
 *   2. Um endereço mal escrito com subdomínio dá erro de DNS no browser —
 *      "não foi possível encontrar o servidor" — e acabou. Com caminho, o erro
 *      chega aqui, e podemos responder com a página certa. Numa emergência,
 *      um engano que nós vemos vale mais do que um engano que não vemos.
 *
 * Esta ferramenta foi desenhada à volta de gente a ditar coisas ao telefone
 * num ginásio com barulho. Por isso o padrão é o caminho.
 * -------------------------------------------------------------------------*/
const DOMINIO = (process.env.CAPEM_DOMINIO || '').toLowerCase().replace(/^\.+|\.+$/g, '');
const ESTILO = process.env.CAPEM_ESTILO === 'subdominio' ? 'subdominio' : 'caminho';

/* Nomes que nunca podem ser um centro, porque são infra-estrutura ou porque
   um centro chamado "admin" seria um convite. */
const RESERVADOS = new Set(['www', 'admin', 'api', 'kit', 'mail', 'smtp', 'imap',
  'ftp', 'ns', 'ns1', 'ns2', 'mx', 'cdn', 'static', 'assets', 'app', 'test',
  'dev', 'staging', 'localhost']);

function anfitriao(req) {
  return (req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(',')[0].trim().toLowerCase().replace(/:\d+$/, '');
}

/** O slug se o pedido veio por subdomínio; null se veio pelo domínio de topo. */
function slugDoAnfitriao(req) {
  if (!DOMINIO) return null;
  const h = anfitriao(req);
  if (!h.endsWith('.' + DOMINIO)) return null;
  const rotulo = h.slice(0, -(DOMINIO.length + 1));
  if (!/^[a-z0-9-]{1,60}$/.test(rotulo) || rotulo.includes('.')) return null;
  return RESERVADOS.has(rotulo) ? null : rotulo;
}

/* O endereço público.
 *
 * Se CAPEM_BASE estiver definido, manda ele. Se não, deduz-se do pedido —
 * porque a alternativa era servir "http://localhost:8080" dentro de páginas
 * reais no dia em que alguém se esquecesse da variável, e um endereço errado
 * impresso num QR não se corrige depois de estar colado a cem portas. */
function baseDe(req) {
  const proto = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || 'http';
  const porta = (req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(',')[0].trim().match(/:\d+$/);
  if (process.env.CAPEM_BASE) return BASE;
  /* Num pedido que chegou por subdomínio, a "base" é sempre o domínio de topo:
     é lá que estão a entrada, o kit e a fila. */
  const s = slugDoAnfitriao(req);
  const h = s ? DOMINIO + (porta ? porta[0] : '') : anfitriao(req) + (porta ? porta[0] : '');
  return /^[a-z0-9.:\[\]-]+$/i.test(h) && h ? `${proto}://${h}` : BASE;
}

/** O endereço canónico de um centro, na forma escolhida. */
function urlDoCentro(slug, base) {
  if (ESTILO !== 'subdominio' || !DOMINIO) return `${base}/${slug}`;
  const u = new URL(base);
  return `${u.protocol}//${slug}.${u.host}`;
}

/** Só os campos que conhecemos, cortados ao tamanho, nada mais. */
function limparDados(d) {
  const out = {};
  Object.keys(LIMITES).forEach(k => { if (d[k] != null) out[k] = texto(d[k], LIMITES[k]); });
  out.pausado = !!d.pausado;
  /* A quantidade é curta de propósito — cabe "200", "20 caixas" e "muitas",
     não cabe um parágrafo. Ver o comentário em field/src/catalogo.js. */
  const lista = v => (Array.isArray(v) ? v : []).slice(0, 24).map(x => {
    if (typeof x === 'string') return texto(x, 40);
    if (!x) return '';
    const q = texto(x.q, MAX_Q);
    if (x.id) return q ? { id: texto(x.id, 40), q } : texto(x.id, 40);
    return { texto: texto(x.texto, 40),
             marca: x.marca ? texto(x.marca, 40) : undefined,
             q: q || undefined };
  }).filter(Boolean);
  out.precisa = lista(d.precisa);
  out.naoTraga = lista(d.naoTraga);
  return out;
}

/* ---------------------------------------------------------------------------
 * Rotas
 * -------------------------------------------------------------------------*/
async function encaminhar(req, res) {
  const url = new URL(req.url, 'http://interno');
  const caminho = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/';
  const ip = ipDe(req);
  const base = baseDe(req);
  const slugAnfitriao = slugDoAnfitriao(req);

  if (req.method === 'OPTIONS') {
    return responder(res, 204, '', 'text/plain', {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
  }

  /* --- um pedido que chegou por subdomínio ---
     Serve o centro na raiz. Se a forma canónica for o caminho, redireciona
     em vez de servir duas cópias do mesmo conteúdo em endereços diferentes. */
  if (slugAnfitriao && req.method === 'GET' && caminho === '/') {
    if (ESTILO !== 'subdominio') {
      return redireccionar(res, `${base}/${slugAnfitriao}${url.search}`, 301);
    }
    return servirCentro(req, res, slugAnfitriao, url, base);
  }
  if (slugAnfitriao && caminho !== '/') {
    /* Tudo o resto vive no domínio de topo: o kit, a fila, o formulário. */
    return redireccionar(res, `${base}${caminho}${url.search}`, 301);
  }

  /* --- estáticos --- */
  if (caminho === '/fontes.css') {
    return responder(res, 200, fs.readFileSync(path.join(RAIZ, 'field', 'src', 'fonts.css')),
      'text/css; charset=utf-8', { 'Cache-Control': 'public, max-age=31536000, immutable' });
  }
  if (caminho === '/kit') {
    return responder(res, 200, fs.readFileSync(path.join(RAIZ, 'field', 'kit.html')),
      'text/html; charset=utf-8', { 'Cache-Control': 'public, max-age=300' });
  }

  /* --- entrada --- */
  if (caminho === '/' && req.method === 'GET') {
    return responder(res, 200, P.paginaInicial({ contagem: db.contar(), base }));
  }
  if (caminho === '/centros' && req.method === 'GET') {
    const consulta = B.lerConsulta(url.searchParams);
    const DIA = 86400000;
    const r = db.procurar({
      termos: B.termos(consulta.q), ordem: consulta.ordem,
      aceitando: consulta.aceitando, recentes: consulta.recentes,
      pagina: consulta.pagina, porPagina: consulta.porPagina,
      /* As fronteiras dos escalões, calculadas agora: até um dia é "de hoje",
         até sete ainda vale a pena mostrar sem alarme. */
      fresca: Date.now() - DIA, envelhecida: Date.now() - 7 * DIA
    });
    const centros = r.linhas.map(x => ({ ...x, url: urlDoCentro(x.slug, base) }));
    return responder(res, 200,
      P.paginaCentros({ centros, base, consulta, total: r.total, paginas: r.paginas }),
      'text/html; charset=utf-8', { 'Cache-Control': 'public, max-age=60' });
  }
  if (caminho === '/centro' && req.method === 'GET') {
    return responder(res, 200, P.paginaCentroEntrada({ base }));
  }
  if (caminho === '/novo' && req.method === 'GET') {
    return responder(res, 200, P.paginaNovo({}));
  }

  /* --- pedir uma página --- */
  if (caminho === '/pedir' && req.method === 'POST') {
    if (demasiado(ip, 5, 3600e3)) return responder(res, 429, P.molde({
      titulo: 'Demasiados pedidos',
      corpo: '<main class="aviso-pagina"><h1>Demasiados pedidos deste aparelho</h1><p>Tente daqui a uma hora.</p></main>'
    }));
    const campos = new URLSearchParams(await corpo(req));
    const dados = limparDados({
      nome: campos.get('nome'), tipo: campos.get('tipo'), endereco: campos.get('endereco'),
      horario: campos.get('horario'), contato: campos.get('contato'),
      precisa: [], naoTraga: require('./compartilhado').RECUSAS
    });
    if (!dados.nome || !dados.endereco || !dados.contato) {
      /* Devolve o formulário com o aviso, não uma página de erro sem saída. */
      return responder(res, 400, P.paginaNovo({
        erro: 'O nome, o endereço e o telefone são obrigatórios.'
      }));
    }
    const slug = slugLivre(dados.nome);
    const codigo = db.criar(slug, dados);
    console.log(`[pedido] ${slug} — ${dados.nome}`);
    /* Fire-and-forget de propósito: um bot em baixo não pode impedir um centro
       de pedir a sua página. */
    A.avisar({
      tipo: 'pedido',
      titulo: 'Novo pedido de centro',
      corpo: [dados.nome, dados.tipo, dados.endereco, dados.contato, '/' + slug]
        .filter(Boolean).join('\n'),
      url: `${base}/admin?t=${encodeURIComponent(ADMIN)}`,
      slug
    });
    return responder(res, 200, P.paginaCodigo({ slug, codigo, base,
      url: urlDoCentro(slug, base), nome: dados.nome }));
  }

  /* --- publicar (o botão do kit) --- */
  /* --- a actualização diária ---
   *
   * Um GET mostra o formulário de entrada; um POST com código certo mostra a
   * lista; um POST com `publicar=1` publica e volta a mostrar a lista.
   *
   * O código anda no formulário como campo escondido e NÃO numa sessão. Sem
   * cookie não há nada para roubar de um telemóvel emprestado, nada para expirar
   * a meio de uma manhã, e fechar o separador é sair. A troca é que o código
   * viaja em cada envio — por HTTPS, para o mesmo servidor a que ele já pertence.
   */
  if (caminho === '/atualizar' && req.method === 'GET') {
    return responder(res, 200, P.paginaAtualizarEntrada({ slug: url.searchParams.get('c') || '' }));
  }
  if (caminho === '/atualizar' && req.method === 'POST') {
    /* Mais apertado do que publicar: aqui é onde alguém tentaria adivinhar um
       código à força. Vinte por hora chega para um coordenador que se engana
       algumas vezes e não chega para mais nada. */
    if (demasiado(ip, 20, 3600e3)) {
      return responder(res, 429, P.paginaAtualizarEntrada({
        erro: 'Demasiadas tentativas deste aparelho. Espere uma hora.' }));
    }
    const campos = new URLSearchParams(await corpo(req));
    const pedido = texto(campos.get('slug'), 60).toLowerCase().replace(/^.*\//, '');
    const codigo = texto(campos.get('codigo'), 20);
    const real = db.resolver(pedido);
    const centro = real ? db.ler(real) : null;

    /* Uma mensagem só para "não existe" e para "código errado". Os centros são
       públicos, por isso isto não esconde grande coisa — mas também não há
       vantagem nenhuma em confirmar a alguém que adivinhou metade. */
    if (!centro || !db.codigoConfere(codigo, centro.codigo_hash)) {
      return responder(res, 403, P.paginaAtualizarEntrada({
        slug: pedido,
        erro: 'Endereço ou código errados. Confira as letras — no código não há O, nem I, nem S.'
      }));
    }

    let feito = false, erro = '';
    if (campos.get('publicar') === '1') {
      const precisa = campos.getAll('precisa').slice(0, 24).map(id => {
        const q = texto(campos.get('q-' + id), MAX_Q);
        return q ? { id: texto(id, 40), q } : texto(id, 40);
      });
      /* Os itens escritos à mão, um por linha, com "| quantidade" opcional. É a
         forma mais simples que funciona sem JavaScript, e a que se percebe sem
         instruções depois do exemplo que está ao lado da caixa. */
      /* Dividir ANTES de limpar. O `texto()` tira os caracteres de controlo — e
         a mudança de linha é um deles, por isso limpar primeiro colava as doze
         linhas todas num item só. Foi assim que este código nasceu e é o género
         de erro que passa despercebido até alguém escrever a segunda linha. */
      const livres = String(campos.get('livres') || '').slice(0, 600)
        .split(/[\r\n]+/)
        .map(l => texto(l, 60)).filter(Boolean).slice(0, 12)
        .map(l => {
          const [t, q] = l.split('|').map(x => (x || '').trim());
          return q ? { texto: t, q: q.slice(0, MAX_Q) } : { texto: t };
        }).filter(x => x.texto);

      const dados = {
        ...centro.dados,
        precisa: [...precisa, ...livres],
        naoTraga: campos.getAll('naoTraga').slice(0, 12).map(x => texto(x, 40)),
        horario: texto(campos.get('horario'), LIMITES.horario) || centro.dados.horario,
        pausado: campos.get('pausado') === '1',
        motivoPausa: texto(campos.get('motivoPausa'), LIMITES.motivoPausa)
      };
      const limpo = limparDados(dados);
      db.publicar(centro.slug, { ...centro.dados, ...limpo });
      console.log(`[publicado] ${centro.slug} — ${limpo.precisa.length} itens${limpo.pausado ? ' (pausado)' : ''} (via /atualizar)`);
      feito = true;
      centro.dados = { ...centro.dados, ...limpo };
      centro.publicado = Date.now();
      if (!limpo.precisa.length && !limpo.pausado) {
        erro = 'Publicou uma lista vazia e o centro não está marcado como '
             + 'fechado. Quem abrir a página não fica a saber o que trazer.';
      }
    }

    /* O código volta para o formulário para o envio seguinte não obrigar a
       escrevê-lo outra vez — é a mesma sessão de trabalho, e uma manhã tem mais
       do que uma correcção. */
    centro.codigoDado = codigo;
    return responder(res, feito ? 200 : 200,
      P.paginaAtualizar({ centro, url: urlDoCentro(centro.slug, base), feito, erro }));
  }

  /* --- ler os próprios dados com o código ---
   *
   * O código servia só para escrever. Isso obrigava o coordenador a preencher o
   * formulário inteiro outra vez sempre que abrisse o kit noutro telemóvel, ou
   * depois de limpar o browser — e a maior parte do que ele escrevia era
   * deitada fora, porque publicar não mexe no nome, na morada nem no telefone.
   * Escrever quinze campos para que doze sejam ignorados não é só trabalho a
   * mais: dá a entender que se pode mudar o que foi verificado à mão.
   *
   * O que volta daqui já é todo público — está na página do centro, que
   * qualquer pessoa abre sem código nenhum. O código continua a ser o que
   * autoriza a ESCRITA; aqui só evita transformar isto numa lista de todos os
   * centros de uma vez.
   */
  if (caminho === '/api/carregar' && req.method === 'POST') {
    if (demasiado(ip, 60, 3600e3)) return json(res, 429, { erro: 'demasiados pedidos' });
    let p;
    try { p = JSON.parse(await corpo(req)); } catch (e) { return json(res, 400, { erro: 'json inválido' }); }
    const real = db.resolver(texto(p.slug, 60));
    const centro = real ? db.ler(real) : null;
    if (!centro) return json(res, 404, { erro: 'centro não encontrado' });
    if (!db.codigoConfere(p.codigo || '', centro.codigo_hash)) {
      return json(res, 403, { erro: 'código errado' });
    }
    const d = centro.dados || {};
    return json(res, 200, {
      ok: true, slug: centro.slug, url: urlDoCentro(centro.slug, base),
      estado: centro.estado, publicado: centro.publicado || null,
      dados: {
        nome: d.nome || '', tipo: d.tipo || '', endereco: d.endereco || '',
        horario: d.horario || '', contato: d.contato || '', link: d.link || '',
        precisa: d.precisa || [], naoTraga: d.naoTraga || [],
        pausado: !!d.pausado, motivoPausa: d.motivoPausa || ''
      }
    });
  }

  if (caminho === '/api/publicar' && req.method === 'POST') {
    if (demasiado(ip, 120, 3600e3)) return json(res, 429, { erro: 'demasiados envios' });
    let p;
    try { p = JSON.parse(await corpo(req)); } catch (e) { return json(res, 400, { erro: 'json inválido' }); }
    const real = db.resolver(texto(p.slug, 60));
    const centro = real ? db.ler(real) : null;
    if (!centro) return json(res, 404, { erro: 'centro não encontrado' });
    if (!db.codigoConfere(p.codigo || '', centro.codigo_hash)) {
      return json(res, 403, { erro: 'código errado' });
    }
    /* O nome, o endereço e o telefone foram verificados à mão; a lista do dia
       não. Por isso a publicação muda a lista e não os dados verificados —
       senão a aprovação passava a não valer nada depois do primeiro envio. */
    const antes = centro.dados;
    const novo = limparDados(p.dados || {});
    const dados = {
      ...antes,
      precisa: novo.precisa, naoTraga: novo.naoTraga,
      horario: novo.horario || antes.horario,
      link: novo.link || antes.link,
      pausado: novo.pausado, motivoPausa: novo.motivoPausa || ''
    };
    db.publicar(centro.slug, dados);
    console.log(`[publicado] ${centro.slug} — ${dados.precisa.length} itens${dados.pausado ? ' (pausado)' : ''}`);
    return json(res, 200, {
      ok: true, slug: centro.slug, url: urlDoCentro(centro.slug, base),
      estado: centro.estado
    });
  }

  /* --- admin --- */
  if (caminho === '/admin' && req.method === 'GET') {
    if (url.searchParams.get('t') !== ADMIN) return responder(res, 404, P.paginaNaoExiste());
    return responder(res, 200, P.paginaAdmin({
      pendentes: db.listar('pendente'),
      aprovados: db.listar('aprovado').map(c => ({ ...c, url: urlDoCentro(c.slug, base) })),
      parados: db.parados(DIAS_PARADO).map(c => ({ ...c, url: urlDoCentro(c.slug, base) })),
      erro: url.searchParams.get('erro'),
      token: ADMIN, contagem: db.contar(), base
    }), 'text/html; charset=utf-8', { 'X-Robots-Tag': 'noindex' });
  }
  /* --- emitir um código novo ---
   *
   * "Perdi o código" vai ser o pedido de ajuda mais comum que esta ferramenta
   * recebe: um papel colado à parede de um ginásio perde-se, molha-se, e quem
   * o tinha no telemóvel foi para casa. Até aqui a única resposta era uma
   * alteração à mão na base de dados.
   *
   * Vive atrás do segredo de administração e não numa página pública, e isso é
   * a decisão inteira: emitir um código é dar acesso de escrita à página de um
   * centro. A verificação de que a pessoa do outro lado é mesmo do centro é um
   * telefonema para o número que já está guardado — não é coisa que um
   * formulário faça.
   */
  if (caminho === '/admin/recodigo' && req.method === 'POST') {
    const campos = new URLSearchParams(await corpo(req));
    if (campos.get('t') !== ADMIN) return responder(res, 404, P.paginaNaoExiste());
    const slug = db.resolver(texto(campos.get('slug'), 60));
    const centro = slug ? db.ler(slug) : null;
    if (!centro) return paraOndeIr(res, '/admin?t=' + encodeURIComponent(ADMIN));

    const codigo = db.novoCodigoPara(slug);
    console.log(`[código novo] ${slug}`);
    /* Mostrado uma vez, na mesma página que mostra um código acabado de criar —
       com o mesmo botão de mandar no WhatsApp, porque o problema a seguir a
       "perdi o código" é exactamente o mesmo: fazê-lo chegar a quem está de
       turno. */
    return responder(res, 200, P.paginaCodigo({
      slug, codigo, base, url: urlDoCentro(slug, base),
      nome: (centro.dados || {}).nome, reemitido: true,
      voltar: '/admin?t=' + encodeURIComponent(ADMIN)
    }));
  }

  if (caminho === '/admin/decidir' && req.method === 'POST') {
    const campos = new URLSearchParams(await corpo(req));
    if (campos.get('t') !== ADMIN) return responder(res, 404, P.paginaNaoExiste());
    const slug = texto(campos.get('slug'), 60);
    const decisao = campos.get('decisao');
    if (!db.existe(slug) || !db.ESTADOS.includes(decisao)) {
      return paraOndeIr(res, '/admin?t=' + encodeURIComponent(ADMIN));
    }
    let alvo = slug;
    /* Encurtar o endereço na aprovação é o momento certo: é aqui que alguém
       olha para "paroquia-sao-sebastiao" e percebe que "canoas-ss" é o que
       se consegue ditar ao telefone. O endereço antigo fica a redireccionar. */
    const novo = fazerSlug(texto(campos.get('novo_slug'), 48), '');
    if (decisao === 'aprovado' && novo && novo !== slug) {
      if (RESERVADOS.has(novo) || db.existe(novo)) {
        return paraOndeIr(res, '/admin?t=' + encodeURIComponent(ADMIN) + '&erro=ocupado');
      }
      db.renomear(slug, novo);
      alvo = novo;
      console.log(`[renomeado] ${slug} → ${novo}`);
    }
    db.decidir(alvo, decisao);
    console.log(`[${decisao}] ${alvo}`);
    return paraOndeIr(res, '/admin?t=' + encodeURIComponent(ADMIN));
  }

  /* --- a página de um centro --- */
  if (req.method === 'GET' && /^\/[a-z0-9-]{1,60}$/.test(caminho)) {
    const slug = caminho.slice(1);
    if (ESTILO === 'subdominio' && DOMINIO && db.existe(slug)) {
      return redireccionar(res, urlDoCentro(slug, base) + url.search, 301);
    }
    return servirCentro(req, res, slug, url, base);
  }

  return responder(res, 404, P.paginaNaoExiste());
}

function servirCentro(req, res, slug, url, base) {
  /* Um endereço antigo continua a responder — está impresso algures — mas
     manda o browser para o actual. */
  const real = db.resolver(slug);
  if (real && real !== slug) {
    return redireccionar(res, urlDoCentro(real, base) + url.search, 301);
  }
  const centro = db.ler(slug);
  if (!centro) return responder(res, 404, P.paginaNaoExiste());
  if (centro.estado !== 'aprovado') {
    /* O coordenador pode ver a sua página antes de estar no ar, com o código.
       Sem isso teria de imprimir o QR às cegas. */
    const c = url.searchParams.get('codigo');
    if (c && db.codigoConfere(c, centro.codigo_hash)) {
      return responder(res, 200, P.paginaCentro(centro, base, urlDoCentro(slug, base)),
        'text/html; charset=utf-8', { 'X-Robots-Tag': 'noindex' });
    }
    return responder(res, 404, P.paginaPendente(centro), 'text/html; charset=utf-8',
      { 'X-Robots-Tag': 'noindex' });
  }
  return responder(res, 200, P.paginaCentro(centro, base, urlDoCentro(slug, base)),
    'text/html; charset=utf-8', { 'Cache-Control': 'public, max-age=120' });
}

/* ---------------------------------------------------------------------------
 * Arranque
 * -------------------------------------------------------------------------*/
function criarServidor() {
  return http.createServer((req, res) => {
    encaminhar(req, res).catch(e => {
      console.error('erro:', e && e.message);
      if (!res.headersSent) responder(res, 500, P.molde({
        titulo: 'Erro',
        corpo: '<main class="aviso-pagina"><h1>Alguma coisa correu mal</h1><p>Tente outra vez daqui a pouco.</p></main>'
      }));
    });
  });
}

/* ---------------------------------------------------------------------------
 * O resumo dos parados
 *
 * O modo de falhar mais provável desta ferramenta não é o servidor cair: é um
 * centro deixar de publicar e a página continuar no ar a parecer nova. A
 * própria página avisa quem a lê, mas ninguém avisa quem a devia atualizar.
 *
 * Uma vez por dia, no máximo: quantos estão parados e quem. A partir daí é um
 * toque num link wa.me na fila de aprovação.
 * -------------------------------------------------------------------------*/
const DIAS_PARADO = Number(process.env.CAPEM_DIAS_PARADO || 3);

function resumoDeParados(base) {
  const ultimo = Number(db.lerEstado('ultimo_resumo', 0));
  if (Date.now() - ultimo < 20 * 3600e3) return null;

  const lista = db.parados(DIAS_PARADO);
  db.escreverEstado('ultimo_resumo', Date.now());
  if (!lista.length) return null;

  const linhas = lista.slice(0, 20).map(c => {
    const dias = c.publicado
      ? Math.floor((Date.now() - c.publicado) / 86400000) + ' dias'
      : 'nunca publicou';
    return `· ${(c.dados || {}).nome || c.slug} — ${dias}`;
  });
  const aviso = {
    tipo: 'parados',
    titulo: `${lista.length} ${lista.length === 1 ? 'centro parado' : 'centros parados'}`,
    corpo: linhas.join('\n') + (lista.length > 20 ? `\n… e mais ${lista.length - 20}` : ''),
    url: `${base}/admin?t=${encodeURIComponent(ADMIN)}`
  };
  A.avisar(aviso);
  return aviso;
}

if (require.main === module) {
  db.abrir(FICHEIRO_DB);
  criarServidor().listen(PORTA, () => {
    console.log(`CAPEM em ${BASE}  (porta ${PORTA})`);
    console.log(`fila de aprovação: ${BASE}/admin?t=${ADMIN}`);
    const c = db.contar();
    console.log(`${c.aprovado} no ar · ${c.pendente} à espera`);
    const canais = A.canaisActivos();
    console.log(`avisos por: ${canais.join(', ')}`);
    if (canais.length === 1) {
      console.log('  (só a consola — ver server/README.md para ligar o Telegram)');
    }

    /* De seis em seis horas verifica; o próprio resumo não sai mais do que uma
       vez por dia. Assim um reinício não faz perder o dia inteiro nem manda
       três resumos numa tarde. */
    const relogio = setInterval(() => {
      try { resumoDeParados(BASE); } catch (e) { console.error('[resumo]', e && e.message); }
    }, 6 * 3600e3);
    relogio.unref();
  });
}

module.exports = { criarServidor, encaminhar, fazerSlug, limparDados, db,
                   urlDoCentro, slugDoAnfitriao, resumoDeParados, DIAS_PARADO,
                   ESTILO, DOMINIO, RESERVADOS };
