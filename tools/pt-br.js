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
 * A primeira versão deste teste só apanhava vocabulário, e vocabulário é a
 * metade fácil. Uma auditoria externa mostrou o que passava ao lado: 29
 * ênclises, nove "continuar a fazer", onze "o seu código". Nenhuma palavra
 * errada em lado nenhum — e o texto todo a soar a Lisboa. As regras estruturais
 * abaixo são o que fecha esse buraco; sem elas a suite ficava verde por cima de
 * cinquenta frases por corrigir.
 *
 * Este teste lê SÓ o que o utilizador vê: fora comentários, fora selectores de
 * CSS, fora nomes de variáveis. Os comentários do código continuam em português
 * europeu de propósito — são para quem mexe no código, não para quem o usa, e
 * reescrevê-los agora seria ruído num diff que já é grande.
 *
 * Do `00-i18n.js` lê-se só a coluna pt: a do meio é castelhano, e "contacto",
 * "artefacto" e "demasiado" estão lá certos.
 *
 * Correr: node tools/pt-br.js
 * ==========================================================================*/
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const FICHEIROS = [
  'server/pagina.js', 'server/server.js', 'server/avisos.js', 'server/busca.js',
  'field/src/kit.template.html', 'field/src/kit.js', 'field/src/catalogo.js'
];

/* `\w` é ASCII: não conhece o ç nem as vogais acentuadas. Uma regra com
   (?<![\w-]) lia "peça sua" como "a sua" e acusava a frase certa. As
   fronteiras de palavra abaixo incluem as letras que faltam ao \w.

   Uma regra por linha: o que apanhar, e o que escrever em vez disso. A segunda
   coluna vai directa para o ecrã de quem partiu o teste, por isso diz o que
   fazer e não o nome da regra. */
