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
11. **Numery warsztatowe siedzą w profilu** (`src/engine/profile.js`), nie w kodzie. Łuki czytają `frameHead.face`, `leafTop.face`, `leafAtJamb`, `glassInset` z profilu — nigdy nie wpisuj 68 / 67 / 51 na sztywno (rama 68 weszła 06.09 bez dotykania `arch.js`; bramka grep w `verify/arch/t27.mjs` §8). Rama casement i drzwi: face **68**, rebate 21, land 47, `leafAtJamb` 51 (casement), słupek drzwi 136; 3D dostaje `frameDims` z profilu (`windowSpecToConfig.js`), stałe 57 / 36 w `src/3d` to tylko domyślne PSW.

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

## STAN — noce 1–7 na `main` / na branchu nocy 7 (łuki casement/sash/stałe, archiwum, planer v2, PDF szklarza, rama 68, gothic-full, glass DXF wszystkich szyb, wymiary, drzwi opcja B)
Noce 1–6 + `arch-pieces-v1` + `gothic-full-v1` (e037020) są na `main`. Noc 7 siedzi na branchu
`claude/zadanie-nocne-7-glass-dxf-wb0eay` (5 commitów, do zmergowania rano).
Harnessy t16–t29 ALL PASS (1822 checks). Spec historyczne w `docs/handover/`.

## WYNIK NOCY 7 (06.09) — cztery etapy zamknięte + jeden punkt z BLOCKERS

1. **Glass DXF: wszystkie szyby** — `glassUnitsForWindow()`, kontur 4 linie, oblamówka z profilu (11),
   pasy 18 z osiami, teksty z pozycjami prętów od dolnych narożników; reguła prętów ta sama co w glass PDF.
   Bramka **t28** (50). Kształtowe bajt w bajt; łukowy sash urósł o dolną szybę (zamierzone).
2. **Wymiary spójnie** — chain na dole, wymiar całkowity na górze, wysokości po prawej w Leaf / Frame /
   FrontElevation / SashDetail / GlassDrawing; Box już spełniał regułę, Elements dziedziczy z komponentów.
   Nowa bramka `verify/arch/lib/dimRule.mjs` w t19 / t22 / t27. Każdy viewBox bez zmian → skala bez zmian.
3. **Drzwi opcja B** — land 43, leafAtJamb 47, leafFullHeight 94, leafNoThreshold 53; skrzydło 1000 → 906,
   french 1200 → 2 × 556. Bramka **t27** (87), tabela stare/nowe liczona przez harness z drzewa d733414.
4. **Kontrola 3D** — **t29** (34): łuki to prawdziwe łuki z `arch.js`, pierścienie od 68/47, `Kind: Fixed`
   zostaje łukowy, drzwi 68/43 i słupek 136. **Nie zmieniono żadnego pliku 3D.**
5. **BLOCKERS §19.6 zamknięty** — C.5b (tabela dla ramy 68) w specyfikacji, bramkowana t25 §2c.

**Otwarte po nocy 7 (BLOCKERS §24) — wymagają decyzji Piotra, NIE kodować bez niej:**
- **§24.1** koło w 3D idzie do `fix-only` bez `frameDims`; `FixFrameWindow` ma własne `FRAME_FACE 64`.
  Pytanie: rama koła to 68 (casement) czy 64 (fix-frame)?
- **§24.2** skrzydło w 3D jest 4 mm niższe (1398 vs 1402): 3D trzyma skrzydło 51 nad dołem ramy
  (cokół liczony jak ościeżnica), profil mówi 47 (gapCill 6 + cillVisible 41). Błąd sprzed ramy 68.
  Pytanie: który model cokołu jest prawdziwy?
- **§24.3** screen „3D kwadratowe" nie dotarł — nic nie było oglądane w przeglądarce.


## NIE RÓB DZIŚ (zaplanowane, osobne pakiety)

- Drzwi: ramiaki skrzydła 92 mm zamiast 94 (materiał 014); próg 4 zawiasów > 2100 mm.
- Snapshot profilu per projekt (BLOCKERS 19.3) — dziś każde okno liczy się na żywo z aktywnego profilu
  (po nocy 7 dotyczy też drzwi: skrzydło 920 → 906).
