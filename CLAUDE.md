# CLAUDE.md — Production Core (Sash-Planner-Web)

## O projekcie

Production Core (PC) to webowy SaaS do planowania produkcji stolarki drewnianej: okna
skrzynkowe (sash), casement, drzwi, fix frame. Repo: `Piotr3009/Sash-Planner-Web`.
Aplikacja jest w aktywnym rozwoju przed startem. Silniki sash / casement / door działają;
fix frame nie ma jeszcze silnika (`emptyDerived`).

**Właściciel:** Piotr — NIE jest programistą. Ty piszesz cały kod, Piotr testuje i ocenia rano.

Trzy osobne produkty, nie duplikować logiki między nimi:
- **PC** — to repo (planowanie produkcji)
- **PSW** — `Prime-Sash-Windows`, konfigurator/wycena dla klienta (tylko do odczytu)
- **JC** — `Joinery-Core-SaaS`, magazyn/dostawcy (osobna subskrypcja, nie ruszać)

---

## TRYB PRACY: AUTONOMIA NOCNA

Zadanie na sesję jest w sekcji **„ZADANIE NOCNE"** niżej, spec w `docs/handover/`. Piotr
zatwierdza cały zakres z góry — **nie czekaj na potwierdzenia** w jego obrębie, poza zakres
nie wychodź.

- Sesja w chmurze na własnym branchu (nazwę nadaje środowisko). **Nigdy nie pushuj na `main`**
  — Piotr merguje rano.
- Commit po każdym zamkniętym zadaniu, push brancha.
- Problem blokujący albo niejasna logika biznesowa → wpis w `BLOCKERS.md`, jedź dalej z resztą.
- Werdykty per zadanie → `BUILD-LOG.md` (nowa sekcja na górze, z datą).
- Harness musi przejść **ALL PASS przed każdym commitem** zadania, którego dotyczy.

Rzeczy z listy „NIE RÓB DZIŚ" (§ niżej) są celowo poza zakresem, nawet jeśli wyglądają na
łatwe do „przy okazji".

---

## REPOZYTORIA

### Sash-Planner-Web — TU PRACUJEMY
```
git -c http.proxyAuthMethod=basic clone --depth 1 https://github.com/Piotr3009/Sash-Planner-Web.git pc
```

### Prime-Sash-Windows — TYLKO DO ODCZYTU, OPCJONALNE
```
git -c http.proxyAuthMethod=basic clone --depth 1 https://github.com/Piotr3009/Prime-Sash-Windows.git psw
```
**NIE edytuj, NIE twórz branchy, NIE pushuj.** Jeśli klon się nie uda (repo prywatne) —
nie proś o token: wszystkie potrzebne liczby z PSW są zacytowane w specyfikacji z plikiem
i linią. Geometrię łuków z PSW **nie portować** — patrz spec §3 (Bézier w 2D,
niewspółśrodkowe łuki w 3D).

---

## KRYTYCZNE ZASADY

