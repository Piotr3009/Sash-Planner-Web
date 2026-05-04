/**
 * Lightweight elevation thumbnail of a sash window for the project cards.
 * Pure SVG — no canvas/3D dependency, no flicker, easy to print.
 */
export default function MiniWindowSvg({ windowSpec }) {
  if (!windowSpec) return null;
  const w = Number(windowSpec.frame.width) || 1000;
  const h = Number(windowSpec.frame.height) || 1500;

  // Fit into 120×170 viewport, preserve aspect
  const viewportW = 120;
  const viewportH = 170;
  const scale = Math.min(viewportW / w, viewportH / h) * 0.92;
  const dispW = w * scale;
  const dispH = h * scale;
  const x0 = (viewportW - dispW) / 2;
  const y0 = (viewportH - dispH) / 2;

  const frameThickness = 4;
  const meetingY = y0 + dispH / 2;

  const grid = windowSpec.sash.grid;
  const cols = grid.cols || 2;
  const rows = grid.rows || 2;
  const sashInset = frameThickness + 2;

  const drawSashGrid = (sashY, sashH) => {
    const lines = [];
    const sashX = x0 + sashInset;
    const sashW = dispW - 2 * sashInset;
    const innerY = sashY + 4;
    const innerH = sashH - 8;
    for (let i = 1; i < cols; i += 1) {
      const x = sashX + (sashW * i) / cols;
      lines.push(<line key={`v${sashY}-${i}`} x1={x} y1={innerY} x2={x} y2={innerY + innerH} stroke="#0f172a" strokeWidth="0.6" />);
    }
    for (let j = 1; j < rows; j += 1) {
      const y = innerY + (innerH * j) / rows;
      lines.push(<line key={`h${sashY}-${j}`} x1={sashX} y1={y} x2={sashX + sashW} y2={y} stroke="#0f172a" strokeWidth="0.6" />);
    }
    return lines;
  };

  return (
    <svg viewBox={`0 0 ${viewportW} ${viewportH}`} className="w-full h-32">
      {/* Frame */}
      <rect x={x0} y={y0} width={dispW} height={dispH} fill="#f1f5f9" stroke="#0f172a" strokeWidth="1" />
      {/* Top sash */}
      <rect
        x={x0 + sashInset}
        y={y0 + sashInset}
        width={dispW - 2 * sashInset}
        height={meetingY - y0 - sashInset - 1}
        fill="#e0f2fe"
        stroke="#334155"
        strokeWidth="0.8"
        opacity="0.6"
      />
      {/* Bottom sash */}
      <rect
        x={x0 + sashInset}
        y={meetingY + 1}
        width={dispW - 2 * sashInset}
        height={dispH - (meetingY - y0) - sashInset - 1}
        fill="#e0f2fe"
        stroke="#334155"
        strokeWidth="0.8"
        opacity="0.6"
      />
      {drawSashGrid(y0 + sashInset, meetingY - y0 - sashInset - 1)}
      {drawSashGrid(meetingY + 1, dispH - (meetingY - y0) - sashInset - 1)}
    </svg>
  );
}
