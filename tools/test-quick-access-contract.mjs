import assert from "node:assert/strict";
import test from "node:test";

const bridge = await import("../foundry-module/scripts/quick-access-bridge.mjs");

const IMPORTER_ID = "air-islands-character-importer";
const QA_ID = "fbl-quick-access";

function importedActor({ biography = {}, updates = [] } = {}) {
  return {
    flags: {
      [IMPORTER_ID]: { profile: { biography: {} }, characterId: "char-1" },
      [QA_ID]: { biographyProfile: biography, pilgrimCardProfile: { identity: { name: "OLD" } } }
    },
    getFlag(moduleId, key) {
      return this.flags?.[moduleId]?.[key] ?? null;
    },
    async update(change, options) {
      updates.push({ change, options });
      for (const [path, value] of Object.entries(change)) {
        if (path === `flags.${QA_ID}.pilgrimCardProfile`) this.flags[QA_ID].pilgrimCardProfile = value;
      }
      return this;
    }
  };
}

test("Pilgrim Card projection contains only the fields currently shown by Quick Access", () => {
  const card = bridge.pilgrimCardFromBiography({
    identity: {
      name: "Lucien",
      kin: "Half-Elf",
      kinVariant: "Conquist",
      profession: "Sorcerer",
      issuingCountry: "Sangren",
      origin: "Sirosten",
      religion: "Steel Faith",
      birthDate: { day: 12, month: "Теплорост", year: 850, label: "12 Теплороста 850 П.П." }
    },
    concept: "GM-only concept",
    publicNote: "Visible only in Note",
    portrait: "portrait.webp",
    physical: {
      appearance: "Tall",
      height: "182 cm",
      weight: "74 kg",
      skin: "Pale",
      eyes: "Gray",
      hair: "Black",
      distinguishingMarks: "Scar"
    }
  });

  assert.deepEqual(card, {
    version: 1,
    identity: {
      name: "Lucien",
      kin: "Half-Elf",
      kinVariant: "Conquist",
      issuingCountry: "Sangren",
      birthDate: { day: 12, month: "Теплорост", year: 850, label: "12 Теплороста 850 П.П." }
    },
    physical: {
      appearance: "Tall",
      height: "182 cm",
      weight: "74 kg",
      skin: "Pale",
      eyes: "Gray",
      hair: "Black",
      distinguishingMarks: "Scar"
    }
  });
  assert.equal("portrait" in card, false);
  assert.equal("concept" in card, false);
  assert.equal("publicNote" in card, false);
  assert.equal("profession" in card.identity, false);
});

test("re-import rewrites an already independent Pilgrim Card from the new BIO snapshot", async () => {
  const biography = {
    identity: {
      name: "NEW",
      kin: "Human",
      kinVariant: "",
      issuingCountry: "Sirosten",
      birthDate: { day: 1, month: "Хладоход", year: 860, label: "1 Хладохода 860 П.П." }
    },
    physical: { appearance: "New appearance", eyes: "Green" }
  };
  const actor = importedActor({ biography });
  const calls = [];
  const qa = {
    async savePilgrimCardProfile(target, profile, options) {
      calls.push({ target, profile, options });
      target.flags[QA_ID].pilgrimCardProfile = structuredClone(profile);
      return true;
    }
  };

  assert.equal(actor.flags[QA_ID].pilgrimCardProfile.identity.name, "OLD");
  assert.equal(await bridge.syncImportedPilgrimCard(actor, qa), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].target, actor);
  assert.deepEqual(calls[0].options, { render: false });
  assert.equal(calls[0].profile.identity.name, "NEW");
  assert.equal(actor.flags[QA_ID].pilgrimCardProfile.identity.name, "NEW");
});

test("older Quick Access builds receive the Pilgrim Card flag through the compatibility fallback", async () => {
  const updates = [];
  const actor = importedActor({
    biography: { identity: { name: "Fallback" }, physical: { hair: "Brown" } },
    updates
  });
  const previousGame = globalThis.game;
  globalThis.game = { modules: new Map([[QA_ID, { active: true, api: {} }]]) };
  try {
    assert.equal(await bridge.syncImportedPilgrimCard(actor, {}), true);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].change[`flags.${QA_ID}.pilgrimCardProfile`].identity.name, "Fallback");
  } finally {
    globalThis.game = previousGame;
  }
});

test("a failing Quick Access import subsystem does not block the following subsystems", async () => {
  const actor = importedActor();
  const calls = [];
  const notices = [];
  const api = {
    async saveReputationEntries() {
      calls.push("reputation");
      throw new Error("broken reputation");
    },
    async saveWillpowerTalents() {
      calls.push("willpower");
      return true;
    },
    async saveBiographyProfile() {
      calls.push("biography");
      return true;
    }
  };
  bridge.installQuickAccessImportErrorIsolation(api, { notify: (label) => notices.push(label) });

  const results = [];
  results.push(await api.saveReputationEntries(actor, []));
  results.push(await api.saveWillpowerTalents(actor, {}));
  results.push(await api.saveBiographyProfile(actor, {}));

  assert.deepEqual(results, [false, true, true]);
  assert.deepEqual(calls, ["reputation", "willpower", "biography"]);
  assert.deepEqual(notices, ["Reputation"]);

  const plainActor = { flags: {}, getFlag: () => null };
  await assert.rejects(() => api.saveReputationEntries(plainActor, []), /broken reputation/);
});

test("imported talent ranks are converted to numbers before Foundry persistence", () => {
  const source = {
    type: "talent",
    system: { rank: "5" },
    flags: { [IMPORTER_ID]: { catalogId: "talent.path", kind: "talent" } }
  };
  const updates = [];
  const item = {
    ...source,
    updateSource(change) {
      updates.push(change);
      this.system.rank = change["system.rank"];
    }
  };

  assert.equal(bridge.normalizeImportedTalentRank(item, source), true);
  assert.deepEqual(updates, [{ "system.rank": 5 }]);
  assert.equal(typeof item.system.rank, "number");
});

test("new Actor source talent ranks are normalized even when embedded Item hooks are not emitted", () => {
  const actorSource = {
    flags: { [IMPORTER_ID]: { profile: {}, characterId: "char-2" } },
    items: [
      { type: "talent", system: { rank: "3" }, flags: { [IMPORTER_ID]: { catalogId: "talent.a", kind: "talent" } } },
      { type: "spell", system: { rank: "2" }, flags: { [IMPORTER_ID]: { catalogId: "spell.a", kind: "spell" } } }
    ]
  };
  const actor = {
    updateSource(change) {
      actorSource.items = change.items;
    }
  };

  assert.equal(bridge.normalizeImportedActorTalentRanks(actor, actorSource), 1);
  assert.equal(actorSource.items[0].system.rank, 3);
  assert.equal(typeof actorSource.items[0].system.rank, "number");
  assert.equal(actorSource.items[1].system.rank, "2");
});

test("Pilgrim Card resync is triggered by importer payload changes, not ordinary BIO edits", () => {
  assert.equal(bridge.importerPayloadChanged({ flags: { [IMPORTER_ID]: { profile: {} } } }), true);
  assert.equal(bridge.importerPayloadChanged({ [`flags.${IMPORTER_ID}.profile`]: {} }), true);
  assert.equal(bridge.importerPayloadChanged({ [`flags.${QA_ID}.biographyProfile`]: {} }), false);
  assert.equal(bridge.importerPayloadChanged({ name: "Manual rename" }), false);
});
