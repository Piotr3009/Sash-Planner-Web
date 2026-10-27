;;;========================================
;;; KIT_DOOR_SINGLE.lsp
;;; Single Fire Door with Frame
;;; Command: DOOR_SINGLE
;;; Base point: bottom-left of door leaf (0,0)
;;; Requires: SKYLON_COMMON.lsp loaded first
;;;========================================

(if (null drawRect) (load "SKYLON_COMMON"))

;;;========================================
;;; A. LAYERS
;;;========================================
(defun createDoorLayers ()
  (command "._LAYER" "_M" "FRAME" "_C" "7" "FRAME" "")
  (command "._LAYER" "_M" "DOOR_OUTSIDE" "_C" "1" "DOOR_OUTSIDE" "")
  (command "._LAYER" "_M" "DOOR_INSIDE" "_C" "94" "DOOR_INSIDE" "")
  (command "._LAYER" "_M" "DOOR_IRONMONGERY" "_C" "7" "DOOR_IRONMONGERY" "")
  (command "._LAYER" "_M" "DIMENSIONS" "_C" "5" "DIMENSIONS" "")
  (command "._LAYER" "_M" "UNIT_NUMBER" "_C" "5" "UNIT_NUMBER" "")
  (command "._LAYER" "_M" "VISION_PANEL" "_C" "5" "VISION_PANEL" "")
  (command "._LAYER" "_M" "SUMMARY" "_C" "7" "SUMMARY" ""))

;;;========================================
;;; B. OUTSIDE VIEW
;;; Base point (x0,y0) = bottom-left of door leaf
;;; Door + frame lines interrupted at hinges
;;; Hinges with bearing lines (divided into 4)
;;; Label: "LH - Outside" or "RH - Outside"
;;;========================================

