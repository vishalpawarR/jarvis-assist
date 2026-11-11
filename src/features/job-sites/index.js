import { TRACKED_SITES_KEY } from "../../shared/storage.js";
import { recordLocalDeletion } from "../../shared/sync-tombstones.js";

const trackedSitesElement = document.getElementById("tracked-sites");
const managedSitesElement = document.getElementById("managed-sites");
const siteMessage = document.getElementById("site-message");
const manageMessage = document.getElementById("manage-message");

function getFaviconCandidates(site) {
  const candidates = [];
  if (site.faviconUrl && /^https?:\/\//i.test(site.faviconUrl)) {
    candidates.push(site.faviconUrl);
  }
  try {
    const origin = new URL(site.url).origin;
    candidates.push(`${origin}/favicon.ico`);
    candidates.push(
      `chrome://favicon2/?size=64&scale_factor=2x&page_url=${encodeURIComponent(site.url)}`,
    );
  } catch (error) {
    console.warn("Jarvis could not determine the website favicon.", error);
  }
  return [...new Set(candidates)];
}

export async function renderSites() {
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
    link.setAttribute(
      "aria-label",
      `Open ${site.label || site.hostname}; last opened ${daysSince} ${daysSince === 1 ? "day" : "days"} ago`,
    );

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

export async function renderManagedSites() {
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
      try {
        await recordLocalDeletion("tracked_sites", site.id);
        manageMessage.textContent = "Tracked site deleted from this device.";
        await renderManagedSites();
      } catch (error) {
        console.error("Jarvis could not delete the tracked site.", error);
        manageMessage.textContent = "Could not delete the tracked site.";
      }
    });
    item.append(details, remove);
    managedSitesElement.append(item);
  }
}

async function addActiveSite(activeTab) {
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
    createdAt: Date.now(),
    lastVisitedAt: Date.now(),
    updatedAt: new Date().toISOString(),
  });
  await chrome.storage.local.set({ [TRACKED_SITES_KEY]: sites });
  siteMessage.textContent = "Website added. Jarvis will update its visit date when you open it.";
  await renderSites();
}

export async function initializeJobSites(activeTab) {
  document.getElementById("track-current").addEventListener("click", () => {
    addActiveSite(activeTab).catch((error) => {
      console.error("Jarvis could not add this job site.", error);
      siteMessage.textContent = "Could not add this website.";
    });
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      if (tab.dataset.tab !== "manage") return;
      renderManagedSites().catch((error) => {
        console.error("Jarvis could not load managed job sites.", error);
        managedSitesElement.textContent = "Could not load tracked sites.";
      });
    });
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[TRACKED_SITES_KEY]) return;
    Promise.all([renderSites(), renderManagedSites()]).catch((error) => {
      console.error("Jarvis could not refresh tracked job sites.", error);
    });
  });
  await Promise.all([renderSites(), renderManagedSites()]);
}
