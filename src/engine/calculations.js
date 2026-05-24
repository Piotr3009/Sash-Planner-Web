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
    SASH_HEIGHT_DIFFERENCE: 33,

    // Frame component deductions (verified against Excel)
    JAMB_HEIGHT_DEDUCTION: 108,
    HEAD_WIDTH_DEDUCTION: 0,
    SILL_WIDTH_DEDUCTION: 0,
    EXTERNAL_HEAD_LINER_DEDUCTION: 204,
    INTERNAL_HEAD_LINER_DEDUCTION: 172,

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

export const CONFIGURATIONS = Object.freeze({
    '2x2': {
        key: '2x2',
        rows: 2,
        cols: 2,
        totalPanes: 4,
        verticalBars: 1,
        horizontalBars: 1,
        description: '2×2 Traditional'
    },
    '3x3': {
        key: '3x3',
        rows: 3,
        cols: 3,
        totalPanes: 9,
        verticalBars: 2,
        horizontalBars: 2,
        description: '3×3 Georgian'
    },
    '4x4': {
        key: '4x4',
        rows: 4,
        cols: 4,
        totalPanes: 16,
        verticalBars: 3,
        horizontalBars: 3,
        description: '4×4 Fine Georgian'
    },
    '6x6': {
        key: '6x6',
        rows: 6,
        cols: 6,
        totalPanes: 36,
        verticalBars: 5,
        horizontalBars: 5,
        description: '6×6 Extra Fine'
    },
    '9x9': {
        key: '9x9',
        rows: 9,
        cols: 9,
        totalPanes: 81,
        verticalBars: 8,
        horizontalBars: 8,
        description: '9×9 Ultra Fine'
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

    const sashWidth = frameWidth - CONSTANTS.SASH_WIDTH_DEDUCTION;
    const totalSashHeight = frameHeight - CONSTANTS.SASH_HEIGHT_DEDUCTION;
    const topSashHeight = (totalSashHeight - CONSTANTS.SASH_HEIGHT_DIFFERENCE) / 2;
    const bottomSashHeight = topSashHeight + CONSTANTS.SASH_HEIGHT_DIFFERENCE;
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

function calculateSashComponentSet(windowSpec, settings, sashWidth, sashHeight) {
    const halfHeight = sashHeight / 2;
    const hornExtra = windowSpec.sash?.horns ? Number(windowSpec.sash?.hornExtension ?? settings.hornExtensionDefault) : 0;
    const meetingLength = sashWidth;

    const topSashHeight = halfHeight;
    const bottomSashHeight = halfHeight;

    const sashComponents = [];
    sashComponents.push(createComponentRecord(windowSpec, 'sash', 'TOP RAIL', '57x57', meetingLength, 1));
    sashComponents.push(createComponentRecord(windowSpec, 'sash', 'STILES TOP SASH (L)', '57x57', topSashHeight + hornExtra, 1));
    sashComponents.push(createComponentRecord(windowSpec, 'sash', 'STILES TOP SASH (R)', '57x57', topSashHeight + hornExtra, 1));
    sashComponents.push(createComponentRecord(windowSpec, 'sash', 'TOP MEET RAIL', '57x43', meetingLength, 1));
    sashComponents.push(createComponentRecord(windowSpec, 'sash', 'BOTTOM MEET RAIL', '57x43', meetingLength, 1));
    sashComponents.push(createComponentRecord(windowSpec, 'sash', 'STILES BOTTOM SASH (L)', '57x57', bottomSashHeight + hornExtra, 1));
    sashComponents.push(createComponentRecord(windowSpec, 'sash', 'STILES BOTTOM SASH (R)', '57x57', bottomSashHeight + hornExtra, 1));
    sashComponents.push(createComponentRecord(windowSpec, 'sash', 'BOTTOM RAIL', '57x90', meetingLength, 1));

    return sashComponents;
}

function calculateBoxComponentSet(windowSpec, frameWidth, frameHeight) {
    const cillExtension = Number(windowSpec.cill?.extension ?? 0);
    const headLength = frameWidth;
    const jambLength = frameHeight;

    const boxComponents = [];
    boxComponents.push(createComponentRecord(windowSpec, 'box', 'HEAD', '28x141', headLength, 1));
    boxComponents.push(createComponentRecord(windowSpec, 'box', 'CILL', '69x46', headLength + cillExtension, 1, `Extension ${cillExtension}mm`));
    boxComponents.push(createComponentRecord(windowSpec, 'box', 'CILL NOSE', '28x141', headLength + cillExtension, 1));
    boxComponents.push(createComponentRecord(windowSpec, 'box', 'JAMB LEFT', '28x141', jambLength, 1));
    boxComponents.push(createComponentRecord(windowSpec, 'box', 'JAMB RIGHT', '28x141', jambLength, 1));
    boxComponents.push(createComponentRecord(windowSpec, 'box', 'INTERNAL HEAD LINER', '17x86', headLength, 1));
    boxComponents.push(createComponentRecord(windowSpec, 'box', 'EXTERNAL HEAD LINER', '17x102', headLength, 1));
    boxComponents.push(createComponentRecord(windowSpec, 'box', 'INTERNAL JAMB LINER (L)', '17x86', jambLength, 1));
    boxComponents.push(createComponentRecord(windowSpec, 'box', 'INTERNAL JAMB LINER (R)', '17x86', jambLength, 1));
    boxComponents.push(createComponentRecord(windowSpec, 'box', 'EXTERNAL JAMB LINER (L)', '17x102', jambLength, 1));
    boxComponents.push(createComponentRecord(windowSpec, 'box', 'EXTERNAL JAMB LINER (R)', '17x102', jambLength, 1));

    return boxComponents;
}

function calculateGlazingSummaryForWindow(windowSpec, sashWidth, sashHeight, settings) {
    const grid = windowSpec.sash?.grid ?? { rows: 2, cols: 2 };
    const clearWidth = Math.max(sashWidth - 2 * CONSTANTS.STILE_WIDTH, 0);
    const clearHeight = Math.max((sashHeight / 2) - CONSTANTS.TOP_RAIL_WIDTH - CONSTANTS.BOTTOM_RAIL_WIDTH, 0);

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

const BEADING_BAR_PATTERNS = {
    'none': { v: 0, h: 0 }, '2x2': { v: 1, h: 0 }, '3x3': { v: 2, h: 0 },
    '4x4': { v: 1, h: 1 }, '6x6': { v: 2, h: 1 }, '9x9': { v: 2, h: 2 },
};

function calculateBeadingComponents(windowSpec, frameWidth, frameHeight, sashWidth, topSashHeight) {
    const F = OFFCUT_FACTOR;
    const glassW = sashWidth - 2 * CONSTANTS.STILE_WIDTH;
    const glassH = topSashHeight - CONSTANTS.TOP_RAIL_WIDTH - CONSTANTS.MEETING_RAIL_WIDTH;

    const gridMode = windowSpec.sash?.grid?.mode || 'none';
    const pattern = BEADING_BAR_PATTERNS[gridMode] || BEADING_BAR_PATTERNS['none'];
    const barPerSash = (pattern.v * glassH) + (pattern.h * glassW);

    const rec = (name, lengthMm, notes) =>
        createComponentRecord(windowSpec, 'beading', name, 'profile', lengthMm, 1, notes);

    const beading = [];

    // 1. Glazing bar beading — perimeter of glass area × 2 sashes
    const perimPerSash = 2 * (glassW + glassH);
    beading.push(rec('GLAZING BAR BEADING', round(perimPerSash * 2 * F),
        `Perim ${round(perimPerSash)} × 2 + 15%`));

    // 2 & 3. Georgian + Triangle (only if bars exist)
    if (barPerSash > 0) {
        const barTotal = round(barPerSash * 2 * F);
        beading.push(rec('INTERNAL GEORGIAN BEADING', barTotal,
            `Bars ${round(barPerSash)} × 2 + 15%`));
        beading.push(rec('TRIANGLE BEADING (EXT)', barTotal,
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

export function deriveWindowData(windowSpec, settings = {}) {
    const frameWidth = Number(windowSpec.frame?.width ?? 0);
    const frameHeight = Number(windowSpec.frame?.height ?? 0);
    const gridMode = windowSpec.sash?.grid?.mode ?? '2x2';

    const config = resolveConfiguration(gridMode, windowSpec.sash?.grid ?? {});
    const sashWidth = frameWidth - CONSTANTS.SASH_WIDTH_DEDUCTION;
    const totalSashHeight = frameHeight - CONSTANTS.SASH_HEIGHT_DEDUCTION;
    const topSashHeight = (totalSashHeight - CONSTANTS.SASH_HEIGHT_DIFFERENCE) / 2;
    const bottomSashHeight = topSashHeight + CONSTANTS.SASH_HEIGHT_DIFFERENCE;
    const sashHeight = totalSashHeight;

    const sashComponents = calculateSashComponentSet(windowSpec, settings, sashWidth, sashHeight);
    const boxComponents = calculateBoxComponentSet(windowSpec, frameWidth, frameHeight);
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

    return {
        sashWidth,
        sashHeight,
        topSashHeight,
        bottomSashHeight,
        config,
        components: { sash: sashComponents, box: boxComponents, beading: beadingComponents },
        glazingItems: [glazingSummary],
        barPositions,
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

export function summariseProjectWindows(windows, settings) {
    const { sash, box, glazing } = aggregateComponents(windows, settings);
    const cutLists = {
        sash: aggregateCutList(sash),
        box: aggregateCutList(box),
    };

    const precut = {
        sashEngineering: buildSashPrecut(sash, settings),
        boxSapele: buildBoxPrecut(box, windows, settings),
    };

    return {
        cutLists,
        precut,
        glazing,
    };
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
    const jambLength = frameHeight - CONSTANTS.JAMB_HEIGHT_DEDUCTION;
    const headLength = frameWidth - CONSTANTS.HEAD_WIDTH_DEDUCTION;
    const sillLength = frameWidth - CONSTANTS.SILL_WIDTH_DEDUCTION;
    const extHeadLiner = frameWidth - CONSTANTS.EXTERNAL_HEAD_LINER_DEDUCTION;
    const intHeadLiner = frameWidth - CONSTANTS.INTERNAL_HEAD_LINER_DEDUCTION;
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
    const availableWidth = sashWidth - 2 * CONSTANTS.STILE_WIDTH;
    const availableHeight = sashHeight - CONSTANTS.TOP_RAIL_WIDTH - CONSTANTS.BOTTOM_RAIL_WIDTH;

    const stiles = buildComponent('Sash stiles', CONSTANTS.STILE_WIDTH, sashHeight, 2, CONSTANTS.SASH_SECTION, 'Hardwood', {
        preCutLength: sashHeight + CONSTANTS.HORN_ALLOWANCE_VERTICAL,
        cutLength: sashHeight
    });

    const topRail = buildComponent('Top rail', CONSTANTS.TOP_RAIL_WIDTH, horizontalLength, 1, CONSTANTS.SASH_SECTION, 'Hardwood', {
        preCutLength: horizontalLength + CONSTANTS.HORN_ALLOWANCE_HORIZONTAL,
        cutLength: horizontalLength
    });

    const meetingRail = buildComponent('Meeting rail', CONSTANTS.MEETING_RAIL_WIDTH, horizontalLength, 1, CONSTANTS.SASH_SECTION, 'Hardwood', {
        preCutLength: horizontalLength + CONSTANTS.HORN_ALLOWANCE_HORIZONTAL,
        cutLength: horizontalLength
    });

    const bottomRail = buildComponent('Bottom rail', CONSTANTS.BOTTOM_RAIL_WIDTH, horizontalLength, 1, CONSTANTS.SASH_SECTION, 'Hardwood', {
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
    const availableWidth = sashWidth - 2 * CONSTANTS.STILE_WIDTH;
    const availableHeight = sashHeight - CONSTANTS.TOP_RAIL_WIDTH - CONSTANTS.BOTTOM_RAIL_WIDTH;

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
            section: CONSTANTS.SASH_SECTION,
            material: 'Hardwood'
        });
    }

    if (sashComponents.glazingBars.horizontal.quantity > 0) {
        push({
            element: 'Horizontal glazing bar',
            width: CONSTANTS.GLAZING_BAR_WIDTH,
            length: sashComponents.glazingBars.horizontal.length,
            quantity: sashComponents.glazingBars.horizontal.quantity,
            section: CONSTANTS.SASH_SECTION,
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
