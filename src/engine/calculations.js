import { resolveCasementLayout, clampFanRatio, CASEMENT_GEO_DEFAULTS } from './casementLayouts.js';
import { getWindowProfile, getCasementProfile, profileSashDepth, profileBoardWidth, boardWidthForDepth, kgPerM } from './profile.js';

/**
 * calculations.js - ETAP 3
 * Comprehensive sash window calculation engine supporting multiple configurations.
 */

export const CONSTANTS = Object.freeze({
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
    const areaSqm = round((frameWidth * frameHeight) / 1_000_000);
    // Per 1.5 m²: 2L primer + 1L topcoat
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

function deriveCasementWindow(windowSpec, frameWidth, frameHeight) {
    // ── Casement engine v1 — every number from the casement profile
    //    (casement-dimensioning-v1.md); no bare constants in formulas. ──
    const p = getCasementProfile();
    const els = p.elements;
    const ded = p.deductions;
    const geo = p.geometry;
    const fd = p.frameDepth, ld = p.leafDepth;
    const r1 = (v) => Math.round(v / p.rounding) * p.rounding / 1;
    const R = (v) => Math.round(v * 10) / 10; // one decimal, CNC-ready

    const cas = windowSpec.casement || {};
    const layout = cas.layout || '040L';

    // Layout geometry driven by the PROFILE faces (57 / 68 / 68 defaults —
    // numerically identical to the PSW visual geometry, so 3D/2D/import agree).
    const GEO = {
        frameFace: els.frameHead.face,
        bottomFace: els.frameCill.face,
        mullionW: els.mullion.face,
    };
    const innerW = frameWidth - 2 * GEO.frameFace;
    const innerH = frameHeight - GEO.frameFace - GEO.bottomFace;
    const layoutDef = resolveCasementLayout({
        code: layout, innerW, innerH, height: frameHeight,
        fanlightRatio: clampFanRatio(cas.fanlightHeight, innerH),
        fan2Ratio: clampFanRatio(cas.fan2Height, innerH),
        middleSectionMm: Number(cas.middleWidth) || 0,
        casementHinges: cas.hinges,
        geo: GEO,
    });

    const secFrame = `${els.frameHead.face}x${fd}`;
    const secCill = `${els.frameCill.face}x${fd}`;
    const secMull = `${els.mullion.face}x${fd}`;
    const secTrans = `${els.transom.face}x${fd}`;
    const secLeaf = `${els.leafStile.face}x${ld}`;

    // Record helper: profile rounding (0.1) + element letter code on top of
    // the shared record shape (createComponentRecord rounds to integers).
    const mk = (group, name, section, length, qty, code, notes = '') => {
        const rec = createComponentRecord(windowSpec, group, name, section, length, qty, notes);
        rec.length = R(length);
        rec.code = code;
        return rec;
    };

    // ── Frame: full external dimensions (comb / finger / T&G joints) ──
    const box = [
        mk('box', 'C-FRAME HEAD', secFrame, frameWidth, 1, 'C-H'),
        mk('box', 'C-FRAME CILL', secCill, frameWidth, 1, 'C-CILL'),
        mk('box', 'C-FRAME JAMB (L)', secFrame, frameHeight, 1, 'C-J/L'),
        mk('box', 'C-FRAME JAMB (R)', secFrame, frameHeight, 1, 'C-J/R'),
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
    });

    // ── Mullions: full-height run through (extH − lengths.mullion);
    //    partial tier dividers (031/032) use the provisional transom-style rule. ──
    const sash = [];
    let mullIdx = 0;
    (layoutDef.mullions || []).forEach((mu) => {
        mullIdx += 1;
        const idx = (layoutDef.mullions.length > 1) ? String(mullIdx) : '';
        if (typeof mu === 'number') {
            sash.push(mk('sash', 'C-MULLION', secMull, frameHeight - p.lengths.mullion, 1, `C-M${idx}`));
        } else {
            // Partial mullion spans one tier; adjacent tier = the pane tier it divides.
            const tierPane = mu.touchesTop
                ? leafSizes[paneBounds.findIndex((b) => b.topIsHead)]
                : leafSizes[paneBounds.findIndex((b) => b.bottomIsCill)];
            const len = (tierPane ? tierPane.leafH : 0) + p.lengths.partialMullionSeat;
            sash.push(mk('sash', 'C-MULLION', secMull, len, 1, `C-M${idx}`,
                'partial · UNCONFIRMED length rule'));
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
        const dummy = pn.hinge === 'fixed' ? 'dummy sash' : '';
        const noteBase = [dummy, s.heightNote].filter(Boolean).join(' · ');
        const fnL = hingeFn(pn.hinge, 'L'), fnR = hingeFn(pn.hinge, 'R');
        sash.push(mk('sash', 'C-STILE (L)', secLeaf, s.leafH, 1, `C-ST/L-${pcode}`,
            [fnL, noteBase].filter(Boolean).join(' · ')));
        sash.push(mk('sash', 'C-STILE (R)', secLeaf, s.leafH, 1, `C-ST/R-${pcode}`,
            [fnR, noteBase].filter(Boolean).join(' · ')));
        sash.push(mk('sash', 'C-TOP RAIL', secLeaf, s.leafW, 1, `C-TR-${pcode}`,
            [pn.hinge === 'top' ? 'hinge' : '', noteBase].filter(Boolean).join(' · ')));
        sash.push(mk('sash', 'C-BOTTOM RAIL', secLeaf, s.leafW, 1, `C-BR-${pcode}`,
            [pn.hinge === 'top' ? 'lock' : '', noteBase].filter(Boolean).join(' · ')));
    });

    // ── Glass: one 24 mm unit per pane (fixed = dummy sash, same math) ──
    const paneGlass = layoutDef.panels.map((pn, i) => ({
        width: Math.max(0, R(leafSizes[i].leafW - ded.glass)),
        height: Math.max(0, R(leafSizes[i].leafH - ded.glass)),
        location: `${layout} P${i + 1} ${pn.hinge === 'fixed' ? 'fixed' : pn.hinge}`,
        qty: 1,
    }));
    const glassSqm = paneGlass.reduce((a, g) => a + (g.width * g.height) / 1e6, 0);
    const openers = layoutDef.panels.filter((pn) => pn.hinge !== 'fixed').length;

    void r1;
    return {
        category: 'casement',
        sashWidth: leafSizes[0]?.leafW || 0,
        sashHeight: leafSizes[0]?.leafH || 0,
        topSashHeight: 0, bottomSashHeight: 0,
        config: { key: 'none', rows: 0, cols: 0 },
        components: { sash, box, beading: [] },
        glazingItems: [],
        customGlassUnits: paneGlass,
        casement: {
            layout, layoutDef, openers, panes: layoutDef.panels.length,
            leaves: leafSizes,
        },
        barPositions: { vertical: [], horizontal: [] },
        weights: { timber: 0, glass: 0, total: 0 },
        paint: calculatePaint(frameWidth, frameHeight),
        consumables: { glass: { type: windowSpec.glazing?.type || 'double', sqm: Math.round(glassSqm * 100) / 100 } },
        frame: { width: frameWidth, height: frameHeight },
    };
}

export function deriveWindowData(windowSpec, settings = {}) {
    const frameWidth = Number(windowSpec.frame?.width ?? 0);
    const frameHeight = Number(windowSpec.frame?.height ?? 0);
    const category = windowSpec.category || 'sash';
    if (category === 'casement') return deriveCasementWindow(windowSpec, frameWidth, frameHeight);
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
    const weights = calculateWeights(windowSpec, tripleSections ? tripleSections.center : sashWidth, topSashHeight, bottomSashHeight);
    const paint = calculatePaint(frameWidth, frameHeight);
    const consumables = calculateConsumables(windowSpec, frameWidth, frameHeight, sashWidth, topSashHeight, bottomSashHeight);

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
