/* ============================================================================
 * COORDINATOR SCREENS
 *
 * Including the matching engine, which is the part of this problem the
 * research calls hard and the previous prototype did not show at all.
 * ==========================================================================*/

/* ---- Command view -------------------------------------------------------*/
function renderCoordDash() {
  const s = Store.get();
  const site = Sel.site(s.siteId);
  const sh = Sel.shelterFor(s.siteId);
  const alerts = Sel.alerts(s.siteId).slice(0, 5);
  const cov = Sel.coverage(s.siteId);
  const open = Sel.needs({ site: s.siteId, publishedOnly: true }).filter(n => n.pct < 95);
  const crit = open.filter(n => n.priority === 'critical').length;

  return screenHead(
      t('crumb.coord', { site: site.name })
        + (site.independent ? ' · ' + t('coord.independentNode', { since: site.liveSince }) : ''),
      t('coord.title'), t('coord.lede'))
    + grid('g4', [
        tile(t('coord.households'), num(Sel.families(s.siteId).length),
             t('coord.peopleN', { n: num(Sel.peopleCount(s.siteId)) })),
        tile(t('coord.openNeeds'), num(open.length), t('coord.criticalN', { n: crit })),
        tile(t('coord.coverage'), pct(cov), t('coord.coverageSub'),
             { accent: cov < 50 }),
        sh ? tile(t('coord.shelter'), pct(Math.round(sh.occupied / sh.spots * 100)),
             t('coord.spotsLeft', { n: num(sh.spots - sh.occupied) }))
           : tile(t('coord.volunteers'), num(Sel.volunteers().length), t('coord.onRoster'))
      ])
    + `<div class="two-col-wide">`
    + card(t('coord.flowTitle'), [
        ['coord.flowDonations', Sel.stats().donorsToday, 100],
        ['coord.flowVouchers', s.vouchers.filter(v => v.status === 'fulfilled').length || Sel.stats().vouchersToday, 200],
        ['coord.flowRegistered', Sel.stats().registeredToday, 60],
        ['coord.flowRedirected', Sel.stats().redirected, 30]
      ].map(([key, val, max]) => `<div class="cov-row">
          <span class="cov-lab">${esc(t(key))}</span>
          ${bar(Math.min(100, val / max * 100), 'good', t(key))}
          <span class="cov-n">${num(val)}</span></div>`).join('')
      + `<p class="card-note">${esc(t('coord.flowNote'))}</p>`)
    + card(t('coord.attentionTitle'),
        alerts.length ? alerts.map(a => alertRow(a)).join('')
          : `<p class="empty">${esc(t('coord.noAlerts'))}</p>`)
    + `</div>`;
}

function alertRow(a) {
  const site = Sel.site(a.site);
  let title = '', body = '';
  if (a.kind === 'belowMin') {
    title = t('alert.belowMin', { item: Sel.itemName(a.item), have: num(a.onHand), min: num(a.min) });
    body = a.incoming ? t('alert.incoming', { n: num(a.incoming) }) : t('alert.noIncoming');
  } else if (a.kind === 'expiring') {
    title = t('alert.expiring', { n: num(a.qty), item: Sel.itemName(a.item) });
    body = t('alert.fefo');
  } else if (a.kind === 'surplus') {
    title = t('alert.surplus', { item: Sel.itemName(a.item), pct: pct(a.pct) });
    body = t('alert.surplusBody');
  } else if (a.kind === 'capacity') {
    title = t('alert.capacity', { pct: pct(a.pct) });
    body = t('alert.capacityBody');
  }
  return `<div class="alert alert-${a.level}">
      <span class="alert-ico">${STATUS_ICON[a.level] || ''}</span>
      <div><b>${esc(title)}</b><span>${esc(body)} · ${esc(site ? site.name : '')}</span></div></div>`;
}

