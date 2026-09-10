import * as base from "./core.mjs";
export * from "./core.mjs";

const ATTRIBUTES = ["strength", "agility", "wits", "empathy"];
const MODULE_ID = "air-islands-character-importer";
const MORTAR_BASE_ATTRIBUTE_POINTS = 13;
const MORTAR_BASE_ATTRIBUTE_MAXIMUM = 6;
const MORTAR_FINAL_ATTRIBUTE_MAXIMUM = 8;
const cloneValue = value => typeof globalThis.structuredClone === "function" ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value));
const makeIssue = (code, message, path = "") => ({ code, message, path });

function isMortarCharacter(character) {
  return character?.identity?.kinId === "mortar";
}

function mortarTalents(rules) {
  return rules.catalogs.talents.items.filter(entry => String(entry.builderRole ?? "").startsWith("mortar-"));
}

function recoveryTalent(rules) {
  return mortarTalents(rules).find(entry => entry.builderRole === "mortar-recovery") ?? null;
}

function mechanicalBodyTalent(rules) {
  return mortarTalents(rules).find(entry => entry.builderRole === "mortar-body") ?? null;
}

function operationalTalents(rules) {
  return mortarTalents(rules).filter(entry => entry.builderRole === "mortar-operational");
}

function recoveryAttributeBonusPoints(rank) {
  return Math.max(0, Math.min(3, Number(rank ?? 1) - 2));
}

function mortarAttributeMaximumForRank(rank) {
  return Math.min(MORTAR_FINAL_ATTRIBUTE_MAXIMUM, MORTAR_BASE_ATTRIBUTE_MAXIMUM + recoveryAttributeBonusPoints(rank));
}

function currentUiState() {
  if (typeof globalThis.document === "undefined" || !globalThis.AIR_ISLANDS_CONFIG) return null;
  globalThis.AIR_ISLANDS_MORTAR_UI_STATE ??= {
    characterId: null,
    killerRoll: null,
    defectRoll: null,
    derived: null
  };
  return globalThis.AIR_ISLANDS_MORTAR_UI_STATE;
}

function syncMortarCreation(character) {
  if (!isMortarCharacter(character)) return;
  character.creation ??= {};
  character.creation.mortar ??= { killerRoll: null, defectRoll: null };

  const key = String(character.characterId ?? "").trim();
  const ui = key ? currentUiState() : null;
  if (ui) {
    if (ui.characterId !== key) {
      ui.characterId = key;
      ui.killerRoll = Number(character.creation.mortar.killerRoll) || null;
      ui.defectRoll = Number(character.creation.mortar.defectRoll) || null;
    } else {
      character.creation.mortar.killerRoll = Number(ui.killerRoll) || null;
      character.creation.mortar.defectRoll = Number(ui.defectRoll) || null;
    }
  }

  character.reputation ??= { entries: [] };
  character.reputation.entries ??= [];
  const automaticIndex = character.reputation.entries.findIndex(entry => entry?.id === "mortar-killer");
  if (Number(character.creation.mortar.killerRoll) === 1 && automaticIndex < 0) {
    character.reputation.entries.unshift({ id: "mortar-killer", amount: 1, description: "Убийца", location: "" });
  }
  if (Number(character.creation.mortar.killerRoll) !== 1 && automaticIndex >= 0) {
    character.reputation.entries.splice(automaticIndex, 1);
  }
}

function safeActorConversionCharacter(character) {
  const rumors = character?.biography?.rumors;
  const gmRequests = character?.gmRequests;
  const hasNullRumor = Array.isArray(rumors) && rumors.some(entry => entry == null);
  const hasNullRequest = Array.isArray(gmRequests) && gmRequests.some(entry => entry == null);
  if (!hasNullRumor && !hasNullRequest) return character;

  const safe = cloneValue(character);
  if (Array.isArray(safe.biography?.rumors)) safe.biography.rumors = safe.biography.rumors.map(entry => entry ?? {});
  if (Array.isArray(safe.gmRequests)) safe.gmRequests = safe.gmRequests.map(entry => entry ?? {});
  return safe;
}

