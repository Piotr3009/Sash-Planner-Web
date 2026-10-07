import { create } from 'zustand';
import * as cloud from '../services/cloudSync.js';
import { normalizeAssignments, expandAssignments, legacyToCanonical } from '../engine/partRegistry.js';
import { CASEMENT_HINGE_PARTS, CASEMENT_LOCK_PARTS } from '../engine/casementHardware.js';
import { DOOR_HARDWARE_PARTS } from '../engine/doorHardware.js';
import { DEFAULT_DOOR_PROFILE } from '../engine/profile.js';

// ─── Sash Window Parts (hardcoded — structural, used by calculations engine) ───
// section = pre-cut (raw) section that needs to be matched to a stock material
export const SASH_WINDOW_PARTS = {
  box: [
    { id: 'head',            name: 'Head',                  section: '28×141',  pcs: 1, materialType: 'hardwood' },
    { id: 'jambs',           name: 'Jambs',                 section: '28×141',  pcs: 2, materialType: 'hardwood' },
    { id: 'head_slim',       name: 'Head (Slim)',           section: '28×121',  pcs: 1, materialType: 'hardwood', note: 'slim frame' },
    { id: 'jambs_slim',      name: 'Jambs (Slim)',          section: '28×121',  pcs: 2, materialType: 'hardwood', note: 'slim frame' },
    { id: 'head_heritage',   name: 'Head (Heritage)',       section: '28×111',  pcs: 1, materialType: 'hardwood', note: 'heritage frame' },
    { id: 'jambs_heritage',  name: 'Jambs (Heritage)',      section: '28×111',  pcs: 2, materialType: 'hardwood', note: 'heritage frame' },
    { id: 'head_triple',     name: 'Head (Triple)',         section: '28×149',  pcs: 1, materialType: 'hardwood', note: 'triple glazing frame' },
    { id: 'jambs_triple',    name: 'Jambs (Triple)',        section: '28×149',  pcs: 2, materialType: 'hardwood', note: 'triple glazing frame' },
    { id: 'mullion',         name: 'Mullion Post',          section: '50×141',  pcs: 2, materialType: 'hardwood', note: 'triple sash' },
    { id: 'cill',            name: 'Cill',                  section: '69×46',   pcs: 1, materialType: 'hardwood' },
    { id: 'cill_nose',       name: 'Cill Nose',             section: '64×128',  pcs: 1, materialType: 'hardwood' },
    { id: 'cill_extension',  name: 'Cill Extension',        section: '—',       pcs: 1, materialType: 'hardwood', optional: true },
    { id: 'ext_head_liner',  name: 'External Head Liner',   section: '17×102',  pcs: 1, materialType: 'softwood' },
    { id: 'int_head_liner',  name: 'Internal Head Liner',   section: '17×86',   pcs: 1, materialType: 'softwood' },
    { id: 'ext_jamb_liner',  name: 'External Jamb Liner',   section: '17×102',  pcs: 2, materialType: 'softwood' },
    { id: 'int_jamb_liner',  name: 'Internal Jamb Liner',   section: '17×86',   pcs: 2, materialType: 'softwood' },
  ],
  sash: [
    { id: 'top_rail',             name: 'Top Rail',              section: '—',  finishedSection: '57×57',  pcs: 1, materialType: 'hardwood' },
    { id: 'stiles_top_sash',      name: 'Stiles Top',            section: '—',  finishedSection: '57×57',  pcs: 2, materialType: 'hardwood', mirror: true },
    { id: 'stiles_bottom_sash',   name: 'Stiles Bottom Sash',    section: '—',  finishedSection: '57×57',  pcs: 2, materialType: 'hardwood', mirror: true },
    { id: 'bottom_rail',          name: 'Bottom Rail',            section: '—',  finishedSection: '57×90',  pcs: 1, materialType: 'hardwood' },
    { id: 'top_meet_rail',        name: 'Top Meeting Rail',       section: '—',  finishedSection: '57×43',  pcs: 1, materialType: 'hardwood' },
    { id: 'bottom_meet_rail',     name: 'Bottom Meeting Rail',    section: '—',  finishedSection: '57×43',  pcs: 1, materialType: 'hardwood' },
  ],
  beading: [
    { id: 'glazing_beading',           name: 'Glazing Beading',            section: 'profile',  pcs: 1, materialType: 'beading', unit: 'm' },
    { id: 'triangle_beading_ext',      name: 'Triangle Beading (Ext)',     section: 'profile',  pcs: 1, materialType: 'beading', unit: 'm' },
    { id: 'georgian_middle_beading',   name: 'Georgian Middle Beading',    section: 'profile',  pcs: 1, materialType: 'beading', unit: 'm' },
    { id: 'parting_beading',           name: 'Parting Beading',            section: 'profile',  pcs: 1, materialType: 'beading', unit: 'm' },
    { id: 'staff_beading',            name: 'Staff Beading',              section: 'profile',  pcs: 1, materialType: 'beading', unit: 'm' },
    { id: 'meeting_beading_a',         name: 'Meeting Beading A',          section: 'profile',  pcs: 1, materialType: 'beading', unit: 'm' },
    { id: 'meeting_beading_b',         name: 'Meeting Beading B',          section: 'profile',  pcs: 1, materialType: 'beading', unit: 'm' },
  ],
  glass: [
    { id: 'glass_double',     name: 'Double Glazing',       section: '4-16-4',   pcs: 2, materialType: 'glass', unit: 'm²' },
    { id: 'glass_double_slim', name: 'Double Slim Glazing',  section: '4-8-4',    pcs: 2, materialType: 'glass', unit: 'm²' },
    { id: 'glass_triple',     name: 'Triple Glazing',       section: '4-8-4-8-4', pcs: 2, materialType: 'glass', unit: 'm²' },
    { id: 'glass_single',     name: 'Single Heritage',      section: '6.8mm lam',      pcs: 2, materialType: 'glass', unit: 'm²' },
    { id: 'glass_passive',    name: 'Passive (Vacuum)',     section: 'vacuum',   pcs: 2, materialType: 'glass', unit: 'm²' },
    { id: 'glass_acoustic',   name: 'Laminate / Acoustic',  section: '4-14-6.8', pcs: 2, materialType: 'glass', unit: 'm²', optional: true,
      hint: 'The 24.8mm Laminate / Acoustic unit: every sash or casement window and every door with the Laminate / Acoustic spec, or the Laminated spec on a double / passive unit (the same glass). Its m² never land on the Double row.' },
  ],
  paint: [
    { id: 'paint_primer',     name: 'Primer',               section: '—',  pcs: 1, materialType: 'paint', unit: 'L' },
    { id: 'paint_preserver',  name: 'Preserver',            section: '—',  pcs: 1, materialType: 'paint', unit: 'L',
      hint: 'Timber preserver: 10% of the primer litres (sash windows; doors use the casement row).' },
    { id: 'paint_white_9016', name: 'White Standard 9016',  section: '—',  pcs: 1, materialType: 'paint', unit: 'L' },
    { id: 'paint_bespoke',    name: 'Bespoke Colour',       section: '—',  pcs: 1, materialType: 'paint', unit: 'L', optional: true },
  ],
  consumables: [
    { id: 'cord',               name: 'Cord / Rope',              section: '—',  pcs: 1, materialType: 'consumable', unit: 'm' },
    { id: 'glazing_clips_24mm', name: 'Glazing Clips — standard frame', section: '—', pcs: 20, materialType: 'consumable', unit: 'pcs', note: 'size = assigned material' },
    { id: 'glazing_clips_24_8mm', name: 'Glazing Clips — laminated / acoustic (24.8mm)', section: '—', pcs: 20, materialType: 'consumable', unit: 'pcs', note: '4-14-6.8 unit · Laminated or Laminate / Acoustic spec' },
    { id: 'glazing_clips_28mm', name: 'Glazing Clips — triple frame',   section: '—', pcs: 20, materialType: 'consumable', unit: 'pcs', note: 'size = assigned material' },
    { id: 'glazing_clips_14mm', name: 'Glazing Clips — slim frame',     section: '—', pcs: 20, materialType: 'consumable', unit: 'pcs', note: 'size = assigned material' },
    { id: 'glazing_clips_heritage', name: 'Glazing Clips — heritage frame', section: '—', pcs: 20, materialType: 'consumable', unit: 'pcs', note: 'size = assigned material' },
    { id: 'spacer_1mm',         name: 'Glazing Packer 1mm',       section: '—',  pcs: 20, materialType: 'consumable', unit: 'pcs' },
    { id: 'spacer_2mm',         name: 'Glazing Packer 2mm',       section: '—',  pcs: 4, materialType: 'consumable', unit: 'pcs' },
    { id: 'bead_tape',          name: 'Georgian Bar/Bead Tape 1mm', section: '1mm', pcs: 1, materialType: 'consumable', unit: 'm' },
    { id: 'bead_tape_2mm',      name: 'Georgian Bar/Bead Tape 2mm', section: '2mm', pcs: 1, materialType: 'consumable', unit: 'm' },
    { id: 'silicone',           name: 'Silicone',                 section: '—',  pcs: 1, materialType: 'consumable', unit: 'tubes' },
    { id: 'weights_normal',     name: 'Weights Normal',           section: '—',  pcs: 1, materialType: 'consumable', unit: 'kg', note: 'standard frame' },
    { id: 'weights_slim',       name: 'Weights Slim',             section: '—',  pcs: 1, materialType: 'consumable', unit: 'kg', note: 'slim frame' },
    { id: 'seal_sliding_6070',  name: 'Sliding Sash Seal 6070',   section: '—',  pcs: 1, materialType: 'consumable', unit: 'm' },
    { id: 'seal_bottom_6009',   name: 'Bottom Seal 6009',         section: '—',  pcs: 1, materialType: 'consumable', unit: 'm' },
  ],
};

