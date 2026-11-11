import { SYNC_CONFIG_KEY, SYNC_SESSION_KEY } from "../../shared/storage.js";

const REFRESH_WINDOW_MS = 60_000;

function isValidProjectUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === value.replace(/\/+$/, "");
  } catch {
    return false;
  }
}

export async function getSyncConfig() {
  const { [SYNC_CONFIG_KEY]: config } = await chrome.storage.local.get(SYNC_CONFIG_KEY);
  return config ?? null;
}

export async function saveSyncConfig(projectUrl, publishableKey) {
  const normalizedUrl = projectUrl.trim().replace(/\/+$/, "");
  const normalizedKey = publishableKey.trim();
  if (!isValidProjectUrl(normalizedUrl) || !normalizedKey) {
    throw new Error("Enter a valid HTTPS Supabase project URL and publishable key.");
  }
  await chrome.storage.local.set({
    [SYNC_CONFIG_KEY]: { projectUrl: normalizedUrl, publishableKey: normalizedKey },
  });
}

async function getConfigOrThrow() {
  const config = await getSyncConfig();
  if (!config) throw new Error("Save your Supabase project URL and publishable key first.");
  return config;
}

async function authRequest(path, body, config) {
  const response = await fetch(`${config.projectUrl}/auth/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: config.publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      result?.msg ||
        result?.message ||
        result?.error_description ||
        "Supabase authentication failed.",
    );
  }
  return result;
}

function toStoredSession(session) {
  if (!session?.access_token || !session?.refresh_token || !session?.user?.id) {
    throw new Error("Supabase did not return a complete sign-in session.");
  }
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: Date.now() + Number(session.expires_in || 3600) * 1000,
    userId: session.user.id,
    email: session.user.email || "",
  };
}

export async function getStoredSession() {
  const { [SYNC_SESSION_KEY]: session } = await chrome.storage.local.get(SYNC_SESSION_KEY);
  return session ?? null;
}

export async function signIn(email, password) {
  const config = await getConfigOrThrow();
  const result = await authRequest(
    "token?grant_type=password",
    { email: email.trim(), password },
    config,
  );
  const session = toStoredSession(result);
  await chrome.storage.local.set({ [SYNC_SESSION_KEY]: session });
  return session;
}

export async function getValidSession() {
  const session = await getStoredSession();
  if (!session) return null;
  if (session.expiresAt > Date.now() + REFRESH_WINDOW_MS) return session;

  const config = await getConfigOrThrow();
  try {
    const result = await authRequest(
      "token?grant_type=refresh_token",
      { refresh_token: session.refreshToken },
      config,
    );
    const refreshed = toStoredSession(result);
    await chrome.storage.local.set({ [SYNC_SESSION_KEY]: refreshed });
    return refreshed;
  } catch (error) {
    await chrome.storage.local.remove(SYNC_SESSION_KEY);
    throw error;
  }
}

export async function signOut() {
  const [config, session] = await Promise.all([getSyncConfig(), getStoredSession()]);
  if (!session) return;

  let requestError;
  if (config) {
    try {
      const response = await fetch(`${config.projectUrl}/auth/v1/logout`, {
        method: "POST",
        headers: {
          apikey: config.publishableKey,
          Authorization: `Bearer ${session.accessToken}`,
        },
      });
      if (!response.ok)
        requestError = new Error("Supabase could not revoke the extension session.");
    } catch (error) {
      requestError = error;
    }
  }

  await chrome.storage.local.remove(SYNC_SESSION_KEY);
  if (requestError) throw requestError;
}
