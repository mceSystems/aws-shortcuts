import styles from './Logo.module.css';

type Props = { size?: number };

export function Logo({ size = 40 }: Props) {
  return (
    <span
      className={styles.logo}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.32),
        fontSize: Math.round(size * 0.55),
      }}
      aria-label="AWS Shortcut"
    >
      ◐
    </span>
  );
}
