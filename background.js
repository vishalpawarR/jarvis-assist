const TRACKED_SITES_KEY = "jarvisTrackedSites";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "jarvis:open-resume") {
    chrome.tabs.create({ url: chrome.runtime.getURL("resume.html") }).then(() => {
      sendResponse({ ok: true });
    }).catch((error) => {
      console.error("Jarvis could not open the saved resume.", error);
      sendResponse({ ok: false });
    });
    return true;
  }

  if (message?.type !== "jarvis:site-visited") {
    return false;
  }

  const url = sender.tab?.url;
  if (!url) {
    sendResponse({ ok: false });
    return false;
  }

  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    sendResponse({ ok: false });
    return false;
  }

  chrome.storage.local.get(TRACKED_SITES_KEY).then((result) => {
    const sites = result[TRACKED_SITES_KEY] ?? [];
    const existing = sites.find((site) => site.hostname === hostname);
    if (!existing) {
      sendResponse({ ok: true, tracked: false });
      return;
    }

    existing.lastVisitedAt = Date.now();
    existing.lastTitle = sender.tab?.title || existing.lastTitle;
    return chrome.storage.local.set({ [TRACKED_SITES_KEY]: sites }).then(() => {
      sendResponse({ ok: true, tracked: true });
    });
  }).catch((error) => {
    console.error("Jarvis could not update the site's last-visited time.", error);
    sendResponse({ ok: false });
  });

  return true;
});