/* ---- THE MATCHING ENGINE ------------------------------------------------*/
function renderCoordMatch() {
  const s = Store.get();
  const site = Sel.site(s.siteId);
  const result = Match.plan(s.siteId);
  const shown = result.allocations.slice(0, s.matchShowAll ? 200 : 6);
  const openVouchers = s.vouchers.filter(v => v.site === s.siteId).length;

  return screenHead(t('crumb.coordMatch', { site: site.name }), t('match.title'), t('match.lede'))
    + grid('g4', [
        tile(t('match.considered'), num(result.considered), t('match.householdsWaiting')),
        tile(t('match.canServe'), num(result.allocations.length), t('match.fromStockNow')),
        tile(t('match.shortItems'), num(result.unmet.length), t('match.becomesNeed')),
        tile(t('match.issued'), num(openVouchers), t('match.thisSession'))
      ])
    + `<div class="two-col-wide">`
    + card(t('match.planTitle'),
        (result.allocations.length === 0
          ? `<p class="empty">${esc(t('match.allServed'))}</p>`
          : shown.map(a => allocationCard(a)).join('')
            + (result.allocations.length > shown.length
              ? `<div class="row-actions">${btn(t('match.showAll', { n: result.allocations.length }), "Store.update(s=>{s.matchShowAll=true})", { block: true })}</div>`
              : ''))
        + (result.allocations.length ? `<div class="row-actions sticky-actions">
            ${btn(t('match.issueAll', { n: result.allocations.length }), "matchIssueAll(this)", { primary: true, block: true })}
          </div>` : ''))
    + `<div>`
    + card(t('match.unmetTitle'),
        result.unmet.length
          ? result.unmet.map(u => `<div class="unmet-row">
              <div><b>${esc(Sel.itemName(u.item))}</b>
                <span>${esc(t('match.shortBy', { n: num(u.qty) }))}</span></div>
              ${btn(t('match.publish'), `matchPublishNeed('${u.item}', this)`, { small: true })}
            </div>`).join('') + `<p class="card-note">${esc(t('match.unmetNote'))}</p>`
          : `<p class="empty">${esc(t('match.nothingShort'))}</p>`,
        { cls: 'card-warn' })
    + card(t('match.howTitle'), `
        <p>${esc(t('match.howBody'))}</p>
        <ol class="how-list">
          <li><b>${esc(t('match.step1t'))}</b> ${esc(t('match.step1'))}</li>
          <li><b>${esc(t('match.step2t'))}</b> ${esc(t('match.step2'))}</li>
          <li><b>${esc(t('match.step3t'))}</b> ${esc(t('match.step3'))}</li>
          <li><b>${esc(t('match.step4t'))}</b> ${esc(t('match.step4'))}</li>
        </ol>
        <p class="card-note">${esc(t('match.notOptimiser'))}</p>
        <p class="note-link"><a href="#/about/about-questions">${esc(t('match.openQuestions'))}</a></p>`)
    + card(t('match.rulesTitle'),
        `<div class="table-wrap"><table><thead><tr>
            <th scope="col">${esc(t('match.rule'))}</th><th scope="col" class="num">${esc(t('match.cap'))}</th></tr></thead><tbody>`
        + ENTITLEMENTS.map(r => `<tr><td>${esc(pick(r.rule))}</td>
            <td class="num">${num(r.cap)}</td></tr>`).join('')
        + `</tbody></table></div>
           <p class="card-note">${esc(t('match.rulesNote'))}</p>`)
    + `</div></div>`;
}

function allocationCard(a) {
  const openId = 'why-' + a.family.ref;
  return `<article class="alloc">
      <div class="alloc-top">
        <div><span class="alloc-rank">#${a.rank}</span>
          <b>${esc(a.family.ref)}</b>
          <span class="alloc-meta">${esc(t('match.householdOf', { n: a.family.size }))}${
            a.family.under5 ? ' · ' + esc(t('match.under5N', { n: a.family.under5 })) : ''}${
            a.family.medical ? ' · ' + esc(t('match.medicalFlag')) : ''}</span></div>
        <div class="alloc-score"><b>${num(a.score)}</b><span>${esc(t('match.score'))}</span></div>
      </div>
      <ul class="alloc-lines">
        ${a.lines.map(l => `<li><span class="alloc-qty">${num(l.qty)} ×</span>
          <span class="alloc-item">${esc(Sel.itemName(l.item))}</span>
          <span class="alloc-rule">${esc(pick(ENTITLEMENTS[l.ruleIndex].rule))}${
            l.short ? ' · ' + esc(t('match.shortNote', { n: l.short })) : ''}</span></li>`).join('')}
      </ul>
      <details class="alloc-why">
        <summary>${esc(t('match.whyThisOrder'))}</summary>
        <ul class="factor-list">
          ${a.factors.map(f => `<li><span>${esc(t('factor.' + f.key, { n: f.detail }))}</span>
            <b>+${num(f.points)}</b></li>`).join('')}
          <li class="factor-total"><span>${esc(t('match.total'))}</span><b>${num(a.score)}</b></li>
        </ul>
        <p class="factor-note">${esc(t('match.aheadOf', { n: a.aheadOf }))}</p>
      </details>
    </article>`;
}

