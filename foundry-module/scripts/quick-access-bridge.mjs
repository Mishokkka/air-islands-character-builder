const IMPORTER_ID = "air-islands-character-importer";
const QUICK_ACCESS_ID = "fbl-quick-access";

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

export async function applyQuickAccessImport({
  actor,
  quickAccess = null,
  reputationEntries = [],
  selection = {},
  biographyProfile = {},
  notify = notifyQuickAccessFailure
} = {}) {
  if (!actor?.update) {
    return {
      reputation: false,
      willpower: false,
      biography: false,
      pilgrimCard: false
    };
  }

  const pilgrimCardProfile = pilgrimCardFromBiography(biographyProfile);
  const results = {};
  const steps = [
    {
      key: "reputation",
      label: "Reputation",
      run: async () => {
        if (typeof quickAccess?.saveReputationEntries === "function") {
          return quickAccess.saveReputationEntries(actor, reputationEntries, { render: false });
        }
        return actor.update({
          [`flags.${QUICK_ACCESS_ID}.reputationEntries`]: reputationEntries,
          "system.bio.reputation.value": reputationEntries.reduce((sum, entry) => sum + Number(entry?.amount ?? 0), 0)
        }, { render: false });
      }
    },
    {
      key: "willpower",
      label: "стартовый Willpower",
      run: async () => {
        if (typeof quickAccess?.saveWillpowerTalents === "function") {
          return quickAccess.saveWillpowerTalents(actor, selection, { render: false });
        }
        return actor.update({
          [`flags.${QUICK_ACCESS_ID}.willpowerTalents`]: selection
        }, { render: false });
      }
    },
    {
      key: "biography",
      label: "BIO",
      run: async () => {
        if (typeof quickAccess?.saveBiographyProfile === "function") {
          return quickAccess.saveBiographyProfile(actor, biographyProfile, { render: false });
        }
        return actor.update({
          [`flags.${QUICK_ACCESS_ID}.biographyProfile`]: biographyProfile
        }, { render: false });
      }
    },
    {
      key: "pilgrimCard",
      label: "Карта пилигрима",
      run: async () => {
        if (typeof quickAccess?.savePilgrimCardProfile === "function") {
          return quickAccess.savePilgrimCardProfile(actor, pilgrimCardProfile, { render: false });
        }
        return actor.update({
          [`flags.${QUICK_ACCESS_ID}.pilgrimCardProfile`]: pilgrimCardProfile
        }, { render: false });
      }
    }
  ];

  for (const step of steps) {
    try {
      await step.run();
      results[step.key] = true;
    } catch (error) {
      results[step.key] = false;
      console.warn(`${IMPORTER_ID} | Quick Access ${step.key} import failed`, error);
      notify(step.label, error);
    }
  }

  return results;
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
