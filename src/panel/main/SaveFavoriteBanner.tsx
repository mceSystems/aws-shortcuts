import { useEffect, useRef, useState } from 'react';
import type { Favorite } from '@/shared/types';
import { send } from '@/shared/messages';
import styles from './SaveFavoriteBanner.module.css';

export type PendingFavorite = {
  defaultLabel: string;
  accountId: string;
  roleName: string;
  region: string;
  serviceId: string;
  featurePath?: string;
  consolePath: string;
};

type Props = {
  pending: PendingFavorite;
  onClose: () => void;
};

export function SaveFavoriteBanner({ pending, onClose }: Props) {
  const [draft, setDraft] = useState(pending.defaultLabel);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(pending.defaultLabel);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [pending]);

  async function commit() {
    const label = draft.trim() || pending.defaultLabel;
    const fav: Favorite = {
      id: `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      accountId: pending.accountId,
      roleName: pending.roleName,
      region: pending.region,
      serviceId: pending.serviceId,
      featurePath: pending.featurePath,
      consolePath: pending.consolePath,
      label,
      createdAt: Date.now(),
    };
    await send({ type: 'SAVE_FAVORITE', fav });
    onClose();
  }

  return (
    <div className={styles.banner}>
      <span className={styles.icon} aria-hidden>★</span>
      <input
        ref={inputRef}
        className={styles.input}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
        spellCheck={false}
        autoComplete="off"
      />
      <button type="button" className={styles.btnPrimary} onClick={() => void commit()}>
        Save
      </button>
      <button type="button" className={styles.btnGhost} onClick={onClose} aria-label="Cancel">
        ✕
      </button>
    </div>
  );
}
