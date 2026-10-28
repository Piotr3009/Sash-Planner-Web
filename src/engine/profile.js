// ─── Window construction profile ───
// Workshop-editable dimensions that drive the engine: finished sections,
// box depths, length deductions, raw-stock mapping and timber weights.
// Different workshops = different NUMBERS, never different formulas.
//
// The defaults below are the OTD profile (Prime Sash Windows' current values).
// The active profile is pushed in by windowProfileStore (persisted per user);
// the engine always reads through getWindowProfile() so plain-function code
// needs no React/store imports.

// Canonical UI order for frame variants. Supabase stores the profile as
// JSONB, which re-sorts object keys (by length, then bytewise) — so tab
// order must NEVER come from Object.keys of the stored object.
export const VARIANT_ORDER = ['standard', 'slim', 'triple', 'heritage'];

export const DEFAULT_SASH_PROFILE = {
  // Frame variants: box depth + finished sash depth (planed from the same raw stock)
  variants: {
    standard: { label: 'Standard', boxDepth: 164, sashDepth: 57, boardWidth: 141 },
    slim:     { label: 'Slim',     boxDepth: 144, sashDepth: 47, boardWidth: 121 },
    heritage: { label: 'Heritage', boxDepth: 134, sashDepth: 42, boardWidth: 111 },
    triple:   { label: 'Triple glazing', boxDepth: 172, sashDepth: 61, boardWidth: 149 },
  },
  // Legacy only: pre-boardWidth profiles derived board = boxDepth − boardInset.
  // boardWidth on each variant is now the source of truth (workshop-editable).
  boardInset: 23,
  // Window sill construction: true = cill + separate nose, false = one piece
  cillTwoPiece: true,
  // Per-element finished dimensions; sash depth comes from the variant.
  elements: {
    stiles:       { face: 57, raw: '63x63' },
    topRail:      { face: 57, raw: '63x63' },
    meetingRail:  { face: 43, raw: '63x63' },
    bottomRail:   { face: 90, raw: '63x95' },
    head:         { thickness: 28 },
    jambs:        { thickness: 28 },
    extHeadLiner: { w: 17, h: 102, deduction: 204 },
    intHeadLiner: { w: 17, h: 86,  deduction: 172 },
    extJambLiner: { w: 17, h: 102, deduction: 0 },
    intJambLiner: { w: 17, h: 86,  deduction: 0 },
    cill:         { w: 69, h: 46 },   // legacy field names: w = vertical HEIGHT (69), h = WIDTH/depth (46); UI + drawings map accordingly — do not swap the data (stored profiles, "69×46" section convention)
    cillNose:     { w: 64, h: 128 },
    // Triple sash mullion post 50 (confirmed by Piotr 13.10.2026: "50 stays, everything is designed around it").
    // extFace: the external mullion board seen from outside, 50 + 20 + 20 = 90, 17 thick like the box liners,
    // with the drainage curves at its foot (3D MullionPost extBoard; Piotr 13.10.2026).
    mullion:      { face: 50, extFace: 90, raw: '63x63' },
  },
  // Length rules (mm subtracted from the window dimension). "Advanced" —
  // geometrically coupled values; changing them reshapes the whole window.
  // Glass makeup labels printed on glass orders (free text; no effect on sizes).
  // Keyed by glass type; the frame variant chooses the type per window.
  glassMakeup: { double: '4x16x4', double_slim: '4x8x4', triple: '4x8x4x8x4', single: '', passive: '', acoustic: '4x14x6.8' },   // acoustic = SPEC makeup (01.10.2026)
  hornExtension: 70,  // sash horn height; per-window spec override wins, this is the workshop default
  dedSchema: 2,       // v2: sashHeight is the PURE opening deduction (MR excluded)
  deductions: {
    sashWidth: 178,   // sash W = frame W − this
    sashHeight: 135,  // OPENING deduction: total sash H = frame H − this + meeting rail face
    // Derivation (Adam's Excel, verified 1:1): upper sash = H/2 − 62.5, lower = H/2 − 29.5
    //   62.5 + 29.5 = 92   → legacy v1 total-CUT deduction (MR=43 baked in)
    //   62.5 − 29.5 = 33   → sash height difference = bottomRail.face − topRail.face
    //   92 + 43     = 135  → v2 pure OPENING deduction; engine adds live MR
    // This number does NOT react to MR/rail edits by design — those enter the formulas directly.
    jambHeight: 108,  // jamb L = frame H − this
    headWidth: 0,     // head L = frame W − this
  },
  // ── Arched sash (ARCHED-WINDOWS-v3 Block 1, night 5) ─────────────────────
  // The box head is an arched RING headFace deep (PSW ArchedSashWindow.jsx
  // HEAD_FACE 80 — DEFAULT (open), BLOCKERS); the upper sash's arched top rail
  // sits deductions.sashWidth / 2 inside the frame contour (rule C: the ring
  // meets the stile line) with the face of elements.topRail. Limits from PSW
  // price-calculator.js (MIN_WIDTH / MAX_WIDTH / MIN_STRAIGHT / MIN_UPPER_STILE).
  // The blank planner numbers (stock, finger, allowance) are the CNC's and live
  // once, in the casement profile `arch` block.
  sashArch: {
    headFace: 80,
    minHaunchRadius: 150,
    limits: { minWidth: 400, maxWidth: 1500, minStraightBelowRise: 900, minUpperStile: 100 },
  },
};

// Timber density calibrated from the legacy kg/m constants
// (2.0 @ 57×57 → 616, 3.1 @ 57×90 → 604, 1.5 @ 57×43 → 612 kg/m³)
export const TIMBER_DENSITY_KG_M3 = 610;

/** kg per running metre for a finished section (mm × mm). */
export function kgPerM(faceMm, depthMm) {
  return (Number(faceMm) * Number(depthMm) * TIMBER_DENSITY_KG_M3) / 1e6;
}

