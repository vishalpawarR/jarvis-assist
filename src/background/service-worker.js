const TRACKED_SITES_KEY = "jarvisTrackedSites";
const STALE_SITE_ALARM = "jarvis-daily-stale-site-check";
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const STALE_NOTIFICATION_ID = "jarvis-stale-job-sites";
let checkingStaleSites = false;

async function recordSiteVisit(url, title) {
  try {
    const parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return false;
    }

    const result = await chrome.storage.local.get(TRACKED_SITES_KEY);
    const sites = result[TRACKED_SITES_KEY] ?? [];
    const site = sites.find((item) => item.hostname === parsedUrl.hostname);
    if (!site) {
      return false;
    }

    site.lastVisitedAt = Date.now();
    site.lastTitle = title || site.lastTitle;
    await chrome.storage.local.set({ [TRACKED_SITES_KEY]: sites });
    return true;
  } catch (error) {
    console.error("Jarvis could not update a tracked site's last-visited time.", error);
    return false;
  }
}

async function checkStaleSites() {
  if (checkingStaleSites) return;
  checkingStaleSites = true;
  try {
    const result = await chrome.storage.local.get(TRACKED_SITES_KEY);
    const sites = result[TRACKED_SITES_KEY] ?? [];
    const now = Date.now();
    const newlyStale = sites.filter((site) => {
      const lastVisitedAt = site.lastVisitedAt || site.createdAt || now;
      return (
        now - lastVisitedAt >= STALE_AFTER_MS &&
        (!site.lastStaleNotificationAt || site.lastStaleNotificationAt < lastVisitedAt)
      );
    });
    if (!newlyStale.length) {
      return;
    }

    await chrome.notifications.create(STALE_NOTIFICATION_ID, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("assets/jarvis-128.png"),
      title: "Jarvis job-site reminder",
      message: `${newlyStale.length} tracked job ${newlyStale.length === 1 ? "site has" : "sites have"} not been opened in 7 or more days.`,
      priority: 0,
    });

    for (const site of newlyStale) {
      site.lastStaleNotificationAt = now;
    }
    await chrome.storage.local.set({ [TRACKED_SITES_KEY]: sites });
  } finally {
    checkingStaleSites = false;
  }
}

function scheduleStaleSiteCheck() {
  chrome.alarms.create(STALE_SITE_ALARM, {
    delayInMinutes: 1,
    periodInMinutes: 24 * 60,
  });
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleStaleSiteCheck();
  checkStaleSites().catch((error) => {
    console.error("Jarvis could not check for stale job sites.", error);
  });
});

chrome.runtime.onStartup.addListener(() => {
  scheduleStaleSiteCheck();
  checkStaleSites().catch((error) => {
    console.error("Jarvis could not check for stale job sites.", error);
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== STALE_SITE_ALARM) return;
  checkStaleSites().catch((error) => {
    console.error("Jarvis could not check for stale job sites.", error);
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[TRACKED_SITES_KEY]) return;
  checkStaleSites().catch((error) => {
    console.error("Jarvis could not check for stale job sites.", error);
  });
});

chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId !== STALE_NOTIFICATION_ID) return;
  chrome.notifications.clear(notificationId);
  chrome.tabs
    .create({ url: chrome.runtime.getURL("src/popup/index.html?tab=sites") })
    .catch((error) => {
      console.error("Jarvis could not open the job-site list from the notification.", error);
    });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    recordSiteVisit(tab.url, tab.title);
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs
    .get(tabId)
    .then((tab) => {
      if (tab.url) return recordSiteVisit(tab.url, tab.title);
      return false;
    })
    .catch((error) => {
      console.error("Jarvis could not check the activated tab.", error);
    });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-jarvis-panel") {
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id === undefined) {
      return;
    }
    await chrome.tabs.sendMessage(tab.id, { type: "jarvis:toggle-panel" });
  } catch (error) {
    console.warn("Jarvis panel shortcut is unavailable on this browser page.", error);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "jarvis:open-resume") {
    chrome.tabs
      .create({ url: chrome.runtime.getURL("src/features/resume/viewer.html") })
      .then(() => {
        sendResponse({ ok: true });
      })
      .catch((error) => {
        console.error("Jarvis could not open the saved resume.", error);
        sendResponse({ ok: false });
      });
    return true;
  }

  if (message?.type !== "jarvis:site-visited") {
    return false;
  }

  if (!sender.tab?.url) {
    sendResponse({ ok: false });
    return false;
  }

  recordSiteVisit(sender.tab.url, sender.tab.title).then((tracked) => {
    sendResponse({ ok: true, tracked });
  });
  return true;
});
