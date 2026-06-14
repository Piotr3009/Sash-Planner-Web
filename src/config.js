/**
 * config.js — Single source of truth for all shared window options.
 *
 * Shared across: ConfiguratorPage, 3D App, specification.js, windowSpecToConfig.js
 * Per-type options (sash horns, casement layouts, door styles) stay in their respective files.
 */

// ═══════════════════════════════════════════════════════════════
// RAL COLOURS — full lookup table (~200 entries)
// ═══════════════════════════════════════════════════════════════
export const RAL_LOOKUP = {
  '1000': '#BEBD7F', '1001': '#C2B078', '1002': '#C6A664', '1003': '#E5BE01',
  '1004': '#CDA434', '1005': '#A98307', '1006': '#E4A010', '1007': '#DC9D00',
  '1011': '#8A6642', '1012': '#C7B446', '1013': '#EAE6CA', '1014': '#E1CC4F',
  '1015': '#E6D690', '1016': '#EDFF21', '1017': '#F5D033', '1018': '#F8F32B',
  '1019': '#9E9764', '1020': '#999950', '1021': '#F3DA0B', '1023': '#FAD201',
  '1024': '#AEA04B', '1026': '#FFFF00', '1027': '#9D9101', '1028': '#F4A900',
  '1032': '#D6AE01', '1033': '#F3A505', '1034': '#EFA94A', '1035': '#6A5D4D',
  '1036': '#705335', '1037': '#F39F18', '2000': '#ED760E', '2001': '#C93C20',
  '2002': '#CB2821', '2003': '#FF7514', '2004': '#F44611', '2005': '#FF2301',
  '2007': '#FFA420', '2008': '#F75E25', '2009': '#F54021', '2010': '#D84B20',
  '2011': '#EC7C26', '2012': '#E55137', '2013': '#C35831', '3000': '#AF2B1E',
  '3001': '#A52019', '3002': '#A2231D', '3003': '#9B111E', '3004': '#75151E',
  '3005': '#5E2129', '3007': '#412227', '3009': '#642424', '3011': '#781F19',
  '3012': '#C1876B', '3013': '#A12312', '3014': '#D36E70', '3015': '#EA899A',
  '3016': '#B32821', '3017': '#E63244', '3018': '#D53032', '3020': '#CC0605',
  '3022': '#D95030', '3024': '#F80000', '3026': '#FE0000', '3027': '#C51D34',
  '3028': '#CB3234', '3031': '#B32428', '3032': '#721422', '3033': '#B44C43',
  '4001': '#6D3F5B', '4002': '#922B3E', '4003': '#DE4C8A', '4004': '#641C34',
  '4005': '#6C4675', '4006': '#A03472', '4007': '#4A192C', '4008': '#924E7D',
  '4009': '#A18594', '4010': '#CF3476', '4011': '#8673A1', '4012': '#6C6874',
  '5000': '#354D73', '5001': '#1F3438', '5002': '#20214F', '5003': '#1D1E33',
  '5004': '#18171C', '5005': '#1E2460', '5007': '#3E5F8A', '5008': '#26252D',
  '5009': '#025669', '5010': '#0E4243', '5011': '#1B2A4A', '5012': '#3B83BD',
  '5013': '#1E213D', '5014': '#606E8C', '5015': '#2271B3', '5017': '#063971',
  '5018': '#3F888F', '5019': '#1B5583', '5020': '#1D334A', '5021': '#256D7B',
  '5022': '#252850', '5023': '#49678D', '5024': '#5D9B9B', '5025': '#2A6478',
  '5026': '#102C54', '6000': '#316650', '6001': '#287233', '6002': '#2D572C',
  '6003': '#424632', '6004': '#1F3A3D', '6005': '#2F4538', '6006': '#3E3B32',
  '6007': '#343B29', '6008': '#39352A', '6009': '#31372B', '6010': '#35682D',
  '6011': '#587246', '6012': '#343E40', '6013': '#6C7156', '6014': '#47402E',
  '6015': '#3B3C36', '6016': '#1E5945', '6017': '#4C9141', '6018': '#57A639',
  '6019': '#BDECB6', '6020': '#2E3A23', '6021': '#89AC76', '6022': '#25221B',
  '6024': '#308446', '6025': '#3D6B35', '6026': '#1C542D', '6027': '#83C491',
  '6028': '#2B5B34', '6029': '#20603D', '6032': '#317F43', '6033': '#497E76',
  '6034': '#7FB5B5', '6035': '#1C542D', '6036': '#193737', '6037': '#008F39',
  '6038': '#00BB2D', '7000': '#78858B', '7001': '#8A9597', '7002': '#817F68',
  '7003': '#7D7F7D', '7004': '#9EA0A1', '7005': '#6C7059', '7006': '#756F61',
  '7008': '#6A5F31', '7009': '#4D5645', '7010': '#4C514A', '7011': '#434B4D',
  '7012': '#4E5754', '7013': '#464531', '7015': '#434750', '7016': '#293133',
  '7021': '#23282B', '7022': '#332F2C', '7023': '#8B8C7A', '7024': '#474A51',
  '7026': '#2F353B', '7030': '#8B8B7A', '7031': '#474B4E', '7032': '#B8B799',
  '7033': '#7D8471', '7034': '#8F8B66', '7035': '#D7D7D7', '7036': '#7F7679',
  '7037': '#7D7F7D', '7038': '#B5B8B1', '7039': '#6C6960', '7040': '#9DA1AA',
  '7042': '#8D948D', '7043': '#4E5452', '7044': '#CAC4B0', '7045': '#909090',
  '7046': '#82898F', '7047': '#D0D0D0', '7048': '#898176', '8000': '#826C34',
  '8001': '#955F20', '8002': '#6C3B2A', '8003': '#734222', '8004': '#8E402A',
  '8007': '#59351F', '8008': '#6F4F28', '8009': '#5B3A29', '8010': '#592321',
  '8011': '#6F3B2A', '8012': '#6D3525', '8014': '#382C1E', '8015': '#633A34',
  '8016': '#4C2F27', '8017': '#45322E', '8019': '#403A3A', '8022': '#212121',
  '8023': '#A65E2E', '8024': '#79553D', '8025': '#755C48', '8028': '#4E3B31',
  '8029': '#763C28', '9001': '#FDF4E3', '9002': '#E7EBDA', '9003': '#F4F4F4',
  '9004': '#282828', '9005': '#0A0A0A', '9006': '#A5A5A5', '9007': '#8F8F8F',
  '9010': '#FFFFFF', '9011': '#1C2023', '9016': '#F6F6F6', '9017': '#1E1E1E',
  '9018': '#D7D7D7', '9022': '#9E9E9E', '9023': '#828282',
};

