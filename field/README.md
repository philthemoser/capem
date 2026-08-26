# CAPEM Campo — ferramentas de campo

Ferramentas simples para pontos de arrecadação e abrigos. Não são demonstração:
são para usar.

Cada uma é **um arquivo só**. Funciona sem internet, sem cadastro e sem servidor.
Dá para abrir de um pen drive, mandar por e-mail ou salvar no celular.

---

## 1. Gerador de cartaz — `cartaz.html` ✅ pronto

Gera o cartaz de "precisamos hoje / por favor não traga" do seu centro.

**Como usar:** abra o arquivo no celular ou no computador, preencha, toque em
**Gerar imagem e compartilhar**. A imagem vai direto para o WhatsApp.

- Imagem 1080×1350, no formato que o WhatsApp não corta
- Versão para imprimir em A4
- Texto pronto para colar no grupo
- O que você escreve fica salvo no aparelho — amanhã é só ajustar a lista
- Nada sai do seu celular

![exemplo de cartaz](exemplo.png)

**Por que o "não traga" tem o mesmo tamanho que o "precisamos":** nas enchentes
do Rio Grande do Sul em 2024, roupa chegou a 70% de tudo o que foi arrecadado no
país, e os Correios suspenderam o recebimento. Avisar os vizinhos do que *não*
mandar evita mais transtorno do que qualquer lista de necessidades resolve.

## 2. Página de necessidades — em construção

Cada centro terá um endereço na internet com a lista sempre atualizada. O
coordenador atualiza pelo celular com um código; quem abre o link vê a versão de
hoje. O QR code do cartaz aponta para essa página — assim o cartaz impresso
nunca fica velho.

## 3. Código do saco — em construção

O doador descreve o que está levando e recebe um número. Na chegada, o
voluntário digita o número e já sabe o que tem dentro, sem abrir. O número
carrega a própria lista, então funciona mesmo sem sinal.

---

## Para quem for mexer no código

```bash
node build.js     # monta cartaz.html a partir de src/
```

Sem dependências. O `cartaz.html` gerado fica no repositório — quem só quer usar
não precisa instalar nada.

Testes: `node ../tools/cartaz-test.js` (precisa de Playwright).

---

**In English:** field tools for Brazilian relief centres, in Portuguese because
that is who uses them. Each is a single self-contained HTML file with no server,
no build step required to use, and no data leaving the device. The poster
generator is finished; the needs page and bag-code tool are next. See
[../docs/production.md](../docs/production.md) for how this fits the wider plan.

Licença: Apache 2.0, igual ao resto do repositório.
