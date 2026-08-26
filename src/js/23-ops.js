/* ============================================================================
 * INVENTORY, VOLUNTEERS, AND THE MULTI-CENTRE NETWORK
 * ==========================================================================*/

/* ---- Stock by site ------------------------------------------------------*/
function renderInvStock() {
  const s = Store.get();
  const siteId = s.invSite || s.siteId;
  const rows = s.data.stock.filter(r => r.site === siteId);

  return screenHead(t('crumb.inventory'), t('inv.title'), t('inv.lede'))
    + `<div class="toolbar">`
    + seg(Sel.sites().map(x => ({ id: x.id, label: x.name })), siteId, "invSetSite('{id}')")
    + `</div>`
    + card(null, table([
        t('inv.colItem'), { label: t('inv.colOnHand'), num: true }, { label: t('inv.colMin'), num: true },
        { label: t('inv.colReserved'), num: true }, { label: t('inv.colIncoming'), num: true },
        t('inv.colLevel'), t('inv.colStatus')
      ], rows.map(r => {
        const need = s.data.needs.find(n => n.site === r.site && n.item === r.item);
        const target = need ? need.target : r.min * 2 || 1;
        const p = Math.min(100, Math.round(r.onHand / target * 100));
        const below = r.onHand < r.min;
        const it = Sel.item(r.item);
        return `<td><b>${esc(Sel.itemName(r.item))}</b>
            <div class="sub">${esc(r.item)} · ${esc(Sel.itemUnit(r.item))}${r.expiring ? ' · ' + esc(t('inv.expiringN', { n: r.expiring })) : ''}</div></td>
          <td class="num">${num(r.onHand)}</td>
          <td class="num">${num(r.min)}</td>
          <td class="num">${num(r.reserved || 0)}</td>
          <td class="num">${r.incoming ? '+' + num(r.incoming) : '—'}</td>
          <td class="col-bar">${bar(p, levelFor(p), Sel.itemName(r.item))}</td>
          <td>${below ? pill('critical', t('inv.belowMin'))
               : p >= 95 ? pill('good', t('inv.surplus')) : pill('good', t('inv.ok'))}</td>`;
      }), { caption: t('inv.tableCaption', { site: Sel.site(siteId).name }) }))
    + card(t('inv.reservedTitle'), `<p>${esc(t('inv.reservedBody'))}</p>`, { cls: 'card-note-only' });
}

function invSetSite(id) { Store.update(s => { s.invSite = id; }); }

/* ---- Movement log -------------------------------------------------------*/
function renderInvLog() {
  const s = Store.get();
  const filter = s.logFilter || 'all';
  const list = s.data.movements.filter(m => filter === 'all' || m.type === filter).slice(0, 25);
  const TYPE_PILL = { in: 'good', out: 'neutral', xfer: 'neutral', redirect: 'serious' };

  return screenHead(t('crumb.inventory'), t('log.title'), t('log.lede'))
    + `<div class="toolbar">` + seg([
        { id: 'all', label: t('log.all') }, { id: 'in', label: t('log.in') },
        { id: 'out', label: t('log.out') }, { id: 'xfer', label: t('log.xfer') },
        { id: 'redirect', label: t('log.redirect') }
      ], filter, "Store.update(s=>{s.logFilter='{id}'})") + `</div>`
    + card(null, table([
        t('log.colTime'), t('log.colType'), t('log.colItem'), { label: t('log.colQty'), num: true },
        t('log.colSite'), t('log.colRef'), t('log.colBy')
      ], list.map(m => `
        <td>${esc(m.time)}</td>
        <td>${pill(TYPE_PILL[m.type] || 'neutral', t('log.type.' + m.type))}</td>
        <td>${esc(Sel.itemName(m.item))}</td>
        <td class="num">${m.qty ? (m.qty > 0 ? '+' : '') + num(m.qty) : '—'}</td>
        <td>${esc(Sel.site(m.site) ? Sel.site(m.site).name : m.site)}</td>
        <td class="sub">${esc(m.ref)}</td>
        <td class="sub">${esc(m.by)}</td>`), { caption: t('log.tableCaption') }))
    + card(t('log.whyTitle'), `<p>${esc(t('log.whyBody'))}</p>`, { cls: 'card-note-only' });
}

