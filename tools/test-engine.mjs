import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  calculateAge,
  ageCategoryFor,
  attributeMaximum,
  languageBudget,
  baseXpAllowance,
  languageSelectionCost,
  validateCharacter,
  characterToActorData,
  sanitizeEmbeddedItem,
  indexRules,
  replayCharacter,
  simulateXpTransaction,
  normalizeReputationEntries
} from "../shared/core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const rules = JSON.parse(fs.readFileSync(path.join(root, "data/generated/air-islands-rules.json"), "utf8"));
const sample = JSON.parse(fs.readFileSync(path.join(root, "samples/test-character.json"), "utf8"));
const index = indexRules(rules);

assert.equal(rules.catalogs.talents.package, "world.talents");
assert.equal(rules.catalogs.spells.package, "world.spellscomplete");
assert.equal(rules.catalogs.talents.items.length, 132);
assert.equal(rules.catalogs.spells.items.length, 369);

const monsterHunter = index.professions.get("monster-hunter");
assert.ok(monsterHunter, "Профессия Monster Hunter отсутствует в правилах");
assert.deepEqual(monsterHunter.focus, ["wits"]);
assert.deepEqual(monsterHunter.skills, ["scouting", "lore", "survival", "crafting", "healing"]);
const monsterHunterPaths = rules.catalogs.talents.items.filter(item => item.type === "profession" && item.professions?.includes("monster-hunter"));
assert.equal(monsterHunterPaths.length, 3);
assert.deepEqual(new Set(monsterHunterPaths.map(item => item.pathKey)), new Set(["path-of-dossier", "path-of-arsenal", "path-of-slayer"]));

const stableBrawler = rules.catalogs.talents.items.find(item => item.name === "Brawler");
assert.equal(stableBrawler.catalogId, "talent:world.talentscompendium:LEN92iJ2ec1Dvnvr", "Стабильный catalogId таланта должен переживать замену компендиума");
assert.match(stableBrawler.sourceUuid, /^Compendium\.world\.talents\.Item\./u);
const stableHealingHands = rules.catalogs.spells.items.find(item => item.name === "1 - Healing Hands");
assert.equal(stableHealingHands.catalogId, "spell:world.spells:1FMeoXBcYTThjAfJ", "Стабильный catalogId заклинания должен переживать замену компендиума");
assert.match(stableHealingHands.sourceUuid, /^Compendium\.world\.spellscomplete\.Item\./u);
const physician = rules.catalogs.talents.items.find(item => item.name === "Physician");
assert.ok(physician, "Исправленный талант Physician отсутствует");
assert.equal(physician.catalogId, "talent:world.talentscompendium:NGu6sPct0zaMkYgC", "Исправление Physican → Physician не должно ломать старые файлы");

assert.equal(calculateAge({ year: 852, month: "hladohod", day: 1 }, rules.campaignDate, rules), 30);
assert.equal(calculateAge({ year: 852, month: "teplorost", day: 1 }, rules.campaignDate, rules), 29);
assert.equal(ageCategoryFor(index.kin.get("human"), 25), "young");
assert.equal(ageCategoryFor(index.kin.get("human"), 26), "adult");
assert.equal(ageCategoryFor(index.kin.get("human"), 51), "old");

assert.equal(attributeMaximum("strength", sample, rules), 6, "Гвирл + Fighter дают двойной фокус STR");
assert.equal(attributeMaximum("agility", sample, rules), 4);

const bullet = rules.catalogs.talents.items.find(item => item.pathKey === "path-of-bullet");
const additionalBulletCharacter = structuredClone(sample);
additionalBulletCharacter.experience.baseTotal += 5;
const blockedAdditionalPath = simulateXpTransaction(additionalBulletCharacter, rules, { type: "talent", catalogId: bullet.catalogId, toRank: 1 });
assert.equal(blockedAdditionalPath.valid, false);
assert.equal(blockedAdditionalPath.issue.code, "XP_ADDITIONAL_PATH_FORBIDDEN");
assert.equal(attributeMaximum("agility", additionalBulletCharacter, rules), 4, "Не выбранный первым Path не даёт условный фокус");

const bulletCharacter = structuredClone(sample);
bulletCharacter.creation.initialPathCatalogId = bullet.catalogId;
bulletCharacter.creation.ageTalentLedger = [];
bulletCharacter.experience.ledger = [];
assert.equal(attributeMaximum("agility", bulletCharacter, rules), 5, "Первый Path of the Bullet добавляет Fighter фокус AGI");

