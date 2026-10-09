# CLAUDE.md: TURA PC · DOORS v3 (casement rules inside the door frame), SASH BARS PER SASH, SETTINGS SAVE

This file is the brief for ONE tura in this repo (`Piotr3009/Sash-Planner-Web`, Production Core, "PC"). If your session was started for a different task, ignore this file.

---

## RAMKA DLA PIOTRA (owner box, binding)

Piotr czyta tylko tę ramkę przed startem. Reszta pliku mówi to samo po angielsku, ze szczegółami. Decyzje Piotra z 09.10.2026 (odpowiedzi 1 do 23). Punkty oznaczone ZAŁOŻENIE to moje domyślne odczytanie tam, gdzie zabrakło odpowiedzi: tura zapisuje je jako klucze profilu w Window Settings · Doors, więc rano zmiana to liczba, nie przeróbka.

**Drzwi: jedna zasada, zasada casement**
1. Rama drzwi to rama casement 68 x 93 (land 47, rebate 21, gap 4). Słupek łączący 136 znika. Między drzwiami a panelem bocznym stoi mullion casement 68 x 93 na wylot, skrzydło 17 od osi mullionu (13 + 4), dokładnie jak w oknie casement.
2. Transom fanlightu = transom casement, te same obliczenia: fan 65 od osi (51 + 6 + 8), skrzydło pod transomem 17 od osi (13 + 4), rygiel cięty na segmenty jak w casement (seat 8.5), land 8 nad osią i 13 pod osią. Mullion przechodzi na wylot, transom w segmentach.
3. ZAŁOŻENIE: `transomHeight` z formularza (450) to odległość od góry ramy do OSI transomu, jak T w casement. Dziś 450 było dołem rygla. Przy 450: fan 385 wysoki, skrzydło drzwi zaczyna się 467 od góry.
4. Wysokość skrzydła: liczymy od podłogi, na dole 51 na próg i akcesoria, w KAŻDYCH drzwiach (próg drewniany, do środka, alu, low profile). Skrzydło = H - 51 - 51 = H - 102. Rama 2100: skrzydło 1998 (było 2002 z progiem drewnianym, 2043 z alu). Szerokość bez zmian: W - 102 (jamb 51 z każdej strony), french połowa + lip 6, meeting stile 100.
5. Panel boczny = casement fixed za mullionem: ślepe skrzydło, stile 64, górny ramiak 64, DOLNY RAMIAK 180 (jak w drzwiach, żeby linie się zgadzały), głębokość 57. Szerokość = strefa panelu - 51 (jamb) - 17 (oś mullionu). Wysokość jak skrzydło drzwi (H - 102, pod transomem H - T - 17 - 51). Szyba regułą casement: W - 105, H - (64 - 11.5) - (180 - 11.5).
6. ZAŁOŻENIE: `sideLeftWidth` / `sideRightWidth` (500) to strefa panelu od zewnętrznej krawędzi ramy do osi mullionu.
7. Fanlight stały = ślepe skrzydło casement 64 / 64 / 67 (ZAŁOŻENIE: dolny ramiak 67 jak casement fixed, nie 64), tych samych wymiarów co fan otwierany (W strefy - 2 x odjęcie, T - 65). Fan otwierany bez zmian: skrzydło casement 64 / 64 / 67, okucia casement.
8. Panel (half glazed, three quarter): 2 x 18 Tricoya + rdzeń 18 = 54. Krawędź zebrana do 24 i siedzi w felcu szyby (18 głęboki) na 17 mm. Panel = światło + 2 x 17 (szyba ma + 2 x 11.5). Beading dookoła jak przy szybie. Rama 2100 half glazed: szyba 633 x 881, panel 644 x 806. ZAŁOŻENIE do rysunku: język 24 gruby, skos 40 szeroki od 24 do 54, płaski pasek 15 przy listwie. ZAŁOŻENIE do BOM: obie płyty i rdzeń w pełnym wymiarze panelu.
9. Próg: alu albo low profile = kupujemy threshold (jest) PLUS wiersz uszczelki progu (nowy). Próg drewniany = nic nie kupujemy, cill jest w drewnie. Drzwi do środka = ZAWSZE próg drewniany (cill 40 / 35 jak dziś); ZAŁOŻENIE: wybór alu / low profile przy drzwiach do środka jest ignorowany, z notatką na arkuszu i w konfiguratorze.
10. Nawiewniki w drzwiach liczymy w BOM tą samą regułą co w oknach (room type).
11. Handing: zostaje oznaczenie z konfiguratora, jak w PSW: „Hinge left” = zawiasy po lewej patrząc od środka. Drukujemy „Hinge left / Hinge right” i „opens outward / inward”. Słowa Winkhaus LH / RH, anti-clockwise, clockwise znikają z wydruków.
12. Zawiasy: bez limitu nośności (minimum 3). Ciężarki: bez zmian. Wycena drzwi: bez zmian (jak PSW). bSuite drzwi: nie teraz. French clearance: nie teraz.
13. Meeting stiles (french): ZAŁOŻENIE: zostaje jak narysowano, rebated joint na 12 mm zakładki, połowa grubości każdy. Tura nic tu nie zmienia, tylko wpisuje do BLOCKERS.
14. Arkusz skrzydła: wymiary zawiasów H1 do H4 mniejszą czcionką i rozsunięte, nic nie może na siebie nachodzić. Test sprawdza kolizje tekstu.
15. Partia typu `door` dostaje domyślne drzwi (dziś sash).

