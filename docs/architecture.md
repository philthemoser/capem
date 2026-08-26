# Architecture

This describes how the prototype is built and, more usefully, *why* — including the decisions that would not survive contact with a real deployment.

---

## 1. The spine

The one hard internal contract is a shared reference. Everything else is negotiable.

| Reference | Issued by | Format | Used by |
|---|---|---|---|
| Donation code | Donor app, client-side | `CP-2026-09173` | Intake, inventory, impact feed |
| Household reference | People registration | `PS-2214` | Matching, gate, shelter, case notes |
| Voucher reference | Matching engine | `PS-2214-V3` | Gate, inventory reservation |
| Item code | Item catalogue | `BBF-400` | Everything that touches stock |

Three properties matter more than the format:

- **It works on paper.** Every reference can be written on a box in marker, read aloud down a phone line, or copied onto a wristband. A system that requires the person in front of you to own a working device has excluded the people most likely to need it.
- **It is generated client-side.** A donation code must be issuable with no connectivity, which rules out a server-allocated sequence. In production this implies a signed payload with a centre prefix rather than a global counter — collision handling is unresolved, see §7.
- **It joins, it does not describe.** The reference carries no information about the person. That is a data-protection decision as much as an engineering one.

## 2. Blocks

Five modules, adopted independently:

| Module | Contains | Activation |
|---|---|---|
| **Donations** | Donor pre-registration, intake, walk-in matching, stock | Day one |
| **People** | Minimal registration, shelter occupancy, household records | When people arrive |
| **Matching & distribution** | Entitlement, ranking, allocation, vouchers, the gate | Needs both above |
| **Volunteer operations** | Roster, skills, shifts, coverage | When volunteers outgrow improvisation |
| **Network & command** | Multi-centre view, transfer suggestions, reporting | Automatically at 2+ centres |

The reason for blocks rather than a system: a centre already tracking people on paper should be able to adopt only the piece it lacks. A tool that requires replacing what already works will not be adopted during an emergency, which is the only time it is needed.

**Matching sits alongside the two pipelines rather than inside either.** Donations feeds it stock, People feeds it need, and it feeds fulfilment back to both. It is what the other two are *for*.

## 3. Data model

One scenario object is the source of truth. Everything on screen is derived.

```
Scenario
├── event        { name, detail, region }          — multilingual triples
├── sites[]      { id, name, kind, municipality, connectivity,
│                  independent, capacityM3, shelter{spots,occupied}, slug }
├── needs[]      { site, item, target, priority, published, channels[] }
├── stock[]      { site, item, onHand, min, incoming, reserved, expiring }
├── families[]   { ref, site, size, under5, over65, medical,
│                  sheltered, daysWaiting, received{} }
├── volunteers[] { id, name, skills[], verified, trained[] }
├── shifts[]     { site, template, start, end, slots[] }
├── movements[]  { time, type, item, qty, site, ref, by }
└── cashOptions[], cashRails[], stats{}

CATALOG[]        { code, name[3], unit[3], cat, aliases[], blocked?, batch? }
ENTITLEMENTS[]   { item, per, qty, cap, rule[3], ifSheltered?, ifMedical? }
```

**Nothing is denormalised.** Coverage percentages, alert conditions, event-wide totals and the "who needs what" join are all computed in `Sel.*` at render time. This is the single most important structural decision in the codebase, and the direct answer to the failure mode of the prototype this replaces: numbers typed into markup screen by screen, which drift the moment anything changes and then quietly contradict each other in front of a reviewer.

Deriving everything costs a little performance and buys the guarantee that the coordinator's figure and the donor's figure cannot disagree — which is precisely the claim the "one shared spine" architecture is making. A demo that hard-codes per-screen numbers cannot honestly make it.

**The caseload is generated, deterministically.** Six hand-written households and 312 sheltered people is not a caseload, and a matching engine that never runs out of stock demonstrates nothing. The rest of the population is generated from the site's actual occupancy with a fixed seed, so figures are consistent with the shelter counts shown everywhere else and every reviewer sees the same households. Rationing is the interesting case.

## 4. The matching engine

`src/js/06-match.js`, about 150 lines. Four stages:

1. **Entitlement** — what each household is due under the published rules, minus what it has already received. Rules are data (`ENTITLEMENTS`), not code.
2. **Ranking** — vulnerability and waiting time, scored openly. Factors are *returned*, not folded into a number, so the interface can show the arithmetic.
3. **Allocation** — greedy, in rank order, against `onHand − reserved`. A working pool is decremented as it goes, so the shelf is never over-committed.
4. **Feedback** — the shortfall is emitted as `unmet`, which becomes a published need.

Two commitments are load-bearing:

**Explainability over optimality.** A cleverer algorithm — a proper assignment or flow formulation — would allocate marginally better and be impossible to defend to somebody angry about their place in the queue. In this context that is the worse trade. Allocation nobody can explain is allocation nobody will trust, and a distribution runs on trust or it runs on crowd control.

**Reservation at issue, not at handover.** Stock is committed when a voucher is generated. This costs availability on paper and buys the guarantee that a voucher presented at the gate can always be honoured. A voucher that bounces at the table costs more trust than a slower queue.

Current scoring — deliberately visible in the UI so it can be argued with:

| Factor | Points | Cap |
|---|---|---|
| Children under 5 | 3 each | 9 |
| Adults over 65 | 2 each | 6 |
| Medical need flagged | 4 | — |
| Days since last distribution | 1.5 each | 9 |
| Sheltering at this centre | 2 | — |
| Household size | 0.5 each | 4 |

These numbers are invented. See [open-questions.md](open-questions.md) §2.

## 5. Why one file

`index.html` is about 370 KB, self-contained, and committed to the repository.

The deployment context decides this. A coordinator opens it on a phone on a bad connection, or from a USB stick in a building with none. One file works in both cases, opens from `file://`, survives being emailed, and will still run in fifteen years. A build step that reviewers must execute before they can look at anything is a barrier placed in front of exactly the people whose time is worth most here.

Source stays split under `src/` so it can be read and reviewed, and `build.js` concatenates it. That script has no dependencies and does nothing but join files in filename order — the numeric prefixes are the dependency order. There is no transpiler, no bundler config, and nothing to rot.

The trade is real: no module system, no tree-shaking, global scope, and a bundle that grows linearly. For a production build this would be wrong. For an artefact whose job is to be examined and argued with, it is right.

**Everything runs client-side.** No server, no accounts, no analytics, no network requests of any kind. Nothing a reviewer types leaves their browser, which also means the prototype cannot quietly collect anything about the people evaluating it.

## 6. Accessibility and language

- **Colour never carries meaning alone.** Every status has an icon and a written label, so it survives greyscale printing, colour-blind readers, and a cracked screen in direct sunlight. All three are ordinary field conditions.
- **Navigation does not move under you.** The role list is in a fixed order and never reorders; only the current role's screens expand beneath it. An earlier version promoted the active role to the top and pushed the rest into an "other roles" group, so the menu rearranged itself on every click and nobody could learn where anything was.
- **Mobile-first.** Built and tested at 360px. Below 900px the sidebar becomes a bar naming where you are, which opens a slide-up sheet containing the same tree — eleven roles do not fit in a row of tabs, and the version before that hid navigation entirely, making every sub-screen unreachable on a phone.
- **One theme, light.** A dark variant was dropped. It doubles the surface to verify for a prototype whose job is to be read and argued with, and the field reality it was serving — a phone in bad light — is better served by high contrast than by a dark palette.
- **Verified, not asserted:** `tools/a11y.js` runs axe-core against WCAG 2.1 A/AA across 16 screens in light and dark. Current result: zero violations.
- **All strings are `[en, es, pt]` triples** in one file, so a translator sees source and both targets on one line. Currency and number formatting follow the scenario's locale — COP in Colombia, BRL in Brazil. `tools/check-i18n.js` proves no key is missing and no row lacks a language.

Portuguese is not decoration. The strongest field evidence for this design is Brazilian, and a platform that works in one country is not a platform.

## 7. What this architecture does not solve

Stated plainly, because these are the parts that would bite in a real deployment.

**Offline conflict resolution.** The store queues writes and replays them on reconnect. That is honest for a single centre. Two centres editing the same stock offline, with conflicting writes, is a genuine distributed-systems problem and nothing here addresses it. Whether it matters depends on whether centres share stock in practice — which we do not know.

**Client-side reference collisions.** Codes must be issuable offline, so they cannot come from a server sequence. A centre prefix plus a signed random payload probably suffices, but "probably" is not an answer and the failure mode — two donations sharing a code — is silent and ugly.

**Authentication.** There is none. Donors are anonymous by design, but field and coordinator roles obviously need identity in production, and adding it is where "no account required" starts fighting "know who booked this stock in".

**Multi-centre trust.** The network screen is deliberately read-only about other centres' stock. The literature is consistent that interoperability between independent organisations fails for organisational and legal reasons far more often than technical ones, and a shared database between unequal partners is a power arrangement, not an integration. A shared *standard* is the right shape; nothing here implements one.

**Production stack.** If this were built for real: PWA with a service worker, a modular monolith backend with boundaries mirroring the five blocks, PostgreSQL, payments behind an interface (Wompi/PayU for PSE and Nequi in Colombia; a Pix provider in Brazil), and a WhatsApp Business API adapter with copy-to-clipboard as the zero-integration fallback. None of that is written, and none of it is the hard part.

The hard parts are in [open-questions.md](open-questions.md), and none of them are technical.
