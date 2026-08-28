/* ============================================================================
 * AVISOS
 *
 * Como o servidor chega a uma pessoa. Duas direcções, e não são a mesma coisa:
 *
 *   PARA QUEM ADMINISTRA — "chegou um pedido", "há três centros parados".
 *     É uma pessoa, o seu próprio telemóvel. Telegram, ntfy ou um webhook
 *     resolvem isto em dois minutos e de graça.
 *
 *   PARA OS COORDENADORES — "a sua lista tem quatro dias, atualize".
 *     Esses vivem no WhatsApp e não vão ler e-mail nenhum. Mas isso NÃO se faz
 *     daqui: faz-se com um link wa.me na fila de aprovação, que abre a conversa
 *     com a mensagem já escrita. Ver `linkWhatsApp` mais abaixo.
 *
 * Porque é que o WhatsApp não está aqui dentro (Agosto de 2026):
 *
 *   A Cloud API é viável — não exige verificação da empresa para começar, dá
 *   250 conversas iniciadas por 24 h sem ela, e um template utilitário no
 *   Brasil custa cerca de $0,0068. O que exige é um número de telefone
 *   dedicado que não pode ser um WhatsApp normal, um URL de política de
 *   privacidade publicado, templates aprovados um a um, e consentimento
 *   explícito de cada centro.
 *
 *   Nada disso se justifica para avisar UMA pessoa de que chegou um pedido. E
 *   para empurrar doze centros, um toque num link faz o mesmo hoje, sem
 *   número novo, e deixa quem administra ver quem está a chatear — o que numa
 *   emergência é uma vantagem e não um atraso.
 *
 *   Quando fizer sentido automatizar, entra aqui como mais um adaptador ao pé
 *   do telegram e do ntfy. Nada no resto do servidor muda: só se conhece
 *   `avisar()`.
 *
 * REGRA DURA: um aviso nunca pode partir um pedido. Tudo aqui apanha os seus
 * próprios erros, tem prazo, e nunca é esperado por quem está a responder a
 * um browser.
 * ==========================================================================*/

const PRAZO = 8000;

/* ---------------------------------------------------------------------------
 * Telefones
 *
 * Um número escrito por uma pessoa — "(51) 99612-0044" — não é um número que
 * o WhatsApp aceite num link. Isto é uma heurística e assume-se que é: junta
 * o indicativo do país quando ele obviamente falta. Se estiver errado, o
 * link abre o WhatsApp com um número que não existe, e quem administra vê-o
 * logo. Errar em silêncio seria pior.
 * -------------------------------------------------------------------------*/
const PAIS = String(process.env.CAPEM_PAIS || '55');

function telefoneInternacional(bruto) {
  const t = String(bruto || '').trim();
  if (!t) return '';
  const mais = t.startsWith('+');
  const d = t.replace(/\D/g, '');
  if (!d) return '';
  if (mais) return d;                    // já veio internacional
  if (d.startsWith(PAIS) && d.length > 11) return d;
  return PAIS + d;
}

/** Um link que abre a conversa com a mensagem já escrita. */
function linkWhatsApp(telefone, texto) {
  const n = telefoneInternacional(telefone);
  if (!n) return '';
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

/* ---------------------------------------------------------------------------
 * Adaptadores
 * -------------------------------------------------------------------------*/
async function comPrazo(promessa) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), PRAZO);
  try { return await promessa(ac.signal); } finally { clearTimeout(t); }
}

const ADAPTADORES = {
  /* Sempre ligado. Se mais nada estiver configurado, pelo menos fica no log
     da máquina — que é onde alguém vai procurar quando perguntar "porque é
     que ninguém me avisou". */
  consola: {
    activo: () => true,
    enviar: async ({ titulo, corpo }) => {
      console.log(`\n[aviso] ${titulo}\n${corpo}\n`);
    }
  },

  telegram: {
    activo: () => !!(process.env.CAPEM_TELEGRAM_TOKEN && process.env.CAPEM_TELEGRAM_CHAT),
    enviar: ({ titulo, corpo, url }) => comPrazo(signal =>
      fetch(`https://api.telegram.org/bot${process.env.CAPEM_TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.CAPEM_TELEGRAM_CHAT,
          text: `*${escaparMd(titulo)}*\n\n${escaparMd(corpo)}${url ? `\n\n${escaparMd(url)}` : ''}`,
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: true
        })
      }).then(async r => {
        if (!r.ok) throw new Error('telegram ' + r.status + ' ' + (await r.text()).slice(0, 200));
      }))
  },

  ntfy: {
    activo: () => !!process.env.CAPEM_NTFY,
    enviar: ({ titulo, corpo, url }) => comPrazo(signal =>
      fetch(process.env.CAPEM_NTFY, {
        method: 'POST', signal,
        headers: { Title: enc(titulo), ...(url ? { Click: url } : {}) },
        body: corpo
      }).then(r => { if (!r.ok) throw new Error('ntfy ' + r.status); }))
  },

  /* A saída para tudo o resto — Slack, Discord, n8n, o que existir daqui a um
     ano. Um POST com JSON e mais nada. */
  webhook: {
    activo: () => !!process.env.CAPEM_WEBHOOK,
    enviar: (aviso) => comPrazo(signal =>
      fetch(process.env.CAPEM_WEBHOOK, {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aviso)
      }).then(r => { if (!r.ok) throw new Error('webhook ' + r.status); }))
  }
};

/* O Telegram exige que se escape um punhado de caracteres no MarkdownV2, e um
   deles é o hífen — que está em todos os endereços que este servidor gera. */
const escaparMd = s => String(s == null ? '' : s)
  .replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, c => '\\' + c);

/* Os cabeçalhos HTTP são latin-1; um título com acentos parte o pedido. */
const enc = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Envia um aviso por todos os canais configurados.
 *
 * Não devolve nada de útil e nunca é esperado: quem chama segue em frente. Um
 * bot do Telegram em baixo não pode fazer um centro deixar de conseguir pedir
 * a sua página.
 */
function avisar(aviso) {
  Object.entries(ADAPTADORES).forEach(([nome, a]) => {
    if (!a.activo()) return;
    Promise.resolve()
      .then(() => a.enviar(aviso))
      .catch(e => console.error(`[aviso:${nome}] falhou —`, e && e.message));
  });
}

/** Que canais estão realmente ligados. Serve para o arranque dizer a verdade. */
const canaisActivos = () =>
  Object.entries(ADAPTADORES).filter(([, a]) => a.activo()).map(([n]) => n);

module.exports = { avisar, canaisActivos, linkWhatsApp, telefoneInternacional, ADAPTADORES };
