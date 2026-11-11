import { getStoredSession, saveSyncConfig, signIn, signOut } from "./client.js";
import {
  enableSync,
  getSyncPreferences,
  pauseSync,
  previewSync,
  resolveSyncConflict,
  syncNow,
} from "./engine.js";
import { SYNC_STATE_KEY } from "../../shared/storage.js";

const configForm = document.getElementById("sync-config-form");
const authForm = document.getElementById("sync-auth-form");
const status = document.getElementById("sync-account-status");
const message = document.getElementById("sync-message");
const signOutButton = document.getElementById("sync-sign-out");
const categoryControls = document.getElementById("sync-category-controls");
const previewMessage = document.getElementById("sync-preview-message");
const syncStatus = document.getElementById("sync-status");
const conflictList = document.getElementById("sync-conflicts");
let previewedUserId = null;

const categoryLabels = {
  personal_details: "Personal details",
  tracked_sites: "Tracked job sites",
  saved_pages: "Saved pages",
};

function selectedCategories() {
  return [...document.querySelectorAll("[data-sync-category]:checked")].map((input) => input.value);
}

function renderPreview(preview) {
  for (const [category, counts] of Object.entries(preview)) {
    const count = document.getElementById(`sync-count-${category}`);
    const pending = counts.pendingDeletes
      ? ` · ${counts.pendingDeletes} pending deletion${counts.pendingDeletes === 1 ? "" : "s"}`
      : "";
    count.textContent = `On this device: ${counts.local} · In Supabase: ${counts.cloud}${pending}`;
  }
}

async function renderSyncState(userId) {
  const { [SYNC_STATE_KEY]: state } = await chrome.storage.local.get(SYNC_STATE_KEY);
  if (!state || state.userId !== userId) return;
  const labels = {
    syncing: "Syncing…",
    synced: `Synced${state.lastSyncedAt ? ` at ${new Date(state.lastSyncedAt).toLocaleString()}` : ""}.`,
    conflicts: "Sync paused for conflicts. Choose which version to keep.",
    needs_attention: state.message || "Sync needs attention.",
  };
  syncStatus.textContent = labels[state.status] || "Not synced yet.";
  conflictList.replaceChildren();
  for (const conflict of state.conflicts || []) {
    const item = document.createElement("div");
    item.className = "sync-conflict";
    const description = document.createElement("p");
    description.textContent = `${categoryLabels[conflict.category] || "Record"} differs on this device and the website.`;
    const actions = document.createElement("div");
    actions.className = "button-row";
    for (const [choice, label] of [
      ["local", "Keep this device"],
      ["cloud", "Keep website"],
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button";
      button.textContent = label;
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await resolveSyncConflict(conflict.key, choice);
          await renderSyncState(userId);
        } catch (error) {
          console.error("Jarvis could not resolve the sync conflict.", error);
          message.textContent = error.message || "Could not resolve the conflict.";
          button.disabled = false;
        }
      });
      actions.append(button);
    }
    item.append(description, actions);
    conflictList.append(item);
  }
}

async function refreshAccountState() {
  const session = await getStoredSession();
  const isSignedIn = Boolean(session);
  document.getElementById("sync-account-email").textContent = session?.email || "";
  authForm.hidden = isSignedIn;
  signOutButton.hidden = !isSignedIn;
  categoryControls.hidden = !isSignedIn;
  status.textContent = isSignedIn
    ? `Connected as ${session.email}. Review your data preview and choose what to sync.`
    : "Not connected";
  if (!session) {
    previewedUserId = null;
    return;
  }

  const preferences = await getSyncPreferences(session.userId);
  for (const input of document.querySelectorAll("[data-sync-category]")) {
    input.checked = Boolean(preferences?.categories?.[input.value]);
  }
  document.getElementById("sync-confirm").checked = false;
  document.getElementById("sync-pause").textContent = preferences?.paused
    ? "Resume sync"
    : "Pause sync";
  document.getElementById("sync-pause").hidden = !preferences?.enabled;
  document.getElementById("sync-now").hidden = !preferences?.enabled;
  try {
    const preview = await previewSync();
    previewedUserId = session.userId;
    renderPreview(preview);
    previewMessage.textContent = preferences?.enabled
      ? "Preview loaded. Sync is enabled for the selected categories."
      : "Preview loaded. No data has been transferred yet.";
  } catch (error) {
    previewedUserId = null;
    console.error("Jarvis could not preview Supabase data.", error);
    previewMessage.textContent = error.message || "Could not load a sync preview.";
  }
  if (preferences?.enabled && !preferences.paused) {
    try {
      await syncNow();
    } catch (error) {
      console.error("Jarvis could not refresh synchronized data.", error);
      message.textContent = error.message || "Could not refresh synchronized data.";
    }
  }
  await renderSyncState(session.userId);
}