// ─── Casement (simple: outer frame + sash all round; mullions/transoms later) ───

export const CASEMENT_PARTS = {
  frame: [
    // ARCHED-WINDOWS-v4 Block F (06.09): head and jambs 68 × 93 (was 57 × 93).
    // The 57 × 93 material stays in Part Registry for projects made before —
    // an existing assignment is by material id and is not touched.
    { id: 'c_frame_head', name: 'Frame Head',   section: '68×93', pcs: 1, materialType: 'hardwood',
      hint: 'Raw section 68×93 from v4 Block F (frame face 68, rebate 21, land 47). Was 57×93 — older projects keep their assigned 57×93 material.' },
    { id: 'c_frame_jamb', name: 'Frame Jambs',  section: '68×93', pcs: 2, materialType: 'hardwood',
      hint: 'Raw section 68×93 from v4 Block F. Was 57×93 — older projects keep their assigned 57×93 material.' },
    { id: 'c_frame_cill', name: 'Frame Cill',   section: '68×93', pcs: 1, materialType: 'hardwood', note: 'profiled section' },
    { id: 'c_mullion',    name: 'Mullion',      section: '68×93', pcs: 1, materialType: 'hardwood' },
    { id: 'c_transom',    name: 'Transom',      section: '68×93', pcs: 1, materialType: 'hardwood' },
    { id: 'c_sill_ext_35', name: 'Sill Extension 35mm', section: '34×45', pcs: 1, materialType: 'hardwood', unit: 'm',
      hint: 'External cill extension board, 35mm projection. Raw 34×45 incl. the 10×10 tongue. Length = cill length, engine-fed when the window has this extension.' },
    { id: 'c_sill_ext_60', name: 'Sill Extension 60mm', section: '34×70', pcs: 1, materialType: 'hardwood', unit: 'm',
      hint: 'External cill extension board, 60mm projection. Raw 34×70 incl. the 10×10 tongue.' },
    { id: 'c_sill_ext_85', name: 'Sill Extension 85mm', section: '34×95', pcs: 1, materialType: 'hardwood', unit: 'm',
      hint: 'External cill extension board, 85mm projection. Raw 34×95 incl. the 10×10 tongue.' },
  ],
  sash: [
    { id: 'c_sash_stile',       name: 'Leaf Stiles',      section: '64×57', pcs: 2, materialType: 'hardwood' },
    { id: 'c_sash_top_rail',    name: 'Leaf Top Rail',    section: '64×57', pcs: 1, materialType: 'hardwood' },
    { id: 'c_sash_bottom_rail', name: 'Leaf Bottom Rail', section: '67×57', pcs: 1, materialType: 'hardwood' },
    // arched-windows-v3 0.4: timber tracery board over the arched unit (one board, one side, CNC-cut)
    { id: 'c_tracery',          name: 'Tracery Board',    section: '18×blank', pcs: 1, materialType: 'hardwood',
      hint: 'Arched casement with a bar pattern: one board (profile tracery.boardThickness) cut on the CNC to the pane pattern, applied on one side of the glass. Engine-fed: blank W x H from the tracery export.' },
  ],
  // Hinge slots: rows come from the engine catalogue (single source of truth
  // for labels + size/weight limits). The engine picks the slot per opener;
  // the user assigns ANY material to any slot — `hint` is the "?" tooltip with
  // the limits of the row. One row per slot, no LH / RH: the material is a
  // PAIR, so PCS is 1 (Piotr 04.10.2026 — Yield 2 on the row for a product
  // sold per piece).
  ironmongeryHinges: CASEMENT_HINGE_PARTS.map((s) => ({
    id: s.id, name: s.name, hint: s.hint,
    section: '\u2014', pcs: 1, materialType: 'ironmongery', unit: 'pcs',
  })),
  // Lock rows: one per PURCHASABLE code from the engine catalogue — six BJ
  // Waller size bands × LH / RH / TOP, plus one row for sashes under 350mm
  // (04.10.2026).
  ironmongeryLocks: CASEMENT_LOCK_PARTS.map((l) => ({
    id: l.id, name: l.name, hint: l.hint,
    section: '\u2014', pcs: 1, materialType: 'ironmongery', unit: 'pcs',
  })),
  ironmongeryOthers: [
    // Child restrictor: handed catch + separate stud (05.10.2026). Counted per
    // side hung opener, only on windows with the Child restrictor box ticked.
    { id: 'c_child_restrictor_lh', name: 'Child Restrictor LH', section: '\u2014', pcs: 1, materialType: 'ironmongery', unit: 'pcs',
      hint: 'Left hand restrictor: side hung sash hinged on the RIGHT, viewed from outside. One per such opener, only when the window has Child restrictor ticked. Top hung openers get none.' },
    { id: 'c_child_restrictor_rh', name: 'Child Restrictor RH', section: '\u2014', pcs: 1, materialType: 'ironmongery', unit: 'pcs',
      hint: 'Right hand restrictor: side hung sash hinged on the LEFT, viewed from outside. One per such opener, only when the window has Child restrictor ticked. Top hung openers get none.' },
    { id: 'c_child_restrictor_stud', name: 'Child Restrictor Stud', section: '\u2014', pcs: 1, materialType: 'ironmongery', unit: 'pcs',
      hint: 'One stud per restrictor (LH + RH together). Sold separately from the restrictor.' },
    { id: 'c_wedge_packer', name: 'Wedge Packers', section: '\u2014', pcs: 1, materialType: 'consumable', unit: 'm',
      hint: 'Metres. One wedge per side hung opener, under the BOTTOM hinge only (on the cill, or on the transom when the leaf sits above one) \u2014 its length is the hinge length of the row the engine picked: 210 / 311 / 413 / 406mm, 500mm on the XL row. Top hung openers get none. For a packer sold in 2m lengths set Yield 0.5 to read the result in lengths.' },
  ],

  beading: [
    { id: 'c_glazing_beading', name: 'Glazing Beading', section: 'profile', pcs: 1, materialType: 'beading', unit: 'm',
      hint: 'Casement glazing bead profile. Length = pane perimeters + 15% waste, computed by the engine.' },
    { id: 'c_triangle_beading_ext', name: 'Triangle Beading (Ext)', section: 'profile', pcs: 1, materialType: 'beading', unit: 'm',
      hint: 'Astragal bar profile glued on the OUTSIDE glass face, casement windows and also doors. Length = bar runs + 15%, only when bar type is astragal.' },
    { id: 'c_georgian_middle_beading', name: 'Georgian Middle Beading', section: 'profile', pcs: 1, materialType: 'beading', unit: 'm',
      hint: 'Astragal bar profile glued on the INSIDE glass face: same runs as the external one + 15% (also doors).' },
  ],
  consumables: [
    { id: 'c_silicone', name: 'Silicone', section: '—', pcs: 1, materialType: 'consumable', unit: 'tubes',
      hint: 'Glazing silicone, casement windows and also doors: 0.1 tube per metre of pane perimeters + astragal runs.' },
    { id: 'c_bead_tape_1mm', name: 'Bead Tape 1mm', section: '—', pcs: 1, materialType: 'consumable', unit: 'm',
      hint: 'Astragal fixing tape, one glass face (sash convention: 1mm outside), casement windows and also doors. Engine feeds pane perimeters + bar runs when bar type is astragal.' },
    { id: 'c_bead_tape_2mm', name: 'Bead Tape 2mm', section: '—', pcs: 1, materialType: 'consumable', unit: 'm',
      hint: 'Astragal fixing tape, the other glass face (sash convention: 2mm inside), casement windows and also doors.' },
    { id: 'c_seal_frame_black', name: 'Frame Seal — Black', section: '—', pcs: 1, materialType: 'consumable', unit: 'm',
      hint: 'Seal round every leaf, fixed or opening, casement windows and also doors (door leaves, side panel leaves, fan leaves): (2 × leaf height + 2 × leaf width) per leaf, summed, + 10%. The BOM picks Black or White from the window Seal colour.' },
    { id: 'c_seal_frame_white', name: 'Frame Seal — White', section: '—', pcs: 1, materialType: 'consumable', unit: 'm',
      hint: 'Seal round every leaf, white: same length rule as the black one (also doors).' },
    { id: 'c_seal_hj_black', name: 'Head & Jambs Seal — Black', section: '—', pcs: 1, materialType: 'consumable', unit: 'm',
      hint: 'Second seal line, head and jambs of every leaf, fixed or opening, casement windows and also doors: (2 × leaf height + 1 × leaf width) per leaf, summed, + 10%. Colour follows the window Seal colour.' },
    { id: 'c_seal_hj_white', name: 'Head & Jambs Seal — White', section: '—', pcs: 1, materialType: 'consumable', unit: 'm',
      hint: 'Second seal line, white: same length rule as the black one (also doors).' },
  ],
  paint: [
    { id: 'c_paint_primer', name: 'Primer', section: '—', pcs: 1, materialType: 'paint', unit: 'L',
      hint: 'Primer, casement windows and also doors: litres from the engine paint model (a door: the whole assembly W x H).' },
    { id: 'c_paint_preserver', name: 'Preserver', section: '—', pcs: 1, materialType: 'paint', unit: 'L',
      hint: 'Timber preserver: 10% of the primer litres (casement windows and also doors).' },
    { id: 'c_paint_white_9016', name: 'White Standard 9016', section: '—', pcs: 1, materialType: 'paint', unit: 'L',
      hint: 'Topcoat when the window or door colour is RAL 9016 / default white.' },
    { id: 'c_paint_bespoke', name: 'Bespoke Colour', section: '—', pcs: 1, materialType: 'paint', unit: 'L',
      hint: 'Topcoat for any non-9016 colour (windows and doors).' },
  ],
  glazing: [
    { id: 'c_glass_clips_double', name: 'Glass Clips — Double', sub: 'double glazed units', section: '—', pcs: 1, materialType: 'consumable', unit: 'pcs',
      hint: 'Clips for double units (24mm), casement windows and also doors (the 6-12-6 door unit, slim door units): fans 6, panes taller than 500mm 8, others 6.' },
    { id: 'c_glass_clips_triple', name: 'Glass Clips — Triple', sub: 'triple glazed units', section: '—', pcs: 1, materialType: 'consumable', unit: 'pcs',
      hint: 'Clips for triple units (28mm), casement windows and also doors: fans 6, panes taller than 500mm 8, others 6.' },
    { id: 'c_glass_clips_laminated', name: 'Glass Clips — Laminated / Acoustic (24.8mm)', sub: 'laminated or Laminate / Acoustic spec, 4-14-6.8 unit', section: '—', pcs: 1, materialType: 'consumable', unit: 'pcs',
      hint: 'Clips for the 24.8mm Laminate / Acoustic unit, casement windows and also doors: fans 6, panes taller than 500mm 8, others 6.' },
    { id: 'c_glazing_packer', name: 'Glazing Packers', sub: '8 pcs × pane — engine counts panes', section: '—', pcs: 8, materialType: 'consumable', unit: 'pcs',
      hint: '8 per pane, casement windows and also doors (door leaf, side panel and fanlight panes).' },
  ],
};
CASEMENT_PARTS.ironmongery = [
  ...CASEMENT_PARTS.ironmongeryHinges,
  ...CASEMENT_PARTS.ironmongeryLocks,
  ...CASEMENT_PARTS.ironmongeryOthers,
];
export const CASEMENT_ALL_PARTS = [
  ...CASEMENT_PARTS.frame, ...CASEMENT_PARTS.sash,
  ...CASEMENT_PARTS.ironmongery, ...CASEMENT_PARTS.beading,
  ...CASEMENT_PARTS.consumables, ...CASEMENT_PARTS.paint, ...CASEMENT_PARTS.glazing,
];