function matchIssueAll(el) {
  const result = Match.plan(Store.get().siteId);
  const issued = Match.issueAll(result);
  flash(el, t('match.issuedN', { n: issued.length }));
  announce(t('match.issuedAnnounce', { n: issued.length }));
}

function matchPublishNeed(itemCode, el) {
  const s = Store.get();
  Store.update(st => {
    const existing = st.data.needs.find(n => n.site === st.siteId && n.item === itemCode);
    if (existing) { existing.published = true; existing.priority = 'critical'; }
    else st.data.needs.push({ site: st.siteId, item: itemCode, target: 100,
      priority: 'critical', published: true, channels: ['items', 'money'] });
  });
  flash(el, t('match.published'));
}

/* ---- Needs board (curation) --------------------------------------------*/
function renderCoordNeeds() {
  const s = Store.get();
  const site = Sel.site(s.siteId);
  const list = Sel.needs({ site: s.siteId });

  const rows = list.map(n => `
    <td><b>${esc(Sel.itemName(n.item))}</b><div class="sub">${esc(n.item)}</div></td>
    <td class="col-bar">${bar(n.pct, n.status, Sel.itemName(n.item))}
      <span class="bar-num">${num(n.have)}/${num(n.target)}</span></td>
    <td>${priorityPill(n.priority)}</td>
    <td class="num">${n.incoming ? '+' + num(n.incoming) : '—'}</td>
    <td>${toggleSwitch(n.published, `Store.setNeedPublished('${n.site}','${n.item}',${!n.published})`,
        t('needs.publishedLabel', { item: Sel.itemName(n.item) }))}</td>
    <td class="col-actions">
      ${n.priority !== 'critical' ? btn(t('needs.raise'), `Store.setNeedPriority('${n.site}','${n.item}','critical')`, { small: true }) : ''}
      ${n.pct >= 95 && n.published ? btn(t('needs.pause'), `Store.setNeedPublished('${n.site}','${n.item}',false)`, { small: true }) : ''}
    </td>`);

  return screenHead(t('crumb.coordNeeds', { site: site.name }), t('needs.curateTitle'), t('needs.curateLede'))
    + card(null, table([
        t('needs.colNeed'), t('needs.colProgress'), t('needs.colPriority'),
        { label: t('needs.colIncoming'), num: true }, t('needs.colPublished'), t('needs.colActions')
      ], rows, { caption: t('needs.tableCaption', { site: site.name }) }))
    + `<div class="two-col-wide">`
    + why(t('needs.whyTitle'), [
        `<b>${esc(t('needs.why1t'))}</b> ${esc(t('needs.why1'))}`,
        `<b>${esc(t('needs.why2t'))}</b> ${esc(t('needs.why2'))}`,
        `<b>${esc(t('needs.why3t'))}</b> ${esc(t('needs.why3'))}`
      ])
    + card(t('needs.seeEffect'), `<p>${esc(t('needs.seeEffectBody'))}</p>
        <div class="row-actions">${btn(t('needs.openPublic'), "go('donor','donor-needs')", { small: true })}
        ${btn(t('needs.openBroadcast'), "go('coord','coord-whatsapp')", { small: true })}</div>`)
    + `</div>`;
}

