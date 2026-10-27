# Co zmienione 25.10.2026: scianki dzialowe do meeting roomow (partition walls, main f4b0e47)

Zmiana z czatu. Nowa kategoria produktu "Partition walls": jedna prosta scianka na rekord, dab lity olejowany,
szyby 6/16/6 z nakladanymi szprosami 22, drzwi na zawiasach Enduro, kolki 8 mm. Liczby wzorcowe to zatoka z DXF
Windmill Street: 2525 x 2165, uklad SDS (ekran, drzwi, ekran), drzwi 800, 3 swiatla, panel 790.

## 1. Co widzisz w programie

* **Nowy typ batcha "Partition walls"** (Project > dodaj batch). Domyslne batcha: stal nierdzewna, kolor dab,
  szklo 6/16/6 hartowane, ramka czarna, bez PAS24, bez koloru farby (olej).
* **Konfigurator, sekcja "Partition Wall"** (po wymiarach W x H = cala scianka miedzy deskami koncowymi i pod
  deska glowna):
  * **Layout**: litery od lewej do prawej, patrzac z korytarza: S = ekran szklony, D = drzwi (np. SDS, SS, D, SSDS).
  * **Door opening width**: otwor drzwiowy (800); szerokosc ekranow liczy sie sama: (W - 2 x 20 - slupki x 50 -
    drzwi) / liczba ekranow.
  * **Lights per screen**: liczba swiatel w ekranie (3); szprosy nakladane 22 x 8 na obu licach.
  * **Panel height**: wysokosc panelu nad dolna poprzeczka (790); 0 = bez panelu i bez srodkowej poprzeczki.
  * **Hinge side**: lewa / prawa (z korytarza). **Swing**: out (na korytarz, domyslnie) / in (do pokoju).
* **Window Settings > Partition**: karta profilu scianki: glebokosc 54, slupek 50, poprzeczki 50, deska 20 x 74,
  szpros 22 x 8, listwa przyszybowa 18 x 12, wrab 18, szklo 13.5 we wrab, pakiet 28 (6/16/6), panel 30, drzwi
  (stojaki 120, gorna 100, srodkowa 50, dolna 180, luz 3, 5 nad podloga, lip 20, stop 17), zawiasy (102 x 76 x 3,
  knuckle 14, regula 200 / srodek - 100 / 150, 4 zawiasy powyzej 2200), klamka 1000, zapadka 76 / 57, kolki
  8 x 40 x 3 na polaczenie, domyslne konfiguratora. Zmiana tu przelicza wszystko.
* **Drawings (zakladki)**: Front Elevation, Door Leaf, End Posts P1 P4, Hinge Post P2, Lock Post P3, Top Rail,
  Screen Rails, Door Stiles, Door Rails, Sections; do tego rysunki szyb (jeden na rozmiar). Te same arkusze ida
  do PDF i do paczki produkcyjnej.
* **3D**: na razie plansza "3D preview is not available for partition walls yet" (przycisk PDF 3D wylaczony).
* **Cena**: 0 (stawki `pricing.partition` sa zerowe, dopoki PSW ich nie ustawi).

## 2. Co pokazuje kazdy arkusz

* **Front Elevation**: scianka z korytarza: deska glowna i deski koncowe, gorna poprzeczka (jedna sztuka miedzy
  deskami), slupki, ekrany (swiatla, szprosy, srodkowa poprzeczka, PANEL, dolna poprzeczka na podlodze),
  skrzydlo z symbolem otwierania, zawiasami i klamka. Wymiary: szerokosc u gory, wysokosci po prawej (klamka 1000,
  H), lancuch pol wzdluz dolu, lancuch elementow po lewej (przez ekran), wysokosc skrzydla.
* **Door Leaf**: samo skrzydlo: stojaki i poprzeczki z kodami z cut listy (DS/H, DS/L, DTR, DMR, DBR), swiatlo
  i krawedz pakietu, szprosy, panel, linia wrabu zamkowego, wybrania zawiasow, czolo zapadki i klamka; lancuchy
  stojakow (dol), poprzeczek / swiatel (lewo), zawiasow (prawo), klamka nad dolem skrzydla i nad podloga,
  spindle od krawedzi zamkowej.
