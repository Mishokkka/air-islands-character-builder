const IMPORTER_ID = "air-islands-character-importer";
const QUICK_ACCESS_ID = "fbl-quick-access";
const QUICK_ACCESS_BIO_FLAG = "biographyProfile";
const QUICK_ACCESS_PILGRIM_FLAG = "pilgrimCardProfile";
const WRAPPED_SAVE = Symbol.for("air-islands-character-importer.quick-access-save-wrapper");
const PILGRIM_SYNC_QUEUES = new WeakMap();

const QUICK_ACCESS_SAVE_LABELS = Object.freeze({
  saveReputationEntries: "Reputation",
  saveWillpowerTalents: "стартовый Willpower",
  saveBiographyProfile: "BIO"
});

export function pilgrimCardFromBiography(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const identity = source.identity && typeof source.identity === "object" ? source.identity : {};
  const physical = source.physical && typeof source.physical === "object" ? source.physical : {};

  return {
    version: 1,
    identity: {
      name: String(identity.name ?? source.name ?? ""),
      kin: String(identity.kin ?? ""),
      kinVariant: String(identity.kinVariant ?? identity.subrace ?? ""),
      issuingCountry: String(identity.issuingCountry ?? identity.country ?? identity.citizenship ?? ""),
      birthDate: normalizeBirthDate(identity.birthDate)
    },
    physical: {
      appearance: String(physical.appearance ?? source.appearance ?? ""),
      height: String(physical.height ?? ""),
      weight: String(physical.weight ?? ""),
      skin: String(physical.skin ?? ""),
      eyes: String(physical.eyes ?? ""),
      hair: String(physical.hair ?? ""),
      distinguishingMarks: String(physical.distinguishingMarks ?? physical.marks ?? "")
    }
  };
}

export async function syncImportedPilgrimCard(actor, quickAccess = getQuickAccessApi()) {
  if (!actor?.update || !isImportedActor(actor)) return false;

  const biography = readActorFlag(actor, QUICK_ACCESS_ID, QUICK_ACCESS_BIO_FLAG);
  if (!biography || typeof biography !== "object") return false;
  const profile = pilgrimCardFromBiography(biography);

  if (typeof quickAccess?.savePilgrimCardProfile === "function") {
    await quickAccess.savePilgrimCardProfile(actor, profile, { render: false });
    return true;
  }

  const quickAccessModule = globalThis.game?.modules?.get?.(QUICK_ACCESS_ID);
  if (!quickAccessModule?.active && !quickAccessModule?.api) return false;

  await actor.update({
    [`flags.${QUICK_ACCESS_ID}.${QUICK_ACCESS_PILGRIM_FLAG}`]: profile
  }, { render: false });
  return true;
}

export function installQuickAccessImportErrorIsolation(api, { notify = notifyQuickAccessFailure } = {}) {
  if (!api || typeof api !== "object") return false;
  let changed = false;

  for (const [methodName, label] of Object.entries(QUICK_ACCESS_SAVE_LABELS)) {
    const original = api[methodName];
    if (typeof original !== "function" || original[WRAPPED_SAVE]) continue;

    const wrapped = async function (...args) {
      try {
        return await original.apply(this, args);
      } catch (error) {
        const actor = args[0];
        if (!isImportedActor(actor)) throw error;
        console.warn(`${IMPORTER_ID} | Quick Access ${methodName} failed during character import`, error);
        notify(label, error);
        return false;
      }
    };
    Object.defineProperty(wrapped, WRAPPED_SAVE, { value: true });
    api[methodName] = wrapped;
    changed = true;
  }

  return changed;
}

export function normalizeImportedTalentRank(item, source = null) {
  if (!item) return false;
  const raw = source && typeof source === "object" ? source : item?._source ?? item;
  if (!isImporterTaggedItem(raw) && !isImporterTaggedItem(item)) return false;
  if (String(raw?.type ?? item?.type ?? "") !== "talent") return false;

  const rank = raw?.system?.rank ?? item?.system?.rank;
  if (rank === null || rank === undefined || String(rank).trim() === "") return false;
  const numericRank = Number(rank);
  if (!Number.isFinite(numericRank)) return false;

  if (typeof item.updateSource === "function") {
    item.updateSource({ "system.rank": numericRank });
    return true;
  }

  if (raw?.system && typeof raw.system === "object") {
    raw.system.rank = numericRank;
    return true;
  }
  return false;
}

