# CLAUDE.md — Sash Planner Web

## O projekcie

Sash Planner Web to webowa aplikacja produkcyjna dla firm produkujących drewniane okna skrzynkowe (sash windows).
Docelowo SaaS — każda firma ma swoje konto, profile okien, ceny.

**Właściciel:** Piotr — NIE jest programistą. Ty (Claude) piszesz cały kod. Piotr testuje i recenzuje.

---

## TRYB PRACY: AUTONOMIA NOCNA

Piotr zlecił Ci wykonanie WSZYSTKICH faz od 0 do 5 w jednej sesji.
**NIE czekaj na potwierdzenie** między fazami — pracuj ciągle, faza po fazie.
Po zakończeniu każdej fazy:
- Zrób commit z opisem co zostało zrobione
- Pushuj branch
- Przejdź do następnej fazy

Piotr oceni cały projekt rano. Jeśli napotkasz problem blokujący (np. brak kluczy Supabase, niejasna logika biznesowa), zanotuj go w pliku `BLOCKERS.md` i kontynuuj z tym co możesz zrobić.

**Kolejność pracy:**
1. Faza 0 — Szkielet projektu (React + Vite + struktura + layout)
2. Faza 1 — Import estimate z Supabase (auth + lista estimates + parse specification + kalkulacje)
3. Faza 2 — 3D Preview (embed window3d.js z Prime Sash Windows)
4. Faza 3 — Rysunki techniczne 2D (Canvas renderer)
5. Faza 4 — Cut List & Materiały (agregacja + optimizer + listy)
6. Faza 5 — Export PDF/Excel/DXF (client-side)

Fazy 6 i 7 (Manual Creator + SaaS) — NIE rób teraz.

---

## REPOZYTORIA (3 repo)

### 1. Prime Sash Windows — TYLKO DO ODCZYTU (referencja)
- **Repo:** `https://github.com/Piotr3009/Prime-Sash-Windows.git`
- **Clone:** `git clone -c http.proxyAuthMethod=basic https://github.com/Piotr3009/Prime-Sash-Windows.git`
- **⚠️ NIE EDYTUJ. NIE twórz branchy. NIE pushuj. Tylko czytaj i kopiuj.**

#### Co wziąć z Prime-Sash-Windows:

| Plik źródłowy | Docelowo w Sash-Planner-Web | Do czego |
|---|---|---|
| `js/estimate-renderer.js` | Referencja | Logika renderowania estimates, PDF, Excel |
| `js/price-calculator.js` | Referencja | Logika cenowa, zrozumienie fullConfig |
| `3d-src/` (cały folder) | `src/3d/` | React Three Fiber source — 3D preview |
| `3d-src/package.json` | Referencja | Dependencje 3D |
| `online-estimate.html` | Referencja | Główny konfigurator — struktura fullConfig |
| `js/bars-unified.js` | Referencja | Logika szprosów |
| `js/ironmongery-gallery.js` | Referencja | Galeria okuć |

### 2. Windows App Electron — TYLKO DO ODCZYTU (źródło kalkulacji + 2D renderer)
- **Repo:** `https://github.com/Piotr3009/Windows-App-electron-.git`
- **Clone:** `git clone -c http.proxyAuthMethod=basic https://github.com/Piotr3009/Windows-App-electron-.git`
- **⚠️ NIE EDYTUJ. Tylko czytaj i kopiuj.**

#### Co wziąć z Windows-App-electron-:

| Plik źródłowy | Docelowo w Sash-Planner-Web | Do czego |
|---|---|---|
| `calculations.js` (lub podobna nazwa) | `src/engine/calculations.js` | Kalkulacje sash window — wymiary, components, cut list |
| `optimizer.js` (lub podobna nazwa) | `src/engine/optimizer.js` | Pre-cut optimizer (best-fit-decreasing) |
| `renderer.js` (lub podobna nazwa) | `src/engine/canvas-renderer.js` | 2D Canvas renderer — rysunki techniczne |
| `state.js` | Referencja | Stan aplikacji — przerobić na Zustand |
| `app.js` | Referencja | DXF generator + ogólna logika |

