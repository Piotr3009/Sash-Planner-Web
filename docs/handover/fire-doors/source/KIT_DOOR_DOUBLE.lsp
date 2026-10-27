;;;========================================
;;; KIT_DOOR_DOUBLE.lsp
;;; Double Doors with Frame
;;; Command: DOOR_DOUBLE
;;; Base point: bottom-left of left door leaf
;;; Requires: SKYLON_COMMON.lsp loaded first
;;;
;;; INPUT: overall frame size (incl. frame members)
;;; Frame width outer  = leafL + leafR + gapMid(3) + 2*(gap(3)+fw(35))
;;;                    = totalLeaf + 3 + 76 = totalLeaf + 79
;;; Frame height outer = doorH + gap(3) + fw(35) + 5 = doorH + 43
;;;
;;; handleLeaf = L or R viewed from OUTSIDE
;;; User is asked from INSIDE - code converts
;;;========================================

(if (null drawRect) (load "SKYLON_COMMON"))

;;;========================================
;;; A. LAYERS
;;;========================================
(defun createDoubleDoorLayers ()
  (command "._LAYER" "_M" "FRAME" "_C" "7" "FRAME" "")
  (command "._LAYER" "_M" "DOOR_OUTSIDE" "_C" "1" "DOOR_OUTSIDE" "")
  (command "._LAYER" "_M" "DOOR_INSIDE" "_C" "94" "DOOR_INSIDE" "")
  (command "._LAYER" "_M" "DOOR_IRONMONGERY" "_C" "7" "DOOR_IRONMONGERY" "")
  (command "._LAYER" "_M" "DIMENSIONS" "_C" "5" "DIMENSIONS" "")
  (command "._LAYER" "_M" "UNIT_NUMBER" "_C" "5" "UNIT_NUMBER" "")
  (command "._LAYER" "_M" "SUMMARY" "_C" "7" "SUMMARY" ""))

;;;========================================
;;; B. UTILITIES
;;;========================================