// RAL grouped for dropdown/chip UI
export const RAL_GROUPS = [
  { g: 'Whites & Creams', o: [['#FFFFFF','9010 Pure White'],['#F6F6F6','9016 Traffic White'],['#F4F4F4','9003 Signal White'],['#FDF4E3','9001 Cream White'],['#E7EBDA','9002 Grey White'],['#E6D690','1015 Light Ivory'],['#C2B078','1001 Beige'],['#C6A664','1002 Sand Yellow']] },
  { g: 'Greys', o: [['#D7D7D7','7035 Light Grey'],['#B5B8B1','7038 Agate Grey'],['#8D948D','7042 Traffic Grey A'],['#7D7F7D','7037 Dusty Grey'],['#78858B','7000 Squirrel Grey'],['#9EA0A1','7004 Signal Grey'],['#6C7059','7005 Mouse Grey'],['#474A51','7024 Graphite Grey'],['#293133','7016 Anthracite Grey'],['#23282B','7021 Black Grey'],['#434750','7015 Slate Grey'],['#4E5754','7012 Basalt Grey']] },
  { g: 'Blacks', o: [['#0A0A0A','9005 Jet Black'],['#1C2023','9011 Graphite Black'],['#1E1E1E','9017 Traffic Black'],['#282828','9004 Signal Black']] },
  { g: 'Greens', o: [['#31372B','6009 Fir Green'],['#2F4538','6005 Moss Green'],['#343B29','6007 Bottle Green'],['#1F3A3D','6004 Blue Green'],['#4A4F3B','6003 Olive Green'],['#587246','6011 Reseda Green'],['#35682D','6010 Grass Green'],['#1E5945','6016 Turquoise Green']] },
  { g: 'Blues', o: [['#1E2460','5002 Ultramarine Blue'],['#1D1E33','5004 Black Blue'],['#1B2A4A','5011 Steel Blue'],['#2271B3','5015 Sky Blue'],['#063971','5017 Traffic Blue'],['#3B83BD','5012 Light Blue'],['#354D73','5000 Violet Blue'],['#49678D','5023 Distant Blue']] },
  { g: 'Reds', o: [['#AF2B1E','3000 Flame Red'],['#9B111E','3003 Ruby Red'],['#75151E','3004 Purple Red'],['#5E2129','3005 Wine Red'],['#D53032','3018 Strawberry Red'],['#CC0605','3020 Traffic Red']] },
  { g: 'Browns', o: [['#955F20','8001 Ochre Brown'],['#6F4F28','8008 Olive Brown'],['#6F3B2A','8011 Nut Brown'],['#4E3B31','8028 Terra Brown'],['#45322E','8017 Chocolate Brown'],['#382C1E','8014 Sepia Brown']] },
  { g: 'Yellows & Oranges', o: [['#E5BE01','1003 Signal Yellow'],['#F4A900','1028 Melon Yellow'],['#ED760E','2000 Yellow Orange'],['#FF7514','2003 Pastel Orange']] },
];

