/* ============================================================================
 * GERADOR DE CARTAZ — CAPEM Campo
 *
 * Uma ferramenta, não uma demonstração. Feita para ser usada por um
 * coordenador no celular, num prédio com pouca luz e sinal ruim.
 *
 * Três decisões que mandam em tudo aqui:
 *
 * 1. NÃO TEM SERVIDOR. Tudo roda no navegador. Não há nada para cair, nada
 *    para vazar e nada para pagar. O arquivo funciona aberto de um pen drive.
 *
 * 2. A IMAGEM PARA WHATSAPP É MAIS IMPORTANTE QUE A IMPRESSÃO. A maioria dos
 *    centros não tem impressora à mão. Todo mundo tem WhatsApp.
 *
 * 3. O "NÃO TRAGA" TEM O MESMO PESO VISUAL QUE O "PRECISAMOS". Avisar 200
 *    vizinhos para pararem de mandar roupa evita mais caos do que qualquer
 *    lista de necessidades resolve.
 * ==========================================================================*/

/* ---------------------------------------------------------------------------
 * Catálogo. Voltado para enchente, que é o cenário das próximas semanas —
 * material de limpeza, bota e balde importam tanto quanto água e colchonete.
 * -------------------------------------------------------------------------*/
const ITENS = [
  { g: 'Água e alimento', itens: [
    'Água potável', 'Alimento não perecível', 'Leite em pó', 'Fórmula infantil',
    'Marmita pronta', 'Ração para cães e gatos'
  ]},
  { g: 'Limpeza', itens: [
    'Kit de limpeza', 'Água sanitária', 'Desinfetante', 'Sabão em pó', 'Balde',
    'Rodo', 'Vassoura', 'Pano de chão', 'Saco de lixo'
  ]},
  { g: 'Higiene', itens: [
    'Kit de higiene', 'Sabonete', 'Creme dental', 'Escova de dente',
    'Absorvente', 'Fralda infantil', 'Fralda geriátrica', 'Papel higiênico'
  ]},
  { g: 'Dormir e abrigo', itens: [
    'Colchonete', 'Cobertor', 'Lençol', 'Travesseiro', 'Lona'
  ]},
  { g: 'Proteção e trabalho', itens: [
    'Bota de borracha', 'Luva de borracha', 'Máscara', 'Pá', 'Carrinho de mão'
  ]},
  { g: 'Saúde', itens: [
    'Kit de primeiros socorros', 'Álcool em gel', 'Repelente'
  ]}
];

/* Os dois que sempre afogam um centro. Pré-preenchidos, editáveis. */
const NAO_PADRAO = ['Roupa usada', 'Sacos misturados sem separar', 'Alimento perecível', 'Móveis'];

/* ---------------------------------------------------------------------------
 * Estado. Salvo no aparelho para o coordenador não redigitar tudo amanhã —
 * atualizar a lista todo dia só funciona se levar trinta segundos.
 * -------------------------------------------------------------------------*/
const vazio = () => ({
  nome: '', tipo: 'Ponto de arrecadação', endereco: '', horario: '',
  contato: '', link: '',
  precisa: [], naoTraga: NAO_PADRAO.slice(),
  atualizado: ''
});

let S = vazio();

function salvar() {
  S.atualizado = agora();
  try { localStorage.setItem('capem.cartaz', JSON.stringify(S)); } catch (e) { /* anônima */ }
  desenhar();
}

function carregar() {
  try {
    const raw = localStorage.getItem('capem.cartaz');
    if (raw) S = Object.assign(vazio(), JSON.parse(raw));
  } catch (e) { /* ignora */ }
}