- Reguła ekonomiczna C.4 „AND niższy odpad" (BLOCKERS 19.5). [C.5 dla ramy 68 = zrobione w nocy 7, C.5b.]
- 3D: rama koła i model cokołu (BLOCKERS §24.1 / §24.2) — obie zmiany ruszają plik dzielony z PSW, czekają na decyzję.
- PSW: port ramy 68 (`PSW-FRAME-68-PORT.md`) — repo tylko do odczytu z PC, Piotr robi sam.
- Nadświetla łukowe drzwi; drzwi / sliding / bifold / front door poza zakresem (Piotr 07.09).
- Listwy przyszybowe: moduł beading SASH zamrożony (także łukowe — 12.5, 13.5); casement nie ma listew
  w silniku W OGÓLE — osobny pakiet z przekrojem z profilu.
- `EstimateConfiguratorPage.jsx` limit 3000 mm (nierozstrzygnięte).
- Mullions/ślemienia casement nie trafiają do cut listy (`components.box`) — znana luka silnika.
- Łuki: zmiana nazw kształtów na `'gothic'` + `profile` (spec §3.4), typy linii (DASHED) w `dxfWriter.js`,
  złącze głowica/ościeżnica i skrzydło/słupek na linii startu łuku (haunch), pełna listwa na linii startu
  w hub-spoke (9.7), pionowe pręty użytkownika przy hubach (9.6), paginacja tabeli w glass PDF.
- Okno stałe `directGlazed` (14.1), FD30 / FD60 (14.9), offset sunburst per okno w konfiguratorze (14.5).
- Sash glazing arch (`headType 'arch'`) — poza silnikiem do decyzji Piotra (15.1).

## Pliki do utrzymywania

- `CLAUDE.md` — ten plik; aktualizuj sekcję „ZADANIE NOCNE" i „NIE RÓB DZIŚ" po każdym pakiecie
- `docs/handover/*.md` — specyfikacje pakietów (nie kasować po wdrożeniu — to historia decyzji)
- `BUILD-LOG.md` — werdykty per krok, najnowsze na górze
- `BLOCKERS.md` — pytania do Piotra, LOGIC FAILURE, CRITICAL AMBIGUITY

## Checklist na koniec sesji

- [ ] branch sesji wypchnięty, `main` nietknięty
- [ ] `node verify/arch/t16.mjs` … `t29.mjs` (t16, t17_edges, t18, t19, t20, t20_bars, t21, t22, t23, t24_stage4, t25, t26, t27, t28, t29) → ALL PASS (t16 / t18 / t19 / t20 / t22 / t23 / t25 wymagają `pip install ezdxf --break-system-packages`; fixtures prostokątne przebazowuje się TYLKO przy zamierzonej zmianie liczb: `node verify/arch/rect_casement_baseline.mjs` + `node verify/arch/t19_baseline.mjs live`, z wpisem starych i nowych liczb w BUILD-LOG)
- [ ] `npm run build` przechodzi
- [ ] esbuild OK na każdym dotkniętym pliku, zero polskiego w źródłach
- [ ] `git diff main --stat` obejmuje TYLKO pliki ze spec §11 (+ verify, docs, BUILD-LOG, BLOCKERS, CLAUDE.md)
- [ ] `docs/handover/samples/`: `sample_arch_1200_*.dxf` (pięć), `sample_arch_c5_*.dxf` (pięć — od ramy 68 także `1000_gothic-equilateral`, bo skrzydło gotyku 1000 się planuje), `sample_glass_*.dxf`, `sample_tracery_*.dxf` (+ stare `.lsp` z nocy 5), `sample_sash_arch_1200_*.dxf` (trzy), `sample_circle_1000_sunburst.dxf` (CNC; 800 tylko glass / tracery — pierścień skrzydła 800 blokuje limit 400), `sample_glass_order_arched.pdf` + `_a3.pdf` (układ v4) w repo — wszystkie z profilu 68
- [ ] BUILD-LOG.md z werdyktami, BLOCKERS.md z D5 / d50 / P9 / F2 otwartymi (D13 zamknięty przez v4 C.3/C.4) + §11–§15 (noc 5) + §16–§19 (noc 6) + wszystkim, co wyszło w nocy
