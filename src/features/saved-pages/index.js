import { SAVED_PAGES_KEY } from "../../shared/storage.js";
import { recordLocalDeletion } from "../../shared/sync-tombstones.js";

const savedPagesElement = document.getElementById("saved-pages");
const managedPagesElement = document.getElementById("managed-pages");
const manageMessage = document.getElementById("manage-message");

export async function renderSavedPages(query = "") {
  const result = await chrome.storage.local.get(SAVED_PAGES_KEY);
  const pages = result[SAVED_PAGES_KEY] ?? [];
  const normalizedQuery = query.trim().toLowerCase();
  const matches = pages.filter((page) =>
    `${page.title} ${page.url} ${page.selection}`.toLowerCase().includes(normalizedQuery),
  );
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

export async function renderManagedPages() {
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
      try {
        await recordLocalDeletion("saved_pages", page.id);
        manageMessage.textContent = "Saved page deleted from this device.";
        await renderManagedPages();
      } catch (error) {
        console.error("Jarvis could not delete the saved page.", error);
        manageMessage.textContent = "Could not delete the saved page.";
      }
    });
    item.append(details, remove);
    managedPagesElement.append(item);
  }
}

export function initializeSavedPages() {
  document.getElementById("saved-search").addEventListener("input", (event) => {
    renderSavedPages(event.target.value).catch((error) => {
      console.error("Jarvis could not search saved pages.", error);
      savedPagesElement.textContent = "Could not load saved pages.";
    });
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      if (tab.dataset.tab !== "manage") return;
      renderManagedPages().catch((error) => {
        console.error("Jarvis could not load managed saved pages.", error);
        managedPagesElement.textContent = "Could not load saved pages.";
      });
    });
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[SAVED_PAGES_KEY]) return;
    Promise.all([
      renderSavedPages(document.getElementById("saved-search").value),
      renderManagedPages(),
    ]).catch((error) => {
      console.error("Jarvis could not refresh saved pages.", error);
    });
  });
  return Promise.all([renderSavedPages(), renderManagedPages()]);
}
