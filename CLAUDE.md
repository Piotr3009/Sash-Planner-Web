# CLAUDE.md: TURA PC · FIRE DOORS v1 (internal door sets FDR / DR, leaf + frame, machining, bSuite rows)

This file is the brief for ONE tura in this repo (`Piotr3009/Sash-Planner-Web`, Production Core, "PC"). If your session was started for a different task, ignore this file.

Workshop sources for this tura are in `docs/handover/fire-doors/`. Read `docs/handover/fire-doors/WORKSHOP-NOTES.md` first: it holds every number the owner gave, the reading of his bSolid master and the old Weeke programs.

---

## RAMKA DLA PIOTRA (owner box, binding)

Piotr czyta tylko tę ramkę przed startem. Reszta pliku mówi to samo po angielsku, ze szczegółami. Ustalenia z rozmowy 27.10.2026. Punkty ZAŁOŻENIE to moje domyślne odczytanie tam, gdzie nie było odpowiedzi: tura zapisuje je jako klucze profilu w Window Settings · Fire Doors, więc rano zmiana to liczba, nie przeróbka.

**Co budujemy**
1. Nowy typ w PC: `firedoor` (drzwi wewnętrzne, zestaw skrzydło + futryna). Osobny od `door` (drzwi zewnętrzne zostają nietknięte). Nowe repo NIE.
2. ZAŁOŻENIE: jeden typ z przełącznikiem Fire. Fire ON = numer `FDR-01`, `FDR-02`…; Fire OFF = `DR-01`… Numer podpowiadany, do nadpisania.
3. Fire ON: ocena FD30 albo FD60. FD30 = skrzydło 44, FD60 = skrzydło 54 (makro ma warunki na 44 i 54). Fire ON włącza: zawiasy Fire, zamek FD30/FD60, zaczep FD30/FD60, intumescent, szybę ogniową w VP, zamykacz domyślnie TAK. Fire OFF: zawiasy standard, zamek standard, bez intumescent, zamykacz domyślnie NIE.

**Co wpisuje użytkownik (konfigurator)**
4. Szerokość skrzydła: podpowiedzi 626 / 686 / 726 / 762 / 826 / 838 / 926 / 1056 (klik wstawia), pole wolne, BEZ blokady. Wysokość skrzydła: podpowiedź 2040, pole wolne.
5. Strona zawiasów Left / Right, kierunek otwarcia, grubość ściany = głębokość futryny (podpowiedzi 100 do 200, domyślnie 100, pole wolne).
6. Zamek: Latch (standard) / Sashlock euro / Bathroom. Zamykacz (concealed closer) tak / nie. Vision panel: lista stylów z makra bSolid albo Custom. Kolor / wykończenie jak w innych typach. Podgląd 3D.
7. Reszta jak przy oknach: listy, zamówienia (Assign Materials, BOM), Pre-Cut, Cut List, rysunki, pack, wycena, eksport na maszynę.

**Futryna (rama)**
8. Drewno 63 grube, obrabiane na 50. Szerokość drewna = głębokość futryny (100 do 200). ZAŁOŻENIE: naddatek na szerokość 5 mm (klucz profilu).
9. Przylga frezowana z litego (bez listwy przyklejanej): 15 szeroka (12 zakładki + 3 luzu) x (grubość skrzydła + 3) głęboka, czyli 47 przy 44. Od zewnątrz widać 35, od wewnątrz 50 (jak w LSP).
10. Luz skrzydło do futryny: 3 z boków i u góry. ZAŁOŻENIE: 5 nad podłogą (jak w LSP), klucz profilu.
11. Wymiary zewnętrzne futryny: szerokość = skrzydło + 76, wysokość = skrzydło + 43. ZAŁOŻENIE: narożniki górne na ucios 45 (jak rysuje LSP).
12. Elementy futryny: HEAD, JAMB HINGE (zawiasowy), JAMB LOCK (zamkowy). Na jambie zawiasowym gniazda zawiasów na tych samych wysokościach co w skrzydle (+3 luzu u góry). Na jambie zamkowym zaczep (keep) naprzeciw zamka.