function agora() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} às ${p(d.getHours())}h${p(d.getMinutes())}`;
}

const esc = s => String(s == null ? '' : s)
  .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------------------------------------------------------------------------
 * Formulário
 * -------------------------------------------------------------------------*/
function montarForm() {
  document.getElementById('f-nome').value = S.nome;
  document.getElementById('f-tipo').value = S.tipo;
  document.getElementById('f-endereco').value = S.endereco;
  document.getElementById('f-horario').value = S.horario;
  document.getElementById('f-contato').value = S.contato;
  document.getElementById('f-link').value = S.link;

  document.getElementById('grupos').innerHTML = ITENS.map((grupo, gi) => `
    <fieldset class="grupo">
      <legend>${esc(grupo.g)}</legend>
      <div class="chips">
        ${grupo.itens.map(it => `
          <button type="button" class="chip${S.precisa.includes(it) ? ' on' : ''}"
            aria-pressed="${S.precisa.includes(it)}"
            onclick="alternarItem(${JSON.stringify(it).replace(/"/g, '&quot;')})">${esc(it)}</button>
        `).join('')}
      </div>
    </fieldset>`).join('');

  document.getElementById('lista-precisa').innerHTML = S.precisa.length
    ? S.precisa.map((it, i) => `
        <li>
          <span>${esc(it)}</span>
          <span class="li-acoes">
            <button type="button" onclick="mover(${i},-1)" aria-label="Subir ${esc(it)}" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" onclick="mover(${i},1)" aria-label="Descer ${esc(it)}" ${i === S.precisa.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" class="rm" onclick="removerItem(${i})" aria-label="Remover ${esc(it)}">✕</button>
          </span>
        </li>`).join('')
    : `<li class="vazio">Nenhum item escolhido ainda. Toque nos botões acima.</li>`;

  document.getElementById('lista-nao').innerHTML = S.naoTraga.map((it, i) => `
    <li><span>${esc(it)}</span>
      <span class="li-acoes"><button type="button" class="rm" onclick="removerNao(${i})"
        aria-label="Remover ${esc(it)}">✕</button></span></li>`).join('');
}

function alternarItem(it) {
  const i = S.precisa.indexOf(it);
  if (i >= 0) S.precisa.splice(i, 1); else S.precisa.push(it);
  salvar(); montarForm();
}
function removerItem(i) { S.precisa.splice(i, 1); salvar(); montarForm(); }
function removerNao(i) { S.naoTraga.splice(i, 1); salvar(); montarForm(); }
function mover(i, d) {
  const j = i + d;
  if (j < 0 || j >= S.precisa.length) return;
  [S.precisa[i], S.precisa[j]] = [S.precisa[j], S.precisa[i]];
  salvar(); montarForm();
}
function addLivre() {
  const el = document.getElementById('f-livre');
  const v = el.value.trim();
  if (!v) return;
  if (!S.precisa.includes(v)) S.precisa.push(v);
  el.value = '';
  salvar(); montarForm();
}
function addNao() {
  const el = document.getElementById('f-nao-livre');
  const v = el.value.trim();
  if (!v) return;
  if (!S.naoTraga.includes(v)) S.naoTraga.push(v);
  el.value = '';
  salvar(); montarForm();
}
function campo(id, chave) {
  S[chave] = document.getElementById(id).value;
  salvar();
}
function limparTudo() {
  if (!confirm('Apagar tudo e começar de novo?')) return;
  S = vazio(); salvar(); montarForm();
}

/* ---------------------------------------------------------------------------
 * Cartaz em HTML — usado na tela e na impressão. Texto vetorial, nítido no
 * papel, ao contrário de uma imagem esticada.
 * -------------------------------------------------------------------------*/
function desenhar() {
  const p = document.getElementById('cartaz');
  const temQR = !!S.link.trim();

  p.innerHTML = `
    <div class="c-topo">
      <p class="c-tipo">${esc(S.tipo || 'Ponto de arrecadação')}</p>
      <h1 class="c-nome">${esc(S.nome || 'Nome do centro')}</h1>
    </div>

    <div class="c-precisa">
      <h2>Precisamos hoje</h2>
      ${S.precisa.length
        ? `<ul class="c-lista">${S.precisa.slice(0, 10).map(i => `<li>${esc(i)}</li>`).join('')}</ul>`
        : `<p class="c-placeholder">Escolha os itens ao lado</p>`}
    </div>

    <div class="c-nao">
      <h2>Por favor, não traga</h2>
      <p class="c-nao-itens">${S.naoTraga.map(esc).join(' · ')}</p>
      <p class="c-nao-motivo">Não temos onde separar. Ocupa o espaço do que precisamos.</p>
    </div>

    <div class="c-pe">
      ${temQR ? `<div class="c-qr">${QR.svg(S.link.trim(), 150, { label: 'Lista atualizada' })}
        <p>Lista sempre<br>atualizada aqui</p></div>` : ''}
      <div class="c-dados">
        ${S.endereco ? `<p><b>Endereço</b> ${esc(S.endereco)}</p>` : ''}
        ${S.horario ? `<p><b>Horário</b> ${esc(S.horario)}</p>` : ''}
        ${S.contato ? `<p><b>Contato</b> ${esc(S.contato)}</p>` : ''}
        <p class="c-data">Atualizado ${esc(S.atualizado || agora())}</p>
      </div>
    </div>`;

  const n = S.precisa.length;
  document.getElementById('aviso-itens').hidden = n <= 10;
  document.getElementById('n-itens').textContent = n;
}

/* ---------------------------------------------------------------------------
 * Imagem para WhatsApp.
 *
 * Desenhada no canvas em vez de fotografar o HTML: sem biblioteca externa,
 * resultado idêntico em qualquer aparelho, e o arquivo continua sendo um só.
 * 1080x1350 é o formato que o WhatsApp não corta.
 * -------------------------------------------------------------------------*/
const IMG_W = 1080, IMG_H = 1350;

function desenharCanvas() {
  const cv = document.createElement('canvas');
  cv.width = IMG_W; cv.height = IMG_H;
  const c = cv.getContext('2d');
  const M = 64;                                   // margem
  let y = 0;

  const F = (px, peso) => `${peso || 700} ${px}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

  c.fillStyle = '#ffffff'; c.fillRect(0, 0, IMG_W, IMG_H);

  // Faixa superior
  c.fillStyle = '#16160f'; c.fillRect(0, 0, IMG_W, 226);
  c.fillStyle = '#c9c7bd'; c.font = F(30, 600);
  c.fillText((S.tipo || 'Ponto de arrecadação').toUpperCase(), M, 78);
  c.fillStyle = '#ffffff';
  y = quebrar(c, S.nome || 'Nome do centro', M, 148, IMG_W - M * 2, 60, F(56, 800), 2);

  // Precisamos
  y = 300;
  c.fillStyle = '#1f5fa8'; c.font = F(38, 800);
  c.fillText('PRECISAMOS HOJE', M, y);
  y += 22;
  c.fillStyle = '#1f5fa8'; c.fillRect(M, y, 150, 6);
  y += 48;

  c.fillStyle = '#16160f';
  const lista = S.precisa.slice(0, 10);
  const passo = lista.length > 7 ? 54 : 62;
  const tam = lista.length > 7 ? 38 : 44;
  if (lista.length) {
    lista.forEach(item => {
      c.fillStyle = '#1f5fa8';
      c.beginPath(); c.arc(M + 9, y - tam / 3, 9, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#16160f'; c.font = F(tam, 600);
      c.fillText(cortar(c, item, IMG_W - M * 2 - 44), M + 36, y);
      y += passo;
    });
  } else {
    c.fillStyle = '#8d8b81'; c.font = F(34, 500);
    c.fillText('(escolha os itens)', M, y); y += passo;
  }

  // Não traga — mesmo peso visual que "precisamos", porque é a mensagem mais
  // valiosa do cartaz. A caixa acompanha a lista em vez de ficar presa embaixo:
  // um vão morto no meio faz o leitor parar de ler antes de chegar aqui.
  const larguraCaixa = IMG_W - M * 2;
  const larguraTexto = larguraCaixa - 76;
  const nItens = contarLinhas(c, S.naoTraga.join(' · '), larguraTexto, F(32, 600), 2);
  const nMotivo = contarLinhas(c, MOTIVO, larguraTexto, F(26, 500), 2);
  const boxH = 62 + 50 + nItens * 40 + 6 + nMotivo * 34 + 14;

  const boxY = Math.min(Math.max(y + 20, 620), IMG_H - 214 - boxH);
  c.fillStyle = '#fdf3d9'; c.fillRect(M, boxY, larguraCaixa, boxH);
  c.fillStyle = '#8a6100'; c.fillRect(M, boxY, 10, boxH);

  let by = boxY + 62;
  c.fillStyle = '#8a6100'; c.font = F(36, 800);
  c.fillText('POR FAVOR, NÃO TRAGA', M + 38, by);
  by += 50;
  c.fillStyle = '#6d4d00';
  by = quebrar(c, S.naoTraga.join(' · '), M + 38, by, larguraTexto, 40, F(32, 600), 2);
  by += 6;
  c.fillStyle = '#7a5c1e';
  quebrar(c, MOTIVO, M + 38, by, larguraTexto, 34, F(26, 500), 2);

  // Rodapé
  const py = IMG_H - 190;
  c.fillStyle = '#dedcd4'; c.fillRect(M, py, IMG_W - M * 2, 2);

  const link = S.link.trim();
  let tx = M;
  if (link) {
    const m = QR.encode(link);
    if (m) {
      const n = m.length, cell = 108 / n, ox = M, oy = py + 28;
      c.fillStyle = '#ffffff'; c.fillRect(ox - 6, oy - 6, 120, 120);
      c.fillStyle = '#16160f';
      for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) {
        if (m[r][k]) c.fillRect(ox + k * cell, oy + r * cell, Math.ceil(cell), Math.ceil(cell));
      }
      tx = M + 136;
    }
  }

  c.fillStyle = '#45443d'; c.font = F(25, 500);
  let fy = py + 48;
  const linhas = [];
  if (S.endereco) linhas.push(S.endereco);
  if (S.horario) linhas.push(S.horario);
  if (S.contato) linhas.push(S.contato);
  linhas.slice(0, 3).forEach(l => { c.fillText(cortar(c, l, IMG_W - tx - M), tx, fy); fy += 34; });
  c.fillStyle = '#8d8b81'; c.font = F(23, 500);
  c.fillText('Atualizado ' + (S.atualizado || agora()), tx, fy);

  return cv;
}

