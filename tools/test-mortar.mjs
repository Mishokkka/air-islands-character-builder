import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ageCategoryFor,
  attributeMaximum,
  characterToActorData,
  indexRules,
  replayCharacter,
  simulateXpTransaction,
  validateCharacter
} from "../shared/mortar-core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const rules = JSON.parse(fs.readFileSync(path.join(root, "data/generated/air-islands-rules.json"), "utf8"));
const sample = JSON.parse(fs.readFileSync(path.join(root, "samples/test-character.json"), "utf8"));
const index = indexRules(rules);
const mortarKin = index.kin.get("mortar");
assert.ok(mortarKin, "Раса Мортар отсутствует");
assert.equal(ageCategoryFor(mortarKin, 500), "mortar");
assert.equal(rules.ageCategories.mortar.attributePoints, 13);
assert.equal(rules.ageCategories.mortar.skillPoints, 10);
assert.equal(rules.ageCategories.mortar.talentPoints, 0);
assert.equal(mortarKin.summary, "Загадочный пробужденный механизм с разумным интеллектуальным ядром. Во многих частях мира мортары считаются плохим предзнаменованием, в других - интересными механизмами, в третьих - врагами народа. Мортар не выбирает профессию, начинает с Recovery Protocol Rank 1 и развивает Operational Protocols вместо Professional Paths.");

const body = rules.catalogs.talents.items.find(entry => entry.builderRole === "mortar-body");
const recovery = rules.catalogs.talents.items.find(entry => entry.builderRole === "mortar-recovery");
const operational = rules.catalogs.talents.items.filter(entry => entry.builderRole === "mortar-operational");
const calibrations = rules.catalogs.talents.items.filter(entry => entry.builderRole === "mortar-attribute");
assert.ok(body, "Механическое Тело отсутствует");
assert.equal(body.name, "Механическое Тело");
assert.equal(body.maximumRank, 1, "Механическое Тело не должно прокачиваться");
assert.match(body.snapshot.system.description, /не нужны пища, вода, сон, дыхание/u);
assert.ok(recovery, "Recovery Protocol отсутствует");
assert.doesNotMatch(recovery.snapshot.system.description, /МЕХАНИЧЕСКОЕ ТЕЛО/u, "Пассивные свойства тела не должны оставаться внутри Recovery Protocol");
assert.equal(operational.length, 5);
assert.equal(calibrations.length, 12);
assert.equal(mortarKin.talentCatalogId, recovery.catalogId);

const mortar = structuredClone(sample);
mortar.identity.kinId = "mortar";
mortar.identity.kinVariantId = null;
mortar.identity.kinFocus = null;
mortar.identity.professionId = "";
mortar.creation.initialPathCatalogId = null;
mortar.creation.ageTalentLedger = [];
mortar.creation.startingSpells = [];
mortar.creation.mortar = { killerRoll: 2, defectRoll: 11 };
mortar.attributes = { strength: 4, agility: 3, wits: 3, empathy: 3 };
mortar.skills = Object.fromEntries(rules.skills.map(skill => [skill.id, { startingRank: 0 }]));
for (const skillId of ["might", "endurance", "melee", "crafting", "scouting"]) mortar.skills[skillId].startingRank = 2;
mortar.experience = { baseTotal: 1000, ledger: [] };
mortar.reputation = { entries: [] };

assert.equal(attributeMaximum("strength", mortar, rules), 6);
assert.equal(attributeMaximum("empathy", mortar, rules), 6);
let validation = validateCharacter(mortar, rules);
assert.equal(validation.valid, true, JSON.stringify(validation.errors, null, 2));
let replay = replayCharacter(mortar, rules);
assert.equal(replay.final.talents.find(entry => entry.catalogId === body.catalogId)?.rank, 1, "Механическое Тело должно выдаваться каждому мортару автоматически");
assert.equal(replay.final.talents.find(entry => entry.catalogId === recovery.catalogId)?.rank, 1);
assert.equal(replay.final.xpSpent, 0);
const bodyUpgrade = simulateXpTransaction(mortar, rules, { type: "talent", catalogId: body.catalogId, toRank: 2 });
assert.equal(bodyUpgrade.valid, false, "Механическое Тело нельзя повышать");
assert.equal(bodyUpgrade.issue?.code, "MORTAR_BODY_FIXED");