// ─── Casement profile v1 — Piotr 30.07.2026 (casement-dimensioning-v1.md) ───
// FINISHED dimensions only. Raw material is never stored here — it comes from
// Part Registry assignments (resolveRaw). Every value is a per-workshop
// editable default ("settings by client"); formulas in calculations.js read
// exclusively from this object — no bare numbers there.
export const DEFAULT_CASEMENT_PROFILE = {
  // Frame-section schema (ARCHED-WINDOWS-v4 Block F, option B): 2 = head and
  // jambs 68 wide (land 47, rebate 21). Stored copies with schema 1 (57 / 36 /
  // 40) are migrated key by key in migrateCasementProfile — only values that
  // still equal the OLD default move, a workshop edit is kept.
  frameSchema: 2,
  // Glass schema (Piotr 02.10.2026): 2 = every sealed unit 1mm smaller all round
  // (glassInset 11.5; deductions.glass 111 then, 105 since leaf schema 2) with the perimeter spacer left where
  // it was (glass.edgeCover 10). Stored copies with schema 1 are migrated key
  // by key in migrateCasementProfile — only values that still equal the OLD
  // default (12.5 / 109 / 11) move, a workshop edit is kept.
  glassSchema: 2,
  // Leaf schema (Piotr 07.10.2026): 3 = stiles and top rail 64, bottom rail 67
  // (schema 2, 06.10.2026: all four members 64; schema 1: all four 67). A stored
  // copy below 3 is migrated face by face in migrateCasementProfile, by the
  // schema it is on: a face moves only while it still equals that schema's
  // default, a hand-edited face is kept. The glass deductions follow the faces:
  // width from the stiles, height from the top and bottom rails
  // (casementGlassDeductions).
  leafSchema: 3,
  // Length schema (Piotr 06.10.2026): 2 = transom seat 8.5 (was 8; the joint
  // needs 8.6, 8.5 is enough). A stored copy below 2 moves lengths.transomSeat
  // only while it still equals 8; a hand-edited seat is kept.
  lengthSchema: 2,
  frameDepth: 93,   // finished depth of frame / mullion / transom members
  leafDepth: 57,
  leafDepthTriple: 61,  // 28mm triple unit needs a deeper rebate    // finished depth of all leaf members
  elements: {
    frameHead:  { face: 68 },   // v4 Block F: 57 → 68 (option B, rebate 21, land 47)
    frameJamb:  { face: 68 },
    frameCill:  { face: 68 },   // profiled section; envelope 68×93 — UNCHANGED by Block F
    mullion:    { face: 68 },   // visible land 26 (13 per side)
    transom:    { face: 68 },
    leafStile:  { face: 64 },   // vertogen: every leaf member cut to the FULL leaf
    leafTop:    { face: 64 },   // dimension; stiles and top rail share one width,
    leafBottom: { face: 67 },   // the bottom rail its own (leaf schema 3, Piotr 07.10.2026: 67)
  },
  geometry: {
    land: 47,             // frame land — visible frame margin (68 − 21; v4 Block F)
    rebate: 21,           // frame rebate depth (68 − 47), unchanged by Block F
    gap: 4,               // leaf side fitting gap (jambs, mullions, head)
    mullionLand: 26,      // mullion visible land (13 + 13, symmetric)
    // Transom land is ASYMMETRIC around the element axis (v1.1):
    transomLandAbove: 8,  // visible land above the axis
    transomLandBelow: 13, // visible land below the axis
    gapFanTransom: 6,     // gap between fan bottom rail and transom land
    gapBelowTransom: 4,   // gap between transom land and lower top rail
    gapCill: 6,           // gap between bottom rail and cill
    cillVisible: 41,      // cill front height seen from outside
    glassInset: 11.5,     // glass enters the leaf rebate this deep, per side (glass schema 2: 12.5 → 11.5)
    // The leaf's glazing rebate is 18 deep everywhere — casement, sash, fixed
    // (Piotr 06.09): 11.5 of it is glass, the remaining 6.5 takes the clips.
    // A tracery board reaches the timber: it sits the full 18 in, not 11.5.
    glazingRebate: 18,
    // Layer closure: 47+4 + leafH + 6+41 = extH  (full = extH − 98)
    //                top 47+4 + fan + 6+8 = T    (fan  = T − 65)
    //                13+4 + lower + 6+41 = extH − T (lower = extH − T − 64)
  },
  deductions: {
    // Leaf WIDTH per edge (from frame edge / member axis):
    leafAtJamb: 51,        // land 47 + gap 4 (v4 Block F; 1000 frame → 898 leaf)
    leafAtMullionAxis: 17, // half-land 13 + gap 4
    // Leaf HEIGHT (T = frame top -> transom axis) — v1.1 layer-verified:
    leafFullHeight: 98,    // no transom: leafH = extH − 98  (51 top + 47 cill side)
    fanFromAxis: 65,       // fan (above transom): leafH = T − 65  (51 + 6 + 8)
    lowerFromAxis: 64,     // below transom: leafH = extH − T − 64  (13+4 + 6+41)
    // Middle tier (transom above AND below, 3-tier 013/023):
    // UNCONFIRMED — awaiting Piotr; provisional symmetric 2×17 like mullions.
    middleTierFromAxes: 34,
    // Glass: DERIVED from the leaf member faces (Piotr 04.08, 07.10.2026):
    //   glass W = leaf W - 2 x (leafStile - glassInset)                    = leaf W - 105
    //   glass H = leaf H - (leafTop - glassInset) - (leafBottom - glassInset) = leaf H - 108
    // This key holds the WIDTH deduction as the resolved value for display /
    // back-compat: 105 = 2 x (64 - 11.5) (111 with the 67 stile, 109 with 67 and
    // 12.5). Every reader takes both numbers from casementGlassDeductions();
    // the stored value is kept in step on migrate and on every write of a face
    // or glassInset (windowProfileStore).
    glass: 105,
  },
  lengths: {
    mullion: 77,       // C-M = extH − 77 (full height, runs through)
    transomSeat: 8.5,  // C-T segment = leaf width of its field + 8.5 (length schema 2, Piotr 06.10.2026; was 8)
    // Per-element cut deductions (Piotr 04.08) — every member runs the FULL
    // dimension by default (T&G joint), so these are 0 and today's cut lists
    // are unchanged. A workshop without T&G subtracts its own numbers here;
    // cut list AND pre-cut both read them, exactly like the sash page.
    headDeduct: 0,       // C-H  = frame W − this
    jambDeduct: 0,       // C-J  = frame H − this
    cillDeduct: 0,       // C-CILL = frame W (+ ext) − this
    stileDeduct: 0,      // C-ST = leaf H − this
    topRailDeduct: 0,    // C-TR = leaf W − this
    bottomRailDeduct: 0, // C-BR = leaf W − this
    // Partial mullion (031/032 tier divider) — UNCONFIRMED, provisional
    // transom-style rule: adjacent tier leafH + partialMullionSeat.
    partialMullionSeat: 8,
  },
  // ── Arched head (arched-casement-v1, 05.09.2026) ─────────────────────────
  // Curved members are glued from straight boards on finger joints and routed
  // afterwards (src/engine/arch.js). The arch geometry itself reads
  // frameHead.face / leafTop.face / leafAtJamb / glassInset above; this block
  // holds only what the segment planner and the CNC drawing need.
  arch: {
    // Schema version of this block. Up to v3 no UI edited it, so an older
    // stored copy is replaced whole by this default (migrateCasementProfile);
    // from v4 the Window Settings "CNC & arches" card edits it, so a stored
    // v4 block is merged key by key.
    // v3 (arched-casement-v2): minHaunchRadius + bar pattern ratios.
    // v4 (ARCHED-WINDOWS-v4 Block C): segment planner v2 — the stock list,
    // the hard minimum piece length and the economy threshold; the grain
    // run-out angle and the D13 piece rule are gone (the chain is planned as
    // a whole, fewest pieces first).
    version: 4,
    // Smallest haunch radius of a three-centre (Round below half width) arch,
    // mm (v2 P3): r = max(rise² / halfW, this). Keeps the leaf-top inner ring
    // positive (150 - leafAtJamb 51 - leafTop.face 64 = 35; was 32 with the
    // 67 face). A Round arch therefore needs a rise above this value.
    minHaunchRadius: 150,
    // Glazing bar patterns in the arch (v2 P5), geometry ported from PSW
    // 3d-src FixFrameWindow.jsx (semiBarPattern) on the glass outline: hub
    // ring radii as fractions of the clear half width (ring 1 / 2 / 3). The
    patterns: {
      hubRingRatios: [0.3, 0.6, 0.8],
      // Intersecting tracery. The ARCS follow the PSW arched-sash rule (v4 Block E): two arcs from
      // every mullion top, both with the outline's own radius — PC and PSW stay identical there.
      // The MULLION COUNT comes from the clear width by pitch, as it did before night 6: taking it
      // from the bar chips gave a 1500 gothic two mullions and left the straight part as one pane
      // (Piotr 07.09). Chips still win when set. `pitch` = target clear spacing between mullions.
      intersecting: { pitch: 220, minMullions: 2, maxMullions: 9 },
      // v3 Block 3: sunburst in a CIRCLE fixed window (PSW 3d-src FixFrameWindow
      // CircleFrame): one ring `offset` mm inside the clear circle, `spokes`
      // spokes from the ring to the glass edge. PSW's per-window offset
      // (fixCircleOffset, default 200) is imported; this is the PC default.
      sunburst: { offset: 200, spokes: 6 },
    },
    // Finger-joint profile of the Stark d50 head (D5): finger length / joint
    // depth / pitch — printed on the drawing as FINGER 15/16/3.8.
    finger: { length: 15, depth: 16, pitch: 3.8 },
    // Board widths the planner may pick from (finished piece + allowance must
    // fit). Workshop stock list (Piotr 06.09, v4 C.2: 50 removed, 120 and 150
    // added); the widest entry is the board cap — there is no separate
    // maximum. Edit here or on the CNC & arches card, never in the planner.
    stockWidths: [63, 75, 95, 105, 120, 150, 180, 200],
    // Contour allowance, mm PER SIDE (Piotr 05.09, spec D6): the blank is cut
    // this much outside the finished contour on both edges; the board must
    // contain that band.
    contourAllowance: 10,
    // v4 C.1 (Piotr 06.09), HARD: the SHORTER stock edge of every raw piece
    // (the inner edge of a convex arch) must be at least this long —
    // joinery: fewer, larger pieces. The machine limit on the overall length
    // is cnc.minClampLength. A plan that cannot satisfy both is reported
    // (plan.noStock, reason 'below minimum length'), never split finer.
    minPieceLength: 400,
    // v4 C.4 (DEFAULT open, BLOCKERS): the fewest-pieces plan is taken unless
    // its waste (Σ board area − Σ band area) / Σ board area exceeds this
    // fraction AND the next piece count passes the limits on a narrower
    // board — then the next count wins. 1.0 = always the fewest pieces.
    wasteThreshold: 0.45,
    // Validity limits (spec §3.3 / §5): PSW MIN_WIDTH / MAX_WIDTH, and the PSW
    // arched-sash rules adopted for the casement until Piotr says otherwise —
    // straight part below the arch (height >= rise + this) and the straight
    // stile of the arched leaf. Physical limits (rise vs width per shape) are
    // geometry and live in arch.js.
    limits: { minWidth: 400, maxWidth: 1500, minStraightBelowRise: 900, minLeafStraightStile: 100 },
  },
  // ── CNC (ARCHED-WINDOWS-v4 Block C, Piotr 06.09): the Rover A 1532 holds
  // the arch pieces in Uniclamps, not vacuum pods. minClampLength = the
  // shortest raw piece the machine can hold — two Uniclamps plus the end cuts
  // (measured on the piece's overall length, the longer stock edge with the
  // finger extension). clamp = the Uniclamp footprint drawn on the CLAMPS
  // layer as a suggestion (base 130 × 130, jaws for a piece thickness 40–98,
  // Biesse minimum workpiece 140); clampClearance = the distance kept from
  // the angled end cuts (DEFAULT open, BLOCKERS).
  cnc: {
    minClampLength: 450,
    clamp: { base: 130, minThickness: 40, maxThickness: 98, minPiece: 140 },
    clampClearance: 20,
  },
  // ── bSuite worklist export (.ewlist) for the Rover A 1532 — frames only
  // (12–14.09.2026). Matt's programs are built on a 68 × 93 board and take the
  // FINISHED length as LPX; a row carries program + quantity + LPX/LPY/LPZ. The
  // mullion / transom macros expose OP1..3_HX (joint positions), LH_RH_CNTRL and
  // SCRW_ON_OFF — written as document variables when macroVarsInList is on (Matt
  // must link the macro properties to document variables of the same name).
  //
  // TARGETS (Piotr 14.09): a list is made FOR A COMPUTER — the machine PC, the
  // office PC, Jack's PC — and each one keeps the programs under its own paths.
  // So the paths live per target, every element with its own full path, and the
  // table placement too (ExOrigin / offsets belong to the table, not the program).
  // Programs on the machine (photos 14.09): C:\Users\Xp600\Desktop\TEMPLATES_02.09.26
  // \UPDATED_09.09.26\*_MASTER_V2.bSolid — Matt's 09.09 update of the 01.09 FC_* set.
  bsuite: {
    activeTarget: 'machine',
    targets: [
      {
        id: 'machine',
        name: 'Machine (Rover)',
        programs: {
          head:    { path: 'C:/Users/Xp600/Desktop/TEMPLATES_02.09.26/UPDATED_09.09.26/HEAD_MASTER_V2.bSolid',    panelId: 1001, panelName: 'P1001' },
          cill:    { path: 'C:/Users/Xp600/Desktop/TEMPLATES_02.09.26/UPDATED_09.09.26/CILL_MASTER_V2.bSolid',    panelId: 1001, panelName: 'P1001' },
          jambL:   { path: 'C:/Users/Xp600/Desktop/TEMPLATES_02.09.26/UPDATED_09.09.26/LH_JAMB_MASTER_V2.bSolid', panelId: 1001, panelName: 'P1001' },
          jambR:   { path: 'C:/Users/Xp600/Desktop/TEMPLATES_02.09.26/UPDATED_09.09.26/RH_JAMB_MASTER_V2.bSolid', panelId: 1001, panelName: 'P1001' },
          // 14.09: Matt's V2 mullion / transom are PARAMETRIC MASTERS (like the Biesse sample's
          // OUTER_FRAME): no OP1_HX macro any more — the program takes the WINDOW (WINDOW_WIDTH /
          // WINDOW_HEIGHT), the joint height OPN_1_H, the hands and the trickle-vent flag as
          // document variables and computes its own board. mode 'master' → the row carries those
          // variables and NO panel node. (mode 'macro' = the 01.09 V1 programs with OP1_HX.)
          mullion: { path: 'C:/Users/Xp600/Desktop/TEMPLATES_02.09.26/UPDATED_09.09.26/MULLION_MASTER_V2.bSolid', panelId: 1001, panelName: 'P1001', mode: 'master' },
          transom: { path: 'C:/Users/Xp600/Desktop/TEMPLATES_02.09.26/UPDATED_09.09.26/TRANSOM_MASTER_V2.bSolid', panelId: 1001, panelName: 'P1001', mode: 'master' },
        },
        // bSolid writes an EMPTY <ExecutionParameters /> per panel (Worklist_5.ewlist, 14.09) —
        // that is the default. 'Write placement' fills it with the values below (the Biesse
        // sample list saved on this machine, user Xp600, had 9 / 1 / 66.8 / −139.45).
        // Each program entry also carries `stored` once its .bSolid file is uploaded in
        // Window Settings — the export embeds those files (bSolid reads programs from the list).
        writeExecutionParameters: false,
        executionParameters: { origin: 0, refCorner: 0, rotX: 0, rotY: 0, rotZ: 0, offsetX: 0, offsetY: 0, offsetZ: 0 },
      },
    ],
    // ── V2 master programs (mode 'master'): document variables read out of MULLION_1 /
    // TRANSOM_1_MASTER_V2 on 14.09 — WINDOW_WIDTH, WINDOW_HEIGHT, HORN, OPN_1_H, OPN_1_HAND,
    // OPN_2_HAND, FRM_SZE, HEAD_WDTH, TRKL_VNT (TOOL_1..3 / PASS_NUM / STACKED_1 stay the
    // program's). The meanings below are DEFAULT (open) until Matt confirms them.
    master: {
      opn1From: 'bottom',        // OPN_1_H = joint height measured from the frame BOTTOM ('top' = from the head)
      handCodes: { left: 1, right: 4, top: 2, bottom: 3, fixed: 0 },   // OPN_n_HAND codes (Matt's defaults 1 / 4 on a left + right pair)
      noJointValue: 0,           // OPN_1_H written for a member with no joint (ask Matt whether 0 disables the joint)
      headWidth: 80,             // HEAD_WDTH (Matt's default; the head program's 80 constant)
      writeTrickleVent: true,    // TRKL_VNT from the window's ventilation (1 when a trickle vent is fitted)
    },
    // ── V1 macro programs (mode 'macro', 01.09 FC_* set) — kept for a target that still uses them
    screws: 1,                 // SCRW_ON_OFF for the mullion / transom macro (1 = screws, 0 = dowels only)
    opOriginEnd: 'start',      // 'start' | 'end' — the end of the member OPn_HX is measured from (machine test)
    seatSplitStart: 0.5,       // share of (board length − visible run) at the START end — the mullion seats into head and cill (machine test)
    sideValue: { left: 0, right: 1 },   // LH_RH_CNTRL for a joint on the left / right of the member (machine test)
    macroVarsInList: true,     // write OPn_HX / LH_RH_CNTRL / SCRW_ON_OFF as document variables
  },
  // ── Glazier numbers (ARCHED-WINDOWS-v3 Block 0.2) — the sealed unit's
  // spacer bar width laid out in the pattern, and the edge cover: the
  // perimeter spacer / seal band inside the unit contour. Piotr 02.10.2026
  // (glass schema 2): 10 for every glass type (was 11) — the unit is 1mm
  // smaller all round and the spacer line stays where it was.
  glass: {
    barWidth: 18,
    edgeCover: { default: 10, double: 10, double_slim: 10, triple: 10, single: 10, passive: 10 },
  },
  // ── Timber tracery over the arched unit (v3 Block 0.4, numbers from
  // docs/handover/workshop/arka_CNC-piotr.dxf): bead profile R8 along every
  // pane opening — pane outline +paneOffset is the VCarve rail, +paneOffset +
  // profileWidth the bead limit; ridgeLand = timber left between two beads on
  // a bar (bar width = 2·(paneOffset + profileWidth) + ridgeLand = 22),
  // edgeLand = timber outside the bead at the board edge (edge margin =
  // paneOffset + profileWidth + edgeLand = 18). mitreLeg = corner guide leg
  // along each edge. sides = boards per window (tracery on ONE side, Piotr).
  tracery: {
    paneOffset: 2,
    profileWidth: 8,
    ridgeLand: 2,
    edgeLand: 8,
    mitreLeg: 15,
    sides: 1,
    boardThickness: 18,   // DEFAULT (open): the tracery board thickness for the cut list section
  },
  // ── FIXED windows in the casement batch (ARCHED-WINDOWS-v3 Block 3, Piotr
  // 07.09): a fixed window is the casement frame + a NON-OPENING
  // leaf (same members, no hardware). DEFAULT (open, BLOCKERS): 'fixedLeaf';
  // 'directGlazed' (glass straight into the frame rebate, no leaf) has no
  // rebate numbers in this profile yet — the engine refuses it readably.
  fix: { construction: 'fixedLeaf' },
  rounding: 0.1,       // mm — CNC-ready, one decimal
};

