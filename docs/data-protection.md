# Data protection in a CAPEM centre

This document is for the person who will be responsible, legally and morally, for the people who walk into their centre. It is not a compliance checklist and it is not legal advice. It sets out the reasoning behind CAPEM's data design, so that you can judge whether it is safe enough to use, and so that you can argue your position to someone who outranks you.

The short version: **the people arriving at your centre cannot meaningfully consent to anything, so do not build your data practice on consent. Collect almost nothing, keep it briefly, and make sure that what leaves your centre is counts rather than people.**

---

## 1. Why consent is usually the wrong basis here

The reference standard for this is the ICRC's *Handbook on Data Protection in Humanitarian Action*, third edition, November 2024, published with the Brussels Privacy Hub by Cambridge University Press. Chapter 3 covers legal bases for processing.[^1]

The Handbook's position on consent is grounded in a simple observation about power. Consent is not valid where:

> "the Data Subject has no genuine and free choice, or is unable to refuse or withdraw Consent without detriment" (§3.2.3)

And the problem becomes acute where:

> "consenting to the Processing of Personal Data is a precondition to receive assistance" (§3.1)

On the specific situation of people in crisis, the Handbook notes that a person may lack:

> "a real choice to refuse Consent due to a situation of need and vulnerability, including a lack of alternative to the specific assistance being offered" (§3.2)

Apply that to a real centre. Someone has lost their home. It is raining. Your hall is the only place within walking distance with a dry floor and a working toilet. You hold out a form. Whatever they sign, they were not choosing freely, and everyone in the room knows it. A consent record gathered in that moment documents your process; it does not protect the person.

**One precision, because it is frequently overstated and practitioners will check.** The Handbook does **not** say consent is never a valid basis in humanitarian action. It says consent is often not appropriate, and sets out the conditions under which it fails. There are contexts where consent works: a volunteer signing up to a rota, a donor giving contact details, a survey someone can walk away from without losing anything. Write and speak accordingly. Claiming the Handbook bans consent will cost you credibility with anyone who has read it.

CALP Network material makes the same point in plainer language, and is worth quoting to colleagues who find the legal framing abstract. Amos Doornbos: "It's hard to call it consent when it's a requirement for participation, when there are not meaningful alternatives to digital registration available."[^2] Cite CALP for that ethical framing. The blog does not discuss legal bases, so do not cite it for those.

---

## 2. What to use instead

The Handbook sets out three alternatives. Each shifts the burden from the person receiving help onto the organisation collecting the data, which is where it belongs.

**Vital interest** (§3.3). Processing is justified where it "is necessary in order to protect an interest which is essential for the Data Subject's life, integrity, health, dignity or security."

*What this asks of you:* the processing must genuinely be about protecting that person. Recording that a named individual is diabetic and needs insulin is vital interest. Recording their occupation is not. This basis is narrow by design; it does not stretch to cover a general registration form because some of the fields might matter later.

**Important grounds of public interest** (§3.4). Applicable where the activity is "part of a humanitarian mandate established under national or international law."

*What this asks of you:* an actual mandate. A national Red Cross society, a civil protection agency, a body operating under a statutory emergency framework can rely on this. A parish hall that opened its doors on Saturday morning generally cannot. If your centre is operating under formal instruction from a civil protection authority, note that fact in writing, because it changes which basis is available to you.

**Legitimate interest** (§3.5). Processing that is "necessary for the effective performance of the Humanitarian Organization's mission."

*What this asks of you:* an assessment, before you collect, that weighs what the processing achieves against the risk to the person, and a conclusion that the balance favours processing. This is the basis most improvised centres will actually rely on, and it is not a free pass. It requires you to have thought about it and to be able to say what you concluded. One paragraph in a notebook, dated, is enough to show you did.

The practical consequence for a coordinator: **you decide, in advance, why each field exists and under which basis, and you can defend it.** You do not push that decision onto a frightened person at the door.

---

## 3. What this means for CAPEM's design

These are design commitments, not aspirations. If the software does not hold to them, the software is wrong.