const killerMortar = structuredClone(mortar);
killerMortar.creation.mortar = { killerRoll: 1, defectRoll: 11 };
killerMortar.reputation = { entries: [] };
replayCharacter(killerMortar, rules);
assert.equal(killerMortar.reputation.entries[0]?.id, "mortar-killer", "Автоматическая Reputation должна синхронизироваться и без browser UI");

const previousDocument = globalThis.document;
const previousConfig = globalThis.AIR_ISLANDS_CONFIG;
const previousUiState = globalThis.AIR_ISLANDS_MORTAR_UI_STATE;
globalThis.document = {};
globalThis.AIR_ISLANDS_CONFIG = { builderVersion: "test" };
globalThis.AIR_ISLANDS_MORTAR_UI_STATE = { characterId: "other-character", killerRoll: 1, defectRoll: 66, derived: null };
const idlessMortar = structuredClone(mortar);
delete idlessMortar.characterId;
idlessMortar.creation.mortar = { killerRoll: 2, defectRoll: 11 };
replayCharacter(idlessMortar, rules);
assert.deepEqual(idlessMortar.creation.mortar, { killerRoll: 2, defectRoll: 11 }, "Мортар без characterId не должен получать броски другого черновика");
assert.equal(globalThis.AIR_ISLANDS_MORTAR_UI_STATE.characterId, "other-character", "Мортар без characterId не должен захватывать UI-state под общим ключом");
if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
if (previousConfig === undefined) delete globalThis.AIR_ISLANDS_CONFIG; else globalThis.AIR_ISLANDS_CONFIG = previousConfig;
if (previousUiState === undefined) delete globalThis.AIR_ISLANDS_MORTAR_UI_STATE; else globalThis.AIR_ISLANDS_MORTAR_UI_STATE = previousUiState;

const r2 = simulateXpTransaction(mortar, rules, { type: "talent", catalogId: recovery.catalogId, toRank: 2 });
assert.equal(r2.valid, true, r2.issue?.message);
assert.equal(r2.cost, 20, "Recovery Protocol Rank 2 должен стоить 20 XP");
mortar.experience.ledger.push({ type: "talent", catalogId: recovery.catalogId, toRank: 2 });
validation = validateCharacter(mortar, rules);
assert.ok(validation.errors.some(error => error.code === "MORTAR_FIRST_PROTOCOL_REQUIRED"), "После Recovery R2 нужно выбрать первый Operational Protocol");

const combat = operational.find(entry => entry.name === "Combat Protocol");
const firstProtocol = simulateXpTransaction(mortar, rules, { type: "talent", catalogId: combat.catalogId, toRank: 1 });
assert.equal(firstProtocol.valid, true, firstProtocol.issue?.message);
assert.equal(firstProtocol.cost, 0, "Первый Operational Protocol Rank 1 после Recovery R2 бесплатный");
mortar.experience.ledger.push({ type: "talent", catalogId: combat.catalogId, toRank: 1 });
validation = validateCharacter(mortar, rules);
assert.equal(validation.valid, true, JSON.stringify(validation.errors, null, 2));

const r3 = simulateXpTransaction(mortar, rules, { type: "talent", catalogId: recovery.catalogId, toRank: 3 });
assert.equal(r3.valid, true, r3.issue?.message);
assert.equal(r3.cost, 30);
mortar.experience.ledger.push({ type: "talent", catalogId: recovery.catalogId, toRank: 3 });
validation = validateCharacter(mortar, rules);
assert.ok(validation.errors.some(error => error.code === "MORTAR_ATTRIBUTE_INCREASE_REQUIRED"), "Recovery R3 должен требовать +1 Attribute");

const strengthR3 = calibrations.find(entry => entry.recoveryTier === 3 && entry.recoveryAttribute === "strength");
const calibration = simulateXpTransaction(mortar, rules, { type: "talent", catalogId: strengthR3.catalogId, toRank: 1 });
assert.equal(calibration.valid, true, calibration.issue?.message);
assert.equal(calibration.cost, 0);
mortar.experience.ledger.push({ type: "talent", catalogId: strengthR3.catalogId, toRank: 1 });
replay = replayCharacter(mortar, rules);
assert.equal(replay.final.attributes.strength, 5);
assert.equal(replay.final.talents.some(entry => entry.catalogId === strengthR3.catalogId), false, "Системная калибровка не должна импортироваться как Talent Item");