const monsterHunterCharacter = structuredClone(sample);
monsterHunterCharacter.identity.professionId = "monster-hunter";
monsterHunterCharacter.creation.initialPathCatalogId = monsterHunterPaths.find(item => item.pathKey === "path-of-dossier").catalogId;
monsterHunterCharacter.creation.ageTalentLedger = [];
monsterHunterCharacter.experience.ledger = [];
assert.equal(attributeMaximum("wits", monsterHunterCharacter, rules), 5, "Monster Hunter даёт профессиональный фокус WIT");
monsterHunterCharacter.skills = Object.fromEntries(rules.skills.map(skill => [skill.id, { startingRank: 0 }]));
for (const [skillId, rank] of Object.entries({ scouting: 3, lore: 2, survival: 2, crafting: 2, healing: 2 })) {
  monsterHunterCharacter.skills[skillId].startingRank = rank;
}
monsterHunterCharacter.creation.ageTalentLedger = structuredClone(sample.creation.ageTalentLedger);
monsterHunterCharacter.experience = { baseTotal: 0, ledger: [] };
const monsterHunterValidation = validateCharacter(monsterHunterCharacter, rules);
assert.equal(monsterHunterValidation.valid, true, JSON.stringify(monsterHunterValidation.errors, null, 2));

const oldElf = structuredClone(sample);
oldElf.identity.kinId = "elf";
oldElf.identity.kinVariantId = "arkandar";
oldElf.identity.kinFocus = null;
oldElf.identity.birthDate = { year: 761, month: "hladohod", day: 1 };
assert.equal(attributeMaximum("strength", oldElf, rules), 2);
assert.equal(attributeMaximum("agility", oldElf, rules), 2);

const oldOrc = structuredClone(sample);
oldOrc.identity.kinId = "orc";
oldOrc.identity.kinVariantId = "common";
oldOrc.identity.birthDate = { year: 844, month: "hladohod", day: 1 };
assert.equal(attributeMaximum("strength", oldOrc, rules), 3);

const replay = replayCharacter(sample, rules);
assert.equal(replay.ageTalents.spent, 2);
assert.equal(replay.final.skills.move, 3);
assert.equal(replay.final.xpSpent, 25);
assert.equal(replay.final.xpBudget, 25);
assert.equal(replay.final.xpRemaining, 0);
assert.equal(replay.final.talents.find(entry => entry.catalogId === sample.creation.ageTalentLedger[0].catalogId)?.rank, 3);

assert.equal(baseXpAllowance(sample), 25);
const roundedXp = structuredClone(sample);
roundedXp.experience.baseTotal = 101;
assert.equal(baseXpAllowance(roundedXp), 21, "20% Base XP округляются вверх");
const legacyXp = structuredClone(sample);
legacyXp.formatVersion = 5;
legacyXp.experience.baseTotal = 25;
assert.equal(baseXpAllowance(legacyXp), 25, "Старый формат сохраняет прежний бюджет при прямой проверке");
assert.equal(languageBudget(sample), 1);
const languageXpCheck = structuredClone(sample);
languageXpCheck.experience.baseTotal = 500;
languageXpCheck.experience.ledger = [{ type: "skill", skillId: "lore", toRank: 1 }];
assert.equal(replayCharacter(languageXpCheck, rules).final.skills.lore, 1);
assert.equal(languageBudget(languageXpCheck), 1, "Покупка Lore за XP не увеличивает очки языков");
assert.equal(languageSelectionCost({ languageId: "damian", level: "full", native: true }, sample, rules), 1);
assert.equal(languageSelectionCost({ languageId: "damian", level: "basic", native: true }, sample, rules), 0);

const result = validateCharacter(sample, rules);
assert.equal(result.valid, true, JSON.stringify(result.errors, null, 2));
assert.equal(result.derived.age, 30);
assert.equal(result.derived.ageCategory, "adult");
assert.equal(result.derived.xpSpent, 25);

const { actorData, items } = characterToActorData(sample, rules);
assert.equal(actorData.type, "character");
assert.equal(actorData.system.attribute.strength.value, 4);
assert.equal(actorData.system.skill.move.value, 3);
assert.equal(actorData.system.bio.experience.value, 0);
assert.equal(actorData.system.currency.silver.value, 0);
assert.ok(items.length >= 3);
assert.ok(items.every(item => !("_id" in item) && !("folder" in item) && !("_stats" in item) && !("ownership" in item)));
assert.match(actorData.system.bio.body.value, /Слухи/u);
assert.match(actorData.system.bio.body.value, /Запросы ГМу/u);
assert.match(actorData.system.bio.body.value, /Никерий/u);
assert.match(actorData.system.bio.body.value, /<strong><em>Рост:<\/em><\/strong>/u);
assert.doesNotMatch(actorData.system.bio.body.value, /<dt>/u);
assert.match(actorData.system.bio.note.value, /Сдержанный бывший стражник/u);
assert.deepEqual(actorData.flags["fbl-quick-access"].reputationEntries, [
  { id: "rep-city-guard", amount: 1, description: "Известен как надёжный участник городской стражи.", location: "Никерий" }
]);
assert.match(actorData.system.bio.body.value, /Никерий/u);
const legacyReputation = normalizeReputationEntries({ origins: ["Старая запись"] });
assert.deepEqual(legacyReputation, [{ id: "rep-1", amount: 1, description: "Старая запись", location: "" }]);

