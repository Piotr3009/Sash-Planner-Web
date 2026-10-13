# Triple sash: strona okna, pack, PDF, luz 6 mm na skrzydło, listwa mulliona 90 od zewnątrz, otwieranie (13.10.2026, chat fix, main 94ba0a6)

Zastępuje paczki z 17:03 i 18:15 (ta ma wszystko z tamtych plus listwę 90 i otwieranie).

Rozpakuj do katalogu repo (pliki leżą w swoich ścieżkach, nadpisz), potem:

    git checkout main
    git pull
    git checkout -b claude/triple-sash-1310
    git add -A
    git commit -m "Triple sash: own running gap per sash, external mullion board 90, middle section bottom-only opening, window page / pack / PDFs show the triple (t47)"
    git push -u origin claude/triple-sash-1310

i PR do main (albo od razu na main, jak wolisz).

## Reguły (Twoje odpowiedzi z 13.10)

1. Skrzydła: światło między listwami wewnętrznymi (rama minus 2 x 86) minus 2 mulliony po 50 = otwory sekcji z podziału
   (lewy / prawy do 0.5 mm, środek bierze resztę), każde skrzydło = otwór minus 6 (178 minus 172, jak w double).
   2000: otwory 432 / 864 / 432, skrzydła 426 / 858 / 426, szkło 335 / 767 / 335. Wysokości jak w double. Mullion 50.
2. Mullion od zewnątrz: deska 50 + 20 + 20 = 90, 17 grubości, z wycięciami u dołu (kształt z 3D). Rysowana na elewacji
   i na Box External; Box Internal pokazuje słupek 50. Klucz profilu elements.mullion.extFace 90. Bez wiersza w cut liście
   (pytanie w BLOCKERS 32.5: osobna część i jaka długość).
3. Otwieranie: triple otwiera tylko środkową sekcję, tylko dolne skrzydło. Silnik wymusza openingType bottom
   (okucia: 2 bloczki zamiast 4), wydruki piszą "middle section only, bottom only" (pack overview ekran i PDF,
   estimate PDF, oba konfiguratory zamiast chipsów).

## Pliki (26)

- src/engine/calculations.js: tripleSectionWidths wg reguły 1; derived.tripleSections: openings, gap, clear, mullionExtFace
- src/engine/profile.js: elements.mullion.extFace 90 (+ uzupełnienie w zapisanych profilach)
- src/engine/specification.js: TRIPLE_OPENING_TYPE / LABEL, sashOpeningLabel, wymuszony openingType bottom dla triple
- src/utils/windowSpecToConfig.js: sashType i splitRatio z windowSpec (było na sztywno 'double')
- src/3d/components/ParametricSashWindow.jsx: gizmo osi w triple tylko przy showGuides
- src/components/drawings/tripleDrawUtils.js (NOWY): prawo układu (skrzydła, słupki, deska 90 i jej kształt)
- src/components/drawings/FrontElevation2D.jsx, BoxDetail2D.jsx: trzy sekcje, słupki 50 + deska 90 od zewnątrz, łańcuch otworów, podtytuły
- src/components/drawings/SashDetail2D.jsx, GlassDrawing2D.jsx: prop section (arkusz jednej sekcji)
- src/utils/elementsPayload.js, src/components/drawings/DrawingsPanel.jsx, src/pages/WindowDetailPage.jsx, src/pages/ProductionPackPage.jsx: arkusze i szyby per sekcja, overview z etykietą otwierania
- src/utils/estimatePdfExport.js, src/pages/ConfiguratorPage.jsx, src/pages/EstimateConfiguratorPage.jsx: etykieta otwierania triple
- verify/parity/t47_triple_sash.mjs (NOWY): 117 sprawdzeń
- verify/parity/t43_sash_proportions.mjs, t38, t41, t44: kontrole z zapisanym powodem (START dostaje żywą regułę podziału i klucz profilu; profil domyślny równy poza extFace)
- verify/arch/fixtures/rect-sash-sheets.json, rect-sash-base.json: tylko przypadek triple_6x6 (diff w BUILD-LOG)
- BUILD-LOG.md, BLOCKERS.md: wpisy 13.10 (sekcja 32: otwarte 32.1 szprosy, 32.5 listwa jako część, 32.6 beading i zamki)

Suite: 34 harnessy, 4283 sprawdzeń, 0 błędów. npm run build OK.
