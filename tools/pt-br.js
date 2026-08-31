#!/usr/bin/env node
/* ============================================================================
 * A LÍNGUA DA INTERFACE É O PORTUGUÊS DO BRASIL
 *
 * Quem usa isto é um coordenador em Canoas e um vizinho com cobertores no
 * carro. O kit impresso trabalha muito para ser reconhecido como local — as
 * marcas, o "não traga", os itens do catálogo. Uma interface que diz
 * "telemóvel" desfaz isso numa palavra: percebe-se à mesma, e percebe-se
 * também que foi feita por alguém que não está lá.
 *
 * Foi exactamente o que aconteceu. O texto visível acumulou seis "telemóvel",
 * nove "ficheiro", quatro "morada" e nove gerúndios à portuguesa antes de
 * alguém reparar, porque cada frase estava bem escrita — só não estava escrita
 * no lugar certo.
 *
 * Este teste lê SÓ o que o utilizador vê: fora comentários, fora selectores de
 * CSS, fora nomes de variáveis. Os comentários do código continuam em português
 * europeu de propósito — são para quem mexe no código, não para quem o usa, e
 * reescrevê-los agora seria ruído num diff que já é grande.
 *
 * Correr: node tools/pt-br.js
 * ==========================================================================*/
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const FICHEIROS = [
  'server/pagina.js', 'server/avisos.js', 'server/busca.js',
  'field/src/kit.template.html', 'field/src/kit.js', 'field/src/catalogo.js'
];

/* pt-PT → pt-BR. Só palavras que mudam mesmo, e só onde a diferença se nota. */
const TROCAS = [
  [/(?<![\w-])telemóve(l|is)(?![\w-])/gi, 'celular / celulares'],
  [/(?<![\w-])ecrãs?(?![\w-])/gi, 'tela'],
  [/(?<![\w-])ficheiros?(?![\w-])/gi, 'arquivo'],
  [/(?<![\w-])morada(?![\w-])/gi, 'endereço'],
  [/(?<![\w-])contacto(s)?(?![\w-])/gi, 'contato'],
  [/(?<![\w-])utilizador(es)?(?![\w-])/gi, 'usuário'],
  [/(?<![\w-])equipa(?![\w-])/gi, 'equipe'],
  [/(?<![\w-])autocarro(?![\w-])/gi, 'ônibus'],
  [/(?<![\w-])descarregar(?![\w-])/gi, 'baixar'],
  [/(?<![\w-])carregue em(?![\w-])/gi, 'clique em'],
  [/(?<![\w-])sítio(?![\w-])/gi, 'lugar / site'],
  /* O gerúndio: "está a fazer" é a marca mais audível de todas. */
  [/(?<![\w-])est(á|ão|ava|avam|ou) a [a-zç]+r(?![\w-])/gi, 'está fazendo, não "está a fazer"'],
  /* "precisa DE fazer" é de Portugal; no Brasil o "de" cai. */
  [/(?<![\w-])precisa(m)? de [a-zç]+r(?![\w-])/gi, 'precisa fazer, sem o "de"'],
  [/(?<![\w-])t(em|êm|inha|er) de [a-zç]+r(?![\w-])/gi, 'tem que fazer'],
];

/** Fora comentários, selectores de CSS e atributos class: nada disso se lê. */
function textoVisivel(fonte) {
  let t = fonte;
  t = t.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  t = t.replace(/^[ \t]*\/\/.*$/gm, '');
  t = t.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '));
  t = t.replace(/^\s*[.#][\w-][^\n{]*\{[^}]*\}/gm, '');
  t = t.replace(/class="[^"]*"/g, '');
  return t;
}

let maus = 0;
FICHEIROS.forEach(f => {
  const texto = textoVisivel(fs.readFileSync(path.join(RAIZ, f), 'utf8'));
  texto.split('\n').forEach((linha, n) => {
    TROCAS.forEach(([re, certo]) => {
      re.lastIndex = 0;
      const m = re.exec(linha);
      if (m) {
        maus++;
        console.log(`  ${f}:${n + 1}  "${m[0]}"  → ${certo}`);
        console.log(`      ${linha.trim().slice(0, 88)}`);
      }
    });
  });
});

if (!maus) {
  console.log('PASS — nenhum português europeu no texto que o utilizador lê');
  process.exit(0);
}
console.log(`\nFALHA — ${maus} ${maus === 1 ? 'expressão' : 'expressões'} de Portugal no texto visível.`);
console.log('Quem lê isto está no Brasil. Uma palavra fora do sítio diz-lhe que');
console.log('a ferramenta foi feita por alguém que não está lá.');
process.exit(1);
