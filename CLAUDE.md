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

## STAN — noc 6 (v4) w toku na branchu sesji: Etap 1 (Blok C, planer v2) ✅ t25 · Etap 2 (Blok B, PDF szklarza) ✅ t26 · Etap 3 (Blok E, intersecting z prętów) ✅ t20_bars — t16–t26 ALL PASS, build OK
Planer v2: cały łańcuch dzielony po długości łuku (kawałki przez granice łuków, gotyk w wierzchołku, koło jako
jeden zamknięty pierścień), dwa twarde limity `cnc.minClampLength 450` / `arch.minPieceLength 400`, deski
`63…200`, najmniej kawałków + alternatywa ekonomiczna (`arch.wasteThreshold 0.45`), koniec surowego kawałka na
linii startu cięty PROSTOPADLE (`Q`, CNC frezuje czoło), warstwa `CLAMPS`, karta „CNC & arches" w Window Settings.
Skutki limitów (uczciwie raportowane, BLOCKERS §16): gotyk 1000 skrzydło, koło 800 skrzydło, sash 1000 głowica,
W 400 — bez planu (eksport pomija z powodem). Niezależny planer harnessów: `verify/arch/lib/indPlanner.mjs`.
PDF szklarza v4: komórka = rysunek na max skali, tytuł + spec pod nim, łańcuch prętów na dole, szerokość na górze,
same ID; strony prętów na końcu (miniaturka okna + tabela ID · s od wierzchołka / pozycja · L · kąt / R), A3/A4
z ustawienia paczki; prostokąty bajt w bajt jak przed (t26). Otwarte: BLOCKERS §17.
Intersecting v4: pręty pionowe do linii startu (0 → kolumny ±¼), z każdego szczytu dwa łuki o promieniu łuku SZKŁA
(półkole 405.5, gotyk 905.5 — spec „R = 1000" to promień ramy, errata E4), bez pręta na linii startu; klucze
`arch.patterns.intersecting` usunięte z profilu. Otwarte: BLOCKERS §18.

## STAN poprzedni — łuki: casement + sash + okna stałe + archiwum (noce 1–5), paczka arch-pieces-v1 (06.09) na `main`
Kawałki łuków = proste trapezy (PIECES) i sklejony blank (ASSEMBLY), długość surowa = krawędź
deski + palec; traceria do drewna (`glazingRebate 18`); Pre-Cut per kawałek; wymiary: odległości
prętów na dole, całość na górze; LSP usunięty. Harnessy t16–t24 ALL PASS. Spec historyczne:
`docs/handover/ARCHED-CASEMENT-v1/v2.md`, `ARCHED-WINDOWS-v3.md`.

## ZADANIE NOCNE 6 — ARCHED-WINDOWS-v4: cztery bramkowane etapy w jedną noc

Spec: `@docs/handover/ARCHED-WINDOWS-v4.md`. Czytasz w całości; przy rozbieżności ze starszymi
wygrywa v4. Zanim ruszysz, sprawdź, że paczka arch-pieces-v1 jest na `main`:
`grep -c pieceStockTrapezoid src/engine/arch.js` > 0, `grep -c glazingRebate src/engine/profile.js`
> 0, brak przycisku „Tracery LSP". Jeśli nie — STOP, wpis w BLOCKERS, koniec sesji.

**Etapy — następny startuje TYLKO po ALL PASS poprzedniego i zielonym `npm run build`:**
1. **Blok C — planer kawałków v2:** dwa limity (`cnc.minClampLength 450` na całą długość,
   `arch.minPieceLength 400` na krótszą krawędź, oba twarde), deski `63 75 95 105 120 150 180 200`,
   kawałki przez granice łuków (haunch + korona w jednym), gotyk dzielony w wierzchołku, reguła
   ekonomiczna z progiem odpadu, warstwa `CLAMPS` (Uniclamp 130 × 130, nie ssawki), karta
   „CNC & arches" w Window Settings.
   Bramka: t25 z wektorami ze spec C.5 (policzone niezależnie) + t16–t24.
2. **Blok B — PDF szklarza:** rysunek na całą komórkę, tabele prętów na osobnych stronach na końcu
   z miniaturką okna i nazwą; na rysunku same ID. Bramka: t26.
3. **Blok E — intersecting z prętów pionowych** (reguła z PSW sash, jeden silnik dla casement /
   sash / stałych). Bramka: t20_bars, t22, t23.
4. **Blok F — rama 68 wszędzie (opcja B):** face 68, land 47, `leafAtJamb 51`, cill bez zmian,
   słupek drzwi 136, `casementLayouts` FRAME_FACE + bump wersji, 3D z profilu, instrukcja portu
   do PSW. Bramka: wszystkie harnessy z wektorami przeliczonymi Z WZORÓW (nie z kodu), snapshoty
   casement/drzwi przebazowane z wpisem starych i nowych liczb w BUILD-LOG.

Etap nie przechodzi — naprawiasz, nie przeskakujesz. Kończą się możliwości — zamykasz etap czysto,
werdykt, BLOCKERS, koniec.

Bez LISP-a, bez rekordów listew, `casementLayouts.js` tylko stała FRAME_FACE + wersja, drzwi tylko
face/słupek. Sesja w chmurze, własny branch, commit + push po każdym zamkniętym punkcie. Każde
**DEFAULT (open)** = wpis w BLOCKERS.

## NIE RÓB DZIŚ (zaplanowane, osobne pakiety)

- Drzwi: ramiaki skrzydła 92 mm zamiast 94 (materiał 014); próg 4 zawiasów > 2100 mm.
- Casement: jamby i head 68 mm zamiast 57 (razem z PSW + bump wersji layoutów).
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
- [ ] `node verify/arch/t16.mjs` … `t26.mjs` (t16, t17_edges, t18, t19, t20, t20_bars, t21, t22, t23, t24_stage4, t25, t26) → ALL PASS (t16 / t18 / t19 / t20 / t22 / t23 / t25 wymagają `pip install ezdxf --break-system-packages`)
- [ ] `npm run build` przechodzi
- [ ] esbuild OK na każdym dotkniętym pliku, zero polskiego w źródłach
- [ ] `git diff main --stat` obejmuje TYLKO pliki ze spec §11 (+ verify, docs, BUILD-LOG, BLOCKERS, CLAUDE.md)
- [ ] `docs/handover/samples/`: `sample_arch_1200_*.dxf` (pięć), `sample_arch_c5_*.dxf` (cztery, wektory C.5), `sample_glass_*.dxf`, `sample_tracery_*.dxf` (+ stare `.lsp` z nocy 5), `sample_sash_arch_1200_*.dxf` (trzy), `sample_circle_1000_sunburst.dxf` (CNC; 800 tylko glass / tracery — pierścień skrzydła 800 blokuje limit 400), `sample_glass_order_arched.pdf` + `_a3.pdf` (układ v4) w repo
- [ ] BUILD-LOG.md z werdyktami, BLOCKERS.md z D5 / d50 / P9 / F2 otwartymi (D13 zamknięty przez v4 C.3/C.4) + §11–§15 (noc 5) + §16 (noc 6, etap 1) + wszystkim, co wyszło w nocy
