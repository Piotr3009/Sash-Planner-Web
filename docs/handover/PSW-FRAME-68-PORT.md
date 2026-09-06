# PSW port — casement / door frame face 57 → 68 (ARCHED-WINDOWS-v4 Block F, option B)

Piotr 06.09: head and jambs of the casement AND door frames go from 57 to **68** wide. Option B:
the rebate stays **21**, the visible land grows 36 → **47**, the fitting gap stays 4, so the leaf
deduction per jamb goes 40 → **51** (a 1000 frame gives an 898 leaf, a 1500 frame a 1402 leaf:
`leafH = H − (land + gap) − (gapCill + cillVisible) = 1500 − 51 − 47`). The **cill is unchanged**
(68 with its fall, 41 visible outside, gap 6). Mullion and transom stay 68. Door: same face 68,
coupling post between a side panel and the door = 2 × 68 = **136** (was 114), transom rail 68
unchanged, door land stays 36 (doors change face and post only — PC BLOCKERS §19 asks whether the
door land should follow).

PC (this repo) carries the change from `main` after the Stage 4 merge: `DEFAULT_CASEMENT_PROFILE`
(`src/engine/profile.js`), `DEFAULT_DOOR_PROFILE`, `CASEMENT_GEO_DEFAULTS.frameFace = 68` with
`CASEMENT_LAYOUTS_VERSION = 3` (`src/engine/casementLayouts.js`), and the 3D reads the face / land
from the profile through a `frameDims` prop. Pricing in PSW is by outer size — **unaffected**.

**Until PSW is ported, PSW imports still describe a 57 frame.** PC re-derives every imported window
from its own profile (leaf 898, not 920), so the PSW estimate drawing and the PC production numbers
disagree by 11 mm per jamb on every casement / door until the lines below are changed.

## 1. `js/estimate-renderer.js` — the estimate drawings

| line | now | change to |
|---|---|---|
| 1503 | `const FRAME_FACE = 57, BOTTOM_FACE = 68, MULLION_W = 68;` | `const FRAME_FACE = 68, BOTTOM_FACE = 68, MULLION_W = 68;` |
| 2017 | `const FRAME_FACE = 57, BOTTOM_FACE = 68, MULLION_W = 68, LEAF_FACE = 50;` | `const FRAME_FACE = 68, …` (LEAF_FACE untouched) |

Search the file for any other `57` used as the head / jamb width (the two constants above are the
ones found on 06.09; the layout definitions at ~1884 read `FRAME_FACE`, do not touch their panel
order — PC mirrors it).

## 2. `js/casement-controller.js` — layout defs and the transom-axis convention

| line | now | change to |
|---|---|---|
| 54 | `window.CASEMENT_LAYOUTS_VERSION = 2` | `window.CASEMENT_LAYOUTS_VERSION = 3` (PC is at 3 — same session, same bump) |
| 153 | `var innerH = def.h - 57 - 68;` | `var innerH = def.h - 68 - 68;` |
| 154 | comment: transom axis offset `91 = 57 head + 34 half transom` | `102 = 68 head + 34 half transom` — and every place that adds / subtracts **91** for the top-anchored fanlight axis becomes **102** (PC: `FAN_AXIS_OFFSET_TOP = frameFace + 34`) |
| 415 | comment: fanlight zone = axis − 91 | axis − 102 |
| 417 | `var innerH = h - 57 - 68;` | `var innerH = h - 68 - 68;` |

The bottom-anchored fan2 offset (68 cill + 34 = 102) is unchanged.

## 3. `js/casement-type-modal.js` — layout thumbnails

| line | now | change to |
|---|---|---|
| 378 | `var x = m + (mx - 57) * scale; // def mullion x includes FRAME_FACE(57)` | `(mx - 68)` |

## 4. 3D (`3d-src/src/components`) — copy the PC files or change the constants

PC's copies of these files now take a `frameDims` prop `{ frameFace, extFace }` (extFace = the
visible land = face − rebate) and keep the PSW numbers as defaults, so the PC files are a drop-in:
copying `CasementFrame.jsx`, `CasementWindow.jsx`, `ArchedCasementWindow.jsx`, `DoorFrame.jsx`,
`DoorWindow.jsx`, `DoorSidePanel.jsx` into PSW changes nothing until PSW passes `frameDims`. To
show the 68 frame in PSW, either pass `frameDims={{ frameFace: 68, extFace: 47 }}` (casement) /
`{{ frameFace: 68, extFace: 36 }}` (door) from the PSW App, or change the constants:

| file | line | now | change to |
|---|---|---|---|
| `casement/CasementFrame.jsx` | 12–13 | `const FRAME_FACE = 57; const EXT_FACE = 36;` | `68` / `47` |
| `door/DoorFrame.jsx` | 12–13 | `const FRAME_FACE = 57; const EXT_FACE = 36;` | `68` / `36` (door land unchanged — see the open question) |
| `door/DoorWindow.jsx` | 504 | `const SLIDING_FRAME_FACE = 50;` | unchanged (sliding / bifold have their own frame) |
| `door/DoorWindow.jsx` | 676, 710 | `const FIX_FRAME_FACE = 64;` | unchanged (fixed side lights use the FixFrame section) |
| `casement/ArchedCasementWindow.jsx` (PSW version) | 70 | comment `FRAME_FACE=57` + the FixFrame-shaped arch | PSW's arched casement still draws the PSW ratios; the PC file draws the arch from `arch.js` (see PSW-3D-ARCH-PORT.md) and takes `frameDims` |
| `fix-frame/FixFrameWindow.jsx` | 13 | `const FRAME_FACE = 64;` | unchanged (fixed windows in PSW have their own 64 frame; PC builds fixed windows as a casement frame + fixed leaf) |

Everything that derives from `FRAME_FACE` in the 3D follows automatically: `innerW = width −
2·FRAME_FACE`, the leaf `= panel + 2·21 − 2·4`, the coupling post between a side panel and the door
(two abutting jambs = 136), the mullion positions in `getLayout`.

## 5. Not in PSW's scope

- The casement / door **engine** numbers (cut list, glass, hardware) live only in PC.
- The PC `frameSchema: 2` migration (a stored 57 profile moves to 68 once) is a PC store concern.
- Pricing: by outer size, no change.

## 6. Check after the port

A 1000 × 1500 040L casement in the PSW estimate drawing must show a leaf 898 wide × 1402 high
(was 920 × 1413); a 1200 fanlight with the axis typed at 500 from the top must put the fan zone at
500 − 102 = 398 (was 409).
