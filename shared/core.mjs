const ATTRIBUTES = ["strength", "agility", "wits", "empathy"];
const LEVEL_ORDER = { basic: 1, full: 2, academic: 3 };
const cloneValue = value => typeof globalThis.structuredClone === "function" ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value));

export class RuleError extends Error {
  constructor(code, message, path = "") {
    super(message);
    this.name = "RuleError";
    this.code = code;
    this.path = path;
  }
}

export function indexRules(rules) {
  return {
    kin: new Map(rules.kin.map(entry => [entry.id, entry])),
    professions: new Map(rules.professions.map(entry => [entry.id, entry])),
    skills: new Map(rules.skills.map(entry => [entry.id, entry])),
    languages: new Map(rules.languages.map(entry => [entry.id, entry])),
    origins: new Map(rules.origins.map(entry => [entry.id, entry])),
    talents: new Map(rules.catalogs.talents.items.map(entry => [entry.catalogId, entry])),
    spells: new Map(rules.catalogs.spells.items.map(entry => [entry.catalogId, entry])),
    months: new Map(rules.calendar.months.map(entry => [entry.id, entry])),
    religions: new Map((rules.religions ?? []).map(entry => [entry.id, entry]))
  };
}

export function compareCalendarDate(a, b, rules) {
  const index = indexRules(rules);
  const aMonth = index.months.get(a?.month)?.order ?? 0;
  const bMonth = index.months.get(b?.month)?.order ?? 0;
  return (Number(a?.year) - Number(b?.year)) || (aMonth - bMonth) || (Number(a?.day) - Number(b?.day));
}

export function calculateAge(birthDate, currentDate, rules) {
  if (!birthDate || !currentDate) return null;
  const index = indexRules(rules);
  if (!index.months.has(birthDate.month) || !index.months.has(currentDate.month)) return null;
  if (!Number.isInteger(Number(birthDate.year)) || !Number.isInteger(Number(birthDate.day))) return null;
  let age = Number(currentDate.year) - Number(birthDate.year);
  const birthdayThisYear = { ...birthDate, year: currentDate.year };
  if (compareCalendarDate(currentDate, birthdayThisYear, rules) < 0) age -= 1;
  return age;
}

export function ageCategoryFor(kin, age) {
  if (!kin || !Number.isInteger(age)) return null;
  if (age <= kin.youngMax) return "young";
  if (age <= kin.adultMax) return "adult";
  return "old";
}

function plannedTalentCatalogIds(character) {
  const ids = new Set();
  if (character.creation?.initialPathCatalogId) ids.add(character.creation.initialPathCatalogId);
  for (const tx of character.creation?.ageTalentLedger ?? []) if (tx.catalogId) ids.add(tx.catalogId);
  for (const tx of character.experience?.ledger ?? []) if (tx.type === "talent" && tx.catalogId) ids.add(tx.catalogId);
  return ids;
}

export function kinFocuses(character, rules) {
  const index = indexRules(rules);
  const kin = index.kin.get(character.identity?.kinId);
  if (!kin) return [];
  const variant = kin.variants?.find(entry => entry.id === character.identity?.kinVariantId);
  const focus = variant?.selectableFocus ? character.identity?.kinFocus : (variant?.focus ?? kin.focus);
  return ATTRIBUTES.includes(focus) ? [focus] : [];
}

export function professionFocuses(character, rules) {
  const index = indexRules(rules);
  const profession = index.professions.get(character.identity?.professionId);
  if (!profession) return [];
  const focuses = new Set(profession.focus ?? []);
  const initialPath = index.talents.get(character.creation?.initialPathCatalogId);
  const pathKeys = new Set(initialPath?.type === "profession" ? [initialPath.pathKey] : []);
  for (const conditional of profession.conditionalFocus ?? []) {
    if (pathKeys.has(conditional.pathKey)) focuses.add(conditional.attribute);
  }
  return [...focuses];
}

export function attributeMaximum(attribute, character, rules) {
  let maximum = 4;
  const kin = kinFocuses(character, rules).includes(attribute);
  const profession = professionFocuses(character, rules).includes(attribute);
  if (kin || profession) maximum = 5;
  if (kin && profession) maximum = 6;

  const index = indexRules(rules);
  const kinEntry = index.kin.get(character.identity?.kinId);
  const age = calculateAge(character.identity?.birthDate, rules.campaignDate, rules);
  for (const cap of kinEntry?.hardCaps ?? []) {
    if (age >= cap.minimumAge && cap.attribute === attribute) maximum = Math.min(maximum, cap.maximum);
  }
  return maximum;
}

export function languageBudget(character) {
  const wits = Number(character.attributes?.wits ?? 0);
  const lore = Number(character.skills?.lore?.startingRank ?? 0);
  return Math.max(0, wits - 2) + Math.max(0, lore) * 2;
}

export function baseXpAllowance(character) {
  const raw = Math.max(0, Number(character.experience?.baseTotal ?? 0) || 0);
  return Number(character.formatVersion ?? 0) >= 6 ? Math.ceil(raw * 0.2) : raw;
}

export function languageBaseCost(language, level, character, rules) {
  if (!language?.levels || language.levels[level] === undefined) return null;
  let cost = language.levels[level];
  const kinKey = `${character.identity?.kinId}:${character.identity?.kinVariantId}`;
  cost = language.kinVariantCosts?.[kinKey]?.[level] ?? language.kinCosts?.[character.identity?.kinId]?.[level] ?? cost;

  const appliedDiscountGroups = new Set();
  for (const discount of language.discounts ?? []) {
    let applies = discount.origins?.includes(character.identity?.originId) ?? false;
    if (discount.requiresLanguage) {
      const known = (character.languages ?? []).find(item => item.languageId === discount.requiresLanguage.id);
      applies ||= Boolean(known && LEVEL_ORDER[known.level] >= LEVEL_ORDER[discount.requiresLanguage.minimumLevel]);
    }
    if (!applies) continue;
    if (discount.group && appliedDiscountGroups.has(discount.group)) continue;
    cost -= discount.amount;
    if (discount.group) appliedDiscountGroups.add(discount.group);
  }

  const random = language.randomDiscount;
  const randomResult = (character.languageRolls ?? []).find(item => item.languageId === language.id && item.level === level);
  if (random && random.level === level && randomResult?.result >= random.successMinimum) cost = Math.min(cost, random.discountedCost);
  return Math.max(0, cost);
}

export function languageSelectionCost(selection, character, rules) {
  const index = indexRules(rules);
  const language = index.languages.get(selection.languageId);
  const targetCost = languageBaseCost(language, selection.level, character, rules);
  if (targetCost === null) return null;
  if (!selection.native) return targetCost;

  let nativeBase = languageBaseCost(language, "basic", character, rules);
  if (nativeBase === null) nativeBase = 0;
  return Math.max(0, targetCost - nativeBase);
}

export function totalLanguageCost(character, rules) {
  return (character.languages ?? []).reduce((sum, selection) => {
    const cost = languageSelectionCost(selection, character, rules);
    return sum + (Number.isFinite(cost) ? cost : 0);
  }, 0);
}

export function startingSkillCost(rank) {
  const costs = [0, 1, 2, 4, 7, 11];
  return costs[rank] ?? Number.POSITIVE_INFINITY;
}

export function skillXpCost(skillId, fromRank, toRank, professionId, rules) {
  const index = indexRules(rules);
  const profession = index.professions.get(professionId);
  const table = profession?.skills.includes(skillId) ? rules.skillXpCosts.profession : rules.skillXpCosts.other;
  let total = 0;
  for (let rank = fromRank + 1; rank <= toRank; rank += 1) total += table[rank - 1] ?? Number.POSITIVE_INFINITY;
  return total;
}

