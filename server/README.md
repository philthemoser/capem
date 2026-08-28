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

## Onde alojar

Não usa nada que pertença a uma nuvem em particular: HTTP simples e um ficheiro
SQLite. Corre igual num VPS de quatro euros, no Fly, no Railway, ou no seu
portátil atrás de um túnel. Ponha um proxy à frente para o TLS (Caddy resolve
isso em três linhas) e faça cópia do ficheiro `.db` — é o estado todo.

O custo não é o problema: `docs/running-costs.md` fica-se por cerca de $25/mês, e
para uma dúzia de centros a conta é praticamente zero.

## O caminho completo

1. **O centro pede a página** em `/` — nome, tipo, endereço, horário, telefone.
   Recebe na hora um código de oito caracteres.
2. **Você aprova** em `/admin?t=SEGREDO`. Um cartão por pedido, dois botões.
   Feito para ser aberto de pé, no telemóvel.
3. **O coordenador gera o material** em `/kit` e publica a lista do dia com o
   código. Depois da primeira publicação, o QR de todas as peças aponta
   sozinho para a página.
4. **Quem lê o QR** vê a lista de hoje — com as mesmas marcas do papel.

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
server/pagina.js         as páginas, com as fichas de design do papel
server/compartilhado.js  carrega as 29 marcas e o catálogo de field/src/
```

## Testes

```bash
node tools/server-test.js    # 72 verificações
```

Por ordem do que interessa: uma página que mente sobre a sua idade; as marcas
terem de chegar ao ecrã; o que foi verificado à mão não poder ser mudado por um
POST; páginas não aprovadas não estarem no ar. Mais o escapamento, os limites de
tamanho, a trava por IP, os endereços saírem do pedido e não de um `localhost`
esquecido numa variável, e as duas formas de endereço responderem e
redirecionarem uma para a outra nos dois estilos.

## O que falta

- **Nada avisa quando chega um pedido.** É preciso abrir a fila para ver. Um
  aviso por e-mail ou Telegram é o passo seguinte óbvio, e é o que decide se a
  aprovação à mão aguenta uma emergência a sério.
- **Não há como um centro se apagar** a si próprio, nem como marcar um centro
  como encerrado. Hoje é uma alteração à mão na base de dados.
- **Não há cópia de segurança automática** do ficheiro `.db`.
- **`node:sqlite` está marcado como experimental.** Se mudar de forma, é
  `server/db.js` que se reescreve e mais nenhum ficheiro — foi isolado de
  propósito.
