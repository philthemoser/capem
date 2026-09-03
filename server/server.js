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
const os = require('node:os');
const crypto = require('node:crypto');
const { URL } = require('node:url');

const db = require('./db');
const P = require('./pagina');
const A = require('./avisos');
const SAC = require('./sacola');
const B = require('./busca');

const PORTA = Number(process.env.PORT || 8080);
const ADMIN = process.env.CAPEM_ADMIN || '';
const BASE = (process.env.CAPEM_BASE || `http://localhost:${PORTA}`).replace(/\/+$/, '');
const ARQUIVO_DB = process.env.CAPEM_DB || path.join(__dirname, 'capem.db');

const RAIZ = path.join(__dirname, '..');

/* Como o armazenamento deriva as colunas de procura. O `db.js` guarda e lê; as
   regras de o que conta como uma correspondência estão no `busca.js`, e é aqui
   que as duas metades se ligam — uma vez, no arranque. */
/* O aviso do topo do site chega ao desenhador por injecção, e não por um
   require: `pagina.js` desenha páginas e não sabe onde mora o estado. */
P.definirAviso(() => db.lerAviso());
/* O endereco de contacto do projecto. Vazio ate alguem o pôr no ambiente, e
   vazio faz a pagina do "sobre" mandar as pessoas para o GitHub em vez de
   inventar um endereco que ninguem le. */
P.definirContacto(process.env.CAPEM_CONTATO || '');

/* ---------------------------------------------------------------------------
 * O que a ferramenta não sabia dizer sobre si própria.
 *
 * Quatro faltas que não partem nada e desfazem em silêncio uma funcionalidade
 * cada: sem coordenadas não há ordem por distância, sem lista publicada a
 * página está no ar sem dizer o que o centro precisa. Nada disto aparecia em
 * lado nenhum — descobria-se abrindo o site e reparando.
 * -------------------------------------------------------------------------*/
function saudeDoSite() {
  const noAr = db.listar('aprovado');
  const tem = (d, k) => {
    const v = (d || {})[k];
    return Array.isArray(v) ? v.length === 2 : !!String(v || '').trim();
  };
  return {
    total: noAr.length,
    semCoords: noAr.filter(c => !tem(c.dados, 'coords')).length,
    semPerfil: noAr.filter(c => !tem(c.dados, 'perfil')).length,
    nuncaPublicou: noAr.filter(c => !c.publicado).length,
    parados: db.parados(DIAS_PARADO).length,
    diasParado: DIAS_PARADO
  };
}

/* As mensagens de "está feito", por chave e não por texto no endereço: um
   parâmetro que vai directo para o ecrã é um XSS à espera de acontecer. */
const MENSAGENS = {
  'aviso-no-ar': 'Aviso publicado. Está no topo de todas as páginas.',
  'aviso-fora': 'Aviso retirado. As páginas estão limpas.',
  emergencia: 'Emergências atualizadas.',
  'emergencia-fora': 'Emergência apagada. Os centros continuam no ar, sem agrupamento.',
  'teste-ok': 'Aviso de teste enviado. Se não chegou, o canal está mal configurado.',
  'teste-falhou': 'O aviso de teste falhou em pelo menos um canal — veja o log do servidor.',
  'backup-falhou': 'Não deu para gerar a cópia. Veja o log do servidor.',
  encontrado: 'Centro acrescentado e no ar, sem código e sem lista. A página diz de onde vieram as informações.'
};

