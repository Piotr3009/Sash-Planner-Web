// pricing.js — sales-price engine for Estimates.
//
// This is a 1:1 port of the Prime Sash Windows web estimator
// (js/pricing-config.js + js/price-calculator.js), rewritten as a pure ES
// module. It is COMPLETELY SEPARATE from calculations.js / deriveWindowData():
// that engine computes production materials; this one computes the price the
// customer pays. One window object, two independent calculations.
//
// Usage:  const { unitPrice, totalPrice, breakdown } = calculatePrice(config, pricing)
//   config  — a window configuration (same shape the 3D configurator produces)
//   pricing — a rates object; omit to use DEFAULT_PRICING below.
//
// All rates are editable per-tenant via the Pricing Settings page. The defaults
// here are the REAL Prime Sash Windows rates (sash double = £850/m², triple =
// £950/m², etc.) so a new tenant starts from a sane, working price list.

// ─────────────────────────────────────────────────────────────
// DEFAULT_PRICING — real PSW rates (frozen so callers can't mutate them).
// ─────────────────────────────────────────────────────────────
export const DEFAULT_PRICING = Object.freeze({
  // Sash base price per m²
  basePricePerSqm: 850, // double-hung base (degressive multiplier applied)
  triplePricePerSqm: 950, // triple sash, flat (no size degression)

  // Degressive size multipliers — bigger window, cheaper per m²
  sizeMultipliers: [
    { maxSqm: 1.0, multiplier: 1.35 },
    { maxSqm: 1.5, multiplier: 0.95 },
    { maxSqm: 2.0, multiplier: 0.9 },
    { maxSqm: 3.0, multiplier: 0.85 },
    { maxSqm: 999, multiplier: 0.8 },
  ],

  // Georgian bars
  pricePerBar: 15,
  barsPerPattern: {
    none: 0, '2x2': 2, '3x3': 4, '4x4': 4, '6x6': 5, '9x9': 8,
    '2-vertical': 2, '1-vertical': 1, custom: null,
  },

  // Frame type
  frameTypes: { standard: 0, slim: 180 },

  // Glass type (added per m² for sliding/bifold via glassMultiplier)
  glassTypes: { double: 0, triple: 150, passive: 250 },
  // Glass spec — laminated charged per m²
  glassSpec: { toughened: 0, laminated: 90 },
  // Glass finish
  glassFinish: { clear: 0, frosted: 80 },

  // Opening mechanism (discounts, stored as the value subtracted)
  openingTypes: { both: 0, bottom: -30, fixed: -50 },

  // Colour surcharges (fractions of subtotal)
  colorSingleNonWhite: 0.05, // single colour other than white: +5%
  colorDual: 0.15, // dual colour: +15%
  archedHead: 0.10, // arched glazing head: +10%

  // Sill extension
  sillExtension: { none: 0, '35': 45, '60': 65, '85': 85 },

  // Security
  pas24: { no: 0, yes: 0 },

  // Quantity discounts (currently all 0 in PSW)
  quantityDiscounts: [
    { minQty: 1, discount: 0 },
    { minQty: 6, discount: 0 },
    { minQty: 12, discount: 0 },
    { minQty: 24, discount: 0 },
  ],

  vatRate: 0.20,

  // ── Casement ──
  casement: {
    basePriceMin: 300,
    basePricePerSqm: 300,
    firstSqmPrice: 500,
    mullionPrice: 150,
    transomPrice: 200,
    sashPrice: 50,
    layouts: {
      '010T': { mullions: 0, transoms: 0, sashes: 1 },
      '040L': { mullions: 0, transoms: 0, sashes: 1 },
      '040R': { mullions: 0, transoms: 0, sashes: 1 },
      '040D': { mullions: 1, transoms: 0, sashes: 2 },
      '051L': { mullions: 1, transoms: 0, sashes: 1 },
      '051R': { mullions: 1, transoms: 0, sashes: 1 },
      '052L': { mullions: 1, transoms: 1, sashes: 2 },
      '052R': { mullions: 1, transoms: 1, sashes: 2 },
      '180L': { mullions: 1, transoms: 0, sashes: 1 },
      '180R': { mullions: 1, transoms: 0, sashes: 1 },
      '021': { mullions: 0, transoms: 1, sashes: 1 },
      '021L': { mullions: 0, transoms: 1, sashes: 2 },
      '021R': { mullions: 0, transoms: 1, sashes: 2 },
      '031': { mullions: 1, transoms: 1, sashes: 2 },
      '031L': { mullions: 1, transoms: 1, sashes: 3 },
      '031R': { mullions: 1, transoms: 1, sashes: 3 },
      '032': { mullions: 1, transoms: 1, sashes: 3 },
      '130': { mullions: 2, transoms: 0, sashes: 2 },
      '131': { mullions: 2, transoms: 1, sashes: 3 },
      '132': { mullions: 2, transoms: 2, sashes: 4 },
      '140L': { mullions: 3, transoms: 0, sashes: 1 },
      '140R': { mullions: 3, transoms: 0, sashes: 1 },
    },
  },

  // ── Fix-only ──
  fix: {
    rectanglePerSqm: 450,
    circlePerSqm: 1200,
    archFirstSqm: 800,
    archPerExtraSqm: 400,
    fd30PerSqm: 150,
    fd60PerSqm: 300,
    patternPrices: {
      intersecting: 250, 'half-hub': 150, 'hub-spoke': 210,
      'double-hub-spoke': 270, 'triple-hub-spoke': 320, sunburst: 300,
    },
  },

  // ── Arched casement ──
  archedCasement: {
    firstSqm: 1200,
    perExtraSqm: 600,
    sashAdd: 50,
    patternPrices: {
      intersecting: 250, 'half-hub': 150, 'hub-spoke': 210,
      'double-hub-spoke': 270, 'triple-hub-spoke': 320,
    },
  },

  // ── Door ──
  door: {
    basePerSqm: 680,
    frenchSurchargePerSqm: 50,
    panelBasePerSqm: 500,
    slidingStandardPerSqm: 1100,
    slidingExtraPerSqm: 1400,
    bifoldPerSqm: 1050,
    sillExtensionPrice: 80,
    sillRatePerM: 80, // sliding/bifold sill, per linear metre
    beadingDoor: 80,
    beadingPanel: 40,
    recessedDoor: 120,
    recessedPanel: 80,
    singleColourSurcharge: 0.05,
    dualColourSurcharge: 0.15,
  },
});

