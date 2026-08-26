# Concept

The full design argument. This replaces two earlier documents that overlapped by more than half and disagreed with each other in places.

Where a claim rests on evidence, it links to [research.md](research.md), which carries the sources and a confidence rating per section. Where it rests on a guess, it says so.

---

## 1. Who this is for

Not a disaster agency. An improvised centre.

The 2024 Rio Grande do Sul floods ran 803 shelters at peak, the great majority in buildings never designed for it — 543 had running water, 516 had kitchens. Post-event research studying 28 of them concludes that community centres and churches are the *best* pre-existing buildings for the purpose, because their space is flexible. Several parishes sheltered hundreds of people each, and at least one reported receiving no assistance from public authorities at all.

That is the customer. A building that was doing something else last week, run by people who are not logisticians, that needs to be operational this afternoon.

This reframes everything. A tool for an agency can assume training, procurement, IT support and a planning horizon. A tool for a parish can assume none of those. It has to be adoptable in pieces, usable by someone who has never seen it, and worth using on a normal Tuesday as well as during a catastrophe — because otherwise nobody ever practises with it, and the first day of an emergency is the worst possible time to learn a tool.

## 2. The three failures

**Donations arrive that cannot be used.** In catastrophic events, researchers estimate 50–70% of arriving cargo is "non-priority" — inappropriate, unsortable, expired, or with no identified destination. That figure is a published expert estimate rather than a measured statistic, and the category is broader than "unwanted": goods nobody can sort are counted in it. The concrete version is better evidenced. By mid-May 2024, clothing was 70% of everything collected nationally for Rio Grande do Sul, and the postal service suspended accepting it, redirecting donors to water, non-perishable food, pet food and cleaning materials. Relief coordinators had said the same a week earlier: sorting clothing was the single most time-consuming task.

**Volunteers converge unevenly.** The documented pattern in Mexico City in 2017 is distributional rather than absolute — coordinators actively redirecting people between sites, some organisations turning volunteers away, while other areas went unserved. Not a surplus everywhere; a mismatch.

**Nobody has a current picture.** Which is why the volunteer response to the 2017 earthquake ran substantially on WhatsApp groups and citizen-built platforms — most notably Verificado19S, assembled within hours by 100+ volunteers, which mapped collapses, shelters and collection centres *together with their specific unmet needs*, publishing nothing without two independent on-site confirmations.

That last detail is the important one. A group of volunteers built a needs-matching system in days, by hand, because the need for one was overwhelming and nothing existed. That is a demand signal, not a gap in the market.

## 3. The mechanism

**Donations are described before they travel.**

A donor opens a web page — no account — and either gives money, answers a published need, or describes what they already have. If it is goods, they pack one category per bag and describe each bag. They get a single code with a scannable tag.

Three things follow.

**Intake becomes a scan.** The bag's contents are already known, so the volunteer confirms rather than interrogates. One category per bag means the bag goes to a shelf without being opened, emptied and sorted — the sorting mountain never forms rather than being cleared faster.

**Steering happens at the only moment it is free.** Refusing a donation at the door has already cost the donor a journey and the volunteer a difficult conversation. Refusing it at the packing stage costs nothing and keeps the donor, who will probably come back with something needed. The centre publishes what it wants and, more importantly, what it does not.

**The centre is suggested after the bags, not before.** Somebody packing what they already own is not shopping from a list. Ask what they have, then rank centres by which most needs those categories against live unmet need.

### The novelty claim, precisely

We found no published precedent for registration at the level of the **individual container** — a machine-readable tag on that specific bag, scanned in at the door.

The broader idea has a precedent and it failed. The Aidmatrix-powered **National Donations Management Network** let donors post goods offers online for agencies to accept before shipment, from the late 2000s. That is real donor-side pre-registration, at the level of the *offer*, with no tagging and no scan-in. It is defunct.

