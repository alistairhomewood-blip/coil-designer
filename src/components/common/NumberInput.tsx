import { useRef, useState, useCallback } from 'react';
import styles from './NumberInput.module.css';

interface Props {
  label?: string;
  unit?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  decimals?: number;
  disabled?: boolean;
}

export function NumberInput({ label, unit, value, onChange, step = 1, min, max, decimals = 4, disabled }: Props) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const display = editing ? raw : value.toFixed(decimals);

  const commit = useCallback((str: string) => {
    const n = parseFloat(str);
    if (!isNaN(n)) {
      let v = n;
      if (min !== undefined) v = Math.max(min, v);
      if (max !== undefined) v = Math.min(max, v);
      onChange(v);
    }
    setEditing(false);
  }, [onChange, min, max]);

  return (
    <div className={styles.row}>
      {label && <span className={styles.label}>{label}</span>}
      <div className={styles.inputWrap}>
        <button className={styles.step} onClick={() => onChange(Math.max(min ?? -Infinity, value - step))} disabled={disabled} tabIndex={-1}>−</button>
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          value={display}
          disabled={disabled}
          onFocus={() => { setRaw(value.toFixed(decimals)); setEditing(true); }}
          onChange={e => setRaw(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commit(raw);
            if (e.key === 'Escape') { setEditing(false); inputRef.current?.blur(); }
            if (e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(max ?? Infinity, value + step)); }
            if (e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(min ?? -Infinity, value - step)); }
          }}
        />
        <button className={styles.step} onClick={() => onChange(Math.min(max ?? Infinity, value + step))} disabled={disabled} tabIndex={-1}>+</button>
        {unit && <span className={styles.unit}>{unit}</span>}
      </div>
    </div>
  );
}
