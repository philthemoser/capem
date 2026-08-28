# Pôr isto no ar

Um guia para quem nunca alojou nada. Vinte minutos, cinco euros por mês,
nenhum comando no computador — só o browser.

No fim tem um endereço público a funcionar, do género
`capem-production.up.railway.app`, e pode ligar-lhe o seu domínio depois.

---

## O que é preciso decidir primeiro

Nada. É de propósito: este servidor não usa nada que pertença a uma nuvem em
particular. Se daqui a três meses o Railway subir o preço ou fechar, os mesmos
dois ficheiros correm noutro sítio qualquer, e a única coisa a mudar é para
onde aponta o domínio.

## Porquê o Railway

Porque é o que dá menos trabalho para chegar ao ar, e chegar ao ar é o que
falta. Escolhe-se assim: quem está com uma época de tempestades pela frente não
quer aprender Docker primeiro.

Concretamente:

| | Railway | Render | Fly |
|---|---|---|---|
| Preciso de Dockerfile? | não | não | sim, normalmente |
| Preciso da linha de comandos? | não | não | sim |
| Disco que sobrevive a um deploy | dois cliques | sim, no plano pago | sim, mas configura-se à mão |
| Adormece quando ninguém usa? | não | no plano grátis, sim — 30 a 50 s a acordar | opcional |
| Por mês | ~5 USD | ~7 USD | ~2 USD e para cima |

O Render tem um plano grátis, mas nesse plano o serviço adormece ao fim de 15
minutos sem visitas e demora meio minuto a acordar. Meio minuto é muito tempo
para alguém à chuva com o telemóvel na mão — e a página de um centro é
precisamente o que se abre uma vez, de repente, quando faz falta. O Fly é o mais
barato dos três e continua a ser a escolha certa para quem já sabe usá-lo.

**O disco é a parte que interessa.** Isto guarda tudo num ficheiro SQLite. Sem
um disco que sobreviva aos deploys, cada actualização apaga todos os centros.
É o passo 4, e é o único que não se pode saltar.

---

## Os passos

### 1. Pôr o código no GitHub

Se o repositório ainda só existe no seu computador: em github.com,
**New repository**, dê-lhe um nome, e siga as duas linhas que o GitHub mostra
para "push an existing repository".

### 2. Criar o projecto

Em [railway.com/new](https://railway.com/new) → **Deploy from GitHub repo** →
autorize o GitHub → escolha o repositório.

Não é preciso escolher mais nada. O ficheiro `railway.json` que está na raiz do
repositório já diz o que correr; não é preciso Dockerfile.

A primeira tentativa **vai falhar**, e isso é o comportamento correcto: falta
a senha de administração. É o passo seguinte.

### 3. A senha de administração

O servidor recusa-se a arrancar sem ela, porque a fila de aprovação abre com
ela. Gere uma:

- num computador: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`
- ou use qualquer gerador de senhas, com 40 caracteres ou mais.

No Railway: **Variables** → **New Variable**:

```
CAPEM_ADMIN = <a senha que gerou>
```

Guarde-a onde guarda as suas senhas. Não há como recuperá-la — só substituí-la.

Aproveite e ponha já mais duas, na mesma janela:

```
NPM_CONFIG_OMIT = dev
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = 1
```

O servidor não tem dependência nenhuma — corre só com o que vem dentro do Node.
As que estão no `package.json` são para os testes, e uma delas quer descarregar
um browser inteiro. Estas duas variáveis dizem à instalação para as saltar: o
deploy passa de minutos a segundos, e deixa de poder falhar por causa de um
browser que ninguém lá vai usar.

### 4. O disco  ← o passo que não se salta

Na sua service: **Settings** → **Volumes** → **Add Volume**.

```
Mount path:  /dados
```

1 GB chega para muito mais centros do que alguma vez vai ter.

E depois, em **Variables**, diga ao servidor que é lá que ele escreve:

```
CAPEM_DB = /dados/capem.db
```

Sem isto o site funciona e parece bem — até ao deploy seguinte, que apaga tudo.
É a falha mais fácil de cometer aqui e a mais cara.

### 5. O endereço

**Settings** → **Networking** → **Generate Domain**. Aparece qualquer coisa como
`capem-production.up.railway.app`. Já está no ar.

Diga ao servidor qual é o seu próprio endereço, para os QR codes e os links não
apontarem para `localhost`:

```
CAPEM_BASE = https://capem-production.up.railway.app
```

### 6. Ver se está bom

| Onde | O que tem de acontecer |
|---|---|
| `/` | a entrada, com as duas portas |
| `/centros` | "Ainda não há centros no ar" |
| `/novo` | o formulário para pedir uma página |
| `/admin?t=<a sua senha>` | a fila de aprovação |
| `/admin?t=errado` | uma página de "não existe" — se abrir a fila, pare tudo |

Depois faça o percurso todo uma vez: peça uma página em `/novo`, aprove-a em
`/admin`, e publique uma lista a partir de `/kit`. São três minutos e é o
único teste que conta.

### 7. E depois, o teste a sério

Redeploy (**Deployments** → nos três pontos do último, **Redeploy**) e volte a
`/centros`. **O centro que criou tem de continuar lá.** Se desapareceu, o passo
4 não ficou feito, e é melhor descobrir isso agora do que em Março.

---

## Depois, quando fizer sentido

**Um domínio seu.** Compre `capem.org.br` ou o que for, e em **Settings** →
**Networking** → **Custom Domain** o Railway diz que registo de DNS criar. Depois
mude `CAPEM_BASE` para o novo endereço. O antigo continua a funcionar.

Vale a pena fazer isto **antes** de imprimir seja o que for: os endereços vão
para o papel, e papel não se corrige.

**Avisos no Telegram.** Três minutos, e passa a saber que há um centro à espera
de aprovação sem ter de ir ver. Ver [../server/README.md](../server/README.md).

**Cópias de segurança.** O Railway não faz cópias do volume por si. Enquanto não
houver nada automático, de vez em quando abra a shell da service e descarregue
o `/dados/capem.db` — é um ficheiro só. É a lacuna conhecida mais séria desta
montagem e está anotada como tal.

---

## Quando correr mal

**Fica em "crashed" logo a seguir ao deploy.** Quase de certeza é o
`CAPEM_ADMIN`: em falta, ou com menos de 16 caracteres. Os **Deploy Logs**
dizem-no por extenso — o servidor recusa-se a arrancar de propósito, porque um
servidor que arranca sempre é um servidor que um dia arranca com a fila de
aprovação aberta ao mundo.

**Os centros desaparecem a cada deploy.** Passo 4.

**Os QR apontam para `localhost`.** Falta o `CAPEM_BASE`, ou tem uma barra no
fim. Sem barra no fim.

**"Application failed to respond".** O servidor tem de ouvir na porta que a
plataforma manda no `PORT`, e ouve — mas confirme que não pôs uma variável
`PORT` à mão a dizer outra coisa.

---

## Quanto custa, de verdade

O plano Hobby são 5 USD/mês, que já incluem 5 USD de utilização. Um servidor
pequeno sempre ligado com um volume de 1 GB cabe dentro disso ou fica um pouco
acima — conte 5 a 10 USD por mês. Se isso passar a ser um problema, é sinal de
que isto está a ser usado a sério, e nessa altura um VPS de 4 EUR aguenta o
mesmo trabalho com mais uma tarde de configuração.

Para calibrar: com mil centros no ar, uma máquina destas serve a lista umas
quatrocentas vezes por segundo. O travão desta ferramenta nunca vai ser o
hardware — é haver quem aprove os pedidos e quem telefone aos centros parados.
