// ─── Cabinet construction profile ───
// Workshop-editable numbers that drive the engine: clearances, deductions,
// drill positions, the Skylon puzzle joint geometry and the drawer standard.
// Different workshops = different NUMBERS, never different formulas.
//
// The defaults below are the SKYLON profile, traced 1:1 from the production
// AutoLISP in reference/lisp/ (SKYLON_COMMON, KIT_BUD_FULL, KIT_WARDROBE_FULL).
// The active profile is pushed in by cabinetProfileStore (persisted per user);
// the engine always reads through getCabinetProfile() so plain-function code
// needs no React/store imports.
//
// RULE: formulas in cabinet.js read EXCLUSIVELY from this object. If you find a
// bare number in a formula, it belongs here.

export const PROFILE_SCHEMA = 1;

export const DEFAULT_CABINET_PROFILE = {
  schema: PROFILE_SCHEMA,
  id: 'skylon',
  label: 'Skylon Joinery',

  // ─── Material thicknesses ───
  board: {
    thickness: 18,                    // G — standard carcass board
    thicknessOptions: [18, 22],       // 22 = heavy
  },
  front: {
    thickness: 25,                    // 18 = MDF, 19 = melamine, 25 = shaker
    thicknessOptions: [18, 19, 25],
    types: {
      S: { label: 'Shaker', frameWidth: 50 },
      H: { label: 'Handleless (J-groove)', grooveDepth: 30 },
      F: { label: 'Flat' },
    },
    defaultType: 'S',
  },

  // ─── Carcass panel deductions ───
  // "Boards" = how many board thicknesses come off; "Clearance" = fixed mm.
  carcass: {
    sideDepthBoards: 1,        // side W = depth − 1×G          (back panel sits behind)
    topWidthBoards: 2,         // top/bottom W = width − 2×G    (between the sides)
    topDepthBoards: 1,         // top/bottom H = depth − 1×G
    backCoversFullFace: true,  // back = full width × full height
    shelfWidthBoards: 2,       // shelf W = width − 2×G − clearance
    shelfWidthClearance: 4,
    shelfDepthBoards: 1,       // shelf H = depth − 1×G − clearance
    shelfDepthClearance: 20,
    // ─── Turn 8 (CLAUDE.md F4) ───
    // The same 20 mm, for the pieces the AutoLISP cut FULL depth: a FIX shelf
    // and a partition. An adjustable shelf has stood 20 mm back from the face
    // since the LISP (the line above) and a joiner reads that gap as the front
    // of the cabinet; a partition flush with the face beside it reads as a
    // mistake, and it is the piece a hinge arm swings closest to.
    //
    // It is a DEFAULT, not a rule: every one of these pieces may be pulled out
    // to the face on its own (`front_mm` on the item, `partition_front_mm` on
    // the unit), because a partition under a worktop sometimes has to be.
    //
    // The TOP and BOTTOM stay full depth and are not in this: they carry the
    // puzzle joint, and shortening them is shortening the carcass.
    interiorSetback: 20,
  },

  // ─── Doors / fronts ───
  doors: {
    // 1 door while (width − widthDeduction) ≤ singleDoorMaxWidth → 2 doors from
    // width 705 mm (704 is still ONE door — BLOCKERS.md #2)
    widthDeduction: 4,
    singleDoorMaxWidth: 700,
    gap: 3,                    // overlay clearance: single front = (W−gap) × (H−gap)
    doubleTotalGap: 6,         // pair of fronts = ((W − doubleTotalGap)/2) × (H − gap)
    defaultHinge: 'L',
    // ─── How far a door opens in the 3D view (turn 8, CLAUDE.md F5) ───
    // `openAngle` is what a door in the middle of a run swings to when you
    // double-click it: a little past square, which is what a hinge does and
    // what makes the inside of the cabinet readable.
    //
    // `openAngleAtWall` is the answer when there is a WALL on the hinge side.
    // Past 90° a door starts to come BACK towards that wall — its free edge
    // crosses the hinge line — so a run of cabinets in a corner would animate
    // its end door straight through the plaster. Square is where it stops.
    // Neither number reaches the cut list; a swing is a picture.
    openAngle: 99,
    openAngleAtWall: 90,
  },

  // ─── Hinge drilling ───
  hinges: {
    holeDiameter: 5,
    holePairOffset: 16,        // 2 holes per centre at centre ± 16
    xFromFrontEdge: 37,        // measured from the FRONT edge of the side panel
    layer: 'HINGES_5MM',
    endOffset: 100,            // first/last hinge centre, from panel end
    // Hinge-count rules per unit family (SKYLON_COMMON calcHingePositions*)
    rules: {
      base: { mode: 'base', secondFromTop: 300 },                 // [100, H−300, H−100]
      tall: { mode: 'tall', sixHingeMinHeight: 1600, innerBelow: 3, innerAtOrAbove: 4 },
      low:  { mode: 'low', twoHingeMaxHeight: 800, threeHingeMaxHeight: 1200, innerAtOrAbove: 2 },
      // KIT_SINK L323: the top hinge drops 50 mm to clear the front holder.
      sink: { mode: 'sink', secondFromTop: 300, topFromTop: 150 },
    },
    // Hinge cups drilled in the front panel
    cups: {
      diameter: 35,
      xFromHingeEdge: 21.5,
      layer: 'FRONT_HINGES_35MM',
      screwDiameter: 3,
      screwOffsetX: 9.5,       // toward the door centre from the cup centre
      screwOffsetY: 23,        // one screw above, one below
      screwLayer: 'FRONT_HINGES_3MM',
      // Where the cups sit on the door. 'baseOffsets' = KIT_BUD_FULL, measured
      // on the (shorter) front panel; 'hingeCentres' = KIT_WARDROBE_FULL, which
      // passes the carcass hinge centres straight through.
      baseOffsets: { bottom: 100, upperFromTop: 297, topFromTop: 97 },
      // KIT_SINK L434 — the top cup follows its hinge 50 mm down the door.
      sinkOffsets: { bottom: 100, upperFromTop: 297, topFromTop: 147 },
    },
  },

  // ─── Shelf pin holes ───
  shelfHoles: {
    diameter: 7.5,
    clusterOffsets: [-50, 0, 50],   // 3 holes per row
    columnFromEdge: 70,             // x = 70 and panelWidth − 70
    pinsPerShelf: 4,                // one pin in each corner — the hardware count
    layer: 'SHELVES_7_5MM',
    // Row spacing is (H − 2×G)/(n+1) measured over the FULL carcass height,
    // even when a drawer stack occupies the bottom (KIT_WARDROBE_FULL v1
    // behaviour, recorded in golden-wardrobe.json → shelf_holes_quirk).
    spanMode: 'fullHeight',
    // When the UI supplies explicit shelf positions, drill the rows there
    // instead of on the even-spacing formula.
    followPositions: true,
  },

  // ─── Skylon puzzle joint (SKYLON_COMMON drawBUL / drawBUR / drawTOP_ROT90) ───
  puzzle: {
    tabCentresFromEnd: 95,     // outer tab centres; the third sits at mid-length
    tabHalfOpening: 19,        // half-width of the slot mouth at the edge
    tabHalfWidth: 25,          // half-width once past the shoulder
    shoulderDepth: 10.5,       // depth at which the slot widens
    dogboneHalfHeight: 30,     // relief pocket ± this around the tab centre
    socketHalfWidth: 25.5,     // socket pocket on the mating edge
    socketOvershoot: 6,        // pocket runs 6 mm past the panel edge
    socketHoleOffset: 24.5,    // 2 holes per socket at ± this
    socketHoleDiameter: 7.5,
    socketHoleInset: 1,        // holes sit 1 mm inside the pocket
    // ─── Turn 7 (CLAUDE.md F4 / BACKLOG #28) ───
    // Below this run length the two sockets COLLIDE, and one socket goes in the
    // middle instead. The AutoLISP never met this case — its kits are 558 and
    // 578 deep — so there is no LISP number to trace and the threshold is
    // DERIVED from the geometry above:
    //
    //   190    the two socket centres, `tabCentresFromEnd` (95) in from each end
    // + 56.5   each socket's own footprint across the run. Not the pocket:
    //          the HOLES are wider than it. ±max(socketHalfWidth 25.5,
    //          socketHoleOffset 24.5 + socketHoleDiameter/2 3.75) = ±28.25,
    //          and two of those halves is 56.5.
    // + 18     the minimum bridge — the narrowest web of board a cutter should
    //          be asked to leave standing between two pockets, which is one
    //          standard board thickness (board.thickness).
    // = 264.5
    //
    // A workshop on a different board or different sockets recomputes it the
    // same way; test/single-socket.test.js recomputes it on every run, so the
    // number and the reasoning cannot drift apart.
    singleSocketBelow: 264.5,
    // ─── Turn 8 (F0 / BLOCKERS #37 / BACKLOG #47) ───
    // The same family of problem on the OTHER axis. `tabCentres()` puts three
    // tabs down the back edge of a side panel — 95 in from each end and one in
    // the middle — and on a LOW carcass the middle one walks into the outer
    // ones. The tab itself is ±25, but the DOG BONE around it is ±30, and it is
    // the dog bone that has to clear:
    //
    //   190    the two outer centres, `tabCentresFromEnd` (95) in from each end
    // + 120    each outer tab's own footprint plus the middle tab's, both ends:
    //          2 × 2 × max(tabHalfWidth 25, dogboneHalfHeight 30) = 120
    // + 36     the minimum bridge, one board thickness on EACH side of the
    //          middle tab — there are two gaps to keep open here, not one
    // = 346
    //
    // Below this the middle tab is not cut and the panel has two, exactly as it
    // has two sockets below `singleSocketBelow`. `LOW_CABINET.minHeight` is 300,
    // so the case is reachable from the UI. test/low-tabs.test.js recomputes the
    // number on every run, so it and the reasoning cannot drift apart.
    middleTabBelow: 346,
    screwDiameter: 3,
    screwFromEnd: 50,          // screws at 50, mid, length−50
    centrelineExtra: 0.5,      // screw/socket centreline = G/2 + this
    layers: {
      outline: 'OUTLINE',
      socket: 'PUZZLE_SOCKET',
      dogbone: 'PUZZLE_DOG_BONES',
      socketHole: 'PUZZLE_HOLES_7_5MM',
      screw: 'SCREWS_3MM',
    },
  },

  // ─── Partition fixing: the biscuit set (turn 13, CLAUDE.md F8 / #59) ─────
  //
  // The owner's workshop truth, given as the reference pattern for a butt
  // joint: screw ⌀3 → 10 mm gap → biscuit mark 70 mm → 10 mm gap → screw ⌀3,
  // starting no closer than 50 mm from the element's edge, two sets up to
  // 700 mm wide and three above it. The arithmetic is engine/biscuits.js; every
  // number it uses is here, which is what lets a workshop with a different
  // cutter or a different habit change the pattern without touching code.
  biscuits: {
    markLength: 70,            // the biscuit mark itself
    markTool: 4,               // …cut with the owner's dedicated 4 mm in-and-out program
    gap: 10,                   // CLEAR space between a screw and the mark
    screwDiameter: 3,          // the same ⌀3 the rest of the carcass is screwed with
    edgeMin: 50,               // a set STARTS no closer than this to the edge — never less
    wideThreshold: 700,        // wider than this and a third set goes in the middle
    // How far in from the partition's END its half of the mark is drawn. The
    // joint's other half is an END and a flat bed cannot reach it, so what the
    // partition carries is the set-out transferred onto its face.
    markFromEnd: 20,
    layer: 'BISCUIT_4MM',      // the name is the tool mapping — never tidied up
    screwLayer: 'SCREWS_3MM',  // the turn-8 family, joined rather than duplicated
    // Where a through-screw is allowed: the receiving face must be CONCEALED.
    // A carcass top is under a worktop and a bottom is inside the plinth void;
    // a fixed shelf's faces are what you look at with the doors open, so a
    // partition landing on one takes the biscuit-only set.
    concealedReceivers: ['TOP', 'BOTTOM'],
  },

  // ─── Wardrobe specifics (KIT_WARDROBE_FULL constants, lines 498-508) ───
  wardrobe: {
    legHeight: 100,
    legsPerUnit: 4,
    minHeight: 1800,
    defaults: { width: 600, height: 2150, depth: 578, railOffset: 1400 },

    drawers: {
      maxCount: 6,
      setback: 50,             // drawer box sits 50 mm behind the carcass front
      frontHeight: 200,        // DEFAULT visible drawer front; each drawer may
                               // carry its own height_mm (SPEC / turn-2 task 4)
      minFrontHeight: 100,     // workshop limits on a per-drawer height; a value
      maxFrontHeight: 600,     // outside them is clamped with a warning
      // Drawer box side = front height − this. The LISP's fixed pair
      // (drawerFrontH 200, drawerSideH 164) is the special case 200 − 36; with
      // variable fronts the DELTA is the invariant, not the side height, so
      // that is what the profile carries.
      frontToSideDelta: 36,
      firstFrontAdjust: 3,     // bottom front is 3 mm shorter (clears the base)
      gap: 3,                  // gap between drawer fronts
      boxSideThickness: 18,
      boxWidthClearance: 10,   // box W = internal W − this − drawer-panel reduction
      frontOversize: 4,        // front W = box W + this (2 mm each side)
      boxFrontBoards: 4,       // box front/back length = W − 4×G − clearance − reduction
      boxFrontClearance: 10,
      boxFrontHeightDeduction: 15,   // box front H = box side H − 15 − G − 1
      boxFrontHeightExtra: 1,
      bottomOversize: 13,      // bottom W = box front length + this
      boxDropFromRunner: 9,    // box bottom sits this far below the runner row
      depthSteps: [390, 440, 490, 540, 590, 640, 690],   // runner standard
      // usable depth = depth − G − setback − frontThickness − depthAllowance
      depthAllowance: 20,
      partitionClearance: 5,   // partition sits 5 mm above the top drawer front
      zoneHeadroom: 200,       // drawer zone must leave this much above it
    },

    // Vertical panel that carries the runners on the hinge side
    drawerPanel: {
      inset: 30,               // distance from the carcass side
      fillerWidth: 30,         // filler closing the gap, 2 per drawer panel
      fillerFrontOffset: 40,   // filler set back from the drawer setback (top view)
      screwDepth: 99,          // attachment holes, from the front edge
      screwDiameter: 3,
    },

    runners: {
      firstRowFromBottom: 38,  // relative to the drawer-panel bottom
      holeXPattern: [37, 69, 293],   // measured from the front of the runner run
      holeDiameter: 3,
      layer: 'RUNNERS_3MM',
    },

    rail: {
      partitionAbove: 40,      // rail partitioner sits 40 mm above the rail
      topClearance: 50,        // rail partitioner must clear the top by this
      bracketScrewDiameter: 3,
    },
  },

  // ─── Base unit (kitchen) specifics ───
  baseUnit: {
    legHeight: 100,
    legsPerUnit: 4,
    defaults: { width: 600, height: 770, depth: 558 },
  },

  // ─── Project heights (turn 5, BACKLOG #29) ───
  // A workshop builds a whole KITCHEN to one set of heights, not each cabinet
  // to its own. These are where a new project starts; Design Settings ▸ Project
  // heights then owns them per project, and a unit inherits the one for its
  // height group (engine/types.js `heightGroup`). A unit may still be given its
  // own height — that is a deliberate exception and the panel marks it custom.
  //
  // The numbers are the SKYLON standard: 720 carcass base and wall units, 2150
  // tall, hung at 1500, on a 100 mm toe kick. They are separate from the
  // per-type `defaults` above, which stay what the AutoLISP kits ship with —
  // the kit default is the factory setting, this is the job.
  projectHeights: {
    base: 770,
    wall: 720,
    tall: 2150,
    wallMount: 1500,
    toeKick: 100,          // = legHeight; the plinth follows it
    // What a project height is allowed to be at all. Outside this the field is
    // clamped, exactly as every other millimetre field is.
    min: 100,
    max: 3000,
  },

  // ─── Project types (turn 7, CLAUDE.md F2 / BACKLOG #41) ───
  // What KIND of job this is. The type is picked once, on the second screen of
  // the new-project flow, and all it does is choose better starting points:
  // which Library category opens first, which scope is suggested, and — where
  // the workshop genuinely builds that kind of job to a different height —
  // which project heights it starts from.
  //
  // The heights are DELIBERATELY sparse. A kitchen is the Skylon standard, so
  // it overrides nothing; a type only appears here when there is a real reason
  // for it to differ, and the two that do are flagged in BLOCKERS for Piotr to
  // confirm against what the workshop actually builds. Everything is editable
  // in Design Settings the moment the project opens — this is a starting point,
  // not a rule.
  //
  // The LIST (order, labels, category, scope) is engine/projectTypes.js; the
  // millimetres are here, because millimetres are always here.
  projectTypes: {
    wardrobe: { heights: { tall: 2400 } },
    // A vanity carcass hangs or stands under a basin, and 770 + 100 legs + a
    // top is a worktop at 890 — too high for a bathroom.
    vanity: { heights: { base: 600 } },
  },

  // ─── Joinery (turn 7, CLAUDE.md F2) ───
  // HOW the carcass is held together. Today there is exactly one system and it
  // is the one the whole engine is traced from — the Skylon puzzle joint, tabs
  // and dog-bone relief pockets, `profile.puzzle` above. It is listed rather
  // than assumed so that the second system (dowels, CamLock, Lamello) is a
  // profile entry and a geometry module, not a rewrite of the settings screen.
  //
  // `geometryKey` names the block of numbers that system's geometry reads, so a
  // preview can draw a joint it has never heard of by looking there.
  joinery: {
    types: [
      {
        id: 'dogbone',
        label: 'Dog bones (Skylon puzzle)',
        hint: 'Tabs and dog-bone relief — the joint every AutoLISP kit is cut for',
        geometryKey: 'puzzle',
      },
    ],
    defaultType: 'dogbone',
  },

  // ─── What a PROJECT is set up with (turn 11, CLAUDE.md F9) ───────────────
  //
  // Step 5 of the new-project flow asks a workshop how it builds THIS job, and
  // every answer it offers is here: where a board comes from, how thick that
  // makes it, how many types of each are in play, and which variant of each
  // piece of ironmongery is fitted.
  //
  // The shape of it is the owner's: the user picks a SOURCE and a VARIANT, and
  // everything else — the thickness, the legs and clips under a plinth, the edge
  // banding — follows automatically from these numbers. That is what "the user
  // only ever picks a VARIANT" means, and it is why the automatic parts are
  // listed here rather than being decided in a component.
  projectSettings: {
    // A carcass board, and where it comes from. `thickness` is what that source
    // IS: an EGGER decor board is 18, and a sprayed carcass is 18 of MDF.
    // ─── Turn 15 (CLAUDE.md F3) ───
    // `picker` is WHICH QUESTION this source asks, and it is data because the
    // owner's verdict was that the app kept asking the wrong one: a veneer
    // front offered a RAL palette. A source names its own picker, so adding a
    // fifth source is a line here and not a branch in a component.
    //   'decor'  → the 85-EGGER picker
    //   'veneer' → the veneer collection (engine/veneers.js)
    //   'colour' → the RAL / F&B / custom colour picker
    //   null     → nothing to pick yet (the wood range is a later turn)
    carcassSources: [
      { id: 'egger', label: 'EGGER decor', thickness: 18, kind: 'decor', picker: 'decor' },
      { id: 'sprayed', label: 'Sprayed', thickness: 18, kind: 'spray', picker: 'colour' },
      // Owner, turn 15 F3.3: a carcass can be veneered too, from the SAME
      // collection the fronts pick from — and 19 mm is pinned by the source
      // exactly the way an EGGER board pins 18.
      { id: 'veneer', label: 'Veneer', thickness: 19, kind: 'board', picker: 'veneer' },
    ],
    // A front. The two sprayed systems are the colour ranges a workshop orders
    // by name; veneer is the one that is genuinely a different thickness.
    frontSources: [
      // Owner, 09.08: ONE spray source. RAL vs Farrow & Ball is a choice the
      // COLOUR PICKER offers underneath (it always has), not a source button —
      // two buttons here made the same finish look like two finishes.
      { id: 'spray', label: 'Spray', thickness: 18, kind: 'spray', picker: 'colour' },
      // Turn 15 (CLAUDE.md F3.2): a veneer front picks a TIMBER, not a paint.
      { id: 'veneer', label: 'Veneer', thickness: 19, kind: 'board', picker: 'veneer' },
      // …and a laminate front picks a DECOR — the same 85-EGGER picker the
      // carcass has used since turn 5 (F3.1). It was offering RAL palettes,
      // which is a paint range for a board that is never painted.
      { id: 'laminate', label: 'Laminate', thickness: 18, kind: 'board', picker: 'decor' },
      // The wood RANGE is a later turn's (CLAUDE.md F9.2 says so in as many
      // words: "wood colour range comes later — leave the option present,
      // colours coming soon"). The option is real; the colours are not yet.
      { id: 'wood', label: 'Wood', thickness: 20, kind: 'board', coloursSoon: true, picker: null },
    ],
    // The selector beside the automatic thickness. "Other" is not in the list —
    // it is the absence of a choice from it, and the number is then typed.
    boardThicknessOptions: [18, 22, 25],
    maxCarcassTypes: 3,
    maxFrontTypes: 2,
    // The ironmongery. Every one of these is FITTED AUTOMATICALLY — the plinth
    // gets its legs, bases and clips, a door gets its hinges, a drawer gets its
    // runners, a wall unit gets its handles, and every cut edge that shows gets
    // its banding. The only question a user is ever asked is which VARIANT, and
    // `automat` names what the automatic then picks the concrete item from.
    hardware: {
      plinth: { label: 'Plinth', fits: ['legs', 'bases', 'clips'], automat: 'legs' },
      hinges: {
        label: 'Hinges',
        variants: [
          { id: 'soft-close', label: 'Soft-close' },
          { id: 'standard', label: 'Standard' },
        ],
        default: 'soft-close',
        automat: 'hinge',
      },
      runners: {
        label: 'Runners',
        variants: [
          { id: 'soft-close', label: 'Soft-close' },
          { id: 'push-open', label: 'Push-open' },
        ],
        default: 'soft-close',
        automat: 'runner',
      },
      handles: {
        label: 'Handles',
        hint: 'Wall units',
        variants: [
          { id: 'j-pull', label: 'J-pull' },
          { id: 'bar', label: 'Bar' },
          { id: 'none', label: 'Handleless' },
        ],
        default: 'j-pull',
        automat: 'handle',
      },
      edgeBanding: { label: 'Edge banding', auto: 'Matched to each material', automat: 'edge' },
    },
  },

  // ─── What goes INSIDE a unit of this kind (turn 11, CLAUDE.md F4.4) ───
  //
  // "Add items" used to offer the same four things to every cabinet, so a
  // kitchen base unit was asked whether it wanted a hanging rail and a wardrobe
  // was not offered a cargo. What a workshop actually fits depends on what the
  // cabinet IS, and that is DATA — keyed on the type's own `family`
  // (engine/types.js), listed in the order a joiner reaches for them.
  //
  // It is a FILTER AND NEVER A BLOCK. The panel puts a "Show all" under the
  // list, and everything the KIT supports is still one click away: this decides
  // what is offered first, not what is possible. A cabinet that supports a thing
  // the list for its family does not mention is still a cabinet that can have
  // one, and the workshop that fits hanging rails in its pantries changes four
  // characters here rather than arguing with a component.
  itemsByContext: {
    kitchen: ['shelves', 'drawers', 'partition', 'cargo', 'bins'],
    wardrobe: ['shelves', 'hanger', 'drawers', 'partition', 'pulldown'],
    // Anything whose family is not listed. Deliberately the plain furniture
    // answer rather than a union of the two.
    default: ['shelves', 'drawers', 'partition'],
  },

  // ─── Legs (shared rule for every standing type) ───
  // Four in the corners; over `extraLegOverWidth` a FIFTH goes in the
  // geometric centre of the footprint (Piotr, turn 3). The AutoLISP only ever
  // draws a PAIR in the elevation view (drawLegPair, legW 78 inset by G) and
  // carries no leg drilling at all, so nothing here emits holes — this is the
  // hardware count and the 3D placement.
  legs: {
    cornerCount: 4,
    extraLegOverWidth: 1000,
    width: 78,              // LISP drawLegPair legW
    insetFromSide: null,    // null = one board thickness, as the LISP does
    insetFromFront: 50,
    insetFromBack: 50,
  },

  // ─── Wall unit (KIT_WUD_FULL) ───
  wallUnit: {
    defaults: { width: 600, height: 720, depth: 400, mountHeight: 1500 },
    doorExtend: 38,          // handleless grab edge: front runs this far below
    hangers: {
      count: 2,
      holeDiameter: 5,
      fromBackEdge: [21, 53],  // two holes per side panel
      fromTop: 53,
      layer: 'HINGES_5MM',
      // Cut-outs in the back panel, both top corners
      cutoutWidth: 30,
      cutoutHeight: 58,
      cutoutLayer: 'HANGER_HOLE',
    },
  },

  // ─── Tall unit (KIT_BUDTALL_FULL) ───
  tallUnit: {
    minHeight: 1100,
    defaults: { width: 600, height: 2100, depth: 558 },
  },

  // ─── Low cabinet (KIT_LOW_CABINET_FULL) ───
  lowCabinet: {
    minHeight: 300,
    defaults: { width: 600, height: 600, depth: 578, railOffset: 200 },
  },

  // ─── Base drawer unit, 3 drawers 4:3:2 (KIT_BUDR_FULL) ───
  baseDrawerUnit: {
    defaults: { width: 600, height: 770, depth: 558 },
    ratio: [4, 3, 2],           // front heights split of (H − stackGaps)
    // ─── The drawer-unit variants (turn 12, CLAUDE.md F3.2) ───
    //
    // "Drawer unit — expandable group: 1× (drawerline), 2×, 3× (today's BUDR),
    // 4×. Derive them from the EXISTING BUD/BUDR mathematics … parameterised by
    // count/heights; NO new joint formulas."
    //
    // And that is all a variant is: a RATIO. Every other number in this block —
    // the box side ratio, the runner rows, the front width deduction, the screw
    // positions — is already written per front rather than per unit, so 2 and 4
    // fronts run through KIT_BUDR_FULL's arithmetic unchanged. `x3` repeats the
    // kit's own 4:3:2 and is what BUDR has always used; it is listed so that the
    // group reads as four of one thing rather than three plus an exception.
    //
    // 1× is DISABLED, and deliberately: a drawer over a DOOR needs a door of
    // partial height, and no kit in reference/lisp defines one — the hinge rule
    // (`hinges.rules.base`) measures its centres from the carcass, and mapping
    // them onto a shorter front is exactly the "inventing" CLAUDE.md F3.2
    // forbids. It is held open here with the reason attached (BLOCKERS #63).
    variants: [
      {
        id: 'x1',
        label: '1×',
        count: 1,
        hint: 'Drawerline — one drawer over a door',
        ratio: null,
        enabled: false,
        soon: 'No kit defines a partial-height door yet — the pattern comes first',
      },
      // `exact` — does the last front take up whatever the rounding left, so
      // that the stack fills the carcass exactly? The kit's own 4:3:2 says NO
      // and is frozen there by rule 7 (see BLOCKERS #64 and the note on
      // cabinet.js `budrFrontHeights`); the variants turn 12 adds say YES,
      // because four equal fronts standing 2 mm proud of the carcass is not
      // something to ship on purpose.
      {
        id: 'x2',
        label: '2×',
        count: 2,
        hint: 'Two equal deep drawers',
        ratio: [1, 1],
        exact: true,
        enabled: true,
      },
      {
        id: 'x3',
        label: '3×',
        count: 3,
        hint: 'The workshop standard — 4:3:2',
        ratio: [4, 3, 2],
        exact: false,
        enabled: true,
      },
      {
        id: 'x4',
        label: '4×',
        count: 4,
        hint: 'Four equal drawers',
        ratio: [1, 1, 1, 1],
        exact: true,
        enabled: true,
      },
    ],
    gap: 3,                     // between fronts, and the top clearance
    frontWidthDeduction: 3,     // front W = W − 3 (overlay, like a single door)
    sideRatio: 0.7,             // box side height = round(0.7 × front height)
    boxWidthClearance: 10,      // box W = internal W − 10
    boxFrontBoards: 4,          // box front/back length = W − 4G − 10
    boxFrontClearance: 10,
    boxFrontHeightDeduction: 15,
    boxFrontHeightExtra: 1,
    bottomOversize: 13,
    depthAllowance: 20,         // usable depth = D − G − 20 (NOT the wardrobe rule)
    firstRowFromBottom: 38,     // runner row above each front's base
    frontScrewFromSide: 50,     // + 2×G + halfDiameter, see cabinet.js
    frontScrewExtra: 3.5,
    frontScrewFromBottom: 96.5, // + G on the bottom drawer
    frontScrewDiameter: 3,
    frontScrewLayer: 'FRONT_HINGES_3MM',
    boxScrewFromEdge: 50,
    bottomScrewFromSide: 70,
    bottomScrewFromEnd: 9,
    runnerPocketWidth: 15,      // DRAWER_RUNNER_POCKET strip on the box side
    bottomPocketExtra: 1,       // DRAWER_BOTTOM_POCKET strip = G + 1 wide
    pocketOvershoot: 10,
  },

  // ─── Sink base (KIT_SINK) ───
  sinkUnit: {
    defaults: { width: 600, height: 770, depth: 558 },
    railHeight: 100,            // two holders on edge instead of a TOP panel
    backSetback: 50,            // back panel sits this far forward, inside
    backHeightDeduction: 120,   // back H = H − 120 − G
    backWidthClearance: 4,      // back W = W − 2G − 4
    backScrewFromBackEdge: 37,
    backScrewFromEnd: 100,
    holderScrewFromTop: [30, 70],
    shelfBackColumnFromEdge: 120,  // shelf pin back column (not the usual 70)
  },

  // ─── Fridge housing (KIT_FRIDGE) ───
  fridgeUnit: {
    minHeight: 1900,
    defaults: { width: 600, height: 2100, depth: 558, fridgeH: 1786 },
    railHeight: 200,            // the two back strips
    spursFromFront: 100,
    spursWidthClearance: 8,
    blockSize: 25,              // 25 × 25 wood blocks carrying the spurs panel
    blockScrewFromFront: 100,
    blockScrewOffsets: [37.5, 87.5],
    blockScrewFromTop: 50,
    fixedScrewFromEnd: 50,
  },

  // ─── Construction automatics (turn 3, phase 7) ───
  // Parts nobody draws by hand: the plinth under a run of units, the scribe
  // filler between a unit and the wall, and the panel that closes the gap
  // between a unit and the ceiling. They are cut pieces like any other — they
  // go in the BOM and on the CNC sheet — so their numbers live here.
  autoParts: {
    plinth: {
      enabled: true,
      // height: null = the unit's own leg height, so raising the legs raises
      // the plinth with them instead of leaving a gap.
      height: null,
      setback: 50,          // recessed from the front face (toe kick)
      thickness: null,      // null = the unit's board thickness
    },
    topInfill: {
      defaultHeight: 40,    // the visible face; "40" is what a workshop says
      minHeight: 10,
      thickness: null,
      // ─── Turn 6 (CLAUDE.md F4 / BACKLOG #20) ───
      // The top infill is an L in section: a face strip standing on the units
      // and a shelf running back off the top of it, the two mitred at 45° and
      // glued. `shelfDepth` is the horizontal leg. It is what stops the piece
      // reading as a flap of board stuck to the front of a run — and it is what
      // the joiner actually screws to the ceiling or the wall.
      shelfDepth: 80,
      // How close two units have to stand to be ONE run. The clamp lands them
      // edge to edge, so this only absorbs the 0.5 mm grid.
      runGap: 1,
      // The open end turns the corner and runs back to the wall (the fourth of
      // the four end conditions). This is the shortest return worth making;
      // below it the mitre is longer than the piece.
      minReturn: 60,
    },
    sideInfill: {
      // ─── Turn 11 (CLAUDE.md F5.2) ───
      // What a NEW project's infill width starts at, and therefore how far from
      // the wall a unit parks. Owner verdict: 40, not the 20 turn 3 shipped —
      // 20 mm of board is a strip that flexes and a gap you cannot get a screw
      // into, and every job was being retyped to 40 on the first day.
      //
      // It lives here rather than in engine/design.js because it is a NUMBER
      // (CLAUDE.md rule 2); the DESIGN still owns the per-project value, and
      // this is what it starts from.
      defaultWidth: 40,
      // The width comes from Design Settings (project level). This is the
      // widest gap the workshop will close with a scribe filler at all — a
      // 200 mm "filler" is a cabinet, not a scribe.
      //
      // A PINNED filler (turn 11, CLAUDE.md F5.1) is deliberately not held to
      // it: pinning is a joiner saying "there IS a piece here and it is this
      // wide", and CLAUDE.md asks for it to stretch past 100 mm on demand.
      maxWidth: 120,
      minWidth: 3,
      thickness: null,
      // ─── Turn 6 (CLAUDE.md F4) ───
      // The vertical filler is an L too: arm B closes the gap in the plane of
      // the doors, arm A is screwed to the carcass side and runs back. This is
      // how far back — enough to take two screws, not so far it fouls a hinge.
      returnDepth: 60,
      // An L only fits when the gap is wider than the board it is made of.
      // Under that the piece stays a plain scribe strip, which is what a
      // workshop would cut anyway for a 12 mm gap.
      minLWidth: 24,
      // Turn 4 (BACKLOG #15): the unit STOPS one infill width from the wall, and
      // the filler appears when it is parked there. This is how much slop counts
      // as "parked at the stop" — the clamp lands it exactly, so 1 mm is plenty
      // and a unit sitting out in the room grows no filler at all.
      stopTolerance: 1,
    },
    endPanel: {
      // A masking panel screwed to the outside of a carcass side. Manual, like
      // the plinth: it exists when somebody adds it (BACKLOG #17).
      // `thickness: null` = the project's front thickness, which is what a
      // workshop means by "same as the doors".
      thickness: null,
      defaultHeight: 'floor',       // 'floor' | 'carcass' ('unit' is the old name)
      // ─── Turn 13 (CLAUDE.md F4) ───
      // The owner's bug: a WALL unit's end panel ran to the FLOOR — a masking
      // panel hanging in mid-air down the wall under a cabinet that stops at
      // 2100. The verdict is that it ends flush with the hanging cabinet's
      // bottom, so the DEFAULT is per unit class rather than per project.
      //
      // 'carcass' means "ends with the cabinet". The fourth value the slot is
      // shaped for is 'extended' — the door/panel EXTENSION below a wall unit,
      // parked as BACKLOG #45 — which is why this is a table of classes and not
      // a boolean: when the extension lands, a wall unit opts into it by name
      // and nothing about the data has to change shape.
      defaultHeightByMount: { wall: 'carcass', floor: 'floor' },
    },
    // ─── The bottom masking panel (turn 14, CLAUDE.md F5 / BACKLOG #45) ─────
    //
    // The panel under a run of WALL units. The two numbers it needs are here
    // for the reason every number is: a workshop that cuts it from 12 mm rather
    // than from the door board changes one line.
    //
    // `depthExtra` is the ten millimetres the piece exists for — every cabinet
    // in this app stands `room.wallBackClearance` off the wall, and a panel cut
    // to the carcass depth would stop at the edge of that slot instead of
    // hiding it. It is written as its OWN number rather than read straight off
    // `room.wallBackClearance` at the panel-building site because they are two
    // decisions that happen to agree today: one is how far a cabinet stands off
    // a bowed wall, the other is how far past the carcass this board reaches.
    mask: {
      enabled: true,
      thickness: null,      // null = the project's FRONT thickness (F5.2)
      depthExtra: null,     // null = the wall standoff, which is what F5 asks for
    },
  },

  // ─── Appearance (turn 4, BACKLOG #4–#6) ───
  // What the furniture LOOKS like. Not one number of it reaches the cut list —
  // but it is still workshop configuration ("our carcass board is broken
  // white"), so it lives here with every other number rather than as literals
  // scattered through the 3D view.
  appearance: {
    // The finishes a project can pick from. `colour` is a painted/melamine
    // board; `decor` is a wood decor whose image is generated by
    // scripts/gen-textures.mjs (no downloaded artwork — BACKLOG #19).
    finishes: [
      { id: 'broken_white', label: 'Broken white', kind: 'colour', hex: '#F2F0EC' },
      { id: 'light_grey', label: 'Light grey', kind: 'colour', hex: '#E8E8E6' },
      {
        id: 'dark_walnut', label: 'Dark walnut', kind: 'decor',
        hex: '#6B4A32', texture: 'textures/dark-walnut.png', repeatMm: 900,
      },
      {
        id: 'light_oak', label: 'Light oak', kind: 'decor',
        hex: '#C9A87C', texture: 'textures/light-oak.png', repeatMm: 900,
      },
    ],
    defaultCarcassFinish: 'broken_white',
    // null = the fronts are whatever the carcass is, which is what a workshop
    // means by "same material throughout".
    defaultFrontFinish: null,
    // Thin BLACK contours — an edges pass, not the old thick brown lines.
    //
    // ─── Turn 15 (CLAUDE.md F2): AND THEY WIN THE DEPTH WAR ───
    // The owner: "the outer contour is crisp, the interior edges vanish". They
    // do, and it is not a colour problem. An edge line INSIDE a cabinet lies
    // exactly ON a neighbouring panel's face — a shelf's front arris is in the
    // plane of the side panel it butts into — so line and face are at the same
    // depth and the winner is whichever the GPU rasterises last. Outside the
    // cabinet there is nothing behind the line, so the silhouette was always
    // crisp; that is the tell.
    //
    // The textbook fix is `polygonOffset` on the FILL: every panel face is
    // pushed a hair back in the depth buffer, so a line lying on it is nearer
    // the camera and always wins. It moves nothing in the scene — only what the
    // depth test believes — so no dimension, no cut and no fixture is touched.
    //
    // `factor` scales with the polygon's slope (it is what makes a face seen
    // nearly edge-on offset more, which is exactly where the fight is worst)
    // and `units` is a flat push in depth-buffer steps. 1 and 1 is the
    // conventional starting pair and is enough here — bigger numbers start to
    // show as bleed-through at silhouette edges, which is the artefact this
    // must not trade for.
    outline: {
      colour: '#1A1A1A',
      width: 1,
      threshold: 12,
      polygonOffset: { factor: 1, units: 1 },
    },
    // ~20 % sheen: a hint of clear coat over a matt board. Not plastic.
    // Kept as the fallback a piece takes when it belongs to no finish family.
    sheen: { roughness: 0.55, clearcoat: 0.2, clearcoatRoughness: 0.35, metalness: 0.0 },

    // ─── The sheen SCALE (turn 8; corrected turn 9, CLAUDE.md F5) ───
    // A lacquer is specified as a PERCENTAGE of gloss, and that is the number a
    // sprayer, a paint supplier and a customer all already use: 5 % is dead
    // matt, 100 % is full gloss, in fives. Turn 8 ran a 0–25 scale, which is the
    // same information in a language the industry does not speak — and it had a
    // 0 on it, which nothing is. There is no such thing as a lacquer with no
    // sheen at all; the flattest one anybody sells is a 5.
    //
    //     roughness = 1 − sheen / 100
    //
    // 60 is the default: a two-pack satin at roughness 0.4. It is turn 8's own
    // default (15) on the new scale, which is what the migration multiplies
    // every stored value by — engine/design.js `migrateDesign`.
    sheenScale: { min: 5, max: 100, step: 5, default: 60 },

    // ─── Sprayed surfaces (turn 8, CLAUDE.md F1) ───
    // The Spraying philosophy, in three numbers: A SPRAYED COLOUR IS THE COLOUR.
    // Nothing in the room may tint it, so the environment probe is switched OFF
    // for a sprayed piece — a white lacquer door that picks up the walnut carcass
    // beside it is not white any more, and a client matching a RAL chip against
    // the screen is being lied to. What is left is the surface itself: the fine
    // orange peel a gun leaves, done on the normals at a tenth of the strength
    // the board edges use.
    // `peelMm` is the size of one orange-peel cell — the gun leaves a texture
    // between about one and three millimetres, and it is the reason a sprayed
    // white door does not read as a white rectangle even in flat light.
    // ─── Sprayed surfaces (turn 8, CLAUDE.md F1; amended hotfix 08.08) ───
    // The Spraying philosophy stands: A SPRAYED COLOUR IS THE COLOUR. Turn 8
    // enforced it by switching the environment probe fully OFF — and that was
    // one caution too many. The probe here is three's RoomEnvironment: a
    // SYNTHETIC neutral grey studio, not a capture of the scene, so a white
    // door cannot pick up the walnut carcass beside it — walnut is simply not
    // in the map. What intensity 0 actually removed was every reflection the
    // clearcoat had to work with, and with it the gloss the sheen slider is
    // supposed to drive. 0.25 of a neutral studio reads as lacquer and shifts
    // a RAL chip by nothing a spray booth could measure.
    //
    // normalScale 0 (hotfix 08.08, earlier the same day): the peel was a
    // procedural sine at ~2 mm, per fragment — 1–2 px per period on screen,
    // below Nyquist, and a shader sin() has no mipmaps. It aliased into the
    // shimmering moiré Piotr filmed. bevel.js now band-limits it by pixel
    // footprint, so turning it back up can no longer stripe; Spraying-Calc
    // gets the same effect the other correct way, as a mipmapped TEXTURE.
    spray: { envMapIntensity: 0.25, normalScale: 0, metalness: 0, peelMm: 2 },

    // ─── Manufacturer decor textures (turn 8, Piotr 07.08) ───
    // The full-board scans that ship with the decor pack (`tex` in the JSON).
    // `scanHeightMm` is what one image is worth on a real board — the scan is a
    // full sheet along the grain — so a 720 mm door shows the part of the board
    // it would be cut from instead of a repeat that reads as wallpaper.
    decor: { scanHeightMm: 2800, anisotropy: 8 },

    // ─── The studio rig (turn 8, CLAUDE.md F1 — from Spraying-Calc) ───
    // Turn 7's answer to "the white walls must stay white" was an ambient at
    // 1.25 with a key at 0.85, and Piotr's verdict on it is the reason this
    // block exists: "no shadow, no depth, white runs into white". A light that
    // is weaker than the fill it is meant to beat cannot model anything.
    //
    // So the balance is inverted to the one a photographer uses, and it is the
    // SAME rig in the working view and in a still: what the joiner is looking at
    // while he works is what the customer will be shown. ACES holds the
    // highlights at both ends of it.
    //
    // `shadowPadding` is room millimetres of margin around the furniture: the
    // key light's shadow camera is fitted to the CABINETS rather than to the
    // room, so every texel of the map lands on something that casts a shadow
    // instead of on four metres of empty floor.
    //
    // ─── Turn 9 (CLAUDE.md F1): THE STRIPES, AND WHY THE FILL WENT UP ───
    // Piotr's report was diagonal stripes across the fronts, in the working view
    // and in a 4K still alike. That is SHADOW ACNE — a surface shadowing itself
    // because the depth it is compared against was sampled at texel centres that
    // do not line up with it — and turn 8 had three of the four classic causes
    // at once: a shadow frustum spanning the whole run at 1024 px (~5 mm per
    // texel on a 4 m kitchen), no `normalBias` at all, and a render preset that
    // raised the map size while LOWERING the bias.
    //
    // The map size and the two bias numbers are in `render.shadow` below, where
    // the rest of the shadow settings live. What belongs HERE is the fourth
    // cause, which is a lighting decision rather than a shadow one: ambient 0.2
    // against key 1.0 makes every band of acne a high-contrast band, and the
    // clearcoat on a lacquered door doubles it.
    //
    // Prime-Sash-Windows is the reference for the target look, and its answer is
    // the one adopted here: flood the scene with fill so the colour reads bright
    // and clean from every angle, keep exactly ONE shadow-casting light, and
    // ground the object with a soft contact blob. The key stays 1.0 and stays
    // the only caster — the modelling turn 8 bought is not being given back —
    // but the flat light under it is raised so that what the key leaves in
    // shadow is still a colour rather than a hole.
    //
    // ─── Turn 10 (CLAUDE.md F1/F3): THE JUPITERS, AND WHY THE AMBIENT CAME DOWN ──
    // Piotr's verdict on turn 9 plus the hotfix day was "realism gone": the room
    // was one white blur, the fronts read as flat matt, and there was no
    // travelling highlight to be found. Two numbers here are the answer.
    //
    // The first is the AMBIENT. 0.45 of light from every direction at once is
    // 0.45 of the frame that no light can shape and no shadow can darken; on a
    // white wall in front of a white floor it is most of what you see. It drops
    // to 0.20 and the energy moves to the hemisphere (which at least has a top
    // and a bottom) and to the new spots (which have a POOL and a falloff). The
    // wall gets a gradient instead of a value: measured over a hundred columns
    // of the working view, top of wall to skirting, it went from 0.004 of
    // luminance (which is nothing, and is what "one white blur" means
    // arithmetically) to 0.023 (verify/t10/measurements.json).
    //
    // The second is `spots` below — the studio jupiters Piotr asked for by name.
    studio: {
      ambient: 0.2,
      key: 1.0,
      fill: 0.55,
      rim: 0.3,
      exposure: 1.0,
      shadowPadding: 600,
      // ─── The shadow budget (turn 10, CLAUDE.md F1.4) ───
      // At most this many lights in the whole rig own a shadow map. It is a
      // COST rule, and the working view is where the cost is felt: every caster
      // is a full extra depth pass over the furniture, every frame the scene is
      // dirty. Two is the ceiling; the rig ships with one.
      //
      // `keyCastsShadow` is the other half of the decision CLAUDE.md F1.4 asks
      // to be made BY LOOKING, and it was: the key keeps the shadow and the
      // spots do not. A spot hung in the upper front corner throws its shadow
      // down and BACKWARDS — straight under the carcass and into the wall,
      // where the cabinet itself already hides it — so it buys a depth pass and
      // shows almost nothing. The key comes in from the front quarter and lays
      // its shadow ACROSS the open floor beside the run, which is the one place
      // it can be seen. Screenshots of both are in verify/t10.
      shadowCasters: 2,
      keyCastsShadow: true,
      // ─── The sky and the floor (turn 9, CLAUDE.md F1) ───
      // An ambient light is one number in every direction, which is the one
      // thing real light never is: in a room the light from above is warm
      // daylight or a warm lamp, and the light from below has bounced off a
      // floor and carries the floor's colour. A hemisphere costs the same as an
      // ambient — no shadow map, no extra pass — and it is what stops a raised
      // fill from reading as fog.
      //
      // `sky` is a warm off-white (a room with the lights on), `ground` is the
      // warm grey a timber or a screed floor bounces back. It casts NOTHING:
      // the key is still the only shadow in the scene.
      //
      // Turn 10 takes it DOWN with the ambient, 0.5 to 0.45, but by a quarter
      // of the ambient's share: what matters is the ratio between the light
      // that has a direction and the light that has none, and that has moved
      // from 0.45 : 0.50 to 0.20 : 0.45. The room is no darker to look at — the
      // floor still reads 0.90 of white — it simply has somewhere left to go.
      hemisphere: { sky: '#fdf6e8', ground: '#c8c0b0', intensity: 0.45 },

      // ─── The jupiters (turn 10, CLAUDE.md F1) ───
      //
      // Piotr described the light he wants in the language of the trade: two
      // studio spots hung in the UPPER FRONT CORNERS, aimed roughly 45° DOWN
      // across the furniture, and "maybe a second one lower". Turn 9's point
      // lights were the wrong instrument for that — a point light has no
      // direction at all, so it lights the ceiling, the back wall and the floor
      // as happily as the doors, and there is no pool for the wall to show.
      //
      // A spot has a cone, and the cone is what buys BOTH of this turn's
      // complaints at once: the pool it throws on the wall behind the run is the
      // vertical gradient that stops the room reading as one white blur (F3),
      // and its hotspot on a lacquered door TRAVELS as the camera orbits, which
      // is what the eye reads as gloss (F4.B).
      //
      // THE GEOMETRY. `x/y/z` are fractions of the rig's own distance from the
      // furniture's centre — the same convention the key, the fill, the rim and
      // the points use — so the rig scales with the job instead of being tuned
      // for one kitchen. The aim is always the fit centre, so the angle below
      // the horizon is atan(y / hypot(x, z)): at (±0.50, 0.62, 0.40) that is
      // atan(0.62 / 0.64) = 44.1°, which is Piotr's "~45° w dół" to within the
      // precision the phrase carries.
      //
      // THE INTENSITIES ARE PHYSICAL (three r0.180, decay 2, candela-like): the
      // light fades with distance SQUARED, and these hang ~0.88 of the rig
      // distance out, so the useful numbers are an order up from a directional's.
      // 38 at 3.9 m is ~2.5 of irradiance at the centre of the pool, which is
      // the key's own order. The bracket was measured rather than guessed: at 0
      // the wall has no gradient at all, at 300 the fronts blow out to pink
      // (rgb 228,113,120 against a RAL 3005 that is 135,48,57) and the white
      // carcass picks up 0.29 of chroma. See verify/t10/measurements.json.
      //
      // The pair is UNEQUAL — 38 and 32 — because a rig of two identical lights
      // at mirrored positions is a rig with no key side, and a run lit dead
      // evenly from both front corners has no modelling across its length.
      //
      // `angle` is the half-angle of the cone in radians; `penumbra` is how much
      // of it is soft edge. 0.68 means the hard core is the inner third and
      // everything outside it is gradient, which is what a real softbox does
      // and what makes the wall pool read as light rather than as a circle.
      // Tightening the cone instead (angle 0.55) was tried and rejected: it
      // sharpens the pool but cuts the floor in front of the run out of it, and
      // the toe shadow lost two thirds of its contrast.
      //
      // IT IS AN ARRAY BY DESIGN. Piotr tunes the COUNT and the numbers here
      // without anybody touching a component: a third, lower spot is four lines
      // in this file. It ships with two — the F4 loop found the third one only
      // ever fought the first two for the same wall, and what it was really
      // asking for was more penumbra on the pair.
      // The COLOURS are barely warm on purpose. The hotfix's #fff6ea reads as
      // tungsten and, poured over a broken-white carcass at this strength, took
      // it to 0.11 of chroma — a white board that is visibly cream is a white
      // board a client will query. At #fffaf0 the same measurement is 0.015,
      // against the board's own 0.024: warm light, white board.
      spots: [
        {
          x: 0.5, y: 0.62, z: 0.4, intensity: 38, angle: 0.62, penumbra: 0.68,
          colour: '#fffaf0', castShadow: false,
        },
        {
          x: -0.5, y: 0.62, z: 0.4, intensity: 32, angle: 0.62, penumbra: 0.73,
          colour: '#fff8f2', castShadow: false,
        },
      ],
      // Falloff limit as a multiple of the rig distance, for the spots as well
      // as the points; decay stays physical inside it. It is ALSO the spot
      // shadow camera's far plane, because three takes `light.distance` for it
      // (SpotLightShadow.updateMatrices) — read there before it was relied on.
      spotReach: 4,
      // ─── The glints: EMPTY, and that is the finding (turn 10, F1.5) ───
      //
      // PSW's gloss was never an environment map — its painted wood has none.
      // It is close sources whose hotspots TRAVEL across a panel as the camera
      // orbits; that movement is what the eye reads as lacquer, and the 08.08
      // hotfix bought it with four point lights.
      //
      // CLAUDE.md F1.5 asked whether the spots could take that job over, and
      // said to decide it by running the orbit. It was run both ways. With the
      // four points, with the two viewer-side ones, and with none at all, the
      // highlight patch on a sheen-90 door lands in the same three places along
      // the orbit at the same strength — (0.77, 0.19) ×1.11, (0.88, 0.21) ×1.19,
      // (0.88, 0.30) ×1.12 with the array empty, against ×1.11 / ×1.20 / ×1.13
      // with it full. The travelling glint was never the points' doing: it is
      // the spots' hotspot plus the 0.25 environment probe, and the points were
      // two more lights per fragment for a difference in the second decimal.
      //
      // So the array ships EMPTY and the structure stays, which is the whole
      // point of it being data: a workshop that wants a fifth source types one
      // line. Kept as an example rather than deleted, so the shape is obvious.
      // Intensities are PHYSICAL (three r0.180, decay 2, candela-like) — a
      // point light fades with distance SQUARED, so a working value at ~5 m is
      // in the tens; 0.9 would be invisible and 45 blows the scene out. `x/y/z`
      // are fractions of the rig distance, as everywhere else in this block.
      //
      //   points: [
      //     { x:  0.60, y: 0.45, z: 0.85, intensity: 9, colour: '#fff8f0' },
      //     { x: -0.60, y: 0.45, z: 0.85, intensity: 9, colour: '#fff4e8' },
      //   ],
      //
      // ─── TURN 14 (CLAUDE.md F9): THE EYE-LEVEL PAIR, AND `yMm` ─────────────
      //
      // The owner's finding, and it is a geometric one rather than a taste one:
      // the gloss reads only at STEEP angles, because every strong light in the
      // rig is high. A specular highlight is the mirror of the source, so a
      // source at 3 m and a viewer at 1.65 m can only meet on a vertical door
      // when the viewer is looking up at it — which is not how anybody looks at
      // a kitchen. Turn 10 was right that the SPOTS carry the travelling glint;
      // it measured that from an orbit that was mostly above the furniture.
      //
      // So the pair is a pair of EYES, and that is why `yMm` exists. Every other
      // position in this block is a fraction of the rig distance, which is
      // correct for a studio rig — it scales with the subject. An eye does not:
      // a joiner standing in a 2 m vanity and a joiner standing in a 6 m kitchen
      // both have their eyes at 1650. So `yMm` is an ABSOLUTE height above the
      // floor in millimetres and OVERRIDES `y` where it is given; x and z stay
      // rig-distance fractions, so the pair still opens out with the job.
      //
      // The numbers are the owner's own starting values (F9.1) and he will turn
      // them. Intensities are PHYSICAL — decay 2, so a point light fades with
      // distance squared and a working value at a few metres is in the teens.
      // NO SHADOWS: the caster budget (`shadowCasters`) is untouched, and a
      // point light casting one would be six depth passes for a cube map.
      points: [
        {
          x: 0.35, yMm: 1650, z: 0.7, intensity: 12, colour: '#fff6ec',
        },
        {
          x: -0.35, yMm: 1650, z: 0.7, intensity: 12, colour: '#fff3e4',
        },
        // ─── Turn 16: THE LOW PAIR (the owner's own request) ───
        // The eye-level pair lights what is at eye level. Below the worktop a
        // base unit's doors were falling away into the floor's shadow, because
        // the only light reaching them arrives at a glancing angle from 1650 and
        // there is no bounce off a floor the rig does not really light.
        //
        // So: the same pair again, at 500 — the height of a door's middle on a
        // base unit — and at HALF the intensity, which is what "not so strong,
        // just enough to throw a glow" asks for. A point light is spherical
        // already; softness here is a matter of how hard it lands, and 6 at a
        // couple of metres is a wash rather than a hot spot. Still no shadows,
        // for the same reason as the pair above: the caster budget is spent.
        {
          x: 0.35, yMm: 500, z: 0.7, intensity: 6, colour: '#fff6ec',
        },
        {
          x: -0.35, yMm: 500, z: 0.7, intensity: 6, colour: '#fff3e4',
        },
      ],
      // Falloff limit as a multiple of the rig distance; decay stays physical.
      pointReach: 4,
      // ─── The bounce the rig cannot produce ───
      // A three-light studio rig is built for a subject on a seamless backdrop.
      // Point it at a ROOM and the walls come out grey, because most of what
      // lights a real wall is light that has already bounced off the floor, the
      // ceiling and the wall opposite — and a directional light has no bounce.
      //
      // Turn 7 answered that with an ambient at 1.25, which lit the walls and
      // flattened the furniture with them. This is the same answer aimed only
      // where it belongs: the ROOM's own surfaces carry this fraction of their
      // colour as emission. The furniture sees the studio rig and nothing else,
      // so the modelling on a white door is untouched and the wall behind it is
      // still white.
      //
      // ─── Turn 10: THIS NUMBER IS WHY THE FLOOR SHADOW WAS BARELY THERE ───
      // Emission is ADDED after the lighting, so it is the one part of a
      // surface's brightness that no shadow can take away. At 0.42 the floor
      // carried 42 % of itself as light a shadow map cannot touch — and the
      // contact blob, which is alpha over the top, was fighting it too. The
      // walls still want it (they are lit by nothing else); the floor does not.
      // So it is now a per-surface number in `appearance.room.bounce` and this
      // one is the fallback a profile saved before turn 10 falls back to.
      roomBounce: 0.42,
    },

    // ─── PBR per finish family (turn 6, CLAUDE.md F2) ───
    // Turn 4 gave every piece the same 20 % sheen, which is why a melamine
    // carcass and a sprayed door looked like the same material with two
    // colours. They are not the same material and a client can see it: melamine
    // is a matt foil with a wide, soft highlight; two-pack lacquer is a thin
    // clear film over colour, with a tighter one you can read the room in.
    //
    // Which family a piece is in is NOT a list of panel ids — it is the
    // finish_exposed flag the engine already sets (BACKLOG #35): the pieces
    // that go to the spray booth get lacquer, everything else is board.
    materials: {
      melamine: { roughness: 0.58, clearcoat: 0.0, clearcoatRoughness: 0.4, metalness: 0.0 },
      lacquer: { roughness: 0.3, clearcoat: 0.35, clearcoatRoughness: 0.12, metalness: 0.0 },
    },

    // ─── Edge break (turn 6) ───
    // A real board edge is not a mathematical corner: the saw and the edge
    // bander leave 0.5–1 mm of break that catches the light, and its absence is
    // most of what makes a CG cabinet read as CG. Done on the NORMALS, in the
    // shader — a mesh dense enough to model it would cost the whole frame rate
    // for something under a millimetre wide (BACKLOG #37 says so explicitly).
    //
    // `ao` is the same trick used for the other half of the problem: panels
    // meeting panels should darken slightly where they meet. `strength` is what
    // the working view carries, `render` is what a render carries.
    bevel: {
      mm: 0.8,
      strength: 1.0,
      ao: { mm: 7, strength: 0.16, render: 0.3 },
    },

    // The room the furniture is lit BY. RoomEnvironment (three/examples, no
    // download, no .hdr file — CLAUDE.md forbids both) through PMREM. The
    // working view keeps it low so white walls stay white with no tone mapping;
    // a render turns it up and lets ACES hold the highlights.
    // ─── Turn 8 (CLAUDE.md F1) ───
    // The two intensities are now the SAME, and that is the whole of "one rig".
    // Turn 6 turned the probe up for a still because the working view ran flat
    // and untone-mapped and needed the still to compensate; the working view is
    // tone-mapped now, and a probe turned up on top of the studio key washes out
    // exactly the modelling the key is there to put in.
    //
    // Kept as two numbers rather than collapsed to one: a workshop that wants a
    // glossier still has the knob, and the render pass still reads it.
    environment: { intensity: 0.5, renderIntensity: 0.5, blur: 0.05 },

    // ─── Contact shadow (turn 6; rebuilt turn 9, CLAUDE.md F1.3) ───
    // The dark that says a cabinet is STANDING on the floor rather than hovering
    // a millimetre above it. The key light cannot give you one: it comes in from
    // off to the side, so its shadow lands BESIDE the unit and the floor between
    // the legs stays as bright as the open room.
    //
    // Turn 6 answered that with one hand-painted quad per unit. Turn 9 replaces
    // it with drei's <ContactShadows>, fitted to the whole run from the same
    // furniture bounds the key light's frustum uses — because the thing that
    // reads as wrong is not one cabinet floating, it is a RUN floating, and a
    // per-unit blob leaves a bright seam at every joint between two of them.
    // It is rendered ONCE per layout change (`frames={1}` plus a React key), so
    // orbiting costs nothing: the price is paid when the furniture moves.
    //
    //   opacity  how dark the blob is under the carcass.
    //   blur     how far the edge of it is smeared. A room has no point source
    //            in it, so a contact shadow has no hard edge either.
    //   farMm    how high above the floor the shadow camera still sees. Past
    //            this, nothing contributes — so a wall unit hanging at 1500 mm
    //            does not print a second blob on the floor under it.
    //
    // ─── Turn 10 (CLAUDE.md F2) ───
    // The blob was invisible on main for a reason that had nothing to do with
    // these three numbers — drei multiplies width/height by its `scale` prop,
    // whose DEFAULT is 10, so a 1.8 m run was being baked onto an 18 m canvas
    // (3d/Scene.jsx FloorShadow carries the fix and the note). With the bake
    // finally landing where the furniture is, these could be tuned by looking
    // at it rather than in the dark:
    //
    //   opacity 0.5 → 0.62. The room is brighter than turn 9's and the floor's
    //   own emission is down (studio.roomBounce → appearance.room.bounce), so
    //   the blob has to do more of the work and can afford to.
    //   farMm 400 → 300. 400 mm reached up past the plinth and into the carcass
    //   sides, which smeared the dark out into a soft pool a hand's width wider
    //   than the furniture. 300 keeps it hugging the legs, which is the whole
    //   point of a CONTACT shadow.
    //
    // …and `blur` is gone, replaced by numbers that mean something:
    //
    //   blurMm         how far the edge of the shadow is smeared, IN
    //                  MILLIMETRES. drei's own `blur` is in UV units — a
    //                  fraction of the canvas — so the same number is twice the
    //                  softness on half a canvas, and the canvas size now
    //                  depends on where in the room the furniture is standing.
    //                  Turn 9's 2.5 over a 1.8 m bake was 18 mm; 22 is that,
    //                  a touch softer, and it stays 22 on a six-metre kitchen.
    //   texelMm        how much floor one texel of the bake is worth. The bake
    //                  is centred on the room (3d/Scene.jsx FloorShadow says
    //                  why), so its canvas grows with the room and the
    //                  RESOLUTION has to grow with it or a leg stops being
    //                  resolved — which is exactly what turn 9's accidental
    //                  18 m canvas did.
    //   maxResolution  the ceiling on that. 1024² RGBA is 4 MB, allocated
    //                  twice by drei and paid for on a layout change, never per
    //                  frame. A 4 m room lands at 1024 and 4.1 mm per texel,
    //                  which is turn 9's intended density to within a whisker.
    contactShadow: {
      opacity: 0.62, farMm: 300, blurMm: 22, texelMm: 4, maxResolution: 1024,
    },

    // ─── The room's own three tones (turn 10, CLAUDE.md F3) ───
    //
    // The complaint this answers is one sentence long: "the back wall and the
    // floor melt into one white blur". They did, and it was not subtle — the
    // wall was #ffffff, the floor #f2f0ec and the background #fafaf8, which is
    // three values inside 5 % of each other, and then both room surfaces
    // carried 42 % of themselves as emission on top of a 0.45 ambient. There
    // was nothing left for a junction to be made of.
    //
    // So: THREE DISTINGUISHABLE VALUES, warm as they go down. The background is
    // the lightest (it is the sky above the walls and it must not read as a
    // surface), the wall sits a step under it, and the floor is a clear step
    // darker AND warmer — a floor is timber, screed or tile, and none of them
    // is the colour of paint. Subtle by intent: this is a workshop tool and not
    // a showroom render, so the steps are ~4 % and ~9 % of luminance, which is
    // enough for an edge and not enough to look art-directed.
    //
    // `bounce` is the emission fraction per surface (Room.jsx `bounce`), split
    // out of `studio.roomBounce` this turn — and both halves come DOWN, because
    // emission is the part of a surface that no light shapes and no shadow
    // darkens, and turn 9 was carrying 0.42 of the room as exactly that.
    //
    // The wall's 0.42 → 0.18 is what buys criterion C: with 42 % of the wall
    // nailed to a constant, the spot pool had 58 % of a tone-mapped near-white
    // to work in and produced 0.004 of gradient over a hundred columns. At 0.18
    // the same pool produces 0.023, and the wall still reads 0.78 of white —
    // which is a white wall in a photograph, not a grey one. The floor's
    // 0.16 → 0.10 is the same argument for criterion A: the floor is the one
    // surface in the scene whose whole job this turn is to RECEIVE a shadow,
    // and emission is precisely the light a shadow cannot take away.
    room: {
      wall: '#f7f5f1',
      floor: '#e6e0d5',
      background: '#fafaf8',
      bounce: { wall: 0.18, floor: 0.1 },
      // How far the room's own surfaces stand BELOW the furniture datum, so the
      // contact shadow's bake camera — which must sit at the world origin at
      // floor level, looking up — cannot see the floor, and so the blob is a
      // hair proud of it instead of z-fighting. Half a millimetre: the app's
      // finest unit, and a quarter of a pixel at the closest the orbit goes.
      // The whole room moves, not just the floor, so the junction stays sealed.
      floorOffsetMm: 0.5,
    },
    // Presentation mode (View ▸ Contour): the material fades out, the contour
    // stays. Changes nothing in the BOM.
    contour: { opacity: 0.06, hex: '#ffffff', outline: '#101010' },
    // A shade off the base finish, so a drawer box and a back panel read as
    // separate pieces inside an open carcass instead of one flat mass.
    shade: { drawer_box: 0.1, back: 0.07, plinth: 0.04, infill: 0.02, end_panel: 0.02 },
    // Parts that are not a "finish" at all.
    // Parts that are not a "finish" at all. `hinge` is turn 11's (CLAUDE.md
    // F3.5): a hinge is drawn in SOLID now, not only in X-ray, and on a broken
    // white door a bright bracket grey reads as a smudge. This is the tone of
    // the nickel-plated body a workshop actually screws in — dark enough to be
    // an object, quiet enough not to be a diagram.
    hardware: {
      rail: '#8d8d92', leg: '#4a4a4a', bracket: '#8d8d92', hinge: '#5b5f63',
      // ─── Turn 13 (CLAUDE.md F7) ───
      // Are the hinge bodies drawn in SOLID, without switching to X-ray? Yes,
      // and the owner's verdict is that the switch now exists to HIDE them.
      //
      // It is a profile number rather than a `true` in the ui store because it
      // is workshop configuration like every other appearance answer here
      // (rule 2) — a shop that wants a clean working view sets it once instead
      // of asking every joiner to find the toggle.
      showInSolid: true,
    },

    // ─── Which ink the dimensions are written in (turn 11, CLAUDE.md F1.5) ──
    // Owner verdict: RED by default, with the drawing-office navy as the option
    // — the reverse of turn 5, which had it the other way round because that is
    // what a paper drawing does. On a screen, over furniture, red is the one
    // that reads at a glance and cannot be mistaken for a part.
    //
    // These are KEYS into `profile.dimensions.colours`, which is where the two
    // hexes live: one home for the colour, one for the choice. `alt` is what
    // View ▸ Dimension colour offers as the other one, so a workshop that adds
    // a third ink to `colours` decides here which two are on the menu by
    // default without touching a component.
    dimensions: { colour: 'red', alt: 'navy' },

    // ─── The joint, drawn (turn 8, CLAUDE.md F8) ───
    // The joint is the identity of the system, and a carcass that shows none is
    // six boxes meeting at nothing. Two answers to two questions:
    //
    //   `solid` — the division lines a tab leaves where a side meets a wieniec.
    //   Quiet: a shade off the board, not a diagram drawn on the furniture.
    //
    //   the rest — X-ray, where the question is "how is this held together" and
    //   the answer may be as loud as it needs to be. One colour per kind, so a
    //   socket and the relief pocket beside it are not one shape.
    joinery: {
      solid: '#8f8a82',
      solidOpacity: 0.5,
      // Near-black for the tab PROFILE: it is a cut line, it has to read
      // against a panel at a fifth of its opacity, and it must not be mistaken
      // for the selection mark — which is a mid blue and a dashed box, and was
      // exactly what a blue profile line looked like.
      outline: '#2A2A2A',
      socket: '#B4783C',
      dogbone: '#8C182B',
      // ─── Turn 13 (CLAUDE.md F8): the partition's fixing ───
      // The biscuit MARK and the ⌀3 screws that flank it, drawn in X-ray so a
      // joiner can see the set-out on the furniture and not only on the sheet.
      // The mark takes the same warm tone its DXF layer has in the CNC preview,
      // so the same thing is the same colour in both places; the screws take a
      // cooler one, because a set is three things and has to read as three.
      biscuit: '#E08A3C',
      screw: '#3D7F9C',
      // Off the face, in mm. The same trick and the same reason as the edge
      // handle's (3d/EdgeHandle.jsx): a line drawn ON a surface is a coin toss
      // per pixel per frame.
      lift: 0.4,
    },

    // ─── X-ray (turn 7, CLAUDE.md F3 / BACKLOG #42) ───
    // Look THROUGH the furniture: the board goes translucent, the contours
    // stay, and the hardware the workshop has to buy appears where it is
    // fitted. Two opacities, not one, and the difference is the whole trick —
    // a front stays readable as a front (it is the face of the cabinet) while
    // the carcass fades far enough back to see a hinge through it.
    xray: { carcass: 0.2, front: 0.42 },

    // ─── Selection (turn 6, CLAUDE.md F5) ───
    // Turn 4 drew the selected unit's own edges in the app's gold. Two things
    // were wrong with that. The gold is the FURNITURE's colour — a brass
    // handle, a bronze frame — so a selected cabinet read as a cabinet made of
    // something else; and drawing the piece's own outline meant the selection
    // was a property of the object rather than a mark on top of it.
    //
    // What replaces it is what a CAD package draws: a thin DASHED box in the
    // drawing-office navy, standing clear of the solid, following its bounding
    // box and not its geometry. Nothing about it can be mistaken for a part.
    // `offset` is in millimetres of ROOM, so the gap stays 10 mm of furniture
    // whatever the camera is doing.
    selection: {
      // ─── Turn 8 (CLAUDE.md F2.5) ───
      // It WAS the dimension arrows' navy (#1B2A4A). On paper that is a colour;
      // on a screen, one pixel wide against a dark canvas, it is black — Piotr
      // could not tell a selected cabinet from an unselected one. The mark is a
      // legible mid blue now, and thinner, because a mark you can see does not
      // need to be heavy. The ARROWS keep the navy: they are a drawing.
      colour: '#2B6CB0',
      width: 0.75,
      offset: 10,               // clear of the solid — CLAUDE.md asks for 8–12
      dash: 34,
      gap: 20,
      // ─── Turn 14 (CLAUDE.md F1.4) ───
      // `hoverOpacity` is GONE, and the absence is the setting. Turn 6 drew
      // this same mark a second time and quieter under the cursor; the owner's
      // verdict after living with it is that in a room full of cabinets a mark
      // that appears without being asked for stops saying "this one" and starts
      // saying "the mouse is somewhere". Highlight is what a CLICK does.
    },

    // ─── The two pluses (turn 11, CLAUDE.md F4.3) ───
    // They ask different questions and must not look alike. The RUN plus stands
    // in the gap at the end of a run and means "another CABINET here"; the INNER
    // plus stands in the middle of the selected cabinet and means "something
    // inside THIS one". Piotr asked for the second in a different colour, and he
    // is right for a reason worth writing down: two identical discs a hand's
    // width apart, one of which adds a wardrobe and one of which adds a shelf,
    // is a mistake waiting for a Friday afternoon.
    //
    // `run` is the app's selection blue, which is where it started; `inner` is
    // the app's gold, the colour every other "this is the thing you are working
    // on" mark in the app already wears.
    addPlus: { run: '#2B6CB0', inner: '#C9A227' },
  },

  // ─── Render (turn 6, CLAUDE.md F2 / BACKLOG #37) ───
  // An OUTPUT setting, like the CNC sheet metrics below: what size the picture
  // is, what lens it is taken with, how good the shadows are. The maths that
  // uses them is engine/render.js; the 3D layer only points a camera.
  render: {
    resolutions: [
      { id: 'preview', label: '1080p preview', long: 1920, hint: 'Quick look, a second or two' },
      { id: '4k', label: '4K', long: 3840, hint: '3840 px on the longer side — print and proposals' },
    ],
    defaultResolution: 'preview',
    // Shadow map size and softness. `high` is a render-only cost: twice the map
    // in each direction is four times the pixels, and the working view must not
    // pay for it (CLAUDE.md: heavy things ONLY in the render).
    //
    // ─── Turn 9 (CLAUDE.md F1): THE THREE NUMBERS THAT KILL THE STRIPES ───
    //
    //   mapSize    how many texels the key light's frustum is divided into. The
    //              frustum is fitted to the FURNITURE (studio.shadowPadding), so
    //              on a 4 m run 1024 was ~5 mm per texel — wider than the gap
    //              between two cabinets. 2048 halves that for the working view;
    //              a render doubles it again.
    //
    //   bias       a flat depth offset. It fixes acne and buys peter-panning
    //              (the shadow detaching from the foot of the thing casting it)
    //              — so it is kept SMALL and the work is done by normalBias.
    //              Turn 8's render preset had it at −0.00018 against the working
    //              view's −0.0006: the 4K still was the LEAST biased picture in
    //              the app, which is exactly why the stripes survived at 4K.
    //              It scales the other way now: a bigger map needs less bias.
    //
    //   normalBias the modern fix, and the one turn 8 did not have at all. It
    //              moves the shadow lookup along the surface NORMAL rather than
    //              along the light, so a flat panel stops sampling its own depth
    //              without the whole shadow sliding. In world units — 0.02 is
    //              20 mm at the working view's texel size, 0.01 at the render's
    //              finer one, because a finer map needs less of it.
    shadow: {
      normal: {
        label: 'Normal', mapSize: 2048, radius: 4, bias: -0.0002, normalBias: 0.02,
      },
      high: {
        label: 'High', mapSize: 4096, radius: 7, bias: -0.0001, normalBias: 0.01,
      },
    },
    defaultShadows: 'normal',
    // A 35 mm lens on full frame: 37.8° vertical. Wide enough to take a run of
    // units in without the barrel distortion of a 24, close enough to keep the
    // perspective an interior photograph has.
    focalMm: 35,
    sensorHeightMm: 24,
    // Air around the subject. 1.0 = the furniture touches the frame edge; the
    // framing fits the box's own corners, so this is real breathing room and
    // not slack in the fit.
    margin: 1.1,
    // ─── Turn 8 (CLAUDE.md F1) ───
    // The exposure the STUDIO RIG is balanced at — `appearance.studio.exposure`
    // — and no longer a second number for the still. Turn 7 ran the working view
    // flat and untone-mapped and had to raise the exposure to compensate when
    // ACES came in for a render; the working view is tone-mapped now, so there
    // is nothing left to compensate for.
    exposure: 1.0,
    // …and for the same reason there is nothing left to rebalance. Turn 7 lit
    // the editor one way and the still another, which meant a joiner could not
    // judge from the screen what the customer would be sent. The rig is one rig
    // now (3d/Scene.jsx Lights), so these are all 1 and the render's contrast
    // comes from the same key light the editor is showing.
    //
    // Kept as a block rather than deleted: a workshop that wants a punchier
    // still than its working view has the knob, and the render pass still reads
    // it. It just has nothing to say by default.
    //
    // `spot` joins them in turn 10 with the jupiters (CLAUDE.md F1.6). The
    // capture loop skips a role it does not recognise, so the rig would have
    // worked without it — but a knob that exists for four of the five lights
    // and silently not for the fifth is a trap, not a saving.
    lightScale: {
      ambient: 1, key: 1, fill: 1, rim: 1, point: 1, spot: 1,
    },
  },

  // ─── Bought hardware, to catalogue size (turn 7, CLAUDE.md F1/F3) ───
  // Not `appearance.hardware` — that one is COLOURS. This is the CATALOGUE: the
  // millimetres of the things a workshop buys rather than cuts, so the top view
  // can draw a hinge and the X-ray can model one from the same numbers.
  //
  // Nothing here reaches the cutting list. The engine still decides HOW MANY of
  // each and WHERE (result.hardware + result.drillSummary); this only says what
  // one of them looks like. A workshop on a different hinge system changes these
  // numbers and both the drawing and the 3D follow.
  hardware: {
    // A 35 mm cup hinge (the Blum/Hettich standard the drilling in `hinges`
    // above is already dimensioned for — cup ⌀35, 12.5 deep, cup centre 21.5 in
    // from the door edge).
    hinge: {
      cupDiameter: 35,
      cupDepth: 12.5,
      bossHeight: 16,        // the cup body standing proud of the door's back face
      armLength: 62,         // cup centre → the far end of the arm, along the depth
      armWidth: 22,          // across the door's height
      armThickness: 11,
      plateLength: 56,       // mounting plate on the carcass side, front to back
      plateWidth: 34,
      plateThickness: 12,
    },
    // A side-mounted runner pair: two L-profiles, one on the box and one on the
    // carcass, at the runner rows the engine drills. `length` comes from
    // result.hardware ('runner_pairs' → spec.length_mm), never from here.
    runner: {
      profileHeight: 45,     // the visible face of the profile
      profileThickness: 12.5, // how far it stands off the panel it is screwed to
      flangeDepth: 6,        // the return of the L
    },
    // An adjustable leg: a plate, a stem and a foot.
    leg: {
      plateThickness: 4,     // the plate screwed under the carcass; its footprint
                             // is profile.legs.width (78), from the LISP
      stemDiameter: 26,
      footDiameter: 48,
      footHeight: 8,
    },
    // The hanging rail. The 3D drew a ⌀30 tube with the number written into the
    // mesh; it lives here now, with everything else that is bought and not cut.
    rail: { diameter: 30 },
  },

  // ─── Technical drawings (turn 6, CLAUDE.md F7; turn 7, F1) ───
  // The sheet metrics for a printed elevation: what scales the workshop draws
  // at, how big the text is, and the title block that makes a printout read as
  // a drawing rather than a screenshot. Paper millimetres unless noted.
  drawings: {
    // A drawing is at 1:10 or 1:20 — never at 1:13.7. The largest that fits
    // wins, so a 600 mm base unit comes out at 1:5 and a 3.6 m run at 1:20.
    scales: [5, 10, 20, 25, 50],
    margin: 8,             // border, in from the paper edge
    padding: 6,            // inside the border, before the drawing may start
    // In DRAWING millimetres — these are scaled down with the geometry, then
    // held at minTextHeight so a label never becomes a smudge.
    unitNumberHeight: 120,
    textHeight: 90,
    dimensionOffset: 140,
    // …and this is paper millimetres: the floor under all of it.
    minTextHeight: 2.4,
    titleBlock: {
      rows: ['CABINET CORE', 'Project', 'Unit', 'View', 'Scale', 'Date'],
      width: 74,
      rowHeight: 6.5,
      labelWidth: 20,
      labelHeight: 2.5,
      valueHeight: 3.0,
      titleHeight: 3.6,
    },

    // ─── The production card (turn 7, CLAUDE.md F1) ───
    // Three views of one cabinet on one sheet. Every number below is in DRAWING
    // millimetres (they travel with the geometry through the scale), except
    // where it says otherwise.
    unitCard: {
      // Between two views. Wide enough that one view's dimensions never read as
      // the neighbour's.
      viewGap: 280,
      // A card sets its text SMALLER than a single elevation does, and that is
      // not a cosmetic choice: three views and six runs of dimensions have to
      // share one sheet, and every millimetre of drawing-mm text height costs
      // roughly two millimetres of run spacing on all four sides of every view.
      // At 60 the whole card of a base unit fits A3 at 1:10 where 90 forced
      // 1:20 — one whole scale step, bought by setting the numbers at 3 mm on
      // paper instead of 4.5, which is what a drawing office sets them at
      // anyway. The floor is still `minTextHeight`.
      textHeight: 60,
      unitNumberHeight: 100,
      // The caption under each view ("FRONT", "CARCASS (no fronts)", "TOP").
      viewLabelHeight: 75,
      viewLabelGap: 70,
      // Where the detailed dimensions hang. `first` is the innermost run; each
      // further run steps out by `step`, which is what keeps a stack of shelf
      // positions readable instead of overwritten.
      dimFirst: 100,
      dimStep: 125,
      // The title block of a card carries what the workshop asks for at the
      // bench: what it is, and what it is made of.
      titleRows: ['CABINET CORE', 'Project', 'Unit', 'Type', 'Carcass', 'Fronts', 'Scale', 'Date'],
      titleWidth: 108,
      // The front gap (the 3 mm all round a front) is worth SAYING once rather
      // than dimensioning four times — at this scale the arrow would be longer
      // than the gap.
      noteHeight: 55,
    },

    // ─── The project booklet (turn 7, CLAUDE.md F1) ───
    booklet: {
      // The cover: a list of the units in the project, so the first page
      // answers "what is in this job".
      titleHeight: 9,        // paper mm
      headingHeight: 4.2,
      rowHeight: 5.4,
      textHeight: 3.2,
      // Two columns once the list is longer than this.
      rowsPerColumn: 24,
    },
  },

  // ─── CNC sheet + DXF output ───
  // Layer NAMES live in engine/cnc/layers.js (they are a machine contract, not
  // a workshop preference). What belongs here is the sheet metrics.
  cnc: {
    unitNumberLayer: 'UNIT_NUMBER',  // LISP drawText layer for the part label
    labelHeight: 40,                 // LISP drawText height on the CNC sheet
    labelMinHeight: 6,               // …shrunk to fit a small part, never below this
    labelFitRatio: 0.12,             // label height ≤ this × the part's short side
    layoutGap: 50,                   // LISP `odstep` — gap between parts laid out flat
    layoutRowWidth: 3600,            // wrap to a new row past this (preview only)
    // ─── Turn 11 (CLAUDE.md F6) ───
    // The cutter the workshop runs these files on. It reaches the CUT LIST
    // nowhere and the DXF nowhere — the machine's own post-processor owns the
    // toolpath — but the SHAPE the tool leaves is visible in the furniture, and
    // that is what F6 is about: an internal corner comes out filleted at the
    // tool's radius, never square, and a joint drawn with square corners is a
    // joint drawn from a drawing rather than from the part.
    //
    // 8 mm is the standard two-flute compression bit a board is cut with. A
    // workshop on a 6 or a 10 changes this line and the picture follows.
    toolDiameter: 8,
  },

  // ─── Cutting-list CSV (must stay byte-identical to the LISP output) ───
  csv: {
    header: 'UNIT,PANEL,SZER,WYS,EDGE,EDG_L,SQM',
    dimDecimals: 0,
    edgingDecimals: 2,
    areaDecimals: 3,
    codes: { left: '<', right: '>', topBottom: '^v', all: '<>^v', none: '' },
  },

  // ─── The room a unit stands in (turn 8, CLAUDE.md F3) ───
  // Not the room's SHAPE — that is the project's (engine/room.js). This is what
  // the workshop knows about walls in general.
  room: {
    // EVERY unit stands this far off the wall behind it. Base, wall and tall
    // alike, and not because anybody asked for a gap: because a wall is not
    // flat and a hung cabinet needs somewhere for its bracket to be.
    //
    // Piotr's two reasons, in his order: walls are never straight, and a wall
    // unit hangs on hooks that stand it off anyway. Ten millimetres is what the
    // workshop builds to; a workshop with a plaster wall and a different hanger
    // changes this number and the whole app follows it — the plan, the arrows,
    // the drawing, the depth clamp and the door swing.
    //
    // It is SEPARATE from `params.inset_back_mm` (turn 7), and the two add up.
    // That inset is a decision about ONE cabinet with a pipe behind it; this is
    // a fact about all of them.
    wallBackClearance: 10,
  },

  // ─── The editor's own affordances (turn 9, CLAUDE.md F2) ───
  // Not clearances and not geometry: numbers that decide when a CONTROL is
  // offered. They are here rather than in the component for the same reason
  // every other number is — a workshop that wants the plus to appear sooner
  // changes one number and the canvas and the test both follow it.
  ui: {
    // How much clear room there has to be at the end of a run before the "+"
    // that adds a cabinet there is offered at all.
    //
    // Piotr's verdict on the arrow-based side picker was that it is confusing,
    // so adding is a "+" standing at the free end of the run itself — you point
    // at the gap you mean. Which means the plus has to be HONEST: offering one
    // in a 60 mm slot is offering to put a cabinet where no cabinet goes, and
    // the placement would refuse it a moment later.
    //
    // 100 mm is the narrowest gap a workshop would still call a gap rather than
    // a scribe — `autoParts.sideInfill.maxWidth` is 120, so anything under this
    // is a filler's job and not a cabinet's.
    addPlusMinGapMm: 100,

    // ─── THE MODAL RULE (turn 12, CLAUDE.md rule 15) ───
    // "Every modal in this application is DRAGGABLE by its header and opens
    // BESIDE the object it concerns — never covering it." The owner said
    // "na zawsze", so the two numbers that decide what "beside" means are here
    // rather than in a component: one shell reads them and every modal in the
    // app is placed by it.
    modal: {
      // Clear screen pixels left between the object and the modal. Enough that
      // the edge of the cabinet and the edge of the panel are plainly two
      // things, and not so much that the panel stops feeling attached to it.
      gapPx: 14,
      // How close to a viewport edge a modal may come. The same 8 px the
      // right-click menu has used since turn 11.
      marginPx: 8,
      // ─── Turn 13 (CLAUDE.md F2.1 / rule 15's one exception) ───
      // How much room a MAXIMISED window leaves round itself. The cabinet
      // editor is a workspace rather than a side dialog and the owner asked for
      // it near-fullscreen; "near" is this number, and it is a number rather
      // than a `inset-6` in a class list because rule 2 says so. Big enough
      // that the room behind still reads as the thing underneath, small enough
      // that the window is the screen.
      maximiseMarginPx: 28,
    },
  },

  // ─── Editor defaults ───
  // The clearances the collision clamp enforces. A move STOPS at these values
  // (src/engine/collision.js) — they are not advisory.
  editor: {
    snapSteps: [0.5, 1, 32],
    defaultSnap: 1,
    // The precision the WORKSHOP works to (BACKLOG #33). Every millimetre field
    // in the app commits on this grid and every millimetre on screen is shown
    // to it, so "196.5" can be typed, seen and cut. Nothing to do with the drag
    // snap above — that is a user preference, this is what the tool measures in.
    mmStep: 0.5,
    minShelfGap: 40,           // minimum clear space between two shelves
    minShelfEdgeGap: 40,       // …and between a shelf and the top / base / partition
    // ─── Turn 12 (CLAUDE.md F7) ───
    // How much HEIGHT two units have to share before one blocks the other. A
    // wall unit hung exactly level with the top of a tall cabinet beside it is a
    // kitchen finished flush and not a collision, so touching is not overlapping
    // — but a millimetre of float should not turn into a phantom obstacle
    // either. The tolerance is the workshop's own grid.
    levelOverlapMm: 0.5,
    unitMagnet: 40,            // butt a unit against its neighbour within this
    minUnitGap: 0,             // units stand edge to edge; > 0 forces a scribe gap
    // The widest deliberate clearance a unit may be given (turn 7, BACKLOG
    // #32). A joiner insets a cabinet to clear a soil pipe or a wall that bows;
    // past this it is not a clearance, it is a gap you would put another
    // cabinet in — and the app has a filler and a cabinet for that.
    maxInset: 300,
    // Auto-order (turn 4): the gap the next shelf leaves below the last one.
    // Never allowed to close up tighter than minShelfGap — that is the clamp.
    itemStackPitch: 350,
    // ─── Turn 9 (CLAUDE.md F4) ───
    // The shallowest a piece inside a carcass may be pulled back to and still
    // be a piece. A shelf slides in DEPTH now — grab it and pull, between the
    // face of the cabinet and the construction plane behind it — and a clamp
    // with no floor under it would let a joiner drag a 560 mm shelf back until
    // it was a 4 mm strip with a full cut list entry and two edges banded.
    //
    // 100 mm is a spice rack: the narrowest thing a workshop would still cut,
    // edge and drill as a shelf rather than call an offcut.
    minElementDepth: 100,

    // ─── Undo / redo (turn 12, CLAUDE.md F9) ───
    // How far back it goes, and how long a burst of writes has to stop for
    // before it counts as one edit. A shelf drag writes on every pointer frame;
    // 400 ms of stillness is a hand that has let go, and it is what makes one
    // gesture one Ctrl+Z rather than a hundred.
    history: {
      depth: 50,
      coalesceMs: 400,
    },

    // ─── The cabinet coming apart (turn 12, CLAUDE.md F4.1) ───
    // "Each panel slides out along its face normal … like the cabinet was
    // unscrewed." How far is a FRACTION of the cabinet's own size, not a number
    // of millimetres, so a 300 mm vanity drawer and a 2.4 m wardrobe explode to
    // the same picture. The maths is engine/explode.js.
    explode: {
      // Far enough to see the joint; near enough that it still reads as one
      // cabinet rather than a parts diagram.
      distanceFactor: 0.45,
      // Extra separation between pieces travelling the same way — three shelves
      // all lifting would otherwise stay stacked. Fans them out like a hand.
      spreadFactor: 0.18,
      // How long the animation takes, out and back.
      seconds: 0.6,
    },
  },

  // ─── Distance arrows on the canvas (turn 3 phase 8; redrawn turn 5, #34) ───
  // The measurements the toolbar draws: unit to unit, and unit to wall.
  //
  // Turn 5 draws them the way a drawing office does. Filled cones pointing the
  // wrong way are gone; what is left is a thin line, extension lines out to the
  // faces being measured, an architectural tick across each end, and the value
  // in the middle. Every number below is in ROOM millimetres, so the annotation
  // scales with the drawing instead of with the camera.
  dimensions: {
    minGap: 2,            // below this the two things are touching, not spaced
    arrowHead: 45,        // length of the tick / open head, in room mm
    standoff: 90,         // how far in front of the units the line is drawn
    height: 120,          // how high above a unit's base the line floats
    // "1 px look": the thinnest bar that survives being rasterised at the
    // distances this scene is viewed from. Thinner and the line strobes.
    lineWeight: 3,
    extension: 110,       // extension line, from the measured face outwards
    extensionGap: 18,     // …starting this far off the face, as a draughtsman does
    tickAngle: 45,        // the oblique architectural tick, in degrees
    // How the ends are drawn: 'tick' = the 45° slash of an architectural
    // drawing, 'open' = a two-stroke arrowhead with nothing filled in.
    head: 'tick',
    // Which way the value sits off the line.
    labelOffset: 70,
    // The two inks of a technical drawing. Navy is the default; red is the
    // option in View ▸ Dimension colour. Nothing else on the canvas is either
    // colour, so a measurement never reads as part of the furniture.
    colours: {
      navy: '#1B2A4A',
      red: '#8C182B',
    },
    // WHICH of them is the default lives in `appearance.dimensions.colour`
    // (turn 11, CLAUDE.md F1.5) — one home for the choice, this one for the
    // hexes. It was 'navy' here; it is 'red' there.
  },
};

