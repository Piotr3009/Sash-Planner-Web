# CLAUDE.md — TURN 65 · PBI: THE EMPTY ROOM, THE BAYS, AND WHAT THE CARCASS WEARS

Run autonomously. Zero questions, zero stops. Skip-and-note. PR before morning.
Full suite, never `--silent`. Frames under `verify/t65/`.

## THE LAW OF THE TURN

**1:1 = COPY.** Where PRO has it, copy PRO's file, repoint imports, change only
the skin (T62/T63 method, proven). Never re-invent in "retail language".

**The lazy client.** Every step has its answer already chosen. NEXT always
works. "More options" for the picky.

**The right panel is the selected element, nothing else.** The owner:
*"w menu prawym powinny się pojawiać tylko menu funkcyjne danego elementu,
dokładnie te które już są. Po naciśnięciu na inny element menu się zmienia,
a jak naciśniesz w szafę lub poza menu — znika."*

## THE THREE DECISIONS MADE HERE

The owner ordered the spec with three questions open. Decided, one line each,
overturnable with one word:

1. **A gap of 100 mm or less to the ceiling is closed by the CORNICE growing**,
   not by a top infill — the owner said the cornice reaches the ceiling.
   Top infill stays a manual choice. *(Overturn: "top infill zamyka".)*
2. **A large gap (over 100 mm) is left alone.** No proposal, no nagging. ADD
   TOP BOX sits in EXTRAS if the client wants it. *(Overturn: "proponuj top box".)*
3. **No wardrobe is placed by the app at all.** The owner: *"ściana 4000 mm,
   ale bez szaf"*. WHERE gives a 4000 mm wall and an empty room; the client
   adds the first wardrobe himself — from the plus on the empty floor, or from
   ADD A WARDROBE in the step. Default width when he does: **1200**, or the
   wall if it is narrower. *(Overturn: "stawiaj pierwszą szafę".)*

---

## WHAT IS FROZEN

1. **PRO — zero bytes**: `index.html`, `src/App.jsx`, `src/main.jsx`,
   `src/components/**`, `src/pages/**`. Freeze test green, unedited.
2. **`reference/lisp/**`** — parens 14/14 at 0/0. **LISP IS LAW**: any change
   to cut geometry goes into `reference/lisp/` FIRST, then the engine. F5 and
   F6 below touch cut geometry; both follow that order or they are skipped.
3. **The six goldens stay byte-identical.** Every engine change tonight must
   be reachable only through a parameter the golden fixtures do not set, or
   through a new code path they never enter. A change that would move a golden
   is not made: skip that ONE feature, name the fixture and the line, and go
   straight on to the next feature. **The session never halts.** "Stop" in this
   file always means "stop that feature", never "stop the night" — there is no
   condition tonight under which the run ends early or waits for the owner.
   Never re-bless a fixture.
4. **The copies from T62/T63 stay copies**; their fidelity tests stay green.
5. **The layout is not rebuilt.** Variant B stands. Column widths change (F3);
   nothing else moves.

## LICENSED ENGINE FILES

Only these, only for the named purpose, each with `UNNAMED=0` and the goldens
proving nothing else moved:

- `src/engine/endPanelAuto.js` — F6, the wardrobe's own step rule.
- `src/engine/cabinet.js` — F5 (the shelf that caps an overlay stack) and F7
  (the partition standing on that shelf), both narrow.
- `src/engine/profile.js` — F8's cornice defaults only, as new keys.

Anything else: skip-and-note.

---

## F1 · THE ROOM STARTS EMPTY

Owner: *"usuń szafę default"*.

- `startDesign` no longer adds a WARDROBE. The room mounts empty.
- **Nothing is placed automatically, ever.** WHERE ends with a 4000 mm wall
  (the default wall width) and an EMPTY room. The client places the first
  wardrobe: the plus on the empty floor, and an ADD A WARDROBE action in the
  step itself, both calling one store path. Its width when added:
  `min(wallLength, 1200)`.
- The empty room is a first-class state, not an error: the stage shows the
  room with its walls and ceiling, the hint says what to do, and the steps
  after WHERE stay reachable but say plainly that they need a wardrobe.
- `fitWardrobeToWall` — T64's "fills the wall" — is **deleted**. It is what
  produced a 3920 mm carcass with two 1960 mm leaves. Licensed removal.
