import { getStoredSession, saveSyncConfig, signIn, signOut } from "./client.js";

const configForm = document.getElementById("sync-config-form");
const authForm = document.getElementById("sync-auth-form");
const status = document.getElementById("sync-account-status");
const message = document.getElementById("sync-message");
const signOutButton = document.getElementById("sync-sign-out");

async function refreshAccountState() {
  const session = await getStoredSession();
  const isSignedIn = Boolean(session);
  document.getElementById("sync-account-email").textContent = session?.email || "";
  authForm.hidden = isSignedIn;
  signOutButton.hidden = !isSignedIn;
  status.textContent = isSignedIn
    ? `Connected as ${session.email}. Data sync is not enabled until you review and select sync categories.`
    : "Not connected";
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
      message.textContent = "Connected. Choose sync categories before any data is transferred.";
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

  try {
    await refreshAccountState();
  } catch (error) {
    console.error("Jarvis could not load its Supabase account state.", error);
    status.textContent = "Could not load account status.";
  }
}