/* ---- People and shelter -------------------------------------------------*/
function renderCoordPeople() {
  const s = Store.get();
  const site = Sel.site(s.siteId);
  const fams = Sel.families(s.siteId);
  const sh = Sel.shelterFor(s.siteId);
  const named = fams.filter(f => !f.generated).slice(0, 8);

  return screenHead(t('crumb.coordPeople', { site: site.name }), t('cpeople.title'), t('cpeople.lede'))
    + grid('g4', [
        tile(t('cpeople.households'), num(fams.length), t('cpeople.peopleN', { n: num(Sel.peopleCount(s.siteId)) })),
        sh ? tile(t('cpeople.capacity'), pct(Math.round(sh.occupied / sh.spots * 100)),
             t('cpeople.ofSpots', { n: num(sh.spots) })) : tile(t('cpeople.capacity'), '—', ''),
        tile(t('cpeople.under5'), num(Sel.under5Count(s.siteId)), t('cpeople.drivesTargets')),
        tile(t('cpeople.medical'), num(fams.filter(f => f.medical).length), t('cpeople.flagged'))
      ])
    + `<div class="two-col-wide">`
    + card(t('cpeople.caseloadTitle'), table(
        [t('cpeople.colRef'), t('cpeople.colHousehold'), t('cpeople.colWaiting'), t('cpeople.colStatus')],
        named.map(f => {
          const v = s.vouchers.find(x => x.family === f.ref);
          return `<td><b>${esc(f.ref)}</b></td>
            <td>${esc(t('cpeople.sizeN', { n: f.size }))}${f.under5 ? ' · ' + esc(t('cpeople.u5', { n: f.under5 })) : ''}${f.medical ? ' · ' + esc(t('cpeople.med')) : ''}</td>
            <td class="num">${num(f.daysWaiting)}</td>
            <td>${v ? (v.status === 'fulfilled' ? pill('good', t('cpeople.served')) : pill('warning', t('cpeople.voucherIssued')))
                    : pill('neutral', t('cpeople.awaiting'))}</td>`;
        }), { caption: t('cpeople.tableCaption') })
      + `<p class="card-note">${esc(t('cpeople.namedOnly', { n: fams.length }))}</p>`)
    + card(t('cpeople.scopeTitle'), `
        <p>${esc(t('cpeople.scopeBody'))}</p>
        <ul class="why-list">
          <li><b>${esc(t('cpeople.s1t'))}</b> ${esc(t('cpeople.s1'))}</li>
          <li><b>${esc(t('cpeople.s2t'))}</b> ${esc(t('cpeople.s2'))}</li>
          <li><b>${esc(t('cpeople.s3t'))}</b> ${esc(t('cpeople.s3'))}</li>
        </ul>
        <p class="note-link"><a href="#/about/about-data">${esc(t('cpeople.readPolicy'))}</a></p>`, { cls: 'card-warn' })
    + `</div>`;
}

/* ---- WhatsApp broadcast -------------------------------------------------*/
function renderCoordWhatsapp() {
  const s = Store.get();
  const site = Sel.site(s.siteId);
  const msg = buildBroadcast(site);

  return screenHead(t('crumb.coordComms', { site: site.name }), t('wa.title'), t('wa.lede'))
    + `<div class="two-col">`
    + `<div class="wa-frame">
        <div class="wa-head"><span class="wa-av">${esc(site.name.slice(0, 2).toUpperCase())}</span>
          <div><b>${esc(pick(Store.get().data.whatsappGroup))}</b><span>${esc(t('wa.participants', { n: 212 }))}</span></div></div>
        <div class="wa-body">
          <div class="wa-msg"><span class="wa-sender">CAPEM · ${esc(site.name)}</span>${esc(msg)}
            <span class="wa-time">${esc(Store.nowClock())} ✓✓</span></div>
        </div></div>`
    + `<div class="col-notes">`
    + why(t('wa.whyTitle'), [
        `<b>${esc(t('wa.why1t'))}</b> ${esc(t('wa.why1'))}`,
        `<b>${esc(t('wa.why2t'))}</b> ${esc(t('wa.why2'))}`,
        `<b>${esc(t('wa.why3t'))}</b> ${esc(t('wa.why3'))}`
      ])
    + card(null, `
        ${btn(t('wa.send'), "flash(this, t('wa.sent'))", { primary: true, block: true })}
        ${btn(t('wa.copy'), "copyBroadcast(this)", { block: true })}
        <p class="card-note">${esc(t('wa.fallback'))}</p>`)
    + `</div></div>`;
}

