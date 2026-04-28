import { useMemo, useState } from 'react';
import { useStore } from './store';
import { AccountChip } from './AccountChip';
import { fuzzyFilter } from '@/shared/fuzzy';
import { send } from '@/shared/messages';
import './Composer.css';

export function Composer() {
  const accounts = useStore((s) => s.accounts);
  const catalog = useStore((s) => s.catalog);
  const selectedIds = useStore((s) => s.selectedAccountIds);
  const selectedService = useStore((s) => s.selectedService);
  const selectedFeature = useStore((s) => s.selectedFeature);
  const toggleAccount = useStore((s) => s.toggleAccount);
  const clearSelection = useStore((s) => s.clearSelection);
  const selectService = useStore((s) => s.selectService);
  const selectFeature = useStore((s) => s.selectFeature);

  const [serviceQuery, setServiceQuery] = useState('');

  const serviceMatches = useMemo(
    () => fuzzyFilter(serviceQuery, catalog, (s) => s.name).slice(0, 8),
    [serviceQuery, catalog],
  );

  const previews = selectedIds
    .map((id) => accounts.find((a) => a.accountId === id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  async function openAll() {
    if (!selectedService || selectedIds.length === 0) return;
    await send({
      type: 'OPEN_COMPOSED',
      accountIds: selectedIds,
      service: selectedService.id,
      feature: selectedFeature,
    });
    window.close();
  }

  return (
    <div className="composer">
      <section className="composer__section">
        <div className="composer__hint">
          Click chip to filter · Shift-click for multi · Right-click chip for color
        </div>
        <div className="composer__chips">
          {accounts.map((a) => (
            <AccountChip
              key={a.accountId}
              account={a}
              selected={selectedIds.includes(a.accountId)}
              onToggle={(multi) => toggleAccount(a.accountId, multi)}
            />
          ))}
        </div>
        {selectedIds.length > 0 && (
          <div className="composer__selection">
            Selected: {previews.map((a) => a.name).join(' · ')}
            <button onClick={clearSelection}>clear</button>
          </div>
        )}
      </section>

      <section className="composer__section">
        <input
          className="composer__search"
          placeholder="Search service... e.g. cloudwatch, ec2, iam"
          value={serviceQuery}
          onChange={(e) => setServiceQuery(e.target.value)}
        />
        {serviceMatches.length > 0 && (
          <ul className="composer__results">
            {serviceMatches.map(({ item }) => (
              <li
                key={item.id}
                className={item.id === selectedService?.id ? 'composer__result composer__result--active' : 'composer__result'}
                onClick={() => selectService(item)}
              >
                {item.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedService && selectedService.features && selectedService.features.length > 0 && (
        <section className="composer__section">
          <label>
            Feature:{' '}
            <select
              value={selectedFeature ?? ''}
              onChange={(e) => selectFeature(e.target.value || undefined)}
            >
              <option value="">— none —</option>
              {selectedService.features.map((f) => (
                <option key={f.path} value={f.path}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}

      {selectedService && previews.length > 0 && (
        <section className="composer__section composer__preview">
          <div className="composer__preview-title">Going to:</div>
          {previews.map((a) => (
            <div key={a.accountId} className="composer__preview-row">
              <span className="composer__dot" style={{ background: a.color }} />
              {a.name} · {a.defaultRoleName} · {a.defaultRegion} · {selectedService.name}
              {selectedFeature ? ` · ${selectedFeature}` : ''}
            </div>
          ))}
          <button className="composer__open" onClick={openAll}>
            Open {previews.length === 1 ? 'tab' : `${previews.length} tabs`}
          </button>
        </section>
      )}
    </div>
  );
}
