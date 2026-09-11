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
} from "../shared/mortar-runtime-core.mjs";

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
  engineering: "WhitetransparentICONS/Other/blackbackground/big-gear.svg",
  command: "icons/svg/cog.svg"
};

assert.ok(mortarKin, "Раса Мортар отсутствует");
assert.equal(ageCategoryFor(mortarKin, 500), "mortar");
assert.equal(rules.ageCategories.mortar.attributePoints, 13);
assert.equal(rules.ageCategories.mortar.skillPoints, 10);
assert.equal(rules.ageCategories.mortar.talentPoints, 0);
assert.equal(rules.rulesVersion, "2026.09.11-1.5.1");
assert.equal(rules.minimumBuilderVersion, "1.5.1");

const body = rules.catalogs.talents.items.find(entry => entry.builderRole === "mortar-body");
const recovery = rules.catalogs.talents.items.find(entry => entry.builderRole === "mortar-recovery");
const operational = rules.catalogs.talents.items.filter(entry => entry.builderRole === "mortar-operational");
const calibrations = rules.catalogs.talents.items.filter(entry => entry.builderRole === "mortar-attribute");
const mortarEntries = rules.catalogs.talents.items.filter(entry => String(entry.builderRole ?? "").startsWith("mortar-"));

assert.ok(body, "Механическое Тело отсутствует");
assert.equal(body.name, "Механическое Тело");
assert.equal(body.type, "general");
assert.equal(body.maximumRank, 1, "Механическое Тело не должно прокачиваться");
assert.equal(body.image, MORTAR_ICONS.body);
assert.match(body.snapshot.system.description, /большинству болезней и ядов/u);
assert.match(body.snapshot.system.description, /Hungry, Sleepy, Thirsty, Cold/u);
assert.match(body.snapshot.system.description, /не имеет биологического тела/u);
assert.match(body.snapshot.system.description, /восстанавливает 1 ед\. WITS, 1 ед\. EMPATHY/u);
assert.match(body.snapshot.system.description, /не лечатся HEALING или со временем/u);
assert.match(body.snapshot.system.description, /уменьшает Structural Damage на 1 и одновременно восстанавливает соответствующий Attribute на 1/u);
assert.match(body.snapshot.system.description, /Turn \(15 минут\)/u);

assert.ok(recovery, "Recovery Protocol отсутствует");
assert.equal(recovery.image, MORTAR_ICONS.recovery);
assert.match(recovery.snapshot.system.description, /Активация и применение способностей протоколов не требует действий/u);
assert.match(recovery.snapshot.system.description, /Способности разных рангов разных Protocol могут использоваться одновременно/u);
assert.match(recovery.snapshot.system.description, /REDLINE создаёт 4 OVERLOAD/u);
assert.match(recovery.snapshot.system.description, /игнорируя состояние Broken до конца REDLINE/u);

assert.equal(operational.length, 6, "Должно быть шесть Operational Protocols, включая Command Protocol");
assert.equal(calibrations.length, 0);
assert.equal(mortarEntries.length, 8, "Механическое Тело + Recovery + шесть Operational Protocols");
assert.equal(mortarKin.talentCatalogId, recovery.catalogId);

const operationalByName = new Map(operational.map(entry => [entry.name, entry]));
const expectedOperationalIcons = new Map([
  ["Combat Protocol", MORTAR_ICONS.combat],
  ["Bulwark Protocol", MORTAR_ICONS.bulwark],
  ["Reconnaissance Protocol", MORTAR_ICONS.recon],
  ["Engineering Protocol", MORTAR_ICONS.engineering],
  ["Mobility Protocol", MORTAR_ICONS.mobility],
  ["Command Protocol", MORTAR_ICONS.command]
]);
for (const [name, icon] of expectedOperationalIcons) {
  const entry = operationalByName.get(name);
  assert.ok(entry, `${name} отсутствует`);
  assert.equal(entry.image, icon, `${name}: неверная иконка каталога`);
  assert.equal(entry.snapshot.img, icon, `${name}: неверная иконка импортируемого Item`);
}

