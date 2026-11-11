import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

const storage = {};
const remote = {
  personal_details: [],
  tracked_sites: [],
  saved_pages: [],
  sync_tombstones: [],
};
const userId = "de8046ec-9d6c-4ea6-8a01-d1431954632c";
const siteId = "5d319461-2723-4f08-a011-dfa2f898a5dd";

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

const { enableSync, previewSync, resolveSyncConflict, syncNow } =
  await import("../src/features/sync/engine.js");

function response(payload, status = 200, headers = {}) {
  return new Response(payload === null ? null : JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function matchesFilters(row, params) {
  for (const [key, value] of params) {
    if (key === "select" || key === "on_conflict") continue;
    if (key === "deleted_at" && value === "is.null") {
      if (row.deleted_at !== null) return false;
      continue;
    }
    if (value.startsWith("eq.") && String(row[key]) !== value.slice(3)) return false;
  }
  return true;
}

function installRestMock() {
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input);
    const table = url.pathname.split("/").at(-1);
    const user = options.headers?.Authorization?.replace(/^Bearer /, "");
    assert.equal(user, "test-access-token", "REST access must use the signed-in user's token");
    const rows = remote[table];
    assert.ok(rows, `Unexpected REST table: ${table}`);
    const filters = url.searchParams;
    const visible = rows.filter((row) => {
      if (row.user_id !== userId) return false;
      return matchesFilters(row, filters);
    });

    if (options.method === "DELETE") {
      for (const row of visible) {
        if (table !== "sync_tombstones") {
          remote.sync_tombstones.push({
            user_id: userId,
            record_type: table,
            record_id: table === "personal_details" ? userId : row.id,
            deleted_at: new Date().toISOString(),
          });
        }
      }
      remote[table] = rows.filter((row) => !visible.includes(row));
      return response(null, 204);
    }

    if (options.method === "POST") {
      const incoming = JSON.parse(options.body);
      const records = Array.isArray(incoming) ? incoming : [incoming];
      const conflictColumn = filters.get("on_conflict") || "id";
      for (const record of records) {
        assert.equal(record.user_id, userId, "records must be scoped to the signed-in user");
        const index = rows.findIndex((row) => row[conflictColumn] === record[conflictColumn]);
        if (index < 0) rows.push(record);
        else rows[index] = record;
        const recordId = table === "personal_details" ? userId : record.id;
        remote.sync_tombstones = remote.sync_tombstones.filter(
          (item) =>
            !(item.user_id === userId && item.record_type === table && item.record_id === recordId),
        );
      }
      return response(null, 204);
    }

    const range = options.headers?.Range || "0-499";
    const [start, end] = range.split("-").map(Number);
    const page = visible.slice(start, end + 1);
    const selected = filters.get("select");
    const payload =
      selected && selected !== "*"
        ? page.map((row) =>
            Object.fromEntries(selected.split(",").map((column) => [column, row[column]])),
          )
        : page;
    const last = Math.max(start, start + page.length - 1);
    return response(payload, 200, {
      "Content-Range": `${start}-${last}/${visible.length}`,
    });
  };
}

function setSession() {
  storage.jarvisSyncConfig = {
    projectUrl: "https://jarvis-test.supabase.co",
    publishableKey: "publishable-test-key",
  };
  storage.jarvisSyncSession = {
    accessToken: "test-access-token",
    refreshToken: "test-refresh-token",
    expiresAt: Date.now() + 60 * 60 * 1000,
    userId,
    email: "person@example.com",
  };
}

function site(id, overrides = {}) {
  return {
    id,
    hostname: "example.com",
    label: "Example",
    url: "https://example.com/",
    faviconUrl: "https://example.com/favicon.ico",
    lastTitle: "Example",
    createdAt: Date.now() - 10_000,
    lastVisitedAt: Date.now() - 5_000,
    updatedAt: new Date(Date.now() - 5_000).toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  for (const key of Object.keys(storage)) delete storage[key];
  for (const table of Object.keys(remote)) remote[table].length = 0;
  setSession();
  installRestMock();
});