/* ---- Alerts -------------------------------------------------------------*/
function renderInvAlerts() {
  const all = Sel.alerts(null);
  return screenHead(t('crumb.inventory'), t('alerts.title'), t('alerts.lede'))
    + (all.length ? all.map(a => alertRow(a)).join('') : `<p class="empty">${esc(t('alerts.none'))}</p>`)
    + card(t('alerts.rulesTitle'), `
        <ul class="why-list">
          <li><b>${esc(t('alerts.r1t'))}</b> ${esc(t('alerts.r1'))}</li>
          <li><b>${esc(t('alerts.r2t'))}</b> ${esc(t('alerts.r2'))}</li>
          <li><b>${esc(t('alerts.r3t'))}</b> ${esc(t('alerts.r3'))}</li>
          <li><b>${esc(t('alerts.r4t'))}</b> ${esc(t('alerts.r4'))}</li>
        </ul>`);
}

/* ---- Volunteers ---------------------------------------------------------*/
function renderVmRoster() {
  const s = Store.get();
  const vols = Sel.volunteers();
  const gaps = Sel.shifts().flatMap(sh => sh.slots
    .filter(sl => sl.filled < sl.need)
    .map(sl => ({ shift: sh, slot: sl })));

  return screenHead(t('crumb.ops'), t('vm.title'), t('vm.lede'))
    + grid('g4', [
        tile(t('vm.active'), num(vols.length), t('vm.onRoster')),
        tile(t('vm.verified'), num(vols.filter(v => v.verified).length), t('vm.credentialChecked')),
        tile(t('vm.trained'), num(vols.filter(v => v.trained.length).length), t('vm.viaAcademy')),
        tile(t('vm.gaps'), num(gaps.reduce((a, g) => a + (g.slot.need - g.slot.filled), 0)), t('vm.next48'))
      ])
    + `<div class="two-col-wide">`
    + card(t('vm.rosterTitle'), table(
        [t('vm.colName'), t('vm.colSkills'), t('vm.colStatus'), { label: t('vm.colShifts'), num: true }],
        vols.map(v => `
          <td><b>${esc(v.name)}</b><div class="sub">${esc(v.base)}</div></td>
          <td>${v.skills.map(sk => chip(t('skill.' + sk), v.verified && sk !== 'general')).join('')}
              ${v.trained.map(tr => chip(t('vm.trainedIn', { role: t('role.' + tr) }), true)).join('')}</td>
          <td>${v.pending ? pill('warning', t('vm.pendingDocs'))
               : v.noShows ? pill('serious', t('vm.noShows', { n: v.noShows }))
               : v.verified ? pill('good', t('vm.verifiedTag')) : pill('neutral', t('vm.activeTag'))}</td>
          <td class="num">${num(v.shifts)}</td>`), { caption: t('vm.tableCaption') }))
    + card(t('vm.coverageTitle'),
        Sel.shifts().map(sh => {
          const site = Sel.site(sh.site);
          return `<div class="shift">
            <div class="shift-top"><b>${esc(t('template.' + sh.template))} · ${esc(site.name)}</b>
              <span class="sub">${esc(sh.start)}–${esc(sh.end)}</span></div>
            ${sh.slots.map(sl => {
              const p = Math.round(sl.filled / sl.need * 100);
              return `<div class="cov-row"><span class="cov-lab">${esc(t('skill.' + sl.skill))}</span>
                ${bar(p, levelFor(p), t('skill.' + sl.skill))}
                <span class="cov-n">${sl.filled}/${sl.need}</span></div>`;
            }).join('')}
          </div>`;
        }).join('')
        + `<p class="card-note">${esc(t('vm.gapsNote'))}</p>`)
    + `</div>`;
}

