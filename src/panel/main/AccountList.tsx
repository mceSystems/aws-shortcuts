import { useMemo, useState } from 'react';
import type { Account } from '@/shared/types';
import { send } from '@/shared/messages';
import { rowKey } from '@/shared/storage';
import { AccountRow } from './AccountRow';
import styles from './AccountList.module.css';

type Props = {
  accounts: Account[];
  /** Composite row keys (`${identityCenterId}:${accountId}`) in display order. */
  accountOrder: string[];
  /** Composite row keys hidden by the user. */
  hiddenAccountIds: string[];
  selectedId: string | null;
  onSelect: (rowKey: string) => void;
  editing: boolean;
  /** Header-only render for collapsed section: only the selected row, or nothing. */
  compactSelected?: boolean;
};

type DropTarget =
  | { kind: 'row'; section: 'visible' | 'hidden'; id: string; before: boolean }
  | { kind: 'divider' }
  | null;

export function AccountList({
  accounts,
  accountOrder,
  hiddenAccountIds,
  selectedId,
  onSelect,
  editing,
  compactSelected,
}: Props) {
  const byKey = useMemo(() => {
    const m = new Map<string, Account>();
    for (const a of accounts) m.set(rowKey(a.identityCenterId, a.accountId), a);
    return m;
  }, [accounts]);

  if (compactSelected) {
    const selected = selectedId ? byKey.get(selectedId) : undefined;
    if (!selected) return null;
    const selectedKey = rowKey(selected.identityCenterId, selected.accountId);
    return (
      <div className={styles.list}>
        <AccountRow
          account={selected}
          selected
          onClick={() => onSelect(selectedKey)}
        />
      </div>
    );
  }

  const visible = useMemo(
    () => accountOrder.map((k) => byKey.get(k)).filter((a): a is Account => Boolean(a)),
    [accountOrder, byKey],
  );
  const hidden = useMemo(
    () =>
      hiddenAccountIds.map((k) => byKey.get(k)).filter((a): a is Account => Boolean(a)),
    [hiddenAccountIds, byKey],
  );

  const [userExpanded, setUserExpanded] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);

  // In edit mode hidden section is always open so drag targets are visible.
  const expanded = editing || userExpanded;

  if (accounts.length === 0) {
    return (
      <div className={styles.empty}>
        No accounts yet. Re-run the wizard from settings.
      </div>
    );
  }

  function commitDrop(target: DropTarget) {
    if (!draggingId || !target) return;
    const newVisible = accountOrder.filter((k) => k !== draggingId);
    const newHidden = hiddenAccountIds.filter((k) => k !== draggingId);
    if (target.kind === 'divider') {
      // Drop on chevron → top of hidden.
      newHidden.unshift(draggingId);
    } else if (target.section === 'visible') {
      const idx = newVisible.indexOf(target.id);
      const insertAt = target.before ? idx : idx + 1;
      newVisible.splice(insertAt, 0, draggingId);
    } else {
      const idx = newHidden.indexOf(target.id);
      const insertAt = target.before ? idx : idx + 1;
      newHidden.splice(insertAt, 0, draggingId);
    }
    void send({
      type: 'REORDER_ACCOUNTS',
      visible: newVisible,
      hidden: newHidden,
    });
  }

  function rowDragHandlers(section: 'visible' | 'hidden', id: string) {
    if (!editing) return {};
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        setDraggingId(id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
      },
      onDragEnd: () => {
        setDraggingId(null);
        setDropTarget(null);
      },
      onDragOver: (e: React.DragEvent) => {
        if (!draggingId || draggingId === id) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const before = e.clientY < rect.top + rect.height / 2;
        setDropTarget({ kind: 'row', section, id, before });
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        commitDrop(dropTarget);
        setDraggingId(null);
        setDropTarget(null);
      },
    };
  }

  function dividerHandlers() {
    if (!editing) return {};
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!draggingId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDropTarget({ kind: 'divider' });
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        commitDrop({ kind: 'divider' });
        setDraggingId(null);
        setDropTarget(null);
      },
    };
  }

  // Drop zone after the last hidden row so user can drag to "end of hidden"
  // even when the hidden section is empty (or below the last row).
  function tailHandlers() {
    if (!editing) return {};
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!draggingId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (hidden.length === 0) {
          setDropTarget({ kind: 'divider' });
        } else {
          const last = hidden[hidden.length - 1];
          const lastKey = rowKey(last.identityCenterId, last.accountId);
          setDropTarget({ kind: 'row', section: 'hidden', id: lastKey, before: false });
        }
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        commitDrop(dropTarget);
        setDraggingId(null);
        setDropTarget(null);
      },
    };
  }

  const showChevron = editing || hidden.length > 0;

  return (
    <div className={[styles.list, editing ? styles.editing : ''].filter(Boolean).join(' ')}>
      {visible.map((a) => {
        const key = rowKey(a.identityCenterId, a.accountId);
        const isDragging = draggingId === key;
        const indicator =
          dropTarget?.kind === 'row' &&
          dropTarget.section === 'visible' &&
          dropTarget.id === key
            ? dropTarget.before
              ? styles.dropBefore
              : styles.dropAfter
            : '';
        return (
          <div
            key={key}
            className={[styles.rowWrap, indicator, isDragging ? styles.dragging : '']
              .filter(Boolean)
              .join(' ')}
            {...rowDragHandlers('visible', key)}
          >
            {editing && (
              <span className={styles.handle} aria-hidden>
                <GripIcon />
              </span>
            )}
            <AccountRow
              account={a}
              selected={selectedId === key}
              compact={editing}
              onClick={() => onSelect(key)}
            />
          </div>
        );
      })}

      {showChevron && (
        <button
          type="button"
          className={[
            styles.toggle,
            dropTarget?.kind === 'divider' ? styles.toggleDrop : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-label={expanded ? 'Hide hidden accounts' : 'Show hidden accounts'}
          aria-expanded={expanded}
          onClick={() => {
            if (editing) return; // forced-open in edit mode; click no-op
            setUserExpanded((v) => !v);
          }}
          {...dividerHandlers()}
        >
          {expanded ? '▾' : '▸'}
        </button>
      )}

      {expanded &&
        hidden.map((a) => {
          const key = rowKey(a.identityCenterId, a.accountId);
          const isDragging = draggingId === key;
          const indicator =
            dropTarget?.kind === 'row' &&
            dropTarget.section === 'hidden' &&
            dropTarget.id === key
              ? dropTarget.before
                ? styles.dropBefore
                : styles.dropAfter
              : '';
          return (
            <div
              key={key}
              className={[
                styles.rowWrap,
                styles.hiddenRow,
                indicator,
                isDragging ? styles.dragging : '',
              ]
                .filter(Boolean)
                .join(' ')}
              {...rowDragHandlers('hidden', key)}
            >
              {editing && (
                <span className={styles.handle} aria-hidden>
                  <GripIcon />
                </span>
              )}
              <AccountRow
                account={a}
                selected={selectedId === key}
                compact={editing}
                onClick={() => onSelect(key)}
              />
            </div>
          );
        })}

      {editing && draggingId && (
        <div
          className={styles.tailDrop}
          aria-hidden
          {...tailHandlers()}
        />
      )}
    </div>
  );
}

export function AccountsEditButton({
  editing,
  onToggle,
}: {
  editing: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.editBtn}
      aria-label={editing ? 'Save account order' : 'Edit accounts'}
      aria-pressed={editing}
      onClick={onToggle}
    >
      {editing ? <CheckIcon /> : <PencilIcon />}
    </button>
  );
}

function PencilIcon() {
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
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <circle cx="9" cy="5" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="15" cy="5" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="15" cy="19" r="1.5" />
    </svg>
  );
}
