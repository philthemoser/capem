/* ============================================================================
 * DONOR SCREENS — public, no account.
 *
 * The signature mechanism lives here: a donor describes each bag or box before
 * leaving home and gets one code. Intake then becomes a scan instead of an
 * interrogation, and the centre can steer what arrives before it arrives.
 *
 * Three corrections against the earlier prototype, all of which were things a
 * reviewer would have found by clicking:
 *   - choosing a centre now actually changes the centre on the pass;
 *   - the "best match" ranking is computed from what is in the bags, against
 *     live unmet need, rather than being a static label;
 *   - a bag of a blocked category cannot be carried through to a pass, which
 *     is the entire point of steering.
 * ==========================================================================*/

const DONOR_CATEGORIES = ['hygiene', 'infant', 'food', 'water', 'shelter', 'medical', 'blocked'];

function donorDraft() {
  const s = Store.get();
  if (!s.donor) {
    s.donor = { step: 'home', bags: [], cash: 0, cashKey: null, centre: null, code: null };
  }
  return s.donor;
}

function donorGo(step) {
  Store.update(s => { donorDraft().step = step; });
  window.scrollTo(0, 0);
}

function donorAddBag(cat) {
  Store.update(() => {
    donorDraft().bags.push({ cat: cat || 'hygiene', items: [], note: '' });
  });
}

function donorRemoveBag(i) { Store.update(() => { donorDraft().bags.splice(i, 1); }); }

function donorSetBagCat(i, cat) {
  Store.update(() => { const b = donorDraft().bags[i]; b.cat = cat; b.items = []; });
}

function donorToggleItem(i, code) {
  Store.update(() => {
    const b = donorDraft().bags[i];
    const at = b.items.indexOf(code);
    if (at >= 0) b.items.splice(at, 1); else b.items.push(code);
  });
}

function donorSetCash(amount, key) {
  Store.update(() => { const d = donorDraft(); d.cash = amount; d.cashKey = key; });
}

function donorPickCentre(siteId) {
  Store.update(() => { donorDraft().centre = siteId; });
}

/** Categories actually packed, ignoring anything blocked. */
function donorPackedCategories() {
  return [...new Set(donorDraft().bags.map(b => b.cat).filter(c => c !== 'blocked'))];
}

function donorHasBlockedBag() {
  return donorDraft().bags.some(b => b.cat === 'blocked');
}

function donorGenerateCode() {
  Store.update(() => {
    const d = donorDraft();
    if (!d.centre) d.centre = Sel.suggestCentres(donorPackedCategories())[0].site.id;
    const n = 9000 + Math.floor(Math.random() * 900);
    d.code = 'CP-2026-0' + n;
    d.step = 'pass';
    // Pledged goods become visible as incoming stock straight away. A centre
    // that can see what is on its way can stop asking for it.
    d.bags.forEach(bag => bag.items.forEach(code => {
      const row = Store.get().data.stock.find(r => r.site === d.centre && r.item === code);
      if (row) row.incoming += 1;
    }));
    Store.get().impact.unshift({ kind: 'pledged', ref: d.code, site: d.centre, at: Store.nowClock() });
  });
}

function donorReset() {
  Store.update(s => { s.donor = null; });
  donorGo('home');
}

/* -------------------------------------------------------------------------*/
function renderDonorGive() {
  const d = donorDraft();
  const body = { home: donorHome, cash: donorCash, bags: donorBags,
                 centre: donorCentre, review: donorReview, pass: donorPass }[d.step] || donorHome;

  return screenHead(t('crumb.donorPublic'), t('donor.title'), t('donor.lede'))
    + `<div class="two-col">`
    + `<div class="phone" role="region" aria-label="${esc(t('donor.phoneLabel'))}">`
    + `<div class="phone-head"><div class="ph-brand">${BRAND_MARK_SM} CAPEM</div>`
    + `<p class="ph-event">${esc(pick(Sel.event().name))}</p>`
    + `<p class="ph-region">${esc(pick(Sel.event().region))}</p></div>`
    + `<div class="phone-body">${body()}</div></div>`
    + `<div class="col-notes">` + donorNotes() + `</div></div>`;
}

