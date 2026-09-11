import * as mortar from "./mortar-core.mjs";
export * from "./mortar-core.mjs";

const MODULE_ID = "air-islands-character-importer";
const POST_CREATION_CODES = new Set(["MORTAR_KILLER_ROLL", "MORTAR_DEFECT_ROLL"]);
const ATTRIBUTES = ["strength", "agility", "wits", "empathy"];
const MORTAR_BASE_ATTRIBUTE_MAXIMUM = 6;
const MORTAR_RECOVERY_ATTRIBUTE_BONUS_MAXIMUM = 3;
const cloneValue = value => typeof globalThis.structuredClone === "function" ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value));

function isMortarCharacter(character) {
  return character?.identity?.kinId === "mortar";
}

function clearBuilderPostCreationRolls(character) {
  if (!isMortarCharacter(character)) return character;
  character.creation ??= {};
  character.creation.mortar ??= {};
  character.creation.mortar.killerRoll = null;
  character.creation.mortar.defectRoll = null;
  if (Array.isArray(character.reputation?.entries)) {
    character.reputation.entries = character.reputation.entries.filter(entry => entry?.id !== "mortar-killer");
  }
  const ui = globalThis.AIR_ISLANDS_MORTAR_UI_STATE;
  const characterId = String(character.characterId ?? "").trim();
  if (ui && (!ui.characterId || ui.characterId === characterId)) {
    ui.characterId = characterId || ui.characterId;
    ui.killerRoll = null;
    ui.defectRoll = null;
  }
  return character;
}

function stripPostCreationValidation(validation) {
  const errors = (validation.errors ?? []).filter(issue => !POST_CREATION_CODES.has(issue.code));
  return { ...validation, valid: errors.length === 0, errors };
}

function documentAttributeMaximum(replay) {
  const bonus = Math.max(0, Math.min(
    MORTAR_RECOVERY_ATTRIBUTE_BONUS_MAXIMUM,
    Number(replay?.mortar?.attributeBonusPoints ?? 0)
  ));
  return MORTAR_BASE_ATTRIBUTE_MAXIMUM + bonus;
}

function patchMortarReplay(replay, character) {
  if (!replay?.mortar) return replay;
  const maximum = documentAttributeMaximum(replay);
  replay.mortar.attributeMaximum = maximum;
  if (replay.categoryRules) replay.categoryRules.attributePoints = replay.mortar.attributePointsTotal;

  const ui = globalThis.AIR_ISLANDS_MORTAR_UI_STATE;
  const characterId = String(character?.characterId ?? "").trim();
  if (ui?.derived && (!ui.characterId || ui.characterId === characterId)) {
    ui.derived.attributeMaximum = maximum;
  }
  return replay;
}

function patchMortarValidation(validation, character, rules) {
  const replay = patchMortarReplay(mortar.replayCharacter(character, rules), character);
  const maximum = replay?.mortar?.attributeMaximum ?? MORTAR_BASE_ATTRIBUTE_MAXIMUM;
  const errors = (validation.errors ?? []).filter(issue => issue.code !== "ATTRIBUTE_MAX");
  for (const attribute of ATTRIBUTES) {
    const value = Number(character.attributes?.[attribute]);
    if (Number.isFinite(value) && value > maximum) {
      errors.push({
        code: "ATTRIBUTE_MAX",
        message: `${attribute}: при Recovery Protocol Rank ${replay.mortar.recoveryRank} максимум ${maximum}.`,
        path: `attributes.${attribute}`
      });
    }
  }
  const derived = { ...(validation.derived ?? {}) };
  derived.attributeMaxima = Object.fromEntries(ATTRIBUTES.map(attribute => [attribute, maximum]));
  return { ...validation, valid: errors.length === 0, errors, derived };
}

export function attributeMaximum(attribute, character, rules) {
  if (!isMortarCharacter(character)) return mortar.attributeMaximum(attribute, character, rules);
  clearBuilderPostCreationRolls(character);
  return patchMortarReplay(mortar.replayCharacter(character, rules), character).mortar.attributeMaximum;
}

export function replayCharacter(character, rules) {
  clearBuilderPostCreationRolls(character);
  return isMortarCharacter(character)
    ? patchMortarReplay(mortar.replayCharacter(character, rules), character)
    : mortar.replayCharacter(character, rules);
}

export function validateCharacter(character, rules) {
  if (!isMortarCharacter(character)) return mortar.validateCharacter(character, rules);
  clearBuilderPostCreationRolls(character);
  const validation = stripPostCreationValidation(mortar.validateCharacter(character, rules));
  return patchMortarValidation(validation, character, rules);
}

export function simulateXpTransaction(character, rules, transaction) {
  const result = mortar.simulateXpTransaction(character, rules, transaction);
  if (isMortarCharacter(character) && result?.replay) patchMortarReplay(result.replay, character);
  return result;
}

export function characterToActorData(character, rules, options = {}) {
  if (!isMortarCharacter(character)) return mortar.characterToActorData(character, rules, options);
  clearBuilderPostCreationRolls(character);
  const validation = validateCharacter(character, rules);
  if (!validation.valid && options.allowInvalid !== true) {
    throw new mortar.RuleError("INVALID_CHARACTER", "Нельзя создать Actor из невалидного файла персонажа.");
  }

  const converted = mortar.characterToActorData(character, rules, { ...options, allowInvalid: true });
  converted.validation = validation;
  converted.actorData.system.bio.reputation.value = Number(validation.derived.reputation ?? 0);
  converted.actorData.flags["fbl-quick-access"] ??= {};
  converted.actorData.flags["fbl-quick-access"].reputationEntries = cloneValue(mortar.normalizeReputationEntries(character.reputation));
  converted.actorData.flags[MODULE_ID] ??= {};
  converted.actorData.flags[MODULE_ID].mortar ??= {};
  converted.actorData.flags[MODULE_ID].mortar.rules ??= {};
  Object.assign(converted.actorData.flags[MODULE_ID].mortar.rules, {
    immuneToMostDiseasesAndPoisons: true,
    suffocationImmune: true,
    conditionImmunities: ["hungry", "sleepy", "thirsty", "cold"],
    biologicalBody: false
  });
  converted.actorData.flags[MODULE_ID].mortar.postCreationRolls = {
    killer: "1D2",
    defect: "1D100",
    completed: false
  };
  converted.actorData.flags[MODULE_ID].profile = cloneValue(character);
  return converted;
}