// ═══════════════════════════════════════════════════════════════
// FARROW & BALL COLOURS
// ═══════════════════════════════════════════════════════════════
export const FB_GROUPS = [
  { g: 'Whites', o: [['#fbf8f4','All White 2005'],['#eee9e7','Wevet 273'],['#f2f0e8','Strong White 2001'],['#ede8dc','Great White 2006'],['#f0ece0','Wimborne White 239'],['#fdfeec','Pointing 2003'],['#f3f0e1','James White 2010'],['#ede6d5','White Tie 2002'],['#ede3ce','Slipper Satin 2004'],['#f4f0e5','School House White 291'],['#eceae5','Blackened 2011'],['#ecf0e0','Cabbage White 269'],['#dfe6e4','Borrowed Light 235'],['#eae4d6','Shadow White 282'],['#f0e4d4','Dimity 2008'],['#f0e4c8','Matchstick 2013']] },
  { g: 'Creams & Yellows', o: [['#eee8d8','New White 59'],['#f0e8c8','Tallow 203'],["#f0deb8","Farrow's Cream 67"],['#f4e4ba','Dorset Cream 68'],['#ede4b8','Pale Hound 71'],['#dac586','Hay 37'],['#c89830','Sudbury Yellow 51'],['#ce923c','India Yellow 66'],['#e8b830','Babouche 223'],['#ece0a0','Yellow Ground 218'],['#f0e0a0','Dayroom Yellow 233'],['#d8d498','Citron 74'],["#c07030","Charlotte's Locks 268"]] },
  { g: 'Neutrals & Stones', o: [['#e8e2d0','Skimming Stone 241'],['#c8b898','Stony Ground 211'],["#b8b0a0","Joa's White 226"],['#c8b898','Oxford Stone 264'],['#a09880','London Stone 6'],["#ccbfb3","Elephant's Breath 229"],['#d0ccc4','Ammonite 274'],['#c8c4b8','Cornforth White 228'],['#c0b8a8','Purbeck Stone 275'],['#c8bca8','Drop Cloth 283'],['#c0b498','Jitney 293'],['#d8ccae','String 8'],['#d6c39e','Cord 16'],['#deccb0','Bone 15'],['#ccc8c1','Shaded White 201'],['#b8a888','Stirabout 300'],['#e8ddc8','Old White 4'],['#f2ecd8','Lime White 1'],['#e4dcca','Off-White 3'],['#c8c0ae','Hardwick White 5']] },
  { g: 'Greys', o: [['#d0ccc8','Dimpse 277'],['#c8ccc0','Cromarty 285'],['#b9beaa','Pigeon 25'],['#a8a8a0','Pavilion Gray 242'],['#9c9c98','Lamp Room Gray 88'],['#8c8880','Worsted 284'],['#949088','Manor House Gray 265'],['#8c887c','Charleston Gray 243'],["#9d9088","Mole's Breath 276"],["#8c7c68","Mouse's Back 40"],['#c8c0ae','Light Gray 17'],['#b8b0a0','French Gray 18'],['#787470','Plummett 272'],['#b0b8a0','Mizzle 266'],['#a0aab0','Blue Gray 91'],['#b0a8a0','Dove Tale 267'],['#a8a0a0','Tailor Tack 302']] },
  { g: 'Pinks & Reds', o: [['#f0d8c8','Pink Ground 202'],['#e8c8b8','Setting Plaster 231'],['#e8c8c0','Calamine 230'],["#e8c8b8","Nancy's Blushes 278"],['#cdb8b0','Peignoir 286'],['#d08880','Cinder Rose 246'],['#c09090','Sulking Room Pink 295'],['#c89888','Templeton Pink 303'],['#c8a898','Dead Salmon 28'],['#b8a0a0','Calluna 270'],['#6a1820','Incarnadine 248'],['#8c182b','Rectory Red 217'],['#a82830','Eating Room Red 43'],['#c84848','Picture Gallery Red 42'],['#7a2830','Preference Red 297'],['#6c2838','Radicchio 96'],['#a05838','Red Earth 64'],['#c07868','Whirlybird 309']] },
  { g: 'Greens', o: [['#bbbe9f','Vert de Terre 234'],["#b0c0a8","Teresa's Green 236"],['#a0a888','Lichen 19'],['#7a8868','Saxon Green 80'],['#73806e','Card Room Green 79'],['#5a6850','Calke Green 34'],['#636f65','Green Smoke 47'],['#98a878','Breakfast Room Green 81'],['#b0b898','Ball Green 75'],['#97a07a','Cooking Apple Green 32'],['#748860','Yeabridge Green 287'],['#808870','Treron 292'],['#4a5040','Bancha 298'],['#384030','Studio Green 93'],['#485840','Arsenic 214'],['#586048','Beverly 310'],['#788050','Sap Green 199'],['#708888','Green Blue 84']] },
  { g: 'Blues', o: [['#6888a0','Lulworth Blue 89'],['#8898a8','Parma Gray 27'],['#759194','Stone Blue 86'],['#a0b8c8','Light Blue 22'],['#2c3437','Hague Blue 30'],['#2c3a48','Stiffkey Blue 281'],['#586768','Inchyra Blue 289'],['#7898a0','Dix Blue 82'],['#507898','Cooks Blue 237'],['#7888a0','Oval Room Blue 85'],['#c0d0d8','Skylight 205'],['#8098a8','Kittiwake 307'],['#485060','Selvedge 304'],['#6a7c80','De Nimes 299'],['#7890a0','Eddy 301']] },
  { g: 'Darks & Blacks', o: [['#3c3d42','Down Pipe 26'],['#45484b','Railings 31'],['#313639','Off-Black 57'],['#292820','Pitch Black 256'],["#483830","Tanner's Brown 255"],['#482838','Brinjal 222'],['#3a2830','Paean Black 294'],['#4a3030','Mahogany 36'],['#504838','Hopper Head 305'],['#2a5058','Vardo 288'],['#4a2028','Wine Dark 308'],['#5a5038','Broccoli Brown 198'],['#584858','Brassica 271']] },
  { g: 'New 2025', o: [['#984838','Etruscan Red 56'],['#e8d8c8','Scallop 311'],['#485838','Dibber 312'],['#606850','Reduced Green 313'],['#c8c0a8','Sizing 314'],['#e8d8b8','Naperon 315'],['#b87838','Marmelo 316'],['#889068','Kakelugn 317'],['#9c9880','Douter 318'],['#b8a880','Duster 319']] },
];

