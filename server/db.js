/* ============================================================================
 * ARMAZENAMENTO
 *
 * SQLite, através do módulo `node:sqlite` que vem dentro do Node — zero
 * dependências, um ficheiro no disco, escritas atómicas.
 *
 * Duas notas honestas para quem vier a seguir:
 *
 * 1. `node:sqlite` está marcado como experimental. Se um dia mudar de forma,
 *    é este ficheiro que se reescreve e mais nenhum: tudo o que o resto do
 *    servidor sabe são as sete funções lá em baixo. Escolheu-se assim de
 *    propósito.
 * 2. Ficheiros JSON teriam chegado para dez centros e teriam corrompido no dia
 *    em que dois coordenadores publicassem ao mesmo tempo. SQLite trata disso
 *    sem se pensar nele, que é a razão para não se ter poupado aqui.
 * ==========================================================================*/
const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const path = require('node:path');

/* `encerrado` é o fim da vida de um centro, e é um estado e não um sinal dentro
   dos dados porque muda quem o vê: sai da lista pública, sai da procura, sai
   dos empurrões. A página continua a responder — há cartazes impressos a
   apontar para ela — mas passa a dizer que fechou. */
const ESTADOS = ['pendente', 'aprovado', 'recusado', 'encerrado'];

let db;

/**
 * Como se derivam as colunas de procura a partir dos dados de um centro.
 *
 * Instalada de fora (`server.js` liga-lhe o `busca.js`) porque este ficheiro é
 * armazenamento e mais nada: não sabe o que é o rótulo de um item, e não deve
 * passar a saber só para poder indexá-lo. A predefinição chega para um teste
 * que só queira guardar e ler.
 */
let derivar = d => ({
  busca: String((d && d.nome) || '').toLowerCase(),
  nome_ord: String((d && d.nome) || '').toLowerCase(),
  pausado: !!(d && d.pausado),
  emergencia: String((d && d.emergencia) || '')
});

const definirDerivacao = fn => { derivar = fn; };

const derivadas = d => {
  const x = derivar(d || {});
  return [String(x.busca || ''), String(x.nome_ord || ''), x.pausado ? 1 : 0,
          String(x.emergencia || '')];
};

