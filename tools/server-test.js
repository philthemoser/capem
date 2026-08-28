#!/usr/bin/env node
/* ============================================================================
 * Testes do servidor das páginas de necessidades
 *
 * O que estes testes existem para apanhar, por ordem de importância:
 *
 * 1. UMA PÁGINA QUE MENTE SOBRE A SUA IDADE. É a falha que manda um vizinho
 *    carregar cinco quilos de arroz até um centro que já não os quer. Uma
 *    página web parece sempre nova; tem de dizer quando não é.
 * 2. AS MARCAS TÊM DE CHEGAR AO ECRÃ. Se a página sair só com texto, perde-se
 *    a razão de existir do conjunto de ícones — quem não lê português fica
 *    sem nada.
 * 3. O QUE FOI VERIFICADO À MÃO NÃO PODE SER MUDADO POR UM POST. Se publicar
 *    pudesse reescrever a morada, a aprovação não valia nada depois do
 *    primeiro envio.
 * 4. PÁGINAS NÃO APROVADAS NÃO ESTÃO NO AR.
 *
 * Correr: node tools/server-test.js
 * ==========================================================================*/
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

process.env.CAPEM_ADMIN = 'teste-'.repeat(4) + 'abcdef';
process.env.CAPEM_BASE = '';
const ADMIN = process.env.CAPEM_ADMIN;

const S = require(path.join(__dirname, '..', 'server', 'server.js'));

let passou = 0, falhou = 0;
const ok = (nome, cond, extra) => {
  if (cond) { passou++; console.log(`  ok   ${nome}`); }
  else { falhou++; console.log(`  FALHA ${nome}${extra ? '  → ' + extra : ''}`); }
};

const DIA = 86400000;