**Sash**
16. Szprosy osobno góra i dół: PSW przysyła `upperBars` i `lowerBars`, PC ma je wczytać także z fullConfig estymaty, i każdy arkusz, wiersz szkła, beading, DXF, canvas i 3D ma brać wzór swojej sashki. „6 over 1” ma wychodzić.
17. Martwy kod `glazingItems` (`calculateGlazingSummaryForWindow`, `aggregateComponents`) do usunięcia, jeśli naprawdę nic go nie czyta; jeśli coś czyta, poprawić.
18. Pricing Settings: pole „Cottage sash” obok „Arched head”, domyślnie 5 %.
19. Nieznana wartość `sashProportion` nie wywala strony: błąd per okno, komunikat na karcie tego okna.

**Ustawienia**
20. Zapis Window Settings nie nadpisuje chmury całym blobem ze starej karty: zapis łączy tylko zmienione gałęzie z tym, co jest w chmurze, a strona ustawień odświeża się z chmury przy wejściu i po powrocie do karty.

**Nie ruszamy**: tytuły arkuszy (myślniki zostają), bSuite, wycena, French clearance, ciężarki.

If anything below seems to conflict with this box, the box wins. If the box itself is unclear for a case you meet, do not guess: skip that case and write it in `BLOCKERS.md`.

---

## 0. Why this tura exists

