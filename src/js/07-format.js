/* ============================================================================
 * FORMATTING + i18n runtime
 * ==========================================================================*/

/** Escapes text for safe interpolation into markup. */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Translate. Keys resolve against STRINGS, which holds [en, es, pt] tuples.
 * Missing keys return the key itself and are reported by tools/check-i18n.js
 * rather than failing silently in front of a reviewer.
 */
function t(key, vars) {
  const row = STRINGS[key];
  const lang = Store.get().lang;
  let out = row ? (row[LANG_INDEX[lang]] || row[0]) : key;
  if (vars) {
    Object.keys(vars).forEach(k => {
      out = out.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
    });
  }
  return out;
}

/** Picks the right entry from a [en, es, pt] tuple carried by scenario data. */
function pick(tuple) {
  if (!Array.isArray(tuple)) return tuple || '';
  return tuple[LANG_INDEX[Store.get().lang]] || tuple[0];
}

function locale() {
  const s = Store.get();
  return (s.data.locale && s.data.locale[s.lang]) || 'en-GB';
}

function num(n) {
  return new Intl.NumberFormat(locale()).format(Math.round(n));
}

/** Currency in the scenario's own rail — COP in Colombia, BRL in Brazil. */
function money(amount, opts) {
  opts = opts || {};
  const cur = Sel.currency();
  try {
    return new Intl.NumberFormat(locale(), {
      style: 'currency', currency: cur,
      minimumFractionDigits: opts.decimals != null ? opts.decimals : (cur === 'COP' ? 0 : 2),
      maximumFractionDigits: opts.decimals != null ? opts.decimals : (cur === 'COP' ? 0 : 2)
    }).format(amount);
  } catch (e) {
    return cur + ' ' + num(amount);
  }
}

/** Compact money for tiles, e.g. COP 4.8M / R$ 96k */
function moneyShort(amount) {
  const cur = Sel.currency();
  const sym = cur === 'COP' ? '$' : 'R$';
  if (amount >= 1e6) return sym + (amount / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (amount >= 1e3) return sym + Math.round(amount / 1e3) + 'k';
  return sym + num(amount);
}

function pct(n) { return num(n) + '%'; }