(async () => {
  const ficheiro = path.join(os.tmpdir(), `capem-teste-${Date.now()}.db`);
  S.db.abrir(ficheiro);
  const servidor = S.criarServidor();
  await new Promise(r => servidor.listen(0, r));
  const base = `http://127.0.0.1:${servidor.address().port}`;

  const get = (p, h) => fetch(base + p, { redirect: 'manual', headers: h });
  const form = (p, obj) => fetch(base + p, {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(obj).toString()
  });
  const api = (p, obj) => fetch(base + p, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj)
  });

  console.log('\nentrada');
  let r = await get('/');
  let html = await r.text();
  ok('a página inicial responde', r.status === 200, String(r.status));
  ok('e explica o que é antes de pedir dados', /lista de hoje/i.test(html));
  ok('serve o kit em /kit', (await get('/kit')).status === 200);
  ok('serve as mesmas fontes do papel', (await get('/fontes.css')).status === 200);

  console.log('\npedir uma página');
  r = await form('/pedir', {
    nome: 'Paróquia São Sebastião', tipo: 'Ponto de arrecadação',
    endereco: 'R. Bento Gonçalves, 412 — Centro, Canoas/RS',
    horario: 'Todos os dias, 8h às 20h', contato: '(51) 99612-0044'
  });
  html = await r.text();
  ok('o pedido é aceite', r.status === 200, String(r.status));
  const codigo = (html.match(/class="codigo">([A-Z0-9-]+)</) || [])[1];
  ok('devolve um código', !!codigo, codigo);
  /* Sem O, I, S, 0, 1, 5: este código vai ser ditado ao telefone. */
  ok('sem caracteres que se confundem ao telefone', codigo && !/[OIS015]/.test(codigo), codigo);
  const slug = 'paroquia-sao-sebastiao';
  ok('o endereço é legível', html.includes(slug), slug);

  r = await form('/pedir', { nome: 'Paróquia São Sebastião', endereco: 'Outra rua, 1', contato: '(51) 90000-0000' });
  ok('um segundo centro com o mesmo nome não rouba o endereço',
    (await r.text()).includes(slug + '-2'));

  r = await form('/pedir', { nome: 'Sem telefone', endereco: 'Rua X' });
  ok('faltar o telefone é recusado', r.status === 400, String(r.status));

  console.log('\nantes de ser aprovada');
  r = await get('/' + slug);
  html = await r.text();
  ok('a página não está no ar', r.status === 404, String(r.status));
  ok('mas explica que está à espera', /ainda não está no ar/i.test(html));
  ok('e não é indexada', (r.headers.get('x-robots-tag') || '').includes('noindex'));

  r = await get(`/${slug}?codigo=${encodeURIComponent(codigo)}`);
  ok('o coordenador pode pré-ver com o seu código', r.status === 200, String(r.status));
  r = await get(`/${slug}?codigo=AAAA-BBBB`);
  ok('um código errado não abre a pré-visualização', r.status === 404, String(r.status));

  console.log('\npublicar');
  r = await api('/api/publicar', { slug, codigo: 'ZZZZ-9999', dados: { precisa: ['agua'] } });
  ok('código errado é recusado', r.status === 403, String(r.status));
  r = await api('/api/publicar', { slug: 'nao-existe', codigo, dados: {} });
  ok('centro inexistente é recusado', r.status === 404, String(r.status));

  r = await api('/api/publicar', {
    slug, codigo: codigo.toLowerCase().replace('-', ' '),
    dados: { precisa: ['agua', 'alimento', { texto: 'Luva de borracha', marca: 'botas' }],
             naoTraga: ['roupa-usada', 'moveis'], horario: 'Todos os dias, 8h às 18h' }
  });
  ok('o código funciona em minúsculas e com outro separador', r.status === 200, String(r.status));

  console.log('\no que a aprovação protege');
  r = await api('/api/publicar', {
    slug, codigo,
    dados: { nome: 'Centro Falso', endereco: 'Rua Inventada, 999',
             contato: '(00) 00000-0000', precisa: ['agua'] }
  });
  ok('publicar aceita a lista', r.status === 200, String(r.status));
  const guardado = S.db.ler(slug).dados;
  ok('mas não deixa mudar o nome verificado', guardado.nome === 'Paróquia São Sebastião', guardado.nome);
  ok('nem o endereço verificado', /Bento Gonçalves/.test(guardado.endereco), guardado.endereco);
  ok('nem o telefone verificado', guardado.contato === '(51) 99612-0044', guardado.contato);

  console.log('\naprovar');
  r = await get('/admin');
  ok('a fila não abre sem o segredo', r.status === 404, String(r.status));
  r = await get('/admin?t=' + encodeURIComponent(ADMIN));
  html = await r.text();
  ok('a fila abre com o segredo', r.status === 200, String(r.status));
  ok('e mostra o pedido', html.includes('Paróquia São Sebastião'));

  r = await form('/admin/decidir', { t: 'errado', slug, decisao: 'aprovado' });
  ok('não se aprova sem o segredo', r.status === 404, String(r.status));
  ok('e o centro continua pendente', S.db.ler(slug).estado === 'pendente');

  r = await form('/admin/decidir', { t: ADMIN, slug, decisao: 'aprovado' });
  ok('aprovar redireciona de volta à fila', r.status === 303, String(r.status));
  ok('e o centro fica aprovado', S.db.ler(slug).estado === 'aprovado');

  console.log('\na página pública');
  /* Republica com um item escrito à mão que tem marca escolhida — o passo
     anterior tinha reposto a lista, e o que se quer verificar aqui é que a
     marca escolhida no kit chega ao ecrã. */
  await api('/api/publicar', { slug, codigo, dados: {
    precisa: ['agua', 'alimento', { texto: 'Luva de borracha', marca: 'botas' }],
    naoTraga: ['roupa-usada', 'moveis'] } });
  r = await get('/' + slug);
  html = await r.text();
  ok('está no ar', r.status === 200, String(r.status));
  ok('mostra o nome do centro', html.includes('Paróquia São Sebastião'));
  /* A razão de existir do conjunto de ícones: quem não lê português tem de
     perceber a página na mesma. Texto sozinho não serve. */
  const svgs = (html.match(/<svg/g) || []).length;
  ok('desenha as marcas, não só palavras', svgs >= 6, String(svgs));
  ok('usa a marca escolhida à mão para o item livre',
    html.includes(require('../server/compartilhado').POR_ID.botas.d));
  ok('o telefone é um link que liga', /href="tel:\+?\d/.test(html));
  ok('traz a data da lista', /Lista de \d\d\/\d\d/.test(html));
  ok('e o "não traga" continua lá', /não traga/i.test(html));

  console.log('\nidade da lista — o teste que evita uma viagem em vão');
  const idades = [
    [0, 'fresca', false], [3 * DIA, 'a-envelhecer', true], [30 * DIA, 'velha', true]
  ];
  for (const [atras, nivel, avisa] of idades) {
    S.db.publicar(slug, S.db.ler(slug).dados);
    const bd = require('node:sqlite');
    const conn = new bd.DatabaseSync(ficheiro);
    conn.prepare('UPDATE centros SET publicado = ? WHERE slug = ?')
      .run(Date.now() - atras, slug);
    conn.close();
    html = await (await get('/' + slug)).text();
    const dias = Math.round(atras / DIA);
    ok(`lista de ${dias} dia(s) é classificada "${nivel}"`,
      require('../server/pagina').idade(Date.now() - atras).nivel === nivel);
    ok(`e ${avisa ? 'avisa' : 'não avisa'} na página`,
      /class="idade/.test(html) === avisa);
  }
  html = await (await get('/' + slug)).text();
  ok('uma lista velha manda ligar antes de vir', /ligue antes/i.test(html));

  console.log('\npausa');
  await api('/api/publicar', { slug, codigo, dados: { precisa: ['agua'], pausado: true,
    motivoPausa: 'Estamos cheios.' } });
  html = await (await get('/' + slug)).text();
  ok('a pausa substitui a lista', /não estamos recebendo/i.test(html) && !/class="bloco-precisa"/.test(html));
  ok('mas mantém o "não traga"', /class="bloco-nao"/.test(html));
  await api('/api/publicar', { slug, codigo, dados: { precisa: ['agua'], pausado: false } });

  console.log('\nrecusar');
  const slug2 = slug + '-2';
  await form('/admin/decidir', { t: ADMIN, slug: slug2, decisao: 'recusado' });
  ok('um centro recusado não vai para o ar', (await get('/' + slug2)).status === 404);

  console.log('\ndefesas simples');
  r = await api('/api/publicar', { slug, codigo, dados: {
    nome: 'x'.repeat(500), precisa: new Array(200).fill('agua') } });
  const d = S.db.ler(slug).dados;
  ok('a lista é cortada a um tamanho sensato', d.precisa.length <= 24, String(d.precisa.length));
  r = await api('/api/publicar', { slug, codigo, dados: {
    precisa: [{ texto: '<script>alert(1)</script>', marca: 'caixa' }] } });
  html = await (await get('/' + slug)).text();
  ok('nada do que é publicado vira HTML', !html.includes('<script>alert'));
  ok('e sai escapado', html.includes('&lt;script&gt;'));

  r = await get('/nao/existe/nada');
  ok('um caminho desconhecido dá 404', r.status === 404, String(r.status));

  /* Sem CAPEM_BASE, os endereços têm de sair do pedido. Um "localhost:8080"
     impresso num QR não se corrige depois de estar colado a cem portas. */
  html = await (await get('/' + slug)).text();
  ok('os links usam o endereço por onde o pedido chegou',
    html.includes('127.0.0.1') && !html.includes('localhost:8080'),
    (html.match(/https?:\/\/[^"< ]+/) || [])[0]);
  html = await (await get('/' + slug, { 'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'capem.org' })).text();
  ok('e respeitam o proxy à frente', html.includes('https://capem.org/' + slug),
    (html.match(/https?:\/\/[^"< ]+/) || [])[0]);

  servidor.close();

  /* -------------------------------------------------------------------------
   * SUBDOMÍNIOS
   *
   * As duas formas têm de responder sempre — um endereço já impresso não se
   * corrige. O que muda com CAPEM_ESTILO é qual delas é a canónica: a que sai
   * no QR, e para a qual a outra redireciona.
   * -----------------------------------------------------------------------*/
  for (const estilo of ['caminho', 'subdominio']) {
    console.log(`\nsubdomínios · estilo "${estilo}"`);
    /* O módulo lê as variáveis ao ser carregado, por isso recarrega-se. */
    delete require.cache[require.resolve('../server/server.js')];
    delete require.cache[require.resolve('../server/pagina.js')];
    process.env.CAPEM_DOMINIO = 'capem.org';
    process.env.CAPEM_ESTILO = estilo;
    const S2 = require('../server/server.js');
    S2.db.abrir(ficheiro);
    const srv2 = S2.criarServidor();
    await new Promise(res2 => srv2.listen(0, res2));
    const b2 = `http://127.0.0.1:${srv2.address().port}`;
    /* `Host` é um cabeçalho proibido no fetch do Node, e em produção há sempre
       um proxy à frente — por isso o servidor lê X-Forwarded-Host, e é isso
       que se testa. */
    const comHost = (p, host) => fetch(b2 + p, { redirect: 'manual',
      headers: { 'X-Forwarded-Host': host } });

    const porSub = await comHost('/', `${slug}.capem.org`);
    const porCaminho = await comHost('/' + slug, 'capem.org');

    if (estilo === 'caminho') {
      ok('o subdomínio redireciona para o caminho', porSub.status === 301, String(porSub.status));
      ok('e aponta para o endereço certo',
        porSub.headers.get('location') === `http://capem.org/${slug}`,
        porSub.headers.get('location'));
      ok('o caminho serve a página', porCaminho.status === 200, String(porCaminho.status));
      ok('e o endereço impresso é o caminho',
        (await porCaminho.text()).includes(`capem.org/${slug}`));
    } else {
      ok('o subdomínio serve a página', porSub.status === 200, String(porSub.status));
      ok('o caminho redireciona para o subdomínio', porCaminho.status === 301, String(porCaminho.status));
      ok('e aponta para o endereço certo',
        porCaminho.headers.get('location') === `http://${slug}.capem.org`,
        porCaminho.headers.get('location'));
      ok('e o endereço impresso é o subdomínio',
        (await porSub.text()).includes(`${slug}.capem.org`));
    }

    /* Um centro chamado "admin" seria um convite; e o kit, a fila e as fontes
       vivem no domínio de topo, não num subdomínio de centro. */
    ok('"admin" nunca é tratado como centro', S2.slugDoAnfitriao({ headers: { host: 'admin.capem.org' } }) === null);
    ok('"www" nunca é tratado como centro', S2.slugDoAnfitriao({ headers: { host: 'www.capem.org' } }) === null);
    ok('um domínio estranho não é tratado como centro',
      S2.slugDoAnfitriao({ headers: { host: 'capem.org.mau.example' } }) === null);
    ok('um subdomínio de dois níveis não é tratado como centro',
      S2.slugDoAnfitriao({ headers: { host: 'a.b.capem.org' } }) === null);

    const kitNoSub = await comHost('/kit', `${slug}.capem.org`);
    ok('o kit pedido a um subdomínio volta ao domínio de topo',
      kitNoSub.status === 301 && kitNoSub.headers.get('location') === 'http://capem.org/kit',
      `${kitNoSub.status} ${kitNoSub.headers.get('location')}`);

    const pub = await fetch(b2 + '/api/publicar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-Host': 'capem.org' },
      body: JSON.stringify({ slug, codigo, dados: { precisa: ['agua'] } })
    });
    const j = await pub.json();
    ok('o kit recebe de volta o endereço canónico',
      j.url === (estilo === 'subdominio' ? `http://${slug}.capem.org` : `http://capem.org/${slug}`),
      j.url);

    srv2.close();
    delete process.env.CAPEM_DOMINIO;
    delete process.env.CAPEM_ESTILO;
  }

  fs.unlinkSync(ficheiro);
  console.log(`\n${passou} passaram · ${falhou} falharam\n`);
  process.exit(falhou ? 1 : 0);
})();
