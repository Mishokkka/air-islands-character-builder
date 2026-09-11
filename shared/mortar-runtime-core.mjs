import * as mortar from "./mortar-core.mjs";
export * from "./mortar-core.mjs";

const MODULE_ID = "air-islands-character-importer";
const POST_CREATION_CODES = new Set(["MORTAR_KILLER_ROLL", "MORTAR_DEFECT_ROLL"]);
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

export function replayCharacter(character, rules) {
  clearBuilderPostCreationRolls(character);
  return mortar.replayCharacter(character, rules);
}

export function validateCharacter(character, rules) {
  if (!isMortarCharacter(character)) return mortar.validateCharacter(character, rules);
  clearBuilderPostCreationRolls(character);
  return stripPostCreationValidation(mortar.validateCharacter(character, rules));
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
  converted.actorData.flags[MODULE_ID].mortar.postCreationRolls = {
    killer: "1D2",
    defect: "1D100",
    completed: false
  };
  converted.actorData.flags[MODULE_ID].profile = cloneValue(character);
  return converted;
}