// ─── Doors (08.10.2026, doors to production): single and french ───
// Own rows for door timber, the door glass unit, the panel boards, the door
// glazing bead and the door ironmongery. Consumables, seals, clips, packers,
// astragal beads and paint are NOT duplicated: doors count on the casement rows
// (hints say "also doors"). The opening fanlight leaf buys the casement leaf
// timber and the casement hinge / lock rows. Section labels from the default
// door profile (one source for the numbers).
const DP = DEFAULT_DOOR_PROFILE;
const dSec = (face, depth) => `${face}×${depth}`;
const DOOR_FRAME_SEC = dSec(DP.elements.frameHead.face, DP.frameDepth);
const DOOR_LEAF_SEC = (k) => dSec(DP.elements[k].face, DP.leafDepth);
export const DOOR_PARTS = {
  frame: [
    { id: 'd_frame_head', name: 'Frame Head', section: DOOR_FRAME_SEC, pcs: 1, materialType: 'hardwood',
      hint: 'Door frame head, one piece across the whole assembly (side panels included). The casement frame section.' },
    { id: 'd_frame_jamb', name: 'Frame Jambs', section: DOOR_FRAME_SEC, pcs: 2, materialType: 'hardwood',
      hint: 'Door frame jambs, full height (door + fanlight).' },
    { id: 'd_frame_cill', name: 'Frame Cill', section: dSec(DP.elements.frameCill.face, DP.frameDepth), pcs: 1, materialType: 'hardwood', note: 'profiled section',
      hint: 'Outward opening door: the casement cill, 41 visible. Length = assembly width + threshold extension. None with an aluminium or low-profile threshold.' },
    { id: 'd_frame_cill_inward', name: 'Frame Cill (Inward)', section: dSec(DP.cillInward.faceInternal, DP.frameDepth), pcs: 1, materialType: 'hardwood',
      hint: 'Inward opening door: unrebated cill, the inside face falling to the outside face across the depth (Window Settings, Doors).' },
    { id: 'd_coupling_post', name: 'Coupling Post', section: dSec(DP.couplingPost.width, DP.frameDepth), pcs: 1, materialType: 'hardwood',
      hint: 'One member between a side panel and the door, two rebates. One per side panel, full height.' },
    { id: 'd_transom_rail', name: 'Transom Rail', section: dSec(DP.elements.transomRail.face, DP.frameDepth), pcs: 1, materialType: 'hardwood',
      hint: 'Fanlight rail across the assembly, between the jambs.' },
  ],
  leaf: [
    { id: 'd_leaf_stile', name: 'Leaf Stiles', section: DOOR_LEAF_SEC('leafStile'), pcs: 2, materialType: 'hardwood', mirror: true,
      hint: 'Single door: both stiles. French door: the hinge stile of each leaf (the meeting stile has its own row).' },
    { id: 'd_leaf_meeting_stile', name: 'Meeting Stile', section: DOOR_LEAF_SEC('leafMeeting'), pcs: 1, materialType: 'hardwood',
      hint: 'French door: one per leaf, the stile with the 6mm lip that laps the centre line (94 + lip).' },
    { id: 'd_leaf_top_rail', name: 'Leaf Top Rail', section: DOOR_LEAF_SEC('leafTop'), pcs: 1, materialType: 'hardwood' },
    { id: 'd_leaf_bottom_rail', name: 'Leaf Bottom Rail', section: DOOR_LEAF_SEC('leafBottom'), pcs: 1, materialType: 'hardwood' },
    { id: 'd_leaf_mid_rail', name: 'Leaf Mid Rail', section: DOOR_LEAF_SEC('leafMid'), pcs: 1, materialType: 'hardwood',
      hint: 'Half-glazed and three-quarter doors: the rail between the glass and the panel, full leaf width.' },
  ],
  panel: [
    { id: 'd_panel_tricoya_18', name: 'Panel Board, Tricoya MDF', section: `${DP.panel.boardThickness}mm`, pcs: DP.panel.boards, materialType: 'board', unit: 'm²',
      hint: 'Half-glazed and three-quarter doors: the panel below the mid rail is two Tricoya MDF boards and a core. m² = panel area × 2 per panel.' },
    { id: 'd_panel_mdf_core', name: 'Panel Core, MDF', section: `${DP.panel.coreThickness}mm`, pcs: 1, materialType: 'board', unit: 'm²',
      hint: 'The MDF core between the two Tricoya boards: panel area × 1 per panel. Core thickness to confirm (Window Settings, Doors).' },
  ],
  sidePanel: [
    { id: 'd_side_stile', name: 'Side Panel Stiles', section: dSec(DP.sidePanel.member, DP.sidePanel.depth), pcs: 2, materialType: 'hardwood', mirror: true },
    { id: 'd_side_top_rail', name: 'Side Panel Top Rail', section: dSec(DP.sidePanel.member, DP.sidePanel.depth), pcs: 1, materialType: 'hardwood' },
    { id: 'd_side_bottom_rail', name: 'Side Panel Bottom Rail', section: dSec(DP.sidePanel.member, DP.sidePanel.depth), pcs: 1, materialType: 'hardwood' },
  ],
  glass: [
    { id: 'd_glass_double_6_12_6', name: 'Door Glass 6-12-6', section: '6-12-6', pcs: 1, materialType: 'glass', unit: 'm²',
      hint: 'The standard door unit, double 6 × 12 × 6 = 24mm: door leaves, side panels and fanlights. A door with slim, triple or the Laminate / Acoustic spec counts on the window glass rows.' },
  ],
  beading: [
    { id: 'd_glazing_beading', name: 'Glazing Beading', section: 'profile', pcs: 1, materialType: 'beading', unit: 'm',
      hint: 'Door glazing bead profile: pane perimeters (door leaves, side panels, fanlights) and the panel perimeters, + 15% waste. Astragal beads count on the casement rows.' },
  ],
  // Hardware rows from the engine catalogue (doorHardware.js): the counting
  // rule is the hint. defaultCategory = the ironmongery tab the row opens on.
  ironmongery: DOOR_HARDWARE_PARTS.map((h) => ({
    id: h.id, name: h.name, hint: h.hint, defaultCategory: h.slot,
    section: '-', pcs: 1, materialType: 'ironmongery', unit: 'pcs',
  })),
};
export const DOOR_ALL_PARTS = [
  ...DOOR_PARTS.frame, ...DOOR_PARTS.leaf, ...DOOR_PARTS.panel, ...DOOR_PARTS.sidePanel,
  ...DOOR_PARTS.glass, ...DOOR_PARTS.beading, ...DOOR_PARTS.ironmongery,
];
// The window glass rows a door may count on (slim, triple, Laminate /
// Acoustic): shown read-only on the Doors page, "shared with windows".
export const DOOR_SHARED_GLASS_IDS = ['glass_double_slim', 'glass_triple', 'glass_acoustic'];