/* ---- Network and command ------------------------------------------------*/
function renderNetwork() {
  const s = Store.get();
  const sites = Sel.sites();

  // Transfer suggestions: a site below minimum, another with genuine surplus.
  const suggestions = [];
  s.data.stock.forEach(short => {
    if (short.onHand >= short.min) return;
    const gap = short.min - short.onHand;
    s.data.stock.forEach(rich => {
      if (rich.item !== short.item || rich.site === short.site) return;
      const spare = rich.onHand - rich.min * 1.5;
      if (spare > 0) {
        suggestions.push({ item: short.item, from: rich.site, to: short.site,
                           qty: Math.min(gap, Math.floor(spare)) });
      }
    });
  });
  const top = suggestions.filter(x => x.qty > 0)
    .sort((a, b) => b.qty - a.qty).slice(0, 5);

  return screenHead(t('crumb.network'), t('net.title'), t('net.lede'))
    + grid('g4', [
        tile(t('net.centres'), num(sites.length), t('net.inThisEvent')),
        tile(t('net.independent'), num(sites.filter(x => x.independent).length), t('net.notAgency')),
        tile(t('net.people'), num(sites.reduce((a, x) => a + (x.shelter ? x.shelter.occupied : 0), 0)), t('net.sheltered')),
        tile(t('net.coverage'), pct(Sel.coverage(null)), t('net.eventWide'))
      ])
    + card(t('net.boardTitle'), table(
        [t('net.colCentre'), t('net.colType'), t('net.colShelter'), t('net.colCoverage'),
         t('net.colConnectivity'), t('net.colBelowMin')],
        sites.map(x => {
          const cov = Sel.coverage(x.id);
          const below = s.data.stock.filter(r => r.site === x.id && r.onHand < r.min).length;
          return `<td><b>${esc(x.name)}</b><div class="sub">${esc(x.municipality)}${x.independent ? ' · ' + esc(t('net.independentTag')) : ''}</div></td>
            <td>${esc(t('siteKind.' + x.kind))}</td>
            <td class="num">${x.shelter ? num(x.shelter.occupied) + ' / ' + num(x.shelter.spots) : '—'}</td>
            <td class="col-bar">${bar(cov, levelFor(cov), x.name)}<span class="bar-num">${pct(cov)}</span></td>
            <td>${x.connectivity === 'online' ? pill('good', t('net.online'))
                 : x.connectivity === 'intermittent' ? pill('warning', t('net.intermittent'))
                 : pill('critical', t('net.offlineSite'))}</td>
            <td class="num">${below ? pill('critical', num(below)) : pill('good', '0')}</td>`;
        }), { caption: t('net.tableCaption') }))
    + `<div class="two-col-wide">`
    + card(t('net.transferTitle'),
        top.length ? top.map(x => `<div class="unmet-row">
            <div><b>${esc(Sel.itemName(x.item))} × ${num(x.qty)}</b>
              <span>${esc(Sel.site(x.from).name)} → ${esc(Sel.site(x.to).name)}</span></div>
            ${btn(t('net.draft'), "flash(this, t('net.drafted'))", { small: true })}
          </div>`).join('') + `<p class="card-note">${esc(t('net.transferNote'))}</p>`
          : `<p class="empty">${esc(t('net.noTransfers'))}</p>`)
    + card(t('net.limitsTitle'), `
        <p>${esc(t('net.limitsBody'))}</p>
        <ul class="why-list">
          <li><b>${esc(t('net.l1t'))}</b> ${esc(t('net.l1'))}</li>
          <li><b>${esc(t('net.l2t'))}</b> ${esc(t('net.l2'))}</li>
          <li><b>${esc(t('net.l3t'))}</b> ${esc(t('net.l3'))}</li>
        </ul>`, { cls: 'card-warn' })
    + `</div>`;
}