export function normalizeImportedActorTalentRanks(actor, source = null) {
  const raw = source && typeof source === "object" ? source : actor?._source ?? actor;
  if (!hasImporterFlag(raw) && !hasImporterFlag(actor)) return 0;

  let changed = 0;
  if (actor?.items && Symbol.iterator in Object(actor.items)) {
    for (const item of actor.items) changed += normalizeImportedTalentRank(item) ? 1 : 0;
    if (changed > 0) return changed;
  }

  if (!Array.isArray(raw?.items) || typeof actor?.updateSource !== "function") return changed;
  const items = raw.items.map((item) => {
    if (!isImporterTaggedItem(item) || String(item?.type ?? "") !== "talent") return item;
    const rank = item?.system?.rank;
    if (rank === null || rank === undefined || String(rank).trim() === "") return item;
    const numericRank = Number(rank);
    if (!Number.isFinite(numericRank) || numericRank === rank) return item;
    changed += 1;
    return {
      ...item,
      system: {
        ...(item.system ?? {}),
        rank: numericRank
      }
    };
  });
  if (changed > 0) actor.updateSource({ items });
  return changed;
}

export function importerPayloadChanged(changes = {}) {
  if (!changes || typeof changes !== "object") return false;
  if (Object.hasOwn(changes, `flags.${IMPORTER_ID}`)) return true;
  if (Object.keys(changes).some((key) => key.startsWith(`flags.${IMPORTER_ID}.`))) return true;
  return Boolean(changes.flags && typeof changes.flags === "object" && Object.hasOwn(changes.flags, IMPORTER_ID));
}

function registerHooks() {
  const Hooks = globalThis.Hooks;
  if (!Hooks?.on) return;

  Hooks.on("fblQuickAccess.apiReady", (api) => {
    installQuickAccessImportErrorIsolation(api);
  });

  Hooks.on("preCreateActor", (actor, data) => {
    normalizeImportedActorTalentRanks(actor, data);
  });

  Hooks.on("preCreateItem", (item, data) => {
    normalizeImportedTalentRank(item, data);
  });

  Hooks.on("createActor", (actor) => {
    if (isImportedActor(actor)) queuePilgrimSync(actor);
  });

  Hooks.on("updateActor", (actor, changes) => {
    if (isImportedActor(actor) && importerPayloadChanged(changes)) queuePilgrimSync(actor);
  });

  Hooks.once?.("ready", () => {
    installQuickAccessImportErrorIsolation(getQuickAccessApi());
  });
}

function queuePilgrimSync(actor) {
  const previous = PILGRIM_SYNC_QUEUES.get(actor) ?? Promise.resolve();
  const current = previous
    .catch(() => undefined)
    .then(() => syncImportedPilgrimCard(actor))
    .catch((error) => {
      console.warn(`${IMPORTER_ID} | Quick Access Pilgrim Card synchronization failed`, error);
      notifyQuickAccessFailure("Карта пилигрима", error);
      return false;
    });
  PILGRIM_SYNC_QUEUES.set(actor, current);
  current.finally(() => {
    if (PILGRIM_SYNC_QUEUES.get(actor) === current) PILGRIM_SYNC_QUEUES.delete(actor);
  });
  return current;
}

function getQuickAccessApi() {
  return globalThis.game?.modules?.get?.(QUICK_ACCESS_ID)?.api ?? null;
}

function isImportedActor(actor) {
  if (!actor) return false;
  if (hasImporterFlag(actor)) return true;
  return Boolean(readActorFlag(actor, IMPORTER_ID, "profile"));
}

function hasImporterFlag(value) {
  const flags = value?.flags ?? value?._source?.flags;
  const importer = flags?.[IMPORTER_ID];
  return Boolean(importer && typeof importer === "object" && (importer.profile || importer.characterId || importer.importedAt));
}

function isImporterTaggedItem(value) {
  const flags = value?.flags ?? value?._source?.flags;
  const importer = flags?.[IMPORTER_ID];
  return Boolean(importer && typeof importer === "object" && (importer.catalogId || importer.kind));
}

function readActorFlag(actor, moduleId, key) {
  try {
    const value = actor?.getFlag?.(moduleId, key);
    if (value !== undefined) return value;
  } catch (_error) {
    // Reading a raw flag keeps the importer tolerant of disabled/older modules.
  }
  return actor?.flags?.[moduleId]?.[key] ?? actor?._source?.flags?.[moduleId]?.[key] ?? null;
}

function normalizeBirthDate(value) {
  if (value && typeof value === "object") {
    return {
      day: Number(value.day) || 0,
      month: String(value.month ?? ""),
      year: Number(value.year) || 0,
      label: String(value.label ?? "")
    };
  }
  return { day: 0, month: "", year: 0, label: String(value ?? "") };
}

function notifyQuickAccessFailure(label) {
  globalThis.ui?.notifications?.warn?.(`Персонаж импортирован, но Quick Access не смог записать раздел «${label}». Остальные разделы импорта продолжены.`);
}

registerHooks();
