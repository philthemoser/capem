# Brief for Claude Design — printed media kit for relief centres

Copy everything below the horizontal rule into Claude Design.

---

I need a design system for disaster relief centres in Brazil — the churches, schools and gyms that become donation points and shelters during floods. A coordinator enters their details once on a phone, and the tool generates **a complete set of printed and shareable material** from that one set of information.

**This is a system, not an artwork.** The content changes daily and per centre, and I will rebuild your design in code as a generator. Please design reusable parts with explicit rules, not finished one-off pieces.

## Why paper matters more than you'd expect

Screens fail in a flood. Batteries die, there is no power to recharge, and phones get wet. Paper keeps working, gets handed to people, gets taped to a door, and stays readable by lamplight. Within a week of the 2024 Rio Grande do Sul floods, 803 shelters were operating, most in buildings never designed for it, many with no reliable power.

So: **printed output is the primary deliverable, not an afterthought.** Every printed piece must carry its full meaning on the page. Never assume a QR code can be scanned — the address, hours and phone number must always be readable as text too.

## The information it is generated from

One centre enters: name, what kind of place it is, address, opening hours, a phone number, an optional web link, a list of **3–10 things needed today**, and a list of **3–4 things not to bring**.

Everything below is generated from exactly that.

## The two messages, of equal weight

1. **PRECISAMOS HOJE** — what we need
2. **POR FAVOR, NÃO TRAGA** — what to stop bringing

The second is the one that matters most and is almost always designed as an afterthought. In the 2024 floods, clothing reached 70% of everything collected nationally before the postal service suspended accepting it. Telling neighbours what *not* to send prevents more chaos than any list of needs resolves. Give it at least equal visual weight — while remembering these are people trying to help, so it must not read as hostile.

## Who reads it

Someone walking past a church door, glancing at a WhatsApp thumbnail on a cracked screen in bright sun, or holding a damp handbill at dusk. Possibly unable to read. Possibly not a Portuguese speaker — Brazil's south has Venezuelan, Haitian and Bolivian communities, and international responders arrive. **Every piece must work with the text ignored entirely.**

---

# What to design

Three families. **Please do them in this order** — if you only finish the first family, that is a good outcome; a shallow pass across all three is not.

## Family 1 — ANNOUNCE (outward facing) · highest priority

| Piece | Format | Purpose |
|---|---|---|
| **Door poster** | A4 portrait | The main one. Taped to the entrance |
| **Street sign** | A3 portrait | Readable from a passing car. Needs a much harder hierarchy — probably only the centre name, two or three icons, and an arrow |
| **WhatsApp post** | 1080 × 1350 | The single most-shared artefact |
| **WhatsApp status** | 1080 × 1920 | Different crop. Heavily used in Brazil, and usually forgotten |
| **Handbill** | A6, **4-up on one A4 sheet** | Handed to people in the street. One sheet of paper produces four |

## Family 2 — OPERATE (inside the centre) · high value, usually missing

Nobody makes these, and sorting donations is the actual bottleneck. Cheap paper solves a lot of it.

| Piece | Format | Purpose |
|---|---|---|
| **Bin / shelf labels** | A5, **2-up on A4** | One item, one giant icon, one word. Taped to the box so volunteers sort without asking |
| **Intake table sign** | A4 landscape | "We can accept these / we cannot accept these" — so a volunteer refusing a donation is backed by a sign and not doing it alone |
| **Wayfinding arrows** | A4, arrow rotatable | "Donations →", "Shelter →". Basic and always improvised badly |
| **Opening hours card** | A5 | For the door when the centre is closed |

## Family 3 — CARRY (leaves with a person) · valuable, lower priority

