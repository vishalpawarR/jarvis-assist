import {
  PERSONAL_INFO_KEY,
  SAVED_PAGES_KEY,
  SYNC_TOMBSTONES_KEY,
  TRACKED_SITES_KEY,
} from "./storage.js";

const STORAGE_KEY_BY_TYPE = {
  tracked_sites: TRACKED_SITES_KEY,
  saved_pages: SAVED_PAGES_KEY,
  personal_details: PERSONAL_INFO_KEY,
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function recordLocalDeletion(recordType, recordId = null) {
  if (!Object.hasOwn(STORAGE_KEY_BY_TYPE, recordType)) {
    throw new Error("Unsupported sync record type.");
  }
  const storageKey = STORAGE_KEY_BY_TYPE[recordType];
  if (recordType !== "personal_details" && !UUID_PATTERN.test(recordId ?? "")) {
    throw new Error("A valid record ID is required to queue this deletion.");
  }

  const result = await chrome.storage.local.get([storageKey, SYNC_TOMBSTONES_KEY]);
  const storedTombstones = result[SYNC_TOMBSTONES_KEY];
  const tombstones = storedTombstones === undefined ? [] : storedTombstones;
  if (!Array.isArray(tombstones)) throw new Error("Local sync deletion queue is invalid.");

  const normalizedRecordId = recordType === "personal_details" ? null : recordId;
  const alreadyQueued = tombstones.some(
    (tombstone) => tombstone.recordType === recordType && tombstone.recordId === normalizedRecordId,
  );
  const nextTombstones = alreadyQueued
    ? tombstones
    : [
        ...tombstones,
        {
          recordType,
          recordId: normalizedRecordId,
          deletedAt: new Date().toISOString(),
        },
      ];

  if (recordType === "personal_details") {
    await chrome.storage.local.set({
      [storageKey]: {},
      [SYNC_TOMBSTONES_KEY]: nextTombstones,
    });
    return;
  }

  const storedRecords = result[storageKey];
  const records = storedRecords === undefined ? [] : storedRecords;
  if (!Array.isArray(records)) throw new Error(`Local ${recordType} data is invalid.`);
  await chrome.storage.local.set({
    [storageKey]: records.filter((record) => record.id !== normalizedRecordId),
    [SYNC_TOMBSTONES_KEY]: nextTombstones,
  });
}