const MOTIVO = 'Não temos onde separar. Ocupa o espaço do que precisamos.';

/** Quantas linhas o texto vai ocupar, para dimensionar a caixa antes de desenhar. */
function contarLinhas(c, texto, largura, fonte, maxLinhas) {
  c.font = fonte;
  let linha = '', n = 1;
  String(texto).split(/\s+/).forEach(p => {
    const t = linha ? linha + ' ' + p : p;
    if (c.measureText(t).width > largura && linha) { n++; linha = p; } else linha = t;
  });
  return Math.min(n, maxLinhas || 99);
}

/** Escreve texto quebrando linhas; devolve o y final. */
function quebrar(c, texto, x, y, largura, alturaLinha, fonte, maxLinhas) {
  c.font = fonte;
  const palavras = String(texto).split(/\s+/);
  let linha = '', linhas = [];
  palavras.forEach(p => {
    const t = linha ? linha + ' ' + p : p;
    if (c.measureText(t).width > largura && linha) { linhas.push(linha); linha = p; }
    else linha = t;
  });
  if (linha) linhas.push(linha);
  linhas.slice(0, maxLinhas || 99).forEach((l, i) => {
    const ultima = i === Math.min(linhas.length, maxLinhas || 99) - 1;
    c.fillText(ultima && linhas.length > (maxLinhas || 99) ? l + '…' : l, x, y);
    y += alturaLinha;
  });
  return y;
}

