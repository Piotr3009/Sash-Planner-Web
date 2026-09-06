import { resolveCasementLayout, fanAxisToRatio, fan2AxisToRatio, CASEMENT_GEO_DEFAULTS } from './casementLayouts.js';
import { selectCasementHinges, summariseHinges, selectCasementLocks, summariseLocks } from './casementHardware.js';
import { getWindowProfile, getCasementProfile, getDoorProfile, DEFAULT_DOOR_PROFILE, profileSashDepth, profileBoardWidth, boardWidthForDepth, profileBoxDepth, kgPerM } from './profile.js';
import { buildArchGeometry, buildSashArchGeometry, planArchSegments, buildGlassOutline, buildArchBars, glassOutlinePoly, chainAreaAboveLine, ArchError, isCircleShape, buildCircleGeometry, buildCircleGlassOutline, buildCircleBars } from './arch.js';
import { buildTraceryForDerived } from './cnc/traceryExport.js';

/**
 * calculations.js - ETAP 3
 * Comprehensive sash window calculation engine supporting multiple configurations.
 */

export const CONSTANTS = Object.freeze({
    // Weight margin: % added on top of timber+glass for hardware, seals and
    // paint (Piotr 02.08.2026). Moves to per-tenant Settings in a later pass.
    WEIGHT_MARGIN_PCT: 5,
    // Frame <-> Sash deductions
    SASH_WIDTH_DEDUCTION: 178,
    // Total sash height deduction from frame: top_sash + bot_sash = frame_height - 92
    // Bottom sash is 33mm taller than top sash
    SASH_HEIGHT_DEDUCTION: 92,
    GLASS_REBATE: 12.5,           // glass sits this deep into each rail/stile rebate
    SASH_HEIGHT_DIFFERENCE: 33,   // legacy fallback — live value = bottomRail.face − topRail.face (sashFaces().diff)

    // Frame component deductions (verified against Excel)
    JAMB_HEIGHT_DEDUCTION: 108,
    HEAD_WIDTH_DEDUCTION: 0,
    SILL_WIDTH_DEDUCTION: 0,
    EXTERNAL_HEAD_LINER_DEDUCTION: 204,
    INTERNAL_HEAD_LINER_DEDUCTION: 172,

    // Frame/box depths (mm) per frame type; triple glazing forces the deeper box
    FRAME_DEPTH_STANDARD: 164,
    FRAME_DEPTH_SLIM: 144,
    FRAME_DEPTH_TRIPLE: 172,
    FRAME_DEPTH_HERITAGE: 134,

    // Sash finished depth (mm) per frame type — face widths stay the same,
    // raw stock stays 63x63 / 63x95; only the planed depth differs.
    SASH_DEPTH_STANDARD: 57,
    SASH_DEPTH_SLIM: 47,
    SASH_DEPTH_HERITAGE: 42,
    SASH_DEPTH_TRIPLE: 61,
    // Head/Jamb board width = box depth − inset (164−23=141, 144→121, 134→111, 172→149)
    BOX_BOARD_INSET: 23,

    // Timber dimensions (mm) - visible from front elevation
    JAMBS_WIDTH: 28,
    HEAD_WIDTH: 28,
    SILL_WIDTH: 46,

    // Glazing bars
    GLAZING_BAR_WIDTH: 18,
    GLAZING_BAR_DEPTH: 35,

    // Sash components (mm) - verified against Excel
    STILE_WIDTH: 57,
    TOP_RAIL_WIDTH: 57,
    BOTTOM_RAIL_WIDTH: 90,
    MEETING_RAIL_WIDTH: 43,

    // Horn allowances
    HORN_ALLOWANCE_VERTICAL: 70,
    HORN_ALLOWANCE_HORIZONTAL: 30,

    // Glass deduction from sash width (verified against Excel: glass_w = sash_w - 89)
    // = 2×stile(57) - 2×rebate(12.5) = 114 - 25 = 89
    GLASS_WIDTH_DEDUCTION: 89,
    // Glass deduction from sash height (verified against Excel: glass_h = top_sash_h - 75)
    // = topRail(57) + meetRail(43) - 2×rebate(12.5) = 100 - 25 = 75
    GLASS_HEIGHT_DEDUCTION: 75,

    // Tolerances
    GLASS_TOLERANCE: 3,

    // Timber sections (for reporting) - verified against Excel
    FRAME_SECTION: '28 x 141',
    SILL_SECTION: '69 x 127',
    SASH_SECTION: '57 x 57',
    BOTTOM_RAIL_SECTION: '57 x 90',
    MEETING_RAIL_SECTION: '57 x 43',
    HEAD_LINER_EXT_SECTION: '17 x 102',
    HEAD_LINER_INT_SECTION: '17 x 86',
    JAMB_LINER_EXT_SECTION: '17 x 102',
    JAMB_LINER_INT_SECTION: '17 x 86',

    // Waste factors
    FRAME_WASTE_FACTOR: 1.15,
    SASH_WASTE_FACTOR: 1.15,

    // Miscellaneous
    VAT_RATE: 0.2
});

/** Live sash face widths from the active (or snapshotted) profile.
 *  Schematic drawings keep CONSTANTS; all calculations use these. */
function sashFaces() {
    const e = getWindowProfile().elements || {};
    const stile = Number(e.stiles?.face) || CONSTANTS.STILE_WIDTH;
    const top = Number(e.topRail?.face) || CONSTANTS.TOP_RAIL_WIDTH;
    const meet = Number(e.meetingRail?.face) || CONSTANTS.MEETING_RAIL_WIDTH;
    const bottom = Number(e.bottomRail?.face) || CONSTANTS.BOTTOM_RAIL_WIDTH;
    return { stile, top, meet, bottom, diff: bottom - top };
}

/** dedSchema 2: total sash height = frame H − opening deduction + meeting rail. */
function totalSashHeightFor(frameHeight) {
    const p = getWindowProfile();
    const mr = Number(p.elements?.meetingRail?.face) || CONSTANTS.MEETING_RAIL_WIDTH;
    return frameHeight - p.deductions.sashHeight + mr;
}


export const CONFIGURATIONS = Object.freeze({
    'none': {
        key: 'none',
        rows: 1,
        cols: 1,
        totalPanes: 1,
        verticalBars: 0,
        horizontalBars: 0,
        description: 'No bars'
    },
    '2x2': {
        key: '2x2',
        rows: 1,
        cols: 2,
        totalPanes: 2,
        verticalBars: 1,
        horizontalBars: 0,
        description: '2 over 2'
    },
    '3x3': {
        key: '3x3',
        rows: 1,
        cols: 3,
        totalPanes: 3,
        verticalBars: 2,
        horizontalBars: 0,
        description: '3 over 3'
    },
    '4x4': {
        key: '4x4',
        rows: 2,
        cols: 2,
        totalPanes: 4,
        verticalBars: 1,
        horizontalBars: 1,
        description: '4 over 4'
    },
    '6x6': {
        key: '6x6',
        rows: 2,
        cols: 3,
        totalPanes: 6,
        verticalBars: 2,
        horizontalBars: 1,
        description: '6 over 6'
    },
    '9x9': {
        key: '9x9',
        rows: 3,
        cols: 3,
        totalPanes: 9,
        verticalBars: 2,
        horizontalBars: 2,
        description: '9 over 9'
    },
    custom: {
        key: 'custom',
        rows: null,
        cols: null,
        description: 'Custom Configuration'
    }
});

/**
 * Entry point used by UI and exports.
 */
export function calculateWindow(frameWidth, frameHeight, configuration = '2x2', options = {}) {
    const configData = resolveConfiguration(configuration, options);

    validateInputs(frameWidth, frameHeight, configData);

    const sashWidth = frameWidth - getWindowProfile().deductions.sashWidth;
    const totalSashHeight = totalSashHeightFor(frameHeight);
    const sashDiff = sashFaces().diff;
    const topSashHeight = (totalSashHeight - sashDiff) / 2;
    const bottomSashHeight = topSashHeight + sashDiff;
    // For legacy compatibility, sashHeight = totalSashHeight
    const sashHeight = totalSashHeight;

    const frameComponents = calculateFrameComponents(frameWidth, frameHeight);
    const sashComponents = calculateSashComponents(sashWidth, sashHeight, configData);
    const glazing = calculateGlazing(sashWidth, sashHeight, configData, options.glazingType);
    const precutList = buildPrecutList(frameComponents, sashComponents);
    const cutList = buildCutList(frameComponents, sashComponents);
    const shoppingList = buildShoppingList(frameComponents, sashComponents, glazing, options);

    return {
        frame: {
            width: frameWidth,
            height: frameHeight
        },
        sash: {
            width: sashWidth,
            height: sashHeight,
            topHeight: topSashHeight,
            bottomHeight: bottomSashHeight
        },
        components: {
            frame: frameComponents,
            sash: sashComponents
        },
        glazing,
        precutList,
        cutList,
        shoppingList,
        shopping: shoppingList,
        options: buildOptionSet(options),
        config: configData.key,
        configuration: configData
    };
}

function parseSection(section) {
    if (!section) return { width: null, height: null };
    const normalised = section.replace(/×/g, 'x');
    const parts = normalised.split('x').map((value) => Number(value.trim()));
    return { width: parts[0] ?? null, height: parts[1] ?? null };
}