const effectSnapshotV13 = {
  name: "Effect Test",
  type: "talent",
  system: { rank: "1" },
  effects: [{ name: "Bonus", changes: [{ key: "system.test", mode: 2, value: "1" }] }]
};
const effectV14 = sanitizeEmbeddedItem(effectSnapshotV13, 2, 14);
assert.equal(effectV14.system.rank, "2");
assert.equal(effectV14.effects[0].changes, undefined);
assert.deepEqual(effectV14.effects[0].system.changes, effectSnapshotV13.effects[0].changes);
const effectV13 = sanitizeEmbeddedItem(effectV14, null, 13);
assert.deepEqual(effectV13.effects[0].changes, effectSnapshotV13.effects[0].changes);
assert.equal(effectV13.effects[0].system, undefined);

const invalidRumors = structuredClone(sample);
invalidRumors.biography.rumors.pop();
const invalidRumorResult = validateCharacter(invalidRumors, rules);
assert.equal(invalidRumorResult.valid, false);
assert.ok(invalidRumorResult.errors.some(error => error.code === "RUMOR_COUNT"));

const invalidRequest = structuredClone(sample);
invalidRequest.gmRequests[0].description = "";
const invalidRequestResult = validateCharacter(invalidRequest, rules);
assert.equal(invalidRequestResult.valid, false);
assert.ok(invalidRequestResult.errors.some(error => error.code === "GM_REQUEST_DESCRIPTION"));

const invalidReputationTotal = structuredClone(sample);
invalidReputationTotal.reputation.entries[0].amount = 2;
const invalidReputationTotalResult = validateCharacter(invalidReputationTotal, rules);
assert.equal(invalidReputationTotalResult.valid, false);
assert.ok(invalidReputationTotalResult.errors.some(error => error.code === "REPUTATION_TOTAL"));

const invalidReputationDescription = structuredClone(sample);
invalidReputationDescription.reputation.entries[0].description = "";
const invalidReputationDescriptionResult = validateCharacter(invalidReputationDescription, rules);
assert.equal(invalidReputationDescriptionResult.valid, false);
assert.ok(invalidReputationDescriptionResult.errors.some(error => error.code === "REPUTATION_DESCRIPTION"));

const invalid = structuredClone(sample);
invalid.attributes.strength = 7;
const invalidResult = validateCharacter(invalid, rules);
assert.equal(invalidResult.valid, false);
assert.ok(invalidResult.errors.some(error => error.code === "ATTRIBUTE_MAX"));

assert.throws(() => characterToActorData(invalid, rules), /Нельзя создать Actor/u);
const forcedInvalid = characterToActorData(invalid, rules, { allowInvalid: true, foundryGeneration: 13 });
assert.equal(forcedInvalid.actorData.system.attribute.strength.value, 7, "Принудительный импорт сохраняет исходное значение характеристики");
assert.equal(forcedInvalid.actorData.flags["air-islands-character-importer"].audit.forcedImport, true);
assert.ok(forcedInvalid.actorData.flags["air-islands-character-importer"].audit.validationErrors.some(error => error.code === "ATTRIBUTE_MAX"));

const severelyInvalid = structuredClone(sample);
severelyInvalid.identity.name = "";
severelyInvalid.identity.kinId = "missing-kin";
severelyInvalid.identity.professionId = "missing-profession";
severelyInvalid.identity.birthDate = null;
severelyInvalid.attributes.wits = null;
const forcedSevere = characterToActorData(severelyInvalid, rules, { allowInvalid: true, foundryGeneration: 14 });
assert.equal(forcedSevere.actorData.name, "Без имени");
assert.equal(forcedSevere.actorData.system.bio.kin.value, "missing-kin");
assert.equal(forcedSevere.actorData.system.bio.profession.value, "missing-profession");
assert.equal(forcedSevere.actorData.system.attribute.wits.value, 0);

const noAge = structuredClone(sample);
noAge.creation.ageTalentLedger = [];
noAge.experience.ledger = [];
const blocked = simulateXpTransaction(noAge, rules, { type: "skill", skillId: "move", toRank: 3 });
assert.equal(blocked.valid, false);
assert.equal(blocked.issue.code, "AGE_TALENT_UNSPENT");

