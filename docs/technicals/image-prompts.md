# Image prompts — Urban Furniture

Paste **STYLE + SUBJECT + EXCLUSIONS** as one prompt. The style and exclusion
blocks never change — that constancy is what makes fifteen separate generations
read as one family instead of fifteen unrelated pictures.

Generate at the **highest resolution offered**, then hand the files over; they get
downscaled on the way into the UI, and downscaling is the only direction that
doesn't lose detail.

---

## Specs

| | Tab icons | Login scene | Error / 404 |
|---|---|---|---|
| Aspect | **1:1** | **4:3** (landscape) | **1:1** |
| Displayed at | ~64 px | ~520 px wide | ~260 px |
| Background | pure white `#FFFFFF` | pure white `#FFFFFF` | pure white `#FFFFFF` |
| Blue | `#1068d1` — the app's exact accent | same | same |

> **The single most important constraint for tab icons:** they render at about
> **64 pixels**. One bold object, few lines, no fine detail — an intricate drawing
> turns to mud at that size. The login and error scenes are the opposite: those
> are large, and can carry real detail.

---

## STYLE — paste this first, every time

```
STYLE — follow exactly:
Orthographic technical line illustration of furniture, in the manner of a
cabinetmaker's shop drawing or a patent figure. Drawn with a single uniform
stroke weight, clean and confident, as if inked with a technical pen.
Strictly two colours: one flat blue (#1068d1) for all linework, and pure white
(#FFFFFF) for the background and all negative space. A small number of shapes
may carry a flat 12-18% opacity wash of the same blue to suggest a surface —
never a gradient, never a second hue.
Geometry is exact and architectural: true proportions, parallel edges, honest
joinery, visible construction. Confident empty space around the subject.
Flat, even, shadowless lighting. No perspective vanishing point — orthographic
or gently isometric only.
Calm, precise, engineered mood. The feeling of a well-made object drawn by
someone who understands how it is built.
```

## EXCLUSIONS — paste this last, every time

```
MUST NOT CONTAIN — this is strict:
no text, no letters, no words, no numbers, no digits, no captions, no labels,
no annotations, no dimension lines, no measurement arrows, no leader lines,
no callouts, no legends, no watermarks, no signatures, no logos,
no people, no faces, no hands, no animals, no plants,
no gradients, no drop shadows, no ambient occlusion, no 3D rendering,
no photorealism, no glossy or reflective surfaces, no wood grain texture,
no paper texture, no grain, no noise, no halftone, no stippling,
no background scenery, no room, no walls, no floor line, no horizon,
no colour other than the single blue and pure white,
no green, no red, no orange, no yellow, no purple, no beige, no brown.
```

The exclusion list is long deliberately. Technical-drawing prompts pull *hard*
toward dimension lines and annotation, and the brief here is the exact opposite:
the picture must carry no writing of any kind. "No text" is stated seven ways on
purpose.

---

## SUBJECT lines — one per tab (1:1, keep them bold and simple)

Each line goes between the two blocks above, prefixed with
`SUBJECT — draw exactly this:`

> ⚠️ **The slot is opt-in, not automatic.** `.page-head` is rendered by **44**
> pages, not 18 — every `[id]` detail page and every `/new` form uses it too.
> Wiring the image into `.page-head` unconditionally would put an illustration on
> "New sales order" and on every invoice detail screen, which is decoration
> competing with dense figures. Only the 18 tabs below pass an image; detail and
> create pages pass nothing.

These 18 are the complete nav — verified against `sidebar.tsx`, so the list
cannot silently drift out of step with the menu.

**Shipped so far: 5 of the 18 tabs** — `dashboard`, `sales-order`,
`sale-invoice`, `receipt`, `purchase-order` — plus both scenes (`login`,
`error`). The other 13 tabs pass no image and render a plain heading, which is
a valid state, not a gap to patch. `purchase-bill` was generated but not
shipped: it came back as a second workbench, indistinguishable from
`dashboard`; the crate subject below is the corrected replacement.

> ⚠️ **Every subject must have its OWN silhouette.** This bit us: Dashboard and
> Purchase Bill were both written as "a workbench", and at 112px they were the
> same picture — mean pixel difference 10.9/255, ink coverage 4.2% vs 4.5%. A
> reader glancing between the two tabs sees no difference at all. Before
> generating, check each new subject against the ones already made: a bench, a
> box, a grid, a stack and a chair are five silhouettes; two benches are one.
>
> **Deliberate pairs are the exception**, and they are meant to echo:
> Receipt/Payment are the same cabinet closed and open, Sales Order/Sale Invoice
> the same table with and without its chairs, Analyticals/Analytical Budget the
> same shelving empty and filled. Those read as a relationship. Everything else
> must not.



