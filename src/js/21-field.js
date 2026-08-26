/* ============================================================================
 * FIELD SCREENS — intake and the distribution gate.
 *
 * These are the two screens a rotating, untrained volunteer actually touches,
 * usually with a queue forming. They are built for that: large targets, one
 * decision at a time, and no state that is lost if the signal drops.
 * ==========================================================================*/

/* ---- Intake: scan a pre-registered pass ---------------------------------*/
function renderIntakeScan() {
  const s = Store.get();
  const site = Sel.site(s.siteId);
  const d = s.donor;
  const hasPass = d && d.code;

  const scanned = s.scanned;

  let panel;
  if (!scanned) {
    panel = `<div class="scanbox">
        <p class="scan-title">${esc(t('intake.scanOrType'))}</p>
        <label class="sr-only" for="passcode">${esc(t('intake.codeLabel'))}</label>
        <input id="passcode" type="text" value="${esc(hasPass ? d.code : 'CP-2026-08441')}"
          autocomplete="off" spellcheck="false">
        ${btn(t('intake.lookUp'), "intakeLookup()", { primary: true })}
        <p class="scan-hint">${esc(hasPass ? t('intake.yourCodeHint') : t('intake.sampleHint'))}</p>
      </div>`;
  } else {
    panel = `<div class="pass-found">
        <p class="found-head"><b>${esc(t('intake.passFound', { code: scanned.code }))}</b>
          <span>${esc(t('intake.preRegistered'))}</span></p>
        ${scanned.bags.map((b, i) => `<div class="bagline${b.confirmed ? ' done' : ''}">
            <div><b>${esc(t('donor.bagN', { n: i + 1 }))} · ${esc(t('cat.' + b.cat))}</b>
              <span class="bl-sub">${b.items.length ? esc(b.items.map(c => Sel.itemName(c)).join(', ')) : esc(t('intake.contentsInApp'))}</span></div>
            ${b.confirmed ? pill('good', t('intake.booked'))
              : btn(t('intake.confirm'), `intakeConfirmBag(${i})`, { primary: true, small: true })}
          </div>`).join('')}
        ${scanned.cash ? `<div class="bagline"><div><b>${esc(t('donor.cashGift'))}</b>
            <span class="bl-sub">${esc(money(scanned.cash))} · ${esc(Store.get().data.cashRails[0])}</span></div>
            ${pill('good', t('intake.alreadyReceived'))}</div>` : ''}
        <p class="scan-hint">${esc(t('intake.oneTapDoes'))}</p>
        ${btn(t('intake.nextDonor'), "intakeReset()", { block: true })}
      </div>`;
  }

  return screenHead(t('crumb.field', { site: site.name }), t('intake.title'), t('intake.lede'))
    + grid('g3', [
        tile(t('intake.bagsToday'), num(Sel.stats().donorsToday), t('intake.avgSeconds')),
        tile(t('intake.walkInsToday'), num(Sel.stats().walkIns), t('intake.redirected', { n: Sel.stats().redirected })),
        tile(t('intake.connection'), s.online ? t('common.online') : t('common.offline'),
             s.queue.length ? t('intake.queued', { n: s.queue.length }) : t('intake.allSynced'),
             { small: true, accent: !s.online })
      ])
    + `<div class="two-col"><div>` + card(null, panel) + `</div><div class="col-notes">`
    + why(t('intake.whyTitle'), [
        `<b>${esc(t('intake.why1t'))}</b> ${esc(t('intake.why1'))}`,
        `<b>${esc(t('intake.why2t'))}</b> ${esc(t('intake.why2'))}`,
        `<b>${esc(t('intake.why3t'))}</b> ${esc(t('intake.why3'))}`,
        `<b>${esc(t('intake.why4t'))}</b> ${esc(t('intake.why4'))}`
      ])
    + `</div></div>`;
}

function intakeLookup() {
  const input = document.getElementById('passcode');
  const typed = input ? input.value.trim() : '';
  Store.update(s => {
    const d = s.donor;
    if (d && d.code && d.code === typed) {
      // The pass this reviewer just created a moment ago on the donor screen.
      s.scanned = { code: d.code, bags: d.bags.map(b => Object.assign({}, b, { confirmed: false })), cash: d.cash };
    } else {
      // A stand-in pass, so intake can be reviewed without doing the donor flow first.
      s.scanned = {
        code: typed || 'CP-2026-08441',
        bags: [
          { cat: 'hygiene', items: ['HYG-STD'], confirmed: false },
          { cat: 'infant', items: ['BBF-400', 'DIA-M'], confirmed: false }
        ],
        cash: Store.get().data.cashOptions[0].amount
      };
    }
  });
  announce(t('intake.passFound', { code: Store.get().scanned.code }));
}