export async function initializeSyncFeature() {
  configForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";
    try {
      await saveSyncConfig(
        document.getElementById("sync-project-url").value,
        document.getElementById("sync-publishable-key").value,
      );
      message.textContent = "Supabase project settings saved on this device.";
    } catch (error) {
      console.error("Jarvis could not save Supabase project settings.", error);
      message.textContent = error.message || "Could not save Supabase project settings.";
    }
  });

  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = authForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    message.textContent = "";
    try {
      await signIn(
        document.getElementById("sync-email").value,
        document.getElementById("sync-password").value,
      );
      document.getElementById("sync-password").value = "";
      await refreshAccountState();
      message.textContent =
        "Connected. Review the counts and select categories before enabling sync.";
    } catch (error) {
      console.error("Jarvis could not sign in to Supabase.", error);
      message.textContent = error.message || "Could not sign in to Supabase.";
    } finally {
      submit.disabled = false;
    }
  });

  signOutButton.addEventListener("click", async () => {
    signOutButton.disabled = true;
    message.textContent = "";
    try {
      await signOut();
      await refreshAccountState();
      message.textContent = "Signed out. Your local records were not cleared.";
    } catch (error) {
      console.error("Jarvis could not revoke the Supabase session.", error);
      await refreshAccountState();
      message.textContent = "Signed out locally, but Supabase session revocation failed.";
    } finally {
      signOutButton.disabled = false;
    }
  });

  document.getElementById("sync-preview").addEventListener("click", async () => {
    const session = await getStoredSession();
    if (!session) return;
    document.getElementById("sync-preview").disabled = true;
    try {
      renderPreview(await previewSync());
      previewedUserId = session.userId;
      previewMessage.textContent = "Preview refreshed. No data has been transferred.";
    } catch (error) {
      console.error("Jarvis could not preview Supabase data.", error);
      previewMessage.textContent = error.message || "Could not refresh the preview.";
    } finally {
      document.getElementById("sync-preview").disabled = false;
    }
  });

  document.getElementById("sync-confirm").addEventListener("change", () => {
    if (!document.getElementById("sync-confirm").checked) return;
    if (previewedUserId !== null) return;
    document.getElementById("sync-confirm").checked = false;
    message.textContent = "Load a sync preview for this account before consenting.";
  });

  document.getElementById("sync-enable").addEventListener("click", async () => {
    const session = await getStoredSession();
    if (!session) return;
    if (previewedUserId !== session.userId) {
      message.textContent = "Load a fresh preview for this account before enabling sync.";
      return;
    }
    const button = document.getElementById("sync-enable");
    button.disabled = true;
    message.textContent = "";
    try {
      await enableSync(selectedCategories(), document.getElementById("sync-confirm").checked);
      message.textContent = "Sync enabled for the selected categories.";
      await syncNow();
      await renderSyncState(session.userId);
    } catch (error) {
      console.error("Jarvis could not enable or run sync.", error);
      message.textContent = error.message || "Could not enable sync.";
      await renderSyncState(session.userId);
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("sync-now").addEventListener("click", async () => {
    const session = await getStoredSession();
    if (!session) return;
    const button = document.getElementById("sync-now");
    button.disabled = true;
    try {
      await syncNow({ force: true });
      await renderSyncState(session.userId);
    } catch (error) {
      console.error("Jarvis could not synchronize data.", error);
      message.textContent = error.message || "Sync failed.";
      await renderSyncState(session.userId);
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById("sync-pause").addEventListener("click", async () => {
    const session = await getStoredSession();
    if (!session) return;
    const preferences = await getSyncPreferences(session.userId);
    const shouldPause = !preferences?.paused;
    try {
      await pauseSync(session.userId, shouldPause);
      document.getElementById("sync-pause").textContent = shouldPause
        ? "Resume sync"
        : "Pause sync";
      syncStatus.textContent = shouldPause ? "Sync paused." : "Sync resumed.";
      if (!shouldPause) {
        await syncNow();
        await renderSyncState(session.userId);
      }
    } catch (error) {
      console.error("Jarvis could not update sync pause state.", error);
      message.textContent = error.message || "Could not update sync state.";
    }
  });

  for (const input of document.querySelectorAll("[data-sync-category]")) {
    input.addEventListener("change", () => {
      document.getElementById("sync-confirm").checked = false;
      previewedUserId = null;
      message.textContent = "Review the preview again after changing sync categories.";
    });
  }

  try {
    await refreshAccountState();
  } catch (error) {
    console.error("Jarvis could not load its Supabase account state.", error);
    status.textContent = "Could not load account status.";
  }
}
