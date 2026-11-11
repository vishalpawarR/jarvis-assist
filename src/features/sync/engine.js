import {
  PERSONAL_INFO_KEY,
  SAVED_PAGES_KEY,
  SYNC_PREFERENCES_KEY,
  SYNC_STATE_KEY,
  SYNC_TOMBSTONES_KEY,
  SYNC_WRITE_MARKER_KEY,
  TRACKED_SITES_KEY,
} from "../../shared/storage.js";
import { getSyncConfig, getValidSession } from "./client.js";

const CATEGORIES = {
  personal_details: {
    storageKey: PERSONAL_INFO_KEY,
    table: "personal_details",
    idColumn: "user_id",
  },
  tracked_sites: { storageKey: TRACKED_SITES_KEY, table: "tracked_sites", idColumn: "id" },
  saved_pages: { storageKey: SAVED_PAGES_KEY, table: "saved_pages", idColumn: "id" },
};
const PAGE_SIZE = 500;
const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
let syncInProgress = false;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .filter((key) => key !== "updatedAt")
      .sort()
      .map((key) => [key, canonicalJson(value[key])]),
  );
}

function readTimestamp(value, fallback = Date.now()) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toIso(value, fallback) {
  return new Date(readTimestamp(value, fallback)).toISOString();
}

function normalizeSiteUrl(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("A tracked site has an unsupported URL.");
  }
  return url.href;
}

function siteIdentity(value) {
  return new URL(normalizeSiteUrl(value)).origin;
}

function errorFromResponse(payload, status) {
  const message =
    payload?.message || payload?.msg || payload?.details || payload?.error_description;
  return new Error(
    message ? `Supabase request failed: ${message}` : `Supabase request failed (${status}).`,
  );
}