- Default wardrobe width in the profile: **1200 max by default, no hard
  block** (owner: *"nie dawaj blokady na szafy szersze ale default daj 1200
  max"*). The client may type wider; the engine's existing clamps still refuse
  what the room refuses.
- Every screen that assumed a wardrobe exists must survive an empty room:
  READ each caller of the adapter's wardrobe readers and give it an empty
  state, never a crash. The estimate page with zero items already has one.

**Proof**: `verify/t65/f1-*.png` — the empty 4000 mm room at WHERE and still
empty at NEXT; the client's first wardrobe at 1200; the same on a 900 wall
(900, not 1200); INSIDE with no wardrobe, saying so.

## F2 · THE WHOLE LIGHTING RIG, COPIED — NOT JUST THE SLIDER

Owner: *"retail jest za jasna … zapomniałeś o natężeniu naświetlenia — kopia
identycznie jak w PRO, włącznie z ustawieniem jasności etc."*

This is wider than a control. `profile.appearance.studio` holds ELEVEN named
numbers, and one of them is the owner's own decision of 25.08.2026 —
`baseGain: 0.75`, quoted in the profile: *"teraz 100 to niech będzie jakby
teraz było 75"*. If retail's scene is brighter than PRO's, retail is not
reading the same rig.

- **Find every lighting number retail resolves** — walk `src/3d/Scene.jsx` and
  the retail mount, and list what each reads: `baseGain`, `ambient`, `key`,
  `fill`, `rim`, `exposure`, `shadowPadding`, the showroom `band`, the spots,
  the environment probe, the tone mapping. Print PRO's value and retail's value
  for each, side by side, in the PR body.
- **Every difference is closed in retail's favour of PRO's number**, except a
  difference that is deliberate and named in the code with a reason. There
  should be none; if there is, name it and keep it, saying why.
- The environment probe stays OFF in both — the profile explains at length why
  (a tinted probe shifts white fronts). Do not "improve" it.
- **Copy PRO's BRIGHT slider** into the retail top bar (`TopBar.jsx`, T26):
  same `uiStore.brightness`, same min/max/step/default from
  `profile.appearance.studio.brightness`, PBI skin. It is a slider in PRO and
  stays a slider here — the no-slider rule is about dimensions, not light.
- A test that asserts, number by number, that the retail rig equals PRO's.
  That test is the thing that stops this drifting again.

**Proof**: `verify/t65/f2-*.png` — the slider in the bar; the SAME scene
rendered in PRO and in retail at the same brightness, side by side, plus the
number-by-number table in the PR body.

## F3 · COLUMN 2, TEN PER CENT NARROWER

Owner: *"może na początek 10 procent zrób"*.

- Measure the OPTIONS column today, take 10% off, hand the space to the stage.
- The scale law (one number from window width) still governs; this is a change
  to the base width, not a new mechanism.
- **Check before, not after**: at 1280 and 1440, no label in the copied
  `MaterialChoicePanel` or `FrontStyleGallery` may clip or break word-by-word.
  If one does, keep the 10% and fix the copy's own `pbi-re-*` widths — never
  the copy's markup. If it cannot be fixed without touching markup, take 5%
  and say so.

**Proof**: `verify/t65/f3-*.png` — before/after at 1280 and at 1440.

## F4 · THE VIEW: STRAIGHT ON AND CLOSER, AS IN PRO

Owner: *"default ustawienie sceny pokoju prosto i bliżej — dokładnie jak w
PRO"*.

- Read PRO's default camera (`src/3d/cameraPresets.js` and whatever PRO's
  first-mount uses) and make retail's first view and RESET VIEW identical to
  it: same preset, same framing distance, same target.
- This supersedes T64's "FRONT, framed to bounds" — PRO's number wins.

**Proof**: `verify/t65/f4-*.png` — PRO and retail first views side by side.

## F5 · THE SHELF THAT CAPS AN OVERLAY STACK — SETBACK 0

Owner: *"półka nad overlay drawers nie powinna mieć setback, powinna być na
0"*; only that shelf, not every shelf; and the reason, which is why this is
not cosmetic: *"jak dodasz szuflady to jest dziura i to wygląda okropnie"*.
A 20 mm slot above a drawer stack, seen from the front. It must go.

- `profile.shelfDepthClearance` is 20 and EVERY shelf reads it. **Do not change
  it.** Narrow the change: the shelf that caps an overlay-drawer stack gets
  clearance 0, every other shelf keeps 20.
- Find where that shelf is emitted (`cabinet.js`, the overlay path — read
  `setbackOf(item?.front_mm, C.shelfDepthClearance)` at both sites and see
  which one caps a stack). Add the exception at that site only, named, with
  the owner's sentence in the comment.
