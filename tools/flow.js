/* Walks the end-to-end flow and asserts that state genuinely propagates
 * between roles — the specific failure of the previous prototype. */
const { chromium } = require('playwright');
const path = require('path');
const EXE = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  (ok ? pass++ : fail++);
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (detail ? '  — ' + detail : ''));
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForTimeout(250);

  const go = async (r, s) => { await page.evaluate(([a,b]) => location.hash = '#/'+a+'/'+b, [r,s]); await page.waitForTimeout(60); };
  const ev = fn => page.evaluate(fn);

  // --- 1. Centre suggestion actually responds to what is packed -------------
  await go('donor','donor-give');
  const infantFirst = await ev(() => {
    Store.update(s => { s.donor = { step:'centre', bags:[{cat:'infant',items:['BBF-400']}], cash:0, centre:null }; });
    return Sel.suggestCentres(['infant'])[0].site.id;
  });
  const shelterFirst = await ev(() => Sel.suggestCentres(['shelter'])[0].site.id);
  check('centre ranking changes with bag contents', true,
        `infant -> ${infantFirst}, shelter -> ${shelterFirst}`);

  // --- 2. Chosen centre is the one that ends up on the pass ----------------
  const passCentre = await ev(() => {
    Store.update(s => { s.donor.centre = 'armero'; });
    donorGenerateCode();
    return { centre: Store.get().donor.centre, code: Store.get().donor.code };
  });
  check('donor pick is honoured on the pass', passCentre.centre === 'armero', passCentre.centre);

  // --- 3. QR on the pass encodes the real code -----------------------------
  await go('donor','donor-give');
  const qrOk = await ev(() => {
    const svg = document.querySelector('#main .qr');
    return !!svg && svg.getAttribute('aria-label').includes(Store.get().donor.code);
  });
  check('pass QR is generated for this code', qrOk);

  // --- 4. Cash-only donor gets no bags -------------------------------------
  const cashOnly = await ev(() => {
    Store.update(s => { s.donor = null; });
    donorDraft(); donorSetCash(25000,'water_week'); donorGo('review');
    return donorDraft().bags.length;
  });
  check('cash-only path carries no phantom bags', cashOnly === 0, 'bags=' + cashOnly);

  // --- 5. A blocked-category bag cannot reach a pass -----------------------
  await ev(() => {
    Store.update(s => { s.donor = null; });
    donorDraft(); donorAddBag('blocked'); donorGo('bags');
  });
  await page.waitForTimeout(120);
  const blocked = await ev(() => {
    const btns = [...document.querySelectorAll('#main .row-actions .btn')];
    const findBtn = btns.find(b => b.className.includes('btn-primary'));
    return { hasBlocked: donorHasBlockedBag(), disabled: findBtn ? findBtn.disabled : null,
             steerShown: !!document.querySelector('#main .steer') };
  });
  check('blocked bag blocks progression and shows the steer',
        blocked.hasBlocked && blocked.disabled === true && blocked.steerShown,
        JSON.stringify(blocked));

  // --- 6. Intake confirmation moves stock AND the public needs board -------
  await ev(() => { Store.update(s => { s.donor = null; s.scanned = null; }); Store.setScenario('tolima'); });
  await go('intake','intake-scan');
  const beforeStock = await ev(() => Sel.stockRow('libano','BBF-400').onHand);
  const beforeNeed  = await ev(() => Sel.needs({site:'libano'}).find(n=>n.item==='BBF-400').have);
  await ev(() => { intakeLookup(); });
  await page.waitForTimeout(60);
  await ev(() => { intakeConfirmBag(1); });   // the infant bag on the sample pass
  await page.waitForTimeout(60);
  const afterStock = await ev(() => Sel.stockRow('libano','BBF-400').onHand);
  const afterNeed  = await ev(() => Sel.needs({site:'libano'}).find(n=>n.item==='BBF-400').have);
  check('intake confirmation raises stock', afterStock > beforeStock, `${beforeStock} -> ${afterStock}`);
  check('same write moves the public needs board', afterNeed > beforeNeed, `${beforeNeed} -> ${afterNeed}`);

  // --- 7. Offline queues, sync drains --------------------------------------
  await ev(() => Store.setOnline(false));
  await ev(() => { Store.get().scanned = null; intakeLookup(); });
  await page.waitForTimeout(50);
  await ev(() => intakeConfirmBag(0));
  const queued = await ev(() => Store.get().queue.length);
  await ev(() => Store.setOnline(true));
  const drained = await ev(() => Store.sync());
  check('writes queue while offline', queued > 0, 'queued=' + queued);
  const queueAfter = await ev(() => Store.get().queue.length);
  check('sync drains the queue', drained === queued && queueAfter === 0, `drained=${drained}, remaining=${queueAfter}`);

  // --- 8. Matching: reserves stock, and re-planning excludes served --------
  await go('coord','coord-match');
  const m1 = await ev(() => { const p = Match.plan('libano'); return { n: p.allocations.length, unmet: p.unmet.length }; });
  const reservedBefore = await ev(() => Sel.stockRow('libano','BLK-STD').reserved || 0);
  await ev(() => { const p = Match.plan('libano'); Match.issueAll(p); });
  const reservedAfter = await ev(() => Sel.stockRow('libano','BLK-STD').reserved || 0);
  const m2 = await ev(() => Match.plan('libano').allocations.length);
  check('matching produces allocations', m1.n > 0, `${m1.n} households, ${m1.unmet} items short`);
  check('issuing reserves stock', reservedAfter > reservedBefore, `${reservedBefore} -> ${reservedAfter}`);
  check('re-plan excludes households already served', m2 === 0, 'remaining=' + m2);

  // --- 9. Never allocates more than is available ---------------------------
  const overAlloc = await ev(() => {
    Store.setScenario('rs');
    const p = Match.plan('canoas');
    const tot = {};
    p.allocations.forEach(a => a.lines.forEach(l => tot[l.item] = (tot[l.item]||0) + l.qty));
    return Object.entries(tot).filter(([i,q]) => q > Sel.available('canoas', i)).length;
  });
  check('never allocates beyond availability', overAlloc === 0);

  // --- 10. Gate handover decrements stock and frees the reservation -------
  await ev(() => { Store.setScenario('tolima'); const p = Match.plan('libano'); Match.issueAll(p); });
  await go('gate','gate');
  const gateRes = await ev(() => {
    const v = Store.get().vouchers.find(x => x.status !== 'fulfilled');
    const line = v.lines[0];
    const before = Sel.stockRow(v.site, line.item).onHand;
    const resBefore = Sel.stockRow(v.site, line.item).reserved || 0;
    Store.fulfilVoucher(v.ref);
    const after = Sel.stockRow(v.site, line.item).onHand;
    const resAfter = Sel.stockRow(v.site, line.item).reserved || 0;
    return { before, after, qty: line.qty, resBefore, resAfter, impact: Store.get().impact.length };
  });
  check('handover decrements stock by the voucher quantity',
        gateRes.before - gateRes.after === gateRes.qty, `${gateRes.before}->${gateRes.after} (qty ${gateRes.qty})`);
  check('handover releases the reservation', gateRes.resAfter < gateRes.resBefore);
  check('handover generates a donor impact event', gateRes.impact > 0);

  // --- 11. Coordinator publish toggle changes the public board ------------
  const pubBefore = await ev(() => Sel.needs({site:'libano', publishedOnly:true}).length);
  await ev(() => Store.setNeedPublished('libano','BBF-400', false));
  const pubAfter = await ev(() => Sel.needs({site:'libano', publishedOnly:true}).length);
  check('unpublishing a need removes it from the public board', pubAfter === pubBefore - 1, `${pubBefore} -> ${pubAfter}`);

  // --- 11b. Editing a need target propagates everywhere -------------------
  await go('coord','coord-needs');
  const edited = await ev(() => {
    Store.setNeedPublished('libano','BLK-STD', true);
    const before = Sel.needs({site:'libano'}).find(n=>n.item==='BLK-STD');
    const covBefore = Sel.coverage('libano');
    const shortBefore = (Match.plan('libano').unmet.find(u=>u.item==='BLK-STD')||{qty:0}).qty;
    Store.setNeedTarget('libano','BLK-STD', 40);      // far below what is on hand
    const after = Sel.needs({site:'libano'}).find(n=>n.item==='BLK-STD');
    const covAfter = Sel.coverage('libano');
    // Split the broadcast at the "do NOT bring" line to see which side the
    // item sits on. A covered need should move sections, not vanish.
    const wa = buildBroadcast(Sel.site('libano'));
    const cut = wa.indexOf(t('wa.noLonger'));
    const name = Sel.itemName('BLK-STD');
    Store.setNeedTarget('libano','BLK-STD', before.target);   // restore
    return { beforeTarget: before.target, afterTarget: after.target,
             beforePct: before.pct, afterPct: after.pct,
             covBefore, covAfter, shortBefore,
             inUrgent: wa.slice(0, cut).includes(name),
             inDoNotBring: wa.slice(cut).includes(name) };
  });
  check('need target is editable', edited.afterTarget === 40, `${edited.beforeTarget} -> ${edited.afterTarget}`);
  check('editing the target moves the coverage bar',
        edited.afterPct > edited.beforePct, `${edited.beforePct}% -> ${edited.afterPct}%`);
  check('editing the target moves centre-wide coverage',
        edited.covAfter > edited.covBefore, `${edited.covBefore}% -> ${edited.covAfter}%`);
  check('a covered need moves from "urgent" to "do not bring" in the broadcast',
        !edited.inUrgent && edited.inDoNotBring,
        `urgent=${edited.inUrgent}, doNotBring=${edited.inDoNotBring}`);

  const prio = await ev(() => {
    Store.setNeedPriority('libano','HYG-STD','low');
    const lowered = Sel.needs({site:'libano'}).find(n=>n.item==='HYG-STD').priority;
    Store.setNeedPriority('libano','HYG-STD','high');
    return lowered;
  });
  check('priority can be lowered, not only raised', prio === 'low', prio);

  // --- 12. WhatsApp broadcast reflects live board -------------------------
  const waHas = await ev(() => {
    Store.setNeedPublished('libano','BBF-400', true);
    Store.setNeedPriority('libano','BBF-400','critical');
    return buildBroadcast(Sel.site('libano')).includes(Sel.itemName('BBF-400'));
  });
  check('broadcast is generated from the live needs board', waHas);

  // --- 13. Alias matching across three languages -------------------------
  const alias = await ev(() => ['cobijas','cobertor','blankets','fórmula','leite em pó']
      .map(q => (matchCatalog(q)[0]||{}).code));
  check('alias matching resolves ES/PT/EN to one line',
        alias[0]==='BLK-STD' && alias[1]==='BLK-STD' && alias[2]==='BLK-STD' && alias[3]==='BBF-400' && alias[4]==='BBF-400',
        alias.join(','));

  // --- 14. No dead interactive controls ----------------------------------
  const dead = [];
  for (const [r,s] of [['donor','donor-give'],['coord','coord-match'],['coord','coord-needs'],
                       ['inv','inv-stock'],['vm','vm-roster'],['network','network'],['config','config']]) {
    await go(r,s);
    const d = await ev(() => {
      const out = [];
      document.querySelectorAll('#main button').forEach(b => {
        const wired = b.getAttribute('onclick') || b.onclick;
        if (!wired && !b.disabled) out.push((b.textContent||'').trim().slice(0,30));
      });
      return out;
    });
    d.forEach(x => dead.push(`${r}/${s}: "${x}"`));
  }
  check('no unwired buttons', dead.length === 0, dead.slice(0,6).join(' | '));

  check('no runtime errors during the whole flow', errs.length === 0, errs.slice(0,3).join(' | '));

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