The doors tura of 08.10.2026 (PR #13, `docs/handover/DOORS-PRODUCTION.md`) built the door engine with its own frame rules (coupling post 136, side panels of 57 x 57 members, a transom band of 94 / 115, a cill-dependent leaf height). The owner reviewed it on 09.10.2026 and decided: the door frame follows the casement rules everywhere (mullion, transom, fixed lights), every leaf stands 51 above the floor, the panel sits 17 deep in the glass rebate, the handing keeps the PSW wording. Two sash items from PR #14 (bars per sash, the explicit error per window), one pricing field and the settings save bug come along because they are small and decided.

---

## 1. How to run this tura

1. Run autonomously. No questions. If something is unclear or outside the scope below, skip it and write it in `BLOCKERS.md`.
2. Start from the current `main`. Work on a branch named `claude/doors-v3`. Commit per stage. Open a PR to `main`. Do not merge. Do not push to `main`. No force push.
3. Code, comments and UI copy in English.
4. Every NEW file starts with the Skylon Development Ltd header. Copy it from `src/engine/partColours.js`.
5. In text you write (comments, logs, UI copy, PR text, BLOCKERS, BUILD-LOG) do not use the em dash or en dash characters. Hyphens are fine.
6. No new dependencies. Do not remove or rename existing functions or UI the owner uses. If you believe one of these is needed, do not do it: write it in `BLOCKERS.md`. The one removal allowed is item 17 of the box (dead glazing summary code), under its conditions.
7. `deriveWindowData()` is the single source of truth. Components never calculate per-window data on their own. Every number a sheet, the 3D or a PDF prints must come from the derived data or from the profile, never from a literal in the component.
8. Zustand stores: no ES6 getter properties.
9. A grep is not proof. Prove every claim with the harness on derived data, and test the component that reaches the screen, not only the geometry under it.
10. Subagents: read-only agents for the Stage 0 sweep; at most one agent per independent area later, only on disjoint files; at the end one independent review agent that has not seen your work. It re-derives the box numbers by hand, confirms that no assertion was weakened or deleted, reads the fixture diffs and opens the rendered sheets. Fix what it finds and record its verdict in `BUILD-LOG.md`.
11. Order of value if the time runs short: Stages 1, 2, 3 and 8 are the product (door engine, lists, BOM, tests). Then 4 (sheets), 5 (3D), 6 (sash), 7 (settings save). Never leave a stage half applied: finish it or revert it and report.
12. Do not edit this file.
13. Whatever the box calls ZAŁOŻENIE (assumption) becomes a profile key or a documented constant, listed in `BLOCKERS.md` under "owner check" with the number the tura used. Never bury an assumption in a literal.

---

## 2. Scope

**In scope**: the door engine (`deriveDoorWindow` in `src/engine/calculations.js`, `DEFAULT_DOOR_PROFILE` in `src/engine/profile.js`, `doorHardware.js`), door lists, BOM, assign materials rows, door sheets, door PDFs, door 3D, the Window Settings Doors card, the configurators' door form where a rule changes what they show; sash bars per sash across engine, lists, sheets, glass, beading, DXF, canvas renderer and 3D; the sash proportion error handling and the pricing field; the window profile cloud save; batch creation defaults for `door`; tests, logs, handover docs.

**Out of scope, do not touch**: casement and sash engine numbers (they are the reference: the door now REUSES them); arched windows; bSuite export; pricing other than the one new field; the French centre clearance; counterweights; sheet title punctuation; PSW.

---

## 3. The model (binding)

Every number below is the default of the door profile (`DEFAULT_DOOR_PROFILE`, schema 3) and editable in Window Settings · Doors. `deriveDoorWindow` is the only place that turns it into sizes. Where this section says "casement rule", the door engine calls the SAME helper the casement engine uses (extract it into a shared function if it is inline today); never a second copy of a casement formula inside the door code.

### 3.1 Frame

- Head, jambs, cill 68 x 93 as today (land 47, rebate 21, gap 4, cill visible 41). Unchanged.
- Mullion 68 x 93, casement rule: face `elements.mullion 68`, land 26 (13 per side), leaf at the mullion axis 17 (`deductions.leafAtMullionAxis`), the mullion runs the full height through the transom (`lengths.mullion` as casement: frame height less 77 with a timber cill). It replaces the coupling post wherever a side panel meets the door. `couplingPost` stays in the profile for stored copies only and is no longer used by the engine; the migration maps it away (3.9).
- Transom rail 68 x 93, casement rule: axis at `transom.height` from the frame top (3.3), land 8 above and 13 below the axis, fan from the axis 65 (= 51 + 6 + 8, `deductions.fanFromAxis`), the leaf below the transom 17 from the axis (= 13 + 4, `deductions.leafBelowAxis`), the rail cut in segments between the jambs and the mullions the way the casement cuts `C-T` (seat `lengths.transomSeat 8.5`, use the casement helper). The mullion runs through, the transom does not.
- Without a timber cill (aluminium or low-profile threshold) the mullion and the jambs run to the floor line: mullion length = frame height less the head seat part of the casement rule (the casement helper with the cill part set to 0). Record the number in `BLOCKERS.md` for the owner.

### 3.2 Leaf heights, one rule for every door

- `deductions.leafAtFloor 51` (new): every leaf bottom (door leaf, side panel light, lower leaf under a transom) stands 51 above the floor line, whatever the threshold (timber cill, inward cill 40 / 35, aluminium, low-profile) and whatever the direction.
- No transom: leaf H = H - leafAtJamb 51 - leafAtFloor 51 = H - 102. Frame 2100: 1998.
- Under a transom at axis T: leaf H = H - T - leafBelowAxis 17 - leafAtFloor 51.
- `leafFullHeight` and `leafNoThreshold` are no longer read by the engine; keep them in the profile object for stored copies, migrate them to the derived values (102 and 102) and show them read-only or drop them from the Doors card.
- Widths unchanged: single leaf W - 2 x leafAtJamb; french half = (W_zone - 2 x 51 - clearance) / 2, leaf = half + lip 6, meeting stile 100; a door zone bounded by a mullion uses 17 on that side instead of 51.

### 3.3 Fanlight (transom zone)

- `transom.height` T = frame top to the transom AXIS (owner box 3, an assumption: flag it). Opening fan leaf: casement leaf 64 / 64 / 67 x 57, W = zone width less the casement edge deductions (51 at a jamb, 17 at a mullion axis), H = T - 65. One fan leaf per frame zone (over the door, over each side panel), as today.
- Fixed fanlight: a casement fixed light = a non-opening casement leaf 64 / 64 / 67 x 57 of the same size as the opening fan leaf would be (no hardware, the casement `fix.construction 'fixedLeaf'` rule). Glass by the casement rule: W - 105, H - 108. Replaces today's "glazed into the frame" fanlight. Profile key `fixedFan: { stile: 64, top: 64, bottom: 67 }` (bottom 67 is an assumption: flag).
- Opening fan leaf hardware, seals, consumables: as today (casement picks).

### 3.4 Side panels

- A side panel is a casement fixed light behind a mullion: a non-opening leaf with stiles 64, top rail 64, bottom rail 180 (`elements.leafBottom` of the door, so its line meets the door bottom rail), depth 57. Profile key `sidePanel: { stile: 64, top: 64, bottom: 180, depth: 57 }` (replaces `sidePanel.member 57`).
- Zone: `sideLeftWidth` / `sideRightWidth` = from the outer frame edge to the mullion axis (assumption: flag). Light W = zone - 51 - 17; light H as 3.2 (H - 102, or under the transom H - T - 17 - 51).
- Glass by the casement rule: W - 2 x (64 - 11.5) = W - 105; H - (64 - 11.5) - (180 - 11.5) = H - 221.
- No hardware. Seals, beading, bars and consumables as a casement fixed light. Bars: `sideHBars` / `sideVBars` as today.
- Side panels never open, so they never need a threshold of their own; without a timber cill nothing is bought under them (owner answer 15).

### 3.5 Panel (half-glazed and three-quarter leaves)

- Build 2 x 18 Tricoya MDF + MDF core 18 = 54 (`panel.boardThickness`, `panel.boards`, `panel.coreThickness`, unchanged).
- The panel edge is machined down to a tongue 24 thick that sits in the leaf glazing rebate (18 deep) 17 mm in: `panel.inset 17` (new; the glass uses `geometry.glassInset 11.5`). Panel outer size = daylight + 2 x 17 in both directions. Frame 2100 single half-glazed (leaf 798 x 1998, mid rail axis at 999): daylight 610 x 772, glass 633 x 881, panel 644 x 806.
- Edge profile for the drawings and the 3D: `panel.edge: { tongue: 24, slope: 40, flat: 15 }` (assumption: flag): a 24 tongue, a 40 wide slope up to 54, a 15 flat next to the bead. BOM: both boards and the core at the full panel outer size (assumption: flag), beading around the panel perimeter as around a pane (as today).

### 3.6 Thresholds

- `thresholdType 'standard'` (timber): the cill 68 x 93 is timber in the lists; nothing bought.
- `'aluminium'` or `'low-profile'`: the threshold product as today PLUS a new BOM row "Threshold seal" (one length per door opening, in metres, on the door Ironmongery or Consumables list: pick the list the threshold product is on). Add the Assign Materials row.
- Inward door: ALWAYS the timber inward cill 40 / 35 as today. A stored or chosen aluminium / low-profile value on an inward door is ignored by the engine; the sheets print "inward door: timber threshold" in the notes and the configurators show the same note and disable the aluminium / low-profile choices when the direction is inward (assumption on disabling: flag).
- Leaf heights do not depend on the threshold any more (3.2).

### 3.7 Trickle vents on doors

- Count vents for a door assembly with the same rule as a window (`buildVentGrilles` by room type, the `trickleVents` slot), on the BOM and the hardware list. The configurator already shows the vent slot for doors.

### 3.8 Handing

- The configurator value is the handing, PSW convention: `doorHinge 'left'` = hinges on the left seen from INSIDE (right from outside) for an outward door; the inward door keeps the same inside-view meaning. PC prints exactly "Hinge left" / "Hinge right" plus "opens outward" / "opens inward" on the leaf sheet, the hardware list, the BOM detail and the pack. Remove the Winkhaus LH / RH words and "anti-clockwise closing" / "clockwise closing" from every printout (`doorHardware.js` `HANDING_WORDS` and its callers). If the ThunderBolt or FGTE kit itself needs a handed variant for the order, keep the mapping internal and report in `BLOCKERS.md` which variant the engine would pick; do not print it.

### 3.9 Profile schema 3 and migration

- Bump `DEFAULT_DOOR_PROFILE.schema` to 3. New keys: `deductions.leafAtFloor 51`, `deductions.fanFromAxis 65`, `deductions.leafBelowAxis 17`, `geometry.transomLandAbove 8`, `geometry.transomLandBelow 13`, `geometry.gapFanTransom 6`, `geometry.gapBelowTransom 4`, `lengths.transomSeat 8.5`, `panel.inset 17`, `panel.edge {24, 40, 15}`, `sidePanel {64, 64, 180, 57}`, `fixedFan {64, 64, 67}`. Keys no longer read: `couplingPost`, `deductions.fanAtHead`, `deductions.fanAtRail`, `deductions.leafFullHeight`, `deductions.leafNoThreshold`, `lengths.transomDeduct`, `sidePanel.member`.
- `migrateDoorProfile`: a stored schema-2 copy takes the schema-3 defaults for the new keys; a value equal to the old default moves, a hand-edited one is kept (as the schema 1 to 2 migration does). Batch snapshots (`_profileSnapshot.door`) migrate the same way when read.
- `windowProfileStore.js` `DOOR_PATH_ROOTS` and the Window Settings Doors card expose every new key; nothing a tenant could type can grow the profile (keep the existing guard).

### 3.10 Reference numbers (default profile)

| case | leaf W x H | glass W x H | notes |
|---|---|---|---|
| single 900 x 2100, timber cill, outward | 798 x 1998 | 633 x 1747 | was 798 x 2002, glass 633 x 1751 |
| single 900 x 2100, aluminium threshold | 798 x 1998 | 633 x 1747 | was 798 x 2043; threshold product + threshold seal |
| single 900 x 2100, inward | 798 x 1998 | 633 x 1747 | timber inward cill 40 / 35 always |
| single 900 x 2100, half-glazed | 798 x 1998 | 633 x 881 | mid rail axis 999; panel 644 x 806 (daylight 610 x 772 + 2 x 17) |
| french 1600 x 2100 | 2 x 755 x 1998 | 584 x 1747 each | half 749, lip 6, meeting stile 100 |
| french 2400 x 2400, side panels 400 + 400, opening fan T 450 | door leaves 2 x 789 x 1882 | 618 x 1631 each | door zone 1600 between mullion axes: half (1600 - 34) / 2 = 783 |
| the same, side panel light | 332 x 1882 | 227 x 1661 | 400 - 51 - 17 wide; H - T - 17 - 51 |
| the same, fan leaves | over the door 1566 x 385, over each side 332 x 385 | casement rule | 1600 - 34; 400 - 68; 450 - 65 |
| the same with a fixed fan | the same three sizes, no hardware | W - 105, H - 108 | 64 / 64 / 67 non-opening leaves |

The tura derives every row with the live engine and writes the table into `BUILD-LOG.md`; a row that disagrees with this table is a finding to resolve (fix the engine or explain in `BLOCKERS.md`), never a silent re-typing of the table. The transom rail segment lengths, the mullion lengths and the transom visible band come from the casement helper: print them in the table as well.

### 3.11 Sash: bars per sash (owner box 16)

- Today the window record carries `upperBars` and `lowerBars` but `detectGridMode` keeps one pattern (the lower wins) and the sheets, glass rows, beading runs, the glass DXF, the canvas renderer and the 3D put it on both sashes. PSW sends both fields (sometimes only inside the estimate `fullConfig`).
- Required: each sash keeps its own pattern end to end. `normaliseToWindowSpec` reads `upperBars` / `lowerBars` from the item, then from `fullConfig`, then `'none'`. `deriveWindowData` exposes the upper and lower pattern separately (and the bar positions per sash computed over THAT sash's pane). Cut list and pre-cut bar rows, glass rows (bar spacings per unit), beading (Georgian and triangle runs per sash), the glass DXF, `canvas-renderer.js` (h bars spaced over each pane), the sash sheets (`SashDetail2D`, `FrontElevation2D`, `GlassDrawing2D`), the estimate / window PDFs and the 3D (`ParametricSashWindow`, `windowSpecToConfig`) all read the per-sash pattern. Custom bar lists stay per sash and are checked against that sash's own glass (a bar outside its pane is an explicit per-window warning, not a crash).
- A window with the same pattern on both sashes derives byte-identical to today (any key that only reorganises data is listed in `BUILD-LOG.md`). "6 over 1" (upper 2x3 or the PSW six-pane pattern, lower none) must come out on every surface.

### 3.12 Sash: proportion error per window (box 19), pricing field (box 18), dead glazing summary (box 17)

- `SashProportionError` (and `ArchError` where it is caught the same way) is caught per window in `ProjectDetailPage`, `ProductionPackPage` and `WindowDetailPage`: the failing window shows its message on its own card or row and is excluded from the pack lists and PDFs with a visible note; every other window renders. The pack header shows a count of excluded windows.
- Pricing Settings: a field "Cottage sash surcharge" next to "Arched head" bound to `pricing.cottageSash` (default 0.05, stored price lists fall back to it), with the same save path as the arched head field.
- `calculateGlazingSummaryForWindow` and `aggregateComponents`: prove with a repo-wide search (src, verify, docs scripts) and with the harness that no reader exists for `glazingItems`; if so delete them and the `glazingItems` key from `deriveWindowData` output, and re-baseline the fixtures that carried the key (list the diff: the removed key only). If a reader exists, fix the row (one pane height per sash from its daylight) instead of deleting.

### 3.13 Settings save (box 20)

- Today `windowProfileStore.scheduleCloudSave` writes `{ sash, casement, door }` from the tab's memory and `saveWindowProfiles` stores it whole under `settings.constants.windowProfiles`: a tab opened before a change on another computer overwrites that change with its stale copy (this removed the owner's bSuite target on 07.10.2026).
- Required: the store records the paths it changed since its last cloud load at the granularity "profile.firstKey" (for example `casement.bsuite`, `casement.elements`, `door.deductions`, `sash`); the save loads the current cloud copy, overlays ONLY the dirty paths from local memory, writes the merged object, replaces the local copy with the merged result and clears the dirty list. Loading from the cloud happens on app start (as today), on entering the Window Settings page and when the tab regains focus (`visibilitychange`), without clobbering unsaved local edits (dirty paths win locally until saved). `saveWindowProfiles` keeps merging into the other `constants` keys as it does today. No DB change; if a true per-key atomic write needs a migration, write the SQL to `docs/handover/sql/` and say so, but ship the client merge regardless.
- Harness: simulate two tabs (two store instances over a fake cloud object): tab A changes the bSuite target, tab B (loaded earlier) changes a casement face; both save; the cloud holds both changes. A third case: the same path changed in both tabs, the later save wins and `BLOCKERS.md` says so.

### 3.14 Batch type `door` (box 15)

- `createBatch` (and `moveToProduction` if it builds defaults itself) maps type `'door'` to the `doors` defaults of `BATCH_DEFAULTS`; the Batch Defaults page treats both spellings as doors. One mapping, no second copy of the defaults.

### 3.15 Door leaf sheet (box 14)

- The hinge dimensions H1 to H4 on `DoorLeafDetail2D` (stacked on one line today) move to a smaller font and are spread so that no two texts overlap on any leaf height from 1900 to 2400 with 3 or 4 hinges. Add a text-collision check to the door sheet test (approximate each `<text>` by font size x 0.55 x character count, rotated texts by their transform) and apply it to every door sheet in the t41 §18 set.

---

## 4. Work, in this order

### Stage 0: baseline and sweep (no code changes)

1. Run every harness in `verify/arch/t*.mjs` (not the `*baseline*` generators) and `verify/parity/*.mjs` on the starting commit, `npm ci` and `pip install ezdxf` first; restore `docs/handover/samples/` with `git checkout` after the run. Record the pass count per file. `npm run build`.
2. Derive the BEFORE table for the cases of 3.10 with the live engine and keep it.
3. Sweep (read-only agents, disjoint areas): every reader of `couplingPost`, `sidePanel.member`, `fanAtHead`, `fanAtRail`, `leafFullHeight`, `leafNoThreshold`, `transomDeduct`, `zones.transom.band`, `HANDING_WORDS`, `doorHanding`; every place that draws or counts the side panel members, the coupling post, the fanlight; the bars trail for sash (`upperBars`, `lowerBars`, `detectGridMode`, `gridMode`, bar positions, `canvas-renderer`, `glassDxfExport`, beading, 3D); `glazingItems` readers; the window profile save path; `createBatch` / `BATCH_DEFAULTS`. Write the list into the new `BUILD-LOG.md` entry.

### Stage 1: door profile and engine

1. Profile schema 3, keys and migration (3.9); `DOOR_PATH_ROOTS`; Window Settings Doors card.
2. `deriveDoorWindow`: frame per 3.1 (mullions, transom per casement helpers), leaf heights per 3.2, fanlight per 3.3, side panels per 3.4, panel per 3.5, thresholds per 3.6, handing data per 3.8. `derived.door` keeps its shape where nothing changed and gains: `mullions[]` (axis, length, segments), `transom` (axis, rail segments, band from the casement rule), `sidePanels[]` as fixed lights (members 64 / 64 / 180, glass), `fanLeaves[]` for fixed and opening fans with `fixed: true | false`, `panel` with outer size, daylight and edge profile, `threshold` with `{ type, effectiveType, seal }`.
3. The 3.10 table from the live engine: write it into `BUILD-LOG.md` and compare row by row.

### Stage 2: lists, BOM, assign materials

1. Cut list, pre-cut, grouped cut list: mullion rows (casement mullion symbol `M`), transom segments (`T`), side panel light members (stiles and top rail on the casement leaf 64 x 57 rows, bottom rail on the door bottom rail 180 x 57 row), fixed fan members (casement 64 / 64 / 67), panel sizes with the 17 inset. Symbols without a prefix (08.10.2026 rule). Part colours: side panel and fixed fan members join the existing door colour groups (`door_side_panel`, `door_fan`).
2. BOM: timber per the new members; panel boards and core at the outer size; threshold seal row (3.6); trickle vents (3.7); nothing for the coupling post any more.
3. Assign Materials (Doors branch): rows for the mullion, the side panel members (64 x 57 and 180 x 57), the fixed fan members, the threshold seal; defaults equal to the casement counterparts; the pre-cut merges by material as today.
4. Hardware list: handing wording per 3.8; the fixed fan has no hardware; vents per 3.7.

### Stage 3: tests for Stages 1 and 2

1. New `verify/parity/t44_doors_v3.mjs`: every row of 3.10 (leaf, glass, panel, fan, side light, mullion and transom lengths) to 0.01; thresholds (standard, aluminium, low-profile, inward with each) all give leaf H 1998 at 2100; inward ignores aluminium; the threshold seal row appears only for aluminium / low-profile; vents per room type; handing strings; the schema 2 to 3 migration (defaults move, hand edits stay); casement and sash controls deep-equal to the starting commit; the door BOM part quantities for the reference set (write them as the expected values after reading them once, with the reasoning in the test).
2. Update `t41_doors_production.mjs` to the new rules with the reason at every changed assertion; never weaken a check that still holds. `t38` and `t42` door controls likewise.

### Stage 4: sheets and PDFs

1. `DoorFrameDetail2D`: mullions `M` instead of the coupling post, the transom per the casement rule, dimensions from derived. `DoorSidePanelDetail2D`: the fixed light as a casement leaf (64 / 64 / 180). `DoorFanlightDetail2D`: fixed and opening fans. `DoorLeafDetail2D`: the panel edge note and the hinge dimensions per 3.15. `DoorSection2D`: the panel edge profile (tongue, slope, flat) in the plan section, the inward threshold note. `DoorElevation2D`: the new frame.
2. The Elements and Elevations PDFs and the pack mount the same components (no change needed beyond the components themselves): prove it with the t41 §18 render set plus the collision check of 3.15.
3. Samples: regenerate `docs/handover/samples/doors/` renders.

### Stage 5: 3D

1. `doorGeometryFromSpec` and `DoorAssembly.jsx`: mullions instead of the coupling post, side panels as 64 / 64 / 180 lights, fixed fans as 64 / 64 / 67 lights, the transom band from derived, the panel edge profile (a bevelled panel; if the geometry is not done, the flat 54 panel stays and `BLOCKERS.md` says so). The preview and the pack capture rig need no change if they read derived; prove it.
2. `t40_bottom_rail_3d.mjs` section 6 (door meshes): update the pins with the reason.

### Stage 6: sash items

1. Bars per sash (3.11) with a new `verify/parity/t45_sash_bars_per_sash.mjs`: a 1000 x 1400 window upper 2x3 / lower none and upper none / lower 2x2: bar rows, glass rows, beading runs, DXF entities, canvas bar count per pane, sheet texts and the 3D bar meshes per sash; a same-pattern window byte-identical to today; a PSW-style item with bars only in `fullConfig` derives with them.
2. Error per window (3.12) with a harness that mounts the three pages' window lists the way t41 §18 mounts the sheets, or, if a page cannot be mounted in node, the extracted per-window boundary function with a test on it.
3. Pricing field (3.12) and the dead glazing summary (3.12).

### Stage 7: settings save and batch type

1. 3.13 with its harness. 2. 3.14 with a test in the project store harness (`t39` or a new section).

### Stage 8: full suite, build, docs

1. Full suite twice on the final tree, then `npm run build`. Record the pass counts per file. Never weaken or delete an assertion to get a pass; fixtures regenerate only after reading the diff, with the diff summary in `BUILD-LOG.md`.
2. `docs/handover/DOORS-PRODUCTION.md`: rewrite the model table for v3 (one page, the way it is now), `BLOCKERS.md` section 31 with every owner check, `BUILD-LOG.md` entry with the verdict, the before / after tables, the suite counts.

### Stage 9: review and PR

1. Independent review agent per rule 10. Fix findings; record the verdict.
2. PR description: the owner box numbers first, then summary, files changed, suite counts, the items for Piotr.

---

## 5. Items to report to Piotr in `BLOCKERS.md` (short, numbered, section 31)

1. Every ZAŁOŻENIE of the owner box with the number used and where it lives (profile key or constant): transom axis convention, side panel zone convention, fixed fan bottom rail 67, panel edge 24 / 40 / 15, panel boards at the outer size, inward door ignoring aluminium, meeting stile joint unchanged.
2. The casement helper numbers the door now prints: mullion length with and without a timber cill, transom segment lengths, the visible transom band.
3. The kit variant the handing would have picked (ThunderBolt / FGTE), if any handed variant exists.
4. Bars per sash: anything the 3D or a sheet could not do per sash, and the custom bar warning cases.
5. Settings save: the remaining race (same path in two tabs) and whether a DB migration would close it.
6. Anything skipped, with the reason.

---

## 6. Comparison table for the owner (write it in `BUILD-LOG.md`)

Every row of 3.10 plus: single 900 x 2100 three-quarter (glass and panel), french 1600 x 2100 with a fixed fan T 450 (fan light size and glass), a single 1000 x 2100 with one side panel 450 on the right (door leaf, light, mullion length), and the sash 1000 x 1400 "6 over 1" bar rows per sash. Every number from the live engine, not copied from this file.