function isD66(value) {
  const text = String(value ?? "");
  return /^[1-6][1-6]$/u.test(text);
}

function isLegacyCalibrationTransaction(tx) {
  return tx?.type === "talent" && /^talent:air-islands\.mortar:mCal/iu.test(String(tx.catalogId ?? ""));
}

function startingSkillCost(rank) {
  return base.startingSkillCost(rank);
}

function generalTalentCost(talent, targetRank, state, rules) {
  const baseCost = Number(rules.talentXpCosts.general[targetRank - 1]);
  if (!Number.isFinite(baseCost)) return { base: Number.POSITIVE_INFINITY, surcharge: 0, multiplier: 1, total: Number.POSITIVE_INFINITY };
  let distinct = 0;
  for (const catalogId of state.talents.keys()) {
    const entry = rules.catalogs.talents.items.find(item => item.catalogId === catalogId);
    if (entry?.builderRole === "mortar-body") continue;
    distinct += 1;
  }
  if (!state.talents.has(talent.catalogId)) distinct += 1;
  const surcharge = Math.max(0, distinct - 5);
  let total = baseCost + surcharge;

  const engineering = operationalTalents(rules).find(entry => entry.name === "Engineering Protocol");
  const engineeringRank = engineering ? (state.talents.get(engineering.catalogId) ?? 0) : 0;
  const craftTalentNames = new Set(["Alchemist", "Apothecary", "Bowyer", "Builder", "Inventor", "Smith", "Tailor", "Tanner"]);
  const engineeringDiscount = talent.type === "general"
    && !talent.builderRole
    && craftTalentNames.has(talent.name)
    && targetRank <= engineeringRank;
  if (engineeringDiscount) total = Math.ceil(total / 2);
  return { base: baseCost, surcharge, multiplier: 1, engineeringDiscount, total };
}

function mortarSkillCost(skillId, targetRank, state, rules) {
  const baseCost = Number(rules.skillXpCosts.other[targetRank - 1]);
  if (!Number.isFinite(baseCost)) return Number.POSITIVE_INFINITY;
  if (skillId !== "crafting") return baseCost;
  const engineering = operationalTalents(rules).find(entry => entry.name === "Engineering Protocol");
  const engineeringRank = engineering ? (state.talents.get(engineering.catalogId) ?? 0) : 0;
  return targetRank <= engineeringRank ? Math.ceil(baseCost / 2) : baseCost;
}

function createMortarState(character, rules) {
  const skills = new Map(rules.skills.map(skill => [skill.id, Number(character.skills?.[skill.id]?.startingRank ?? 0)]));
  const attributes = new Map(ATTRIBUTES.map(attribute => [attribute, Number(character.attributes?.[attribute] ?? 0)]));
  const talents = new Map();
  const talentSources = new Map();
  const body = mechanicalBodyTalent(rules);
  if (body) {
    talents.set(body.catalogId, 1);
    talentSources.set(body.catalogId, "kin");
  }
  const recovery = recoveryTalent(rules);
  if (recovery) {
    talents.set(recovery.catalogId, 1);
    talentSources.set(recovery.catalogId, "kin");
  }
  const killerRoll = Number(character.creation?.mortar?.killerRoll);
  return {
    skills,
    attributes,
    talents,
    talentSources,
    spells: new Map(),
    reputation: killerRoll === 1 ? 1 : 0,
    xpSpent: 0,
    xpRemaining: base.baseXpAllowance(character),
    transactionResults: [],
    operationalOrder: []
  };
}