function donorHome() {
  const needs = Sel.needs({ publishedOnly: true }).filter(n => n.pct < 95).slice(0, 4);
  return `<h2 class="ph-h2">${esc(t('donor.howHelp'))}</h2>`
    + `<button class="entry" onclick="donorGo('cash')">
         <span class="entry-ico">${ICON_CASH}</span>
         <span><b>${esc(t('donor.giveMoney'))}</b><span>${esc(t('donor.giveMoneySub', { rails: Store.get().data.cashRails.slice(0, 2).join(' / ') }))}</span></span>
       </button>`
    + `<button class="entry" onclick="donorGo('bags')">
         <span class="entry-ico">${ICON_BAG}</span>
         <span><b>${esc(t('donor.haveItems'))}</b><span>${esc(t('donor.haveItemsSub'))}</span></span>
       </button>`
    + `<p class="ph-section">${esc(t('donor.orAnswer'))}</p>`
    + needs.map(n => {
        const s = Sel.site(n.site);
        return `<article class="need">
          <div class="need-top"><b>${esc(Sel.itemName(n.item))}</b>${priorityPill(n.priority)}</div>
          <p class="need-where">${esc(s.name)} · ${esc(s.municipality)}</p>
          ${bar(n.pct, n.status, Sel.itemName(n.item))}
          <p class="need-num">${num(n.have)} / ${num(n.target)} ${esc(Sel.itemUnit(n.item))}</p>
          <div class="need-actions">
            ${btn(t('donor.bringIt'), `donorAnswerNeed('${n.item}','${n.site}')`, { primary: true, small: true })}
            ${btn(t('donor.fundIt'), `donorGo('cash')`, { small: true })}
          </div></article>`;
      }).join('');
}

function donorAnswerNeed(itemCode, siteId) {
  const it = Sel.item(itemCode);
  Store.update(() => {
    const d = donorDraft();
    d.bags.push({ cat: it.cat, items: [itemCode], note: '' });
    d.centre = siteId;
    d.step = 'bags';
  });
}

function donorCash() {
  const d = donorDraft();
  const opts = Store.get().data.cashOptions;
  return `<h2 class="ph-h2">${esc(t('donor.cashTitle'))}</h2>`
    + `<p class="ph-note">${esc(t('donor.cashWhy'))}</p>`
    + opts.map(o => `<button class="cash-opt${d.cash === o.amount ? ' sel' : ''}" onclick="donorSetCash(${o.amount},'${o.key}')">
        <span><b>${esc(t('cash.' + o.key))}</b><span class="co-sub">${esc(t('cash.' + o.key + '.sub'))}</span></span>
        <span class="co-amt">${esc(money(o.amount))}</span></button>`).join('')
    + `<p class="f-label">${esc(t('donor.payWith'))}</p><div class="chips">`
    + Store.get().data.cashRails.map((r, i) => chip(r, i === 0)).join('') + `</div>`
    + `<div class="row-actions">${btn(t('common.back'), "donorGo('home')", { block: true })}
        ${btn(t('common.continue'), "donorGo(donorDraft().bags.length ? 'centre' : 'review')", { primary: true, block: true, disabled: !d.cash })}</div>`
    + `<p class="ph-note">${esc(t('donor.cashAlsoItems'))}</p>`;
}

