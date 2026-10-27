# Co zmienione 24.10.2026: french meeting stiles i obrobka pod zamek (main 20fba5c; v3 na 44a6b11)

Zmiana z czatu (bez tury nocnej). Pliki w ZIP-ie, wszystkie sciezki jak w repo.

## 1. Nowe parametry w profilu drzwi (Window Settings > Doors)

* **Depths & glazing:** Meeting gap 4, Active lip 37, Passive lip 14.5, Seal groove 3. Rebate na kazdym meeting
  stile = lap (2 x French lip 6 = 12) + gap = **16**. Active: ciecie 20 od strony przeciwnej do otwierania (lip 37
  zostaje po stronie otwierania). Passive: ciecie 42.5 od strony otwierania (lip 14.5 zostaje od drugiej strony).
  Miedzy lipami 5.5 na uszczelke; rowek 3 w shoulderze passive przy lipie.
* **Hardware > Lock machining:** Spindle above leaf bottom **1050** (jedna os na single i french; 1101 nad podloga
  przy stopie 51; 0 = stara regula handleHeight nad podloga), Edge margin 12, Faceplate recess width 21 (os 22.5 od
  lica lipa), recess 3 (master) / 5 (slave), ThunderBolt aux housing: machined / not on this lock.
* Stare kopie profilu dostaja te wartosci automatycznie (migracja).

## 2. Co liczy silnik (derived.door)

* `door.meeting`: overlap 12, gap 4, rebateWidth 16, lipActive 37, lipPassive 14.5, cutActive 20, cutPassive 42.5,
  sealSpace 5.5, lapFace exterior / interior.
* `leaves[i].meeting`: strona lipa, grubosc, rebate (width, depth, fromFace), plaszczyzna podzialu do 3D.
* `leaves[i].machining`: wszystko od osi spindle (+ w gore) i rownolegle od dolu skrzydla:
  * ThunderBolt (single i french z jedna klamka, active), pozycje z Twojego DXF zamka (T-FGAO2070): faceplate
    21 x 3 od -906 do +864, kanal pod listwe 12.2 x 8, kieszenie -840.5..-700.5 (47), -135.5..+94.5 (D+21 = 66),
    +649.5..+789.5 (47); czwarta kieszen (+256.7..+366.7 z data sheetu) tylko przy wlaczonej fladze aux
    (domyslnie WYLACZONA, bo DXF ma 3 obudowy); spindle 0, cylinder -92, osie rygli -753.5 / +736.5.
  * keeps (passive z jedna klamka; jamb przy single door): F2402 przy ryglach (plytka 24 x 176 x 2.5, kieszen
    18 x 120 x 25), F24-912W na spindle (plytka 235 od -126.5 do +108.5, kieszen 182 od -106.5 do +75.5);
    przy `keeps full length` dodatkowo rowek 24 x 2.5 na dlugosci plytki (zalozenie, brak rysunku szyny).
  * FGTE master / slave (french z dwiema klamkami): kieszenie z rysunkow Winkhaus (58 slab), recess na cala
    wysokosc, kanal 12.2 x 12 / x 15, plytki koncowe slave 20.5 x 65 x 3.
* Wysokosc klamki na wszystkich arkuszach: 1050 nad dolem skrzydla.

## 3. Arkusze i 3D

* **Nowy arkusz "Lock Machining"** (po Leaf): krawedzie zamka polozone (dol skrzydla po lewej), kieszenie, keeps,
  spindle, cylinder, tabela od dolu skrzydla i od spindle, notatki. W Drawings, w PDF i w paczce.
* **Sections:** detal meeting stiles rysuje rebate 16 z gapem 4 i oba lipy (37 / 14.5), etykieta "rebate 16 = lap 12 +
  gap 4".
* **Leaf:** notatka o rebate i odsylacz do arkusza Lock Machining.
* **3D:** meeting stile ciety na 16 do plaszczyzny lipa (active 37 / passive 14.5), gap 4 widoczny.

## 4. Testy

* nowy `verify/parity/t49_door_meeting_machining.mjs` (55 checks), poprawione oczekiwania w t40 i t41.
* Build OK. Suite: patrz BUILD-LOG (wpis 24.10).

## 6. Wieczor, wersja v3: plyty narysowane z DXF (Piotr: "wybrania plus plyty, rounded edge, specjalne wciecia")