function evaluateMortarXpTransaction(tx, character, rules, index, state) {
  if (!tx || typeof tx !== "object") return { valid: false, issue: makeIssue("XP_LEDGER_ENTRY", "Повреждённая запись журнала Base XP.") };

  if (tx.type === "skill") {
    const skill = index.skills.get(tx.skillId);
    if (!skill) return { valid: false, issue: makeIssue("XP_SKILL_UNKNOWN", "Указан неизвестный навык.") };
    const current = state.skills.get(tx.skillId) ?? 0;
    const target = Number(tx.toRank);
    if (!Number.isInteger(target) || target !== current + 1 || target > 5) {
      return { valid: false, issue: makeIssue("XP_SKILL_SEQUENCE", `${skill.name}: ожидался переход ${current} → ${current + 1}.`) };
    }
    const cost = mortarSkillCost(tx.skillId, target, state, rules);
    return { valid: Number.isFinite(cost), cost, label: `${skill.name}: Rank ${current} → ${target}`, apply: () => state.skills.set(tx.skillId, target) };
  }

  if (tx.type === "talent") {
    const talent = index.talents.get(tx.catalogId);
    if (!talent) return { valid: false, issue: makeIssue("XP_TALENT_UNKNOWN", "Указан неизвестный талант.") };
    const current = state.talents.get(tx.catalogId) ?? 0;
    const target = Number(tx.toRank);
    if (talent.builderRole === "mortar-body") {
      return { valid: false, issue: makeIssue("MORTAR_BODY_FIXED", "«Механическое Тело» бесплатно даётся всем мортарам и не имеет повышаемых рангов.") };
    }
    const maxRank = Number(talent.maximumRank ?? 5);
    if (!Number.isInteger(target) || target !== current + 1 || target > maxRank) {
      return { valid: false, issue: makeIssue("XP_TALENT_SEQUENCE", `${talent.name}: ожидался переход ${current} → ${current + 1}.`) };
    }

    if (talent.builderRole === "mortar-recovery") {
      const cost = Number(rules.talentXpCosts.general[target - 1]) * Number(rules.talentXpCosts.kinMultiplier ?? 2);
      return {
        valid: Number.isFinite(cost), cost,
        breakdown: { base: Number(rules.talentXpCosts.general[target - 1]), surcharge: 0, multiplier: Number(rules.talentXpCosts.kinMultiplier ?? 2), total: cost },
        label: `${talent.name}: Rank ${current} → ${target}`,
        apply: () => state.talents.set(tx.catalogId, target)
      };
    }

    if (talent.builderRole === "mortar-operational") {
      const recovery = recoveryTalent(rules);
      const recoveryRank = recovery ? (state.talents.get(recovery.catalogId) ?? 0) : 0;
      if (current === 0) {
        if (recoveryRank < 2) return { valid: false, issue: makeIssue("MORTAR_PROTOCOL_LOCKED", "Первый Operational Protocol открывается на Recovery Protocol Rank 2.") };
        if (state.operationalOrder.length) {
          if (recoveryRank < 3) return { valid: false, issue: makeIssue("MORTAR_PROTOCOL_ADDITIONAL_LOCKED", "Дополнительные Operational Protocols открываются после Recovery Protocol Rank 3.") };
          const previousId = state.operationalOrder.at(-1);
          const previous = index.talents.get(previousId);
          const previousRank = state.talents.get(previousId) ?? 0;
          if (previousRank < 3) return { valid: false, issue: makeIssue("MORTAR_PROTOCOL_PREVIOUS_RANK", `Сначала развейте ${previous?.name ?? "предыдущий Operational Protocol"} до Rank 3.`) };
        }
      }
      const firstFree = current === 0 && state.operationalOrder.length === 0;
      const breakdown = firstFree ? { base: 0, surcharge: 0, multiplier: 1, total: 0 } : generalTalentCost(talent, target, state, rules);
      return {
        valid: Number.isFinite(breakdown.total), cost: breakdown.total, breakdown,
        label: `${talent.name}: Rank ${current} → ${target}${firstFree ? " (Recovery Rank 2)" : ""}`,
        apply: () => {
          state.talents.set(tx.catalogId, target);
          if (!state.talentSources.has(tx.catalogId)) state.talentSources.set(tx.catalogId, firstFree ? "recovery" : "xp");
          if (current === 0) state.operationalOrder.push(tx.catalogId);
        }
      };
    }

    if (talent.type === "profession" || talent.type === "kin") {
      return { valid: false, issue: makeIssue("MORTAR_TALENT_ACCESS", "Мортар не имеет Profession Talents и не может покупать расовые таланты других рас.") };
    }
    if (talent.type !== "general") return { valid: false, issue: makeIssue("MORTAR_TALENT_ACCESS", "Этот талант недоступен мортару.") };
    const breakdown = generalTalentCost(talent, target, state, rules);
    return {
      valid: Number.isFinite(breakdown.total), cost: breakdown.total, breakdown,
      label: `${talent.name}: Rank ${current} → ${target}`,
      apply: () => {
        state.talents.set(tx.catalogId, target);
        if (!state.talentSources.has(tx.catalogId)) state.talentSources.set(tx.catalogId, "xp");
      }
    };
  }

  if (tx.type === "spell") return { valid: false, issue: makeIssue("MORTAR_NO_MAGIC_PATH", "Мортар не имеет Professional Path, поэтому заклинания через конструктор недоступны.") };

  if (tx.type === "reputation") {
    const amount = Number(tx.amount ?? 1);
    if (amount !== 1) return { valid: false, issue: makeIssue("XP_REPUTATION_AMOUNT", "Каждая запись журнала должна покупать ровно 1 Reputation.") };
    const cost = Number(rules.reputationXpCost ?? 4);
    return { valid: true, cost, label: `Reputation ${state.reputation} → ${state.reputation + 1}`, apply: () => { state.reputation += 1; } };
  }

  return { valid: false, issue: makeIssue("XP_LEDGER_TYPE", `Неизвестный тип покупки: ${String(tx.type ?? "?")}.`) };
}