let activeProfile = null;
let activeCasementProfile = null;

/**
 * Casement profile schema migration. Stored copies (windowProfileStore
 * persistence, batch _profileSnapshot.casement) may predate v1/v1.1:
 * - pre-v1 prototype (raw fields, sashWidth deductions, no geometry/lengths):
 *   nothing user-set worth keeping — replaced by the current default;
 * - v1 (missing v1.1 transom-layer keys): missing keys filled from the
 *   default, existing values preserved.
 * Without this, deriveCasementWindow crashes on `geometry.land` of undefined
 * and every consumer sees derived = null (blank tabs).
 */
const BSUITE_KEYS = ['head', 'cill', 'jambL', 'jambR', 'mullion', 'transom'];

/** One target's programs merged over the defaults' shape (panel ids, macro flags). */
function mergeTargetPrograms(stored, def) {
  return Object.fromEntries(BSUITE_KEYS.map((k) => [k, { ...def[k], ...(stored?.[k] || {}) }]));
}

export function migrateBsuite(stored, D) {
  const defTarget = D.targets[0];
  let targets;
  if (Array.isArray(stored?.targets) && stored.targets.length) {
    targets = stored.targets.map((t, i) => ({
      ...defTarget, ...t,
      id: t.id || `target-${i + 1}`,
      programs: mergeTargetPrograms(t.programs, defTarget.programs),
      executionParameters: { ...defTarget.executionParameters, ...(t.executionParameters || {}) },
    }));
  } else if (stored?.programsFolder || stored?.programs) {
    // 12.09 shape → one target
    const folder = String(stored.programsFolder || 'C:/bSolid').replace(/\\/g, '/').replace(/\/+$/, '');
    targets = [{
      ...defTarget,
      id: 'target-1', name: `Programs in ${folder}`,
      programs: Object.fromEntries(BSUITE_KEYS.map((k) => {
        const p = stored.programs?.[k] || {};
        return [k, { ...defTarget.programs[k], ...p, path: p.file ? `${folder}/${p.file}` : defTarget.programs[k].path }];
      })),
      writeExecutionParameters: stored.writeExecutionParameters ?? defTarget.writeExecutionParameters,
      executionParameters: { ...defTarget.executionParameters, ...(stored.executionParameters || {}) },
    }];
  } else targets = D.targets.map((t) => ({ ...t, programs: mergeTargetPrograms(null, t.programs), executionParameters: { ...t.executionParameters } }));
  const activeTarget = targets.some((t) => t.id === stored?.activeTarget) ? stored.activeTarget : targets[0].id;
  const { programsFolder, programs, writeExecutionParameters, executionParameters, ...rest } = stored || {};
  void programsFolder; void programs; void writeExecutionParameters; void executionParameters;
  return { ...D, ...rest, targets, activeTarget, sideValue: { ...D.sideValue, ...(stored?.sideValue || {}) },
    master: { ...D.master, ...(stored?.master || {}), handCodes: { ...D.master.handCodes, ...(stored?.master?.handCodes || {}) } } };
}

/** The target a list is built for (profile.bsuite.activeTarget, else the first). */
export function bsuiteActiveTarget(bsuite) {
  return bsuite.targets.find((t) => t.id === bsuite.activeTarget) || bsuite.targets[0];
}

export function migrateCasementProfile(profile) {
  if (!profile) return null;
  const D = DEFAULT_CASEMENT_PROFILE;
  const oldShape = !profile.geometry || !profile.lengths || !profile.elements?.leafStile;
  if (oldShape) return D;
  // v4 Block F (frameSchema 2): a schema-1 copy still carries the 57-wide
  // frame. Each frame-driven value that equals its OLD default moves to the
  // new default; anything the workshop edited by hand is left alone.
  const fs = migrateFrameSchema(profile, D);
  // Glass schema 2 (02.10.2026): a schema-1 copy still carries the 12.5 glass
  // inset / 109 deduction / 11 edge cover — each moves to the new default only
  // while it equals the old one.
  const gs = migrateGlassSchema(profile, D);
  // Leaf schema 3 (07.10.2026) and length schema 2 (06.10.2026): the leaf faces
  // move by the schema the copy is on (schema 1: a face of 67 moves to today's
  // default, so 64 / 64 / 67; schema 2: the bottom rail 64 moves to 67) and a
  // stored transom seat of 8 to 8.5, each only while it still equals the old
  // default.
  const ls = migrateLeafSchema(profile, D);
  const ns = migrateLengthSchema(profile, D);
  const elements = { ...D.elements, ...profile.elements, ...fs.elements, ...ls.elements };
  const geometry = { ...D.geometry, ...profile.geometry, ...fs.geometry, ...gs.geometry };
  const deductions = { ...D.deductions, ...profile.deductions, ...fs.deductions, ...gs.deductions };
  // One source for the glass deductions: wherever glassInset is a number the
  // stored value (the WIDTH deduction) is rewritten to the derived one, so no
  // reader can meet a 111 next to a 64 stile, or a 105 next to a hand-edited 67.
  // The height deduction is never stored: it is derived from the two rails.
  if (glassInsetOf({ geometry }) != null) deductions.glass = casementGlassDeduction({ elements, geometry, deductions });
  return {
    ...D, ...profile,
    frameSchema: D.frameSchema,
    glassSchema: D.glassSchema,
    leafSchema: D.leafSchema,
    lengthSchema: D.lengthSchema,
    elements,
    geometry,
    deductions,
    lengths: { ...D.lengths, ...profile.lengths, ...ns.lengths },
    // v1.2: arched-head section (finger joint, board stock) — filled from the
    // default for profiles stored before arched-casement-v1. v1.3: the block
    // carries a schema version; an older stored block (night-1 keys
    // widthAllowance / maxPieces, invented stock list) is replaced whole.
    // v1.4 (arched-casement-v2): version 3 adds minHaunchRadius + patterns;
    // a stored v2 block is replaced whole (no UI edits this block yet).
    // v3 (arched-windows-v3): glazier block + tracery block, filled from the
    // default for older stored copies (no UI edits them yet).
    glass: { ...D.glass, ...(profile.glass || {}), edgeCover: { ...D.glass.edgeCover, ...(profile.glass?.edgeCover || {}), ...gs.edgeCover } },
    tracery: { ...D.tracery, ...(profile.tracery || {}) },
    fix: { ...D.fix, ...(profile.fix || {}) },
    // v4 (ARCHED-WINDOWS-v4 Block C): CNC block (clamp limits), filled from the default
    cnc: { ...D.cnc, ...(profile.cnc || {}), clamp: { ...D.cnc.clamp, ...(profile.cnc?.clamp || {}) } },
    // bSuite export block: merged key by key. Targets (14.09) are kept as stored; a
    // 12.09 copy with programsFolder + programs (one folder, file names) becomes one
    // target named after the folder so nothing the user typed is lost.
    bsuite: migrateBsuite(profile.bsuite, D.bsuite),
    arch: profile.arch?.version === D.arch.version
      ? {
          ...D.arch, ...profile.arch,
          finger: { ...D.arch.finger, ...profile.arch.finger },
          limits: { ...D.arch.limits, ...profile.arch.limits },
          patterns: {
            ...D.arch.patterns, ...(profile.arch.patterns || {}),
            sunburst: { ...D.arch.patterns.sunburst, ...(profile.arch.patterns?.sunburst || {}) },
          },
        }
      : D.arch,
  };
}

// Old defaults of frame schema 1 (head / jambs 57, land 36) and the schema-2
// keys they map to. Returns only the keys that must move.
const FRAME_SCHEMA_1 = {
  elements: { frameHead: { face: 57 }, frameJamb: { face: 57 } },
  geometry: { land: 36 },
  deductions: { leafAtJamb: 40, leafFullHeight: 87, fanFromAxis: 54 },
};
// Old defaults of glass schema 1 (glass 12.5 into the rebate, 2×(67 − 12.5) =
// 109, edge cover 11) and the schema-2 keys they map to. Returns only the keys
// that must move (Piotr 02.10.2026: 1mm smaller all round, spacer unmoved).
const GLASS_SCHEMA_1 = { geometry: { glassInset: 12.5 }, deductions: { glass: 109 }, edgeCover: 11 };
function migrateGlassSchema(profile, D) {
  const out = { geometry: {}, deductions: {}, edgeCover: {} };
  if ((Number(profile.glassSchema) || 1) >= D.glassSchema) return out;
  if (profile.geometry?.glassInset === GLASS_SCHEMA_1.geometry.glassInset) out.geometry.glassInset = D.geometry.glassInset;
  if (profile.deductions?.glass === GLASS_SCHEMA_1.deductions.glass) out.deductions.glass = D.deductions.glass;
  const covers = profile.glass?.edgeCover || {};
  for (const k of Object.keys(covers)) {
    if (covers[k] === GLASS_SCHEMA_1.edgeCover) out.edgeCover[k] = D.glass.edgeCover[k] ?? D.glass.edgeCover.default;
  }
  return out;
}