const surchargeCharacter = structuredClone(sample);
surchargeCharacter.experience.baseTotal = 500;
surchargeCharacter.experience.ledger = [];
const generalTalents = rules.catalogs.talents.items.filter(item => item.type === "general" && item.catalogId !== sample.creation.ageTalentLedger[0].catalogId).slice(0, 2);
for (const talent of generalTalents) {
  const currentReplay = replayCharacter(surchargeCharacter, rules);
  const simulation = simulateXpTransaction(surchargeCharacter, rules, { type: "talent", catalogId: talent.catalogId, toRank: 1 });
  assert.equal(simulation.valid, true, simulation.issue?.message);
  surchargeCharacter.experience.ledger.push({ type: "talent", catalogId: talent.catalogId, toRank: 1 });
  assert.ok(currentReplay.final.talents.length >= 3);
}
const sixth = rules.catalogs.talents.items.find(item => item.type === "general" && !surchargeCharacter.experience.ledger.some(tx => tx.catalogId === item.catalogId) && item.catalogId !== sample.creation.ageTalentLedger[0].catalogId);
const sixthSim = simulateXpTransaction(surchargeCharacter, rules, { type: "talent", catalogId: sixth.catalogId, toRank: 1 });
assert.equal(sixthSim.valid, true);
assert.equal(sixthSim.breakdown.surcharge, 1, "Шестой отдельный талант получает +1 XP до множителей");


const deathPath = rules.catalogs.talents.items.find(item => item.pathKey === "path-of-death");
const mage = structuredClone(sample);
mage.identity.professionId = "sorcerer";
mage.creation.initialPathCatalogId = deathPath.catalogId;
mage.creation.ageTalentLedger = [{ id: "age-death-2", type: "talent", catalogId: deathPath.catalogId, toRank: 2 }];
mage.experience.baseTotal = 500;
mage.experience.ledger = [];
const startingPool = rules.catalogs.spells.items.filter(item => ["General Spells", "Death Magic"].includes(item.discipline) && [1, 2].includes(item.rank));
mage.creation.startingSpells = [
  ...startingPool.filter(item => item.rank === 1).slice(0, 5),
  ...startingPool.filter(item => item.rank === 2).slice(0, 4)
].map(item => item.catalogId);
const mageReplay = replayCharacter(mage, rules);
assert.equal(mageReplay.startingSpells.actualTotal, 9);
assert.equal(mageReplay.startingSpells.maximumTotal, 9);
assert.equal(mageReplay.startingSpells.issues.length, 0, JSON.stringify(mageReplay.startingSpells.issues));
const underfilledMage = structuredClone(mage);
underfilledMage.creation.startingSpells = underfilledMage.creation.startingSpells.slice(0, 2);
assert.equal(replayCharacter(underfilledMage, rules).startingSpells.issues.length, 0, "Незаполненные бесплатные слоты не должны блокировать экспорт");

const fifthRank2 = startingPool.filter(item => item.rank === 2)[4];
const buyFifthRank2 = simulateXpTransaction(mage, rules, { type: "spell", catalogId: fifthRank2.catalogId });
assert.equal(buyFifthRank2.valid, true, buyFifthRank2.issue?.message);
mage.experience.ledger.push({ type: "spell", catalogId: fifthRank2.catalogId });
const sixthRank2 = startingPool.filter(item => item.rank === 2)[5];
const blockSixthRank2 = simulateXpTransaction(mage, rules, { type: "spell", catalogId: sixthRank2.catalogId });
assert.equal(blockSixthRank2.valid, false);
assert.equal(blockSixthRank2.issue.code, "XP_SPELL_LIMIT");

const prematurePath = simulateXpTransaction(mage, rules, { type: "talent", catalogId: deathPath.catalogId, toRank: 3 });
assert.equal(prematurePath.valid, false);
assert.equal(prematurePath.issue.code, "XP_MAGIC_PATH_PREREQUISITE");
const deathRank3 = rules.catalogs.spells.items.find(item => item.discipline === "Death Magic" && item.rank === 3);
const learnRank3 = simulateXpTransaction(mage, rules, { type: "spell", catalogId: deathRank3.catalogId });
assert.equal(learnRank3.valid, true, learnRank3.issue?.message);
assert.equal(learnRank3.cost, 3);
mage.experience.ledger.push({ type: "spell", catalogId: deathRank3.catalogId });
const raiseDeath = simulateXpTransaction(mage, rules, { type: "talent", catalogId: deathPath.catalogId, toRank: 3 });
assert.equal(raiseDeath.valid, true, raiseDeath.issue?.message);
assert.equal(raiseDeath.cost, 20, "Магический Profession Talent Rank 3 стоит 10 ×2 без надбавки");

console.log("All rule-engine tests passed.");