1. **Kod, komentarze i copy po angielsku.** Zero polskiego w plikach źródłowych. Commity po angielsku.
2. **Nie zmieniaj istniejących funkcji poza zakresem zadania.** Nowa metoda poza spec = wpis w BLOCKERS, nie kod.
3. **Nigdy nie usuwaj kodu bez uzasadnienia** w BUILD-LOG.
4. **Nie kłam.** Czego nie zrobiłeś — napisz. Werdykt ✅ tylko po harnessie.
5. **Beading (listwy przyszybowe) jest zamrożony** — nie dotykać, także łukowych.
6. **`casementLayouts.js`:** kolejność paneli w definicjach jest 1:1 z PSW (`casementHinges` jest indeksowane po tej kolejności). Nie zmieniać. Nowe kody wymagają tej samej zmiany w PSW i bumpa `CASEMENT_LAYOUTS_VERSION`.
7. **Zustand:** nigdy `get xyz()` w store'ach (psuje hydratację persist).
8. **Rysunki 2D:** wszystkie stałe wizualne z `drawingTheme.js`; mnożnik `sc` tylko do pozycji, nigdy do `fontSize` / `strokeWidth` / `strokeDasharray`. (W tym pakiecie nie ma 2D — zasada na przyszłość.)
9. **Batch:** pole `label` (nie `name`); typ drzwi to `'door'` w liczbie pojedynczej.
10. **Supabase PC:** projekt `teqkuumenoerphfuqijb`, multi-tenant przez `tenant_id`; `user_profiles.id` = `auth.uid()`. SQL nigdy w kodzie aplikacji bez osobnego pliku migracji. **W tym pakiecie nie ma zmian w bazie.**
11. **Numery warsztatowe siedzą w profilu** (`src/engine/profile.js`), nie w kodzie. Łuki czytają `frameHead.face`, `leafTop.face`, `leafAtJamb`, `glassInset` z profilu — nigdy nie wpisuj 57 / 67 / 40 na sztywno (planowana zmiana ramy casement na 68 mm musi przejść bez dotykania modułu łuków).

---

## WERYFIKACJA — obowiązkowa

Każdy dotknięty plik:
```
npx esbuild@0.25.0 <plik.js>  --loader:.js=js   --format=esm --outfile=/dev/null
npx esbuild@0.25.0 <plik.jsx> --loader:.jsx=jsx --jsx=automatic --format=esm --outfile=/dev/null
```
esbuild i Vite **nie łapią niezdefiniowanych identyfikatorów** — po dodaniu importu/hooka
sprawdź `grep` przed commitem. Po każdym zapisie pliku `grep -F` na świeżo wpisany string
(sed/python potrafią zawieść po cichu, a build i tak przejdzie).

Harness (node, katalog `verify/` w repo — commituj go):
```
node verify/arch/t16.mjs
```
Bundluj moduły do `.audit/` przez esbuild (`--bundle --format=esm --external:react`),
asercje na realnych danych z `normaliseToWindowSpec` → `deriveWindowData`. Grep-audyt
to nie dowód. Do DXF round-trip: `pip install ezdxf --break-system-packages`.

Na koniec: `npm run build` przechodzi.

---

## ENGINEERING DISCIPLINE

Dla każdego kroku, po kolei:
1. **Understanding** — przeformułuj krok własnymi słowami.
2. **Context linking** — które moduły to dotyka (engine / cnc / utils / pages).
3. **Acceptance** — co znaczy „gotowe" (wektory testowe ze spec §10).
4. **Think before code** — dwa podejścia, jedno odrzucone z uzasadnieniem. Najprostsze rozwiązanie pierwsze.
5. **Edge cases** — null, 0, W poniżej minimum, rise > W/2, brak deski dopasowanej.
6. **Plan** — numerowana lista, ryzykowne kroki ⚠️.
7. **Implement** — bez niezleconych feature'ów. Jawność > domysły.
8. **Self-review** — jak surowy reviewer.
9. **Multi-pass** — logika → integracja → edge cases.
10. **Verdict** — ✅ / ⚠️ / ❌ z tym, co NIE zostało zweryfikowane. Do BUILD-LOG.

**LOGIC THINKING** przed każdą decyzją: co to jest → do czego należy → co się dzieje
po akcji / błędzie / w edge case → czy ma sens fizycznie dla stolarni → co zmienia gdzie
indziej. Brak sensu = **LOGIC FAILURE** w BLOCKERS, nie koduj tej części.
**Zakaz fałszywej akceptacji**: bez „looks good" przed sprawdzeniem.

**PRECISION DIAGNOSER** przy bugu: mapa flow → pass programisty → pass biznesowy →
weryfikacja własnego wniosku → symulacja na realnych danych → najmniejsza bezpieczna zmiana.
Priorytet: złe wyniki > złamana logika biznesowa > rendering > UX > runtime > edge > wydajność > styl.

---

## Stack

