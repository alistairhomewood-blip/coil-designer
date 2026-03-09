import styles from './ToggleButton.module.css';

interface Props {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}

export function ToggleButton({ active, onClick, children, title }: Props) {
  return (
    <button
      className={`${styles.btn} ${active ? styles.active : ''}`}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}
