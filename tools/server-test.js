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
  /* O menu tem as MESMAS duas portas e mais nenhuma. Chegou a ter três —
     ajudar, atualizar, imprimir — e o problema não era o nome do meio: era
     misturar dois públicos na mesma fila, e pôr uma tarefa (imprimir) ao lado
     de quem a contém (o centro). Duas portas é também a forma que aguenta o
     código do saco e o donativo de um lado, e receber sacos do outro. */
  {
    const h = await (await get('/centros')).text();
    const links = (h.match(/<div class="nav-links">([\s\S]*?)<\/div>/) || [])[1] || '';
    const quantos = (links.match(/<a /g) || []).length;
    ok('o menu tem duas portas e mais nenhuma', quantos === 2, String(quantos));
    ok('e são ajudar e o centro',
      /href="\/centros"/.test(links) && /href="\/centro"/.test(links), links.trim().slice(0, 120));
    ok('nada de tarefas soltas no menu',
      !/href="\/kit"/.test(links) && !/href="\/atualizar"/.test(links));
    /* Registo consistente: "Quero ajudar" e "Meu centro" são os dois a voz de
       quem chega. Misturar primeira pessoa com imperativo lia-se como acaso. */
    ok('e o registo é o mesmo nos dois', /Quero ajudar/.test(links) && /Meu centro/.test(links));
  }
  /* As páginas do lado do centro marcam a porta do centro, não uma tarefa. */
  ok('a página de atualizar marca "Meu centro" no menu',
    /href="\/centro" aria-current="page"/.test(await (await get('/atualizar')).text()));
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
  html = await r.text();
  ok('o formulário vive na sua própria página', r.status === 200 && /<form/.test(html));

  /* A página de resposta deixou de prometer um código no mesmo instante em que
     o código passou a nascer na aprovação, mas as páginas que levam até aqui
     ficaram a dizer "recebe o código na hora" durante semanas — o convite e a
     promessa vivem em ficheiros diferentes e ninguém os lê ao mesmo tempo. Isto
     compara-os: nenhuma porta para o pedido pode prometer o que só a aprovação
     entrega. */
  const promete = /c[óo]digo na hora|um c[óo]digo na hora|recebe (o|um) c[óo]digo/i;
  ok('a página do pedido não promete um código na hora', !promete.test(html));
  ok('e a porta que leva até ela também não', !promete.test(await (await get('/centro')).text()));
  ok('nem o kit', !promete.test(fs.readFileSync(
    path.join(__dirname, '..', 'field', 'src', 'kit.template.html'), 'utf8')));
  r = await form('/pedir', {
    nome: 'Paróquia São Sebastião', tipo: 'Ponto de arrecadação',
    endereco: 'R. Bento Gonçalves, 412 — Centro, Canoas/RS',
    horario: 'Todos os dias, 8h às 20h', contato: '(51) 99612-0044'
  });
  html = await r.text();
  ok('o pedido é aceite', r.status === 200, String(r.status));
  const slug = 'paroquia-sao-sebastiao';
  let codigo;
  ok('o endereço é legível', html.includes(slug), slug);

  /* NÃO devolve código nenhum. Antes devolvia, e isso queria dizer que quem
     soubesse o nome de uma paróquia recebia na hora uma chave de escrita para
     uma página com esse nome — a aprovação travava a página, não a chave. */
  ok('mas NÃO devolve um código', !/class="codigo">[A-Z0-9]{4}-/.test(html));
  ok('e diz que o código chega depois, por WhatsApp',
    /código do centro/i.test(html) && /WhatsApp/.test(html));
  /* Não é um beco: imprimir nunca precisou de código, só do nome do centro. */
  ok('e manda imprimir entretanto', /href="\/kit"/.test(html));
  ok('e diz que o silêncio não é rejeição', /24 horas/.test(html));
  ok('a página não é servida como código guardado',
    S.db.ler(slug).codigo_hash === '', S.db.ler(slug).codigo_hash.slice(0, 12));


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

  /* Um centro por aprovar não tem código nenhum, por isso não há
     pré-visualização para abrir — e sobretudo, um palpite não pode abri-la. */
  r = await get(`/${slug}?codigo=AAAA-BBBB`);
  ok('um palpite não abre uma página por aprovar', r.status === 404, String(r.status));
  ok('e um código vazio também não',
    (await get(`/${slug}?codigo=`)).status === 404);

  console.log('\naprovar');
  r = await get('/admin');
  ok('a fila não abre sem o segredo', r.status === 404, String(r.status));

  /* -------------------------------------------------------------------------
   * A SESSÃO
   *
   * O segredo já não fica no endereço: chegar com `?t=…` troca-o por um cookie
   * e redirecciona para `/admin` limpo. O link do Telegram continua a ser o
   * mesmo — muda o que fica no histórico do browser depois de o seguir.
   * -----------------------------------------------------------------------*/
  r = await get('/admin?t=' + encodeURIComponent(ADMIN));
  ok('o segredo no endereço é trocado por um cookie', r.status === 303, String(r.status));
  ok('e o endereço fica limpo', r.headers.get('location') === '/admin',
    r.headers.get('location'));
  const posto = r.headers.get('set-cookie') || '';
  /* HttpOnly: o script da página nunca lhe toca. SameSite=Strict: um POST
     vindo de outro site não o leva consigo, que é a defesa contra CSRF de que
     isto precisa agora que daqui se escreve em todas as páginas. */
  ok('o cookie é HttpOnly e SameSite=Strict',
    /HttpOnly/.test(posto) && /SameSite=Strict/.test(posto), posto);
  const sessao = posto.split(';')[0];

  /* Secure só quando a ligação é HTTPS — e atrás do proxy da Railway isso
     lê-se no cabeçalho, não no socket. Sem isto, um Secure em desenvolvimento
     dava um cookie que o browser guarda e nunca devolve. */
  ok('e ganha Secure quando o pedido vem por HTTPS',
    /Secure/.test((await get('/admin?t=' + encodeURIComponent(ADMIN),
      { 'x-forwarded-proto': 'https' })).headers.get('set-cookie') || ''));
  ok('mas não em HTTP, senão o browser guardava-o e nunca o devolvia',
    !/Secure/.test(posto));

  ok('um segredo errado não abre nem põe cookie',
    (await get('/admin?t=nao-e-este')).status === 404);
  ok('sair apaga o cookie',
    /Max-Age=0/.test((await get('/admin/sair', { cookie: sessao })).headers.get('set-cookie') || ''));

  /* Daqui para a frente a fila abre-se com o cookie, como no browser. */
  const filaHtml = () => get('/admin', { cookie: sessao }).then(x => x.text());
  r = await get('/admin', { cookie: sessao });
  html = await r.text();
  ok('a fila abre com o cookie', r.status === 200, String(r.status));
  ok('e mostra o pedido', html.includes('Paróquia São Sebastião'));

  r = await form('/admin/decidir', { t: 'errado', slug, decisao: 'aprovado' });
  ok('não se aprova sem o segredo', r.status === 404, String(r.status));
  ok('e o centro continua pendente', S.db.ler(slug).estado === 'pendente');

  ok('a fila deixa editar o endereço antes de aprovar', /name="novo_slug"/.test(html));

  /* O código nasce AQUI, não no pedido: verifica-se primeiro, e a chave vai
     depois para o número que foi conferido. */
  r = await form('/admin/decidir', { t: ADMIN, slug, decisao: 'aprovado' });
  html = await r.text();
  ok('aprovar mostra o código, uma vez', r.status === 200, String(r.status));
  ok('e o centro fica aprovado', S.db.ler(slug).estado === 'aprovado');
  codigo = (html.match(/class="codigo">([A-Z0-9-]+)</) || [])[1];
  ok('o código só existe a partir daqui', !!codigo, codigo);
  /* Sem O, I, S, 0, 1, 5: este código vai ser ditado ao telefone. */
  ok('sem caracteres que se confundem ao telefone', codigo && !/[OIS015]/.test(codigo), codigo);
  /* Para o telefone conferido, não para "escolha um contacto". */
  ok('e oferece mandá-lo para o telefone do centro',
    /wa\.me\/5551996120044\?text=/.test(html));
  const waAp = decodeURIComponent(((html.match(/href="(https:\/\/wa\.me\/55[^"]*)"/) || [])[1] || '')
    .replace(/&amp;/g, '&').split('text=')[1] || '');
  ok('a mensagem leva o código', waAp.includes(codigo), waAp.slice(0, 60));
  ok('e o endereço da página', waAp.includes(slug));
  ok('e onde se atualiza', waAp.includes('/atualizar'));
  /* Metade do valor: o centro fica com um contacto humano guardado. */
  ok('e pede que salvem o contato', /[Ss]alve também este contato/.test(waAp));

  /* Aprovar outra vez não pode invalidar a chave que já está num telemóvel. */
  S.db.decidir(slug, 'pendente');
  r = await form('/admin/decidir', { t: ADMIN, slug, decisao: 'aprovado' });
  ok('aprovar de novo não emite outro código', r.status === 303, String(r.status));
  ok('e o código continua a valer',
    S.db.codigoConfere(codigo, S.db.ler(slug).codigo_hash));

  /* Um campo de endereço vazio, ou só com pontuação, tem de ser "não mexer".
     O recurso do gerador de slugs é "centro" — sem esta guarda, aprovar sem
     tocar no campo renomeava o centro para /centro. */
  for (const vazio of ['', '   ', '!!!', '---']) {
    r = await form('/admin/decidir', { t: ADMIN, slug, decisao: 'aprovado', novo_slug: vazio });
    ok(`endereço "${vazio || '(vazio)'}" não renomeia nada`, !!S.db.ler(slug), 'renomeou');
    S.db.decidir(slug, 'pendente');
  }


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
  /* `slug` já é um alias: a secção de encurtar o endereço corre antes desta
     agora que a aprovação subiu. Resolve-se, como o servidor faz. */
  const guardado = S.db.ler(S.db.resolver(slug)).dados;
  ok('mas não deixa mudar o nome verificado', guardado.nome === 'Paróquia São Sebastião', guardado.nome);
  ok('nem o endereço verificado', /Bento Gonçalves/.test(guardado.endereco), guardado.endereco);
  ok('nem o telefone verificado', guardado.contato === '(51) 99612-0044', guardado.contato);

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
  const formN = (p, obj, ip) => {
    const u = new URLSearchParams();
    Object.entries(obj).forEach(([k, v]) =>
      Array.isArray(v) ? v.forEach(x => u.append(k, x)) : u.append(k, v));
    return fetch(base + p, { method: 'POST', redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded',
                 ...(ip ? { 'X-Forwarded-For': ip } : {}) }, body: u.toString() });
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
  ok('e a página diz porquê', /não mudam aqui/.test(html));

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

  html = await filaHtml();
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
  console.log('\nencerrar um centro');
  /* A falha que esta ferramenta existe para evitar: alguém carregar cinco
     quilos de arroz até uma porta fechada. Até aqui, um centro que acabasse
     ficava na lista para sempre — ou alguém mexia na base de dados à mão. */
  {
    S.db.criar('vai-fechar', { nome: 'Ponto que Vai Fechar', tipo: 'Ponto de arrecadação',
      endereco: 'Rua Final, 1', contato: '(51) 90000-0009', precisa: ['agua'], naoTraga: [] });
    r = await form('/admin/decidir', { t: ADMIN, slug: 'vai-fechar',
      novo_slug: 'vai-fechar', decisao: 'aprovado' });
    const cod = ((await r.text()).match(/class="codigo">([A-Z0-9-]+)</) || [])[1];
    S.db.publicar('vai-fechar', S.db.ler('vai-fechar').dados);

    html = await (await formN('/atualizar', { slug: 'vai-fechar', codigo: cod }, '198.51.100.4')).text();
    ok('a lista aberta oferece encerrar', /name="encerrar" value="pedir"/.test(html));
    /* A pausa e o encerramento parecem-se o suficiente para se trocarem, e
       trocá-los custa a um centro real ficar invisível numa manhã. */
    ok('e explica a diferença para a pausa', /Se for só por hoje/.test(html));

    r = await formN('/atualizar', { slug: 'vai-fechar', codigo: cod, encerrar: 'pedir' }, '198.51.100.4');
    html = await r.text();
    ok('pedir para encerrar mostra uma confirmação', /encerrar=|name="encerrar" value="confirmar"/.test(html));
    ok('que diz o que acontece', /sai da lista pública/.test(html));
    ok('e que não há como voltar atrás do lado do centro', /não há\s+como reabrir/.test(html));
    ok('mas o centro ainda NÃO está encerrado',
      S.db.ler('vai-fechar').estado === 'aprovado', S.db.ler('vai-fechar').estado);

    r = await formN('/atualizar', { slug: 'vai-fechar', codigo: cod, encerrar: 'confirmar' }, '198.51.100.4');
    html = await r.text();
    ok('confirmar encerra', S.db.ler('vai-fechar').estado === 'encerrado');
    ok('e a resposta já é a página de encerrado', /encerrou/.test(html));

    /* Sai da lista e da procura, mas o endereço continua a responder: há
       cartazes impressos a apontar para ele. Um 404 mandava a pessoa embora
       sem lhe dizer para onde ir. */
    ok('sai da lista pública',
      !(await (await get('/centros')).text()).includes('Ponto que Vai Fechar'));
    ok('e da procura',
      !(await (await get('/centros?q=fechar')).text()).includes('Ponto que Vai Fechar'));
    r = await get('/vai-fechar');
    html = await r.text();
    ok('mas o endereço continua a responder', r.status === 200, String(r.status));
    ok('a dizer que fechou', /encerrou/.test(html) && /Não traga/.test(html));
    ok('sem mostrar a lista de necessidades que lá estava', !/Precisamos hoje/.test(html));
    ok('e a mandar para os que estão abertos', /href="\/centros"/.test(html));
    ok('e não é indexado', (r.headers.get('x-robots-tag') || '').includes('noindex'));
    /* Quem vai a caminho pode ligar antes de dar a volta. */
    ok('o telefone continua lá', /90000-0009/.test(html));

    /* Não entra nos empurrões: não está parado, acabou. */
    ok('não entra na lista de empurrões',
      !S.db.parados(0).map(c => c.slug).includes('vai-fechar'));

    /* Reabrir é decisão de quem aprova. Um código que ande num telemóvel não a
       pode tomar. */
    r = await formN('/atualizar', { slug: 'vai-fechar', codigo: cod }, '198.51.100.4');
    ok('o código já não abre a lista de um centro encerrado', r.status === 403, String(r.status));
    ok('e diz porquê', /encerrado/.test(await r.text()));

    html = await filaHtml();
    ok('a fila mostra os encerrados', /Encerrados/.test(html) && html.includes('Ponto que Vai Fechar'));
    ok('com um botão de reabrir', /Reabrir/.test(html));
    await form('/admin/decidir', { t: ADMIN, slug: 'vai-fechar', novo_slug: '', decisao: 'aprovado' });
    ok('reabrir devolve o centro ao ar', S.db.ler('vai-fechar').estado === 'aprovado');
    S.db.decidir('vai-fechar', 'encerrado');
  }

  console.log('\naprovar, recusar, e quem não tem telefone');
  {
    /* Recusar não gera código nenhum: uma chave para uma página que não vai
       existir, e não há nada de bom para mandar a ninguém. */
    S.db.criar('recusa-teste', { nome: 'Centro Recusado', endereco: 'R. X',
      contato: '(51) 90000-0000', precisa: [], naoTraga: [] });
    r = await form('/admin/decidir', { t: ADMIN, slug: 'recusa-teste',
      novo_slug: 'recusa-teste', decisao: 'recusado' });
    ok('recusar volta à fila sem mostrar código', r.status === 303, String(r.status));
    ok('e não gera chave nenhuma', S.db.ler('recusa-teste').codigo_hash === '');

    /* Sem telefone utilizável não há para onde mandar — e a página tem de o
       dizer, porque a página fica no ar e ninguém a poderá atualizar. */
    S.db.criar('sem-tel', { nome: 'Centro Sem Telefone', endereco: 'R. Y',
      contato: 'ligar na portaria', precisa: [], naoTraga: [] });
    r = await form('/admin/decidir', { t: ADMIN, slug: 'sem-tel',
      novo_slug: 'sem-tel', decisao: 'aprovado' });
    html = await r.text();
    ok('sem telefone utilizável, avisa que não há para onde mandar',
      /não tem um telefone utilizável/.test(html));
    ok('e diz o que está em jogo', /ninguém consegue atualizar/.test(html));
    ok('mas o código é gerado na mesma', /class="codigo">[A-Z0-9]{4}-/.test(html));
  }

  /* Um centro acabado de aprovar não está parado — está a começar. Sem isto
     aparecia na lista de empurrões no segundo seguinte à aprovação, e entrava
     no resumo diário antes de alguém ter escrito a primeira lista. */
  {
    const recentes = S.db.parados(S.DIAS_PARADO).map(c => c.slug);
    ok('um centro aprovado agora não entra nos empurrões',
      !recentes.includes('sem-tel'), recentes.join(', '));
    const c4 = new (require('node:sqlite').DatabaseSync)(ficheiro);
    c4.prepare('UPDATE centros SET decidido=? WHERE slug=?')
      .run(Date.now() - 30 * DIA, 'sem-tel');
    c4.close();
    ok('mas entra se for aprovado há um mês e continuar sem lista',
      S.db.parados(S.DIAS_PARADO).map(c => c.slug).includes('sem-tel'));
  }

  console.log('\npedir um código novo (público)');
  /* O beco sem saída: a página dizia "fale com quem aprovou o seu centro" a
     alguém que provavelmente nunca soube quem foi. */
  r = await get('/atualizar');
  ok('a entrada de atualização diz onde pedir',
    /href="\/pedir-codigo"/.test(await r.text()));
  r = await get('/centro');
  html = await r.text();
  ok('e a porta do centro também', /href="\/pedir-codigo"/.test(html));
  /* Mandar criar uma página nova era conselho activamente mau: ficavam duas do
     mesmo centro e os cartazes impressos apontavam para a errada. */
  ok('e já não manda criar uma página nova', /não crie uma página\s+nova/.test(html));

  r = await get('/pedir-codigo');
  ok('a página de pedido responde', r.status === 200, String(r.status));
  ok('e avisa que o código vai para o telefone do centro',
    /não para quem fez este pedido/.test(await r.text()));

  r = await formN('/pedir-codigo', { slug: 'nao-existe-nenhum' }, '203.0.113.7');
  ok('um endereço que não existe é recusado', r.status === 404, String(r.status));

  /* O que este formulário NÃO pode fazer, que é a razão de ele poder ser
     público: emitir. Se emitisse, bastava saber um nome — que está numa lista
     pública — para tomar conta de um centro. */
  const hashAntes = S.db.ler(slugFinal).codigo_hash;
  r = await formN('/pedir-codigo', { slug: slugFinal, nota: 'Sou a Ana, o papel molhou-se.' }, '203.0.113.7');
  html = await r.text();
  ok('um pedido válido é aceite', r.status === 200, String(r.status));
  ok('e diz que vai haver um telefonema', /Vamos ligar/.test(html));
  ok('MAS não emite código nenhum',
    S.db.ler(slugFinal).codigo_hash === hashAntes);
  ok('e o código actual continua a publicar',
    (await api('/api/publicar', { slug: slugFinal, codigo, dados: { precisa: ['agua'] } })).status === 200);

  /* Cinco por hora: chega para alguém que se engana no endereço, e não chega
     para encher o Telegram de quem tem de atender. */
  let travou = false;
  for (let i = 0; i < 8; i++) {
    const x = await formN('/pedir-codigo', { slug: slugFinal }, '203.0.113.7');
    if (x.status === 429) { travou = true; break; }
  }
  ok('e há uma trava para não encher o Telegram', travou);

  console.log('\nemitir um código novo');
  /* "Perdi o código" é o pedido de ajuda mais provável que esta ferramenta vai
     receber. Até aqui a única resposta era mexer na base de dados à mão. */
  html = await filaHtml();
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
  ok('e oferece mandá-lo no WhatsApp', /wa\.me\//.test(html));
  /* Para o número conferido na aprovação, não para "escolha um contacto": é o
     que faz um pedido feito por um impostor acabar no telemóvel do centro. */
  ok('e o destino por omissão é o telefone do centro',
    /wa\.me\/5551996120044\?text=/.test(html));
  ok('com a opção de mandar para outro número', /Mandar para outro número/.test(html));

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


  /* =========================================================================
   * LIGAR E CHEGAR
   *
   * Alguém com cobertores no carro quer duas coisas: telefonar antes de sair, e
   * saber onde é. Ambas obrigavam a abrir a página do centro e a copiar o
   * endereço à mão para outro aplicativo.
   * =======================================================================*/
  console.log('\nligar e chegar');
  /* As secções de paginação acima deixaram quarenta centros "Paginado" na
     lista, por isso a fixture está na página 2. Procura-se por ela. */
  const soEste = '/centros?q=' + encodeURIComponent('sebastiao');
  {
    const lista = await (await get(soEste)).text();

    ok('a lista tem um botão de ligar, com o nome do centro no rótulo',
      /aria-label="Ligar para Paróquia São Sebastião"/.test(lista));
    ok('e um de como chegar, também com o nome',
      /aria-label="Como chegar a Paróquia São Sebastião[^"]*"/.test(lista));
    ok('o telefone vira um tel: com só dígitos', /href="tel:51996120044"/.test(lista));
    ok('o mapa é uma procura pelo endereço',
      /https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=/.test(lista));

    /* A razão de os botões estarem FORA do link do cartão, e o teste que
       impede que alguém os volte a pôr lá dentro. Um <a> dentro de outro <a>
       não é HTML válido; o que acontece na prática é pior do que a regra —
       um toque na beira do botão segue o cartão e leva a pessoa para outra
       página. O axe também o reprova, mas isto falha mais depressa e diz
       porquê. */
    ok('nenhum link dentro de outro link na lista',
      !/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<a\b/.test(lista));

    const pag = await (await get('/' + slugFinal)).text();
    ok('na página do centro o endereço abre o mapa',
      /class="lin"><a href="https:\/\/www\.google\.com\/maps\/search/.test(pag));
    ok('e há um botão grande de como chegar', /class="btn btn-ir"/.test(pag));

    /* Um centro encerrado NÃO ganha o botão: a página existe para dizer
       "não traga nada para aqui", e um botão de rota diz o contrário. */
  }

  /* =========================================================================
   * COORDENADAS
   *
   * Coladas à mão na aprovação, no mesmo momento em que já se está a conferir
   * o endereço no mapa. O que não for um par de números dentro do planeta tem
   * de virar "sem coordenadas" e não meio par — e "sem coordenadas" continua a
   * funcionar, com a procura pelo texto do endereço.
   * =======================================================================*/
  console.log('\ncoordenadas');
  {
    const casos = [
      ['-29.9177, -51.1839', [-29.9177, -51.1839], 'o formato normal'],
      ['-29.9177,-51.1839', [-29.9177, -51.1839], 'sem espaço'],
      ['(-29.9177, -51.1839)', [-29.9177, -51.1839], 'entre parênteses'],
      ['-29,9177; -51,1839', [-29.9177, -51.1839], 'com vírgula decimal e ponto e vírgula'],
      ['', undefined, 'vazio'],
      ['perto da igreja', undefined, 'texto'],
      ['-29.9177', undefined, 'meio par'],
      ['999, 999', undefined, 'fora do planeta'],
      /* Zero-zero é o Golfo da Guiné, e é quase sempre um campo vazio que
         passou por um Number(). Mandar alguém para lá é pior do que não ter
         mapa nenhum. */
      ['0, 0', undefined, 'zero-zero, que é o Golfo da Guiné']
    ];
    let bons = 0;
    casos.forEach(([entrada, esperado]) => {
      const saida = S.lerCoords(entrada);
      const bate = esperado === undefined
        ? saida === undefined
        : Array.isArray(saida) && saida[0] === esperado[0] && saida[1] === esperado[1];
      if (bate) bons++;
      else console.log(`       ↳ "${entrada}" deu ${JSON.stringify(saida)}`);
    });
    ok(`${casos.length} formas de coordenada lidas como devem`, bons === casos.length,
      `${bons}/${casos.length}`);

    S.db.definirVerificados(slugFinal, { coords: [-29.9177, -51.1839] });
    const lista = await (await get(soEste)).text();
    ok('com coordenadas, o mapa aponta ao ponto e não ao texto',
      /query=-29\.9177,-51\.1839/.test(lista));
    ok('e a linha leva as coordenadas para o script ordenar',
      /data-lat="-29\.9177" data-lon="-51\.1839"/.test(lista));
    ok('o botão de ordenar por distância aparece', /id="perto-barra"/.test(lista));

    /* Escondido no HTML e mostrado pelo script: sem JavaScript, um botão que
       pede a localização e não faz nada a seguir é pior do que botão nenhum. */
    ok('e vem escondido, para o script o mostrar',
      /<div class="perto-barra" id="perto-barra" hidden>/.test(lista));

    S.db.definirVerificados(slugFinal, { coords: undefined });
    const sem = await (await get(soEste)).text();
    ok('sem coordenadas volta a ser uma procura pelo endereço',
      !/data-lat=/.test(sem) && /maps\/search\/\?api=1&amp;query=R\./.test(sem));
    ok('e o botão de distância desaparece com ele', !/id="perto-barra"/.test(sem));
  }

  /* =========================================================================
   * EMERGÊNCIA
   *
   * Uma coluna derivada, um filtro, e uma barra que não aparece enquanto
   * houver uma resposta só. Não aparecer é o comportamento certo, não uma
   * funcionalidade por acabar.
   * =======================================================================*/
  console.log('\nemergência');
  {
    /* A emergência passou a ser um catálogo: o centro guarda o SLUG e o nome
       vive numa tabela. Texto livre escrito vinte vezes dava vinte grafias do
       mesmo acontecimento, e a lista partia-se em três sem ninguém perceber. */
    S.db.criarEmergencia('enchentes-rs-2026', 'Enchentes RS 2026');
    S.db.definirVerificados(slugFinal, { emergencia: 'enchentes-rs-2026' });

    /* A coluna e não só o campo dentro do JSON. Esquecer a linha que a deriva
       em server.js não rebenta nada — a coluna fica vazia, o filtro deixa de
       devolver seja o que for, e tudo o resto continua a funcionar. Foi
       exactamente o que aconteceu da primeira vez, e é por isso que este teste
       vai ler a COLUNA e não os dados. */
    ok('a emergência chega à coluna derivada, e não só ao JSON',
      S.db.ler(slugFinal).emergencia === 'enchentes-rs-2026',
      JSON.stringify(S.db.ler(slugFinal).emergencia));

    const filtrado = await (await get('/centros?e=enchentes-rs-2026')).text();
    ok('o filtro por emergência encontra o centro', filtrado.includes(slugFinal));
    ok('e a procura leva a emergência consigo, para não a perder ao filtrar',
      /<input type="hidden" name="e" value="enchentes-rs-2026">/.test(filtrado));
    const outra = await (await get('/centros?e=chuvas-ba-2026')).text();
    ok('uma emergência que não é a dele não o traz', !outra.includes(slugFinal));

    /* Com uma resposta só, a barra não existe: um botão sozinho numa barra só
       faz alguém perguntar-se o que é aquilo. */
    ok('com uma emergência só, não há barra na lista',
      !/<nav class="emergencias"/.test(await (await get(soEste)).text()));
    ok('nem na entrada',
      !/<section class="emg-inicial">/.test(await (await get('/')).text()));

    /* Com duas, misturá-las manda alguém atravessar um estado.
       Criado directamente: o formulário de /pedir tem um limite de cinco por
       hora e por IP, e as secções acima já o gastaram. */
    S.db.criarEmergencia('chuvas-ba-2026', 'Chuvas BA 2026');
    S.db.criar('salvador-ec', { nome: 'Escola Central', tipo: 'Abrigo',
      endereco: 'R. das Flores, 5 — Salvador BA', contato: '(71) 98888-2222' });
    await form('/admin/decidir', { t: ADMIN, slug: 'salvador-ec', decisao: 'aprovado',
      novo_slug: 'salvador-ec', verificados: '1', coords: '',
      emergencia: 'chuvas-ba-2026', perfil: '' });
    S.db.publicar('salvador-ec', { ...S.db.ler('salvador-ec').dados, precisa: ['agua'] });

    const duas = await (await get(soEste)).text();
    ok('com duas emergências, a barra aparece', /<nav class="emergencias"/.test(duas));
    ok('e nomeia as duas',
      /Enchentes RS 2026/.test(duas) && /Chuvas BA 2026/.test(duas));
    ok('a entrada passa a listar as respostas em curso',
      /<section class="emg-inicial">/.test(await (await get('/')).text()));
    const so = await (await get('/centros?e=chuvas-ba-2026')).text();
    ok('o filtro separa mesmo as duas',
      so.includes('salvador-ec') && !so.includes('>Paróquia São Sebastião<'));
  }

  /* =========================================================================
   * O PERFIL — INSTAGRAM OU SITE
   *
   * `dados.link` já existe e é outra coisa: o destino do QR, a própria página
   * do centro. Este campo chama-se `perfil` por isso mesmo.
   * =======================================================================*/
  console.log('\nperfil do centro');
  {
    ok('um javascript: não é guardado',
      S.lerPerfilBruto('javascript:alert(1)') === '', S.lerPerfilBruto('javascript:alert(1)'));
    ok('um data: também não', S.lerPerfilBruto('data:text/html,<script>') === '');
    ok('texto que não é endereço nenhum também não', S.lerPerfilBruto('o instagram deles') === '');
    ok('um endereço sem esquema ganha https',
      S.lerPerfilBruto('instagram.com/paroquia') === 'https://instagram.com/paroquia',
      S.lerPerfilBruto('instagram.com/paroquia'));

    S.db.definirVerificados(slugFinal, { perfil: 'https://instagram.com/paroquiasaosebastiao' });
    const pag = await (await get('/' + slugFinal)).text();
    ok('a página diz qual é a casa e qual é a conta',
      /Instagram — @paroquiasaosebastiao/.test(pag));
    /* Um link que sai de uma página que leva a nossa verificação não pode
       levar a nossa reputação com ele. */
    ok('e sai com noopener nofollow ugc', /rel="noopener nofollow ugc"/.test(pag));

    S.db.definirVerificados(slugFinal, { perfil: 'https://paroquiasaosebastiao.org.br/doacoes' });
    ok('um site sem casa conhecida mostra o domínio, em vez de dizer só "site"',
      /paroquiasaosebastiao\.org\.br/.test(await (await get('/' + slugFinal)).text()));

    /* Nem o kit nem /atualizar podem escrever isto: foi conferido à mão, e uma
       verificação que o próprio verificado reescreve não é verificação. */
    await api('/api/publicar', { slug: slugFinal, codigo: novoCod,
      dados: { precisa: ['agua'], perfil: 'https://sitio-do-atacante.example' } });
    ok('o kit não consegue trocar o perfil ao publicar',
      S.db.ler(slugFinal).dados.perfil === 'https://paroquiasaosebastiao.org.br/doacoes',
      S.db.ler(slugFinal).dados.perfil);
  }

  /* =========================================================================
   * CORRIGIR DEPOIS DE APROVAR
   *
   * Uma coordenada colada com um dígito a menos ficava errada para sempre — e
   * este projecto tem uma regra sobre números viverem só onde se corrigem.
   * =======================================================================*/
  console.log('\ncorrigir o que foi conferido');
  {
    const antes = S.db.ler(slugFinal).publicado;
    r = await form('/admin/verificados', { t: ADMIN, slug: slugFinal,
      coords: '-29.9200, -51.1800', emergencia: 'enchentes-rs-2026',
      perfil: 'https://instagram.com/paroquiasaosebastiao' });
    const d = S.db.ler(slugFinal);
    ok('a correção entra', d.dados.coords[0] === -29.92, JSON.stringify(d.dados.coords));

    /* Corrigir uma coordenada não é o centro ter publicado uma lista. Fazer a
       página parecer fresca por causa de uma correção nossa seria exactamente
       a mentira que o resto do desenho existe para evitar. */
    ok('e não faz a lista do centro parecer mais nova do que é', d.publicado === antes,
      `${antes} → ${d.publicado}`);

    r = await form('/admin/verificados', { t: 'errado', slug: slugFinal, coords: '0,0' });
    ok('sem o segredo do admin, não corrige nada', r.status === 404, String(r.status));

    /* O botão "Reabrir" da lista de encerrados faz POST para /admin/decidir com
       decisao=aprovado e SEM estes campos. Sem a marca `verificados`, reabrir
       um centro apagava-lhe as coordenadas, a emergência e o perfil — que é
       precisamente o género de perda silenciosa que ninguém repara até alguém
       procurar o centro e ele não aparecer no filtro. */
    S.db.decidir(slugFinal, 'encerrado');
    await form('/admin/decidir', { t: ADMIN, slug: slugFinal, decisao: 'aprovado', novo_slug: '' });
    const dep = S.db.ler(slugFinal).dados;
    ok('reabrir um centro não lhe apaga as coordenadas', !!dep.coords, JSON.stringify(dep.coords));
    ok('nem a emergência', dep.emergencia === 'enchentes-rs-2026', dep.emergencia);
    ok('nem o perfil', !!dep.perfil, dep.perfil);
  }

  /* =========================================================================
   * O PAINEL DE ADMINISTRAÇÃO
   *
   * Era uma fila de aprovação e passou a ser o sítio de onde se governa o site.
   * Isso muda o que o segredo vale — ver a secção da sessão lá em cima.
   * =======================================================================*/
  console.log('\no painel');
  {
    const h = await filaHtml();
    ok('tem a barra do site, para se conferir as páginas de lá',
      /class="nav-topo"/.test(h));
    /* Numa aba nova de propósito: sair daqui para ver uma página e ter de
       voltar ao Telegram para reentrar é o atrito que faz ninguém conferir. */
    ok('e os atalhos abrem noutra aba, sem largar o painel',
      (h.match(/class="btn" href="\/[a-z]*" target="_blank"/g) || []).length >= 5);
    ok('diz por onde saem os avisos', /Avisos por:/.test(h));
  }

  console.log('\ncomo está o site');
  {
    /* Quatro faltas que não partem nada e desfazem uma funcionalidade cada.
       Nenhuma aparecia em lado nenhum: descobria-se abrindo o site e
       reparando. */
    S.db.definirVerificados(slugFinal, { coords: undefined, perfil: '' });
    const h = await filaHtml();
    ok('conta os centros sem coordenadas', /sem coordenadas/.test(h));
    ok('e diz o que isso custa', /ordem por distância/.test(h));
    ok('conta os que não têm perfil', /sem Instagram ou site/.test(h));

    S.db.definirVerificados(slugFinal, { coords: [-29.9177, -51.1839],
      perfil: 'https://instagram.com/paroquiasaosebastiao' });
  }

  console.log('\no aviso no topo do site');
  {
    const texto = 'Ponte da BR-386 fechada. Não traga doações a Canoas hoje.';

    /* Primeiro passo: ver a faixa a sério antes de ela sair. Isto aparece
       acima do nome do centro que a pessoa veio procurar, em todas as
       páginas — ver é melhor do que ler uma descrição. */
    r = await form('/admin/aviso', { t: ADMIN, texto, prazo: '24' });
    let h = await r.text();
    ok('publicar pede confirmação primeiro', r.status === 200 && /Publicar este aviso/.test(h));
    ok('e mostra a faixa como ela vai ficar', /class="aviso-global"/.test(h) && h.includes('BR-386'));
    ok('e ainda não publicou nada', S.db.lerAviso() === null);

    await form('/admin/aviso', { t: ADMIN, texto, prazo: '24', confirmar: '1' });
    ok('confirmado, o aviso existe', !!S.db.lerAviso());

    const corpo = async p => {
      const t = await (await get(p)).text();
      return t.slice(t.indexOf('<body'));   /* fora do CSS, que também diz "aviso-global" */
    };
    ok('aparece na lista de centros', (await corpo('/centros')).includes('BR-386'));
    ok('e na entrada', (await corpo('/')).includes('BR-386'));
    ok('e na página de um centro, que é onde o QR do cartaz cai',
      (await corpo('/' + slugFinal)).includes('BR-386'));

    /* A decisão que interessa. Todo este projecto existe para dizer que um
       cartaz envelhece e uma página web mente sobre a sua idade; uma faixa
       vermelha que sobrevive ao motivo é essa falha com o nosso nome em cima.
       Por isso expira sem cron e sem ninguém se lembrar dela. */
    S.db.escreverAviso(texto, Date.now() - 1000);
    ok('passado o prazo, sai sozinho', !(await corpo('/centros')).includes('BR-386'));
    ok('e lerAviso passa a não devolver nada', S.db.lerAviso() === null);

    S.db.escreverAviso('Sem prazo nenhum.', 0);
    ok('mas "até eu tirar" fica mesmo', (await corpo('/')).includes('Sem prazo nenhum'));

    await form('/admin/aviso', { t: ADMIN, apagar: '1' });
    ok('tirar à mão limpa as páginas', S.db.lerAviso() === null);

    /* Um aviso é texto escrito à mão que sai em TODAS as páginas. É o sítio
       mais perigoso do site para um escape em falta. */
    await form('/admin/aviso', { t: ADMIN, texto: '<script>alert(1)</script>',
      prazo: '6', confirmar: '1' });
    const cru = await (await get('/centros')).text();
    ok('o aviso é escapado, como tudo o resto',
      !cru.includes('<script>alert(1)') && cru.includes('&lt;script&gt;'));
    await form('/admin/aviso', { t: ADMIN, apagar: '1' });

    ok('sem o segredo não se publica nada',
      (await form('/admin/aviso', { t: 'errado', texto: 'x', prazo: '6', confirmar: '1' })).status === 404);
    ok('e continua sem aviso', S.db.lerAviso() === null);
  }

  console.log('\nas emergências, geridas');
  {
    await form('/admin/emergencia', { t: ADMIN, accao: 'criar', nome: 'Ciclone SC 2027' });
    const nova = S.db.emergencia('ciclone-sc-2027');
    ok('criar faz o slug a partir do nome', !!nova && nova.nome === 'Ciclone SC 2027');

    /* O nome muda; o slug NUNCA. O slug está guardado em cada centro e num
       endereço que já pode ter sido partilhado — /centros?e=… é um link. */
    await form('/admin/emergencia', { t: ADMIN, accao: 'renomear',
      slug: 'ciclone-sc-2027', nome: 'Ciclone em Santa Catarina' });
    ok('renomear muda o nome e não o endereço',
      S.db.emergencia('ciclone-sc-2027').nome === 'Ciclone em Santa Catarina');

    await form('/admin/emergencia', { t: ADMIN, accao: 'arquivar', slug: 'ciclone-sc-2027' });
    ok('arquivar não a apaga', S.db.emergencia('ciclone-sc-2027').ativa === 0);
    await form('/admin/emergencia', { t: ADMIN, accao: 'ativar', slug: 'ciclone-sc-2027' });
    ok('e reativar devolve-a', S.db.emergencia('ciclone-sc-2027').ativa === 1);

    /* Criar duas vezes o mesmo nome não é um erro: é a mesma emergência. */
    await form('/admin/emergencia', { t: ADMIN, accao: 'criar', nome: 'Ciclone SC 2027' });
    ok('criar de novo não duplica',
      S.db.emergenciasTodas().filter(e => e.slug === 'ciclone-sc-2027').length === 1);

    /* Apagar solta os centros. NENHUM centro é apagado, nunca — ficam no
       estado em que todos estavam antes de isto existir. */
    r = await form('/admin/emergencia', { t: ADMIN, accao: 'apagar', slug: 'chuvas-ba-2026' });
    let h = await r.text();
    ok('apagar pede confirmação', r.status === 200 && /Apagar/.test(h));
    ok('e diz quantos centros ficam sem emergência', /1 centro fica/.test(h));
    ok('e sugere arquivar em vez de apagar', /arquive/.test(h));
    ok('ainda não apagou', !!S.db.emergencia('chuvas-ba-2026'));

    await form('/admin/emergencia', { t: ADMIN, accao: 'apagar', slug: 'chuvas-ba-2026', confirmar: '1' });
    ok('confirmado, a emergência desaparece', !S.db.emergencia('chuvas-ba-2026'));
    ok('mas o centro continua no ar', S.db.ler('salvador-ec').estado === 'aprovado');
    ok('só que sem emergência', S.db.ler('salvador-ec').emergencia === '');

    ok('sem o segredo não se mexe nas emergências',
      (await form('/admin/emergencia', { t: 'errado', accao: 'criar', nome: 'Falsa' })).status === 404);
    ok('e nada foi criado', !S.db.emergencia('falsa'));
  }

  console.log('\na cópia de segurança');
  {
    r = await form('/admin/backup', { t: ADMIN });
    const h = await r.text();
    ok('baixar pede confirmação', r.status === 200 && /Baixar a base de dados/.test(h));
    /* Diz o que vai lá dentro. O ficheiro leva os telefones dos coordenadores;
       quem o baixa tem de saber isso ANTES de o deixar na pasta de downloads
       de um computador partilhado. */
    ok('e diz o que o ficheiro leva', /telefones/.test(h) && /hash/.test(h));

    r = await form('/admin/backup', { t: ADMIN, confirmar: '1' });
    const bytes = Buffer.from(await r.arrayBuffer());
    ok('vem como anexo, com a data no nome',
      /attachment; filename="capem-\d{4}-\d{2}-\d{2}\.db"/.test(r.headers.get('content-disposition') || ''),
      r.headers.get('content-disposition'));
    /* VACUUM INTO e não uma cópia do ficheiro à mão: a cópia à mão apanha uma
       escrita a meio e dá um backup que só se descobre partido no dia em que
       se precisa dele. */
    ok('é mesmo um ficheiro SQLite íntegro',
      bytes.slice(0, 15).toString() === 'SQLite format 3');

    const copia = path.join(os.tmpdir(), `capem-copia-${Date.now()}.db`);
    fs.writeFileSync(copia, bytes);
    const { DatabaseSync } = require('node:sqlite');
    const d2 = new DatabaseSync(copia);
    ok('a cópia abre e traz os centros',
      d2.prepare('SELECT COUNT(*) n FROM centros').get().n >= 2);
    ok('e os códigos continuam só em hash',
      !/-/.test(d2.prepare('SELECT codigo_hash FROM centros WHERE slug = ?').get(slugFinal).codigo_hash));
    fs.unlinkSync(copia);

    ok('sem o segredo não sai nada',
      (await form('/admin/backup', { t: 'errado', confirmar: '1' })).status === 404);
  }

  console.log('\navisar por engano');
  {
    /* Sem isto, descobria-se que o Telegram estava em baixo no dia em que um
       pedido real ficasse sem resposta. */
    r = await form('/admin/testar-aviso', { t: ADMIN });
    ok('o teste responde e volta ao painel',
      r.status === 303 && /feito=teste/.test(r.headers.get('location') || ''),
      r.headers.get('location'));
    ok('sem o segredo, não',
      (await form('/admin/testar-aviso', { t: 'errado' })).status === 404);
  }

  /* =========================================================================
   * DE /ATUALIZAR PARA O KIT
   * =======================================================================*/
  console.log('\nde atualizar para o kit');
  {
    /* A página é desenhada directamente e não pedida por HTTP: /atualizar tem
       um limite de vinte tentativas por hora e por IP — é a rota onde alguém
       adivinharia um código à força — e as secções acima já o gastaram. O que
       se testa aqui é o que a página escreve, não o caminho até ela. */
    const P = require('../server/pagina.js');
    const at = P.paginaAtualizar({
      centro: { ...S.db.ler(slugFinal), codigoDado: novoCod },
      url: `${base}/${slugFinal}` });
    ok('o link para o kit leva o endereço do centro',
      at.includes('href="/kit?slug=' + slugFinal + '"'));
    /* O código nunca viaja num URL: fica no histórico do navegador, e o
       computador da secretaria é de toda a gente que faz turno. */
    ok('e NUNCA leva o código', !/\/kit\?[^"]*codigo/.test(at));
    ok('o endereço no cabeçalho abre o mapa',
      at.includes('class="endereco"><a href="https://www.google.com/maps'));
  }


  console.log('\ncentros que nunca pediram página');
  {
    /* O que estas asserções existem para apanhar, por ordem:
       1. UMA NECESSIDADE INVENTADA. Um centro que nós acrescentámos não disse
          o que precisa. Se a página lhe puser uma lista — mesmo as quatro
          recusas, que são bom conselho — passamos a falar em nome de uma casa
          que não falou connosco.
       2. UMA PÁGINA QUE NÃO DIZ QUE NINGUÉM A CONFIRMOU. É a mesma falha da
          idade da lista, um andar acima: uma página parece sempre confirmada.
       3. UM CASTIGO DISFARÇADO DE ORDENAÇÃO. Sem dono, `publicado` é NULL, e o
          escalão de sempre atirava-o para o fim de todas as listas. Um centro
          não deve descer na lista por não usar a ferramenta.
       4. UM FORMULÁRIO PÚBLICO QUE ENTREGA A CHAVE. `/sou-daqui` não pode
          emitir nada: os nomes dos centros são públicos. */
    const t = '?t=' + encodeURIComponent(ADMIN);

    let r2 = await form('/admin/encontrado' + t, {
      t: ADMIN, nome: 'Ginásio do Bairro Rio Branco', endereco: 'Rua Um, 100, Canoas',
      contato: '(51) 3000-0000', tipo: 'Ginásio', horario: '9h às 17h',
      fonte: 'https://prefeitura.exemplo.gov.br/pontos', novo_slug: 'rio-branco'
    });
    ok('o admin acrescenta um centro sem coordenador', r2.status === 303, String(r2.status));

    const sd = S.db.ler('rio-branco');
    ok('e ele fica no ar na hora', sd && sd.estado === 'aprovado');
    ok('sem código nenhum', sd && sd.codigo_hash === '');
    ok('sem lista de necessidades', sd && (sd.dados.precisa || []).length === 0);
    /* As quatro recusas são um conselho bom e continuam a não ser nossas para
       dar em nome de quem não falou. */
    ok('e sem recusas — nem as quatro de sempre', sd && (sd.dados.naoTraga || []).length === 0);
    ok('a fonte fica guardada com a data', !!(sd.dados.fonte && sd.dados.fonteEm));
    /* A coluna derivada. Esquecê-la não rebenta nada — falha em silêncio e o
       centro cai no escalão errado. Já aconteceu com `emergencia`. */
    const col = S.db.ler('rio-branco');
    ok('a coluna sem_dono foi escrita', col.sem_dono === 1, String(col.sem_dono));

    r2 = await form('/admin/encontrado' + t, { t: ADMIN, nome: 'Sem fonte', endereco: 'Rua Dois' });
    ok('sem fonte não entra', r2.status === 303 && /erro=encontrado/.test(r2.headers.get('location') || ''));

    r2 = await get('/rio-branco');
    let h2 = await r2.text();
    ok('a página diz que ninguém a confirmou',
      h2.includes('Ninguém deste centro confirmou esta página'));
    ok('e mostra de onde veio', h2.includes('prefeitura.exemplo.gov.br'));
    ok('e NÃO diz "Precisamos hoje"', !h2.includes('Precisamos hoje'));
    ok('e NÃO diz "Por favor, não traga"', !h2.includes('Por favor, não traga'));
    ok('e não oferece mandar uma lista que não existe',
      !h2.includes('Mandar esta lista no WhatsApp'));
    /* Tudo o que serve para lá chegar continua igual ao de qualquer centro. */
    ok('o telefone continua a ligar', /href="tel:\d/.test(h2));
    ok('o endereço continua a abrir o mapa', h2.includes('https://www.google.com/maps'));
    ok('e oferece a quem for da casa assumir a página',
      h2.includes('/sou-daqui?c=rio-branco'));
    /* O horário leva um relógio e não o visto de "aberto": um visto ao lado da
       hora, numa página que diz logo abaixo que ninguém a confirmou, é a
       página a contradizer-se em dois centímetros. */
    ok('e o horário não leva a marca de "aberto", que ninguém confirmou',
      !/class="horas">[^]{0,400}M18 32 L27 42/.test(h2));

    r2 = await get('/centros?q=rio+branco');
    h2 = await r2.text();
    ok('aparece na lista como qualquer outro centro',
      h2.includes('Ginásio do Bairro Rio Branco'));
    ok('com "sem lista publicada" e não "ainda sem lista"',
      h2.includes('sem lista publicada') && !h2.includes('ainda sem lista'));

    /* O castigo disfarçado de ordenação, medido onde ele acontece: no SQL.
       Com o escalão antigo, `publicado IS NULL` atirava um centro sem dono
       para o mesmo lugar de quem tem coordenador e não publica há semanas — ou
       seja, para o fim de todas as listas, por não usar a ferramenta. Comparar
       posições no HTML não serviria: a esta altura a suite já tem centros que
       cheguem para haver segunda página. */
    S.db.criar('nunca-publicou', { nome: 'Zzz Centro Que Nunca Publicou', endereco: 'Rua Tres' });
    S.db.decidir('nunca-publicou', 'aprovado');
    const ordenados = S.db.procurar({
      ordem: 'uteis', porPagina: 500,
      fresca: Date.now() - DIA, envelhecida: Date.now() - 7 * DIA
    }).linhas.map(x => x.slug);
    ok('e fica à frente de quem tem coordenador e nunca publicou',
      ordenados.indexOf('rio-branco') < ordenados.indexOf('nunca-publicou'),
      `sem dono em ${ordenados.indexOf('rio-branco')}, sem lista em ${ordenados.indexOf('nunca-publicou')}`);

    /* Uma procura por necessidade nunca o alcança — o texto de busca é feito
       das necessidades e ele não tem nenhuma. Responder como se não existisse
       manda alguém passar à porta de um ginásio aberto. */
    r2 = await get('/centros?q=cobertor');
    h2 = await r2.text();
    ok('uma procura por item avisa que há centros sem lista',
      h2.includes('ainda não publicaram o que precisam') ||
      h2.includes('ainda não publicou o que precisa'));
    ok('e leva a uma lista só deles', h2.includes('semlista=1'));

    r2 = await get('/centros?semlista=1');
    h2 = await r2.text();
    ok('essa lista mostra o centro sem dono', h2.includes('Ginásio do Bairro Rio Branco'));
    ok('e não mostra os centros com coordenador', !h2.includes('canoas-ss'));

    /* Sou deste centro. */
    r2 = await get('/sou-daqui?c=rio-branco');
    ok('o formulário de assumir a página responde', r2.status === 200, String(r2.status));
    r2 = await get('/sou-daqui?c=' + slugFinal);
    ok('e não existe para um centro que já tem coordenador', r2.status === 404, String(r2.status));

    r2 = await form('/sou-daqui', { slug: 'rio-branco', nome: 'Ana', contato: '(51) 99999-0000',
      papel: 'coordeno a triagem' });
    h2 = await r2.text();
    ok('o pedido é aceite', r2.status === 200, String(r2.status));
    ok('e não emite código nenhum', !/[A-Z2-9]{4}-[A-Z2-9]{4}/.test(h2));
    ok('o centro continua sem código depois do pedido',
      S.db.ler('rio-branco').codigo_hash === '');
    ok('e o pedido fica guardado', !!S.db.ler('rio-branco').dados.reivindicacao);

    /* Com o cookie e não com `?t=`: chegar com o segredo no endereço redireciona
       para um /admin limpo, e um `redirect: manual` traz o 303 em vez da página. */
    h2 = await filaHtml();
    ok('o painel mostra quem quer assumir a página', h2.includes('Querem assumir a página'));
    ok('com o nome e o telefone de quem pediu', h2.includes('Ana') && h2.includes('99999-0000'));

    r2 = await form('/admin/entregar' + t, { t: ADMIN, slug: 'rio-branco' });
    h2 = await r2.text();
    ok('entregar mostra o código uma vez', /[A-Z2-9]{4}-[A-Z2-9]{4}/.test(h2));
    const depois = S.db.ler('rio-branco');
    ok('e o centro passa a ter código', depois.codigo_hash !== '');
    ok('deixa de ser um centro sem dono', depois.dados.origem !== 'encontrado');
    ok('a coluna derivada acompanha', depois.sem_dono === 0, String(depois.sem_dono));
    ok('e recebe as quatro recusas de sempre', (depois.dados.naoTraga || []).length === 4);

    r2 = await get('/rio-branco');
    h2 = await r2.text();
    ok('a página deixa de dizer que ninguém a confirmou',
      !h2.includes('Ninguém deste centro confirmou'));
    ok('e volta a ter a secção do que não trazer', h2.includes('Por favor, não traga'));
  }

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
