import type { InputHTMLAttributes } from 'react';
import styles from './TextInput.module.css';

type Props = InputHTMLAttributes<HTMLInputElement>;

export function TextInput({ className = '', ...rest }: Props) {
  return <input className={`${styles.input} ${className}`} {...rest} />;
}