assert.match(operationalByName.get("Combat Protocol").snapshot.system.description, /но не более Rank/u);
assert.match(operationalByName.get("Combat Protocol").snapshot.system.description, /Не более одного применения за бой/u);
assert.match(operationalByName.get("Bulwark Protocol").snapshot.system.description, /Врожденный доспех становится равен 4/u);
assert.match(operationalByName.get("Bulwark Protocol").snapshot.system.description, /откажись от брони, но уменьши урон на 1D3/u);
assert.match(operationalByName.get("Bulwark Protocol").snapshot.system.description, /вычислительного ядра/u);
assert.match(operationalByName.get("Reconnaissance Protocol").snapshot.system.description, /SCOUTING с PRECISION PROCESSING автоматически получает 1 успех/u);
assert.match(operationalByName.get("Engineering Protocol").snapshot.system.description, /полностью восстанови текущие STR и AGI/u);
assert.match(operationalByName.get("Engineering Protocol").snapshot.system.description, /не устраняет Critical Injuries/u);
assert.match(operationalByName.get("Mobility Protocol").snapshot.system.description, /\+1 ко всем проверкам MOVE/u);
assert.match(operationalByName.get("Mobility Protocol").snapshot.system.description, /\+10 м скорости/u);
assert.match(operationalByName.get("Command Protocol").snapshot.system.description, /LINKED OVERCLOCK/u);
assert.match(operationalByName.get("Command Protocol").snapshot.system.description, /TACTICAL LINK/u);
assert.match(operationalByName.get("Command Protocol").snapshot.system.description, /IMMEDIATE DIRECTIVE/u);
assert.match(operationalByName.get("Command Protocol").snapshot.system.description, /COMMAND NETWORK/u);
assert.match(operationalByName.get("Command Protocol").snapshot.system.description, /BATTLEFIELD ORCHESTRATION/u);

const mortar = structuredClone(sample);
mortar.identity.kinId = "mortar";
mortar.identity.kinVariantId = null;
mortar.identity.kinFocus = null;
mortar.identity.professionId = "";
mortar.creation.initialPathCatalogId = null;
mortar.creation.ageTalentLedger = [];
mortar.creation.startingSpells = [];
mortar.creation.mortar = { killerRoll: null, defectRoll: null };
mortar.attributes = { strength: 4, agility: 3, wits: 3, empathy: 3 };
mortar.skills = Object.fromEntries(rules.skills.map(skill => [skill.id, { startingRank: 0 }]));
for (const skillId of ["might", "endurance", "melee", "crafting", "scouting"]) mortar.skills[skillId].startingRank = 2;
mortar.experience = { baseTotal: 1000, ledger: [] };
mortar.reputation = { entries: [] };

assert.equal(attributeMaximum("strength", mortar, rules), 6);
let validation = validateCharacter(mortar, rules);
assert.equal(validation.valid, true, JSON.stringify(validation.errors, null, 2));
assert.equal(validation.errors.some(error => ["MORTAR_KILLER_ROLL", "MORTAR_DEFECT_ROLL"].includes(error.code)), false, "Post-creation D2/D100 не должны блокировать builder");

let replay = replayCharacter(mortar, rules);
assert.equal(replay.mortar.attributePointsTotal, 13);
assert.equal(replay.mortar.attributeBonusPoints, 0);
assert.equal(replay.final.talents.find(entry => entry.catalogId === body.catalogId)?.rank, 1);
assert.equal(replay.final.talents.find(entry => entry.catalogId === recovery.catalogId)?.rank, 1);

const bodyUpgrade = simulateXpTransaction(mortar, rules, { type: "talent", catalogId: body.catalogId, toRank: 2 });
assert.equal(bodyUpgrade.valid, false);
assert.equal(bodyUpgrade.issue?.code, "MORTAR_BODY_FIXED");

