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
  /* Duas portas e nada mais: quem chega tem alguma coisa para dar, ou está a
     montar um centro. Um formulário aqui obrigava a primeira — que aparece às
     centenas — a passar por cima da segunda. */
  ok('mostra as duas portas', /href="\/centros"/.test(html) && /href="\/centro"/.test(html));
  ok('e não pede dados logo à entrada', !/<form/.test(html));

  /* A porta de quem gere um centro: faltava, e sem ela quem já tinha página
     tinha de saber escrever /kit de cor. */
  r = await get('/centro');
  html = await r.text();
  ok('a porta do centro responde', r.status === 200, String(r.status));
  ok('e oferece o material impresso e o pedido de página',
    /href="\/kit"/.test(html) && /href="\/novo"/.test(html));
  ok('serve o kit em /kit', (await get('/kit')).status === 200);
  ok('serve as mesmas fontes do papel', (await get('/fontes.css')).status === 200);

  console.log('\nlista de centros');
  r = await get('/centros');
  html = await r.text();
  ok('a lista responde mesmo vazia', r.status === 200, String(r.status));
  ok('e diz o que fazer quando não há nada', /ainda não há centros/i.test(html));

  console.log('\npedir uma página');
  r = await get('/novo');
  ok('o formulário vive na sua própria página', r.status === 200 && /<form/.test(await r.text()));
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

  /* O código aparece uma vez e mais nenhuma. Um papel colado à parede de um
     ginásio perde-se, e quem entra ao turno seguinte não viu este ecrã — por
     isso há como o mandar para onde ele vai ser procurado. Sem servidor de
     e-mail, sem domínio com SPF, e sem guardar mais um dado pessoal. */
  ok('a página do código oferece mandá-lo no WhatsApp', /wa\.me\/\?text=/.test(html));
  const waCod = decodeURIComponent(((html.match(/href="([^"]*wa\.me[^"]*)"/) || [])[1] || '')
    .replace(/&amp;/g, '&').split('text=')[1] || '');
  ok('a mensagem leva o código', waCod.includes(codigo), waCod.slice(0, 60));
  /* Fora de contexto, uma semana depois, para alguém que não pediu a página:
     oito caracteres soltos não dizem nada. */
  ok('e diz de que centro é', waCod.includes('Paróquia São Sebastião'));
  ok('e onde se usa', waCod.includes('/atualizar'));


  r = await form('/pedir', { nome: 'Paróquia São Sebastião', endereco: 'Outra rua, 1', contato: '(51) 90000-0000' });
  ok('um segundo centro com o mesmo nome não rouba o endereço',
    (await r.text()).includes(slug + '-2'));

  r = await form('/pedir', { nome: 'Sem telefone', endereco: 'Rua X' });
  html = await r.text();
  ok('faltar o telefone é recusado', r.status === 400, String(r.status));
  /* Devolver o formulário com o aviso, não uma página de erro sem saída. */
  ok('e devolve o formulário com o aviso', /<form/.test(html) && /obrigatórios/.test(html));

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

  ok('a fila deixa editar o endereço antes de aprovar', /name="novo_slug"/.test(html));

  /* Um campo de endereço vazio, ou só com pontuação, tem de ser "não mexer".
     O recurso do gerador de slugs é "centro" — sem esta guarda, aprovar sem
     tocar no campo renomeava o centro para /centro. */
  for (const vazio of ['', '   ', '!!!', '---']) {
    r = await form('/admin/decidir', { t: ADMIN, slug, decisao: 'aprovado', novo_slug: vazio });
    ok(`endereço "${vazio || '(vazio)'}" não renomeia nada`, !!S.db.ler(slug), 'renomeou');
    S.db.decidir(slug, 'pendente');
  }

  r = await form('/admin/decidir', { t: ADMIN, slug, decisao: 'aprovado' });
  ok('aprovar redireciona de volta à fila', r.status === 303, String(r.status));
  ok('e o centro fica aprovado', S.db.ler(slug).estado === 'aprovado');

  console.log('\nencurtar o endereço na aprovação');
  /* O ponto: "paroquia-sao-sebastiao" é longo de ditar; "canoas-ss" não é.
     Mas o endereço antigo pode já estar impresso. */
  S.db.decidir(slug, 'pendente');
  r = await form('/admin/decidir', { t: ADMIN, slug, decisao: 'aprovado', novo_slug: 'Canoas SS' });
  ok('renomear aceita texto e faz o slug', !!S.db.ler('canoas-ss'), 'não renomeou');
  ok('e o centro fica aprovado no novo endereço',
    S.db.ler('canoas-ss') && S.db.ler('canoas-ss').estado === 'aprovado');
  ok('o endereço antigo já não é o centro', S.db.ler(slug) === null);

  r = await get('/' + slug);
  ok('mas o endereço antigo continua a responder', r.status === 301, String(r.status));
  ok('e manda para o novo', /\/canoas-ss$/.test(r.headers.get('location') || ''),
    r.headers.get('location'));

  r = await api('/api/publicar', { slug, codigo, dados: { precisa: ['agua'] } });
  ok('publicar pelo endereço antigo continua a funcionar', r.status === 200, String(r.status));
  ok('e devolve o novo endereço', (await r.json()).slug === 'canoas-ss');

  /* Um alias a apontar para si próprio faria um ciclo de redireccionamentos. */
  r = await get('/canoas-ss');
  ok('o endereço novo serve a página, sem ciclo', r.status === 200, String(r.status));

  r = await form('/admin/decidir', { t: ADMIN, slug: 'canoas-ss', decisao: 'aprovado', novo_slug: 'admin' });
  ok('não se pode renomear para um nome reservado', !!S.db.ler('canoas-ss'));

  const slugFinal = 'canoas-ss';

  console.log('\na página pública');
  /* Republica com um item escrito à mão que tem marca escolhida — o passo
     anterior tinha reposto a lista, e o que se quer verificar aqui é que a
     marca escolhida no kit chega ao ecrã. */
  await api('/api/publicar', { slug: slugFinal, codigo, dados: {
    precisa: ['agua', 'alimento', { texto: 'Luva de borracha', marca: 'botas' }],
    naoTraga: ['roupa-usada', 'moveis'] } });
  r = await get('/' + slugFinal);
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
    S.db.publicar(slugFinal, S.db.ler(slugFinal).dados);
    const bd = require('node:sqlite');
    const conn = new bd.DatabaseSync(ficheiro);
    conn.prepare('UPDATE centros SET publicado = ? WHERE slug = ?')
      .run(Date.now() - atras, slugFinal);
    conn.close();
    html = await (await get('/' + slugFinal)).text();
    const dias = Math.round(atras / DIA);
    ok(`lista de ${dias} dia(s) é classificada "${nivel}"`,
      require('../server/pagina').idade(Date.now() - atras).nivel === nivel);
    ok(`e ${avisa ? 'avisa' : 'não avisa'} na página`,
      /class="idade/.test(html) === avisa);
  }
  html = await (await get('/' + slugFinal)).text();
  ok('uma lista velha manda ligar antes de vir', /ligue antes/i.test(html));

  console.log('\npausa');
  await api('/api/publicar', { slug: slugFinal, codigo, dados: { precisa: ['agua'], pausado: true,
    motivoPausa: 'Estamos cheios.' } });
  html = await (await get('/' + slugFinal)).text();
  ok('a pausa substitui a lista', /não estamos recebendo/i.test(html) && !/class="bloco-precisa"/.test(html));
  ok('mas mantém o "não traga"', /class="bloco-nao"/.test(html));
  await api('/api/publicar', { slug: slugFinal, codigo, dados: { precisa: ['agua'], pausado: false } });

  console.log('\nordem da lista de centros');
  /* Cria três vizinhos para poder verificar a ordem sem depender do resto. */
  for (const [nm, dias, pausa] of [['AAA Fresco', 0, false], ['AAA Pausado', 0, true],
                                    ['AAA Velho', 30, false]]) {
    const sl = S.fazerSlug(nm);
    if (!S.db.existe(sl)) {
      S.db.criar(sl, { nome: nm, tipo: 'Ponto de arrecadação', endereco: 'Rua Teste, 1',
        contato: '(51) 90000-0000', precisa: ['agua'], naoTraga: ['roupa-usada'],
        pausado: pausa, motivoPausa: pausa ? 'Cheios.' : '' });
      S.db.decidir(sl, 'aprovado');
      S.db.publicar(sl, S.db.ler(sl).dados);
      const c2 = new (require('node:sqlite').DatabaseSync)(ficheiro);
      c2.prepare('UPDATE centros SET publicado=? WHERE slug=?')
        .run(Date.now() - dias * DIA, sl);
      c2.close();
    }
  }
  html = await (await get('/centros')).text();
  const pos = n => html.indexOf('>' + n + '<');
  ok('quem recebe vem antes de quem está em pausa',
    pos('AAA Fresco') < pos('AAA Pausado'),
    `fresco@${pos('AAA Fresco')} pausado@${pos('AAA Pausado')}`);
  ok('e uma lista velha vai para o fim',
    pos('AAA Pausado') < pos('AAA Velho'),
    `pausado@${pos('AAA Pausado')} velho@${pos('AAA Velho')}`);
  ok('a pausa é dita na lista', /Não está recebendo agora/.test(html));
  /* Contar <svg> na página inteira apanharia o favicon e diria pouco. O que
     interessa é que cada centro que está a receber traga as suas marcas —
     é isso que deixa correr a lista com os olhos sem ler uma palavra. */
  const comMarcas = (html.match(/class="c-marcas"/g) || []).length;
  const aReceber = (html.match(/class="c-item [^"]*"/g) || []).length
    - (html.match(/class="c-pausa"/g) || []).length;
  ok('cada centro que recebe mostra as suas marcas', comMarcas === aReceber && comMarcas >= 3,
    `${comMarcas} com marcas, ${aReceber} a receber`);

  console.log('\nprocurar, filtrar, ordenar');
  /* Um vizinho com cobertores no carro não escreve o nome de um centro: escreve
     "cobertor". Se a procura só vir nomes e moradas, a página não responde à
     única pergunta que essa pessoa tem. */
  const q = async qs => (await get('/centros?' + qs)).text();
  const tem = (h, n) => h.indexOf('>' + n + '<') >= 0;

  S.db.criar('proc-cobertores', { nome: 'Abrigo Dos Cobertores', tipo: 'Ponto de arrecadação',
    endereco: 'Avenida Água Branca, 9', contato: '(51) 90000-0001',
    precisa: ['cobertor', 'agua'], naoTraga: [] });
  S.db.decidir('proc-cobertores', 'aprovado');
  S.db.publicar('proc-cobertores', S.db.ler('proc-cobertores').dados);

  S.db.criar('proc-racao', { nome: 'Ponto Zona Sul', tipo: 'Ponto de arrecadação',
    endereco: 'Rua Central, 2', contato: '(51) 90000-0002',
    precisa: [{ texto: 'Ração para cães', marca: 'caixa' }], naoTraga: [] });
  S.db.decidir('proc-racao', 'aprovado');
  S.db.publicar('proc-racao', S.db.ler('proc-racao').dados);

  html = await q('q=cobertor');
  ok('procurar por um item encontra quem o pede', tem(html, 'Abrigo Dos Cobertores'));
  ok('e deixa de fora quem não o pede', !tem(html, 'Ponto Zona Sul'));

  /* O item escrito à mão conta tanto como os do catálogo: é onde estão as
     necessidades que ninguém previu, e é exactamente o que se procura. */
  ok('um item escrito à mão também se procura',
    tem(await q('q=racao'), 'Ponto Zona Sul'));

  /* Acentos dos dois lados. Quem escreve de pé, à chuva, não escreve "água". */
  ok('sem acentos encontra com acentos', tem(await q('q=agua'), 'Abrigo Dos Cobertores'));
  ok('com acentos encontra na mesma', tem(await q('q=%C3%A1gua'), 'Abrigo Dos Cobertores'));
  ok('e maiúsculas não interessam', tem(await q('q=COBERTOR'), 'Abrigo Dos Cobertores'));

  /* Duas palavras estreitam, não alargam — senão escrever mais piora. */
  html = await q('q=cobertor+branca');
  ok('duas palavras exigem as duas', tem(html, 'Abrigo Dos Cobertores'));
  ok('e uma palavra que não bate elimina o centro',
    !tem(await q('q=cobertor+inexistente'), 'Abrigo Dos Cobertores'));

  html = await q('q=zzzznada');
  ok('sem resultados diz que não há e oferece a saída',
    /Nenhum centro com isso/.test(html) && /href="\/centros"/.test(html));

  /* A pergunta não pode desaparecer da caixa: quem não vê o que procurou não
     sabe se procurou o que queria. */
  ok('a procura fica escrita na caixa', /name="q"[^>]*value="cobertor"/.test(await q('q=cobertor')));

  html = await q('aceitando=1');
  ok('"só quem está recebendo" tira os pausados', !tem(html, 'AAA Pausado'));
  ok('e mantém os outros', tem(html, 'AAA Fresco'));
  ok('e a caixa fica marcada', /name="aceitando"[^>]*checked/.test(html));

  html = await q('recentes=1');
  ok('"só listas da última semana" tira as velhas', !tem(html, 'AAA Velho'));

  html = await q('ordem=nome');
  ok('ordenar por nome ordena por nome',
    html.indexOf('>AAA Fresco<') < html.indexOf('>Abrigo Dos Cobertores<'));
  ok('e a ordem escolhida fica escolhida', /value="nome" selected/.test(html));
  /* Um parâmetro inventado não pode partir a página nem escolher-se a si mesmo. */
  html = await q('ordem=' + encodeURIComponent("'; DROP TABLE centros; --"));
  ok('uma ordem inventada volta à predefinida',
    /value="uteis" selected/.test(html) && !/DROP TABLE/.test(html));

  /* Sem JavaScript isto tem de continuar a ser utilizável: é um formulário GET
     com um botão, e não uma lista que só se filtra no aparelho. */
  html = await q('');
  ok('os filtros são um formulário GET', /<form class="procura" method="get"/.test(html));
  ok('com um botão que os aplica sem JavaScript', /id="aplicar"/.test(html));

  console.log('\npáginas');
  /* O que motivou tudo isto: com mil centros a página inteira eram 1,6 MB, e
     ninguém numa rua com uma barra de rede espera por isso. */
  const antes = S.db.contar().aprovado;
  for (let i = 0; i < 45; i++) {
    const sl = 'pag-' + i;
    S.db.criar(sl, { nome: 'Paginado ' + String(i).padStart(2, '0'),
      tipo: 'Ponto de arrecadação', endereco: 'Rua Paginada, ' + i,
      contato: '(51) 90000-0000', precisa: ['agua'], naoTraga: [] });
    S.db.decidir(sl, 'aprovado');
    S.db.publicar(sl, S.db.ler(sl).dados);
  }
  const totalAgora = antes + 45;
  html = await q('ordem=nome');
  const naPagina = (html.match(/class="c-item /g) || []).length;
  ok('uma página traz no máximo 40 centros', naPagina <= 40, String(naPagina));
  ok('mas diz quantos há ao todo',
    html.includes(totalAgora + ' centros'), String(totalAgora));
  ok('e há um link para as seguintes', /rel="next"/.test(html));
  ok('sem link para trás na primeira', !/rel="prev"/.test(html));
  const p2 = await q('ordem=nome&p=2');
  ok('a segunda página tem centros diferentes',
    /rel="prev"/.test(p2) && (p2.match(/class="c-item /g) || []).length > 0 &&
    p2.indexOf('>AAA Fresco<') < 0);
  /* Uma página que não existe não pode ser um erro: alguém colou um link. */
  const p999 = await get('/centros?p=999');
  ok('uma página que não existe responde na mesma', p999.status === 200);

  /* E o tamanho, que é o número que interessa a quem está na rua. */
  const bytes = Buffer.byteLength(await q(''));
  ok('a página fica pequena o suficiente para uma rede má', bytes < 200000,
    Math.round(bytes / 1024) + ' KB com ' + totalAgora + ' centros');

  console.log('\natualizar a lista com o código');
  /* A página que se abre todas as manhãs, e a única cujo êxito se mede em
     segundos. Se esta não for usada, tudo o resto envelhece. */
  const formN = (p, obj) => {
    const u = new URLSearchParams();
    Object.entries(obj).forEach(([k, v]) =>
      Array.isArray(v) ? v.forEach(x => u.append(k, x)) : u.append(k, v));
    return fetch(base + p, { method: 'POST', redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: u.toString() });
  };

  r = await get('/atualizar');
  html = await r.text();
  ok('a entrada de atualização responde', r.status === 200, String(r.status));
  ok('e pede só endereço e código', /name="slug"/.test(html) && /name="codigo"/.test(html));

  r = await formN('/atualizar', { slug: slugFinal, codigo: 'ZZZZ-9999' });
  html = await r.text();
  ok('um código errado não abre a lista', r.status === 403, String(r.status));
  /* A mesma mensagem para código errado e centro inexistente: os centros são
     públicos, mas confirmar metade de um palpite não ajuda ninguém. */
  const msgErrada = /Endereço ou código errados/.test(html);
  r = await formN('/atualizar', { slug: 'nao-existe-de-todo', codigo: 'ZZZZ-9999' });
  ok('e diz o mesmo para um centro que não existe',
    msgErrada && /Endereço ou código errados/.test(await r.text()));

  r = await formN('/atualizar', { slug: slugFinal, codigo });
  html = await r.text();
  ok('o código certo abre a lista', r.status === 200, String(r.status));
  ok('com o nome do centro visível', html.includes('Paróquia São Sebastião'));
  /* O que foi verificado à mão aparece, mas não como campo: escrever por cima
     dava a entender que se podia mudar, e a publicação ignora-o na mesma. */
  ok('o nome não é um campo editável', !/name="nome"/.test(html));
  ok('nem a morada', !/name="endereco"/.test(html));
  ok('e a página diz porquê', /não se mudam aqui/.test(html));

  r = await formN('/atualizar', { slug: slugFinal, codigo, publicar: '1',
    precisa: ['cobertor', 'fralda'], 'q-cobertor': '20 caixas', 'q-fralda': '',
    livres: 'Ração para cães | 5 kg\nCarregador de telemóvel',
    naoTraga: ['roupa-usada'], horario: '9h às 17h' });
  html = await r.text();
  ok('publicar daqui funciona', r.status === 200 && /Publicado\./.test(html));
  const dep = S.db.ler(slugFinal).dados;
  ok('a lista é a que foi enviada', dep.precisa.length === 4, JSON.stringify(dep.precisa));
  ok('a quantidade sobrevive inteira',
    dep.precisa.some(x => x && x.q === '20 caixas'), JSON.stringify(dep.precisa));
  /* O `texto()` tira caracteres de controlo, e a mudança de linha é um deles.
     Limpar antes de dividir colava as doze linhas todas num item só — foi
     exactamente esse o erro, e é este teste que impede o regresso dele. */
  ok('cada linha escrita à mão é um item',
    dep.precisa.filter(x => x && x.texto).length === 2, JSON.stringify(dep.precisa));
  ok('e a quantidade depois da barra também',
    dep.precisa.some(x => x && x.texto === 'Ração para cães' && x.q === '5 kg'));
  ok('o horário muda', dep.horario === '9h às 17h', dep.horario);
  ok('mas o nome verificado continua intacto', dep.nome === 'Paróquia São Sebastião', dep.nome);
  ok('e o telefone verificado também', dep.contato === '(51) 99612-0044', dep.contato);

  /* Publicar uma lista vazia sem estar fechado é uma página que não responde à
     única pergunta que lhe fazem. Publica-se na mesma — é o coordenador que
     manda — mas ele tem de sair dali a saber. */
  r = await formN('/atualizar', { slug: slugFinal, codigo, publicar: '1', livres: '' });
  ok('uma lista vazia sem pausa é avisada', /lista vazia/.test(await r.text()));
  r = await formN('/atualizar', { slug: slugFinal, codigo, publicar: '1',
    pausado: '1', motivoPausa: 'Cheios.', livres: '' });
  ok('mas vazia e fechado não é erro nenhum', !/lista vazia/.test(await r.text()));
  ok('e o centro fica em pausa', S.db.ler(slugFinal).dados.pausado === true);

  /* O código volta ao formulário para a correcção seguinte não obrigar a
     escrevê-lo outra vez. Uma manhã tem mais do que uma correcção. */
  r = await formN('/atualizar', { slug: slugFinal, codigo });
  ok('o código fica no formulário para o envio seguinte',
    new RegExp('name="codigo" value="' + codigo + '"').test(await r.text()));

  console.log('\npuxar os dados para o kit');
  r = await api('/api/carregar', { slug: slugFinal, codigo: 'ZZZZ-9999' });
  ok('código errado não devolve nada', r.status === 403, String(r.status));
  r = await api('/api/carregar', { slug: 'nao-existe', codigo });
  ok('centro inexistente também não', r.status === 404, String(r.status));
  r = await api('/api/carregar', { slug: slugFinal, codigo });
  const carga = await r.json();
  ok('o código certo devolve os dados', r.status === 200, String(r.status));
  ok('com o nome que o kit não precisa de reescrever',
    carga.dados.nome === 'Paróquia São Sebastião', carga.dados && carga.dados.nome);
  ok('a morada e o telefone vêm juntos',
    /Bento Gonçalves/.test(carga.dados.endereco) && carga.dados.contato === '(51) 99612-0044');
  ok('e o endereço da página, para o QR se preencher sozinho',
    /\/(paroquia|canoas)/.test(carga.url || ''), carga.url);
  /* Nada de secreto sai daqui: é o que já está na página pública. O código diz
     QUAL centro, não destranca um segredo. */
  ok('não devolve o hash do código', !JSON.stringify(carga).includes('codigo_hash'));

  console.log('\navisos e empurrões');
  const A = require('../server/avisos.js');
  /* Um número escrito por uma pessoa não é um número que o WhatsApp aceite. */
  const tels = [
    ['(51) 99612-0044', '5551996120044'],
    ['51 99612-0044', '5551996120044'],
    ['+351 912 345 678', '351912345678'],
    ['5551996120044', '5551996120044'],
    ['', ''], ['sem número', '']
  ];
  tels.forEach(([bruto, esperado]) =>
    ok(`telefone "${bruto || '(vazio)'}" → ${esperado || '(nada)'}`,
      A.telefoneInternacional(bruto) === esperado, A.telefoneInternacional(bruto)));
  ok('sem telefone não há link', A.linkWhatsApp('', 'olá') === '');
  ok('o link leva a mensagem já escrita',
    /^https:\/\/wa\.me\/5551996120044\?text=/.test(A.linkWhatsApp('(51) 99612-0044', 'olá')));

  /* O aviso não pode partir um pedido: se o canal rebentar, o pedido segue. */
  const originais = { ...A.ADAPTADORES.webhook };
  process.env.CAPEM_WEBHOOK = 'http://127.0.0.1:1/nao-existe';
  /* Outro IP: a trava por pedido já gastou a quota deste durante os testes
     acima, e é ela que deve responder 429 — não o que se quer medir aqui. */
  r = await fetch(base + '/pedir', {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded',
               'X-Forwarded-For': '203.0.113.7' },
    body: new URLSearchParams({ nome: 'Centro Com Aviso', endereco: 'Rua Z, 9',
                                contato: '(51) 97777-0000' }).toString()
  });
  ok('um canal de avisos em baixo não impede um pedido', r.status === 200, String(r.status));
  ok('e o centro fica mesmo criado', !!S.db.ler('centro-com-aviso'));
  delete process.env.CAPEM_WEBHOOK;
  A.ADAPTADORES.webhook = originais;

  /* Um centro parado tem de aparecer na fila com um botão de empurrão. */
  const parado = 'centro-parado';
  S.db.criar(parado, { nome: 'Centro Parado', tipo: 'Abrigo', endereco: 'Rua Velha, 1',
    contato: '(51) 96666-0000', precisa: ['agua'], naoTraga: ['roupa-usada'] });
  S.db.decidir(parado, 'aprovado');
  S.db.publicar(parado, S.db.ler(parado).dados);
  const c3 = new (require('node:sqlite').DatabaseSync)(ficheiro);
  c3.prepare('UPDATE centros SET publicado=? WHERE slug=?').run(Date.now() - 9 * DIA, parado);
  c3.close();

  ok('a base sabe quem está parado',
    S.db.parados(3).some(c => c.slug === parado), 'não listou');
  ok('e não conta quem publicou hoje',
    !S.db.parados(3).some(c => c.slug === slugFinal), 'contou um fresco');

  html = await (await get('/admin?t=' + encodeURIComponent(ADMIN))).text();
  ok('a fila mostra quem precisa de um empurrão', /Precisam de um empurrão/.test(html));
  ok('com um botão de WhatsApp para o coordenador',
    /href="https:\/\/wa\.me\/5551966660000\?text=/.test(html));
  ok('e a mensagem nomeia o centro e a idade da lista',
    /Centro%20Parado|Centro\+Parado/.test(html) || /9%20dias|9\+dias/.test(html));

  /* O resumo sai no máximo uma vez por dia, mesmo com reinícios. */
  S.db.escreverEstado('ultimo_resumo', 0);
  const r1 = S.resumoDeParados('http://teste');
  ok('o resumo é enviado quando há parados', !!r1 && /parado/i.test(r1.titulo), JSON.stringify(r1));
  const r2 = S.resumoDeParados('http://teste');
  ok('e não se repete no mesmo dia', r2 === null, JSON.stringify(r2));

  console.log('\nquantidades');
  /* Um número só vive onde pode ser corrigido: a página do centro. O papel e
     as imagens levam a lista e o link, nunca o número. */
  await api('/api/publicar', { slug: slugFinal, codigo, dados: {
    precisa: [{ id: 'cobertor', q: '200' }, 'agua', { texto: 'Luva', marca: 'botas', q: '20' }],
    naoTraga: ['roupa-usada'] } });
  const guardadoQ = S.db.ler(slugFinal).dados.precisa;
  ok('a quantidade sobrevive à publicação',
    guardadoQ[0] && guardadoQ[0].q === '200', JSON.stringify(guardadoQ[0]));
  ok('um item sem quantidade continua a ser só o id',
    guardadoQ[1] === 'agua', JSON.stringify(guardadoQ[1]));
  ok('e um item escrito à mão pode ter as duas coisas',
    guardadoQ[2] && guardadoQ[2].marca === 'botas' && guardadoQ[2].q === '20',
    JSON.stringify(guardadoQ[2]));

  html = await (await get('/' + slugFinal)).text();
  ok('a página mostra a quantidade', /class="q">200</.test(html));
  ok('e o texto de partilha também', /Cobertor%20%E2%80%94%20200|Cobertor\s—\s200/.test(html));

  /* Um número comprido demais seria uma frase dentro de uma grelha de marcas. */
  await api('/api/publicar', { slug: slugFinal, codigo, dados: {
    precisa: [{ id: 'cobertor', q: 'duzentos mil cobertores por favor' }],
    naoTraga: ['roupa-usada'] } });
  /* Contra a constante e não contra um número escrito à mão: o limite já viveu
     em cinco sítios com dois valores diferentes, e "20 caixas" — o exemplo que
     o próprio texto de ajuda dá — não cabia nos oito que aqui estavam. */
  const { MAX_Q } = require('../server/compartilhado');
  ok('uma quantidade comprida é cortada',
    S.db.ler(slugFinal).dados.precisa[0].q.length <= MAX_Q,
    S.db.ler(slugFinal).dados.precisa[0].q);
  ok('mas "20 caixas" cabe inteiro', MAX_Q >= '20 caixas'.length, String(MAX_Q));
  await api('/api/publicar', { slug: slugFinal, codigo, dados: {
    precisa: ['agua', 'alimento', { texto: 'Luva de borracha', marca: 'botas' }],
    naoTraga: ['roupa-usada', 'moveis'] } });

  console.log('\npartilhar');
  html = await (await get('/' + slugFinal)).text();
  ok('a página tem um botão de partilha', /id="b-wa"/.test(html));
  ok('que manda o link e não uma imagem', /wa\.me\/\?text=/.test(html) &&
    /Lista%20sempre%20atualizada|Lista\+sempre\+atualizada/.test(html));

  console.log('\nrecusar');
  const slug2 = slug + '-2';
  await form('/admin/decidir', { t: ADMIN, slug: slug2, decisao: 'recusado' });
  ok('um centro recusado não vai para o ar', (await get('/' + slug2)).status === 404);

  console.log('\ndefesas simples');
  r = await api('/api/publicar', { slug: slugFinal, codigo, dados: {
    nome: 'x'.repeat(500), precisa: new Array(200).fill('agua') } });
  const d = S.db.ler(slugFinal).dados;
  ok('a lista é cortada a um tamanho sensato', d.precisa.length <= 24, String(d.precisa.length));
  r = await api('/api/publicar', { slug: slugFinal, codigo, dados: {
    precisa: [{ texto: '<script>alert(1)</script>', marca: 'caixa' }] } });
  html = await (await get('/' + slugFinal)).text();
  ok('nada do que é publicado vira HTML', !html.includes('<script>alert'));
  ok('e sai escapado', html.includes('&lt;script&gt;'));

  r = await get('/nao/existe/nada');
  ok('um caminho desconhecido dá 404', r.status === 404, String(r.status));

  /* Sem CAPEM_BASE, os endereços têm de sair do pedido. Um "localhost:8080"
     impresso num QR não se corrige depois de estar colado a cem portas. */
  html = await (await get('/' + slugFinal)).text();
  ok('os links usam o endereço por onde o pedido chegou',
    html.includes('127.0.0.1') && !html.includes('localhost:8080'),
    (html.match(/https?:\/\/[^"< ]+/) || [])[0]);
  html = await (await get('/' + slugFinal, { 'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'capem.org' })).text();
  ok('e respeitam o proxy à frente', html.includes('https://capem.org/' + slugFinal),
    (html.match(/https:\/\/capem[^"< ]*/) || [])[0]);

  let novoCod;
  console.log('\nemitir um código novo');
  /* "Perdi o código" é o pedido de ajuda mais provável que esta ferramenta vai
     receber. Até aqui a única resposta era mexer na base de dados à mão. */
  html = await (await get('/admin?t=' + encodeURIComponent(ADMIN))).text();
  ok('a fila oferece emitir um código novo', /action="\/admin\/recodigo"/.test(html));
  ok('e diz para confirmar ao telefone primeiro', /confirmar ao telefone/.test(html));

  r = await form('/admin/recodigo', { t: 'errado', slug: slugFinal });
  ok('não se emite sem o segredo', r.status === 404, String(r.status));
  ok('e o código antigo continua a valer',
    (await api('/api/publicar', { slug: slugFinal, codigo, dados: { precisa: ['agua'] } })).status === 200);

  r = await form('/admin/recodigo', { t: ADMIN, slug: slugFinal });
  html = await r.text();
  ok('com o segredo, emite', r.status === 200, String(r.status));
  novoCod = (html.match(/class="codigo">([A-Z0-9-]+)</) || [])[1];
  ok('e mostra o código novo', !!novoCod && novoCod !== codigo, novoCod);
  ok('sem caracteres que se confundem ao telefone',
    novoCod && !/[OIS015]/.test(novoCod), novoCod);
  ok('diz que o anterior deixou de funcionar', /deixou de funcionar/.test(html));
  /* O problema a seguir a "perdi o código" é o mesmo: fazê-lo chegar a quem
     está de turno. */
  ok('e oferece mandá-lo no WhatsApp', /wa\.me\/\?text=/.test(html));

  /* A parte que interessa: invalidar não é um efeito secundário, é metade da
     razão de existir. Um código perdido pode estar perdido PARA ALGUÉM. */
  r = await api('/api/publicar', { slug: slugFinal, codigo, dados: { precisa: ['agua'] } });
  ok('o código antigo deixa mesmo de publicar', r.status === 403, String(r.status));
  r = await api('/api/publicar', { slug: slugFinal, codigo: novoCod,
    dados: { precisa: ['agua'], naoTraga: ['roupa-usada'] } });
  ok('e o novo publica', r.status === 200, String(r.status));
  /* Emitir um código não é aprovar nem mexer no que foi verificado à mão. */
  const depois = S.db.ler(slugFinal);
  ok('o centro continua aprovado', depois.estado === 'aprovado', depois.estado);
  ok('e o nome verificado continua intacto',
    depois.dados.nome === 'Paróquia São Sebastião', depois.dados.nome);

  r = await form('/admin/recodigo', { t: ADMIN, slug: 'nao-existe-nenhum' });
  ok('um centro que não existe não rebenta a página',
    r.status === 303 || r.status === 200, String(r.status));


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

    const porSub = await comHost('/', `${slugFinal}.capem.org`);
    const porCaminho = await comHost('/' + slugFinal, 'capem.org');

    if (estilo === 'caminho') {
      ok('o subdomínio redireciona para o caminho', porSub.status === 301, String(porSub.status));
      ok('e aponta para o endereço certo',
        porSub.headers.get('location') === `http://capem.org/${slugFinal}`,
        porSub.headers.get('location'));
      ok('o caminho serve a página', porCaminho.status === 200, String(porCaminho.status));
      ok('e o endereço impresso é o caminho',
        (await porCaminho.text()).includes(`capem.org/${slugFinal}`));
    } else {
      ok('o subdomínio serve a página', porSub.status === 200, String(porSub.status));
      ok('o caminho redireciona para o subdomínio', porCaminho.status === 301, String(porCaminho.status));
      ok('e aponta para o endereço certo',
        porCaminho.headers.get('location') === `http://${slugFinal}.capem.org`,
        porCaminho.headers.get('location'));
      ok('e o endereço impresso é o subdomínio',
        (await porSub.text()).includes(`${slugFinal}.capem.org`));
    }

    /* Um centro chamado "admin" seria um convite; e o kit, a fila e as fontes
       vivem no domínio de topo, não num subdomínio de centro. */
    ok('"admin" nunca é tratado como centro', S2.slugDoAnfitriao({ headers: { host: 'admin.capem.org' } }) === null);
    ok('"www" nunca é tratado como centro', S2.slugDoAnfitriao({ headers: { host: 'www.capem.org' } }) === null);
    ok('um domínio estranho não é tratado como centro',
      S2.slugDoAnfitriao({ headers: { host: 'capem.org.mau.example' } }) === null);
    ok('um subdomínio de dois níveis não é tratado como centro',
      S2.slugDoAnfitriao({ headers: { host: 'a.b.capem.org' } }) === null);

    const kitNoSub = await comHost('/kit', `${slugFinal}.capem.org`);
    ok('o kit pedido a um subdomínio volta ao domínio de topo',
      kitNoSub.status === 301 && kitNoSub.headers.get('location') === 'http://capem.org/kit',
      `${kitNoSub.status} ${kitNoSub.headers.get('location')}`);

    const pub = await fetch(b2 + '/api/publicar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-Host': 'capem.org' },
      /* `novoCod` e não `codigo`: a secção anterior emitiu um código novo e
         invalidou o antigo, que é precisamente o que ela testa. */
      body: JSON.stringify({ slug: slugFinal, codigo: novoCod, dados: { precisa: ['agua'] } })
    });
    const j = await pub.json();
    ok('o kit recebe de volta o endereço canónico',
      j.url === (estilo === 'subdominio' ? `http://${slugFinal}.capem.org` : `http://capem.org/${slugFinal}`),
      j.url);

    srv2.close();
    delete process.env.CAPEM_DOMINIO;
    delete process.env.CAPEM_ESTILO;
  }

  fs.unlinkSync(ficheiro);
  console.log(`\n${passou} passaram · ${falhou} falharam\n`);
  process.exit(falhou ? 1 : 0);
})();
