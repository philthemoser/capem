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
      publicado   INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_estado ON centros(estado, criado);

    /* Endereços antigos. Quando um centro é renomeado — normalmente na
       aprovação, para encurtar o que vai ser ditado ao telefone — o endereço
       velho continua a responder e redireciona. Um endereço que já saiu da
       impressora não se corrige. */
    CREATE TABLE IF NOT EXISTS aliases (
      alias TEXT PRIMARY KEY,
      slug  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_alias_slug ON aliases(slug);
  `);
  return db;
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
  db.prepare(`INSERT INTO centros (slug, estado, codigo_hash, dados, criado)
              VALUES (?, 'pendente', ?, ?, ?)`)
    .run(slug, hash(codigo), JSON.stringify(dados), Date.now());
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
  db.prepare('UPDATE centros SET dados = ?, publicado = ? WHERE slug = ?')
    .run(JSON.stringify(dados), Date.now(), slug);
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

function contar() {
  const r = {};
  ESTADOS.forEach(e => {
    r[e] = db.prepare('SELECT COUNT(*) n FROM centros WHERE estado = ?').get(e).n;
  });
  return r;
}

module.exports = { abrir, criar, ler, existe, resolver, renomear, publicar,
                   decidir, listar, contar, novoCodigo, codigoConfere, ESTADOS };
