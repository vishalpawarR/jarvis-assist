const TRACKED_SITES_KEY = "jarvisTrackedSites";
const SAVED_PAGES_KEY = "jarvisSavedPages";
const RESUME_DB_NAME = "jarvisResume";
const RESUME_STORE_NAME = "files";
let activeTab;

const trackedSitesElement = document.getElementById("tracked-sites");
const savedPagesElement = document.getElementById("saved-pages");
const siteMessage = document.getElementById("site-message");
const resumeMessage = document.getElementById("resume-message");

function daysSince(timestamp) {
  return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
}

function openResumeDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(RESUME_DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(RESUME_STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getResume() {
  const database = await openResumeDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(RESUME_STORE_NAME).objectStore(RESUME_STORE_NAME).get("resume");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveResume(file) {
  const database = await openResumeDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(RESUME_STORE_NAME, "readwrite");
    transaction.objectStore(RESUME_STORE_NAME).put(file, "resume");
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function renderSites() {
  const result = await chrome.storage.local.get(TRACKED_SITES_KEY);
  const sites = result[TRACKED_SITES_KEY] ?? [];
  trackedSitesElement.replaceChildren();
  if (!sites.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "No job sites tracked yet.";
    trackedSitesElement.append(empty);
    return;
  }

  for (const site of sites) {
    const row = document.createElement("div");
    row.className = "site-item";
    const details = document.createElement("div");
    const name = document.createElement("div");
    name.className = "site-name";
    const link = document.createElement("a");
    link.className = "site-link";
    link.href = site.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = site.label || site.hostname;
    name.append(link);
    const meta = document.createElement("div");
    meta.className = "site-meta";
    meta.textContent = `${site.hostname} · ${daysSince(site.lastVisitedAt)} days since last visit`;
    details.append(name, meta);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-site";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove ${site.hostname}`);
    remove.addEventListener("click", async () => {
      const current = await chrome.storage.local.get(TRACKED_SITES_KEY);
      const updated = (current[TRACKED_SITES_KEY] ?? []).filter((item) => item.id !== site.id);
      await chrome.storage.local.set({ [TRACKED_SITES_KEY]: updated });
      await renderSites();
    });
    row.append(details, remove);
    trackedSitesElement.append(row);
  }
}

async function renderSavedPages(query = "") {
  const result = await chrome.storage.local.get(SAVED_PAGES_KEY);
  const pages = result[SAVED_PAGES_KEY] ?? [];
  const normalizedQuery = query.trim().toLowerCase();
  const matches = pages.filter((page) =>
    `${page.title} ${page.url} ${page.selection}`.toLowerCase().includes(normalizedQuery));
  savedPagesElement.replaceChildren();

  if (!matches.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = pages.length ? "No saved pages match your search." : "No pages saved yet.";
    savedPagesElement.append(empty);
    return;
  }

  for (const page of matches) {
    const item = document.createElement("div");
    item.className = "saved-item";
    const link = document.createElement("a");
    link.className = "saved-title";
    link.href = page.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = page.title || page.url;
    const snippet = document.createElement("div");
    snippet.className = "saved-snippet";
    snippet.textContent = page.selection || page.url;
    item.append(link, snippet);
    savedPagesElement.append(item);
  }
}

async function initialize() {
  const [tabs, resume] = await Promise.all([
    chrome.tabs.query({ active: true, currentWindow: true }),
    getResume(),
  ]);
  activeTab = tabs[0];
  const activeSite = document.getElementById("active-site");
  try {
    const url = new URL(activeTab?.url ?? "");
    activeSite.textContent = `Current page: ${activeTab.title || url.hostname} (${url.hostname})`;
  } catch {
    activeSite.textContent = "This browser page cannot be added to the tracker.";
    document.getElementById("track-current").disabled = true;
  }
  document.getElementById("open-resume").disabled = !resume;
  if (resume) resumeMessage.textContent = `Saved locally: ${resume.name}`;
  await Promise.all([renderSites(), renderSavedPages()]);
}

document.getElementById("track-current").addEventListener("click", async () => {
  let url;
  try {
    url = new URL(activeTab?.url ?? "");
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported page protocol");
  } catch {
    siteMessage.textContent = "Open a regular website before tracking it.";
    return;
  }

  const result = await chrome.storage.local.get(TRACKED_SITES_KEY);
  const sites = result[TRACKED_SITES_KEY] ?? [];
  if (sites.some((site) => site.hostname === url.hostname)) {
    siteMessage.textContent = "This website is already tracked.";
    return;
  }
  sites.unshift({
    id: crypto.randomUUID(),
    hostname: url.hostname,
    label: activeTab.title || url.hostname,
    url: url.origin,
    lastTitle: activeTab.title || "",
    createdAt: Date.now(),
    lastVisitedAt: Date.now(),
  });
  await chrome.storage.local.set({ [TRACKED_SITES_KEY]: sites });
  siteMessage.textContent = "Website added. Jarvis will update its visit date when you open it.";
  await renderSites();
});

document.getElementById("choose-resume").addEventListener("click", () => {
  document.getElementById("resume-file").click();
});

document.getElementById("saved-search").addEventListener("input", (event) => {
  renderSavedPages(event.target.value).catch((error) => {
    console.error("Jarvis could not search saved pages.", error);
    savedPagesElement.textContent = "Could not load saved pages.";
  });
});

document.getElementById("resume-file").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    resumeMessage.textContent = "Please choose a PDF file.";
    return;
  }
  try {
    await saveResume(file);
    document.getElementById("open-resume").disabled = false;
    resumeMessage.textContent = `Saved locally: ${file.name}`;
  } catch (error) {
    console.error("Jarvis could not save the selected resume.", error);
    resumeMessage.textContent = "Could not save this PDF in browser storage.";
  }
  event.target.value = "";
});

document.getElementById("open-resume").addEventListener("click", async () => {
  try {
    const file = await getResume();
    if (!file) {
      resumeMessage.textContent = "Choose a resume PDF first.";
      return;
    }
    await chrome.tabs.create({ url: chrome.runtime.getURL("resume.html") });
  } catch (error) {
    console.error("Jarvis could not open the saved resume.", error);
    resumeMessage.textContent = "Could not open the saved resume.";
  }
});

document.getElementById("export-data").addEventListener("click", async () => {
  try {
    const data = await chrome.storage.local.get([TRACKED_SITES_KEY, SAVED_PAGES_KEY]);
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...data }, null, 2)], {
      type: "application/json",
    });
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

initialize().catch((error) => {
  console.error("Jarvis could not load its saved data.", error);
  siteMessage.textContent = "Could not load Jarvis data. Check extension storage permissions.";
});