**Minimal fields.** Every field must earn its place against a stated purpose. If nobody can say what decision a field informs, it is removed. The default state of a field is absent.

**Reference IDs, not dossiers.** A person in a centre is a short reference, generated locally, that means nothing outside that centre and that context. It is not built from a name, a date of birth, or a document number, so it cannot be re-derived or cross-matched against another list. The reference lets staff say "bed 14, the family who came in Tuesday" without the system holding a profile.

**Aggregates flow out, records stay.** This is the load-bearing rule. What leaves a centre, to a coordinating body, a dashboard or a donor, is counts: how many people, how many households, how many need infant formula, how much floor space remains. Individual records do not leave the machine they were entered on. Coordination genuinely needs the numbers. It almost never needs the names, and the fact that it would find them convenient is not a reason.

**Short and explicit retention.** Every record has a stated life measured in days or weeks, set when the centre opens, not decided later. Deletion is scheduled and automatic, not a task that depends on somebody remembering during the exhausted week after everyone goes home. A centre coordinator can see, at any moment, what is held and when it goes.

**No national ID or document numbers.** These are the join key that turns a scattered set of local lists into a single searchable population register. Not collecting them is the single most effective protective decision available, and it costs almost nothing operationally.

**No ethnicity, religion, nationality, migration status, or political affiliation.** Fields that have historically been used to target people. In some contexts these are what a hostile actor most wants. Where an operational need is claimed for one of these, the answer is a count with no identifiers attached, never a flag on a person's record.

**No biometrics.** No fingerprints, no facial recognition, no iris scans. A fingerprint cannot be reissued when a database leaks. The convenience does not come close to justifying the permanence.

**The scan is for boxes, not people.** CAPEM's tag mechanism applies to donated containers. A tag identifies what is inside a box and who is expecting it. It is not, and must not become, a token carried by a displaced person. If you find yourself scanning a human being, stop.

---

## 4. What this design does not solve

Anyone claiming a data design removes risk is selling something. These are the failure modes CAPEM does not fix, listed so you can plan around them rather than discover them.

**Pressure to share across organisations.** Within days of a disaster, several bodies will independently ask for your data, each for a defensible reason: deduplication, funding, a needs assessment, a national dashboard. Each request is reasonable in isolation. The combined effect is that data collected in a parish hall for the purpose of running a parish hall ends up in systems whose retention, access controls and future purposes you will never see. Aggregate-only export helps here, and it does not settle it, because the requests will keep coming and some will come from people you depend on.

**Government requests for lists.** In many contexts the state is the primary responder, the funder, and a legitimate partner, and cooperation is right. In some contexts, some of the people sleeping in your hall have reason to fear a specific arm of the state. You may not know which situation you are in until the request arrives. No software setting resolves this. What CAPEM can do is limit what exists to be handed over, so that a compelled disclosure yields less. Data you never collected cannot be demanded. This is the strongest argument for the minimal-fields rule, and it is worth making to colleagues who find the rule inconvenient.

**What happens when the centre closes.** This is the most reliably mishandled moment in the whole cycle. Centres close fast. Volunteers disperse. Laptops go back to whoever owned them, phones get wiped or do not, spreadsheets sit in a personal cloud account for years, printed lists go into a cupboard in a building nobody is responsible for. Scheduled deletion addresses the software. It does not address the exported copy someone made on day three because the internet was down. Decide the closure procedure when you open, write it down, and name the person who executes it.

**Paper has its own exposure.** Falling back to paper is not a privacy improvement, and it should not be presented as one. A clipboard on a trestle table is readable by every person in the queue behind the one being registered. It cannot be access-controlled, it cannot be selectively deleted, it is lost, photographed and copied more easily than a database, and it leaves no record of who read it. Paper is the right fallback when systems fail, and it needs its own physical handling rules: who holds it, where it is stored overnight, who destroys it, when.

---

## 5. Practical guidance for a coordinator

**Before you open.** Write one page: what fields you are collecting, why each exists, which legal basis you are relying on, how long records live, who has access, and who deletes them at closure. Date it. This takes fifteen minutes and is the whole of your defensibility.