;;; Centered text with color override
(defun drawTextCC (layer x y height txt color / )
  (entmake (list '(0 . "TEXT") '(100 . "AcDbEntity") (cons 8 layer) (cons 62 color)
    '(100 . "AcDbText") (cons 10 (list x y 0.0)) (cons 40 height) (cons 1 txt)
    '(72 . 1) (cons 11 (list x y 0.0)) '(100 . "AcDbText") '(73 . 2))))

;;; Draw bathroom lock: outer R27.5 + inner R10 + line 15mm horizontal
(defun drawBathroom (lay cx cy /)
  (drawCircle lay cx cy 27.5)
  (drawCircle lay cx cy 10.0)
  (drawLine lay (- cx 7.5) cy (+ cx 7.5) cy))

;;; outer circle R27.5, inner circle R7.5 (+5mm up), rect 10x20 down with R5 fillet
(defun drawEurocylinder (lay cx cy / iy eStart ss)
  (setq iy (+ cy 5.0))
  ;; outer circle (stays as circle)
  (drawCircle lay cx cy 27.5)
  ;; marker - last entity before inner shapes
  (setq eStart (entlast))
  ;; inner circle
  (drawCircle lay cx iy 7.5)
  ;; rectangle 10x20 down with R5 fillet
  (entmake (list '(0 . "LWPOLYLINE") '(100 . "AcDbEntity")
    (cons 8 lay) '(100 . "AcDbPolyline") '(90 . 4) '(70 . 1)
    (cons 10 (list (- cx 5.0) iy))
    (cons 10 (list (+ cx 5.0) iy))
    (cons 10 (list (+ cx 5.0) (- iy 20.0)))
    (cons 10 (list (- cx 5.0) (- iy 20.0)))))
  (command "._FILLET" "_R" "5" "")
  (command "._FILLET" "_P" (entlast) "")
  ;; collect circle + fillet-rect into selection set
  (setq ss (ssget "L" (list (cons 0 "*"))))
  (setq ss (ssadd))
  (setq e eStart)
  (while (setq e (entnext e))
    (ssadd e ss))
  ;; convert to regions
  (command "._REGION" ss "")
  ;; collect resulting regions
  (setq ss2 (ssadd))
  (setq e eStart)
  (while (setq e (entnext e))
    (ssadd e ss2))
  (command "._UNION" ss2 ""))


(defun drawDoorOutside (x0 y0 doorW doorH openWay unitNum lockType /
                         gap fw oldOs oldLay
                         fL fR fT fLi fRi fTi
                         hW hH h1b h1t h2b h2t h3b h3t hx1 hx2
                         doorEdgeX frameInnerX
                         doorOppX frameOppX
                         labelTxt)
  
  (setq gap 3.0)
  (setq fw 35.0)
  (setq hW 10.0)
  (setq hH 102.0)
  
  ;; Frame edges
  (setq fL (- x0 gap fw))
  (setq fR (+ x0 doorW gap fw))
  (setq fT (+ y0 doorH gap fw))
  (setq fLi (- x0 gap))
  (setq fRi (+ x0 doorW gap))
  (setq fTi (+ y0 doorH gap))
  
  ;; Hinge Y positions (bottom and top of each hinge)
  (setq h1t (- (+ y0 doorH) 145.0))          ;; top hinge top
  (setq h1b (- h1t hH))                       ;; top hinge bottom
  (setq h2t (- (+ y0 doorH) 700.0))          ;; middle hinge top
  (setq h2b (- h2t hH))                       ;; middle hinge bottom
  (setq h3b (+ y0 200.0))                     ;; bottom hinge bottom
  (setq h3t (+ h3b hH))                       ;; bottom hinge top
  
  ;; Hinge X positions (shifted 3.5mm inward)
  (if (= openWay "L")
    (progn
      (setq hx1 (- (+ x0 doorW) 3.5))
      (setq hx2 (+ hx1 hW))
      (setq doorEdgeX (+ x0 doorW))       ;; door edge on hinge side
      (setq frameInnerX fRi)               ;; frame inner on hinge side
      (setq doorOppX x0)                   ;; door edge opposite side
      (setq frameOppX fLi))                ;; frame inner opposite side
    (progn
      (setq hx2 (+ x0 3.5))
      (setq hx1 (- hx2 hW))
      (setq doorEdgeX x0)
      (setq frameInnerX fLi)
      (setq doorOppX (+ x0 doorW))
      (setq frameOppX fRi)))
  
  ;; --- DOOR LEAF ---
  ;; Bottom line
  (drawLine "DOOR_OUTSIDE" x0 y0 (+ x0 doorW) y0)
  ;; Top line
  (drawLine "DOOR_OUTSIDE" x0 (+ y0 doorH) (+ x0 doorW) (+ y0 doorH))
  ;; Opposite side (continuous, no hinges)
  (drawLine "DOOR_OUTSIDE" doorOppX y0 doorOppX (+ y0 doorH))
  ;; Hinge side (interrupted by 3 hinges)
  (drawLine "DOOR_OUTSIDE" doorEdgeX y0 doorEdgeX h3b)
  (drawLine "DOOR_OUTSIDE" doorEdgeX h3t doorEdgeX h2b)
  (drawLine "DOOR_OUTSIDE" doorEdgeX h2t doorEdgeX h1b)
  (drawLine "DOOR_OUTSIDE" doorEdgeX h1t doorEdgeX (+ y0 doorH))
  
  ;; --- FRAME ---
  ;; Opposite side (continuous)
  (if (= openWay "L")
    (progn
      ;; Left side = opposite, continuous
      (drawLine "FRAME" fL (- y0 5.0) fL fT)
      (drawLine "FRAME" fLi (- y0 5.0) fLi fTi)
      (drawLine "FRAME" fL (- y0 5.0) fLi (- y0 5.0))
      ;; Right side = hinge side, interrupted inner line
      (drawLine "FRAME" fR (- y0 5.0) fR fT)
      (drawLine "FRAME" fR (- y0 5.0) fRi (- y0 5.0))
      ;; Right inner - interrupted
      (drawLine "FRAME" fRi (- y0 5.0) fRi h3b)
      (drawLine "FRAME" fRi h3t fRi h2b)
      (drawLine "FRAME" fRi h2t fRi h1b)
      (drawLine "FRAME" fRi h1t fRi fTi))
    (progn
      ;; Right side = opposite, continuous
      (drawLine "FRAME" fR (- y0 5.0) fR fT)
      (drawLine "FRAME" fRi (- y0 5.0) fRi fTi)
      (drawLine "FRAME" fR (- y0 5.0) fRi (- y0 5.0))
      ;; Left side = hinge side, interrupted inner line
      (drawLine "FRAME" fL (- y0 5.0) fL fT)
      (drawLine "FRAME" fL (- y0 5.0) fLi (- y0 5.0))
      ;; Left inner - interrupted
      (drawLine "FRAME" fLi (- y0 5.0) fLi h3b)
      (drawLine "FRAME" fLi h3t fLi h2b)
      (drawLine "FRAME" fLi h2t fLi h1b)
      (drawLine "FRAME" fLi h1t fLi fTi)))
  
  ;; Top outer + inner (always continuous)
  (drawLine "FRAME" fL fT fR fT)
  (drawLine "FRAME" fLi fTi fRi fTi)

  ;; Miter joints 45deg - gorny lewy i prawy naroznik
  (drawLine "FRAME" fL fT fLi fTi)
  (drawLine "FRAME" fR fT fRi fTi)
  
  ;; --- HINGES (3x bearing hinge style) ---
  ;; Each hinge: 4 sides + 3 horizontal bearing lines
  (foreach hBot (list h1b h2b h3b)
    ;; Rectangle
    (drawLine "DOOR_IRONMONGERY" hx1 hBot hx2 hBot)
    (drawLine "DOOR_IRONMONGERY" hx2 hBot hx2 (+ hBot hH))
    (drawLine "DOOR_IRONMONGERY" hx2 (+ hBot hH) hx1 (+ hBot hH))
    (drawLine "DOOR_IRONMONGERY" hx1 (+ hBot hH) hx1 hBot)
    ;; 3 bearing lines (divide into 4 equal parts)
    (drawLine "DOOR_IRONMONGERY" hx1 (+ hBot (* hH 0.25)) hx2 (+ hBot (* hH 0.25)))
    (drawLine "DOOR_IRONMONGERY" hx1 (+ hBot (* hH 0.50)) hx2 (+ hBot (* hH 0.50)))
    (drawLine "DOOR_IRONMONGERY" hx1 (+ hBot (* hH 0.75)) hx2 (+ hBot (* hH 0.75)))
  )
  
  ;; --- HANDLE (circle dia 55mm + lever trapezoid R4 fillet) ---
  (if (= openWay "L")
    (progn
      ;; LH outside: lever goes RIGHT
      (drawCircle "DOOR_IRONMONGERY" (+ x0 60.0) (+ y0 1000.0) 27.5)
      (entmake (list '(0 . "LWPOLYLINE") '(100 . "AcDbEntity")
        (cons 8 "DOOR_IRONMONGERY") '(100 . "AcDbPolyline") '(90 . 4) '(70 . 1)
        (cons 10 (list (+ x0 60.0)       (- (+ y0 1000.0) 5.0)))
        (cons 10 (list (+ x0 60.0 120.0) (- (+ y0 1000.0) 7.0)))
        (cons 10 (list (+ x0 60.0 120.0) (+ (+ y0 1000.0) 7.0)))
        (cons 10 (list (+ x0 60.0)       (+ (+ y0 1000.0) 5.0)))))
      (command "._FILLET" "_R" "4" "")
      (command "._FILLET" "_P" (entlast) "")
      (if (= lockType "E") (drawEurocylinder "DOOR_IRONMONGERY" (+ x0 60.0) (+ y0 922.0)))
      (if (= lockType "B") (drawBathroom "DOOR_IRONMONGERY" (+ x0 60.0) (+ y0 922.0))))
    (progn
      ;; RH outside: lever goes LEFT
      (drawCircle "DOOR_IRONMONGERY" (- (+ x0 doorW) 60.0) (+ y0 1000.0) 27.5)
      (entmake (list '(0 . "LWPOLYLINE") '(100 . "AcDbEntity")
        (cons 8 "DOOR_IRONMONGERY") '(100 . "AcDbPolyline") '(90 . 4) '(70 . 1)
        (cons 10 (list (- (+ x0 doorW) 60.0)       (- (+ y0 1000.0) 5.0)))
        (cons 10 (list (- (+ x0 doorW) 60.0 120.0) (- (+ y0 1000.0) 7.0)))
        (cons 10 (list (- (+ x0 doorW) 60.0 120.0) (+ (+ y0 1000.0) 7.0)))
        (cons 10 (list (- (+ x0 doorW) 60.0)       (+ (+ y0 1000.0) 5.0)))))
      (command "._FILLET" "_R" "4" "")
      (command "._FILLET" "_P" (entlast) "")
      (if (= lockType "E") (drawEurocylinder "DOOR_IRONMONGERY" (- (+ x0 doorW) 60.0) (+ y0 922.0)))
      (if (= lockType "B") (drawBathroom "DOOR_IRONMONGERY" (- (+ x0 doorW) 60.0) (+ y0 922.0))))
  )
  
  ;; --- DIMENSIONS ---
  (setq oldOs (getvar "OSMODE"))
  (setq oldLay (getvar "CLAYER"))
  (setvar "OSMODE" 0)
  (setvar "CLAYER" "DIMENSIONS")
  (command "_.DIMLINEAR"
    "_non" (list fL (- y0 5.0))
    "_non" (list fL fT)
    "_non" (list (- fL 350.0) (/ (+ (- y0 5.0) fT) 2.0)))
  (command "_.DIMLINEAR"
    "_non" (list fLi y0)
    "_non" (list fLi (+ y0 doorH))
    "_non" (list (- fL 100.0) (/ (+ y0 (+ y0 doorH)) 2.0)))
  (command "_.DIMLINEAR"
    "_non" (list x0 (+ y0 doorH))
    "_non" (list (+ x0 doorW) (+ y0 doorH))
    "_non" (list (+ x0 (/ doorW 2.0)) (+ fT 150.0)))
  (command "_.DIMLINEAR"
    "_non" (list fL fT)
    "_non" (list fR fT)
    "_non" (list (+ x0 (/ doorW 2.0)) (+ fT 250.0)))
  (setvar "CLAYER" oldLay)
  (setvar "OSMODE" oldOs)

  ;; --- LABEL below door ---
  (setq labelTxt (strcat (if (= openWay "L") "LH" "RH") " - Outside"))
  (drawTextCC "DOOR_OUTSIDE"
    (+ x0 (/ doorW 2.0)) (- y0 60.0) 30.0 labelTxt 1)
  
  ;; --- DOOR NUMBER below label ---
  (drawTextCC "UNIT_NUMBER"
    (+ x0 (/ doorW 2.0)) (- y0 110.0) 25.0 unitNum 7)
)

;;; Draw dashed line: 20mm dash, 5mm gap
(defun drawDashedLine (layer x1 y1 x2 y2 / dash gp len dx dy i sx sy ex ey)
  (setq dash 20.0 gp 5.0)
  (setq dx (- x2 x1) dy (- y2 y1))
  (setq len (sqrt (+ (* dx dx) (* dy dy))))
  (if (> len 0.01)
    (progn
      (setq dx (/ dx len) dy (/ dy len))
      (setq i 0.0)
      (while (< i len)
        (setq sx (+ x1 (* dx i)) sy (+ y1 (* dy i)))
        (setq i (+ i dash))
        (if (> i len) (setq i len))
        (setq ex (+ x1 (* dx i)) ey (+ y1 (* dy i)))
        (drawLine layer sx sy ex ey)
        (setq i (+ i gp))))))

;;;========================================
;;; C. INSIDE VIEW
;;; Same frame outer, but wall 50mm (overlap covers door edge)
;;; Door = green, dashed (behind frame)
;;; No hinges visible
;;; Label: "LH - Inside" or "RH - Inside"
;;;========================================
(defun drawDoorInside (x0 y0 doorW doorH openWay unitNum lockType /
                        gap fwOut fwIn
                        fL fR fT fLi fRi fTi
                        labelTxt)
  
  (setq gap 3.0)
  (setq fwOut 35.0)   ;; outside wall (for outer frame position)
  (setq fwIn 50.0)    ;; inside wall (overlap)
  
  ;; Frame outer edges (same as outside view)
  (setq fL (- x0 gap fwOut))
  (setq fR (+ x0 doorW gap fwOut))
  (setq fT (+ y0 doorH gap fwOut))
  ;; Frame inner edges (50mm from outer = overlaps onto door)
  (setq fLi (+ fL fwIn))
  (setq fRi (- fR fwIn))
  (setq fTi (- fT fwIn))
  
  ;; --- DOOR LEAF (dashed, green) ---
  (drawDashedLine "DOOR_INSIDE" x0 y0 (+ x0 doorW) y0)
  (drawDashedLine "DOOR_INSIDE" (+ x0 doorW) y0 (+ x0 doorW) (+ y0 doorH))
  (drawDashedLine "DOOR_INSIDE" (+ x0 doorW) (+ y0 doorH) x0 (+ y0 doorH))
  (drawDashedLine "DOOR_INSIDE" x0 (+ y0 doorH) x0 y0)
  
  ;; --- FRAME (3 sides, outer + inner, continuous) ---
  ;; Left leg
  (drawLine "FRAME" fL (- y0 5.0) fL fT)
  (drawLine "FRAME" fLi (- y0 5.0) fLi fTi)
  (drawLine "FRAME" fL (- y0 5.0) fLi (- y0 5.0))
  ;; Right leg
  (drawLine "FRAME" fR (- y0 5.0) fR fT)
  (drawLine "FRAME" fRi (- y0 5.0) fRi fTi)
  (drawLine "FRAME" fR (- y0 5.0) fRi (- y0 5.0))
  ;; Top
  (drawLine "FRAME" fL fT fR fT)
  (drawLine "FRAME" fLi fTi fRi fTi)

  ;; Miter joints 45deg
  (drawLine "FRAME" fL fT fLi fTi)
  (drawLine "FRAME" fR fT fRi fTi)
  
  ;; --- HANDLE (circle dia 55mm + lever trapezoid R4 fillet) ---
  (if (= openWay "L")
    (progn
      ;; LH inside: lever goes LEFT
      (drawCircle "DOOR_IRONMONGERY" (- (+ x0 doorW) 60.0) (+ y0 1000.0) 27.5)
      (entmake (list '(0 . "LWPOLYLINE") '(100 . "AcDbEntity")
        (cons 8 "DOOR_IRONMONGERY") '(100 . "AcDbPolyline") '(90 . 4) '(70 . 1)
        (cons 10 (list (- (+ x0 doorW) 60.0)       (- (+ y0 1000.0) 5.0)))
        (cons 10 (list (- (+ x0 doorW) 60.0 120.0) (- (+ y0 1000.0) 7.0)))
        (cons 10 (list (- (+ x0 doorW) 60.0 120.0) (+ (+ y0 1000.0) 7.0)))
        (cons 10 (list (- (+ x0 doorW) 60.0)       (+ (+ y0 1000.0) 5.0)))))
      (command "._FILLET" "_R" "4" "")
      (command "._FILLET" "_P" (entlast) "")
      (if (= lockType "E") (drawEurocylinder "DOOR_IRONMONGERY" (- (+ x0 doorW) 60.0) (+ y0 922.0)))
      (if (= lockType "B") (drawBathroom "DOOR_IRONMONGERY" (- (+ x0 doorW) 60.0) (+ y0 922.0))))
    (progn
      ;; RH inside: lever goes RIGHT
      (drawCircle "DOOR_IRONMONGERY" (+ x0 60.0) (+ y0 1000.0) 27.5)
      (entmake (list '(0 . "LWPOLYLINE") '(100 . "AcDbEntity")
        (cons 8 "DOOR_IRONMONGERY") '(100 . "AcDbPolyline") '(90 . 4) '(70 . 1)
        (cons 10 (list (+ x0 60.0)       (- (+ y0 1000.0) 5.0)))
        (cons 10 (list (+ x0 60.0 120.0) (- (+ y0 1000.0) 7.0)))
        (cons 10 (list (+ x0 60.0 120.0) (+ (+ y0 1000.0) 7.0)))
        (cons 10 (list (+ x0 60.0)       (+ (+ y0 1000.0) 5.0)))))
      (command "._FILLET" "_R" "4" "")
      (command "._FILLET" "_P" (entlast) "")
      (if (= lockType "E") (drawEurocylinder "DOOR_IRONMONGERY" (+ x0 60.0) (+ y0 922.0)))
      (if (= lockType "B") (drawBathroom "DOOR_IRONMONGERY" (+ x0 60.0) (+ y0 922.0))))
  )
  
  ;; --- LABELS below door ---
  (setq labelTxt (strcat (if (= openWay "L") "LH" "RH") " - Inside"))
  (drawTextCC "DOOR_INSIDE"
    (+ x0 (/ doorW 2.0)) (- y0 60.0) 30.0 labelTxt 94)
  
  ;; Door number below label
  (drawTextCC "UNIT_NUMBER"
    (+ x0 (/ doorW 2.0)) (- y0 110.0) 25.0 unitNum 7)
)

;;; Zawias z gory:
;;; - czesc stala = prawy prostokat + kolo (REGION+UNION)
;;; - czesc ruchoma = lewy prostokat (REGION, dla otwartego - ROTATE przed REGION)
(defun drawHingePlan (lay cx cy side openAng / r gx hcx hcy ar2
                      eStart e ss ss2 leftEnt ss3)
  (setq r   5.0)
  (setq gx  1.5)
  (setq hcx (if (= side "L") (+ cx 13.5) (- cx 13.5)))
  (setq hcy (- cy 27.0))

  ;; === 1. CZESC STALA: LH=prawy prostokat, RH=lewy prostokat + kolo - REGION + UNION ===
  (setq eStart (entlast))
  (if (= side "L")
    (drawRect lay (+ hcx gx) hcy (+ hcx gx 3.0) (+ hcy 32.0))
    (drawRect lay (- hcx gx 3.0) hcy (- hcx gx) (+ hcy 32.0)))
  (drawCircle lay hcx hcy r)
  (setq ss (ssadd))
  (setq e eStart)
  (while (setq e (entnext e)) (ssadd e ss))
  (command "._REGION" ss "")
  (setq ss2 (ssadd))
  (setq e eStart)
  (while (setq e (entnext e)) (ssadd e ss2))
  (command "._UNION" ss2 "")

  ;; === 2. CZESC RUCHOMA: LH=lewy prostokat, RH=prawy prostokat ===
  (if (= side "L")
    (entmake (list
      '(0 . "LWPOLYLINE") '(100 . "AcDbEntity") (cons 8 lay)
      '(100 . "AcDbPolyline") '(90 . 4) '(70 . 1)
      (cons 10 (list (- hcx gx 3.0) hcy))
      (cons 10 (list (- hcx gx)     hcy))
      (cons 10 (list (- hcx gx)     (+ hcy 32.0)))
      (cons 10 (list (- hcx gx 3.0) (+ hcy 32.0)))))
    (entmake (list
      '(0 . "LWPOLYLINE") '(100 . "AcDbEntity") (cons 8 lay)
      '(100 . "AcDbPolyline") '(90 . 4) '(70 . 1)
      (cons 10 (list (+ hcx gx)     hcy))
      (cons 10 (list (+ hcx gx 3.0) hcy))
      (cons 10 (list (+ hcx gx 3.0) (+ hcy 32.0)))
      (cons 10 (list (+ hcx gx)     (+ hcy 32.0))))))
  (setq leftEnt (entlast))

  ;; === 3. ROTATE jesli otwarty, potem REGION ===
  (if (/= openAng 0)
    (progn
      (setq ar2 (if (= side "L") openAng (- openAng)))
      (command "._ROTATE" leftEnt "" (list hcx hcy) ar2)))
  ;; REGION lewego prostokata przez ssadd
  (setq ss3 (ssadd leftEnt))
  (command "._REGION" ss3 ""))




;;;========================================
;;; HANDLE PLAN VIEW
;;; rozeta 55x4, szyja 10x25, dzwignia 110x10
;;; fillet 5mm na 4 koncach
;;;========================================
(defun drawHandlePlan (lay x0 y0 doorW openWay /
                       hX hYt hYb fw lt
                       rW rD sW sH lL lD sgn)
  (setq fw 45.0)
  (setq lt 44.0)
  (setq rW 27.5)   ;; rozeta polowa szerokosci
  (setq rD 4.0)    ;; rozeta glebokosc
  (setq sW 5.0)    ;; szyja polowa szerokosci
  (setq sH 25.0)   ;; szyja wysokosc
  (setq lL 110.0)  ;; dzwignia dlugosc
  (setq lD 10.0)   ;; dzwignia glebokosc

  ;; Pozycja X klamki: 60mm od strony zamkowej
  (setq hX (if (= openWay "L")
    (+ x0 fw 60.0)
    (- (+ x0 fw doorW) 60.0)))
  (setq hYt (+ y0 lt))  ;; podstawa zewnatrz
  (setq hYb y0)          ;; podstawa wewnatrz
  ;; LH: dzwignia w prawo (+1), RH: dzwignia w lewo (-1)
  (setq sgn (if (= openWay "L") 1.0 -1.0))

  ;; === ZEWNATRZ (powyzej skrzydla) ===
  (entmake (list
    '(0 . "LWPOLYLINE") '(100 . "AcDbEntity") (cons 8 lay)
    '(100 . "AcDbPolyline") '(90 . 11) '(70 . 1)
    (cons 10 (list (- hX rW)                   hYt))
    (cons 10 (list (+ hX rW)                   hYt))
    (cons 10 (list (+ hX (* sgn rW))            (+ hYt rD)))
    (cons 10 (list (+ hX (* sgn sW))            (+ hYt rD)))
    (cons 10 (list (+ hX (* sgn sW))            (+ hYt rD sH)))
    (cons 10 (list (+ hX (* sgn (+ sW lL)))     (+ hYt rD sH)))
    (cons 10 (list (+ hX (* sgn (+ sW lL)))     (+ hYt rD sH lD)))
    (cons 10 (list (+ hX (* sgn sW))            (+ hYt rD sH lD)))
    (cons 10 (list (- hX (* sgn sW))            (+ hYt rD sH lD)))
    (cons 10 (list (- hX (* sgn sW))            (+ hYt rD)))
    (cons 10 (list (- hX (* sgn rW))            (+ hYt rD)))))
  (command "._FILLET" "_R" "2" "")
  (command "._FILLET" "_P" (entlast) "")

  ;; === WEWNATRZ (ponizej skrzydla) ===
  (entmake (list
    '(0 . "LWPOLYLINE") '(100 . "AcDbEntity") (cons 8 lay)
    '(100 . "AcDbPolyline") '(90 . 11) '(70 . 1)
    (cons 10 (list (- hX rW)                   hYb))
    (cons 10 (list (+ hX rW)                   hYb))
    (cons 10 (list (+ hX (* sgn rW))            (- hYb rD)))
    (cons 10 (list (+ hX (* sgn sW))            (- hYb rD)))
    (cons 10 (list (+ hX (* sgn sW))            (- hYb rD sH)))
    (cons 10 (list (+ hX (* sgn (+ sW lL)))     (- hYb rD sH)))
    (cons 10 (list (+ hX (* sgn (+ sW lL)))     (- hYb rD sH lD)))
    (cons 10 (list (+ hX (* sgn sW))            (- hYb rD sH lD)))
    (cons 10 (list (- hX (* sgn sW))            (- hYb rD sH lD)))
    (cons 10 (list (- hX (* sgn sW))            (- hYb rD)))
    (cons 10 (list (- hX (* sgn rW))            (- hYb rD)))))
  (command "._FILLET" "_R" "2" "")
  (command "._FILLET" "_P" (entlast) ""))


;;; Frame: 100mm deep, 4mm thick
;;; Rebate: 12mm + 3mm gap from inside
;;; Door leaf: 44mm thick, open 30deg
;;;========================================
(defun drawDoorPlan (x0 y0 doorW openWay frameW /
                     fw fd lt gp ang ar ca sa shiftX ofs ntch
                     lx rx olx orx
                     hx hy
                     phC phE rphC rphE
                     ohX ohYt ohYb osgn orW orD osW osH olL olD
                     hp1 hp2 hp3 hp4 hp5 hp6 hp7 hp8 hp9 hp10 hp11
                     p1 p2 p3 p4
                     r1 r2 r3 r4 arcR ox)

  (setq fw   45.0)   ;; szerokosc profilu ramy - stala
  (setq fd   frameW) ;; glebokosc profilu ramy - z menu
  (setq lt   44.0)    ;; grubosc skrzydla
  (setq gp   3.0)     ;; luz
  (setq ang  30.0)

  ;; =====================================================
  ;; WIDOK 1: ZAMKNIETE  (x0, y0)
  ;; ofs=12mm overlap, gap=3mm (notch=15mm)
  ;; =====================================================
  (setq ofs 12.0)
  (setq ntch 15.0)

  ;; Lewy jamb - profil L, wcięcie po PRAWEJ stronie (ku drzwiom)
  ;; Jamb przesunieta 12mm w prawo: x0+ofs do x0+ofs+fw
  (setq lx (+ x0 ofs))
  (drawLine "FRAME" lx y0 lx (+ y0 fd))                          ;; lewy bok pelny
  (drawLine "FRAME" lx (+ y0 fd) (+ lx fw) (+ y0 fd))           ;; gora
  (drawLine "FRAME" (+ lx fw) (+ y0 fd) (+ lx fw) (+ y0 47.0)) ;; prawy bok od gory do y0+47
  (drawLine "FRAME" (+ lx fw) (+ y0 47.0) (- (+ lx fw) ntch) (+ y0 47.0)) ;; wcięcie gora
  (drawLine "FRAME" (- (+ lx fw) ntch) (+ y0 47.0) (- (+ lx fw) ntch) y0) ;; wcięcie lewy bok
  (drawLine "FRAME" (- (+ lx fw) ntch) y0 lx y0)                ;; dol od wciecia do lewej

  ;; Prawy jamb - profil L, wcięcie po LEWEJ stronie (ku drzwiom)
  ;; Jamb przesunieta 12mm w lewo: x0+fw+doorW-ofs do x0+fw+doorW-ofs+fw
  (setq rx (- (+ x0 fw doorW) ofs))
  (drawLine "FRAME" (+ rx fw) y0 (+ rx fw) (+ y0 fd))           ;; prawy bok pelny
  (drawLine "FRAME" (+ rx fw) (+ y0 fd) rx (+ y0 fd))           ;; gora
  (drawLine "FRAME" rx (+ y0 fd) rx (+ y0 47.0))                ;; lewy bok od gory do y0+47
  (drawLine "FRAME" rx (+ y0 47.0) (+ rx ntch) (+ y0 47.0))    ;; wcięcie gora
  (drawLine "FRAME" (+ rx ntch) (+ y0 47.0) (+ rx ntch) y0)    ;; wcięcie prawy bok
  (drawLine "FRAME" (+ rx ntch) y0 (+ rx fw) y0)               ;; dol od wciecia do prawej

  ;; Skrzydlo zamkniete
  (drawRect "DOOR_INSIDE"
    (+ x0 fw) y0
    (+ x0 fw doorW) (+ y0 lt))

  ;; Zawias
  (if (= openWay "L")
    (drawHingePlan "DOOR_IRONMONGERY" rx (+ y0 (/ lt 2.0)) "L" 0)
    (drawHingePlan "DOOR_IRONMONGERY" (+ lx fw) (+ y0 (/ lt 2.0)) "R" 0))

  ;; Klamka
  (drawHandlePlan "DOOR_IRONMONGERY" x0 y0 doorW openWay)

  ;; Etykieta
  (drawTextCC "UNIT_NUMBER"
    (+ x0 fw (/ doorW 2.0)) (- y0 60.0) 25.0 "Closed" 7)

  ;; Wymiar 1: szerokosc swiatla drzwi (doorW) - ponizej
  (drawDimHFront (+ x0 fw) (+ x0 fw doorW) y0)

  ;; Wymiar 2: glebokosc ramy (fd) - pionowy po lewej
  (setvar "OSMODE" 0)
  (setvar "CLAYER" "DIMENSIONS")
  (command "_.DIMLINEAR"
    "_non" (list lx y0)
    "_non" (list lx (+ y0 fd))
    "_non" (list (- lx 80.0) (/ (+ y0 (+ y0 fd)) 2.0)))

  (setvar "CLAYER" "FRAME")

  ;; =====================================================
  ;; WIDOK 2: OTWARTE  (ox, y0)
  ;; =====================================================
  (setq ox (+ x0 fw doorW fw 200.0))

  ;; Lewy jamb - profil L, wcięcie po PRAWEJ (ku drzwiom)
  (setq olx (+ ox ofs))
  (drawLine "FRAME" olx y0 olx (+ y0 fd))
  (drawLine "FRAME" olx (+ y0 fd) (+ olx fw) (+ y0 fd))
  (drawLine "FRAME" (+ olx fw) (+ y0 fd) (+ olx fw) (+ y0 47.0))
  (drawLine "FRAME" (+ olx fw) (+ y0 47.0) (- (+ olx fw) ntch) (+ y0 47.0))
  (drawLine "FRAME" (- (+ olx fw) ntch) (+ y0 47.0) (- (+ olx fw) ntch) y0)
  (drawLine "FRAME" (- (+ olx fw) ntch) y0 olx y0)

  ;; Prawy jamb - profil L, wcięcie po LEWEJ (ku drzwiom)
  (setq orx (- (+ ox fw doorW) ofs))
  (drawLine "FRAME" (+ orx fw) y0 (+ orx fw) (+ y0 fd))
  (drawLine "FRAME" (+ orx fw) (+ y0 fd) orx (+ y0 fd))
  (drawLine "FRAME" orx (+ y0 fd) orx (+ y0 47.0))
  (drawLine "FRAME" orx (+ y0 47.0) (+ orx ntch) (+ y0 47.0))
  (drawLine "FRAME" (+ orx ntch) (+ y0 47.0) (+ orx ntch) y0)
  (drawLine "FRAME" (+ orx ntch) y0 (+ orx fw) y0)

  ;; Pivot point
  (if (= openWay "L")
    (progn (setq hx orx) (setq hy y0))
    (progn (setq hx (+ olx fw)) (setq hy y0)))

  ;; Zawias
  (if (= openWay "L")
    (drawHingePlan "DOOR_IRONMONGERY" hx (+ hy (/ lt 2.0)) "L" 30)
    (drawHingePlan "DOOR_IRONMONGERY" hx (+ hy (/ lt 2.0)) "R" 30))

  ;; Narozniki skrzydla (bez przesuniecia - obrot od pivot)
  (if (= openWay "L")
    (progn
      (setq p1 (list hx           hy))
      (setq p2 (list hx           (+ hy lt)))
      (setq p3 (list (+ ox fw)    (+ hy lt)))
      (setq p4 (list (+ ox fw)    hy)))
    (progn
      (setq p1 (list hx              hy))
      (setq p2 (list hx              (+ hy lt)))
      (setq p3 (list (+ ox fw doorW) (+ hy lt)))
      (setq p4 (list (+ ox fw doorW) hy))))

  ;; Obrot
  (if (= openWay "L")
    (setq ar (* (/ pi 180.0) ang))
    (setq ar (* (/ pi 180.0) (- ang))))
  (setq ca (cos ar))
  (setq sa (sin ar))

  (defun rotPt (pt / dx dy)
    (setq dx (- (car pt) hx))
    (setq dy (- (cadr pt) hy))
    (list
      (+ hx (- (* dx ca) (* dy sa)))
      (+ hy (+ (* dx sa) (* dy ca)))))

  ;; Obrot, potem przesuniecie (LH=+8.88 w prawo, RH=-8.88 w lewo)
  (setq shiftX (if (= openWay "L") 8.88 -8.88))
  (setq r1 (list (+ (car (rotPt p1)) shiftX) (cadr (rotPt p1))))
  (setq r2 (list (+ (car (rotPt p2)) shiftX) (cadr (rotPt p2))))
  (setq r3 (list (+ (car (rotPt p3)) shiftX) (cadr (rotPt p3))))
  (setq r4 (list (+ (car (rotPt p4)) shiftX) (cadr (rotPt p4))))

  ;; Skrzydlo otwarte
  (entmake (list
    '(0 . "LWPOLYLINE") '(100 . "AcDbEntity")
    (cons 8 "DOOR_OUTSIDE") '(100 . "AcDbPolyline") '(90 . 4) '(70 . 1)
    (cons 10 r1) (cons 10 r2) (cons 10 r3) (cons 10 r4)))

  ;; Klamka otwarta - te same punkty co drawHandlePlan, obrocone przez rotPt+shiftX
  (setq ohX (if (= openWay "L") (+ ox fw 60.0) (- (+ ox fw doorW) 60.0)))
  (setq ohYt (+ hy lt))
  (setq ohYb hy)
  (setq osgn (if (= openWay "L") 1.0 -1.0))
  (setq orW 27.5  orD 4.0  osW 5.0  osH 25.0  olL 110.0  olD 10.0)

  ;; Definiuje liste 11 punktow dla zewnatrz i wewnatrz, obraca kazdy
  (defun rotShift (pt)
    (list (+ (car (rotPt pt)) shiftX) (cadr (rotPt pt))))

  ;; ZEWNATRZ
  (setq hp1  (rotShift (list (- ohX orW)                      ohYt)))
  (setq hp2  (rotShift (list (+ ohX orW)                      ohYt)))
  (setq hp3  (rotShift (list (+ ohX (* osgn orW))             (+ ohYt orD))))
  (setq hp4  (rotShift (list (+ ohX (* osgn osW))             (+ ohYt orD))))
  (setq hp5  (rotShift (list (+ ohX (* osgn osW))             (+ ohYt orD osH))))
  (setq hp6  (rotShift (list (+ ohX (* osgn (+ osW olL)))     (+ ohYt orD osH))))
  (setq hp7  (rotShift (list (+ ohX (* osgn (+ osW olL)))     (+ ohYt orD osH olD))))
  (setq hp8  (rotShift (list (+ ohX (* osgn osW))             (+ ohYt orD osH olD))))
  (setq hp9  (rotShift (list (- ohX (* osgn osW))             (+ ohYt orD osH olD))))
  (setq hp10 (rotShift (list (- ohX (* osgn osW))             (+ ohYt orD))))
  (setq hp11 (rotShift (list (- ohX (* osgn orW))             (+ ohYt orD))))
  (entmake (list
    '(0 . "LWPOLYLINE") '(100 . "AcDbEntity") (cons 8 "DOOR_IRONMONGERY")
    '(100 . "AcDbPolyline") '(90 . 11) '(70 . 1)
    (cons 10 hp1) (cons 10 hp2) (cons 10 hp3) (cons 10 hp4)
    (cons 10 hp5) (cons 10 hp6) (cons 10 hp7) (cons 10 hp8)
    (cons 10 hp9) (cons 10 hp10) (cons 10 hp11)))
  (command "._FILLET" "_R" "2" "")
  (command "._FILLET" "_P" (entlast) "")

  ;; WEWNATRZ
  (setq hp1  (rotShift (list (- ohX orW)                      ohYb)))
  (setq hp2  (rotShift (list (+ ohX orW)                      ohYb)))
  (setq hp3  (rotShift (list (+ ohX (* osgn orW))             (- ohYb orD))))
  (setq hp4  (rotShift (list (+ ohX (* osgn osW))             (- ohYb orD))))
  (setq hp5  (rotShift (list (+ ohX (* osgn osW))             (- ohYb orD osH))))
  (setq hp6  (rotShift (list (+ ohX (* osgn (+ osW olL)))     (- ohYb orD osH))))
  (setq hp7  (rotShift (list (+ ohX (* osgn (+ osW olL)))     (- ohYb orD osH olD))))
  (setq hp8  (rotShift (list (+ ohX (* osgn osW))             (- ohYb orD osH olD))))
  (setq hp9  (rotShift (list (- ohX (* osgn osW))             (- ohYb orD osH olD))))
  (setq hp10 (rotShift (list (- ohX (* osgn osW))             (- ohYb orD))))
  (setq hp11 (rotShift (list (- ohX (* osgn orW))             (- ohYb orD))))
  (entmake (list
    '(0 . "LWPOLYLINE") '(100 . "AcDbEntity") (cons 8 "DOOR_IRONMONGERY")
    '(100 . "AcDbPolyline") '(90 . 11) '(70 . 1)
    (cons 10 hp1) (cons 10 hp2) (cons 10 hp3) (cons 10 hp4)
    (cons 10 hp5) (cons 10 hp6) (cons 10 hp7) (cons 10 hp8)
    (cons 10 hp9) (cons 10 hp10) (cons 10 hp11)))
  (command "._FILLET" "_R" "2" "")
  (command "._FILLET" "_P" (entlast) "")

  ;; Luk otwarcia - promien = doorW (od pivot do naroznika zamkowego)
  (setq arcR doorW)
  (if (= openWay "L")
    ;; LH: 180 -> 210
    (entmake (list '(0 . "ARC") '(100 . "AcDbEntity") (cons 8 "DIMENSIONS")
      (cons 62 8)
      '(100 . "AcDbCircle") (cons 10 (list hx hy 0.0)) (cons 40 arcR)
      '(100 . "AcDbArc")
      (cons 50 (* (/ pi 180.0) 180.0))
      (cons 51 (* (/ pi 180.0) 210.0))))
    ;; RH: 330 -> 360
    (entmake (list '(0 . "ARC") '(100 . "AcDbEntity") (cons 8 "DIMENSIONS")
      (cons 62 8)
      '(100 . "AcDbCircle") (cons 10 (list hx hy 0.0)) (cons 40 arcR)
      '(100 . "AcDbArc")
      (cons 50 (* (/ pi 180.0) 330.0))
      (cons 51 (* (/ pi 180.0) 360.0)))))

  ;; Etykieta
  (drawTextCC "UNIT_NUMBER"
    (+ ox fw (/ doorW 2.0)) (- y0 60.0) 25.0 "Open 30" 7))



(defun c:DOOR_SINGLE ( / doorW doorH doorThick frameDepth frameW
                        hingePos unitNum visionPanel lockType lockExtra
                        pt x0 y0 sizeChoice inputType customW
                        viewGap outsideW vx px
                        _oldCmdecho _oldOsmode _oldClayer _olderr)
  
  ;; Save state
  (setq _oldCmdecho (getvar "CMDECHO"))
  (setq _oldOsmode  (getvar "OSMODE"))
  (setq _oldClayer  (getvar "CLAYER"))
  (setq _olderr *error*)
  
  ;; Error handler
  (defun *error* (msg)
    (if _oldClayer  (setvar "CLAYER"  _oldClayer))
    (if _oldOsmode  (setvar "OSMODE"  _oldOsmode))
    (if _oldCmdecho (setvar "CMDECHO" _oldCmdecho))
    (setq *error* _olderr)
    (if (and msg (not (wcmatch (strcase msg) "*CANCEL*,*QUIT*,*EXIT*")))
      (princ (strcat "\nERROR: " msg)))
    (princ))
  
  (setvar "CMDECHO" 0)
  
  ;; === INPUT ===
  
  ;; 1. Door width
  (setq sizeChoice (getstring "\nStandard door size? [Y/N] <Y>: "))
  (if (= sizeChoice "") (setq sizeChoice "Y"))
  (setq sizeChoice (strcase sizeChoice))
  
  (if (= sizeChoice "Y")
    (progn
      (initget "626 686 726 762 826 838 926 1056")
      (setq doorW (getkword "\nSelect door width [626/686/726/762/826/838/926/1056]: "))
      (if (null doorW) (setq doorW "726"))
      (setq doorW (atof doorW)))
    (progn
      (setq doorW (getreal "\nDoor leaf WIDTH [mm]: "))
      (if (or (null doorW) (<= doorW 0.0))
        (progn (princ "\nInvalid width.") (setvar "CMDECHO" _oldCmdecho) (exit)))))
  
  ;; 2. Door height
  (setq doorH (getreal "\nDoor leaf HEIGHT [mm] <2040>: "))
  (if (or (null doorH) (<= doorH 0.0)) (setq doorH 2040.0))
  
  ;; 3. Open way
  (setq hingePos (getstring "\nOpen way [L=Left / R=Right] <L>: "))
  (if (= hingePos "") (setq hingePos "L"))
  (setq hingePos (strcase hingePos))
  (if (not (or (= hingePos "L") (= hingePos "R"))) (setq hingePos "L"))
  
  ;; 4. Non-standard lock
  (setq lockType "N")
  (setq lockExtra (getstring "\nNon-standard lock? [Y/N] <N>: "))
  (if (= lockExtra "") (setq lockExtra "N"))
  (setq lockExtra (strcase lockExtra))
  (if (= lockExtra "Y")
    (progn
      (setq lockType (getstring "\nLock type [B=Bathroom / E=Eurocylinder] <B>: "))
      (if (= lockType "") (setq lockType "B"))
      (setq lockType (strcase lockType))
      (if (not (or (= lockType "B") (= lockType "E"))) (setq lockType "B"))))
  
  ;; 5. Frame depth
  (setq frameW (getreal "\nFrame depth [mm] <100>: "))
  (if (or (null frameW) (<= frameW 0.0)) (setq frameW 100.0))

  ;; 6. Door number
  (setq unitNum (getstring T "\nDoor number <DR01>: "))
  (if (= unitNum "") (setq unitNum "DR01"))
  
  ;; 6. Insertion point (last!)
  (setq pt (getpoint "\nInsertion point (bottom-left of door leaf): "))
  (if (null pt)
    (progn (princ "\nNo point selected.") (setvar "CMDECHO" _oldCmdecho) (exit)))
  (setq x0 (car pt) y0 (cadr pt))
  
  ;; === LAYERS ===
  (createDoorLayers)
  
  ;; === DRAW OUTSIDE VIEW ===
  (drawDoorOutside x0 y0 doorW doorH hingePos unitNum lockType)
  
  ;; === DRAW INSIDE VIEW (300mm gap between frame edges) ===
  (setq viewGap 300.0)
  (setq vx (+ x0 doorW 3.0 35.0 viewGap 35.0 3.0))
  (drawDoorInside vx y0 doorW doorH hingePos unitNum lockType)

  ;; === DRAW PLAN VIEW (300mm gap after inside view) ===
  (setq px (+ vx doorW 3.0 35.0 viewGap))
  (drawDoorPlan px y0 doorW hingePos frameW)
  
  ;; === RESTORE STATE ===
  (if _oldClayer  (setvar "CLAYER"  _oldClayer))
  (if _oldOsmode  (setvar "OSMODE"  _oldOsmode))
  (if _oldCmdecho (setvar "CMDECHO" _oldCmdecho))
  (setq *error* _olderr)
  
  (princ (strcat "\nDOOR_SINGLE - Done! " (rtos doorW 2 0) "x" (rtos doorH 2 0)))
  (princ))

(princ "\nKIT_DOOR_SINGLE loaded. Type DOOR_SINGLE to run.")
(princ)