function intakeConfirmBag(i) {
  const s = Store.get();
  const bag = s.scanned.bags[i];
  if (!bag || bag.confirmed) return;
  Store.update(st => { bag.confirmed = true; });
  // One confirmation, four consequences — all from the same write.
  const codes = bag.items.length ? bag.items : [defaultItemForCat(bag.cat)];
  codes.forEach(code => { if (code) Store.receiveStock(s.siteId, code, 1, s.scanned.code); });
  Store.update(st => {
    st.impact.unshift({ kind: 'received', ref: st.scanned.code, site: st.siteId, at: Store.nowClock() });
  });
  announce(t('intake.bookedAnnounce'));
}

function defaultItemForCat(cat) {
  const it = CATALOG.find(c => c.cat === cat && !c.blocked);
  return it ? it.code : null;
}

function intakeReset() { Store.update(s => { s.scanned = null; }); }

/* ---- Intake: walk-in ----------------------------------------------------*/
function renderIntakeWalkin() {
  const s = Store.get();
  const site = Sel.site(s.siteId);
  const q = s.walkinQuery || '';
  const matches = q ? matchCatalog(q) : [];

  return screenHead(t('crumb.field', { site: site.name }), t('walkin.title'), t('walkin.lede'))
    + `<div class="two-col"><div>`
    + card(null, `
        <label class="f-label" for="walkin">${esc(t('walkin.whatBringing'))}</label>
        <input id="walkin" type="text" value="${esc(q)}" placeholder="${esc(t('walkin.placeholder'))}"
          oninput="walkinSearch(this.value)" autocomplete="off" spellcheck="false">
        <p class="f-hint">${esc(t('walkin.aliasHint'))}</p>
        ${q && !matches.length ? `<p class="empty">${esc(t('walkin.noMatch'))}</p>` : ''}
        ${matches.map(m => walkinResult(m)).join('')}
      `)
    + `</div><div class="col-notes">`
    + card(t('walkin.tryTitle'),
        `<p>${esc(t('walkin.tryBody'))}</p><div class="chips">`
        + ['cobijas', 'fórmula', 'agua', 'ropa', 'limpeza', 'colchonete']
            .map(x => chip(x, false, `walkinSearch('${x}'); document.getElementById('walkin').value='${x}'`)).join('')
        + `</div>`)
    + why(t('walkin.whyTitle'), [
        `<b>${esc(t('walkin.why1t'))}</b> ${esc(t('walkin.why1'))}`,
        `<b>${esc(t('walkin.why2t'))}</b> ${esc(t('walkin.why2'))}`,
        `<b>${esc(t('walkin.why3t'))}</b> ${esc(t('walkin.why3'))}`
      ])
    + `</div></div>`;
}

/** Alias matching — the unglamorous thing that stops one item becoming three. */
function matchCatalog(query) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const norm = str => str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const nq = norm(q);
  return CATALOG.filter(c =>
    c.aliases.some(a => norm(a).includes(nq) || nq.includes(norm(a)))
    || c.name.some(n => norm(n).includes(nq))
  ).slice(0, 4);
}

function walkinSearch(v) { Store.update(s => { s.walkinQuery = v; }); }

function walkinResult(it) {
  const s = Store.get();
  if (it.blocked) {
    const wanted = Sel.needs({ site: s.siteId, publishedOnly: true })
      .filter(n => n.pct < 60).slice(0, 3).map(n => Sel.itemName(n.item));
    return `<div class="bagline blocked">
        <div><b>${esc(Sel.itemName(it.code))}</b>
        <span class="bl-sub">${esc(t('walkin.offCatalogue'))}</span></div>
        ${pill('serious', t('walkin.redirect'))}
      </div>
      <div class="steer" role="note">
        <b>${esc(t('walkin.scriptTitle'))}</b>
        <p class="script">${esc(t('walkin.script', { needs: wanted.join(', ') }))}</p>
        <p class="steer-alt">${esc(t('walkin.logged'))}</p>
        ${btn(t('walkin.logRedirect'), "walkinLogRedirect(this)", { small: true })}
      </div>`;
  }
  const need = Sel.needs({ site: s.siteId }).find(n => n.item === it.code);
  return `<div class="bagline">
      <div><b>${esc(Sel.itemName(it.code))} <span class="code">${esc(it.code)}</span></b>
        <span class="bl-sub">${esc(t('walkin.matchedVia', { alias: it.aliases[0] }))}${
          need ? ` · ${esc(t('walkin.openNeed', { have: num(need.have), target: num(need.target) }))}` : ` · ${esc(t('walkin.noOpenNeed'))}`}</span></div>
      ${need ? priorityPill(need.priority) : pill('neutral', t('walkin.acceptAnyway'))}
    </div>
    <div class="qty-row">
      <label class="f-label" for="wq-${it.code}">${esc(t('walkin.quantity'))}</label>
      <input id="wq-${it.code}" type="number" value="6" min="1" max="999">
      ${btn(t('walkin.book'), `walkinBook('${it.code}', this)`, { primary: true, small: true })}
    </div>`;
}