function replayMortar(character, rules) {
  syncMortarCreation(character);
  const index = base.indexRules(rules);
  const state = createMortarState(character, rules);
  const issues = [];
  const xpBudget = base.baseXpAllowance(character);

  for (const [position, tx] of (character.experience?.ledger ?? []).entries()) {
    if (isLegacyCalibrationTransaction(tx)) continue;
    const evaluation = evaluateMortarXpTransaction(tx, character, rules, index, state);
    const path = `experience.ledger.${position}`;
    if (!evaluation.valid) {
      issues.push({ ...(evaluation.issue ?? makeIssue("XP_LEDGER_INVALID", "Недопустимая покупка.")), path });
      continue;
    }
    if (state.xpSpent + evaluation.cost > xpBudget) {
      issues.push(makeIssue("XP_OVERSPEND", `${evaluation.label}: стоимость ${evaluation.cost} XP превышает доступный остаток.`, path));
      continue;
    }
    const before = state.xpSpent;
    evaluation.apply();
    state.xpSpent += evaluation.cost;
    state.xpRemaining = xpBudget - state.xpSpent;
    state.transactionResults.push({
      position, id: tx.id ?? null, type: tx.type, label: evaluation.label, cost: evaluation.cost,
      cumulativeBefore: before, cumulativeAfter: state.xpSpent, breakdown: evaluation.breakdown ?? null,
      transaction: cloneValue(tx)
    });
  }

  const finalTalents = [...state.talents]
    .map(([catalogId, rank]) => ({ catalogId, rank, source: state.talentSources.get(catalogId) ?? "xp" }));
  const finalAttributes = Object.fromEntries(state.attributes);
  const recovery = recoveryTalent(rules);
  const recoveryRank = recovery ? (state.talents.get(recovery.catalogId) ?? 1) : 1;
  const attributeBonusPoints = recoveryAttributeBonusPoints(recoveryRank);
  const attributePointsTotal = MORTAR_BASE_ATTRIBUTE_POINTS + attributeBonusPoints;
  const attributePointsSpent = ATTRIBUTES.reduce((sum, attribute) => sum + (Number(finalAttributes[attribute]) || 0), 0);
  const attributeMaximum = mortarAttributeMaximumForRank(recoveryRank);
  const result = {
    issues,
    age: null,
    ageCategory: "mortar",
    categoryRules: { ...rules.ageCategories.mortar, attributePoints: attributePointsTotal },
    ageTalents: { issues: [], records: [], total: 0, spent: 0, remaining: 0 },
    startingSpells: { issues: [], records: [], initialPath: null, initialRank: 0, expectedTotal: 0, maximumTotal: 0, limitsByRank: {}, actualTotal: 0, allowedDisciplines: [] },
    state,
    mortar: {
      recoveryRank,
      attributeBasePoints: MORTAR_BASE_ATTRIBUTE_POINTS,
      attributeBonusPoints,
      attributePointsTotal,
      attributePointsSpent,
      attributeMaximum
    },
    final: {
      attributes: finalAttributes,
      skills: Object.fromEntries(state.skills),
      talents: finalTalents,
      spells: [],
      reputation: state.reputation,
      xpSpent: state.xpSpent,
      xpBudget,
      xpRemaining: xpBudget - state.xpSpent,
      transactionResults: state.transactionResults
    }
  };
  const ui = currentUiState();
  const key = String(character.characterId ?? "").trim();
  if (ui && key && ui.characterId === key) {
    ui.derived = {
      recoveryRank,
      attributeBasePoints: MORTAR_BASE_ATTRIBUTE_POINTS,
      attributeBonusPoints,
      attributePointsTotal,
      attributePointsSpent,
      attributeMaximum,
      finalAttributes,
      xpBudget,
      xpSpent: state.xpSpent,
      xpRemaining: xpBudget - state.xpSpent,
      operationalProtocols: state.operationalOrder.map(id => ({ name: index.talents.get(id)?.name ?? id, rank: state.talents.get(id) ?? 0 }))
    };
  }
  return result;
}