const TROCAS = [
  /* ---- Vocabulário: palavras que mudam mesmo ---------------------------- */
  [/(?<![\wçãõáéíóúâêôàü-])telemóve(l|is)(?![\wçãõáéíóúâêôàü-])/gi, 'celular / celulares'],
  [/(?<![\wçãõáéíóúâêôàü-])ecrãs?(?![\wçãõáéíóúâêôàü-])/gi, 'tela'],
  [/(?<![\wçãõáéíóúâêôàü-])ficheiros?(?![\wçãõáéíóúâêôàü-])/gi, 'arquivo'],
  [/(?<![\wçãõáéíóúâêôàü-])morada(?![\wçãõáéíóúâêôàü-])/gi, 'endereço'],
  [/(?<![\wçãõáéíóúâêôàü-])contactos?(?![\wçãõáéíóúâêôàü-])/gi, 'contato'],
  [/(?<![\wçãõáéíóúâêôàü-])utilizador(es)?(?![\wçãõáéíóúâêôàü-])/gi, 'usuário'],
  [/(?<![\wçãõáéíóúâêôàü-])equipa(?![\wçãõáéíóúâêôàü-])/gi, 'equipe'],
  [/(?<![\wçãõáéíóúâêôàü-])autocarro(?![\wçãõáéíóúâêôàü-])/gi, 'ônibus'],
  [/(?<![\wçãõáéíóúâêôàü-])descarregar(?![\wçãõáéíóúâêôàü-])/gi, 'baixar'],
  [/(?<![\wçãõáéíóúâêôàü-])sítios?(?![\wçãõáéíóúâêôàü-])/gi, 'lugar / site'],
  [/(?<![\wçãõáéíóúâêôàü-])partilh\w*/gi, 'compartilhar / compartilhamento'],
  [/(?<![\wçãõáéíóúâêôàü-])artefactos?(?![\wçãõáéíóúâêôàü-])/gi, 'artefato'],
  [/(?<![\wçãõáéíóúâêôàü-])demasiad\w*/gi, '"pedidos demais", "excesso de", "muitos"'],
  [/(?<![\wçãõáéíóúâêôàü-])ligaç(ão|ões)(?![\wçãõáéíóúâêôàü-])(?=[^\n]*(servidor|rede|internet))/gi, 'conexão'],
  [/(?<![\wçãõáéíóúâêôàü-])à espera(?![\wçãõáéíóúâêôàü-])/gi, 'aguardando'],
  [/(?<![\wçãõáéíóúâêôàü-])pen(?! drive)(?![\wçãõáéíóúâêôàü-])/gi, 'pen drive'],
  [/(?<![\wçãõáéíóúâêôàü-])[Cc]arregue (em|no|na)(?![\wçãõáéíóúâêôàü-])/g, 'toque em / toque no'],
  [/(?<![\wçãõáéíóúâêôàü-])encontrámos(?![\wçãõáéíóúâêôàü-])/gi, 'encontramos — sem acento no pretérito'],
  [/(?<![\wçãõáéíóúâêôàü-])recolhe(m)? dados/gi, 'coleta dados'],
  [/(?<![\wçãõáéíóúâêôàü-])a preto e branco(?![\wçãõáéíóúâêôàü-])/gi, 'em preto e branco'],
  [/(?<![\wçãõáéíóúâêôàü-])húmid\w+/gi, 'úmido'],
  [/(?<![\wçãõáéíóúâêôàü-])canónic\w+/gi, 'canônico'],
  [/(?<![\wçãõáéíóúâêôàü-])percentagem(?![\wçãõáéíóúâêôàü-])/gi, 'porcentagem'],
  [/(?<![\wçãõáéíóúâêôàü-])regist(o|os)(?![\wçãõáéíóúâêôàü-])/gi, 'registro'],
  [/(?<![\wçãõáéíóúâêôàü-])autocolante(s)?(?![\wçãõáéíóúâêôàü-])/gi, 'adesivo'],
  [/(?<![\wçãõáéíóúâêôàü-])cami(ão|ões)(?![\wçãõáéíóúâêôàü-])/gi, 'caminhão / caminhões'],
  [/(?<![\wçãõáéíóúâêôàü-])planeamento(?![\wçãõáéíóúâêôàü-])/gi, 'planejamento'],
  [/(?<![\wçãõáéíóúâêôàü-])cartão de caixa(?![\wçãõáéíóúâêôàü-])/gi, 'papelão'],

  /* ---- Gramática: a metade que não se resolve com um find & replace ------ */

  /* "está a fazer" é a marca mais audível de todas. Também apanha o particípio
     solto — "pessoas a tentar ajudar" — que é a mesma construção sem o verbo. */
  [/(?<![\wçãõáéíóúâêôàü-])est(á|ão|ava|avam|ou|eve|iver) a [a-zçãõáéíóú]+r(?![\wçãõáéíóúâêôàü-])/gi,
    'está fazendo, não "está a fazer"'],
  [/(?<![\wçãõáéíóúâêôàü-])(pessoas|gente|alguém|ninguém|estranho|centro|voluntário|coordenador) a [a-zçãõáéíóú]+r(?![\wçãõáéíóúâêôàü-])/gi,
    'pessoas fazendo, não "pessoas a fazer"'],
  /* Uma lista fechada de verbos só conhece os que já foram apanhados: esta
     começou com oito e ficou verde por cima de um "A puxar…" durante semanas,
     porque "puxar" não estava lá. Uma regra que só sabe o bug que já foi
     corrigido não é uma regra. Agora são duas:
       · qualquer infinitivo antes de reticências, que é a forma de todas as
         mensagens de estado ("A puxar…", "A gerar…");
       · a lista antiga, para os casos sem reticências. */
  [/(?<![\wçãõáéíóúâêôàü-])A [a-zçãõáéíóúâêô]{2,}(ar|er|ir)(?=\s*(?:…|\.\.\.))/g,
    'no gerúndio: "Puxando…", "Gerando…"'],
  [/(?<![\wçãõáéíóúâêôàü-])A (abrir|carregar|guardar|publicar|imprimir|enviar|procurar|gerar|puxar|conferir)(?![\wçãõáéíóúâêôàü-])/g,
    'Abrindo…, no gerúndio'],

  /* "continua a funcionar" → "continua funcionando". */
  [/(?<![\wçãõáéíóúâêôàü-])continu(a|am|ar|ava|avam|e|em) a [a-zçãõáéíóú]+r(?![\wçãõáéíóúâêôàü-])/gi,
    'continua fazendo / continuar valendo — gerúndio, sem o "a"'],

  /* Ênclise. No Brasil o pronome vem antes do verbo, e no imperativo cai quase
     sempre: "Pregue-a na parede" é "Pregue na parede". Nenhuma palavra composta
     do português (bem-vindo, guarda-roupa, segunda-feira) termina nestes
     pronomes, por isso isto não apanha nada por engano.

     A excepção é o infinitivo: "triá-las", "montá-lo", "recuperá-lo" são
     brasileiros correntes — o -r cai e o pronome cola, e não há outra forma de
     o dizer. O que trai Portugal é a ênclise com verbo conjugado
     ("preenche-se") e com imperativo ("Pregue-a"). A primeira versão desta
     regra não fazia a distinção e acusou onze frases certas na coluna pt do
     protótipo, que é como o erro apareceu. */
  [/(?<![\wçãõáéíóúâêôàü-])[a-zçãõáéíóúâêô]{2,}-(a|o|as|os|se|me|te|nos|vos|lhe|lhes|lo|la|los|las)(?![\wçãõáéíóú-])/gi,
    'pronome antes do verbo ("se escreve"), ou fora dele ("Escreva o nome")',
    /[áâéêíô]-l[oa]s?$/i],

  /* Artigo antes de possessivo: "o seu código" é de Portugal, "seu código" é
     daqui. As contracções (do seu, no seu, ao seu) são normais nos dois e a
     fronteira de palavra deixa-as passar. */
  [/(?<![\wçãõáéíóúâêôàü-])(o|a|os|as) (seu|sua|seus|suas|meu|minha|meus|minhas)(?![\wçãõáéíóúâêôàü-])/gi,
    'sem o artigo: "seu código", "minha lista"'],

  /* "precisa DE fazer" e "tem DE fazer" — no Brasil o "de" cai, ou vira "que". */
  [/(?<![\wçãõáéíóúâêôàü-])precisa(m)? de [a-zçãõáéíóú]+r(?![\wçãõáéíóúâêôàü-])/gi, 'precisa fazer, sem o "de"'],
  [/(?<![\wçãõáéíóúâêôàü-])t(em|êm|inha|er) de [a-zçãõáéíóú]+r(?![\wçãõáéíóúâêôàü-])/gi, 'tem que fazer / precisa fazer'],

  /* ---- Expressões que não viajam ---------------------------------------- */
  /* "imprime na mesma" é de Portugal; "na mesma linha" é só um lugar. A
     diferença está no que vem a seguir: o advérbio fecha a frase. */
  [/(?<![\wçãõáéíóúâêôàü-])na mesma(?=\s*(?:[.,;:!?—<"'’)]|$))/gi, 'do mesmo jeito'],
  [/(?<![\wçãõáéíóúâêôàü-])com conta(?![\wçãõáéíóúâêôàü-])/gi, 'com moderação'],
  [/(?<![\wçãõáéíóúâêôàü-])consigo(?![\wçãõáéíóúâêôàü-])/gi, 'com você'],
  [/(?<![\wçãõáéíóúâêôàü-])a si próprio(s)?(?![\wçãõáéíóúâêôàü-])/gi, 'para você mesmo'],
  [/(?<![\wçãõáéíóúâêôàü-])lado nenhum(?![\wçãõáéíóúâêôàü-])/gi, 'lugar nenhum'],
  /* Duas que passaram ao lado até a página de administração as escrever, e
     que se viam numa captura de ecrã antes de se verem no teste. */
  [/(?<![\wçãõáéíóúâêôàü-])toda a gente(?![\wçãõáéíóúâêôàü-])/gi, 'todo mundo'],
  [/(?<![\wçãõáéíóúâêôàü-])em baixo(?![\wçãõáéíóúâêôàü-])/gi, 'embaixo, numa palavra'],
  /* "consola" é o nome interno de um adaptador em avisos.js e pode ficar; o
     que não pode é chegar ao ecrã. A regra exige a maiúscula ou um espaço à
     frente, para não acusar a chave `consola:` do objecto. */
  [/(?<![\wçãõáéíóúâêôàü-])consola(?![\wçãõáéíóúâêôàü:-])/g, 'console'],
  [/(?<![\wçãõáéíóúâêôàü-])ao turno(?![\wçãõáéíóúâêôàü-])/gi, 'no turno'],
  /* "perceber" existe no Brasil — é "reparar", não "entender". Só se acusa o
     uso europeu, que é o de compreender uma coisa dita. */
  [/(?<![\wçãõáéíóúâêôàü-])[Nn]ão perceb(i|e|eu|emos|eram)(?![\wçãõáéíóúâêôàü-])/g, 'não entendemos'],
  [/(?<![\wçãõáéíóúâêôàü-])[Jj]untar(?![\wçãõáéíóúâêôàü-])(?=[^\n]*(lista|<\/button|botão))/g, 'Adicionar'],
  [/(?<![\wçãõáéíóúâêôàü-])Porquê(?![\wçãõáéíóúâêôàü-])/g, 'Motivo'],
  [/(?<![\wçãõáéíóúâêôàü-])tudo o que(?![\wçãõáéíóúâêôàü-])/gi, 'tudo que'],
  [/(?<![\wçãõáéíóúâêôàü-])não correu(?![\wçãõáéíóúâêôàü-])/gi, 'não rodou'],
  [/(?<![\wçãõáéíóúâêôàü-])fica(m)? a saber(?![\wçãõáéíóúâêôàü-])/gi, 'vai saber'],
  [/(?<![\wçãõáéíóúâêôàü-])valor à(?![\wçãõáéíóúâêôàü-])/gi, 'o valor da'],
  [/(?<![\wçãõáéíóúâêôàü-])se mudam(?![\wçãõáéíóúâêôàü-])/gi, 'são alterados'],
  [/(?<![\wçãõáéíóúâêôàü-])nome chega(?![\wçãõáéíóúâêôàü-])/gi, 'o nome basta'],
];

/** Fora comentários, selectores de CSS e atributos class: nada disso se lê. */
function textoVisivel(fonte) {
  let t = fonte;
  t = t.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  t = t.replace(/^[ \t]*\/\/.*$/gm, m => m.replace(/[^\n]/g, ' '));
  t = t.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '));
  t = t.replace(/^\s*[.#][\w-][^\n{]*\{[^}]*\}/gm, m => m.replace(/[^\n]/g, ' '));
  t = t.replace(/class="[^"]*"/g, '');
  return t;
}

let maus = 0;
const acusar = (onde, linha, achado, certo) => {
  maus++;
  console.log(`  ${onde}  "${achado}"  → ${certo}`);
  console.log(`      ${linha.trim().slice(0, 88)}`);
};

/**
 * Uma frase parte-se ao fim de oitenta colunas; uma expressão não.
 *
 * Isto lia linha a linha, e "legíveis a preto\n e branco" passou despercebido
 * durante semanas por causa de uma quebra de linha no meio — a regra existia,
 * estava certa, e nunca chegou a ver a frase inteira. O texto é lido duas
 * vezes: uma linha a linha (para as regras que dependem do fim da linha, como
 * "na mesma"), e outra com os espaços todos colapsados, para as que só querem a
 * frase. As posições são traduzidas de volta em número de linha, senão o aviso
 * manda alguém procurar às cegas num ficheiro de mil e novecentas linhas.
 */
function porLinha(texto, pos) {
  let n = 1;
  for (let i = 0; i < pos && i < texto.length; i++) if (texto[i] === '\n') n++;
  return n;
}

FICHEIROS.forEach(f => {
  const texto = textoVisivel(fs.readFileSync(path.join(RAIZ, f), 'utf8'));
  const visto = new Set();

  texto.split('\n').forEach((linha, n) => {
    TROCAS.forEach(([re, certo, salvo]) => {
      re.lastIndex = 0;
      const m = re.exec(linha);
      if (m && !(salvo && salvo.test(m[0]))) {
        visto.add(`${n + 1}|${m[0].toLowerCase()}`);
        acusar(`${f}:${n + 1}`, linha, m[0], certo);
      }
    });
  });

  /* Segunda passagem, sem quebras de linha. Só acusa o que a primeira não viu:
     a mesma frase apanhada duas vezes seria ruído no ecrã de quem a vai
     corrigir. */
  const corrido = texto.replace(/[ \t]*\n[ \t]*/g, ' ');
  const mapa = [];
  { let j = 0;
    for (let i = 0; i < texto.length; i++) {
      mapa[j] = i;
      if (/[ \t]/.test(texto[i]) && /[ \t\n]/.test(texto[i + 1] || '')) continue;
      j++;
    }
  }
  TROCAS.forEach(([re, certo, salvo]) => {
    re.lastIndex = 0;
    let m;
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    while ((m = g.exec(corrido)) !== null) {
      if (salvo && salvo.test(m[0])) continue;
      const n = porLinha(texto, mapa[m.index] != null ? mapa[m.index] : 0);
      /* A quebra pode cair antes ou depois: aceita-se a linha e a seguinte. */
      const chave = m[0].toLowerCase();
      if (visto.has(`${n}|${chave}`) || visto.has(`${n + 1}|${chave}`)) continue;
      visto.add(`${n}|${chave}`);
      acusar(`${f}:${n} (frase partida em duas linhas)`,
        corrido.slice(Math.max(0, m.index - 30), m.index + 60), m[0], certo);
    }
  });
});

/* O protótipo guarda as três línguas em triplos [en, es, pt]. Ler o ficheiro em
   texto corrido dava falsos positivos em castelhano — "contacto", "artefacto" e
   "demasiado" são a grafia certa lá. Por isso avalia-se o objecto e lê-se só a
   terceira coluna, que é a única que este teste governa. */
const I18N = 'src/js/00-i18n.js';
try {
  const fonte = fs.readFileSync(path.join(RAIZ, I18N), 'utf8');
  const STRINGS = new Function(fonte + ';return STRINGS;')();
  Object.keys(STRINGS).forEach(chave => {
    const pt = STRINGS[chave][2];
    if (typeof pt !== 'string') return;
    TROCAS.forEach(([re, certo, salvo]) => {
      re.lastIndex = 0;
      const m = re.exec(pt);
      if (m && !(salvo && salvo.test(m[0]))) acusar(`${I18N}  '${chave}'`, pt, m[0], certo);
    });
  });
} catch (e) {
  console.log(`  ${I18N} não pôde ser lido: ${e.message}`);
  maus++;
}

if (!maus) {
  console.log('PASS — nenhum português europeu no texto que o utilizador lê');
  process.exit(0);
}
console.log(`\nFALHA — ${maus} ${maus === 1 ? 'expressão' : 'expressões'} de Portugal no texto visível.`);
console.log('Quem lê isto está no Brasil. Uma palavra fora do lugar diz-lhe que');
console.log('a ferramenta foi feita por alguém que não está lá.');
process.exit(1);