function walkinBook(code, el) {
  const input = document.getElementById('wq-' + code);
  const qty = Math.max(1, parseInt(input ? input.value : '1', 10) || 1);
  Store.receiveStock(Store.get().siteId, code, qty, t('walkin.walkInRef'));
  flash(el, t('walkin.booked', { n: qty }));
}

function walkinLogRedirect(el) {
  Store.update(s => {
    s.data.stats.redirected += 1;
    s.data.movements.unshift({
      time: Store.nowClock(), type: 'redirect', item: 'CLO-USED', qty: 0,
      site: s.siteId, src: 'walk', ref: t('walkin.offCatalogue'), by: 'this session'
    });
  });
  flash(el, t('walkin.redirectLogged'));
}

/* ---- Intake: register people -------------------------------------------*/
function renderIntakePeople() {
  const s = Store.get();
  const site = Sel.site(s.siteId);
  const fams = Sel.families(s.siteId);

  return screenHead(t('crumb.fieldPeople', { site: site.name }), t('people.title'), t('people.lede'))
    + `<div class="two-col"><div>`
    + card(t('people.formTitle'), `
        <label class="f-label" for="pname">${esc(t('people.nameLabel'))}</label>
        <input id="pname" type="text" placeholder="${esc(t('people.namePlaceholder'))}" autocomplete="off">
        <p class="f-hint">${esc(t('people.nameHint'))}</p>
        <div class="grid g2">
          <div><label class="f-label" for="psize">${esc(t('people.size'))}</label>
            <input id="psize" type="number" value="4" min="1" max="20"></div>
          <div><label class="f-label" for="punder5">${esc(t('people.under5'))}</label>
            <input id="punder5" type="number" value="1" min="0" max="10"></div>
          <div><label class="f-label" for="pover65">${esc(t('people.over65'))}</label>
            <input id="pover65" type="number" value="0" min="0" max="10"></div>
          <div><label class="f-label" for="pshelter">${esc(t('people.sheltered'))}</label>
            <select id="pshelter"><option value="yes">${esc(t('common.yes'))}</option>
              <option value="no">${esc(t('common.no'))}</option></select></div>
        </div>
        <p class="f-label">${esc(t('people.immediateNeeds'))}</p>
        <div class="chips" id="pneeds">
          ${['shelter', 'food', 'medical', 'infant', 'water'].map(n =>
            chip(t('need.' + n), n === 'shelter', `toggleChip(this)`)).join('')}
        </div>
        <div class="row-actions">${btn(t('people.register'), "registerPerson(this)", { primary: true })}</div>
        <p class="f-hint">${esc(t('people.refHint'))}</p>
      `)
    + `</div><div class="col-notes">`
    + card(t('people.protectTitle'), `
        <ul class="why-list">
          <li><b>${esc(t('people.p1t'))}</b> ${esc(t('people.p1'))}</li>
          <li><b>${esc(t('people.p2t'))}</b> ${esc(t('people.p2'))}</li>
          <li><b>${esc(t('people.p3t'))}</b> ${esc(t('people.p3'))}</li>
        </ul>
        <p class="note-link"><a href="#/about/about-data">${esc(t('people.readPolicy'))}</a></p>`)
    + grid('g2', [
        tile(t('people.registeredHere'), num(fams.length), t('people.households')),
        tile(t('people.peopleHere'), num(Sel.peopleCount(s.siteId)), t('people.under5Count', { n: Sel.under5Count(s.siteId) }))
      ])
    + `</div></div>`;
}

function toggleChip(el) {
  el.classList.toggle('chip-on');
  el.setAttribute('aria-pressed', el.classList.contains('chip-on'));
}

function registerPerson(el) {
  const val = id => { const e = document.getElementById(id); return e ? e.value : ''; };
  const size = Math.max(1, parseInt(val('psize'), 10) || 1);
  const under5 = Math.max(0, parseInt(val('punder5'), 10) || 0);
  const over65 = Math.max(0, parseInt(val('pover65'), 10) || 0);
  const sheltered = val('pshelter') === 'yes';
  const needs = [...document.querySelectorAll('#pneeds .chip-on')].map(c => c.textContent.trim());

  const site = Store.get().siteId;
  const prefix = site.slice(0, 2).toUpperCase();
  const ref = prefix + '-' + String(9000 + Sel.families(site).length).padStart(4, '0');

  Store.registerFamily({
    ref: ref, site: site, size: size, under5: Math.min(under5, size), over65: Math.min(over65, size),
    medical: needs.some(n => n === t('need.medical')), sheltered: sheltered,
    daysWaiting: 0, needs: needs, received: {}
  });
  flash(el, t('people.registered', { ref: ref }));
}

