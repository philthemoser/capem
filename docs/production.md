# Taking CAPEM to production

What a real implementation would involve, what it would require technically, and — the longer list — what is missing entirely.

Facts about payment rails, data-protection law and cloud regions were checked in August 2026 and are cited. Where something could not be verified it says so.

---

## 0. The honest framing

The prototype is roughly **5% of a production system, and close to the easiest 5%**. Everything visible is a client-side rendering layer over an in-memory object. There is no server, no database, no authentication, no persistence, no payment handling, and no security model. A competent team would rebuild almost all of the current code.

That is fine — it was built to be argued with, not extended. But it means "how long to production" is not really a software question. Three honest observations before any of the architecture below matters:

**Building it is the known part.** Roughly 14–18 months and 3–5 people to a defensible system across all three phases; 4–5 months to something pilotable. That is a normal estimate for a normal system, and the least uncertain number in this document.

**The load-bearing assumption is still untested.** If donors do not pre-register at a meaningful rate ([open question 1](open-questions.md)), the entire mechanism is decoration and none of the engineering below is worth doing. That can be tested in a month, for almost nothing, at an ordinary donation drive. **Nothing in this document should start before that does.**

**Nobody is funded to run it.** The target customer is a parish with no software budget. Whoever pays is not whoever benefits, and that gap — not the code — is what most plausibly ended [Aidmatrix/NDMN](../README.md#what-is-actually-new-here). See §7.

### Which version of "production" this is

The answer forks depending on who builds it, and the fork matters more than the stack:

| Path | What changes |
|---|---|
| **You build and operate it** | You become a data controller or processor for displaced people's records, with the legal exposure that carries. Needs a legal entity, insurance, a DPIA, and someone reachable at 2am during a disaster. |
| **An established NGO adopts it** | The hardest problems — legal entity, liability, funding, field access, trust — are already solved. You are contributing a design and possibly code. Overwhelmingly the lowest-risk path, and the one this document assumes is preferable. |
| **You publish the design and someone else builds it** | Cheapest and most likely to reach real centres, but you lose control of the data-protection commitments, which are the part where being wrong hurts people who cannot complain. |

---

## 1. Deployment topology — and why law decides it

The first architectural decision is not the stack. It is that **Colombia and Brazil should be separate deployments.**

Neither country mandates data localisation — this is a common and incorrect assumption. But:

- **Brazil (LGPD)** permits international transfer with a legal mechanism. ANPD [Resolution CD/ANPD No. 19/2024](https://www.mayerbrown.com/en/insights/publications/2024/08/new-anpd-regulation-international-data-transfers) approved Standard Contractual Clauses; the grace period **ended 23 August 2025**, so transfers without SCCs or another approved mechanism are now exposed to enforcement. The SCCs must be executed essentially unmodified, and controllers must notify ANPD and affected data subjects of an incident **within three days**.
- **Colombia (Ley 1581)** prohibits transfer to countries without adequate protection. The SIC's adequacy list (Circular Externa 005 de 2017) includes the **United States**, Mexico, Peru, the UK and the EEA — but **not Brazil**. [Circular 002 de 2025](https://cancilleria.gov.co/normograma/compilacion/docs/circular_superindustria_0002_2025.htm) added a route to request a *Declaración de Conformidad* where the destination is not adequate.

So a single shared database holding both countries' caseloads would put Colombian personal data in Brazil, which is not an adequate destination and would need a specific authorisation. The clean answer is one deployment per country.

That is not a hardship — it fits the design. Centres are the unit; there is no product reason for a Colombian parish and a Brazilian one to share a database. It does mean two of everything to operate, and it kills any ambition of a single global instance.

**Regions, as of 2026:**

| | Brazil | Colombia |
|---|---|---|
| AWS | `sa-east-1` São Paulo (full region) | No region. A Bogotá Local Zone is announced but **not confirmed GA**, and its parent region is US East — verify with AWS |
| Google Cloud | `southamerica-east1` (Osasco) | None announced |
| Azure | Brazil South (São Paulo) | None |
| Oracle | — | Bogotá region exists |

Brazil hosts in-country comfortably. Colombia has no realistic in-country hyperscaler region, but **US hosting is legally adequate for Colombia** under the SIC list — which is convenient, and worth writing down before someone spends six months looking for a Bogotá region.

> A note on the reform: a GDPR-aligned bill replacing Ley 1581 was filed in August 2025, adding mandatory impact assessments, breach notification and DPOs. We could not confirm it has passed. Design to the stricter version anyway; it costs little and the direction of travel is clear.

---

## 2. The genuinely hard problem: offline

Everything else in this document is ordinary work. This part is not, and it is where a naive implementation will lose stock records and hand out vouchers that cannot be honoured.

### The insight that makes it tractable

**Model stock as an append-only ledger of movements, not as a mutable quantity.**

The prototype stores `onHand: 96` and mutates it. Two disconnected devices both doing that produces a lost update: last write wins, and a stock movement silently vanishes. In an inventory that is the failure that destroys trust permanently, because nobody can tell it happened.

Instead, store movements — `+20 blankets, device A, 14:22, idempotency key X` — and derive the quantity. Movements are **commutative**: they can arrive in any order, from any device, after any delay, and the derived total is the same. Two devices booking in donations offline simply produce two movements that both apply. No conflict, no resolution logic, no lost writes.

This is the single most important modelling decision in a production build, and it is cheap to make at the start and expensive to retrofit.

Requirements that follow:

- **Idempotency keys on every write.** Offline replay will send the same operation twice. Without a key, a queued intake confirmation applied twice doubles the stock. This is the most likely serious bug in the whole system.
- **Client-generated IDs.** ULID or UUIDv7 — time-ordered, so they index well in Postgres and sort sensibly.
- **Monotonic derived views.** Materialise current quantities, but always be able to rebuild them from the ledger. That is also what makes the transparency reporting honest.

### The part that does not have a clean answer

**Reservations require coordination, and coordination is exactly what a network partition removes.**

A voucher reserves stock at issue — that is a deliberate design commitment, because a voucher that bounces at the table costs more trust than a slower queue. But two coordinators, both offline, can each issue vouchers against the same 96 blankets. When they reconnect, the reservations exceed the stock and somebody's voucher fails at the gate, which is the exact outcome the design exists to prevent.

There is no clever fix. This is a real distributed-systems constraint, not an implementation gap. The options:

| Option | Cost |
|---|---|
| **Issue vouchers online only** | Allocation stops when the signal drops. Intake and the gate stay offline-capable. Simplest, honest, and probably right for v1. |
| **Per-device stock allotments** | Each device is granted an exclusive slice of stock it may allocate against while offline. No conflicts by construction. Costs utilisation — allotted stock is unusable by anyone else — and needs a lease/expiry mechanism. |
| **Issue optimistically, reconcile on sync** | Best availability, but pushes the failure to the worst possible place: a family at the table holding a voucher that no longer works. |

**Recommendation: online-only issuance in v1**, with allotments as a later option if field evidence shows allocation actually needs to run during outages. Which it may not — allocation is a back-office act performed by a coordinator, not a queue-side one, and coordinators are more likely to have connectivity than the gate is.

This should be stated plainly in the product, not hidden. "You cannot issue vouchers while offline" is a limitation people can plan around. A voucher that fails at the table is not.

### Build or adopt a sync engine

For Postgres-backed sync with real offline writes, as of 2026:

| Engine | Read | Verdict |
|---|---|---|
| **PowerSync** | Most complete offline-write story; local SQLite, queued upload, production-proven | Strongest capability fit. Client SDKs are Apache-2.0 but the **server is Functional Source License** — source-available, not OSI-open. Needs a licence review if the project must be fully open or expects third parties to redeploy it. |
| **Electric** | GA since March 2025, Apache-2.0, clean licence, partial replication | Cleanest licence. Read-path sync is solid; **you build more of the write and offline path yourself**. |
| **Zero (Rocicorp)** | 1.0 in June 2026, Apache-2.0, works with ordinary Postgres | Promising, newest, and its **offline story is the least documented** — verify before committing. |
| **Automerge / Yjs** | Mature CRDTs, MIT | Not Postgres sync engines. Choosing one means building the Postgres mapping, auth and persistence yourself. |
| **RxDB** | Mature local-first JS DB, broad replication plugins | No first-party Postgres plugin; some modules are behind a closed Premium tier. |

Given the ledger model above does most of the conflict work, the sync layer's job is smaller than it first appears: reliable queued delivery with idempotency, not general conflict resolution. **Electric plus a hand-built outbox is a defensible choice for a small team that wants a fully open stack**; PowerSync is the faster path if the licence is acceptable.

---

## 3. Stack

Chosen for a 3–5 person team that will change composition, in a region with a specific hiring pool, running on cheap Android hardware.

**Frontend — PWA, TypeScript, React.** The prototype's hand-rolled rendering does not survive real offline state. React is not the most elegant option, but it has by far the deepest hiring pool in Latin America, and *who can maintain this in three years* outweighs elegance for a project like this. Budget hard for bundle size: the target device is a low-end Android phone on a slow connection, not a laptop. Set a performance budget and fail the build when it is exceeded.

**Local store — SQLite (via the sync engine) or IndexedDB.** Whatever the engine dictates.

**Backend — modular monolith, Node/TypeScript + Fastify or NestJS.** Same language as the frontend, which genuinely matters at this team size. Module boundaries mirror the five blocks so they can be split later if they ever need to be. Not microservices — there is no scale problem here, only a coordination one.

**Database — PostgreSQL.** Row-level security for centre-level tenancy, so a query bug cannot leak one centre's caseload to another. Partition the movement ledger by centre and month.

**Offline codes — Ed25519-signed compact payloads.** A donation pass must be verifiable at a door with no connectivity, which means the code itself must carry a signature the device can check against a cached public key. Add a **check digit** (Damm or Verhoeff) so a code read aloud down a phone line or copied off a box in marker fails loudly rather than silently resolving to the wrong donation.

**Hosting — managed, in-region per §1.** Terraform or equivalent; two environments minimum.

**Observability — error tracking, structured logs, uptime monitoring, and a public status page.** The status page is not vanity: during a disaster, a coordinator needs to know within seconds whether the problem is the system or their signal, because the answer changes what they do next.

---

## 4. Identity, which is not standard

This is where off-the-shelf SaaS auth stops fitting, and it is worth designing deliberately rather than reaching for the default.

**Donors stay anonymous.** No account, ever. The code is the only key. This is a product commitment, not an oversight.

**Field volunteers cannot have individual accounts.** They rotate daily, may work one shift ever, and share a tablet at the intake table. Email-and-password per volunteer is a fantasy — the real-world outcome is one shared login taped to the device, which is worse than designing for sharing honestly.

A workable model:

- **The device is enrolled**, once, by a coordinator. It holds a long-lived credential and a scoped role.
- **A volunteer identifies with a short PIN or a scanned badge** at the start of a shift, so the audit log attributes actions to a person without requiring them to hold an account.
- **Sessions expire on shift boundaries**, not after 30 days.
- **Remote revocation** of a device credential, because tablets get lost — and a lost tablet holding a shelter caseload is the worst plausible incident this system can have.

**Coordinators and admins get real accounts** with MFA, because they can export aggregates and change entitlement rules.

**Everything is attributed.** The movement ledger records which device and which volunteer, immutably. That is what makes the transparency claim real rather than rhetorical.

---

## 5. Technical requirements

Grouped so it can be used as a checklist.

### Core platform
- REST or GraphQL API with explicit versioning; contract tests
- Multi-tenancy: event → centre → user, with row-level security
- Append-only movement ledger with idempotency keys and client-generated IDs
- Derived read models, rebuildable from the ledger
- Immutable audit log covering every stock, voucher and personal-data operation
- Migrations, seed data, backup **and a tested restore** — untested backups are not backups

### Offline
- Service worker, app shell caching, background sync
- Local database and durable operation queue surviving app restart and device reboot
- Conflict policy documented per entity type, not per incident
- Clear, visible sync state — a volunteer who cannot tell whether their work saved will redo it or go back to paper

### Security
- Threat model written down. The realistic threats: voucher fraud and duplicate claims; **theft of a list of displaced people**, which has real value to hostile actors; insider misuse; device loss; denial of service during the exact hours the system matters most
- Signed offline-verifiable codes; replay protection
- Encryption in transit and at rest; managed keys
- Rate limiting and abuse protection on the public donor endpoint
- Dependency scanning, SBOM, and an independent penetration test before any real personal data is entered

### Data protection
- **DPIA/RIPD, treated as mandatory.** Under ANPD's high-risk test (Resolution 2/2022) this processing meets a specific criterion — sensitive data and data of vulnerable groups — so a RIPD is very likely required in Brazil. Colombia does not expressly require one, but it is the artefact the SIC would ask for under *demostrada responsabilidad*, and it is largely the same document
- Controller/processor determination, in writing, per centre — this decides who carries the legal exposure and it must not be left ambiguous
- Data processing agreements with every centre; ANPD Standard Contractual Clauses for any transfer out of Brazil
- Retention schedules with **automatic deletion that actually runs and is monitored**
- Data subject rights: access, correction, erasure, portability — for people who may be unreachable by the time they are exercised
- Breach process meeting **three-day** ANPD notification
- Records of processing activities

### Payments — if in scope at all
- PSP integration: Bre-B and/or Nequi/PSE in Colombia; a Pix PSP in Brazil
- Reconciliation between money received and goods purchased, exportable for audit
- Fiscal sponsorship arrangements, per centre
- Chargeback and refund handling — including Brazil's **MED 2.0**, in force February 2026, which lets banks automatically block suspected fraudulent amounts for up to **11 days** while investigating. Donations can therefore be frozen mid-response, and the product must not assume received money is spendable money

### Field realities
- Barcode/QR scanning that works in bad light, at angles, on creased and damp labels — harder than it looks, and the difference between an 11-second intake and a queue
- Label and A4 poster printing
- Tested on genuinely low-end Android devices; a device lab, not an emulator
- SMS fallback for alerts at sites with no data

### Quality
- Unit tests on the allocation engine; **property-based tests on its invariants** — never allocate beyond availability, never double-issue against the same reservation, always terminate
- Offline/sync chaos testing: kill the network mid-write, mid-sync, mid-voucher
- Load testing at a realistic peak — the first 72 hours of a response, not a steady state
- Professional translation review. The Spanish and Portuguese in the prototype were not written by native speakers and need a proper pass before anyone relies on them

---

## 6. What is missing entirely

Everything below exists in **no form at all** today. The engineering column is long; the second column is longer and matters more.

### Not built
- Backend, database, API, authentication, authorisation, persistence — all of it
- Offline sync, operation queue, idempotency, conflict handling
- Payments, reconciliation, fiscal sponsorship
- WhatsApp integration beyond copy-to-clipboard (see below)
- SMS gateway
- Real barcode scanning; printing
- Admin tooling: creating events and centres, enrolling devices, managing users
- Import/export, reporting, transparency publication
- Backup, restore, monitoring, alerting, incident response
- Anything resembling a security posture

### Not decided
- **Who the data controller is** — the centre or the operator. This determines who carries liability, and it is the first question a lawyer will ask
- **What happens to records when a centre closes.** Improvised centres stop operating abruptly. That is precisely when caseload data ends up somewhere nobody intended, and no one plans for it
- **Whether money is in scope at all.** Including it brings CNPJ requirements, reconciliation, fraud exposure and MED freezes. Excluding it and linking to the centre's own channel is far simpler and may be all that is wanted
- **What the entitlement rules should actually be.** The current numbers are invented. Real ones come from Sphere standards, national guidance, or a coordinator's judgement about what a centre can sustain
- **Who governs the project** — licence, decision-making, who may change the allocation rules

### Not solved, and possibly not solvable
- **Reservation under partition** (§2). Constrained, not eliminated
- **The official who asks for the list.** Minimal fields reduce the harm; they do not remove the request. The control is a coordinator standing in front of an authority, and software cannot be that for them
- **Cross-organisation interoperability.** The literature is consistent that this fails for organisational and legal reasons far more than technical ones. A shared database between unequal partners is a power arrangement, not an integration

### Missing outside the code — the part that actually decides this
- **A legal entity** to hold contracts, liability and insurance
- **Professional indemnity insurance**
- **A support model.** Who does a coordinator call at 2am, in Portuguese, during a flood
- **A safeguarding policy**, since the system touches households with children
- **Terms and privacy notices** in three languages, written to be understood by people under stress and with varying literacy
- **Field partners** in each country with existing relationships and trust
- **A funding model.** Nobody in this chain has a software budget. Foundation grant, government contract, NGO core funding and platform-fee models all have precedent and all have failure modes
- **A sustainability plan.** Software that stops being maintained during a quiet year is unavailable in the next disaster, which is worse than never having existed because people will have stopped keeping the paper system fresh

### One constraint worth knowing before promising WhatsApp

The WhatsApp Business Platform requires **Meta Business Verification**, which requires legal registration documents. A Brazilian parish will need its **CNPJ**; an informal community group **cannot verify at all** and simply cannot use the API. It also needs a dedicated phone number not already on WhatsApp, a Business Solution Provider, and pre-approved message templates.

That is a hard gate in front of the exact customer this design targets. The good news is that the prototype's zero-integration fallback — generate the message, copy to clipboard, coordinator pastes it into their own group — has none of those requirements, works today, and may be the only version that ever ships for small centres. **Treat it as the primary path and the API as an upgrade for larger organisations**, rather than the reverse.

Pricing, for larger organisations: Meta moved to per-message billing in July 2025, and service messages inside a 24-hour customer window are free. Per-country rates are published only as downloadable rate cards we could not retrieve — third-party figures put a Brazilian utility message at roughly R$0.04–0.05, and a Colombian figure we found looked anomalous. **Do not budget from these numbers without checking Meta's rate card directly.**

---

## 7. Phasing, effort and cost

Planning estimates, not quotes. Every phase is gated on the previous one producing evidence.

| Phase | Scope | Effort | Team |
|---|---|---|---|
| **0 — Validate** | One ordinary donation drive, with and without the QR poster. Measure pre-registration rate, intake time, sorting hours. No software beyond the existing prototype and a printed poster | 4–6 weeks | 1 person + a willing centre |
| **1 — Donations** | Backend, auth, offline intake, walk-in matching, needs board, stock ledger, WhatsApp copy-out. **No personal data, no money** | 4–5 months | 3 (2 eng, 1 product/design) + field advisor |
| **2 — People and matching** | Registration, entitlements, allocation, vouchers, the gate. DPIA, DPAs, retention, security review | 4–6 months | 4 (3 eng, 1 product) + legal counsel |
| **3 — Network** | Multi-centre, transfers, reporting, civil-defence interface | 4+ months | 4–5 |

**To something pilotable: about 5 months.** To a system defensible with real caseload data: **14–18 months.**

Cost, at Latin American remote rates, roughly **USD 150–250k/year** for a team of this size; European rates are two to three times that. Running costs are modest — hosting on the order of USD 150–600 per month per country — with the variable risk in SMS and WhatsApp per-message fees, which scale with the size of the emergency and are therefore highest exactly when funds are most constrained.

Legal and data-protection work runs in parallel with Phase 1 and must complete before Phase 2 begins. It is not a line item to compress.

---

## 8. The three things most likely to kill this

Not the technical risks. Those are ordinary.

**1. Donors do not pre-register.** The whole design rests on a stranger doing sixty seconds of unpaid administration before an act of generosity. Testable in a month. **Do that first, before anything in this document.**

**2. Nobody pays for it.** The customer is a parish with no budget. The beneficiary is a displaced family with less. The funder, whoever they are, is a third party with different incentives from both. Every project in this category has died here, and there is a reasonable chance it is what ended NDMN — which nobody has yet told us.

**3. It is unmaintained when the next disaster arrives.** Disaster software has long idle periods. A system that quietly rots between events is worse than no system, because centres will have let their paper practice lapse in the meantime. This is the strongest argument for the design's "works on an ordinary donation drive" property, and for an established NGO owning it rather than a small independent team.

---

## 9. What we would actually recommend

Given all of the above, the honest recommendation is not "build this".

1. **Run the Phase 0 test.** Four weeks, one centre, a printed poster. It either validates the core mechanism or saves eighteen months.
2. **If it validates, find an NGO to own it** rather than building it independently. They already have the legal entity, insurance, field access, funding relationships and trust that constitute most of the missing work above.
3. **Build Phase 1 only, donations only,** with no personal data and no money. It is genuinely useful alone, it is measurable, and it avoids the entire data-protection burden until there is evidence worth protecting.
4. **Keep the open questions open in public.** The willingness to be corrected is this project's main asset, and it is worth more than the code.

The code in this repository is not the valuable part. The argument, the cited evidence, and the list of things we do not know are.