// ─── Single read point ───

let activeProfile = null;

/**
 * Schema migration for stored profiles (Supabase JSONB, localStorage cache).
 * Missing keys are filled from the current default, user-set values preserved.
 * Without this, a profile saved before a new key existed crashes every formula
 * that reads it.
 */
export function migrateCabinetProfile(profile) {
  if (!profile) return null;
  const D = DEFAULT_CABINET_PROFILE;
  if (profile.schema !== PROFILE_SCHEMA) {
    // Unknown/older shape: nothing user-set is safely transferable yet.
    if (!profile.carcass || !profile.puzzle || !profile.wardrobe) return { ...D };
  }
  return {
    ...D, ...profile,
    schema: PROFILE_SCHEMA,
    board: { ...D.board, ...profile.board },
    front: { ...D.front, ...profile.front, types: { ...D.front.types, ...profile.front?.types } },
    carcass: { ...D.carcass, ...profile.carcass },
    doors: { ...D.doors, ...profile.doors },
    hinges: {
      ...D.hinges, ...profile.hinges,
      rules: { ...D.hinges.rules, ...profile.hinges?.rules },
      cups: { ...D.hinges.cups, ...profile.hinges?.cups,
        baseOffsets: { ...D.hinges.cups.baseOffsets, ...profile.hinges?.cups?.baseOffsets },
        sinkOffsets: { ...D.hinges.cups.sinkOffsets, ...profile.hinges?.cups?.sinkOffsets } },
    },
    shelfHoles: { ...D.shelfHoles, ...profile.shelfHoles },
    puzzle: { ...D.puzzle, ...profile.puzzle, layers: { ...D.puzzle.layers, ...profile.puzzle?.layers } },
    // Turn 13 (F8): a stored profile made before the biscuit pattern existed
    // must come back with it, exactly as every other block here does.
    biscuits: { ...D.biscuits, ...profile.biscuits },
    wardrobe: {
      ...D.wardrobe, ...profile.wardrobe,
      defaults: { ...D.wardrobe.defaults, ...profile.wardrobe?.defaults },
      drawers: { ...D.wardrobe.drawers, ...profile.wardrobe?.drawers },
      drawerPanel: { ...D.wardrobe.drawerPanel, ...profile.wardrobe?.drawerPanel },
      runners: { ...D.wardrobe.runners, ...profile.wardrobe?.runners },
      rail: { ...D.wardrobe.rail, ...profile.wardrobe?.rail },
    },
    baseUnit: { ...D.baseUnit, ...profile.baseUnit, defaults: { ...D.baseUnit.defaults, ...profile.baseUnit?.defaults } },
    projectHeights: { ...D.projectHeights, ...profile.projectHeights },
    projectTypes: { ...D.projectTypes, ...profile.projectTypes },
    projectSettings: {
      ...D.projectSettings, ...profile.projectSettings,
      carcassSources: mergeList(D.projectSettings.carcassSources, profile.projectSettings?.carcassSources),
      frontSources: mergeList(D.projectSettings.frontSources, profile.projectSettings?.frontSources),
      boardThicknessOptions: mergeList(
        D.projectSettings.boardThicknessOptions, profile.projectSettings?.boardThicknessOptions,
      ),
      hardware: { ...D.projectSettings.hardware, ...profile.projectSettings?.hardware },
    },
    itemsByContext: { ...D.itemsByContext, ...profile.itemsByContext },
    joinery: {
      ...D.joinery, ...profile.joinery,
      types: Array.isArray(profile.joinery?.types) && profile.joinery.types.length
        ? profile.joinery.types
        : D.joinery.types,
    },
    legs: { ...D.legs, ...profile.legs },
    wallUnit: {
      ...D.wallUnit, ...profile.wallUnit,
      defaults: { ...D.wallUnit.defaults, ...profile.wallUnit?.defaults },
      hangers: { ...D.wallUnit.hangers, ...profile.wallUnit?.hangers },
    },
    tallUnit: { ...D.tallUnit, ...profile.tallUnit, defaults: { ...D.tallUnit.defaults, ...profile.tallUnit?.defaults } },
    lowCabinet: { ...D.lowCabinet, ...profile.lowCabinet, defaults: { ...D.lowCabinet.defaults, ...profile.lowCabinet?.defaults } },
    baseDrawerUnit: {
      ...D.baseDrawerUnit,
      ...profile.baseDrawerUnit,
      defaults: { ...D.baseDrawerUnit.defaults, ...profile.baseDrawerUnit?.defaults },
      // The variant LIST is the app's, like the finishes above: a profile saved
      // before turn 12 has no variants at all, and a stored one that predates a
      // new variant must not hide it from the library.
      variants: mergeById(D.baseDrawerUnit.variants, profile.baseDrawerUnit?.variants),
    },
    sinkUnit: { ...D.sinkUnit, ...profile.sinkUnit, defaults: { ...D.sinkUnit.defaults, ...profile.sinkUnit?.defaults } },
    fridgeUnit: { ...D.fridgeUnit, ...profile.fridgeUnit, defaults: { ...D.fridgeUnit.defaults, ...profile.fridgeUnit?.defaults } },
    autoParts: {
      ...D.autoParts, ...profile.autoParts,
      plinth: { ...D.autoParts.plinth, ...profile.autoParts?.plinth },
      topInfill: { ...D.autoParts.topInfill, ...profile.autoParts?.topInfill },
      sideInfill: { ...D.autoParts.sideInfill, ...profile.autoParts?.sideInfill },
      endPanel: { ...D.autoParts.endPanel, ...profile.autoParts?.endPanel },
    },
    appearance: {
      ...D.appearance, ...profile.appearance,
      // The finish LIST is the app's, not the stored profile's: a project saved
      // before a decor existed must still be able to show it.
      finishes: mergeFinishes(D.appearance.finishes, profile.appearance?.finishes),
      outline: {
        ...D.appearance.outline,
        ...profile.appearance?.outline,
        // A profile saved before turn 15 has no `polygonOffset` at all, and a
        // stored one that overrides only `factor` must keep the app's `units`.
        polygonOffset: {
          ...D.appearance.outline.polygonOffset,
          ...profile.appearance?.outline?.polygonOffset,
        },
      },
      sheen: { ...D.appearance.sheen, ...profile.appearance?.sheen },
      sheenScale: { ...D.appearance.sheenScale, ...profile.appearance?.sheenScale },
      spray: { ...D.appearance.spray, ...profile.appearance?.spray },
      decor: { ...D.appearance.decor, ...profile.appearance?.decor },
      studio: {
        ...D.appearance.studio, ...profile.appearance?.studio,
        hemisphere: { ...D.appearance.studio.hemisphere, ...profile.appearance?.studio?.hemisphere },
        // ─── Turn 10 (CLAUDE.md F1/F5) ───
        // The lights that are LISTS — the jupiters and the glints — merge like
        // the other lists in this file: a stored profile that names them wins
        // whole, and one that has never heard of them takes the app's. Merging
        // them entry by entry would be wrong twice over, because the COUNT is
        // half the setting ("maybe a second one lower") and a workshop that has
        // deliberately turned a rig down to one spot must not have a second
        // grafted back on by an upgrade.
        spots: mergeLightArray(D.appearance.studio.spots, profile.appearance?.studio?.spots),
        points: mergeLightArray(D.appearance.studio.points, profile.appearance?.studio?.points),
      },
      materials: {
        melamine: { ...D.appearance.materials.melamine, ...profile.appearance?.materials?.melamine },
        lacquer: { ...D.appearance.materials.lacquer, ...profile.appearance?.materials?.lacquer },
      },
      bevel: {
        ...D.appearance.bevel, ...profile.appearance?.bevel,
        ao: { ...D.appearance.bevel.ao, ...profile.appearance?.bevel?.ao },
      },
      environment: { ...D.appearance.environment, ...profile.appearance?.environment },
      contactShadow: { ...D.appearance.contactShadow, ...profile.appearance?.contactShadow },
      room: {
        ...D.appearance.room, ...profile.appearance?.room,
        bounce: { ...D.appearance.room.bounce, ...profile.appearance?.room?.bounce },
      },
      contour: { ...D.appearance.contour, ...profile.appearance?.contour },
      shade: { ...D.appearance.shade, ...profile.appearance?.shade },
      hardware: { ...D.appearance.hardware, ...profile.appearance?.hardware },
      joinery: { ...D.appearance.joinery, ...profile.appearance?.joinery },
      xray: { ...D.appearance.xray, ...profile.appearance?.xray },
      selection: { ...D.appearance.selection, ...profile.appearance?.selection },
      dimensions: { ...D.appearance.dimensions, ...profile.appearance?.dimensions },
      addPlus: { ...D.appearance.addPlus, ...profile.appearance?.addPlus },
    },
    render: {
      ...D.render, ...profile.render,
      resolutions: Array.isArray(profile.render?.resolutions) && profile.render.resolutions.length
        ? profile.render.resolutions
        : D.render.resolutions,
      shadow: {
        normal: { ...D.render.shadow.normal, ...profile.render?.shadow?.normal },
        high: { ...D.render.shadow.high, ...profile.render?.shadow?.high },
      },
      // ─── Turn 10 (CLAUDE.md F1.6) ───
      // Per KEY, not wholesale. A profile saved before the jupiters existed
      // carries a `lightScale` with five roles in it, and a plain spread would
      // let that stale block delete the sixth — leaving the spots with no knob
      // at all, which is exactly the trap F1.6 asks to be closed.
      lightScale: { ...D.render.lightScale, ...profile.render?.lightScale },
    },
    hardware: {
      ...D.hardware, ...profile.hardware,
      hinge: { ...D.hardware.hinge, ...profile.hardware?.hinge },
      runner: { ...D.hardware.runner, ...profile.hardware?.runner },
      leg: { ...D.hardware.leg, ...profile.hardware?.leg },
      rail: { ...D.hardware.rail, ...profile.hardware?.rail },
    },
    drawings: {
      ...D.drawings, ...profile.drawings,
      scales: Array.isArray(profile.drawings?.scales) && profile.drawings.scales.length
        ? profile.drawings.scales
        : D.drawings.scales,
      titleBlock: {
        ...D.drawings.titleBlock, ...profile.drawings?.titleBlock,
        rows: Array.isArray(profile.drawings?.titleBlock?.rows) && profile.drawings.titleBlock.rows.length
          ? profile.drawings.titleBlock.rows
          : D.drawings.titleBlock.rows,
      },
      unitCard: {
        ...D.drawings.unitCard, ...profile.drawings?.unitCard,
        titleRows: Array.isArray(profile.drawings?.unitCard?.titleRows) && profile.drawings.unitCard.titleRows.length
          ? profile.drawings.unitCard.titleRows
          : D.drawings.unitCard.titleRows,
      },
      booklet: { ...D.drawings.booklet, ...profile.drawings?.booklet },
    },
    room: { ...D.room, ...profile.room },
    ui: { ...D.ui, ...profile.ui },
    cnc: { ...D.cnc, ...profile.cnc },
    csv: { ...D.csv, ...profile.csv, codes: { ...D.csv.codes, ...profile.csv?.codes } },
    editor: { ...D.editor, ...profile.editor },
    dimensions: { ...D.dimensions, ...profile.dimensions },
  };
}

