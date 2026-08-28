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

const ESTADOS = ['pendente', 'aprovado', 'recusado'];

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
  pausado: !!(d && d.pausado)
});

const definirDerivacao = fn => { derivar = fn; };

const derivadas = d => {
  const x = derivar(d || {});
  return [String(x.busca || ''), String(x.nome_ord || ''), x.pausado ? 1 : 0];
};

function abrir(ficheiro) {
  db = new DatabaseSync(ficheiro || path.join(__dirname, 'capem.db'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS centros (
      slug        TEXT PRIMARY KEY,
      estado      TEXT NOT NULL DEFAULT 'pendente',
      codigo_hash TEXT NOT NULL,
      dados       TEXT NOT NULL,
      criado      INTEGER NOT NULL,
      decidido    INTEGER,
      publicado   INTEGER,

      /* Três colunas que são cópias de coisas que já estão dentro do JSON.
         Existem porque a lista de centros tem de ser filtrada, procurada e
         ordenada em SQL — a alternativa é ler e desempacotar mil JSON a cada
         pedido, que é exactamente o que tornava essa página lenta.

         busca     nome + morada + tipo + os rótulos das necessidades, sem
                   acentos nem maiúsculas. Ver busca.js: quem procura escreve
                   o que quer dar, não o nome de um centro.
         nome_ord  o nome sem acentos, porque o SQLite não ordena português.
         pausado   para "só quem está a receber" ser um WHERE e não um filtro
                   aplicado depois de já se ter desenhado tudo.

         São derivadas: a coluna dados continua a ser a verdade. Reescrevem-se
         sozinhas a cada publicação, e reindexar() refá-las todas. */
      busca       TEXT NOT NULL DEFAULT '',
      nome_ord    TEXT NOT NULL DEFAULT '',
      pausado     INTEGER NOT NULL DEFAULT 0
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
  `);
  migrar();
  /* Refaz as colunas derivadas de tudo o que já lá estava. É uma passagem por
     uma tabela pequena, e é o que torna seguro mudar a regra de indexação sem
     obrigar centro nenhum a republicar para voltar a ser encontrável. */
  reindexar();
  return db;
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
    pausado: 'INTEGER NOT NULL DEFAULT 0'
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
  const upd = db.prepare('UPDATE centros SET busca = ?, nome_ord = ?, pausado = ? WHERE slug = ?');
  db.exec('BEGIN');
  try {
    linhas.forEach(r => {
      let d = {};
      try { d = JSON.parse(r.dados); } catch { /* uma linha corrompida não pára o arranque */ }
      const x = derivar(d);
      upd.run(x.busca, x.nome_ord, x.pausado ? 1 : 0, r.slug);
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
  const a = Buffer.from(hash(codigo));
  const b = Buffer.from(guardado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------------------------------------------------------------------------
 * Operações
 * -------------------------------------------------------------------------*/
function criar(slug, dados) {
  const codigo = novoCodigo();
  db.prepare(`INSERT INTO centros (slug, estado, codigo_hash, dados, criado,
                                   busca, nome_ord, pausado)
              VALUES (?, 'pendente', ?, ?, ?, ?, ?, ?)`)
    .run(slug, hash(codigo), JSON.stringify(dados), Date.now(), ...derivadas(dados));
  return codigo;
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
                                 busca = ?, nome_ord = ?, pausado = ?
              WHERE slug = ?`)
    .run(JSON.stringify(dados), Date.now(), ...derivadas(dados), slug);
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
                    recentes = false, pagina = 1, porPagina = 40,
                    fresca = 0, envelhecida = 0 } = {}) {
  const onde = ["estado = 'aprovado'"];
  const arg = [];

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
  return db.prepare(`SELECT * FROM centros
                     WHERE estado = 'aprovado'
                       AND (publicado IS NULL OR publicado < ?)
                     ORDER BY COALESCE(publicado, 0) ASC`).all(limite)
    .map(r => ({ ...r, dados: JSON.parse(r.dados) }));
}

function contar() {
  const r = {};
  ESTADOS.forEach(e => {
    r[e] = db.prepare('SELECT COUNT(*) n FROM centros WHERE estado = ?').get(e).n;
  });
  return r;
}

module.exports = { abrir, criar, ler, existe, resolver, renomear, publicar,
                   decidir, listar, procurar, parados, contar, lerEstado,
                   escreverEstado, definirDerivacao, reindexar,
                   novoCodigo, codigoConfere, ESTADOS };