**Zawiasy, zamek, zaczep: PC liczy dokładnie tak jak makro Master_Door_PIOTR**
13. Zawiasy 3 na skrzydło, długość 102. Reguła makra: górny 150 od góry skrzydła, dolny kończy się 200 od dołu, środkowy równo pomiędzy. Skrzydło 2040: 150 / 944 / 1738 od góry (do górnej krawędzi zawiasu). ZAŁOŻENIE: górny koniec deski w makrze = góra drzwi; sprawdzisz w bSolidzie.
14. Gniazdo zawiasu: ZAŁOŻENIE 103 x 30 (płyty +1 mm, Twoja zasada), głębokość 3, rogi R6 (frez 12). W starych programach Weeke głębokość była 3.2 / 4 / 4.2: to jest klucz profilu.
15. Zamek DIN (z Petrosa): czoło 235 x 24 frezowane 236 x 25, końce pełny promień; kaseta 85 w głąb x 150 wys., wpust 17 szeroki; backset 60; klamka (spindle) 1000 od dołu skrzydła; euro 72 pod klamką, bathroom 78. Latch = ta sama kieszeń, bez otworu na wkładkę.
16. Zaczep w jambie zamkowym: 175 x 39 frezowany 176 x 40, środek ZAŁOŻENIE 15 pod klamką (z wyrażeń makra), plus kieszeń na zapadkę i rygiel.
17. Zamykacz: wiersz w zamówieniu i flaga do eksportu. Wymiarów kieszeni nie mamy (makra Weeke `concealed_closer_*.mpr` nie ma w plikach): tura NIE frezuje zamykacza, wpisuje do BLOCKERS.
18. Intumescent: w skrzydle (robi go makro, styl INTU_STYLE jak w makrze, domyślnie 1 = 15 x 4). W zamówieniu w metrach: 2 x wysokość + szerokość na pasek.

**Eksport na maszynę**
19. bSuite: na każde drzwi 4 wiersze `.ewlist`: FD_LEAF, FD_HEAD, FD_JAMB_HINGE, FD_JAMB_LOCK, Label = numer drzwi. Zmienne mają NAZWY Z MAKRA 1:1 (HAND, HINGE, LOCK, LOCK_H, EURO, KEEP, INTU_STYLE, VP_STYLE, C_VP_*...). Lista sortowana: skrzydła, potem nadproża, potem stojaki.
20. Programów futryny (5-osiowe) jeszcze nie ma: brak ścieżki = wiersz pominięty z komunikatem, nie błąd. Do tego plik obróbki neutralny (CSV + JSON): każdy element i każda operacja z pozycją, dla programisty ramy na 5 osi.
21. Uwaga: master skrzydła ma dziś tylko LPX / LPY / LPZ jako zmienne dokumentu. Reszta to parametry wewnątrz makra. Żeby wiersz z PC sterował zawiasami i zamkiem, w masterze trzeba dodać zmienne dokumentu o tych samych nazwach i podpiąć je w makrze. To robisz Ty w bSolidzie; tura tylko pisze listę.

**Nie ruszamy**: typ `door`, partition, casement, sash, eksport bSuite ram casement, PSW. Drzwi podwójne (KIT_DOOR_DOUBLE) = następna tura.

If anything below seems to conflict with this box, the box wins. If the box itself is unclear for a case you meet, do not guess: skip that case and write it in `BLOCKERS.md`.

---

## 0. Why this tura exists

The owner makes internal timber door sets (FD30 / FD60 fire doors and non-fire internal doors). The leaf is machined on the Biesse Rover by his bSolid master `FD_LEAF_MASTER_PIOTR.bSolid` (macro `Master_Door_PIOTR`); the frame will be machined on a 5-axis CNC. PC must take the order (size, handing, wall, lock, closer, vision panel, colour) and produce everything the windows already get: element lists, purchasing, pre-cut, drawings, pack, price, and the machine list with the same hinge, lock and keep positions the bSolid macro cuts. PC has no internal door today: the `door` type is an external casement-rule door (68 x 93 frame, stile and rail leaf, multipoint locks), see `src/engine/profile.js` `DEFAULT_DOOR_PROFILE`. The nearest pattern for a new type is the `partition` type (commit 088d447, 44 files, `docs/handover/PARTITION-WALLS.md`), which also has hinge recesses and a latch keep.

---

## 1. How to run this tura