- **LISP FIRST.** This is cut geometry: the shelf's depth changes, so the
  wardrobe kit in `reference/lisp/` states it before the engine does. Parens
  re-verified.
- The goldens must not move: check whether any of the six carries an overlay
  stack. If one does, the change WILL move it — stop, skip-and-note, and say
  which fixture and why.

**Proof**: a unit test asserting the capping shelf's depth equals D − boards·G
(no clearance) while a plain shelf keeps the 20; the goldens unmoved.

## F6 · END PANELS: NO CARCASS SIDE IS EVER LEFT SHOWING

The owner, and this sentence is the whole law:

> *"po prostu nie dopuszczamy do pozostawienia boku szafy / carcasa
> widocznego."*

Not "a step demands a panel" — **visibility demands a panel**. One rule, and
it covers the kitchen and the wardrobe both; they only look different because
what exposes a side differs:

| Beside the side | Panel? | Why |
|---|---|---|
| nothing — a free end | **yes** | the whole side shows |
| a wall | **no** | the wall covers it; the infill closes the gap |
| a wardrobe, flush — same height, same depth, same offset | **no** | the neighbour covers it |
| a wardrobe of different height, depth, or set back | **yes** | part of the side still shows |
| the client added one by hand in EXTRAS | **yes, permanently** | his decision outranks the automat |