React 19 + Vite · Zustand · Tailwind · React Three Fiber / Three.js (`src/3d`, dzielone
z PSW) · Supabase · jsPDF + jspdf-autotable · SheetJS (xlsx) · własny DXF R12 writer
(`src/engine/cnc/dxfWriter.js`, POLYLINE z bulge, sprawdzony na VCarve). esbuild 0.25.0 do
sprawdzeń. Bez TypeScript.

Skrypty: `npm run dev` · `npm run build` · `npm run preview`.

## Struktura (stan faktyczny)

```
src/
├── engine/
│   ├── calculations.js      # deriveWindowData → deriveSashWindow / deriveCasementWindow / deriveDoorWindow
│   ├── specification.js     # normaliseToWindowSpec (PSW fullConfig → windowSpec)
│   ├── profile.js           # DEFAULT_*_PROFILE — wszystkie numery warsztatowe
│   ├── casementLayouts.js   # kody layoutów 1:1 z PSW (nie ruszać kolejności paneli)
│   ├── casementHardware.js  # dobór okuć (limity per skrzydło)
│   ├── lists.js             # cut list: CUT_LIST_ORDER, MIRROR_PAIRS, grupowanie
│   ├── bom.js · pricing.js · partRegistry.js · partSymbols.js · optimizer.js
│   └── cnc/
│       ├── dxfWriter.js     # R12 serialiser: {poly|circle|text}, bulge
│       └── jambDxf.js       # port 1:1 KIT_SASH_JAMB.lsp — WZORZEC dla archDxf.js
├── components/drawings/     # arkusze 2D (SVG), drawingTheme.js, drawingUtils.jsx
├── pages/                   # ConfiguratorPage, WindowDetailPage, ProductionPackPage, ...
├── stores/                  # Zustand (projectStore, estimateStore, ...)
├── utils/                   # eksporty: cncExport.js, *PdfExport.js, excelExport.js
└── 3d/                      # R3F (identyczne z PSW/3d-src)
docs/handover/               # specyfikacje pakietów
verify/                      # harnessy node (commitowane)
```

Zasada architektury: **`deriveWindowData()` jest jedynym źródłem prawdy per okno** —
karmi cut listę, PDF-y, rysunki, PP. Nigdy nie licz wymiarów okna w innym miejscu.

---

## STAN — arched-casement-v1 zamknięty (noce 1–2, na `main`), v2 noc 3 zrobiona (branch)
v1: geometria (`src/engine/arch.js`), planer desek, CNC DXF (`archDxf.js`), harnessy t16/t17.
v2 noc 3 (branch `claude/arched-casement-v2-impl-0j27uw`, 06.09): model kształtów v2 (P1 reguła C,
`segmental` usunięty, Round → półkole / trójłuk z `minHaunchRadius` 150), konfigurator Round | Gothic
z polem „Arch starts at", silnik z `C-ARCH HEAD` / `C-ARCH TOP RAIL`, szyba jako kształt, pręty
(proste + wzory PSW), eksporty dla szklarza (DXF + PDF), harness `verify/arch/t18.mjs`.
Werdykty w `BUILD-LOG.md` (sekcja 06.09 noc 3), otwarte pytania w `BLOCKERS.md §9`.
Spec: `docs/handover/ARCHED-CASEMENT-v2.md` (+ v1, v1-AUDIT jako historia).

## ZADANIE NOCNE 4 — arched-casement-v2, część D + E + F (po mergu nocy 3)

Spec: `@docs/handover/ARCHED-CASEMENT-v2.md` §4. Czytasz w całości, potem BUILD-LOG (noc 3)
i BLOCKERS §9. Zakres — TYLKO:
- **D** arkusze 2D (`CasementElevation2D`, `CasementFrameDetail2D`, `CasementLeafDetail2D`,
  `CasementGlassDrawing2D`): łuki z ArcChain (`derived.arch.geometry`, `derived.arch.glassOutline`,
  `derived.arch.bars`) jako SVG `A`, nigdy Bézier; wymiary W, H, start, rise, każdy promień;
  okna proste bajt-w-bajt identyczne (snapshot).
