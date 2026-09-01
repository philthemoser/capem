# CAPEM — servidor das páginas de necessidades

Cada centro tem um endereço com a lista de hoje. O coordenador publica pelo
telemóvel a partir do kit; quem abre o link — ou lê o QR de qualquer peça
impressa — vê a versão de hoje.

**É isto que impede o papel de ficar velho.** Sem esta página, um cartaz na
porta diz o que o centro precisava no dia em que foi impresso.

---

## Correr

Sem dependências. Só é preciso Node 22 ou mais recente (usa o `node:sqlite`
que vem dentro do Node).

```bash
CAPEM_ADMIN=$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))") \
node server/server.js
```

Imprime no arranque o endereço da fila de aprovação, com o segredo já lá.
**Guarde esse endereço** — é o único sítio por onde se aprova um centro.

| Variável | |
|---|---|
| `CAPEM_ADMIN` | **obrigatória**, mínimo 16 caracteres. O servidor recusa arrancar sem ela — uma fila de aprovação aberta ao mundo é pior do que um servidor que não arranca. |
| `CAPEM_BASE` | o endereço público, ex. `https://capem.org`. Se não estiver definida, deduz-se de cada pedido (respeitando `X-Forwarded-Proto` e `X-Forwarded-Host`). |
| `CAPEM_DOMINIO` | o domínio de topo, ex. `capem.org`. Só é preciso para que `centro.capem.org` funcione. |
| `CAPEM_ESTILO` | `caminho` (omissão) ou `subdominio` — qual das duas formas é a canónica. |
| `PORT` | por omissão 8080 |
| `CAPEM_DB` | caminho do ficheiro SQLite, por omissão `server/capem.db` |
| `CAPEM_TELEGRAM_TOKEN` + `CAPEM_TELEGRAM_CHAT` | avisa-o no Telegram quando chega um pedido |
| `CAPEM_NTFY` | um endereço [ntfy.sh](https://ntfy.sh), em alternativa |
| `CAPEM_WEBHOOK` | um POST com JSON, para ligar a outra coisa qualquer |
| `CAPEM_PAIS` | indicativo do país para os links wa.me (por omissão `55`) |
| `CAPEM_DIAS_PARADO` | ao fim de quantos dias um centro conta como parado (3) |

### Avisos no Telegram em dois minutos

1. Fale com o [@BotFather](https://t.me/BotFather), `/newbot`, guarde o token.
2. Mande uma mensagem qualquer ao seu bot.
3. Abra `https://api.telegram.org/bot<TOKEN>/getUpdates` e copie o `chat.id`.
4. `CAPEM_TELEGRAM_TOKEN=… CAPEM_TELEGRAM_CHAT=… node server/server.js`

Sem nada configurado os avisos saem na consola — é sempre melhor do que
silêncio, e é onde alguém vai procurar quando perguntar porque é que não foi
avisado. O arranque diz que canais estão mesmo ligados.

## Caminho ou subdomínio

As duas formas respondem sempre:

```
capem.org/canoas-sao-sebastiao       (caminho)
canoas-sao-sebastiao.capem.org       (subdomínio)
```

`CAPEM_ESTILO` decide qual é a **canónica** — a que sai impressa, a que entra no
QR, e para a qual a outra faz 301. A outra continua a responder para sempre,
porque um endereço já colado numa porta não se corrige.

Para que o subdomínio funcione é preciso `CAPEM_DOMINIO=capem.org`, um registo
DNS wildcard `*.capem.org`, e um certificado wildcard. Nomes reservados
(`www`, `admin`, `api`, `kit`, `mail`, …) nunca são tratados como centro.

**O padrão é o caminho, por duas razões que custam dinheiro a quem as ignora:**

1. **O certificado.** Um wildcard obriga a validação DNS-01, o que obriga a
   guardar credenciais do fornecedor de DNS no servidor. Se esse certificado
   falhar a renovação, caem todos os centros ao mesmo tempo. Com caminhos há um
   certificado só, e o modo de falhar é o mais conhecido que existe.
2. **Quem escreve mal.** Um subdomínio mal escrito dá erro de DNS no browser —
   "não foi possível encontrar o servidor" — e acabou. Um caminho mal escrito
   chega aqui, e podemos responder. Esta ferramenta foi desenhada à volta de
   gente a ditar coisas ao telefone num ginásio com barulho; um engano que nós
   vemos vale mais do que um engano que não vemos.

Nada disto impede o subdomínio — só diz o que ele custa. Se a sensação de "a
página é do centro" valer esse custo, ponha `CAPEM_ESTILO=subdominio` e está
feito.

## Isto não corre no GitHub Pages

O Pages serve ficheiros; não corre código. Estas páginas mostram a lista de hoje
e há quantos dias ela foi tocada — as duas coisas mudam sem ninguém fazer
commit — e precisam de um POST para publicar, de uma base de dados e de uma
fila de aprovação. Nada disso existe num alojamento estático.

O que **vai** para o Pages é a outra metade: o protótipo e o kit de material
impresso, que são ficheiros autónomos. Ver `.github/workflows/pages.yml`.

O kit consegue publicar para um servidor alojado em qualquer sítio,
independentemente de onde ele próprio foi aberto: basta colar o endereço
completo da página do centro no campo de publicação.

## Onde alojar

**Se é a primeira vez: [../docs/por-no-ar.md](../docs/por-no-ar.md).** Vinte
minutos no browser, sem linha de comandos, ~5 USD/mês. Recomenda o Railway —
não porque seja melhor, mas porque é o que tem menos passos entre "tenho o
código" e "está no ar", e chegar ao ar é o que falta. O `railway.json` na raiz
já está lá.

Não usa nada que pertença a uma nuvem em particular: HTTP simples e um ficheiro
SQLite. Corre igual num VPS de quatro euros, no Fly, no Railway, ou no seu
portátil atrás de um túnel. Ponha um proxy à frente para o TLS (Caddy resolve
isso em três linhas) e faça cópia do ficheiro `.db` — é o estado todo.

Onde quer que seja: **o `.db` tem de estar num disco que sobreviva a um
redeploy**. É a única forma de estragar isto num sítio só.

O custo não é o problema: `docs/running-costs.md` fica-se por cerca de $25/mês, e
para uma dúzia de centros a conta é praticamente zero.

## As páginas

| Endereço | |
|---|---|
| `/` | Duas portas: **quero ajudar** e **sou de um centro**. Nada mais. |
| `/centros` | A lista, com o que cada um precisa hoje em marcas, e a idade de cada lista. Procura, filtros, ordem e páginas — tudo no servidor, tudo no endereço. |
| `/centro` | **Meu centro** — a porta de quem gere um: atualizar, imprimir, ou pedir uma página. |
| `/pedir-codigo` | Pedir um código novo. **Não emite nada** — manda um recado. |
| `/atualizar` | **A actualização diária.** Endereço + código, e a lista abre para edição. 30 KB, sem JavaScript obrigatório. |
| `/novo` | O formulário de pedido. |
| `/<centro>` | A página do centro — o destino do QR. |
| `/kit` | O gerador de material impresso. |
| `/admin?t=…` | A fila de aprovação, os empurrões, e emitir um código novo. |

A entrada não tem formulário de propósito. Quem chega é uma de duas pessoas e
não há uma terceira: ou tem alguma coisa para dar, ou está a montar um centro.
Um formulário na entrada obrigava a primeira — que aparece às centenas — a
passar por cima da segunda.

### Encerrar um centro

Um centro que acaba e continua na lista manda alguém carregar cinco quilos de
arroz até uma porta fechada — a falha exacta que esta ferramenta existe para
evitar. Até aqui a única saída era uma alteração à mão na base de dados.

No fim de `/atualizar` há **Encerrar o centro**, em dois passos. O primeiro só
mostra o que vai acontecer: a diferença entre "fechámos hoje" e "fechámos de
vez" é grande demais para caber num clique ao lado dos outros, e as duas coisas
parecem-se o suficiente para se trocarem.

`encerrado` é um **estado** e não um sinal dentro dos dados, porque muda quem o
vê: sai da lista, sai da procura, sai dos empurrões.

**A página continua a responder, com 200 e não 404.** Há cartazes com esse
endereço colados em portas, e um QR impresso não se corrige. O que muda é o
conteúdo: diz que fechou, não mostra a lista que lá estava, e manda para os
centros abertos. O endereço e o telefone ficam — quem já vai a caminho pode
ligar. Um 404 mandava a pessoa embora sem lhe dizer para onde ir.

**Reabrir não se faz com o código.** Um código que ainda ande num celular não
pode desfazer isto sozinho; a fila de aprovação tem os encerrados numa lista
com um botão de reabrir. E o encerramento manda um aviso — é a única mudança de
estado que mais ninguém vê acontecer.

### O menu: duas portas, e mais nenhuma

O menu tem **Quero ajudar** e **Meu centro**, que são as mesmas duas portas da
entrada. Quem chega tem alguma coisa para dar, ou tem um centro para tratar;
não há uma terceira pessoa.

Chegou a ter três — *ajudar · atualizar · imprimir* — e o problema não era o
nome do meio. Era misturar dois públicos na mesma fila, e pôr uma tarefa
(imprimir) ao lado de quem a contém (o centro). Só um dos três estava na
primeira pessoa, o que fazia o conjunto ler-se como acaso.

Duas portas é também a forma que aguenta o que falta construir:

| | hoje | a seguir | depois |
|---|---|---|---|
| **Quero ajudar** | ver os centros | preparar um saco, receber o código | donativo em dinheiro |
| **Meu centro** | atualizar, imprimir | receber sacos à porta | |

Cada coisa nova entra pela porta a que pertence e o menu não cresce. O custo é
um toque a mais para um coordenador que chegue sem link — e ele quase nunca
chega assim: a mensagem de aprovação leva o endereço de `/atualizar`, e é essa
a página que fica nos favoritos.

### `/atualizar` — a página que se abre todas as manhãs

É a única página cujo êxito se mede em segundos, e tudo o resto neste projecto
existe para que ela seja usada: uma lista que não é tocada envelhece, e uma
lista velha manda um vizinho carregar cinco quilos de arroz até um centro que já
não os quer.

Por isso **não é o kit**. O kit é a ferramenta de montar um centro — quinze
peças, fontes embutidas, 273 KB. Abri-lo para trocar dois itens é atravessar uma
gráfica para escrever um recado. Esta página são 30 KB.

Três decisões:

- **O nome, a morada e o telefone aparecem, mas não são campos.** A publicação
  já os ignorava; mostrá-los sem caixa de texto diz isso sem uma frase de
  explicação, e evita que alguém escreva por cima à espera que mude.
- **Formulário normal: um POST, um redesenho, zero JavaScript obrigatório.**
  Há um teste que abre a lista, marca um item, escreve uma quantidade e publica
  com o JavaScript desligado — porque o telemóvel do coordenador é o pior
  aparelho da cadeia toda.
- **O código anda no formulário, não numa sessão.** Sem cookie não há nada para
  roubar de um telemóvel emprestado, nada para expirar a meio de uma manhã, e
  fechar o separador é sair. Em troca, o código viaja em cada envio — por HTTPS,
  para o mesmo servidor a que já pertence.

Publicar uma lista vazia sem marcar "não estamos recebendo" é permitido — quem
manda é o coordenador — mas a página avisa, porque nesse estado ela não responde
à única pergunta que lhe fazem.

### O código nasce na aprovação

Antes nascia no pedido e aparecia no ecrã de quem preencheu o formulário. Isso
queria dizer que **qualquer pessoa que soubesse o nome de uma paróquia recebia,
na hora, uma chave de escrita para uma página com esse nome** — a aprovação
travava a página, não a chave. E a aprovação em si era silenciosa: nada dizia
ao centro que já estava no ar.

Agora a ordem é a certa:

1. `/novo` — o pedido é registado. Sem código. A página diz o que vem a seguir,
   e manda imprimir entretanto: **o kit nunca precisou de código, só do nome do
   centro.**
2. Você confere, e aprova. **O código é gerado nesse momento** e aparece uma
   vez, com um botão de WhatsApp já apontado ao telefone que acabou de
   conferir.
3. A mensagem leva o endereço, o código, onde se atualiza, e pede que guardem o
   contacto.

**A mensagem é mandada à mão, e isso é deliberado.** O centro fica com um
contacto humano guardado. No dia em que o código se perder — e vai perder-se —
há para onde ligar que não depende de encontrar a página certa num site.

Recusar não gera código nenhum: seria uma chave para uma página que não vai
existir. Aprovar duas vezes também não gera outro — a chave que já está num
telemóvel não pode ser invalidada por um clique repetido. E um centro sem
telefone utilizável recebe um aviso em vez de um botão morto, porque nesse caso
a página fica no ar e ninguém a poderá atualizar.

Se a página se fechar antes de mandar o código, a recuperação é o botão
**Código novo** na fila.

### Emitir um código novo

"Perdi o código" é o pedido de ajuda mais provável que esta ferramenta vai
receber: um papel colado à parede de um ginásio perde-se, molha-se, e quem o
tinha no telemóvel foi para casa. Até aqui a única resposta era uma alteração à
mão na base de dados.

Na lista **No ar** de `/admin` cada centro tem um botão discreto. Emite um
código novo, mostra-o uma vez, e oferece o mesmo botão de WhatsApp da página de
um centro acabado de criar — porque o problema a seguir a "perdi o código" é
exactamente o mesmo: fazê-lo chegar a quem está de turno.

**O código anterior deixa de funcionar, e isso é metade da razão.** Um código
perdido pode estar perdido *para alguém*; emitir sem invalidar seria acumular
chaves da mesma porta. Há um teste que confirma que o antigo passa a receber
403 e que o novo publica.

Vive atrás do segredo de administração e não numa página pública, e essa é a
decisão inteira: emitir um código é dar acesso de escrita à página de um centro.
A verificação de que a pessoa do outro lado é mesmo de lá é um telefonema para
o número que já está guardado — não é coisa que um formulário faça. A página
diz isso por extenso, ao lado do botão.

### Pedir um código novo, do lado de quem o perdeu

`/pedir-codigo` é público e **não concede nada**. O coordenador escreve o
endereço do centro, opcionalmente quem é e o que aconteceu, e isso chega ao
Telegram com o nome do centro, o telefone que está guardado, e um link `wa.me`
já apontado a esse número — porque quando a notificação chega, a acção seguinte
é ligar.

Porque não emite: o código é o que deixa escrever na página de um centro, e os
nomes dos centros estão numa lista pública. Um formulário que emitisse
transformava "saber o nome de um centro" em "tomar conta do centro". A
verificação é o telefonema, e não é coisa que um formulário faça.

E o código novo vai para o **telefone conferido na aprovação**, não para quem
pediu — o botão da página de reemissão já vem apontado a esse número, com
"mandar para outro número" ao lado para o caso raro. É isso que faz um pedido
feito por um impostor acabar no telemóvel do centro em vez de no dele.

Cinco pedidos por hora por IP: chega para quem se engana no endereço, e não
chega para encher o Telegram de quem tem de atender.

Antes disto, as duas páginas que falavam de códigos perdidos mandavam "falar
com quem aprovou o seu centro" — sem dizer como, a alguém que provavelmente
nunca soube quem foi — e uma delas sugeria **criar uma página nova**, o que
deixaria duas páginas do mesmo centro com os cartazes impressos a apontar para
a errada.

### `POST /api/carregar` — o código também lê

O código só escrevia. Isso obrigava o coordenador a preencher o formulário
inteiro outra vez em cada telemóvel novo, para o servidor deitar fora o nome, a
morada e o telefone — que não se mudam por ali. Escrever doze campos para que
nove sejam ignorados não é só trabalho a mais: dá a entender que se pode mudar o
que foi verificado à mão.

```
POST /api/carregar   { slug, codigo }  →  { dados, url, estado, publicado }
```

O kit usa-o no bloco **Já tem página?**, que passou para o topo do formulário:
endereço, código, um botão, e tudo se preenche — incluindo o link que faz o QR
de todas as peças apontar para a página certa.

Não há exposição nova: o que volta daqui já está na página pública do centro,
que qualquer pessoa abre sem código nenhum. O código continua a ser o que
autoriza a **escrita**; aqui só diz *qual* centro, em vez de servir a lista
toda de uma vez.

### `/centros`, em detalhe

Tudo vem do endereço, e o endereço é partilhável — um link para
"quem está a receber cobertores em Canoas" é `/centros?q=canoas+cobertor&aceitando=1`.

| Parâmetro | |
|---|---|
| `q` | Procura. Sem acentos e sem maiúsculas dos dois lados, e **inclui as necessidades**: quem escreve `cobertor` encontra quem está a pedir cobertores, não só centros com "cobertor" no nome. Várias palavras têm de bater todas. |
| `ordem` | `uteis` (por omissão), `recentes`, `nome`. |
| `aceitando=1` | Esconde quem está em pausa. |
| `recentes=1` | Só listas da última semana. |
| `e` | Emergência. Filtra por `dados.emergencia`, resolvido na coluna derivada. |
| `p` | Página. 40 por página. |

`uteis` é a ordem de sempre: primeiro o escalão de idade da lista, depois quem
está a receber antes de quem está em pausa, depois o nome. Esta página chama-se
"quero ajudar" — o primeiro da lista tem de ser um sítio que aceita alguma coisa.

**É um `<form method="get">` a sério.** Sem JavaScript há um botão *Aplicar* e
funciona tudo; com JavaScript o botão desaparece e as escolhas aplicam-se
sozinhas. O script é acabamento, nunca o mecanismo — e há um teste que falha se
isso deixar de ser verdade.

Porque foi feito assim: antes, a página desenhava **todos** os centros e
filtrava-os no telemóvel. Com mil centros eram 1,6 MB de HTML e 41 páginas por
segundo. Agora são 51 KB e ~440 por segundo, e o tamanho já não depende de
quantos centros existem.

### Ligar e chegar, sem abrir a página

Cada linha da lista tem dois botões: `tel:` com o telefone, e uma procura no
Google Maps com a morada. Um vizinho com cobertores no carro fazia isto abrindo
a página do centro, copiando a morada à mão e colando-a noutro aplicativo.

Os botões estão **fora** do `<a>` do cartão. Um `<a>` dentro de outro não é HTML
válido, o axe reprova-o, e na prática um toque na beira do botão segue o cartão
e leva a pessoa para outra página. O truque de esticar o link com um `::after` e
deixar os botões por cima resolve-o no papel e traz de volta a família de bugs
que a linha `[hidden]{display:none!important}` está no topo de todas as folhas
para evitar. Há um teste que falha se alguém os voltar a aninhar.

O rótulo de cada botão leva o nome do centro (`aria-label="Ligar para
Paróquia São Sebastião"`): numa lista de quarenta, "Ligar" quarenta vezes
seguidas não diz nada a um leitor de ecrã.

### Coordenadas, e o mais perto de mim

`dados.coords` é um par `[lat, lon]` colado à mão na aprovação — no momento em
que já se está a conferir a morada no mapa. Sem coordenadas o link do mapa é uma
procura pelo texto da morada, que acerta quase sempre; com elas, o pino cai no
sítio exacto.

**A ordenação por distância corre toda no aparelho.** O servidor manda as
coordenadas dos centros da página, e é o browser que faz as contas e reordena as
linhas que já lá estão. A localização de quem procura **nunca** vai para o
servidor — nem num parâmetro, nem num pedido, nem num registo. Não é um
pormenor de implementação: é a única versão desta funcionalidade compatível com
um rodapé que diz que isto não recolhe dados sobre pessoas. Quem a mudar um dia
para ordenar em SQL está a tornar essa frase falsa.

Duas consequências, ditas na própria página em vez de escondidas:

- Ordena os que estão **nesta** página. Com mais de quarenta centros, o mais
  perto pode estar na seguinte. Com uma dúzia — que é onde isto vai estar
  durante muito tempo — não acontece; quando acontecer, a ordenação passa a
  precisar do servidor e a decisão de privacidade volta à mesa.
- Centros sem coordenadas vão para o fim, com a ordem que já tinham. Sumir com
  um centro por causa de um campo que quem aprova não preencheu seria
  transformar uma falha nossa numa viagem que não se faz.

Sem JavaScript e sem permissão, a lista fica na ordem de sempre — e o botão nem
aparece, porque um botão que abre uma caixa de permissões e não faz nada a
seguir é pior do que botão nenhum.

### A emergência

`dados.emergencia` existe para o dia em que houver duas respostas ao mesmo
tempo. Uma lista que misture o Rio Grande do Sul com a Bahia manda alguém
atravessar um estado.

Hoje **não aparece em lado nenhum**: a barra de emergências só é desenhada
quando existe mais do que uma, e com zero ou uma a entrada vai direita à lista
simples, exactamente como sempre foi. Não aparecer é o comportamento certo e não
uma funcionalidade por acabar. É uma coluna derivada, um filtro e um parâmetro —
e deve continuar assim até haver um segundo evento real. Uma tabela de
emergências, um ecrã para as gerir e páginas por evento são a mobília; isto é a
fundação, e só a fundação é barata.

### O perfil — Instagram ou site

`dados.perfil`, e o nome importa: **`dados.link` já existe e é outra coisa** —
o destino do QR, a própria página do centro, usada por todas as peças
impressas. Reaproveitar aquele nome dava um bug silencioso e caro.

Três decisões:

- **Quem o põe é quem aprova.** Um link que sai de uma página que leva a
  verificação feita à mão herda essa verificação: quem o segue acredita que
  alguém conferiu. Um perfil que morre, muda de dono ou é invadido passa a
  fazê-lo com o nosso nome em cima. Nem o kit nem `/atualizar` lhe tocam, e há
  um teste que tenta publicá-lo pelo kit e verifica que não passa.
- **Só `http` e `https`.** A lista de esquemas permitidos é mais curta e mais
  segura do que a dos proibidos; um `javascript:` guardado à mão seria um XSS a
  um clique da página pública de um centro.
- **Não vai para o papel.** Mesma regra das quantidades: um endereço que muda
  não se corrige numa folha que já saiu da impressora.

Sem logótipo de marca: as 29 marcas são silhuetas cheias que se lêem a dois
metros a preto e branco, e um logótipo do Instagram não pertence a esse
conjunto. A marca de elo é desenhada em `pagina.js` e **não** entra em
`field/src/icones.js` de propósito — aquele conjunto é o do papel, e pô-la lá
punha-a também na lista de onde um coordenador escolhe a marca de um item.

### Corrigir depois de aprovar

`POST /admin/verificados` reescreve coordenadas, emergência e perfil de um
centro que já está no ar. Existe porque uma coordenada colada com um dígito a
menos ficava errada para sempre — e este projecto tem uma regra sobre números
viverem só onde se podem corrigir. **Não republica:** mexer nisto não é a lista
do centro mudar, e fazer a página parecer fresca por causa de uma correcção
nossa seria a mentira que o resto do desenho existe para evitar.

O formulário da fila leva um `verificados=1` escondido. Sem ele o servidor não
toca nestes campos — e é preciso, porque o botão **Reabrir** da lista de
encerrados também faz `POST /admin/decidir` com `decisao=aprovado` e sem estes
campos: sem a marca, reabrir um centro apagava-lhe as coordenadas, a emergência
e o perfil. Há um teste para isso.

Se um dia forem dezenas de milhares: a procura é um `LIKE '%…%'`, que percorre a
tabela. A 10 000 centros ainda dá ~130 páginas por segundo; muito acima disso
quer FTS5 ou uma tabela própria de necessidades. Está longe.

## O caminho completo

1. **O centro pede a página** em `/novo` — nome, tipo, endereço, horário,
   telefone. Recebe na hora um código de oito caracteres.
2. **Você aprova** em `/admin?t=SEGREDO`. Um cartão por pedido, dois botões, e
   **um campo para encurtar o endereço** — é aqui que
   `paroquia-sao-sebastiao` passa a `canoas-ss`, que é o que se consegue ditar
   ao telefone. O endereço antigo fica a redireccionar para sempre. Feito para
   ser aberto de pé, no telemóvel.
3. **O coordenador gera o material** em `/kit` e publica a lista do dia com o
   código. Depois da primeira publicação, o QR de todas as peças aponta
   sozinho para a página.
4. **Quem lê o QR** vê a lista de hoje — com as mesmas marcas do papel.

## WhatsApp

O WhatsApp está aqui, mas não como API. As três coisas que se queriam dele
não precisam da mesma ferramenta:

**Avisar quem administra** — é uma pessoa, o seu próprio telemóvel. Telegram,
ntfy ou um webhook fazem isto de graça e em dois minutos. Usar a Cloud API para
isto obrigava a comprar um número dedicado só para se avisar a si próprio.

**Empurrar um centro parado** — este quer mesmo WhatsApp: os coordenadores
vivem lá e não vão ler e-mail. A fila de aprovação tem uma secção **precisam de
um empurrão** com quem não publica há três dias ou mais, e um botão que abre a
conversa com a mensagem já escrita — nomeia o centro, diz há quantos dias, dá o
endereço do kit, e oferece marcar o centro como fechado. Zero configuração, e
quem administra vê quem está a chatear, o que numa emergência é uma vantagem.

**Mandar a lista para os grupos** — o kit oferece a partilha no momento de
publicar, e a página pública tem um botão para qualquer pessoa reenviar. Manda
sempre o **link**, nunca uma imagem: uma imagem de uma lista nasce velha e
continua a circular meses depois no WhatsApp de alguém, que é exactamente o
problema que estas páginas existem para resolver.

### E a Cloud API, quando fizer sentido

Entra como mais um adaptador em `server/avisos.js`, ao lado do telegram e do
ntfy; nada no resto do servidor muda. O que ela exige (Agosto de 2026):

- **Não exige verificação da empresa para começar** — 250 conversas iniciadas
  por 24 h sem ela, o que chega para muitos centros.
- Um **número de telefone dedicado**, que não pode ser um WhatsApp normal.
- Um **URL de política de privacidade** publicado.
- **Templates aprovados** um a um, e **consentimento explícito** de cada centro.
- Preço por mensagem desde Julho de 2025. No Brasil, utilitária ≈ **$0,0068**;
  mensagens de serviço são grátis, e templates utilitários são grátis dentro da
  janela de 24 h aberta por uma mensagem do próprio centro.

## Quantidades

Um item pode levar uma quantidade curta — `200`, `500 L`, `20 caixas`, `muitas`.
É opcional: quem sabe escreve, quem não sabe deixa em branco.

**Um número só aparece onde pode ser corrigido**, e isso é exactamente um sítio:
esta página, que é reescrita a cada publicação. O papel na porta, as imagens de
WhatsApp e o texto colado num grupo **nunca levam o número** — nenhum deles se
corrige depois de sair, e "200 cobertores" impresso às 8h está errado ao
meio-dia. Um número velho é pior do que nenhum, porque parece exacto.

Isso também evita o problema de layout: nada de selos a disputar espaço com uma
marca que tem um piso de 26 mm para se ler a dois metros.

O limite são oito caracteres, e a lista do "não traga" nunca leva quantidade.

## Decisões que valem a pena conhecer

**A aprovação continua a valer depois do primeiro envio.** Publicar muda a lista
do dia, o horário, o link e o estado de pausa. **Não** muda o nome, o endereço
nem o telefone — esses foram verificados à mão. Se um POST pudesse reescrever a
morada, a aprovação seria teatro.

**A página diz a idade da lista em voz alta.** Este é o coração da coisa. Uma
página web parece sempre nova, e essa é exactamente a mentira perigosa aqui: uma
lista de três semanas manda um vizinho carregar cinco quilos de arroz até um
centro que já não os quer.

| Idade | O que a página faz |
|---|---|
| até 1 dia | nada, mostra a data no rodapé |
| 2 a 6 dias | faixa amarela: "atualizada há N dias, ligue antes de vir" |
| 7 dias ou mais | faixa vermelha: "pode já não valer" |
| nunca publicou | faixa vermelha |

O silêncio nunca é o estado apresentado.

**O código não é recuperável.** Guarda-se só o hash. Se a base de dados vazar,
ninguém publica em nome de um centro; se o coordenador o perder, emite-se outro.
É a troca certa nos dois sentidos. O alfabeto do código não tem `O`, `I`, `S`,
`0`, `1` nem `5`, porque vai ser ditado ao telefone a alguém num ginásio com
barulho.

**Encurtar o endereço não parte nada.** Renomear guarda o endereço antigo como
alias: continua a responder, faz 301 para o novo, e `POST /api/publicar` aceita
os dois. Um endereço que já saiu da impressora não se corrige.

**Uma página não aprovada não está no ar** — devolve 404 e `noindex`. Mas o
coordenador pode pré-vê-la juntando `?codigo=SEU-CODIGO`, senão teria de
imprimir o QR às cegas.

**As marcas são as mesmas do papel, do mesmo ficheiro.** `server/compartilhado.js`
lê `field/src/icones.js` e `field/src/catalogo.js` e avalia-os uma vez, em vez de
manter uma segunda cópia. No dia em que duas cópias divergissem, o cartaz na
porta e a página do QR passariam a dizer coisas diferentes sobre o mesmo centro.

**Nada aqui é sobre quem é atendido.** O servidor guarda a morada, o horário e o
telefone de um edifício — informação que o centro já quer ver colada na porta.
Isso mantém a posição de proteção de dados simples, ao contrário do protótipo
(ver `docs/data-protection.md`).

## A língua da interface é o português do Brasil

Quem usa isto é um coordenador em Canoas e um vizinho com cobertores no carro.
O kit impresso trabalha muito para ser reconhecido como local — as marcas, o
"não traga", os rótulos do catálogo. Uma interface que diz **telemóvel** desfaz
isso numa palavra: percebe-se à mesma, e percebe-se também que foi feita por
alguém que não está lá.

Foi exactamente o que aconteceu. O texto visível acumulou seis *telemóvel*,
nove *ficheiro*, quatro *morada* e nove gerúndios à portuguesa antes de alguém
reparar — porque cada frase estava bem escrita, só não estava escrita no lugar
certo.

`node tools/pt-br.js` lê **só o que o utilizador vê** — fora comentários, fora
selectores de CSS, fora nomes de variáveis — e falha em: telemóvel, ecrã,
ficheiro, morada, contacto, utilizador, equipa, autocarro, descarregar,
"carregue em", sítio, "está a fazer", "precisa de fazer", "tem de fazer".

**Os comentários do código continuam em português europeu**, de propósito: são
para quem mexe no código e não para quem o usa. Se um dia isso incomodar quem
mantém o projecto, muda-se — mas é ruído a mais para juntar a um diff de texto
visível.

## O CSS, e como não o desarrumar

A folha de estilos vive num template literal no fim de `server/pagina.js` — uma
só, para todas as páginas, servida dentro do HTML. Duas regras chegam para
manter isto arrumado.

**Uma página escolhe um de dois modelos, e só há dois.**

| | |
|---|---|
| **com goteira** (por omissão) | O `main` afasta o conteúdo das beiras e nada lá dentro volta a afastá-lo. É o que quase todas as páginas querem. |
| **em faixas** (`main.faixas`) | O `main` não tem goteira, para as faixas — cabeçalho do centro, aviso de idade, blocos com risco em cima — atravessarem o ecrã de beira a beira. Cada faixa põe a goteira por dentro. |

A goteira vive no `main` e é o modelo em faixas que a tira, e **não** ao
contrário. Era ao contrário: cada classe de página punha a sua, e uma classe que
se esquecesse ficava colada à beira do ecrã. Foi o que aconteceu a `.entrar` —
`/atualizar` e `/pedir-codigo`, as duas páginas que um coordenador mais abre ao
telemóvel — sem ninguém dar por isso, porque cada página estava certa em
relação a si própria. `node tools/goteira.js` mede-as todas e compara-as umas
com as outras, que é o único ângulo de onde o erro se vê.

**A distância chama-se `--goteira`.** Havia seis `20px` escritos à mão em sítios
diferentes. Se um dia mudar, muda numa linha.

**Nada de crases dentro do CSS.** É um template literal: uma crase num
comentário fecha-o e o servidor deixa de arrancar, com um erro que aponta para
o comentário e não diz porquê. Aconteceu quatro vezes. O `tools/goteira.js`
verifica isso antes de mais nada, e diz a linha.

## Ficheiros

```
server/server.js         rotas, defesas, arranque    (um ficheiro, sem dependências)
server/db.js             SQLite; o único sítio que sabe como se guarda
server/busca.js          o que conta como uma correspondência, e as ordens
server/pagina.js         as páginas, com as fichas de design do papel
server/compartilhado.js  carrega as 29 marcas e o catálogo de field/src/
```

## Testes

```bash
node tools/server-test.js    # 250 verificações
node tools/a11y-server.js    # axe nas páginas servidas, claro e escuro
node tools/goteira.js        # a mesma goteira em todas as páginas
node tools/pt-br.js          # nada de português europeu no texto visível
```

Por ordem do que interessa: uma página que mente sobre a sua idade; as marcas
terem de chegar ao ecrã; o que foi verificado à mão não poder ser mudado por um
POST; páginas não aprovadas não estarem no ar. Mais o escapamento, os limites de
tamanho, a trava por IP, os endereços saírem do pedido e não de um `localhost`
esquecido numa variável, e as duas formas de endereço responderem e
redirecionarem uma para a outra nos dois estilos.

## O que falta

- **Não há como um centro se apagar** a si próprio, nem como marcar um centro
  como encerrado. Hoje é uma alteração à mão na base de dados.
- **A lista não ordena por distância.** Ordena por idade da lista, o que é a
  coisa certa a fazer com dez centros e a coisa errada com quinhentos: quem quer
  ajudar quer o centro mais perto que precisa do que tem no carro. Isso obriga a
  guardar coordenadas de cada centro e a pedir a localização a quem visita — e a
  segunda parte é uma decisão de privacidade, não de código.
- **Não há cópia de segurança automática** do ficheiro `.db`.
- **O empurrão é manual.** Alguém tem de abrir a fila e carregar no botão. É
  deliberado a esta escala, mas com cem centros passa a ser trabalho a sério —
  aí entra a Cloud API.
- **`node:sqlite` está marcado como experimental.** Se mudar de forma, é
  `server/db.js` que se reescreve e mais nenhum ficheiro — foi isolado de
  propósito.
