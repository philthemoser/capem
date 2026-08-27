# The printed design system

This is the reference for `kit.html`. It exists so that the next person to add a
piece or an icon does not have to reverse-engineer the decisions from CSS.

The system was designed against [`design-brief.md`](design-brief.md) and is
implemented in `src/icones.js`, `src/kit.css` and `src/kit.js`. Where the
implementation departs from the design, it says so below and in a comment at the
site of the change. There are two such places.

---

## The premise

Screens fail in a flood. Batteries die, there is no power to recharge, phones get
wet. Paper keeps working, gets handed to people, gets taped to a door, and stays
readable by lamplight. So printed output is the primary deliverable, and every
printed piece carries its full meaning on the page: **no piece assumes a QR code
can be scanned** — the address, hours and phone number are always readable as
text.

The second premise is that **"do not bring" carries equal weight with "we need"**.
In the 2024 Rio Grande do Sul floods, clothing reached 70% of everything collected
nationally before the postal service suspended accepting it. Telling neighbours
what *not* to send prevents more chaos than any list of needs resolves.

---

## Tokens

| | Hex | Role |
|---|---|---|
| Ink | `#16130F` | Everything black prints to this |
| Prohibited | `#C8102E` | ISO 7010 ring and bar |
| Permitted | `#007A33` | Check mark |
| Warning | `#F2C500` | Reserved, currently unused on paper |
| Rule / mark | `#B8B4AE` | |
| Paper | `#FFFFFF` | |

**Mono is the canonical design; colour is an enhancement layer.** Switching to
mono changes exactly two tokens — `--proibido` and `--permitido` both become the
ink colour — and nothing else. Nothing may depend on colour alone to be
understood: prohibition is *ring + diagonal bar* (a shape), permission is
*ring + check* (a shape). This is the tested case, not the degraded one, because
colour toner runs out first and many centres photocopy.

Ink coverage per A4 piece stays under about 8%. No dark panels, no full-bleed
backgrounds, no reversed-out body text — they drain cartridges, curl the paper,
and cost money a parish does not have.

## Type

**Archivo Black + Archivo**, SIL OFL, embedded in the file as base64 WOFF2
(weights 400/500/600/700/800 plus Black, about 120 KB). Embedded rather than
linked because the tool must work with no network — a linked font means the whole
typographic system disappears in the one situation the tool is for.

Wide grotesque, tall x-height, no hairlines at any weight, open apertures that
stay open through a bad photocopy. Fallback stack:
`Archivo, "Helvetica Neue", Helvetica, Arial, sans-serif`.

Scale: **1 rem = 4.5 mm** (≈12.8 pt) on A4 · ratio 1.25 · A3 pieces use the same
tokens × 1.414. Nothing below 1 rem prints; nothing below weight 500 prints below
1.3 rem. A rule is never thinner than 1.2 mm — below that it vanishes in a
photocopy and disappears entirely on damp paper.

| Token | Size | Use |
|---|---|---|
| display-1 | 24 mm | Centre name |
| display-2 | 12 mm | PRECISAMOS HOJE / NÃO TRAGA |
| lead | 8 mm | Phone number |
| label | 4.6 mm | Item labels under marks |
| body | 4.5 mm | Minimum printing size |

## The 28 marks

One 64 × 64 viewBox, one `<path>`, `fill-rule="evenodd"`, `currentColor`. Solid
silhouettes — no strokes, no hairlines. Minimum limb thickness 6 units (1.4 mm
printed at 15 mm). Optical margin 4 units all round so marks align in a grid.
Subpaths never overlap except where a hole is intended: `evenodd` XORs overlaps,
and that rule is what lets another twenty items be added later without the set
drifting.

16 needs · 4 refusals · 8 utility marks. `tools/kit-test.js` asserts the counts,
that every id is unique, and that every path is valid SVG — an invalid `d` does
not throw in SVG, it silently draws nothing, so the test parses each one through
`Path2D`.

Solid silhouettes rather than fine line drawings because research on
low-literacy audiences finds concrete objects are recognised more reliably as
photographs or solid silhouettes, and because a silhouette survives a bad
photocopy and a wet sheet in a way a 0.5 mm line does not.