// Flat list for lookups — includes casement parts: mergeWindowMaterials and
// the per-window material table iterate THIS list, so anything missing here
// is silently dropped from every BOM (the audit's casement drop bug).
export const ALL_PARTS = [
  ...SASH_WINDOW_PARTS.box,
  ...SASH_WINDOW_PARTS.sash,
  ...SASH_WINDOW_PARTS.beading,
  ...SASH_WINDOW_PARTS.glass,
  ...SASH_WINDOW_PARTS.paint,
  ...SASH_WINDOW_PARTS.consumables,
  ...CASEMENT_ALL_PARTS,
  ...DOOR_ALL_PARTS,   // appended LAST: index-based assignment sets (t37) keep every earlier row
];

// ─── Store ───
// Canonical shape (schema 2): base assignment per part + per-variant overrides.
// `assignments` stays as a FLAT legacy view (expanded, inheritance applied) so
// the current page, counter and any flat consumers keep working unchanged.
function project(data) {
  const d = normalizeAssignments(data);
  return { data: d, assignments: expandAssignments(d) };
}

export const useMaterialAssignmentStore = create((set, get) => ({
      // data: { schema: 2, base: {...}, overrides: {...} } — source of truth
      data: { schema: 2, base: {}, overrides: {} },
      // assignments: flat legacy view derived from `data` (read-only)
      assignments: {},

      // Set assignment for a part (includes category/subcategory filter)
      setAssignment: (partId, materialId, yieldCoeff = 1.0, category = '', subcategory = '', explicitVariant = null) => {
        set((s) => {
          const canon = legacyToCanonical(partId);
          const key = canon.key;
          const variantKey = explicitVariant && explicitVariant !== 'standard' ? explicitVariant : canon.variantKey;
          const d = normalizeAssignments(s.data);
          const prev = (variantKey ? d.overrides?.[key]?.[variantKey] : d.base?.[key]) || s.assignments[partId] || {};
          const next = {
            material_id: materialId,
            yield: yieldCoeff,
            category: category || prev.category || '',
            subcategory: subcategory || prev.subcategory || '',
          };
          if (variantKey) {
            d.overrides[key] = { ...(d.overrides[key] || {}), [variantKey]: next };
          } else {
            d.base[key] = next;
          }
          return project(d);
        });
        cloud.saveAssignments(get().data);
      },

      // Update filter (category/subcategory) for a part
      setFilter: (partId, category, subcategory = '', explicitVariant = null) => {
        set((s) => {
          const canon = legacyToCanonical(partId);
          const key = canon.key;
          const variantKey = explicitVariant && explicitVariant !== 'standard' ? explicitVariant : canon.variantKey;
          const d = normalizeAssignments(s.data);
          const prev = (variantKey ? d.overrides?.[key]?.[variantKey] : d.base?.[key]) || s.assignments[partId] || {};
          const next = {
            material_id: prev.material_id || '',
            yield: prev.yield ?? 1.0,
            category,
            subcategory,
          };
          if (variantKey) {
            d.overrides[key] = { ...(d.overrides[key] || {}), [variantKey]: next };
          } else {
            d.base[key] = next;
          }
          return project(d);
        });
        cloud.saveAssignments(get().data);
      },

      // Update yield only
      setYield: (partId, yieldCoeff, explicitVariant = null) => {
        set((s) => {
          const canon = legacyToCanonical(partId);
          const key = canon.key;
          const variantKey = explicitVariant && explicitVariant !== 'standard' ? explicitVariant : canon.variantKey;
          const d = normalizeAssignments(s.data);
          const prev = (variantKey ? d.overrides?.[key]?.[variantKey] : d.base?.[key]) || s.assignments[partId] || {};
          const next = { ...prev, yield: yieldCoeff };
          if (variantKey) {
            d.overrides[key] = { ...(d.overrides[key] || {}), [variantKey]: next };
          } else {
            d.base[key] = next;
          }
          return project(d);
        });
        cloud.saveAssignments(get().data);
      },

      // Remove assignment
      // Base part → removes base (and its overrides). Variant row → removes
      // just the override; the row falls back to the inherited base value.
      removeAssignment: (partId, explicitVariant = null) => {
        set((s) => {
          const canon = legacyToCanonical(partId);
          const key = canon.key;
          const variantKey = explicitVariant && explicitVariant !== 'standard' ? explicitVariant : canon.variantKey;
          const d = normalizeAssignments(s.data);
          if (variantKey) {
            if (d.overrides[key]) {
              const o = { ...d.overrides[key] };
              delete o[variantKey];
              if (Object.keys(o).length) d.overrides[key] = o; else delete d.overrides[key];
            }
          } else {
            delete d.base[key];
            delete d.overrides[key];
          }
          return project(d);
        });
        cloud.saveAssignments(get().data);
      },

      // Get assignment for a part
      getAssignment: (partId) => get().assignments[partId] || null,

      // ── Custom consumables (user-defined, counted as qtyPerWindow × windows) ──
      addCustomPart: ({ name, unit, qtyPerWindow }) => {
        set((s) => {
          const d = normalizeAssignments(s.data);
          d.customParts = [...(d.customParts || []), {
            id: `custom_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
            name: String(name || '').trim() || 'Custom consumable',
            unit: unit || 'pcs',
            qtyPerWindow: Number(qtyPerWindow) || 1,
          }];
          return project(d);
        });
        cloud.saveAssignments(get().data);
      },
      updateCustomPart: (id, patch) => {
        set((s) => {
          const d = normalizeAssignments(s.data);
          d.customParts = (d.customParts || []).map((cp) => (cp.id === id ? { ...cp, ...patch, qtyPerWindow: Number(patch.qtyPerWindow ?? cp.qtyPerWindow) || 1 } : cp));
          return project(d);
        });
        cloud.saveAssignments(get().data);
      },
      removeCustomPart: (id) => {
        set((s) => {
          const d = normalizeAssignments(s.data);
          d.customParts = (d.customParts || []).filter((cp) => cp.id !== id);
          delete d.base[id];
          delete d.overrides[id];
          return project(d);
        });
        cloud.saveAssignments(get().data);
      },

      // Clear all assignments (local only — used on sign-out)
      clearAll: () => set({ data: { schema: 2, base: {}, overrides: {} }, assignments: {} }),

      // Load assignments for the logged-in user from the cloud.
      // Legacy flat blobs are migrated to schema 2 on the fly (idempotent).
      loadFromCloud: async () => {
        const raw = await cloud.loadAssignments();
        if (raw) set(project(raw));
      },
}));