**At the door.** Tell people plainly what you are recording and what it is for, in the language they speak. Do this because they are entitled to know, not to obtain a signature. Explain what you are *not* recording, which is often the more reassuring half. If someone declines to give a name, help them anyway and use the reference ID. A person who will not register is a person with a reason.

**During operation.** Keep the number of people with access small and named. Resist adding fields mid-operation because a partner asked; if the field is genuinely needed, apply the same one-page test before adding it. Never let individual records be exported to a spreadsheet "just for tonight". That spreadsheet becomes permanent.

**When someone official asks for "the list".**

Do not refuse on the spot and do not hand it over on the spot. Both are mistakes. Say something like:

> "We keep aggregate figures and I can give you those now: how many people, how many households, what we need. We do not hold a personal list I can share. If you need something beyond the numbers, put the request in writing with the legal basis for it and who is asking, and I will respond."

That sentence does four useful things. It offers real cooperation immediately. It states a fact about your systems rather than a refusal of the person. It moves an in-person demand into a written process, which slows it and creates a record. And it puts the burden of justification where it belongs.

If the request is written, lawful and specific, comply with it and note what you disclosed, to whom, on what date and under what authority. If it is verbal, vague, or the requester will not identify their authority, keep giving them the aggregates. Escalate to whoever has legal responsibility for your organisation rather than deciding alone in a corridor at midnight.

**At closure.** Execute the deletion procedure you wrote on day one. Physically collect and destroy paper. Ask every volunteer directly whether they have a copy of anything, including photographs of a whiteboard or a sign-in sheet, because they usually do and they will not think of it as data. Record that closure happened and who did it.

---

## 6. Further reading

- **ICRC and Brussels Privacy Hub, *Handbook on Data Protection in Humanitarian Action*, 3rd edition, November 2024** (Cambridge University Press). The primary reference. Chapter 3 covers legal bases; read it in full before designing any collection.[^1] Overview: https://www.icrc.org/en/data-protection-humanitarian-action-handbook
- **CALP Network, *Protecting Beneficiary Privacy: Principles and Operational Standards for the Secure Use of Personal Data in Cash and e-transfer Programmes***. The right source for operational detail if your centre handles cash or voucher assistance, which brings in financial service providers and a set of data-sharing questions this document does not cover.[^3]
- **CALP Network, Beneficiary Data Protection theme pages**, for the wider ethical debate about ownership and meaningful choice in digital humanitarian assistance.[^4]

---

## Corrections

This document is written by people building a prototype, not by people who have carried legal responsibility for a shelter population. If your national law, your organisation's obligations, or your operational reality contradicts anything here, we want to know. Open an issue.

---

[^1]: ICRC and Brussels Privacy Hub, *Handbook on Data Protection in Humanitarian Action*, 3rd edition, November 2024, Cambridge University Press. Chapter 3, "Legal bases for Personal Data Processing", sections 3.1 to 3.5. https://www.cambridge.org/core/books/handbook-on-data-protection-in-humanitarian-action/legal-bases-for-personal-data-processing/DF71FB331569DA5B83B60DC925017278

[^2]: Doornbos, A., "Consent and Ownership in the Shift to Digital Cash and Voucher Assistance", CALP Network, 11 November 2019. Cited for ethical framing only; this source does not address legal bases. https://www.calpnetwork.org/blog/consent-and-ownership-in-the-shift-to-digital-cash-and-voucher-assistance/

[^3]: CALP Network, *Protecting Beneficiary Privacy: Principles and Operational Standards for the Secure Use of Personal Data in Cash and e-transfer Programmes*. https://www.calpnetwork.org/publication/protecting-beneficiary-privacy-principles-and-operational-standards-for-the-secure-use-of-personal-data-in-cash-and-e-transfer-programmes/

[^4]: CALP Network, Beneficiary Data Protection. https://www.calpnetwork.org/evidence-and-insights/themes/digital-payments/beneficiary-data-protection/
