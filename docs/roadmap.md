# Roadmap

Written as conditions rather than dates, because every phase after the first depends on an answer we do not have.

For what each phase would take to build — architecture, technical requirements, effort and cost — see [production.md](production.md).

---

## Phase 0 — Now: get argued with

**Goal:** find out which parts of this are wrong before any of it is built.

- Put the prototype in front of people who have run relief centres, collection points and shelters — in Colombia and Brazil first.
- Get answers, or at least informed opinions, on the [open questions](open-questions.md). Questions 1 (will donors pre-register), 2 (is the ordering defensible) and 8 (why did NDMN fail) are the ones that decide whether the rest is worth building.
- Have the [data-protection position](data-protection.md) checked by somebody who does this work in the relevant jurisdictions.
- Correct `research.md` where practitioners say it does not match what they saw.

**This phase can fail, and failing here is cheap.** If pre-registration is a fantasy, that should surface now.

**Exit condition:** at least three people who have run a centre have engaged in detail, and the open questions have moved from "unknown" to "answered or explicitly deferred".

---

## Phase 1 — Only if Phase 0 survives: one real drive

**Goal:** one measurable number, from a low-stakes context.

The right test is **an ordinary donation drive, not a disaster.** A parish collection, a school appeal, a Christmas campaign. No displaced-person data, no emergency pressure, no reputational risk if it goes badly — and it can be run twice, with and without the pre-registration poster.

What to measure:
- Pre-registration rate (question 1, directly).
- Time per donor at intake, pre-registered versus walk-in.
- Volunteer hours spent sorting.
- Proportion of arriving goods that were not on the needs list.

Scope: donations only. No People module, no matching, no vouchers. That deliberately avoids handling any sensitive data in the first build, and it targets the best-evidenced problem with the cleanest before-and-after measurement.

**Exit condition:** a real number for pre-registration rate and sorting time. If pre-registration is negligible, stop and say so publicly — a documented negative result is a genuine contribution to a field that repeats these ideas.

---

## Phase 2 — Only with a willing centre: people and matching

**Goal:** find out whether allocation survives a real queue.

This is where displaced-person data enters, so it does not start until:
- a centre actively wants it, rather than agreeing to try it;
- the data-protection design has been reviewed by someone qualified in that jurisdiction;
- there is a clear answer to what happens to records when the centre closes.

The matching engine is the substance here, and the honest expectation is that its ranking will be wrong and will need to be re-derived locally rather than tuned.

**Exit condition:** a distribution run with vouchers, and a coordinator's account of whether the order held.

---

## Phase 3 — Only at two or more centres: the network

Multi-centre transfers, shared reporting and civil-defence integration. Deferred not because it is hard to build but because it is the wrong problem to solve early: the literature is consistent that interoperability between independent organisations fails for organisational and legal reasons far more than technical ones, and a shared database between unequal partners is a power arrangement rather than an integration.

If this phase happens, the right output is probably a **shared standard** — a small agreed reference format — rather than a shared system.

---

## What is deliberately not on this roadmap

- **Inbound WhatsApp parsing.** Turning group chatter into structured needs is a much harder problem than generating outbound messages. Revisit only with field evidence that it is needed.
- **A mobile app.** A web page that works on any phone with no install is a lower barrier than an app store, and the barrier is the point.
- **Anything predictive.** Forecasting demand from historical patterns is attractive and would be built on data this project does not have and should not pretend to.
- **Scale.** There is no version of this that is worth scaling before one centre has used it and said it helped.

---

## What would make us stop

Stated in advance, so it is harder to rationalise away later:

- Pre-registration rates that make the mechanism pointless.
- A practitioner consensus that allocation ordering cannot be legitimately automated, only facilitated.
- Discovering that Aidmatrix / NDMN failed for a reason that applies identically here.
- Any evidence that the People module creates risk for displaced people that the design cannot mitigate.

A concept prototype that is abandoned for a documented reason is more useful to the field than one that is quietly maintained forever.
