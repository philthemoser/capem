/* ============================================================================
 * UI PRIMITIVES
 *
 * Small composable builders returning HTML strings. Accessibility is built in
 * here rather than bolted on: status pills carry a text label as well as a
 * colour, progress bars expose their value to assistive technology, and every
 * interactive element is a real button or input with a focus style.
 * ==========================================================================*/

const STATUS_ICON = {
  critical: '<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><circle cx="6" cy="6" r="5" fill="currentColor"/><rect x="5.2" y="2.8" width="1.6" height="4.2" fill="#fff"/><rect x="5.2" y="8" width="1.6" height="1.6" fill="#fff"/></svg>',
  serious:  '<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M6 1.4 11.2 10.6H0.8z" fill="currentColor"/></svg>',
  warning:  '<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M6 1.4 11.2 10.6H0.8z" fill="currentColor"/></svg>',
  good:     '<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M2 6.4 4.9 9.4 10 3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  neutral:  ''
};

/**
 * A status pill. Never colour alone: the label is always present, so the
 * meaning survives greyscale printing and colour-blind readers.
 */
function pill(level, label) {
  return `<span class="pill pill-${level}">${STATUS_ICON[level] || ''}<span>${esc(label)}</span></span>`;
}

function bar(pctValue, level, label) {
  const v = Math.max(0, Math.min(100, pctValue));
  return `<div class="bar" role="meter" aria-valuenow="${Math.round(v)}" aria-valuemin="0" `
    + `aria-valuemax="100"${label ? ` aria-label="${esc(label)}"` : ''}>`
    + `<i class="bar-${level || 'good'}" style="width:${v}%"></i></div>`;
}

function tile(label, value, sub, opts) {
  opts = opts || {};
  return `<div class="tile${opts.accent ? ' tile-accent' : ''}">`
    + `<div class="t-label">${esc(label)}</div>`
    + `<div class="t-value${opts.small ? ' t-small' : ''}">${value}</div>`
    + (sub ? `<div class="t-sub">${sub}</div>` : '') + `</div>`;
}

function card(title, body, opts) {
  opts = opts || {};
  return `<section class="card${opts.cls ? ' ' + opts.cls : ''}">`
    + (title ? `<h3>${esc(title)}</h3>` : '') + body + `</section>`;
}

/**
 * The rationale panel. In the previous prototype these said "why investors
 * should care". Practitioners are the audience now, so they say what breaks
 * without the feature and what it costs at the table.
 */
function why(title, points) {
  return `<aside class="why"><h3>${esc(title)}</h3><ul>`
    + points.map(p => `<li>${p}</li>`).join('') + `</ul></aside>`;
}

function btn(label, onclick, opts) {
  opts = opts || {};
  const cls = ['btn', opts.primary ? 'btn-primary' : '', opts.small ? 'btn-sm' : '',
               opts.ghost ? 'btn-ghost' : '', opts.danger ? 'btn-danger' : '',
               opts.block ? 'btn-block' : ''].filter(Boolean).join(' ');
  return `<button class="${cls}" ${opts.disabled ? 'disabled ' : ''}`
    + `onclick="${esc(onclick)}"${opts.aria ? ` aria-label="${esc(opts.aria)}"` : ''}>${label}</button>`;
}

function chip(label, on, onclick) {
  const tag = onclick ? 'button' : 'span';
  return `<${tag} class="chip${on ? ' chip-on' : ''}"`
    + (onclick ? ` onclick="${esc(onclick)}" aria-pressed="${!!on}"` : '')
    + `>${esc(label)}</${tag}>`;
}

/** Segmented control. Real tabs with real keyboard semantics. */
function seg(options, current, onclick) {
  return `<div class="seg" role="tablist">` + options.map(o =>
    `<button role="tab" aria-selected="${o.id === current}" class="${o.id === current ? 'on' : ''}" `
    + `onclick="${esc(onclick.replace('{id}', o.id))}">${esc(o.label)}</button>`).join('') + `</div>`;
}

function toggleSwitch(on, onclick, label) {
  return `<button class="toggle${on ? ' on' : ''}" role="switch" aria-checked="${!!on}" `
    + `onclick="${esc(onclick)}" aria-label="${esc(label || '')}"><span></span></button>`;
}

function table(headers, rows, opts) {
  opts = opts || {};
  // The wrapper scrolls horizontally on narrow screens, so it must be
  // focusable — otherwise a keyboard user cannot reach the columns that are
  // off-screen. (WCAG 2.1: scrollable-region-focusable.)
  return `<div class="table-wrap" tabindex="0" role="region"`
    + (opts.caption ? ` aria-label="${esc(opts.caption)}"` : '') + `><table>`
    + (opts.caption ? `<caption>${esc(opts.caption)}</caption>` : '')
    + `<thead><tr>` + headers.map(h =>
        `<th scope="col"${h.num ? ' class="num"' : ''}>${esc(h.label != null ? h.label : h)}</th>`).join('')
    + `</tr></thead><tbody>` + rows.map(r => `<tr>${r}</tr>`).join('') + `</tbody></table></div>`;
}

function screenHead(crumb, title, lede) {
  return `<header class="screen-head">`
    + (crumb ? `<p class="crumb">${esc(crumb)}</p>` : '')
    + `<h1>${esc(title)}</h1>`
    + (lede ? `<p class="lede">${lede}</p>` : '') + `</header>`;
}

function grid(cls, items) { return `<div class="grid ${cls}">${items.join('')}</div>`; }

function levelFor(pctValue) {
  return pctValue >= 95 ? 'good' : pctValue >= 60 ? 'warning' : pctValue >= 30 ? 'serious' : 'critical';
}

function priorityPill(priority) {
  const map = { critical: 'critical', high: 'serious', medium: 'warning', low: 'neutral' };
  return pill(map[priority] || 'neutral', t('priority.' + priority));
}

/**
 * Transient confirmation on a button. Announced politely so screen-reader
 * users get the same feedback sighted users get from the label change.
 */
function flash(el, msg) {
  if (!el) return;
  const original = el.innerHTML;
  el.innerHTML = esc(msg);
  el.disabled = true;
  announce(msg);
  setTimeout(() => { el.innerHTML = original; el.disabled = false; }, 1600);
}

function announce(msg) {
  const region = document.getElementById('live');
  if (region) { region.textContent = ''; setTimeout(() => { region.textContent = msg; }, 30); }
}

/** Marks a control that is intentionally not wired up in the prototype. */
function inert(label, note) {
  return `<span class="inert" title="${esc(note || t('common.notInPrototype'))}">`
    + `${esc(label)}<span class="inert-mark" aria-hidden="true">·</span>`
    + `<span class="sr-only"> — ${esc(note || t('common.notInPrototype'))}</span></span>`;
}