export function ageCategoryFor(kin, age) {
  return kin?.id === "mortar" ? "mortar" : base.ageCategoryFor(kin, age);
}

export function professionFocuses(character, rules) {
  return isMortarCharacter(character) ? [] : base.professionFocuses(character, rules);
}

export function attributeMaximum(attribute, character, rules) {
  if (!isMortarCharacter(character)) return base.attributeMaximum(attribute, character, rules);
  return replayMortar(character, rules).mortar.attributeMaximum;
}

export function allowedSpellDisciplines(character, rules, finalTalents = null) {
  return isMortarCharacter(character) ? [] : base.allowedSpellDisciplines(character, rules, finalTalents);
}

export function replayCharacter(character, rules) {
  return isMortarCharacter(character) ? replayMortar(character, rules) : base.replayCharacter(character, rules);
}

export function simulateXpTransaction(character, rules, transaction) {
  if (!isMortarCharacter(character)) return base.simulateXpTransaction(character, rules, transaction);
  const replay = replayMortar(character, rules);
  if (replay.issues.length) return { valid: false, issue: replay.issues[0], replay };
  const index = base.indexRules(rules);
  const evaluation = evaluateMortarXpTransaction(transaction, character, rules, index, replay.state);
  if (!evaluation.valid) return { ...evaluation, replay };
  const remaining = base.baseXpAllowance(character) - replay.final.xpSpent;
  if (evaluation.cost > remaining) return { valid: false, cost: evaluation.cost, issue: makeIssue("XP_NOT_ENOUGH", `Нужно ${evaluation.cost} XP, доступно ${remaining}.`), replay };
  return { ...evaluation, replay, remainingAfter: remaining - evaluation.cost };
}

