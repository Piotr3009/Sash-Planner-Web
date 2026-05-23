import * as XLSX from 'xlsx';
import {
  buildCutListForWindow,
  buildPrecutForWindow,
  buildGlassListForWindow,
  buildHardwareList
} from '../engine/lists.js';
import { optimisePrecut } from '../engine/optimizer.js';

export async function exportWindowToExcel({ item, windowSpec, settings, derived }) {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summary = [
    ['Sash Planner — Production export'],
    [],
    ['Window number', item.window_number || ''],
    ['Type', item.window_type || 'sash'],
    ['Width × Height (mm)', `${item.width} × ${item.height}`],
    ['Quantity', item.quantity || 1],
    ['Unit price', item.unit_price || 0],
    ['Total price', item.total_price || 0],
    ['Generated', new Date().toLocaleString()],
    [],
    ['Calculated sash width', derived?.sashWidth ?? ''],
    ['Top sash height', derived?.topSashHeight ?? ''],
    ['Bottom sash height', derived?.bottomSashHeight ?? '']
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Summary');

  // Cut list
  const cutList = buildCutListForWindow(derived, windowSpec);
  const cutSheet = [
    ['Element', 'Section', 'Length (mm)', 'Qty', 'Material', 'Notes'],
    ...cutList.map((c) => [c.element, c.section || '', c.length, c.quantity, c.material || '', c.notes || ''])
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cutSheet), 'Cut list');

  // Precut groups + optimisation
  const precut = buildPrecutForWindow(derived, windowSpec, settings);
  const optim = optimisePrecut(precut, settings);

  const precutRows = [['Group', 'Element', 'Length (mm)', 'Qty', 'Window']];
  precut.sashEngineering.forEach((g) =>
    g.items.forEach((it) =>
      precutRows.push([`Sash ${g.section}`, it.elementName, it.length, it.quantity, it.windowName || ''])
    )
  );
  precut.boxSapele.forEach((g) =>
    g.items.forEach((it) =>
      precutRows.push([`Box ${g.preCutWidth}`, it.elementName, it.length, it.quantity, it.windowName || ''])
    )
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(precutRows), 'Pre-cut');

  const optRows = [['Section', 'Bar', 'Cut (mm)', 'Used (mm)', 'Waste (mm)', 'Utilisation']];
  optim.sashEngineering.forEach((g) =>
    g.bars.forEach((bar) =>
      optRows.push([
        g.section,
        bar.barId,
        bar.cuts.join(', '),
        Math.round(bar.used),
        Math.round(bar.waste),
        Number((bar.utilization * 100).toFixed(1))
      ])
    )
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(optRows), 'Optimiser');

  // Glass
  const glassRows = [['Unit', 'Width', 'Height', 'Qty', 'Type', 'Makeup', 'Spec', 'Finish', 'Spacer']];
  buildGlassListForWindow(derived, windowSpec).forEach((p) =>
    glassRows.push([p.label, p.width, p.height, p.quantity, p.type, p.makeup, p.spec, p.finish, p.spacer])
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(glassRows), 'Glass');

  // Hardware
  const hwRows = [['Item', 'Detail', 'Qty']];
  buildHardwareList(windowSpec).forEach((h) => hwRows.push([h.item, h.detail, h.quantity]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hwRows), 'Hardware');

  const filename = `${item.window_number || 'window'}-${item.id.slice(0, 6)}.xlsx`;
  XLSX.writeFile(wb, filename);
}
