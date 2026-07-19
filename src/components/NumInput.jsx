import { useEffect, useRef, useState } from 'react';

/**
 * Controlled-number input without the "sticky 0" problem.
 *
 * The store keeps only valid numbers; this component keeps its own text while
 * the user types, so select-all + Delete leaves the field EMPTY instead of
 * snapping to 0. Valid numbers commit immediately (live recalcs unchanged);
 * an empty/invalid field commits nothing, and blur re-syncs to the last good
 * store value. External changes (variant switch, cloud load, Reset) re-sync
 * whenever the field is not focused.
 */
export default function NumInput({ value, onCommit, ...rest }) {
  const [text, setText] = useState(value === undefined || value === null ? '' : String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(value === undefined || value === null ? '' : String(value));
  }, [value]);

  return (
    <input
      type="number"
      value={text}
      onFocus={() => { focused.current = true; }}
      onBlur={() => {
        focused.current = false;
        setText(value === undefined || value === null ? '' : String(value));
      }}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        if (t !== '' && !Number.isNaN(Number(t))) onCommit(t);
      }}
      {...rest}
    />
  );
}