const combatR2 = simulateXpTransaction(mortar, rules, { type: "talent", catalogId: combat.catalogId, toRank: 2 });
assert.equal(combatR2.valid, true, combatR2.issue?.message);
assert.equal(combatR2.cost, 10);
mortar.experience.ledger.push({ type: "talent", catalogId: combat.catalogId, toRank: 2 });
const blockedSecond = simulateXpTransaction(mortar, rules, { type: "talent", catalogId: operational.find(entry => entry.name === "Mobility Protocol").catalogId, toRank: 1 });
assert.equal(blockedSecond.valid, false);
assert.equal(blockedSecond.issue.code, "MORTAR_PROTOCOL_PREVIOUS_RANK");

const combatR3 = simulateXpTransaction(mortar, rules, { type: "talent", catalogId: combat.catalogId, toRank: 3 });
assert.equal(combatR3.valid, true, combatR3.issue?.message);
mortar.experience.ledger.push({ type: "talent", catalogId: combat.catalogId, toRank: 3 });
const mobility = operational.find(entry => entry.name === "Mobility Protocol");
const secondProtocol = simulateXpTransaction(mortar, rules, { type: "talent", catalogId: mobility.catalogId, toRank: 1 });
assert.equal(secondProtocol.valid, true, secondProtocol.issue?.message);
assert.ok(secondProtocol.cost >= 5, "Дополнительный Operational Protocol должен стоить как обычный талант");

const moveRank1 = simulateXpTransaction(mortar, rules, { type: "skill", skillId: "move", toRank: 1 });
assert.equal(moveRank1.valid, true, moveRank1.issue?.message);
assert.equal(moveRank1.cost, 5, "У мортара все навыки используют стоимость непрофессионального навыка");

const invalidCap = structuredClone(mortar);
invalidCap.attributes.strength = 7;
assert.ok(validateCharacter(invalidCap, rules).errors.some(error => error.code === "ATTRIBUTE_MAX"));
const invalidSkill = structuredClone(mortar);
invalidSkill.skills.move.startingRank = 3;
assert.ok(validateCharacter(invalidSkill, rules).errors.some(error => error.code === "SKILL_CAP"));
const invalidRolls = structuredClone(mortar);
invalidRolls.creation.mortar = { killerRoll: null, defectRoll: null };
const invalidRollResult = validateCharacter(invalidRolls, rules);
assert.ok(invalidRollResult.errors.some(error => error.code === "MORTAR_KILLER_ROLL"));
assert.ok(invalidRollResult.errors.some(error => error.code === "MORTAR_DEFECT_ROLL"));

const { actorData, items } = characterToActorData(mortar, rules, { foundryGeneration: 13, allowInvalid: true });
assert.equal(actorData.system.bio.profession.value, "Нет");
assert.equal(actorData.system.attribute.strength.value, 5);
assert.equal(actorData.flags["air-islands-character-importer"].mortar.startingResources.ordinarySpareParts, "1D10");
assert.equal(actorData.flags["air-islands-character-importer"].mortar.startingResources.precisionSpareParts, "1D8");
assert.equal(actorData.flags["air-islands-character-importer"].mortar.rules.builtInArmor, 2);
assert.equal(items.some(item => item.name.startsWith("Recovery Protocol Rank 3:")), false);
assert.ok(items.some(item => item.name === "Механическое Тело"), "Механическое Тело должно импортироваться как отдельный Talent Item");
assert.ok(items.some(item => item.name === "Recovery Protocol"));
assert.ok(items.some(item => item.name === "Combat Protocol"));
assert.match(actorData.flags["fbl-quick-access"].biographyProfile.identity.birthDate.label, /^Пробуждение:/u, "Дата мортара должна экспортироваться как дата пробуждения");

const forcedNullEntries = structuredClone(sample);
forcedNullEntries.biography.rumors = [null];
forcedNullEntries.gmRequests = [null];
const forcedNullActor = characterToActorData(forcedNullEntries, rules, { foundryGeneration: 13, allowInvalid: true });
assert.equal(forcedNullActor.actorData.flags["air-islands-character-importer"].profile.biography.rumors[0], null, "Принудительный импорт должен сохранять исходный профиль с null-элементами");
assert.equal(forcedNullActor.actorData.flags["air-islands-character-importer"].profile.gmRequests[0], null);

console.log("All Mortar rule-engine tests passed.");
