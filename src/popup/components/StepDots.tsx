import styles from './StepDots.module.css';

type Props = {
  total: number;
  current: number;
};

export function StepDots({ total, current }: Props) {
  return (
    <div className={styles.steps} role="progressbar" aria-valuenow={current + 1} aria-valuemin={1} aria-valuemax={total}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={i === current ? `${styles.dot} ${styles.active}` : styles.dot} />
      ))}
    </div>
  );
}