* **Arkusze elementow (CNC): End Posts, Hinge Post, Lock Post, Top Rail, Screen Rails, Door Stiles, Door Rails**:
  element polozony 1:1, dlugosc wzdluz, lico w poprzek. **Elementy pionowe (slupki, stojaki) leza licem
  POKOJOWYM do gory (kieszenie otwarte do pokoju), koniec GORNY po lewej; krawedz u gory rysunku to ta, ktora w
  elewacji patrzy w LEWO. Poprzeczki od FRONTU (korytarz), gorna krawedz u gory.** Nad i pod pasem lica sa
  rozlozone obie krawedzie (lico frontowe na zewnatrz) z operacjami krawedziowymi: wybrania zawiasow, czolo i
  otwor zapadki, blaszka zaczepu i kieszen rygla na lipie slupka zamkowego, otwory kolkow (poprzeczki w stojaki,
  slupki w spod gornej poprzeczki), nabity stop nadprozowy. Na licu: kieszenie zatrzymane (kreskowane), wraby
  przelotowe, lip stopu z litego, wrab zamkowy i nadprozowy, otwor spindla. Kazda operacja ma numer: callout nad
  pasem, wiersz w tabeli (od / do / dlugosc / szerokosc / glebokosc / gdzie), lancuch wymiarowy pod kazdym
  wierszem. Element dluzszy niz arkusz jest zlamany na wiersze ("continued"). **Widoki czol do 3:1** rysuja L
  (kieszen i lip wyciete) z numerowanymi otworami kolkow i ich wspolrzednymi "n: across / depth" (across od
  gornej krawedzi rysunku, depth od lica frontowego, 20 gleboko). P1 i P4 to jeden arkusz (P4 = lustro).
* **Sections**: rzut poziomy przez strefe szklona (deski koncowe wystajace, slupki z kieszeniami, lip slupka
  zamkowego, pakiety z szybami i ramkami, listwy od pokoju, skrzydlo zamkniete z wrabem zamkowym, knuckle i luk
  otwierania) oraz przekroje pionowe przez ekran (deska glowna, kieszen gornej poprzeczki, pakiet, szprosy z
  dummy spacerem, srodkowa poprzeczka, panel, dolna poprzeczka) i przez drzwi (nabity stop, gorna poprzeczka
  skrzydla z wrabem nadprozowym, srodkowa i dolna, 5 nad podloga).
* **Glass drawings**: jeden na rozmiar pakietu: 6/16/6, szprosy nakladane na swoich osiach, dummy spacer, lista
  szyb (screen S1, S2; door D1 z nota "safety glass").

## 3. Cut lista, precut, szklo, okucia

* **Cut lista**: wszystko z prefiksem W- i kodem: W-HEAD BOARD 20x74, W-END BOARD 20x74 (x2), W-TOP RAIL 50x54,
  W-POST 50x54 (x3), W-POST (LOCK) 67x54 (slupek + lip 17 z litego), W-MID RAIL i W-BOTTOM RAIL 50x54 (po jednym
  na ekran), W-BAR 22x8, W-BEAD 18x12 (dlugosc = swiatlo + 36, na ucios), W-DOOR HEAD STOP 17x31; skrzydlo:
  W-DOOR STILE (HINGE) / (LOCK) 120x54, W-DOOR TOP RAIL 100x54, W-DOOR MID RAIL 50x54, W-DOOR BOTTOM RAIL 180x54,
  W-DOOR BAR 22x8, W-DOOR BEAD 18x12. Material: Oak (solid). Grupy: HB, EB, TR, P, PL, MR, BR, HS, DS-H, DS-L,
  DTR, DMR, DBR, GB, DGB, BD, DBD; notatki (role slupkow, wraby, wybrania, pozycja zapadki) zostaja.
* **Precut**: elementy W- grupuja sie po przekroju gotowym (50x54, 120x54, 100x54, 180x54, 67x54, 20x74, 22x8,
  18x12, 17x31) + naddatek 10, dopoki nie przypiszesz materialu (jak drzwi). Strona z kolorami w PDF precutu.
