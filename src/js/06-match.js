/* ============================================================================
 * MATCHING ENGINE
 *
 * The research this project rests on is blunt about where the difficulty lies:
 * matching what is needed against what exists is the hard part, and the one
 * organisation known to run it at scale did it with two people doing it by
 * hand until 2025. A prototype that shows a distribution gate but not the
 * allocation behind it is showing the easy half.
 *
 * Two design commitments, both of which practitioners will test:
 *
 * 1. EXPLAINABILITY. Every allocated line names the rule that produced it, and
 *    every ranking names the factors that produced it. A volunteer at the gate
 *    must be able to tell a family why they received what they received, and a
 *    coordinator must be able to defend the order to somebody who is angry.
 *    An allocation nobody can explain is an allocation nobody will trust.
 *
 * 2. RESERVATION AT ISSUE. Stock is committed when the voucher is generated,
 *    not when it is handed over. A voucher that bounces at the table costs more
 *    trust than a slower queue.
 *
 * What this deliberately is NOT: an optimiser. It is a transparent, ordered,
 * greedy allocation. Something cleverer would allocate marginally better and
 * be impossible to argue with in public, which in this context is a worse
 * trade. See docs/open-questions.md.
 * ==========================================================================*/
const Match = (function () {
  'use strict';

  /* -------------------------------------------------------------------------
   * What a household is entitled to, before stock is considered.
   * -----------------------------------------------------------------------*/
  function entitlement(fam) {
    const lines = [];
    ENTITLEMENTS.forEach((rule, idx) => {
      if (rule.ifSheltered && !fam.sheltered) return;
      if (rule.ifMedical && !fam.medical) return;

      let units = 0;
      if (rule.per === 'person') units = fam.size;
      else if (rule.per === 'household') units = 1;
      else if (rule.per === 'under5') units = fam.under5;
      if (units <= 0) return;

      const due = Math.min(units * rule.qty, rule.cap);
      const already = fam.received[rule.item] || 0;
      const outstanding = Math.max(0, due - already);
      if (outstanding <= 0) return;

      lines.push({
        item: rule.item,
        qty: outstanding,
        due: due,
        already: already,
        ruleIndex: idx,
        basis: { per: rule.per, units: units, each: rule.qty, cap: rule.cap }
      });
    });
    return lines;
  }

  /* -------------------------------------------------------------------------
   * Ranking. Factors are returned rather than folded away, so the UI can show
   * the arithmetic instead of a bare number.
   * -----------------------------------------------------------------------*/
  function priority(fam) {
    const factors = [];
    const add = (key, points, detail) => {
      if (points > 0) factors.push({ key: key, points: Math.round(points * 10) / 10, detail: detail });
    };

    add('under5', Math.min(fam.under5 * 3, 9), fam.under5);
    add('over65', Math.min(fam.over65 * 2, 6), fam.over65);
    if (fam.medical) add('medical', 4);
    add('waiting', Math.min(fam.daysWaiting * 1.5, 9), fam.daysWaiting);
    if (fam.sheltered) add('sheltered', 2);
    add('size', Math.min(fam.size * 0.5, 4), fam.size);

    const score = factors.reduce((a, f) => a + f.points, 0);
    return { score: Math.round(score * 10) / 10, factors: factors };
  }

  /* -------------------------------------------------------------------------
   * The plan. Runs against live availability (on hand minus already reserved),
   * in priority order, and records what it could not satisfy.
   * -----------------------------------------------------------------------*/
  function plan(siteId) {
    const fams = Sel.families(siteId).filter(f => !hasOpenVoucher(f.ref));

    const ranked = fams.map(f => {
      const p = priority(f);
      return { family: f, score: p.score, factors: p.factors, wants: entitlement(f) };
    }).filter(r => r.wants.length > 0)
      .sort((a, b) => b.score - a.score);

    // Working copy of availability so we never over-commit the shelf.
    const pool = {};
    ranked.forEach(r => r.wants.forEach(w => {
      if (!(w.item in pool)) pool[w.item] = Sel.available(siteId, w.item);
    }));

    const allocations = [];
    const unmet = {};

    ranked.forEach((r, rank) => {
      const lines = [];
      r.wants.forEach(w => {
        const canGive = Math.min(w.qty, pool[w.item] || 0);
        if (canGive > 0) {
          pool[w.item] -= canGive;
          lines.push({
            item: w.item, qty: canGive, requested: w.qty,
            short: w.qty - canGive, ruleIndex: w.ruleIndex, basis: w.basis, already: w.already
          });
        }
        const missing = w.qty - canGive;
        if (missing > 0) unmet[w.item] = (unmet[w.item] || 0) + missing;
      });

      if (lines.length) {
        allocations.push({
          family: r.family, site: siteId, lines: lines,
          score: r.score, factors: r.factors, rank: rank + 1,
          aheadOf: ranked.length - rank - 1
        });
      }
    });

    return {
      site: siteId,
      allocations: allocations,
      unmet: Object.keys(unmet).map(item => ({ item: item, qty: unmet[item] }))
                   .sort((a, b) => b.qty - a.qty),
      considered: ranked.length,
      pool: pool
    };
  }

  function hasOpenVoucher(familyRef) {
    return Store.get().vouchers.some(v => v.family === familyRef && v.status !== 'fulfilled');
  }

  /** Turns one allocation into an issued, stock-reserving voucher. */
  function issue(allocation) {
    const seq = Store.get().vouchers.length + 1;
    const voucher = {
      ref: allocation.family.ref + '-V' + seq,
      family: allocation.family.ref,
      site: allocation.site,
      lines: allocation.lines.map(l => ({ item: l.item, qty: l.qty, ruleIndex: l.ruleIndex, basis: l.basis })),
      score: allocation.score,
      factors: allocation.factors,
      status: 'issued',
      issuedAt: Store.nowClock()
    };
    Store.issueVoucher(voucher);
    return voucher;
  }

  function issueAll(planResult) {
    return planResult.allocations.map(issue);
  }

  return { entitlement, priority, plan, issue, issueAll, hasOpenVoucher };
})();