/**
 * A list the workshop may replace WHOLE: its own if it has one, ours otherwise.
 * Never merged entry by entry — a workshop that has deliberately deleted an
 * option must not have it grafted back on by an upgrade (the same rule the light
 * arrays follow, turn 10).
 */
function mergeList(defaults, stored) {
  return Array.isArray(stored) && stored.length ? stored : defaults;
}

/**
 * A rig's list of lights: the workshop's if it has one, ours otherwise
 * (turn 10, CLAUDE.md F1). Entries are normalised so a half-written spec — a
 * spot with no penumbra, a point with no colour — cannot reach three.js as
 * `undefined` and light nothing.
 */
function mergeLightArray(defaults, stored) {
  const list = Array.isArray(stored) ? stored : defaults;
  return list
    .filter((l) => l && Number.isFinite(Number(l.intensity)))
    .map((l) => ({ ...l, intensity: Number(l.intensity) }));
}

/**
 * Finishes a stored profile carries, plus every finish the app ships. A user's
 * own entry wins on its id; anything new arrives on top, so a project saved
 * before "light oak" existed still opens with light oak available.
 */
/**
 * A list of {id,...} records: the app's own, with a stored profile's overrides
 * merged onto them by id. An id the stored list has never heard of survives —
 * which is what lets a profile saved before turn 12 still see the drawer
 * variants that turn 12 added.
 */
