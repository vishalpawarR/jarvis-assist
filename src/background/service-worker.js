import { getValidSession } from "../features/sync/client.js";
import { getSyncPreferences, syncNow } from "../features/sync/engine.js";
import {
  PERSONAL_INFO_KEY,
  SAVED_PAGES_KEY,
  SYNC_TOMBSTONES_KEY,
  SYNC_WRITE_MARKER_KEY,
  TRACKED_SITES_KEY,
} from "../shared/storage.js";

const STALE_SITE_ALARM = "jarvis-daily-stale-site-check";
const SYNC_RETRY_ALARM = "jarvis-sync-retry";
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const STALE_NOTIFICATION_ID = "jarvis-stale-job-sites";
const SYNC_DEBOUNCE_MS = 3000;
let checkingStaleSites = false;
let syncTimer;

async function runAutomaticSync() {
  const session = await getValidSession();
  if (!session) return;
  const preferences = await getSyncPreferences(session.userId);
  if (!preferences?.enabled || preferences.paused) return;
  const result = await syncNow();
  if (result.status === "syncing") scheduleAutomaticSync();
}

function scheduleAutomaticSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    runAutomaticSync().catch((error) => {
      console.error("Jarvis could not synchronize local changes.", error);
    });
  }, SYNC_DEBOUNCE_MS);
}

function hasMeaningfulSiteChange(change) {
  const stripActivity = (sites) => {
    if (!Array.isArray(sites)) return sites;
    return sites.map((site) => {
      if (!site || typeof site !== "object" || Array.isArray(site)) return site;
      const { lastVisitedAt, lastTitle, lastStaleNotificationAt, updatedAt, ...trackedSite } = site;
      return trackedSite;
    });
  };
  return (
    JSON.stringify(stripActivity(change.oldValue)) !==
    JSON.stringify(stripActivity(change.newValue))
  );
}

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
    site.updatedAt = new Date().toISOString();
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
  chrome.alarms.create(SYNC_RETRY_ALARM, {
    delayInMinutes: 15,
    periodInMinutes: 15,
  });
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleStaleSiteCheck();
  checkStaleSites().catch((error) => {
    console.error("Jarvis could not check for stale job sites.", error);
  });
  runAutomaticSync().catch((error) => {
    console.error("Jarvis could not synchronize on installation.", error);
  });
});

chrome.runtime.onStartup.addListener(() => {
  scheduleStaleSiteCheck();
  checkStaleSites().catch((error) => {
    console.error("Jarvis could not check for stale job sites.", error);
  });
  runAutomaticSync().catch((error) => {
    console.error("Jarvis could not synchronize on startup.", error);
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === STALE_SITE_ALARM) {
    checkStaleSites().catch((error) => {
      console.error("Jarvis could not check for stale job sites.", error);
    });
  } else if (alarm.name === SYNC_RETRY_ALARM) {
    runAutomaticSync().catch((error) => {
      console.error("Jarvis could not retry synchronization.", error);
    });
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (changes[TRACKED_SITES_KEY]) {
    checkStaleSites().catch((error) => {
      console.error("Jarvis could not check for stale job sites.", error);
    });
  }
  if (changes[SYNC_WRITE_MARKER_KEY]) return;
  const changedSites =
    changes[TRACKED_SITES_KEY] && hasMeaningfulSiteChange(changes[TRACKED_SITES_KEY]);
  if (
    changedSites ||
    changes[SAVED_PAGES_KEY] ||
    changes[PERSONAL_INFO_KEY] ||
    changes[SYNC_TOMBSTONES_KEY]
  ) {
    scheduleAutomaticSync();
  }
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