**WAŻNE:** Nazwy plików mogą się różnić. Przejrzyj strukturę repo i znajdź odpowiedniki. Kluczowe moduły to: kalkulacje wymiarów/cięć, optimizer prętów, renderer canvas 2D.

### 3. Sash Planner Web — TU PRACUJEMY
- **Repo:** `https://github.com/Piotr3009/Sash-Planner-Web.git`
- **Clone:** `git clone -c http.proxyAuthMethod=basic https://github.com/Piotr3009/Sash-Planner-Web.git`
- **Branch roboczy:** `claude/full-build` (od main)

---

## KRYTYCZNE ZASADY

1. **NIGDY nie usuwaj funkcji/kodu bez uzasadnienia.** Przy kopiowaniu z innych repo — nie wycinaj logiki którą nie rozumiesz.
2. **Nie kłam.** Jeśli czegoś nie potrafisz zrobić — napisz w BLOCKERS.md.
3. **Minimalne, działające rozwiązania.** Każda faza powinna dać coś co działa w przeglądarce.
4. **Zawsze diffuj przed commit.**
5. **Komentarze w kodzie po angielsku.** Commit messages po angielsku.

---

## ENGINEERING DISCIPLINE (wbudowany skill)

Dla KAŻDEGO zadania/fazy stosuj tę kolejność:

### 1. Understanding
Co dokładnie robisz? Przeformułuj zadanie własnymi słowami.

### 2. Context Linking
Zidentyfikuj powiązania z innymi modułami, wcześniejszymi decyzjami, zależności upstream/downstream.

### 3. Goal & Acceptance Criteria
Co znaczy "gotowe"? Zdefiniuj konkretne kryteria akceptacji.

### 4. Think Before You Code
Opisz podejście ZANIM napiszesz kod. Dla nietrywialnych zadań — rozważ minimum 2 podejścia, odrzuć jedno z uzasadnieniem.

### 5. Edge Cases & Dependencies
Co może się zepsuć? Jakie są zależności (biblioteki, API, DB, config)?

### 6. Plan
Krótka, numerowana lista kroków. Oznacz ryzykowne kroki ⚠️.

### 7. Implement
Kod. Trzymaj się planu. Nie dodawaj niezleconych feature'ów. Prostota > spryt. Jawność > domysły.

### 8. Self-Review
Przejrzyj swój kod jak surowy reviewer:
- Czy działa dla happy path?
- Czy obsługuje edge cases?
- Czy nie usunąłem czegoś czego nie powinienem?
- Czy kod jest czytelny?

### 9. Multi-Pass Verification
- **Pass 1:** Logiczna poprawność — czy rozwiązuje problem?
- **Pass 2:** Integracja — czy nie łamie innych modułów?
- **Pass 3:** Edge cases — null, empty, zero, boundary values

### 10. Risks & Verdict
Co nie jest zweryfikowane? Bądź szczery.
- ✅ gotowe
- ⚠️ działa ale [problem]
- ❌ nie działa

### Code Preservation Rule
NIGDY nie usuwaj istniejącego kodu chyba że:
- jest bezpośrednim celem zmiany
- usunięcie zostało uzasadnione

**Zapisuj verdykty w pliku `BUILD-LOG.md` — po jednej sekcji na fazę.**

---

## LOGIC THINKING (wbudowany skill)

Przed każdą decyzją architektoniczną sprawdź:

1. **Logika bytu** — Co to jest? Czy nazwa pasuje do roli? Czy nie ma sprzecznych ról?
2. **Logika relacji** — Do czego należy? Co kontroluje? Co jest nadrzędne/podrzędne?
3. **Logika zachowania** — Co po akcji użytkownika? Przy błędzie? W edge case?
4. **Logika realnego świata** — Czy to ma sens dla firmy produkującej okna? Czy wynik jest realny fizycznie i biznesowo?
5. **Konsekwencje** — Jak ta decyzja wpływa na inne części systemu?

Jeśli coś nie ma sensu — zanotuj jako **LOGIC FAILURE** w BLOCKERS.md i nie koduj tej części.

**Zakaz fałszywej akceptacji:** Nie pisz "looks good", "great", "this works" dopóki nie sprawdzisz logiki.

---

## PRECISION DIAGNOSER (wbudowany skill)