export function allowedNativeLanguages(character, rules) {
  const index = indexRules(rules);
  const origin = index.origins.get(character.identity?.originId);
  const keys = new Set(origin?.nativeLanguages ?? []);
  const kinVariantKey = `${character.identity?.kinId}:${character.identity?.kinVariantId}`;
  for (const id of rules.racialNativeLanguages?.[character.identity?.kinId] ?? []) keys.add(id);
  for (const id of rules.racialNativeLanguages?.[kinVariantKey] ?? []) keys.add(id);
  return [...keys];
}

function magicalPathsFromTalentMap(talents, index, rules) {
  const paths = [];
  for (const [catalogId, rank] of talents) {
    const talent = index.talents.get(catalogId);
    if (!talent?.magical || talent.type !== "profession") continue;
    const discipline = rules.spellDisciplineMap[talent.disciplineKey];
    if (discipline) paths.push({ catalogId, rank, talent, discipline });
  }
  return paths;
}

export function allowedSpellDisciplines(character, rules, finalTalents = null) {
  const index = indexRules(rules);
  const disciplines = new Set();
  const talents = finalTalents instanceof Map
    ? finalTalents
    : new Map([...plannedTalentCatalogIds(character)].map(id => [id, 1]));
  const paths = magicalPathsFromTalentMap(talents, index, rules);
  for (const path of paths) disciplines.add(path.discipline);
  if (paths.length) disciplines.add(rules.spellDisciplineMap.general);
  return [...disciplines];
}

function makeIssue(code, message, path = "") {
  return { code, message, path };
}

function createProgressionState(character, rules, index, categoryRules) {
  const skills = new Map();
  for (const skill of rules.skills) skills.set(skill.id, Number(character.skills?.[skill.id]?.startingRank ?? 0));

  const talents = new Map();
  const talentSources = new Map();
  const kin = index.kin.get(character.identity?.kinId);
  if (kin?.talentCatalogId) {
    talents.set(kin.talentCatalogId, 1);
    talentSources.set(kin.talentCatalogId, "kin");
  }

  const initialPathId = character.creation?.initialPathCatalogId;
  if (initialPathId) {
    talents.set(initialPathId, 1);
    talentSources.set(initialPathId, "profession");
  }

  return {
    skills,
    talents,
    talentSources,
    spells: new Map(),
    reputation: categoryRules?.reputation ?? 0,
    xpSpent: 0,
    xpRemaining: baseXpAllowance(character),
    transactionResults: []
  };
}

function replayAgeTalents(character, rules, index, state) {
  const issues = [];
  const records = [];
  const kin = index.kin.get(character.identity?.kinId);
  const age = calculateAge(character.identity?.birthDate, rules.campaignDate, rules);
  const category = ageCategoryFor(kin, age);
  const total = rules.ageCategories[category]?.talentPoints ?? 0;
  let spent = 0;
  const initialPathId = character.creation?.initialPathCatalogId;

  for (const [position, tx] of (character.creation?.ageTalentLedger ?? []).entries()) {
    const path = `creation.ageTalentLedger.${position}`;
    if (tx?.type !== "talent") {
      issues.push(makeIssue("AGE_LEDGER_TYPE", "Возрастные очки можно тратить только на таланты.", path));
      continue;
    }
    const talent = index.talents.get(tx.catalogId);
    if (!talent) {
      issues.push(makeIssue("AGE_TALENT_UNKNOWN", "В журнале возрастных очков указан неизвестный талант.", path));
      continue;
    }
    const current = state.talents.get(tx.catalogId) ?? 0;
    const target = Number(tx.toRank);
    if (!Number.isInteger(target) || target !== current + 1 || target > 5) {
      issues.push(makeIssue("AGE_TALENT_SEQUENCE", `${talent.name}: ожидался переход ${current} → ${current + 1}.`, path));
      continue;
    }

    let cost = 0;
    if (talent.type === "general") cost = 1;
    else if (talent.type === "profession" && tx.catalogId === initialPathId && current >= 1) cost = talent.magical ? 2 : 1;
    else {
      issues.push(makeIssue("AGE_TALENT_ACCESS", `${talent.name} нельзя получить за возрастные очки.`, path));
      continue;
    }

    if (spent + cost > total) {
      issues.push(makeIssue("AGE_TALENT_OVERRUN", `${talent.name}: не хватает возрастных очков.`, path));
      continue;
    }
    spent += cost;
    state.talents.set(tx.catalogId, target);
    if (!state.talentSources.has(tx.catalogId)) state.talentSources.set(tx.catalogId, "age");
    records.push({ ...cloneValue(tx), cost, name: talent.name, fromRank: current, toRank: target });
  }

  return { issues, records, total, spent, remaining: total - spent };
}

function startingSpellLimitForRank(rules, rank) {
  const configuredLimits = rules.startingSpellLimitByRank;
  if (!configuredLimits) return Number(rules.spellLimitPerRank ?? 5);
  if (!Object.prototype.hasOwnProperty.call(configuredLimits, String(rank))) return 0;
  const configured = Number(configuredLimits[String(rank)]);
  return Number.isFinite(configured) && configured >= 0 ? configured : 0;
}

function replayStartingSpells(character, rules, index, state) {
  const issues = [];
  const records = [];
  const initialPathId = character.creation?.initialPathCatalogId;
  const initialPath = index.talents.get(initialPathId);
  const initialRank = state.talents.get(initialPathId) ?? 0;
  const maximumByRank = new Map();
  if (initialPath?.magical) {
    for (let rank = 1; rank <= initialRank; rank += 1) maximumByRank.set(rank, startingSpellLimitForRank(rules, rank));
  }
  const allowed = new Set(initialPath?.magical
    ? [rules.spellDisciplineMap.general, rules.spellDisciplineMap[initialPath.disciplineKey]].filter(Boolean)
    : []);
  const counts = new Map();

  for (const [position, raw] of (character.creation?.startingSpells ?? []).entries()) {
    const catalogId = typeof raw === "string" ? raw : raw?.catalogId;
    const path = `creation.startingSpells.${position}`;
    const spell = index.spells.get(catalogId);
    if (!spell) {
      issues.push(makeIssue("STARTING_SPELL_UNKNOWN", "Указано неизвестное стартовое заклинание.", path));
      continue;
    }
    if (!initialPath?.magical) {
      issues.push(makeIssue("STARTING_SPELL_NONMAGIC", "Немагический персонаж не получает стартовые заклинания.", path));
      continue;
    }
    if (state.spells.has(catalogId)) {
      issues.push(makeIssue("STARTING_SPELL_DUPLICATE", `${spell.name} выбрано дважды.`, path));
      continue;
    }
    if (!allowed.has(spell.discipline)) {
      issues.push(makeIssue("STARTING_SPELL_DISCIPLINE", `${spell.name}: стартово доступна только школа первого Path или General Spells.`, path));
      continue;
    }
    if (spell.rank < 1 || spell.rank > initialRank) {
      issues.push(makeIssue("STARTING_SPELL_RANK", `${spell.name}: для стартового Path Rank ${initialRank} этот ранг недоступен.`, path));
      continue;
    }
    state.spells.set(catalogId, "starting");
    counts.set(spell.rank, (counts.get(spell.rank) ?? 0) + 1);
    records.push({ catalogId, name: spell.name, rank: spell.rank, discipline: spell.discipline, source: "starting" });
  }

  if (initialPath?.magical) {
    for (const [rank, maximum] of maximumByRank) {
      const actual = counts.get(rank) ?? 0;
      if (actual > maximum) issues.push(makeIssue("STARTING_SPELL_COUNT", `Для Rank ${rank} бесплатно доступно не более ${maximum} заклинаний, сейчас ${actual}.`, "creation.startingSpells"));
    }
    for (const [rank, count] of counts) {
      if (!maximumByRank.has(rank) && count > 0) issues.push(makeIssue("STARTING_SPELL_EXTRA_RANK", `Стартовые заклинания Rank ${rank} недоступны.`, "creation.startingSpells"));
    }
  } else if ((character.creation?.startingSpells ?? []).length) {
    issues.push(makeIssue("STARTING_SPELLS_FORBIDDEN", "У выбранного первого Path нет стартовых заклинаний.", "creation.startingSpells"));
  }

  return {
    issues,
    records,
    initialPath,
    initialRank,
    expectedTotal: initialPath?.magical ? [...maximumByRank.values()].reduce((sum, value) => sum + value, 0) : 0,
    maximumTotal: initialPath?.magical ? [...maximumByRank.values()].reduce((sum, value) => sum + value, 0) : 0,
    limitsByRank: Object.fromEntries(maximumByRank),
    actualTotal: records.length,
    allowedDisciplines: [...allowed]
  };
}