function donorBags() {
  const d = donorDraft();
  if (!d.bags.length) donorAddBag('hygiene');

  return `<h2 class="ph-h2">${esc(t('donor.packTitle', { n: d.bags.length }))}</h2>`
    + `<p class="ph-note">${esc(t('donor.packWhy'))}</p>`
    + d.bags.map((bag, i) => {
        const items = CATALOG.filter(c => c.cat === bag.cat && !c.blocked);
        const blocked = bag.cat === 'blocked';
        return `<div class="bagcard">
          <div class="bag-top"><b>${esc(t('donor.bagN', { n: i + 1 }))}</b>
            ${d.bags.length > 1 ? `<button class="link-danger" onclick="donorRemoveBag(${i})">${esc(t('common.remove'))}</button>` : ''}
          </div>
          <label class="f-label" for="bagcat${i}">${esc(t('donor.oneCategory'))}
            <span class="f-hint">${esc(t('donor.oneCategoryWhy'))}</span></label>
          <select id="bagcat${i}" onchange="donorSetBagCat(${i}, this.value)">
            ${DONOR_CATEGORIES.map(c => `<option value="${c}"${c === bag.cat ? ' selected' : ''}>${esc(t('cat.' + c))}</option>`).join('')}
          </select>
          ${blocked ? donorSteer() : `
            <p class="f-label">${esc(t('donor.whatsInside'))}</p>
            <div class="chips">${items.map(it => chip(it.name[LANG_INDEX[Store.get().lang]],
                bag.items.includes(it.code), `donorToggleItem(${i},'${it.code}')`)).join('')}</div>`}
        </div>`;
      }).join('')
    + btn('+ ' + t('donor.addBag'), "donorAddBag()", { block: true })
    + `<div class="row-actions">${btn(t('common.back'), "donorGo('home')", { block: true })}
        ${btn(t('donor.findCentre'), "donorGo('centre')", { primary: true, block: true, disabled: donorHasBlockedBag() })}</div>`
    + (donorHasBlockedBag() ? `<p class="ph-warn">${esc(t('donor.blockedBlocks'))}</p>` : '');
}

function donorSteer() {
  const wanted = Sel.needs({ publishedOnly: true }).filter(n => n.pct < 60)
    .slice(0, 3).map(n => Sel.itemName(n.item));
  return `<div class="steer" role="note">
      <b>${esc(t('donor.steerTitle'))}</b>
      <p>${esc(t('donor.steerBody'))}</p>
      <p class="steer-alt">${esc(t('donor.steerInstead'))} <b>${esc(wanted.join(' · '))}</b></p>
    </div>`;
}

function donorCentre() {
  const d = donorDraft();
  const cats = donorPackedCategories();
  const ranked = Sel.suggestCentres(cats);
  if (!d.centre && ranked.length) d.centre = ranked[0].site.id;

  return `<h2 class="ph-h2">${esc(t('donor.whereTitle'))}</h2>`
    + `<p class="ph-note">${esc(cats.length
        ? t('donor.whereMatched', { cats: cats.map(c => t('cat.' + c).toLowerCase()).join(', ') })
        : t('donor.wherePick'))}</p>`
    + ranked.map((r, i) => {
        const covered = r.matched.map(m => Sel.itemName(m)).slice(0, 3);
        return `<button class="centre-opt${d.centre === r.site.id ? ' sel' : ''}" onclick="donorPickCentre('${r.site.id}')"
            aria-pressed="${d.centre === r.site.id}">
            <span class="centre-top"><b>${esc(r.site.name)}</b>
            ${i === 0 && r.score > 0 ? `<span class="match-tag">${esc(t('donor.bestMatch'))}</span>` : ''}</span>
            <span class="centre-meta">${esc(r.site.municipality)} · ${esc(r.site.hours)}</span>
            ${covered.length ? `<span class="centre-meta">${esc(t('donor.needsYours'))}: ${esc(covered.join(', '))}</span>`
              : `<span class="centre-meta centre-nomatch">${esc(t('donor.noOpenNeed'))}</span>`}
          </button>`;
      }).join('')
    + `<div class="row-actions">${btn(t('common.back'), "donorGo('bags')", { block: true })}
        ${btn(t('common.review'), "donorGo('review')", { primary: true, block: true })}</div>`;
}

