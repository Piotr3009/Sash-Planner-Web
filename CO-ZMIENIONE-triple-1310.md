# Triple sash: strona okna, pack, PDF i reguła luzu 6 mm na skrzydło (13.10.2026, chat fix, main 94ba0a6)

Zastępuje paczkę productioncore-triple-sash-1310-1703.zip (ta ma wszystko z tamtej plus poprawkę silnika).

Rozpakuj do katalogu repo (pliki leżą w swoich ścieżkach, nadpisz), potem:

    git checkout main
    git pull
    git checkout -b claude/triple-sash-1310
    git add -A
    git commit -m "Triple sash: every sash takes its own running gap (double-hung rule), window page, pack and PDFs show the triple (3D config, sheets per section, t47)"
    git push -u origin claude/triple-sash-1310

i PR do main (albo od razu na main, jak wolisz).

## Reguła silnika (Twoje odpowiedzi 1 do 3)

Światło między listwami wewnętrznymi (rama minus 2 x 86) minus 2 mulliony po 50 = otwory sekcji z podziału
(lewy / prawy do 0.5 mm, środek bierze resztę), każde skrzydło = otwór minus 6 (178 minus 172, jak w double).
2000: otwory 432 / 864 / 432, skrzydła 426 / 858 / 426, szkło 335 / 767 / 335. Wysokości jak w double. Mullion 50.
Przedtem: 431 / 861 / 430 (jeden luz 6 na całe okno).

## Pliki (18)

- src/engine/calculations.js: tripleSectionWidths wg reguły wyżej; derived.tripleSections ma dodatkowo openings, gap, clear
- src/utils/windowSpecToConfig.js: sashType i splitRatio z windowSpec (było na sztywno 'double'): 3D na stronie okna, w packu i w PDF 3D
- src/3d/components/ParametricSashWindow.jsx: gizmo osi X/Y/Z w triple tylko przy showGuides (konfigurator bez zmian, strona okna bez gizma)
- src/components/drawings/tripleDrawUtils.js (NOWY): jedno prawo układu (skrzydła i mulliony od krawędzi światła: 3, skrzydło, 3, mullion, ...)
- src/components/drawings/FrontElevation2D.jsx: trzy skrzydła, dwa mulliony, łańcuch otworów 432 / 50 / 864 / 50 / 432, szprosy tylko na środku (jak 3D), podtytuł ze skrzydłami i luzem
- src/components/drawings/BoxDetail2D.jsx: dwa słupki MULLION (L) / (R) 50 x 1392, ten sam łańcuch, podtytuł
- src/components/drawings/SashDetail2D.jsx, GlassDrawing2D.jsx: prop section (arkusz skrzydła / szyby jednej sekcji); bez propa jak dotąd, bajt w bajt
- src/utils/elementsPayload.js: plan Elements dla triple = box + 6 arkuszy skrzydeł
- src/components/drawings/DrawingsPanel.jsx: zakładki Upper / Lower po 3 arkusze, rig PDF po kluczach planu
- src/pages/WindowDetailPage.jsx: 6 rysunków szkła dla triple
- src/pages/ProductionPackPage.jsx: 7 kart Elements, 6 kart Glass, modal z sekcją
- verify/parity/t47_triple_sash.mjs (NOWY): 101 sprawdzeń (reguła silnika, układ, config 3D i meshe, arkusze, plan, strony w przeglądarce, kontrole double bajt w bajt)
- verify/parity/t43_sash_proportions.mjs: START dostaje żywą tripleSectionWidths, kontrole triple dalej bajt w bajt (237 / 237)
- verify/arch/fixtures/rect-sash-sheets.json, rect-sash-base.json: tylko przypadek triple_6x6 (diff opisany w BUILD-LOG)
- BUILD-LOG.md, BLOCKERS.md: wpisy 13.10 (sekcja 32: 32.1 szprosy w triple nadal otwarte, 32.2 i 32.3 zamknięte Twoimi odpowiedziami)

Suite: 34 harnessy, 4265 sprawdzeń, 0 błędów. npm run build OK.
