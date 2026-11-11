import { initializeDataExport } from "../features/data-export/index.js";
import { initializeJobSites } from "../features/job-sites/index.js";
import { initializeNavigation } from "../features/navigation/index.js";
import { initializePersonalDetails } from "../features/personal-details/index.js";
import { initializeResume } from "../features/resume/popup.js";
import { initializeSavedPages } from "../features/saved-pages/index.js";
import { initializeSyncFeature } from "../features/sync/index.js";

async function initializePopup() {
  try {
    initializeNavigation();
    await initializeSyncFeature();
    const [tabs] = await Promise.all([
      chrome.tabs.query({ active: true, currentWindow: true }),
      initializePersonalDetails(),
      initializeSavedPages(),
      initializeResume(),
    ]);
    initializeDataExport();

    const activeTab = tabs[0];
    try {
      const url = new URL(activeTab?.url ?? "");
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported page protocol");
    } catch {
      document.getElementById("track-current").disabled = true;
      document.getElementById("site-message").textContent = "Open a regular website to track it.";
    }
    await initializeJobSites(activeTab);
  } catch (error) {
    console.error("Jarvis could not initialize the extension popup.", error);
    document.getElementById("site-message").textContent =
      "Could not load Jarvis. Check the extension's storage permissions.";
  }
}

initializePopup();
