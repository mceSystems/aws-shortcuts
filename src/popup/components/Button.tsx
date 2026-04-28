import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

type Variant = 'primary' | 'ghost';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  fullWidth?: boolean;
};

export function Button({ variant = 'primary', fullWidth, className = '', ...rest }: Props) {
  const cls = [
    styles.btn,
    variant === 'primary' ? styles.primary : styles.ghost,
    fullWidth ? styles.fullWidth : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <button className={cls} {...rest} />;
}
