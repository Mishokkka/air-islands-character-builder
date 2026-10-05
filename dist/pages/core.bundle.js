var AirIslandsCore = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // shared/mortar-runtime-core.mjs
  var mortar_runtime_core_exports = {};
  __export(mortar_runtime_core_exports, {
    RuleError: () => RuleError,
    ageCategoryFor: () => ageCategoryFor2,
    allowedNativeLanguages: () => allowedNativeLanguages,
    allowedSpellDisciplines: () => allowedSpellDisciplines2,
    attributeMaximum: () => attributeMaximum3,
    baseXpAllowance: () => baseXpAllowance,
    calculateAge: () => calculateAge,
    characterToActorData: () => characterToActorData3,
    characterToQuickAccessBiographyProfile: () => characterToQuickAccessBiographyProfile2,
    compareCalendarDate: () => compareCalendarDate,
    indexRules: () => indexRules,
    kinFocuses: () => kinFocuses,
    languageBaseCost: () => languageBaseCost,
    languageBudget: () => languageBudget,
    languageSelectionCost: () => languageSelectionCost,
    normalizeReputationEntries: () => normalizeReputationEntries,
    professionFocuses: () => professionFocuses2,
    replayCharacter: () => replayCharacter3,
    sanitizeEmbeddedItem: () => sanitizeEmbeddedItem,
    simulateAgeTalentTransaction: () => simulateAgeTalentTransaction2,
    simulateXpTransaction: () => simulateXpTransaction3,
    skillXpCost: () => skillXpCost,
    startingSkillCost: () => startingSkillCost,
    totalLanguageCost: () => totalLanguageCost,
    validateCharacter: () => validateCharacter3
  });

  // shared/core.mjs
  var ATTRIBUTES = ["strength", "agility", "wits", "empathy"];
  var LEVEL_ORDER = { basic: 1, full: 2, academic: 3 };
  var cloneValue = (value) => typeof globalThis.structuredClone === "function" ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value));
  var RuleError = class extends Error {
    constructor(code, message, path = "") {
      super(message);
      this.name = "RuleError";
      this.code = code;
      this.path = path;
    }
  };
  function indexRules(rules) {
    return {
      kin: new Map(rules.kin.map((entry) => [entry.id, entry])),
      professions: new Map(rules.professions.map((entry) => [entry.id, entry])),
      skills: new Map(rules.skills.map((entry) => [entry.id, entry])),
      languages: new Map(rules.languages.map((entry) => [entry.id, entry])),
      origins: new Map(rules.origins.map((entry) => [entry.id, entry])),
      talents: new Map(rules.catalogs.talents.items.map((entry) => [entry.catalogId, entry])),
      spells: new Map(rules.catalogs.spells.items.map((entry) => [entry.catalogId, entry])),
      months: new Map(rules.calendar.months.map((entry) => [entry.id, entry])),
      religions: new Map((rules.religions ?? []).map((entry) => [entry.id, entry]))
    };
  }
  function compareCalendarDate(a, b, rules) {
    const index = indexRules(rules);
    const aMonth = index.months.get(a?.month)?.order ?? 0;
    const bMonth = index.months.get(b?.month)?.order ?? 0;
    return Number(a?.year) - Number(b?.year) || aMonth - bMonth || Number(a?.day) - Number(b?.day);
  }
  function calculateAge(birthDate, currentDate, rules) {
    if (!birthDate || !currentDate) return null;
    const index = indexRules(rules);
    if (!index.months.has(birthDate.month) || !index.months.has(currentDate.month)) return null;
    if (!Number.isInteger(Number(birthDate.year)) || !Number.isInteger(Number(birthDate.day))) return null;
    let age = Number(currentDate.year) - Number(birthDate.year);
    const birthdayThisYear = { ...birthDate, year: currentDate.year };
    if (compareCalendarDate(currentDate, birthdayThisYear, rules) < 0) age -= 1;
    return age;
  }
  function ageCategoryFor(kin, age) {
    if (!kin || !Number.isInteger(age)) return null;
    if (age <= kin.youngMax) return "young";
    if (age <= kin.adultMax) return "adult";
    return "old";
  }
  function plannedTalentCatalogIds(character) {
    const ids = /* @__PURE__ */ new Set();
    if (character.creation?.initialPathCatalogId) ids.add(character.creation.initialPathCatalogId);
    for (const tx of character.creation?.ageTalentLedger ?? []) if (tx.catalogId) ids.add(tx.catalogId);
    for (const tx of character.experience?.ledger ?? []) if (tx.type === "talent" && tx.catalogId) ids.add(tx.catalogId);
    return ids;
  }
  function kinFocuses(character, rules) {
    const index = indexRules(rules);
    const kin = index.kin.get(character.identity?.kinId);
    if (!kin) return [];
    const variant = kin.variants?.find((entry) => entry.id === character.identity?.kinVariantId);
    const focus = variant?.selectableFocus ? character.identity?.kinFocus : variant?.focus ?? kin.focus;
    return ATTRIBUTES.includes(focus) ? [focus] : [];
  }
  function professionFocuses(character, rules) {
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
  function attributeMaximum(attribute, character, rules) {
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
  function languageBudget(character) {
    const wits = Number(character.attributes?.wits ?? 0);
    const lore = Number(character.skills?.lore?.startingRank ?? 0);
    return Math.max(0, wits - 2) + Math.max(0, lore) * 2;
  }
  function baseXpAllowance(character) {
    const raw = Math.max(0, Number(character.experience?.baseTotal ?? 0) || 0);
    return Number(character.formatVersion ?? 0) >= 6 ? Math.ceil(raw * 0.2) : raw;
  }
  function languageBaseCost(language, level, character, rules) {
    if (!language?.levels || language.levels[level] === void 0) return null;
    let cost = language.levels[level];
    const kinKey = `${character.identity?.kinId}:${character.identity?.kinVariantId}`;
    cost = language.kinVariantCosts?.[kinKey]?.[level] ?? language.kinCosts?.[character.identity?.kinId]?.[level] ?? cost;
    const appliedDiscountGroups = /* @__PURE__ */ new Set();
    for (const discount of language.discounts ?? []) {
      let applies = discount.origins?.includes(character.identity?.originId) ?? false;
      if (discount.requiresLanguage) {
        const known = (character.languages ?? []).find((item) => item.languageId === discount.requiresLanguage.id);
        applies ||= Boolean(known && LEVEL_ORDER[known.level] >= LEVEL_ORDER[discount.requiresLanguage.minimumLevel]);
      }
      if (!applies) continue;
      if (discount.group && appliedDiscountGroups.has(discount.group)) continue;
      cost -= discount.amount;
      if (discount.group) appliedDiscountGroups.add(discount.group);
    }
    const random = language.randomDiscount;
    const randomResult = (character.languageRolls ?? []).find((item) => item.languageId === language.id && item.level === level);
    if (random && random.level === level && randomResult?.result >= random.successMinimum) cost = Math.min(cost, random.discountedCost);
    return Math.max(0, cost);
  }
  function languageSelectionCost(selection, character, rules) {
    const index = indexRules(rules);
    const language = index.languages.get(selection.languageId);
    const targetCost = languageBaseCost(language, selection.level, character, rules);
    if (targetCost === null) return null;
    if (!selection.native) return targetCost;
    let nativeBase = languageBaseCost(language, "basic", character, rules);
    if (nativeBase === null) nativeBase = 0;
    return Math.max(0, targetCost - nativeBase);
  }
  function totalLanguageCost(character, rules) {
    return (character.languages ?? []).reduce((sum, selection) => {
      const cost = languageSelectionCost(selection, character, rules);
      return sum + (Number.isFinite(cost) ? cost : 0);
    }, 0);
  }
  function startingSkillCost(rank) {
    const costs = [0, 1, 2, 4, 7, 11];
    return costs[rank] ?? Number.POSITIVE_INFINITY;
  }
  function skillXpCost(skillId, fromRank, toRank, professionId, rules) {
    const index = indexRules(rules);
    const profession = index.professions.get(professionId);
    const table = profession?.skills.includes(skillId) ? rules.skillXpCosts.profession : rules.skillXpCosts.other;
    let total = 0;
    for (let rank = fromRank + 1; rank <= toRank; rank += 1) total += table[rank - 1] ?? Number.POSITIVE_INFINITY;
    return total;
  }
  function allowedNativeLanguages(character, rules) {
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
  function allowedSpellDisciplines(character, rules, finalTalents = null) {
    const index = indexRules(rules);
    const disciplines = /* @__PURE__ */ new Set();
    const talents = finalTalents instanceof Map ? finalTalents : new Map([...plannedTalentCatalogIds(character)].map((id) => [id, 1]));
    const paths = magicalPathsFromTalentMap(talents, index, rules);
    for (const path of paths) disciplines.add(path.discipline);
    if (paths.length) disciplines.add(rules.spellDisciplineMap.general);
    return [...disciplines];
  }
  function makeIssue(code, message, path = "") {
    return { code, message, path };
  }
  function createProgressionState(character, rules, index, categoryRules) {
    const skills = /* @__PURE__ */ new Map();
    for (const skill of rules.skills) skills.set(skill.id, Number(character.skills?.[skill.id]?.startingRank ?? 0));
    const talents = /* @__PURE__ */ new Map();
    const talentSources = /* @__PURE__ */ new Map();
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
      spells: /* @__PURE__ */ new Map(),
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
        issues.push(makeIssue("AGE_LEDGER_TYPE", "\u0412\u043E\u0437\u0440\u0430\u0441\u0442\u043D\u044B\u0435 \u043E\u0447\u043A\u0438 \u043C\u043E\u0436\u043D\u043E \u0442\u0440\u0430\u0442\u0438\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430 \u0442\u0430\u043B\u0430\u043D\u0442\u044B.", path));
        continue;
      }
      const talent = index.talents.get(tx.catalogId);
      if (!talent) {
        issues.push(makeIssue("AGE_TALENT_UNKNOWN", "\u0412 \u0436\u0443\u0440\u043D\u0430\u043B\u0435 \u0432\u043E\u0437\u0440\u0430\u0441\u0442\u043D\u044B\u0445 \u043E\u0447\u043A\u043E\u0432 \u0443\u043A\u0430\u0437\u0430\u043D \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0442\u0430\u043B\u0430\u043D\u0442.", path));
        continue;
      }
      const current = state.talents.get(tx.catalogId) ?? 0;
      const target = Number(tx.toRank);
      if (!Number.isInteger(target) || target !== current + 1 || target > 5) {
        issues.push(makeIssue("AGE_TALENT_SEQUENCE", `${talent.name}: \u043E\u0436\u0438\u0434\u0430\u043B\u0441\u044F \u043F\u0435\u0440\u0435\u0445\u043E\u0434 ${current} \u2192 ${current + 1}.`, path));
        continue;
      }
      let cost = 0;
      if (talent.type === "general") cost = 1;
      else if (talent.type === "profession" && tx.catalogId === initialPathId && current >= 1) cost = talent.magical ? 2 : 1;
      else {
        issues.push(makeIssue("AGE_TALENT_ACCESS", `${talent.name} \u043D\u0435\u043B\u044C\u0437\u044F \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0437\u0430 \u0432\u043E\u0437\u0440\u0430\u0441\u0442\u043D\u044B\u0435 \u043E\u0447\u043A\u0438.`, path));
        continue;
      }
      if (spent + cost > total) {
        issues.push(makeIssue("AGE_TALENT_OVERRUN", `${talent.name}: \u043D\u0435 \u0445\u0432\u0430\u0442\u0430\u0435\u0442 \u0432\u043E\u0437\u0440\u0430\u0441\u0442\u043D\u044B\u0445 \u043E\u0447\u043A\u043E\u0432.`, path));
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
    const maximumByRank = /* @__PURE__ */ new Map();
    if (initialPath?.magical) {
      for (let rank = 1; rank <= initialRank; rank += 1) maximumByRank.set(rank, startingSpellLimitForRank(rules, rank));
    }
    const allowed = new Set(initialPath?.magical ? [rules.spellDisciplineMap.general, rules.spellDisciplineMap[initialPath.disciplineKey]].filter(Boolean) : []);
    const counts = /* @__PURE__ */ new Map();
    for (const [position, raw] of (character.creation?.startingSpells ?? []).entries()) {
      const catalogId = typeof raw === "string" ? raw : raw?.catalogId;
      const path = `creation.startingSpells.${position}`;
      const spell = index.spells.get(catalogId);
      if (!spell) {
        issues.push(makeIssue("STARTING_SPELL_UNKNOWN", "\u0423\u043A\u0430\u0437\u0430\u043D\u043E \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E\u0435 \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u043E\u0435 \u0437\u0430\u043A\u043B\u0438\u043D\u0430\u043D\u0438\u0435.", path));
        continue;
      }
      if (!initialPath?.magical) {
        issues.push(makeIssue("STARTING_SPELL_NONMAGIC", "\u041D\u0435\u043C\u0430\u0433\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436 \u043D\u0435 \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0442 \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u044B\u0435 \u0437\u0430\u043A\u043B\u0438\u043D\u0430\u043D\u0438\u044F.", path));
        continue;
      }
      if (state.spells.has(catalogId)) {
        issues.push(makeIssue("STARTING_SPELL_DUPLICATE", `${spell.name} \u0432\u044B\u0431\u0440\u0430\u043D\u043E \u0434\u0432\u0430\u0436\u0434\u044B.`, path));
        continue;
      }
      if (!allowed.has(spell.discipline)) {
        issues.push(makeIssue("STARTING_SPELL_DISCIPLINE", `${spell.name}: \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u043E \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u0442\u043E\u043B\u044C\u043A\u043E \u0448\u043A\u043E\u043B\u0430 \u043F\u0435\u0440\u0432\u043E\u0433\u043E Path \u0438\u043B\u0438 General Spells.`, path));
        continue;
      }
      if (spell.rank < 1 || spell.rank > initialRank) {
        issues.push(makeIssue("STARTING_SPELL_RANK", `${spell.name}: \u0434\u043B\u044F \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u043E\u0433\u043E Path Rank ${initialRank} \u044D\u0442\u043E\u0442 \u0440\u0430\u043D\u0433 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D.`, path));
        continue;
      }
      state.spells.set(catalogId, "starting");
      counts.set(spell.rank, (counts.get(spell.rank) ?? 0) + 1);
      records.push({ catalogId, name: spell.name, rank: spell.rank, discipline: spell.discipline, source: "starting" });
    }
    if (initialPath?.magical) {
      for (const [rank, maximum] of maximumByRank) {
        const actual = counts.get(rank) ?? 0;
        if (actual > maximum) issues.push(makeIssue("STARTING_SPELL_COUNT", `\u0414\u043B\u044F Rank ${rank} \u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u043E \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E \u043D\u0435 \u0431\u043E\u043B\u0435\u0435 ${maximum} \u0437\u0430\u043A\u043B\u0438\u043D\u0430\u043D\u0438\u0439, \u0441\u0435\u0439\u0447\u0430\u0441 ${actual}.`, "creation.startingSpells"));
      }
      for (const [rank, count] of counts) {
        if (!maximumByRank.has(rank) && count > 0) issues.push(makeIssue("STARTING_SPELL_EXTRA_RANK", `\u0421\u0442\u0430\u0440\u0442\u043E\u0432\u044B\u0435 \u0437\u0430\u043A\u043B\u0438\u043D\u0430\u043D\u0438\u044F Rank ${rank} \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B.`, "creation.startingSpells"));
      }
    } else if ((character.creation?.startingSpells ?? []).length) {
      issues.push(makeIssue("STARTING_SPELLS_FORBIDDEN", "\u0423 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E \u043F\u0435\u0440\u0432\u043E\u0433\u043E Path \u043D\u0435\u0442 \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u044B\u0445 \u0437\u0430\u043A\u043B\u0438\u043D\u0430\u043D\u0438\u0439.", "creation.startingSpells"));
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
    return paths.filter((path) => path.discipline === spell.discipline).reduce((maximum, path) => Math.max(maximum, path.rank), 0);
  }
  function countSpellsAtRank(state, index, rank) {
    let count = 0;
    for (const catalogId of state.spells.keys()) if (index.spells.get(catalogId)?.rank === rank) count += 1;
    return count;
  }
  function evaluateXpTransaction(tx, character, rules, index, state) {
    if (!tx || typeof tx !== "object") return { valid: false, issue: makeIssue("XP_LEDGER_ENTRY", "\u041F\u043E\u0432\u0440\u0435\u0436\u0434\u0451\u043D\u043D\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C \u0436\u0443\u0440\u043D\u0430\u043B\u0430 Base XP.") };
    if (tx.type === "skill") {
      const skill = index.skills.get(tx.skillId);
      if (!skill) return { valid: false, issue: makeIssue("XP_SKILL_UNKNOWN", "\u0423\u043A\u0430\u0437\u0430\u043D \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u043D\u0430\u0432\u044B\u043A.") };
      const current = state.skills.get(tx.skillId) ?? 0;
      const target = Number(tx.toRank);
      if (!Number.isInteger(target) || target !== current + 1 || target > 5) {
        return { valid: false, issue: makeIssue("XP_SKILL_SEQUENCE", `${skill.name}: \u043E\u0436\u0438\u0434\u0430\u043B\u0441\u044F \u043F\u0435\u0440\u0435\u0445\u043E\u0434 ${current} \u2192 ${current + 1}.`) };
      }
      const cost = skillXpCost(tx.skillId, current, target, character.identity?.professionId, rules);
      return { valid: true, cost, label: `${skill.name}: Rank ${current} \u2192 ${target}`, apply: () => state.skills.set(tx.skillId, target) };
    }
    if (tx.type === "talent") {
      const talent = index.talents.get(tx.catalogId);
      if (!talent) return { valid: false, issue: makeIssue("XP_TALENT_UNKNOWN", "\u0423\u043A\u0430\u0437\u0430\u043D \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0442\u0430\u043B\u0430\u043D\u0442.") };
      const current = state.talents.get(tx.catalogId) ?? 0;
      const target = Number(tx.toRank);
      if (!Number.isInteger(target) || target !== current + 1 || target > 5) {
        return { valid: false, issue: makeIssue("XP_TALENT_SEQUENCE", `${talent.name}: \u043E\u0436\u0438\u0434\u0430\u043B\u0441\u044F \u043F\u0435\u0440\u0435\u0445\u043E\u0434 ${current} \u2192 ${current + 1}.`) };
      }
      if (talent.type === "kin") {
        const kin = index.kin.get(character.identity?.kinId);
        if (tx.catalogId !== kin?.talentCatalogId) return { valid: false, issue: makeIssue("XP_KIN_TALENT_ACCESS", `${talent.name} \u043D\u0435 \u043E\u0442\u043D\u043E\u0441\u0438\u0442\u0441\u044F \u043A \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0439 \u0440\u0430\u0441\u0435.`) };
      }
      if (talent.type === "profession" && !talent.professions?.includes(character.identity?.professionId)) {
        return { valid: false, issue: makeIssue("XP_PATH_ACCESS", `${talent.name} \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0439 \u043F\u0440\u043E\u0444\u0435\u0441\u0441\u0438\u0438.`) };
      }
      if (talent.type === "profession" && tx.catalogId !== character.creation?.initialPathCatalogId) {
        return { valid: false, issue: makeIssue("XP_ADDITIONAL_PATH_FORBIDDEN", "\u041F\u0440\u0438 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u0438 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430 \u043C\u043E\u0436\u043D\u043E \u0432\u044B\u0431\u0440\u0430\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u043E\u0434\u0438\u043D Professional Path. \u041F\u043E\u0432\u044B\u0448\u0430\u0442\u044C \u043C\u043E\u0436\u043D\u043E \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u0435\u0440\u0432\u044B\u0439 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 Path.") };
      }
      if (talent.magical && target > 1) {
        const discipline = rules.spellDisciplineMap[talent.disciplineKey];
        const hasRequiredSpell = [...state.spells.keys()].some((id) => {
          const spell = index.spells.get(id);
          return spell?.discipline === discipline && spell.rank === target;
        });
        if (!hasRequiredSpell) {
          return { valid: false, issue: makeIssue("XP_MAGIC_PATH_PREREQUISITE", `${talent.name} Rank ${target} \u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u043D\u043E \u0437\u0430\u043A\u043B\u0438\u043D\u0430\u043D\u0438\u0435 \u0441\u0432\u043E\u0435\u0439 \u0448\u043A\u043E\u043B\u044B Rank ${target}.`) };
        }
      }
      const distinctCount = state.talents.size + (current === 0 ? 1 : 0);
      const breakdown = talentPurchaseCost(talent, target, distinctCount, rules);
      return {
        valid: Number.isFinite(breakdown.total),
        cost: breakdown.total,
        label: `${talent.name}: Rank ${current} \u2192 ${target}`,
        breakdown,
        apply: () => {
          state.talents.set(tx.catalogId, target);
          if (!state.talentSources.has(tx.catalogId)) state.talentSources.set(tx.catalogId, "xp");
        }
      };
    }
    if (tx.type === "spell") {
      const spell = index.spells.get(tx.catalogId);
      if (!spell) return { valid: false, issue: makeIssue("XP_SPELL_UNKNOWN", "\u0423\u043A\u0430\u0437\u0430\u043D\u043E \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E\u0435 \u0437\u0430\u043A\u043B\u0438\u043D\u0430\u043D\u0438\u0435.") };
      if (state.spells.has(tx.catalogId)) return { valid: false, issue: makeIssue("XP_SPELL_DUPLICATE", `${spell.name} \u0443\u0436\u0435 \u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0443.`) };
      const pathRank = relevantPathRankForSpell(spell, state, rules, index);
      if (pathRank < 1) return { valid: false, issue: makeIssue("XP_SPELL_DISCIPLINE", `${spell.name}: \u0443 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430 \u043D\u0435\u0442 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u044E\u0449\u0435\u0433\u043E \u043C\u0430\u0433\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E Path.`) };
      if (spell.rank > pathRank + 1) {
        return { valid: false, issue: makeIssue("XP_SPELL_RANK", `${spell.name}: \u043C\u043E\u0436\u043D\u043E \u0438\u0437\u0443\u0447\u0430\u0442\u044C \u0437\u0430\u043A\u043B\u0438\u043D\u0430\u043D\u0438\u044F \u043D\u0435 \u0431\u043E\u043B\u0435\u0435 \u0447\u0435\u043C \u043D\u0430 1 \u0440\u0430\u043D\u0433 \u0432\u044B\u0448\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u044E\u0449\u0435\u0433\u043E Path (\u0441\u0435\u0439\u0447\u0430\u0441 Rank ${pathRank}).`) };
      }
      const count = countSpellsAtRank(state, index, spell.rank);
      if (count >= rules.spellLimitPerRank) return { valid: false, issue: makeIssue("XP_SPELL_LIMIT", `\u041B\u0438\u043C\u0438\u0442 \u0437\u0430\u043A\u043B\u0438\u043D\u0430\u043D\u0438\u0439 Rank ${spell.rank}: ${rules.spellLimitPerRank}.`) };
      const cost = rules.spellXpCosts[spell.rank - 1] ?? Number.POSITIVE_INFINITY;
      return { valid: Number.isFinite(cost), cost, label: `${spell.name} (${spell.discipline}, Rank ${spell.rank})`, apply: () => state.spells.set(tx.catalogId, "xp") };
    }
    if (tx.type === "reputation") {
      const amount = Number(tx.amount ?? 1);
      if (!Number.isInteger(amount) || amount !== 1) return { valid: false, issue: makeIssue("XP_REPUTATION_AMOUNT", "\u041A\u0430\u0436\u0434\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C \u0436\u0443\u0440\u043D\u0430\u043B\u0430 \u0434\u043E\u043B\u0436\u043D\u0430 \u043F\u043E\u043A\u0443\u043F\u0430\u0442\u044C \u0440\u043E\u0432\u043D\u043E 1 Reputation.") };
      const cost = Number(rules.reputationXpCost ?? 4);
      return { valid: true, cost, label: `Reputation ${state.reputation} \u2192 ${state.reputation + 1}`, apply: () => {
        state.reputation += 1;
      } };
    }
    return { valid: false, issue: makeIssue("XP_LEDGER_TYPE", `\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0442\u0438\u043F \u043F\u043E\u043A\u0443\u043F\u043A\u0438: ${String(tx.type ?? "?")}.`) };
  }
  function replayCharacter(character, rules) {
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
        xpIssues.push({ ...evaluation.issue ?? makeIssue("XP_LEDGER_INVALID", "\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0430\u044F \u043F\u043E\u043A\u0443\u043F\u043A\u0430."), path });
        continue;
      }
      if (state.xpSpent + evaluation.cost > xpBudget) {
        xpIssues.push(makeIssue("XP_OVERSPEND", `${evaluation.label}: \u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C ${evaluation.cost} XP \u043F\u0440\u0435\u0432\u044B\u0448\u0430\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u0439 \u043E\u0441\u0442\u0430\u0442\u043E\u043A.`, path));
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
  function simulateXpTransaction(character, rules, transaction) {
    const replay = replayCharacter(character, rules);
    if (replay.issues.length) return { valid: false, issue: replay.issues[0], replay };
    if (replay.ageTalents.remaining !== 0) {
      return { valid: false, issue: makeIssue("AGE_TALENT_UNSPENT", `\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043F\u043E\u0442\u0440\u0430\u0442\u044C\u0442\u0435 \u0432\u0441\u0435 \u0432\u043E\u0437\u0440\u0430\u0441\u0442\u043D\u044B\u0435 \u043E\u0447\u043A\u0438 \u0442\u0430\u043B\u0430\u043D\u0442\u043E\u0432: \u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C ${replay.ageTalents.remaining}.`), replay };
    }
    const index = indexRules(rules);
    const evaluation = evaluateXpTransaction(transaction, character, rules, index, replay.state);
    if (!evaluation.valid) return { ...evaluation, replay };
    const remaining = baseXpAllowance(character) - replay.final.xpSpent;
    if (evaluation.cost > remaining) {
      return { valid: false, cost: evaluation.cost, issue: makeIssue("XP_NOT_ENOUGH", `\u041D\u0443\u0436\u043D\u043E ${evaluation.cost} XP, \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E ${remaining}.`), replay };
    }
    return { ...evaluation, replay, remainingAfter: remaining - evaluation.cost };
  }
  function simulateAgeTalentTransaction(character, rules, transaction) {
    const clone = cloneValue(character);
    clone.creation ??= { initialPathCatalogId: null, ageTalentLedger: [], startingSpells: [] };
    clone.creation.ageTalentLedger ??= [];
    clone.creation.ageTalentLedger.push(transaction);
    const replay = replayCharacter(clone, rules);
    const previousCount = (character.creation?.ageTalentLedger ?? []).length;
    const issue = replay.ageTalents.issues.find((entry) => entry.path === `creation.ageTalentLedger.${previousCount}`) ?? replay.ageTalents.issues.at(-1);
    if (issue) return { valid: false, issue, replay };
    const record = replay.ageTalents.records.at(-1);
    return { valid: Boolean(record), record, replay };
  }
  function validateCharacter(character, rules) {
    const errors = [];
    const warnings = [];
    const add = (target, code, message, path = "") => target.push({ code, message, path });
    const index = indexRules(rules);
    const builderSettings = rules.builderSettings ?? {};
    if (character.format !== "air-islands-character") add(errors, "FORMAT", "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442 \u0444\u0430\u0439\u043B\u0430 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430.", "format");
    if (![2, 3, 4, 5, 6, 7, 8].includes(character.formatVersion)) add(errors, "FORMAT_VERSION", "\u041D\u0435\u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u043C\u0430\u044F \u0432\u0435\u0440\u0441\u0438\u044F \u0444\u043E\u0440\u043C\u0430\u0442\u0430 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430. \u041F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u044E\u0442\u0441\u044F \u0432\u0435\u0440\u0441\u0438\u0438 2\u20138.", "formatVersion");
    if (character.rulesHash && character.rulesHash !== rules.packageHash) add(warnings, "RULES_HASH", "\u041F\u0435\u0440\u0441\u043E\u043D\u0430\u0436 \u0441\u043E\u0437\u0434\u0430\u043D \u043D\u0430 \u0434\u0440\u0443\u0433\u043E\u0439 \u0432\u0435\u0440\u0441\u0438\u0438 \u043F\u0430\u043A\u0435\u0442\u0430 \u043F\u0440\u0430\u0432\u0438\u043B.", "rulesHash");
    const identity = character.identity ?? {};
    if (!String(identity.name ?? "").trim()) add(errors, "NAME_REQUIRED", "\u041D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u043E \u0438\u043C\u044F \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430.", "identity.name");
    const kin = index.kin.get(identity.kinId);
    const profession = index.professions.get(identity.professionId);
    if (!kin) add(errors, "KIN_UNKNOWN", "\u041D\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u0430 \u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0430\u044F \u0440\u0430\u0441\u0430.", "identity.kinId");
    if (!profession) add(errors, "PROFESSION_UNKNOWN", "\u041D\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u0430 \u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0430\u044F \u043F\u0440\u043E\u0444\u0435\u0441\u0441\u0438\u044F.", "identity.professionId");
    if (kin && Array.isArray(builderSettings.enabledKin) && builderSettings.enabledKin.length && !builderSettings.enabledKin.includes(identity.kinId)) add(errors, "KIN_DISABLED", `${kin.name} \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u0432 \u0442\u0435\u043A\u0443\u0449\u0435\u043C \u043F\u0430\u043A\u0435\u0442\u0435 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438.`, "identity.kinId");
    if (profession && Array.isArray(builderSettings.enabledProfessions) && builderSettings.enabledProfessions.length && !builderSettings.enabledProfessions.includes(identity.professionId)) add(errors, "PROFESSION_DISABLED", `${profession.name} \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u0432 \u0442\u0435\u043A\u0443\u0449\u0435\u043C \u043F\u0430\u043A\u0435\u0442\u0435 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438.`, "identity.professionId");
    if (identity.religionId && !index.religions.has(identity.religionId)) add(errors, "RELIGION_UNKNOWN", "\u0412\u044B\u0431\u0440\u0430\u043D\u043E \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E\u0435 \u0432\u0435\u0440\u043E\u0432\u0430\u043D\u0438\u0435.", "identity.religionId");
    if (kin?.variants?.length && !kin.variants.some((entry) => entry.id === identity.kinVariantId)) add(errors, "KIN_VARIANT", "\u041D\u0435 \u0432\u044B\u0431\u0440\u0430\u043D \u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 \u0432\u0430\u0440\u0438\u0430\u043D\u0442 \u0440\u0430\u0441\u044B.", "identity.kinVariantId");
    const selectedVariant = kin?.variants?.find((entry) => entry.id === identity.kinVariantId);
    if (selectedVariant?.selectableFocus && !ATTRIBUTES.includes(identity.kinFocus)) add(errors, "KIN_FOCUS", "\u0413\u0432\u0438\u0440\u043B \u0434\u043E\u043B\u0436\u0435\u043D \u0432\u044B\u0431\u0440\u0430\u0442\u044C \u0444\u043E\u043A\u0443\u0441\u043D\u0443\u044E \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0443.", "identity.kinFocus");
    const age = calculateAge(identity.birthDate, rules.campaignDate, rules);
    if (!Number.isInteger(age) || Number(identity.birthDate?.day) < 1 || Number(identity.birthDate?.day) > rules.calendar.daysPerMonth) add(errors, "BIRTH_DATE", "\u0414\u0430\u0442\u0430 \u0440\u043E\u0436\u0434\u0435\u043D\u0438\u044F \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u0430 \u043D\u0435\u0432\u0435\u0440\u043D\u043E.", "identity.birthDate");
    if (kin && Number.isInteger(age)) {
      if (age < kin.minimumAge) add(errors, "AGE_MIN", `\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u044B\u0439 \u0432\u043E\u0437\u0440\u0430\u0441\u0442: ${kin.minimumAge}.`, "identity.birthDate");
      if (age > kin.maximumAge) add(errors, "AGE_MAX", `\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u044B\u0439 \u0432\u043E\u0437\u0440\u0430\u0441\u0442 \u0434\u043B\u044F \u0440\u0430\u0441\u044B: ${kin.maximumAge}.`, "identity.birthDate");
    }
    const category = ageCategoryFor(kin, age);
    const categoryRules = rules.ageCategories[category];
    const attributes = character.attributes ?? {};
    let attributeTotal = 0;
    for (const attribute of ATTRIBUTES) {
      const value = Number(attributes[attribute]);
      attributeTotal += Number.isFinite(value) ? value : 0;
      if (!Number.isInteger(value) || value < 2) add(errors, "ATTRIBUTE_MIN", `${attribute}: \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0434\u043E\u043B\u0436\u043D\u043E \u0431\u044B\u0442\u044C \u0446\u0435\u043B\u044B\u043C \u0438 \u043D\u0435 \u043D\u0438\u0436\u0435 2.`, `attributes.${attribute}`);
      const maximum = attributeMaximum(attribute, character, rules);
      if (value > maximum) add(errors, "ATTRIBUTE_MAX", `${attribute}: \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C ${maximum}.`, `attributes.${attribute}`);
    }
    if (categoryRules && attributeTotal !== categoryRules.attributePoints) add(errors, "ATTRIBUTE_TOTAL", `\u041D\u0443\u0436\u043D\u043E \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u0440\u043E\u0432\u043D\u043E ${categoryRules.attributePoints} \u043E\u0447\u043A\u043E\u0432 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A, \u0441\u0435\u0439\u0447\u0430\u0441 ${attributeTotal}.`, "attributes");
    let skillPoints = 0;
    let oldRankFourCount = 0;
    for (const skill of rules.skills) {
      const starting = Number(character.skills?.[skill.id]?.startingRank ?? 0);
      if (!Number.isInteger(starting) || starting < 0 || starting > 4) add(errors, "SKILL_START", `${skill.name}: \u043D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u044B\u0439 \u0440\u0430\u043D\u0433.`, `skills.${skill.id}.startingRank`);
      skillPoints += startingSkillCost(starting);
      if (category && profession) {
        const classSkill = profession.skills.includes(skill.id);
        const cap = category === "young" ? classSkill ? 2 : 1 : classSkill ? 3 : 2;
        if (category === "old" && classSkill && starting === 4) oldRankFourCount += 1;
        else if (starting > cap) add(errors, "SKILL_CAP", `${skill.name}: \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u044B\u0439 \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C ${cap}.`, `skills.${skill.id}.startingRank`);
      }
    }
    if (category === "old" && oldRankFourCount > 1) add(errors, "OLD_SKILL_FOUR", "\u0421\u0442\u0430\u0440\u044B\u0439 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436 \u043C\u043E\u0436\u0435\u0442 \u0438\u043C\u0435\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u043E\u0434\u0438\u043D \u043A\u043B\u0430\u0441\u0441\u043E\u0432\u044B\u0439 \u043D\u0430\u0432\u044B\u043A 4 \u0440\u0430\u043D\u0433\u0430 \u043D\u0430 \u0441\u0442\u0430\u0440\u0442\u0435.", "skills");
    if (categoryRules && skillPoints !== categoryRules.skillPoints) add(errors, "SKILL_POINTS", `\u041D\u0443\u0436\u043D\u043E \u043F\u043E\u0442\u0440\u0430\u0442\u0438\u0442\u044C \u0440\u043E\u0432\u043D\u043E ${categoryRules.skillPoints} \u043E\u0447\u043A\u043E\u0432 \u043D\u0430\u0432\u044B\u043A\u043E\u0432, \u0441\u0435\u0439\u0447\u0430\u0441 ${skillPoints}.`, "skills");
    const initialPathId = character.creation?.initialPathCatalogId;
    const initialPath = index.talents.get(initialPathId);
    if (!initialPath || initialPath.type !== "profession") add(errors, "PATH_MISSING", "\u041D\u0435 \u0432\u044B\u0431\u0440\u0430\u043D \u043F\u0435\u0440\u0432\u044B\u0439 \u043F\u0440\u043E\u0444\u0435\u0441\u0441\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0439 Path.", "creation.initialPathCatalogId");
    else if (!initialPath.professions?.includes(identity.professionId)) add(errors, "PATH_ACCESS", `${initialPath.name} \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u043F\u0440\u043E\u0444\u0435\u0441\u0441\u0438\u0438 ${profession?.name ?? ""}.`, "creation.initialPathCatalogId");
    else if (Array.isArray(builderSettings.enabledPathCatalogIds) && builderSettings.enabledPathCatalogIds.length && !builderSettings.enabledPathCatalogIds.includes(initialPathId)) add(errors, "PATH_DISABLED", `${initialPath.name} \u043E\u0442\u043A\u043B\u044E\u0447\u0451\u043D \u0432 \u0442\u0435\u043A\u0443\u0449\u0435\u043C \u043F\u0430\u043A\u0435\u0442\u0435 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438.`, "creation.initialPathCatalogId");
    const replay = replayCharacter(character, rules);
    for (const issue of replay.issues) errors.push(issue);
    const hiddenTalents = new Set(builderSettings.hiddenTalentCatalogIds ?? []);
    for (const selection of replay.final.talents) {
      const talent = index.talents.get(selection.catalogId);
      if (hiddenTalents.has(selection.catalogId)) add(errors, "TALENT_DISABLED", `${talent?.name ?? selection.catalogId} \u043E\u0442\u043A\u043B\u044E\u0447\u0451\u043D \u0432 \u0442\u0435\u043A\u0443\u0449\u0435\u043C \u043F\u0430\u043A\u0435\u0442\u0435 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438.`, "creation.ageTalentLedger");
    }
    const hiddenDisciplines = new Set(builderSettings.hiddenSpellDisciplines ?? []);
    for (const selection of replay.final.spells) {
      const spell = index.spells.get(selection.catalogId);
      if (spell && hiddenDisciplines.has(spell.discipline)) add(errors, "SPELL_SCHOOL_DISABLED", `\u0428\u043A\u043E\u043B\u0430 \xAB${spell.discipline}\xBB \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u0430 \u0432 \u0442\u0435\u043A\u0443\u0449\u0435\u043C \u043F\u0430\u043A\u0435\u0442\u0435 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438.`, "creation.startingSpells");
    }
    if (replay.ageTalents.spent !== replay.ageTalents.total) add(errors, "AGE_TALENT_POINTS", `\u041D\u0443\u0436\u043D\u043E \u043F\u043E\u0442\u0440\u0430\u0442\u0438\u0442\u044C \u0440\u043E\u0432\u043D\u043E ${replay.ageTalents.total} \u0432\u043E\u0437\u0440\u0430\u0441\u0442\u043D\u044B\u0445 \u043E\u0447\u043A\u043E\u0432 \u0442\u0430\u043B\u0430\u043D\u0442\u043E\u0432, \u0441\u0435\u0439\u0447\u0430\u0441 ${replay.ageTalents.spent}.`, "creation.ageTalentLedger");
    const baseXp = Number(character.experience?.baseTotal ?? 0);
    if (!Number.isInteger(baseXp) || baseXp < 0) add(errors, "XP_VALUES", "Base XP \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u0446\u0435\u043B\u044B\u043C \u0438 \u043D\u0435\u043E\u0442\u0440\u0438\u0446\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u043C.", "experience.baseTotal");
    const maximumBaseXp = builderSettings.maximumBaseXp === null || builderSettings.maximumBaseXp === void 0 || builderSettings.maximumBaseXp === "" ? null : Number(builderSettings.maximumBaseXp);
    if (maximumBaseXp !== null && Number.isFinite(maximumBaseXp) && maximumBaseXp >= 0 && baseXp > maximumBaseXp) add(errors, "XP_CAP", `\u0412 \u0442\u0435\u043A\u0443\u0449\u0435\u043C \u043F\u0430\u043A\u0435\u0442\u0435 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438 \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043D\u043E \u043D\u0435 \u0431\u043E\u043B\u0435\u0435 ${maximumBaseXp} Base XP.`, "experience.baseTotal");
    const nativeLanguages = (character.languages ?? []).filter((entry) => entry.native);
    if (nativeLanguages.length > 1) add(errors, "NATIVE_LANGUAGE_COUNT", "\u0411\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u044B\u043C \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u043E\u0434\u0438\u043D \u0440\u043E\u0434\u043D\u043E\u0439 \u044F\u0437\u044B\u043A.", "languages");
    if (nativeLanguages.length === 1 && !allowedNativeLanguages(character, rules).includes(nativeLanguages[0].languageId)) add(errors, "NATIVE_LANGUAGE_INVALID", "\u0412\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u044B\u0439 \u0440\u043E\u0434\u043D\u043E\u0439 \u044F\u0437\u044B\u043A \u043D\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043F\u0440\u043E\u0438\u0441\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u044E \u0438\u043B\u0438 \u0440\u0430\u0441\u0435.", "languages");
    const languageIds = /* @__PURE__ */ new Set();
    for (const selection of character.languages ?? []) {
      const language = index.languages.get(selection.languageId);
      if (languageIds.has(selection.languageId)) add(errors, "LANGUAGE_DUPLICATE", `${language?.name ?? selection.languageId} \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D \u0434\u0432\u0430\u0436\u0434\u044B.`, "languages");
      languageIds.add(selection.languageId);
      if (!language || language.levels?.[selection.level] === void 0) add(errors, "LANGUAGE_LEVEL", "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u044F\u0437\u044B\u043A \u0438\u043B\u0438 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u0439 \u0443\u0440\u043E\u0432\u0435\u043D\u044C.", "languages");
      if (language?.creationOrigins && !language.creationOrigins.includes(identity.originId)) add(errors, "LANGUAGE_ORIGIN", `${language.name} \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u043F\u0440\u0438 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u043C \u043F\u0440\u043E\u0438\u0441\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u0438.`, "languages");
      if (language?.nativeOnlyOrigins && selection.native && !language.nativeOnlyOrigins.includes(identity.originId)) add(errors, "LANGUAGE_NATIVE", `${language.name} \u043D\u0435\u043B\u044C\u0437\u044F \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u043E \u043F\u0440\u0438 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u043C \u043F\u0440\u043E\u0438\u0441\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u0438.`, "languages");
    }
    const spentLanguage = totalLanguageCost(character, rules);
    const budgetLanguage = languageBudget(character);
    if (spentLanguage > budgetLanguage) add(errors, "LANGUAGE_BUDGET", `\u041D\u0430 \u044F\u0437\u044B\u043A\u0438 \u043F\u043E\u0442\u0440\u0430\u0447\u0435\u043D\u043E ${spentLanguage} \u0438\u0437 ${budgetLanguage} \u043E\u0447\u043A\u043E\u0432.`, "languages");
    if (spentLanguage < budgetLanguage) add(warnings, "LANGUAGE_UNUSED", `\u041D\u0435 \u043F\u043E\u0442\u0440\u0430\u0447\u0435\u043D\u043E \u043E\u0447\u043A\u043E\u0432 \u044F\u0437\u044B\u043A\u043E\u0432: ${budgetLanguage - spentLanguage}.`, "languages");
    const reputation = replay.final.reputation;
    const reputationEntries = normalizeReputationEntries(character.reputation);
    const reputationTotal = reputationEntries.reduce((sum, entry) => sum + entry.amount, 0);
    if (reputationTotal !== reputation) {
      add(errors, "REPUTATION_TOTAL", `\u0412 \u0437\u0430\u043F\u0438\u0441\u044F\u0445 \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u043E ${reputationTotal} \u0438\u0437 ${reputation} \u043F\u0443\u043D\u043A\u0442\u043E\u0432 \u0440\u0435\u043F\u0443\u0442\u0430\u0446\u0438\u0438.`, "reputation.entries");
    }
    for (const [position, entry] of reputationEntries.entries()) {
      if (!entry.description) add(errors, "REPUTATION_DESCRIPTION", `\u0423 \u0437\u0430\u043F\u0438\u0441\u0438 \u0440\u0435\u043F\u0443\u0442\u0430\u0446\u0438\u0438 ${position + 1} \u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u043E, \u043F\u043E\u0447\u0435\u043C\u0443 \u043E\u043D\u0430 \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0430.`, `reputation.entries.${position}.description`);
    }
    const biography = character.biography ?? {};
    const biographyLabels = {
      concept: "\u041A\u043E\u043D\u0446\u0435\u043F\u0442",
      appearance: "\u0412\u043D\u0435\u0448\u043D\u043E\u0441\u0442\u044C",
      background: "\u041F\u0440\u0435\u0434\u044B\u0441\u0442\u043E\u0440\u0438\u044F",
      family: "\u0421\u0435\u043C\u044C\u044F",
      pride: "\u0413\u043E\u0440\u0434\u043E\u0441\u0442\u044C",
      darkSecret: "\u0422\u0451\u043C\u043D\u044B\u0439 \u0441\u0435\u043A\u0440\u0435\u0442",
      motivation: "\u041C\u043E\u0442\u0438\u0432\u0430\u0446\u0438\u044F",
      partyConnections: "\u0421\u0432\u044F\u0437\u044C \u0441 \u0433\u0440\u0443\u043F\u043F\u043E\u0439"
    };
    const requiredBiographyFields = new Set(builderSettings.requiredBiographyFields ?? []);
    for (const field of ["concept", "appearance", "background", "family", "pride", "darkSecret", "motivation", "partyConnections"]) {
      if (!String(biography[field] ?? "").trim()) {
        if (requiredBiographyFields.has(field)) add(errors, "BIO_REQUIRED", `\u041E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u043F\u043E\u043B\u0435 \xAB${biographyLabels[field]}\xBB \u043D\u0435 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u043E.`, `biography.${field}`);
        else add(warnings, "BIO_EMPTY", `\u041D\u0435 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u043E \u043F\u043E\u043B\u0435 \xAB${biographyLabels[field]}\xBB.`, `biography.${field}`);
      }
    }
    if (character.formatVersion >= 4) {
      const questionLabels = {
        bestFriend: "\u041B\u0443\u0447\u0448\u0438\u0439 \u0434\u0440\u0443\u0433",
        favoriteFood: "\u041B\u044E\u0431\u0438\u043C\u043E\u0435 \u0431\u043B\u044E\u0434\u043E",
        prejudices: "\u041F\u0440\u0435\u0434\u0443\u0431\u0435\u0436\u0434\u0435\u043D\u0438\u044F",
        aristocracy: "\u041E\u0442\u043D\u043E\u0448\u0435\u043D\u0438\u0435 \u043A \u0430\u0440\u0438\u0441\u0442\u043E\u043A\u0440\u0430\u0442\u0438\u0438",
        favoriteMemory: "\u041B\u044E\u0431\u0438\u043C\u043E\u0435 \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0435",
        oneWish: "\u041E\u0434\u043D\u043E \u0436\u0435\u043B\u0430\u043D\u0438\u0435",
        greatestFear: "\u0413\u043B\u0430\u0432\u043D\u044B\u0439 \u0441\u0442\u0440\u0430\u0445"
      };
      for (const [field, label] of Object.entries(questionLabels)) {
        if (!String(biography.questions?.[field] ?? "").trim()) add(warnings, "BIO_QUESTION_EMPTY", `\u041D\u0435 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D \u043E\u0442\u0432\u0435\u0442: ${label}.`, `biography.questions.${field}`);
      }
      const otherCharacters = Number(biography.otherActiveCharacters ?? 0);
      if (!Number.isInteger(otherCharacters) || otherCharacters < 0 || otherCharacters > 20) {
        add(errors, "RUMOR_PARTY_SIZE", "\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u0434\u0440\u0443\u0433\u0438\u0445 \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0445 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0435\u0439 \u0434\u043E\u043B\u0436\u043D\u043E \u0431\u044B\u0442\u044C \u0446\u0435\u043B\u044B\u043C \u0447\u0438\u0441\u043B\u043E\u043C \u043E\u0442 0 \u0434\u043E 20.", "biography.otherActiveCharacters");
      } else {
        const rumors = Array.isArray(biography.rumors) ? biography.rumors : [];
        const nonEmptyRumors = rumors.filter((entry) => String(entry?.text ?? "").trim());
        if (rumors.some((entry) => !String(entry?.text ?? "").trim())) add(errors, "RUMOR_EMPTY", "\u041F\u0443\u0441\u0442\u043E\u0439 \u0441\u043B\u0443\u0445 \u043D\u0443\u0436\u043D\u043E \u0437\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u0438\u043B\u0438 \u0443\u0434\u0430\u043B\u0438\u0442\u044C.", "biography.rumors");
        const configuredRumorCount = builderSettings.rumorCountMode === "fixed" ? Math.max(0, Number(builderSettings.requiredRumorCount ?? 0)) : otherCharacters;
        if (nonEmptyRumors.length !== configuredRumorCount) add(errors, "RUMOR_COUNT", `\u041D\u0443\u0436\u043D\u043E \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u044C ${configuredRumorCount} \u0441\u043B\u0443\u0445\u043E\u0432, \u0441\u0435\u0439\u0447\u0430\u0441 ${nonEmptyRumors.length}.`, "biography.rumors");
        if (configuredRumorCount >= 2) {
          if (!nonEmptyRumors.some((entry) => entry.truth === "true")) add(errors, "RUMOR_TRUE_REQUIRED", "\u0421\u0440\u0435\u0434\u0438 \u0441\u043B\u0443\u0445\u043E\u0432 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u0438\u043D \u043F\u0440\u0430\u0432\u0434\u0438\u0432\u044B\u0439.", "biography.rumors");
          if (!nonEmptyRumors.some((entry) => entry.truth === "false")) add(errors, "RUMOR_FALSE_REQUIRED", "\u0421\u0440\u0435\u0434\u0438 \u0441\u043B\u0443\u0445\u043E\u0432 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u0438\u043D \u043B\u043E\u0436\u043D\u044B\u0439.", "biography.rumors");
        }
      }
      for (const [position, request] of (character.gmRequests ?? []).entries()) {
        if (!String(request?.category ?? "").trim()) add(errors, "GM_REQUEST_CATEGORY", `\u0417\u0430\u043F\u0440\u043E\u0441 \u0413\u041C\u0443 \u2116${position + 1}: \u043D\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u0430 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F.`, `gmRequests.${position}.category`);
        if (!String(request?.description ?? "").trim()) add(errors, "GM_REQUEST_DESCRIPTION", `\u0417\u0430\u043F\u0440\u043E\u0441 \u0413\u041C\u0443 \u2116${position + 1}: \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435.`, `gmRequests.${position}.description`);
      }
    }
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      derived: {
        age,
        ageCategory: category,
        attributeMaxima: Object.fromEntries(ATTRIBUTES.map((attribute) => [attribute, attributeMaximum(attribute, character, rules)])),
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
  function sanitizeEmbeddedItem(snapshot, rank = null, foundryGeneration = null) {
    const item = cloneValue(snapshot);
    for (const key of ["_id", "folder", "sort", "_stats", "ownership"]) delete item[key];
    item.flags ??= {};
    delete item.flags["scene-packer"];
    if (rank !== null && item.system) {
      const numericRank = Number(rank);
      if (Number.isFinite(numericRank)) item.system.rank = numericRank;
    }
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
  function characterToQuickAccessBiographyProfile(character, rules) {
    const index = indexRules(rules);
    const identity = character.identity ?? {};
    const bio = character.biography ?? {};
    const kin = index.kin.get(identity.kinId);
    const kinVariant = kin?.variants?.find((entry) => entry.id === identity.kinVariantId);
    const profession = index.professions.get(identity.professionId);
    const origin = index.origins.get(identity.originId);
    const religion = index.religions.get(identity.religionId);
    const birthDate = identity.birthDate ?? {};
    const monthName = index.months.get(birthDate.month)?.name ?? birthDate.month ?? "";
    const birthLabel = [birthDate.day, monthName, birthDate.year ? `${birthDate.year} \u041F.\u041F.` : ""].filter(Boolean).join(" ");
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
        text: String(entry?.text ?? ""),
        truth: ["true", "false", "uncertain"].includes(entry?.truth) ? entry.truth : "uncertain"
      })),
      legacy: { face: "", body: "", clothing: "" }
    };
  }
  function characterToActorData(character, rules, options = {}) {
    const validation = validateCharacter(character, rules);
    const allowInvalid = options.allowInvalid === true;
    if (!validation.valid && !allowInvalid) throw new RuleError("INVALID_CHARACTER", "\u041D\u0435\u043B\u044C\u0437\u044F \u0441\u043E\u0437\u0434\u0430\u0442\u044C Actor \u0438\u0437 \u043D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u043E\u0433\u043E \u0444\u0430\u0439\u043B\u0430 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430.");
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
    const actorName = String(identity.name ?? "").trim() || "\u0411\u0435\u0437 \u0438\u043C\u0435\u043D\u0438";
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
      ["\u041B\u0443\u0447\u0448\u0438\u0439 \u0434\u0440\u0443\u0433", questions.bestFriend],
      ["\u041B\u044E\u0431\u0438\u043C\u043E\u0435 \u0431\u043B\u044E\u0434\u043E", questions.favoriteFood],
      ["\u041F\u0440\u0435\u0434\u0443\u0431\u0435\u0436\u0434\u0435\u043D\u0438\u044F", questions.prejudices],
      ["\u041E\u0442\u043D\u043E\u0448\u0435\u043D\u0438\u0435 \u043A \u0430\u0440\u0438\u0441\u0442\u043E\u043A\u0440\u0430\u0442\u0438\u0438", questions.aristocracy],
      ["\u041B\u044E\u0431\u0438\u043C\u043E\u0435 \u0432\u043E\u0441\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0435", questions.favoriteMemory],
      ["\u041E\u0434\u043D\u043E \u0436\u0435\u043B\u0430\u043D\u0438\u0435", questions.oneWish],
      ["\u0413\u043B\u0430\u0432\u043D\u044B\u0439 \u0441\u0442\u0440\u0430\u0445", questions.greatestFear]
    ];
    const physicalEntries = [
      ["\u0420\u043E\u0441\u0442", bio.physical?.height],
      ["\u0412\u0435\u0441", bio.physical?.weight],
      ["\u041A\u043E\u0436\u0430", bio.physical?.skin],
      ["\u0413\u043B\u0430\u0437\u0430", bio.physical?.eyes],
      ["\u0412\u043E\u043B\u043E\u0441\u044B", bio.physical?.hair],
      ["\u041E\u0441\u043E\u0431\u044B\u0435 \u043F\u0440\u0438\u043C\u0435\u0442\u044B", bio.physical?.distinguishingMarks]
    ];
    const rumorTruth = { true: "\u043F\u0440\u0430\u0432\u0434\u0430", false: "\u043B\u043E\u0436\u044C", uncertain: "\u043D\u0435 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u043E" };
    const requestCategories = {
      "rule-exception": "\u0418\u0441\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u0438\u0437 \u043F\u0440\u0430\u0432\u0438\u043B",
      "profession-skill": "\u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u043A\u043B\u0430\u0441\u0441\u043E\u0432\u043E\u0433\u043E \u043D\u0430\u0432\u044B\u043A\u0430",
      "custom-talent": "\u0410\u0432\u0442\u043E\u0440\u0441\u043A\u0438\u0439 \u0442\u0430\u043B\u0430\u043D\u0442",
      "unusual-background": "\u041D\u0435\u043E\u0431\u044B\u0447\u043D\u0430\u044F \u043F\u0440\u0435\u0434\u044B\u0441\u0442\u043E\u0440\u0438\u044F",
      other: "\u041F\u0440\u043E\u0447\u0435\u0435"
    };
    const labelLine = (label, value, paragraphs = false) => {
      if (!String(value ?? "").trim()) return "";
      return paragraphs ? `<p><strong><em>${escapeHtml(label)}:</em></strong></p>${paragraphHtml(value)}` : `<p><strong><em>${escapeHtml(label)}:</em></strong> ${escapeHtml(value)}</p>`;
    };
    const sectionTitle = (title) => `<p><strong>${escapeHtml(title)}</strong></p>`;
    const noteHtml = [
      sectionTitle("\u041E\u0441\u043D\u043E\u0432\u043D\u044B\u0435 \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F"),
      `<p><strong><em>\u0414\u0430\u0442\u0430 \u0440\u043E\u0436\u0434\u0435\u043D\u0438\u044F:</em></strong> ${birthDate.day ?? "?"} ${escapeHtml(monthName)}, ${birthDate.year ?? "?"} \u041F.\u041F.<br><strong><em>\u041F\u0440\u043E\u0438\u0441\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u0435:</em></strong> ${escapeHtml(origin?.name ?? identity.originId ?? "\u041D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u043E")}${identity.originDetail ? `, ${escapeHtml(identity.originDetail)}` : ""}${identity.citizenship ? `<br><strong><em>\u0413\u0440\u0430\u0436\u0434\u0430\u043D\u0441\u0442\u0432\u043E:</em></strong> ${escapeHtml(identity.citizenship)}` : ""}${religion ? `<br><strong><em>\u0412\u0435\u0440\u0430:</em></strong> ${escapeHtml(religion.name)}` : ""}${identity.religionDetail ? ` \u2014 ${escapeHtml(identity.religionDetail)}` : ""}</p>`,
      sectionTitle("\u041A\u043E\u043D\u0446\u0435\u043F\u0442"),
      paragraphHtml(bio.concept),
      sectionTitle("\u0412\u043D\u0435\u0448\u043D\u043E\u0441\u0442\u044C"),
      paragraphHtml(bio.appearance),
      ...physicalEntries.map(([label, value]) => labelLine(label, value)),
      sectionTitle("\u041F\u0440\u0435\u0434\u044B\u0441\u0442\u043E\u0440\u0438\u044F"),
      paragraphHtml(bio.background),
      sectionTitle("\u0421\u0435\u043C\u044C\u044F"),
      paragraphHtml(bio.family),
      sectionTitle("\u041C\u043E\u0442\u0438\u0432\u0430\u0446\u0438\u044F \u0438 \u0441\u0432\u044F\u0437\u044C \u0441 \u0433\u0440\u0443\u043F\u043F\u043E\u0439"),
      paragraphHtml(bio.motivation),
      paragraphHtml(bio.partyConnections),
      sectionTitle("\u041E\u0442\u0432\u0435\u0442\u044B \u043D\u0430 \u0432\u043E\u043F\u0440\u043E\u0441\u044B"),
      ...questionEntries.map(([label, value]) => labelLine(label, value, true)),
      paragraphHtml(questions.notes ?? bio.answers ?? ""),
      sectionTitle("\u0421\u043B\u0443\u0445\u0438"),
      `<ol>${(bio.rumors ?? []).map((entry) => `<li>${escapeHtml(entry.text)} <em>(${escapeHtml(rumorTruth[entry.truth] ?? entry.truth ?? "\u043D\u0435 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u043E")})</em></li>`).join("")}</ol>`,
      sectionTitle("\u041F\u0440\u043E\u0438\u0441\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u0435 \u0440\u0435\u043F\u0443\u0442\u0430\u0446\u0438\u0438"),
      `<ol>${reputationEntries.map((entry) => `<li><strong>${escapeHtml(entry.amount)}</strong> \u2014 ${escapeHtml(entry.description || "\u041F\u0440\u0438\u0447\u0438\u043D\u0430 \u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u0430")}${entry.location ? ` <em>(${escapeHtml(entry.location)})</em>` : ""}</li>`).join("")}</ol>`,
      sectionTitle("\u042F\u0437\u044B\u043A\u0438"),
      `<ul>${(character.languages ?? []).map((entry) => `<li>${escapeHtml(index.languages.get(entry.languageId)?.name ?? entry.languageId)}: ${escapeHtml(entry.level)}${entry.native ? " (\u0440\u043E\u0434\u043D\u043E\u0439)" : ""}</li>`).join("")}</ul>`,
      sectionTitle("\u041F\u043E\u0436\u0435\u043B\u0430\u043D\u0438\u044F \u043F\u043E \u0441\u043D\u0430\u0440\u044F\u0436\u0435\u043D\u0438\u044E"),
      paragraphHtml(character.equipmentRequest ?? ""),
      sectionTitle("\u0417\u0430\u043F\u0440\u043E\u0441\u044B \u0413\u041C\u0443"),
      `<ol>${(character.gmRequests ?? []).map((entry) => `<li><strong>${escapeHtml(requestCategories[entry.category] ?? entry.category ?? "\u041F\u0440\u043E\u0447\u0435\u0435")}</strong>: ${escapeHtml(entry.description ?? "")}</li>`).join("")}</ol>`,
      sectionTitle("Base XP"),
      `<p>\u0422\u0435\u043A\u0443\u0449\u0438\u0439 Base XP: ${character.experience?.baseTotal ?? 0}; \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E \u043D\u0430 \u0440\u0430\u0437\u0432\u0438\u0442\u0438\u0435: ${validation.derived.xpBudget}; \u043F\u043E\u0442\u0440\u0430\u0447\u0435\u043D\u043E: ${validation.derived.xpSpent}; \u043E\u0441\u0442\u0430\u0442\u043E\u043A: ${validation.derived.xpRemaining}.</p>`
    ].filter(Boolean).join("");
    const attributes = Object.fromEntries(ATTRIBUTES.map((attribute) => {
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
          importedAt: (/* @__PURE__ */ new Date()).toISOString()
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
          kin: { label: "BIO.KIN", value: kin?.name ?? identity.kinId ?? "\u041D\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u0430" },
          profession: { label: "BIO.PROFESSION", value: profession?.name ?? identity.professionId ?? "\u041D\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u0430" },
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
  function normalizeReputationEntries(value) {
    const source = value ?? {};
    if (Array.isArray(source.entries)) {
      return source.entries.map((entry, position) => {
        const amount = Math.max(0, Math.floor(Number(entry?.amount) || 0));
        if (amount < 1) return null;
        return {
          id: String(entry?.id ?? `rep-${position + 1}`).trim() || `rep-${position + 1}`,
          amount,
          description: String(entry?.description ?? entry?.reason ?? "").trim(),
          location: String(entry?.location ?? entry?.place ?? "").trim()
        };
      }).filter(Boolean);
    }
    return (Array.isArray(source.origins) ? source.origins : []).map((description, position) => ({
      id: `rep-${position + 1}`,
      amount: 1,
      description: String(description ?? "").trim(),
      location: ""
    }));
  }
  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function paragraphHtml(value) {
    const text = String(value ?? "").trim();
    if (!text) return "";
    return text.split(/\n{2,}/u).map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`).join("");
  }

  // shared/mortar-core.mjs
  var ATTRIBUTES2 = ["strength", "agility", "wits", "empathy"];
  var MODULE_ID = "air-islands-character-importer";
  var MORTAR_BASE_ATTRIBUTE_POINTS = 13;
  var MORTAR_BASE_ATTRIBUTE_MAXIMUM = 6;
  var MORTAR_FINAL_ATTRIBUTE_MAXIMUM = 8;
  var cloneValue2 = (value) => typeof globalThis.structuredClone === "function" ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value));
  var makeIssue2 = (code, message, path = "") => ({ code, message, path });
  function isMortarCharacter(character) {
    return character?.identity?.kinId === "mortar";
  }
  function mortarTalents(rules) {
    return rules.catalogs.talents.items.filter((entry) => String(entry.builderRole ?? "").startsWith("mortar-"));
  }
  function recoveryTalent(rules) {
    return mortarTalents(rules).find((entry) => entry.builderRole === "mortar-recovery") ?? null;
  }
  function mechanicalBodyTalent(rules) {
    return mortarTalents(rules).find((entry) => entry.builderRole === "mortar-body") ?? null;
  }
  function operationalTalents(rules) {
    return mortarTalents(rules).filter((entry) => entry.builderRole === "mortar-operational");
  }
  function recoveryAttributeBonusPoints(rank) {
    return Math.max(0, Math.min(3, Number(rank ?? 1) - 2));
  }
  function mortarAttributeMaximumForRank(rank) {
    return Math.min(MORTAR_FINAL_ATTRIBUTE_MAXIMUM, MORTAR_BASE_ATTRIBUTE_MAXIMUM + recoveryAttributeBonusPoints(rank));
  }
  function syncMortarCreation(character) {
    if (!isMortarCharacter(character)) return character;
    const normalized = cloneValue2(character);
    normalized.creation ??= {};
    normalized.creation.mortar ??= { killerRoll: null, defectRoll: null };
    normalized.reputation ??= { entries: [] };
    normalized.reputation.entries ??= [];
    const position = normalized.reputation.entries.findIndex((entry) => entry?.id === "mortar-killer");
    if (Number(normalized.creation.mortar.killerRoll) === 1 && position < 0) {
      normalized.reputation.entries.unshift({ id: "mortar-killer", amount: 1, description: "\u0423\u0431\u0438\u0439\u0446\u0430", location: "" });
    } else if (Number(normalized.creation.mortar.killerRoll) !== 1 && position >= 0) normalized.reputation.entries.splice(position, 1);
    return normalized;
  }
  function safeActorConversionCharacter(character) {
    const rumors = character?.biography?.rumors;
    const gmRequests = character?.gmRequests;
    const hasNullRumor = Array.isArray(rumors) && rumors.some((entry) => entry == null);
    const hasNullRequest = Array.isArray(gmRequests) && gmRequests.some((entry) => entry == null);
    if (!hasNullRumor && !hasNullRequest) return character;
    const safe = cloneValue2(character);
    if (Array.isArray(safe.biography?.rumors)) safe.biography.rumors = safe.biography.rumors.map((entry) => entry ?? {});
    if (Array.isArray(safe.gmRequests)) safe.gmRequests = safe.gmRequests.map((entry) => entry ?? {});
    return safe;
  }
  function isD66(value) {
    const text = String(value ?? "");
    return /^[1-6][1-6]$/u.test(text);
  }
  function isLegacyCalibrationTransaction(tx) {
    return tx?.type === "talent" && /^talent:air-islands\.mortar:mCal/iu.test(String(tx.catalogId ?? ""));
  }
  function startingSkillCost2(rank) {
    return startingSkillCost(rank);
  }
  function generalTalentCost(talent, targetRank, state, rules) {
    const baseCost = Number(rules.talentXpCosts.general[targetRank - 1]);
    if (!Number.isFinite(baseCost)) return { base: Number.POSITIVE_INFINITY, surcharge: 0, multiplier: 1, total: Number.POSITIVE_INFINITY };
    let distinct = 0;
    for (const catalogId of state.talents.keys()) {
      const entry = rules.catalogs.talents.items.find((item) => item.catalogId === catalogId);
      if (entry?.builderRole === "mortar-body") continue;
      distinct += 1;
    }
    if (!state.talents.has(talent.catalogId)) distinct += 1;
    const surcharge = Math.max(0, distinct - 5);
    let total = baseCost + surcharge;
    const engineering = operationalTalents(rules).find((entry) => entry.name === "Engineering Protocol");
    const engineeringRank = engineering ? state.talents.get(engineering.catalogId) ?? 0 : 0;
    const craftTalentNames = /* @__PURE__ */ new Set(["Alchemist", "Apothecary", "Bowyer", "Builder", "Inventor", "Smith", "Tailor", "Tanner"]);
    const engineeringDiscount = talent.type === "general" && !talent.builderRole && craftTalentNames.has(talent.name) && targetRank <= engineeringRank;
    if (engineeringDiscount) total = Math.ceil(total / 2);
    return { base: baseCost, surcharge, multiplier: 1, engineeringDiscount, total };
  }
  function mortarSkillCost(skillId, targetRank, state, rules) {
    const baseCost = Number(rules.skillXpCosts.other[targetRank - 1]);
    if (!Number.isFinite(baseCost)) return Number.POSITIVE_INFINITY;
    if (skillId !== "crafting") return baseCost;
    const engineering = operationalTalents(rules).find((entry) => entry.name === "Engineering Protocol");
    const engineeringRank = engineering ? state.talents.get(engineering.catalogId) ?? 0 : 0;
    return targetRank <= engineeringRank ? Math.ceil(baseCost / 2) : baseCost;
  }
  function createMortarState(character, rules) {
    const skills = new Map(rules.skills.map((skill) => [skill.id, Number(character.skills?.[skill.id]?.startingRank ?? 0)]));
    const attributes = new Map(ATTRIBUTES2.map((attribute) => [attribute, Number(character.attributes?.[attribute] ?? 0)]));
    const talents = /* @__PURE__ */ new Map();
    const talentSources = /* @__PURE__ */ new Map();
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
      spells: /* @__PURE__ */ new Map(),
      reputation: killerRoll === 1 ? 1 : 0,
      xpSpent: 0,
      xpRemaining: baseXpAllowance(character),
      transactionResults: [],
      operationalOrder: []
    };
  }
  function evaluateMortarXpTransaction(tx, character, rules, index, state) {
    if (!tx || typeof tx !== "object") return { valid: false, issue: makeIssue2("XP_LEDGER_ENTRY", "\u041F\u043E\u0432\u0440\u0435\u0436\u0434\u0451\u043D\u043D\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C \u0436\u0443\u0440\u043D\u0430\u043B\u0430 Base XP.") };
    if (tx.type === "skill") {
      const skill = index.skills.get(tx.skillId);
      if (!skill) return { valid: false, issue: makeIssue2("XP_SKILL_UNKNOWN", "\u0423\u043A\u0430\u0437\u0430\u043D \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u043D\u0430\u0432\u044B\u043A.") };
      const current = state.skills.get(tx.skillId) ?? 0;
      const target = Number(tx.toRank);
      if (!Number.isInteger(target) || target !== current + 1 || target > 5) {
        return { valid: false, issue: makeIssue2("XP_SKILL_SEQUENCE", `${skill.name}: \u043E\u0436\u0438\u0434\u0430\u043B\u0441\u044F \u043F\u0435\u0440\u0435\u0445\u043E\u0434 ${current} \u2192 ${current + 1}.`) };
      }
      const cost = mortarSkillCost(tx.skillId, target, state, rules);
      return { valid: Number.isFinite(cost), cost, label: `${skill.name}: Rank ${current} \u2192 ${target}`, apply: () => state.skills.set(tx.skillId, target) };
    }
    if (tx.type === "talent") {
      const talent = index.talents.get(tx.catalogId);
      if (!talent) return { valid: false, issue: makeIssue2("XP_TALENT_UNKNOWN", "\u0423\u043A\u0430\u0437\u0430\u043D \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0442\u0430\u043B\u0430\u043D\u0442.") };
      const current = state.talents.get(tx.catalogId) ?? 0;
      const target = Number(tx.toRank);
      if (talent.builderRole === "mortar-body") {
        return { valid: false, issue: makeIssue2("MORTAR_BODY_FIXED", "\xAB\u041C\u0435\u0445\u0430\u043D\u0438\u0447\u0435\u0441\u043A\u043E\u0435 \u0422\u0435\u043B\u043E\xBB \u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u043E \u0434\u0430\u0451\u0442\u0441\u044F \u0432\u0441\u0435\u043C \u043C\u043E\u0440\u0442\u0430\u0440\u0430\u043C \u0438 \u043D\u0435 \u0438\u043C\u0435\u0435\u0442 \u043F\u043E\u0432\u044B\u0448\u0430\u0435\u043C\u044B\u0445 \u0440\u0430\u043D\u0433\u043E\u0432.") };
      }
      const maxRank = Number(talent.maximumRank ?? 5);
      if (!Number.isInteger(target) || target !== current + 1 || target > maxRank) {
        return { valid: false, issue: makeIssue2("XP_TALENT_SEQUENCE", `${talent.name}: \u043E\u0436\u0438\u0434\u0430\u043B\u0441\u044F \u043F\u0435\u0440\u0435\u0445\u043E\u0434 ${current} \u2192 ${current + 1}.`) };
      }
      if (talent.builderRole === "mortar-recovery") {
        const cost = Number(rules.talentXpCosts.general[target - 1]) * Number(rules.talentXpCosts.kinMultiplier ?? 2);
        return {
          valid: Number.isFinite(cost),
          cost,
          breakdown: { base: Number(rules.talentXpCosts.general[target - 1]), surcharge: 0, multiplier: Number(rules.talentXpCosts.kinMultiplier ?? 2), total: cost },
          label: `${talent.name}: Rank ${current} \u2192 ${target}`,
          apply: () => state.talents.set(tx.catalogId, target)
        };
      }
      if (talent.builderRole === "mortar-operational") {
        const recovery = recoveryTalent(rules);
        const recoveryRank = recovery ? state.talents.get(recovery.catalogId) ?? 0 : 0;
        if (current === 0) {
          if (recoveryRank < 2) return { valid: false, issue: makeIssue2("MORTAR_PROTOCOL_LOCKED", "\u041F\u0435\u0440\u0432\u044B\u0439 Operational Protocol \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043D\u0430 Recovery Protocol Rank 2.") };
          if (state.operationalOrder.length) {
            if (recoveryRank < 3) return { valid: false, issue: makeIssue2("MORTAR_PROTOCOL_ADDITIONAL_LOCKED", "\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 Operational Protocols \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u044E\u0442\u0441\u044F \u043F\u043E\u0441\u043B\u0435 Recovery Protocol Rank 3.") };
            const previousId = state.operationalOrder.at(-1);
            const previous = index.talents.get(previousId);
            const previousRank = state.talents.get(previousId) ?? 0;
            if (previousRank < 3) return { valid: false, issue: makeIssue2("MORTAR_PROTOCOL_PREVIOUS_RANK", `\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0440\u0430\u0437\u0432\u0435\u0439\u0442\u0435 ${previous?.name ?? "\u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0438\u0439 Operational Protocol"} \u0434\u043E Rank 3.`) };
          }
        }
        const firstFree = current === 0 && state.operationalOrder.length === 0;
        const breakdown2 = firstFree ? { base: 0, surcharge: 0, multiplier: 1, total: 0 } : generalTalentCost(talent, target, state, rules);
        return {
          valid: Number.isFinite(breakdown2.total),
          cost: breakdown2.total,
          breakdown: breakdown2,
          label: `${talent.name}: Rank ${current} \u2192 ${target}${firstFree ? " (Recovery Rank 2)" : ""}`,
          apply: () => {
            state.talents.set(tx.catalogId, target);
            if (!state.talentSources.has(tx.catalogId)) state.talentSources.set(tx.catalogId, firstFree ? "recovery" : "xp");
            if (current === 0) state.operationalOrder.push(tx.catalogId);
          }
        };
      }
      if (talent.type === "profession" || talent.type === "kin") {
        return { valid: false, issue: makeIssue2("MORTAR_TALENT_ACCESS", "\u041C\u043E\u0440\u0442\u0430\u0440 \u043D\u0435 \u0438\u043C\u0435\u0435\u0442 Profession Talents \u0438 \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u043F\u043E\u043A\u0443\u043F\u0430\u0442\u044C \u0440\u0430\u0441\u043E\u0432\u044B\u0435 \u0442\u0430\u043B\u0430\u043D\u0442\u044B \u0434\u0440\u0443\u0433\u0438\u0445 \u0440\u0430\u0441.") };
      }
      if (talent.type !== "general") return { valid: false, issue: makeIssue2("MORTAR_TALENT_ACCESS", "\u042D\u0442\u043E\u0442 \u0442\u0430\u043B\u0430\u043D\u0442 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u043C\u043E\u0440\u0442\u0430\u0440\u0443.") };
      const breakdown = generalTalentCost(talent, target, state, rules);
      return {
        valid: Number.isFinite(breakdown.total),
        cost: breakdown.total,
        breakdown,
        label: `${talent.name}: Rank ${current} \u2192 ${target}`,
        apply: () => {
          state.talents.set(tx.catalogId, target);
          if (!state.talentSources.has(tx.catalogId)) state.talentSources.set(tx.catalogId, "xp");
        }
      };
    }
    if (tx.type === "spell") return { valid: false, issue: makeIssue2("MORTAR_NO_MAGIC_PATH", "\u041C\u043E\u0440\u0442\u0430\u0440 \u043D\u0435 \u0438\u043C\u0435\u0435\u0442 Professional Path, \u043F\u043E\u044D\u0442\u043E\u043C\u0443 \u0437\u0430\u043A\u043B\u0438\u043D\u0430\u043D\u0438\u044F \u0447\u0435\u0440\u0435\u0437 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B.") };
    if (tx.type === "reputation") {
      const amount = Number(tx.amount ?? 1);
      if (amount !== 1) return { valid: false, issue: makeIssue2("XP_REPUTATION_AMOUNT", "\u041A\u0430\u0436\u0434\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C \u0436\u0443\u0440\u043D\u0430\u043B\u0430 \u0434\u043E\u043B\u0436\u043D\u0430 \u043F\u043E\u043A\u0443\u043F\u0430\u0442\u044C \u0440\u043E\u0432\u043D\u043E 1 Reputation.") };
      const cost = Number(rules.reputationXpCost ?? 4);
      return { valid: true, cost, label: `Reputation ${state.reputation} \u2192 ${state.reputation + 1}`, apply: () => {
        state.reputation += 1;
      } };
    }
    return { valid: false, issue: makeIssue2("XP_LEDGER_TYPE", `\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0442\u0438\u043F \u043F\u043E\u043A\u0443\u043F\u043A\u0438: ${String(tx.type ?? "?")}.`) };
  }
  function replayMortar(character, rules) {
    character = syncMortarCreation(character);
    const index = indexRules(rules);
    const state = createMortarState(character, rules);
    const issues = [];
    const xpBudget = baseXpAllowance(character);
    for (const [position, tx] of (character.experience?.ledger ?? []).entries()) {
      if (isLegacyCalibrationTransaction(tx)) continue;
      const evaluation = evaluateMortarXpTransaction(tx, character, rules, index, state);
      const path = `experience.ledger.${position}`;
      if (!evaluation.valid) {
        issues.push({ ...evaluation.issue ?? makeIssue2("XP_LEDGER_INVALID", "\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0430\u044F \u043F\u043E\u043A\u0443\u043F\u043A\u0430."), path });
        continue;
      }
      if (state.xpSpent + evaluation.cost > xpBudget) {
        issues.push(makeIssue2("XP_OVERSPEND", `${evaluation.label}: \u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C ${evaluation.cost} XP \u043F\u0440\u0435\u0432\u044B\u0448\u0430\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u0439 \u043E\u0441\u0442\u0430\u0442\u043E\u043A.`, path));
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
        transaction: cloneValue2(tx)
      });
    }
    const finalTalents = [...state.talents].map(([catalogId, rank]) => ({ catalogId, rank, source: state.talentSources.get(catalogId) ?? "xp" }));
    const finalAttributes = Object.fromEntries(state.attributes);
    const recovery = recoveryTalent(rules);
    const recoveryRank = recovery ? state.talents.get(recovery.catalogId) ?? 1 : 1;
    const attributeBonusPoints = recoveryAttributeBonusPoints(recoveryRank);
    const attributePointsTotal = MORTAR_BASE_ATTRIBUTE_POINTS + attributeBonusPoints;
    const attributePointsSpent = ATTRIBUTES2.reduce((sum, attribute) => sum + (Number(finalAttributes[attribute]) || 0), 0);
    const attributeMaximum4 = mortarAttributeMaximumForRank(recoveryRank);
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
        attributeMaximum: attributeMaximum4
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
    return result;
  }
  function ageCategoryFor2(kin, age) {
    return kin?.id === "mortar" ? "mortar" : ageCategoryFor(kin, age);
  }
  function professionFocuses2(character, rules) {
    return isMortarCharacter(character) ? [] : professionFocuses(character, rules);
  }
  function attributeMaximum2(attribute, character, rules) {
    if (!isMortarCharacter(character)) return attributeMaximum(attribute, character, rules);
    return replayMortar(character, rules).mortar.attributeMaximum;
  }
  function allowedSpellDisciplines2(character, rules, finalTalents = null) {
    return isMortarCharacter(character) ? [] : allowedSpellDisciplines(character, rules, finalTalents);
  }
  function replayCharacter2(character, rules) {
    return isMortarCharacter(character) ? replayMortar(character, rules) : replayCharacter(character, rules);
  }
  function simulateXpTransaction2(character, rules, transaction) {
    if (!isMortarCharacter(character)) return simulateXpTransaction(character, rules, transaction);
    const replay = replayMortar(character, rules);
    if (replay.issues.length) return { valid: false, issue: replay.issues[0], replay };
    const index = indexRules(rules);
    const evaluation = evaluateMortarXpTransaction(transaction, character, rules, index, replay.state);
    if (!evaluation.valid) return { ...evaluation, replay };
    const remaining = baseXpAllowance(character) - replay.final.xpSpent;
    if (evaluation.cost > remaining) return { valid: false, cost: evaluation.cost, issue: makeIssue2("XP_NOT_ENOUGH", `\u041D\u0443\u0436\u043D\u043E ${evaluation.cost} XP, \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E ${remaining}.`), replay };
    return { ...evaluation, replay, remainingAfter: remaining - evaluation.cost };
  }
  function simulateAgeTalentTransaction2(character, rules, transaction) {
    if (!isMortarCharacter(character)) return simulateAgeTalentTransaction(character, rules, transaction);
    return { valid: false, issue: makeIssue2("MORTAR_NO_AGE_TALENTS", "\u041C\u043E\u0440\u0442\u0430\u0440 \u043D\u0435 \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0442 General Talents \u043F\u0440\u0438 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u0438. \u0418\u0445 \u043C\u043E\u0436\u043D\u043E \u0438\u0437\u0443\u0447\u0430\u0442\u044C \u043F\u043E\u0441\u043B\u0435 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F \u0437\u0430 XP."), replay: replayMortar(character, rules) };
  }
  function mortarMechanicalValidation(character, rules, replay) {
    const errors = [];
    const add = (code, message, path = "") => errors.push({ code, message, path });
    const recoveryRank = replay.mortar.recoveryRank;
    const attributeTarget = replay.mortar.attributePointsTotal;
    const attributeMaximum4 = replay.mortar.attributeMaximum;
    let attributeTotal = 0;
    for (const attribute of ATTRIBUTES2) {
      const value = Number(character.attributes?.[attribute]);
      attributeTotal += Number.isFinite(value) ? value : 0;
      if (!Number.isInteger(value) || value < 2) add("ATTRIBUTE_MIN", `${attribute}: \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0434\u043E\u043B\u0436\u043D\u043E \u0431\u044B\u0442\u044C \u0446\u0435\u043B\u044B\u043C \u0438 \u043D\u0435 \u043D\u0438\u0436\u0435 2.`, `attributes.${attribute}`);
      if (value > attributeMaximum4) add("ATTRIBUTE_MAX", `${attribute}: \u043F\u0440\u0438 Recovery Protocol Rank ${recoveryRank} \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C ${attributeMaximum4}.`, `attributes.${attribute}`);
    }
    if (attributeTotal !== attributeTarget) {
      const bonusText = replay.mortar.attributeBonusPoints ? `, \u0432\u043A\u043B\u044E\u0447\u0430\u044F +${replay.mortar.attributeBonusPoints} \u043E\u0442 Recovery Protocol` : "";
      add("ATTRIBUTE_TOTAL", `\u041C\u043E\u0440\u0442\u0430\u0440 \u0434\u043E\u043B\u0436\u0435\u043D \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u0440\u043E\u0432\u043D\u043E ${attributeTarget} \u043E\u0447\u043A\u043E\u0432 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A${bonusText}, \u0441\u0435\u0439\u0447\u0430\u0441 ${attributeTotal}.`, "attributes");
    }
    let skillPoints = 0;
    for (const skill of rules.skills) {
      const starting = Number(character.skills?.[skill.id]?.startingRank ?? 0);
      if (!Number.isInteger(starting) || starting < 0 || starting > 2) add("SKILL_CAP", `${skill.name}: \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u044B\u0439 \u0440\u0430\u043D\u0433 \u043C\u043E\u0440\u0442\u0430\u0440\u0430 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043E\u0442 0 \u0434\u043E 2.`, `skills.${skill.id}.startingRank`);
      skillPoints += startingSkillCost2(starting);
    }
    if (skillPoints !== 10) add("SKILL_POINTS", `\u041C\u043E\u0440\u0442\u0430\u0440 \u0434\u043E\u043B\u0436\u0435\u043D \u043F\u043E\u0442\u0440\u0430\u0442\u0438\u0442\u044C \u0440\u043E\u0432\u043D\u043E 10 \u043E\u0447\u043A\u043E\u0432 \u043D\u0430\u0432\u044B\u043A\u043E\u0432, \u0441\u0435\u0439\u0447\u0430\u0441 ${skillPoints}.`, "skills");
    if (character.creation?.initialPathCatalogId) add("MORTAR_NO_PROFESSION_PATH", "\u041C\u043E\u0440\u0442\u0430\u0440 \u043D\u0435 \u0432\u044B\u0431\u0438\u0440\u0430\u0435\u0442 Professional Path.", "creation.initialPathCatalogId");
    if ((character.creation?.ageTalentLedger ?? []).length) add("MORTAR_NO_STARTING_GENERAL_TALENTS", "\u041C\u043E\u0440\u0442\u0430\u0440 \u043D\u0435 \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0442 General Talents \u043F\u0440\u0438 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u0438.", "creation.ageTalentLedger");
    if ((character.creation?.startingSpells ?? []).length) add("MORTAR_NO_STARTING_SPELLS", "\u041C\u043E\u0440\u0442\u0430\u0440 \u043D\u0435 \u0438\u043C\u0435\u0435\u0442 \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u044B\u0445 \u0437\u0430\u043A\u043B\u0438\u043D\u0430\u043D\u0438\u0439 \u0447\u0435\u0440\u0435\u0437 Professional Path.", "creation.startingSpells");
    const killerRoll = Number(character.creation?.mortar?.killerRoll);
    if (![1, 2].includes(killerRoll)) add("MORTAR_KILLER_ROLL", "\u0421\u0434\u0435\u043B\u0430\u0439\u0442\u0435 \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439 D2 \u0431\u0440\u043E\u0441\u043E\u043A Reputation \xAB\u0423\u0431\u0438\u0439\u0446\u0430\xBB.", "creation.mortar.killerRoll");
    if (!isD66(character.creation?.mortar?.defectRoll)) add("MORTAR_DEFECT_ROLL", "\u0421\u0434\u0435\u043B\u0430\u0439\u0442\u0435 \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439 D66 \u0431\u0440\u043E\u0441\u043E\u043A \u0434\u0435\u0444\u0435\u043A\u0442\u0430.", "creation.mortar.defectRoll");
    const knownOps = operationalTalents(rules).filter((entry) => replay.state.talents.has(entry.catalogId));
    if (recoveryRank >= 2 && knownOps.length < 1) add("MORTAR_FIRST_PROTOCOL_REQUIRED", "Recovery Protocol Rank 2 \u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u0432\u044B\u0431\u0440\u0430\u0442\u044C \u043F\u0435\u0440\u0432\u044B\u0439 Operational Protocol Rank 1. \u041E\u043D \u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u044B\u0439.", "experience.ledger");
    errors.push(...replay.issues);
    return errors;
  }
  function validateCharacter2(character, rules) {
    if (!isMortarCharacter(character)) return validateCharacter(character, rules);
    character = syncMortarCreation(character);
    const baseline = validateCharacter(character, rules);
    const ignoredCodes = /* @__PURE__ */ new Set([
      "PROFESSION_UNKNOWN",
      "PROFESSION_DISABLED",
      "BIRTH_DATE",
      "AGE_MIN",
      "AGE_MAX",
      "ATTRIBUTE_MIN",
      "ATTRIBUTE_MAX",
      "ATTRIBUTE_TOTAL",
      "SKILL_START",
      "SKILL_CAP",
      "SKILL_POINTS",
      "OLD_SKILL_FOUR",
      "PATH_MISSING",
      "PATH_ACCESS",
      "PATH_DISABLED",
      "AGE_TALENT_POINTS",
      "REPUTATION_TOTAL",
      "REPUTATION_DESCRIPTION"
    ]);
    const ignoredPrefixes = ["XP_", "AGE_", "STARTING_SPELL", "MORTAR_"];
    const keep = (issue) => !ignoredCodes.has(issue.code) && !ignoredPrefixes.some((prefix) => issue.code.startsWith(prefix));
    const errors = baseline.errors.filter(keep);
    const warnings = baseline.warnings.filter(keep);
    const replay = replayMortar(character, rules);
    errors.push(...mortarMechanicalValidation(character, rules, replay));
    const reputationEntries = normalizeReputationEntries(character.reputation);
    const reputationTotal = reputationEntries.reduce((sum, entry) => sum + entry.amount, 0);
    if (reputationTotal !== replay.final.reputation) errors.push(makeIssue2("REPUTATION_TOTAL", `\u0412 \u0437\u0430\u043F\u0438\u0441\u044F\u0445 \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u043E ${reputationTotal} \u0438\u0437 ${replay.final.reputation} \u043F\u0443\u043D\u043A\u0442\u043E\u0432 \u0440\u0435\u043F\u0443\u0442\u0430\u0446\u0438\u0438.`, "reputation.entries"));
    for (const [position, entry] of reputationEntries.entries()) if (!entry.description) errors.push(makeIssue2("REPUTATION_DESCRIPTION", `\u0423 \u0437\u0430\u043F\u0438\u0441\u0438 \u0440\u0435\u043F\u0443\u0442\u0430\u0446\u0438\u0438 ${position + 1} \u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u043E, \u043F\u043E\u0447\u0435\u043C\u0443 \u043E\u043D\u0430 \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0430.`, `reputation.entries.${position}.description`));
    const hiddenTalents = new Set(rules.builderSettings?.hiddenTalentCatalogIds ?? []);
    const index = indexRules(rules);
    for (const selection of replay.final.talents) {
      if (hiddenTalents.has(selection.catalogId)) errors.push(makeIssue2("TALENT_DISABLED", `${index.talents.get(selection.catalogId)?.name ?? selection.catalogId} \u043E\u0442\u043A\u043B\u044E\u0447\u0451\u043D \u0432 \u0442\u0435\u043A\u0443\u0449\u0435\u043C \u043F\u0430\u043A\u0435\u0442\u0435 \u043A\u0430\u043C\u043F\u0430\u043D\u0438\u0438.`, "experience.ledger"));
    }
    const languageBudget2 = languageBudget(character);
    const languageSpent = totalLanguageCost(character, rules);
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      derived: {
        age: null,
        ageCategory: "mortar",
        attributeMaxima: Object.fromEntries(ATTRIBUTES2.map((attribute) => [attribute, replay.mortar.attributeMaximum])),
        attributePoints: {
          base: replay.mortar.attributeBasePoints,
          bonus: replay.mortar.attributeBonusPoints,
          total: replay.mortar.attributePointsTotal,
          spent: replay.mortar.attributePointsSpent,
          remaining: replay.mortar.attributePointsTotal - replay.mortar.attributePointsSpent
        },
        finalAttributes: replay.final.attributes,
        languageBudget: languageBudget2,
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
  function characterToQuickAccessBiographyProfile2(character, rules) {
    const profile = characterToQuickAccessBiographyProfile(character, rules);
    if (!isMortarCharacter(character)) return profile;
    profile.identity.profession = "\u041D\u0435\u0442";
    const awakeningDate = profile.identity.birthDate ?? {};
    profile.identity.birthDate = {
      ...awakeningDate,
      label: awakeningDate.label ? `\u041F\u0440\u043E\u0431\u0443\u0436\u0434\u0435\u043D\u0438\u0435: ${awakeningDate.label}` : "\u041F\u0440\u043E\u0431\u0443\u0436\u0434\u0435\u043D\u0438\u0435 \u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u043E"
    };
    return profile;
  }
  function characterToActorData2(character, rules, options = {}) {
    if (!isMortarCharacter(character)) {
      const safeCharacter = options.allowInvalid === true ? safeActorConversionCharacter(character) : character;
      const result = characterToActorData(safeCharacter, rules, options);
      if (safeCharacter !== character && result.actorData?.flags?.[MODULE_ID]) result.actorData.flags[MODULE_ID].profile = cloneValue2(character);
      return result;
    }
    character = syncMortarCreation(character);
    const validation = validateCharacter2(character, rules);
    if (!validation.valid && options.allowInvalid !== true) throw new RuleError("INVALID_CHARACTER", "\u041D\u0435\u043B\u044C\u0437\u044F \u0441\u043E\u0437\u0434\u0430\u0442\u044C Actor \u0438\u0437 \u043D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u043E\u0433\u043E \u0444\u0430\u0439\u043B\u0430 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430.");
    const skeletonCharacter = safeActorConversionCharacter(character);
    const skeleton = characterToActorData(skeletonCharacter, rules, { ...options, allowInvalid: true });
    const actorData = skeleton.actorData;
    const index = indexRules(rules);
    const finalAttributes = validation.derived.finalAttributes ?? character.attributes ?? {};
    for (const attribute of ATTRIBUTES2) {
      const value = Number(finalAttributes[attribute] ?? 0);
      actorData.system.attribute[attribute].value = value;
      actorData.system.attribute[attribute].max = value;
    }
    for (const skill of rules.skills) actorData.system.skill[skill.id].value = validation.derived.finalSkills[skill.id] ?? 0;
    actorData.system.bio.profession.value = "\u041D\u0435\u0442";
    actorData.system.bio.age.value = 0;
    actorData.system.bio.reputation.value = validation.derived.reputation;
    actorData.system.bio.experience.value = validation.derived.xpRemaining;
    const quickAccessBiography = characterToQuickAccessBiographyProfile2(character, rules);
    const reputationEntries = normalizeReputationEntries(character.reputation);
    actorData.flags["fbl-quick-access"] = { reputationEntries: cloneValue2(reputationEntries), biographyProfile: cloneValue2(quickAccessBiography) };
    actorData.flags[MODULE_ID] ??= {};
    actorData.flags[MODULE_ID].profile = cloneValue2(character);
    actorData.flags[MODULE_ID].audit = {
      baseXp: Number(character.experience?.baseTotal ?? 0),
      xpBudget: validation.derived.xpBudget,
      xpSpent: validation.derived.xpSpent,
      xpRemaining: validation.derived.xpRemaining,
      transactionResults: cloneValue2(validation.derived.xpLedger),
      forcedImport: options.allowInvalid === true && !validation.valid,
      validationErrors: cloneValue2(validation.errors),
      validationWarnings: cloneValue2(validation.warnings)
    };
    const recovery = recoveryTalent(rules);
    const replay = replayMortar(character, rules);
    const recoveryRank = recovery ? replay.state.talents.get(recovery.catalogId) ?? 1 : 1;
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
      items.push(sanitizeEmbeddedItem(talent.snapshot, selection.rank, options.foundryGeneration));
    }
    return { actorData, items, validation };
  }

  // shared/mortar-runtime-core.mjs
  var MODULE_ID2 = "air-islands-character-importer";
  var POST_CREATION_CODES = /* @__PURE__ */ new Set(["MORTAR_KILLER_ROLL", "MORTAR_DEFECT_ROLL"]);
  var ATTRIBUTES3 = ["strength", "agility", "wits", "empathy"];
  var MORTAR_BASE_ATTRIBUTE_MAXIMUM2 = 6;
  var MORTAR_RECOVERY_ATTRIBUTE_BONUS_MAXIMUM = 3;
  var cloneValue3 = (value) => typeof globalThis.structuredClone === "function" ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value));
  function isMortarCharacter2(character) {
    return character?.identity?.kinId === "mortar";
  }
  function clearBuilderPostCreationRolls(character) {
    if (!isMortarCharacter2(character)) return character;
    character = cloneValue3(character);
    character.creation ??= {};
    character.creation.mortar ??= {};
    character.creation.mortar.killerRoll = null;
    character.creation.mortar.defectRoll = null;
    if (Array.isArray(character.reputation?.entries)) {
      character.reputation.entries = character.reputation.entries.filter((entry) => entry?.id !== "mortar-killer");
    }
    return character;
  }
  function stripPostCreationValidation(validation) {
    const errors = (validation.errors ?? []).filter((issue) => !POST_CREATION_CODES.has(issue.code));
    return { ...validation, valid: errors.length === 0, errors };
  }
  function documentAttributeMaximum(replay) {
    const bonus = Math.max(0, Math.min(
      MORTAR_RECOVERY_ATTRIBUTE_BONUS_MAXIMUM,
      Number(replay?.mortar?.attributeBonusPoints ?? 0)
    ));
    return MORTAR_BASE_ATTRIBUTE_MAXIMUM2 + bonus;
  }
  function patchMortarReplay(replay, character) {
    if (!replay?.mortar) return replay;
    const maximum = documentAttributeMaximum(replay);
    replay.mortar.attributeMaximum = maximum;
    if (replay.categoryRules) replay.categoryRules.attributePoints = replay.mortar.attributePointsTotal;
    return replay;
  }
  function patchMortarValidation(validation, character, rules) {
    const replay = patchMortarReplay(replayCharacter2(character, rules), character);
    const maximum = replay?.mortar?.attributeMaximum ?? MORTAR_BASE_ATTRIBUTE_MAXIMUM2;
    const errors = (validation.errors ?? []).filter((issue) => issue.code !== "ATTRIBUTE_MAX");
    for (const attribute of ATTRIBUTES3) {
      const value = Number(character.attributes?.[attribute]);
      if (Number.isFinite(value) && value > maximum) {
        errors.push({
          code: "ATTRIBUTE_MAX",
          message: `${attribute}: \u043F\u0440\u0438 Recovery Protocol Rank ${replay.mortar.recoveryRank} \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C ${maximum}.`,
          path: `attributes.${attribute}`
        });
      }
    }
    const derived = { ...validation.derived ?? {} };
    derived.attributeMaxima = Object.fromEntries(ATTRIBUTES3.map((attribute) => [attribute, maximum]));
    return { ...validation, valid: errors.length === 0, errors, derived };
  }
  function attributeMaximum3(attribute, character, rules) {
    if (!isMortarCharacter2(character)) return attributeMaximum2(attribute, character, rules);
    character = clearBuilderPostCreationRolls(character);
    return patchMortarReplay(replayCharacter2(character, rules), character).mortar.attributeMaximum;
  }
  function replayCharacter3(character, rules) {
    character = clearBuilderPostCreationRolls(character);
    return isMortarCharacter2(character) ? patchMortarReplay(replayCharacter2(character, rules), character) : replayCharacter2(character, rules);
  }
  function validateCharacter3(character, rules) {
    if (!isMortarCharacter2(character)) return validateCharacter2(character, rules);
    character = clearBuilderPostCreationRolls(character);
    const validation = stripPostCreationValidation(validateCharacter2(character, rules));
    return patchMortarValidation(validation, character, rules);
  }
  function simulateXpTransaction3(character, rules, transaction) {
    character = clearBuilderPostCreationRolls(character);
    const result = simulateXpTransaction2(character, rules, transaction);
    if (isMortarCharacter2(character) && result?.replay) patchMortarReplay(result.replay, character);
    return result;
  }
  function characterToActorData3(character, rules, options = {}) {
    if (!isMortarCharacter2(character)) return characterToActorData2(character, rules, options);
    character = clearBuilderPostCreationRolls(character);
    const validation = validateCharacter3(character, rules);
    if (!validation.valid && options.allowInvalid !== true) {
      throw new RuleError("INVALID_CHARACTER", "\u041D\u0435\u043B\u044C\u0437\u044F \u0441\u043E\u0437\u0434\u0430\u0442\u044C Actor \u0438\u0437 \u043D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u043E\u0433\u043E \u0444\u0430\u0439\u043B\u0430 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430.");
    }
    const converted = characterToActorData2(character, rules, { ...options, allowInvalid: true });
    converted.validation = validation;
    converted.actorData.system.bio.reputation.value = Number(validation.derived.reputation ?? 0);
    converted.actorData.flags["fbl-quick-access"] ??= {};
    converted.actorData.flags["fbl-quick-access"].reputationEntries = cloneValue3(normalizeReputationEntries(character.reputation));
    converted.actorData.flags[MODULE_ID2] ??= {};
    converted.actorData.flags[MODULE_ID2].mortar ??= {};
    converted.actorData.flags[MODULE_ID2].mortar.rules ??= {};
    Object.assign(converted.actorData.flags[MODULE_ID2].mortar.rules, {
      immuneToMostDiseasesAndPoisons: true,
      suffocationImmune: true,
      conditionImmunities: ["hungry", "sleepy", "thirsty", "cold"],
      biologicalBody: false
    });
    converted.actorData.flags[MODULE_ID2].mortar.postCreationRolls = {
      killer: "1D2",
      defect: "1D100",
      completed: false
    };
    converted.actorData.flags[MODULE_ID2].profile = cloneValue3(character);
    return converted;
  }
  return __toCommonJS(mortar_runtime_core_exports);
})();
