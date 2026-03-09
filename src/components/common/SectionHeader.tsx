import { useState } from 'react';
import styles from './SectionHeader.module.css';

interface Props {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function SectionHeader({ title, children, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={styles.section}>
      <button className={styles.header} onClick={() => setOpen(o => !o)}>
        <span className={`${styles.chevron} ${open ? styles.open : ''}`}>›</span>
        {title}
      </button>
      {open && <div className={styles.body}>{children}</div>}
    </div>
  );
}