test("previews local and cloud counts without downloading record contents", async () => {
  storage.jarvisTrackedSites = [site(siteId)];
  remote.tracked_sites.push({
    id: "cedef907-bfc5-4146-9583-d927d492d1ee",
    user_id: userId,
    label: "Cloud",
    url: "https://cloud.example/",
    hostname: "cloud.example",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  });
  remote.tracked_sites.push({
    id: "1df77da2-ef77-419a-8e1c-6e793c50a45c",
    user_id: userId,
    label: "Deleted cloud site",
    url: "https://deleted.example/",
    hostname: "deleted.example",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: new Date().toISOString(),
  });

  const preview = await previewSync();

  assert.deepEqual(preview.tracked_sites, { local: 1, cloud: 1, pendingDeletes: 0 });
  assert.equal(preview.personal_details.cloud, 0);
});

test("requires explicit consent and syncs selected local data to the signed-in account", async () => {
  storage.jarvisTrackedSites = [site(siteId)];

  await assert.rejects(enableSync(["tracked_sites"], false), /confirm/i);
  assert.equal(remote.tracked_sites.length, 0);

  await enableSync(["tracked_sites"], true);
  const result = await syncNow();

  assert.equal(result.status, "synced");
  assert.equal(remote.tracked_sites.length, 1);
  assert.equal(remote.tracked_sites[0].id, siteId);
  assert.equal(remote.tracked_sites[0].user_id, userId);
  assert.equal(remote.tracked_sites[0].url, "https://example.com/");
  assert.equal(remote.personal_details.length, 0);
});

test("preserves complete tracked-site URLs and replaces invalid legacy IDs", async () => {
  storage.jarvisTrackedSites = [
    site("legacy-record-id", {
      url: "https://example.com/careers?source=jarvis",
    }),
  ];
  await enableSync(["tracked_sites"], true);

  await syncNow();

  const [uploaded] = remote.tracked_sites;
  assert.match(uploaded.id, /^[0-9a-f-]{36}$/i);
  assert.equal(uploaded.url, "https://example.com/careers?source=jarvis");
  assert.equal(storage.jarvisTrackedSites[0].id, uploaded.id);
});

test("syncs saved-page content and expiration metadata", async () => {
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  storage.jarvisSavedPages = [
    {
      id: siteId,
      title: "Application page",
      url: "https://jobs.example/apply?id=42",
      selection: "Application deadline",
      collection: "read_later",
      savedAt: Date.now() - 1000,
      expiresAt,
      updatedAt: new Date().toISOString(),
    },
  ];
  await enableSync(["saved_pages"], true);

  await syncNow();

  assert.equal(remote.saved_pages.length, 1);
  assert.equal(remote.saved_pages[0].url, "https://jobs.example/apply?id=42");
  assert.equal(remote.saved_pages[0].selected_text, "Application deadline");
  assert.equal(Date.parse(remote.saved_pages[0].expires_at), expiresAt);
});

test("syncs personal details without uploading extension-only timestamps", async () => {
  storage.jarvisPersonalInfo = {
    fullName: "Jarvis User",
    email: "person@example.com",
    phone: "555-0100",
    updatedAt: new Date().toISOString(),
  };
  await enableSync(["personal_details"], true);

  await syncNow();

  assert.equal(remote.personal_details.length, 1);
  assert.deepEqual(remote.personal_details[0].details, {
    fullName: "Jarvis User",
    email: "person@example.com",
    phone: "555-0100",
  });
});

test("downloads saved pages and personal details from the website", async () => {
  const savedPageId = "e67a84bb-0a6a-4b2c-a0f6-22f3d1717f57";
  remote.saved_pages.push({
    id: savedPageId,
    user_id: userId,
    title: "Website page",
    url: "https://jobs.example/application",
    selected_text: "Saved on the website",
    collection: "keep_forever",
    saved_at: new Date().toISOString(),
    expires_at: null,
    updated_at: new Date().toISOString(),
    deleted_at: null,
  });
  remote.personal_details.push({
    user_id: userId,
    details: { fullName: "Website User", phone: "555-0123" },
    updated_at: new Date().toISOString(),
  });
  await enableSync(["saved_pages", "personal_details"], true);

  await syncNow();

  assert.equal(storage.jarvisSavedPages[0].id, savedPageId);
  assert.equal(storage.jarvisSavedPages[0].selection, "Saved on the website");
  assert.equal(storage.jarvisPersonalInfo.fullName, "Website User");
  assert.equal(storage.jarvisPersonalInfo.phone, "555-0123");
});