function talentPurchaseCost(talent, targetRank, distinctTalentCount, rules) {
  const table = talent.type === "profession" ? rules.talentXpCosts.profession : rules.talentXpCosts.general;
  const base = table[targetRank - 1] ?? Number.POSITIVE_INFINITY;
  const surcharge = Math.max(0, distinctTalentCount - 5);
  let multiplier = 1;
  if (talent.type === "kin") multiplier *= Number(rules.talentXpCosts.kinMultiplier ?? 2);
  if (talent.magical) multiplier *= Number(rules.talentXpCosts.magicalMultiplier ?? 2);
  return { base, surcharge, multiplier, total: (base + surcharge) * multiplier };
}

function relevantPathRankForSpell(spell, state, rules, index) {
  const paths = magicalPathsFromTalentMap(state.talents, index, rules);
  if (spell.discipline === rules.spellDisciplineMap.general) {
    return paths.reduce((maximum, path) => Math.max(maximum, path.rank), 0);
  }
  return paths
    .filter(path => path.discipline === spell.discipline)
    .reduce((maximum, path) => Math.max(maximum, path.rank), 0);
}

function countSpellsAtRank(state, index, rank) {
  let count = 0;
  for (const catalogId of state.spells.keys()) if (index.spells.get(catalogId)?.rank === rank) count += 1;
  return count;
}

function evaluateXpTransaction(tx, character, rules, index, state) {
  if (!tx || typeof tx !== "object") return { valid: false, issue: makeIssue("XP_LEDGER_ENTRY", "Повреждённая запись журнала Base XP.") };

  if (tx.type === "skill") {
    const skill = index.skills.get(tx.skillId);
    if (!skill) return { valid: false, issue: makeIssue("XP_SKILL_UNKNOWN", "Указан неизвестный навык.") };
    const current = state.skills.get(tx.skillId) ?? 0;
    const target = Number(tx.toRank);
    if (!Number.isInteger(target) || target !== current + 1 || target > 5) {
      return { valid: false, issue: makeIssue("XP_SKILL_SEQUENCE", `${skill.name}: ожидался переход ${current} → ${current + 1}.`) };
    }
    const cost = skillXpCost(tx.skillId, current, target, character.identity?.professionId, rules);
    return { valid: true, cost, label: `${skill.name}: Rank ${current} → ${target}`, apply: () => state.skills.set(tx.skillId, target) };
  }

  if (tx.type === "talent") {
    const talent = index.talents.get(tx.catalogId);
    if (!talent) return { valid: false, issue: makeIssue("XP_TALENT_UNKNOWN", "Указан неизвестный талант.") };
    const current = state.talents.get(tx.catalogId) ?? 0;
    const target = Number(tx.toRank);
    if (!Number.isInteger(target) || target !== current + 1 || target > 5) {
      return { valid: false, issue: makeIssue("XP_TALENT_SEQUENCE", `${talent.name}: ожидался переход ${current} → ${current + 1}.`) };
    }
    if (talent.type === "kin") {
      const kin = index.kin.get(character.identity?.kinId);
      if (tx.catalogId !== kin?.talentCatalogId) return { valid: false, issue: makeIssue("XP_KIN_TALENT_ACCESS", `${talent.name} не относится к выбранной расе.`) };
    }
    if (talent.type === "profession" && !talent.professions?.includes(character.identity?.professionId)) {
      return { valid: false, issue: makeIssue("XP_PATH_ACCESS", `${talent.name} недоступен выбранной профессии.`) };
    }
    if (talent.type === "profession" && tx.catalogId !== character.creation?.initialPathCatalogId) {
      return { valid: false, issue: makeIssue("XP_ADDITIONAL_PATH_FORBIDDEN", "При создании персонажа можно выбрать только один Professional Path. Повышать можно только первый выбранный Path.") };
    }
    if (talent.magical && target > 1) {
      const discipline = rules.spellDisciplineMap[talent.disciplineKey];
      const hasRequiredSpell = [...state.spells.keys()].some(id => {
        const spell = index.spells.get(id);
        return spell?.discipline === discipline && spell.rank === target;
      });
      if (!hasRequiredSpell) {
        return { valid: false, issue: makeIssue("XP_MAGIC_PATH_PREREQUISITE", `${talent.name} Rank ${target} требует хотя бы одно заклинание своей школы Rank ${target}.`) };
      }
    }
    const distinctCount = state.talents.size + (current === 0 ? 1 : 0);
    const breakdown = talentPurchaseCost(talent, target, distinctCount, rules);
    return {
      valid: Number.isFinite(breakdown.total),
      cost: breakdown.total,
      label: `${talent.name}: Rank ${current} → ${target}`,
      breakdown,
      apply: () => {
        state.talents.set(tx.catalogId, target);
        if (!state.talentSources.has(tx.catalogId)) state.talentSources.set(tx.catalogId, "xp");
      }
    };
  }

  if (tx.type === "spell") {
    const spell = index.spells.get(tx.catalogId);
    if (!spell) return { valid: false, issue: makeIssue("XP_SPELL_UNKNOWN", "Указано неизвестное заклинание.") };
    if (state.spells.has(tx.catalogId)) return { valid: false, issue: makeIssue("XP_SPELL_DUPLICATE", `${spell.name} уже известно персонажу.`) };
    const pathRank = relevantPathRankForSpell(spell, state, rules, index);
    if (pathRank < 1) return { valid: false, issue: makeIssue("XP_SPELL_DISCIPLINE", `${spell.name}: у персонажа нет соответствующего магического Path.`) };
    if (spell.rank > pathRank + 1) {
      return { valid: false, issue: makeIssue("XP_SPELL_RANK", `${spell.name}: можно изучать заклинания не более чем на 1 ранг выше соответствующего Path (сейчас Rank ${pathRank}).`) };
    }
    const count = countSpellsAtRank(state, index, spell.rank);
    if (count >= rules.spellLimitPerRank) return { valid: false, issue: makeIssue("XP_SPELL_LIMIT", `Лимит заклинаний Rank ${spell.rank}: ${rules.spellLimitPerRank}.`) };
    const cost = rules.spellXpCosts[spell.rank - 1] ?? Number.POSITIVE_INFINITY;
    return { valid: Number.isFinite(cost), cost, label: `${spell.name} (${spell.discipline}, Rank ${spell.rank})`, apply: () => state.spells.set(tx.catalogId, "xp") };
  }

  if (tx.type === "reputation") {
    const amount = Number(tx.amount ?? 1);
    if (!Number.isInteger(amount) || amount !== 1) return { valid: false, issue: makeIssue("XP_REPUTATION_AMOUNT", "Каждая запись журнала должна покупать ровно 1 Reputation.") };
    const cost = Number(rules.reputationXpCost ?? 4);
    return { valid: true, cost, label: `Reputation ${state.reputation} → ${state.reputation + 1}`, apply: () => { state.reputation += 1; } };
  }

  return { valid: false, issue: makeIssue("XP_LEDGER_TYPE", `Неизвестный тип покупки: ${String(tx.type ?? "?")}.`) };
}