function migrateFrameSchema(profile, D) {
  const out = { elements: {}, geometry: {}, deductions: {} };
  if ((Number(profile.frameSchema) || 1) >= D.frameSchema) return out;
  for (const k of Object.keys(FRAME_SCHEMA_1.elements)) {
    if (profile.elements?.[k]?.face === FRAME_SCHEMA_1.elements[k].face) out.elements[k] = { ...profile.elements[k], face: D.elements[k].face };
  }
  for (const k of Object.keys(FRAME_SCHEMA_1.geometry)) {
    if (profile.geometry?.[k] === FRAME_SCHEMA_1.geometry[k]) out.geometry[k] = D.geometry[k];
  }
  for (const k of Object.keys(FRAME_SCHEMA_1.deductions)) {
    if (profile.deductions?.[k] === FRAME_SCHEMA_1.deductions[k]) out.deductions[k] = D.deductions[k];
  }
  return out;
}

// Old defaults of the leaf schemas, by the schema a stored copy is on, and the
// faces they map to (today's default: stiles 64, top rail 64, bottom rail 67).
// Schema 1 (until 06.10.2026): the four members 67, so every face of 67 moves
// to today's default (the bottom rail stays 67). Schema 2 (06.10.2026): the four
// members 64, so only the bottom rail moves, 64 to 67 (Piotr 07.10.2026); the
// stiles and the top rail of a schema 2 copy are already today's. Each copy is
// read on its OWN schema only, never chained, so a hand edit made under schema 1
// is never taken for a schema 2 default. Returns only the faces that must move;
// the element object keeps every other key it carries.
const LEAF_SCHEMA_1 = { elements: { leafStile: { face: 67 }, leafTop: { face: 67 }, leafBottom: { face: 67 } } };
const LEAF_SCHEMA_2 = { elements: { leafBottom: { face: 64 } } };
function migrateLeafSchema(profile, D) {
  const out = { elements: {} };
  const schema = Number(profile.leafSchema) || 1;
  if (schema >= D.leafSchema) return out;
  const old = schema >= 2 ? LEAF_SCHEMA_2 : LEAF_SCHEMA_1;
  for (const k of Object.keys(old.elements)) {
    if (profile.elements?.[k]?.face === old.elements[k].face) out.elements[k] = { ...profile.elements[k], face: D.elements[k].face };
  }
  return out;
}

// Old defaults of length schema 1 (transom seat 8) and the schema-2 value it
// maps to (Piotr 06.10.2026: 8.5). partialMullionSeat is NOT in here: it stays 8
// (provisional, its own decision). Returns only the lengths that must move.
const LENGTH_SCHEMA_1 = { lengths: { transomSeat: 8 } };
function migrateLengthSchema(profile, D) {
  const out = { lengths: {} };
  if ((Number(profile.lengthSchema) || 1) >= D.lengthSchema) return out;
  for (const k of Object.keys(LENGTH_SCHEMA_1.lengths)) {
    if (profile.lengths?.[k] === LENGTH_SCHEMA_1.lengths[k]) out.lengths[k] = D.lengths[k];
  }
  return out;
}

export function setActiveCasementProfile(profile) {
  activeCasementProfile = migrateCasementProfile(profile);
}
export function getCasementProfile() {
  return activeCasementProfile || DEFAULT_CASEMENT_PROFILE;
}