function donorReview() {
  const d = donorDraft();
  const centre = d.centre ? Sel.site(d.centre) : null;
  return `<h2 class="ph-h2">${esc(t('donor.reviewTitle'))}</h2>`
    + `<div class="review">`
    + (centre ? `<div class="rev-row"><span>${esc(t('donor.centre'))}</span>
        <span><b>${esc(centre.name)}</b> <button class="link" onclick="donorGo('centre')">${esc(t('common.change'))}</button></span></div>` : '')
    + d.bags.map((b, i) => `<div class="rev-row"><span>${esc(t('donor.bagN', { n: i + 1 }))} · <b>${esc(t('cat.' + b.cat))}</b></span>
        <span>${b.items.length ? esc(b.items.map(c => Sel.itemName(c)).join(', ')) : esc(t('donor.listedInApp'))}</span></div>`).join('')
    + (d.bags.length ? `<div class="rev-row rev-edit"><button class="link" onclick="donorGo('bags')">${esc(t('donor.editBags'))}</button></div>` : '')
    + (d.cash ? `<div class="rev-row"><span>${esc(t('donor.cashGift'))} · ${esc(t('cash.' + d.cashKey))}</span>
        <span><b>${esc(money(d.cash))}</b> <button class="link" onclick="donorGo('cash')">${esc(t('common.change'))}</button></span></div>` : '')
    + `</div>`
    + `<div class="row-actions">${btn(t('common.back'), d.bags.length ? "donorGo('centre')" : "donorGo('cash')", { block: true })}
        ${btn(t('donor.confirm'), "donorGenerateCode()", { primary: true, block: true })}</div>`;
}

function donorPass() {
  const d = donorDraft();
  const centre = Sel.site(d.centre);
  const url = 'https://capem.org/p/' + d.code;
  return `<div class="pass">
      <div class="pass-top"><b>CAPEM · ${esc(t('donor.passTitle'))}</b><span>${esc(pick(Sel.event().name))}</span></div>
      <div class="pass-body">
        <p class="pass-hint">${esc(t('donor.showCode'))}</p>
        <p class="pass-code">${esc(d.code)}</p>
        ${QR.svg(url, 132, { label: t('donor.qrLabel', { code: d.code }) })}
        <div class="pass-perf"></div>
        <div class="rev-row"><span>${esc(t('donor.centre'))}</span><span><b>${esc(centre.name)}</b></span></div>
        <div class="rev-row"><span>${esc(t('donor.hours'))}</span><span><b>${esc(centre.hours)}</b></span></div>
        <div class="rev-row"><span>${esc(t('donor.address'))}</span><span>${esc(centre.address)}</span></div>
        ${d.bags.map((b, i) => `<div class="rev-row"><span>${esc(t('donor.bagN', { n: i + 1 }))}</span>
            <span><b>${esc(t('cat.' + b.cat))}</b></span></div>`).join('')}
        ${d.cash ? `<div class="rev-row"><span>${esc(t('donor.cashGift'))}</span><span><b>${esc(money(d.cash))}</b></span></div>` : ''}
      </div></div>
    <p class="ph-note">${esc(t('donor.passOffline'))}</p>
    <div class="row-actions">
      ${btn(t('donor.seeIntake'), "go('intake','intake-scan')", { primary: true, block: true })}
      ${btn(t('donor.restart'), "donorReset()", { block: true })}
    </div>`;
}

function donorNotes() {
  return why(t('donor.whyTitle'), [
    `<b>${esc(t('donor.why1t'))}</b> ${esc(t('donor.why1'))}`,
    `<b>${esc(t('donor.why2t'))}</b> ${esc(t('donor.why2'))}`,
    `<b>${esc(t('donor.why3t'))}</b> ${esc(t('donor.why3'))}`,
    `<b>${esc(t('donor.why4t'))}</b> ${esc(t('donor.why4'))}`
  ]) + card(t('donor.precedentTitle'),
    `<p>${t('donor.precedentBody')}</p>
     <p class="note-link"><a href="#/about/about-questions">${esc(t('donor.precedentLink'))}</a></p>`);
}