- `endPanelAuto.js` already computes SITES first and filters after (T51, the
  owner's *"dojeżdżam — panel się pojawia, nie dojeżdżam — panel znika"*).
  Keep that architecture. Replace the question it asks with the one above:
  **is any part of this side visible?** Read the neighbour's height, depth and
  front offset; a side is covered only when the neighbour covers it fully.
- One function answers it, for kitchens and wardrobes alike. If the kitchen's
  present behaviour is a special case of the new question, it keeps working
  unchanged and a test proves it. If it is NOT — if the visibility rule would
  change a kitchen's panels — do not force it: keep the kitchen path as it is,
  add the wardrobe path beside it in the same function, and say so in the PR
  body with the case that differed.
- **Retail adds them automatically, each removable.** PRO's law
  (*"Plinth, top infill and end panels — added, never assumed"*) is
  deliberately NOT changed for PRO. Panels appear as lines in the estimate so
  the client sees what he pays for.
- A panel added by hand in EXTRAS is permanent: the automat never removes it.
  `declinedSides` holds the opposite already — add the matching "asked for"
  set beside it, same shape, same file.

**Proof**: `verify/t65/f6-*.png` — one wardrobe alone, panels both ends; a
flush neighbour arrives and the shared panel goes; a taller neighbour arrives
and it stays; a deeper neighbour, it stays; against a wall, no panel and an
infill instead; a hand-added panel surviving a flush neighbour.

## F7 · BAYS, IN THE CLIENT'S WORDS

Owner: *"zamiast vertical partition dać BAYS i wpisz ilość, max 3"* · *"i
wtedy dopiero informacja o tym że bays można zrobić niższe ale półka musi być
fix"* · *"przegroda ma się zaczynać nad szufladami … na półce … pamiętaj starą
zasadę: materiał nigdy nie wchodzi w materiał"*.

- In INSIDE, the row named "Vertical partition (divider)" becomes **BAYS**,
  with a typed count, default 1, **max 3**. Writing 3 puts two partitions in;
  writing 1 takes them out. The partitions are the engine's own — this is a
  name and a counter over the existing law, not a second law.
- After a count above 1 is set, one line appears: bays may be different
  heights, but the shelf between them is fixed. PRO's own wording if it has
  one; otherwise that sentence.
- **A partition inside a bay that holds an overlay drawer stack starts ON the
  shelf that caps the stack** — whether the stack is 2 drawers or 5. It does
  not pass through the stack, and it does not start at a fixed height. Material
  never enters material.
- Doors do NOT follow from bays (F9).

**Proof**: `verify/t65/f7-*.png` — BAYS at 1, 2, 3; a partition standing on a
5-drawer stack's shelf; the sentence.

## F8 · CORNICE, TOP INFILL, END PANELS — THE MENU PRO HAS AND RETAIL NEVER GOT

Owner: *"nie widzę przycisków: top infill, cornice, panels"*. They live in
`src/components/ContextMenu.jsx` (334 lines) — the one surface the T63 ledger
listed as OWED and the reason none of them are reachable.

- **COPY** `ContextMenu.jsx` into `src/retail/design/detail/`, by the method:
  verbatim, imports repointed, recursive component copies, skin only. It brings
  cornice, top infill, end panels and the bottom mask with their refusals.
- Entry: the wardrobe's own menu on the right, and the same actions offered in
  EXTRAS on the left where they are choices rather than edits.
- **Cornice is automatic at 40 mm** (new profile keys, defaults only).
  When the gap to the ceiling is **100 mm or less, the cornice grows to close
  it**, automatically, removable (decision 1). A visual choice of **40 / 70 /
  100** sits beside it.
- Gaps over 100 mm are left alone (decision 2).

**Proof**: `verify/t65/f8-*.png` — the copied menu; a 40 mm cornice; a 80 mm
gap closed by the cornice; the 40/70/100 chips; the estimate showing the
panels and cornice as lines.

## F9 · ADD DOORS, AND ADD TOP BOX MOVES LEFT

Owner: *"drzwi to osobna decyzja, w extrasach lub w setup"* · *"ADD DOORS —
i tu i tu chyba"* · *"add top box powinno być przeniesione do EXTRAS po lewej"*.

- **Doors do not follow from bays.** ADD DOORS is its own action, offered in
  **EXTRAS on the left** and on the **selected wardrobe on the right**. Both
  call the same store path — one law, two doors to it.
- **ADD TOP BOX moves out of the wardrobe's right-hand menu into EXTRAS on the
  left.** Adding furniture is a step; editing an element is the right panel.

**Proof**: `verify/t65/f9-*.png` — ADD DOORS in both places, one store call;
ADD TOP BOX in EXTRAS and gone from the right.

## F10 · THE RIGHT PANEL OBEYS ONE SENTENCE

Owner: *"po naciśnięciu na inny element menu się zmienia, a jak naciśniesz w
szafę lub poza menu — znika"*.

- Click an element → its menu slides in. Click a different element → the menu
  **swaps in place**, the panel does not close and reopen. Click the wardrobe
  body or empty stage → it slides out.
- The plus in the middle of a wardrobe **hides while the INSIDE menu is open**
  (owner's point 5) — two doors to the same act confuse.
- `TieRackMenu`, `TrouserMenu` and `KitMenu` are empty today: an element with
  no controls is not clickable (the standing T60 law). Either give each the
  controls PRO's editor has for it, or make it unclickable with the engine's
  reason. Name which you did, per element.

**Proof**: `verify/t65/f10-*.png` — element A open, element B swapping in,
empty stage clicked and gone; the plus hidden with INSIDE open.

---

## TESTS AND PROOF

1. Full suite green, never `--silent`. PRO freeze test green, unedited.
2. **Goldens ×6 byte-identical** — the hard gate this turn, because engine
   files are licensed. `verify/t65/t65-classify.mjs` names every engine delta
   and proves none reaches the cut path of a fixture.
3. `computeCabinet()` vs LISP exact; `UNNAMED=0`; parens 14/14 at 0/0, with
   the wardrobe kit re-verified after F5.
4. Boundary and copy-fidelity tests green; the new `ContextMenu` copy added to
   the fidelity list with every label PRO's file carries.
5. New tests: an empty room mounts and every screen survives it; the first
   wardrobe is `min(wall,1200)`; the capping shelf has zero clearance and a
   plain shelf 20; a flush neighbour removes a panel and a deeper one does not;
   a hand-added panel survives; BAYS 1/2/3 and the partition standing on the
   stack's shelf; the cornice closing a ≤100 mm gap; ADD DOORS from both places
   calling one store path; the right panel swapping without closing.
6. Playwright walk: every F's frames, plus a lazy-client run from the empty
   room to ADD TO MY ESTIMATE, `verify/t65/lazy-01.png …`.

## LICENSED REMOVALS

- `fitWardrobeToWall` and its callers (F1).
- The default WARDROBE in `startDesign` (F1).
- ADD TOP BOX from the wardrobe's right-hand menu (moves, F9).
- Nothing else. Tombstones two lines maximum.

## BALANCE

Per F: files touched, lines added/removed, and the PRO file each copy came
from. Then one line each:
- How many functions decide where an end panel goes? (One.)
- How many store paths add a door? (One.)
- Which engine lines changed, and why each cannot reach a golden.
- Which of the three decisions above did the night rely on, and where.

## SKIP-AND-NOTE ORDER

F5 → F6 → F8 → F7 → F9 → F10 → F4 → F3 → F2 → F1.
F1 and F10 are the owner's plainest orders and are not skipped. F5 and F6
touch cut geometry and the engine: if either cannot be done without moving a
golden, it is skipped with the fixture named — that is the correct outcome,
not a failure.