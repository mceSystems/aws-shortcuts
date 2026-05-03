// Pretty-print add/remove/change summaries between two id-keyed snapshots.

type Diff<T> = {
  added: string[];
  removed: string[];
  changed: { id: string; field: string }[];
};

export function diffServices<T extends { id: string }>(before: T[], after: T[]): Diff<T> {
  const beforeMap = new Map(before.map((s) => [s.id, s]));
  const afterMap = new Map(after.map((s) => [s.id, s]));
  const added: string[] = [];
  const removed: string[] = [];
  const changed: { id: string; field: string }[] = [];

  for (const id of afterMap.keys()) if (!beforeMap.has(id)) added.push(id);
  for (const id of beforeMap.keys()) if (!afterMap.has(id)) removed.push(id);
  for (const [id, a] of afterMap) {
    const b = beforeMap.get(id);
    if (!b) continue;
    for (const field of Object.keys(a) as (keyof T)[]) {
      if (JSON.stringify(a[field]) !== JSON.stringify(b[field])) {
        changed.push({ id, field: String(field) });
      }
    }
  }
  return { added, removed, changed };
}

export function printSummary(label: string, diff: Diff<unknown>): void {
  console.log(`[${label}] added (${diff.added.length}):`, diff.added.slice(0, 10).join(', ') + (diff.added.length > 10 ? '…' : ''));
  console.log(`[${label}] removed (${diff.removed.length}):`, diff.removed.join(', '));
  const fieldCounts = new Map<string, number>();
  for (const c of diff.changed) fieldCounts.set(c.field, (fieldCounts.get(c.field) ?? 0) + 1);
  for (const [field, n] of fieldCounts) console.log(`[${label}] changed ${field}: ${n}`);
}