(defun drawTextCCd (layer x y height txt color / )
  (entmake (list '(0 . "TEXT") '(100 . "AcDbEntity") (cons 8 layer) (cons 62 color)
    '(100 . "AcDbText") (cons 10 (list x y 0.0)) (cons 40 height) (cons 1 txt)
    '(72 . 1) (cons 11 (list x y 0.0)) '(100 . "AcDbText") '(73 . 2))))

(defun drawDashedLineD (layer x1 y1 x2 y2 / dash gp len dx dy i sx sy ex ey)
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

;;; Hinge plan view (identical logic to KIT_DOOR_SINGLE)
(defun drawHingePlanD (lay cx cy side openAng / r gx hcx hcy eStart e ss ss2 leftEnt ss3 ar2)
  (setq r 5.0 gx 1.5)
  (setq hcx (if (= side "L") (+ cx 13.5) (- cx 13.5)))
  (setq hcy (- cy 27.0))
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
  (if (= side "L")
    (entmake (list '(0 . "LWPOLYLINE") '(100 . "AcDbEntity") (cons 8 lay)
      '(100 . "AcDbPolyline") '(90 . 4) '(70 . 1)
      (cons 10 (list (- hcx gx 3.0) hcy))
      (cons 10 (list (- hcx gx)     hcy))
      (cons 10 (list (- hcx gx)     (+ hcy 32.0)))
      (cons 10 (list (- hcx gx 3.0) (+ hcy 32.0)))))
    (entmake (list '(0 . "LWPOLYLINE") '(100 . "AcDbEntity") (cons 8 lay)
      '(100 . "AcDbPolyline") '(90 . 4) '(70 . 1)
      (cons 10 (list (+ hcx gx)     hcy))
      (cons 10 (list (+ hcx gx 3.0) hcy))
      (cons 10 (list (+ hcx gx 3.0) (+ hcy 32.0)))
      (cons 10 (list (+ hcx gx)     (+ hcy 32.0))))))
  (setq leftEnt (entlast))
  (if (/= openAng 0)
    (progn
      (setq ar2 (if (= side "L") openAng (- openAng)))
      (command "._ROTATE" leftEnt "" (list hcx hcy) ar2)))
  (setq ss3 (ssadd leftEnt))
  (command "._REGION" ss3 ""))

;;; Handle plan view - IDENTICAL code to KIT_DOOR_SINGLE drawHandlePlan
;;; hX  = rose center X
;;; hy  = base Y (inside face of leaf)
;;; lt  = door leaf thickness
;;; sgn = +1.0 lever RIGHT, -1.0 lever LEFT
(defun drawHandlePlanD (lay hX hy lt sgn /
                        hYt hYb rW rD sW sH lL lD)
  (setq hYt (+ hy lt))
  (setq hYb hy)
  (setq rW 27.5)
  (setq rD 4.0)
  (setq sW 5.0)
  (setq sH 25.0)
  (setq lL 110.0)
  (setq lD 10.0)
  ;; OUTSIDE face
  (entmake (list
    '(0 . "LWPOLYLINE") '(100 . "AcDbEntity") (cons 8 lay)
    '(100 . "AcDbPolyline") '(90 . 11) '(70 . 1)
    (cons 10 (list (- hX rW)                  hYt))
    (cons 10 (list (+ hX rW)                  hYt))
    (cons 10 (list (+ hX (* sgn rW))           (+ hYt rD)))
    (cons 10 (list (+ hX (* sgn sW))           (+ hYt rD)))
    (cons 10 (list (+ hX (* sgn sW))           (+ hYt rD sH)))
    (cons 10 (list (+ hX (* sgn (+ sW lL)))    (+ hYt rD sH)))
    (cons 10 (list (+ hX (* sgn (+ sW lL)))    (+ hYt rD sH lD)))
    (cons 10 (list (+ hX (* sgn sW))           (+ hYt rD sH lD)))
    (cons 10 (list (- hX (* sgn sW))           (+ hYt rD sH lD)))
    (cons 10 (list (- hX (* sgn sW))           (+ hYt rD)))
    (cons 10 (list (- hX (* sgn rW))           (+ hYt rD)))))
  (command "._FILLET" "_R" "2" "")
  (command "._FILLET" "_P" (entlast) "")
  ;; INSIDE face
  (entmake (list
    '(0 . "LWPOLYLINE") '(100 . "AcDbEntity") (cons 8 lay)
    '(100 . "AcDbPolyline") '(90 . 11) '(70 . 1)
    (cons 10 (list (- hX rW)                  hYb))
    (cons 10 (list (+ hX rW)                  hYb))
    (cons 10 (list (+ hX (* sgn rW))           (- hYb rD)))
    (cons 10 (list (+ hX (* sgn sW))           (- hYb rD)))
    (cons 10 (list (+ hX (* sgn sW))           (- hYb rD sH)))
    (cons 10 (list (+ hX (* sgn (+ sW lL)))    (- hYb rD sH)))
    (cons 10 (list (+ hX (* sgn (+ sW lL)))    (- hYb rD sH lD)))
    (cons 10 (list (+ hX (* sgn sW))           (- hYb rD sH lD)))
    (cons 10 (list (- hX (* sgn sW))           (- hYb rD sH lD)))
    (cons 10 (list (- hX (* sgn sW))           (- hYb rD)))
    (cons 10 (list (- hX (* sgn rW))           (- hYb rD)))))
  (command "._FILLET" "_R" "2" "")
  (command "._FILLET" "_P" (entlast) ""))


;;;========================================
;;; C. OUTSIDE VIEW
;;; x0,y0 = bottom-left of left door leaf
;;; gapMid = 3mm gap between leaves at meeting point
;;; handleLeaf = "L" or "R" from OUTSIDE view
;;;========================================
(defun drawDoubleDoorOutside (x0 y0 leafL leafR doorH handleLeaf unitNum /
  gap gapMid fw totalW meetL meetR
  fL fR fT fLi fRi fTi
  hW hH h1b h1t h2b h2t h3b h3t
  hxLL1 hxLL2 hxRL1 hxRL2
  oldOs oldLay)

  (setq gap 3.0 gapMid 3.0 fw 35.0 hW 10.0 hH 102.0)
  (setq totalW (+ leafL leafR gapMid))
  ;; 3mm gap between leaves
  (setq meetL (+ x0 leafL))           ;; left leaf right edge
  (setq meetR (+ x0 leafL gapMid))    ;; right leaf left edge

  ;; Frame outer edges
  (setq fL  (- x0 gap fw))
  (setq fR  (+ x0 totalW gap fw))
  (setq fT  (+ y0 doorH gap fw))
  (setq fLi (- x0 gap))
  (setq fRi (+ x0 totalW gap))
  (setq fTi (+ y0 doorH gap))

  ;; Hinge Y positions (3 per leaf)
  (setq h1t (- (+ y0 doorH) 145.0))
  (setq h1b (- h1t hH))
  (setq h2t (- (+ y0 doorH) 700.0))
  (setq h2b (- h2t hH))
  (setq h3b (+ y0 200.0))
  (setq h3t (+ h3b hH))

  ;; Left leaf: hinges on LEFT side
  (setq hxLL2 (+ x0 3.5))
  (setq hxLL1 (- hxLL2 hW))

  ;; Right leaf: hinges on RIGHT side
  (setq hxRL1 (- (+ x0 totalW) 3.5))
  (setq hxRL2 (+ hxRL1 hW))

  ;; === LEFT LEAF ===
  (drawLine "DOOR_OUTSIDE" x0 y0 meetL y0)
  (drawLine "DOOR_OUTSIDE" x0 (+ y0 doorH) meetL (+ y0 doorH))
  (drawLine "DOOR_OUTSIDE" meetL y0 meetL (+ y0 doorH))
  ;; Hinge side interrupted
  (drawLine "DOOR_OUTSIDE" x0 y0 x0 h3b)
  (drawLine "DOOR_OUTSIDE" x0 h3t x0 h2b)
  (drawLine "DOOR_OUTSIDE" x0 h2t x0 h1b)
  (drawLine "DOOR_OUTSIDE" x0 h1t x0 (+ y0 doorH))

  ;; === RIGHT LEAF ===
  (drawLine "DOOR_OUTSIDE" meetR y0 (+ x0 totalW) y0)
  (drawLine "DOOR_OUTSIDE" meetR (+ y0 doorH) (+ x0 totalW) (+ y0 doorH))
  (drawLine "DOOR_OUTSIDE" meetR y0 meetR (+ y0 doorH))
  ;; Hinge side interrupted
  (drawLine "DOOR_OUTSIDE" (+ x0 totalW) y0 (+ x0 totalW) h3b)
  (drawLine "DOOR_OUTSIDE" (+ x0 totalW) h3t (+ x0 totalW) h2b)
  (drawLine "DOOR_OUTSIDE" (+ x0 totalW) h2t (+ x0 totalW) h1b)
  (drawLine "DOOR_OUTSIDE" (+ x0 totalW) h1t (+ x0 totalW) (+ y0 doorH))

  ;; === FRAME ===
  (drawLine "FRAME" fL (- y0 5.0) fL fT)
  (drawLine "FRAME" fL (- y0 5.0) fLi (- y0 5.0))
  (drawLine "FRAME" fLi (- y0 5.0) fLi h3b)
  (drawLine "FRAME" fLi h3t fLi h2b)
  (drawLine "FRAME" fLi h2t fLi h1b)
  (drawLine "FRAME" fLi h1t fLi fTi)
  (drawLine "FRAME" fR (- y0 5.0) fR fT)
  (drawLine "FRAME" fR (- y0 5.0) fRi (- y0 5.0))
  (drawLine "FRAME" fRi (- y0 5.0) fRi h3b)
  (drawLine "FRAME" fRi h3t fRi h2b)
  (drawLine "FRAME" fRi h2t fRi h1b)
  (drawLine "FRAME" fRi h1t fRi fTi)
  (drawLine "FRAME" fL fT fR fT)
  (drawLine "FRAME" fLi fTi fRi fTi)
  (drawLine "FRAME" fL fT fLi fTi)
  (drawLine "FRAME" fR fT fRi fTi)

  ;; === LEFT HINGES (3x) ===
  (foreach hBot (list h1b h2b h3b)
    (drawLine "DOOR_IRONMONGERY" hxLL1 hBot hxLL2 hBot)
    (drawLine "DOOR_IRONMONGERY" hxLL2 hBot hxLL2 (+ hBot hH))
    (drawLine "DOOR_IRONMONGERY" hxLL2 (+ hBot hH) hxLL1 (+ hBot hH))
    (drawLine "DOOR_IRONMONGERY" hxLL1 (+ hBot hH) hxLL1 hBot)
    (drawLine "DOOR_IRONMONGERY" hxLL1 (+ hBot (* hH 0.25)) hxLL2 (+ hBot (* hH 0.25)))
    (drawLine "DOOR_IRONMONGERY" hxLL1 (+ hBot (* hH 0.50)) hxLL2 (+ hBot (* hH 0.50)))
    (drawLine "DOOR_IRONMONGERY" hxLL1 (+ hBot (* hH 0.75)) hxLL2 (+ hBot (* hH 0.75))))

  ;; === RIGHT HINGES (3x) ===
  (foreach hBot (list h1b h2b h3b)
    (drawLine "DOOR_IRONMONGERY" hxRL1 hBot hxRL2 hBot)
    (drawLine "DOOR_IRONMONGERY" hxRL2 hBot hxRL2 (+ hBot hH))
    (drawLine "DOOR_IRONMONGERY" hxRL2 (+ hBot hH) hxRL1 (+ hBot hH))
    (drawLine "DOOR_IRONMONGERY" hxRL1 (+ hBot hH) hxRL1 hBot)
    (drawLine "DOOR_IRONMONGERY" hxRL1 (+ hBot (* hH 0.25)) hxRL2 (+ hBot (* hH 0.25)))
    (drawLine "DOOR_IRONMONGERY" hxRL1 (+ hBot (* hH 0.50)) hxRL2 (+ hBot (* hH 0.50)))
    (drawLine "DOOR_IRONMONGERY" hxRL1 (+ hBot (* hH 0.75)) hxRL2 (+ hBot (* hH 0.75))))

  ;; === HANDLE (same trapezoid+fillet code as KIT_DOOR_SINGLE) ===
  ;; handleLeaf="L": on left leaf, rose 60mm from meetL, lever LEFT
  ;; handleLeaf="R": on right leaf, rose 60mm from meetR, lever RIGHT
  (if (= handleLeaf "L")
    (progn
      (drawCircle "DOOR_IRONMONGERY" (- meetL 60.0) (+ y0 1000.0) 27.5)
      (entmake (list '(0 . "LWPOLYLINE") '(100 . "AcDbEntity")
        (cons 8 "DOOR_IRONMONGERY") '(100 . "AcDbPolyline") '(90 . 4) '(70 . 1)
        (cons 10 (list (- meetL 60.0)       (- (+ y0 1000.0) 5.0)))
        (cons 10 (list (- meetL 60.0 120.0) (- (+ y0 1000.0) 7.0)))
        (cons 10 (list (- meetL 60.0 120.0) (+ (+ y0 1000.0) 7.0)))
        (cons 10 (list (- meetL 60.0)       (+ (+ y0 1000.0) 5.0)))))
      (command "._FILLET" "_R" "4" "")
      (command "._FILLET" "_P" (entlast) ""))
    (progn
      (drawCircle "DOOR_IRONMONGERY" (+ meetR 60.0) (+ y0 1000.0) 27.5)
      (entmake (list '(0 . "LWPOLYLINE") '(100 . "AcDbEntity")
        (cons 8 "DOOR_IRONMONGERY") '(100 . "AcDbPolyline") '(90 . 4) '(70 . 1)
        (cons 10 (list (+ meetR 60.0)       (- (+ y0 1000.0) 5.0)))
        (cons 10 (list (+ meetR 60.0 120.0) (- (+ y0 1000.0) 7.0)))
        (cons 10 (list (+ meetR 60.0 120.0) (+ (+ y0 1000.0) 7.0)))
        (cons 10 (list (+ meetR 60.0)       (+ (+ y0 1000.0) 5.0)))))
      (command "._FILLET" "_R" "4" "")
      (command "._FILLET" "_P" (entlast) "")))

  ;; === DIMENSIONS ===
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
    "_non" (list meetL (+ y0 doorH))
    "_non" (list (+ x0 (/ leafL 2.0)) (+ fT 150.0)))
  (command "_.DIMLINEAR"
    "_non" (list meetR (+ y0 doorH))
    "_non" (list (+ x0 totalW) (+ y0 doorH))
    "_non" (list (+ meetR (/ leafR 2.0)) (+ fT 250.0)))
  (command "_.DIMLINEAR"
    "_non" (list fL fT)
    "_non" (list fR fT)
    "_non" (list (+ x0 (/ totalW 2.0)) (+ fT 350.0)))
  (setvar "CLAYER" oldLay)
  (setvar "OSMODE" oldOs)

  ;; Labels
  (drawTextCCd "DOOR_OUTSIDE"
    (+ x0 (/ totalW 2.0)) (- y0 60.0) 30.0 "DD - Outside" 1)
  (drawTextCCd "UNIT_NUMBER"
    (+ x0 (/ totalW 2.0)) (- y0 110.0) 25.0 unitNum 7))


;;;========================================
;;; D. INSIDE VIEW
;;;========================================
(defun drawDoubleDoorInside (x0 y0 leafL leafR doorH handleLeaf unitNum /
  gap gapMid fwOut fwIn totalW meetL meetR
  fL fR fT fLi fRi fTi)

  (setq gap 3.0 gapMid 3.0 fwOut 35.0 fwIn 50.0)
  (setq totalW (+ leafL leafR gapMid))
  (setq meetL (+ x0 leafL))
  (setq meetR (+ x0 leafL gapMid))

  (setq fL  (- x0 gap fwOut))
  (setq fR  (+ x0 totalW gap fwOut))
  (setq fT  (+ y0 doorH gap fwOut))
  (setq fLi (+ fL fwIn))
  (setq fRi (- fR fwIn))
  (setq fTi (- fT fwIn))

  ;; LEFT LEAF dashed
  (drawDashedLineD "DOOR_INSIDE" x0 y0 meetL y0)
  (drawDashedLineD "DOOR_INSIDE" meetL y0 meetL (+ y0 doorH))
  (drawDashedLineD "DOOR_INSIDE" meetL (+ y0 doorH) x0 (+ y0 doorH))
  (drawDashedLineD "DOOR_INSIDE" x0 (+ y0 doorH) x0 y0)

  ;; RIGHT LEAF dashed
  (drawDashedLineD "DOOR_INSIDE" meetR y0 (+ x0 totalW) y0)
  (drawDashedLineD "DOOR_INSIDE" (+ x0 totalW) y0 (+ x0 totalW) (+ y0 doorH))
  (drawDashedLineD "DOOR_INSIDE" (+ x0 totalW) (+ y0 doorH) meetR (+ y0 doorH))
  (drawDashedLineD "DOOR_INSIDE" meetR (+ y0 doorH) meetR y0)

  ;; FRAME
  (drawLine "FRAME" fL (- y0 5.0) fL fT)
  (drawLine "FRAME" fLi (- y0 5.0) fLi fTi)
  (drawLine "FRAME" fL (- y0 5.0) fLi (- y0 5.0))
  (drawLine "FRAME" fR (- y0 5.0) fR fT)
  (drawLine "FRAME" fRi (- y0 5.0) fRi fTi)
  (drawLine "FRAME" fR (- y0 5.0) fRi (- y0 5.0))
  (drawLine "FRAME" fL fT fR fT)
  (drawLine "FRAME" fLi fTi fRi fTi)
  (drawLine "FRAME" fL fT fLi fTi)
  (drawLine "FRAME" fR fT fRi fTi)

  ;; HANDLE inside = mirror of outside
  ;; handleLeaf="L" outside -> inside: rose on right leaf at meetR+60, lever RIGHT
  ;; handleLeaf="R" outside -> inside: rose on left leaf at meetL-60, lever LEFT
  (if (= handleLeaf "L")
    (progn
      (drawCircle "DOOR_IRONMONGERY" (+ meetR 60.0) (+ y0 1000.0) 27.5)
      (entmake (list '(0 . "LWPOLYLINE") '(100 . "AcDbEntity")
        (cons 8 "DOOR_IRONMONGERY") '(100 . "AcDbPolyline") '(90 . 4) '(70 . 1)
        (cons 10 (list (+ meetR 60.0)       (- (+ y0 1000.0) 5.0)))
        (cons 10 (list (+ meetR 60.0 120.0) (- (+ y0 1000.0) 7.0)))
        (cons 10 (list (+ meetR 60.0 120.0) (+ (+ y0 1000.0) 7.0)))
        (cons 10 (list (+ meetR 60.0)       (+ (+ y0 1000.0) 5.0)))))
      (command "._FILLET" "_R" "4" "")
      (command "._FILLET" "_P" (entlast) ""))
    (progn
      (drawCircle "DOOR_IRONMONGERY" (- meetL 60.0) (+ y0 1000.0) 27.5)
      (entmake (list '(0 . "LWPOLYLINE") '(100 . "AcDbEntity")
        (cons 8 "DOOR_IRONMONGERY") '(100 . "AcDbPolyline") '(90 . 4) '(70 . 1)
        (cons 10 (list (- meetL 60.0)       (- (+ y0 1000.0) 5.0)))
        (cons 10 (list (- meetL 60.0 120.0) (- (+ y0 1000.0) 7.0)))
        (cons 10 (list (- meetL 60.0 120.0) (+ (+ y0 1000.0) 7.0)))
        (cons 10 (list (- meetL 60.0)       (+ (+ y0 1000.0) 5.0)))))
      (command "._FILLET" "_R" "4" "")
      (command "._FILLET" "_P" (entlast) "")))

  ;; Labels
  (drawTextCCd "DOOR_INSIDE"
    (+ x0 (/ totalW 2.0)) (- y0 60.0) 30.0 "DD - Inside" 94)
  (drawTextCCd "UNIT_NUMBER"
    (+ x0 (/ totalW 2.0)) (- y0 110.0) 25.0 unitNum 7))


;;;========================================
;;; E. PLAN VIEW
;;; Closed + Open (both leaves 30deg outward)
;;; Left pivot = left jamb inner right edge
;;; Right pivot = right jamb inner left edge
;;;========================================
(defun drawDoubleDoorPlan (x0 y0 leafL leafR frameW handleLeaf /
  fw fd lt gp gapMid ofs ntch totalW
  lx rx meetL meetR
  r1 r2 r3 r4
  ar_L ar_R ca_L sa_L ca_R sa_R
  ox olx orx
  hxL hxR hy
  hX_handle sgn_handle
  oldOs oldLay)

  (setq fw 45.0)
  (setq fd frameW)
  (setq lt 44.0)
  (setq gp 3.0)
  (setq gapMid 3.0)
  (setq ofs 12.0)
  (setq ntch 15.0)
  (setq totalW (+ leafL leafR gapMid))

  ;; CLOSED
  (setq lx    (+ x0 ofs))
  (setq rx    (- (+ x0 fw totalW) ofs))
  (setq meetL (+ x0 fw leafL))
  (setq meetR (+ x0 fw leafL gapMid))

  ;; Left jamb
  (drawLine "FRAME" lx y0 lx (+ y0 fd))
  (drawLine "FRAME" lx (+ y0 fd) (+ lx fw) (+ y0 fd))
  (drawLine "FRAME" (+ lx fw) (+ y0 fd) (+ lx fw) (+ y0 47.0))
  (drawLine "FRAME" (+ lx fw) (+ y0 47.0) (- (+ lx fw) ntch) (+ y0 47.0))
  (drawLine "FRAME" (- (+ lx fw) ntch) (+ y0 47.0) (- (+ lx fw) ntch) y0)
  (drawLine "FRAME" (- (+ lx fw) ntch) y0 lx y0)

  ;; Right jamb
  (drawLine "FRAME" (+ rx fw) y0 (+ rx fw) (+ y0 fd))
  (drawLine "FRAME" (+ rx fw) (+ y0 fd) rx (+ y0 fd))
  (drawLine "FRAME" rx (+ y0 fd) rx (+ y0 47.0))
  (drawLine "FRAME" rx (+ y0 47.0) (+ rx ntch) (+ y0 47.0))
  (drawLine "FRAME" (+ rx ntch) (+ y0 47.0) (+ rx ntch) y0)
  (drawLine "FRAME" (+ rx ntch) y0 (+ rx fw) y0)

  ;; Leaves closed (with 3mm gap + 12mm rebay on active leaf)
  (if (= handleLeaf "L")
    (progn
      ;; Left leaf ACTIVE: rebay +12mm to right at top half
      (drawRect "DOOR_INSIDE" (+ x0 fw) y0 meetL (+ y0 (/ lt 2.0)))
      (drawRect "DOOR_INSIDE" (+ x0 fw) (+ y0 (/ lt 2.0)) (+ meetL 12.0) (+ y0 lt))
      ;; Right leaf PASSIVE: notched
      (drawRect "DOOR_INSIDE" meetR y0 (+ x0 fw totalW) (+ y0 lt))
      (drawLine "DOOR_INSIDE" (+ meetL 12.0) y0 (+ meetL 12.0) (+ y0 (/ lt 2.0)))
      (drawLine "DOOR_INSIDE" (+ meetL 12.0) (+ y0 (/ lt 2.0)) meetR (+ y0 (/ lt 2.0))))
    (progn
      ;; Right leaf ACTIVE: rebay -12mm to left at top half
      (drawRect "DOOR_INSIDE" (+ x0 fw) y0 (- meetR 12.0) (+ y0 lt))
      (drawRect "DOOR_INSIDE" (- meetR 12.0) y0 (+ x0 fw totalW) (+ y0 (/ lt 2.0)))
      (drawRect "DOOR_INSIDE" (- meetR 12.0) (+ y0 (/ lt 2.0)) (+ x0 fw totalW) (+ y0 lt))
      (drawLine "DOOR_INSIDE" meetL y0 meetL (+ y0 (/ lt 2.0)))
      (drawLine "DOOR_INSIDE" meetL (+ y0 (/ lt 2.0)) (- meetR 12.0) (+ y0 (/ lt 2.0)))))

  ;; Hinges closed
  (drawHingePlanD "DOOR_IRONMONGERY" (+ lx fw) (+ y0 (/ lt 2.0)) "R" 0)
  (drawHingePlanD "DOOR_IRONMONGERY" rx         (+ y0 (/ lt 2.0)) "L" 0)

  ;; Handle closed - proper KIT_DOOR_SINGLE code
  (setq hX_handle  (if (= handleLeaf "L") (- meetL 60.0) (+ meetR 60.0)))
  (setq sgn_handle (if (= handleLeaf "L") -1.0 1.0))
  (drawHandlePlanD "DOOR_IRONMONGERY" hX_handle y0 lt sgn_handle)

  ;; Label + dims closed
  (drawTextCCd "UNIT_NUMBER"
    (+ x0 fw (/ totalW 2.0)) (- y0 60.0) 25.0 "Closed" 7)
  (setvar "OSMODE" 0)
  (setvar "CLAYER" "DIMENSIONS")
  (command "_.DIMLINEAR"
    "_non" (list (+ x0 fw) y0)
    "_non" (list (+ x0 fw totalW) y0)
    "_non" (list (+ x0 fw (/ totalW 2.0)) (- y0 80.0)))
  (command "_.DIMLINEAR"
    "_non" (list lx y0)
    "_non" (list lx (+ y0 fd))
    "_non" (list (- lx 80.0) (/ (+ y0 (+ y0 fd)) 2.0)))
  (setvar "CLAYER" "FRAME")

  ;; OPEN (200mm gap from closed)
  (setq ox  (+ x0 fw totalW fw 200.0))
  (setq olx (+ ox ofs))
  (setq orx (- (+ ox fw totalW) ofs))

  ;; Left jamb open
  (drawLine "FRAME" olx y0 olx (+ y0 fd))
  (drawLine "FRAME" olx (+ y0 fd) (+ olx fw) (+ y0 fd))
  (drawLine "FRAME" (+ olx fw) (+ y0 fd) (+ olx fw) (+ y0 47.0))
  (drawLine "FRAME" (+ olx fw) (+ y0 47.0) (- (+ olx fw) ntch) (+ y0 47.0))
  (drawLine "FRAME" (- (+ olx fw) ntch) (+ y0 47.0) (- (+ olx fw) ntch) y0)
  (drawLine "FRAME" (- (+ olx fw) ntch) y0 olx y0)

  ;; Right jamb open
  (drawLine "FRAME" (+ orx fw) y0 (+ orx fw) (+ y0 fd))
  (drawLine "FRAME" (+ orx fw) (+ y0 fd) orx (+ y0 fd))
  (drawLine "FRAME" orx (+ y0 fd) orx (+ y0 47.0))
  (drawLine "FRAME" orx (+ y0 47.0) (+ orx ntch) (+ y0 47.0))
  (drawLine "FRAME" (+ orx ntch) (+ y0 47.0) (+ orx ntch) y0)
  (drawLine "FRAME" (+ orx ntch) y0 (+ orx fw) y0)

  ;; Pivots
  (setq hxL (+ olx fw))
  (setq hxR orx)
  (setq hy y0)

  ;; Rotation
  (setq ar_L (* (/ pi 180.0) (- 30.0)))
  (setq ar_R (* (/ pi 180.0)   30.0))
  (setq ca_L (cos ar_L)) (setq sa_L (sin ar_L))
  (setq ca_R (cos ar_R)) (setq sa_R (sin ar_R))

  ;; Left leaf rotated CW -30 around (hxL,hy)
  (defun rotL (px py / dx dy)
    (setq dx (- px hxL) dy (- py hy))
    (list (+ hxL (- (* dx ca_L) (* dy sa_L)))
          (+ hy  (+ (* dx sa_L) (* dy ca_L)))))
  (setq r1 (rotL hxL hy))
  (setq r2 (rotL hxL (+ hy lt)))
  (setq r3 (rotL (+ hxL leafL) (+ hy lt)))
  (setq r4 (rotL (+ hxL leafL) hy))
  (entmake (list '(0 . "LWPOLYLINE") '(100 . "AcDbEntity")
    (cons 8 "DOOR_OUTSIDE") '(100 . "AcDbPolyline") '(90 . 4) '(70 . 1)
    (cons 10 r1) (cons 10 r2) (cons 10 r3) (cons 10 r4)))

  ;; Right leaf rotated CCW +30 around (hxR,hy)
  (defun rotR (px py / dx dy)
    (setq dx (- px hxR) dy (- py hy))
    (list (+ hxR (- (* dx ca_R) (* dy sa_R)))
          (+ hy  (+ (* dx sa_R) (* dy ca_R)))))
  (setq r1 (rotR hxR hy))
  (setq r2 (rotR hxR (+ hy lt)))
  (setq r3 (rotR (- hxR leafR) (+ hy lt)))
  (setq r4 (rotR (- hxR leafR) hy))
  (entmake (list '(0 . "LWPOLYLINE") '(100 . "AcDbEntity")
    (cons 8 "DOOR_OUTSIDE") '(100 . "AcDbPolyline") '(90 . 4) '(70 . 1)
    (cons 10 r1) (cons 10 r2) (cons 10 r3) (cons 10 r4)))

  ;; Hinges open
  (drawHingePlanD "DOOR_IRONMONGERY" hxL (+ hy (/ lt 2.0)) "R" 30)
  (drawHingePlanD "DOOR_IRONMONGERY" hxR (+ hy (/ lt 2.0)) "L" 30)

  ;; Swing arcs
  (entmake (list '(0 . "ARC") '(100 . "AcDbEntity") (cons 8 "DIMENSIONS") (cons 62 8)
    '(100 . "AcDbCircle") (cons 10 (list hxL hy 0.0)) (cons 40 leafL)
    '(100 . "AcDbArc")
    (cons 50 (* (/ pi 180.0) 180.0))
    (cons 51 (* (/ pi 180.0) 210.0))))
  (entmake (list '(0 . "ARC") '(100 . "AcDbEntity") (cons 8 "DIMENSIONS") (cons 62 8)
    '(100 . "AcDbCircle") (cons 10 (list hxR hy 0.0)) (cons 40 leafR)
    '(100 . "AcDbArc")
    (cons 50 (* (/ pi 180.0) 330.0))
    (cons 51 (* (/ pi 180.0) 360.0))))

  ;; Label open
  (drawTextCCd "UNIT_NUMBER"
    (+ ox fw (/ totalW 2.0)) (- y0 60.0) 25.0 "Open 30" 7))


;;;========================================
;;; F. MAIN COMMAND
;;; Asks for overall frame size (incl frame members)
;;;========================================
(defun c:DOOR_DOUBLE ( / equalLeaves frameWTotal frameHTotal
                         leafL leafR doorH gapMid
                         handleInside handleLeaf frameW unitNum
                         pt x0 y0 viewGap vx px totalW
                         _oldCmdecho _oldOsmode _oldClayer _olderr)

  (setq _oldCmdecho (getvar "CMDECHO"))
  (setq _oldOsmode  (getvar "OSMODE"))
  (setq _oldClayer  (getvar "CLAYER"))
  (setq _olderr *error*)
  (setq gapMid 3.0)

  (defun *error* (msg)
    (if _oldClayer  (setvar "CLAYER"  _oldClayer))
    (if _oldOsmode  (setvar "OSMODE"  _oldOsmode))
    (if _oldCmdecho (setvar "CMDECHO" _oldCmdecho))
    (setq *error* _olderr)
    (if (and msg (not (wcmatch (strcase msg) "*CANCEL*,*QUIT*,*EXIT*")))
      (princ (strcat "\nERROR: " msg)))
    (princ))

  (setvar "CMDECHO" 0)

  ;; 1. Equal leaves?
  (setq equalLeaves (getstring "\nEqual leaves? [Y/N] <Y>: "))
  (if (= equalLeaves "") (setq equalLeaves "Y"))
  (setq equalLeaves (strcase equalLeaves))

  (if (= equalLeaves "Y")
    (progn
      ;; Ask overall FRAME width (outer to outer incl frame members)
      ;; frameWTotal = leafL + leafR + gapMid + 2*(gap+fw) = totalLeaf + 3 + 76 = totalLeaf + 79
      (setq frameWTotal (getreal "\nOverall FRAME WIDTH incl frame members [mm] <1603>: "))
      (if (or (null frameWTotal) (<= frameWTotal 0.0)) (setq frameWTotal 1603.0))
      (setq leafL (/ (- frameWTotal 79.0) 2.0))
      (setq leafR leafL))
    (progn
      (setq frameWTotal (getreal "\nOverall FRAME WIDTH incl frame members [mm] <1603>: "))
      (if (or (null frameWTotal) (<= frameWTotal 0.0)) (setq frameWTotal 1603.0))
      (setq leafL (getreal "\nLeft leaf clear width [mm] <724>: "))
      (if (or (null leafL) (<= leafL 0.0)) (setq leafL 724.0))
      (setq leafR (- frameWTotal 79.0 leafL))
      (if (<= leafR 0.0)
        (progn
          (princ "\nError: left leaf too wide.")
          (setvar "CMDECHO" _oldCmdecho) (exit)))))

  ;; 2. Overall FRAME height
  ;; frameHTotal = doorH + gap(3) + fw(35) + 5 = doorH + 43
  (setq frameHTotal (getreal "\nOverall FRAME HEIGHT incl frame members [mm] <2083>: "))
  (if (or (null frameHTotal) (<= frameHTotal 0.0)) (setq frameHTotal 2083.0))
  (setq doorH (- frameHTotal 43.0))
  (if (<= doorH 0.0)
    (progn
      (princ "\nError: frame height too small.")
      (setvar "CMDECHO" _oldCmdecho) (exit)))

  ;; 3. Handle leaf from INSIDE [L/R]
  (setq handleInside (getstring "\nHandle leaf - viewed from INSIDE [L/R] <R>: "))
  (if (= handleInside "") (setq handleInside "R"))
  (setq handleInside (strcase handleInside))
  (if (not (or (= handleInside "L") (= handleInside "R"))) (setq handleInside "R"))
  ;; Mirror: inside L = outside R
  (setq handleLeaf (if (= handleInside "L") "R" "L"))

  ;; 4. Frame depth
  (setq frameW (getreal "\nFrame depth [mm] <100>: "))
  (if (or (null frameW) (<= frameW 0.0)) (setq frameW 100.0))

  ;; 5. Door number
  (setq unitNum (getstring T "\nDoor number <DD01>: "))
  (if (= unitNum "") (setq unitNum "DD01"))

  ;; 6. Insertion point
  (setq pt (getpoint "\nInsertion point (bottom-left of left door leaf): "))
  (if (null pt)
    (progn (princ "\nNo point selected.") (setvar "CMDECHO" _oldCmdecho) (exit)))
  (setq x0 (car pt) y0 (cadr pt))

  ;; Info line
  (setq totalW (+ leafL leafR gapMid))
  (princ (strcat "\n  Leaf L: " (rtos leafL 2 1)
                 "  Leaf R: " (rtos leafR 2 1)
                 "  Door H: " (rtos doorH 2 1)))

  ;; === LAYERS ===
  (createDoubleDoorLayers)

  ;; === OUTSIDE VIEW ===
  (drawDoubleDoorOutside x0 y0 leafL leafR doorH handleLeaf unitNum)

  ;; === INSIDE VIEW (300mm gap) ===
  (setq viewGap 300.0)
  (setq vx (+ x0 totalW 3.0 35.0 viewGap 35.0 3.0))
  (drawDoubleDoorInside vx y0 leafL leafR doorH handleLeaf unitNum)

  ;; === PLAN VIEW (300mm gap) ===
  (setq px (+ vx totalW 3.0 35.0 viewGap))
  (drawDoubleDoorPlan px y0 leafL leafR frameW handleLeaf)

  ;; === RESTORE ===
  (if _oldClayer  (setvar "CLAYER"  _oldClayer))
  (if _oldOsmode  (setvar "OSMODE"  _oldOsmode))
  (if _oldCmdecho (setvar "CMDECHO" _oldCmdecho))
  (setq *error* _olderr)

  (princ (strcat "\nDOOR_DOUBLE done! Frame: "
    (rtos frameWTotal 2 0) "x" (rtos frameHTotal 2 0)
    "  Handle: " handleInside " from inside"))
  (princ))

(princ "\nKIT_DOOR_DOUBLE loaded. Type DOOR_DOUBLE to run.")
(princ)