| Piece | Format | Purpose |
|---|---|---|
| **Pocket card** | 85 × 55 mm, **10-up on A4** | Address, hours, phone, QR. Fits in a wallet |
| **Tear-off strip poster** | A4 with tabs along the bottom | The familiar Brazilian format — passers-by tear off the address and phone |
| **Volunteer script card** | A6 | What to say when declining a donation, kindly. The hardest part of the job, done by someone on their first shift |

---

# Print constraints — please treat these as hard

These decide whether the material actually gets used.

- **A4 is the only size you may assume.** A centre has, at best, a tired office printer. A3 is a copy-shop nice-to-have. Anything requiring special stock will not exist.
- **Must work in pure black and white.** Colour toner runs out first, and many centres photocopy. Nothing may depend on colour alone to be understood — please show a mono version of at least the door poster and the bin label.
- **Low ink coverage.** Avoid large dark fills and full-bleed backgrounds. They drain cartridges, curl the paper and cost money a parish does not have.
- **No full bleed.** Home and office printers cannot print to the edge. Keep a safe margin — assume 10 mm minimum.
- **Imposition, not just layout.** Where a piece is multi-up on a sheet, design the whole A4 sheet including cut marks and gutters. One sheet should yield four handbills or ten pocket cards cleanly with scissors, not a guillotine.
- **Survives being damp.** This is a flood. Paper gets wet and ink runs. Favour heavy strokes and high contrast; avoid hairlines and small reversed-out text, which disappear first. Many centres will slip a sheet into a plastic sleeve or tape it under polythene — a design that still reads through slightly cloudy plastic is a better design.
- **Free fonts only**, or system fonts. This is an open-source tool with no budget.
- **Pretty enough that a centre chooses it over a hand-written sheet of A4.** That is the real bar and it is currently not met.

---

# The icon set

One symbol per item, one consistent style, working with no text at all.

**Start with these sixteen** — they cover most of what a flood response actually asks for:

> drinking water · non-perishable food · infant formula · pet food · cleaning kit · bleach · bucket · broom · hygiene kit · soap · nappies · sanitary pads · sleeping mat · blanket · rubber boots · first-aid kit

**And these four**, which must read as clearly refused:

> used clothing · unsorted mixed bags · perishable food · furniture

**Plus a few utility marks:** an arrow, a clock, a location pin, a telephone, and an "open / closed" pair.

Design the style so another twenty items can be added later without looking foreign. Each icon must survive being printed at **15 mm** on a handbill and blown up to **150 mm** on a bin label.

## A strong recommendation on the visual language

Please build on **ISO 7010 safety-sign conventions** rather than inventing a symbolic language. Those pictograms are the most extensively cross-culturally tested visual system that exists, and people already recognise them from airports, roads and workplaces:

- The **red circle with a diagonal bar** for prohibition is close to genuinely universal, and is the right container for the "do not bring" items.
- **Green** for permitted, **red** for prohibited, **yellow** for warning.
- **Solid filled silhouettes** read better at distance, at small sizes, and after a bad photocopy, than fine line drawings.

If you think something else works better, please say so and make the case — but this approach has the most evidence behind it.

Also worth knowing: research on low-literacy audiences generally finds concrete objects are recognised more reliably as **photographs or solid silhouettes** than as abstract line icons. If you use line icons, keep them literal and heavy.

---

# What I need back

I have to rebuild all of this in code, so please include, **as text on the canvas**:

- **The SVG source for every icon** — single colour using `currentColor`, square viewBox, consistent weight. *This is the thing I most need and the one thing I cannot recover from an exported image.*
- **Every hex code.**
- **The type scale** in relative units, and which free font.
- **Layout rules per piece** — margins, grid, gaps, icon sizes, and how the layout adapts between 3 items and 10.
- **Imposition specs** for the multi-up sheets: positions, gutters, cut marks.

Please also export a PDF of the artboards so I can see the intended result.

---

*Context: this is for CAPEM, an open-source tool for improvised relief centres — github.com/philthemoser/capem. A working but visually plain version exists. You are replacing the design, not the content model.*