* **Glass list**: po jednym wierszu na pakiet, 6/16/6, kolumna szprosow "2H x 0V applied" i osie szprosow od
  gory pakietu (411.5 / 820.5 w ekranie, 308.5 / 717.5 w drzwiach). Eksport DXF szyb dziala.
* **Hardware**: Door hinge (Enduro, 3), Tubular latch (76 / 57, 1), Lever handle set (na rozecie, 1000 od
  podlogi, 1), Dowels (8 x 40, 3 na polaczenie, 54). Brak wierszy Assign Materials dla W- (BLOCKERS 34.12); BOM
  bez obciaznikow i farby.

## 4. Liczby zatoki Windmill Street do sprawdzenia (2525 x 2165, SDS, drzwi 800, 3 swiatla, panel 790)

* ekrany 742.5 szerokie (2525 - 40 - 200 - 800 = 1485 / 2), slupki 50 na x 20 / 812.5 / 1662.5 / 2455 (koncowy,
  zawiasowy, zamkowy, koncowy), dlugosc 2095;
* strefa szklona 1205 (y 70 do 1275), 3 swiatla po 387, szprosy 22 na y 457 i 866; srodkowa poprzeczka y 1275,
  panel 790 (y 1325), dolna poprzeczka y 2115;
* pakiet ekranu 769.5 x 1232 (swiatlo + 27), szprosy 2H na 411.5 / 820.5 od gory pakietu; panel 769.5 x 817 x 30;
* skrzydlo 794 x 2087 x 54 (otwor 800 x 2095, luz 3, 5 nad podloga), swiatlo 554 x 1102, swiatla 284 / 387 /
  387 (na liniach szprosow ekranu), pakiet 581 x 1129, panel drzwi 581 x 682;
* zawiasy 200 / 943.5 / 1937 od gory skrzydla (1892 / 1148.5 / 155 od podlogi), wybranie 102 x 31 x 3;
* zapadka 1092 od gory skrzydla (1000 od podlogi), os 37 od frontu, spindle 74 od krawedzi lipa; wrab zamkowy
  17 x 34 za lipem 20; stop 17 x 31 na slupku P3 (blank 67 x 54); stop nadprozowy nabity 17 x 31 x 800;
* kieszenie: slupek P1 szklo 0 do 1223, panel 1237 do 2063 (od gory slupka); gorna poprzeczka 32 do 810.5 i
  1674.5 do 2453 (od lewego konca);
* 54 kolki w 18 polaczeniach: trojkat (10, 20) (22, 33) (10, 46) w ciele 32; slupek z wrabem (28, 20) (40, 33)
  (28, 46); srodkowa poprzeczka (cialo 14) rzad pionowy 25 / 18 / 33 / 48; gorna poprzeczka drzwi (cialo 82)
  rzad 15 / 41 / 67 na glebokosci 33; dolna (cialo 162) 33 / 99 / 165;
* masa skrzydla ok. 54 kg (zawias 120 kg); listwy 778.5 / 1241 / 826 (ekran), 590 / 1138 / 691 (drzwi).

## 5. Jak przetestowac

1. Otworz projekt, dodaj batch typu "Partition walls".
2. Dodaj okno 2525 x 2165, layout SDS, drzwi 800, 3 swiatla, panel 790 (to sa domyslne), zapisz.
3. Na stronie okna: Drawings (wszystkie zakladki), Cut List, Glass, Hardware; porownaj z liczbami z punktu 4.
4. Zmien: layout SS (bez drzwi), D (same drzwi 900 szer.: otwor 760), panel 0 (szklo do dolnej poprzeczki),
   hinge right, swing in; scianka 1200 SDS ma pokazac blad "too narrow".
5. Window Settings > Partition: zmien np. slupek 50 -> 60 i sprawdz, ze elewacja i cut lista sie przeliczyly;
   Reset przywraca 50.
6. Test automatyczny: `node verify/parity/t50_partition.mjs` (silnik, listy, cena, warianty, kontrole, arkusze).

## 6. Zalozenia do potwierdzenia (BLOCKERS 34.x, w skrocie)

