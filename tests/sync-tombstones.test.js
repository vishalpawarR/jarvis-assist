import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

const storage = {};

globalThis.chrome = {
  storage: {
    local: {
      async get(keys) {
        return Object.fromEntries(keys.map((key) => [key, storage[key]]));
      },
      async set(values) {
        Object.assign(storage, values);
      },
    },
  },
};

const { recordLocalDeletion } = await import("../src/shared/sync-tombstones.js");
const trackedSitesId = "5d319461-2723-4f08-a011-dfa2f898a5dd";
const anotherSiteId = "cedef907-bfc5-4146-9583-d927d492d1ee";

beforeEach(() => {
  for (const key of Object.keys(storage)) delete storage[key];
});

test("removes a tracked site and stores only its tombstone metadata", async () => {
  storage.jarvisTrackedSites = [
    { id: trackedSitesId, label: "Example", url: "https://example.com" },
    { id: anotherSiteId, label: "Other", url: "https://other.example" },
  ];

  await recordLocalDeletion("tracked_sites", trackedSitesId);

  assert.deepEqual(storage.jarvisTrackedSites, [
    { id: anotherSiteId, label: "Other", url: "https://other.example" },
  ]);
  assert.equal(storage.jarvisSyncTombstones.length, 1);
  assert.deepEqual(Object.keys(storage.jarvisSyncTombstones[0]).sort(), [
    "deletedAt",
    "recordId",
    "recordType",
  ]);
  assert.equal(storage.jarvisSyncTombstones[0].recordId, trackedSitesId);
  assert.equal(storage.jarvisSyncTombstones[0].recordType, "tracked_sites");
  assert.ok(Number.isFinite(Date.parse(storage.jarvisSyncTombstones[0].deletedAt)));
});

test("removes a saved page and queues its stable ID", async () => {
  storage.jarvisSavedPages = [
    { id: trackedSitesId, title: "Article", selection: "Private selected text" },
  ];

  await recordLocalDeletion("saved_pages", trackedSitesId);

  assert.deepEqual(storage.jarvisSavedPages, []);
  assert.equal(storage.jarvisSyncTombstones[0].recordType, "saved_pages");
  assert.equal(storage.jarvisSyncTombstones[0].recordId, trackedSitesId);
  assert.equal(
    JSON.stringify(storage.jarvisSyncTombstones).includes("Private selected text"),
    false,
  );
});

test("keeps local delete retries idempotent", async () => {
  storage.jarvisTrackedSites = [{ id: trackedSitesId }];

  await recordLocalDeletion("tracked_sites", trackedSitesId);
  await recordLocalDeletion("tracked_sites", trackedSitesId);

  assert.equal(storage.jarvisSyncTombstones.length, 1);
  assert.deepEqual(storage.jarvisTrackedSites, []);
});

test("clears personal details and queues an owner-resolved tombstone", async () => {
  storage.jarvisPersonalInfo = { fullName: "Example Person", phone: "555-0100" };

  await recordLocalDeletion("personal_details");

  assert.deepEqual(storage.jarvisPersonalInfo, {});
  assert.equal(storage.jarvisSyncTombstones.length, 1);
  assert.equal(storage.jarvisSyncTombstones[0].recordType, "personal_details");
  assert.equal(storage.jarvisSyncTombstones[0].recordId, null);
  assert.ok(Number.isFinite(Date.parse(storage.jarvisSyncTombstones[0].deletedAt)));
});

test("does not mutate local data when a record ID is invalid", async () => {
  storage.jarvisTrackedSites = [{ id: "legacy-id" }];

  await assert.rejects(recordLocalDeletion("tracked_sites", "legacy-id"));

  assert.deepEqual(storage.jarvisTrackedSites, [{ id: "legacy-id" }]);
  assert.equal(storage.jarvisSyncTombstones, undefined);
});

test("rejects malformed local collections without overwriting them", async () => {
  storage.jarvisTrackedSites = null;

  await assert.rejects(recordLocalDeletion("tracked_sites", trackedSitesId));

  assert.equal(storage.jarvisTrackedSites, null);
  assert.equal(storage.jarvisSyncTombstones, undefined);
});