// Merge a (possibly partial) tenant config over the defaults so missing keys
// always fall back. One level deep is enough for our shape.
export function resolvePricing(config) {
  if (!config || typeof config !== 'object') return DEFAULT_PRICING;
  const out = { ...DEFAULT_PRICING };
  for (const key of Object.keys(config)) {
    const val = config[key];
    if (val && typeof val === 'object' && !Array.isArray(val) && DEFAULT_PRICING[key] && typeof DEFAULT_PRICING[key] === 'object' && !Array.isArray(DEFAULT_PRICING[key])) {
      out[key] = { ...DEFAULT_PRICING[key], ...val };
    } else {
      out[key] = val;
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function getSizeMultiplier(pricing, sqm) {
  for (const tier of pricing.sizeMultipliers) {
    if (sqm <= tier.maxSqm) return tier.multiplier;
  }
  return 0.8;
}

function getQuantityDiscount(pricing, quantity) {
  let discount = 0;
  for (const tier of pricing.quantityDiscounts) {
    if (quantity >= tier.minQty) discount = tier.discount;
  }
  return discount;
}

function calculateBarsPrice(pricing, upperBars, lowerBars, customBars) {
  let totalBars = 0;
  if (upperBars === 'custom' && customBars?.upper) {
    totalBars += (customBars.upper.horizontal?.length || 0) + (customBars.upper.vertical?.length || 0);
  } else if (upperBars && upperBars !== 'none' && pricing.barsPerPattern[upperBars] !== undefined && pricing.barsPerPattern[upperBars] !== null) {
    totalBars += pricing.barsPerPattern[upperBars];
  }
  if (lowerBars === 'custom' && customBars?.lower) {
    totalBars += (customBars.lower.horizontal?.length || 0) + (customBars.lower.vertical?.length || 0);
  } else if (lowerBars && lowerBars !== 'none' && pricing.barsPerPattern[lowerBars] !== undefined && pricing.barsPerPattern[lowerBars] !== null) {
    totalBars += pricing.barsPerPattern[lowerBars];
  }
  return totalBars * pricing.pricePerBar;
}

// Ironmongery is passed inside config.ironmongery as an array of selected
// products ({ price_net|price, quantity }) — the configurator (Stage 2) fills
// it. When absent, contributes nothing.
function ironmongeryTotal(config) {
  const sel = config.ironmongery;
  if (!sel) return 0;
  const list = Array.isArray(sel) ? sel : Object.values(sel);
  let total = 0;
  list.forEach((p) => {
    if (!p) return;
    const price = p.price_net || p.price || 0;
    const qty = p.quantity || 1;
    total += price * qty;
  });
  return total;
}

function calculateAdditionalOptions(pricing, config, sqm, glassMultiplier) {
  if (glassMultiplier === undefined) glassMultiplier = 1;
  let add = 0;

  if (config.frameType && pricing.frameTypes[config.frameType]) {
    add += pricing.frameTypes[config.frameType];
  }
  if (config.glassType && pricing.glassTypes[config.glassType]) {
    add += pricing.glassTypes[config.glassType] * glassMultiplier;
  }
  if (config.glassSpec && pricing.glassSpec[config.glassSpec]) {
    add += pricing.glassSpec[config.glassSpec] * sqm; // laminated £/m²
  }
  if (config.glassFinish && pricing.glassFinish[config.glassFinish]) {
    add += pricing.glassFinish[config.glassFinish] * glassMultiplier;
  }

  add += ironmongeryTotal(config);

  // Opening — skip for triple (bottom-only is the only option, no discount)
  if (config.sashType !== 'triple' && config.openingType && pricing.openingTypes[config.openingType]) {
    add += pricing.openingTypes[config.openingType];
  }
  if (config.sillExtension && pricing.sillExtension[config.sillExtension]) {
    add += pricing.sillExtension[config.sillExtension];
  }
  if (config.pas24 && pricing.pas24[config.pas24]) {
    add += pricing.pas24[config.pas24];
  }
  return add;
}

function frameDims(config) {
  const width = config.width;
  const height = config.height;
  let frameWidth, frameHeight;
  if (config.actualFrameWidth && config.actualFrameHeight) {
    frameWidth = config.actualFrameWidth;
    frameHeight = config.actualFrameHeight;
  } else {
    const mt = config.measurementType || 'brick-to-brick';
    if (mt === 'brick-to-brick') {
      frameWidth = width + 150;
      frameHeight = height + 75;
    } else {
      frameWidth = width;
      frameHeight = height;
    }
  }
  return { frameWidth, frameHeight };
}

function round2(n) { return Math.round(n * 100) / 100; }

// ─────────────────────────────────────────────────────────────
// MAIN: calculatePrice(config, pricingConfig)
// ─────────────────────────────────────────────────────────────
export function calculatePrice(config, pricingConfig) {
  const pricing = resolvePricing(pricingConfig);

  if (!config) {
    return { unitPrice: 0, totalPrice: 0, breakdown: {}, noDimensions: true };
  }
  const width = config.width;
  const height = config.height;
  if (!width || width === 0 || !height || height === 0) {
    return { unitPrice: 0, totalPrice: 0, breakdown: {}, noDimensions: true, message: 'Enter dimensions' };
  }

  const { frameWidth, frameHeight } = frameDims(config);
  const sqm = (frameWidth / 1000) * (frameHeight / 1000);

  if (config.windowType === 'casement' && pricing.casement) {
    if (config.casementType === 'arched') return calculateArchedCasement(pricing, config, sqm, frameWidth, frameHeight);
    return calculateCasement(pricing, config, sqm, frameWidth, frameHeight);
  }
  if (config.windowType === 'fix-only') {
    return calculateFixOnly(pricing, config, sqm, frameWidth, frameHeight);
  }
  if (config.productType === 'door' || config.windowCategory === 'door') {
    return calculateDoor(pricing, config, frameWidth, frameHeight);
  }

  // ── SASH ──
  let basePrice;
  let sizeMultiplier;
  if (config.sashType === 'triple') {
    sizeMultiplier = 1.0;
    basePrice = pricing.triplePricePerSqm * sqm;
  } else {
    sizeMultiplier = getSizeMultiplier(pricing, sqm);
    basePrice = pricing.basePricePerSqm * sqm * sizeMultiplier;
  }

  const barsPrice = calculateBarsPrice(pricing, config.upperBars || 'none', config.lowerBars || 'none', config.customBars);

  let fixBarsPrice = 0;
  if (config.sashType === 'triple') {
    const fixBarsOnce = calculateBarsPrice(pricing, config.fixUpperBars || 'none', config.fixLowerBars || 'none', config.fixCustomBars);
    fixBarsPrice = fixBarsOnce * 2; // left + right fix
  }

  const additionalPrice = calculateAdditionalOptions(pricing, config, sqm, sqm);

  let subtotal = basePrice + barsPrice + fixBarsPrice + additionalPrice;

  if (config.headType === 'arch') {
    subtotal += subtotal * pricing.archedHead;
  }

  if (config.colorType === 'dual') {
    subtotal += subtotal * pricing.colorDual;
  } else if (config.colorType === 'single' && config.colorSingle && config.colorSingle !== 'white') {
    subtotal += subtotal * pricing.colorSingleNonWhite;
  }

  const quantity = config.quantity || 1;
  const discount = getQuantityDiscount(pricing, quantity);
  const discountAmount = subtotal * discount;
  const unitPrice = subtotal - discountAmount;
  const totalPrice = unitPrice * quantity;

  return {
    unitPrice: round2(unitPrice),
    totalPrice: round2(totalPrice),
    breakdown: {
      frameWidth, frameHeight,
      sqm: sqm.toFixed(2),
      sizeMultiplier,
      basePrice: basePrice.toFixed(2),
      barsPrice, fixBarsPrice,
      sashType: config.sashType || 'double',
      additionalOptions: additionalPrice,
      subtotal: subtotal.toFixed(2),
      quantity,
      discount: (discount * 100) + '%',
      discountAmount: discountAmount.toFixed(2),
      unitPrice: unitPrice.toFixed(2),
      totalPrice: totalPrice.toFixed(2),
      vatAmount: (totalPrice * pricing.vatRate).toFixed(2),
      totalWithVat: (totalPrice * (1 + pricing.vatRate)).toFixed(2),
    },
  };
}

// ── CASEMENT ──
export function calculateCasement(pricing, config, sqm, frameWidth, frameHeight) {
  const c = pricing.casement;
  const layout = config.casementLayout || '040L';
  const layoutData = c.layouts[layout] || { mullions: 0, transoms: 0, sashes: 1 };

  let basePrice = c.firstSqmPrice;
  if (sqm > 1) basePrice += (sqm - 1) * c.basePricePerSqm;
  basePrice = Math.max(basePrice, c.basePriceMin);
  basePrice += layoutData.mullions * c.mullionPrice + layoutData.transoms * c.transomPrice + layoutData.sashes * c.sashPrice;

  let barsPrice = 0;
  const totalBars = (config.casementHBars || 0) + (config.casementVBars || 0);
  if (totalBars > 0) {
    barsPrice = totalBars * 2 * pricing.pricePerBar;
    barsPrice *= Math.max(1, layoutData.sashes + (layoutData.mullions + 1 - layoutData.sashes));
  }

  const additionalPrice = calculateAdditionalOptions(pricing, config, sqm, sqm);
  let subtotal = basePrice + barsPrice + additionalPrice;

  if (config.colorType === 'dual') subtotal += subtotal * 0.15;
  else if (config.colorType === 'single' && config.colorSingle && config.colorSingle !== 'white') subtotal += subtotal * 0.10;

  const quantity = config.quantity || 1;
  const discount = getQuantityDiscount(pricing, quantity);
  const unitPrice = subtotal - subtotal * discount;
  const totalPrice = unitPrice * quantity;

  return {
    unitPrice: round2(unitPrice),
    totalPrice: round2(totalPrice),
    breakdown: {
      windowType: 'casement', layout, frameWidth, frameHeight,
      sqm: sqm.toFixed(2), basePrice: basePrice.toFixed(2),
      mullions: layoutData.mullions, transoms: layoutData.transoms, sashes: layoutData.sashes,
      barsPrice: barsPrice.toFixed(2), additionalOptions: additionalPrice,
      subtotal: subtotal.toFixed(2), quantity,
      unitPrice: unitPrice.toFixed(2), totalPrice: totalPrice.toFixed(2),
      vatAmount: (totalPrice * pricing.vatRate).toFixed(2),
      totalWithVat: (totalPrice * (1 + pricing.vatRate)).toFixed(2),
    },
  };
}

// ── FIX-ONLY ──
export function calculateFixOnly(pricing, config, sqm, frameWidth, frameHeight) {
  const f = pricing.fix;
  const shape = config.fixShape || 'rectangle';
  const type = config.fixType || 'standard';

  let basePrice;
  if (shape === 'rectangle') basePrice = sqm * f.rectanglePerSqm;
  else if (shape === 'circle') basePrice = sqm * f.circlePerSqm;
  else basePrice = f.archFirstSqm + Math.max(0, sqm - 1) * f.archPerExtraSqm;

  if (type === 'fd30') basePrice += sqm * f.fd30PerSqm;
  else if (type === 'fd60') basePrice += sqm * f.fd60PerSqm;

  let patternPrice = 0;
  const semiPat = config.fixSemiBarPattern || 'none';
  const gothPat = config.fixGothicBars || 'none';
  const circlePat = config.fixCircleBarPattern || 'none';
  if (semiPat !== 'none' && f.patternPrices[semiPat]) patternPrice = f.patternPrices[semiPat];
  if (gothPat !== 'none' && f.patternPrices[gothPat]) patternPrice = f.patternPrices[gothPat];
  if (circlePat !== 'none' && f.patternPrices[circlePat]) patternPrice = f.patternPrices[circlePat];

  const totalBars = (config.casementHBars || 0) + (config.casementVBars || 0);
  const barsPrice = totalBars * 2 * pricing.pricePerBar;

  const additionalPrice = calculateAdditionalOptions(pricing, config, sqm, sqm);
  let subtotal = basePrice + patternPrice + barsPrice + additionalPrice;

  if (config.colorType === 'dual') subtotal += subtotal * 0.15;
  else if (config.colorType === 'single' && config.colorSingle && config.colorSingle !== 'white') subtotal += subtotal * 0.10;

  const quantity = config.quantity || 1;
  const discount = getQuantityDiscount(pricing, quantity);
  const unitPrice = subtotal - subtotal * discount;
  const totalPrice = unitPrice * quantity;

  return {
    unitPrice: round2(unitPrice),
    totalPrice: round2(totalPrice),
    breakdown: {
      windowType: 'fix-only', shape, frameType: type, frameWidth, frameHeight,
      sqm: sqm.toFixed(2), basePrice: basePrice.toFixed(2),
      patternPrice, barsPrice: barsPrice.toFixed(2), additionalOptions: additionalPrice,
      subtotal: subtotal.toFixed(2), quantity,
      unitPrice: unitPrice.toFixed(2), totalPrice: totalPrice.toFixed(2),
      vatAmount: (totalPrice * pricing.vatRate).toFixed(2),
      totalWithVat: (totalPrice * (1 + pricing.vatRate)).toFixed(2),
    },
  };
}

// ── ARCHED CASEMENT ──
export function calculateArchedCasement(pricing, config, sqm, frameWidth, frameHeight) {
  const a = pricing.archedCasement;
  let basePrice = a.firstSqm + Math.max(0, sqm - 1) * a.perExtraSqm + a.sashAdd;

  let patternPrice = 0;
  const semiPat = config.fixSemiBarPattern || 'none';
  const gothPat = config.fixGothicBars || 'none';
  if (semiPat !== 'none' && a.patternPrices[semiPat]) patternPrice = a.patternPrices[semiPat];
  if (gothPat !== 'none' && a.patternPrices[gothPat]) patternPrice = a.patternPrices[gothPat];

  const totalBars = (config.casementHBars || 0) + (config.casementVBars || 0);
  const barsPrice = totalBars * 2 * pricing.pricePerBar;

  const additionalPrice = calculateAdditionalOptions(pricing, config, sqm, sqm);
  let subtotal = basePrice + patternPrice + barsPrice + additionalPrice;

  if (config.colorType === 'dual') subtotal += subtotal * 0.15;
  else if (config.colorType === 'single' && config.colorSingle && config.colorSingle !== 'white') subtotal += subtotal * 0.10;

  const quantity = config.quantity || 1;
  const discount = getQuantityDiscount(pricing, quantity);
  const unitPrice = subtotal - subtotal * discount;
  const totalPrice = unitPrice * quantity;

  return {
    unitPrice: round2(unitPrice),
    totalPrice: round2(totalPrice),
    breakdown: {
      windowType: 'arched-casement', shape: config.casArchShape || 'semi-circle',
      frameWidth, frameHeight, sqm: sqm.toFixed(2), basePrice: basePrice.toFixed(2),
      patternPrice, barsPrice: barsPrice.toFixed(2), additionalOptions: additionalPrice,
      subtotal: subtotal.toFixed(2), quantity,
      unitPrice: unitPrice.toFixed(2), totalPrice: totalPrice.toFixed(2),
      vatAmount: (totalPrice * pricing.vatRate).toFixed(2),
      totalWithVat: (totalPrice * (1 + pricing.vatRate)).toFixed(2),
    },
  };
}

// ── DOOR ──
export function calculateDoor(pricing, config, frameWidth, frameHeight) {
  const d = pricing.door;
  const doorW = config.width || 900;
  const doorH = config.height || 2100;
  const doorSqm = (doorW / 1000) * (doorH / 1000);
  const doorType = config.doorType || 'single-external';
  const isSliding = doorType === 'sliding';
  const isBifold = doorType === 'bifold';
  const isFrench = doorType === 'french';

  let basePrice;
  if (isSliding) {
    const rate = config.extraWidth ? d.slidingExtraPerSqm : d.slidingStandardPerSqm;
    basePrice = rate * doorSqm;
  } else if (isBifold) {
    basePrice = d.bifoldPerSqm * doorSqm;
  } else {
    basePrice = d.basePerSqm * doorSqm;
    if (isFrench) basePrice += d.frenchSurchargePerSqm * doorSqm;
  }

  let panelPrice = 0;
  const sidePanels = config.sidePanels || 'none';
  const hasLeft = sidePanels === 'left' || sidePanels === 'both';
  const hasRight = sidePanels === 'right' || sidePanels === 'both';
  let panelCount = 0;
  if (hasLeft) {
    const leftW = config.sideLeftWidth || 500;
    panelPrice += d.panelBasePerSqm * ((leftW / 1000) * (doorH / 1000));
    panelCount++;
  }
  if (hasRight) {
    const rightW = config.sideRightWidth || 500;
    panelPrice += d.panelBasePerSqm * ((rightW / 1000) * (doorH / 1000));
    panelCount++;
  }

  const barRate = pricing.pricePerBar;
  const doorBarCount = (config.hBars || 0) + (config.vBars || 0);
  const doorPanelCount = (isSliding || isBifold) ? (config.panelCount || 2) : 1;
  let barsPrice = doorBarCount * barRate * doorPanelCount;
  const sideBarCount = (config.sideHBars || 0) + (config.sideVBars || 0);
  barsPrice += sideBarCount * panelCount * barRate;

  let sillPrice = 0;
  if (config.thresholdExtension > 0) {
    if (isSliding || isBifold) sillPrice = Math.round(d.sillRatePerM * (doorW / 1000));
    else sillPrice = d.sillExtensionPrice;
  }

  let panelingPrice = 0;
  const paneling = config.doorPaneling || 'flat';
  const doorStyle = config.doorStyle || 'full-glass';
  const sideStyle = config.sideStyle || 'full-glass';
  const chargeablePanels = sideStyle === 'same' ? panelCount : 0;
  if (doorStyle !== 'full-glass') {
    if (paneling === 'beading') panelingPrice = (d.beadingDoor * doorPanelCount) + (chargeablePanels * d.beadingPanel);
    else if (paneling === 'panel') panelingPrice = (d.recessedDoor * doorPanelCount) + (chargeablePanels * d.recessedPanel);
  }

  const totalSqm = doorSqm
    + (hasLeft ? (config.sideLeftWidth || 500) / 1000 * doorH / 1000 : 0)
    + (hasRight ? (config.sideRightWidth || 500) / 1000 * doorH / 1000 : 0);
  const glassMultiplier = (isSliding || isBifold) ? totalSqm : 1;
  const additionalPrice = calculateAdditionalOptions(pricing, config, totalSqm, glassMultiplier);

  let subtotal = basePrice + panelPrice + barsPrice + sillPrice + panelingPrice + additionalPrice;

  let colourSurcharge = 0;
  const isWhite = !config.woodColor || config.woodColor === '#FAFAFA' || config.woodColor === '#F6F6F6' || config.woodColor === '#ffffff';
  if (!config.sameColor) colourSurcharge = subtotal * d.dualColourSurcharge;
  else if (!isWhite) colourSurcharge = subtotal * d.singleColourSurcharge;
  subtotal += colourSurcharge;

  const quantity = config.quantity || 1;
  const discount = getQuantityDiscount(pricing, quantity);
  const unitPrice = subtotal - subtotal * discount;
  const totalPrice = unitPrice * quantity;

  return {
    unitPrice: round2(unitPrice),
    totalPrice: round2(totalPrice),
    total: round2(unitPrice),
    breakdown: {
      windowType: 'door', doorWidth: doorW, doorHeight: doorH, doorSqm: doorSqm.toFixed(2),
      basePrice: basePrice.toFixed(2), panelPrice: panelPrice.toFixed(2), panelCount,
      barsPrice: barsPrice.toFixed(2), sillPrice: sillPrice.toFixed(2), panelingPrice: panelingPrice.toFixed(2),
      additionalOptions: additionalPrice, colourSurcharge: colourSurcharge.toFixed(2),
      subtotal: subtotal.toFixed(2), quantity,
      unitPrice: unitPrice.toFixed(2), totalPrice: totalPrice.toFixed(2),
      vatAmount: (totalPrice * pricing.vatRate).toFixed(2),
      totalWithVat: (totalPrice * (1 + pricing.vatRate)).toFixed(2),
    },
  };
}

// Convenience for currency formatting in UI.
export function formatPrice(price, includeSymbol = true) {
  const formatted = Number(price || 0).toFixed(2);
  return includeSymbol ? `£${formatted}` : formatted;
}
