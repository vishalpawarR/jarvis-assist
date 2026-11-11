import { PERSONAL_INFO_KEY, SAVED_PAGES_KEY, TRACKED_SITES_KEY } from "../../shared/storage.js";

export function initializeDataExport() {
  document.getElementById("export-data").addEventListener("click", async () => {
    try {
      const data = await chrome.storage.local.get([
        TRACKED_SITES_KEY,
        SAVED_PAGES_KEY,
        PERSONAL_INFO_KEY,
      ]);
      const blob = new Blob(
        [JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...data }, null, 2)],
        {
          type: "application/json",
        },
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "jarvis-data.json";
      anchor.click();
      URL.revokeObjectURL(url);
      document.getElementById("export-message").textContent = "Data export downloaded.";
    } catch (error) {
      console.error("Jarvis could not export your data.", error);
      document.getElementById("export-message").textContent = "Data export failed.";
    }
  });
}