/* ---- Public needs board -------------------------------------------------*/
function renderDonorNeeds() {
  const list = Sel.needs({ publishedOnly: true });
  const bySite = {};
  list.forEach(n => { (bySite[n.site] = bySite[n.site] || []).push(n); });

  return screenHead(t('crumb.donorPublic'), t('needs.publicTitle'), t('needs.publicLede'))
    + Object.keys(bySite).map(siteId => {
        const s = Sel.site(siteId);
        return card(s.name + ' · ' + s.municipality,
          bySite[siteId].map(n => `<div class="need-line">
            <div class="need-line-top"><b>${esc(Sel.itemName(n.item))}</b>${priorityPill(n.priority)}</div>
            ${bar(n.pct, n.status, Sel.itemName(n.item))}
            <p class="need-num">${num(n.have)} / ${num(n.target)} ${esc(Sel.itemUnit(n.item))}
              ${n.incoming ? `· <span class="incoming">${esc(t('needs.incoming', { n: num(n.incoming) }))}</span>` : ''}</p>
          </div>`).join(''));
      }).join('')
    + card(t('needs.notNeededTitle'),
        `<p>${esc(t('needs.notNeededBody'))}</p><div class="chips">`
        + CATALOG.filter(c => c.blocked).map(c => chip(c.name[LANG_INDEX[Store.get().lang]], false)).join('')
        + `</div>`, { cls: 'card-warn' });
}

/* ---- Impact feed --------------------------------------------------------*/
function renderDonorImpact() {
  const s = Store.get();
  const events = s.impact.slice(0, 12);
  return screenHead(t('crumb.donorPublic'), t('impact.title'), t('impact.lede'))
    + `<div class="two-col"><div class="phone">
        <div class="phone-head"><div class="ph-brand">${BRAND_MARK_SM} CAPEM</div>
        <p class="ph-event">${esc(t('impact.yourHelp'))}</p></div>
        <div class="phone-body">`
    + (events.length ? events.map(e => impactRow(e)).join('')
        : `<p class="empty">${esc(t('impact.empty'))}</p>
           <div class="row-actions">${btn(t('impact.goDonate'), "go('donor','donor-give')", { primary: true, block: true })}</div>`)
    + `</div></div><div class="col-notes">`
    + why(t('impact.whyTitle'), [
        `<b>${esc(t('impact.why1t'))}</b> ${esc(t('impact.why1'))}`,
        `<b>${esc(t('impact.why2t'))}</b> ${esc(t('impact.why2'))}`,
        `<b>${esc(t('impact.why3t'))}</b> ${esc(t('impact.why3'))}`
      ])
    + `</div></div>`;
}

function impactRow(e) {
  const site = Sel.site(e.site);
  if (e.kind === 'pledged') {
    return `<div class="impact"><span class="impact-ico">${ICON_BAG}</span>
      <div><b>${esc(t('impact.pledged', { code: e.ref }))}</b>
      <span>${esc(site ? site.name : '')} · ${esc(e.at)}</span></div></div>`;
  }
  if (e.kind === 'received') {
    return `<div class="impact"><span class="impact-ico">${ICON_IN}</span>
      <div><b>${esc(t('impact.received', { code: e.ref }))}</b>
      <span>${esc(site ? site.name : '')} · ${esc(e.at)}</span></div></div>`;
  }
  const lines = (e.lines || []).map(l => `${num(l.qty)} × ${Sel.itemName(l.item)}`).join(', ');
  return `<div class="impact"><span class="impact-ico">${ICON_CHECK}</span>
    <div><b>${esc(t('impact.distributed'))}</b>
    <span>${esc(lines)} · ${esc(site ? site.name : '')} · ${esc(e.at)}</span></div></div>`;
}