function mergeById(defaults, stored) {
  if (!Array.isArray(stored) || !stored.length) return defaults.map((f) => ({ ...f }));
  const byId = new Map(defaults.map((f) => [f.id, { ...f }]));
  for (const f of stored) {
    if (!f?.id) continue;
    byId.set(f.id, { ...(byId.get(f.id) || {}), ...f });
  }
  return [...byId.values()];
}

function mergeFinishes(defaults, stored) {
  if (!Array.isArray(stored) || !stored.length) return defaults.map((f) => ({ ...f }));
  const byId = new Map(defaults.map((f) => [f.id, { ...f }]));
  for (const f of stored) {
    if (!f?.id) continue;
    byId.set(f.id, { ...(byId.get(f.id) || {}), ...f });
  }
  return [...byId.values()];
}

/** Called by cabinetProfileStore whenever the persisted profile changes. */
export function setActiveCabinetProfile(profile) {
  activeProfile = profile ? migrateCabinetProfile(profile) : null;
}

/** The engine's single read point. Falls back to the Skylon defaults. */
export function getCabinetProfile() {
  return activeProfile || DEFAULT_CABINET_PROFILE;
}

/** Temporarily compute with a frozen (snapshot) profile. */
export function withProfile(profile, fn) {
  const prev = activeProfile;
  if (profile) activeProfile = migrateCabinetProfile(profile);
  try { return fn(); } finally { activeProfile = prev; }
}