/* ---- Distribution gate --------------------------------------------------*/
function renderGate() {
  const s = Store.get();
  const site = Sel.site(s.siteId);
  const open = s.vouchers.filter(v => v.site === s.siteId && v.status !== 'fulfilled');
  const done = s.vouchers.filter(v => v.site === s.siteId && v.status === 'fulfilled');
  const selected = s.gateRef ? s.vouchers.find(v => v.ref === s.gateRef) : null;

  let panel;
  if (!s.vouchers.length) {
    panel = `<div class="empty-state">
        <p>${esc(t('gate.noVouchers'))}</p>
        ${btn(t('gate.goToMatching'), "go('coord','coord-match')", { primary: true })}
      </div>`;
  } else if (!selected) {
    panel = `<div class="scanbox">
        <p class="scan-title">${esc(t('gate.scanOrType'))}</p>
        <label class="sr-only" for="voucherref">${esc(t('gate.refLabel'))}</label>
        <input id="voucherref" type="text" value="${esc(open.length ? open[0].ref : '')}"
          autocomplete="off" spellcheck="false">
        ${btn(t('gate.lookUp'), "gateLookup()", { primary: true })}
      </div>
      <p class="f-label">${esc(t('gate.queueNow'))}</p>
      <div class="queue">${open.slice(0, 6).map(v =>
        `<button class="queue-item" onclick="gateSelect('${v.ref}')">
          <b>${esc(v.ref)}</b><span>${esc(t('gate.lines', { n: v.lines.length }))}</span></button>`).join('')}</div>`;
  } else {
    const fam = Sel.families().find(f => f.ref === selected.family);
    panel = `<div class="voucher">
        <div class="voucher-top">
          <div><b>${esc(selected.ref)}</b>
            <span>${esc(t('gate.household', { size: fam ? fam.size : '?', under5: fam ? fam.under5 : 0 }))}</span></div>
          ${selected.status === 'fulfilled' ? pill('good', t('gate.fulfilled') + ' · ' + selected.fulfilledAt) : pill('neutral', t('gate.ready'))}
        </div>
        ${selected.lines.map(l => `<div class="bagline">
            <div><b>${esc(Sel.itemName(l.item))}</b>
              <span class="bl-sub">${esc(pick(ENTITLEMENTS[l.ruleIndex].rule))}</span></div>
            <b class="qty">× ${num(l.qty)}</b></div>`).join('')}
        ${selected.status !== 'fulfilled'
          ? btn(t('gate.handOver'), `gateFulfil('${selected.ref}')`, { primary: true, block: true })
          : `<p class="scan-hint">${esc(t('gate.afterFulfil'))}</p>`}
        ${btn(t('gate.back'), "gateSelect(null)", { block: true })}
      </div>`;
  }

  return screenHead(t('crumb.gate', { site: site.name }), t('gate.title'), t('gate.lede'))
    + grid('g3', [
        tile(t('gate.fulfilledToday'), num(done.length), t('gate.thisSession')),
        tile(t('gate.inQueue'), num(open.length), t('gate.issuedByEngine')),
        tile(t('gate.stockReserved'), t('gate.atIssue'), t('gate.neverBounces'), { small: true })
      ])
    + `<div class="two-col"><div>` + card(null, panel) + `</div><div class="col-notes">`
    + why(t('gate.whyTitle'), [
        `<b>${esc(t('gate.why1t'))}</b> ${esc(t('gate.why1'))}`,
        `<b>${esc(t('gate.why2t'))}</b> ${esc(t('gate.why2'))}`,
        `<b>${esc(t('gate.why3t'))}</b> ${esc(t('gate.why3'))}`,
        `<b>${esc(t('gate.why4t'))}</b> ${esc(t('gate.why4'))}`
      ])
    + `</div></div>`;
}

function gateLookup() {
  const el = document.getElementById('voucherref');
  const ref = el ? el.value.trim() : '';
  const found = Store.get().vouchers.find(v => v.ref === ref);
  if (found) gateSelect(ref);
  else announce(t('gate.notFound'));
}

function gateSelect(ref) { Store.update(s => { s.gateRef = ref; }); }

function gateFulfil(ref) {
  Store.fulfilVoucher(ref);
  announce(t('gate.fulfilledAnnounce'));
}
