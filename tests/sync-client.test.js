import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

const storage = {};
const originalFetch = globalThis.fetch;
const userId = "de8046ec-9d6c-4ea6-8a01-d1431954632c";

globalThis.chrome = {
  storage: {
    local: {
      async get(keys) {
        return Object.fromEntries(
          (Array.isArray(keys) ? keys : [keys]).map((key) => [key, storage[key]]),
        );
      },
      async set(values) {
        Object.assign(storage, values);
      },
      async remove(keys) {
        for (const key of Array.isArray(keys) ? keys : [keys]) delete storage[key];
      },
    },
  },
};

const { getStoredSession, getValidSession, saveSyncConfig, signIn, signOut } =
  await import("../src/features/sync/client.js");

beforeEach(() => {
  for (const key of Object.keys(storage)) delete storage[key];
  globalThis.fetch = originalFetch;
});

function installConfig() {
  storage.jarvisSyncConfig = {
    projectUrl: "https://jarvis-test.supabase.co",
    publishableKey: "publishable-test-key",
  };
}

function authSession(overrides = {}) {
  return {
    access_token: "access-test-token",
    refresh_token: "refresh-test-token",
    expires_in: 3600,
    user: { id: userId, email: "person@example.com" },
    ...overrides,
  };
}

test("accepts HTTPS Supabase project URLs and rejects malformed or non-HTTPS URLs", async () => {
  await saveSyncConfig("https://jarvis-test.supabase.co/", "publishable-test-key");

  assert.equal(storage.jarvisSyncConfig.projectUrl, "https://jarvis-test.supabase.co");
  await assert.rejects(saveSyncConfig("http://jarvis-test.supabase.co", "key"));
  await assert.rejects(saveSyncConfig("https://jarvis-test.supabase.co/path", "key"));
  await assert.rejects(saveSyncConfig("https://jarvis-test.supabase.co", ""));
});

test("signs in with Supabase and stores tokens but never stores the password", async () => {
  installConfig();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://jarvis-test.supabase.co/auth/v1/token?grant_type=password");
    assert.equal(options.headers.apikey, "publishable-test-key");
    assert.equal(JSON.parse(options.body).password, "do-not-store-this");
    return Response.json(authSession());
  };

  const session = await signIn("person@example.com", "do-not-store-this");

  assert.equal(session.userId, userId);
  assert.equal(session.email, "person@example.com");
  assert.equal(storage.jarvisSyncSession.refreshToken, "refresh-test-token");
  assert.equal(JSON.stringify(storage).includes("do-not-store-this"), false);
});

test("reports a useful sign-in error and leaves no session", async () => {
  installConfig();
  globalThis.fetch = async () => Response.json({ msg: "Email not confirmed" }, { status: 400 });

  await assert.rejects(signIn("person@example.com", "password"), /Email not confirmed/);
  assert.equal(storage.jarvisSyncSession, undefined);
});

test("refreshes expiring sessions and stores the rotated refresh token", async () => {
  installConfig();
  storage.jarvisSyncSession = {
    accessToken: "expired-access-token",
    refreshToken: "old-refresh-token",
    expiresAt: Date.now() - 1,
    userId,
    email: "person@example.com",
  };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://jarvis-test.supabase.co/auth/v1/token?grant_type=refresh_token");
    assert.deepEqual(JSON.parse(options.body), { refresh_token: "old-refresh-token" });
    return Response.json(authSession({ refresh_token: "rotated-refresh-token" }));
  };

  const session = await getValidSession();

  assert.equal(session.refreshToken, "rotated-refresh-token");
  assert.ok(session.expiresAt > Date.now());
});

test("clears local credentials when refresh is rejected", async () => {
  installConfig();
  storage.jarvisSyncSession = {
    accessToken: "expired-access-token",
    refreshToken: "revoked-refresh-token",
    expiresAt: 0,
    userId,
    email: "person@example.com",
  };
  globalThis.fetch = async () =>
    Response.json({ message: "Invalid refresh token" }, { status: 400 });

  await assert.rejects(getValidSession(), /Invalid refresh token/);
  assert.equal(await getStoredSession(), null);
});

test("clears local credentials even if server sign-out fails", async () => {
  installConfig();
  storage.jarvisSyncSession = {
    accessToken: "access-test-token",
    refreshToken: "refresh-test-token",
    expiresAt: Date.now() + 60_000,
    userId,
    email: "person@example.com",
  };
  globalThis.fetch = async () => Response.json({ message: "Unavailable" }, { status: 503 });

  await assert.rejects(signOut(), /could not revoke/i);
  assert.equal(await getStoredSession(), null);
});