export function simulateAgeTalentTransaction(character, rules, transaction) {
  if (!isMortarCharacter(character)) return base.simulateAgeTalentTransaction(character, rules, transaction);
  return { valid: false, issue: makeIssue("MORTAR_NO_AGE_TALENTS", "Мортар не получает General Talents при создании. Их можно изучать после создания за XP."), replay: replayMortar(character, rules) };
}

function mortarMechanicalValidation(character, rules, replay) {
  const errors = [];
  const add = (code, message, path = "") => errors.push({ code, message, path });
  const recoveryRank = replay.mortar.recoveryRank;
  const attributeTarget = replay.mortar.attributePointsTotal;
  const attributeMaximum = replay.mortar.attributeMaximum;
  let attributeTotal = 0;
  for (const attribute of ATTRIBUTES) {
    const value = Number(character.attributes?.[attribute]);
    attributeTotal += Number.isFinite(value) ? value : 0;
    if (!Number.isInteger(value) || value < 2) add("ATTRIBUTE_MIN", `${attribute}: значение должно быть целым и не ниже 2.`, `attributes.${attribute}`);
    if (value > attributeMaximum) add("ATTRIBUTE_MAX", `${attribute}: при Recovery Protocol Rank ${recoveryRank} максимум ${attributeMaximum}.`, `attributes.${attribute}`);
  }
  if (attributeTotal !== attributeTarget) {
    const bonusText = replay.mortar.attributeBonusPoints ? `, включая +${replay.mortar.attributeBonusPoints} от Recovery Protocol` : "";
    add("ATTRIBUTE_TOTAL", `Мортар должен распределить ровно ${attributeTarget} очков характеристик${bonusText}, сейчас ${attributeTotal}.`, "attributes");
  }

  let skillPoints = 0;
  for (const skill of rules.skills) {
    const starting = Number(character.skills?.[skill.id]?.startingRank ?? 0);
    if (!Number.isInteger(starting) || starting < 0 || starting > 2) add("SKILL_CAP", `${skill.name}: стартовый ранг мортара должен быть от 0 до 2.`, `skills.${skill.id}.startingRank`);
    skillPoints += startingSkillCost(starting);
  }
  if (skillPoints !== 10) add("SKILL_POINTS", `Мортар должен потратить ровно 10 очков навыков, сейчас ${skillPoints}.`, "skills");

  if (character.creation?.initialPathCatalogId) add("MORTAR_NO_PROFESSION_PATH", "Мортар не выбирает Professional Path.", "creation.initialPathCatalogId");
  if ((character.creation?.ageTalentLedger ?? []).length) add("MORTAR_NO_STARTING_GENERAL_TALENTS", "Мортар не получает General Talents при создании.", "creation.ageTalentLedger");
  if ((character.creation?.startingSpells ?? []).length) add("MORTAR_NO_STARTING_SPELLS", "Мортар не имеет стартовых заклинаний через Professional Path.", "creation.startingSpells");

  const killerRoll = Number(character.creation?.mortar?.killerRoll);
  if (![1, 2].includes(killerRoll)) add("MORTAR_KILLER_ROLL", "Сделайте обязательный D2 бросок Reputation «Убийца».", "creation.mortar.killerRoll");
  if (!isD66(character.creation?.mortar?.defectRoll)) add("MORTAR_DEFECT_ROLL", "Сделайте обязательный D66 бросок дефекта.", "creation.mortar.defectRoll");

  const knownOps = operationalTalents(rules).filter(entry => replay.state.talents.has(entry.catalogId));
  if (recoveryRank >= 2 && knownOps.length < 1) add("MORTAR_FIRST_PROTOCOL_REQUIRED", "Recovery Protocol Rank 2 требует выбрать первый Operational Protocol Rank 1. Он бесплатный.", "experience.ledger");

  errors.push(...replay.issues);
  return errors;
}

