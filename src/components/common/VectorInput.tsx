import { NumberInput } from './NumberInput';
import styles from './VectorInput.module.css';

interface Props {
  value: [number, number, number];
  onChange: (v: [number, number, number]) => void;
  unit?: string;
  step?: number;
  decimals?: number;
  disabled?: boolean;
}

const AXES = ['X', 'Y', 'Z'] as const;

export function VectorInput({ value, onChange, unit, step, decimals, disabled }: Props) {
  return (
    <div className={styles.wrap}>
      {AXES.map((axis, i) => (
        <NumberInput
          key={axis}
          label={axis}
          unit={i === 2 ? unit : undefined}
          value={value[i]}
          step={step}
          decimals={decimals}
          disabled={disabled}
          onChange={v => {
            const next = [...value] as [number, number, number];
            next[i] = v;
            onChange(next);
          }}
        />
      ))}
    </div>
  );
}
