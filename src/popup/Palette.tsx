import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from './store';
import { fuzzyFilter } from '@/shared/fuzzy';
import { send } from '@/shared/messages';
import './Palette.css';

type PaletteItem = {
  key: string;
  label: string;
  accountId: string;
  roleName: string;
  region: string;
  service: string;
  feature?: string;
};

type Props = { onClose: () => void };

export function Palette({ onClose }: Props) {
  const accounts = useStore((s) => s.accounts);
  const catalog = useStore((s) => s.catalog);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const items: PaletteItem[] = useMemo(() => {
    const out: PaletteItem[] = [];
    for (const account of accounts) {
      for (const svc of catalog) {
        out.push({
          key: `${account.accountId}::${svc.id}`,
          label: `${svc.name} · ${account.name} · ${account.defaultRegion}`,
          accountId: account.accountId,
          roleName: account.defaultRoleName,
          region: account.defaultRegion,
          service: svc.id,
        });
      }
    }
    return out;
  }, [accounts, catalog]);

  const matches = useMemo(
    () => fuzzyFilter(query, items, (i) => i.label).slice(0, 12),
    [query, items],
  );

  function commit(item: PaletteItem) {
    void send({
      type: 'OPEN_COMPOSED',
      accountIds: [item.accountId],
      service: item.service,
      feature: item.feature,
    });
    onClose();
  }

  return (
    <div className="palette" onClick={onClose}>
      <div className="palette__panel" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette__input"
          placeholder="Type service + account... e.g. cw logs prod"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIdx(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIdx((i) => Math.min(i + 1, matches.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const hit = matches[activeIdx];
              if (hit) commit(hit.item);
            } else if (e.key === 'Escape') {
              onClose();
            }
          }}
        />
        <ul className="palette__results">
          {matches.map(({ item }, idx) => (
            <li
              key={item.key}
              className={idx === activeIdx ? 'palette__result palette__result--active' : 'palette__result'}
              onClick={() => commit(item)}
            >
              {item.label}
            </li>
          ))}
        </ul>
        <div className="palette__hint">↑↓ navigate · ⏎ open · esc cancel</div>
      </div>
    </div>
  );
}
