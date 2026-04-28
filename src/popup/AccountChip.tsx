import { useState } from 'react';
import type { Account } from '@/shared/types';
import { ACCOUNT_COLORS } from '@/shared/colors';
import { AWS_REGIONS } from './regions';
import { useStore } from './store';
import './AccountChip.css';

type Props = {
  account: Account;
  selected: boolean;
  onToggle: (multi: boolean) => void;
};

export function AccountChip({ account, selected, onToggle }: Props) {
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [regionOpen, setRegionOpen] = useState(false);
  const setAccountColor = useStore((s) => s.setAccountColor);
  const setAccountDefaultRole = useStore((s) => s.setAccountDefaultRole);
  const setAccountDefaultRegion = useStore((s) => s.setAccountDefaultRegion);

  return (
    <div
      className={`chip ${selected ? 'chip--selected' : ''}`}
      style={{ borderColor: account.color, ['--chip-color' as string]: account.color }}
      onClick={(e) => onToggle(e.shiftKey || e.metaKey || e.ctrlKey)}
      onContextMenu={(e) => {
        e.preventDefault();
        setColorPickerOpen((v) => !v);
      }}
    >
      <div className="chip__name">{account.name}</div>
      <div
        className="chip__role"
        onClick={(e) => {
          e.stopPropagation();
          setRoleOpen((v) => !v);
        }}
      >
        {account.defaultRoleName || account.roles[0]?.name || '—'} ▾
      </div>
      <div
        className="chip__region"
        onClick={(e) => {
          e.stopPropagation();
          setRegionOpen((v) => !v);
        }}
      >
        {account.defaultRegion || 'set region'} ▾
      </div>

      {colorPickerOpen && (
        <div className="chip__menu" onClick={(e) => e.stopPropagation()}>
          {ACCOUNT_COLORS.map((c) => (
            <button
              key={c}
              className="chip__swatch"
              style={{ background: c }}
              onClick={() => {
                void setAccountColor(account.accountId, c);
                setColorPickerOpen(false);
              }}
            />
          ))}
        </div>
      )}

      {roleOpen && (
        <div className="chip__menu chip__menu--list" onClick={(e) => e.stopPropagation()}>
          {account.roles.map((r) => (
            <button
              key={r.name}
              className="chip__menu-item"
              onClick={() => {
                void setAccountDefaultRole(account.accountId, r.name);
                setRoleOpen(false);
              }}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}

      {regionOpen && (
        <div className="chip__menu chip__menu--list" onClick={(e) => e.stopPropagation()}>
          {AWS_REGIONS.map((r) => (
            <button
              key={r}
              className="chip__menu-item"
              onClick={() => {
                void setAccountDefaultRegion(account.accountId, r);
                setRegionOpen(false);
              }}
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
