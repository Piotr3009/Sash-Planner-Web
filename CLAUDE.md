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

Zadanie na tę sesję: **pakiet `arched-casement-v1`** — pełna specyfikacja w
`@docs/handover/ARCHED-CASEMENT-v1.md`. Piotr zatwierdził cały zakres z góry.
**Nie czekaj na potwierdzenia** w obrębie tego zakresu. Poza zakresem — nie wychodź.

- Branch roboczy: `claude/arched-casement-v1` (od `main`). **Nigdy nie pushuj na `main`.**
- Commit po każdym zamkniętym kroku (geometria → planer → DXF → eksport → UI), push brancha.
- Problem blokujący albo niejasna logika biznesowa → wpis w `BLOCKERS.md`, jedź dalej z resztą.
- Werdykty per krok → `BUILD-LOG.md` (nowa sekcja na górze, data 2026-09-05).
- Harness musi przejść **ALL PASS przed każdym commitem** kroku, którego dotyczy.

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

## ZADANIE NOCNE — arched-casement-v1

**Stan po nocy 05.09.2026 (branch `claude/arched-casement-v1`, werdykt ⚠️):** pakiet
zbudowany w całości, ALE plik spec `docs/handover/ARCHED-CASEMENT-v1.md` nie istnieje w repo
(ani w żadnym branchu / Petros / Drive / Gmail). Wszystkie liczby spoza CLAUDE.md i źródeł PSW są
założeniami — lista w `BLOCKERS.md` (sekcja 2026-09-05), opis wykonania w
`docs/handover/ARCHED-CASEMENT-v1-AS-BUILT.md`. **Następny krok: wgrać spec do
`docs/handover/`, podmienić tabele `EXPECTED` w `verify/arch/t16.mjs` na wektory §10 i puścić
harness** — dopiero wtedy werdykt może być ✅.

Zakres (wg CLAUDE.md, zrealizowany):

1. `src/engine/arch.js` — geometria (1 / 2 / 3 środki, współśrodkowe offsety, clip do linii
   startu łuku, długości, bulge) + planer segmentów (metoda rzutowania, D13 domyślny wybór).
2. `src/engine/cnc/archDxf.js` — warstwy CONTOUR / ASSEMBLY / PIECES / FINGER / TEXT, rama
   + skrzydło, styl 1:1 z `jambDxf.js`.
3. `profile.js` — sekcja `arch` w profilu casement (spec §5).
4. `specification.js` — `windowSpec.arch` + mapowanie pól PSW (odwrócony zawias w formularzu
   PSW obsłużony — wartość jest odwracana przy odczycie).
5. `cncExport.js` + przycisk „Arch DXF" obok „Jambs DXF" (`WindowDetailPage.jsx`,
   `ProductionPackPage.jsx`). Bez nowego UI konfiguratora.
6. `verify/arch/t16.mjs` — 203 asercje, ALL PASS; **wartości oczekiwane to wzory zamknięte
   liczone w harnessie, NIE wektory ze spec §10** (spec brak).
7. `docs/handover/samples/sample_arch_1200_segmental.dxf` — generowany harnessem (Piotr otwiera
   w VCarve rano). Pozostałe kształty → `.audit/` po uruchomieniu harnessu.

Etap 2 (próbki wszystkich kształtów, edge-case'y, raport parity PSW) **nie został zaczęty** —
warunkiem był werdykt ✅ Etapu 1, a bez specu ✅ jest niemożliwe.

Do BLOCKERS.md (znane, nierozstrzygnięte przez Piotra — wpisane):
- D13 — wybór N (mniej kawałków vs węższa deska): przyjęty domyślny „mniej kawałków", alternatywa drukowana.
- D5 — Piotr mówił „palec 10–11", wybrane narzędzie to profil 15/16; przyjęto 15/16/3,8.
- Głowica Stark d50 na 5-osiowym CNC wymaga trzpienia d50 — decyzja procesowa Piotra, DXF bez zmian.

## NIE RÓB DZIŚ (zaplanowane, osobne pakiety)

- Drzwi: ramiaki skrzydła 92 mm zamiast 94 (materiał 014); próg 4 zawiasów > 2100 mm.
- Casement: jamby i head 68 mm zamiast 57 (razem z PSW + bump wersji layoutów).
- Cut list / szyby / 2D / 3D dla łuków, sash i fix frame łukowe, nadświetla łukowe drzwi, wzory prętów w łukach.
- Listwy przyszybowe (zamrożone).
- `EstimateConfiguratorPage.jsx` limit 3000 mm (nierozstrzygnięte).
- Mullions/ślemienia casement nie trafiają do cut listy (`components.box`) — znana luka silnika, nie tego pakietu.

---

## Pliki do utrzymywania

- `CLAUDE.md` — ten plik; aktualizuj sekcję „ZADANIE NOCNE" i „NIE RÓB DZIŚ" po każdym pakiecie
- `docs/handover/*.md` — specyfikacje pakietów (nie kasować po wdrożeniu — to historia decyzji)
- `BUILD-LOG.md` — werdykty per krok, najnowsze na górze
- `BLOCKERS.md` — pytania do Piotra, LOGIC FAILURE, CRITICAL AMBIGUITY

## Checklist na koniec sesji

- [ ] branch `claude/arched-casement-v1` wypchnięty, `main` nietknięty
- [ ] `node verify/arch/t16.mjs` → ALL PASS
- [ ] `npm run build` przechodzi
- [ ] esbuild OK na każdym dotkniętym pliku, zero polskiego w źródłach
- [ ] `git diff main --stat` obejmuje TYLKO pliki ze spec §11 (+ verify, docs, BUILD-LOG, BLOCKERS)
- [ ] `docs/handover/samples/sample_arch_1200_segmental.dxf` w repo
- [ ] BUILD-LOG.md z werdyktami, BLOCKERS.md z trzema wpisami powyżej + wszystkim, co wyszło w nocy