const r2 = simulateXpTransaction(mortar, rules, { type: "talent", catalogId: recovery.catalogId, toRank: 2 });
assert.equal(r2.valid, true, r2.issue?.message);
assert.equal(r2.cost, 20);
mortar.experience.ledger.push({ type: "talent", catalogId: recovery.catalogId, toRank: 2 });
validation = validateCharacter(mortar, rules);
assert.ok(validation.errors.some(error => error.code === "MORTAR_FIRST_PROTOCOL_REQUIRED"));

const combat = operationalByName.get("Combat Protocol");
const firstProtocol = simulateXpTransaction(mortar, rules, { type: "talent", catalogId: combat.catalogId, toRank: 1 });
assert.equal(firstProtocol.valid, true, firstProtocol.issue?.message);
assert.equal(firstProtocol.cost, 0);
mortar.experience.ledger.push({ type: "talent", catalogId: combat.catalogId, toRank: 1 });
assert.equal(validateCharacter(mortar, rules).valid, true);

const r3 = simulateXpTransaction(mortar, rules, { type: "talent", catalogId: recovery.catalogId, toRank: 3 });
assert.equal(r3.valid, true, r3.issue?.message);
mortar.experience.ledger.push({ type: "talent", catalogId: recovery.catalogId, toRank: 3 });
assert.equal(attributeMaximum("strength", mortar, rules), 7);
replay = replayCharacter(mortar, rules);
assert.equal(replay.mortar.attributePointsTotal, 14);
mortar.attributes.strength += 1;
assert.equal(validateCharacter(mortar, rules).valid, true);

const combatR2 = simulateXpTransaction(mortar, rules, { type: "talent", catalogId: combat.catalogId, toRank: 2 });
assert.equal(combatR2.valid, true, combatR2.issue?.message);
mortar.experience.ledger.push({ type: "talent", catalogId: combat.catalogId, toRank: 2 });

const command = operationalByName.get("Command Protocol");
const blockedSecond = simulateXpTransaction(mortar, rules, { type: "talent", catalogId: command.catalogId, toRank: 1 });
assert.equal(blockedSecond.valid, false);
assert.equal(blockedSecond.issue.code, "MORTAR_PROTOCOL_PREVIOUS_RANK");

const combatR3 = simulateXpTransaction(mortar, rules, { type: "talent", catalogId: combat.catalogId, toRank: 3 });
assert.equal(combatR3.valid, true, combatR3.issue?.message);
mortar.experience.ledger.push({ type: "talent", catalogId: combat.catalogId, toRank: 3 });

const secondProtocol = simulateXpTransaction(mortar, rules, { type: "talent", catalogId: command.catalogId, toRank: 1 });
assert.equal(secondProtocol.valid, true, secondProtocol.issue?.message);
assert.ok(secondProtocol.cost >= 5);
mortar.experience.ledger.push({ type: "talent", catalogId: command.catalogId, toRank: 1 });

const r4 = simulateXpTransaction(mortar, rules, { type: "talent", catalogId: recovery.catalogId, toRank: 4 });
assert.equal(r4.valid, true, r4.issue?.message);
mortar.experience.ledger.push({ type: "talent", catalogId: recovery.catalogId, toRank: 4 });
assert.equal(attributeMaximum("agility", mortar, rules), 8);
mortar.attributes.agility += 1;
assert.equal(validateCharacter(mortar, rules).valid, true);

const r5 = simulateXpTransaction(mortar, rules, { type: "talent", catalogId: recovery.catalogId, toRank: 5 });
assert.equal(r5.valid, true, r5.issue?.message);
mortar.experience.ledger.push({ type: "talent", catalogId: recovery.catalogId, toRank: 5 });
assert.equal(attributeMaximum("wits", mortar, rules), 9, "После удаления старого cap 8 Recovery R5 допускает итоговый Attribute 9");
mortar.attributes.wits += 1;
validation = validateCharacter(mortar, rules);
assert.equal(validation.valid, true, JSON.stringify(validation.errors, null, 2));
assert.deepEqual(validation.derived.attributePoints, { base: 13, bonus: 3, total: 16, spent: 16, remaining: 0 });