export function replayCharacter(character, rules) {
  const index = indexRules(rules);
  const kin = index.kin.get(character.identity?.kinId);
  const age = calculateAge(character.identity?.birthDate, rules.campaignDate, rules);
  const ageCategory = ageCategoryFor(kin, age);
  const categoryRules = rules.ageCategories[ageCategory];
  const state = createProgressionState(character, rules, index, categoryRules);

  const ageTalents = replayAgeTalents(character, rules, index, state);
  const startingSpells = replayStartingSpells(character, rules, index, state);
  const xpIssues = [];
  const ledger = character.experience?.ledger ?? [];
  const xpBudget = baseXpAllowance(character);

  for (const [position, tx] of ledger.entries()) {
    const evaluation = evaluateXpTransaction(tx, character, rules, index, state);
    const path = `experience.ledger.${position}`;
    if (!evaluation.valid) {
      xpIssues.push({ ...(evaluation.issue ?? makeIssue("XP_LEDGER_INVALID", "Недопустимая покупка.")), path });
      continue;
    }
    if (state.xpSpent + evaluation.cost > xpBudget) {
      xpIssues.push(makeIssue("XP_OVERSPEND", `${evaluation.label}: стоимость ${evaluation.cost} XP превышает доступный остаток.`, path));
      continue;
    }
    const before = state.xpSpent;
    evaluation.apply();
    state.xpSpent += evaluation.cost;
    state.xpRemaining = xpBudget - state.xpSpent;
    state.transactionResults.push({
      position,
      id: tx.id ?? null,
      type: tx.type,
      label: evaluation.label,
      cost: evaluation.cost,
      cumulativeBefore: before,
      cumulativeAfter: state.xpSpent,
      breakdown: evaluation.breakdown ?? null,
      transaction: cloneValue(tx)
    });
  }

  const finalSkills = Object.fromEntries(state.skills);
  const finalTalents = [...state.talents].map(([catalogId, rank]) => ({
    catalogId,
    rank,
    source: state.talentSources.get(catalogId) ?? "xp"
  }));
  const finalSpells = [...state.spells].map(([catalogId, source]) => ({ catalogId, source }));

  return {
    issues: [...ageTalents.issues, ...startingSpells.issues, ...xpIssues],
    age,
    ageCategory,
    categoryRules,
    ageTalents,
    startingSpells,
    state,
    final: {
      skills: finalSkills,
      talents: finalTalents,
      spells: finalSpells,
      reputation: state.reputation,
      xpSpent: state.xpSpent,
      xpBudget,
      xpRemaining: xpBudget - state.xpSpent,
      transactionResults: state.transactionResults
    }
  };
}

export function simulateXpTransaction(character, rules, transaction) {
  const replay = replayCharacter(character, rules);
  if (replay.issues.length) return { valid: false, issue: replay.issues[0], replay };
  if (replay.ageTalents.remaining !== 0) {
    return { valid: false, issue: makeIssue("AGE_TALENT_UNSPENT", `Сначала потратьте все возрастные очки талантов: осталось ${replay.ageTalents.remaining}.`), replay };
  }
  const index = indexRules(rules);
  const evaluation = evaluateXpTransaction(transaction, character, rules, index, replay.state);
  if (!evaluation.valid) return { ...evaluation, replay };
  const remaining = baseXpAllowance(character) - replay.final.xpSpent;
  if (evaluation.cost > remaining) {
    return { valid: false, cost: evaluation.cost, issue: makeIssue("XP_NOT_ENOUGH", `Нужно ${evaluation.cost} XP, доступно ${remaining}.`), replay };
  }
  return { ...evaluation, replay, remainingAfter: remaining - evaluation.cost };
}

export function simulateAgeTalentTransaction(character, rules, transaction) {
  const clone = cloneValue(character);
  clone.creation ??= { initialPathCatalogId: null, ageTalentLedger: [], startingSpells: [] };
  clone.creation.ageTalentLedger ??= [];
  clone.creation.ageTalentLedger.push(transaction);
  const replay = replayCharacter(clone, rules);
  const previousCount = (character.creation?.ageTalentLedger ?? []).length;
  const issue = replay.ageTalents.issues.find(entry => entry.path === `creation.ageTalentLedger.${previousCount}`) ?? replay.ageTalents.issues.at(-1);
  if (issue) return { valid: false, issue, replay };
  const record = replay.ageTalents.records.at(-1);
  return { valid: Boolean(record), record, replay };
}