1. Run autonomously. No questions. If something is unclear or outside the scope below, skip it and write it in `BLOCKERS.md` section 35.
2. Start from the current `main`. Work on a branch named `claude/fire-doors-v1`. Commit per stage. Open a PR to `main`. Do not merge. Do not push to `main`. No force push.
3. Code, comments and UI copy in English.
4. Every NEW file starts with the Skylon Development Ltd header. Copy it from `src/engine/partColours.js`.
5. In text you write (comments, logs, UI copy, PR text, BLOCKERS, BUILD-LOG) do not use the em dash or en dash characters. Hyphens are fine.
6. No new dependencies. Do not remove or rename existing functions or UI. If you believe one of these is needed, do not do it: write it in `BLOCKERS.md`.
7. `deriveWindowData()` is the single source of truth. Components never calculate per-door data on their own. Every number a sheet, the 3D, a list, a PDF or an export prints comes from the derived data or the profile, never from a literal in a component.
8. Zustand stores: no ES6 getter properties.
9. A grep is not proof. Prove every claim with the harness on derived data, and test the component that reaches the screen, not only the geometry under it. esbuild and vite do not catch undefined identifiers: after adding any import, hook or variable, grep that it is defined.
10. Subagents: run several in parallel from the start (the owner wants this). Read-only agents for the Stage 0 sweep; after that one agent per independent area on DISJOINT files (engine + lists; drawings; 3D; export). At the end one independent review agent that has not seen the work: it re-derives the reference numbers of 3.10 by hand, confirms no existing assertion was weakened or deleted, opens the rendered sheets. Fix what it finds and record its verdict in `BUILD-LOG.md`.
11. Order of value if time runs short: Stages 1, 2, 3, 4 are the product (type, profile, engine, lists, BOM, tests). Then 7 (export), 5 (sheets), 6 (3D). Never leave a stage half applied: finish it or revert it and report.
12. Do not edit this file.
13. Every ZAŁOŻENIE of the box becomes a profile key of `DEFAULT_FIREDOOR_PROFILE`, editable in Window Settings · Fire Doors, listed in `BLOCKERS.md` 35 under "owner check" with the value used. Never bury an assumption in a literal.
14. Verification proportionate: the new harness, one full suite run, one build. No hour of extra checks.

---

## 2. Scope

**In scope**: a new category `firedoor` registered everywhere a category is registered (list in Stage 1); `DEFAULT_FIREDOOR_PROFILE`, its migration and the Window Settings card; the spec block; the configurator form; `deriveFireDoorWindow`; cut list, pre-cut, Assign Materials slots, BOM, ironmongery slots, glass schedule rows for vision panels, pricing with zero default rates; drawings and PDFs; a simple 3D model; bSuite rows and a machine-neutral machining export; dashboard, project page, batch creation, move to production; tests, logs, handover doc.

**Out of scope, do not touch**: the `door` type and every door number; partition; casement; sash; arched; the casement bSuite frame export behaviour (you may extract shared helpers from `bsuiteExport.js` but the casement output must stay byte identical, prove it with `verify/parity/t32_bsuite.mjs`); PSW; double doors (write the KIT_DOOR_DOUBLE rules into BLOCKERS as the next tura); the concealed closer machining; Weeke MPR export.

---

## 3. The model (binding)

All numbers are defaults of `DEFAULT_FIREDOOR_PROFILE` (new, in `src/engine/profile.js`, schema 1) and editable in Window Settings · Fire Doors. `deriveFireDoorWindow` (new file `src/engine/fireDoor.js`, dispatched from `deriveWindowData` on `category === 'firedoor'`) is the only place that turns them into sizes and positions.

### 3.1 Inputs (spec block `firedoor`)

