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
| `/centro` | A porta de quem gere um centro: atualizar, imprimir, ou pedir uma página. |
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

### Avisar que a página ficou no ar

A aprovação era silenciosa. O coordenador pedia a página, recebia o código na
hora, e depois **nada lhe dizia que já estava no ar** — tinha de ir espreitar o
endereço de vez em quando. Era o único passo do processo que só o administrador
via acontecer.

Aprovar traz agora um cartão ao topo da fila com um botão de WhatsApp para o
telefone do centro. A mensagem leva o endereço da página, onde se atualiza, e
pede que guardem o contacto.

**Essa última parte é metade do valor.** Manda-se à mão, do telemóvel de quem
aprova, e o centro fica com um contacto humano guardado. No dia em que o código
se perder — e vai perder-se — há para onde ligar que não depende de encontrar a
página certa num site.

Recusar não oferece cartão nenhum: não há nada de bom para dizer, e a mensagem
seria a última coisa que alguém quer receber de uma ferramenta.

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
node tools/server-test.js    # 221 verificações
node tools/a11y-server.js    # axe nas páginas servidas, claro e escuro
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
