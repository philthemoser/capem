# Open questions

These are the decisions that cannot be made from a desk. Each has a plausible answer built into the prototype and no evidence behind it.

If you have run a relief centre, a donation drive, or a shelter, this is the page where your disagreement is worth most. Everything else in this repository is easier to argue about and matters less.

---

## 1. Will donors actually pre-register?

**The design assumes** a stranger will do sixty seconds of unpaid administration before an act of generosity, at home, before setting off.

**Why that might be wrong.** Giving is often impulsive and emotional. The moment someone decides to help is not obviously the moment they want to fill in a form, and the form arrives before any reward. If only a small fraction pre-register, the intake screen is a slower version of what centres already do, and the entire differentiation collapses.

**What would settle it.** One ordinary donation drive run twice — with and without the QR poster — counting the ratio of pre-registered to walk-in arrivals. This does not need a disaster, which is precisely why it is the first thing that should be tested.

**What we would accept as a kill signal.** Under roughly 15% pre-registration in a motivated, well-publicised drive.

---

## 2. Is the allocation ordering defensible in a real queue?

**The design assumes** that scoring households by children under five, adults over 65, a medical flag, days waiting and household size produces an order people will accept.

**Why that might be wrong.** Those weights are invented. They look reasonable on a screen. Whether they survive contact with a hundred people who each have a good reason to be first is a different question, and the answer is probably local: what counts as vulnerable, and who is allowed to say so, varies by community and by who is watching.

There is also a structural problem we have not solved. The ranking rewards waiting, which is fair, but it also means a household that misses a distribution is pushed up next time — and a household that is served drops to the bottom. Over several rounds that may produce oscillation rather than fairness.

**What would settle it.** A coordinator who has run distributions telling us which factor is missing, and which one they would never defend out loud.

---

## 3. Does a three-minute course produce a competent volunteer?

**The design assumes** that a short course running inside the live screens, explaining reasoning rather than buttons, beats a manual nobody reads.

**Why that might be wrong.** It might produce *false confidence* instead, which at an intake table is worse than admitted ignorance. Someone who knows they do not know asks. Someone who completed a course and has a badge may not.

**What would settle it.** Somebody who trains volunteers telling us what three minutes can and cannot carry, and whether a completion badge should gate shift assignment at all.

---

## 4. What breaks when two centres edit the same stock offline?

**The design assumes** queue-and-replay is sufficient. For one centre it is.

**Why that might be wrong.** Two centres editing shared stock while disconnected, with conflicting writes, is a genuine distributed-systems problem. This prototype does not attempt it. Naive last-write-wins would silently lose a stock movement, which in this context means goods that exist in the system and not on the shelf — the failure that destroys trust in an inventory permanently.

**What would settle it.** Knowing whether it matters. If centres rarely share stock in practice — and the evidence that independent centres mostly operate on their own resources suggests they might not — this is a problem we can decline to have rather than solve.

---

## 5. Who is liable when the software is wrong?

**The design assumes** this is somebody else's problem.

**Why that might be wrong.** A voucher issued against stock that turns out to be miscounted sends a family away empty after being told to come. In a volunteer-run centre with no legal entity behind it, it is entirely unclear where that lands — on the parish, on the volunteer who booked the stock in, on the tool, or nowhere. "Nowhere" is not reassuring; it usually means it lands on whoever is standing there.

**What would settle it.** Anyone who has dealt with the legal structure of an improvised shelter explaining how this normally works, and whether introducing a system that makes promises changes it.

---

## 6. Should money and goods share one flow?

**The design assumes** yes, because a donor experiences it as one act of giving and splitting it doubles the friction.

**Why that might be wrong.** Money brings financial controls, fiscal sponsorship, reconciliation and fraud exposure that goods do not. A small centre may reasonably refuse to touch a tool that handles money at all — and merging them may make the whole thing unadoptable for the exact customer it targets.

**What would settle it.** Whether a small centre would install this if it handled money, and whether they would install it *only* if it did not.

---

## 7. Is a QR the right artefact?

**The design assumes** a scannable tag on the container is what makes intake fast.

**Why that might be wrong.** It presumes a charged phone, a working camera at the door, adequate light, and a donor comfortable with all of it. The fallback — writing the code by hand — works, but then the tag stops being machine-readable and the speed advantage, which is the entire justification, disappears.

**What would settle it.** What people at your centre already carry, and what they are already willing to do. Not what they could be trained to do.

---

## 8. Why did Aidmatrix / NDMN fail?

**The design assumes** we are doing something meaningfully different from the National Donations Management Network, which offered donor-side pre-registration at the level of the offer and is now defunct.

**Why that might be wrong.** We do not know why it failed. If it failed because donors would not pre-register, question 1 is already answered and the answer is no. If it failed for funding, governance or procurement reasons, that is a different lesson and possibly a more survivable one. We are currently guessing, and building on a guess.

**What would settle it.** Anyone who used it, built it, or watched it wind down.

---

## How to respond

Open an issue in **English, Spanish or Portuguese** — whichever you would rather write in. There are templates for field experience, factual corrections, and data-protection concerns, but a plain description of what you saw is more valuable than a well-formatted one.

We would rather be corrected than believed.