function round(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function createComponentRecord(windowSpec, group, elementName, section, length, quantity = 1, notes = '') {
    const sectionInfo = parseSection(section);
    return {
        windowId: windowSpec.id,
        windowName: windowSpec.name,
        group,
        elementName,
        section,
        sizeLabel: section,
        finishedWidth: sectionInfo.height ?? sectionInfo.width ?? null,
        thickness: sectionInfo.width ?? null,
        length: round(length),
        quantity,
        notes,
    };
}

function calculateSashComponentSet(windowSpec, settings, sashWidth, topSashHeight, bottomSashHeight, suffix = '') {
    const hornExtra = windowSpec.sash?.horns ? Number(windowSpec.sash?.hornExtension ?? getWindowProfile().hornExtension ?? settings?.hornExtensionDefault ?? 70) : 0;
    const railLength = sashWidth;
    const sfx = suffix ? ` ${suffix}` : '';

    // Finished sash depth from the frame variant; face widths from the profile
    const prof = getWindowProfile();
    const sd = sashDepthFor(windowSpec.frame?.type);
    const fStile = prof.elements.stiles.face;
    const fTop = prof.elements.topRail.face;
    const fMeet = prof.elements.meetingRail.face;
    const fBottom = prof.elements.bottomRail.face;
    const sashComponents = [];
    sashComponents.push(createComponentRecord(windowSpec, 'sash', `TOP RAIL${sfx}`, `${sd}x${fTop}`, railLength, 1));
    sashComponents.push(createComponentRecord(windowSpec, 'sash', `STILES TOP (L)${sfx}`, `${sd}x${fStile}`, topSashHeight + hornExtra, 1));
    sashComponents.push(createComponentRecord(windowSpec, 'sash', `STILES TOP (R)${sfx}`, `${sd}x${fStile}`, topSashHeight + hornExtra, 1));
    sashComponents.push(createComponentRecord(windowSpec, 'sash', `TOP MEET RAIL${sfx}`, `${sd}x${fMeet}`, railLength, 1));
    sashComponents.push(createComponentRecord(windowSpec, 'sash', `BOTTOM MEET RAIL${sfx}`, `${sd}x${fMeet}`, railLength, 1));
    sashComponents.push(createComponentRecord(windowSpec, 'sash', `STILES BOTTOM SASH (L)${sfx}`, `${sd}x${fStile}`, bottomSashHeight, 1));
    sashComponents.push(createComponentRecord(windowSpec, 'sash', `STILES BOTTOM SASH (R)${sfx}`, `${sd}x${fStile}`, bottomSashHeight, 1));
    sashComponents.push(createComponentRecord(windowSpec, 'sash', `BOTTOM RAIL${sfx}`, `${sd}x${fBottom}`, railLength, 1));

    return sashComponents;
}

function tripleSectionWidths(windowSpec, sashWidth) {
    const prof = getWindowProfile();
    const mullionFace = prof.elements.mullion?.face || 50;
    const split = windowSpec.sash?.splitRatio || '1/4-1/2-1/4';
    let leftR = 0.25, centerR = 0.5;
    if (split === '1/3-1/3-1/3') { leftR = 1 / 3; centerR = 1 / 3; }
    else if (split === '1/5-3/5-1/5') { leftR = 0.2; centerR = 0.6; }
    const avail = sashWidth - 2 * mullionFace;
    const left = Math.round(avail * leftR);
    const center = Math.round(avail * centerR);
    const right = avail - left - center;
    return { left, center, right, mullionFace };
}

function calculateTripleSashComponentSet(windowSpec, settings, sashWidth, topSashHeight, bottomSashHeight, frameHeight) {
    const { left, center, right, mullionFace } = tripleSectionWidths(windowSpec, sashWidth);
    const prof = getWindowProfile();
    const bw = windowSpec.frame?.type ? profileBoardWidth(windowSpec.frame.type) : boxBoardWidthFor(windowSpec.frame?.depth);
    const jambLength = frameHeight - prof.deductions.jambHeight;

    const parts = [
        ...calculateSashComponentSet(windowSpec, settings, left, topSashHeight, bottomSashHeight, '(FIX L)'),
        ...calculateSashComponentSet(windowSpec, settings, center, topSashHeight, bottomSashHeight, '(C)'),
        ...calculateSashComponentSet(windowSpec, settings, right, topSashHeight, bottomSashHeight, '(FIX R)'),
    ];
    // Two mullion posts — treated like intermediate jamb boards (FLAGGED section)
    parts.push(createComponentRecord(windowSpec, 'sash', `MULLION (L)`, `${mullionFace}x${bw}`, jambLength, 1));
    parts.push(createComponentRecord(windowSpec, 'sash', `MULLION (R)`, `${mullionFace}x${bw}`, jambLength, 1));
    return parts;
}

function calculateBoxComponentSet(windowSpec, frameWidth, frameHeight) {
    const prof = getWindowProfile();
    const els = prof.elements;
    const cillExtension = Number(windowSpec.cill?.extension ?? 0);
    const headLength = frameWidth - prof.deductions.headWidth;
    const jambLength = frameHeight - prof.deductions.jambHeight;
    const extHeadLinerLength = frameWidth - els.extHeadLiner.deduction;
    const intHeadLinerLength = frameWidth - els.intHeadLiner.deduction;
    const extJambLinerLength = frameHeight - els.extJambLiner.deduction;
    const intJambLinerLength = frameHeight - els.intJambLiner.deduction;

    const bw = windowSpec.frame?.type ? profileBoardWidth(windowSpec.frame.type) : boxBoardWidthFor(windowSpec.frame?.depth);
    const bt = els.head.thickness;
    const boxComponents = [];
    boxComponents.push(createComponentRecord(windowSpec, 'box', 'HEAD', `${bt}x${bw}`, headLength, 1));
    boxComponents.push(createComponentRecord(windowSpec, 'box', 'CILL', `${els.cill.w}x${els.cill.h}`, headLength + cillExtension, 1, `Extension ${cillExtension}mm`));
    if (prof.cillTwoPiece) {
        boxComponents.push(createComponentRecord(windowSpec, 'box', 'CILL NOSE', `${els.cillNose.w}x${els.cillNose.h}`, headLength + cillExtension, 1));
    }
    boxComponents.push(createComponentRecord(windowSpec, 'box', 'JAMB LEFT', `${bt}x${bw}`, jambLength, 1));
    boxComponents.push(createComponentRecord(windowSpec, 'box', 'JAMB RIGHT', `${bt}x${bw}`, jambLength, 1));
    boxComponents.push(createComponentRecord(windowSpec, 'box', 'INTERNAL HEAD LINER', `${els.intHeadLiner.w}x${els.intHeadLiner.h}`, intHeadLinerLength, 1));
    boxComponents.push(createComponentRecord(windowSpec, 'box', 'EXTERNAL HEAD LINER', `${els.extHeadLiner.w}x${els.extHeadLiner.h}`, extHeadLinerLength, 1));
    boxComponents.push(createComponentRecord(windowSpec, 'box', 'INTERNAL JAMB LINER (L)', `${els.intJambLiner.w}x${els.intJambLiner.h}`, intJambLinerLength, 1));
    boxComponents.push(createComponentRecord(windowSpec, 'box', 'INTERNAL JAMB LINER (R)', `${els.intJambLiner.w}x${els.intJambLiner.h}`, intJambLinerLength, 1));
    boxComponents.push(createComponentRecord(windowSpec, 'box', 'EXTERNAL JAMB LINER (L)', `${els.extJambLiner.w}x${els.extJambLiner.h}`, extJambLinerLength, 1));
    boxComponents.push(createComponentRecord(windowSpec, 'box', 'EXTERNAL JAMB LINER (R)', `${els.extJambLiner.w}x${els.extJambLiner.h}`, extJambLinerLength, 1));

    return boxComponents;
}

function calculateGlazingSummaryForWindow(windowSpec, sashWidth, sashHeight, settings) {
    const grid = windowSpec.sash?.grid ?? { rows: 2, cols: 2 };
    const _f = sashFaces();
    const clearWidth = Math.max(sashWidth - 2 * _f.stile, 0);
    const clearHeight = Math.max((sashHeight / 2) - _f.top - _f.bottom, 0);

    const paneWidth = Math.max(
        clearWidth / Math.max(grid.cols ?? 1, 1) - settings.glazingAllowanceWidth,
        0,
    );
    const paneHeight = Math.max(
        clearHeight / Math.max(grid.rows ?? 1, 1) - settings.glazingAllowanceHeight,
        0,
    );

    return {
        windowId: windowSpec.id,
        windowName: windowSpec.name,
        width: round(paneWidth),
        height: round(paneHeight),
        rows: grid.rows,
        cols: grid.cols,
        panes: Math.max((grid.rows ?? 1) * (grid.cols ?? 1), 1) * 2,
        thickness: Number(windowSpec.glazing?.thickness ?? 0),
        makeup: windowSpec.glazing?.makeup ?? '',
        toughened: Boolean(windowSpec.glazing?.toughened),
        frosted: Boolean(windowSpec.glazing?.frosted),
        spacerColour: windowSpec.glazing?.spacerColour ?? 'White',
    };
}

const OFFCUT_FACTOR = 1.15; // 15% waste for off-cuts

// ─── Frame-dependent finished sections ───
export function sashDepthFor(frameType) {
    return profileSashDepth(frameType);
}
export function boxBoardWidthFor(frameDepth) {
    return boardWidthForDepth(frameDepth);
}

const GLASS_KG_PER_SQM = {
    'double': 21,
    'double_slim': 15,   // slim unit 16mm — verify vs Excel
    'triple': 33,
    'single': 12,    // single heritage laminated
    'passive': 12,   // vacuum
};

function calculateWeights(windowSpec, sashWidth, topSashHeight, bottomSashHeight) {
    const sw = sashWidth / 1000; // to meters
    // kg/m derived from finished section (profile) × timber density
    const prof = getWindowProfile();
    const sd = sashDepthFor(windowSpec.frame?.type);
    const KG_PER_METER = {
        stile: kgPerM(prof.elements.stiles.face, sd),
        topRail: kgPerM(prof.elements.topRail.face, sd),
        meetingRail: kgPerM(prof.elements.meetingRail.face, sd),
        bottomRail: kgPerM(prof.elements.bottomRail.face, sd),
    };

    // Upper sash: 2× stiles (57×57) + top rail (57×57) + meeting rail (57×43)
    const upperTimber =
        2 * (topSashHeight / 1000) * KG_PER_METER.stile +
        sw * KG_PER_METER.topRail +
        sw * KG_PER_METER.meetingRail;

    // Lower sash: 2× stiles (57×57) + bottom rail (57×90) + meeting rail (57×43)
    const lowerTimber =
        2 * (bottomSashHeight / 1000) * KG_PER_METER.stile +
        sw * KG_PER_METER.bottomRail +
        sw * KG_PER_METER.meetingRail;

    // Glass — both sashes (glassH identical for upper & lower)
    const _f = sashFaces();
    const glassW = sashWidth - 2 * _f.stile;
    const glassH = topSashHeight - _f.top - _f.meet;
    const glassType = windowSpec.glazing?.type || 'double';
    const kgPerSqm = GLASS_KG_PER_SQM[glassType] || GLASS_KG_PER_SQM['double'];
    const glassSqmPerSash = (glassW * glassH) / 1_000_000;
    const glassTotal = glassSqmPerSash * kgPerSqm * 2;

    const subtotal = upperTimber + lowerTimber + glassTotal;
    const total = round(subtotal * 1.05); // +5% silicone, clips, etc.

    return {
        timber: round(upperTimber + lowerTimber),
        glass: round(glassTotal),
        total,
        glassType,
        kgPerSqm,
    };
}

function calculatePaint(frameWidth, frameHeight) {
    return paintFromAreaSqm(round((frameWidth * frameHeight) / 1_000_000));
}

// Per 1.5 m²: 2L primer + 1L topcoat. Shared by the rectangular path (W × H)
// and the arched casement (true outline area, arched-casement-v2 B.6).
function paintFromAreaSqm(areaSqm) {
    return {
        areaSqm,
        primer: round((areaSqm / 1.5) * 2),
        topcoat: round((areaSqm / 1.5) * 1),
    };
}

function calculateConsumables(windowSpec, frameWidth, frameHeight, sashWidth, topSashHeight, bottomSashHeight) {
    const _f = sashFaces();
    const glassW = sashWidth - 2 * _f.stile;
    const glassH = topSashHeight - _f.top - _f.meet;
    const glassType = windowSpec.glazing?.type || 'double';

    const gridMode = windowSpec.sash?.grid?.mode || 'none';
    const pattern = BEADING_BAR_PATTERNS[gridMode] || BEADING_BAR_PATTERNS['none'];
    const barPerSash = (pattern.v * glassH) + (pattern.h * glassW);
    const perimPerSash = 2 * (glassW + glassH);

    // Glass area (m²)
    const glassSqm = round((glassW * glassH) / 1_000_000 * 2);

    // Cord — 3× frame height in meters
    const cordM = round((3 * frameHeight) / 1000);

    // Glazing clips — 20 per window, size depends on glass type + frame type
    // double/single/passive → 24mm, triple → 28mm, slim frame → 16mm
    const frameT = windowSpec.frame?.type;
    const isSlim = frameT === 'slim';
    const clipSize = frameT === 'heritage' ? 'heritage'
      : isSlim ? '16mm' : (glassType === 'triple' ? '28mm' : '24mm');
    const clipQty = 20;

    // Spacer 1mm — 20 per window
    const spacer1mmQty = 20;

    // Spacer 2mm — 4 per window
    const spacer2mmQty = 4;

    // Bead tape — (perim × 2 + bars × 4) × 2 sashes, NO off-cut
    const beadTapeM = round(((perimPerSash * 2) + (barPerSash * 4)) * 2 / 1000);

    // Silicone — 0.1 tube per meter of (perim + bars) × 2 sashes
    const siliconeMeters = ((perimPerSash + barPerSash) * 2) / 1000;
    const siliconeTubes = round(0.1 * siliconeMeters);

    // Weights — slim counterweights for slim AND heritage boxes (lighter glass, shallower box)
    const weightType = (isSlim || windowSpec.frame?.type === 'heritage') ? 'slim' : 'normal';

    // Seals — +10%
    const SEAL_FACTOR = 1.10;
    // Sliding Sash Seal 6070: sashW × 4 + topSashH × 4 + botSashH × 4
    const seal6070 = round((sashWidth * 4 + topSashHeight * 4 + bottomSashHeight * 4) * SEAL_FACTOR / 1000);
    // Bottom Seal 6009: sashW only
    const seal6009 = round(sashWidth * SEAL_FACTOR / 1000);

    return {
        glass: { type: glassType, sqm: glassSqm },
        cord: { meters: cordM },
        clips: { size: clipSize, qty: clipQty },
        spacer1mm: { qty: spacer1mmQty },
        spacer2mm: { qty: spacer2mmQty },
        beadTape: { meters: beadTapeM },
        silicone: { tubes: siliconeTubes },
        weightType,
        seal6070: { meters: seal6070 },
        seal6009: { meters: seal6009 },
    };
}

const BEADING_BAR_PATTERNS = {
    'none': { v: 0, h: 0 }, '2x2': { v: 1, h: 0 }, '3x3': { v: 2, h: 0 },
    '4x4': { v: 1, h: 1 }, '6x6': { v: 2, h: 1 }, '9x9': { v: 2, h: 2 },
};

function calculateBeadingComponents(windowSpec, frameWidth, frameHeight, sashWidth, topSashHeight) {
    const F = OFFCUT_FACTOR;
    const _f = sashFaces();
    const glassW = sashWidth - 2 * _f.stile;
    const glassH = topSashHeight - _f.top - _f.meet;

    const gridMode = windowSpec.sash?.grid?.mode || 'none';
    const pattern = BEADING_BAR_PATTERNS[gridMode] || BEADING_BAR_PATTERNS['none'];
    const barPerSash = (pattern.v * glassH) + (pattern.h * glassW);

    const rec = (name, lengthMm, notes) =>
        createComponentRecord(windowSpec, 'beading', name, 'profile', lengthMm, 1, notes);

    const beading = [];

    // 1. Glazing beading — perimeter of glass area × 2 sashes
    const perimPerSash = 2 * (glassW + glassH);
    beading.push(rec('GLAZING BEADING', round(perimPerSash * 2 * F),
        `Perim ${round(perimPerSash)} × 2 + 15%`));

    // 2. Triangle beading ext (only if bars exist)
    if (barPerSash > 0) {
        const barTotal = round(barPerSash * 2 * F);
        beading.push(rec('TRIANGLE BEADING (EXT)', barTotal,
            `Bars ${round(barPerSash)} × 2 + 15%`));
        // 3. Georgian middle beading (internal) — same length, glued other side of glass
        beading.push(rec('GEORGIAN MIDDLE BEADING', barTotal,
            `Bars ${round(barPerSash)} × 2 + 15%`));
    }

    // 4. Parting beading — 2× frame height + frame width
    beading.push(rec('PARTING BEADING', round((frameHeight * 2 + frameWidth) * F),
        `2×H(${frameHeight}) + W(${frameWidth}) + 15%`));

    // 5. Staff beading — full frame perimeter
    beading.push(rec('STAFF BEADING', round((frameWidth * 2 + frameHeight * 2) * F),
        `2×(W+H) = ${2 * (frameWidth + frameHeight)} + 15%`));

    // 6 & 7. Meeting beading A & B — sash width each (at end)
    beading.push(rec('MEETING BEADING A', round(sashWidth * F),
        `sashW(${sashWidth}) + 15%`));
    beading.push(rec('MEETING BEADING B', round(sashWidth * F),
        `sashW(${sashWidth}) + 15%`));

    return beading;
}

function emptyDerived(category, frameWidth, frameHeight) {
    return {
        unsupported: category,
        sashWidth: 0, sashHeight: 0, topSashHeight: 0, bottomSashHeight: 0,
        config: { key: 'none', rows: 0, cols: 0 },
        components: { sash: [], box: [], beading: [] },
        glazingItems: [],
        barPositions: { vertical: [], horizontal: [] },
        weights: { timber: 0, glass: 0, total: 0 },
        paint: { areaSqm: 0 },
        consumables: {},
        frame: { width: frameWidth, height: frameHeight },
    };
}

function deriveCasementWindow(windowSpec, frameWidth, frameHeight, settings = {}) {
    // ── Casement engine v1 — every number from the casement profile
    //    (casement-dimensioning-v1.md); no bare constants in formulas. ──
    const p = getCasementProfile();
    const els = p.elements;
    const ded = p.deductions;
    const geo = p.geometry;
    const fd = p.frameDepth;
    // Triple 28mm units need a deeper leaf rebate: 57 -> 61 (profile-driven).
    const ld = windowSpec.glazing?.type === 'triple'
        ? (p.leafDepthTriple || p.leafDepth)
        : p.leafDepth;
    const r1 = (v) => Math.round(v / p.rounding) * p.rounding / 1;
    const R = (v) => Math.round(v * 10) / 10; // one decimal, CNC-ready

    const cas = windowSpec.casement || {};
    // ── Arched casement (arched-casement-v2): ONE leaf, geometry from arch.js.
    //    The layout is forced to the single-leaf code of the hinge side and the
    //    hinge array is ignored (spec v1 §4.1); everything below the springing
    //    is the straight engine. Invalid arch numbers throw an ArchError —
    //    never a silent rectangle (every caller catches and shows the reason).
    const archSpec = windowSpec.arch && windowSpec.arch.shape ? windowSpec.arch : null;
    // ── Fixed window (v3 Block 3, Piotr 07.09): the casement frame
    //    + a NON-OPENING leaf — one panel (040L) whose hinge is 'fixed', so the
    //    hardware selectors return nothing and the leaf is a dummy sash; the
    //    circle is its own geometry (rings, no straight member). The profile
    //    switch fix.construction only knows 'fixedLeaf' tonight (BLOCKERS).
    const isFixed = cas.kind === 'fixed';
    const isCircle = !!archSpec && isCircleShape(archSpec.shape);
    if (isCircle && !isFixed) throw new ArchError('A circle window is a fixed window — set casementKind "fixed"');
    const fixConstruction = p.fix?.construction || 'fixedLeaf';
    if (isFixed && fixConstruction !== 'fixedLeaf') throw new ArchError(`Casement profile fix.construction "${fixConstruction}" is not implemented — only 'fixedLeaf' (frame + non-opening leaf) has workshop numbers`);
    const layout = isFixed ? '040L' : archSpec ? (archSpec.hinge === 'right' ? '040R' : '040L') : (cas.layout || '040L');

    // Layout geometry driven by the PROFILE faces (68 / 68 / 68 defaults from
    // v4 Block F; the 3D receives the same faces via windowSpecToConfig).
    const GEO = {
        frameFace: els.frameHead.face,
        bottomFace: els.frameCill.face,
        mullionW: els.mullion.face,
    };
    const innerW = frameWidth - 2 * GEO.frameFace;
    const innerH = frameHeight - GEO.frameFace - GEO.bottomFace;
    const layoutDef = resolveCasementLayout({
        code: layout, innerW, innerH, height: frameHeight,
        fanlightRatio: fanAxisToRatio(cas.fanlightHeight, innerH),
        fan2Ratio: fan2AxisToRatio(cas.fan2Height, frameHeight, innerH),
        middleSectionMm: Number(cas.middleWidth) || 0,
        casementHinges: isFixed ? ['fixed'] : archSpec ? null : cas.hinges,
        geo: GEO,
    });

    const secFrame = `${els.frameHead.face}x${fd}`;
    const secCill = `${els.frameCill.face}x${fd}`;
    const secMull = `${els.mullion.face}x${fd}`;
    const secTrans = `${els.transom.face}x${fd}`;
    const secLeaf = `${els.leafStile.face}x${ld}`;
    // Glass follows the leaf member face: a wider member eats into the light
    // on BOTH sides (Piotr 04.08). glassInset = how deep the pane sits in the
    // rebate, per side. Falls back to the stored deduction for old profiles.
    const glassInset = p.geometry?.glassInset;
    const glassDed = (glassInset == null)
      ? ded.glass
      : R(2 * (els.leafStile.face - glassInset));

    // Bar counts per pane role (straight bars; on an arched leaf they are the
    // straight bars below the springing / across the clear width).
    const casBars = cas.bars || {
        h: Number(windowSpec.casementHBars) || 0,
        v: Number(windowSpec.casementVBars) || 0,
        fanH: Number(windowSpec.casementFanHBars) || 0,
        fanV: Number(windowSpec.casementFanVBars) || 0,
        fan2H: Number(windowSpec.casementFan2HBars) || 0,
        fan2V: Number(windowSpec.casementFan2VBars) || 0,
    };

    // ── Arch geometry, blank plans, glass outline and bars — profile numbers only ──
    let AG = null, archPlans = null, archOutline = null, archBars = null, glassBottomEdge = null, archTracery = null;
    if (isCircle) {
        // circle (v3 Block 3): frame ring + leaf ring on the profile faces, the
        // glass a full circle at leafInner − glassInset, bars = chords + sunburst
        AG = buildCircleGeometry({ width: frameWidth, height: frameHeight }, p);
        archPlans = { frameHead: planArchSegments(AG.frameHead, p.arch, p.cnc), leafTop: planArchSegments(AG.leafTop, p.arch, p.cnc) };
        archOutline = buildCircleGlassOutline(AG.glass.arcs);
        glassBottomEdge = frameHeight / 2 - AG.glass.radius;
        archBars = buildCircleBars({
            outline: archOutline, pattern: archSpec.bars?.pattern || 'none',
            h: casBars.h, v: casBars.v, circleOffset: archSpec.bars?.circleOffset,
        }, p.arch?.patterns);
        if (archBars.pattern !== 'none' && p.tracery) {
            archTracery = buildTraceryForDerived({ arch: { glassOutline: archOutline, bars: archBars.bars, pattern: archBars.pattern } }, p, windowSpec.name || '');
        }
    } else if (archSpec) {
        if (glassInset == null) throw new ArchError('Casement profile geometry.glassInset is missing — required for the arched glass outline');
        AG = buildArchGeometry({ shape: archSpec.shape, width: frameWidth, height: frameHeight, rise: archSpec.rise }, p);
        archPlans = { frameHead: planArchSegments(AG.frameHead, p.arch, p.cnc), leafTop: planArchSegments(AG.leafTop, p.arch, p.cnc) };
        // Glass bottom edge from the frame bottom: cill side of the leaf
        // (gap + cill land = leafFullHeight − leafAtJamb) + bottom rail face − glass inset.
        const cillSide = ded.leafFullHeight - ded.leafAtJamb;
        glassBottomEdge = cillSide + (els.leafBottom.face - glassInset);
        archOutline = buildGlassOutline(AG.glass.arcs, AG.glass.halfWidth, AG.start - glassBottomEdge);
        archBars = buildArchBars({
            outline: archOutline, shape: AG.shape, pattern: archSpec.bars?.pattern || 'none',
            h: casBars.h, v: casBars.v, frameHalfWidth: frameWidth / 2,
            spokes: archSpec.bars?.spokes, rings: archSpec.bars?.rings,
        }, p.arch?.patterns);
        // v3 0.4: the timber tracery (one board, one side) over the unit when a
        // pattern is set — geometry from traceryExport.js on the same bar list
        if (archBars.pattern !== 'none' && p.tracery) {
            archTracery = buildTraceryForDerived({ arch: { glassOutline: archOutline, bars: archBars.bars, pattern: archBars.pattern } }, p, windowSpec.name || '');
        }
    }

    // Record helper: profile rounding (0.1) + element letter code on top of
    // the shared record shape (createComponentRecord rounds to integers).
    const mk = (group, name, section, length, qty, code, notes = '') => {
        const rec = createComponentRecord(windowSpec, group, name, section, length, qty, notes);
        rec.length = R(length);
        rec.code = code;
        return rec;
    };

    // ── Frame: full external dimensions (comb / finger / T&G joints) ──
    const cillWider = !!windowSpec.cill?.wider;
    const cillLength = R(frameWidth + (cillWider ? 100 : 0) - (p.lengths.cillDeduct || 0));
    // Arched: the head is a curved member — length = arc length at the ring
    // CENTRE line, notes = radii / pieces / stock from the blank planner — and
    // the jambs stop at the springing line (straight part only).
    const archNotes = (plan, ring) => {
        const radii = ring.outer.map((a) => Math.round(a.r)).join('/');
        if (plan.noStock) return `R ${radii} · no stock board fits`;
        return `R ${radii} · ${plan.totalPieces} pieces · stock ${plan.arcs.map((a) => a.default.stock).join('/')}`;
    };
    const jambLen = R((archSpec ? AG.start : frameHeight) - (p.lengths.jambDeduct || 0));
    const box = isCircle ? [
        // circle: the whole frame is ONE ring (finger-jointed blank, planner notes)
        mk('box', 'C-FRAME RING', secFrame, AG.frameHead.lengths.centre, 1, 'C-FRR', `${archNotes(archPlans.frameHead, AG.frameHead)} · fixed leaf`),
    ] : [
        archSpec
            ? mk('box', 'C-ARCH HEAD', secFrame, AG.frameHead.lengths.centre, 1, 'C-AH', archNotes(archPlans.frameHead, AG.frameHead))
            : mk('box', 'C-FRAME HEAD', secFrame, R(frameWidth - (p.lengths.headDeduct || 0)), 1, 'C-H'),
        mk('box', 'C-FRAME CILL', secCill, cillLength, 1, 'C-CILL',
            cillWider ? 'wider +50mm each side' : ''),
        mk('box', 'C-FRAME JAMB (L)', secFrame, jambLen, 1, 'C-J/L'),
        mk('box', 'C-FRAME JAMB (R)', secFrame, jambLen, 1, 'C-J/R'),
    ];

    // ── Panel bounds in absolute frame coordinates ──
    // Layout coords: panels centred on the glass area; transom y from frame
    // bottom; mullion x from the frame outside edge.
    const cx = GEO.frameFace + innerW / 2;
    const cy = GEO.bottomFace + innerH / 2; // from bottom
    const eps = 0.6;
    const halfMull = els.mullion.face / 2;

    const paneBounds = layoutDef.panels.map((pn) => {
        const leftAbs = cx + pn.x - pn.w / 2;
        const rightAbs = cx + pn.x + pn.w / 2;
        const bottomAbs = cy + pn.y - pn.h / 2; // from frame bottom
        const topAbs = cy + pn.y + pn.h / 2;
        const leftIsJamb = Math.abs(leftAbs - GEO.frameFace) < eps;
        const rightIsJamb = Math.abs(rightAbs - (frameWidth - GEO.frameFace)) < eps;
        const topIsHead = Math.abs(topAbs - (frameHeight - GEO.frameFace)) < eps;
        const bottomIsCill = Math.abs(bottomAbs - GEO.bottomFace) < eps;
        return {
            leftAxis: leftIsJamb ? 0 : leftAbs - halfMull,
            rightAxis: rightIsJamb ? frameWidth : rightAbs + halfMull,
            leftIsJamb, rightIsJamb, topIsHead, bottomIsCill,
            // Transom axes as "T" (frame TOP -> axis), matching the profile formulas
            topAxisT: topIsHead ? 0 : frameHeight - (topAbs + halfMull),
            bottomAxisT: bottomIsCill ? frameHeight : frameHeight - (bottomAbs - halfMull),
        };
    });

    // ── Leaf sizes — Piotr's formulas verbatim, per pane ──
    const leafSizes = paneBounds.map((b) => {
        const span = b.rightAxis - b.leftAxis;
        const leafW = span
            - (b.leftIsJamb ? ded.leafAtJamb : ded.leafAtMullionAxis)
            - (b.rightIsJamb ? ded.leafAtJamb : ded.leafAtMullionAxis);
        let leafH;
        let heightNote = '';
        if (b.topIsHead && b.bottomIsCill) {
            leafH = frameHeight - ded.leafFullHeight;
        } else if (b.topIsHead) {
            leafH = b.bottomAxisT - ded.fanFromAxis;                 // fan tier
        } else if (b.bottomIsCill) {
            leafH = frameHeight - b.topAxisT - ded.lowerFromAxis;    // lower tier
        } else {
            leafH = (b.bottomAxisT - b.topAxisT) - ded.middleTierFromAxes; // 3-tier middle
            heightNote = 'UNCONFIRMED middle-tier deduction';
        }
        return { leafW: R(leafW), leafH: R(leafH), heightNote };
    }).map((s) => (isCircle ? { leafW: R(2 * AG.leafTop.outer[0].r), leafH: R(2 * AG.leafTop.outer[0].r), heightNote: '' } : s));

    // ── Leaf rectangles (mm, origin = frame top-left, exterior view) ──
    const leafRects = paneBounds.map((b, i) => {
        const x = b.leftIsJamb
            ? geo.land + geo.gap
            : b.leftAxis + geo.mullionLand / 2 + geo.gap;
        const y = b.topIsHead
            ? geo.land + geo.gap
            : b.topAxisT + geo.transomLandBelow + geo.gapBelowTransom;
        return { x: R(x), y: R(y), w: leafSizes[i].leafW, h: leafSizes[i].leafH };
    });

    // ── Drawing-ready member runs (mm, exterior view) ──
    const landX = (b, side) => side === 'L'
        ? (b.leftIsJamb ? geo.land : b.leftAxis + geo.mullionLand / 2)
        : (b.rightIsJamb ? frameWidth - geo.land : b.rightAxis - geo.mullionLand / 2);
    const transomRuns = [];
    const mullionRuns = [];

    // ── Mullions: full-height run through (extH − lengths.mullion);
    //    partial tier dividers (031/032) use the provisional transom-style rule. ──
    const sash = [];
    let mullIdx = 0;
    (layoutDef.mullions || []).forEach((mu) => {
        mullIdx += 1;
        const idx = (layoutDef.mullions.length > 1) ? String(mullIdx) : '';
        if (typeof mu === 'number') {
            sash.push(mk('sash', 'C-MULLION', secMull, frameHeight - p.lengths.mullion, 1, `C-M${idx}`));
            mullionRuns.push({
                axisX: R(mu), full: true,
                x1: R(mu - geo.mullionLand / 2), x2: R(mu + geo.mullionLand / 2),
                yTop: geo.land, yBottom: R(frameHeight - geo.cillVisible),
                code: `C-M${idx}`, length: R(frameHeight - p.lengths.mullion),
            });
        } else {
            // Partial mullion spans one tier; adjacent tier = the pane tier it divides.
            const tierPane = mu.touchesTop
                ? leafSizes[paneBounds.findIndex((b) => b.topIsHead)]
                : leafSizes[paneBounds.findIndex((b) => b.bottomIsCill)];
            const len = (tierPane ? tierPane.leafH : 0) + p.lengths.partialMullionSeat;
            sash.push(mk('sash', 'C-MULLION', secMull, len, 1, `C-M${idx}`,
                'partial · UNCONFIRMED length rule'));
            const tierIdx = mu.touchesTop
                ? paneBounds.findIndex((b) => b.topIsHead)
                : paneBounds.findIndex((b) => b.bottomIsCill);
            const tb = tierIdx >= 0 ? paneBounds[tierIdx] : null;
            mullionRuns.push({
                axisX: R(mu.x), full: false,
                x1: R(mu.x - geo.mullionLand / 2), x2: R(mu.x + geo.mullionLand / 2),
                yTop: tb && !mu.touchesTop ? R(tb.topAxisT + geo.transomLandBelow) : geo.land,
                yBottom: tb && mu.touchesTop
                    ? R(tb.bottomAxisT - geo.transomLandAbove)
                    : R(frameHeight - geo.cillVisible),
                code: `C-M${idx}`, length: R(len),
            });
        }
    });

    // ── Transoms: one segment per layout entry; length = field leaf width + seat ──
    let transIdx = 0;
    const transomCount = (layoutDef.transoms || []).length;
    (layoutDef.transoms || []).forEach((tr) => {
        transIdx += 1;
        const idx = transomCount > 1 ? String(transIdx) : '';
        let fieldLeafW;
        if (typeof tr === 'number' || tr.width === undefined) {
            // Full-width transom: its field spans jamb to jamb.
            fieldLeafW = frameWidth - 2 * ded.leafAtJamb;
        } else {
            // Sided segment: find the pane whose centre matches the segment centre.
            const segCentreAbs = cx + (tr.offsetX || 0);
            const i = layoutDef.panels.findIndex(
                (pn) => Math.abs((cx + pn.x) - segCentreAbs) < eps
            );
            fieldLeafW = i >= 0 ? leafSizes[i].leafW : frameWidth - 2 * ded.leafAtJamb;
        }
        sash.push(mk('sash', 'C-TRANSOM', secTrans, fieldLeafW + p.lengths.transomSeat, 1, `C-T${idx}`));
        // Drawing run: land band asymmetric around the axis (8 above / 13 below)
        const axisFromBottom = typeof tr === 'number' ? tr : tr.y;
        const axisT = R(frameHeight - axisFromBottom);
        let x1, x2;
        if (typeof tr === 'number' || tr.width === undefined) {
            x1 = geo.land; x2 = frameWidth - geo.land;
        } else {
            const segCentreAbs2 = cx + (tr.offsetX || 0);
            const pi = layoutDef.panels.findIndex(
                (pn) => Math.abs((cx + pn.x) - segCentreAbs2) < eps
            );
            const b = pi >= 0 ? paneBounds[pi] : null;
            x1 = b ? landX(b, 'L') : geo.land;
            x2 = b ? landX(b, 'R') : frameWidth - geo.land;
        }
        transomRuns.push({
            axisT, x1: R(x1), x2: R(x2),
            bandTop: R(axisT - geo.transomLandAbove),
            bandBottom: R(axisT + geo.transomLandBelow),
            code: `C-T${idx}`, length: R(fieldLeafW + p.lengths.transomSeat),
        });
    });

    // ── Leaf members per pane — vertogen: all four at full leaf dimensions.
    //    Fixed panes are dummy sashes: identical timber, no hardware. ──
    const hingeFn = (hinge, side) => {
        if (hinge === 'left') return side === 'L' ? 'hinge' : 'lock';
        if (hinge === 'right') return side === 'R' ? 'hinge' : 'lock';
        return '';
    };
    layoutDef.panels.forEach((pn, i) => {
        const s = leafSizes[i];
        const pcode = `P${i + 1}`;
        const dummy = pn.hinge === 'fixed' ? (isFixed ? 'fixed leaf' : 'dummy sash') : '';
        const noteBase = [dummy, s.heightNote].filter(Boolean).join(' · ');
        const fnL = hingeFn(pn.hinge, 'L'), fnR = hingeFn(pn.hinge, 'R');
        if (isCircle) {
            // circle: the leaf is ONE ring — no stiles, no rails
            sash.push(mk('sash', 'C-LEAF RING', secLeaf, AG.leafTop.lengths.centre, 1, `C-LFR-${pcode}`,
                [archNotes(archPlans.leafTop, AG.leafTop), noteBase].filter(Boolean).join(' · ')));
            if (archTracery) {
                const T = archTracery.T, bb = archTracery.geom.bbox;
                const allow = Number(p.arch?.contourAllowance) || 0;
                const blankW = R(bb.maxX - bb.minX + 2 * allow), blankH = R(bb.maxY - bb.minY + 2 * allow);
                sash.push(mk('sash', 'C-TRACERY', `${T.boardThickness}x${blankW}`, blankH, T.sides, `C-TRY-${pcode}`,
                    `blank ${blankW} x ${blankH} · ${archBars.pattern} · ${archTracery.geom.panes.length} panes · ${archTracery.geom.mode}`));
            }
            return;
        }
        // Arched leaf: the stiles run from the leaf bottom to the springing line
        // (straight part only) and the top rail is the curved member.
        const stileLen = R((archSpec ? AG.leafStraightStile : s.leafH) - (p.lengths.stileDeduct || 0));
        sash.push(mk('sash', 'C-STILE (L)', secLeaf, stileLen, 1, `C-ST/L-${pcode}`,
            [fnL, noteBase].filter(Boolean).join(' · ')));
        sash.push(mk('sash', 'C-STILE (R)', secLeaf, stileLen, 1, `C-ST/R-${pcode}`,
            [fnR, noteBase].filter(Boolean).join(' · ')));
        if (archSpec) {
            sash.push(mk('sash', 'C-ARCH TOP RAIL', secLeaf, AG.leafTop.lengths.centre, 1, `C-ATR-${pcode}`,
                [archNotes(archPlans.leafTop, AG.leafTop), noteBase].filter(Boolean).join(' · ')));
        } else {
            sash.push(mk('sash', 'C-TOP RAIL', secLeaf, R(s.leafW - (p.lengths.topRailDeduct || 0)), 1, `C-TR-${pcode}`,
                [pn.hinge === 'top' ? 'hinge' : '', noteBase].filter(Boolean).join(' · ')));
        }
        sash.push(mk('sash', 'C-BOTTOM RAIL', secLeaf, R(s.leafW - (p.lengths.bottomRailDeduct || 0)), 1, `C-BR-${pcode}`,
            [pn.hinge === 'top' ? 'lock' : '', noteBase].filter(Boolean).join(' · ')));
        // v3 0.4: tracery board — qty = sides, section = board thickness x blank W,
        // length = blank H (bounding box of the board outline + contourAllowance)
        if (archSpec && archTracery) {
            const T = archTracery.T, bb = archTracery.geom.bbox;
            const allow = Number(p.arch?.contourAllowance) || 0;
            const blankW = R(bb.maxX - bb.minX + 2 * allow), blankH = R(bb.maxY - bb.minY + 2 * allow);
            sash.push(mk('sash', 'C-TRACERY', `${T.boardThickness}x${blankW}`, blankH, T.sides, `C-TRY-${pcode}`,
                `blank ${blankW} x ${blankH} · ${archBars.pattern} · ${archTracery.geom.panes.length} panes · ${archTracery.geom.mode}`));
        }
    });

    // ── Glass: one 24 mm unit per pane (fixed = dummy sash, same math) ──
    const paneGlass = archSpec
        ? [{
            // Shaped unit: width × height = bounding box (rectangular consumers
            // keep working); `shape` carries the true outline and the bars in
            // the glass frame (origin = unit bottom-left, y up) for the glazier.
            width: R(archOutline.width),
            height: R(archOutline.height),
            location: isCircle ? 'circle leaf' : 'arched leaf',
            role: 'main',
            qty: 1,
            shape: {
                kind: isCircle ? 'circle' : 'arched',
                archShape: AG.shape,
                outline: archOutline,
                poly: glassOutlinePoly(archOutline),
                springing: R(archOutline.springing),
                apex: R(archOutline.apex),
                rise: R(archOutline.rise),
                radii: archOutline.radii.map(R),
                area: archOutline.area,
                perimeter: archOutline.perimeter,
                bars: archBars.bars,
                pattern: archBars.pattern,
                barCounts: archBars.counts,
            },
        }]
        : layoutDef.panels.map((pn, i) => ({
            width: Math.max(0, R(leafSizes[i].leafW - glassDed)),
            height: Math.max(0, R(leafSizes[i].leafH - glassDed)),
            location: `${layout} P${i + 1} ${pn.hinge === 'fixed' ? 'fixed' : pn.hinge}`,
            role: pn._role || 'main',
            qty: 1,
        }));
    const glassSqm = archSpec ? archOutline.area / 1e6 : paneGlass.reduce((a, g) => a + (g.width * g.height) / 1e6, 0);
    const openers = layoutDef.panels.filter((pn) => pn.hinge !== 'fixed').length;

    // ── Weights: timber from component sections × density (kgPerM), glass
    // from GLASS_KG_PER_SQM, + WEIGHT_MARGIN_PCT for hardware/seals/paint.
    // Per-leaf weights (openers only) feed the hinge selector — margin is
    // included so the pick stays on the safe side of manufacturer limits.
    const secKgPerM = (sec) => {
        const [sf, sd2] = String(sec).split('x').map(Number);
        return kgPerM(sf || 0, sd2 || 0);
    };
    const marginPct = Number.isFinite(Number(settings?.weightMarginPct))
        ? Number(settings.weightMarginPct)
        : CONSTANTS.WEIGHT_MARGIN_PCT;
    const wMargin = 1 + (marginPct || 0) / 100;
    const timberKg = [...box, ...sash].reduce(
        (a, cpt) => a + secKgPerM(cpt.section) * ((Number(cpt.length) || 0) / 1000) * (Number(cpt.quantity) || 1),
        0
    );
    const glassKgPerSqm = GLASS_KG_PER_SQM[windowSpec.glazing?.type] || GLASS_KG_PER_SQM['double'];
    const glassKg = glassSqm * glassKgPerSqm;
    const leafWeights = layoutDef.panels.map((pn, i) => {
        if (pn.hinge === 'fixed') return null;
        const s = leafSizes[i];
        // Arched leaf: the timber run is 2 straight stiles + bottom rail + the
        // curved top rail at its centre line; the pane weight from the true area.
        const leafRun = isCircle ? AG.leafTop.lengths.centre : archSpec ? (2 * AG.leafStraightStile + s.leafW + AG.leafTop.lengths.centre) : (2 * s.leafH + 2 * s.leafW);
        const frameKg = kgPerM(els.leafStile.face, ld) * (leafRun / 1000);
        const paneArea = archSpec ? archOutline.area : paneGlass[i].width * paneGlass[i].height;
        const paneKg = (paneArea / 1e6) * glassKgPerSqm;
        return { panel: i + 1, hinge: pn.hinge, weightKg: R((frameKg + paneKg) * wMargin) };
    });
    // Hinge selection per opener (slot ladder by leaf width + weight); the
    // material behind each slot comes from Assign Materials.
    const hingePicks = selectCasementHinges(layoutDef.panels, leafSizes, leafWeights);
    const hingeSummary = summariseHinges(hingePicks);
    const sideOpeners = hingePicks.filter((h) => h && h.hung === 'side').length;
    const lockPicks = selectCasementLocks(layoutDef.panels, leafSizes);
    const lockSummary = summariseLocks(lockPicks);

    // ── Beading components (sash semantics, C- names = casement profiles) ──
    // Glazing bead: pane perimeters +15%. Astragal bars: same run glued on
    // BOTH glass faces — Triangle (Ext) outside, Georgian Middle inside.
    // Between-glass (internal georgian) bars live inside the IGU: no material.
    const barCountsFor = (role) => (role === 'fan'
        ? { h: casBars.fanH, v: casBars.fanV }
        : role === 'fan2'
            ? { h: casBars.fan2H, v: casBars.fan2V }
            : { h: casBars.h, v: casBars.v });
    const BEAD_WASTE = 1.15;
    const recBead = (name, mm, notes) =>
        createComponentRecord(windowSpec, 'beading', name, 'profile', mm, 1, notes);
    // Arched: pane perimeter and bar run from the true outline / bar list.
    const perimMm = archSpec ? archOutline.perimeter : paneGlass.reduce((a, g) => a + 2 * ((g.width || 0) + (g.height || 0)), 0);
    const casBarType = cas.barType || windowSpec.casementBarType || 'astragal';
    const barMm = casBarType !== 'astragal' ? 0
        : archSpec ? archBars.totalLength
        : paneGlass.reduce((a, g) => {
            const c = barCountsFor(g.role);
            return a + c.h * (g.width || 0) + c.v * (g.height || 0);
        }, 0);
    const beading = [recBead('C-GLAZING BEADING', Math.round(perimMm * BEAD_WASTE), 'Pane perimeters + 15%')];
    if (barMm > 0) {
        beading.push(recBead('C-TRIANGLE BEADING (EXT)', Math.round(barMm * BEAD_WASTE), 'Astragal bars ext + 15%'));
        beading.push(recBead('C-GEORGIAN MIDDLE BEADING', Math.round(barMm * BEAD_WASTE), 'Astragal bars int + 15%'));
    }

    // ── Consumables: casement is GLAZED THE SAME WAY AS SASH (Piotr 04.08).
    // Bead tape PER THICKNESS = beading perimeter ×1 + middle glazing bars ×2
    // (bars are glued on BOTH glass faces — duplex, same as the 18mm duplex
    // the glass drawings show). BOM assigns this length to the 2mm (outside)
    // and 1mm (inside) slots equally. Silicone stays 0.1 tube/m of
    // perimeter + single bar run (sash rule — bedding, not both faces);
    // weather seals per Piotr 02.08.2026: frame seal 2H+2W, head&jambs seal
    // 2H+1W, both +10%, colour pair picked by sealColour in the BOM.
    const casSiliconeTubes = Math.round(0.1 * ((perimMm + barMm) / 1000) * 10) / 10;
    const casBeadTapeSideM = Math.round(((perimMm + 2 * barMm) / 1000) * 100) / 100;
    const SEAL_F = 1.10;
    // Arched: the seal follows the true frame outline — two jambs to the
    // springing + the head arc (outer edge), plus the cill for the frame seal.
    // circle: the seal is the ring's outer circumference — no jambs, no cill run
    const jambRun = isCircle ? 0 : archSpec ? 2 * AG.start : 2 * frameHeight;
    const headRun = archSpec ? AG.frameHead.lengths.outer : frameWidth;
    const casSealFrameM = Math.round(((jambRun + headRun + (isCircle ? 0 : frameWidth)) * SEAL_F / 1000) * 100) / 100;
    const casSealHjM = Math.round(((jambRun + headRun) * SEAL_F / 1000) * 100) / 100;
    const casSealColour = (cas.sealColour || windowSpec.sealColour || 'black').toLowerCase();

    void r1;
    return {
        category: 'casement',
        sashWidth: leafSizes[0]?.leafW || 0,
        sashHeight: leafSizes[0]?.leafH || 0,
        topSashHeight: 0, bottomSashHeight: 0,
        config: { key: 'none', rows: 0, cols: 0 },
        components: { sash, box, beading },
        glazingItems: [],
        customGlassUnits: paneGlass,
        casement: {
            // v3 Block 3: present only on a fixed window (absent, not 'opening', so a
            // rectangular casement's derived JSON is unchanged — t18 / t20 fixtures)
            ...(isFixed ? { kind: 'fixed' } : {}),
            layout, layoutDef, openers, panes: layoutDef.panels.length,
            leafWeights,
            hardware: { hingePicks, hingeSummary, sideOpeners, lockPicks, lockSummary },
            leaves: leafSizes, paneBounds, leafRects, transomRuns, mullionRuns,
            geometry: geo,
            cill: {
                length: R(cillLength), wider: cillWider,
                extension: Number(windowSpec.cill?.extension) || 0,
            },
        },
        // ── Arched casement (arched-casement-v2 B.8): geometry, blank plans,
        //    bars and the glass outline for the drawings and the glazier exports.
        //    Absent (not null) on a rectangular casement — its output is unchanged.
        ...(archSpec ? {
            arch: {
                shape: AG.shape,
                geometry: AG,
                plans: archPlans,
                bars: archBars.bars,
                barCounts: archBars.counts,
                barTotalLength: archBars.totalLength,
                pattern: archBars.pattern,
                tracery: archTracery ? { mode: archTracery.geom.mode, panes: archTracery.geom.panes.length, areas: archTracery.geom.areas, bbox: archTracery.geom.bbox, warnings: archTracery.geom.warnings } : null,
                glassOutline: {
                    ...archOutline,
                    // glass-frame origin in FRAME coordinates (mm from the frame's
                    // outer bottom-left corner, y up) = the unit's bottom-left corner
                    origin: { x: R(frameWidth / 2 - AG.glass.halfWidth), y: R(glassBottomEdge) },
                    // circle: the glass centre in frame coordinates
                    ...(isCircle ? { centreFrame: { x: R(frameWidth / 2), y: R(frameHeight / 2) } } : {}),
                },
            },
        } : {}),
        barPositions: { vertical: [], horizontal: [] },
        weights: {
            timber: R(timberKg),
            glass: R(glassKg),
            total: R((timberKg + glassKg) * wMargin),
        },
        // v3 0.4: the tracery face (board minus panes, one side) adds to the paint area
        paint: isCircle
            ? paintFromAreaSqm(round((Math.PI * (frameWidth / 2) ** 2 + (archTracery ? archTracery.geom.areas.timber * archTracery.T.sides : 0)) / 1_000_000))
            : archSpec
            ? paintFromAreaSqm(round((frameWidth * AG.start + chainAreaAboveLine(AG.arcs) + (archTracery ? archTracery.geom.areas.timber * archTracery.T.sides : 0)) / 1_000_000))
            : calculatePaint(frameWidth, frameHeight),
        consumables: {
            glass: { type: windowSpec.glazing?.type || 'double', sqm: Math.round(glassSqm * 100) / 100 },
            silicone: { tubes: casSiliconeTubes },
            beadTapeSide: { meters: casBeadTapeSideM },
            sealFrame: { meters: casSealFrameM },
            sealHeadJambs: { meters: casSealHjM },
            sealColour: casSealColour,
        },
        frame: { width: frameWidth, height: frameHeight },
    };
}

/**
 * DOOR ENGINE v3 (Piotr 09.08) — single + FRENCH, coupled side panels, transom.
 *
 * ASSEMBLY (corrected 09.08 — v2 wrongly subtracted the panels from the door
 * width, which crushed a 1200 french into two 29mm leaves):
 *   windowSpec.frame.width  = the DOOR frame only.
 *   Side panels are COUPLED ON THE OUTSIDE, each with its own width field, so
 *   the assembly grows sideways exactly as the transom grows upwards:
 *       totalWidth = leftPanel + doorFrame + rightPanel
 *   Head and cill are ONE piece each across the whole assembly (Piotr 09.08).
 *   Between a panel and the door stand TWO 57 jambs side by side (the panel's
 *   own jamb + the door's), matching the 3D where DoorSidePanel is a complete
 *   DoorFrame butted against the door frame. NOTE: coupling could also be a
 *   single shared post — awaiting Piotr's confirmation; only D-JC qty changes.
 *
 * Construction:
 *   frame   = casement frame, rebate 4mm deeper (leaf 61 instead of 57)
 *   leaf    = 94mm all round, bottom rail 180mm (stiffness, not decoration)
 *   FRENCH  = two leaves, NO centre mullion EVER: meeting stiles rebated 6mm
 *             with 3mm clearance. Only the 6mm overlap matters for sizing:
 *             each leaf = (door clear width + frenchOverlap) / 2, so a 1200
 *             door gives 2 x 563 (clear 1120, meeting band 94+94-6 = 182).
 *   panel   = FIXED leaf, all members 57 (as 3D). Between panel and door
 *             stands ONE coupling post 114 with two rebates (Piotr 09.08):
 *             72 shows from outside when the door opens outward, 93 when it
 *             opens inward (the door rebate flips to the interior).
 *   transom = frame grows TALLER by transomHeight; frame.height stays the DOOR
 *             zone height. Rail 68 runs the full assembly with its bottom edge
 *             flush with the door opening top; fan cavity = transomHeight - 68.
 *             The jambs run full height, so the fan is one pane PER FRAME.
 *   glass   = member face - glassInset per bounding member, per unit
 *   cill    = outward: casement cill · inward: 40->35 unrebated fall
 *             · aluminium / low-profile threshold: NO bottom timber member
 */
function deriveDoorWindow(windowSpec, frameWidth, frameHeight) {
    const p = getDoorProfile();
    const els = p.elements;
    const ded = p.deductions;
    const geo = p.geometry;
    const L = p.lengths;
    const d = windowSpec.door || {};
    const R = (v) => Math.round(v * 10) / 10;

    const fd = p.frameDepth;
    const ld = p.leafDepth;                    // 61 for double AND triple
    const secFrame = `${els.frameHead.face}x${fd}`;
    const secLeafStile = `${els.leafStile.face}x${ld}`;
    const secLeafBottom = `${els.leafBottom.face}x${ld}`;
    const spMember = p.sidePanel?.member ?? DEFAULT_DOOR_PROFILE.sidePanel.member;
    const postW = p.couplingPost?.width ?? DEFAULT_DOOR_PROFILE.couplingPost.width;
    const secSide = `${spMember}x${p.sidePanel?.depth ?? DEFAULT_DOOR_PROFILE.sidePanel.depth}`;
    const frameFace = els.frameHead.face;
    const inset = geo.glassInset;

    const mk = (group, name, section, length, qty, code, notes = '') => {
        const rec = createComponentRecord(windowSpec, group, name, section, length, qty, notes);
        rec.length = R(length);
        rec.code = code;
        return rec;
    };

    const isFrench = (d.type || 'single-external') === 'french';
    const threshold = d.threshold || 'standard';
    const inward = (d.openDirection || 'outward') === 'inward';
    const hasTimberCill = threshold === 'standard';
    const cillWider = !!windowSpec.cill?.wider;
    const cillExt = Number(windowSpec.cill?.extension) || 0;

    // ── Transom: whole assembly grows upward, door zone height untouched ──
    const tr = d.transom || {};
    const railH = p.transom?.rail ?? 68;
    const transomH = (tr.type && tr.type !== 'none') ? (Number(tr.height) || 0) : 0;
    const totalHeight = frameHeight + transomH;

    // ── Horizontal assembly: panels coupled OUTSIDE the door frame ──
    const sp = d.sidePanels || {};
    const mode = sp.mode || 'none';
    const leftW = (mode === 'left' || mode === 'both') ? (Number(sp.leftWidth) || 0) : 0;
    const rightW = (mode === 'right' || mode === 'both') ? (Number(sp.rightWidth) || 0) : 0;
    const totalWidth = frameWidth + leftW + rightW;
    const doorX = leftW;
    const edge = ded.leafAtJamb;                       // 47 = land 43 + gap 4

    const frames = [
        leftW ? { x: 0, w: leftW, kind: 'panel', side: 'left' } : null,
        { x: doorX, w: frameWidth, kind: 'door' },
        rightW ? { x: doorX + frameWidth, w: rightW, kind: 'panel', side: 'right' } : null,
    ].filter(Boolean);
    // Coupling posts — ONE member per panel, 2 × jamb face wide (136 from v4
    // Block F), two rebates. The band seen from OUTSIDE is not symmetric when
    // the door opens inward: the panel side always shows its land, the door
    // side shows the land outward but its full frame face inward (that rebate
    // has flipped to the interior).
    const halfPost = postW / 2;
    const doorFace = els.frameHead.face;
    const posts = [
        leftW ? { axis: R(leftW), doorSide: 'right' } : null,
        rightW ? { axis: R(doorX + frameWidth), doorSide: 'left' } : null,
    ].filter(Boolean).map((po) => {
        const panelVis = geo.land;                       // land always
        const doorVis = inward ? doorFace : geo.land;    // face inward · land outward
        const visX = po.doorSide === 'right' ? po.axis - panelVis : po.axis - doorVis;
        return {
            axis: po.axis, doorSide: po.doorSide,
            x: R(po.axis - halfPost), w: postW,
            visX: R(visX), visW: R(panelVis + doorVis),
        };
    });
    const joints = posts.map((po) => po.axis);

    // ── Door leaves ──
    const leafH = R(frameHeight - (hasTimberCill ? ded.leafFullHeight : ded.leafNoThreshold));
    const clearW = frameWidth - 2 * edge;
    const overlap = isFrench ? (p.frenchOverlap ?? 6) : 0;
    const leafW = isFrench ? R((clearW + overlap) / 2) : R(clearW);
    // Open side is stated from INSIDE (open left = towards your left as you
    // walk in), so from OUTSIDE the hinges sit on the opposite edge. For
    // french the ACTIVE leaf is the hinged-on-that-side one; the other leaf
    // is passive (bolts top + bottom by default).
    const hingeOnRight = (d.hingeSide || 'left') === 'left';
    const leaves = isFrench
        ? [
            { x: R(doorX + edge), w: leafW, h: leafH, hinge: 'left', role: hingeOnRight ? 'passive' : 'active' },
            { x: R(doorX + frameWidth - edge - leafW), w: leafW, h: leafH, hinge: 'right', role: hingeOnRight ? 'active' : 'passive' },
        ]
        : [{ x: R(doorX + edge), w: leafW, h: leafH, hinge: hingeOnRight ? 'right' : 'left', role: 'single' }];

    // ── Fixed panel leaves — same land/gap as the door, members 57 ──
    const panelLeaves = frames
        .filter((f) => f.kind === 'panel')
        .map((f) => ({ x: R(f.x + edge), w: R(f.w - 2 * edge), h: leafH, side: f.side }));

    // ── BOX: one head, one cill, jambs, transom rail ──
    const box = [
        mk('box', 'D-FRAME HEAD', secFrame, R(totalWidth - (L.headDeduct || 0)), 1, 'D-H',
            panelLeaves.length ? 'full assembly' : ''),
        mk('box', 'D-FRAME JAMB (L)', secFrame, R(totalHeight - (L.jambDeduct || 0)), 1, 'D-J/L'),
        mk('box', 'D-FRAME JAMB (R)', secFrame, R(totalHeight - (L.jambDeduct || 0)), 1, 'D-J/R'),
    ];
    if (posts.length) {
        box.push(mk('box', 'D-COUPLING POST', `${postW}x${fd}`,
            R(totalHeight - (L.jambDeduct || 0)), posts.length, 'D-JC',
            'one member, two rebates (panel + door)'));
    }
    if (hasTimberCill) {
        // Inward-opening cill is a different section: unrebated, 40 -> 35mm fall.
        const cillFace = inward ? p.cillInward.faceInternal : els.frameCill.face;
        box.push(mk('box', 'D-FRAME CILL', `${cillFace}x${fd}`,
            R(totalWidth + (cillWider ? 100 : 0) + cillExt - (L.cillDeduct || 0)), 1, 'D-CILL',
            [panelLeaves.length ? 'full assembly' : '',
             inward ? `inward: ${p.cillInward.faceInternal}->${p.cillInward.faceExternal}mm fall` : '',
             cillWider ? 'wider +50mm each side' : '',
             cillExt ? `ext ${cillExt}mm` : ''].filter(Boolean).join(' · ')));
    }
    if (transomH) {
        box.push(mk('box', 'D-TRANSOM', `${railH}x${fd}`,
            R(totalWidth - (L.transomDeduct || 0)), 1, 'D-T',
            `fan cavity ${R(transomH - railH)}`));
    }

    // ── SASH: door leaves + fixed panel leaves ──
    const sash = [];
    leaves.forEach((leaf) => {
        const noteL = leaf.hinge === 'left' ? 'hinge' : (isFrench ? 'meeting' : 'lock');
        const noteR = leaf.hinge === 'right' ? 'hinge' : (isFrench ? 'meeting' : 'lock');
        const roleNote = isFrench ? ` (${leaf.role})` : '';
        sash.push(
            mk('sash', 'D-STILE (L)', secLeafStile, R(leaf.h - (L.stileDeduct || 0)), 1, 'D-ST/L', noteL + roleNote),
            mk('sash', 'D-STILE (R)', secLeafStile, R(leaf.h - (L.stileDeduct || 0)), 1, 'D-ST/R', noteR + roleNote),
            mk('sash', 'D-TOP RAIL', secLeafStile, R(leaf.w - (L.topRailDeduct || 0)), 1, 'D-TR', isFrench ? leaf.role : ''),
            mk('sash', 'D-BOTTOM RAIL', secLeafBottom, R(leaf.w - (L.bottomRailDeduct || 0)), 1, 'D-BR', isFrench ? leaf.role : ''),
        );
    });
    panelLeaves.forEach((pn) => {
        sash.push(
            mk('sash', 'D-SIDE STILE', secSide, R(pn.h - (L.sideStileDeduct || 0)), 2, 'D-SP-ST', `panel ${pn.side}`),
            mk('sash', 'D-SIDE TOP RAIL', secSide, R(pn.w - (L.sideRailDeduct || 0)), 1, 'D-SP-TR', `panel ${pn.side}`),
            mk('sash', 'D-SIDE BOTTOM RAIL', secSide, R(pn.w - (L.sideRailDeduct || 0)), 1, 'D-SP-BR', `panel ${pn.side}`),
        );
    });

    // ── GLASS: per door leaf + per panel + one fan pane PER FRAME ──
    const stileEat = els.leafStile.face - inset;
    const glassUnits = [];
    leaves.forEach((leaf, i) => {
        const gw = R(leaf.w - 2 * stileEat);
        const gh = R(leaf.h - (els.leafTop.face - inset) - (els.leafBottom.face - inset));
        if (gw > 0 && gh > 0) glassUnits.push({
            width: gw, height: gh, qty: 1, role: 'main',
            location: isFrench
                ? `french P${i + 1} ${leaf.role}`
                : `${d.type || 'single-external'} P1 ${d.hingeSide || 'left'}`,
        });
    });
    const sideEat = spMember - inset;
    panelLeaves.forEach((pn) => {
        const gw = R(pn.w - 2 * sideEat);
        const gh = R(pn.h - 2 * sideEat);
        if (gw > 0 && gh > 0) glassUnits.push({
            width: gw, height: gh, qty: 1, role: 'side',
            location: `side panel ${pn.side}`,
        });
    });
    const fanPanes = [];
    if (transomH) {
        const frameEat = frameFace - inset;
        const fanH = R(transomH - frameEat - (railH - inset));
        frames.forEach((f) => {
            const gw = R(f.w - 2 * frameEat);
            if (gw > 0 && fanH > 0) {
                fanPanes.push({ x: R(f.x + frameEat), w: gw, h: fanH, over: f.kind });
                glassUnits.push({
                    width: gw, height: fanH, qty: 1, role: 'fanlight',
                    location: `fanlight over ${f.kind}${f.side ? ` ${f.side}` : ''}${tr.type === 'opening' ? ' (opening — 64 sash pending)' : ' (fixed)'}`,
                });
            }
        });
    }

    return {
        category: 'door',
        door: {
            type: d.type || 'single-external',
            leafW, leafH,
            threshold, inward,
            hasTimberCill,
            bottomRailFace: els.leafBottom.face,
            overlap,
            totalWidth, totalHeight,
            leaves,
            panelLeaves,
            sidePanelMember: spMember,
            zones: {
                totalWidth, totalHeight,
                doorX: R(doorX), doorW: R(frameWidth),
                frames, joints, posts,
                leftPanel: leftW ? { x: 0, w: leftW } : null,
                rightPanel: rightW ? { x: R(doorX + frameWidth), w: rightW } : null,
                transom: transomH ? {
                    h: transomH, railH,
                    cavity: R(transomH - railH),
                    type: tr.type || 'fixed',
                    fanPanes,
                } : null,
            },
        },
        components: { sash, box, beading: [] },
        customGlassUnits: glassUnits,
        glazingItems: [],
        weights: { total: 0 },
        paint: calculatePaint(totalWidth, totalHeight),
        consumables: {
            glass: {
                type: windowSpec.glazing?.type || 'double',
                sqm: Math.round(glassUnits.reduce((s, u) => s + u.width * u.height * u.qty, 0) / 1e6 * 100) / 100,
            },
        },
        frame: { width: frameWidth, height: frameHeight },
    };
}

export function deriveWindowData(windowSpec, settings = {}) {
    const frameWidth = Number(windowSpec.frame?.width ?? 0);
    const frameHeight = Number(windowSpec.frame?.height ?? 0);
    const category = windowSpec.category || 'sash';
    if (category === 'casement') return deriveCasementWindow(windowSpec, frameWidth, frameHeight, settings);
    if (category === 'door' || category === 'doors') return deriveDoorWindow(windowSpec, frameWidth, frameHeight);
    if (category !== 'sash') return emptyDerived(category, frameWidth, frameHeight);
    const isTripleSash = windowSpec.sash?.type === 'triple';
    const gridMode = windowSpec.sash?.grid?.mode ?? 'none';

    const config = resolveConfiguration(gridMode, windowSpec.sash?.grid ?? {});
    const sashWidth = frameWidth - getWindowProfile().deductions.sashWidth;
    const totalSashHeight = totalSashHeightFor(frameHeight);
    const sashDiff = sashFaces().diff;
    const topSashHeight = (totalSashHeight - sashDiff) / 2;
    const bottomSashHeight = topSashHeight + sashDiff;
    const sashHeight = totalSashHeight;

    const sashComponents = isTripleSash
        ? calculateTripleSashComponentSet(windowSpec, settings, sashWidth, topSashHeight, bottomSashHeight, frameHeight)
        : calculateSashComponentSet(windowSpec, settings, sashWidth, topSashHeight, bottomSashHeight);
    const boxComponents = calculateBoxComponentSet(windowSpec, frameWidth, frameHeight);
    const tripleSections = isTripleSash ? tripleSectionWidths(windowSpec, sashWidth) : null;
    const glazingSummary = calculateGlazingSummaryForWindow(windowSpec, sashWidth, sashHeight, settings);

    const result = calculateWindow(frameWidth, frameHeight, config.key, {
        rows: config.rows,
        cols: config.cols,
    });

    const barPositions = {
        vertical: result.components.sash.glazingBars.vertical.positions,
        horizontal: result.components.sash.glazingBars.horizontal.positions,
    };

    const beadingComponents = calculateBeadingComponents(
        windowSpec, frameWidth, frameHeight, sashWidth, topSashHeight
    );

    // Triple sash: counterweights balance only the centre (opening) section
    let weights = calculateWeights(windowSpec, tripleSections ? tripleSections.center : sashWidth, topSashHeight, bottomSashHeight);
    let paint = calculatePaint(frameWidth, frameHeight);
    let consumables = calculateConsumables(windowSpec, frameWidth, frameHeight, sashWidth, topSashHeight, bottomSashHeight);

    // ── Arched sash (ARCHED-WINDOWS-v3 Block 1 C): the box head and the upper
    //    sash's top rail become rings on the frame contour (arch.js, rule C);
    //    stiles run to the springing, the meeting rail and the lower sash are
    //    untouched. Everything below is conditional — a rectangular sash is
    //    JSON-identical to before (verify/arch/t21.mjs).
    const sashArchSpec = windowSpec.arch && windowSpec.arch.shape ? windowSpec.arch : null;
    let sashArch = null;
    if (sashArchSpec && !isTripleSash) {
        const prof = getWindowProfile();
        const cp = getCasementProfile();                     // blank planner + pattern numbers live once, here
        const SA = buildSashArchGeometry({ shape: sashArchSpec.shape, width: frameWidth, height: frameHeight, rise: sashArchSpec.rise }, prof, CONSTANTS.GLASS_REBATE);
        const plans = { head: planArchSegments(SA.head, cp.arch, cp.cnc), topRail: planArchSegments(SA.topRail, cp.arch, cp.cnc) };
        const R = (v) => Math.round(v * 10) / 10;
        const f = sashFaces();
        // upper glass: bottom edge = meeting rail bottom + meeting rail face − rebate, springing at H − rise
        const straightBelow = SA.upperStileClear - f.meet / 2 + CONSTANTS.GLASS_REBATE;
        const outline = buildGlassOutline(SA.glass.arcs, SA.glass.halfWidth, straightBelow);
        const bars = buildArchBars({
            outline, shape: SA.shape, pattern: sashArchSpec.bars?.pattern || 'none',
            h: sashArchSpec.bars?.h || 0, v: sashArchSpec.bars?.v || 0, frameHalfWidth: frameWidth / 2,
            spokes: sashArchSpec.bars?.spokes, rings: sashArchSpec.bars?.rings,
        }, cp.arch?.patterns);
        // lower sash: straight horizontals only (PSW arch-lower-h-bars), equal divisions of the lower
        // daylight height; the lower UNIT row keeps the double-hung rule (sash − 89, lower − 108)
        const lowerGlassH = bottomSashHeight - f.meet - f.bottom;
        const lowerGlassW = sashWidth - 2 * f.stile;
        const lowerUnitW = sashWidth - (2 * f.stile - 2 * CONSTANTS.GLASS_REBATE);
        const lowerUnitH = bottomSashHeight - (f.meet + f.bottom - 2 * CONSTANTS.GLASS_REBATE);
        const nLower = Math.max(0, Math.floor(Number(sashArchSpec.lowerHBars) || 0));
        const lowerBars = { h: nLower, positions: Array.from({ length: nLower }, (_, j) => R(lowerGlassH * (j + 1) / (nLower + 1))), glassW: R(lowerGlassW), glassH: R(lowerGlassH) };
        const archNotes = (plan, ring) => {
            const radii = ring.outer.map((a) => Math.round(a.r)).join('/');
            if (plan.noStock) return `R ${radii} · no stock board fits`;
            return `R ${radii} · ${plan.totalPieces} pieces · stock ${plan.arcs.map((a) => a.default.stock).join('/')}`;
        };
        const hornExtra = windowSpec.sash?.horns ? Number(windowSpec.sash?.hornExtension ?? prof.hornExtension ?? settings?.hornExtensionDefault ?? 70) : 0;
        const sd = sashDepthFor(windowSpec.frame?.type);
        const bw = windowSpec.frame?.type ? profileBoardWidth(windowSpec.frame.type) : boxBoardWidthFor(windowSpec.frame?.depth);
        const boxDepth = profileBoxDepth(windowSpec.frame?.type);
        const headFace = Number(prof.sashArch.headFace);
        // records: the arched members replace their straight twins, the stiles / jambs stop at the springing
        const rec = (group, name, section, length, qty, notes = '') => { const r = createComponentRecord(windowSpec, group, name, section, length, qty, notes); r.length = R(length); return r; };
        const upperStile = SA.upperStraightStile + hornExtra;
        const sashOut = [];
        for (const c of sashComponents) {
            if (c.elementName === 'TOP RAIL') sashOut.push(rec('sash', 'S-ARCH TOP RAIL', c.section, SA.topRail.lengths.centre, 1, archNotes(plans.topRail, SA.topRail)));
            else if (c.elementName === 'STILES TOP (L)' || c.elementName === 'STILES TOP (R)') sashOut.push(rec('sash', c.elementName, c.section, upperStile, 1, 'to the springing'));
            else sashOut.push(c);
        }
        // DEFAULT (open, BLOCKERS): jambs = start − (jambHeight − headFace) — the head zone of the rectangular
        // deduction is the ring now; head liners are not generated on an arched head; jamb liners to the springing
        const jambLen = SA.start - (prof.deductions.jambHeight - headFace);
        const boxOut = [];
        for (const c of boxComponents) {
            if (c.elementName === 'HEAD') boxOut.push(rec('box', 'S-ARCH HEAD', `${headFace}x${boxDepth}`, SA.head.lengths.centre, 1, archNotes(plans.head, SA.head)));
            else if (c.elementName === 'JAMB LEFT' || c.elementName === 'JAMB RIGHT') boxOut.push(rec('box', c.elementName, c.section, jambLen, 1, 'to the springing'));
            else if (c.elementName === 'INTERNAL HEAD LINER' || c.elementName === 'EXTERNAL HEAD LINER') continue;
            else if (c.elementName.includes('JAMB LINER')) boxOut.push(rec('box', c.elementName, c.section, SA.start - (c.elementName.startsWith('INTERNAL') ? prof.elements.intJambLiner.deduction : prof.elements.extJambLiner.deduction), 1, 'to the springing'));
            else boxOut.push(c);
        }
        void bw;
        // weights from the true outline (balance / cord): upper timber = stiles + arched top rail (centre line) + meeting rail, glass = outline area
        const kg = { stile: kgPerM(f.stile, sd), topRail: kgPerM(f.top, sd), meet: kgPerM(f.meet, sd), bottom: kgPerM(f.bottom, sd) };
        const glassType = windowSpec.glazing?.type || 'double';
        const kgPerSqm = GLASS_KG_PER_SQM[glassType] || GLASS_KG_PER_SQM['double'];
        const upperTimber = 2 * (SA.upperStraightStile / 1000) * kg.stile + (SA.topRail.lengths.centre / 1000) * kg.topRail + (sashWidth / 1000) * kg.meet;
        const upperGlass = (outline.area / 1e6) * kgPerSqm;
        const lowerTimber = 2 * (bottomSashHeight / 1000) * kg.stile + (sashWidth / 1000) * kg.bottom + (sashWidth / 1000) * kg.meet;
        const lowerGlass = ((lowerGlassW * lowerGlassH) / 1e6) * kgPerSqm;
        weights = {
            timber: round(upperTimber + lowerTimber),
            glass: round(upperGlass + lowerGlass),
            total: round((upperTimber + lowerTimber + upperGlass + lowerGlass) * 1.05),
            glassType, kgPerSqm,
            upperKg: round((upperTimber + upperGlass) * 1.05),
            lowerKg: round((lowerTimber + lowerGlass) * 1.05),
            upperGlassArea: round(outline.area / 1e6),
        };
        // paint from the true frame outline; seal 6070 with the upper sash's true perimeter (equivalent height)
        paint = paintFromAreaSqm(round((frameWidth * SA.start + chainAreaAboveLine(SA.arcs)) / 1_000_000));
        const upperEquivH = (2 * SA.upperStraightStile + SA.topRail.lengths.centre - sashWidth) / 2;
        consumables = { ...consumables, seal6070: { meters: round((sashWidth * 4 + upperEquivH * 4 + bottomSashHeight * 4) * 1.10 / 1000) } };
        sashComponents.length = 0; sashComponents.push(...sashOut);
        boxComponents.length = 0; boxComponents.push(...boxOut);
        sashArch = {
            shape: SA.shape,
            geometry: SA,
            plans,
            bars: bars.bars,
            barCounts: bars.counts,
            barTotalLength: bars.totalLength,
            pattern: bars.pattern,
            lowerBars,
            upperSash: { straightStile: R(SA.upperStraightStile), stileClear: R(SA.upperStileClear), topRailLength: R(SA.topRail.lengths.centre), width: sashWidth },
            glassOutline: {
                ...outline,
                // glass-frame origin in FRAME coordinates (frame bottom-left, y up): unit bottom-left corner
                origin: { x: R(frameWidth / 2 - SA.glass.halfWidth), y: R(SA.start - straightBelow) },
            },
            customGlassUnits: [
                { width: R(outline.width), height: R(outline.height), location: 'upper', role: 'main', qty: 1,
                  shape: { kind: 'arched', archShape: SA.shape, outline, poly: glassOutlinePoly(outline), springing: R(outline.springing), apex: R(outline.apex), rise: R(outline.rise), radii: outline.radii.map(R), area: outline.area, perimeter: outline.perimeter, bars: bars.bars, pattern: bars.pattern, barCounts: bars.counts } },
                { width: R(lowerUnitW), height: R(lowerUnitH), location: 'lower', role: 'main', qty: 1 },
            ],
        };
    }

    return {
        category: 'sash',
        tripleSections,
        sashWidth,
        sashHeight,
        topSashHeight,
        bottomSashHeight,
        config,
        // Profile numbers for drawing dimension labels (schematic geometry stays
        // fixed; only the printed numbers follow the active/snapshotted profile).
        // Sash rail/stile face numbers for drawing dimension labels (schematic
        // geometry stays fixed; printed numbers follow the active profile).
        sashDims: (() => {
            const e = getWindowProfile().elements || {};
            return {
                stile: e.stiles?.face, topRail: e.topRail?.face,
                meetingRail: e.meetingRail?.face, bottomRail: e.bottomRail?.face,
                horn: Number(getWindowProfile().hornExtension) || 70,
            };
        })(),
        boxDims: (() => {
            const e = getWindowProfile().elements || {};
            return {
                intJamb: e.intJambLiner?.h, intHead: e.intHeadLiner?.h,
                extJamb: e.extJambLiner?.h, extHead: e.extHeadLiner?.h,
                cillH: e.cill?.w,
            };
        })(),
        components: { sash: sashComponents, box: boxComponents, beading: beadingComponents },
        glazingItems: [glazingSummary],
        barPositions,
        weights,
        paint,
        consumables,
        // arched sash (v3 Block 1): absent on a rectangular sash
        ...(sashArch ? { arch: sashArch, customGlassUnits: sashArch.customGlassUnits } : {}),
    };
}

function aggregateComponents(windows, settings) {
    const sash = [];
    const box = [];
    const glazing = [];
    const beading = [];

    windows.forEach((windowSpec) => {
        const derived = deriveWindowData(windowSpec, settings);
        sash.push(...derived.components.sash);
        box.push(...derived.components.box);
        glazing.push(...derived.glazingItems);
        beading.push(...derived.components.beading);
    });

    return { sash, box, glazing, beading };
}

function aggregateCutList(components) {
    const grouped = new Map();
    components.forEach((component) => {
        const key = `${component.windowId}-${component.elementName}-${component.section}-${component.length}`;
        if (!grouped.has(key)) {
            grouped.set(key, { ...component });
        } else {
            grouped.get(key).quantity += component.quantity;
        }
    });
    return Array.from(grouped.values());
}

function buildSashPrecut(components, settings) {
    const bySection = new Map();
    components.forEach((component) => {
        const rawSection = settings.sectionMap[component.section] ?? settings.sectionMap['57x57'];
        if (!rawSection) return;
        if (!bySection.has(rawSection)) {
            bySection.set(rawSection, []);
        }
        bySection.get(rawSection).push({
            elementName: component.elementName,
            length: component.length,
            quantity: component.quantity,
            windowId: component.windowId,
            windowName: component.windowName,
        });
    });

    return Array.from(bySection.entries()).map(([section, items]) => ({ section, items }));
}

function buildBoxPrecut(components, windowSpecList, settings) {
    const allowance = settings.boxWidthAllowance ?? 20;
    const grouped = new Map();
    components.forEach((component) => {
        if (component.finishedWidth == null) return;
        const widthWithAllowance = component.finishedWidth + allowance;
        if (!grouped.has(widthWithAllowance)) {
            grouped.set(widthWithAllowance, []);
        }
        grouped.get(widthWithAllowance).push({
            elementName: component.elementName,
            length: component.length,
            quantity: component.quantity,
            windowId: component.windowId,
            windowName: component.windowName,
        });
    });
    return Array.from(grouped.entries()).map(([preCutWidth, items]) => ({ preCutWidth, items }));
}

function resolveConfiguration(configuration, options) {
    if (CONFIGURATIONS[configuration]) {
        if (configuration !== 'custom') {
            return CONFIGURATIONS[configuration];
        }
    } else if (configuration !== 'custom') {
        throw new Error(`Configuration "${configuration}" is not supported.`);
    }

    const customRows = Number(options.customRows ?? options.rows ?? 2);
    const customCols = Number(options.customCols ?? options.cols ?? 2);

    if (!Number.isFinite(customRows) || !Number.isFinite(customCols)) {
        throw new Error('Custom configuration requires numeric row and column values.');
    }

    const rows = Math.max(1, Math.floor(customRows));
    const cols = Math.max(1, Math.floor(customCols));

    if (rows > 12 || cols > 12) {
        throw new Error('Custom configuration must be between 1×1 and 12×12.');
    }

    return {
        key: 'custom',
        rows,
        cols,
        totalPanes: rows * cols,
        verticalBars: Math.max(cols - 1, 0),
        horizontalBars: Math.max(rows - 1, 0),
        description: `${rows}×${cols} Custom`
    };
}

function validateInputs(frameWidth, frameHeight, config) {
    if (Number.isNaN(frameWidth) || Number.isNaN(frameHeight)) {
        throw new Error('Frame width/height must be numeric values.');
    }

    if (frameWidth < 400 || frameWidth > 4000) {
        throw new Error('Frame width must be between 400 and 4000 mm.');
    }

    if (frameHeight < 600 || frameHeight > 4000) {
        throw new Error('Frame height must be between 600 and 4000 mm.');
    }

    if (!config || !config.rows || !config.cols) {
        throw new Error('Invalid configuration definition.');
    }
}

function calculateFrameComponents(frameWidth, frameHeight) {
    const jambLength = frameHeight - getWindowProfile().deductions.jambHeight;
    const headLength = frameWidth - getWindowProfile().deductions.headWidth;
    const sillLength = frameWidth - CONSTANTS.SILL_WIDTH_DEDUCTION;
    const extHeadLiner = frameWidth - getWindowProfile().elements.extHeadLiner.deduction;
    const intHeadLiner = frameWidth - getWindowProfile().elements.intHeadLiner.deduction;
    const extJambLiner = frameHeight;
    const intJambLiner = frameHeight;

    return {
        head: buildComponent('Head', CONSTANTS.HEAD_WIDTH, headLength, 1, CONSTANTS.FRAME_SECTION),
        jambs: buildComponent('Jamb', CONSTANTS.JAMBS_WIDTH, jambLength, 2, CONSTANTS.FRAME_SECTION),
        sill: buildComponent('Sill', CONSTANTS.SILL_WIDTH, sillLength, 1, CONSTANTS.SILL_SECTION),
        externalHeadLiner: buildComponent('External head liner', 17, extHeadLiner, 1, CONSTANTS.HEAD_LINER_EXT_SECTION, 'Softwood'),
        internalHeadLiner: buildComponent('Internal head liner', 17, intHeadLiner, 1, CONSTANTS.HEAD_LINER_INT_SECTION, 'Softwood'),
        externalJambLiner: buildComponent('External jamb liner', 17, extJambLiner, 2, CONSTANTS.JAMB_LINER_EXT_SECTION, 'Softwood'),
        internalJambLiner: buildComponent('Internal jamb liner', 17, intJambLiner, 2, CONSTANTS.JAMB_LINER_INT_SECTION, 'Softwood')
    };
}

function calculateSashComponents(sashWidth, sashHeight, config) {
    // Rails are cut at sash width — tenons protrude into stile mortices
    const horizontalLength = sashWidth;
    const sashSection = `${sashDepthFor(config?.frame?.type)} x ${getWindowProfile().elements.stiles.face}`;
    const _f = sashFaces();
    const availableWidth = sashWidth - 2 * _f.stile;
    const availableHeight = sashHeight - _f.top - _f.bottom;

    const stiles = buildComponent('Sash stiles', sashFaces().stile, sashHeight, 2, sashSection, 'Hardwood', {
        preCutLength: sashHeight + CONSTANTS.HORN_ALLOWANCE_VERTICAL,
        cutLength: sashHeight
    });

    const topRail = buildComponent('Top rail', sashFaces().top, horizontalLength, 1, sashSection, 'Hardwood', {
        preCutLength: horizontalLength + CONSTANTS.HORN_ALLOWANCE_HORIZONTAL,
        cutLength: horizontalLength
    });

    const meetingRail = buildComponent('Meeting rail', sashFaces().meet, horizontalLength, 1, sashSection, 'Hardwood', {
        preCutLength: horizontalLength + CONSTANTS.HORN_ALLOWANCE_HORIZONTAL,
        cutLength: horizontalLength
    });

    const bottomRail = buildComponent('Bottom rail', sashFaces().bottom, horizontalLength, 1, sashSection, 'Hardwood', {
        preCutLength: horizontalLength + CONSTANTS.HORN_ALLOWANCE_HORIZONTAL,
        cutLength: horizontalLength
    });

    const glazingBars = calculateGlazingBars(availableWidth, availableHeight, config);

    return {
        stiles,
        topRail,
        meetingRail,
        bottomRail,
        glazingBars,
        availableWidth,
        availableHeight,
        configuration: config.key
    };
}

function calculateGlazingBars(availableWidth, availableHeight, config) {
    const vertical = {
        element: 'Vertical glazing bar',
        width: CONSTANTS.GLAZING_BAR_WIDTH,
        length: availableHeight,
        quantity: config.verticalBars,
        material: 'Hardwood',
        positions: []
    };

    const horizontal = {
        element: 'Horizontal glazing bar',
        width: CONSTANTS.GLAZING_BAR_WIDTH,
        length: availableWidth,
        quantity: config.horizontalBars,
        material: 'Hardwood',
        positions: []
    };

    if (config.verticalBars > 0) {
        const spacing = availableWidth / (config.verticalBars + 1);
        for (let i = 1; i <= config.verticalBars; i += 1) {
            vertical.positions.push(i * spacing);
        }
    }

    if (config.horizontalBars > 0) {
        const spacing = availableHeight / (config.horizontalBars + 1);
        for (let i = 1; i <= config.horizontalBars; i += 1) {
            horizontal.positions.push(i * spacing);
        }
    }

    return {
        vertical,
        horizontal,
        totalBars: vertical.quantity + horizontal.quantity
    };
}

function calculateGlazing(sashWidth, sashHeight, config, glazingType = '4mm Clear') {
    const _f = sashFaces();
    const availableWidth = sashWidth - 2 * _f.stile;
    const availableHeight = sashHeight - _f.top - _f.bottom;

    const paneWidthRaw = config.cols > 0
        ? (availableWidth - config.verticalBars * CONSTANTS.GLAZING_BAR_WIDTH) / config.cols
        : availableWidth;
    const paneHeightRaw = config.rows > 0
        ? (availableHeight - config.horizontalBars * CONSTANTS.GLAZING_BAR_WIDTH) / config.rows
        : availableHeight;

    const paneWidth = Math.max(paneWidthRaw - CONSTANTS.GLASS_TOLERANCE, 0);
    const paneHeight = Math.max(paneHeightRaw - CONSTANTS.GLASS_TOLERANCE, 0);

    const panes = [];
    let paneId = 1;
    for (let row = 0; row < config.rows; row += 1) {
        for (let col = 0; col < config.cols; col += 1) {
            panes.push({
                id: paneId,
                width: paneWidth,
                height: paneHeight,
                position: `row-${row + 1}-col-${col + 1}`,
                gridPosition: { row: row + 1, col: col + 1 }
            });
            paneId += 1;
        }
    }

    return {
        configuration: config.key,
        description: config.description,
        rows: config.rows,
        cols: config.cols,
        totalPanes: panes.length,
        clearWidth: availableWidth,
        clearHeight: availableHeight,
        paneWidth,
        paneHeight,
        glazingType,
        panes
    };
}

function buildPrecutList(frameComponents, sashComponents) {
    const items = [];

    const push = (component) => {
        if (!component) return;
        items.push({
            element: component.element,
            width: component.width,
            length: component.preCutLength ?? component.length,
            quantity: component.quantity ?? 1,
            section: component.section,
            material: component.material
        });
    };

    [
        frameComponents.head,
        frameComponents.sill,
        frameComponents.jambs,
        frameComponents.externalHeadLiner,
        frameComponents.internalHeadLiner,
        frameComponents.externalJambLiner,
        frameComponents.internalJambLiner,
        sashComponents.topRail,
        sashComponents.meetingRail,
        sashComponents.bottomRail,
        sashComponents.stiles
    ].forEach(push);

    if (sashComponents.glazingBars.vertical.quantity > 0) {
        push({
            element: 'Vertical glazing bar',
            width: CONSTANTS.GLAZING_BAR_WIDTH,
            length: sashComponents.glazingBars.vertical.length,
            quantity: sashComponents.glazingBars.vertical.quantity,
            section: sashComponents.stiles.section,
            material: 'Hardwood'
        });
    }

    if (sashComponents.glazingBars.horizontal.quantity > 0) {
        push({
            element: 'Horizontal glazing bar',
            width: CONSTANTS.GLAZING_BAR_WIDTH,
            length: sashComponents.glazingBars.horizontal.length,
            quantity: sashComponents.glazingBars.horizontal.quantity,
            section: sashComponents.stiles.section,
            material: 'Hardwood'
        });
    }

    return items;
}

function buildCutList(frameComponents, sashComponents) {
    const list = [];

    const push = (component) => {
        if (!component) return;
        list.push({
            element: component.element,
            specification: `${roundTo(component.length, 1)} mm`,
            quantity: component.quantity ?? 1,
            notes: component.section || component.material || ''
        });
    };

    [
        frameComponents.head,
        frameComponents.jambs,
        frameComponents.sill,
        frameComponents.externalHeadLiner,
        frameComponents.internalHeadLiner,
        frameComponents.externalJambLiner,
        frameComponents.internalJambLiner,
        sashComponents.topRail,
        sashComponents.meetingRail,
        sashComponents.bottomRail,
        sashComponents.stiles
    ].forEach(push);

    if (sashComponents.glazingBars.vertical.quantity > 0) {
        list.push({
            element: 'Vertical glazing bars',
            specification: `${roundTo(sashComponents.glazingBars.vertical.length, 1)} mm`,
            quantity: sashComponents.glazingBars.vertical.quantity,
            notes: `${CONSTANTS.GLAZING_BAR_WIDTH} mm width`
        });
    }

    if (sashComponents.glazingBars.horizontal.quantity > 0) {
        list.push({
            element: 'Horizontal glazing bars',
            specification: `${roundTo(sashComponents.glazingBars.horizontal.length, 1)} mm`,
            quantity: sashComponents.glazingBars.horizontal.quantity,
            notes: `${CONSTANTS.GLAZING_BAR_WIDTH} mm width`
        });
    }

    return list;
}

function buildShoppingList(frameComponents, sashComponents, glazing, options) {
    const frameLinear = (frameComponents.head.length + frameComponents.sill.length + frameComponents.jambs.length * frameComponents.jambs.quantity)
        * CONSTANTS.FRAME_WASTE_FACTOR / 1000;
    const linerLinear = (
        frameComponents.externalHeadLiner.length +
        frameComponents.internalHeadLiner.length +
        frameComponents.externalJambLiner.length * frameComponents.externalJambLiner.quantity +
        frameComponents.internalJambLiner.length * frameComponents.internalJambLiner.quantity
    ) * CONSTANTS.FRAME_WASTE_FACTOR / 1000;

    const sashLinear = (
        sashComponents.topRail.length +
        sashComponents.meetingRail.length +
        sashComponents.bottomRail.length +
        sashComponents.stiles.length * sashComponents.stiles.quantity
    ) * CONSTANTS.SASH_WASTE_FACTOR / 1000;

    const glazingItems = glazing.panes.map((pane, index) => ({
        material: `Glass pane ${index + 1}`,
        specification: `${roundTo(pane.width, 1)} × ${roundTo(pane.height, 1)} mm ${glazing.glazingType}`,
        quantity: 1,
        unit: 'ea'
    }));

    const hardwareSpec = options.hardware || 'Polished brass set';

    return {
        timber: [
            { material: 'Frame timber', specification: frameComponents.head.section, quantity: roundTo(frameLinear, 2), unit: 'm' },
            { material: 'Liners', specification: `${frameComponents.externalHeadLiner.section}`, quantity: roundTo(linerLinear, 2), unit: 'm' },
            { material: 'Sash timber', specification: sashComponents.topRail.section, quantity: roundTo(sashLinear, 2), unit: 'm' }
        ],
        glass: glazingItems,
        hardware: [
            { material: 'Trickle vent', specification: 'Concealed', quantity: 1, unit: 'set' },
            { material: 'Fasteners & locks', specification: hardwareSpec, quantity: 1, unit: 'set' }
        ],
        finishing: [
            { material: 'Paint', specification: options.paintColor || 'RAL 9010 White', quantity: 1, unit: 'system' }
        ]
    };
}

function buildComponent(element, width, length, quantity, section, material = 'Hardwood', overrides = {}) {
    return {
        element,
        width,
        length,
        quantity,
        section,
        material,
        preCutLength: overrides.preCutLength ?? length,
        cutLength: overrides.cutLength ?? length
    };
}

function buildOptionSet(options) {
    return {
        paintColor: options.paintColor || 'RAL 9010 White',
        glazingType: options.glazingType || '4mm Clear',
        profile: options.profile || 'Standard profile',
        hardware: options.hardware || 'Classic brass',
        customRows: options.customRows ?? null,
        customCols: options.customCols ?? null
    };
}

function roundTo(value, decimals = 2) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

export function getConfigurationKeys() {
    return Object.keys(CONFIGURATIONS);
}

export function getConfigurationDetails(key) {
    return CONFIGURATIONS[key] || null;
}
