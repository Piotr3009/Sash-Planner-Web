/**
 * t30 — the shared 3D preview (src/components/viewer/WindowPreview3D.jsx) renders the SAME
 * component as the configurator for every window kind.
 *
 * Why this test exists (Piotr 07.09): the pack's "3D Views" and the window page showed arched
 * casements as plain rectangles for weeks. Every geometry harness passed, because they measured
 * archedCasementGeometry — the layer BELOW the component — while the preview simply never
 * imported ArchedCasementWindow and rendered <CasementWindow> for every casement. The rule that
 * came out of it: a harness must test the component that actually reaches the screen, and every
 * branch in the configurator (src/3d/App.jsx) needs its twin in the preview.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => readFileSync(resolve(ROOT, ...p), 'utf8');
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { if (ok) { pass++; console.log(`  PASS  ${name}`); } else { fail++; console.log(`  FAIL  ${name}${detail ? `  — ${detail}` : ''}`); } };

const app = read('src', '3d', 'App.jsx');
const prev = read('src', 'components', 'viewer', 'WindowPreview3D.jsx');

console.log('== 1 — every window component the configurator can render is reachable from the preview ==');
const COMPONENTS = ['CasementWindow', 'ArchedCasementWindow', 'DoorWindow', 'FixFrameWindow', 'ParametricSashWindow'];
for (const c of COMPONENTS) {
  const inApp = new RegExp(`<${c}\\b`).test(app);
  const inPrev = new RegExp(`<${c}\\b`).test(prev);
  check(`${c}: configurator ${inApp ? 'renders' : 'does not render'} → preview ${inPrev ? 'renders' : 'does not render'}`, !inApp || inPrev);
  if (inPrev) check(`${c} is imported in the preview`, new RegExp(`import\\s+${c}\\s+from`).test(prev));
}

console.log('== 2 — the arched branch is chosen on the same condition as the configurator ==');
check("preview switches on config.casementType === 'arched'", /casementType === 'arched'/.test(prev));
check("preview switches on config.windowCategory === 'fix-only' (circle)", /windowCategory === 'fix-only'/.test(prev));
check('a plain casement still falls through to CasementWindow', /casementProps/.test(prev));

console.log('== 3 — the arched preview receives the props the geometry needs ==');
for (const prop of ['archShape', 'archRise', 'archProfile', 'barPattern', 'frameDims', 'hingeDirection', 'hBars', 'vBars', 'fixedLeaf', 'archPatterns', 'archMinHaunchRadius']) {
  check(`arched preview passes ${prop}`, new RegExp(`${prop}=\\{`).test(prev));
}
check('arched preview sizes from extWidth / extHeight (ArchedCasementWindow ignores casementProps)', /extWidth \|\| config\.width/.test(prev) && /extHeight \|\| config\.height/.test(prev));
check('preview never opens the leaf (a thumbnail is always closed)', /opening=\{0\}/.test(prev));

console.log('== 4 — the user\'s bar counts reach the 3D (they used to stop at casementProps) ==');
const w2c = read('src', 'utils', 'windowSpecToConfig.js');
check('windowSpecToConfig puts casementHBars / casementVBars in the ARCH config (arch.bars, not casementProps)',
  /casementHBars: Number\(arch\.bars\?\.h\)/.test(w2c) && /casementVBars: Number\(arch\.bars\?\.v\)/.test(w2c));

console.log('== 5 — the two Elements cards use the same container (Piotr 07.09) ==');
const frameSheet = read('src', 'components', 'drawings', 'CasementFrameDetail2D.jsx');
const leafSheet = read('src', 'components', 'drawings', 'CasementLeafDetail2D.jsx');
check('neither sheet caps its height (no maxHeight / inner scrollbar)', !/maxHeight/.test(frameSheet) && !/maxHeight/.test(leafSheet));
check('both sheets offer the same Expand affordance', /Expand/.test(frameSheet) && /Expand/.test(leafSheet));
check('both sheets scale the same way (w-full h-auto on the svg)', (frameSheet.match(/className="w-full h-auto"/g) || []).length === 1 && (leafSheet.match(/className="w-full h-auto"/g) || []).length === 1);

console.log(`\n${pass} passed, ${fail} failed`);
if (!fail) console.log('ALL PASS');
process.exit(fail ? 1 : 0);