* 34.1 przekroj 54 = upstand 12 od frontu / strefa szkla 30 (28 + 2 x 1 tasma) / listwa 12 od pokoju; kieszen 18 x 42.
* 34.2 szprosy nakladane 22 x 8 na obu licach, dummy spacer 22; ramka czarna (domyslna batcha).
* 34.3 panel 30 gruby (dab 6 + MDF 18 + dab 6), w tej samej kieszeni i z tymi samymi listwami co szklo, lico 12
  za frontem; gestosc 700 do mas.
* 34.4 slupki i stojaki: kieszenie ZATRZYMANE 18 x 42 od pokoju, 18 poza otwor z kazdej strony; poprzeczki ciete
  na szerokosc pola z wrabami PRZELOTOWYMI; listwy na ucios (swiatlo + 36); gorna poprzeczka z kieszenia na ekran
  od spodu.
* 34.5 kolki 8 x 40, 3 na polaczenie, po 20 w kazdej czesci; wzor: trojkat [10, 20] [22, 33] [10, 46] w ciele 32,
  rzad na glebokosci 33 (15 od krawedzi ciala) w cialach od 62, rzad pionowy 18 / 33 / 48 w ciele 14.
* 34.6 lip stopu 17 x 31 z litego na slupku zamkowym (blank 67 x 54); stop nadprozowy NABITY 17 x 31 x otwor;
  slupek zawiasowy gladki.
* 34.7 knuckle zawiasu 14 (skrzydelko 31 z kazdej strony), wybranie 102 x 31 x 3 od strony otwierania, pozycje
  jak w single door.
* 34.8 zapadka tubular 76, backset 57, w CZESCI WREBOWANEJ krawedzi zamkowej: os 37 od frontu, spindle 74 od
  krawedzi lipa, otwor 16, czolo i zaczep 57 x 25 x 2, kieszen rygla 16 x 15; klamka na rozecie, stal.
* 34.9 wrab zamkowy 17 x 34 za lipem 20 na calej wysokosci; to samo na gorze skrzydla przy nabitym stopie.
* 34.10 szklo 6/16/6 hartowane wszedzie, pakiet drzwi "safety glass (AD K)"; 30 kg/m2, margines 5 %.
* 34.11 cena 0 (stawki placeholder).
* 34.12 brak wierszy Assign Materials dla W-.
* 34.13 3D: plansza zastepcza.
* 34.14 jedna prosta scianka, tylko S i D; narozniki, zwroty, wiecej drzwi: pozniej.
* 34.15 szprosy drzwi na liniach szprosow ekranu (284 / 387 / 387); sama sciana D dzieli swoja strefe rowno.
* 34.16 swing in: stop i lip lustrzanie na front (policzone, nie rysowane szczegolowo).
* 34.17 pytania z mockupu bez odpowiedzi: wszystko jak wyzej (podzial 12 / 30 / 12, panel opcja A, szpros 8,
  ramka czarna, stop z litego + nadproze nabite, bez luzow montazowych przy deskach, panel drzwi jak w ekranie).
* 34.18 DXF: glebokosc 80 -> 54 (Twoje), zawiasy 10 x 100 -> Enduro 102 x 76 x 3, "rama" 20 -> deska ozdobna
  20 x 74, 10 wystajaca z kazdej strony.

## 7. Pytania (odpowiedz numerami)

1. Podzial przekroju 12 / 30 / 12 (upstand / szklo / listwa) zostaje?
2. Panel 30 gruby, fornirowany (dab 6 + MDF 18 + dab 6), lico 12 za frontem jak szklo: opcja A ok?
3. Szpros nakladany 22 x 8 i ramka czarna: ok?
4. Stop na slupku zamkowym z litego (blank 67), stop nadprozowy nabity: ok, czy oba nabite?
5. Knuckle zawiasu Enduro 14 (skrzydelko 31)?
6. Zapadka: ktory produkt (76 / 57 przyjete), klamka na rozecie stal?
7. Luzy montazowe przy deskach koncowych i pod sufitem: zero (deski = W i H) czy dodac?
8. Stawki ceny: per m2 scianki i per skrzydlo?
9. Material do Assign Materials: jaki przekroj dabu kupujesz (50x54 z czego)?
10. Kolejny krok: 3D, narozniki, czy eksport DXF elementow z otworami kolkow na CNC?
