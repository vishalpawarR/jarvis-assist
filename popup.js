const TRACKED_SITES_KEY = "jarvisTrackedSites";
const SAVED_PAGES_KEY = "jarvisSavedPages";
const PERSONAL_INFO_KEY = "jarvisPersonalInfo";
const RESUME_DB_NAME = "jarvisResume";
const RESUME_STORE_NAME = "files";
let activeTab;

const trackedSitesElement = document.getElementById("tracked-sites");
const managedSitesElement = document.getElementById("managed-sites");
const savedPagesElement = document.getElementById("saved-pages");
const managedPagesElement = document.getElementById("managed-pages");
const siteMessage = document.getElementById("site-message");
const resumeMessage = document.getElementById("resume-message");

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
    const lastVisitedAt = site.lastVisitedAt || site.createdAt || Date.now();
    const daysSince = Math.max(0, Math.floor((Date.now() - lastVisitedAt) / 86_400_000));
    const row = document.createElement("div");
    row.className = "site-item";
    const link = document.createElement("a");
    link.className = `site-link${daysSince >= 7 ? " stale" : ""}`;
    link.href = site.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = `${site.label || site.hostname} · last opened ${daysSince} ${daysSince === 1 ? "day" : "days"} ago`;
    link.setAttribute("aria-label", `Open ${site.label || site.hostname}; last opened ${daysSince} ${daysSince === 1 ? "day" : "days"} ago`);

    const icon = document.createElement("img");
    icon.className = "site-icon";
    icon.alt = "";
    const iconCandidates = getFaviconCandidates(site);
    let iconIndex = 0;
    icon.addEventListener("error", () => {
      iconIndex += 1;
      if (iconIndex < iconCandidates.length) {
        icon.src = iconCandidates[iconIndex];
        return;
      }
      const fallback = document.createElement("span");
      fallback.className = "site-icon-fallback";
      fallback.textContent = (site.hostname || "?").slice(0, 1).toUpperCase();
      icon.replaceWith(fallback);
    });
    icon.src = iconCandidates[iconIndex];
    link.append(icon);
    const ageBadge = document.createElement("span");
    ageBadge.className = `site-age${daysSince >= 7 ? " stale" : ""}`;
    ageBadge.textContent = daysSince > 99 ? "99+" : String(daysSince);
    ageBadge.setAttribute("aria-hidden", "true");
    link.append(ageBadge);

    row.append(link);
    trackedSitesElement.append(row);
  }
}

function getFaviconCandidates(site) {
  const candidates = [];
  if (site.faviconUrl && /^https?:\/\//i.test(site.faviconUrl)) {
    candidates.push(site.faviconUrl);
  }
  try {
    const origin = new URL(site.url).origin;
    candidates.push(`${origin}/favicon.ico`);
    candidates.push(`chrome://favicon2/?size=64&scale_factor=2x&page_url=${encodeURIComponent(site.url)}`);
  } catch (error) {
    console.warn("Jarvis could not determine the website favicon.", error);
  }
  return [...new Set(candidates)];
}

async function renderManagedSites() {
  const result = await chrome.storage.local.get(TRACKED_SITES_KEY);
  const sites = result[TRACKED_SITES_KEY] ?? [];
  managedSitesElement.replaceChildren();
  if (!sites.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "No tracked sites to manage.";
    managedSitesElement.append(empty);
    return;
  }

  for (const site of sites) {
    const item = document.createElement("div");
    item.className = "manage-item";
    const details = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = site.label || site.hostname;
    const url = document.createElement("div");
    url.className = "saved-snippet";
    url.textContent = site.url;
    details.append(name, url);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "button button-danger";
    remove.textContent = "Delete";
    remove.addEventListener("click", async () => {
      if (!confirm(`Delete ${site.label || site.hostname} from tracked job sites?`)) return;
      const current = await chrome.storage.local.get(TRACKED_SITES_KEY);
      const updated = (current[TRACKED_SITES_KEY] ?? []).filter((entry) => entry.id !== site.id);
      await chrome.storage.local.set({ [TRACKED_SITES_KEY]: updated });
      await renderManagedSites();
    });
    item.append(details, remove);
    managedSitesElement.append(item);
  }
}

async function renderPersonalInfo() {
  const result = await chrome.storage.local.get(PERSONAL_INFO_KEY);
  const personalInfo = result[PERSONAL_INFO_KEY] ?? {};
  const form = document.getElementById("personal-form");
  for (const field of form.elements) {
    if (field.name && Object.hasOwn(personalInfo, field.name)) {
      field.value = personalInfo[field.name];
    }
  }

  const values = document.getElementById("personal-values");
  values.replaceChildren();
  const labels = {
    fullName: "Full name",
    email: "Email",
    phone: "Mobile number",
    location: "Location",
    linkedin: "LinkedIn",
  };
  for (const [key, label] of Object.entries(labels)) {
    if (!personalInfo[key]) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-value";
    button.setAttribute("aria-label", `Copy ${label}`);
    const value = document.createElement("strong");
    value.textContent = personalInfo[key];
    const hint = document.createElement("span");
    hint.textContent = `${label} · click to copy`;
    button.append(value, hint);
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(personalInfo[key]);
        document.getElementById("personal-message").textContent = `${label} copied to clipboard.`;
      } catch (error) {
        console.error(`Jarvis could not copy ${label}.`, error);
        document.getElementById("personal-message").textContent = `Could not copy ${label}.`;
      }
    });
    values.append(button);
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