| Tab | File name | Subject line |
|---|---|---|
| **Dashboard** | `dashboard.png` | A cabinetmaker's workbench seen head-on in gentle isometric view, its surface clear and empty, with a low open rack beneath holding three squared timber boards. Calm and ready. Centred, generous white space. |
| Sales Order | `sales-order.png` | A dining table in gentle isometric view with two matching side chairs tucked beneath it. Simple rectangular top, four tapered legs, chair backs with three vertical slats. Centred, generous white space around it. |
| Sale Invoice | `sale-invoice.png` | A finished dining table in gentle isometric view, standing alone with its chairs removed and set slightly apart to one side, as though just handed over. Centred, generous white space. |
| Receipt | `receipt.png` | A small three-drawer cash cabinet in gentle isometric view, the top drawer closed and flush, the whole piece square and settled. Centred, generous white space. |
| Purchase Order | `purchase-order.png` | A neat stack of five long timber boards resting on two low trestles, seen in gentle isometric view. Boards squared and evenly stacked. Centred, generous white space. |
| Purchase Bill | `purchase-bill.png` | A stout wooden shipping crate in gentle isometric view, lid closed and flush, with visible corner battens and horizontal slat boards across each face. Solid, squarely built and closed. Centred, generous white space. |
| Payment | `payment.png` | A small three-drawer cash cabinet in gentle isometric view, the top drawer pulled fully open and empty. Square proportions, simple bar pulls. Centred, generous white space. |
| Contact | `contact.png` | Two identical armchairs facing one another in gentle isometric view, angled slightly inward as if in conversation, with clear space between them. Centred, generous white space. |
| Product | `product.png` | A single upholstered armchair in gentle isometric view. Square frame, low arms, one seat cushion and one back cushion, four short tapered legs. Centred, generous white space. |
| Analyticals | `analyticals.png` | An open shelving unit in gentle isometric view divided into six compartments of visibly different widths, all empty. The uneven division is the point. Centred, generous white space. |
| Analytical Budget | `budget.png` | An open shelving unit in gentle isometric view with six equal compartments, each holding a stack of flat boards filled to a visibly different height — some nearly full, one overflowing slightly past its compartment. Centred, generous white space. |
| Chart of Account | `chart-of-accounts.png` | A card index cabinet in gentle isometric view. A grid of small square drawers, four across and three down, each with a plain round pull, one drawer slightly ajar. Centred, generous white space. |
| Journals | `journals.png` | An upright desktop document sorter in gentle isometric view: a low flat tray base with three tall thin vertical dividers standing up from it, forming four empty upright slots. A silhouette of vertical fins. Centred, generous white space. |
| Journal Entries | `journal-entries.png` | A single wide flat drawer pulled fully open in gentle isometric view, its interior divided lengthwise by thin runners into many narrow parallel slots, all empty. Centred, generous white space. |
| Balance Sheet | `balance-sheet.png` | Two identical cabinets standing side by side in gentle isometric view, perfectly symmetrical and exactly equal in height and width, with a narrow even gap between them. Centred, generous white space. |
| Profit and Loss | `profit-and-loss.png` | A row of six simple square stools in gentle isometric view at clearly varying heights — rising, dipping lower, then rising higher again — forming an uneven up-and-down line rather than a steady climb. Centred, generous white space. |
| Budget Report | `budget-report.png` | A tall narrow cabinet in gentle isometric view with a long straight measuring rod leaning diagonally against one side, the rod clearly taller than the cabinet. The diagonal is the point. Centred, generous white space. |
| Audit log | `audit-log.png` | A tall archive cabinet in gentle isometric view with six full-width flat drawers stacked evenly, each with a single long bar pull, all closed. Centred, generous white space. |

## Login scene — 4:3, this one can carry real detail

```
SUBJECT — draw exactly this:
A calm, well-composed furniture workshop interior seen in wide orthographic
elevation. A long workbench runs across the lower third, with hand planes and
chisels resting on it in a neat row. Behind it, an open shelving wall holds
stacked timber boards, clamps and a few finished stools. To one side a
half-assembled chair frame stands on a low trestle. Everything is drawn as
precise construction, evenly spaced, calm and orderly, with generous white
space above. Rich in detail but never cluttered.
```

## Error / 404 — 1:1

```
SUBJECT — draw exactly this:
A single wooden chair in gentle isometric view with one leg detached and
resting on the ground beside it, the chair tilting very slightly off balance.
Simple honest construction, clearly repairable rather than broken. Centred,
with generous white space around it.
```

## Empty state (optional shared fallback) — 1:1

```
SUBJECT — draw exactly this:
An empty open shelving unit in gentle isometric view, two upright side panels
and three horizontal shelves, entirely bare. Clean and quiet, waiting to be
filled. Centred, with generous white space around it.
```

---

## When the files come back

Drop them in `frontend/public/img/` using the file names in the table. The
`page-head` slot renders them at a fixed position on every tab, so nothing else
needs changing.

Two things worth checking on the first one before generating the rest:

1. **Pure white background**, not off-white or cream. `.card` is `#FFFFFF`, so an
   off-white image shows a visible rectangular seam inside the card.
2. **Legibility at 64 px.** Shrink the first image right down before approving the
   set — if the object stops reading at that size, the subject needs simplifying
   rather than the prompt needing more words.