Gdy napotkasz bug lub problem:

1. **Problem map** — Prześledź flow: input → transformacja → kalkulacja → output
2. **Diagnosis pass 1** — Perspektywa programisty (formuły, typy, nulle, async, zła zmienna)
3. **Diagnosis pass 2** — Perspektywa biznesowa (czy wynik ma sens dla producenta okien?)
4. **Diagnosis pass 3** — Weryfikacja własnego wniosku (czy coś innego mogło to spowodować?)
5. **Simulation** — Przetestuj z realnymi danymi (np. sash window 1200×1800mm, casement 600×1000mm)
6. **Fix** — Najmniejsza bezpieczna zmiana. Nie refaktoruj niezwiązanego kodu.

**Priorytet napraw:** Złe wyniki > złamana logika biznesowa > zepsuty rendering > broken UX > runtime errors > edge cases > wydajność > styl kodu.

---

## Stack technologiczny

- **Frontend:** React 18 + Vite
- **3D:** React Three Fiber + Three.js + @react-three/drei
- **2D:** Canvas API
- **State:** Zustand
- **Styling:** Tailwind CSS
- **Backend:** Supabase (auth, DB, storage) — TEN SAM projekt co Prime Sash Windows
- **Export:** jsPDF, SheetJS (xlsx), custom DXF generator
- **Hosting:** Vercel

---

## Struktura folderów (docelowa)

```
src/
├── components/
│   ├── layout/          # Header, Sidebar, MainContent
│   ├── dashboard/       # Project dashboard, window list, cards
│   ├── viewer/          # 3D preview, 2D canvas viewer
│   ├── export/          # Export controls (PDF/Excel/DXF)
│   └── common/          # Buttons, modals, loaders
├── engine/              # Logika kalkulacyjna (Z ELECTRON APP)
│   ├── calculations.js  # Kalkulacje sash window
│   ├── optimizer.js     # Pre-cut optimizer
│   └── canvas-renderer.js # 2D Canvas renderer
├── 3d/                  # React Three Fiber (Z PRIME-SASH-WINDOWS/3d-src/)
├── stores/              # Zustand
│   ├── projectStore.js
│   └── authStore.js
├── services/
│   └── supabase.js
├── mocks/               # Mock data gdy brak Supabase
│   └── mockEstimates.js
├── utils/
├── App.jsx
└── main.jsx
```

---

## Supabase — baza danych

### Tabele do użycia (istniejące):

**`estimates`** — główna tabela wycen
- `id`, `user_id`, `estimate_number`, `status`, `created_at`
- `total_price`, `additional_options`

**`estimate_items`** — poszczególne okna/drzwi
- `id`, `estimate_id`, `window_type`, `width`, `height`, `quantity`
- `specification` — **JSON z pełnym configiem okna (fullConfig)**
- `unit_price`, `total_price`

### Klucze Supabase:
```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
```
**Jeśli nie masz kluczy — stwórz mockowe dane i zaznacz w BLOCKERS.md.**

---

## FAZY SZCZEGÓŁOWO

### FAZA 0 — Szkielet (React + Vite + Layout)

**Cel:** Pusta apka z layoutem ładuje się w przeglądarce.

1. `npm create vite@latest . -- --template react`
2. Zainstaluj: `zustand`, `tailwindcss`, `@supabase/supabase-js`, `postcss`, `autoprefixer`, `react-router-dom`
3. Skonfiguruj Tailwind
4. Layout: Header (logo "Sash Planner" + nav) + Sidebar (lista projektów) + Main content
5. Placeholder pages: Login, Dashboard, Window Detail
6. Routing: Login → Dashboard → Window Detail
7. Supabase client w `src/services/supabase.js`
8. `.env.example` z placeholder kluczami
9. `npm run dev` → ładuje się bez błędów

**Acceptance:** Apka startuje, routing działa, layout widoczny. Commit + push.

---

### FAZA 1 — Import Estimate

**Cel:** Logujesz się → widzisz estimates → klikasz → widzisz okna z kalkulacjami.