* **Dwa arkusze zamiast jednego:** "Lock Machining: active" i "Lock Machining: passive" (french) albo "leaf" i
  "jamb" (single). Kazdy arkusz: krawedz w skali 1:1 (dol skrzydla po lewej) z PRAWDZIWA plyta, wybrania
  (kreskowane, promien freza 12 / 17 w narozach), obudowy i otwory przelotowe (spindle 8, PZ) liniami kreskowanymi,
  potem DETALE A, B, C... w jednej skali (3:1 do 1.5:1, jeden rzad przy 2:1 lub lepiej, inaczej dwa rzedy), pod
  kazdym oknem pozycje od dolu skrzydla, tabela (od dolu skrzydla i od spindle), notatki w dwoch kolumnach.
* **ThunderBolt:** plyta 1770 x 20 z twojego DXF (T-FGAO2070): zaokraglone konce R10, okna rygli podwojnych, okno
  rygla glownego i zapadki, 10 otworow pod wkrety z pogłebieniem, nity, obudowy 89..182 / 788..966 / 1579..1672
  (grubosc 11.5 / 15.1 z widoku od konca) kreskowane za plyta.
* **Keeps (F2402, F24-912W) z kart BJ Waller:** plytki 24 x 2.5 z koncami R12, kieszen 18 x 25 R6, okna na rygle,
  wkrety (F2402: 76 / 66 od srodka, 17.5 / 6.5 od krawedzi; F24-912W: 96.5 nad klamka, 31.5 i 114.5 pod, na osi),
  srubki regulacyjne.
* **FGTE slave:** listwa 1702.68 x 20 z DXF (G3 Stulpe TFTE 2062-9 LH 22): skrzynki keepow na haki, okna keepa
  rygla i zapadki, dzwignia regulacji (do 25), klocki prowadzace na koncach. Spindle 919.5 nad dolnym koncem listwy
  (wg rysunku zamka slave: follower 783.18 od lewego konca, dziurka PZ 92 dalej, szczelina w dol) -> listwa lezy
  130.5..1833.2 na skrzydle 1998; recess na cala wysokosc, plytki koncowe 0..65 i 1933..1998.
* **FGTE master:** brak DXF plyty w paczce -> plyta schematyczna (kreskowana, 20 szer., okna na haki i rygle) na
  kieszeniach Winkhaus. Jak dasz DXF mastera, wchodzi tym samym generatorem.
* **Jamb (single):** keeps teraz na osi zamka 28.5 (srodek skrzydla 57), nie 22.5 (blad poprzedniej wersji).
* Generator: `verify/tools/winkhaus_dxf_outlines.py <ThunderBolt.dxf> <slave LH.dxf>` (ezdxf) pisze
  `src/engine/hardware/winkhausOutlines.js`; pliki DXF Winkhaus zostaja poza repo. Keeps recznie w
  `src/engine/hardware/winkhausKeeps.js`.
* Testy: t49 80 checks (plyty, oba arkusze, zgodnosc outline z silnikiem), t41 z drugim arkuszem. Build OK.

## 5. Otwarte (BLOCKERS 33)

1. [HIGH] 33.1 Spindle 1050 nad dolem skrzydla: potwierdz (zakres FGTE 1040 do 1247).
2. [DONE] 33.2 Czwarta kieszen ThunderBolt: DXF zamka ma 3 obudowy, flaga aux domyslnie wylaczona.
3. [HIGH] 33.3 Szerokosci kieszeni 18 / 10 z data sheetu: DXF (widok z boku) nie pokazuje grubosci; silnik bierze 18.
   Pozycje rygli i obudow sa juz z DXF.
4. [MEDIUM] 33.6 Keeps: full length (szyna F24-908P) czy individual (3 keeps).
5. [MEDIUM] 33.7 Nie modelowane: flush bolts, kieszenie zawiasow, otwory pod srubki klamki (detail E), wariant
   FGTE 12 / 14 dla inward, rowek uszczelki poza szerokoscia 3.
6. [LOW] 33.9 Export drzwi do bSuite: nastepny krok, gdy beda programy skrzydla (zmienne = tabela machining).
7. [HIGH] 33.10 Listwa slave: orientacja (spindle 919.5 nad dolnym koncem) wywnioskowana z rysunku zamka slave;
   LH / RH i w ktora strone dzwignia (exterior / interior) do potwierdzenia, arkusz jeszcze nie lustrzy.
8. [MEDIUM] 33.11 Brak DXF plyty FGTE master: plyta schematyczna do czasu rysunku.
9. [LOW] 33.12 Plyta ThunderBolt symetryczna w poprzek: jeden rysunek na obie rece.