test("pulls website records to local storage and merges independent local records", async () => {
  const cloudSite = site("cedef907-bfc5-4146-9583-d927d492d1ee", {
    label: "Cloud site",
    hostname: "cloud.example",
    url: "https://cloud.example/",
    updatedAt: undefined,
  });
  remote.tracked_sites.push({
    id: cloudSite.id,
    user_id: userId,
    label: cloudSite.label,
    url: cloudSite.url,
    hostname: cloudSite.hostname,
    favicon_url: "",
    last_visited_at: null,
    created_at: new Date(cloudSite.createdAt).toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  });
  storage.jarvisTrackedSites = [site(siteId)];
  await enableSync(["tracked_sites"], true);

  await syncNow();

  assert.equal(remote.tracked_sites.length, 2);
  assert.deepEqual(
    storage.jarvisTrackedSites.map((record) => record.id).sort(),
    [siteId, cloudSite.id].sort(),
  );
  assert.equal(
    storage.jarvisTrackedSites.find((record) => record.id === cloudSite.id).label,
    "Cloud site",
  );
});

test("applies server tombstones before merging and removes stale local data", async () => {
  const deletedSite = site(siteId);
  storage.jarvisTrackedSites = [deletedSite];
  remote.sync_tombstones.push({
    user_id: userId,
    record_type: "tracked_sites",
    record_id: siteId,
    deleted_at: new Date().toISOString(),
  });
  await enableSync(["tracked_sites"], true);

  await syncNow();

  assert.deepEqual(storage.jarvisTrackedSites, []);
  assert.equal(remote.tracked_sites.length, 0);
  assert.deepEqual(storage.jarvisSyncTombstones, []);
});

test("uploads a local deletion once and removes the cloud record", async () => {
  remote.tracked_sites.push({
    ...site(siteId),
    user_id: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  });
  storage.jarvisTrackedSites = [];
  storage.jarvisSyncTombstones = [
    { recordType: "tracked_sites", recordId: siteId, deletedAt: new Date().toISOString() },
  ];
  await enableSync(["tracked_sites"], true);

  await syncNow();

  assert.equal(remote.tracked_sites.length, 0);
  assert.equal(remote.sync_tombstones.length, 1);
  assert.equal(remote.sync_tombstones[0].record_id, siteId);
  assert.deepEqual(storage.jarvisSyncTombstones, []);
});

test("pauses conflicting concurrent edits until the user chooses a version", async () => {
  const baseline = new Date(Date.now() - 60_000).toISOString();
  const changedAt = new Date().toISOString();
  storage.jarvisTrackedSites = [site(siteId, { label: "Device label", updatedAt: changedAt })];
  remote.tracked_sites.push({
    id: siteId,
    user_id: userId,
    label: "Website label",
    url: "https://example.com/",
    hostname: "example.com",
    favicon_url: "https://example.com/favicon.ico",
    last_visited_at: new Date(Date.now() - 5_000).toISOString(),
    created_at: new Date(Date.now() - 10_000).toISOString(),
    updated_at: changedAt,
    deleted_at: null,
  });
  storage.jarvisSyncPreferences = {
    [userId]: {
      enabled: true,
      categories: { tracked_sites: true },
      lastSyncedAtByCategory: { tracked_sites: baseline },
      resolutions: {},
    },
  };

  const conflictResult = await syncNow();

  assert.equal(conflictResult.status, "conflicts");
  assert.equal(remote.tracked_sites[0].label, "Website label");
  assert.equal(storage.jarvisSyncState.conflicts.length, 1);

  const resolved = await resolveSyncConflict(`tracked_sites:${siteId}`, "local");

  assert.equal(resolved.status, "synced");
  assert.equal(remote.tracked_sites[0].label, "Device label");
  assert.equal(storage.jarvisSyncState.conflicts.length, 0);
});

test("does not reuse another account's sync consent", async () => {
  storage.jarvisSyncPreferences = {
    "f0b016bc-1a44-41ad-99e9-e1dffb7371ce": {
      enabled: true,
      categories: { tracked_sites: true },
    },
  };
  storage.jarvisTrackedSites = [site(siteId)];

  assert.deepEqual(await syncNow(), { status: "paused" });
  assert.equal(remote.tracked_sites.length, 0);
});
