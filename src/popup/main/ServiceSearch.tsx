import { useEffect, useMemo, useRef, useState } from 'react';
import type { Account, ServiceCatalogEntry, SsoConfig } from '@/shared/types';
import { searchServices } from '@/shared/serviceCatalog';
import { send } from '@/shared/messages';
import { chipColor, NEUTRAL_COLOR } from '@/shared/colors';
import styles from './ServiceSearch.module.css';

type Props = {
  account: Account | null;
  ssoConfig?: SsoConfig;
};

export function ServiceSearch({ account, ssoConfig }: Props) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [pickedFeature, setPickedFeature] = useState<{
    serviceId: string;
    featureIdx: number | null;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hits = useMemo(() => searchServices(query), [query]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  useEffect(() => {
    setPickedFeature(null);
    setQuery('');
  }, [account?.accountId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const role = account?.preferredRoleName ?? '';
  const region = account?.preferredRegion ?? '';

  const missingAccount = !account;
  const missingRole = Boolean(account) && !role;
  const missingRegion = Boolean(account) && !region;
  const missingPortal = !ssoConfig?.portalHost;

  async function open(service: ServiceCatalogEntry, featurePath?: string) {
    if (!account || missingRole || missingRegion || missingPortal) return;
    // SW resolves the URL: direct multi-session subdomain if a live session
    // exists for (account, role), portal-shortcut redirect otherwise.
    const res = await send({
      type: 'RESOLVE_LAUNCH_URL',
      accountId: account.accountId,
      roleName: role,
      region,
      consolePath: featurePath ?? service.consolePath,
    });
    if (!res.ok || !res.url) return;
    void chrome.tabs.create({ url: res.url });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = hits[cursor];
      if (!hit) return;
      if (hit.service.features && hit.service.features.length > 0) {
        setPickedFeature({ serviceId: hit.service.id, featureIdx: null });
        return;
      }
      open(hit.service);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (pickedFeature) setPickedFeature(null);
      else setQuery('');
    }
  }

  if (pickedFeature && account) {
    const service = hits.find((h) => h.service.id === pickedFeature.serviceId)?.service;
    if (!service?.features) {
      setPickedFeature(null);
      return null;
    }
    return (
      <FeaturePicker
        account={account}
        service={service}
        onPick={(path) => open(service, path)}
        onCancel={() => setPickedFeature(null)}
      />
    );
  }

  const accountColor = account ? chipColor(account.color) : NEUTRAL_COLOR;
  const blocker =
    missingAccount
      ? null
      : missingPortal
        ? 'Configure portal in onboarding first.'
        : missingRole
          ? `No role set for ${account!.alias || account!.name}.`
          : missingRegion
            ? `No region set for ${account!.alias || account!.name}.`
            : null;

  return (
    <div className={styles.root}>
      <div className={styles.inputRow}>
        <span className={styles.icon} aria-hidden>
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          placeholder={
            account
              ? `Search services in ${account.alias || account.name}…`
              : 'Search services… (pick an account to open)'
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
        />
      </div>

      {blocker && <div className={styles.blocker}>{blocker}</div>}

      <ul className={styles.results}>
        {hits.length === 0 && (
          <li className={styles.empty}>No services match “{query}”.</li>
        )}
        {hits.map((hit, i) => (
          <li
            key={hit.service.id}
            className={[styles.result, i === cursor ? styles.active : '']
              .filter(Boolean)
              .join(' ')}
            onMouseEnter={() => setCursor(i)}
            onClick={() => {
              if (missingAccount) return;
              if (hit.service.features && hit.service.features.length > 0) {
                setPickedFeature({ serviceId: hit.service.id, featureIdx: null });
              } else {
                open(hit.service);
              }
            }}
          >
            <span
              className={styles.swatch}
              style={{ background: accountColor }}
            >
              {hit.service.name.charAt(0)}
            </span>
            <span className={styles.name}>{hit.service.name}</span>
            {hit.service.features && hit.service.features.length > 0 && (
              <span className={styles.chevron} aria-hidden>›</span>
            )}
          </li>
        ))}
      </ul>

      {missingAccount && (
        <div className={styles.hint}>Pick an account above to open services.</div>
      )}
    </div>
  );
}

function FeaturePicker({
  account,
  service,
  onPick,
  onCancel,
}: {
  account: Account;
  service: ServiceCatalogEntry;
  onPick: (path: string) => void;
  onCancel: () => void;
}) {
  const features = service.features ?? [];
  const [cursor, setCursor] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, features.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (cursor === 0) onPick(service.consolePath);
      else onPick(features[cursor - 1].path);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <div className={styles.root} ref={ref} onKeyDown={onKeyDown} tabIndex={-1}>
      <div className={styles.crumb}>
        <button type="button" className={styles.crumbBack} onClick={onCancel}>
          ← {service.name}
        </button>
        <span className={styles.crumbHint}>Pick a feature in {account.alias || account.name}</span>
      </div>
      <ul className={styles.results}>
        <li
          className={[styles.result, cursor === 0 ? styles.active : '']
            .filter(Boolean)
            .join(' ')}
          onMouseEnter={() => setCursor(0)}
          onClick={() => onPick(service.consolePath)}
        >
          <span className={styles.swatchPlain}>↗</span>
          <span className={styles.name}>{service.name} home</span>
        </li>
        {features.map((f, i) => (
          <li
            key={f.path}
            className={[styles.result, cursor === i + 1 ? styles.active : '']
              .filter(Boolean)
              .join(' ')}
            onMouseEnter={() => setCursor(i + 1)}
            onClick={() => onPick(f.path)}
          >
            <span className={styles.swatchPlain}>›</span>
            <span className={styles.name}>{f.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
