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
const MORTAR_ICONS = {
  body: "WhitetransparentICONS/Other/blackbackground/bolt-eye.svg",
  recovery: "WhitetransparentICONS/Other/blackbackground/techno-heart.svg",
  combat: "WhitetransparentICONS/Other/blackbackground/crescent-blade_1.svg",
  bulwark: "WhitetransparentICONS/Other/blackbackground/layered-armor.svg",
  recon: "WhitetransparentICONS/Other/blackbackground/orbital-rays.svg",
  mobility: "WhitetransparentICONS/Other/blackbackground/fast-arrow.svg",
  engineering: "WhitetransparentICONS/Other/blackbackground/big-gear.svg"
};

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
assert.equal(body.type, "general", "Механическое Тело должно импортироваться как отдельный General Talent, а не конкурировать с Recovery за kin-слот");
assert.equal(body.snapshot.system.type, "general");
assert.equal(body.maximumRank, 1, "Механическое Тело не должно прокачиваться");
assert.equal(body.image, MORTAR_ICONS.body);
assert.equal(body.snapshot.img, MORTAR_ICONS.body);
assert.match(body.snapshot.system.description, /не требуются пища, вода, сон, дыхание/u);
assert.match(body.snapshot.system.description, /ИНТЕЛЛЕКТУАЛЬНОЕ ЯДРО/u, "В Механическом Теле потеряно правило интеллектуального ядра");
assert.match(body.snapshot.system.description, /Результат Resource Die одновременно считается Artifact Die/u, "В Механическом Теле потеряна механика Resource Die ремонта");
assert.match(body.snapshot.system.description, /100%: PSYCHOSIS/u, "В Механическом Теле потеряна шкала OVERLOAD");
assert.ok(recovery, "Recovery Protocol отсутствует");
assert.equal(recovery.image, MORTAR_ICONS.recovery);
assert.equal(recovery.snapshot.img, MORTAR_ICONS.recovery);
assert.doesNotMatch(recovery.snapshot.system.description, /МЕХАНИЧЕСКОЕ ТЕЛО/u, "Пассивные свойства тела не должны оставаться внутри Recovery Protocol");
assert.match(recovery.snapshot.system.description, /REDLINE/u, "Recovery Protocol Rank 5 должен содержать REDLINE");
assert.match(recovery.snapshot.system.description, /REDLINE создаёт 4 OVERLOAD/u);
assert.match(recovery.snapshot.system.description, /дополнительную Slow Action/u);
assert.match(recovery.snapshot.system.description, /REDLINE не восстанавливает Attributes, не отменяет Critical Injuries и не снимает Conditions/u, "REDLINE потерял ограничения из исходных правил");
assert.match(recovery.snapshot.system.description, /D8 входит в Dice Pool и перебрасывается при PUSH/u, "Deep Overclock потерял правило PUSH");
assert.match(recovery.snapshot.system.description, /Standard Overclock остаётся доступен/u, "Recovery R4/R5 должны сохранять Standard Overclock");
assert.match(recovery.snapshot.system.description, /постоянному максимальному WITS ×2/u, "MAX OVERLOAD должен использовать постоянный максимум WITS");
assert.equal(operational.length, 5);
assert.equal(calibrations.length, 12);
assert.equal(mortarKin.talentCatalogId, recovery.catalogId);

const operationalByName = new Map(operational.map(entry => [entry.name, entry]));
const expectedOperationalIcons = new Map([
  ["Combat Protocol", MORTAR_ICONS.combat],
  ["Bulwark Protocol", MORTAR_ICONS.bulwark],
  ["Reconnaissance Protocol", MORTAR_ICONS.recon],
  ["Engineering Protocol", MORTAR_ICONS.engineering],
  ["Mobility Protocol", MORTAR_ICONS.mobility]
]);
for (const [name, icon] of expectedOperationalIcons) {
  const entry = operationalByName.get(name);
  assert.ok(entry, `${name} отсутствует`);
  assert.equal(entry.image, icon, `${name}: неверная иконка каталога`);
  assert.equal(entry.snapshot.img, icon, `${name}: неверная иконка импортируемого Item`);
}
for (const calibrationEntry of calibrations) assert.equal(calibrationEntry.image, MORTAR_ICONS.recovery, "Калибровки Recovery должны использовать иконку Recovery Protocol");
assert.match(operationalByName.get("Bulwark Protocol").snapshot.system.description, /независимо от источника БП/u, "Bulwark R3 потерял правило отмены Armor Penetration любого источника");
assert.match(operationalByName.get("Bulwark Protocol").snapshot.system.description, /можешь немедленно потратить 2 WP/u, "Bulwark R4 потерял немедленное окно активации");
assert.match(operationalByName.get("Reconnaissance Protocol").snapshot.system.description, /оставь одну из полученных карт, остальные верни/u, "Recon R2 потерял завершение выбора Initiative Cards");
assert.match(operationalByName.get("Engineering Protocol").snapshot.system.description, /Resource Die истощается по обычным правилам/u, "Engineering R4 потерял расход Resource Die");
assert.match(operationalByName.get("Engineering Protocol").snapshot.system.description, /Resource Die всё равно бросается и может истощиться/u, "Engineering R5 потерял расход Resource Die");

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

const combat = operationalByName.get("Combat Protocol");
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
const blockedSecond = simulateXpTransaction(mortar, rules, { type: "talent", catalogId: operationalByName.get("Mobility Protocol").catalogId, toRank: 1 });
assert.equal(blockedSecond.valid, false);
assert.equal(blockedSecond.issue.code, "MORTAR_PROTOCOL_PREVIOUS_RANK");

const combatR3 = simulateXpTransaction(mortar, rules, { type: "talent", catalogId: combat.catalogId, toRank: 3 });
assert.equal(combatR3.valid, true, combatR3.issue?.message);
mortar.experience.ledger.push({ type: "talent", catalogId: combat.catalogId, toRank: 3 });
const mobility = operationalByName.get("Mobility Protocol");
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
const importedBody = items.find(item => item.name === "Механическое Тело");
assert.ok(importedBody, "Механическое Тело должно импортироваться как отдельный Talent Item");
assert.equal(importedBody.system.type, "general", "Механическое Тело должно быть видимым отдельным General Talent на листе Actor");
assert.equal(importedBody.system.rank, 1);
assert.equal(importedBody.img, MORTAR_ICONS.body);
const importedRecovery = items.find(item => item.name === "Recovery Protocol");
assert.ok(importedRecovery);
assert.equal(importedRecovery.img, MORTAR_ICONS.recovery);
const importedCombat = items.find(item => item.name === "Combat Protocol");
assert.ok(importedCombat);
assert.equal(importedCombat.img, MORTAR_ICONS.combat);
assert.match(actorData.flags["fbl-quick-access"].biographyProfile.identity.birthDate.label, /^Пробуждение:/u, "Дата мортара должна экспортироваться как дата пробуждения");

const forcedNullEntries = structuredClone(sample);
forcedNullEntries.biography.rumors = [null];
forcedNullEntries.gmRequests = [null];
const forcedNullActor = characterToActorData(forcedNullEntries, rules, { foundryGeneration: 13, allowInvalid: true });
assert.equal(forcedNullActor.actorData.flags["air-islands-character-importer"].profile.biography.rumors[0], null, "Принудительный импорт должен сохранять исходный профиль с null-элементами");
assert.equal(forcedNullActor.actorData.flags["air-islands-character-importer"].profile.gmRequests[0], null);

console.log("All Mortar rule-engine tests passed.");