// ═══════════════════════════════════════════════════════════════
// QUICK SWATCHES (colour grid)
// ═══════════════════════════════════════════════════════════════
export const SWATCHES = [
  { name: 'Pure White', hex: '#F4F4F2' },
  { name: 'Jet Black', hex: '#1C1C1C' },
  { name: 'Anthracite', hex: '#2E3A3F' },
  { name: 'Olive Green', hex: '#4A4F3B' },
  { name: 'Off-White', hex: '#F0EEE8' },
  { name: 'Cream', hex: '#EDE8D8' },
  { name: 'Burgundy', hex: '#6B1A2A' },
  { name: 'Royal Blue', hex: '#1A3060' },
  { name: 'Oak', hex: '#C8853A' },
];

// Reverse lookup: hex → human colour name (RAL + Farrow&Ball + swatches). Case-insensitive.
const COLOR_NAME_MAP = (() => {
  const m = {};
  [...RAL_GROUPS, ...FB_GROUPS].forEach((grp) => {
    (grp.o || []).forEach(([hex, label]) => { m[String(hex).toLowerCase()] = label; });
  });
  SWATCHES.forEach(({ hex, name }) => {
    const k = String(hex).toLowerCase();
    if (!m[k]) m[k] = name;
  });
  return m;
})();

export function getColorName(hex) {
  if (!hex) return '—';
  return COLOR_NAME_MAP[String(hex).toLowerCase()] || hex;
}

// ═══════════════════════════════════════════════════════════════
// GLASS OPTIONS
// ═══════════════════════════════════════════════════════════════
export const GLASS_TYPES = [
  { value: 'double', label: 'Double (U: 1.4)' },
  { value: 'triple', label: 'Triple (U: 1.2)' },
  { value: 'passive', label: 'Passive (U: 0.8)' },
];

export const GLASS_SPECS = [
  { value: 'toughened', label: 'Toughened' },
  { value: 'laminated', label: 'Laminated' },
];

export const GLASS_FINISHES = [
  { value: 'clear', label: 'Clear' },
  { value: 'frosted', label: 'Frosted' },
];

export const FROSTED_LOCATIONS = [
  { value: 'bottom', label: 'Bottom Only' },
  { value: 'both', label: 'Both' },
];

// ═══════════════════════════════════════════════════════════════
// SPACERS
// ═══════════════════════════════════════════════════════════════
export const SPACERS = [
  { value: 'white', label: 'White' },
  { value: 'silver', label: 'Silver' },
  { value: 'black', label: 'Black' },
];

// Spacer bar TYPE (separate from colour above). Default: warm edge.
export const SPACER_TYPES = [
  { value: 'warm', label: 'Warm Edge' },
  { value: 'alu', label: 'Aluminium' },
];

// ═══════════════════════════════════════════════════════════════
// PAS24
// ═══════════════════════════════════════════════════════════════
export const PAS24_OPTIONS = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
];