So the differentiation is the **unit** (container, not offer), the **artefact** (a scannable tag), and the **moment** (scan-in at the door). That is narrower than "nobody has done this", and we would rather state the narrow version. Why NDMN failed is [open question 8](open-questions.md#8-why-did-aidmatrix--ndmn-fail), and it is the one most likely to invalidate this whole approach.

## 4. Allocation

Matching need against stock is the part the literature calls hard, and it is where most designs stop. Good360 — which has distributed over $18 billion in goods since 1983 — ran donation-to-recipient matching with a **two-person team** manually searching tens of thousands of nonprofit partners, until automating it in 2025. That is what "hard" means in practice: not intellectually difficult, but unscalable by hand and consequential when wrong.

CAPEM's engine ranks households by openly-scored need, allocates from stock that exists, and reserves it at issue.

Two commitments carry the design:

**Explainability over optimality.** A cleverer algorithm would allocate marginally better and be impossible to defend to somebody angry about their place in the queue. Every allocated line names the rule that produced it; every ranking shows its arithmetic. Allocation nobody can explain is allocation nobody will trust, and a distribution runs on trust or it runs on crowd control.

**Reservation at issue.** Stock is committed when the voucher is generated, not at handover. This costs availability on paper and buys the guarantee that a voucher presented at the gate can always be honoured. A voucher that bounces costs more trust than a slower queue.

The scoring weights are invented. See [open question 2](open-questions.md#2-is-the-allocation-ordering-defensible-in-a-real-queue).

## 5. Design commitments for Latin America

**WhatsApp is a channel, not an integration.** The response lives there. Version one generates an outbound message from the live needs board — urgent first, also-accepting second, and then the line that matters most: what *not* to bring. Telling two hundred neighbours to stop bringing clothing prevents more chaos than any dashboard resolves. Inbound parsing is deliberately deferred; it is a much harder problem.

**Cash first, never cash only.** Money lets a centre buy what is actually short, in bulk, locally. Brazil's state government created an official Pix key on 3 May 2024 explicitly to channel donations and avoid fraud; it passed R$100 million within two weeks. Colombia has Nequi, PSE and Daviplata. But framing matters — abstract "donate" buttons perform worse than concrete impact, so the options are "water for a family for a week", not a number. And item donors are never turned away.

**Trust first, low friction.** No donor accounts. The code is the lookup key. Codes work offline, on paper, read aloud, written on a box in marker. Nothing requires the person in front of you to own a working phone.

**Independent centres are the entry point.** Hence per-module adoption, a setup flow that finishes by going live, and a network view that is read-only about other centres' stock.

## 6. Data protection

Consent is usually the wrong legal basis. Somebody who needs a bed tonight cannot freely refuse a form, and the ICRC *Handbook on Data Protection in Humanitarian Action* (3rd ed., Nov 2024) is explicit that this invalidates consent — while offering vital interest, important grounds of public interest and legitimate interest instead, each of which places the burden of judgement on the organisation rather than on someone who cannot say no.

The design answer is to **collect less rather than consent better**: household size, children under five, adults over 65, a medical flag. No identity numbers, addresses, nationality, ethnicity, religion or biometrics. A reference, not a dossier. Aggregates flow out; records stay at the centre.

What that does not solve is set out in [data-protection.md](data-protection.md), including the one that software cannot solve: an official asking for the list.

## 7. Architecture in one paragraph

A thin **spine** — a shared reference plus a minimal contract — connecting swappable **blocks**: Donations, People, Matching & Distribution, Volunteer Operations, Network & Command. A centre already tracking people on paper adopts only the piece it is missing. Matching sits alongside the two pipelines rather than inside either, because it is what they are *for*. Full detail in [architecture.md](architecture.md).

## 8. What would prove this wrong

Listed here rather than buried, because a concept that cannot be falsified is not a concept.

- **Donors do not pre-register** at a rate that makes the mechanism worth anything. This is the load-bearing assumption and the cheapest to test — one ordinary donation drive, run with and without the poster.
- **Coordinators reject automated ordering** as illegitimate, and want facilitation rather than allocation.
- **NDMN failed for a reason that applies here identically**, in which case this is a repeat rather than an advance.
- **Small centres will not touch a tool that handles money**, which would break the single-flow design.

The first of these can be answered in a month, without a disaster, for almost nothing. That is what [the roadmap](roadmap.md) starts with.
