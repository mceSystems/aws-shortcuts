// Service worker entry. Infrastructure stub — message handlers, listeners,
// and feature logic land in their own modules under src/background/.

chrome.runtime.onInstalled.addListener(() => {
  console.log('[aws-shortcut] installed');
});

export {};