| Key | Default | Notes |
|---|---|---|
| `fire` | true | Fire ON / OFF |
| `rating` | `'FD30'` | `'FD30'` / `'FD60'`; ignored when `fire` false |
| `leafWidth` | 826 | free number; suggestions `profile.leaf.widthSuggestions` = [626, 686, 726, 762, 826, 838, 926, 1056] |
| `leafHeight` | 2040 | free number; suggestion 2040 |
| `leafThickness` | derived | FD30 and non-fire 44, FD60 54 (`profile.leaf.thicknessByRating`) |
| `hingeSide` | `'left'` | `'left'` / `'right'` seen from the PULL side (the side the hinge knuckles show). Same wording rule as PSW: print "Hinge left / Hinge right". |
| `swing` | `'in'` | `'in'` / `'out'` (into the room or into the corridor); only flips drawings, labels and which frame face carries the stop |
| `frameDepth` | 100 | free number = finished wall thickness; suggestions 100, 125, 150, 175, 200 |
| `lockType` | `'latch'` | `'latch'` / `'euro'` / `'bathroom'` |
| `closer` | fire ? true : false | concealed closer yes / no |
| `vpStyle` | 0 | vision panel style id, table 3.7 |
| `vpCustom` | `{ length: 600, width: 150, count: 1, rail: 100, pos: 0 }` | used when `vpStyle` 14 |
| `intuStyle` | 1 | table 3.8; forced 0 when `fire` false |
| `leadEdge` | true | leading edge bevel on the lock edge (macro LEAD_EDGE) |
| `finish` / colour | batch default | as other types |

Width and height are never clamped. Only a hard sanity error (width < 300 or > 1500, height < 1500 or > 3000, depth < 50 or > 400) fails that ONE door with a message on its card; it never blanks the page.

### 3.2 Numbering

New doors in a project get the next free name `FDR-01`, `FDR-02` (fire) or `DR-01` (non-fire), two digits, counted per prefix inside the project. The user can overwrite the name. Changing `fire` on an unsaved door updates the prefix; on a saved door it does not rename.

### 3.3 Leaf

- Blank: one leaf = one board `leafHeight x leafWidth x leafThickness` (bSolid LPX x LPY x LPZ: LPX = height, LPY = width, LPZ = thickness, table orientation fixed by the owner on 09.10.2026).
- BOM: a "Door blank" row per leaf, size of the leaf plus `profile.leaf.blankAllowance` (ZAŁOŻENIE 0, the owner buys blanks oversize and the CNC cuts the size; a fire blank and a non-fire blank are separate Assign Materials slots, and FD60 has its own slot).

### 3.4 Frame

Profile `frame`: `rawThickness 63`, `thickness 50`, `rawWidthAllowance 5` (ZAŁOŻENIE), `overlap 12`, `gapSide 3`, `gapHead 3`, `floorGap 5` (ZAŁOŻENIE, from the LSP), `rebateClearance 3`, `headJoint 'mitre'` (ZAŁOŻENIE; only `'mitre'` is implemented, any other value fails the door with a message).

- Rebate from solid on every member: width `rebateW = overlap + gapSide = 15` (across the 50 thickness), depth `rebateD = leafThickness + rebateClearance = 47` (along the frame depth). Visible faces: 35 outside (`thickness - rebateW`), 50 inside.
- Overall frame: width `leafWidth + 2 x (gapSide + thickness - rebateW) = leafWidth + 76`; height `floorGap + leafHeight + gapHead + (thickness - rebateW) = leafHeight + 43`. These must equal the LSP formulas (`KIT_DOOR_SINGLE.lsp`, `KIT_DOOR_DOUBLE.lsp`: single frame outer = leaf + 76, height = leaf + 43).
- Members (finished `50 x frameDepth`, raw `63 x (frameDepth + rawWidthAllowance)`):
  - `FD-HEAD`: long point length = overall frame width, both ends mitred 45.
  - `FD-JAMB-H` (hinge jamb) and `FD-JAMB-L` (lock jamb): long point length = overall frame height, top end mitred 45, bottom end square (stands on the floor).
- Cut List and Pre-Cut rows as for partition members (raw section, length, quantity, door name). Element names use the prefix `FD-` (`FD-LEAF`, `FD-HEAD`, `FD-JAMB-H`, `FD-JAMB-L`); extend the prefix rule in `partSymbols.js` (today `^[CDSW]-`) to also accept `FD-`, and the pre-cut regex in `lists.js` the same way, so the display drops the prefix as for the other types.

### 3.5 Hinges (copy of the macro rule, do not invent another)

Profile `hinges`: `count 3`, `length 102`, `topOffset 150`, `bottomOffset 200`, `recessLength 103`, `recessWidth 30`, `recessDepth 3`, `cornerRadius 6` (all ZAŁOŻENIE except the macro rule), `fireProduct` and `standardProduct` as Assign Materials slots.