### The prohibition container — ISO 7010

Ring of 7/64 of the diameter, bar at 45° from top-left to bottom-right, as in the
standard. The item sits inside at 70%, centred. ISO 7010 was chosen over
inventing a symbolic language because those pictograms are the most extensively
cross-culturally tested visual system that exists, and people already recognise
them from airports, roads and workplaces.

---

## Layout, per piece

Safe margin 10 mm on every A4/A5/A6 piece, 14 mm on A3. No bleed — home and
office printers cannot print to the edge.

### Family 1 — announce

**Door poster** · A4 portrait 210 × 297, usable 190 × 277. Header auto (kind
4.5 mm / name 21 mm Black / hours 7 mm + 9 mm mark) · rule 1.6 mm · PRECISAMOS
flex 1.9 · NÃO TRAGA flex 1.0 at the same head height and weight · footer address
5.4 mm, phone 8 mm, QR 24 mm, link 3.8 mm mono.

The 3→10 item adaptation is done in CSS, no JavaScript:
`grid-template-columns: repeat(auto-fit, minmax(38mm, 1fr))` with
`grid-auto-rows: minmax(0, 1fr)` and a 4 mm / 5 mm gap. A 190 mm column gives at
most 4 tracks (4 × 38 + 3 × 5 = 167 ≤ 190). NÃO TRAGA is fixed at
`minmax(34mm, 1fr)` so 3–4 refusals always sit on one line.

**Street sign** · A3 portrait 297 × 420, usable 269 × 392. Hard hierarchy: name
only, three marks, arrow, contact. Name 34 mm · three marks at a third of the
width each · arrow to 120 mm · rules 2.4 mm. The three marks are the first three
on today's list — priority is list order.

**WhatsApp post** · 1080 × 1350, padding 64, rules 10 px. Name 104 px · heads
56 px · labels 24 px · phone 44 px.

**WhatsApp status** · 1080 × 1920, padding 260 top / 380 bottom / 72 sides. The
WhatsApp interface zones are left empty. Name 120 px · heads 64 px. Same
information as the post — never a crop of it.

**Handbill** · A6 105 × 148.5, padding 10 mm. Name 9 mm · eight marks at 15 mm in
4 columns · four refusals at 15 mm · phone 6 mm · QR 16 mm. 15 mm is the absolute
floor for a mark (minimum stroke 1.4 mm).

### Family 2 — operate

**Bin label** · A5 landscape 210 × 148.5. Mark 70 mm left, word 13 mm Black right.
Frame 1.2 mm, centre name 4 mm at the foot. One word, always singular. It has to
read from 3 m standing over a box on the floor.

**Intake table sign** · A4 landscape 297 × 210, margin 12 mm. Two columns split by
a 1.6 mm vertical rule. PODEMOS (16 mm green check) left with six marks in 3
columns; NÃO PODEMOS (16 mm red ring) right with four in 2 columns; marks 30 mm.
The line that protects the volunteer sits at the foot at 5 mm and is always
present.

**Wayfinding arrow** · A4 portrait, arrow to 150 mm, word 26 mm. The arrow rotates
in 90° steps; the paper never rotates, or the text ends up sideways.

**Hours card** · A5 portrait, CLOSED state in focus. Closed mark 40 mm · state
line 9 mm · hours 7 mm · phone 10 mm.

### Family 3 — carry

**Visit card** · 85 × 55 mm, padding 6 mm. Name 5.5 mm · address and hours 3.4 mm
· phone 6 mm · QR 12 mm. No marks: at 85 mm a mark would compete with the phone
number, and the phone number wins.

**Tear-off poster** · A4 portrait, body 217 mm plus eight tabs of 23.75 × 60 mm.
Only the phone number on the tab, vertical, 4.6 mm — the centre name would not
fit without dropping the phone below 4 mm, and it is the phone the person takes.
Eight tabs is the maximum on A4 before that happens. Cut the tabs before posting:
a tab only tears if it has already been cut.

**Volunteer script card** · A6, padding 10 mm. Four numbered lines at 4.6 mm/1.35.
The last line is the way out. No marks and no red: this one is to be read, not
seen.