/** Corta com reticências para caber na largura. */
function cortar(c, texto, largura) {
  let t = String(texto);
  if (c.measureText(t).width <= largura) return t;
  while (t.length > 1 && c.measureText(t + '…').width > largura) t = t.slice(0, -1);
  return t + '…';
}

/* ---------------------------------------------------------------------------
 * Compartilhar e baixar
 * -------------------------------------------------------------------------*/
function nomeArquivo() {
  const base = (S.nome || 'cartaz').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'cartaz';
  const d = new Date();
  return `${base}-${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}.png`;
}

function comImagem(fn) {
  desenharCanvas().toBlob(b => fn(b), 'image/png');
}

async function compartilhar(botao) {
  if (!validar()) return;
  comImagem(async blob => {
    const arquivo = new File([blob], nomeArquivo(), { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      try {
        await navigator.share({ files: [arquivo], title: S.nome || 'Cartaz' });
        return;
      } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    baixarBlob(blob);
    avisar(botao, 'Baixado — envie pelo WhatsApp');
  });
}

function baixar(botao) {
  if (!validar()) return;
  comImagem(blob => { baixarBlob(blob); avisar(botao, 'Imagem baixada'); });
}

function baixarBlob(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nomeArquivo();
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function imprimir() { if (validar()) window.print(); }

function validar() {
  if (!S.nome.trim()) {
    alert('Escreva o nome do centro antes de gerar o cartaz.');
    document.getElementById('f-nome').focus();
    return false;
  }
  if (!S.precisa.length && !confirm('Nenhum item na lista de "precisamos". Gerar assim mesmo?')) return false;
  return true;
}

function avisar(botao, msg) {
  if (!botao) return;
  const antes = botao.textContent;
  botao.textContent = msg; botao.disabled = true;
  const live = document.getElementById('live');
  if (live) live.textContent = msg;
  setTimeout(() => { botao.textContent = antes; botao.disabled = false; }, 2200);
}

/* ---------------------------------------------------------------------------
 * Texto para colar no grupo do WhatsApp. Nenhuma integração, nenhum custo,
 * nenhum cadastro na Meta — e chega no mesmo lugar.
 * -------------------------------------------------------------------------*/
function textoWhatsApp() {
  const L = [];
  L.push(`*${(S.nome || 'Centro').toUpperCase()}*`);
  if (S.tipo) L.push(S.tipo);
  L.push('');
  if (S.precisa.length) {
    L.push('*PRECISAMOS HOJE:*');
    S.precisa.forEach(i => L.push('• ' + i));
    L.push('');
  }
  L.push('*POR FAVOR, NÃO TRAGA:* ' + S.naoTraga.join(', '));
  L.push('Não temos onde separar. Ocupa o espaço do que precisamos. 🙏');
  L.push('');
  if (S.endereco) L.push('📍 ' + S.endereco);
  if (S.horario) L.push('🕐 ' + S.horario);
  if (S.contato) L.push('📱 ' + S.contato);
  if (S.link.trim()) L.push('🔗 Lista atualizada: ' + S.link.trim());
  L.push('');
  L.push('_Atualizado ' + (S.atualizado || agora()) + '_');
  return L.join('\n');
}

function copiarTexto(botao) {
  const t = textoWhatsApp();
  const ok = () => avisar(botao, 'Texto copiado');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(ok).catch(() => fallbackCopia(t, ok));
  } else fallbackCopia(t, ok);
}

function fallbackCopia(texto, ok) {
  const ta = document.createElement('textarea');
  ta.value = texto; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); ok(); } catch (e) { alert(texto); }
  ta.remove();
}

function abrirWhatsApp() {
  window.open('https://wa.me/?text=' + encodeURIComponent(textoWhatsApp()), '_blank');
}

function verTexto() {
  const el = document.getElementById('previa-texto');
  el.textContent = textoWhatsApp();
  el.hidden = !el.hidden;
}

/* ---------------------------------------------------------------------------
 * Início
 * -------------------------------------------------------------------------*/
function iniciar() {
  carregar();
  montarForm();
  desenhar();
  ['nome', 'tipo', 'endereco', 'horario', 'contato', 'link'].forEach(k => {
    const el = document.getElementById('f-' + k);
    el.addEventListener('input', () => campo('f-' + k, k));
  });
  document.getElementById('f-livre').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addLivre(); }
  });
  document.getElementById('f-nao-livre').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addNao(); }
  });
}

document.addEventListener('DOMContentLoaded', iniciar);
