// Tab utilities. Side-panel-only mode policy:
//   - All extension-opened tabs come up focused.
//   - We never close tabs we opened (user keeps full control).
//   - When opening a destination that's already open, focus the existing
//     tab instead of spawning a duplicate.

/** Find an existing tab whose URL starts with the given prefix. Returns the
 *  first match across all windows, or undefined. */
export async function findTabByUrlPrefix(prefix: string): Promise<chrome.tabs.Tab | undefined> {
  // chrome.tabs.query supports glob patterns via `url`. Use prefix + '*'.
  const pattern = prefix.endsWith('*') ? prefix : `${prefix}*`;
  try {
    const matches = await chrome.tabs.query({ url: pattern });
    return matches[0];
  } catch {
    return undefined;
  }
}

/** Open a URL in a new tab, focused. If `reuseUrlPrefix` is provided and a
 *  matching tab already exists, focus that tab instead. */
export async function openOrFocusTab(
  url: string,
  opts: { reuseUrlPrefix?: string } = {},
): Promise<chrome.tabs.Tab> {
  const prefix = opts.reuseUrlPrefix;
  if (prefix) {
    const existing = await findTabByUrlPrefix(prefix);
    if (existing?.id != null) {
      await chrome.tabs.update(existing.id, { active: true });
      if (existing.windowId != null) {
        await chrome.windows.update(existing.windowId, { focused: true });
      }
      return existing;
    }
  }
  return chrome.tabs.create({ url, active: true });
}