### Identification

**Badge** · 90 × 60 mm, padding 6 mm. Role band 8 mm in outline, not in solid —
solid would be eighty filled panels per sheet. Hand-fill line 0.4 mm with a 3 mm
label, shift number in mono. The 4 mm hole is marked in outline, never printed
solid.

**Armband** · 210 × 99 mm. Word 14 mm plus a 30 mm person mark, fold at 25 mm from
each end. 14 mm is the step at which the longest role (COORDENAÇÃO, 12
characters) fits on one line. Readable at 10 m, which is the distance from which
someone looks for whoever is in charge.

---

## Imposition

The general rules:

1. The child must be a whole division of A4 (A5 = 1/2, A6 = 1/4, A7 = 1/8), or a
   grid with a gutter of at least 8 mm when it does not divide (85 × 55 cards).
2. Internal margin ≥ 8 mm on pieces A6 and larger, ≥ 6 mm on cards — cutting with
   scissors has about ±1.5 mm of error.
3. Never a full background: a crooked cut through a dark ground is visible, one
   through a white ground is not.
4. Cut marks 0.4 mm on the sheet edges, never inside the piece.

| Piece | Grid | Sheet margin | Cut marks |
|---|---|---|---|
| Handbill A6, 4-up | 2 × 2, gutter 0 | — | x = 105, y = 148.5, plus an 8 mm centre cross |
| Bin label A5, 2-up | 1 × 2, gutter 0 | — | y = 148.5 |
| Visit card 85 × 55, 10-up | 2 × 5, gutter 0 | x 20, y 11 | x = 20, 105, 190 · y = 11, 66, 121, 176, 231, 286 |
| Badge 90 × 60, 8-up | 2 × 4, gutter 0 | x 15, y 28.5 | x = 15, 105, 195 · y = 28.5, 88.5, 148.5, 208.5, 268.5 |
| Armband 210 × 99, 3-up | 1 × 3 | — | y = 99, 198 |

---

## Where the implementation departs from the design

Two places. Both are recorded here and commented at the code.

### 1. The mark floor is measured, not assumed

The design says: below 26 mm a mark stops reading at two metres, so cap the
poster at ten items. We measured, and the arithmetic does not hold — ten items
only give 26 mm if the centre name fits on one line. *Paróquia São Sebastião*
takes two lines, the header grows about 20 mm, and the ninth mark falls to 18 mm:
a poster that looks full and cannot be read from the pavement.

So the limit is not a number, it is the floor. `ajustarCartaz()` measures the
smallest mark after drawing and removes items until it rises above 26 mm, then
tells the coordinator how many were left out. A centre with a short name gets
ten; one with a long name gets eight. Silently truncating at ten would print a
false promise onto a hundred sheets.

`tools/kit-test.js` asserts the floor — not the item count — for both a one-line
and a two-line centre name.

### 2. The intake sign headings are 10 mm, not 11 mm

At the specified 1.5 : 1 column split, the right-hand column has 88 mm of usable
text width and "NÃO PODEMOS" at 11 mm Archivo Black wraps to two lines. The split
is now 1.4 : 1 and **both** headings are 10 mm. Both, deliberately: giving the
refusal side less weight than the acceptance side would undo precisely what the
piece exists to do.

---

## Adding a piece

1. Add an entry to `PECAS` in `src/kit.js` with `w`, `h`, `un` and an `html()`
   that returns a `.folha`.
2. Add its layout to `src/kit.css` in real millimetres. Never a screen-relative
   unit inside a piece — the paper has no viewport.
3. Run `node tools/kit-test.js`. The overflow and true-measure assertions apply
   to every piece automatically, so a new one is checked without writing a test.

## Adding a mark

Add it to `ICONES` in `src/icones.js` following the six rules at the top of that
file, then map it into `GRUPOS` and `ROTULO_BR` in `src/catalogo.js`. The
catalogue is deliberately anchored to the marks: an item with no mark prints a
generic box, which says nothing to someone who does not read Portuguese, so
free-text items are allowed but the form warns about them.