async function restRequest(path, { method = "GET", body, prefer, range } = {}) {
  const [config, session] = await Promise.all([getSyncConfig(), getValidSession()]);
  if (!config || !session) throw new Error("Connect to your Supabase account before syncing.");
  const headers = {
    apikey: config.publishableKey,
    Authorization: `Bearer ${session.accessToken}`,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;
  if (range) headers.Range = range;

  const response = await fetch(`${config.projectUrl}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw errorFromResponse(payload, response.status);
  return { payload, headers: response.headers };
}

async function fetchAllRows(table, filters) {
  const rows = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const params = new URLSearchParams({ select: "*", ...filters });
    const result = await restRequest(`${table}?${params}`, {
      range: `${start}-${start + PAGE_SIZE - 1}`,
    });
    if (!Array.isArray(result.payload)) throw new Error(`Supabase returned invalid ${table} data.`);
    rows.push(...result.payload);
    if (result.payload.length < PAGE_SIZE) return rows;
  }
}

async function fetchCount(table, filters, idColumn) {
  const params = new URLSearchParams({ select: idColumn, ...filters });
  const result = await restRequest(`${table}?${params}`, { range: "0-0", prefer: "count=exact" });
  const match = result.headers.get("content-range")?.match(/\/(\d+)$/);
  if (!match) throw new Error(`Supabase did not return a count for ${table}.`);
  return Number(match[1]);
}

async function deleteRemote(table, filters) {
  const params = new URLSearchParams(filters);
  await restRequest(`${table}?${params}`, { method: "DELETE", prefer: "return=minimal" });
}

async function upsertRemote(table, records, conflictColumn = "id") {
  if (!records.length) return;
  const params = new URLSearchParams({ on_conflict: conflictColumn });
  await restRequest(`${table}?${params}`, {
    method: "POST",
    body: records,
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

function hasPersonalDetails(details) {
  return (
    isRecord(details) &&
    Object.entries(details).some(
      ([key, value]) =>
        key !== "updatedAt" &&
        (Array.isArray(value)
          ? value.length > 0
          : value !== "" && value !== null && value !== undefined),
    )
  );
}

function localCount(category, value) {
  if (category === "personal_details") return hasPersonalDetails(value) ? 1 : 0;
  return Array.isArray(value) ? value.length : 0;
}

async function readLocalData() {
  const result = await chrome.storage.local.get([
    TRACKED_SITES_KEY,
    SAVED_PAGES_KEY,
    PERSONAL_INFO_KEY,
    SYNC_TOMBSTONES_KEY,
  ]);
  for (const [category, config] of Object.entries(CATEGORIES)) {
    const stored = result[config.storageKey];
    if (
      stored !== undefined &&
      (category === "personal_details" ? !isRecord(stored) : !Array.isArray(stored))
    ) {
      throw new Error(`Local ${category} data is invalid; sync was stopped without changing it.`);
    }
  }
  if (result[SYNC_TOMBSTONES_KEY] !== undefined && !Array.isArray(result[SYNC_TOMBSTONES_KEY])) {
    throw new Error("Local sync deletion queue is invalid.");
  }
  return {
    tracked_sites: Array.isArray(result[TRACKED_SITES_KEY]) ? result[TRACKED_SITES_KEY] : [],
    saved_pages: Array.isArray(result[SAVED_PAGES_KEY]) ? result[SAVED_PAGES_KEY] : [],
    personal_details: isRecord(result[PERSONAL_INFO_KEY]) ? result[PERSONAL_INFO_KEY] : {},
    tombstones: Array.isArray(result[SYNC_TOMBSTONES_KEY]) ? result[SYNC_TOMBSTONES_KEY] : [],
  };
}

function userFilter(userId) {
  return { user_id: `eq.${userId}` };
}

export async function previewSync() {
  const session = await getValidSession();
  if (!session) throw new Error("Sign in before previewing data.");
  const local = await readLocalData();
  const preview = {};
  for (const [category, config] of Object.entries(CATEGORIES)) {
    preview[category] = {
      local: localCount(category, local[category]),
      cloud: await fetchCount(
        config.table,
        {
          ...userFilter(session.userId),
          ...(category === "personal_details" ? {} : { deleted_at: "is.null" }),
        },
        config.idColumn,
      ),
      pendingDeletes: local.tombstones.filter(
        (item) =>
          item.recordType === category && (!item.accountId || item.accountId === session.userId),
      ).length,
    };
  }
  return preview;
}

export async function getSyncPreferences(userId) {
  const { [SYNC_PREFERENCES_KEY]: allPreferences } =
    await chrome.storage.local.get(SYNC_PREFERENCES_KEY);
  return allPreferences?.[userId] ?? null;
}

export async function enableSync(categories, reviewed) {
  if (reviewed !== true)
    throw new Error("Review and confirm the sync preview before enabling sync.");
  const selected = [...new Set(categories)].filter((category) =>
    Object.hasOwn(CATEGORIES, category),
  );
  if (!selected.length) throw new Error("Select at least one data category to sync.");
  const session = await getValidSession();
  if (!session) throw new Error("Sign in before enabling sync.");

  const { [SYNC_PREFERENCES_KEY]: allPreferences = {} } =
    await chrome.storage.local.get(SYNC_PREFERENCES_KEY);
  const previous = allPreferences[session.userId] ?? {};
  const mergedCategories = Object.fromEntries(
    Object.keys(CATEGORIES).map((category) => [category, selected.includes(category)]),
  );
  const updated = {
    ...allPreferences,
    [session.userId]: {
      ...previous,
      categories: mergedCategories,
      enabled: true,
      paused: false,
      enabledAt: previous.enabledAt ?? new Date().toISOString(),
    },
  };
  await chrome.storage.local.set({ [SYNC_PREFERENCES_KEY]: updated });
  return session.userId;
}

export async function pauseSync(userId, paused = true) {
  const { [SYNC_PREFERENCES_KEY]: allPreferences = {} } =
    await chrome.storage.local.get(SYNC_PREFERENCES_KEY);
  const previous = allPreferences[userId];
  if (!previous) return;
  await chrome.storage.local.set({
    [SYNC_PREFERENCES_KEY]: {
      ...allPreferences,
      [userId]: { ...previous, paused },
    },
  });
}

function localRecordUpdatedAt(category, record) {
  if (category === "personal_details") return readTimestamp(record.updatedAt, 0);
  return readTimestamp(
    record.updatedAt,
    category === "tracked_sites"
      ? Math.max(readTimestamp(record.createdAt, 0), readTimestamp(record.lastVisitedAt, 0))
      : readTimestamp(record.savedAt, 0),
  );
}

function mapLocalRecord(category, record, userId) {
  if (category === "tracked_sites") {
    const url = normalizeSiteUrl(record.url);
    const updatedAt = localRecordUpdatedAt(category, record);
    return {
      id: record.id,
      user_id: userId,
      label: String(record.label || record.hostname || url).slice(0, 100),
      url,
      hostname: new URL(url).hostname,
      favicon_url: record.faviconUrl || null,
      last_visited_at: record.lastVisitedAt ? toIso(record.lastVisitedAt) : null,
      created_at: toIso(record.createdAt, updatedAt),
      updated_at: new Date(updatedAt || Date.now()).toISOString(),
      deleted_at: null,
    };
  }
  if (category === "saved_pages") {
    const url = new URL(record.url);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      throw new Error("A saved page has an unsupported URL.");
    }
    const updatedAt = localRecordUpdatedAt(category, record);
    return {
      id: record.id,
      user_id: userId,
      title: String(record.title || url.href).slice(0, 300),
      url: url.href,
      selected_text: String(record.selection || "").slice(0, 5000) || null,
      collection: record.collection === "read_later" ? "read_later" : "keep_forever",
      saved_at: toIso(record.savedAt, updatedAt),
      expires_at: record.expiresAt ? toIso(record.expiresAt) : null,
      updated_at: new Date(updatedAt || Date.now()).toISOString(),
      deleted_at: null,
    };
  }
  const details = Object.fromEntries(Object.entries(record).filter(([key]) => key !== "updatedAt"));
  return {
    user_id: userId,
    details,
    updated_at: new Date(localRecordUpdatedAt(category, record) || Date.now()).toISOString(),
  };
}

function mapRemoteRecord(category, record) {
  if (category === "tracked_sites") {
    return {
      id: record.id,
      hostname: record.hostname,
      label: record.label,
      url: record.url,
      faviconUrl: record.favicon_url || "",
      lastVisitedAt: record.last_visited_at ? Date.parse(record.last_visited_at) : null,
      createdAt: Date.parse(record.created_at),
      updatedAt: record.updated_at,
      lastTitle: "",
    };
  }
  if (category === "saved_pages") {
    return {
      id: record.id,
      title: record.title,
      url: record.url,
      selection: record.selected_text || "",
      collection: record.collection,
      savedAt: Date.parse(record.saved_at),
      expiresAt: record.expires_at ? Date.parse(record.expires_at) : null,
      updatedAt: record.updated_at,
    };
  }
  return { ...record.details, updatedAt: record.updated_at };
}

function equivalent(category, local, remote) {
  if (category === "tracked_sites") {
    return (
      local.label === remote.label &&
      normalizeSiteUrl(local.url) === normalizeSiteUrl(remote.url) &&
      (local.faviconUrl || "") === (remote.favicon_url || "") &&
      (local.lastVisitedAt ? Date.parse(toIso(local.lastVisitedAt)) : null) ===
        (remote.last_visited_at ? Date.parse(remote.last_visited_at) : null)
    );
  }
  if (category === "saved_pages") {
    return (
      local.title === remote.title &&
      new URL(local.url).href === new URL(remote.url).href &&
      (local.selection || "") === (remote.selected_text || "") &&
      (local.collection || "keep_forever") === remote.collection &&
      (local.expiresAt ? Date.parse(toIso(local.expiresAt)) : null) ===
        (remote.expires_at ? Date.parse(remote.expires_at) : null)
    );
  }
  return JSON.stringify(canonicalJson(local)) === JSON.stringify(canonicalJson(remote.details));
}

async function writeLocalRecords(category, records) {
  const storageKey = CATEGORIES[category].storageKey;
  await writeSyncStorage({ [storageKey]: records });
}

async function writeSyncStorage(values) {
  await chrome.storage.local.set({
    ...values,
    [SYNC_WRITE_MARKER_KEY]: crypto.randomUUID(),
  });
}

async function applyServerTombstones(category, tombstones, userId) {
  if (!tombstones.length) return;
  const local = await readLocalData();
  const deletedIds = new Set(tombstones.map((item) => item.record_id));
  if (category === "personal_details") {
    await writeSyncStorage({ [PERSONAL_INFO_KEY]: {} });
  } else {
    const records = local[category].filter((record) => !deletedIds.has(record.id));
    await writeLocalRecords(category, records);
  }
  const remaining = local.tombstones.filter(
    (item) =>
      item.recordType !== category ||
      (item.accountId && item.accountId !== userId) ||
      !deletedIds.has(category === "personal_details" ? userId : item.recordId),
  );
  await writeSyncStorage({ [SYNC_TOMBSTONES_KEY]: remaining });
}

async function pushLocalTombstones(category, userId) {
  const local = await readLocalData();
  const selected = local.tombstones.filter(
    (item) => item.recordType === category && (!item.accountId || item.accountId === userId),
  );
  if (!selected.length) return;

  const boundIds = new Set(selected);
  const bound = local.tombstones.map((item) =>
    boundIds.has(item) ? { ...item, accountId: userId } : item,
  );
  await writeSyncStorage({ [SYNC_TOMBSTONES_KEY]: bound });

  for (const item of selected) {
    if (category === "personal_details") {
      await deleteRemote(CATEGORIES[category].table, userFilter(userId));
    } else {
      await deleteRemote(CATEGORIES[category].table, {
        id: `eq.${item.recordId}`,
        ...userFilter(userId),
      });
    }
  }
}

function makeConflict(category, localRecordId, remoteRecordId) {
  return {
    category,
    localRecordId: localRecordId ?? null,
    remoteRecordId,
    key: `${category}:${remoteRecordId}`,
  };
}

async function syncRecords(category, userId, lastSyncedAt, resolutions, conflicts) {
  const table = CATEGORIES[category].table;
  const liveFilters = {
    ...userFilter(userId),
    ...(category === "personal_details" ? {} : { deleted_at: "is.null" }),
  };
  const remoteRows = await fetchAllRows(table, liveFilters);
  const tombstoneParams = new URLSearchParams({
    select: "record_id,record_type",
    ...userFilter(userId),
    record_type: `eq.${category}`,
  });
  const tombstoneResult = await restRequest(`sync_tombstones?${tombstoneParams}`);
  if (!Array.isArray(tombstoneResult.payload)) {
    throw new Error("Supabase returned invalid deletion metadata.");
  }
  const remoteTombstones = tombstoneResult.payload;
  await applyServerTombstones(category, remoteTombstones, userId);

  const tombstoneIds = new Set(remoteTombstones.map((item) => item.record_id));
  const localData = await readLocalData();
  let localRecords =
    category === "personal_details"
      ? hasPersonalDetails(localData.personal_details)
        ? [localData.personal_details]
        : []
      : localData[category];

  if (category !== "personal_details") {
    const nextRecords = localRecords.map((record) => ({
      ...record,
      id: UUID_PATTERN.test(record.id || "") ? record.id : crypto.randomUUID(),
      updatedAt:
        record.updatedAt ||
        new Date(localRecordUpdatedAt(category, record) || Date.now()).toISOString(),
    }));
    if (
      nextRecords.some(
        (record, index) =>
          record.id !== localRecords[index].id ||
          record.updatedAt !== localRecords[index].updatedAt,
      )
    ) {
      await writeLocalRecords(category, nextRecords);
    }
    localRecords = nextRecords;
  }

  const localDeletes = localData.tombstones.filter(
    (item) => item.recordType === category && item.accountId === userId,
  );
  const deletedLocalIds = new Set(localDeletes.map((item) => item.recordId));
  if (category !== "personal_details") {
    localRecords = localRecords.filter(
      (record) => !deletedLocalIds.has(record.id) && !tombstoneIds.has(record.id),
    );
  }

  const remoteById = new Map(remoteRows.map((row) => [row.id, row]));
  const localById = new Map(
    localRecords.map((record) => [category === "personal_details" ? userId : record.id, record]),
  );
  const localUpserts = [];
  const pulled = new Map();
  const removedLocalIds = new Set();
  const handledRemote = new Set();
  const categoryBaseline = lastSyncedAt ? Date.parse(lastSyncedAt) : null;

  for (const [id, localRecord] of localById) {
    if (tombstoneIds.has(id)) continue;
    let remote = remoteById.get(id);
    let localId = id;

    if (!remote && category === "tracked_sites") {
      const localUrl = normalizeSiteUrl(localRecord.url);
      const localOrigin = siteIdentity(localRecord.url);
      remote = remoteRows.find(
        (row) => !handledRemote.has(row.id) && normalizeSiteUrl(row.url) === localUrl,
      );
      if (!remote) {
        const originMatches = remoteRows.filter(
          (row) => !handledRemote.has(row.id) && siteIdentity(row.url) === localOrigin,
        );
        if (originMatches.length === 1) remote = originMatches[0];
      }
      if (remote) localId = localRecord.id;
    }

    if (!remote) {
      localUpserts.push(mapLocalRecord(category, localRecord, userId));
      continue;
    }

    handledRemote.add(remote.id);
    const same = equivalent(category, localRecord, remote);
    if (same) {
      if (category === "tracked_sites" && localRecord.id !== remote.id) {
        removedLocalIds.add(localRecord.id);
        pulled.set(remote.id, {
          ...mapRemoteRecord(category, remote),
          lastTitle: localRecord.lastTitle || "",
        });
      }
      continue;
    }

    const localUpdated = localRecordUpdatedAt(category, localRecord);
    const remoteUpdated = Date.parse(
      remote.updated_at || remote.saved_at || remote.created_at || 0,
    );
    const bothChanged =
      categoryBaseline === null ||
      (localUpdated > categoryBaseline && remoteUpdated > categoryBaseline);
    const conflictKey = `${category}:${remote.id}`;
    const resolution = resolutions[conflictKey];

    if (!same && bothChanged && !resolution) {
      conflicts.push(makeConflict(category, localId, remote.id));
      continue;
    }
    if (resolution === "local" || (resolution !== "cloud" && localUpdated > remoteUpdated)) {
      const mapped = mapLocalRecord(category, localRecord, userId);
      if (category === "tracked_sites" && localRecord.id !== remote.id) mapped.id = remote.id;
      localUpserts.push(mapped);
      if (category === "tracked_sites" && localRecord.id !== remote.id) {
        removedLocalIds.add(localRecord.id);
        pulled.set(remote.id, { ...localRecord, id: remote.id });
      }
    } else {
      if (category === "tracked_sites" && localRecord.id !== remote.id) {
        removedLocalIds.add(localRecord.id);
      }
      pulled.set(
        category === "personal_details" ? userId : remote.id,
        mapRemoteRecord(category, remote),
      );
    }
  }

  for (const remote of remoteRows) {
    if (handledRemote.has(remote.id) || tombstoneIds.has(remote.id)) continue;
    if (category === "personal_details") {
      if (!localById.has(userId)) pulled.set(userId, mapRemoteRecord(category, remote));
      continue;
    }
    if (!localById.has(remote.id)) pulled.set(remote.id, mapRemoteRecord(category, remote));
  }

  await upsertRemote(table, localUpserts, category === "personal_details" ? "user_id" : "id");
  if (category === "personal_details") {
    if (pulled.has(userId)) {
      await writeSyncStorage({ [PERSONAL_INFO_KEY]: pulled.get(userId) });
    }
  } else if (
    pulled.size ||
    localUpserts.some((record) => remoteRows.some((row) => row.id === record.id))
  ) {
    const current = await readLocalData();
    const updatedById = new Map(
      current[category]
        .filter((record) => !removedLocalIds.has(record.id))
        .map((record) => [record.id, record]),
    );
    for (const [id, record] of pulled) updatedById.set(id, record);
    await writeLocalRecords(category, [...updatedById.values()]);
  }

  if (!conflicts.some((conflict) => conflict.category === category)) {
    return {
      completed: true,
      resolvedKeys: Object.keys(resolutions).filter((key) => key.startsWith(`${category}:`)),
    };
  }
  return { completed: false, resolvedKeys: [] };
}

export async function syncNow({ force = false } = {}) {
  if (syncInProgress) return { status: "syncing" };
  syncInProgress = true;
  try {
    const session = await getValidSession();
    if (!session) throw new Error("Sign in before syncing.");
    const preferences = await getSyncPreferences(session.userId);
    if (!preferences?.enabled || preferences.paused) {
      if (!force) return { status: "paused" };
    }
    const selectedCategories = Object.keys(CATEGORIES).filter(
      (category) => preferences?.categories?.[category],
    );
    if (!selectedCategories.length) throw new Error("Enable at least one sync category first.");

    await chrome.storage.local.set({
      [SYNC_STATE_KEY]: {
        status: "syncing",
        userId: session.userId,
        startedAt: new Date().toISOString(),
      },
    });
    const conflicts = [];
    const baselines = { ...(preferences.lastSyncedAtByCategory ?? {}) };
    const remainingResolutions = { ...(preferences.resolutions ?? {}) };
    for (const category of selectedCategories) {
      await pushLocalTombstones(category, session.userId);
      const result = await syncRecords(
        category,
        session.userId,
        baselines[category] ?? null,
        remainingResolutions,
        conflicts,
      );
      if (result.completed) {
        baselines[category] = new Date().toISOString();
        for (const key of result.resolvedKeys) delete remainingResolutions[key];
      }
    }

    const { [SYNC_PREFERENCES_KEY]: allPreferences = {} } =
      await chrome.storage.local.get(SYNC_PREFERENCES_KEY);
    const latest = allPreferences[session.userId] ?? preferences;
    const updated = {
      ...latest,
      lastSyncedAtByCategory: baselines,
      resolutions: remainingResolutions,
    };
    await chrome.storage.local.set({
      [SYNC_PREFERENCES_KEY]: { ...allPreferences, [session.userId]: updated },
      [SYNC_STATE_KEY]: {
        status: conflicts.length ? "conflicts" : "synced",
        userId: session.userId,
        lastSyncedAt: new Date().toISOString(),
        conflicts,
      },
    });
    return { status: conflicts.length ? "conflicts" : "synced", conflicts };
  } catch (error) {
    await chrome.storage.local.set({
      [SYNC_STATE_KEY]: {
        status: "needs_attention",
        message: error.message || "Sync failed.",
        updatedAt: new Date().toISOString(),
      },
    });
    throw error;
  } finally {
    syncInProgress = false;
  }
}

export async function resolveSyncConflict(conflictKey, choice) {
  if (!["local", "cloud"].includes(choice)) throw new Error("Select a valid conflict resolution.");
  const session = await getValidSession();
  if (!session) throw new Error("Sign in before resolving conflicts.");
  const { [SYNC_PREFERENCES_KEY]: allPreferences = {} } =
    await chrome.storage.local.get(SYNC_PREFERENCES_KEY);
  const preferences = allPreferences[session.userId];
  if (!preferences) throw new Error("Sync has not been enabled for this account.");
  await chrome.storage.local.set({
    [SYNC_PREFERENCES_KEY]: {
      ...allPreferences,
      [session.userId]: {
        ...preferences,
        resolutions: { ...(preferences.resolutions ?? {}), [conflictKey]: choice },
      },
    },
  });
  return syncNow();
}