const legalNine = structuredClone(mortar);
legalNine.attributes = { strength: 9, agility: 2, wits: 3, empathy: 2 };
assert.equal(validateCharacter(legalNine, rules).valid, true, "При Recovery R5 документ позволяет довести один Attribute до 9");

const overCap = structuredClone(mortar);
overCap.attributes = { strength: 10, agility: 2, wits: 2, empathy: 2 };
assert.ok(validateCharacter(overCap, rules).errors.some(error => error.code === "ATTRIBUTE_MAX"), "Итоговый Attribute выше 9 невозможен при трёх Recovery increases");

const moveRank1 = simulateXpTransaction(mortar, rules, { type: "skill", skillId: "move", toRank: 1 });
assert.equal(moveRank1.valid, true, moveRank1.issue?.message);
assert.equal(moveRank1.cost, 5, "У мортара все навыки используют стоимость непрофессионального навыка");

const invalidStartCap = structuredClone(mortar);
invalidStartCap.experience.ledger = [];
invalidStartCap.attributes = { strength: 7, agility: 2, wits: 2, empathy: 2 };
assert.ok(validateCharacter(invalidStartCap, rules).errors.some(error => error.code === "ATTRIBUTE_MAX"));
const invalidSkill = structuredClone(mortar);
invalidSkill.skills.move.startingRank = 3;
assert.ok(validateCharacter(invalidSkill, rules).errors.some(error => error.code === "SKILL_CAP"));

const { actorData, items } = characterToActorData(mortar, rules, { foundryGeneration: 13 });
assert.equal(actorData.system.bio.profession.value, "Нет");
assert.equal(actorData.flags["air-islands-character-importer"].mortar.startingResources.ordinarySpareParts, "1D10");
assert.equal(actorData.flags["air-islands-character-importer"].mortar.startingResources.precisionSpareParts, "1D8");
assert.equal(actorData.flags["air-islands-character-importer"].mortar.rules.builtInArmor, 2);
assert.equal(actorData.flags["air-islands-character-importer"].mortar.rules.immuneToMostDiseasesAndPoisons, true);
assert.equal(actorData.flags["air-islands-character-importer"].mortar.rules.suffocationImmune, true);
assert.deepEqual(actorData.flags["air-islands-character-importer"].mortar.rules.conditionImmunities, ["hungry", "sleepy", "thirsty", "cold"]);
assert.equal(actorData.flags["air-islands-character-importer"].mortar.rules.biologicalBody, false);
assert.deepEqual(actorData.flags["air-islands-character-importer"].mortar.postCreationRolls, { killer: "1D2", defect: "1D100", completed: false });

const importedBody = items.find(item => item.name === "Механическое Тело");
assert.ok(importedBody);
assert.equal(importedBody.system.rank, 1);
const importedRecovery = items.find(item => item.name === "Recovery Protocol");
assert.ok(importedRecovery);
assert.equal(importedRecovery.system.rank, 5);
assert.ok(items.some(item => item.name === "Combat Protocol"));
assert.ok(items.some(item => item.name === "Command Protocol"));
assert.match(actorData.flags["fbl-quick-access"].biographyProfile.identity.birthDate.label, /^Пробуждение:/u);

const forcedNullEntries = structuredClone(sample);
forcedNullEntries.biography.rumors = [null];
forcedNullEntries.gmRequests = [null];
const forcedNullActor = characterToActorData(forcedNullEntries, rules, { foundryGeneration: 13, allowInvalid: true });
assert.equal(forcedNullActor.actorData.flags["air-islands-character-importer"].profile.biography.rumors[0], null);
assert.equal(forcedNullActor.actorData.flags["air-islands-character-importer"].profile.gmRequests[0], null);

console.log("All Mortar rule-engine tests passed.");