function abrir(arquivo) {
  db = new DatabaseSync(arquivo || path.join(__dirname, 'capem.db'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS centros (
      slug        TEXT PRIMARY KEY,
      estado      TEXT NOT NULL DEFAULT 'pendente',
      codigo_hash TEXT NOT NULL,
      dados       TEXT NOT NULL,
      criado      INTEGER NOT NULL,
      decidido    INTEGER,
      publicado   INTEGER,

      /* Quatro colunas que são cópias de coisas que já estão dentro do JSON.
         Existem porque a lista de centros tem de ser filtrada, procurada e
         ordenada em SQL — a alternativa é ler e desempacotar mil JSON a cada
         pedido, que é exactamente o que tornava essa página lenta.

         busca       nome + morada + tipo + os rótulos das necessidades, sem
                     acentos nem maiúsculas. Ver busca.js: quem procura escreve
                     o que quer dar, não o nome de um centro.
         nome_ord    o nome sem acentos, porque o SQLite não ordena português.
         pausado     para "só quem está a receber" ser um WHERE e não um filtro
                     aplicado depois de já se ter desenhado tudo.
         emergencia  a que resposta o centro pertence. Vazia em toda a parte
                     hoje, e é para continuar assim enquanto houver uma só:
                     existe para o dia em que houver duas ao mesmo tempo e
                     misturá-las passar a mandar gente para o outro estado.

         São derivadas: a coluna dados continua a ser a verdade. Reescrevem-se
         sozinhas a cada publicação, e reindexar() refá-las todas. */
      busca       TEXT NOT NULL DEFAULT '',
      nome_ord    TEXT NOT NULL DEFAULT '',
      pausado     INTEGER NOT NULL DEFAULT 0,
      emergencia  TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_estado ON centros(estado, criado);
    CREATE INDEX IF NOT EXISTS idx_lista ON centros(estado, publicado);
    CREATE INDEX IF NOT EXISTS idx_nome ON centros(estado, nome_ord);

    /* Endereços antigos. Quando um centro é renomeado — normalmente na
       aprovação, para encurtar o que vai ser ditado ao telefone — o endereço
       velho continua a responder e redireciona. Um endereço que já saiu da
       impressora não se corrige. */
    CREATE TABLE IF NOT EXISTS aliases (
      alias TEXT PRIMARY KEY,
      slug  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_alias_slug ON aliases(slug);

    /* Um sítio para o pouco estado que não pertence a um centro — por agora,
       quando foi enviado o último resumo de centros parados. Está na base de
       dados e não em memória porque um servidor que reinicia três vezes numa
       tarde não pode mandar três resumos. */
    CREATE TABLE IF NOT EXISTS estado (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );

    /* As emergências, com nome próprio.
       Antes era texto livre escrito à mão em cada aprovação, e texto livre
       escrito vinte vezes dá vinte grafias: "Enchentes RS 2026", "enchentes
       rs", "Enchentes  RS 2026". Cada uma virava uma resposta diferente na
       barra, e a lista partia-se em três sem ninguém perceber porquê.

       O centro guarda o SLUG. O nome vive só aqui, o que quer dizer que
       corrigir uma gralha é uma linha e não uma passagem por todos os
       centros — e que o nome pode mudar sem que nenhum endereço mude. */
    CREATE TABLE IF NOT EXISTS emergencias (
      slug   TEXT PRIMARY KEY,
      nome   TEXT NOT NULL,
      ativa  INTEGER NOT NULL DEFAULT 1,
      criada INTEGER NOT NULL
    );
  `);
  migrar();
  /* Depois de migrar (a tabela tem de existir) e ANTES de reindexar, porque
     reescreve `dados.emergencia` e a reindexação é que copia o resultado para
     a coluna. */
  migrarEmergencias();
  /* Refaz as colunas derivadas de tudo o que já lá estava. É uma passagem por
     uma tabela pequena, e é o que torna seguro mudar a regra de indexação sem
     obrigar centro nenhum a republicar para voltar a ser encontrável. */
  reindexar();
  return db;
}

/**
 * De texto livre para um catálogo.
 *
 * A primeira versão da emergência era uma palavra escrita à mão em cada
 * aprovação. Quem tiver dados dessa versão tem nomes guardados onde agora vão
 * slugs, e sem isto ficariam órfãos: a coluna com "Enchentes RS 2026" e a
 * tabela vazia, logo nenhum filtro a devolver coisa nenhuma.
 *
 * Corre a cada arranque e é um no-op quando não há nada por converter. Isso é
 * de propósito: uma migração que só corre uma vez é uma migração que ninguém
 * consegue repetir quando restaura um backup antigo.
 */
function migrarEmergencias() {
  const linhas = db.prepare('SELECT slug, dados FROM centros').all();
  const conhecidos = new Set(db.prepare('SELECT slug FROM emergencias').all().map(r => r.slug));
  let convertidos = 0;
  db.exec('BEGIN');
  try {
    linhas.forEach(r => {
      let d = {};
      try { d = JSON.parse(r.dados); } catch { return; }
      const valor = String(d.emergencia || '').trim();
      if (!valor || conhecidos.has(valor)) return;
      /* Era um nome, não um slug. Faz-se o slug, cria-se a emergência com o
         nome tal como estava escrito, e o centro passa a apontar ao slug. */
      const slug = valor.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
      if (!slug) return;
      if (!conhecidos.has(slug)) {
        db.prepare(`INSERT OR IGNORE INTO emergencias (slug, nome, ativa, criada)
                    VALUES (?, ?, 1, ?)`).run(slug, valor, Date.now());
        conhecidos.add(slug);
      }
      d.emergencia = slug;
      db.prepare('UPDATE centros SET dados = ? WHERE slug = ?')
        .run(JSON.stringify(d), r.slug);
      convertidos++;
    });
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  if (convertidos) console.log(`[migração] ${convertidos} centro(s) passaram a apontar a um slug de emergência`);
  return convertidos;
}

/**
 * Bases de dados que já existiam antes das colunas derivadas.
 *
 * O `CREATE TABLE IF NOT EXISTS` acima não toca numa tabela que já lá está, por
 * isso um servidor actualizado sobre dados antigos arrancaria sem estas colunas
 * e rebentaria no primeiro pedido. Acrescentam-se aqui, vazias; quem as enche é
 * o `reindexar()` do arranque.
 */
function migrar() {
  const tem = new Set(db.prepare('PRAGMA table_info(centros)').all().map(c => c.name));
  const novas = {
    busca: "TEXT NOT NULL DEFAULT ''",
    nome_ord: "TEXT NOT NULL DEFAULT ''",
    pausado: 'INTEGER NOT NULL DEFAULT 0',
    /* A que resposta o centro pertence. Coluna e não só um campo dentro do
       JSON, pelo mesmo motivo que as outras três: filtra-se em SQL, e um
       filtro que obrigue a desempacotar todos os JSON é o desenho que esta
       página já teve uma vez e que custou 1,6 MB. Vazia enquanto ninguém a
       preencher, e vazia é exactamente o comportamento de hoje. */
    emergencia: "TEXT NOT NULL DEFAULT ''"
  };
  Object.entries(novas).forEach(([c, t]) => {
    if (!tem.has(c)) db.exec(`ALTER TABLE centros ADD COLUMN ${c} ${t}`);
  });
}

/**
 * Recalcula as colunas derivadas de todos os centros.
 *
 * Corre-se no arranque. É barato (uma passagem por uma tabela pequena) e é o
 * que torna seguro mudar a regra de indexação: acrescentar uma palavra ao texto
 * de busca não obriga ninguém a republicar para voltar a ser encontrável.
 *
 * O `derivar` vem de fora porque este ficheiro não sabe — nem deve saber — o
 * que é o rótulo de um item.
 */
function reindexar() {
  const linhas = db.prepare('SELECT slug, dados FROM centros').all();
  const upd = db.prepare(`UPDATE centros SET busca = ?, nome_ord = ?, pausado = ?,
                                             emergencia = ? WHERE slug = ?`);
  db.exec('BEGIN');
  try {
    linhas.forEach(r => {
      let d = {};
      try { d = JSON.parse(r.dados); } catch { /* uma linha corrompida não pára o arranque */ }
      upd.run(...derivadas(d), r.slug);
    });
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return linhas.length;
}

/* ---------------------------------------------------------------------------
 * O código de administração.
 *
 * Oito caracteres, sem os que se confundem à mão ou ao telefone: sem O nem 0,
 * sem I nem 1, sem S nem 5. Este código vai ser ditado por telefone a alguém
 * num ginásio com barulho, e escrito num papel colado ao lado do computador.
 *
 * Guarda-se só o hash. Se a base de dados vazar, ninguém publica em nome de um
 * centro; e se o coordenador o perder, ninguém — nem nós — o pode recuperar,
 * só emitir outro. É a troca certa nos dois sentidos.
 * -------------------------------------------------------------------------*/
const ALFABETO = 'ABCDEFGHJKLMNPQRTUVWXYZ2346789';

function novoCodigo() {
  const b = crypto.randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += ALFABETO[b[i] % ALFABETO.length];
  return s.slice(0, 4) + '-' + s.slice(4);
}

const hash = c => crypto.createHash('sha256')
  .update(String(c).toUpperCase().replace(/[^A-Z0-9]/g, ''))
  .digest('hex');

/** Comparação em tempo constante: um código adivinha-se byte a byte se não for. */
function codigoConfere(codigo, guardado) {
  /* Um centro por aprovar tem o hash vazio. Sem esta linha, a comparação de
     comprimentos já o rejeitava por acidente; explicitamente é melhor, porque
     "ainda não há chave" nunca deve depender de um acaso aritmético. */
  if (!guardado) return false;
  const a = Buffer.from(hash(codigo));
  const b = Buffer.from(guardado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------------------------------------------------------------------------
 * Operações
 * -------------------------------------------------------------------------*/
/**
 * Criar um centro — SEM código.
 *
 * O código nasce na aprovação e não aqui. Antes nascia no momento do pedido e
 * aparecia no ecrã de quem preencheu o formulário, o que queria dizer que
 * qualquer pessoa que soubesse o nome de uma paróquia recebia, na hora, uma
 * chave de escrita para uma página com esse nome. A aprovação travava a página,
 * não o código.
 *
 * Agora a ordem é a certa: verifica-se primeiro, e a chave vai depois para o
 * telefone que foi verificado. Não custa nada a quem pede — imprimir o material
 * nunca precisou de código nenhum, só do nome do centro.
 */
function criar(slug, dados) {
  db.prepare(`INSERT INTO centros (slug, estado, codigo_hash, dados, criado,
                                   busca, nome_ord, pausado, emergencia)
              VALUES (?, 'pendente', '', ?, ?, ?, ?, ?, ?)`)
    .run(slug, JSON.stringify(dados), Date.now(), ...derivadas(dados));
}

function ler(slug) {
  const r = db.prepare('SELECT * FROM centros WHERE slug = ?').get(slug);
  if (!r) return null;
  return { ...r, dados: JSON.parse(r.dados) };
}

function existe(slug) {
  return !!db.prepare('SELECT 1 FROM centros WHERE slug = ?').get(slug)
      || !!db.prepare('SELECT 1 FROM aliases WHERE alias = ?').get(slug);
}

/** Devolve o slug verdadeiro para um endereço que pode ser antigo. */
function resolver(x) {
  if (db.prepare('SELECT 1 FROM centros WHERE slug = ?').get(x)) return x;
  const a = db.prepare('SELECT slug FROM aliases WHERE alias = ?').get(x);
  return a ? a.slug : null;
}

/**
 * Renomear.
 *
 * O sítio natural para isto é a aprovação: é aí que alguém olha para
 * "Paróquia São Sebastião, Canoas/RS" e percebe que "canoas-sao-sebastiao"
 * é longo de ditar e "canoas-ss" não é. O endereço antigo passa a alias e
 * continua a responder para sempre.
 */
function renomear(antigo, novo) {
  if (antigo === novo) return;
  if (existe(novo)) throw new Error('esse endereço já está ocupado: ' + novo);
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE centros SET slug = ? WHERE slug = ?').run(novo, antigo);
    db.prepare('UPDATE aliases SET slug = ? WHERE slug = ?').run(novo, antigo);
    db.prepare('INSERT OR REPLACE INTO aliases (alias, slug) VALUES (?, ?)').run(antigo, novo);
    /* Um alias que aponte para si próprio faria um redireccionamento infinito. */
    db.prepare('DELETE FROM aliases WHERE alias = slug').run();
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

function publicar(slug, dados) {
  db.prepare(`UPDATE centros SET dados = ?, publicado = ?,
                                 busca = ?, nome_ord = ?, pausado = ?, emergencia = ?
              WHERE slug = ?`)
    .run(JSON.stringify(dados), Date.now(), ...derivadas(dados), slug);
}

/**
 * Emitir um código novo, invalidando o antigo.
 *
 * O código não se recupera — só se guarda o hash, e isso é deliberado nos dois
 * sentidos. Mas "perdi o código" é o que vai acontecer mais vezes do que
 * qualquer outro pedido de ajuda: um papel colado à parede de um ginásio
 * perde-se, molha-se, e a pessoa que o tinha no telemóvel foi para casa.
 *
 * Que o antigo deixe de funcionar não é um efeito secundário, é metade da
 * razão: um código perdido pode estar perdido *para alguém*. Emitir sem
 * invalidar seria acumular chaves da mesma porta.
 */
/**
 * O código do momento da aprovação.
 *
 * Devolve o código novo se o centro ainda não tinha nenhum, e `null` se já
 * tinha — aprovar duas vezes por engano não pode invalidar a chave que já está
 * num telemóvel.
 */
function garantirCodigo(slug) {
  const r = db.prepare('SELECT codigo_hash FROM centros WHERE slug = ?').get(slug);
  if (!r) throw new Error('centro não existe: ' + slug);
  if (r.codigo_hash) return null;
  return novoCodigoPara(slug);
}

function novoCodigoPara(slug) {
  const codigo = novoCodigo();
  const r = db.prepare('UPDATE centros SET codigo_hash = ? WHERE slug = ?')
    .run(hash(codigo), slug);
  if (!r.changes) throw new Error('centro não existe: ' + slug);
  return codigo;
}

function decidir(slug, estado) {
  if (!ESTADOS.includes(estado)) throw new Error('estado inválido: ' + estado);
  db.prepare('UPDATE centros SET estado = ?, decidido = ? WHERE slug = ?')
    .run(estado, Date.now(), slug);
}

function listar(estado) {
  const q = estado
    ? db.prepare('SELECT * FROM centros WHERE estado = ? ORDER BY criado DESC').all(estado)
    : db.prepare('SELECT * FROM centros ORDER BY criado DESC').all();
  return q.map(r => ({ ...r, dados: JSON.parse(r.dados) }));
}

/* ---------------------------------------------------------------------------
 * A lista pública, com procura, filtros, ordem e páginas.
 *
 * Tudo isto acontece em SQL e devolve no máximo `porPagina` linhas. A versão
 * anterior lia todos os centros, desempacotava todos os JSON e mandava-os para
 * o telemóvel filtrar: 1,6 MB de HTML e 41 páginas por segundo com mil centros.
 *
 * As fronteiras da idade chegam de fora em milissegundos, para o "hoje" ser o
 * de quem faz o pedido e não o de quando o processo arrancou — um servidor que
 * não reinicia há três semanas não pode achar que ainda é a semana passada.
 * -------------------------------------------------------------------------*/
function procurar({ termos = [], ordem = 'uteis', aceitando = false,
                    recentes = false, emergencia = '', pagina = 1, porPagina = 40,
                    fresca = 0, envelhecida = 0 } = {}) {
  const onde = ["estado = 'aprovado'"];
  const arg = [];
  if (emergencia) { onde.push('emergencia = ?'); arg.push(String(emergencia)); }

  /* Todos os termos têm de bater. Com o texto já normalizado dos dois lados,
     um LIKE chega — e uma tabela pequena percorre-se mais depressa do que se
     mantém um índice de texto que o `node:sqlite` pode nem ter compilado. */
  termos.slice(0, 6).forEach(t => {
    onde.push('busca LIKE ? ESCAPE \'\\\'');
    arg.push('%' + t.replace(/[\\%_]/g, c => '\\' + c) + '%');
  });
  if (aceitando) onde.push('pausado = 0');
  if (recentes) { onde.push('publicado IS NOT NULL AND publicado >= ?'); arg.push(envelhecida); }

  const w = 'WHERE ' + onde.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) n FROM centros ${w}`).get(...arg).n;

  /* A ordem de sempre: escalão de idade, depois quem está a receber, depois o
     nome. O escalão escreve-se aqui em vez de se ordenar por `publicado`
     directamente porque dentro do mesmo escalão o que interessa é estar aberto,
     não ter publicado dez minutos antes. */
  const escalao = `CASE WHEN publicado IS NULL THEN 3
                        WHEN publicado >= ? THEN 0
                        WHEN publicado >= ? THEN 1
                        ELSE 2 END`;
  const ORDEM = {
    uteis: { sql: `${escalao} ASC, pausado ASC, nome_ord ASC`, pre: [fresca, envelhecida] },
    recentes: { sql: 'publicado IS NULL ASC, publicado DESC, nome_ord ASC', pre: [] },
    nome: { sql: 'nome_ord ASC', pre: [] }
  };
  const o = ORDEM[ordem] || ORDEM.uteis;

  const p = Math.max(1, pagina);
  const linhas = db.prepare(`SELECT * FROM centros ${w} ORDER BY ${o.sql} LIMIT ? OFFSET ?`)
    .all(...arg, ...o.pre, porPagina, (p - 1) * porPagina)
    .map(r => ({ ...r, dados: JSON.parse(r.dados) }));

  return { linhas, total, pagina: p, paginas: Math.max(1, Math.ceil(total / porPagina)) };
}

const lerEstado = (chave, recurso = null) => {
  const r = db.prepare('SELECT valor FROM estado WHERE chave = ?').get(chave);
  return r ? r.valor : recurso;
};

const escreverEstado = (chave, valor) =>
  db.prepare('INSERT OR REPLACE INTO estado (chave, valor) VALUES (?, ?)')
    .run(chave, String(valor));

/**
 * Centros aprovados que não publicam há mais de `dias`.
 *
 * Um centro parado é o modo de falhar mais provável desta ferramenta: a página
 * continua no ar, parece nova, e manda gente carregar coisas até um sítio que
 * já não as quer. Por isso alguém tem de ser avisado.
 */
function parados(dias) {
  const limite = Date.now() - dias * 86400000;
  /* COALESCE e não "publicado IS NULL": um centro que nunca publicou não está
     parado — está a começar. Sem isto, todo o centro aparecia na lista de
     empurrões no segundo a seguir a ser aprovado, e entrava no resumo diário
     antes de alguém ter tido hipótese de escrever a primeira lista. Conta-se a
     partir da aprovação até haver uma publicação. */
  return db.prepare(`SELECT * FROM centros
                     WHERE estado = 'aprovado'
                       AND COALESCE(publicado, decidido, criado) < ?
                     ORDER BY COALESCE(publicado, decidido, criado) ASC`).all(limite)
    .map(r => ({ ...r, dados: JSON.parse(r.dados) }));
}

function contar() {
  const r = {};
  ESTADOS.forEach(e => {
    r[e] = db.prepare('SELECT COUNT(*) n FROM centros WHERE estado = ?').get(e).n;
  });
  return r;
}

/* ---------------------------------------------------------------------------
 * As emergências
 *
 * `emergencias()` devolve as que têm centros no ar — é o que a barra pública
 * desenha, e continua a esconder-se sozinha enquanto houver uma só.
 * `emergenciasTodas()` devolve o catálogo inteiro, incluindo as que ainda não
 * têm centro nenhum e as desactivadas: é a vista de quem administra.
 * -------------------------------------------------------------------------*/
function emergencias() {
  return db.prepare(`SELECT e.slug, e.nome, COUNT(c.slug) n
                     FROM emergencias e
                     JOIN centros c ON c.emergencia = e.slug AND c.estado = 'aprovado'
                     GROUP BY e.slug, e.nome
                     HAVING n > 0
                     ORDER BY n DESC, e.nome ASC`).all();
}

function emergenciasTodas() {
  return db.prepare(`SELECT e.slug, e.nome, e.ativa, e.criada,
                            (SELECT COUNT(*) FROM centros c
                              WHERE c.emergencia = e.slug AND c.estado = 'aprovado') n
                     FROM emergencias e
                     ORDER BY e.ativa DESC, e.nome ASC`).all();
}

const emergencia = slug =>
  db.prepare('SELECT * FROM emergencias WHERE slug = ?').get(String(slug || '')) || null;

function criarEmergencia(slug, nome) {
  db.prepare(`INSERT INTO emergencias (slug, nome, ativa, criada)
              VALUES (?, ?, 1, ?)`).run(slug, nome, Date.now());
}

/** O nome muda; o slug NUNCA. O slug está guardado em cada centro e num
    endereço que já pode ter sido partilhado — /centros?e=… é um link. */
function renomearEmergencia(slug, nome) {
  db.prepare('UPDATE emergencias SET nome = ? WHERE slug = ?').run(nome, slug);
}

function activarEmergencia(slug, ativa) {
  db.prepare('UPDATE emergencias SET ativa = ? WHERE slug = ?').run(ativa ? 1 : 0, slug);
}

/**
 * Apagar uma emergência solta os centros que estavam nela.
 *
 * Não se apagam centros — nunca. Ficam sem emergência, que é o estado em que
 * todos estavam antes de isto existir e no qual tudo funciona.
 */
function apagarEmergencia(slug) {
  const afectados = db.prepare(`SELECT slug FROM centros WHERE emergencia = ?`).all(slug);
  db.exec('BEGIN');
  try {
    afectados.forEach(r => {
      const c = db.prepare('SELECT dados FROM centros WHERE slug = ?').get(r.slug);
      let d = {};
      try { d = JSON.parse(c.dados); } catch { /* linha corrompida */ }
      d.emergencia = '';
      db.prepare(`UPDATE centros SET dados = ?, busca = ?, nome_ord = ?,
                                     pausado = ?, emergencia = ? WHERE slug = ?`)
        .run(JSON.stringify(d), ...derivadas(d), r.slug);
    });
    db.prepare('DELETE FROM emergencias WHERE slug = ?').run(slug);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return afectados.length;
}

/* ---------------------------------------------------------------------------
 * O aviso que aparece no topo de todas as páginas.
 *
 * Vive no `estado` e não numa tabela própria porque é UM — não há uma lista de
 * avisos, e não deve haver: dois avisos vermelhos ao mesmo tempo já não são um
 * aviso, são um cabeçalho.
 *
 * EXPIRA SOZINHO, e essa é a decisão que interessa. Todo este projecto existe
 * para dizer que um cartaz impresso envelhece e uma página web mente sobre a
 * sua idade. Uma faixa vermelha que sobrevive ao motivo que a pôs lá é
 * exactamente essa falha, com o nosso nome em cima: passa a ser papel de
 * parede, e a emergência seguinte não é lida por ninguém. Por isso a validade
 * é escolhida no momento em que se escreve, e o fim é calculado aqui em vez de
 * depender de alguém se lembrar de a desligar.
 *
 * `ate = 0` é "até eu desligar". Existe porque há casos em que é a resposta
 * certa, e a fila de administração diz há quantos dias esse aviso está no ar
 * precisamente para que ninguém se esqueça dele.
 * -------------------------------------------------------------------------*/
function lerAviso() {
  const texto = lerEstado('aviso_texto', '');
  if (!texto) return null;
  const ate = Number(lerEstado('aviso_ate', 0)) || 0;
  const desde = Number(lerEstado('aviso_desde', 0)) || 0;
  /* Passou a validade: some sozinho, sem cron e sem ninguém. */
  if (ate && Date.now() > ate) return null;
  return { texto, ate, desde };
}

function escreverAviso(texto, ate) {
  escreverEstado('aviso_texto', String(texto || ''));
  escreverEstado('aviso_ate', String(Number(ate) || 0));
  escreverEstado('aviso_desde', String(Date.now()));
}

const apagarAviso = () => escreverAviso('', 0);

/* ---------------------------------------------------------------------------
 * Uma cópia consistente da base de dados.
 *
 * `VACUUM INTO` é do próprio SQLite e produz um ficheiro íntegro mesmo com o
 * servidor a atender pedidos — ao contrário de copiar o ficheiro à mão, que
 * apanha uma escrita a meio e dá um backup que só se descobre partido no dia
 * em que se precisa dele.
 *
 * O caminho é construído aqui e não vem de fora; ainda assim escapa-se a plica,
 * porque `VACUUM INTO` não aceita parâmetros ligados e uma string colada dentro
 * de SQL merece o cuidado de sempre.
 * -------------------------------------------------------------------------*/
function exportarPara(caminho) {
  db.exec(`VACUUM INTO '${String(caminho).replace(/'/g, "''")}'`);
  return caminho;
}

/**
 * Escrever os campos que foram conferidos à mão.
 *
 * Só a aprovação passa por aqui. Nome, morada, telefone, coordenadas, a
 * emergência e o perfil não se mudam nem em /atualizar nem pelo kit — foram
 * verificados por uma pessoa, e uma verificação que o próprio verificado pode
 * reescrever depois não é uma verificação.
 *
 * Funde em vez de substituir: a lista do dia e a pausa vivem no mesmo JSON e
 * não têm nada que ver com isto. `publicado` NÃO é tocado — mexer nos dados
 * verificados não é publicar uma lista, e fazer a página parecer fresca por
 * causa de uma correcção de morada seria a mentira que o resto do projecto
 * existe para evitar.
 */
function definirVerificados(slug, campos) {
  const r = db.prepare('SELECT dados FROM centros WHERE slug = ?').get(slug);
  if (!r) throw new Error('centro não existe: ' + slug);
  let d = {};
  try { d = JSON.parse(r.dados); } catch { /* linha corrompida: recomeça-se */ }
  const dados = { ...d, ...campos };
  db.prepare(`UPDATE centros SET dados = ?, busca = ?, nome_ord = ?,
                                 pausado = ?, emergencia = ? WHERE slug = ?`)
    .run(JSON.stringify(dados), ...derivadas(dados), slug);
  return dados;
}

module.exports = { abrir, criar, ler, existe, resolver, renomear, publicar,
                   decidir, listar, procurar, parados, contar,
                   emergencias, emergenciasTodas, emergencia, criarEmergencia,
                   renomearEmergencia, activarEmergencia, apagarEmergencia,
                   exportarPara, lerAviso, escreverAviso, apagarAviso,
                   definirVerificados, lerEstado,
                   escreverEstado, definirDerivacao, reindexar,
                   novoCodigo, novoCodigoPara, garantirCodigo, codigoConfere, ESTADOS };