export function validateCharacter(character, rules) {
  if (!isMortarCharacter(character)) return base.validateCharacter(character, rules);
  syncMortarCreation(character);
  const baseline = base.validateCharacter(character, rules);
  const ignoredCodes = new Set([
    "PROFESSION_UNKNOWN", "PROFESSION_DISABLED", "BIRTH_DATE", "AGE_MIN", "AGE_MAX",
    "ATTRIBUTE_MIN", "ATTRIBUTE_MAX", "ATTRIBUTE_TOTAL", "SKILL_START", "SKILL_CAP", "SKILL_POINTS", "OLD_SKILL_FOUR",
    "PATH_MISSING", "PATH_ACCESS", "PATH_DISABLED", "AGE_TALENT_POINTS", "REPUTATION_TOTAL", "REPUTATION_DESCRIPTION"
  ]);
  const ignoredPrefixes = ["XP_", "AGE_", "STARTING_SPELL", "MORTAR_"];
  const keep = issue => !ignoredCodes.has(issue.code) && !ignoredPrefixes.some(prefix => issue.code.startsWith(prefix));
  const errors = baseline.errors.filter(keep);
  const warnings = baseline.warnings.filter(keep);
  const replay = replayMortar(character, rules);
  errors.push(...mortarMechanicalValidation(character, rules, replay));

  const reputationEntries = base.normalizeReputationEntries(character.reputation);
  const reputationTotal = reputationEntries.reduce((sum, entry) => sum + entry.amount, 0);
  if (reputationTotal !== replay.final.reputation) errors.push(makeIssue("REPUTATION_TOTAL", `В записях распределено ${reputationTotal} из ${replay.final.reputation} пунктов репутации.`, "reputation.entries"));
  for (const [position, entry] of reputationEntries.entries()) if (!entry.description) errors.push(makeIssue("REPUTATION_DESCRIPTION", `У записи репутации ${position + 1} не указано, почему она получена.`, `reputation.entries.${position}.description`));

  const hiddenTalents = new Set(rules.builderSettings?.hiddenTalentCatalogIds ?? []);
  const index = base.indexRules(rules);
  for (const selection of replay.final.talents) {
    if (hiddenTalents.has(selection.catalogId)) errors.push(makeIssue("TALENT_DISABLED", `${index.talents.get(selection.catalogId)?.name ?? selection.catalogId} отключён в текущем пакете кампании.`, "experience.ledger"));
  }

  const languageBudget = base.languageBudget(character);
  const languageSpent = base.totalLanguageCost(character, rules);
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    derived: {
      age: null,
      ageCategory: "mortar",
      attributeMaxima: Object.fromEntries(ATTRIBUTES.map(attribute => [attribute, replay.mortar.attributeMaximum])),
      attributePoints: {
        base: replay.mortar.attributeBasePoints,
        bonus: replay.mortar.attributeBonusPoints,
        total: replay.mortar.attributePointsTotal,
        spent: replay.mortar.attributePointsSpent,
        remaining: replay.mortar.attributePointsTotal - replay.mortar.attributePointsSpent
      },
      finalAttributes: replay.final.attributes,
      languageBudget,
      languageSpent,
      allowedSpellDisciplines: [],
      ageTalentPoints: { total: 0, spent: 0, remaining: 0 },
      startingSpells: { expected: 0, actual: 0 },
      finalSkills: replay.final.skills,
      finalTalents: replay.final.talents,
      finalSpells: [],
      reputation: replay.final.reputation,
      xpSpent: replay.final.xpSpent,
      xpBudget: replay.final.xpBudget,
      xpRemaining: replay.final.xpRemaining,
      xpLedger: replay.final.transactionResults
    }
  };
}

export function characterToQuickAccessBiographyProfile(character, rules) {
  const profile = base.characterToQuickAccessBiographyProfile(character, rules);
  if (!isMortarCharacter(character)) return profile;
  profile.identity.profession = "Нет";
  const awakeningDate = profile.identity.birthDate ?? {};
  profile.identity.birthDate = {
    ...awakeningDate,
    label: awakeningDate.label ? `Пробуждение: ${awakeningDate.label}` : "Пробуждение не указано"
  };
  return profile;
}