- **E** pręty: rysunek 2D + wymiary końców na łuku (silnik i eksporty już są z nocy 3).
- **F** 3D: przepisanie `ArchedCasementWindow.jsx` na `arch.js` (nazwy propsów PSW + `archRise`,
  `archProfile`, `barPattern`), `windowSpecToConfig.js` i `update3D` przekazują nowe propsy;
  `docs/handover/PSW-3D-ARCH-PORT.md`.
- harness `verify/arch/t19.mjs` (spec §4); t16/t17/t18 nadal ALL PASS.

Nie ruszaj `casementLayouts.js`, beadingu, listy „NIE RÓB DZIŚ". Otwarte w BLOCKERS §9:
P9 (900), D13, minimalna długość kawałka (9.3), F2 (rise > 150).

## NIE RÓB DZIŚ (zaplanowane, osobne pakiety)

- Drzwi: ramiaki skrzydła 92 mm zamiast 94 (materiał 014); próg 4 zawiasów > 2100 mm.
- Casement: jamby i head 68 mm zamiast 57 (razem z PSW + bump wersji layoutów).
- Cut list / szyby / 2D / 3D dla łuków, sash i fix frame łukowe, nadświetla łukowe drzwi, wzory prętów w łukach.
- Listwy przyszybowe: moduł beading SASH jest zamrożony; casement nie ma listew w silniku W OGÓLE (także proste) — nie wymyślaj rekordów beading dla casement, to osobny pakiet z przekrojem z profilu.
- `EstimateConfiguratorPage.jsx` limit 3000 mm (nierozstrzygnięte).
- Mullions/ślemienia casement nie trafiają do cut listy (`components.box`) — znana luka silnika, nie tego pakietu.
- Łuki: zmiana nazw kształtów na `'gothic'` + `profile` (spec §3.4), typy linii (DASHED) w
  `dxfWriter.js`, złącze głowica/ościeżnica i skrzydło/słupek na linii startu łuku (haunch),
  BOM z desek planera zamiast długości łuku (BLOCKERS 9.10), pełna listwa na linii startu
  w hub-spoke (9.7), pionowe pręty użytkownika przy hubach (9.6), `minPieceLength` (9.3),
  paginacja tabeli w glass PDF przy wielu kształtowych szybach — osobne pakiety.

---

## Pliki do utrzymywania

- `CLAUDE.md` — ten plik; aktualizuj sekcję „ZADANIE NOCNE" i „NIE RÓB DZIŚ" po każdym pakiecie
- `docs/handover/*.md` — specyfikacje pakietów (nie kasować po wdrożeniu — to historia decyzji)
- `BUILD-LOG.md` — werdykty per krok, najnowsze na górze
- `BLOCKERS.md` — pytania do Piotra, LOGIC FAILURE, CRITICAL AMBIGUITY

## Checklist na koniec sesji

- [ ] branch sesji wypchnięty, `main` nietknięty
- [ ] `node verify/arch/t16.mjs`, `node verify/arch/t17_edges.mjs`, `node verify/arch/t18.mjs` → ALL PASS
- [ ] `npm run build` przechodzi
- [ ] esbuild OK na każdym dotkniętym pliku, zero polskiego w źródłach
- [ ] `git diff main --stat` obejmuje TYLKO pliki ze spec §11 (+ verify, docs, BUILD-LOG, BLOCKERS, CLAUDE.md)
- [ ] `docs/handover/samples/sample_arch_1200_*.dxf` (pięć: semi-circle, gothic ×2, three-centre 390 i 240) + `sample_glass_*.dxf` w repo
- [ ] BUILD-LOG.md z werdyktami, BLOCKERS.md z D13 / D5 / d50 otwartymi + wszystkim, co wyszło w nocy
