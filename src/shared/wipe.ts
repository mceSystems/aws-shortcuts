// Reset the extension to a fresh-install state. Used by the "Reset
// extension" action in Settings — drops every piece of state we own
// plus the AWS console cookies the extension cares about, so the
// next launch behaves exactly like a brand-new install.

const COOKIE_HOSTS = [
  'console.aws.amazon.com',
  'signin.aws.amazon.com',
  'awsapps.com',
];

async function clearAwsCookies(): Promise<void> {
  const all = await Promise.all(
    COOKIE_HOSTS.map((domain) =>
      chrome.cookies.getAll({ domain }).catch(() => [] as chrome.cookies.Cookie[]),
    ),
  );
  const seen = new Set<string>();
  const removals: Promise<unknown>[] = [];
  for (const cookies of all) {
    for (const c of cookies) {
      const url = `${c.secure ? 'https' : 'http'}://${c.domain.replace(/^\./, '')}${c.path}`;
      const key = `${url}|${c.name}|${c.storeId ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      removals.push(
        chrome.cookies
          .remove({ url, name: c.name, storeId: c.storeId })
          .catch(() => undefined),
      );
    }
  }
  await Promise.all(removals);
}

export async function wipeAll(): Promise<void> {
  try {
    await Promise.all([
      chrome.storage.sync.clear(),
      chrome.storage.local.clear(),
      chrome.storage.session.clear(),
    ]);
  } catch (e) {
    console.error('[aws-shortcut] storage wipe failed', e);
  }
  try {
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    if (existing.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existing.map((r) => r.id),
      });
    }
  } catch (e) {
    console.error('[aws-shortcut] dnr wipe failed', e);
  }
  try {
    await clearAwsCookies();
  } catch (e) {
    console.error('[aws-shortcut] cookie wipe failed', e);
  }
  try {
    window.localStorage.clear();
  } catch {
    // ignore
  }
  // Hard reload so no in-memory React state survives + storage listeners
  // can't repopulate the cache mid-wipe.
  window.location.reload();
}