db.definirDerivacao(d => ({
  busca: B.textoDeBusca(d),
  nome_ord: B.nomeDeOrdem(d),
  pausado: !!(d && d.pausado),
  /* Esquecer esta linha não rebenta nada: a coluna fica vazia, o filtro por
     emergência deixa de devolver seja o que for, e tudo o resto continua a
     funcionar. Foi exactamente o que aconteceu da primeira vez. É por isso que
     há um teste que aprova um centro com emergência e vai ler a coluna — uma
     falha silenciosa numa coluna derivada não se vê de outra maneira. */
  emergencia: String((d && d.emergencia) || ''),
  /* Mesma armadilha da linha acima, e a segunda vez que este ficheiro a arma:
     esquecer isto não rebenta nada — a coluna fica a zero, o centro sem dono
     cai no escalão de quem não publica há semanas, e a lista castiga-o em
     silêncio por não usar a ferramenta. Há um teste que acrescenta um centro
     e vai ler a coluna, e não o JSON, exactamente por isso. */
  semDono: (d && d.origem) === 'encontrado'
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
const { MAX_Q, ROTULO_BR } = require('./compartilhado');

/* `link` é o destino do QR — a própria página do centro. `perfil` é outra coisa
   por completo: o Instagram ou o site do centro, para onde um visitante vai. Os
   dois nomes já se confundiram uma vez na cabeça de quem escreveu isto; ficam
   comentados para não voltarem a confundir-se. */
const LIMITES = { nome: 80, tipo: 60, endereco: 140, horario: 80, contato: 40,
                  link: 140, motivoPausa: 140, emergencia: 60, perfil: 140,
                  /* De onde vieram as informações de um centro que nunca as
                     deu. Vai para a página, à vista, com a data. */
                  fonte: 200 };

/**
 * Coordenadas coladas de um mapa.
 *
 * Aceita "-29.9177, -51.1839", com ou sem espaço, com ou sem parênteses. Tudo o
 * resto dá `undefined` — e `undefined` é o que faz o link do mapa voltar a ser
 * uma procura pelo texto da morada, que é o comportamento certo quando não se
 * sabe. Um par que não seja um par não pode virar meio par.
 */
/** Os três campos conferidos, tal como saem de qualquer um dos dois formulários. */
const camposVerificados = campos => ({
  coords: lerCoords(campos.get('coords')),
  emergencia: texto(campos.get('emergencia'), LIMITES.emergencia),
  perfil: lerPerfilBruto(campos.get('perfil'))
});

function lerCoords(v) {
  const s = String(v || '').trim();
  if (!s) return undefined;
  const m = s.match(/^\(?\s*(-?\d{1,3}(?:[.,]\d+)?)\s*[,;]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*\)?$/);
  if (!m) return undefined;
  const a = Number(m[1].replace(',', '.'));
  const b = Number(m[2].replace(',', '.'));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined;
  if (a < -90 || a > 90 || b < -180 || b > 180) return undefined;
  /* Zero-zero é o Golfo da Guiné, e é quase sempre um campo vazio que passou
     por um Number(). Mandar alguém para lá é pior do que não ter mapa. */
  if (a === 0 && b === 0) return undefined;
  return [a, b];
}

/**
 * O perfil do centro tal como se guarda: só http(s), e só o que é um URL.
 *
 * A lista de esquemas permitidos é mais curta e mais segura do que a dos
 * proibidos — um `javascript:` guardado à mão na base de dados seria um XSS a
 * um clique de distância da página pública de um centro.
 */
function lerPerfilBruto(v) {
  const s = texto(v, LIMITES.perfil);
  if (!s) return '';
  let u;
  try { u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch (e) { return ''; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
  if (!u.hostname.includes('.')) return '';
  return u.href.slice(0, LIMITES.perfil);
}

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
/* A conta é por IP *e por porta*. Era só por IP, e isso queria dizer que as
   rotas partilhavam o mesmo balde: cinco tentativas em /atualizar gastavam o
   orçamento de /pedir, e um centro que tinha acabado de se enganar no código
   deixava de conseguir pedir a sua página. Descoberto por um teste novo que
   levou 429 numa rota em que ninguém tinha batido. */
function excedeu(ip, limite, janela, porta = '') {
  const chave = ip + '|' + porta;
  const agora = Date.now();
  const t = (tentativas.get(chave) || []).filter(x => agora - x < janela);
  t.push(agora);
  tentativas.set(chave, t);
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

const paraOndeIr = (res, url, extra = {}) => {
  res.writeHead(303, { Location: url, ...extra }); res.end();
};

/* ---------------------------------------------------------------------------
 * A SESSÃO DE ADMINISTRAÇÃO
 *
 * O segredo viajava no endereço, em todos os endereços: `/admin?t=…`. Isso quer
 * dizer que ficava no histórico do browser, no que se cola para alguém, no
 * canto de qualquer captura de ecrã, e no chat do Telegram para sempre. Sempre
 * foi assim e sempre foi desconfortável; passou a importar mais quando esta
 * página ganhou uma faixa vermelha que sai em todas as outras — quem tiver o
 * link deixa de poder só aprovar centros e passa a poder escrever no site.
 *
 * Agora: chegar com `?t=…` troca-o por um cookie e redirecciona para `/admin`
 * limpo. O link do Telegram continua a funcionar exactamente como funcionava —
 * é o mesmo link — mas o segredo deixa de aparecer em todos os endereços
 * seguintes.
 *
 * HttpOnly (o JavaScript da página nunca lhe toca), SameSite=Strict (um POST
 * vindo de outro site não o leva consigo, que é a defesa contra CSRF de que
 * isto precisa), e Secure quando a ligação é HTTPS — atrás do proxy da Railway
 * isso lê-se no X-Forwarded-Proto e não no socket.
 *
 * Continua a aceitar-se `t` no corpo de um POST. Não é preguiça: é o que faz
 * um formulário aberto antes da sessão expirar continuar a funcionar, e o
 * próprio `t` é a credencial, não um atalho para a contornar.
 * -------------------------------------------------------------------------*/
const SESSAO = 8 * 3600;   /* uma manhã de trabalho, não uma semana */
const COOKIE = 'capem_admin';

const seguro = req =>
  String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';

function lerCookie(req, nome) {
  const bruto = req.headers.cookie || '';
  for (const parte of bruto.split(';')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    if (parte.slice(0, i).trim() === nome) {
      try { return decodeURIComponent(parte.slice(i + 1).trim()); } catch (e) { return ''; }
    }
  }
  return '';
}

const cookieSessao = (req, valor, segundos) =>
  `${COOKIE}=${encodeURIComponent(valor)}; Path=/; HttpOnly; SameSite=Strict; `
  + `Max-Age=${segundos}${seguro(req) ? '; Secure' : ''}`;

/* ---------------------------------------------------------------------------
 * A SESSÃO DE UM CENTRO
 *
 * Isto reverte uma decisão que estava escrita neste ficheiro, por isso vale a
 * pena dizer porquê. O que lá estava: o código anda num campo escondido do
 * formulário e NÃO numa sessão, "para não haver nada que se roube de um
 * telemóvel emprestado".
 *
 * O argumento está ao contrário. Um campo escondido põe a chave em texto no
 * DOM, no botão de voltar e no ver-código-fonte desse mesmo telemóvel
 * emprestado. Um cookie HttpOnly não se lê — nem pela pessoa que tem o
 * aparelho na mão, nem por um script. Trocar tira a chave do ecrã.
 *
 * O que se perde é "fechar o separador é sair", e isso repõe-se: prazo curto,
 * um botão SAIR à vista, e a página a dizer em que centro se está. É o mesmo
 * padrão que o /admin já usa — só que aqui o cookie NÃO leva a chave, leva o
 * slug assinado. Se a base de dados vazar, os cookies que andam por aí não
 * valem nada; se um cookie vazar, vale um centro e vale doze horas.
 *
 * Doze horas porque um turno é isso. Um coordenador que entra às oito não pode
 * ser posto fora a meio da manhã, e no dia seguinte volta a entrar.
 * -------------------------------------------------------------------------*/
const SESSAO_CENTRO = 12 * 3600;
const COOKIE_CENTRO = 'capem_centro';
/* Derivada do segredo de administração para não haver uma segunda variável de
   ambiente que alguém se esqueça de definir. Muda o segredo, caem as sessões —
   que é o comportamento certo. */
const CHAVE_CENTRO = crypto.createHmac('sha256', 'capem/sessao-centro/v1')
  .update(String(ADMIN)).digest();

function assinarCentro(slug, expira) {
  const corpo = `${slug}.${expira}`;
  const sel = crypto.createHmac('sha256', CHAVE_CENTRO).update(corpo)
    .digest('base64url').slice(0, 32);
  return `${corpo}.${sel}`;
}

/** O slug de quem está com sessão aberta, ou '' — nunca lança. */
function centroDaSessao(req) {
  const v = lerCookie(req, COOKIE_CENTRO);
  if (!v) return '';
  const p = v.split('.');
  if (p.length !== 3) return '';
  const [slug, exp, sel] = p;
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return '';
  const quando = parseInt(exp, 10);
  if (!Number.isFinite(quando) || quando < Date.now()) return '';
  const esperado = Buffer.from(assinarCentro(slug, quando).split('.')[2]);
  const dado = Buffer.from(sel);
  if (esperado.length !== dado.length || !crypto.timingSafeEqual(esperado, dado)) return '';
  return slug;
}

const cookieCentro = (req, valor, segundos) =>
  `${COOKIE_CENTRO}=${encodeURIComponent(valor)}; Path=/; HttpOnly; SameSite=Strict; `
  + `Max-Age=${segundos}${seguro(req) ? '; Secure' : ''}`;

const abrirSessaoCentro = (req, slug) =>
  cookieCentro(req, assinarCentro(slug, Date.now() + SESSAO_CENTRO * 1000), SESSAO_CENTRO);

/**
 * Esta pessoa pode administrar?
 *
 * Comparação de tempo constante. O segredo tem dezasseis bytes ou mais e um
 * ataque de temporização por HTTP é teórico — mas custa três linhas, e a
 * alternativa é justificar um `===` num ficheiro que alguém vai ler daqui a
 * dois anos.
 */
function ehAdmin(req, dado) {
  const oferecido = String(dado != null ? dado : lerCookie(req, COOKIE));
  if (!oferecido || !ADMIN) return false;
  const a = Buffer.from(oferecido), b = Buffer.from(ADMIN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

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

/* ---------------------------------------------------------------------------
 * Onde uma sacola pode ser entregue, e onde ela está
 * -------------------------------------------------------------------------*/
/** Os centros que ligaram a leitura de códigos. Nunca uma condição, só uma dica. */
const centrosQueLeem = base => db.listar('aprovado')
  .filter(c => (c.dados || {}).sacolas && !(c.dados || {}).pausado)
  .map(c => ({ ...c, url: urlDoCentro(c.slug, base) }));

/** Todos os centros no ar, para o voluntário escolher à mão. */
const centrosProximos = () => db.listar('aprovado');

/* Distância em metros pela fórmula do haversine. Chega e sobra: a pergunta é
   "estou nesta porta ou na de outro centro", e não navegação. */
function metrosEntre(la1, lo1, la2, lo2) {
  const R = 6371000, r = Math.PI / 180;
  const dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
  const a = Math.sin(dLa / 2) ** 2
          + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * O centro mais próximo de um par de coordenadas, ou null.
 *
 * Só olha para centros com coordenadas — e é por isso que as coordenadas
 * deixaram de ser opcionais na aprovação: um centro sem elas nunca é sugerido,
 * e o voluntário cai sempre na lista.
 */
function centroMaisPerto(lat, lon) {
  let melhor = null;
  db.listar('aprovado').forEach(c => {
    const co = (c.dados || {}).coords;
    if (!Array.isArray(co) || co.length !== 2) return;
    const m = metrosEntre(lat, lon, Number(co[0]), Number(co[1]));
    if (!melhor || m < melhor.metros) melhor = { slug: c.slug, metros: m };
  });
  return melhor;
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
    return responder(res, 200, P.paginaInicial({
      contagem: db.contar(), base, emergencias: db.emergencias(),
      /* Os centros no ar, so para o mapa desenhar os pontos. E a mesma leitura
         que a lista faz; a esta escala nao vale a pena uma consulta so com
         coordenadas, e no dia em que valer e uma linha em db.js. */
      centros: db.listar('aprovado') }));
  }

  /* --- sobre --- */
  if (caminho === '/sobre' && req.method === 'GET') {
    return responder(res, 200, P.paginaSobre({
      contagem: db.contar(), emergencias: db.emergencias()
    }), 'text/html; charset=utf-8', { 'Cache-Control': 'public, max-age=900' });
  }
  if (caminho === '/centros' && req.method === 'GET') {
    const consulta = B.lerConsulta(url.searchParams);
    const DIA = 86400000;
    const r = db.procurar({
      termos: B.termos(consulta.q), ordem: consulta.ordem,
      aceitando: consulta.aceitando, recentes: consulta.recentes,
      emergencia: consulta.emergencia,
      semDono: consulta.semLista ? true : null,
      pagina: consulta.pagina, porPagina: consulta.porPagina,
      /* As fronteiras dos escalões, calculadas agora: até um dia é "de hoje",
         até sete ainda vale a pena mostrar sem alarme. */
      fresca: Date.now() - DIA, envelhecida: Date.now() - 7 * DIA
    });
    const centros = r.linhas.map(x => ({ ...x, url: urlDoCentro(x.slug, base) }));
    return responder(res, 200,
      P.paginaCentros({ centros, base, consulta, total: r.total, paginas: r.paginas,
                        emergencias: db.emergencias(),
                        /* Quantos ficaram de fora de uma procura por necessidade
                           só por não terem quem publique uma. A página diz-o em
                           voz alta em vez de os deixar invisíveis. */
                        semDono: db.contarSemDono(),
                        /* A entrada para registar uma sacola só aparece quando
                           há quem leia códigos do outro lado. */
                        comSacolas: centrosQueLeem(base).length }),
      'text/html; charset=utf-8', { 'Cache-Control': 'public, max-age=60' });
  }
  /* --- registrar uma sacola ---
   *
   * Uma sacola de cada vez, e é de propósito: cada sacola tem o seu código, por
   * isso juntá-las num rascunho só servia para inventar estado entre pedidos
   * numa ferramenta que não tem sessão para quem doa — e não deve ter.
   */
  if (caminho === '/doar' && req.method === 'GET') {
    const c = db.resolver(texto(url.searchParams.get('c'), 60));
    const centro = c ? db.ler(c) : null;
    return responder(res, 200, P.paginaDoar({
      centro: centro && centro.estado === 'aprovado' ? (centro.dados || {}).nome : ''
    }), 'text/html; charset=utf-8', { 'Cache-Control': 'public, max-age=300' });
  }

  if (caminho === '/doar' && req.method === 'POST') {
    if (excedeu(ip, 40, 3600e3, 'doar')) {
      return responder(res, 429, P.paginaDoar({
        erro: 'Registros demais deste aparelho. Espere uma hora.' }));
    }
    const campos = new URLSearchParams(await corpo(req));
    const ids = campos.getAll('itens').map(x => texto(x, 40))
      .filter(x => SAC.ITENS.indexOf(x) >= 0).slice(0, 16);
    const outros = campos.get('outros') === '1';
    const volumes = Math.max(1, Math.min(SAC.MAX_VOLUMES,
      parseInt(campos.get('volumes'), 10) || 1));
    /* 120 caracteres. Chega para "2 caixas de leite longa vida" e nao chega
       para uma historia com nomes lá dentro. O corte e no servidor e nao no
       maxlength do campo, que qualquer pessoa contorna. */
    const nota = texto(campos.get('nota'), 120);
    if (!ids.length && !outros) {
      return responder(res, 400, P.paginaDoar({
        erro: 'Escolha ao menos um item, ou marque que tem coisa fora da lista.',
        escolhidos: ids, volumes, outros }));
    }
    const descricao = SAC.descrever(ids, outros, volumes);
    const sacola = db.criarSacola(descricao,
      serie => SAC.codificar(ids, outros, volumes, serie), nota);
    /* Os recados que passaram do prazo. Aqui e nao so no arranque, porque um
       servidor que fique meses de pe nunca mais voltaria a limpar nada. */
    db.esquecerNotas();
    /* O recado NAO vai para o registo. Um log e a copia da base que nao tem
       politica de retencao nenhuma, e escrever lá texto de uma pessoa desfazia
       o apagar automatico sem ninguem dar por isso. */
    console.log(`[sacola] ${sacola.codigo} — ${ids.length} itens, ${volumes} volume(s)`);
    /* Os centros que leem códigos, para o doador saber onde a sacola é esperada.
       Nunca é uma condição: o código não fica preso a nenhum centro. */
    return responder(res, 200, P.paginaSacolaCriada({
      sacola, base, centros: centrosQueLeem(base).slice(0, 6)
    }), 'text/html; charset=utf-8', { 'X-Robots-Tag': 'noindex' });
  }

  if (caminho === '/minhas-sacolas' && req.method === 'GET') {
    return responder(res, 200, P.paginaMinhasSacolas(),
      'text/html; charset=utf-8', { 'X-Robots-Tag': 'noindex' });
  }

  /* O estado de sacolas que o aparelho já conhece. Não devolve nada que quem
     pergunta não tivesse já: o código é a chave, e quem o tem tem a sacola. */
  if (caminho === '/api/sacolas' && req.method === 'POST') {
    if (excedeu(ip, 120, 3600e3, 'api-sacolas')) {
      return json(res, 429, { erro: 'pedidos demais' });
    }
    let pedido = {};
    try { pedido = JSON.parse(await corpo(req)); } catch { pedido = {}; }
    const codigos = Array.isArray(pedido.codigos) ? pedido.codigos.slice(0, 60) : [];
    const fora = [];
    codigos.forEach(x => {
      const d = SAC.descodificar(x);
      if (!d) return;
      const linha = db.lerSacola(d.codigo);
      const c = linha && linha.centro ? db.ler(linha.centro) : null;
      fora.push({
        codigo: d.codigo,
        itens: d.ids.map(id => ROTULO_BR[id] || id).join(', ')
               + (d.outros ? (d.ids.length ? ' + fora da lista' : 'fora da lista') : ''),
        recebida: !!(linha && linha.recebida),
        quando: linha && linha.recebida ? new Date(linha.recebida)
          .toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '',
        centro: c ? ((c.dados || {}).nome || c.slug) : ''
      });
    });
    return json(res, 200, fora);
  }

  /* --- o balcão ---
   *
   * Público, e sem nada por trás: quem está na porta com uma sacola na mão não
   * tem código de centro nenhum, e não deve ter — o código de publicação é de
   * quem coordena. O conteúdo nunca foi segredo: quem segura a sacola pode
   * abrir e ver.
   */
  if (caminho === '/balcao' && req.method === 'GET') {
    const c = texto(url.searchParams.get('c'), 12);
    if (c) {
      const d = SAC.descodificar(c);
      if (d) return responder(res, 200, P.paginaBalcaoSacola({
        sacola: { decodificada: d, linha: db.lerSacola(d.codigo) },
        centros: centrosProximos(null, null)
      }), 'text/html; charset=utf-8', { 'X-Robots-Tag': 'noindex' });
    }
    return responder(res, 200, P.paginaBalcao({ codigo: c }),
      'text/html; charset=utf-8', { 'Cache-Control': 'public, max-age=300' });
  }

  if (caminho === '/balcao' && req.method === 'POST') {
    if (excedeu(ip, 200, 3600e3, 'balcao')) {
      return responder(res, 429, P.paginaBalcao({ erro: 'Leituras demais deste aparelho. Espere uma hora.' }));
    }
    const campos = new URLSearchParams(await corpo(req));
    const d = SAC.descodificar(texto(campos.get('c'), 12));
    if (!d) {
      return responder(res, 400, P.paginaBalcao({
        codigo: texto(campos.get('c'), 12),
        erro: 'Isso não parece um código de sacola. São sete letras, três e quatro — '
            + 'sem I, O e S, sem 0, 1 e 5.'
      }));
    }
    return responder(res, 200, P.paginaBalcaoSacola({
      sacola: { decodificada: d, linha: db.lerSacola(d.codigo) },
      centros: centrosProximos(null, null)
    }), 'text/html; charset=utf-8', { 'X-Robots-Tag': 'noindex' });
  }

  /* Confirmar que a sacola chegou.
   *
   * AS COORDENADAS NÃO SE GUARDAM. Chegam neste pedido, resolvem-se para um
   * centro, e morrem com a variável. `capem-state.md` diz que nada sobre quem
   * visita chega ao servidor, e chama a isso "uma restrição de desenho, não um
   * detalhe de implementação". Quem confirma uma sacola é um voluntário a
   * trabalhar e não alguém a procurar ajuda, por isso o espírito aguenta — mas
   * só enquanto o que fica na linha for o CENTRO e nunca o par de números.
   *
   * E isto é uma verificação de plausibilidade, não uma autenticação: a
   * localização do browser falsifica-se em dez segundos. Serve para separar
   * "confirmado por quem estava lá" de "confirmado por qualquer pessoa", que é
   * o que mantém a medição honesta.
   */
  if (caminho === '/balcao/receber' && req.method === 'POST') {
    if (excedeu(ip, 200, 3600e3, 'balcao')) {
      return responder(res, 429, P.paginaBalcao({ erro: 'Confirmações demais deste aparelho.' }));
    }
    const campos = new URLSearchParams(await corpo(req));
    const d = SAC.descodificar(texto(campos.get('c'), 12));
    if (!d) return paraOndeIr(res, '/balcao');

    const lat = Number(campos.get('lat')), lon = Number(campos.get('lon'));
    const temCoords = Number.isFinite(lat) && Number.isFinite(lon) && (lat || lon);
    const escolhido = fazerSlug(texto(campos.get('centro'), 60), '');
    const perto = temCoords ? centroMaisPerto(lat, lon) : null;

    /* O centro é o que o voluntário escolheu; as coordenadas só decidem o GRAU.
       Confirmar com a lista é sempre possível, porque num ginásio com telhado de
       metal o GPS dá 50 a 500 metros ou nada. */
    const slug = escolhido && db.existe(escolhido) ? escolhido : '';
    const grau = (slug && perto && perto.slug === slug && perto.metros <= 400)
      ? 'coordenadas' : 'aberto';

    const linha = db.receberSacola(d.codigo, slug, grau);
    if (!linha) {
      /* Um código que não está registado não pára a doação: diz-se e segue-se.
         Um código ilegível nunca deve fazer um voluntário recusar fraldas. */
      return responder(res, 200, P.paginaBalcaoSacola({
        sacola: { decodificada: d, linha: null },
        centros: centrosProximos(null, null),
        erro: 'Este código não consta como registrado, por isso não há o que marcar. '
            + 'Receba a sacola pelo que se vê.'
      }), 'text/html; charset=utf-8', { 'X-Robots-Tag': 'noindex' });
    }
    const c = slug ? db.ler(slug) : null;
    console.log(`[recebida] ${d.codigo} — ${slug || 'sem centro'} (${grau})`);
    return responder(res, 200, P.paginaBalcaoRecebida({
      sacola: { decodificada: d },
      nomeCentro: c ? ((c.dados || {}).nome || c.slug) : ''
    }), 'text/html; charset=utf-8', { 'X-Robots-Tag': 'noindex' });
  }

  if (caminho === '/centro' && req.method === 'GET') {
    /* Com sessão aberta não se pede o código outra vez — mostra-se quem está
       dentro e a porta para a lista. */
    const daSessao = centroDaSessao(req);
    const cs = daSessao ? db.ler(daSessao) : null;
    return responder(res, 200, P.paginaCentroEntrada({
      base,
      sessao: cs && cs.estado === 'aprovado' ? ((cs.dados || {}).nome || cs.slug) : ''
    }));
  }
  if (caminho === '/novo' && req.method === 'GET') {
    return responder(res, 200, P.paginaNovo({}));
  }

  /* --- pedir uma página --- */
  if (caminho === '/pedir' && req.method === 'POST') {
    if (excedeu(ip, 5, 3600e3, 'pedir')) return responder(res, 429, P.molde({
      titulo: 'Pedidos demais',
      corpo: '<main class="aviso-pagina"><h1>Pedidos demais deste aparelho</h1><p>Tente daqui a uma hora.</p></main>'
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
    db.criar(slug, dados);
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
    return responder(res, 200, P.paginaPedidoRecebido({
      slug, url: urlDoCentro(slug, base), base }));
  }

  /* --- publicar (o botão do kit) --- */
  /* --- pedir um código novo ---
   *
   * Não emite nada. Manda um recado ao Telegram com o centro, o telefone que
   * está guardado, e o link para a fila — onde o botão de emitir já existe.
   *
   * É público de propósito e não concede nada de propósito: o código é o que
   * deixa escrever na página de um centro, e os nomes dos centros estão numa
   * lista pública. Se este formulário emitisse, bastava saber um nome para
   * tomar conta de um centro. A verificação é o telefonema, e o código novo
   * segue para o número conferido à mão na aprovação — não para quem pediu.
   */
  if (caminho === '/pedir-codigo' && req.method === 'GET') {
    return responder(res, 200, P.paginaPedirCodigo({ slug: url.searchParams.get('c') || '' }));
  }
  if (caminho === '/pedir-codigo' && req.method === 'POST') {
    if (excedeu(ip, 5, 3600e3, 'pedir-codigo')) {
      return responder(res, 429, P.paginaPedirCodigo({
        erro: 'Pedidos demais deste aparelho. Tente daqui a uma hora.' }));
    }
    const campos = new URLSearchParams(await corpo(req));
    const pedido = texto(campos.get('slug'), 60).toLowerCase().replace(/^.*\//, '');
    const nota = texto(campos.get('nota'), 140);
    const real = db.resolver(pedido);
    const centro = real ? db.ler(real) : null;
    if (!centro || centro.estado !== 'aprovado') {
      return responder(res, 404, P.paginaPedirCodigo({
        slug: pedido,
        erro: 'Não encontramos esse endereço. Confira no rodapé de uma peça '
            + 'impressa, ou procure seu centro na lista de centros.'
      }));
    }
    const d = centro.dados || {};
    const url_centro = urlDoCentro(centro.slug, base);
    /* O link do WhatsApp para o número guardado vai já feito na notificação:
       quando isto chegar, a acção seguinte é ligar, e um toque poupa procurar
       o número na base de dados. */
    const wa = A.linkWhatsApp(d.contato, `Olá! Aqui é do CAPEM, sobre o código de ${d.nome || centro.slug}.`);
    A.avisar({
      tipo: 'codigo',
      titulo: 'Pedido de código novo',
      corpo: [
        d.nome || centro.slug,
        'telefone do centro: ' + (d.contato || 'sem telefone'),
        nota ? 'disse: ' + nota : '',
        wa ? 'falar: ' + wa : '',
        'confirme ao telefone ANTES de emitir'
      ].filter(Boolean).join('\n'),
      url: `${base}/admin?t=${encodeURIComponent(ADMIN)}`,
      slug: centro.slug
    });
    console.log(`[pedido de código] ${centro.slug}${nota ? ' — ' + nota : ''}`);
    return responder(res, 200, P.paginaPedirCodigo({
      feito: true, nome: d.nome || centro.slug }));
  }

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
    /* Com sessão aberta entra-se direito à lista. É o ponto todo: voltar aqui
       à tarde, no computador da secretaria, sem ir procurar o papel do código. */
    const daSessao = centroDaSessao(req);
    const cs = daSessao ? db.ler(daSessao) : null;
    if (cs && cs.estado === 'aprovado') {
      return responder(res, 200,
        P.paginaAtualizar({ centro: cs, url: urlDoCentro(cs.slug, base), sessao: true }),
        'text/html; charset=utf-8', { 'X-Robots-Tag': 'noindex' });
    }
    return responder(res, 200, P.paginaAtualizarEntrada({ slug: url.searchParams.get('c') || '' }));
  }

  /* Sair. Um botão à vista, porque o preço de trocar o campo escondido por um
     cookie é justamente este: fechar o separador deixou de chegar. */
  if (caminho === '/atualizar/sair') {
    return paraOndeIr(res, '/atualizar', { 'Set-Cookie': cookieCentro(req, '', 0) });
  }
  /* --- configurar o centro: o segundo nível ---
   *
   * A lista de hoje faz-se todos os dias; o horário, as sacolas e o encerramento
   * fazem-se uma vez. Estavam na mesma página, e isso fazia a coisa diária
   * parecer uma configuração. Entrar continua a dar na lista — isto é uma porta
   * a partir dela, e não um passo antes dela.
   *
   * Guardar aqui NÃO republica: a idade da página é a da lista do centro, e não
   * a de um ajuste de horário. Mesma regra que /admin/verificados.
   */
  if ((caminho === '/atualizar/gerir') && (req.method === 'GET' || req.method === 'POST')) {
    const campos = req.method === 'POST'
      ? new URLSearchParams(await corpo(req)) : new URLSearchParams();
    const daSessao = centroDaSessao(req);
    const pedido = daSessao || texto(campos.get('slug'), 60).toLowerCase().replace(/^.*\//, '');
    const real = db.resolver(pedido);
    const centro = real ? db.ler(real) : null;
    const entrou = !!(centro && daSessao === centro.slug);
    if (!centro || centro.estado !== 'aprovado'
        || !(entrou || db.codigoConfere(texto(campos.get('codigo'), 20), centro.codigo_hash))) {
      return responder(res, 403, P.paginaAtualizarEntrada({
        erro: 'Entre com o endereço e o código do seu centro.' }));
    }

    let feito = false;
    if (req.method === 'POST') {
      const dados = {
        ...centro.dados,
        horario: texto(campos.get('horario'), LIMITES.horario),
        sacolas: campos.get('sacolas') === '1'
      };
      /* guardarCampos e não publicar: isto não é a lista do dia. */
      centro.dados = db.guardarCampos(centro.slug, {
        horario: dados.horario, sacolas: dados.sacolas });
      console.log(`[configurado] ${centro.slug}`);
      feito = true;
    }
    const cab = entrou ? {} : { 'Set-Cookie': abrirSessaoCentro(req, centro.slug) };
    return responder(res, 200, P.paginaGerir({
      centro, url: urlDoCentro(centro.slug, base), feito
    }), 'text/html; charset=utf-8', { ...cab, 'X-Robots-Tag': 'noindex' });
  }

  if (caminho === '/atualizar' && req.method === 'POST') {
    /* Mais apertado do que publicar: aqui é onde alguém tentaria adivinhar um
       código à força. Vinte por hora chega para um coordenador que se engana
       algumas vezes e não chega para mais nada. */
    if (excedeu(ip, 20, 3600e3, 'atualizar')) {
      return responder(res, 429, P.paginaAtualizarEntrada({
        erro: 'Tentativas demais deste aparelho. Espere uma hora.' }));
    }
    const campos = new URLSearchParams(await corpo(req));
    /* Duas maneiras de provar quem é, e a ordem importa. A sessão primeiro,
       porque é a que existe depois do primeiro envio; o código a seguir, para
       o primeiro envio e para quem tenha os cookies desligados. */
    const daSessao = centroDaSessao(req);
    const pedido = daSessao
      || texto(campos.get('slug'), 60).toLowerCase().replace(/^.*\//, '');
    const codigo = texto(campos.get('codigo'), 20);
    const real = db.resolver(pedido);
    const centro = real ? db.ler(real) : null;
    const entrou = !!(centro && daSessao === centro.slug);

    /* Uma mensagem só para "não existe" e para "código errado". Os centros são
       públicos, por isso isto não esconde grande coisa — mas também não há
       vantagem nenhuma em confirmar a alguém que adivinhou metade. */
    if (!centro || !(entrou || db.codigoConfere(codigo, centro.codigo_hash))) {
      /* Sem sessão e sem código, mas com um endereço: isto não é um código
         errado, é uma sessão que caiu ou um browser sem cookies. Dizer "código
         errado" mandava alguém procurar um papel que está certo. */
      const caiu = !daSessao && !codigo && !!campos.get('slug');
      return responder(res, 403, P.paginaAtualizarEntrada({
        slug: pedido,
        erro: caiu
          ? 'Sua sessão terminou, ou este navegador não guarda cookies. Entre outra vez com o código.'
          : 'Endereço ou código errados. Confira as letras — no código não há O, nem I, nem S.'
      }));
    }
    /* Um centro encerrado não volta a abrir por aqui: reabrir é uma decisão de
       quem aprova, e um código que ainda ande num telemóvel não a pode tomar. */
    if (centro.estado === 'encerrado') {
      return responder(res, 403, P.paginaAtualizarEntrada({
        slug: pedido,
        erro: 'Este centro está encerrado. Se voltou a abrir, fale connosco — '
            + 'reabrir não se faz com o código.'
      }));
    }

    /* Encerrar, em dois passos. O primeiro só mostra o que vai acontecer: a
       diferença entre "fechámos hoje" e "fechámos de vez" é grande demais para
       caber num clique ao lado dos outros. */
    const querEncerrar = campos.get('encerrar');
    if (querEncerrar === 'pedir') {
      /* Só quando NÃO houve sessão. Com cookie, a chave não volta ao ecrã —
         que é a razão de existir desta mudança. */
      if (!entrou) centro.codigoDado = codigo;
      return responder(res, 200, P.paginaConfirmarEncerrar({
        centro, url: urlDoCentro(centro.slug, base), sessao: entrou }));
    }
    if (querEncerrar === 'confirmar') {
      db.decidir(centro.slug, 'encerrado');
      console.log(`[encerrado] ${centro.slug}`);
      /* Vale um aviso: um centro que fecha é a única mudança de estado que
         ninguém mais vê acontecer, e é a que mais interessa a quem coordena
         uma resposta. */
      A.avisar({
        tipo: 'encerrado',
        titulo: 'Centro encerrado',
        corpo: [(centro.dados || {}).nome || centro.slug,
                (centro.dados || {}).endereco,
                'saiu da lista pública'].filter(Boolean).join('\n'),
        url: urlDoCentro(centro.slug, base),
        slug: centro.slug
      });
      return responder(res, 200, P.paginaEncerrado({ centro, base }),
        'text/html; charset=utf-8', { 'X-Robots-Tag': 'noindex' });
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
        pausado: campos.get('pausado') === '1',
        motivoPausa: texto(campos.get('motivoPausa'), LIMITES.motivoPausa)
      };
      const limpo = limparDados(dados);
      /* O horário e a opção das sacolas vivem em /atualizar/gerir e não neste
         formulário; publicar não lhes pode tocar, senão publicar a lista de hoje
         apagava um horário que ninguém tinha aberto. */
      delete limpo.horario;
      db.publicar(centro.slug, { ...centro.dados, ...limpo });
      console.log(`[publicado] ${centro.slug} — ${limpo.precisa.length} itens${limpo.pausado ? ' (pausado)' : ''} (via /atualizar)`);
      feito = true;
      centro.dados = { ...centro.dados, ...limpo };
      centro.publicado = Date.now();
      if (!limpo.precisa.length && !limpo.pausado) {
        erro = 'Publicou uma lista vazia e o centro não está marcado como '
             + 'fechado. Quem abrir a página não vai saber o que trazer.';
      }
    }

    /* Aqui é onde o campo escondido morre. Se a autenticação foi por código,
       abre-se a sessão agora e o código nunca mais aparece no HTML; se os
       cookies estiverem desligados, o `centroDaSessao` do envio seguinte devolve
       vazio e o campo escondido volta a ser a única forma — por isso ele
       continua a ser escrito nesse caso, e só nesse. */
    /* O campo escondido morre aqui. Entrou-se com o código uma vez; a partir
       deste envio quem prova é o cookie, e a chave nunca mais aparece no HTML.
       Se os cookies estiverem desligados, o envio seguinte chega sem sessão e
       sem código — e tem uma mensagem própria, em vez de dizer que o código
       está errado, que seria mentira. */
    const cab = {};
    if (!entrou) cab['Set-Cookie'] = abrirSessaoCentro(req, centro.slug);
    return responder(res, 200,
      P.paginaAtualizar({ centro, url: urlDoCentro(centro.slug, base), feito, erro,
                          sessao: true }),
      'text/html; charset=utf-8', { ...cab, 'X-Robots-Tag': 'noindex' });
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
    if (excedeu(ip, 60, 3600e3, 'carregar')) return json(res, 429, { erro: 'pedidos demais' });
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
    if (excedeu(ip, 120, 3600e3, 'publicar')) return json(res, 429, { erro: 'envios demais' });
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

  /* Trocar o segredo do endereço por um cookie, e limpar o endereço.
     Feito com um redireccionamento e não em silêncio: o que fica no histórico
     do browser passa a ser `/admin`, e é essa a metade que interessa. */
  if (caminho === '/admin' && req.method === 'GET' && url.searchParams.get('t')) {
    if (!ehAdmin(req, url.searchParams.get('t'))) return responder(res, 404, P.paginaNaoExiste());
    const resto = new URLSearchParams(url.searchParams);
    resto.delete('t');
    const q = resto.toString();
    return paraOndeIr(res, '/admin' + (q ? '?' + q : ''),
      { 'Set-Cookie': cookieSessao(req, ADMIN, SESSAO) });
  }

  if (caminho === '/admin/sair') {
    return paraOndeIr(res, '/', { 'Set-Cookie': cookieSessao(req, '', 0) });
  }

  if (caminho === '/admin' && req.method === 'GET') {
    if (!ehAdmin(req)) return responder(res, 404, P.paginaNaoExiste());
    return responder(res, 200, P.paginaAdmin({
      pendentes: db.listar('pendente'),
      aprovados: db.listar('aprovado').map(c => ({ ...c, url: urlDoCentro(c.slug, base) })),
      encerrados: db.listar('encerrado').map(c => ({ ...c, url: urlDoCentro(c.slug, base) })),
      parados: db.parados(DIAS_PARADO).map(c => ({ ...c, url: urlDoCentro(c.slug, base) })),
      /* Quem disse ser da casa de um centro que nós acrescentámos. Vem antes de
         tudo o resto na página: é a única fila em que alguém está à espera de
         um telefonema nosso. */
      reivindicados: db.listar('aprovado')
        .filter(c => (c.dados || {}).reivindicacao)
        .map(c => ({ ...c, url: urlDoCentro(c.slug, base) })),
      erro: url.searchParams.get('erro') === 'encontrado'
        ? 'Faltou o nome, o endereço ou a fonte. Os três são obrigatórios para um centro que não pediu a página.'
        : url.searchParams.get('erro'),
      feito: MENSAGENS[url.searchParams.get('feito')] || '',
      saude: saudeDoSite(),
      avisoActivo: db.lerAviso(),
      emergencias: db.emergenciasTodas(),
      canais: A.canaisActivos(),
      token: ADMIN, contagem: db.contar(), base
    }), 'text/html; charset=utf-8', { 'X-Robots-Tag': 'noindex' });
  }

  /* --- o aviso do topo do site --- */
  if (caminho === '/admin/aviso' && req.method === 'POST') {
    const campos = new URLSearchParams(await corpo(req));
    if (!ehAdmin(req, campos.get('t') || undefined)) return responder(res, 404, P.paginaNaoExiste());

    if (campos.get('apagar')) {
      db.apagarAviso();
      console.log('[aviso-site] retirado');
      return paraOndeIr(res, '/admin?feito=aviso-fora');
    }

    const msg = texto(campos.get('texto'), 180);
    if (!msg) return paraOndeIr(res, '/admin');
    const horas = Math.max(0, Math.min(720, Number(campos.get('prazo')) || 0));

    /* Primeiro passo: mostra-se a faixa a sério, do tamanho e da cor que vai
       ter, e só depois é que ela sai. Ver uma coisa é melhor do que ler uma
       descrição dela — e isto aparece acima do nome do centro que a pessoa
       veio procurar, em todas as páginas. */
    if (campos.get('confirmar') !== '1') {
      return responder(res, 200, P.paginaConfirmar({
        titulo: 'Publicar este aviso?',
        aviso: `Vai aparecer no topo de <b>todas</b> as páginas do site, incluindo a `
             + `página de cada centro — acima do que a pessoa veio ver. `
             + (horas ? `Sai sozinho daqui a <b>${horas} horas</b>.`
                      : `<b>Não expira</b>: fica no ar até você o tirar.`),
        detalhe: `<div class="previa"><div class="aviso-global">`
               + `<p>${P.esc(msg)}</p></div></div>`,
        accao: '/admin/aviso',
        campos: { t: ADMIN, texto: msg, prazo: String(horas) },
        botao: 'Publicar em todas as páginas',
        perigo: true,
        voltar: '/admin'
      }), 'text/html; charset=utf-8', { 'X-Robots-Tag': 'noindex' });
    }

    db.escreverAviso(msg, horas ? Date.now() + horas * 3600e3 : 0);
    console.log(`[aviso-site] "${msg.slice(0, 60)}" — ${horas ? horas + 'h' : 'sem prazo'}`);
    return paraOndeIr(res, '/admin?feito=aviso-no-ar');
  }

  /* --- as emergências --- */
  if (caminho === '/admin/emergencia' && req.method === 'POST') {
    const campos = new URLSearchParams(await corpo(req));
    if (!ehAdmin(req, campos.get('t') || undefined)) return responder(res, 404, P.paginaNaoExiste());
    const accao = campos.get('accao');
    const nome = texto(campos.get('nome'), LIMITES.emergencia);
    const slug = texto(campos.get('slug'), 48);

    if (accao === 'criar') {
      if (!nome) return paraOndeIr(res, '/admin');
      const novo = fazerSlug(nome, '');
      if (!novo) return paraOndeIr(res, '/admin?erro=emergencia');
      /* Já existe: não é erro nenhum, é a mesma emergência. Renomeia-se para o
         que foi escrito agora e segue-se. */
      if (db.emergencia(novo)) db.renomearEmergencia(novo, nome);
      else db.criarEmergencia(novo, nome);
      console.log(`[emergência] ${novo} — ${nome}`);
      return paraOndeIr(res, '/admin?feito=emergencia');
    }

    if (!db.emergencia(slug)) return paraOndeIr(res, '/admin');

    if (accao === 'renomear' && nome) { db.renomearEmergencia(slug, nome); return paraOndeIr(res, '/admin?feito=emergencia'); }
    if (accao === 'arquivar') { db.activarEmergencia(slug, false); return paraOndeIr(res, '/admin?feito=emergencia'); }
    if (accao === 'ativar') { db.activarEmergencia(slug, true); return paraOndeIr(res, '/admin?feito=emergencia'); }

    if (accao === 'apagar') {
      const e = db.emergencia(slug);
      const quantos = db.emergenciasTodas().filter(x => x.slug === slug).map(x => x.n)[0] || 0;
      if (campos.get('confirmar') !== '1') {
        return responder(res, 200, P.paginaConfirmar({
          titulo: `Apagar "${e.nome}"?`,
          aviso: quantos
            ? `<b>${quantos} ${quantos === 1 ? 'centro fica' : 'centros ficam'} sem emergência.</b> `
              + `Nenhum centro é apagado e nenhum sai do ar — só deixam de estar agrupados. `
              + `Se só quer parar de a oferecer em novos centros, <b>arquive</b> em vez de apagar.`
            : 'Nenhum centro está nesta emergência. Apagar não afeta ninguém.',
          accao: '/admin/emergencia',
          campos: { t: ADMIN, accao: 'apagar', slug },
          botao: 'Apagar a emergência',
          perigo: true,
          voltar: '/admin'
        }), 'text/html; charset=utf-8', { 'X-Robots-Tag': 'noindex' });
      }
      const soltos = db.apagarEmergencia(slug);
      console.log(`[emergência] ${slug} apagada — ${soltos} centro(s) soltos`);
      return paraOndeIr(res, '/admin?feito=emergencia-fora');
    }
    return paraOndeIr(res, '/admin');
  }

  /* --- um aviso de teste ---
     Sem isto, descobria-se que o Telegram estava em baixo no dia em que um
     pedido real ficasse sem resposta. Espera-se mesmo pelo envio, ao contrário
     do `avisar()` normal: aqui o resultado É o que se quer saber. */
  if (caminho === '/admin/testar-aviso' && req.method === 'POST') {
    const campos = new URLSearchParams(await corpo(req));
    if (!ehAdmin(req, campos.get('t') || undefined)) return responder(res, 404, P.paginaNaoExiste());
    const falhas = [];
    for (const [nome, ad] of Object.entries(A.ADAPTADORES)) {
      if (!ad.activo()) continue;
      try { await ad.enviar({ tipo: 'teste', titulo: 'Teste do CAPEM',
        corpo: 'Se leu isto, os avisos estão chegando.', url: base + '/admin' }); }
      catch (e) { falhas.push(`${nome} (${(e && e.message || e).toString().slice(0, 60)})`); }
    }
    return paraOndeIr(res, '/admin?feito=' + (falhas.length
      ? 'teste-falhou&' + new URLSearchParams({ q: falhas.join('; ') })
      : 'teste-ok'));
  }

  /* --- a base de dados, num ficheiro --- */
  if (caminho === '/admin/backup' && req.method === 'POST') {
    const campos = new URLSearchParams(await corpo(req));
    if (!ehAdmin(req, campos.get('t') || undefined)) return responder(res, 404, P.paginaNaoExiste());

    if (campos.get('confirmar') !== '1') {
      return responder(res, 200, P.paginaConfirmar({
        titulo: 'Baixar a base de dados?',
        aviso: 'O arquivo traz <b>tudo</b>: todos os centros, os endereços, os '
             + 'telefones dos coordenadores e o hash de cada código. Os códigos '
             + 'em si não estão lá — só o hash — mas os telefones estão. '
             + 'Trate como trataria uma lista de contatos: não deixe esse '
             + 'arquivo na pasta de downloads de um computador que outras '
             + 'pessoas usam.',
        accao: '/admin/backup',
        campos: { t: ADMIN },
        botao: 'Baixar agora',
        voltar: '/admin'
      }), 'text/html; charset=utf-8', { 'X-Robots-Tag': 'noindex' });
    }

    const nome = `capem-${new Date().toISOString().slice(0, 10)}.db`;
    const tmp = path.join(os.tmpdir(), `capem-backup-${Date.now()}.db`);
    try {
      db.exportarPara(tmp);
      const dados = fs.readFileSync(tmp);
      console.log(`[backup] ${(dados.length / 1024).toFixed(1)} KB`);
      return responder(res, 200, dados, 'application/octet-stream', {
        'Content-Disposition': `attachment; filename="${nome}"`,
        'Content-Length': String(dados.length),
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex'
      });
    } catch (e) {
      console.error('[backup] falhou —', e && e.message);
      return paraOndeIr(res, '/admin?feito=backup-falhou');
    } finally {
      try { fs.unlinkSync(tmp); } catch { /* já não existe */ }
    }
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
    if (!ehAdmin(req, campos.get('t') || undefined)) return responder(res, 404, P.paginaNaoExiste());
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
      nome: (centro.dados || {}).nome, contato: (centro.dados || {}).contato,
      reemitido: true,
      voltar: '/admin?t=' + encodeURIComponent(ADMIN)
    }));
  }

  /* --- acrescentar um centro que nunca pediu página ---
   *
   * A lista tem mais valor no primeiro dia de uma cheia do que em qualquer
   * outro, e no primeiro dia quase nenhum centro ouviu falar disto. Uma lista
   * feita só de quem já nos conhece manda alguém com cobertores no carro passar
   * à porta de um ginásio aberto para ir a outro mais longe.
   *
   * O que entra é o que se encontra numa fonte pública: nome, morada, telefone,
   * horário, redes. O que NÃO entra é uma lista de necessidades — ninguém de lá
   * disse o que precisa, e inventá-la seria pôr palavras na boca de quem não
   * falou. A página diz de onde veio e quando, e oferece a quem for da casa
   * assumi-la.
   *
   * Fica no ar já: não há fila para um centro que fomos nós a criar — a
   * verificação é a fonte, e ela vai à vista na página em vez de ficar num
   * campo interno.
   */
  if (caminho === '/admin/encontrado' && req.method === 'POST') {
    const campos = new URLSearchParams(await corpo(req));
    if (!ehAdmin(req, campos.get('t') || undefined)) return responder(res, 404, P.paginaNaoExiste());
    const dados = limparDados({
      nome: campos.get('nome'), tipo: campos.get('tipo'), endereco: campos.get('endereco'),
      horario: campos.get('horario'), contato: campos.get('contato'),
      fonte: campos.get('fonte'),
      /* Sem necessidades e sem recusas. As quatro recusas são um conselho bom,
         e mesmo assim não são nossas para dar em nome de uma casa que não
         falou connosco. */
      precisa: [], naoTraga: []
    });
    if (!dados.nome || !dados.endereco || !dados.fonte) {
      return paraOndeIr(res, '/admin?erro=encontrado');
    }
    dados.origem = 'encontrado';
    dados.fonteEm = Date.now();
    const verificados = camposVerificados(campos);
    Object.entries(verificados).forEach(([k, v]) => { if (v !== undefined) dados[k] = v; });
    const pedido = fazerSlug(texto(campos.get('novo_slug'), 48), '');
    let slug = pedido && !RESERVADOS.has(pedido) && !db.existe(pedido)
      ? pedido : slugLivre(dados.nome);
    db.criar(slug, dados);
    db.decidir(slug, 'aprovado');
    console.log(`[encontrado] ${slug} — ${dados.nome}`);
    return paraOndeIr(res, '/admin?feito=encontrado');
  }

  /* --- sou deste centro ---
   *
   * O caminho de volta de uma página que criámos sem falar com ninguém. Não
   * concede nada — pelo mesmo motivo que `/pedir-codigo` não concede: os nomes
   * dos centros estão numa lista pública, e um formulário que entregasse a
   * chave bastaria saber um nome para tomar conta de uma página.
   *
   * O que faz é pôr o pedido na fila e tocar o telefone de quem administra. A
   * verificação é o telefonema. Sempre foi.
   */
  if (caminho === '/sou-daqui' && req.method === 'GET') {
    const slug = db.resolver(texto(url.searchParams.get('c'), 60));
    const centro = slug ? db.ler(slug) : null;
    if (!centro || (centro.dados || {}).origem !== 'encontrado') {
      return responder(res, 404, P.paginaNaoExiste());
    }
    return responder(res, 200, P.paginaSouDaqui({ centro }));
  }

  if (caminho === '/sou-daqui' && req.method === 'POST') {
    const campos = new URLSearchParams(await corpo(req));
    const slug = db.resolver(texto(campos.get('slug'), 60));
    const centro = slug ? db.ler(slug) : null;
    if (!centro || (centro.dados || {}).origem !== 'encontrado') {
      return responder(res, 404, P.paginaNaoExiste());
    }
    if (excedeu(ip, 5, 3600e3, 'sou-daqui')) {
      return responder(res, 429, P.molde({
        titulo: 'Pedidos demais',
        corpo: '<main class="aviso-pagina"><h1>Pedidos demais deste aparelho</h1><p>Tente daqui a uma hora.</p></main>'
      }));
    }
    const nome = texto(campos.get('nome'), 80);
    const contato = texto(campos.get('contato'), 40);
    if (!nome || !contato) {
      return responder(res, 400, P.paginaSouDaqui({
        centro, erro: 'Precisamos do nome e de um telefone para ligar.'
      }));
    }
    db.guardarCampos(slug, {
      reivindicacao: { nome, contato, papel: texto(campos.get('papel'), 60), em: Date.now() }
    });
    console.log(`[sou-daqui] ${slug} — ${nome}`);
    A.avisar({
      tipo: 'reivindicacao',
      titulo: 'Alguém diz ser de um centro que nós acrescentámos',
      corpo: [(centro.dados || {}).nome, '/' + slug, nome, contato,
              texto(campos.get('papel'), 60)].filter(Boolean).join('\n'),
      url: `${base}/admin?t=${encodeURIComponent(ADMIN)}`,
      slug
    });
    return responder(res, 200, P.paginaSouDaquiRecebido({ centro, base }));
  }

  /* --- entregar a página a quem é da casa ---
   *
   * Depois do telefonema. Emite o código, apaga a marca de "encontrado" e o
   * pedido: a partir daqui é um centro como os outros, com quem publica a lista
   * e uma página que deixa de dizer que ninguém a confirmou.
   */
  if (caminho === '/admin/entregar' && req.method === 'POST') {
    const campos = new URLSearchParams(await corpo(req));
    if (!ehAdmin(req, campos.get('t') || undefined)) return responder(res, 404, P.paginaNaoExiste());
    const slug = texto(campos.get('slug'), 60);
    const centro = db.existe(slug) ? db.ler(slug) : null;
    if (!centro) return paraOndeIr(res, '/admin');
    db.guardarCampos(slug, {
      origem: '', reivindicacao: null,
      naoTraga: require('./compartilhado').RECUSAS
    });
    const codigo = db.garantirCodigo(slug) || db.novoCodigoPara(slug);
    const d = centro.dados || {};
    console.log(`[entregue] ${slug}`);
    return responder(res, 200, P.paginaCodigo({
      slug, codigo, base, url: urlDoCentro(slug, base),
      nome: d.nome, contato: (d.reivindicacao || {}).contato || d.contato,
      voltar: '/admin'
    }), 'text/html; charset=utf-8', { 'X-Robots-Tag': 'noindex' });
  }

  if (caminho === '/admin/decidir' && req.method === 'POST') {
    const campos = new URLSearchParams(await corpo(req));
    if (!ehAdmin(req, campos.get('t') || undefined)) return responder(res, 404, P.paginaNaoExiste());
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
    /* Os campos que só a aprovação escreve. Ver `definirVerificados` em db.js:
       não são do coordenador porque foram conferidos por uma pessoa, e uma
       verificação que o verificado pode reescrever depois não é verificação
       nenhuma. Passam antes do `decidir` para que o centro entre no ar já com
       as coordenadas e a emergência que a lista precisa para o ordenar. */
    /* `verificados` só vem do formulário da fila. O botão "Reabrir" da lista de
       encerrados também faz POST aqui com decisao=aprovado e sem estes campos —
       sem esta condição, reabrir um centro apagava-lhe as coordenadas, a
       emergência e o perfil. */
    if (decisao === 'aprovado' && campos.get('verificados') === '1') {
      db.definirVerificados(alvo, camposVerificados(campos));
    }

    db.decidir(alvo, decisao);
    console.log(`[${decisao}] ${alvo}`);

    /* O código nasce aqui e não no pedido. Mostra-se uma vez, com o botão de o
       mandar para o telefone que acabou de ser conferido — é o único momento em
       que ele existe em texto. Se esta página se fechar antes de o mandar, a
       recuperação é o botão "Código novo" na fila.

       Recusar não gera nada: uma chave para uma página que não vai existir. */
    if (decisao === 'aprovado') {
      const codigo = db.garantirCodigo(alvo);
      if (codigo) {
        const centro = db.ler(alvo);
        const d = centro.dados || {};
        return responder(res, 200, P.paginaCodigo({
          slug: alvo, codigo, base, url: urlDoCentro(alvo, base),
          nome: d.nome, contato: d.contato,
          voltar: '/admin?t=' + encodeURIComponent(ADMIN)
        }), 'text/html; charset=utf-8', { 'X-Robots-Tag': 'noindex' });
      }
    }
    return paraOndeIr(res, '/admin?t=' + encodeURIComponent(ADMIN));
  }

  /* Corrigir os campos conferidos de um centro que já está no ar.
     Existe porque uma coordenada colada com um dígito a menos ficava errada
     para sempre, e este projecto tem uma regra sobre números viverem só onde se
     podem corrigir. NÃO republica: mexer nisto não é a lista do centro mudar, e
     fazer a página parecer fresca por causa de uma correcção nossa seria a
     mentira que o resto do desenho existe para evitar. */
  if (caminho === '/admin/verificados' && req.method === 'POST') {
    const campos = new URLSearchParams(await corpo(req));
    if (!ehAdmin(req, campos.get('t') || undefined)) return responder(res, 404, P.paginaNaoExiste());
    const slug = texto(campos.get('slug'), 60);
    if (db.existe(slug)) {
      db.definirVerificados(slug, camposVerificados(campos));
      console.log(`[conferido] ${slug}`);
    }
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

  /* Encerrado responde 200 e não 404: há cartazes com este endereço colados em
     portas, e um QR impresso não se corrige. O que muda é o conteúdo — em vez
     de uma lista de necessidades, diz que fechou e manda para os que estão
     abertos. Um 404 aqui mandava a pessoa embora sem saber para onde ir. */
  if (centro.estado === 'encerrado') {
    return responder(res, 200, P.paginaEncerrado({ centro, base }),
      'text/html; charset=utf-8',
      { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'public, max-age=300' });
  }

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
  db.abrir(ARQUIVO_DB);
  criarServidor().listen(PORTA, () => {
    console.log(`CAPEM em ${BASE}  (porta ${PORTA})`);
    console.log(`fila de aprovação: ${BASE}/admin?t=${ADMIN}`);
    const c = db.contar();
    console.log(`${c.aprovado} no ar · ${c.pendente} aguardando`);
    const canais = A.canaisActivos();
    console.log(`avisos por: ${canais.join(', ')}`);
    if (canais.length === 1) {
      console.log('  (só o console — ver server/README.md para ligar o Telegram)');
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
                   lerCoords, lerPerfilBruto,
                   urlDoCentro, slugDoAnfitriao, resumoDeParados, DIAS_PARADO,
                   ESTILO, DOMINIO, RESERVADOS };