/** The message is rendered from the live needs board, never typed by hand. */
function buildBroadcast(site) {
  const lang = Store.get().lang;
  const needs = Sel.needs({ site: site.id, publishedOnly: true });
  const urgent = needs.filter(n => n.priority === 'critical' && n.pct < 95);
  const also = needs.filter(n => n.priority !== 'critical' && n.pct < 95);
  const covered = needs.filter(n => n.pct >= 95);
  const blocked = CATALOG.filter(c => c.blocked).map(c => c.name[LANG_INDEX[lang]]);

  const L = [];
  L.push(t('wa.header', { site: site.municipality }).toUpperCase());
  L.push('');
  if (urgent.length) {
    L.push('*' + t('wa.urgent') + '*');
    urgent.forEach(n => L.push('• ' + Sel.itemName(n.item) + ' — '
      + t('wa.short', { n: num(Math.max(0, n.target - n.have)) })));
    L.push('');
  }
  if (also.length) {
    L.push('*' + t('wa.alsoAccepting') + '*');
    L.push('• ' + also.slice(0, 4).map(n => Sel.itemName(n.item)).join(' · '));
    L.push('');
  }
  // The most valuable line in the message.
  L.push('*' + t('wa.noLonger') + '* ' + blocked.concat(covered.map(n => Sel.itemName(n.item))).join(', '));
  L.push('');
  L.push(t('wa.preRegister') + ': capem.org/c/' + site.slug);
  L.push(t('wa.cash') + ': ' + Store.get().data.cashRails[0]);
  L.push('');
  L.push(site.hours + ' · ' + site.address);
  return L.join('\n');
}

function copyBroadcast(el) {
  const site = Sel.site(Store.get().siteId);
  const text = buildBroadcast(site);
  if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  flash(el, t('wa.copied'));
}

/* ---- Offline and sync ---------------------------------------------------*/
function renderOffline() {
  const s = Store.get();
  return screenHead(t('crumb.coordOps'), t('offline.title'), t('offline.lede'))
    + grid('g3', [
        tile(t('offline.status'), s.online ? t('common.online') : t('common.offline'),
             s.online ? t('offline.writingThrough') : t('offline.writingLocal'),
             { small: true, accent: !s.online }),
        tile(t('offline.queued'), num(s.queue.length), t('offline.awaitingSync')),
        tile(t('offline.thisSession'), num(s.log.length), t('offline.actionsLogged'))
      ])
    + `<div class="two-col-wide">`
    + card(t('offline.tryTitle'), `
        <p>${esc(t('offline.tryBody'))}</p>
        <div class="offline-switch">
          <span>${esc(t('offline.connection'))}</span>
          ${toggleSwitch(s.online, `Store.setOnline(${!s.online})`, t('offline.connection'))}
          <b>${esc(s.online ? t('common.online') : t('common.offline'))}</b>
        </div>
        <ol class="how-list">
          <li>${esc(t('offline.step1'))}</li>
          <li>${esc(t('offline.step2'))}</li>
          <li>${esc(t('offline.step3'))}</li>
        </ol>
        <div class="row-actions">
          ${btn(t('offline.goIntake'), "go('intake','intake-scan')", { small: true })}
          ${btn(t('offline.syncNow'), "offlineSync(this)", { primary: true, small: true, disabled: !s.queue.length || !s.online })}
        </div>
        ${!s.online && s.queue.length ? `<p class="ph-warn">${esc(t('offline.reconnectFirst'))}</p>` : ''}`)
    + card(t('offline.logTitle'),
        s.log.length ? `<ul class="synclog">` + s.log.slice(0, 14).map(e =>
            `<li><span class="log-time">${esc(e.at)}</span>
              <span class="log-label">${esc(e.label)}</span>
              ${e.status === 'queued' ? pill('warning', t('offline.queuedTag')) : pill('good', t('offline.syncedTag'))}</li>`).join('')
          + `</ul>` : `<p class="empty">${esc(t('offline.logEmpty'))}</p>`)
    + `</div>`
    + why(t('offline.whyTitle'), [
        `<b>${esc(t('offline.why1t'))}</b> ${esc(t('offline.why1'))}`,
        `<b>${esc(t('offline.why2t'))}</b> ${esc(t('offline.why2'))}`,
        `<b>${esc(t('offline.why3t'))}</b> ${esc(t('offline.why3'))}`
      ]);
}

function offlineSync(el) {
  const n = Store.sync();
  flash(el, t('offline.synced', { n: n }));
}
