# Triple sash na stronie okna, w packu i w PDF (13.10.2026, chat fix, main 94ba0a6)

Rozpakuj do katalogu repo (pliki leza w swoich sciezkach, nadpisz), potem:

    git checkout main
    git pull
    git checkout -b claude/triple-sash-1310
    git add -A
    git commit -m "Triple sash on the window page, the pack and the PDFs (3D config, sheets per section, t47)"
    git push -u origin claude/triple-sash-1310

i PR do main (albo od razu na main, jak wolisz).

## Pliki (15)

- src/utils/windowSpecToConfig.js: sashType i splitRatio z windowSpec (bylo na sztywno 'double'): 3D na stronie okna, w packu i w PDF 3D
- src/3d/components/ParametricSashWindow.jsx: gizmo osi X/Y/Z w triple tylko przy showGuides (konfigurator bez zmian, strona okna bez gizma)
- src/components/drawings/tripleDrawUtils.js (NOWY): jedno prawo ukladu sekcji FIX L / C / FIX R i mullionow z derived.tripleSections
- src/components/drawings/FrontElevation2D.jsx: trzy sekcje, dwa mulliony, lancuch 431 / 50 / 861 / 50 / 430, szprosy tylko na srodku (jak 3D)
- src/components/drawings/BoxDetail2D.jsx: dwa slupki MULLION (L) / (R) 50 x 1392 i ten sam lancuch
- src/components/drawings/SashDetail2D.jsx, GlassDrawing2D.jsx: prop section (arkusz skrzydla / szyby jednej sekcji); bez propa jak dotad, bajt w bajt
- src/utils/elementsPayload.js: plan Elements dla triple = box + 6 arkuszy skrzydel
- src/components/drawings/DrawingsPanel.jsx: zakladki Upper / Lower po 3 arkusze, rig PDF po kluczach planu
- src/pages/WindowDetailPage.jsx: 6 rysunkow szkla dla triple
- src/pages/ProductionPackPage.jsx: 7 kart Elements, 6 kart Glass, modal z sekcja
- verify/parity/t47_triple_sash.mjs (NOWY): 95 sprawdzen (silnik, prawo ukladu, config 3D i meshe, arkusze, plan, strony w przegladarce, kontrole double bajt w bajt)
- verify/arch/fixtures/rect-sash-sheets.json: przypadek triple_6x6, tylko elevation i box (rysowaly triple jako double)
- BUILD-LOG.md, BLOCKERS.md: wpisy 13.10 (sekcja 32: pytania do Ciebie)

Suite: 34 harnessy, 4259 sprawdzen, 0 bledow. npm run build OK.
