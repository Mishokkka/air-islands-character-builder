import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const bridge = await import("../foundry-module/scripts/quick-access-bridge.mjs");

const QA_ID = "fbl-quick-access";

function actorStub() {
  const updates = [];
  return {
    updates,
    async update(change, options) {
      updates.push({ change: structuredClone(change), options: structuredClone(options) });
      return this;
    }
  };
}

test("Pilgrim Card projection contains only fields used by the current Quick Access card", () => {
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

test("frozen Quick Access API is never mutated and one failing subsystem does not block the others", async () => {
  const actor = actorStub();
  const calls = [];
  const notices = [];
  const reputation = async () => {
    calls.push("reputation");
    throw new Error("broken reputation");
  };
  const willpower = async () => { calls.push("willpower"); return true; };
  const biography = async () => { calls.push("biography"); return true; };
  const pilgrimCard = async () => { calls.push("pilgrimCard"); return true; };
  const api = Object.freeze({
    saveReputationEntries: reputation,
    saveWillpowerTalents: willpower,
    saveBiographyProfile: biography,
    savePilgrimCardProfile: pilgrimCard
  });

  const originalWarn = console.warn;
  let result;
  console.warn = () => undefined;
  try {
    result = await bridge.applyQuickAccessImport({
      actor,
      quickAccess: api,
      reputationEntries: [{ id: "rep-1", amount: 1, description: "Test", location: "Test" }],
      selection: { kinTalentId: "kin", professionalTalentId: "profession" },
      biographyProfile: { identity: { name: "Frozen API" }, physical: {} },
      notify: (label) => notices.push(label)
    });
  } finally {
    console.warn = originalWarn;
  }

  assert.deepEqual(result, {
    reputation: false,
    willpower: true,
    biography: true,
    pilgrimCard: true
  });
  assert.deepEqual(calls, ["reputation", "willpower", "biography", "pilgrimCard"]);
  assert.deepEqual(notices, ["Reputation"]);
  assert.equal(Object.isFrozen(api), true);
  assert.equal(api.saveReputationEntries, reputation);
  assert.equal(api.saveWillpowerTalents, willpower);
  assert.equal(api.saveBiographyProfile, biography);
  assert.equal(api.savePilgrimCardProfile, pilgrimCard);
});

test("Quick Access compatibility fallbacks write all four sections without an API", async () => {
  const actor = actorStub();
  const reputationEntries = [{ id: "rep-1", amount: 2, description: "A", location: "B" }];
  const selection = { kinTalentId: "kin", professionalTalentId: "profession" };
  const biographyProfile = {
    identity: { name: "Fallback", kin: "Human", issuingCountry: "Sirosten" },
    physical: { hair: "Brown" }
  };

  const result = await bridge.applyQuickAccessImport({ actor, reputationEntries, selection, biographyProfile });

  assert.deepEqual(result, {
    reputation: true,
    willpower: true,
    biography: true,
    pilgrimCard: true
  });
  assert.equal(actor.updates.length, 4);
  assert.deepEqual(actor.updates[0].change[`flags.${QA_ID}.reputationEntries`], reputationEntries);
  assert.equal(actor.updates[0].change["system.bio.reputation.value"], 2);
  assert.deepEqual(actor.updates[1].change[`flags.${QA_ID}.willpowerTalents`], selection);
  assert.deepEqual(actor.updates[2].change[`flags.${QA_ID}.biographyProfile`], biographyProfile);
  assert.equal(actor.updates[3].change[`flags.${QA_ID}.pilgrimCardProfile`].identity.name, "Fallback");
});

test("bridge contains no global Quick Access API monkey-patch or Foundry hook registration", async () => {
  const source = await readFile(new URL("../foundry-module/scripts/quick-access-bridge.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /api\s*\[\s*methodName\s*\]\s*=/);
  assert.doesNotMatch(source, /WRAPPED_SAVE/);
  assert.doesNotMatch(source, /fblQuickAccess\.apiReady/);
  assert.doesNotMatch(source, /Hooks\.(?:on|once)/);
  assert.match(source, /Object\.freeze|applyQuickAccessImport|savePilgrimCardProfile/);
});

test("main importer delegates Quick Access persistence to the isolated call-site helper", async () => {
  const source = await readFile(new URL("../foundry-module/scripts/main.mjs", import.meta.url), "utf8");
  assert.match(source, /import\s*\{\s*applyQuickAccessImport\s*\}\s*from\s*["']\.\/quick-access-bridge\.mjs["']/);
  assert.match(source, /await\s+applyQuickAccessImport\s*\(\s*\{[\s\S]*?actor,[\s\S]*?quickAccess,[\s\S]*?reputationEntries,[\s\S]*?selection,[\s\S]*?biographyProfile[\s\S]*?\}\s*\)/);
  assert.doesNotMatch(source, /Quick Access integration failed/);
});

test("both core copies persist numeric talent ranks and send rumor text plus hidden truth without source name", async () => {
  const sources = await Promise.all([
    readFile(new URL("../shared/core.mjs", import.meta.url), "utf8"),
    readFile(new URL("../foundry-module/scripts/core.mjs", import.meta.url), "utf8")
  ]);
  for (const source of sources) {
    assert.match(source, /const numericRank = Number\(rank\);[\s\S]*?Number\.isFinite\(numericRank\)[\s\S]*?item\.system\.rank = numericRank/);
    const profileStart = source.indexOf("export function characterToQuickAccessBiographyProfile");
    const profileEnd = source.indexOf("export function characterToActorData", profileStart);
    const profileSource = source.slice(profileStart, profileEnd);
    assert.match(profileSource, /rumors:[\s\S]*?text:[\s\S]*?truth:/);
    assert.doesNotMatch(profileSource, /name:\s*String\(entry\?\.(?:name|characterName|source)/);
  }
});

test("Foundry manifest loads the bridge only through main.mjs", async () => {
  const manifest = JSON.parse(await readFile(new URL("../foundry-module/module.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.esmodules, ["scripts/main.mjs"]);
});
