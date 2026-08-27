# CAPEM Campo — ferramentas de campo

Ferramentas simples para pontos de arrecadação e abrigos. Não são demonstração:
são para usar.

Cada uma é **um arquivo só**. Funciona sem internet, sem cadastro e sem servidor.
Dá para abrir de um pen drive, mandar por e-mail ou salvar no celular.

---

## 1. Kit de material impresso — `kit.html` ✅ pronto

Preencha os dados do centro **uma vez** e saem **catorze peças** prontas.

**Como usar:** abra o arquivo no celular ou no computador, preencha o nome, o
endereço, o horário, o telefone e o que precisa hoje. Cada peça tem um botão
para imprimir; as duas de WhatsApp têm um botão para gerar a imagem.

![cartaz, panfletos, etiquetas de caixa e crachás gerados a partir dos mesmos dados](exemplo.png)

**Família 1 — anunciar (para fora)**

| Peça | Formato |
|---|---|
| Cartaz de porta | A4 retrato |
| Placa de rua | A3 retrato |
| Post de WhatsApp | 1080 × 1350 |
| Status de WhatsApp | 1080 × 1920 |
| Panfleto | A6, 4-up numa folha A4 |

**Família 2 — operar (dentro do centro)**

| Peça | Formato |
|---|---|
| Etiquetas de caixa | A5 paisagem, 2-up em A4 |
| Sinal da mesa de triagem | A4 paisagem |
| Seta de orientação | A4, seta rotativa |
| Cartão de horário | A5 retrato |

**Família 3 — levar (sai com a pessoa)**

| Peça | Formato |
|---|---|
| Cartão de visita | 85 × 55 mm, 10-up em A4 |
| Cartaz de tiras | A4, 8 tiras para rasgar |
| Cartão de guião do voluntário | A6 |

**Identificação**

| Peça | Formato |
|---|---|
| Crachás | 90 × 60 mm, 8-up em A4 |
| Faixas de braço | 210 × 99 mm, 3-up em A4 |

### O que faz isto ser diferente de um cartaz feito à mão

**Funciona com o texto ignorado.** 28 marcas desenhadas, uma por item. Quem não
lê português — e o sul do Brasil tem comunidades venezuelanas, haitianas e
bolivianas, e chegam socorristas de fora — percebe o cartaz na mesma.

**Funciona a preto e branco.** O toner de cor é o primeiro a acabar, e metade dos
centros fotocopia. Por isso o preto e branco é o desenho principal e a cor é uma
camada por cima: proibido é *anel mais barra* (uma forma), permitido é *anel mais
visto* (uma forma). Há um botão para ver a versão mono antes de imprimir.

**Funciona molhado.** Traços grossos, contraste alto, nada de fios finos nem
texto pequeno em negativo — é o que desaparece primeiro em papel húmido ou
dentro de uma bolsa de plástico.

**Cabe numa impressora de escritório.** Tudo A4, sem sangria, margem de 10 mm,
menos de 8% de cobertura de tinta. As folhas multi-up trazem marcas de corte:
uma folha dá quatro panfletos ou dez cartões, com tesoura.

**O "não traga" tem o mesmo peso que o "precisamos".** Nas enchentes do Rio
Grande do Sul em 2024, roupa chegou a 70% de tudo o que foi arrecadado no país, e
os Correios suspenderam o recebimento. Avisar os vizinhos do que *não* mandar
evita mais transtorno do que qualquer lista de necessidades resolve. Mas são
pessoas a tentar ajudar, por isso a peça não pode soar hostil — daí a linha
"não temos onde guardar — e obrigado por querer ajudar".

**Nenhuma peça depende do QR.** Endereço, horário e telefone estão sempre
escritos. O QR é um extra, nunca o essencial.

**Nada sai do aparelho.** O que escrever fica guardado só no seu celular.

> **Antes de imprimir cem folhas, imprima uma.** Ligue "ver a preto e branco",
> imprima o cartaz de porta e leia-o a dois metros. É o teste que conta.

## 2. Página de necessidades — em construção

Cada centro terá um endereço na internet com a lista sempre atualizada. O
coordenador atualiza pelo celular com um código; quem abre o link vê a versão de
hoje. O QR code das peças aponta para essa página — assim o papel impresso nunca
fica velho.

## 3. Código do saco — em construção

O doador descreve o que está levando e recebe um número. Na chegada, o
voluntário digita o número e já sabe o que tem dentro, sem abrir. O número
carrega a própria lista, então funciona mesmo sem sinal.

---

## Para quem for mexer no código

```bash
node build.js               # monta kit.html a partir de src/
node ../tools/kit-test.js   # 61 verificações (precisa de Playwright)
```

Sem dependências para usar. O `kit.html` gerado fica no repositório — quem só
quer usar não precisa instalar nada. As fontes vêm embutidas no ficheiro, para
o sistema tipográfico não desaparecer justamente quando não há rede.

O sistema de desenho — fichas, regras das marcas, medidas de cada peça, esquemas
de imposição, e os dois sítios onde o código se afasta do desenho e porquê —
está em **[design-system.md](design-system.md)**. O pedido que o originou está em
[design-brief.md](design-brief.md).

```
src/icones.js    as 28 marcas, em SVG
src/catalogo.js  que itens existem e que marca cada um usa
src/kit.css      fichas de design e a medida de cada peça, em milímetros reais
src/kit.js       estado, formulário, as catorze peças, canvas para WhatsApp
src/fonts.css    Archivo e Archivo Black em base64 (SIL OFL)
```

---

**In English:** field tools for Brazilian relief centres, in Portuguese because
that is who uses them. Each is a single self-contained HTML file with no server,
no build step required to use, and no data leaving the device. The printed media
kit generates fourteen pieces — posters, handbills, bin labels, an intake-table
sign, pocket cards, badges — from one set of details, all A4, all legible in pure
black and white, all with a designed icon set so the pieces work with the text
ignored entirely. The needs page and bag-code tool are next. See
[design-system.md](design-system.md) for the design reference and
[../docs/production.md](../docs/production.md) for how this fits the wider plan.

Licença: Apache 2.0, igual ao resto do repositório.