- Position of hinge i (0 based), measured from the leaf TOP to the hinge top edge: `top_i = topOffset + i x step`, `step = (leafHeight - topOffset - bottomOffset - length) / (count - 1)`. This is the macro expression `(lpx - 150 - 200 - w) / (repn - 1)` with `w = 102`, `repn = 3`. Reference: leaf 2040 gives step 794 (the number stored in the owner's file), hinges at 150 / 944 / 1738, the last one ending 200 above the leaf bottom.
- Leaf recess: on the hinge edge, `recessLength` centred on the hinge, `recessWidth` into the face from the pull side, `recessDepth` deep, corners `cornerRadius`.
- Frame recess on `FD-JAMB-H`: same size, same heights shifted by the head: position from the jamb top long point = `(thickness - rebateW) + gapHead + top_i`, on the rebate face that meets the leaf edge.
- Fire ON uses macro HINGE = 1 (Fire), Fire OFF HINGE = 0 (Standard).
- Count stays 3. Write in BLOCKERS whether a 4th hinge rule is wanted (macro supports REPN).

### 3.6 Lock and keep

Profile `lock`: `spindleHeight 1000` (from the leaf bottom, macro LOCK_H), `backset 60`, `forend { length 235, width 24, millOversize 1, depth 4 }`, `case { depth 85, height 150, pocketWidth 17, pocketDepth 87, pocketHeight 153 }` (pocket 87 x 153 = owner proposal, ZAŁOŻENIE), `euroCentres 72`, `bathroomCentres 78`, `caseTopAboveSpindle` (ZAŁOŻENIE 46.5, from the macro expression `lock_h + 46.5`), `forendCentreBelowSpindle` (ZAŁOŻENIE 15, from the macro expressions `lock_h - 15`).
- Leaf: forend recess `236 x 25` with full radius ends, case pocket `17 x pocketDepth x pocketHeight`, both on the lock edge centred on the leaf thickness; spindle hole on both faces at `spindleHeight`, `backset` from the lock edge; euro hole at `spindleHeight - 72` or bathroom hole at `spindleHeight - 78`; latch has no second hole.
- Macro values: Fire FD30 LOCK = 2, FD60 LOCK = 3, non-fire LOCK = 1; EURO = 1 only for `euro`; SPINDLE = 1.
- Keep on `FD-JAMB-L`: plate `176 x 40` (175 x 39 + 1), depth `profile.keep.plateDepth` (ZAŁOŻENIE 3), one bolt pocket `profile.keep.pocket { length 120, width 18, depth 15 }` (ZAŁOŻENIE), centred at the forend centre height mapped onto the jamb (`floorGap + spindleHeight - forendCentreBelowSpindle` from the jamb foot). Macro KEEP for the leaf row = 0 (the keep of a single door is in the frame); the frame row carries `KEEP_STYLE`, `KEEP` (FD30 2, FD60 3, standard 1).

### 3.7 Vision panel (styles of the macro, ids 1:1)

| id | macro label | panes (w x h, count) |
|---|---|---|
| 0 | None | none |
| 1 | 450mm Square | 450 x 450 x 1 |
| 2 | 150mm x 760mm/150mm x 450mm | 150 x 760 + 150 x 450, stacked |
| 4 | 150mm x 1410mm | 150 x 1410 x 1 |
| 5 | 350mm Diamond | 350 x 350 x 1 rotated 45 |
| 6 | 2No. 150mm 800mm | 150 x 800 x 2 |
| 7 | 3No 200mm 450mm | 200 x 450 x 3 |
| 8 | 5No 200mm 500mm | 200 x 500 x 5 |
| 9 | 450mm x 700mm | 450 x 700 x 1 |
| 10 | 150mm x 760mm | 150 x 760 x 1 |
| 11 | 508mm x 1500mm | 508 x 1500 x 1 |
| 12 | 150mm x 700mm/150mm x 700mm | 150 x 700 x 2, stacked |
| 13 | 5No 200mm 200mm | 200 x 200 x 5 |
| 14 | Custom | `vpCustom.width x vpCustom.length x count`, rail between, `pos` 0 vertical / 90 horizontal |

- Exact macro placement is NOT decoded. Drawings and 3D place the panes centred across the leaf, the first pane top at `profile.vp.topRail 150` from the leaf top, multiple panes stacked with `profile.vp.midRail 450` gap for vertical styles (ZAŁOŻENIE, macro defaults D_TOP_RAIL 150, D_MID_RAIL 450, D_SIDE_MARGIN 150). Label each VP sheet "layout per bSolid macro". The export only sends the style id and the custom values; the macro places the cut.
- BOM per door: glass sqm (fire glass slot when `fire`, plain toughened slot otherwise), glazing beads metres (perimeter of every pane x 2 faces), glazing intumescent metres when `fire` (perimeter of every pane). Glass Schedule rows for each pane.

### 3.8 Intumescent

Table of macro `INTU_STYLE` ids exposed in the form: 1 "15mm x 4mm Intu Strip Lock Center", 2 "20mm x 4mm Intu Strip Lock Center", 3 "2No 10mm x 4mm", 4 "2No 15mm x 4mm", 5 "15mm x 4mm Central 2L Top", 6 "20mm x 4mm Central 2L Top", 7 "2No 15mm x 4mm 2L Top". Strips per edge: 1 for ids 1, 2, 5, 6; 2 for ids 3, 4, 7 (ZAŁOŻENIE). BOM metres = strips x (2 x leafHeight + leafWidth), one Assign Materials slot per strip size (10, 15, 20 mm). Fire OFF: no intumescent rows, `INTU_STYLE` 0.

### 3.9 Ironmongery and materials (Assign Materials slots, all new, `windowType: 'firedoor'`)

Fire hinge (pcs, 3 per leaf), standard hinge, lock case latch, lock case sashlock euro, lock case bathroom, euro cylinder (euro only), thumbturn and release (bathroom only), lever handle set on rose (1 per door), keep (1 per door), concealed closer (when `closer`), intumescent 10 / 15 / 20 (m), door blank FD30 44, door blank FD60 54, door blank non-fire 44, frame timber 63 (m, by raw section), fire glass (sqm), toughened glass (sqm), glazing beads (m), glazing intumescent (m), paint as the batch finish (by leaf and frame area, same rule as partition or casement, whichever already exists for a timber face area; write which in BUILD-LOG). Ironmongery rows are picked from the Ironmongery catalogue, materials from Materials, item numbers as for every other slot. Purchase list from the single doors under the client, never from the batch.

### 3.10 Reference numbers (default profile, assert all of them in the harness)

Single FD30, leaf 826 x 2040, depth 100, hinge left, latch:
- frame overall 902 x 2083; head 902 long point; jambs 2083 long point; raw section 63 x 105; finished 50 x 100; rebate 15 x 47; faces 35 / 50.
- hinges from the leaf top 150 / 944 / 1738, step 794; jamb hinge recess tops from the jamb top 188 / 982 / 1776 (35 + 3 + top_i).
- spindle 1000 above the leaf bottom; keep centre on the lock jamb 990 above the jamb foot (5 + 1000 - 15).
- intumescent 15 x 4: 4.906 m.
Same door FD60: leaf 54, rebate depth 57. Non-fire DR: HINGE 0, LOCK 1, no intumescent rows. Leaf 762 x 1981: step 764.5, hinges 150 / 914.5 / 1679.

### 3.11 Profile, store and settings

`DEFAULT_FIREDOOR_PROFILE` with `migrateFireDoorProfile`, `setActiveFireDoorProfile`, `getFireDoorProfile` exactly in the pattern of the partition profile; `KINDS` gets `'firedoor'`; editable roots whitelisted; Window Settings page `/window-settings/firedoor` with a card per block (leaf, frame, hinges, lock, keep, vp, intumescent, bsuite); sidebar link; batch profile snapshot includes it.

---

## 4. Work, in this order

### Stage 0: baseline and sweep (no code changes)

1. `npm ci`, `pip install ezdxf`, run every `verify/arch/t*.mjs` (not the `*baseline*` generators) and `verify/parity/*.mjs` on the starting commit; restore `docs/handover/samples/` with `git checkout` after the run. Record the pass count per file. `npm run build`.
2. Sweep with read-only agents: every place the `partition` category is registered (start from `git show --stat 088d447` and grep `partition`), plus the known gaps where partition is NOT registered (`DashboardPage.jsx` new batch select, `MaterialAssignmentsPage.jsx` `TYPE_LABELS` and the "coming soon" branch, sidebar materials link, `moveToProduction.js` `CATEGORY_TO_BATCH`, `bom.js` `ELEMENT_TO_PART_ID`). `firedoor` must be registered in ALL of them, including the gaps. Write the list in `BUILD-LOG.md`.

### Stage 1: type, profile, spec, configurator form

Register `firedoor` everywhere from the Stage 0 list (`projectStore` BATCH_DEFAULTS and labels, `windowProfileStore`, `profile.js`, `specification.js` block 3.1, `calculations.js` dispatch, `ConfiguratorPage` form, `ProjectDetailPage` TYPE_LABELS and add batch button, `DashboardPage` colour, label and new batch select, `WindowSettingsPage`, `AppSidebar`, `partSymbols`, `partColours`, `lists` CUT_LIST_ORDER, `bom`, `ironmongeryStore`, `BatchDefaultsPage`, `MaterialAssignmentsPage`, `moveToProduction`, `pricing` with `DEFAULT_PRICING.firedoor { leafPrice 0, framePerM 0, vpPerSqm 0, closerPrice 0 }`). Configurator: inputs of 3.1 with suggestion chips, the name field with the auto number, and a live summary (frame overall, hinge positions, rebate). Number inputs without spinners.

### Stage 2: engine

`src/engine/fireDoor.js` `deriveFireDoorWindow`: everything of 3.3 to 3.8. Output `derived.firedoor = { leaf, frame: { overall, members[] }, hinges[], lock, keep, vp, intumescent, machining: { leaf: ops[], head: ops[], jambHinge: ops[], jambLock: ops[] }, bsuiteVars: { leaf, head, jambHinge, jambLock } }`. Every machining op: `{ id, kind, face, x, y, z, length, width, depth, radius }` in the coordinate system of its own board, documented at the top of the file (origin, axis, which end is the top). `bsuiteVars` holds the variable table of 4.7, already resolved, so the export only copies it.

### Stage 3: lists, BOM, assign materials, glass, pricing

Cut list, pre-cut (members, applied colours rule as partition), Assign Materials slots 3.9, BOM rows, ironmongery list, glass schedule for VP panes, glazing beads, pricing. Single door first, batch is the sum ("nasza świętość").

### Stage 4: tests

`verify/parity/t51_fire_door.mjs`: every number of 3.10; prefix numbering; fire OFF rows; free widths (e.g. 803) pass without clamp; a bad size fails only its door; macro variable values of 4.7 for the reference doors; controls: a casement, a sash, a door and a partition derive byte identical to Stage 0; `t32_bsuite.mjs` unchanged.

### Stage 5: drawings and PDFs

Port the three views of `docs/handover/fire-doors/source/KIT_DOOR_SINGLE.lsp` as React SVG sheets (`src/components/drawings/fireDoor*`): outside elevation (frame 35 face, hinges interrupting the edge line, handle rose at the spindle, lock symbol euro / bathroom as the LSP draws them), inside elevation (frame 50 face, leaf dashed), plan closed and open 30 degrees with the rebated jambs; dimensions as the LSP places them. Plus a leaf machining sheet (hinge recesses, lock, spindle, VP cut-outs, every dimension from the leaf top and bottom) and a frame machining sheet (three members, hinge recesses, keep, mitres). Use `drawingTheme.js` and the dimension helpers; `sc` never on font size or stroke. Sheets appear in the window page drawings and in the pack, and in the pack PDF.

### Stage 6: 3D

`src/3d/components/firedoor/FireDoor.jsx`: frame with the rebate, leaf with VP holes and glass, three hinges, handle on rose, colour from the finish, an open angle control (0 to 90, default 30). Wire it in `App.jsx`, `WindowPreview3D.jsx`, `Window3DCaptureRig.jsx`, `windowSpecToConfig.js`, `ThreeDPanel.jsx`. Look only, no dimensions in 3D.

### Stage 7: machine export

1. `buildBsuiteFireDoorRows` next to `buildBsuiteFrameRows` in `src/utils/bsuiteExport.js`, reusing the same writer, embedding and targets. Program keys `firedoor.bsuite`: `leaf`, `head`, `jambHinge`, `jambLock` with paths per target, uploaded programs from the same bucket. Default leaf path `C:/Users/Xp600/Desktop/Biesse Piotr/FD_LEAF_MASTER_PIOTR.bSolid` (ZAŁOŻENIE, editable), frame paths empty.
2. Rows per door in this order over the whole export: all leaves, then all heads, then all hinge jambs, then all lock jambs. Label = door name. A key without a path or program = rows skipped and a message listing the doors, never a throw. The STOP row between blocks: if its XML form is not in `docs/handover/workshop/` samples, do not invent it; write it in BLOCKERS.
3. Variables per row are DOCUMENT variables named 1:1 like the macro parameters (table 4.7). Panel LPX / LPY / LPZ written as in the casement frame rows.
4. Machine-neutral export `{label}_firedoor_machining.json` and `.csv` (one line per op: door, element, op, face, x, y, z, length, width, depth, radius) from `derived.firedoor.machining`.
5. Buttons: Production Pack header "bSuite fire doors" and "Fire door machining (CSV)", window page header the same for one door, shown only for `firedoor`.

#### 4.7 Variable contract (names exactly as in the macro)

Leaf row (FD_LEAF): `LPX` leafHeight, `LPY` leafWidth, `LPZ` thickness, `HAND` 0 left / 1 right (ZAŁOŻENIE that macro hand 0 = "Hinge left" of 3.1, owner checks in bSolid), `LH` / `RH` 1 on the matching side, `HINGE` 1 fire / 0 standard, `LOCK` 1 / 2 / 3, `LOCK_H` spindleHeight, `SPINDLE` 1, `EURO` 1 / 0, `KEEP` 0, `KEEP_STYLE` 0, `INTU_STYLE`, `VP_STYLE`, `C_VP_L`, `C_VP_W`, `C_VP_NUM`, `C_VP_RAIL`, `C_VP_POS`, `D_TOP_RAIL` 150, `D_MID_RAIL` 450, `D_SIDE_MARGIN` 150, `LEAD_EDGE` 1 / 0, `REBATE` 0 (single door), `REBATE_STYLE` 1, `SPY_ON` 0, `SPY_H` 1450, `LBOX` 0, `L_BOX_H` 1000, `DROP_CILL` 0, `PREM_DOOR` 0. New names the master does not have yet (the owner adds them): `HINGE_1`, `HINGE_2`, `HINGE_3` (top_i), `HINGE_D` recessDepth, `CLOSER` 0 / 1.
Frame rows: `LPX` member long point length, `LPY` frameDepth, `LPZ` 50, `REB_W` 15, `REB_D` rebate depth, `HAND`, `HINGE`, `HINGE_1..3` (jamb positions of 3.5, hinge jamb row only), `HINGE_D`, `KEEP` / `KEEP_STYLE` and `KEEP_Y` (keep centre from the jamb foot, lock jamb row only), `MITRE_TOP` 1, `MITRE_BOTTOM` 0 for jambs, 1 / 1 for the head.

### Stage 8: full suite, build, docs

One full suite run, one build. `docs/handover/FIRE-DOORS.md` in the style of `PARTITION-WALLS.md` (model in one page, where it lives, sheets, lists, verification, assumptions and next steps). `BUILD-LOG.md` entry with the reference table from the live engine.

### Stage 9: review and PR

Independent review agent per rule 10. PR description: the owner box numbers first, then summary, files changed, suite counts, the items for Piotr.

---

## 5. Items to report to Piotr in `BLOCKERS.md` (section 35, short, numbered)

1. Every ZAŁOŻENIE with the value used and the profile key.
2. The variables the owner must add to `FD_LEAF_MASTER_PIOTR` as document variables and bind inside `Master_Door_PIOTR` (all of 4.7; today the file has only LPX, LPY, LPZ at document level), and the frame masters that do not exist yet.
3. Values in the owner's saved master that look wrong for a single door: `REBATE 1` with `REBATE_STYLE 1` (meeting rebate for pairs), `EURO 1` fixed on.
4. Concealed closer: no machining (no `concealed_closer_*.mpr` source); what is needed (model, recess sizes on leaf and head).
5. Hinge positions: three sources disagree (macro 150 / 200 rule used; old Weeke 145 / 700 / 1722 from the top; LSP 145 / 700 from the top and 200 from the bottom). Whether a 4th hinge is wanted.
6. Smoke seals (FD30S), architraves, door signs, drop seal: not modelled; ask.
7. Double doors: the KIT_DOOR_DOUBLE rules (frame outer = leaves + 79, height + 43, centre gap 3, active leaf 12 rebate, handle leaf chosen from inside) for the next tura.
8. The STOP row format, if not found.
9. Anything skipped, with the reason.