export function characterToActorData(character, rules, options = {}) {
  if (!isMortarCharacter(character)) {
    const safeCharacter = options.allowInvalid === true ? safeActorConversionCharacter(character) : character;
    const result = base.characterToActorData(safeCharacter, rules, options);
    if (safeCharacter !== character && result.actorData?.flags?.[MODULE_ID]) result.actorData.flags[MODULE_ID].profile = cloneValue(character);
    return result;
  }
  syncMortarCreation(character);
  const validation = validateCharacter(character, rules);
  if (!validation.valid && options.allowInvalid !== true) throw new base.RuleError("INVALID_CHARACTER", "Нельзя создать Actor из невалидного файла персонажа.");

  const skeletonCharacter = safeActorConversionCharacter(character);
  const skeleton = base.characterToActorData(skeletonCharacter, rules, { ...options, allowInvalid: true });
  const actorData = skeleton.actorData;
  const index = base.indexRules(rules);
  const finalAttributes = validation.derived.finalAttributes ?? character.attributes ?? {};
  for (const attribute of ATTRIBUTES) {
    const value = Number(finalAttributes[attribute] ?? 0);
    actorData.system.attribute[attribute].value = value;
    actorData.system.attribute[attribute].max = value;
  }
  for (const skill of rules.skills) actorData.system.skill[skill.id].value = validation.derived.finalSkills[skill.id] ?? 0;
  actorData.system.bio.profession.value = "Нет";
  actorData.system.bio.age.value = 0;
  actorData.system.bio.reputation.value = validation.derived.reputation;
  actorData.system.bio.experience.value = validation.derived.xpRemaining;

  const quickAccessBiography = characterToQuickAccessBiographyProfile(character, rules);
  const reputationEntries = base.normalizeReputationEntries(character.reputation);
  actorData.flags["fbl-quick-access"] = { reputationEntries: cloneValue(reputationEntries), biographyProfile: cloneValue(quickAccessBiography) };
  actorData.flags[MODULE_ID] ??= {};
  actorData.flags[MODULE_ID].profile = cloneValue(character);
  actorData.flags[MODULE_ID].audit = {
    baseXp: Number(character.experience?.baseTotal ?? 0),
    xpBudget: validation.derived.xpBudget,
    xpSpent: validation.derived.xpSpent,
    xpRemaining: validation.derived.xpRemaining,
    transactionResults: cloneValue(validation.derived.xpLedger),
    forcedImport: options.allowInvalid === true && !validation.valid,
    validationErrors: cloneValue(validation.errors),
    validationWarnings: cloneValue(validation.warnings)
  };
  const recovery = recoveryTalent(rules);
  const replay = replayMortar(character, rules);
  const recoveryRank = recovery ? (replay.state.talents.get(recovery.catalogId) ?? 1) : 1;
  actorData.flags[MODULE_ID].mortar = {
    killerRoll: Number(character.creation?.mortar?.killerRoll) || null,
    defectRoll: Number(character.creation?.mortar?.defectRoll) || null,
    recoveryRank,
    attributeBonusPoints: replay.mortar.attributeBonusPoints,
    maxOverload: Number(finalAttributes.wits ?? 0) * 2 + (recoveryRank >= 5 ? 2 : 0),
    startingResources: { ordinarySpareParts: "1D10", precisionSpareParts: "1D8" },
    rules: {
      builtInArmor: 2,
      slashingDamageReduction: 1,
      naturalPhysicalRecovery: false,
      diseaseImmune: true,
      requiresFoodWaterSleepBreathing: false
    }
  };

  const items = [];
  for (const selection of validation.derived.finalTalents) {
    const talent = index.talents.get(selection.catalogId);
    if (!talent) continue;
    items.push(base.sanitizeEmbeddedItem(talent.snapshot, selection.rank, options.foundryGeneration));
  }
  return { actorData, items, validation };
}