export function validateCharacter(character, rules) {
  const errors = [];
  const warnings = [];
  const add = (target, code, message, path = "") => target.push({ code, message, path });
  const index = indexRules(rules);
  const builderSettings = rules.builderSettings ?? {};

  if (character.format !== "air-islands-character") add(errors, "FORMAT", "Неизвестный формат файла персонажа.", "format");
  if (![2, 3, 4, 5, 6, 7, 8].includes(character.formatVersion)) add(errors, "FORMAT_VERSION", "Неподдерживаемая версия формата персонажа. Поддерживаются версии 2–8.", "formatVersion");
  if (character.rulesHash && character.rulesHash !== rules.packageHash) add(warnings, "RULES_HASH", "Персонаж создан на другой версии пакета правил.", "rulesHash");

  const identity = character.identity ?? {};
  if (!String(identity.name ?? "").trim()) add(errors, "NAME_REQUIRED", "Не указано имя персонажа.", "identity.name");
  const kin = index.kin.get(identity.kinId);
  const profession = index.professions.get(identity.professionId);
  if (!kin) add(errors, "KIN_UNKNOWN", "Не выбрана допустимая раса.", "identity.kinId");
  if (!profession) add(errors, "PROFESSION_UNKNOWN", "Не выбрана допустимая профессия.", "identity.professionId");
  if (kin && Array.isArray(builderSettings.enabledKin) && builderSettings.enabledKin.length && !builderSettings.enabledKin.includes(identity.kinId)) add(errors, "KIN_DISABLED", `${kin.name} недоступен в текущем пакете кампании.`, "identity.kinId");
  if (profession && Array.isArray(builderSettings.enabledProfessions) && builderSettings.enabledProfessions.length && !builderSettings.enabledProfessions.includes(identity.professionId)) add(errors, "PROFESSION_DISABLED", `${profession.name} недоступна в текущем пакете кампании.`, "identity.professionId");
  if (identity.religionId && !index.religions.has(identity.religionId)) add(errors, "RELIGION_UNKNOWN", "Выбрано неизвестное верование.", "identity.religionId");

  if (kin?.variants?.length && !kin.variants.some(entry => entry.id === identity.kinVariantId)) add(errors, "KIN_VARIANT", "Не выбран допустимый вариант расы.", "identity.kinVariantId");
  const selectedVariant = kin?.variants?.find(entry => entry.id === identity.kinVariantId);
  if (selectedVariant?.selectableFocus && !ATTRIBUTES.includes(identity.kinFocus)) add(errors, "KIN_FOCUS", "Гвирл должен выбрать фокусную характеристику.", "identity.kinFocus");

  const age = calculateAge(identity.birthDate, rules.campaignDate, rules);
  if (!Number.isInteger(age) || Number(identity.birthDate?.day) < 1 || Number(identity.birthDate?.day) > rules.calendar.daysPerMonth) add(errors, "BIRTH_DATE", "Дата рождения заполнена неверно.", "identity.birthDate");
  if (kin && Number.isInteger(age)) {
    if (age < kin.minimumAge) add(errors, "AGE_MIN", `Минимальный возраст: ${kin.minimumAge}.`, "identity.birthDate");
    if (age > kin.maximumAge) add(errors, "AGE_MAX", `Максимальный возраст для расы: ${kin.maximumAge}.`, "identity.birthDate");
  }
  const category = ageCategoryFor(kin, age);
  const categoryRules = rules.ageCategories[category];

  const attributes = character.attributes ?? {};
  let attributeTotal = 0;
  for (const attribute of ATTRIBUTES) {
    const value = Number(attributes[attribute]);
    attributeTotal += Number.isFinite(value) ? value : 0;
    if (!Number.isInteger(value) || value < 2) add(errors, "ATTRIBUTE_MIN", `${attribute}: значение должно быть целым и не ниже 2.`, `attributes.${attribute}`);
    const maximum = attributeMaximum(attribute, character, rules);
    if (value > maximum) add(errors, "ATTRIBUTE_MAX", `${attribute}: максимум ${maximum}.`, `attributes.${attribute}`);
  }
  if (categoryRules && attributeTotal !== categoryRules.attributePoints) add(errors, "ATTRIBUTE_TOTAL", `Нужно распределить ровно ${categoryRules.attributePoints} очков характеристик, сейчас ${attributeTotal}.`, "attributes");

  let skillPoints = 0;
  let oldRankFourCount = 0;
  for (const skill of rules.skills) {
    const starting = Number(character.skills?.[skill.id]?.startingRank ?? 0);
    if (!Number.isInteger(starting) || starting < 0 || starting > 4) add(errors, "SKILL_START", `${skill.name}: неверный стартовый ранг.`, `skills.${skill.id}.startingRank`);
    skillPoints += startingSkillCost(starting);
    if (category && profession) {
      const classSkill = profession.skills.includes(skill.id);
      const cap = category === "young" ? (classSkill ? 2 : 1) : (classSkill ? 3 : 2);
      if (category === "old" && classSkill && starting === 4) oldRankFourCount += 1;
      else if (starting > cap) add(errors, "SKILL_CAP", `${skill.name}: стартовый максимум ${cap}.`, `skills.${skill.id}.startingRank`);
    }
  }
  if (category === "old" && oldRankFourCount > 1) add(errors, "OLD_SKILL_FOUR", "Старый персонаж может иметь только один классовый навык 4 ранга на старте.", "skills");
  if (categoryRules && skillPoints !== categoryRules.skillPoints) add(errors, "SKILL_POINTS", `Нужно потратить ровно ${categoryRules.skillPoints} очков навыков, сейчас ${skillPoints}.`, "skills");

  const initialPathId = character.creation?.initialPathCatalogId;
  const initialPath = index.talents.get(initialPathId);
  if (!initialPath || initialPath.type !== "profession") add(errors, "PATH_MISSING", "Не выбран первый профессиональный Path.", "creation.initialPathCatalogId");
  else if (!initialPath.professions?.includes(identity.professionId)) add(errors, "PATH_ACCESS", `${initialPath.name} недоступен профессии ${profession?.name ?? ""}.`, "creation.initialPathCatalogId");
  else if (Array.isArray(builderSettings.enabledPathCatalogIds) && builderSettings.enabledPathCatalogIds.length && !builderSettings.enabledPathCatalogIds.includes(initialPathId)) add(errors, "PATH_DISABLED", `${initialPath.name} отключён в текущем пакете кампании.`, "creation.initialPathCatalogId");

  const replay = replayCharacter(character, rules);
  for (const issue of replay.issues) errors.push(issue);
  const hiddenTalents = new Set(builderSettings.hiddenTalentCatalogIds ?? []);
  for (const selection of replay.final.talents) {
    const talent = index.talents.get(selection.catalogId);
    if (hiddenTalents.has(selection.catalogId)) add(errors, "TALENT_DISABLED", `${talent?.name ?? selection.catalogId} отключён в текущем пакете кампании.`, "creation.ageTalentLedger");
  }
  const hiddenDisciplines = new Set(builderSettings.hiddenSpellDisciplines ?? []);
  for (const selection of replay.final.spells) {
    const spell = index.spells.get(selection.catalogId);
    if (spell && hiddenDisciplines.has(spell.discipline)) add(errors, "SPELL_SCHOOL_DISABLED", `Школа «${spell.discipline}» отключена в текущем пакете кампании.`, "creation.startingSpells");
  }
  if (replay.ageTalents.spent !== replay.ageTalents.total) add(errors, "AGE_TALENT_POINTS", `Нужно потратить ровно ${replay.ageTalents.total} возрастных очков талантов, сейчас ${replay.ageTalents.spent}.`, "creation.ageTalentLedger");

  const baseXp = Number(character.experience?.baseTotal ?? 0);
  if (!Number.isInteger(baseXp) || baseXp < 0) add(errors, "XP_VALUES", "Base XP должен быть целым и неотрицательным.", "experience.baseTotal");
  const maximumBaseXp = builderSettings.maximumBaseXp === null || builderSettings.maximumBaseXp === undefined || builderSettings.maximumBaseXp === ""
    ? null
    : Number(builderSettings.maximumBaseXp);
  if (maximumBaseXp !== null && Number.isFinite(maximumBaseXp) && maximumBaseXp >= 0 && baseXp > maximumBaseXp) add(errors, "XP_CAP", `В текущем пакете кампании разрешено не более ${maximumBaseXp} Base XP.`, "experience.baseTotal");

  const nativeLanguages = (character.languages ?? []).filter(entry => entry.native);
  if (nativeLanguages.length > 1) add(errors, "NATIVE_LANGUAGE_COUNT", "Бесплатным может быть только один родной язык.", "languages");
  if (nativeLanguages.length === 1 && !allowedNativeLanguages(character, rules).includes(nativeLanguages[0].languageId)) add(errors, "NATIVE_LANGUAGE_INVALID", "Выбранный бесплатный родной язык не соответствует происхождению или расе.", "languages");
  const languageIds = new Set();
  for (const selection of character.languages ?? []) {
    const language = index.languages.get(selection.languageId);
    if (languageIds.has(selection.languageId)) add(errors, "LANGUAGE_DUPLICATE", `${language?.name ?? selection.languageId} добавлен дважды.`, "languages");
    languageIds.add(selection.languageId);
    if (!language || language.levels?.[selection.level] === undefined) add(errors, "LANGUAGE_LEVEL", "Неизвестный язык или недоступный уровень.", "languages");
    if (language?.creationOrigins && !language.creationOrigins.includes(identity.originId)) add(errors, "LANGUAGE_ORIGIN", `${language.name} недоступен при выбранном происхождении.`, "languages");
    if (language?.nativeOnlyOrigins && selection.native && !language.nativeOnlyOrigins.includes(identity.originId)) add(errors, "LANGUAGE_NATIVE", `${language.name} нельзя получить бесплатно при выбранном происхождении.`, "languages");
  }
  const spentLanguage = totalLanguageCost(character, rules);
  const budgetLanguage = languageBudget(character);
  if (spentLanguage > budgetLanguage) add(errors, "LANGUAGE_BUDGET", `На языки потрачено ${spentLanguage} из ${budgetLanguage} очков.`, "languages");
  if (spentLanguage < budgetLanguage) add(warnings, "LANGUAGE_UNUSED", `Не потрачено очков языков: ${budgetLanguage - spentLanguage}.`, "languages");

  const reputation = replay.final.reputation;
  const reputationEntries = normalizeReputationEntries(character.reputation);
  const reputationTotal = reputationEntries.reduce((sum, entry) => sum + entry.amount, 0);
  if (reputationTotal !== reputation) {
    add(errors, "REPUTATION_TOTAL", `В записях распределено ${reputationTotal} из ${reputation} пунктов репутации.`, "reputation.entries");
  }
  for (const [position, entry] of reputationEntries.entries()) {
    if (!entry.description) add(errors, "REPUTATION_DESCRIPTION", `У записи репутации ${position + 1} не указано, почему она получена.`, `reputation.entries.${position}.description`);
  }

  const biography = character.biography ?? {};
  const biographyLabels = {
    concept: "Концепт",
    appearance: "Внешность",
    background: "Предыстория",
    family: "Семья",
    pride: "Гордость",
    darkSecret: "Тёмный секрет",
    motivation: "Мотивация",
    partyConnections: "Связь с группой"
  };
  const requiredBiographyFields = new Set(builderSettings.requiredBiographyFields ?? []);
  for (const field of ["concept", "appearance", "background", "family", "pride", "darkSecret", "motivation", "partyConnections"]) {
    if (!String(biography[field] ?? "").trim()) {
      if (requiredBiographyFields.has(field)) add(errors, "BIO_REQUIRED", `Обязательное поле «${biographyLabels[field]}» не заполнено.`, `biography.${field}`);
      else add(warnings, "BIO_EMPTY", `Не заполнено поле «${biographyLabels[field]}».`, `biography.${field}`);
    }
  }

  if (character.formatVersion >= 4) {
    const questionLabels = {
      bestFriend: "Лучший друг",
      favoriteFood: "Любимое блюдо",
      prejudices: "Предубеждения",
      aristocracy: "Отношение к аристократии",
      favoriteMemory: "Любимое воспоминание",
      oneWish: "Одно желание",
      greatestFear: "Главный страх"
    };
    for (const [field, label] of Object.entries(questionLabels)) {
      if (!String(biography.questions?.[field] ?? "").trim()) add(warnings, "BIO_QUESTION_EMPTY", `Не заполнен ответ: ${label}.`, `biography.questions.${field}`);
    }

    const otherCharacters = Number(biography.otherActiveCharacters ?? 0);
    if (!Number.isInteger(otherCharacters) || otherCharacters < 0 || otherCharacters > 20) {
      add(errors, "RUMOR_PARTY_SIZE", "Количество других активных персонажей должно быть целым числом от 0 до 20.", "biography.otherActiveCharacters");
    } else {
      const rumors = Array.isArray(biography.rumors) ? biography.rumors : [];
      const nonEmptyRumors = rumors.filter(entry => String(entry?.text ?? "").trim());
      if (rumors.some(entry => !String(entry?.text ?? "").trim())) add(errors, "RUMOR_EMPTY", "Пустой слух нужно заполнить или удалить.", "biography.rumors");
      const configuredRumorCount = builderSettings.rumorCountMode === "fixed" ? Math.max(0, Number(builderSettings.requiredRumorCount ?? 0)) : otherCharacters;
      if (nonEmptyRumors.length !== configuredRumorCount) add(errors, "RUMOR_COUNT", `Нужно подготовить ${configuredRumorCount} слухов, сейчас ${nonEmptyRumors.length}.`, "biography.rumors");
      if (configuredRumorCount >= 2) {
        if (!nonEmptyRumors.some(entry => entry.truth === "true")) add(errors, "RUMOR_TRUE_REQUIRED", "Среди слухов должен быть хотя бы один правдивый.", "biography.rumors");
        if (!nonEmptyRumors.some(entry => entry.truth === "false")) add(errors, "RUMOR_FALSE_REQUIRED", "Среди слухов должен быть хотя бы один ложный.", "biography.rumors");
      }
    }

    for (const [position, request] of (character.gmRequests ?? []).entries()) {
      if (!String(request?.category ?? "").trim()) add(errors, "GM_REQUEST_CATEGORY", `Запрос ГМу №${position + 1}: не выбрана категория.`, `gmRequests.${position}.category`);
      if (!String(request?.description ?? "").trim()) add(errors, "GM_REQUEST_DESCRIPTION", `Запрос ГМу №${position + 1}: отсутствует описание.`, `gmRequests.${position}.description`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    derived: {
      age,
      ageCategory: category,
      attributeMaxima: Object.fromEntries(ATTRIBUTES.map(attribute => [attribute, attributeMaximum(attribute, character, rules)])),
      languageBudget: budgetLanguage,
      languageSpent: spentLanguage,
      allowedSpellDisciplines: allowedSpellDisciplines(character, rules, replay.state.talents),
      ageTalentPoints: { total: replay.ageTalents.total, spent: replay.ageTalents.spent, remaining: replay.ageTalents.remaining },
      startingSpells: { expected: replay.startingSpells.expectedTotal, actual: replay.startingSpells.actualTotal },
      finalSkills: replay.final.skills,
      finalTalents: replay.final.talents,
      finalSpells: replay.final.spells,
      reputation: replay.final.reputation,
      xpSpent: replay.final.xpSpent,
      xpBudget: replay.final.xpBudget,
      xpRemaining: replay.final.xpRemaining,
      xpLedger: replay.final.transactionResults
    }
  };
}

export function sanitizeEmbeddedItem(snapshot, rank = null, foundryGeneration = null) {
  const item = cloneValue(snapshot);
  for (const key of ["_id", "folder", "sort", "_stats", "ownership"]) delete item[key];
  item.flags ??= {};
  delete item.flags["scene-packer"];
  if (rank !== null && item.system) item.system.rank = String(rank);

  const generation = Number(foundryGeneration);
  if (Number.isFinite(generation)) {
    for (const effect of item.effects ?? []) {
      if (generation >= 14) {
        effect.system ??= {};
        if (Array.isArray(effect.changes) && !Array.isArray(effect.system.changes)) effect.system.changes = cloneValue(effect.changes);
        delete effect.changes;
      } else if (generation <= 13 && Array.isArray(effect.system?.changes)) {
        if (!Array.isArray(effect.changes)) effect.changes = cloneValue(effect.system.changes);
        delete effect.system.changes;
        if (!Object.keys(effect.system).length) delete effect.system;
      }
    }
  }
  return item;
}

export function characterToQuickAccessBiographyProfile(character, rules) {
  const index = indexRules(rules);
  const identity = character.identity ?? {};
  const bio = character.biography ?? {};
  const kin = index.kin.get(identity.kinId);
  const kinVariant = kin?.variants?.find(entry => entry.id === identity.kinVariantId);
  const profession = index.professions.get(identity.professionId);
  const origin = index.origins.get(identity.originId);
  const religion = index.religions.get(identity.religionId);
  const birthDate = identity.birthDate ?? {};
  const monthName = index.months.get(birthDate.month)?.name ?? birthDate.month ?? "";
  const birthLabel = [birthDate.day, monthName, birthDate.year ? `${birthDate.year} П.П.` : ""].filter(Boolean).join(" ");

  return {
    version: 1,
    identity: {
      name: String(identity.name ?? ""),
      kin: String(kin?.name ?? identity.kinId ?? ""),
      kinVariant: String(kinVariant?.name ?? identity.kinVariantId ?? ""),
      profession: String(profession?.name ?? identity.professionId ?? ""),
      issuingCountry: String(identity.citizenship || origin?.name || identity.originId || ""),
      origin: String(origin?.name ?? identity.originId ?? ""),
      religion: String(religion?.name ?? identity.religionId ?? ""),
      birthDate: {
        day: Number(birthDate.day) || 0,
        month: String(monthName),
        year: Number(birthDate.year) || 0,
        label: birthLabel
      }
    },
    concept: String(bio.concept ?? ""),
    pride: String(bio.pride ?? ""),
    darkSecret: String(bio.darkSecret ?? ""),
    physical: {
      appearance: String(bio.appearance ?? ""),
      height: String(bio.physical?.height ?? ""),
      weight: String(bio.physical?.weight ?? ""),
      skin: String(bio.physical?.skin ?? ""),
      eyes: String(bio.physical?.eyes ?? ""),
      hair: String(bio.physical?.hair ?? ""),
      distinguishingMarks: String(bio.physical?.distinguishingMarks ?? "")
    },
    background: String(bio.background ?? ""),
    family: String(bio.family ?? ""),
    motivation: String(bio.motivation ?? ""),
    partyConnections: String(bio.partyConnections ?? ""),
    publicNote: String(bio.publicNote ?? ""),
    languages: (character.languages ?? []).map((entry, position) => ({
      id: `language-${position + 1}-${entry.languageId ?? "unknown"}`,
      languageId: String(entry.languageId ?? ""),
      name: String(index.languages.get(entry.languageId)?.name ?? entry.languageId ?? ""),
      level: String(entry.level ?? "basic"),
      cost: languageSelectionCost(entry, character, rules) ?? 0,
      native: Boolean(entry.native)
    })),
    questions: {
      bestFriend: String(bio.questions?.bestFriend ?? ""),
      favoriteFood: String(bio.questions?.favoriteFood ?? ""),
      prejudices: String(bio.questions?.prejudices ?? ""),
      aristocracy: String(bio.questions?.aristocracy ?? ""),
      favoriteMemory: String(bio.questions?.favoriteMemory ?? ""),
      oneWish: String(bio.questions?.oneWish ?? ""),
      greatestFear: String(bio.questions?.greatestFear ?? ""),
      notes: String(bio.questions?.notes ?? "")
    },
    rumors: (bio.rumors ?? []).map((entry, position) => ({
      id: String(entry?.id ?? `rumor-${position + 1}`),
      name: String(entry?.name ?? entry?.characterName ?? entry?.source ?? ""),
      text: String(entry?.text ?? ""),
      truth: ["true", "false", "uncertain"].includes(entry?.truth) ? entry.truth : "uncertain"
    })),
    legacy: { face: "", body: "", clothing: "" }
  };
}

export function characterToActorData(character, rules, options = {}) {
  const validation = validateCharacter(character, rules);
  const allowInvalid = options.allowInvalid === true;
  if (!validation.valid && !allowInvalid) throw new RuleError("INVALID_CHARACTER", "Нельзя создать Actor из невалидного файла персонажа.");
  const index = indexRules(rules);
  const identity = character.identity ?? {};
  const kin = index.kin.get(identity.kinId);
  const profession = index.professions.get(identity.professionId);
  const age = validation.derived.age;
  const bio = character.biography ?? {};
  const birthDate = identity.birthDate ?? {};
  const monthName = index.months.get(birthDate.month)?.name ?? birthDate.month ?? "?";
  const origin = index.origins.get(identity.originId);
  const religion = index.religions.get(identity.religionId);
  const actorName = String(identity.name ?? "").trim() || "Без имени";
  const forcedImport = allowInvalid && !validation.valid;
  const quickAccessBiography = characterToQuickAccessBiographyProfile(character, rules);
  const ageValue = Number.isFinite(Number(age)) ? Number(age) : 0;
  const reputationValue = Number.isFinite(Number(validation.derived.reputation)) ? Number(validation.derived.reputation) : 0;
  const reputationEntries = normalizeReputationEntries(character.reputation).map((entry, position) => ({
    id: entry.id || `rep-${position + 1}`,
    amount: entry.amount,
    description: entry.description,
    location: entry.location
  }));
  const experienceValue = Number.isFinite(Number(validation.derived.xpRemaining)) ? Number(validation.derived.xpRemaining) : 0;
  const questions = bio.questions ?? {};
  const questionEntries = [
    ["Лучший друг", questions.bestFriend],
    ["Любимое блюдо", questions.favoriteFood],
    ["Предубеждения", questions.prejudices],
    ["Отношение к аристократии", questions.aristocracy],
    ["Любимое воспоминание", questions.favoriteMemory],
    ["Одно желание", questions.oneWish],
    ["Главный страх", questions.greatestFear]
  ];
  const physicalEntries = [
    ["Рост", bio.physical?.height],
    ["Вес", bio.physical?.weight],
    ["Кожа", bio.physical?.skin],
    ["Глаза", bio.physical?.eyes],
    ["Волосы", bio.physical?.hair],
    ["Особые приметы", bio.physical?.distinguishingMarks]
  ];
  const rumorTruth = { true: "правда", false: "ложь", uncertain: "не определено" };
  const requestCategories = {
    "rule-exception": "Исключение из правил",
    "profession-skill": "Изменение классового навыка",
    "custom-talent": "Авторский талант",
    "unusual-background": "Необычная предыстория",
    other: "Прочее"
  };
  const labelLine = (label, value, paragraphs = false) => {
    if (!String(value ?? "").trim()) return "";
    return paragraphs
      ? `<p><strong><em>${escapeHtml(label)}:</em></strong></p>${paragraphHtml(value)}`
      : `<p><strong><em>${escapeHtml(label)}:</em></strong> ${escapeHtml(value)}</p>`;
  };
  const sectionTitle = title => `<p><strong>${escapeHtml(title)}</strong></p>`;
  const noteHtml = [
    sectionTitle("Основные сведения"),
    `<p><strong><em>Дата рождения:</em></strong> ${birthDate.day ?? "?"} ${escapeHtml(monthName)}, ${birthDate.year ?? "?"} П.П.<br><strong><em>Происхождение:</em></strong> ${escapeHtml(origin?.name ?? identity.originId ?? "Не указано")}${identity.originDetail ? `, ${escapeHtml(identity.originDetail)}` : ""}${identity.citizenship ? `<br><strong><em>Гражданство:</em></strong> ${escapeHtml(identity.citizenship)}` : ""}${religion ? `<br><strong><em>Вера:</em></strong> ${escapeHtml(religion.name)}` : ""}${identity.religionDetail ? ` — ${escapeHtml(identity.religionDetail)}` : ""}</p>`,
    sectionTitle("Концепт"), paragraphHtml(bio.concept),
    sectionTitle("Внешность"), paragraphHtml(bio.appearance),
    ...physicalEntries.map(([label, value]) => labelLine(label, value)),
    sectionTitle("Предыстория"), paragraphHtml(bio.background),
    sectionTitle("Семья"), paragraphHtml(bio.family),
    sectionTitle("Мотивация и связь с группой"), paragraphHtml(bio.motivation), paragraphHtml(bio.partyConnections),
    sectionTitle("Ответы на вопросы"),
    ...questionEntries.map(([label, value]) => labelLine(label, value, true)),
    paragraphHtml(questions.notes ?? bio.answers ?? ""),
    sectionTitle("Слухи"), `<ol>${(bio.rumors ?? []).map(entry => `<li>${escapeHtml(entry.text)} <em>(${escapeHtml(rumorTruth[entry.truth] ?? entry.truth ?? "не определено")})</em></li>`).join("")}</ol>`,
    sectionTitle("Происхождение репутации"), `<ol>${reputationEntries.map(entry => `<li><strong>${escapeHtml(entry.amount)}</strong> — ${escapeHtml(entry.description || "Причина не указана")}${entry.location ? ` <em>(${escapeHtml(entry.location)})</em>` : ""}</li>`).join("")}</ol>`,
    sectionTitle("Языки"), `<ul>${(character.languages ?? []).map(entry => `<li>${escapeHtml(index.languages.get(entry.languageId)?.name ?? entry.languageId)}: ${escapeHtml(entry.level)}${entry.native ? " (родной)" : ""}</li>`).join("")}</ul>`,
    sectionTitle("Пожелания по снаряжению"), paragraphHtml(character.equipmentRequest ?? ""),
    sectionTitle("Запросы ГМу"), `<ol>${(character.gmRequests ?? []).map(entry => `<li><strong>${escapeHtml(requestCategories[entry.category] ?? entry.category ?? "Прочее")}</strong>: ${escapeHtml(entry.description ?? "")}</li>`).join("")}</ol>`,
    sectionTitle("Base XP"), `<p>Текущий Base XP: ${character.experience?.baseTotal ?? 0}; доступно на развитие: ${validation.derived.xpBudget}; потрачено: ${validation.derived.xpSpent}; остаток: ${validation.derived.xpRemaining}.</p>`
  ].filter(Boolean).join("");

  const attributes = Object.fromEntries(ATTRIBUTES.map(attribute => {
    const raw = Number(character.attributes?.[attribute]);
    const value = Number.isFinite(raw) ? raw : 0;
    return [attribute, {
      label: `ATTRIBUTE.${attribute.toUpperCase()}`,
      value,
      min: 0,
      max: value
    }];
  }));
  attributes.health = { label: "ATTRIBUTE.HEALTH", value: 0, min: 0, max: 0 };
  attributes.resolve = { label: "ATTRIBUTE.RESOLVE", value: 0, min: 0, max: 0 };

  const skills = {};
  for (const skill of rules.skills) {
    skills[skill.id] = {
      label: `SKILL.${skill.id.replaceAll("-", "_").toUpperCase()}`,
      value: validation.derived.finalSkills[skill.id] ?? 0,
      min: 0,
      attribute: skill.attribute
    };
  }

  const defaultImage = "systems/forbidden-lands/assets/fbl-character.webp";
  const actorData = {
    name: actorName,
    type: "character",
    img: defaultImage,
    flags: {
      "air-islands-character-importer": {
        characterId: character.characterId ?? null,
        formatVersion: character.formatVersion,
        rulesVersion: character.rulesVersion,
        rulesHash: character.rulesHash,
        profile: cloneValue(character),
        audit: {
          baseXp: Number(character.experience?.baseTotal ?? 0),
          xpBudget: validation.derived.xpBudget,
          xpSpent: validation.derived.xpSpent,
          xpRemaining: validation.derived.xpRemaining,
          transactionResults: cloneValue(validation.derived.xpLedger),
          forcedImport,
          validationErrors: cloneValue(validation.errors),
          validationWarnings: cloneValue(validation.warnings)
        },
        importedAt: new Date().toISOString()
      },
      "fbl-quick-access": {
        reputationEntries: cloneValue(reputationEntries),
        biographyProfile: cloneValue(quickAccessBiography)
      }
    },
    system: {
      attribute: attributes,
      skill: skills,
      type: "",
      bio: {
        kin: { label: "BIO.KIN", value: kin?.name ?? identity.kinId ?? "Не выбрана" },
        profession: { label: "BIO.PROFESSION", value: profession?.name ?? identity.professionId ?? "Не выбрана" },
        pride: { label: "BIO.PRIDE", value: paragraphHtml(bio.pride) },
        darkSecret: { label: "BIO.DARK_SECRET", value: paragraphHtml(bio.darkSecret) },
        age: { label: "BIO.AGE", value: ageValue },
        reputation: { label: "BIO.REPUTATION", value: reputationValue },
        face: { label: "BIO.FACE", value: "" },
        body: { label: "BIO.BODY", value: "" },
        clothing: { label: "BIO.CLOTHING", value: "" },
        note: { label: "BIO.NOTE", value: paragraphHtml(bio.publicNote ?? "") },
        experience: { label: "BIO.EXPERIENCE", value: experienceValue },
        willpower: { label: "BIO.WILLPOWER", value: 0, min: 0, max: 10 }
      },
      condition: {
        sleepy: { label: "CONDITION.SLEEPY", value: false },
        thirsty: { label: "CONDITION.THIRSTY", value: false },
        hungry: { label: "CONDITION.HUNGRY", value: false },
        cold: { label: "CONDITION.COLD", value: false }
      },
      consumable: {
        food: { label: "CONSUMABLE.FOOD", value: 0 },
        water: { label: "CONSUMABLE.WATER", value: 0 },
        arrows: { label: "CONSUMABLE.ARROWS", value: 0 },
        torches: { label: "CONSUMABLE.TORCHES", value: 0 }
      },
      currency: {
        gold: { label: "CURRENCY.GOLD", value: 0 },
        silver: { label: "CURRENCY.SILVER", value: 0 },
        copper: { label: "CURRENCY.COPPER", value: 0 }
      }
    },
    prototypeToken: {
      name: actorName,
      displayName: 20,
      actorLink: true,
      width: 1,
      height: 1,
      texture: { src: defaultImage, anchorX: 0.5, anchorY: 0.5, fit: "contain", scaleX: 1, scaleY: 1, tint: "#ffffff", alphaThreshold: 0.75 },
      lockRotation: true,
      rotation: 0,
      alpha: 1,
      disposition: 1,
      displayBars: 0,
      bar1: { attribute: "attribute.strength" },
      bar2: { attribute: "bio.willpower" },
      randomImg: false,
      appendNumber: false,
      prependAdjective: false
    }
  };

  const items = [];
  for (const selection of validation.derived.finalTalents) {
    const talent = index.talents.get(selection.catalogId);
    if (talent) items.push(sanitizeEmbeddedItem(talent.snapshot, selection.rank, options.foundryGeneration));
  }
  for (const selection of validation.derived.finalSpells) {
    const spell = index.spells.get(selection.catalogId);
    if (spell) items.push(sanitizeEmbeddedItem(spell.snapshot, null, options.foundryGeneration));
  }
  return { actorData, items, validation };
}

export function normalizeReputationEntries(value) {
  const source = value ?? {};
  if (Array.isArray(source.entries)) {
    return source.entries
      .map((entry, position) => {
        const amount = Math.max(0, Math.floor(Number(entry?.amount) || 0));
        if (amount < 1) return null;
        return {
          id: String(entry?.id ?? `rep-${position + 1}`).trim() || `rep-${position + 1}`,
          amount,
          description: String(entry?.description ?? entry?.reason ?? "").trim(),
          location: String(entry?.location ?? entry?.place ?? "").trim()
        };
      })
      .filter(Boolean);
  }

  return (Array.isArray(source.origins) ? source.origins : [])
    .map((description, position) => ({
      id: `rep-${position + 1}`,
      amount: 1,
      description: String(description ?? "").trim(),
      location: ""
    }));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function paragraphHtml(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.split(/\n{2,}/u).map(paragraph => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`).join("");
}