1. Auth screen (email + password, Supabase auth)
2. Dashboard: fetch `estimates`, wyświetl listę (numer, data, status, ilość okien)
3. Estimate Detail: fetch `estimate_items` dla wybranego estimate
4. Parse `specification` JSON → extract fullConfig
5. Karty okien: typ, wymiary W×H, kolor, bars pattern, ilość
6. Kalkulacje z `calculations.js` (z Electron app): components, cut lengths, glass sizes
7. Summary: łączna ilość okien, łączna cena

**Jeśli brak Supabase:** Stwórz `src/mocks/mockEstimates.js` z realistycznymi danymi.
**Jeśli calculations.js wymaga adaptacji do ES modules:** Przeróbki minimalne, zachowaj oryginalną logikę.

**Acceptance:** Lista estimates → klik → karty okien z danymi. Commit + push.

---

### FAZA 2 — 3D Preview

**Cel:** Klikasz okno → widzisz 3D preview.

1. Skopiuj/adaptuj `3d-src/` z Prime-Sash-Windows
2. Zainstaluj: `three`, `@react-three/fiber`, `@react-three/drei`
3. Komponent `WindowPreview3D` — przyjmuje fullConfig, renderuje okno
4. Window Detail: panel z 3D preview
5. Toggle: Exterior / Interior

**UWAGA:** Importuj source JSX components, nie skompilowany bundle.
**Jeśli za skomplikowane:** Placeholder "3D Preview — coming soon" + BLOCKERS.md.

**Acceptance:** 3D preview renderuje się (nawet basic). Commit + push.

---

### FAZA 3 — Rysunki techniczne 2D

**Cel:** Canvas-based rysunek techniczny.

1. Skopiuj `renderer.js` z Electron app → `src/engine/canvas-renderer.js`
2. Adaptuj do React (komponent `TechnicalDrawing2D` z Canvas ref)
3. Rysuj: obrys ramy, skrzydła, szprosy, wymiary z strzałkami
4. Styl CAD: czarne linie, białe tło
5. Tab "2D Drawing" obok "3D Preview"

**Minimum:** Rysunek elewacyjny z wymiarami ramy i szyb.

**Acceptance:** Rysunek widoczny, wymiary poprawne. Commit + push.

---

### FAZA 4 — Cut List & Materiały

**Cel:** Listy cięć i materiałów.

1. Cut list per okno (z calculations.js) + aggregated per projekt
2. Pre-cut optimizer (optimizer.js z Electron app) — best-fit-decreasing
3. Wizualizacja bar layout (Canvas lub SVG)
4. Glass order list (wymiary, typ, ilości)
5. Timber order list (sekcje, długości, materiał)
6. Hardware/ironmongery list

**Acceptance:** Tabelki z danymi, poprawne wartości. Commit + push.

---

### FAZA 5 — Export

**Cel:** PDF + Excel client-side.

1. **PDF (jsPDF):** Rysunek per okno, cut list, materials, glass
2. **Excel (SheetJS):** Cut list, materials, glass, summary worksheets
3. Przyciski: "Export PDF", "Export Excel"

**DXF:** Jeśli zdążysz — bonus.

**Acceptance:** Klik → pobiera plik z poprawnymi danymi. Commit + push.

---

## Konwencje

- **Pliki:** kebab-case (`project-dashboard.jsx`)
- **Komponenty:** PascalCase (`ProjectDashboard`)
- **Stores:** camelCase (`useProjectStore`)
- **Styling:** Tailwind
- **Brak TypeScript** — JS/JSX
- **Commits:** angielski, opisowe ("Phase 0: Initialize Vite + React project")

---

## Pliki do utrzymywania

- **`CLAUDE.md`** — ten plik, nie edytuj
- **`BUILD-LOG.md`** — log verdyktów per faza (twórz w trakcie pracy)
- **`BLOCKERS.md`** — problemy, pytania do Piotra
- **`.env.example`** — placeholder zmienne środowiskowe
- **`README.md`** — instrukcja instalacji

---

## Checklist na koniec sesji

- [ ] Każda faza ma commit + push na branch `claude/full-build`
- [ ] BUILD-LOG.md aktualny
- [ ] BLOCKERS.md z pytaniami
- [ ] `npm run dev` startuje bez błędów
- [ ] `npm run build` przechodzi
- [ ] README.md z instrukcją (npm install, npm run dev)