/** geometry.glassInset as a number, or null when the profile has none. */
function glassInsetOf(profile) {
  const v = profile?.geometry?.glassInset;
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * The casement glass WIDTH deduction: leaf width minus glass unit width,
 * 2 x (leafStile.face - geometry.glassInset), rounded to 0.1 like the engine.
 * It is also the value kept in deductions.glass. deductions.glass is read only
 * when the profile has no glassInset (a copy stored before the key existed).
 * Default profile: 105. Readers that size a glass unit take BOTH directions from
 * casementGlassDeductions() below; this one never sizes a height.
 */
export function casementGlassDeduction(profile = getCasementProfile()) {
  const inset = glassInsetOf(profile);
  if (inset == null) return profile?.deductions?.glass;
  return Math.round(2 * (Number(profile.elements.leafStile.face) - inset) * 10) / 10;
}

/**
 * The casement glass deductions, one per direction (Piotr 07.10.2026: the bottom
 * rail has its own width). ONE source for every reader (the engine, the leaf /
 * glass / elevation sheets, Window Settings), both rounded to 0.1 like the engine:
 *   width  = 2 x (leafStile.face - glassInset)                          (105)
 *   height = (leafTop.face - glassInset) + (leafBottom.face - glassInset) (108)
 * Without glassInset (a copy stored before the key existed) both fall back to
 * deductions.glass, as they always did.
 */
export function casementGlassDeductions(profile = getCasementProfile()) {
  const width = casementGlassDeduction(profile);
  const inset = glassInsetOf(profile);
  if (inset == null) return { width, height: profile?.deductions?.glass };
  const els = profile.elements;
  const top = Number((els.leafTop || els.leafStile).face);
  const bottom = Number((els.leafBottom || els.leafStile).face);
  return { width, height: Math.round(((top - inset) + (bottom - inset)) * 10) / 10 };
}

// ─── DOOR PROFILE v3 (Piotr 09.10.2026, doors v3: casement rules inside the door frame) ──
// The door FRAME is the casement frame: face 68, depth 93, land 47, rebate 21,
// gap 4, cill 68 x 93 with 41 visible. Since schema 3 it is ONE frame with the
// casement rules inside it (owner box items 1 to 7, 09.10.2026):
//   - frame W x H = the OVERALL frame (side panels and fanlight inside it);
//   - between the door and a side panel stands a casement MULLION 68 x 93,
//     full height through the transom, the leaf 17 from its axis (13 + 4);
//     side panel zone = sideLeftWidth / sideRightWidth from the outer frame
//     edge to the mullion axis (ASSUMPTION, owner check);
//   - the fanlight TRANSOM is the casement transom: axis at transom.height T
//     from the frame top (ASSUMPTION, owner check), land 8 above / 13 below,
//     fan leaf T - 65 (51 + 6 + 8), leaf below it 17 from the axis (13 + 4),
//     the rail cut in segments between the jambs and mullions (seat 8.5);
//   - every leaf stands leafAtFloor 51 above the floor line, whatever the
//     threshold and the direction: leaf H = H - 51 - 51, under a transom
//     H - T - 17 - 51;
//   - side panel = a casement fixed light (non-opening leaf) 64 / 64 / 180 x 57,
//     glass by the casement rule; fixed fanlight = a non-opening casement leaf
//     64 / 64 / 67 (bottom 67 ASSUMPTION, owner check);
//   - panel edge sits 17 deep in the 18 glazing rebate (panel = daylight + 2 x 17).
// The LEAF is 57 deep (61 with a triple unit, as casement): stiles 94, top rail
// 94, bottom rail 180, mid rail 94, french meeting stile 100 = 94 + the 6 lip.
//   single leaf W = zone - edge L - edge R (51 at a jamb, 17 at a mullion axis)
//   french half  = (zone - edges - frenchClearance) / 2, leaf = half + frenchLip
// The casement formulas themselves are in casementRules.js (shared).
// Schema 2 (08.10.2026): coupling post 136, side panel members 57, fanlight
// 51 at the head and the rail, leaf H - 98 / H - 57; schema 1 (04.08 to
// 07.10.2026) the 28mm-unit numbers. migrateDoorProfile moves a stored copy
// key by key.
export const DEFAULT_DOOR_PROFILE = Object.freeze({
  schema: 3,
  frameDepth: 93,
  leafDepth: 57,          // as casement leafDepth (24mm unit)
  leafDepthTriple: 61,    // as casement leafDepthTriple: the 28mm triple unit needs a deeper leaf rebate
  elements: {
    frameHead:   { face: 68 },   // as casement frameHead
    frameJamb:   { face: 68 },   // as casement frameJamb
    frameCill:   { face: 68 },   // outward: the casement cill, 68 x 93, 41 visible
    mullion:     { face: 68 },   // as casement: between the door and a side panel, full height (a french door has no centre mullion)
    transomRail: { face: 68 },   // as casement transom: the fanlight rail, cut in segments between jambs and mullions
    leafStile:   { face: 94 },
    leafTop:     { face: 94 },
    leafBottom:  { face: 180 },  // deliberately taller: door stiffness
    leafMid:     { face: 94 },   // mid rail of the half-glazed and three-quarter styles
    leafMeeting: { face: 100 },  // french meeting stile = 94 + frenchLip 6
  },
  // Inward-opening doors cannot have a rebated cill (the leaf must swing in):
  // the internal face is 40mm and falls to 35mm across the leaf depth. An
  // inward door ALWAYS takes this timber cill: a stored aluminium or
  // low-profile threshold is ignored on it (ASSUMPTION, owner check).
  cillInward: { faceInternal: 40, faceExternal: 35, runDepth: 57 },
  // French doors never have a centre mullion (Piotr 09.08): each leaf runs
  // frenchLip past the centre line on its meeting stile.
  frenchLip: 6,
  // frenchClearance: 0,   // centre clearance between the two halves: owner, later (after tests). Leave unset;
  //                       // the engine honours it when a workshop sets it: half = (zone - edges - clearance) / 2.
  // Side panel (schema 3): a casement FIXED light behind the mullion, a
  // non-opening leaf with stiles and top rail 64 and the bottom rail of the
  // door (180), so its line meets the door bottom rail; depth 57.
  sidePanel: { stile: 64, top: 64, bottom: 180, depth: 57 },
  // Fixed fanlight (schema 3): a non-opening casement leaf of the same size as
  // the opening fan leaf would be; bottom rail 67 as the casement fixed light
  // (ASSUMPTION, owner check).
  fixedFan: { stile: 64, top: 64, bottom: 67 },
  // Schema 2 coupling post (2 x jamb face, two rebates): kept for stored
  // copies only, NOT read by the engine since schema 3 (the mullion replaced it).
  couplingPost: { width: 136 },
  // Panel of the half-glazed and three-quarter styles: two Tricoya MDF boards
  // and an MDF core (54). The edge is machined down to a tongue that sits in
  // the leaf glazing rebate (18 deep) `inset` 17 in: panel = daylight + 2 x 17
  // (the glass sits 11.5 in). edge = the drawing profile: a tongue 24 thick, a
  // slope 40 wide up to the full 54, a flat 15 next to the bead (ASSUMPTION,
  // owner check). coreThickness 18 and densityKgM3 (leaf weight, information
  // only) are FLAGGED defaults. BOM: both boards and the core at the full
  // panel outer size (ASSUMPTION, owner check).
  panel: { boardThickness: 18, boards: 2, coreThickness: 18, densityKgM3: 750, inset: 17, edge: { tongue: 24, slope: 40, flat: 15 } },
  geometry: {
    land: 47,             // as casement: frame land 68 - 21
    rebate: 21,           // as casement
    gap: 4,               // as casement: leaf fitting gap at jambs, mullions and head
    mullionLand: 26,      // as casement: mullion visible land (13 + 13)
    transomLandAbove: 8,  // as casement: transom land above the axis
    transomLandBelow: 13, // as casement: transom land below the axis
    gapFanTransom: 6,     // as casement: fan bottom rail to the transom land
    gapBelowTransom: 4,   // as casement: transom land to the leaf below
    gapCill: 6,           // as casement (window cill; a door leaf stands leafAtFloor above the floor)
    cillVisible: 41,      // as casement: cill front seen from outside
    glassInset: 11.5,     // as casement: glass enters the leaf rebate this deep, per side
    glazingRebate: 18,    // as casement: the leaf glazing rebate (11.5 glass + 6.5 clips; the panel tongue 17)
  },
  deductions: {
    leafAtJamb: 51,          // land 47 + gap 4
    leafAtMullionAxis: 17,   // as casement: half mullion land 13 + gap 4
    leafAtFloor: 51,         // every leaf bottom stands 51 above the floor line (threshold and accessories), any threshold, any direction
    fanFromAxis: 65,         // as casement: fan leaf H = T - 65 (51 + 6 + 8)
    leafBelowAxis: 17,       // as casement: the leaf below the transom starts 17 below the axis (13 + 4)
    // Not read by the engine since schema 3 (kept for stored copies, shown
    // read-only): the derived values leafAtJamb + leafAtFloor.
    leafFullHeight: 102,
    leafNoThreshold: 102,
  },
  // Hinges per door leaf and their centres from the leaf top (the sheets' rule
  // since 05.08.2026): 200 below the top, 100 above the centre, 150 above the
  // bottom; the 4th halfway between top and middle.
  hinges: { perLeaf: 3, perLeafTall: 4, tallAbove: 2100, fromTop: 200, aboveCentre: 100, fromBottom: 150, barrel: 102 },
  // French MEETING STILES (Piotr 24.10.2026, the Winkhaus FGTE rebated routing
  // detail for a 58 slab as the pattern): each meeting stile 100 = 94 + the
  // 6 lip keeps a full-length rebate at its meeting edge,
  //   rebate width  = the two lips (2 x frenchLip - frenchClearance = 12) + gap
  //                   (4 between a lip edge and the other leaf's shoulder) = 16;
  //   rebate depth  = leafDepth - the lip that stays: the ACTIVE lip (lipActive
  //                   37, on the face the door swings to) is cut 20 deep from
  //                   the other face; the PASSIVE lip (lipPassive 14.5, on the
  //                   other face) is cut 42.5 deep from the swing face;
  //   between the two lips 57 - 37 - 14.5 = 5.5 stays for the seal, which sits
  //   in a 3 mm groove in the passive shoulder at the foot of its lip (Q-lon
  //   Aquamac 124, the Winkhaus detail).
  // The lock axis sits lockEdgeMargin 12 + faceplate 21 / 2 = 22.5 from the
  // lip face on BOTH leaves (the FGTE "22 mm centre line" variant).
  meeting: {
    gap: 4,
    lipActive: 37,
    lipPassive: 14.5,
    sealGroove: 3,
  },
  // Variant attributes the buyer selects on the BJ Waller page (owner links
  // 08.10.2026). Every value is a FLAGGED default (BLOCKERS 5.5).
  hardware: {
    doorThickness: 56,          // ThunderBolt door thickness variant for the 57 leaf
    backset: 45,                // ThunderBolt backset: 45 or 55
    faceplate: 'radius',        // ThunderBolt faceplate: radius or square
    keeps: 'full length',       // ThunderBolt keeps
    fgteShootbolts: 'slave',    // FGTE family: 'slave' (slave shootbolts only) or 'both'
    fgteSlaveBackset: 45,       // FGTE slave backset: 35 or 45
    fgteCentreLine: 22,         // FGTE lock centre line: 12 or 22
    cillKeep: 'yes',            // FGTE shootbolt keep cill option, when the door has a timber cill
    handleHeight: 1000,         // handle centre above the floor: read only when spindleFromLeafBottom is unset (pre 24.10 copies)
    // Lock machining (Piotr 24.10.2026, Winkhaus data sheets): ONE spindle axis
    // for the single door (ThunderBolt) and the french door (FGTE master and
    // slave), measured from the LEAF BOTTOM, so the leaf programs share it.
    // 1050 = the Winkhaus routing example; the ThunderBolt 1770 faceplate then
    // lies 144 to 1914 on a 1998 leaf and the FGTE handle range 1040 to 1247
    // holds (ASSUMPTION, owner check: BLOCKERS 32).
    spindleFromLeafBottom: 1050,
    lockEdgeMargin: 12,         // lip face to the faceplate recess edge
    faceplateWidth: 21,         // the routed recess for the 20 mm faceplate (Winkhaus 20.5)
    faceplateRecessMaster: 3,   // recess depth, the master / single lock faceplate
    faceplateRecessSlave: 5,    // recess depth, the FGTE slave faceplate
    rodChannelWidth: 12.2,      // the connecting rod channel under the faceplate (FGTE routing)
    rodChannelDepthMaster: 12,
    rodChannelDepthSlave: 15,
    auxHousing: false,          // ThunderBolt: the 4th pocket (the "additional lock, prepared" housing of the data sheet); the product DXF (24.10.2026) has three housings, so off
  },
  lengths: {
    headDeduct: 0,
    jambDeduct: 0,
    cillDeduct: 0,
    stileDeduct: 0,
    topRailDeduct: 0,
    bottomRailDeduct: 0,
    midRailDeduct: 0,
    meetingStileDeduct: 0,
    mullion: 77,          // as casement: D-M = H - 77 with a timber cill; without one the mullion runs to the floor: H - (77 - cillVisible 41)
    transomSeat: 8.5,     // as casement: a transom segment = the leaf width of its field + 8.5
    // Side panel light and fixed fan members: full outer lengths (the leaf convention).
    sideStileDeduct: 0,
    sideRailDeduct: 0,
  },
});

// Old defaults of door schema 1 (the 28mm-unit door, 04.08 to 07.10.2026) and
// the schema-2 keys they map to. A stored copy below schema 2 takes a new
// value only while it still equals the old default; a hand edit is kept.
const DOOR_SCHEMA_1 = {
  top: { leafDepth: 61 },
  geometry: { land: 43, rebate: 25 },
  deductions: { leafAtJamb: 47, leafFullHeight: 94, leafNoThreshold: 53 },
  cillInward: { runDepth: 61 },
};
// Old defaults of door schema 2 (08.10.2026) that schema 3 moves: the leaf
// height deductions become the derived 102 (51 at the head + 51 at the floor,
// not read by the engine any more). The new schema-3 keys (leafAtFloor,
// fanFromAxis, leafBelowAxis, the transom geometry, transomSeat, panel.inset /
// edge, sidePanel stile / top / bottom, fixedFan) do not exist in a schema-2
// copy and take the defaults. Keys no longer read (couplingPost, fanAtHead,
// fanAtRail, transomDeduct, sidePanel.member) stay in the object as stored.
const DOOR_SCHEMA_2 = {
  deductions: { leafFullHeight: 98, leafNoThreshold: 57 },
};

/**
 * Door profile schema migration (casement style). Stored copies (Window
 * Settings, windowProfiles.door; batch _profileSnapshot.door) move schema by
 * schema, key by key: a value equal to the old schema's default takes the new
 * default, a hand-edited one is kept. Schema 1 to 2: frenchOverlap (the rebate
 * of each meeting stile) is read as frenchLip when no frenchLip is stored;
 * transom.rail as elements.transomRail. Schema 2 to 3: see DOOR_SCHEMA_2.
 * Missing keys come from the default.
 */
export function migrateDoorProfile(profile) {
  if (!profile) return null;
  const D = DEFAULT_DOOR_PROFILE;
  const schema = Number(profile.schema) || 1;
  const below2 = schema < 2;
  const below3 = schema < 3;
  // A key moved by more than one schema step: the stored value is compared
  // with each old default in turn (1 -> 2 -> 3), so a schema-1 default walks
  // all the way, a value hand-edited on any schema stays.
  const walk = (stored, olds, def) => {
    let v = stored;
    for (const [isOld, oldDefault, next] of olds) if (isOld && v === oldDefault) v = next;
    return v ?? def;
  };
  const pick = (stored, oldDefault, def) => walk(stored, [[below2, oldDefault, def]], def);
  const elements = Object.fromEntries(Object.keys(D.elements).map((k) => [k, { ...D.elements[k], ...(profile.elements?.[k] || {}) }]));
  for (const k of Object.keys(profile.elements || {})) if (!elements[k]) elements[k] = { ...profile.elements[k] };
  if (!profile.elements?.transomRail && profile.transom?.rail != null) elements.transomRail = { face: Number(profile.transom.rail) };
  const geometry = { ...D.geometry, ...(profile.geometry || {}) };
  for (const k of Object.keys(DOOR_SCHEMA_1.geometry)) geometry[k] = pick(profile.geometry?.[k], DOOR_SCHEMA_1.geometry[k], D.geometry[k]);
  const deductions = { ...D.deductions, ...(profile.deductions || {}) };
  deductions.leafAtJamb = pick(profile.deductions?.leafAtJamb, DOOR_SCHEMA_1.deductions.leafAtJamb, D.deductions.leafAtJamb);
  for (const k of Object.keys(DOOR_SCHEMA_2.deductions)) {
    deductions[k] = walk(profile.deductions?.[k], [
      [below2, DOOR_SCHEMA_1.deductions[k], DOOR_SCHEMA_2.deductions[k]],
      [below3, DOOR_SCHEMA_2.deductions[k], D.deductions[k]],
    ], D.deductions[k]);
  }
  const cillInward = { ...D.cillInward, ...(profile.cillInward || {}) };
  cillInward.runDepth = pick(profile.cillInward?.runDepth, DOOR_SCHEMA_1.cillInward.runDepth, D.cillInward.runDepth);
  const frenchLip = profile.frenchLip ?? (profile.frenchOverlap != null ? Number(profile.frenchOverlap) : D.frenchLip);
  const { frenchOverlap, transom, ...rest } = profile;
  void frenchOverlap; void transom;
  const storedPanel = profile.panel || {};
  return {
    ...D, ...rest,
    schema: D.schema,
    leafDepth: pick(profile.leafDepth, DOOR_SCHEMA_1.top.leafDepth, D.leafDepth),
    leafDepthTriple: profile.leafDepthTriple ?? D.leafDepthTriple,
    elements,
    cillInward,
    frenchLip,
    sidePanel: { ...D.sidePanel, ...(profile.sidePanel || {}) },
    fixedFan: { ...D.fixedFan, ...(profile.fixedFan || {}) },
    couplingPost: { ...D.couplingPost, ...(profile.couplingPost || {}) },
    panel: { ...D.panel, ...storedPanel, edge: { ...D.panel.edge, ...(storedPanel.edge || {}) } },
    geometry,
    deductions,
    hinges: { ...D.hinges, ...(profile.hinges || {}) },
    hardware: { ...D.hardware, ...(profile.hardware || {}) },
    meeting: { ...D.meeting, ...(profile.meeting || {}) },
    lengths: { ...D.lengths, ...(profile.lengths || {}) },
  };
}

let activeDoorProfile = null;
// Pushed in by windowProfileStore (hydrate, cloud load, every edit). A stored
// copy below schema 2 is migrated key by key on the way in.
export function setActiveDoorProfile(profile) {
  activeDoorProfile = profile ? migrateDoorProfile(profile) : null;
}
export function getDoorProfile() {
  return activeDoorProfile || DEFAULT_DOOR_PROFILE;
}

// ═════════════════════════════════════════════════════════════════════════════
// PARTITION (meeting room walls) PROFILE, Piotr 25.10.2026
//
// An internal glazed partition in solid oak: a bay of screens and one door
// between an end board on each wall and a head board under the ceiling, no
// threshold. Every member is 50 wide x 54 deep, machined as an L: a rebate
// 18 deep (into the width) x 42 (into the depth: the 30 glass zone and the
// 12 bead) on the ROOM face, a solid 12 upstand on the FRONT (corridor) face.
// One 6/16/6 unit (28) per screen sits 13.5 into the rebate (the 12 spacer
// hidden 1.5 in the timber: a 1000 daylight takes a 1027 unit), on 4.5 packers,
// with the 22 glazing bars applied on both faces and a dummy spacer in the
// cavity. The solid panel is made 30 thick so it takes the same rebate and
// bead. The door leaf is as deep as the wall (54), stiles 120, top rail 100,
// bottom rail 180, the mid rail at the screens' mid rail; its lock edge is
// rebated 17 x 34 leaving a 20 lip on the front, the lock post carries a
// 17 x 31 stop lip on the room side (3 clearance), the hinge post is plain.
// Owner numbers of 25.10.2026 (the Windmill Street DXF read with the owner's
// corrections: depth 54 not 80, rebate 18 not 15, applied bars, no screws).
// Numbers marked ASSUMPTION are the programmer's proposal from the section
// mockup v1, to confirm (BLOCKERS 34).
// ═════════════════════════════════════════════════════════════════════════════
export const DEFAULT_PARTITION_PROFILE = Object.freeze({
  schema: 1,
  depth: 54,                      // every member through the wall, the door leaf too (Piotr 25.10.2026)
  elements: {
    board:      { face: 20, overhang: 10 },   // the head board and the end boards: 20 thick, depth + 2 x 10 wide, separate elements
    post:       { face: 50 },
    topRail:    { face: 50 },                 // one piece between the end boards, over the posts
    midRail:    { face: 50 },                 // per screen, between the glass and the panel
    bottomRail: { face: 50 },                 // per screen, on the floor
    bar:        { face: 22, thickness: 8 },   // applied glazing bar, both faces (thickness ASSUMPTION)
    bead:       { width: 18, thickness: 12 }, // the bead fills the rebate width on the room side (ASSUMPTION 12 / 30 / 12)
    doorStile:  { face: 120 },
    doorTop:    { face: 100 },
    doorMid:    { face: 50 },
    doorBottom: { face: 180 },
  },
  glazing: {
    unit: 28,                 // 6 / 16 / 6
    makeup: '6/16/6',
    tape: 1,                  // glazing tape each side of the unit: the glass zone = unit + 2 x tape = 30; the front upstand = depth - zone - bead (12)
    rebateDepth: 18,          // the rebate into the member width (Piotr: 18)
    glassIn: 13.5,            // the unit into the rebate: spacer 12 + 1.5 hidden in the timber (Piotr: 1000 -> 1027)
    packer: 4.5,              // setting blocks under the unit = the play (18 - 13.5), so the top cover stays 13.5
    spacer: 12,               // the unit's spacer frame width
    dummySpacer: 22,          // the dummy spacer behind the applied bars
    beadSide: 'room',         // the beads (and the unit) go in from the room; the stop lip of the door is on the same face
    kgPerSqm: 30,             // 6 / 16 / 6: 12 mm of glass at 2.5 kg per m2 per mm (the door double unit rate)
  },
  panel: {
    thickness: 30,            // made 30 thick so it takes the glass rebate and bead (ASSUMPTION; option A, B or C)
    build: 'veneered',        // 'veneered' (oak 6 + MDF 18 + oak 6), 'solid' (oak 30), 'packed' (oak 20 + 2 x 5 strips)
    panelIn: 13.5,            // into the rebate, as the glass
    densityKgM3: 700,         // veneered MDF / oak board, for the weights
  },
  door: {
    leafDepth: 54,            // as the wall (Piotr: looks better)
    gap: 3,                   // fitting gap each side and at the head (the DXF: 3 / 3 / 3)
    floorClearance: 5,        // leaf bottom above the floor (the DXF: 5)
    lipFront: 20,             // the leaf lock edge keeps a 20 lip on the front; the rebate behind it = leafDepth - 20 (34)
    stopWidth: 17,            // the stop lip on the lock post (room side), 17 wide x (leafDepth - lipFront - gap) deep (31)
    glazed: 'upper',          // the leaf: glazed above the mid rail, a panel below ('upper') or glazed full height ('full')
    headStop: 'planted',      // the head stop over the door: a planted 17 x 31 strip under the top rail (ASSUMPTION); the lock post stop is from solid
  },
  hinges: {
    perLeaf: 3, fromTop: 200, aboveCentre: 100, fromBottom: 150, perLeafTall: 4, tallAbove: 2200,   // the door rule (Piotr 25.10: as the single door)
    length: 102, open: 76, thickness: 3, radius: true, knuckle: 14,   // knuckle 14 (ASSUMPTION): flap (76 - 14) / 2 = 31 each side
    name: 'Enduro radius ball bearing butt hinge grade 13, 102 x 76 x 3, stainless (fire rated, 120 kg)',
  },
  hardware: {
    handleHeight: 1000,       // lever handle centre above the floor (Piotr 25.10)
    latch: 'tubular',         // a plain tubular latch with lever handles on a rose (Piotr: "normalny latch")
    latchCase: 76, latchBackset: 57,   // ASSUMPTION: the 76 mm tubular latch, 57 backset
    latchBore: 16,            // the latch body bore from the leaf edge (ASSUMPTION)
    spindle: 8, spindleBore: 10,
    forend: { length: 57, width: 25, thickness: 2 },   // the latch forend and the keep plate, radius ends (ASSUMPTION)
    keepBolt: { width: 16, depth: 15 },                 // the latch bolt pocket behind the keep (ASSUMPTION)
  },
  joints: {
    dowel: { dia: 8, length: 40, perJoint: 3 },          // Piotr 25.10: dowels 8 mm, 3 per joint, no screws at this stage
    // where the three dowels sit in a rail end (the L section: body 32 wide x 54 deep behind the 12 front strip):
    // [across the width from the solid edge, depth from the front face]; a triangle clear of the rebate (ASSUMPTION)
    pattern50: [[10, 20], [22, 33], [10, 46]],
    rowDepth: 33,             // wider members (the door rails 100 / 180): three dowels in a row at this depth
    rowMargin: 15,            // ... the first and last this far from the solid edges
  },
  lengths: {
    preCut: 10,               // pre-cut allowance per member, as the windows (Piotr 25.10)
    railSeat: 0,              // a rail is cut to its field width (dowelled, no tenon)
  },
  // the configurator defaults (the Windmill Street bay)
  defaults: { lights: 3, panelHeight: 790, doorWidth: 800, layout: 'SDS', hingeSide: 'left', swing: 'out' },
});

/**
 * Partition profile migration: schema 1, block by block over the default (a
 * missing key takes the default, a stored one stays), ready for key moves.
 */
export function migratePartitionProfile(profile) {
  if (!profile) return null;
  const D = DEFAULT_PARTITION_PROFILE;
  const elements = Object.fromEntries(Object.keys(D.elements).map((k) => [k, { ...D.elements[k], ...(profile.elements?.[k] || {}) }]));
  for (const k of Object.keys(profile.elements || {})) if (!elements[k]) elements[k] = { ...profile.elements[k] };
  return {
    ...D, ...profile,
    schema: D.schema,
    elements,
    glazing: { ...D.glazing, ...(profile.glazing || {}) },
    panel: { ...D.panel, ...(profile.panel || {}) },
    door: { ...D.door, ...(profile.door || {}) },
    hinges: { ...D.hinges, ...(profile.hinges || {}) },
    hardware: { ...D.hardware, ...(profile.hardware || {}) },
    joints: { ...D.joints, ...(profile.joints || {}), dowel: { ...D.joints.dowel, ...(profile.joints?.dowel || {}) } },
    lengths: { ...D.lengths, ...(profile.lengths || {}) },
    defaults: { ...D.defaults, ...(profile.defaults || {}) },
  };
}

let activePartitionProfile = null;
export function setActivePartitionProfile(profile) {
  activePartitionProfile = profile ? migratePartitionProfile(profile) : null;
}
export function getPartitionProfile() {
  return activePartitionProfile || DEFAULT_PARTITION_PROFILE;
}

// ═════════════════════════════════════════════════════════════════════════════
// FIRE DOOR PROFILE (internal door sets FDR / DR, Piotr 27.10.2026)
//
// An internal timber door set: one leaf (a bought blank, machined on the Rover
// by the owner's bSolid master FD_LEAF_MASTER_PIOTR, macro Master_Door_PIOTR)
// in a three-member frame (head, hinge jamb, lock jamb) machined from 63 thick
// stock to 50, as wide as the wall (frameDepth 100 to 200). The rebate is cut
// from solid on every member: 15 wide (12 overlap + 3 gap) across the 50 and
// (leaf + 3) deep along the depth, so the frame shows 35 outside and 50 inside.
// v1.1 (27.10.2026 evening): the STRUCTURAL OPENING is the input (frame =
// opening - 5 a side and - 5 at the head, leaf = frame - 76 / - 43), the leaf
// can still be typed to override. Hinges: the top one 150 from the top, the
// bottom one ending 200 above the bottom, the middle one 200 ABOVE the leaf
// centre (owner); the DIN lock spindle at 1000 from the leaf bottom, backset
// 60; the mitred corners dowelled 8 x 40 x 3. Fire ON (FD30 leaf 44, FD60
// leaf 54) switches fire hinges, the FD lock and keep, the 15 x 4 intumescent
// (FD30 one strip, FD60 two) and fire glass; Fire OFF the standard set. No
// swing: an internal door is handed by its hinge side only. Every number
// below is a workshop default edited in Window Settings, Fire Doors; the ones
// marked ZAŁOŻENIE are the programmer's reading where the owner gave no
// number (BLOCKERS 35). fireDoor.js is the only reader that turns them into
// sizes and positions.
// ═════════════════════════════════════════════════════════════════════════════
export const DEFAULT_FIREDOOR_PROFILE = Object.freeze({
  schema: 1,
  leaf: {
    widthSuggestions: [626, 686, 726, 762, 826, 838, 926, 1056],   // chips in the form; the field stays free, never clamped
    heightSuggestion: 2040,
    defaultWidth: 826, defaultHeight: 2040,
    thicknessByRating: { FD30: 44, FD60: 54, none: 44 },           // the macro has conditions on 44 and 54
    blankAllowance: 0,                 // ZAŁOŻENIE: blank bought oversize, CNC cuts the size
    leadEdgeMacroValue: -8,            // the macro LEAD_EDGE expression value (unit not decoded)
    limits: { minWidth: 300, maxWidth: 1500, minHeight: 1500, maxHeight: 3000, minDepth: 50, maxDepth: 400 },   // hard sanity only: outside = that door fails with a message
  },
  frame: {
    rawThickness: 63, thickness: 50,
    rawWidthAllowance: 5,              // ZAŁOŻENIE: raw board width = frame depth + 5
    overlap: 12, gapSide: 3, gapHead: 3,
    floorGap: 5,                       // the frame stands 5 longer than the leaf (owner 27.10, the LSP): leaf bottom above the floor
    rebateClearance: 3,                // rebate depth = leaf thickness + this
    headJoint: 'mitre',                // ZAŁOŻENIE: the head meets the jambs on a 45 mitre (the LSP); only 'mitre' is implemented
    // v1.1 (owner 27.10.2026 evening): the structural opening is the input. The
    // frame overall = opening - 2 x wallGapSide wide and opening - wallGapHead
    // high (the frame foot stands on the floor); the leaf = overall - 76 / - 43.
    // Example: opening 1000 -> frame 990 -> leaf 914; opening 2100 -> 2095 -> 2052.
    wallGapSide: 5, wallGapHead: 5,
    // v1.1: the mitred corners are dowelled: `perJoint` dowels `dia` x `length`
    // per corner, bored square to the mitre face (45 to the member), half the
    // length into each piece, spread along the frame depth `margin` in from
    // each face, on the centre of the 50 thickness (margin ZAŁOŻENIE; 8 x 40 x 3 = owner)
    dowels: { dia: 8, length: 40, perJoint: 3, margin: 20 },
    depthSuggestions: [100, 125, 150, 175, 200], defaultDepth: 100,
  },
  hinges: {
    count: 3, length: 102, topOffset: 150, bottomOffset: 200,     // top hinge 150 from the leaf top, bottom hinge ending 200 above the leaf bottom
    // v1.1 (owner 27.10.2026): the middle hinge is never on the centre: its
    // CENTRE sits midAboveCentre above the leaf centre (2040: top edge at 769,
    // not 944). With more than 3 hinges the inner ones spread equally.
    midAboveCentre: 200,
    recessLength: 103, recessWidth: 30, recessDepth: 3, cornerRadius: 6,   // ZAŁOŻENIE: plate + 1, R6 (12 cutter); old Weeke depths were 3.2 / 4 / 4.2
  },
  lock: {
    spindleHeight: 1000, backset: 60,  // LOCK_H from the leaf bottom; DIN lock backset
    forend: { length: 235, width: 24, millOversize: 1, depth: 4 },
    case: { depth: 85, height: 150, pocketWidth: 17, pocketDepth: 87, pocketHeight: 153 },   // pocket 87 x 153 = owner proposal, ZAŁOŻENIE
    euroCentres: 72, bathroomCentres: 78,
    caseTopAboveSpindle: 46.5,         // ZAŁOŻENIE from the macro expression lock_h + 46.5
    forendCentreBelowSpindle: 15,      // ZAŁOŻENIE from the macro expressions lock_h - 15
    spindleBore: 10, euroBore: 18, bathroomBore: 10,   // ZAŁOŻENIE (hole diameters for the drawings / export)
  },
  keep: {
    length: 175, width: 39, millOversize: 1,
    plateDepth: 3,                     // ZAŁOŻENIE
    pocket: { length: 120, width: 18, depth: 15 },   // ZAŁOŻENIE: one pocket for the latch and the bolt, centred on the plate
  },
  vp: {
    // ZAŁOŻENIE: the macro placement is not decoded; the sheets and the 3D put
    // the first pane top at topRail, the A/B pair styles midRail apart, the
    // nNo styles stackGap apart, centred across the leaf; the export sends the
    // style id and the macro places the cut. glassThickness 6 (fire and toughened).
    topRail: 150, midRail: 450, sideMargin: 150, stackGap: 100, cornerRadius: 6, beadFaces: 2, glassThickness: 6,
    // the macro VP_STYLE table, ids 1:1 (no style 3 in the macro). arrange:
    // 'none' | 'single' | 'stack' | 'diamond' | 'custom'; a stack takes its gap
    // from the vp key named in `gap`; style 2 lists its two different panes.
    styles: [
      { id: 0, label: 'None', w: 0, h: 0, count: 0, arrange: 'none' },
      { id: 1, label: '450mm Square', w: 450, h: 450, count: 1, arrange: 'single' },
      { id: 2, label: '150mm x 760mm/150mm x 450mm', w: 150, h: 760, count: 2, arrange: 'stack', gap: 'midRail', panes: [{ w: 150, h: 760 }, { w: 150, h: 450 }] },
      { id: 4, label: '150mm x 1410mm', w: 150, h: 1410, count: 1, arrange: 'single' },
      { id: 5, label: '350mm Diamond', w: 350, h: 350, count: 1, arrange: 'diamond' },
      { id: 6, label: '2No. 150mm 800mm', w: 150, h: 800, count: 2, arrange: 'stack', gap: 'stackGap' },
      { id: 7, label: '3No 200mm 450mm', w: 200, h: 450, count: 3, arrange: 'stack', gap: 'stackGap' },
      { id: 8, label: '5No 200mm 500mm', w: 200, h: 500, count: 5, arrange: 'stack', gap: 'stackGap' },
      { id: 9, label: '450mm x 700mm', w: 450, h: 700, count: 1, arrange: 'single' },
      { id: 10, label: '150mm x 760mm', w: 150, h: 760, count: 1, arrange: 'single' },
      { id: 11, label: '508mm x 1500mm', w: 508, h: 1500, count: 1, arrange: 'single' },
      { id: 12, label: '150mm x 700mm/150mm x 700mm', w: 150, h: 700, count: 2, arrange: 'stack', gap: 'midRail' },
      { id: 13, label: '5No 200mm 200mm', w: 200, h: 200, count: 5, arrange: 'stack', gap: 'stackGap' },
      { id: 14, label: 'Custom', w: 0, h: 0, count: 0, arrange: 'custom' },
    ],
  },
  intumescent: {
    // v1.1 (owner 27.10.2026 evening): ONE strip size, 15 x 4, all around (top
    // and both edges); the 15.5 x 4 groove is two passes of the 10 disk. FD30
    // takes one strip, FD60 two; a non-fire door none. The macro INTU_STYLE
    // table (styles 1 to 7, 10 / 20 strips) is gone from PC; the export still
    // writes INTU_STYLE for the Master_Door macro (macroStyleByStrips) next to
    // the plain INTU strip count.
    width: 15, thickness: 4,
    grooveWidth: 15.5, grooveDepth: 4,
    stripsByRating: { FD30: 1, FD60: 2 },
    macroStyleByStrips: { 1: 1, 2: 4 },   // Master_Door: 1 = "15mm x 4mm Intu Strip Lock Center", 4 = "2No 15mm x 4mm"
    // ZAŁOŻENIE: two strips sit LPZ / 2 +- this (centres 16 and 38 on a 54 FD60
    // leaf, the 15.5 grooves 6.5 apart). The macro's lpz / 2 +- 2.75 samples are
    // the two passes of the 10 saw that make ONE 15.5 groove, not two strips.
    twoStripOffset: 11,
  },
  // paint: the casement / door rule of calculations.js paintFromAreaSqm (per
  // 1.5 m2 2 L primer + 1 L topcoat) on the leaf both faces + the frame visible
  // faces (35 outside + 50 inside per member); mirrored in fireDoor.js
  bsuite: {
    // the target id is the folder of the uploaded programs (<tenant>/<targetId>/<key>/<file>): 'fd-machine',
    // not the casement's 'machine', so a same named upload of the two kinds never overwrites the other
    activeTarget: 'fd-machine',
    targets: [{
      id: 'fd-machine', name: 'Machine (Rover)',
      programs: {
        leaf:      { path: 'C:/Users/Xp600/Desktop/Biesse Piotr/FD_LEAF_MASTER_PIOTR.bSolid', panelId: 1001, panelName: 'P1001' },   // ZAŁOŻENIE path, editable
        head:      { path: '', panelId: 1001, panelName: 'P1001' },   // the 5-axis frame masters do not exist yet: empty = rows skipped with a message
        jambHinge: { path: '', panelId: 1001, panelName: 'P1001' },
        jambLock:  { path: '', panelId: 1001, panelName: 'P1001' },
      },
      writeExecutionParameters: false,
      executionParameters: { origin: 0, refCorner: 0, rotX: 0, rotY: 0, rotZ: 0, offsetX: 0, offsetY: 0, offsetZ: 0 },
    }],
    stopRows: true,                    // a StopWorklistItem between the leaf / head / hinge jamb / lock jamb blocks
    hand: { left: 0, right: 1 },       // ZAŁOŻENIE: macro HAND 0 = "Hinge left" of the form
    // the macro parameters a single door never changes (table 4.7 of the brief);
    // the D_* placement values are written from vp.topRail / midRail / sideMargin
    // (one source for the sheets and the export), these copies are the macro's own defaults
    macroDefaults: { SPINDLE: 1, KEEP_LEAF: 0, KEEP_STYLE_LEAF: 0, REBATE: 0, REBATE_STYLE: 1, SPY_ON: 0, SPY_H: 1450, LBOX: 0, L_BOX_H: 1000, DROP_CILL: 0, PREM_DOOR: 0, D_TOP_RAIL: 150, D_MID_RAIL: 450, D_SIDE_MARGIN: 150 },
  },
  // v1.1: no swing (an internal door is handed by its hinge side only; in / out
  // belongs to external doors) and no intumescent style; the closer is a kind:
  // 'none' | 'surface' (overhead, the standard fire door set) | 'builtin'
  // (concealed in the leaf top and the head; no machining until the owner's
  // component files arrive, BLOCKERS 35). closerFire applies to fire doors,
  // closerNonFire to DR doors, until the user picks one on the door.
  defaults: { fire: true, rating: 'FD30', hingeSide: 'left', lockType: 'latch', closerFire: 'surface', closerNonFire: 'none', vpStyle: 0, leadEdge: true, vpCustom: { length: 600, width: 150, count: 1, rail: 100, pos: 0 } },
});

export const FIREDOOR_CLOSER_KINDS = ['none', 'surface', 'builtin'];
export const FIREDOOR_CLOSER_LABELS = { none: 'None', surface: 'Surface closer', builtin: 'Built in closer' };

const FIREDOOR_BSUITE_KEYS = ['leaf', 'head', 'jambHinge', 'jambLock'];

/**
 * The fire door bSuite block merged over the default the way migrateBsuite does
 * for the casement: every stored target keeps what it carries (its uploaded
 * `stored` program entries included) and gains the missing keys; a copy
 * without targets takes the default target; the active target must exist.
 * A stored copy whose target is still called 'machine' (the id before 'fd-machine') keeps that id and stays active:
 * the id is only the key of its upload folder; an activeTarget no stored target carries falls back to the first.
 */
function migrateFireDoorBsuite(stored, D) {
  const defTarget = D.targets[0];
  const mergePrograms = (p) => Object.fromEntries(FIREDOOR_BSUITE_KEYS.map((k) => [k, { ...defTarget.programs[k], ...(p?.[k] || {}) }]));
  let targets;
  if (Array.isArray(stored?.targets) && stored.targets.length) {
    targets = stored.targets.map((t, i) => ({
      ...defTarget, ...t,
      id: t.id || `target-${i + 1}`,
      programs: mergePrograms(t.programs),
      executionParameters: { ...defTarget.executionParameters, ...(t.executionParameters || {}) },
    }));
  } else targets = D.targets.map((t) => ({ ...t, programs: mergePrograms(null), executionParameters: { ...t.executionParameters } }));
  const activeTarget = targets.some((t) => t.id === stored?.activeTarget) ? stored.activeTarget : targets[0].id;
  return {
    ...D, ...(stored || {}), targets, activeTarget,
    hand: { ...D.hand, ...(stored?.hand || {}) },
    macroDefaults: { ...D.macroDefaults, ...(stored?.macroDefaults || {}) },
  };
}

/** A styles table merged by id over the default: default order, a stored entry overrides its fields, extra stored ids follow. */
function mergeStylesById(defaults, stored) {
  if (!Array.isArray(stored) || !stored.length) return defaults.map((s) => ({ ...s }));
  const out = defaults.map((s) => ({ ...s, ...(stored.find((x) => x && Number(x.id) === s.id) || {}) }));
  for (const s of stored) if (s && !defaults.some((d) => d.id === Number(s.id))) out.push({ ...s, id: Number(s.id) });
  return out;
}

/**
 * Fire door profile migration: schema 1, block by block over the default (a
 * missing key takes the default, a stored one stays), ready for key moves. The
 * bsuite block goes through migrateFireDoorBsuite so a stored target keeps its
 * uploaded programs.
 */
export function migrateFireDoorProfile(profile) {
  if (!profile) return null;
  const D = DEFAULT_FIREDOOR_PROFILE;
  const P = profile;
  const list = (stored, def) => (Array.isArray(stored) ? stored.map(Number).filter((n) => Number.isFinite(n)) : [...def]);
  return {
    ...D, ...P,
    schema: D.schema,
    leaf: {
      ...D.leaf, ...(P.leaf || {}),
      widthSuggestions: list(P.leaf?.widthSuggestions, D.leaf.widthSuggestions),
      thicknessByRating: { ...D.leaf.thicknessByRating, ...(P.leaf?.thicknessByRating || {}) },
      limits: { ...D.leaf.limits, ...(P.leaf?.limits || {}) },
    },
    frame: { ...D.frame, ...(P.frame || {}), dowels: { ...D.frame.dowels, ...(P.frame?.dowels || {}) }, depthSuggestions: list(P.frame?.depthSuggestions, D.frame.depthSuggestions) },
    hinges: { ...D.hinges, ...(P.hinges || {}) },
    lock: {
      ...D.lock, ...(P.lock || {}),
      forend: { ...D.lock.forend, ...(P.lock?.forend || {}) },
      case: { ...D.lock.case, ...(P.lock?.case || {}) },
    },
    keep: { ...D.keep, ...(P.keep || {}), pocket: { ...D.keep.pocket, ...(P.keep?.pocket || {}) } },
    vp: { ...D.vp, ...(P.vp || {}), styles: mergeStylesById(D.vp.styles, P.vp?.styles) },
    intumescent: migrateFireDoorIntumescent(P.intumescent, D.intumescent),
    bsuite: migrateFireDoorBsuite(P.bsuite, D.bsuite),
    defaults: migrateFireDoorDefaults(P.defaults, D.defaults),
  };
}

/**
 * v1.1: the stored intumescent block loses the v1 `styles` table and
 * `grooveOversize` (one 15 x 4 strip all around, groove 15.5 x 4); the width,
 * thickness, groove and strips per rating merge over the default.
 */
function migrateFireDoorIntumescent(stored, D) {
  const { styles: _styles, grooveOversize: _oversize, ...rest } = stored || {};
  void _styles; void _oversize;
  return {
    ...D, ...rest,
    stripsByRating: { ...D.stripsByRating, ...(stored?.stripsByRating || {}) },
    macroStyleByStrips: { ...D.macroStyleByStrips, ...(stored?.macroStyleByStrips || {}) },
  };
}

/**
 * v1.1: the stored defaults lose `swing` and `intuStyle`; a v1 boolean-style
 * `closer` default (true = the old concealed closer) becomes closerFire.
 */
function migrateFireDoorDefaults(stored, D) {
  const { swing: _swing, intuStyle: _intu, closer: legacyCloser, ...rest } = stored || {};
  void _swing; void _intu;
  const out = { ...D, ...rest, vpCustom: { ...D.vpCustom, ...(stored?.vpCustom || {}) } };
  const storedFire = FIREDOOR_CLOSER_KINDS.includes(rest.closerFire) ? rest.closerFire : null;
  out.closerFire = storedFire || (legacyCloser === true ? 'builtin' : (legacyCloser === false ? 'none' : D.closerFire));
  if (!FIREDOOR_CLOSER_KINDS.includes(out.closerNonFire)) out.closerNonFire = D.closerNonFire;
  return out;
}

let activeFireDoorProfile = null;
// Pushed in by windowProfileStore (hydrate, cloud load, every edit); migrated on the way in.
export function setActiveFireDoorProfile(profile) {
  activeFireDoorProfile = profile ? migrateFireDoorProfile(profile) : null;
}
export function getFireDoorProfile() {
  return activeFireDoorProfile || DEFAULT_FIREDOOR_PROFILE;
}


/**
 * Schema migration for stored sash profiles (Supabase, localStorage cache,
 * batch _profileSnapshot). v1: deductions.sashHeight already "contained" the
 * meeting rail (calibrated at MR=43, total = H − 92). v2: sashHeight is the
 * pure opening deduction and the engine adds MR (total = H − 135 + MR).
 * Idempotent: v1 value += that profile's own meetingRail face, flag set.
 */
export function normalizeSashProfile(p) {
  if (!p || !p.deductions) return p;
  if (!p.glassMakeup) {
    p.glassMakeup = { ...DEFAULT_SASH_PROFILE.glassMakeup };
  }
  if (p.glassMakeup.acoustic == null) p.glassMakeup.acoustic = DEFAULT_SASH_PROFILE.glassMakeup.acoustic;   // 01.10: stored profiles predate the spec
  // v3: arched-sash block for stored profiles (no UI edits it yet)
  if (!p.sashArch) {
    p.sashArch = { ...DEFAULT_SASH_PROFILE.sashArch, limits: { ...DEFAULT_SASH_PROFILE.sashArch.limits } };
  }
  // 13.10.2026: the external mullion board width for stored copies that predate the key
  if (p.elements) {
    if (!p.elements.mullion) p.elements.mullion = { ...DEFAULT_SASH_PROFILE.elements.mullion };
    if (p.elements.mullion.extFace == null) p.elements.mullion.extFace = DEFAULT_SASH_PROFILE.elements.mullion.extFace;
  }
  if (p.dedSchema !== 2) {
    const mr = Number(p.elements?.meetingRail?.face) || DEFAULT_SASH_PROFILE.elements.meetingRail.face;
    p.deductions.sashHeight = (Number(p.deductions.sashHeight) || 0) + mr;
    p.dedSchema = 2;
  }
  return p;
}

/** Called by windowProfileStore whenever the persisted profile changes. */
export function setActiveWindowProfile(profile) {
  activeProfile = profile ? normalizeSashProfile(profile) : null;
}

/** The engine's single read point. Falls back to the OTD defaults. */
export function getWindowProfile() {
  return activeProfile || DEFAULT_SASH_PROFILE;
}

export function profileVariant(frameType) {
  const p = getWindowProfile();
  return p.variants[frameType] || p.variants.standard;
}

export function profileSashDepth(frameType) {
  return profileVariant(frameType).sashDepth;
}

export function profileBoxDepth(frameType) {
  return profileVariant(frameType).boxDepth;
}

/** Head/Jamb board width for a frame variant. boardWidth is authoritative;
 *  legacy persisted profiles without it fall back to depth − inset. */
export function profileBoardWidth(frameType) {
  const p = getWindowProfile();
  const v = p.variants[frameType] || p.variants.standard;
  return v.boardWidth ?? (v.boxDepth - (p.boardInset ?? 23));
}

/** Legacy helper (by depth) kept for old call sites. */
export function boardWidthForDepth(frameDepth) {
  const p = getWindowProfile();
  const depth = Number(frameDepth) || p.variants.standard.boxDepth;
  const v = Object.values(p.variants).find((x) => x.boxDepth === depth);
  if (v) return v.boardWidth ?? (v.boxDepth - (p.boardInset ?? 23));
  return depth - (p.boardInset ?? 23);
}

/**
 * Temporarily compute with frozen (batch snapshot) profiles.
 * withProfiles(sash, casement, door, partition, firedoor, fn), or the older
 * withProfiles(sash, casement, door, partition, fn), withProfiles(sash,
 * casement, door, fn) and withProfiles(sash, casement, fn): a function in
 * third, fourth or fifth place is the callback and the profiles not given
 * stay the live ones (a batch frozen before that kind had a snapshot).
 */
export function withProfiles(sashProfile, casementProfile, doorProfile, partitionProfile, fireDoorProfile, fn) {
  // withProfiles(sash, casement, door, partition, firedoor, fn) since 27.10.2026;
  // the older shapes (sash, casement, door, partition, fn), (sash, casement,
  // door, fn) and (sash, casement, fn) keep working
  if (typeof fireDoorProfile === 'function') { fn = fireDoorProfile; fireDoorProfile = null; }
  if (typeof partitionProfile === 'function') { fn = partitionProfile; partitionProfile = null; }
  if (typeof doorProfile === 'function') { fn = doorProfile; doorProfile = null; }
  const prevSash = activeProfile;
  const prevCas = activeCasementProfile;
  const prevDoor = activeDoorProfile;
  const prevPartition = activePartitionProfile;
  const prevFireDoor = activeFireDoorProfile;
  if (sashProfile) activeProfile = normalizeSashProfile(sashProfile);
  if (casementProfile) activeCasementProfile = migrateCasementProfile(casementProfile);
  if (doorProfile) activeDoorProfile = migrateDoorProfile(doorProfile);
  if (partitionProfile) activePartitionProfile = migratePartitionProfile(partitionProfile);
  if (fireDoorProfile) activeFireDoorProfile = migrateFireDoorProfile(fireDoorProfile);
  try { return fn(); } finally {
    activeProfile = prevSash;
    activeCasementProfile = prevCas;
    activeDoorProfile = prevDoor;
    activePartitionProfile = prevPartition;
    activeFireDoorProfile = prevFireDoor;
  }
}

/**
 * Raw stock for a finished sash section string like "47x90".
 * Matches by face width (second number) against the profile elements,
 * so any variant depth maps correctly (fixes the BR→63x63 regression).
 */
export function profileRawForSection(section) {
  const p = getWindowProfile();
  const face = Number(String(section).toLowerCase().split('x')[1]);
  if (!Number.isFinite(face)) return null;
  const els = p.elements;
  if (face === els.bottomRail.face) return els.bottomRail.raw;
  if (face === els.meetingRail.face) return els.meetingRail.raw;
  if (face === els.stiles.face) return els.stiles.raw;
  if (face === els.topRail.face) return els.topRail.raw;
  if (els.mullion && face === els.mullion.face) return els.mullion.raw;
  const c = getCasementProfile().elements;
  for (const el of Object.values(c)) {
    if (face === el.face) return el.raw;
  }
  return null;
}