async function renderManagedPages() {
  const result = await chrome.storage.local.get(SAVED_PAGES_KEY);
  const pages = result[SAVED_PAGES_KEY] ?? [];
  managedPagesElement.replaceChildren();
  if (!pages.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "No saved pages to manage.";
    managedPagesElement.append(empty);
    return;
  }

  for (const page of pages) {
    const item = document.createElement("div");
    item.className = "manage-item";
    const details = document.createElement("div");
    const link = document.createElement("a");
    link.className = "saved-title";
    link.href = page.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = page.title || page.url;
    const url = document.createElement("div");
    url.className = "saved-snippet";
    url.textContent = page.url;
    details.append(link, url);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "button button-danger";
    remove.textContent = "Delete";
    remove.addEventListener("click", async () => {
      if (!confirm(`Delete “${page.title || page.url}” from saved pages?`)) return;
      const current = await chrome.storage.local.get(SAVED_PAGES_KEY);
      const updated = (current[SAVED_PAGES_KEY] ?? []).filter((entry) => entry.id !== page.id);
      await chrome.storage.local.set({ [SAVED_PAGES_KEY]: updated });
      await renderManagedPages();
    });
    item.append(details, remove);
    managedPagesElement.append(item);
  }
}

async function initialize() {
  const [tabs, resume] = await Promise.all([
    chrome.tabs.query({ active: true, currentWindow: true }),
    getResume(),
  ]);
  activeTab = tabs[0];
  try {
    const url = new URL(activeTab?.url ?? "");
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported page protocol");
  } catch {
    document.getElementById("track-current").disabled = true;
    siteMessage.textContent = "Open a regular website to track it.";
  }
  document.getElementById("open-resume").disabled = !resume;
  if (resume) resumeMessage.textContent = `Saved locally: ${resume.name}`;
  await Promise.all([
    renderSites(),
    renderManagedSites(),
    renderSavedPages(),
    renderManagedPages(),
    renderPersonalInfo(),
  ]);
  const requestedTab = new URLSearchParams(location.search).get("tab");
  if (requestedTab) {
    document.querySelector(`.tab[data-tab="${CSS.escape(requestedTab)}"]`)?.click();
  }
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((candidate) => {
      const selected = candidate === tab;
      candidate.classList.toggle("active", selected);
      candidate.setAttribute("aria-selected", String(selected));
      candidate.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.hidden = panel.id !== tab.getAttribute("aria-controls");
    });
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (changes[TRACKED_SITES_KEY]) {
    Promise.all([renderSites(), renderManagedSites()]).catch((error) => {
      console.error("Jarvis could not refresh tracked job sites.", error);
    });
  }
  if (changes[SAVED_PAGES_KEY]) {
    Promise.all([
      renderSavedPages(document.getElementById("saved-search").value),
      renderManagedPages(),
    ]).catch((error) => {
      console.error("Jarvis could not refresh saved pages.", error);
    });
  }
});

document.getElementById("personal-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const info = Object.fromEntries(new FormData(event.currentTarget).entries());
  for (const [key, value] of Object.entries(info)) {
    info[key] = value.trim();
  }
  try {
    await chrome.storage.local.set({ [PERSONAL_INFO_KEY]: info });
    document.getElementById("personal-message").textContent = "Personal details saved on this device.";
    await renderPersonalInfo();
  } catch (error) {
    console.error("Jarvis could not save personal details.", error);
    document.getElementById("personal-message").textContent = "Could not save your details.";
  }
});

document.getElementById("clear-personal").addEventListener("click", async () => {
  try {
    await chrome.storage.local.remove(PERSONAL_INFO_KEY);
    document.getElementById("personal-form").reset();
    document.getElementById("personal-message").textContent = "Personal details cleared.";
    await renderPersonalInfo();
  } catch (error) {
    console.error("Jarvis could not clear personal details.", error);
    document.getElementById("personal-message").textContent = "Could not clear your details.";
  }
});

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
    faviconUrl: activeTab.favIconUrl || "",
    lastTitle: activeTab.title || "",
    faviconUrl: activeTab.favIconUrl || "",
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
    const data = await chrome.storage.local.get([TRACKED_SITES_KEY, SAVED_PAGES_KEY, PERSONAL_INFO_KEY]);
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
