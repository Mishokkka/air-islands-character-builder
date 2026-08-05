(() => {
  "use strict";

  const core = globalThis.AirIslandsCore;
  const zip = globalThis.AirIslandsZip;
  const appConfig = {
    builderVersion: "1.2.1",
    rulesManifestUrl: "./rules/manifest.json",
    remoteCheckTimeoutMs: 8000,
    ...(globalThis.AIR_ISLANDS_CONFIG ?? {})
  };
  const BUILDER_VERSION = String(appConfig.builderVersion || "1.2.1");
  const RULES_DB_NAME = "air-islands-character-builder-rules";
  const RULES_DB_VERSION = 1;
  const RULES_PACKAGE_STORE = "packages";
  const RULES_STATE_STORE = "state";
  const RULES_STATE_KEY = "current";

  if (!core || !zip) {
    renderBootstrapFailure(new Error("Не загружены движок или контейнер конструктора."));
    return;
  }

  bootstrap().catch(renderBootstrapFailure);

  async function bootstrap() {
    const initial = await resolveInitialRules();
    startApplication(initial);
  }

  function startApplication(initialRulesState) {
    let rules = initialRulesState.rules;
    let rulesRuntimeState = initialRulesState;
    let index = core.indexRules(rules);
  const STORAGE_KEY = "air-islands-character-builder:draft:v7";
  const LEGACY_STORAGE_KEYS = ["air-islands-character-builder:draft:v6", "air-islands-character-builder:draft:v5", "air-islands-character-builder:draft:v4", "air-islands-character-builder:draft:v3", "air-islands-character-builder:draft:v2"];
  const STEP_STORAGE_KEY = "air-islands-character-builder:step:v7";
  const ASSET_DB_NAME = "air-islands-character-builder-assets";
  const ASSET_DB_STORE = "files";
  const defaultAllowedImageTypes = ["image/png", "image/webp", "image/jpeg"];
  const allowedImageTypes = () => new Set(rules.builderSettings?.allowedImageTypes?.length ? rules.builderSettings.allowedImageTypes : defaultAllowedImageTypes);
  const maximumAssetSize = () => Math.max(1, Number(rules.builderSettings?.maxAssetSizeMb ?? 12)) * 1024 * 1024;
  const ATTRIBUTES = [
    ["strength", "STR"],
    ["agility", "AGI"],
    ["wits", "WIT"],
    ["empathy", "EMP"]
  ];
  const LEVEL_NAMES = { basic: "Базовое", full: "Полное", academic: "Ученическое" };
  const RUMOR_TRUTH_NAMES = { true: "Правда", false: "Ложь", uncertain: "На усмотрение ГМа" };
  const GM_REQUEST_NAMES = {
    "rule-exception": "Исключение из правил",
    "profession-skill": "Изменение классового навыка",
    "custom-talent": "Авторский талант",
    "unusual-background": "Необычная предыстория",
    other: "Прочее"
  };
  const WIZARD_STEPS = [
    { id: "identity", label: "Основа и изображения", paths: ["identity", "assets", "experience.baseTotal"] },
    { id: "attributes", label: "Характеристики", paths: ["attributes"] },
    { id: "skills", label: "Навыки", paths: ["skills"] },
    { id: "talents", label: "Таланты", paths: ["creation", "experience.ledger"] },
    { id: "spells", label: "Заклинания", paths: ["creation.startingSpells", "experience.ledger"] },
    { id: "languages", label: "Языки, XP и репутация", paths: ["languages", "languageRolls", "reputation", "experience.ledger"] },
    { id: "biography", label: "Биография", paths: ["biography", "equipmentRequest", "gmRequests"] },
    { id: "review", label: "Проверка и экспорт", paths: [] }
  ];
  const cloneValue = value => typeof globalThis.structuredClone === "function" ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value));
  const startingSpellLimit = rank => {
    const configuredLimits = rules.startingSpellLimitByRank;
    if (!configuredLimits) return Number(rules.spellLimitPerRank ?? 5);
    if (!Object.prototype.hasOwnProperty.call(configuredLimits, String(rank))) return 0;
    const configured = Number(configuredLimits[String(rank)]);
    return Number.isFinite(configured) && configured >= 0 ? configured : 0;
  };

  const el = Object.fromEntries([
    "name", "kin", "kinVariant", "kinVariantWrap", "kinFocus", "kinFocusWrap", "profession", "origin", "religion",
    "originDetail", "citizenship", "religionDetail", "birthYear", "birthMonth", "birthDay", "ageSummary", "attributeSummary", "attributes", "skillSummary",
    "skillsBody", "kinTalent", "initialPath", "ageTalentSummary", "ageTalentLedger", "undoAgeTalent", "paths",
    "generalTalentCatalog", "generalTalents", "spellSummary", "spellCatalog", "spells", "catalogTooltip", "purchaseMenu",
    "languageSummary", "languageSelect", "languageLevel", "languageLore", "identityLore",
    "languageNative", "addLanguage", "languages", "reputationTotal", "baseXp", "baseXpAllowance", "xpBudget", "spentXp", "remainingXp",
    "buyReputation", "undoReputation", "undoXp", "xpLedger", "reputationEntries", "addReputationEntry", "bioConcept", "bioAppearance", "bioBackground",
    "bioFamily", "bioMotivation", "bioPride", "bioDarkSecret", "bioConnections", "bioPublicNote", "equipmentRequest",
    "physicalHeight", "physicalWeight", "physicalSkin", "physicalEyes", "physicalHair", "physicalMarks",
    "questionBestFriend", "questionFavoriteFood", "questionPrejudices", "questionAristocracy", "questionFavoriteMemory",
    "questionOneWish", "questionGreatestFear", "questionNotes", "otherActiveCharacters", "addRumor", "rumors",
    "gmRequestCategory", "gmRequestDescription", "addGmRequest", "gmRequests",
    "validationState", "reviewSummary", "reviewSheet",
    "exportCharacter", "saveDraft", "loadDraft", "loadRulesPackage", "resetDraft",
    "rulesStatus", "rulesStatusText", "checkRulesUpdate", "restorePreviousRules",
    "wizardSteps", "wizardResources", "wizardBack", "wizardNext", "wizardPosition",
    "portraitFile", "tokenFile", "portraitPreview", "tokenPreview", "portraitEmpty", "tokenEmpty",
    "portraitMeta", "tokenMeta", "removePortrait", "removeToken"
  ].map(id => [id, document.getElementById(id)]));

  let state = loadLocalDraft() ?? createDefaultCharacter();
  let currentStep = loadCurrentStep();
  let assetFiles = { portrait: null, token: null };
  let assetUrls = { portrait: null, token: null };
  let tooltipHideTimer = null;
  let activeTooltipTarget = null;
  let purchaseMenuCleanup = null;
  state = migrateCharacter(state);
  ensureCharacterShape();
  populateStaticControls();
  buildWizardNavigation();
  bindStaticEvents();
  syncStaticFields();
  renderDynamic();
  renderRulesStatus();
  registerServiceWorker();
  restoreAssets().then(() => {
    renderAssets();
    updateValidation();
  }).catch(error => console.warn("Не удалось восстановить изображения черновика.", error));
  setTimeout(() => checkRemoteRules({ silent: true }), 80);

  function createDefaultCharacter() {
    const skills = Object.fromEntries(rules.skills.map(skill => [skill.id, { startingRank: 0 }]));
    const firstPath = rules.professionPaths.fighter?.[0] ?? null;
    return {
      format: "air-islands-character",
      formatVersion: 7,
      rulesVersion: rules.rulesVersion,
      rulesHash: rules.packageHash,
      characterId: uid(),
      createdAt: new Date().toISOString(),
      identity: {
        name: "",
        kinId: "human",
        kinVariantId: "gvirl",
        kinFocus: "strength",
        professionId: "fighter",
        originId: "sirosten",
        originDetail: "",
        citizenship: "",
        religionId: "none",
        religionDetail: "",
        birthDate: { year: rules.campaignDate.year - 30, month: rules.campaignDate.month, day: rules.campaignDate.day }
      },
      attributes: { strength: 4, agility: 4, wits: 3, empathy: 3 },
      skills,
      creation: { initialPathCatalogId: firstPath, ageTalentLedger: [], startingSpells: [] },
      languages: [],
      languageRolls: [],
      reputation: { entries: [{ id: uid(), amount: 1, description: "", location: "" }] },
      experience: { baseTotal: 0, ledger: [] },
      biography: {
        concept: "", appearance: "", background: "", family: "", pride: "", darkSecret: "", publicNote: "",
        motivation: "", partyConnections: "",
        physical: { height: "", weight: "", skin: "", eyes: "", hair: "", distinguishingMarks: "" },
        questions: {
          bestFriend: "", favoriteFood: "", prejudices: "", aristocracy: "",
          favoriteMemory: "", oneWish: "", greatestFear: "", notes: ""
        },
        otherActiveCharacters: 0,
        rumors: []
      },
      equipmentRequest: "",
      gmRequests: [],
      assets: { portrait: null, token: null }
    };
  }

  function normalizeBiography(value = {}) {
    const source = cloneValue(value ?? {});
    const questions = source.questions ?? {};
    const physical = source.physical ?? {};
    return {
      concept: String(source.concept ?? ""),
      appearance: String(source.appearance ?? ""),
      background: String(source.background ?? ""),
      family: String(source.family ?? ""),
      pride: String(source.pride ?? ""),
      darkSecret: String(source.darkSecret ?? ""),
      publicNote: String(source.publicNote ?? ""),
      motivation: String(source.motivation ?? ""),
      partyConnections: String(source.partyConnections ?? ""),
      physical: {
        height: String(physical.height ?? ""), weight: String(physical.weight ?? ""),
        skin: String(physical.skin ?? ""), eyes: String(physical.eyes ?? ""),
        hair: String(physical.hair ?? ""), distinguishingMarks: String(physical.distinguishingMarks ?? "")
      },
      questions: {
        bestFriend: String(questions.bestFriend ?? ""), favoriteFood: String(questions.favoriteFood ?? ""),
        prejudices: String(questions.prejudices ?? ""), aristocracy: String(questions.aristocracy ?? ""),
        favoriteMemory: String(questions.favoriteMemory ?? ""), oneWish: String(questions.oneWish ?? ""),
        greatestFear: String(questions.greatestFear ?? ""), notes: String(questions.notes ?? source.answers ?? "")
      },
      otherActiveCharacters: Math.max(0, Number(source.otherActiveCharacters ?? (Array.isArray(source.rumors) ? source.rumors.length : 0)) || 0),
      rumors: (Array.isArray(source.rumors) ? source.rumors : []).map(entry => typeof entry === "string"
        ? { id: uid(), text: entry, truth: "uncertain" }
        : { id: entry.id || uid(), text: String(entry.text ?? ""), truth: RUMOR_TRUTH_NAMES[entry.truth] ? entry.truth : "uncertain" })
    };
  }

  function normalizeGmRequests(value = []) {
    return (Array.isArray(value) ? value : []).map(entry => ({
      id: entry?.id || uid(),
      category: GM_REQUEST_NAMES[entry?.category] ? entry.category : "other",
      description: String(entry?.description ?? entry?.text ?? "")
    }));
  }

  function normalizeReputation(value = {}) {
    const source = value ?? {};
    if (Array.isArray(source.entries)) {
      return {
        entries: source.entries.map(entry => ({
          id: entry?.id || uid(),
          amount: Math.max(1, Math.floor(Number(entry?.amount) || 1)),
          description: String(entry?.description ?? entry?.reason ?? ""),
          location: String(entry?.location ?? entry?.place ?? "")
        }))
      };
    }
    return {
      entries: (Array.isArray(source.origins) ? source.origins : []).map(description => ({
        id: uid(),
        amount: 1,
        description: String(description ?? ""),
        location: ""
      }))
    };
  }

  function migrateCharacter(input) {
    if (!input || input.format !== "air-islands-character") return createDefaultCharacter();
    if ([2, 3, 4, 5, 6, 7].includes(input.formatVersion)) {
      const migrated = cloneValue(input);
      if (Number(input.formatVersion) < 6) {
        migrated.experience ??= { baseTotal: 0, ledger: [] };
        migrated.experience.baseTotal = Math.max(0, Number(migrated.experience.baseTotal ?? 0)) * 5;
      }
      migrated.formatVersion = 7;
      migrated.assets ??= { portrait: null, token: null };
      migrated.identity ??= {};
      migrated.characterId ||= uid();
      migrated.identity.originDetail = String(migrated.identity.originDetail ?? "");
      migrated.identity.citizenship = String(migrated.identity.citizenship ?? "");
      migrated.identity.religionId = String(migrated.identity.religionId ?? "none");
      migrated.identity.religionDetail = String(migrated.identity.religionDetail ?? "");
      migrated.biography = normalizeBiography(migrated.biography);
      migrated.reputation = normalizeReputation(migrated.reputation);
      migrated.gmRequests = normalizeGmRequests(migrated.gmRequests);
      return migrated;
    }
    const migrated = createDefaultCharacter();
    migrated.identity = { ...migrated.identity, ...(cloneValue(input.identity ?? {})) };
    migrated.attributes = cloneValue(input.attributes ?? migrated.attributes);
    for (const skill of rules.skills) migrated.skills[skill.id].startingRank = Number(input.skills?.[skill.id]?.startingRank ?? 0);
    migrated.languages = cloneValue(input.languages ?? []);
    migrated.languageRolls = cloneValue(input.languageRolls ?? []);
    migrated.biography = normalizeBiography(input.biography);
    migrated.equipmentRequest = String(input.equipmentRequest ?? "");
    migrated.gmRequests = normalizeGmRequests(input.gmRequests);
    migrated.experience.baseTotal = Math.max(0, Number(input.experience?.baseTotal ?? 0)) * 5;
    const oldPaths = (input.talents ?? []).filter(entry => index.talents.get(entry.catalogId)?.type === "profession");
    const initial = oldPaths.find(entry => entry.source === "profession") ?? oldPaths[0];
    const allowed = rules.professionPaths[migrated.identity.professionId] ?? [];
    migrated.creation.initialPathCatalogId = allowed.includes(initial?.catalogId) ? initial.catalogId : allowed[0] ?? null;
    const baseRep = baseReputation(migrated);
    migrated.reputation = normalizeReputation(input.reputation);
    if (!migrated.reputation.entries.length && baseRep > 0) {
      migrated.reputation.entries.push({ id: uid(), amount: baseRep, description: "", location: "" });
    }
    return migrated;
  }

  function ensureCharacterShape() {
    state.format = "air-islands-character";
    state.formatVersion = 7;
    state.rulesVersion = rules.rulesVersion;
    state.rulesHash = rules.packageHash;
    state.characterId ||= uid();
    state.identity ??= {};
    state.identity.originDetail = String(state.identity.originDetail ?? "");
    state.identity.citizenship = String(state.identity.citizenship ?? "");
    state.identity.religionId = String(state.identity.religionId ?? "none");
    state.identity.religionDetail = String(state.identity.religionDetail ?? "");
    state.identity.birthDate ??= { year: rules.campaignDate.year - 30, month: rules.campaignDate.month, day: 1 };
    state.attributes ??= { strength: 2, agility: 2, wits: 2, empathy: 2 };
    state.skills ??= {};
    for (const skill of rules.skills) {
      const old = state.skills[skill.id];
      state.skills[skill.id] = { startingRank: Number(old?.startingRank ?? 0) };
    }
    state.creation ??= {};
    state.creation.ageTalentLedger ??= [];
    state.creation.startingSpells ??= [];
    state.experience ??= {};
    state.experience.baseTotal = Math.max(0, Number(state.experience.baseTotal ?? 0));
    state.experience.ledger ??= [];
    state.languages ??= [];
    state.languageRolls ??= [];
    state.reputation = normalizeReputation(state.reputation);
    state.biography = normalizeBiography(state.biography);
    state.gmRequests = normalizeGmRequests(state.gmRequests);
    state.assets ??= { portrait: null, token: null };
    state.assets.portrait ??= null;
    state.assets.token ??= null;
    ensureInitialPath();
    ensureNativeLanguage();
    ensureReputationEntries();
  }

  function availableProfessionPaths(professionId) {
    const configured = new Set(rules.builderSettings?.enabledPathCatalogIds ?? []);
    return (rules.professionPaths[professionId] ?? []).filter(id => !configured.size || configured.has(id));
  }

  function ensureInitialPath() {
    const allowed = availableProfessionPaths(state.identity.professionId);
    if (!allowed.includes(state.creation.initialPathCatalogId)) state.creation.initialPathCatalogId = allowed[0] ?? null;
  }

  function progressionSnapshot() {
    return {
      ageTalentLedger: cloneValue(state.creation.ageTalentLedger ?? []),
      startingSpells: cloneValue(state.creation.startingSpells ?? []),
      xpLedger: cloneValue(state.experience.ledger ?? [])
    };
  }

  function reconcileProgression(snapshot, reason = "изменения основы персонажа") {
    const previous = snapshot ?? progressionSnapshot();
    state.creation.ageTalentLedger = [];
    state.creation.startingSpells = [];
    state.experience.ledger = [];
    ensureInitialPath();

    for (const oldTx of previous.ageTalentLedger) {
      const talent = index.talents.get(oldTx.catalogId);
      if (!talent || (talent.type !== "general" && oldTx.catalogId !== state.creation.initialPathCatalogId)) continue;
      const replay = core.replayCharacter(state, rules);
      const current = replay.state.talents.get(oldTx.catalogId) ?? 0;
      if (current >= 5) continue;
      const candidate = { ...cloneValue(oldTx), id: oldTx.id || uid(), type: "talent", toRank: current + 1 };
      const simulation = core.simulateAgeTalentTransaction(state, rules, candidate);
      if (simulation.valid) state.creation.ageTalentLedger.push(candidate);
    }

    const creationReplay = core.replayCharacter(state, rules);
    const initialPath = creationReplay.startingSpells.initialPath;
    const initialRank = creationReplay.startingSpells.initialRank;
    const allowedStarting = new Set(creationReplay.startingSpells.allowedDisciplines);
    const startingCounts = new Map();
    if (initialPath?.magical) {
      for (const catalogId of previous.startingSpells) {
        const spell = index.spells.get(catalogId);
        if (!spell || state.creation.startingSpells.includes(catalogId)) continue;
        const count = startingCounts.get(spell.rank) ?? 0;
        if (!allowedStarting.has(spell.discipline) || spell.rank > initialRank || count >= startingSpellLimit(spell.rank)) continue;
        state.creation.startingSpells.push(catalogId);
        startingCounts.set(spell.rank, count + 1);
      }
    }

    const baseReplay = core.replayCharacter(state, rules);
    const skillRanks = new Map(Object.entries(baseReplay.final.skills));
    const talentRanks = new Map(baseReplay.final.talents.map(entry => [entry.catalogId, entry.rank]));
    const knownSpells = new Set(baseReplay.final.spells.map(entry => entry.catalogId));
    const spellCounts = new Map();
    for (const catalogId of knownSpells) {
      const rank = index.spells.get(catalogId)?.rank;
      if (rank) spellCounts.set(rank, (spellCounts.get(rank) ?? 0) + 1);
    }

    for (const oldTx of previous.xpLedger) {
      const tx = { ...cloneValue(oldTx), id: oldTx.id || uid() };
      if (tx.type === "skill") {
        const current = Number(skillRanks.get(tx.skillId) ?? 0);
        if (!index.skills.has(tx.skillId) || current >= 5) continue;
        tx.toRank = current + 1;
        skillRanks.set(tx.skillId, tx.toRank);
        state.experience.ledger.push(tx);
        continue;
      }
      if (tx.type === "talent") {
        const talent = index.talents.get(tx.catalogId);
        const kinTalentId = index.kin.get(state.identity.kinId)?.talentCatalogId;
        const accessible = talent?.type === "general"
          || (talent?.type === "kin" && tx.catalogId === kinTalentId)
          || (talent?.type === "profession" && tx.catalogId === state.creation.initialPathCatalogId);
        const current = Number(talentRanks.get(tx.catalogId) ?? 0);
        if (!accessible || current >= 5) continue;
        tx.toRank = current + 1;
        if (talent.magical && tx.toRank > 1) {
          const discipline = rules.spellDisciplineMap[talent.disciplineKey];
          const hasRequired = [...knownSpells].some(id => {
            const spell = index.spells.get(id);
            return spell?.discipline === discipline && spell.rank === tx.toRank;
          });
          if (!hasRequired) continue;
        }
        talentRanks.set(tx.catalogId, tx.toRank);
        state.experience.ledger.push(tx);
        continue;
      }
      if (tx.type === "spell") {
        const spell = index.spells.get(tx.catalogId);
        if (!spell || knownSpells.has(tx.catalogId)) continue;
        const paths = [...talentRanks.entries()]
          .map(([catalogId, rank]) => ({ talent: index.talents.get(catalogId), rank }))
          .filter(entry => entry.talent?.type === "profession" && entry.talent.magical);
        const pathRank = spell.discipline === rules.spellDisciplineMap.general
          ? paths.reduce((max, entry) => Math.max(max, entry.rank), 0)
          : paths.filter(entry => rules.spellDisciplineMap[entry.talent.disciplineKey] === spell.discipline)
            .reduce((max, entry) => Math.max(max, entry.rank), 0);
        const count = spellCounts.get(spell.rank) ?? 0;
        if (pathRank < 1 || spell.rank > pathRank + 1 || count >= rules.spellLimitPerRank) continue;
        knownSpells.add(tx.catalogId);
        spellCounts.set(spell.rank, count + 1);
        state.experience.ledger.push(tx);
        continue;
      }
      if (tx.type === "reputation") state.experience.ledger.push(tx);
    }

    ensureReputationEntries();
    const removed = previous.ageTalentLedger.length + previous.startingSpells.length + previous.xpLedger.length
      - state.creation.ageTalentLedger.length - state.creation.startingSpells.length - state.experience.ledger.length;
    if (removed > 0) alert(`После ${reason} сохранены все совместимые покупки. Удалено несовместимых записей: ${removed}.`);
  }

  function rebaseSkillXpTransactions(skillId) {
    let rank = Number(state.skills?.[skillId]?.startingRank ?? 0);
    state.experience.ledger = (state.experience.ledger ?? []).filter(tx => {
      if (tx.type !== "skill" || tx.skillId !== skillId) return true;
      if (rank >= 5) return false;
      rank += 1;
      tx.toRank = rank;
      return true;
    });
  }

  function baseReputation(character = state) {
    const age = core.calculateAge(character.identity?.birthDate, rules.campaignDate, rules);
    const kin = index.kin.get(character.identity?.kinId);
    const category = core.ageCategoryFor(kin, age);
    return rules.ageCategories[category]?.reputation ?? 0;
  }

  function ensureNativeLanguage() {
    const native = state.languages.filter(entry => entry.native);
    if (native.length > 1) {
      let kept = false;
      for (const entry of state.languages) {
        if (!entry.native) continue;
        if (!kept) kept = true;
        else entry.native = false;
      }
    }
    const allowed = core.allowedNativeLanguages(state, rules);
    const current = state.languages.find(entry => entry.native);
    if (current && !allowed.includes(current.languageId)) current.native = false;
    if (!state.languages.some(entry => entry.native) && allowed.length) {
      const languageId = allowed[0];
      const existing = state.languages.find(entry => entry.languageId === languageId);
      if (existing) existing.native = true;
      else {
        const language = index.languages.get(languageId);
        const level = language?.levels?.basic !== undefined ? "basic" : Object.keys(language?.levels ?? {})[0];
        if (level) state.languages.push({ languageId, level, native: true });
      }
    }
  }

  function ensureReputationEntries(replay = core.replayCharacter(state, rules)) {
    const target = Math.max(0, Number(replay.final.reputation) || 0);
    state.reputation = normalizeReputation(state.reputation);
    const entries = state.reputation.entries;
    let current = entries.reduce((sum, entry) => sum + Math.max(0, Math.floor(Number(entry.amount) || 0)), 0);

    if (current < target) {
      entries.push({ id: uid(), amount: target - current, description: "", location: "" });
      current = target;
    }

    while (current > target && entries.length) {
      const entry = entries.at(-1);
      const amount = Math.max(1, Math.floor(Number(entry.amount) || 1));
      const excess = current - target;
      if (amount > excess) {
        entry.amount = amount - excess;
        current = target;
      } else {
        entries.pop();
        current -= amount;
      }
    }
  }

  function buildWizardNavigation() {
    el.wizardSteps.innerHTML = "";
    WIZARD_STEPS.forEach((step, position) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "wizard-step";
      button.dataset.step = step.id;
      button.innerHTML = `<span class="wizard-step-number">${position + 1}</span><span class="wizard-step-label">${escapeHtml(step.label)}</span><span class="wizard-step-status"></span>`;
      button.addEventListener("click", () => setWizardStep(step.id));
      el.wizardSteps.append(button);
    });
  }

  function loadCurrentStep() {
    try {
      const saved = localStorage.getItem(STEP_STORAGE_KEY);
      return WIZARD_STEPS.some(step => step.id === saved) ? saved : WIZARD_STEPS[0].id;
    } catch {
      return WIZARD_STEPS[0].id;
    }
  }

  function setWizardStep(stepId) {
    if (!WIZARD_STEPS.some(step => step.id === stepId)) return;
    currentStep = stepId;
    try { localStorage.setItem(STEP_STORAGE_KEY, stepId); } catch { /* file:// may restrict storage */ }
    renderWizard(updateValidation(false));
    document.querySelector(".app-shell")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  function issueMatchesStep(issue, step) {
    const path = String(issue?.path ?? "");
    if (!path) return step.id === "review";
    return step.paths.some(prefix => path === prefix || path.startsWith(`${prefix}.`));
  }

  function renderWizard(validation) {
    const position = Math.max(0, WIZARD_STEPS.findIndex(step => step.id === currentStep));
    for (const panel of document.querySelectorAll("[data-step]")) panel.hidden = panel.dataset.step !== currentStep;
    for (const button of el.wizardSteps.querySelectorAll(".wizard-step")) {
      const step = WIZARD_STEPS.find(entry => entry.id === button.dataset.step);
      const errors = step.id === "review"
        ? validation.errors
        : validation.errors.filter(issue => issueMatchesStep(issue, step));
      const warnings = step.id === "review"
        ? validation.warnings
        : validation.warnings.filter(issue => issueMatchesStep(issue, step));
      button.classList.toggle("active", step.id === currentStep);
      button.classList.toggle("has-errors", errors.length > 0);
      button.classList.toggle("complete", errors.length === 0 && step.id !== "review");
      const status = button.querySelector(".wizard-step-status");
      status.textContent = errors.length ? String(errors.length) : (warnings.length ? `•${warnings.length}` : "✓");
      button.setAttribute("aria-current", step.id === currentStep ? "step" : "false");
    }
    el.wizardBack.disabled = position === 0;
    el.wizardNext.textContent = position === WIZARD_STEPS.length - 1 ? "Экспорт .flchar" : "Далее";
    el.wizardNext.disabled = position === WIZARD_STEPS.length - 1 && !validation.valid;
    el.wizardPosition.textContent = `${position + 1} из ${WIZARD_STEPS.length}: ${WIZARD_STEPS[position].label}`;
    renderWizardResources(validation.derived?.replay ?? core.replayCharacter(state, rules));
  }

  function renderWizardResources(replay) {
    const ageRules = replay.categoryRules ?? {};
    const attrSpent = ATTRIBUTES.reduce((sum, [id]) => sum + (Number(state.attributes[id]) || 0), 0);
    const skillSpent = rules.skills.reduce((sum, skill) => sum + core.startingSkillCost(Number(state.skills[skill.id]?.startingRank ?? 0)), 0);
    const languageSpent = core.totalLanguageCost(state, rules);
    const languageTotal = core.languageBudget(state);
    el.wizardResources.innerHTML = `
      <dt>Возраст</dt><dd>${replay.age ?? "?"}</dd>
      <dt>Характеристики</dt><dd>${attrSpent}/${ageRules.attributePoints ?? "?"}</dd>
      <dt>Навыки</dt><dd>${skillSpent}/${ageRules.skillPoints ?? "?"}</dd>
      <dt>Таланты возраста</dt><dd>${replay.ageTalents.spent}/${replay.ageTalents.total}</dd>
      <dt>Языки</dt><dd>${languageSpent}/${languageTotal}</dd>
      <dt>Base XP</dt><dd>${state.experience.baseTotal} → ${replay.final.xpBudget}</dd>
      <dt>Остаток XP</dt><dd>${replay.final.xpRemaining}</dd>
    `;
  }

  function renderReviewSummary(validation) {
    const derived = validation.derived;
    const kin = index.kin.get(state.identity.kinId)?.name ?? "?";
    const profession = index.professions.get(state.identity.professionId)?.name ?? "?";
    const images = [state.assets.portrait ? "портрет" : null, state.assets.token ? "токен" : null].filter(Boolean).join(" и ") || "не добавлены";
    el.reviewSummary.innerHTML = `
      <div class="review-card"><strong>${escapeHtml(state.identity.name || "Без имени")}</strong><span>${escapeHtml(kin)} · ${escapeHtml(profession)}</span></div>
      <div class="review-card"><strong>${derived?.age ?? "?"} лет</strong><span>${escapeHtml(rules.ageCategories[derived?.ageCategory]?.name ?? "Возраст не определён")}</span></div>
      <div class="review-card"><strong>${derived?.finalTalents?.length ?? 0} талантов</strong><span>${derived?.finalSpells?.length ?? 0} заклинаний</span></div>
      <div class="review-card"><strong>${derived?.xpRemaining ?? 0} XP осталось</strong><span>${state.experience.baseTotal} Base XP → ${derived?.xpBudget ?? 0} доступно</span></div>
      <div class="review-card"><strong>Reputation ${derived?.reputation ?? 0}</strong><span>${state.languages.length} языков</span></div>
      <div class="review-card"><strong>Изображения</strong><span>${escapeHtml(images)}</span></div>
      <div class="review-card"><strong>${state.biography.rumors.length} слухов</strong><span>${state.gmRequests.length} запросов ГМу</span></div>
    `;
    el.reviewSheet.innerHTML = buildCharacterSummaryHtml(validation);
  }

  function renderIdentityLore() {
    const kin = index.kin.get(state.identity.kinId);
    const profession = index.professions.get(state.identity.professionId);
    const origin = index.origins.get(state.identity.originId);
    const religion = index.religions.get(state.identity.religionId);
    const cards = [
      ["Раса", kin?.name, kin?.summary],
      ["Профессия", profession?.name, profession?.summary],
      ["Происхождение", origin?.name, origin?.summary],
      ["Вера", religion?.name, religion?.summary]
    ].filter(([, name, summary]) => name || summary);
    el.identityLore.innerHTML = cards.map(([label, name, summary]) => `
      <article class="lore-card"><span>${escapeHtml(label)}</span><h3>${escapeHtml(name ?? "")}</h3><p>${escapeHtml(summary ?? "Справка отсутствует.")}</p></article>
    `).join("");
  }

  function renderLanguageLore() {
    const language = index.languages.get(el.languageSelect.value);
    if (!language) {
      el.languageLore.innerHTML = "";
      return;
    }
    const levels = Object.entries(language.levels ?? {}).map(([level, cost]) => `${LEVEL_NAMES[level] ?? level}: ${cost}`).join(" · ");
    el.languageLore.innerHTML = `<span>Язык</span><h3>${escapeHtml(language.name)}</h3><p>${escapeHtml(language.description ?? "Справка отсутствует.")}</p><small>${escapeHtml(levels)}</small>`;
  }


  function buildCharacterSummaryHtml(validation) {
    const derived = validation.derived ?? {};
    const identity = state.identity;
    const kin = index.kin.get(identity.kinId);
    const variant = kin?.variants?.find(entry => entry.id === identity.kinVariantId);
    const profession = index.professions.get(identity.professionId);
    const origin = index.origins.get(identity.originId);
    const religion = index.religions.get(identity.religionId);
    const path = index.talents.get(state.creation.initialPathCatalogId);
    const portrait = assetUrls.portrait ? `<img class="sheet-portrait" src="${assetUrls.portrait}" alt="Портрет">` : "";
    const attributes = ATTRIBUTES.map(([id, label]) => `<div><strong>${label}</strong><span>${state.attributes[id]}</span></div>`).join("");
    const skills = rules.skills.map(skill => `<tr><td>${escapeHtml(skill.name)}</td><td>${escapeHtml(skill.attribute.toUpperCase())}</td><td>${derived.finalSkills?.[skill.id] ?? 0}</td></tr>`).join("");
    const talents = (derived.finalTalents ?? []).map(selection => {
      const talent = index.talents.get(selection.catalogId);
      return `<li>${escapeHtml(talent?.name ?? selection.catalogId)} <strong>R${selection.rank}</strong></li>`;
    }).join("") || "<li>Нет</li>";
    const spellsByDiscipline = new Map();
    for (const selection of derived.finalSpells ?? []) {
      const spell = index.spells.get(selection.catalogId);
      if (!spell) continue;
      if (!spellsByDiscipline.has(spell.discipline)) spellsByDiscipline.set(spell.discipline, []);
      spellsByDiscipline.get(spell.discipline).push(spell);
    }
    const spells = [...spellsByDiscipline.entries()].map(([discipline, entries]) => `<section><h4>${escapeHtml(discipline)}</h4><ul>${entries.sort((a,b) => a.rank-b.rank || a.name.localeCompare(b.name,"ru")).map(spell => `<li>R${spell.rank} · ${escapeHtml(spell.name)}</li>`).join("")}</ul></section>`).join("") || "<p>Нет</p>";
    const languages = state.languages.map(entry => `<li>${escapeHtml(index.languages.get(entry.languageId)?.name ?? entry.languageId)}: ${escapeHtml(LEVEL_NAMES[entry.level] ?? entry.level)}${entry.native ? " · родной" : ""}</li>`).join("") || "<li>Нет</li>";
    const reputationOrigins = state.reputation.entries.map(entry => `<li><strong>${Math.max(1, Math.floor(Number(entry.amount) || 1))}</strong> — ${escapeHtml(entry.description || "Не описано")}${entry.location ? ` <em>(${escapeHtml(entry.location)})</em>` : ""}</li>`).join("") || "<li>Нет</li>";
    const rumors = state.biography.rumors.map(entry => `<li>${escapeHtml(entry.text)} <em>(${escapeHtml(RUMOR_TRUTH_NAMES[entry.truth] ?? entry.truth)})</em></li>`).join("") || "<li>Нет</li>";
    const requests = state.gmRequests.map(entry => `<li><strong>${escapeHtml(GM_REQUEST_NAMES[entry.category] ?? entry.category)}</strong>: ${escapeHtml(entry.description)}</li>`).join("") || "<li>Нет</li>";
    const bio = state.biography;
    const questionEntries = [
      ["Лучший друг", bio.questions.bestFriend],
      ["Любимое блюдо", bio.questions.favoriteFood],
      ["Предубеждения", bio.questions.prejudices],
      ["Отношение к аристократии", bio.questions.aristocracy],
      ["Любимое воспоминание", bio.questions.favoriteMemory],
      ["Одно желание", bio.questions.oneWish],
      ["Главный страх", bio.questions.greatestFear],
      ["Дополнительные заметки", bio.questions.notes]
    ];
    const questionHtml = questionEntries.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${paragraphsHtml(value)}</dd>`).join("");
    const inner = `
      <header class="sheet-header">${portrait}<div><h1>${escapeHtml(identity.name || "Без имени")}</h1><p>${escapeHtml(kin?.name ?? "?")}${variant ? ` (${escapeHtml(variant.name)})` : ""} · ${escapeHtml(profession?.name ?? "?")} · ${escapeHtml(path?.name ?? "Path не выбран")}</p><p>${escapeHtml(origin?.name ?? "?")}${identity.originDetail ? `, ${escapeHtml(identity.originDetail)}` : ""}${identity.citizenship ? ` · гражданство: ${escapeHtml(identity.citizenship)}` : ""}</p><p>${religion ? `Вера: ${escapeHtml(religion.name)}` : "Вера не указана"}${identity.religionDetail ? `, ${escapeHtml(identity.religionDetail)}` : ""}</p><p>Рождён: ${escapeHtml(formatDate(identity.birthDate))} · ${derived.age ?? "?"} лет · Reputation ${derived.reputation ?? 0}</p></div></header>
      <section class="sheet-section"><h2>Характеристики</h2><div class="sheet-attributes">${attributes}</div></section>
      <section class="sheet-section"><h2>Навыки</h2><table><thead><tr><th>Навык</th><th>Хар.</th><th>Ранг</th></tr></thead><tbody>${skills}</tbody></table></section>
      <section class="sheet-columns"><div class="sheet-section"><h2>Таланты</h2><ul>${talents}</ul></div><div class="sheet-section"><h2>Языки</h2><ul>${languages}</ul></div></section>
      <section class="sheet-section"><h2>Заклинания</h2><div class="sheet-spells">${spells}</div></section>
      <section class="sheet-columns"><div class="sheet-section"><h2>Reputation</h2><ol>${reputationOrigins}</ol></div><div class="sheet-section"><h2>Ресурсы создания</h2><p>Текущий Base XP: ${state.experience.baseTotal}. На развитие доступно: ${derived.xpBudget ?? 0}; потрачено: ${derived.xpSpent ?? 0}; осталось: ${derived.xpRemaining ?? 0}.</p><p>Возрастные очки талантов: ${derived.ageTalentPoints?.spent ?? 0} из ${derived.ageTalentPoints?.total ?? 0} потрачено.</p></div></section>
      <section class="sheet-section"><h2>Концепт</h2>${paragraphsHtml(bio.concept)}</section>
      <section class="sheet-section"><h2>Внешность</h2>${paragraphsHtml(bio.appearance)}<dl><dt>Рост</dt><dd>${escapeHtml(bio.physical.height)}</dd><dt>Вес</dt><dd>${escapeHtml(bio.physical.weight)}</dd><dt>Кожа</dt><dd>${escapeHtml(bio.physical.skin)}</dd><dt>Глаза</dt><dd>${escapeHtml(bio.physical.eyes)}</dd><dt>Волосы</dt><dd>${escapeHtml(bio.physical.hair)}</dd><dt>Приметы</dt><dd>${escapeHtml(bio.physical.distinguishingMarks)}</dd></dl></section>
      <section class="sheet-section"><h2>Предыстория и семья</h2>${paragraphsHtml(bio.background)}${paragraphsHtml(bio.family)}</section>
      <section class="sheet-columns"><div class="sheet-section"><h2>Гордость</h2>${paragraphsHtml(bio.pride)}</div><div class="sheet-section"><h2>Тёмный секрет</h2>${paragraphsHtml(bio.darkSecret)}</div></section>
      <section class="sheet-section"><h2>Мотивация и группа</h2>${paragraphsHtml(bio.motivation)}${paragraphsHtml(bio.partyConnections)}</section>
      <section class="sheet-section"><h2>Что о персонаже знают окружающие</h2>${paragraphsHtml(bio.publicNote)}</section>
      <section class="sheet-section"><h2>Ответы о персонаже</h2><dl class="sheet-questions">${questionHtml}</dl></section>
      <section class="sheet-columns"><div class="sheet-section"><h2>Слухи</h2><ol>${rumors}</ol></div><div class="sheet-section"><h2>Запросы ГМу</h2><ol>${requests}</ol></div></section>
      <section class="sheet-section"><h2>Пожелания по снаряжению</h2>${paragraphsHtml(state.equipmentRequest)}</section>
      <footer class="sheet-footer">Character ID: ${escapeHtml(state.characterId)} · Пакет правил: ${escapeHtml(rules.version ?? "неизвестно")}</footer>
    `;
    return inner;
  }

  function paragraphsHtml(value) {
    const text = String(value ?? "").trim();
    if (!text) return "<p class=\"empty-value\">Не заполнено.</p>";
    return text.split(/\n{2,}/u).map(part => `<p>${escapeHtml(part).replaceAll("\n", "<br>")}</p>`).join("");
  }

  function renderRulesStatus() {
    if (!el.rulesStatus || !el.rulesStatusText) return;
    const sourceLabels = {
      remote: "GitHub",
      "cache-current": "локальный кэш, GitHub проверен",
      cache: "локальный кэш",
      embedded: "встроенный резерв",
      previous: "предыдущая сохранённая версия",
      manual: "загружено вручную"
    };
    const version = String(rules.rulesVersion ?? "без версии");
    const shortHash = String(rules.packageHash ?? "").slice(0, 8);
    const source = sourceLabels[rulesRuntimeState.source] ?? rulesRuntimeState.source ?? "неизвестный источник";
    const checked = rulesRuntimeState.checkedAt
      ? new Date(rulesRuntimeState.checkedAt).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })
      : null;
    const suffix = checked ? ` · проверено ${checked}` : "";
    el.rulesStatusText.textContent = `${version}${shortHash ? ` · ${shortHash}` : ""} · ${source}${suffix}`;
    el.rulesStatus.classList.toggle("is-error", Boolean(rulesRuntimeState.error));
    el.rulesStatus.classList.toggle("is-offline", ["cache", "embedded", "previous"].includes(rulesRuntimeState.source));
    el.rulesStatus.classList.toggle("is-current", ["remote", "cache-current"].includes(rulesRuntimeState.source) && !rulesRuntimeState.error);
    el.rulesStatus.title = rulesRuntimeState.error ? String(rulesRuntimeState.error.message ?? rulesRuntimeState.error) : "";
    if (el.restorePreviousRules) el.restorePreviousRules.disabled = !rulesRuntimeState.canRestore;
  }

  async function applyRulesState(nextState, { notify = false } = {}) {
    const previousHash = rules.packageHash;
    rules = nextState.rules;
    rulesRuntimeState = nextState;
    index = core.indexRules(rules);
    state.rulesVersion = rules.rulesVersion;
    state.rulesHash = rules.packageHash;
    ensureCharacterShape();
    populateStaticControls();
    syncStaticFields();
    renderDynamic();
    renderRulesStatus();
    persist();
    if (notify && previousHash !== rules.packageHash) alert(`Правила обновлены до версии ${rules.rulesVersion}. Персонаж перепроверен.`);
  }

  async function checkRemoteRules({ silent = false } = {}) {
    const button = el.checkRulesUpdate;
    if (button?.disabled) return;
    const previousLabel = button?.textContent ?? "";
    if (button) {
      button.disabled = true;
      button.textContent = "Проверка…";
    }
    try {
      const next = await fetchRemoteRulesPackage();
      const changed = next.rules.packageHash !== rules.packageHash;
      await applyRulesState(next, { notify: !silent && changed });
      if (!silent && !changed) alert("Используется актуальная версия правил.");
    } catch (error) {
      console.warn("Не удалось проверить обновление правил.", error);
      rulesRuntimeState = {
        ...rulesRuntimeState,
        error,
        checkedAt: new Date().toISOString()
      };
      renderRulesStatus();
      if (!silent) alert(`Не удалось проверить обновления: ${error.message}`);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = previousLabel;
      }
    }
  }

  async function restorePreviousRulesVersion() {
    if (!rulesRuntimeState.canRestore) return;
    if (!confirm("Вернуться к предыдущему сохранённому пакету правил? Текущий персонаж будет перепроверен.")) return;
    try {
      const previous = await restorePreviousCachedRules();
      if (!previous) throw new Error("Предыдущая версия правил не найдена в кэше.");
      await applyRulesState(previous);
    } catch (error) {
      console.error(error);
      alert(`Не удалось восстановить предыдущие правила: ${error.message}`);
    }
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || !/^https?:$/u.test(location.protocol)) return;
    navigator.serviceWorker.register("./sw.js").catch(error => console.warn("Service Worker не зарегистрирован.", error));
  }

  async function loadRulesFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const parsed = parseRulesPackageBytes(bytes);
      if (!confirm(`Загрузить пакет правил «${parsed.builderSettings?.campaignTitle ?? parsed.rulesVersion}»? Текущий персонаж будет перепроверен.`)) return;
      const packageSha256 = await sha256Hex(bytes);
      const manifest = {
        format: "air-islands-rules-manifest",
        formatVersion: 1,
        rulesVersion: parsed.rulesVersion,
        minimumBuilderVersion: "1.2.0",
        package: file.name,
        packageSha256,
        packageSize: bytes.length,
        rulesPackageHash: parsed.packageHash,
        publishedAt: new Date().toISOString(),
        manual: true
      };
      const cache = await activateCachedRulesRecord({
        packageSha256,
        bytes,
        manifest,
        rulesVersion: parsed.rulesVersion,
        rulesPackageHash: parsed.packageHash,
        savedAt: new Date().toISOString()
      });
      await applyRulesState({
        rules: parsed,
        manifest,
        packageSha256,
        source: "manual",
        checkedAt: new Date().toISOString(),
        canRestore: Boolean(cache.previousHash)
      });
    } catch (error) {
      console.error(error);
      alert(`Не удалось загрузить пакет правил: ${error.message}`);
    }
  }

  function focusIssue(path) {
    const step = WIZARD_STEPS.find(entry => entry.id !== "review" && entry.paths.some(prefix => path === prefix || path.startsWith(`${prefix}.`)))?.id ?? "review";
    setWizardStep(step);
    requestAnimationFrame(() => {
      const target = issueTarget(path);
      target?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      target?.focus?.({ preventScroll: true });
      target?.classList?.add("issue-focus");
      setTimeout(() => target?.classList?.remove("issue-focus"), 1800);
    });
  }

  function issueTarget(path) {
    const exact = {
      "identity.name": el.name, "identity.kinId": el.kin, "identity.kinVariantId": el.kinVariant,
      "identity.kinFocus": el.kinFocus, "identity.professionId": el.profession, "identity.originId": el.origin,
      "identity.religionId": el.religion, "identity.birthDate": el.birthYear,
      "creation.initialPathCatalogId": el.initialPath, "creation.ageTalentLedger": el.ageTalentLedger,
      "creation.startingSpells": el.spellCatalog, "languages": el.languageSelect, "reputation.entries": el.reputationEntries,
      "experience.baseTotal": el.baseXp, "experience": el.baseXp, "biography.rumors": el.rumors,
      "biography.otherActiveCharacters": el.otherActiveCharacters, "gmRequests": el.gmRequests,
      "assets": el.portraitFile
    };
    if (exact[path]) return exact[path];
    if (path.startsWith("reputation.entries")) return el.reputationEntries;
    const attr = path.match(/^attributes\.(\w+)/u)?.[1];
    if (attr) return document.querySelector(`[data-attribute="${CSS.escape(attr)}"]`);
    const skill = path.match(/^skills\.([^.]+)/u)?.[1];
    if (skill) return document.querySelector(`[data-skill="${CSS.escape(skill)}"]`);
    const biography = path.match(/^biography\.([^.]+)/u)?.[1];
    const bioMap = { concept: el.bioConcept, appearance: el.bioAppearance, background: el.bioBackground, family: el.bioFamily, pride: el.bioPride, darkSecret: el.bioDarkSecret, motivation: el.bioMotivation, partyConnections: el.bioConnections, questions: el.questionBestFriend };
    return bioMap[biography] ?? document.querySelector(`[data-path="${CSS.escape(path)}"]`) ?? document.querySelector(`[data-step="${CSS.escape(currentStep)}"]`);
  }

  async function selectAsset(kind, file) {
    if (!file) return;
    if (!allowedImageTypes().has(file.type)) throw new Error("Этот тип изображения запрещён текущим пакетом кампании.");
    if (file.size > maximumAssetSize()) throw new Error(`Размер изображения не должен превышать ${rules.builderSettings?.maxAssetSizeMb ?? 12} МБ.`);
    const dimensions = await readImageDimensions(file);
    const hash = await digestFile(file);
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    assetFiles[kind] = file;
    state.assets[kind] = {
      path: `assets/${kind}.${extension}`,
      filename: `${kind}.${extension}`,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      width: dimensions.width,
      height: dimensions.height,
      sha256: hash
    };
    await storeAsset(kind, file);
    renderAssets();
    persist();
    updateValidation();
  }

  async function removeAsset(kind) {
    assetFiles[kind] = null;
    state.assets[kind] = null;
    if (assetUrls[kind]) URL.revokeObjectURL(assetUrls[kind]);
    assetUrls[kind] = null;
    await deleteStoredAsset(kind);
    renderAssets();
    persist();
    updateValidation();
  }

  function renderAssets() {
    for (const kind of ["portrait", "token"]) {
      const file = assetFiles[kind];
      const metadata = state.assets[kind];
      const preview = kind === "portrait" ? el.portraitPreview : el.tokenPreview;
      const empty = kind === "portrait" ? el.portraitEmpty : el.tokenEmpty;
      const meta = kind === "portrait" ? el.portraitMeta : el.tokenMeta;
      if (assetUrls[kind]) URL.revokeObjectURL(assetUrls[kind]);
      assetUrls[kind] = file ? URL.createObjectURL(file) : null;
      preview.hidden = !file;
      empty.hidden = Boolean(file);
      if (file) preview.src = assetUrls[kind];
      else preview.removeAttribute("src");
      meta.textContent = metadata
        ? `${metadata.width || "?"}×${metadata.height || "?"} · ${formatBytes(metadata.size || 0)}${file ? "" : " · файл не восстановлен"}`
        : "";
      (kind === "portrait" ? el.removePortrait : el.removeToken).disabled = !metadata && !file;
    }
  }

  async function restoreAssets() {
    if (!state.assets) return;
    for (const kind of ["portrait", "token"]) {
      if (!state.assets[kind]) continue;
      const stored = await loadStoredAsset(kind);
      if (!stored?.bytes) continue;
      assetFiles[kind] = new File([stored.bytes], stored.name || state.assets[kind].originalName || state.assets[kind].filename, {
        type: stored.type || state.assets[kind].mimeType,
        lastModified: stored.lastModified || Date.now()
      });
    }
  }

  async function replaceAssetsFromPackage(entries, character) {
    for (const kind of ["portrait", "token"]) {
      await deleteStoredAsset(kind);
      assetFiles[kind] = null;
      const metadata = character.assets?.[kind];
      if (!metadata?.path) continue;
      const bytes = entries.get(metadata.path);
      if (!bytes) continue;
      const file = new File([bytes], metadata.originalName || metadata.filename || `${kind}.bin`, {
        type: metadata.mimeType || "application/octet-stream",
        lastModified: Date.now()
      });
      assetFiles[kind] = file;
      await storeAsset(kind, file);
    }
    renderAssets();
  }

  function readImageDimensions(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Браузер не смог прочитать изображение."));
      };
      image.src = url;
    });
  }

  async function digestFile(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (crypto.subtle?.digest) {
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
      return [...digest].map(value => value.toString(16).padStart(2, "0")).join("");
    }
    return zip.crc32(bytes).toString(16).padStart(8, "0");
  }

  function formatBytes(value) {
    if (value < 1024) return `${value} Б`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} КБ`;
    return `${(value / (1024 * 1024)).toFixed(1)} МБ`;
  }

  function openAssetDb() {
    if (!globalThis.indexedDB) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(ASSET_DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(ASSET_DB_STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function storeAsset(kind, file) {
    const db = await openAssetDb();
    if (!db) return;
    const value = { name: file.name, type: file.type, lastModified: file.lastModified, bytes: await file.arrayBuffer() };
    await new Promise((resolve, reject) => {
      const tx = db.transaction(ASSET_DB_STORE, "readwrite");
      tx.objectStore(ASSET_DB_STORE).put(value, kind);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  async function loadStoredAsset(kind) {
    const db = await openAssetDb();
    if (!db) return null;
    const value = await new Promise((resolve, reject) => {
      const tx = db.transaction(ASSET_DB_STORE, "readonly");
      const request = tx.objectStore(ASSET_DB_STORE).get(kind);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return value;
  }

  async function deleteStoredAsset(kind) {
    const db = await openAssetDb();
    if (!db) return;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(ASSET_DB_STORE, "readwrite");
      tx.objectStore(ASSET_DB_STORE).delete(kind);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  function populateStaticControls() {
    const settings = rules.builderSettings ?? {};
    const enabledKin = new Set(settings.enabledKin ?? []);
    const enabledProfessions = new Set(settings.enabledProfessions ?? []);
    const kinEntries = rules.kin.filter(entry => !enabledKin.size || enabledKin.has(entry.id));
    const professionEntries = rules.professions.filter(entry => !enabledProfessions.size || enabledProfessions.has(entry.id));
    setOptions(el.kin, kinEntries.map(entry => [entry.id, entry.name]));
    setOptions(el.profession, professionEntries.map(entry => [entry.id, entry.name]));
    setOptions(el.origin, rules.origins.map(entry => [entry.id, entry.name]));
    setOptions(el.religion, (rules.religions ?? []).map(entry => [entry.id, entry.name]));
    setOptions(el.birthMonth, rules.calendar.months.map(entry => [entry.id, entry.name]));
    setOptions(el.kinFocus, ATTRIBUTES.map(([id, name]) => [id, name]));
    setOptions(el.languageSelect, rules.languages.map(entry => [entry.id, entry.name]));

    if (!kinEntries.some(entry => entry.id === state.identity.kinId)) state.identity.kinId = kinEntries[0]?.id ?? state.identity.kinId;
    if (!professionEntries.some(entry => entry.id === state.identity.professionId)) state.identity.professionId = professionEntries[0]?.id ?? state.identity.professionId;
    ensureInitialPath();

    const accept = (settings.allowedImageTypes?.length ? settings.allowedImageTypes : defaultAllowedImageTypes).join(",");
    el.portraitFile.accept = accept;
    el.tokenFile.accept = accept;
    const maxXp = Number(settings.maximumBaseXp);
    el.baseXp.max = Number.isFinite(maxXp) && maxXp >= 0 ? String(maxXp) : "";
  }

  function bindStaticEvents() {
    bindText(el.name, value => state.identity.name = value);
    el.kin.addEventListener("change", () => {
      const snapshot = progressionSnapshot();
      state.identity.kinId = el.kin.value;
      const kin = index.kin.get(state.identity.kinId);
      state.identity.kinVariantId = kin?.variants?.[0]?.id ?? null;
      state.identity.kinFocus = kin?.variants?.[0]?.selectableFocus ? "strength" : null;
      ensureNativeLanguage();
      reconcileProgression(snapshot, "смены расы");
      renderDynamic();
    });
    el.kinVariant.addEventListener("change", () => {
      state.identity.kinVariantId = el.kinVariant.value || null;
      const kin = index.kin.get(state.identity.kinId);
      const variant = kin?.variants?.find(entry => entry.id === state.identity.kinVariantId);
      state.identity.kinFocus = variant?.selectableFocus ? (state.identity.kinFocus ?? "strength") : null;
      ensureNativeLanguage();
      renderDynamic();
    });
    el.kinFocus.addEventListener("change", () => { state.identity.kinFocus = el.kinFocus.value; renderDynamic(); });
    el.profession.addEventListener("change", () => {
      const snapshot = progressionSnapshot();
      state.identity.professionId = el.profession.value;
      ensureInitialPath();
      reconcileProgression(snapshot, "смены профессии");
      renderDynamic();
    });
    el.origin.addEventListener("change", () => {
      state.identity.originId = el.origin.value;
      ensureNativeLanguage();
      renderDynamic();
    });
    el.religion.addEventListener("change", () => {
      state.identity.religionId = el.religion.value;
      renderDynamic();
    });
    bindText(el.originDetail, value => state.identity.originDetail = value);
    bindText(el.citizenship, value => state.identity.citizenship = value);
    bindText(el.religionDetail, value => state.identity.religionDetail = value);
    bindNumber(el.birthYear, value => state.identity.birthDate.year = value, renderDynamic);
    el.birthMonth.addEventListener("change", () => { state.identity.birthDate.month = el.birthMonth.value; renderDynamic(); });
    bindNumber(el.birthDay, value => state.identity.birthDate.day = value, renderDynamic);

    el.initialPath.addEventListener("change", () => {
      if (state.creation.initialPathCatalogId === el.initialPath.value) return;
      if ((state.creation.ageTalentLedger.length || state.creation.startingSpells.length || state.experience.ledger.length)
        && !confirm("Смена первого Path сохранит совместимые покупки и удалит только те, которые относятся к старому Path. Продолжить?")) {
        el.initialPath.value = state.creation.initialPathCatalogId;
        return;
      }
      const snapshot = progressionSnapshot();
      state.creation.initialPathCatalogId = el.initialPath.value;
      reconcileProgression(snapshot, "смены Professional Path");
      renderDynamic();
    });

    el.undoAgeTalent.addEventListener("click", () => {
      state.creation.ageTalentLedger.pop();
      renderDynamic();
    });

    el.languageSelect.addEventListener("change", () => { refreshLanguageLevels(); renderLanguageLore(); });
    el.addLanguage.addEventListener("click", () => {
      const languageId = el.languageSelect.value;
      const level = el.languageLevel.value;
      if (!languageId || !level || state.languages.some(entry => entry.languageId === languageId)) return;
      const native = el.languageNative.checked;
      if (native) for (const entry of state.languages) entry.native = false;
      maybeRollLanguageDiscount(languageId, level);
      state.languages.push({ languageId, level, native });
      renderDynamic();
    });

    bindNumber(el.baseXp, value => state.experience.baseTotal = Math.max(0, value), renderDynamic);
    el.buyReputation.addEventListener("click", () => addXpTransaction({ type: "reputation", amount: 1 }));
    el.undoReputation.addEventListener("click", () => undoLatestXpTransaction(tx => tx.type === "reputation", "покупки Reputation"));
    el.undoXp.addEventListener("click", () => {
      state.experience.ledger.pop();
      ensureReputationEntries();
      renderDynamic();
    });
    el.addReputationEntry.addEventListener("click", () => {
      const replay = core.replayCharacter(state, rules);
      const target = Math.max(0, Number(replay.final.reputation) || 0);
      const assigned = state.reputation.entries.reduce((sum, entry) => sum + Math.max(0, Math.floor(Number(entry.amount) || 0)), 0);
      if (assigned < target) {
        state.reputation.entries.push({ id: uid(), amount: target - assigned, description: "", location: "" });
      } else {
        const splittable = [...state.reputation.entries].reverse().find(entry => Math.max(1, Math.floor(Number(entry.amount) || 1)) > 1);
        if (!splittable) return;
        splittable.amount = Math.max(1, Math.floor(Number(splittable.amount) || 1)) - 1;
        state.reputation.entries.push({ id: uid(), amount: 1, description: "", location: "" });
      }
      renderReputationEntries();
      persist();
      updateValidation();
    });

    const bioBindings = [
      [el.bioConcept, "concept"], [el.bioAppearance, "appearance"], [el.bioBackground, "background"],
      [el.bioFamily, "family"], [el.bioMotivation, "motivation"], [el.bioPride, "pride"],
      [el.bioDarkSecret, "darkSecret"], [el.bioConnections, "partyConnections"], [el.bioPublicNote, "publicNote"]
    ];
    for (const [control, key] of bioBindings) bindText(control, value => state.biography[key] = value);
    const physicalBindings = [
      [el.physicalHeight, "height"], [el.physicalWeight, "weight"], [el.physicalSkin, "skin"],
      [el.physicalEyes, "eyes"], [el.physicalHair, "hair"], [el.physicalMarks, "distinguishingMarks"]
    ];
    for (const [control, key] of physicalBindings) bindText(control, value => state.biography.physical[key] = value);
    const questionBindings = [
      [el.questionBestFriend, "bestFriend"], [el.questionFavoriteFood, "favoriteFood"],
      [el.questionPrejudices, "prejudices"], [el.questionAristocracy, "aristocracy"],
      [el.questionFavoriteMemory, "favoriteMemory"], [el.questionOneWish, "oneWish"],
      [el.questionGreatestFear, "greatestFear"], [el.questionNotes, "notes"]
    ];
    for (const [control, key] of questionBindings) bindText(control, value => state.biography.questions[key] = value);
    bindNumber(el.otherActiveCharacters, value => state.biography.otherActiveCharacters = Math.max(0, Math.min(20, Math.trunc(value || 0))), () => {
      renderRumors(); persist(); updateValidation();
    });
    el.addRumor.addEventListener("click", () => {
      if (state.biography.rumors.length >= 20) return;
      state.biography.rumors.push({ id: uid(), text: "", truth: "uncertain" });
      renderRumors(); persist(); updateValidation();
    });
    el.addGmRequest.addEventListener("click", () => {
      const description = el.gmRequestDescription.value.trim();
      if (!description) { alert("Опишите запрос ГМу."); return; }
      state.gmRequests.push({ id: uid(), category: el.gmRequestCategory.value || "other", description });
      el.gmRequestDescription.value = "";
      renderGmRequests(); persist(); updateValidation();
    });
    bindText(el.equipmentRequest, value => state.equipmentRequest = value);

    el.portraitFile.addEventListener("change", async event => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      try { await selectAsset("portrait", file); } catch (error) { alert(error.message); }
    });
    el.tokenFile.addEventListener("change", async event => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      try { await selectAsset("token", file); } catch (error) { alert(error.message); }
    });
    el.removePortrait.addEventListener("click", () => removeAsset("portrait"));
    el.removeToken.addEventListener("click", () => removeAsset("token"));

    el.wizardBack.addEventListener("click", () => {
      const position = WIZARD_STEPS.findIndex(step => step.id === currentStep);
      if (position > 0) setWizardStep(WIZARD_STEPS[position - 1].id);
    });
    el.wizardNext.addEventListener("click", () => {
      const position = WIZARD_STEPS.findIndex(step => step.id === currentStep);
      if (position === WIZARD_STEPS.length - 1) downloadCharacter(true);
      else setWizardStep(WIZARD_STEPS[position + 1].id);
    });

    el.saveDraft.addEventListener("click", () => downloadCharacter(false));
    el.exportCharacter.addEventListener("click", () => downloadCharacter(true));
    el.loadDraft.addEventListener("change", loadDraftFile);
    el.loadRulesPackage?.addEventListener("change", loadRulesFile);
    el.checkRulesUpdate?.addEventListener("click", () => checkRemoteRules());
    el.restorePreviousRules?.addEventListener("click", restorePreviousRulesVersion);
    el.validationState.addEventListener("click", event => {
      const button = event.target.closest("[data-issue-path]");
      if (button) focusIssue(button.dataset.issuePath);
    });
    el.resetDraft.addEventListener("click", () => {
      if (!confirm("Сбросить текущий черновик?")) return;
      state = createDefaultCharacter();
      for (const kind of ["portrait", "token"]) removeAsset(kind);
      ensureCharacterShape();
      syncStaticFields();
      currentStep = WIZARD_STEPS[0].id;
      renderDynamic();
    });

    el.catalogTooltip.addEventListener("mouseenter", cancelTooltipHide);
    el.catalogTooltip.addEventListener("mouseleave", scheduleTooltipHide);
    el.catalogTooltip.addEventListener("focusin", cancelTooltipHide);
    el.catalogTooltip.addEventListener("focusout", scheduleTooltipHide);
    el.catalogTooltip.addEventListener("wheel", cancelTooltipHide, { passive: true });
    window.addEventListener("resize", hideCatalogTooltip);
    window.addEventListener("scroll", event => {
      if (event.target === el.catalogTooltip || el.catalogTooltip.contains(event.target)) return;
      hideCatalogTooltip();
    }, true);
  }

  function bindText(control, setter) {
    control.addEventListener("input", () => {
      setter(control.value);
      persist();
      updateValidation();
    });
  }

  function bindNumber(control, setter, after) {
    control.addEventListener("input", () => {
      setter(Number(control.value));
      persist();
      after?.();
    });
  }

  function syncStaticFields() {
    el.name.value = state.identity.name ?? "";
    el.kin.value = state.identity.kinId;
    el.profession.value = state.identity.professionId;
    el.origin.value = state.identity.originId;
    el.religion.value = state.identity.religionId ?? "none";
    el.originDetail.value = state.identity.originDetail ?? "";
    el.citizenship.value = state.identity.citizenship ?? "";
    el.religionDetail.value = state.identity.religionDetail ?? "";
    el.birthYear.value = state.identity.birthDate.year;
    el.birthMonth.value = state.identity.birthDate.month;
    el.birthDay.value = state.identity.birthDate.day;
    el.baseXp.value = state.experience.baseTotal;
    el.bioPublicNote.value = state.biography.publicNote ?? "";
    el.bioConcept.value = state.biography.concept ?? "";
    el.bioAppearance.value = state.biography.appearance ?? "";
    el.bioBackground.value = state.biography.background ?? "";
    el.bioFamily.value = state.biography.family ?? "";
    el.bioMotivation.value = state.biography.motivation ?? "";
    el.bioPride.value = state.biography.pride ?? "";
    el.bioDarkSecret.value = state.biography.darkSecret ?? "";
    el.bioConnections.value = state.biography.partyConnections ?? "";
    el.physicalHeight.value = state.biography.physical.height ?? "";
    el.physicalWeight.value = state.biography.physical.weight ?? "";
    el.physicalSkin.value = state.biography.physical.skin ?? "";
    el.physicalEyes.value = state.biography.physical.eyes ?? "";
    el.physicalHair.value = state.biography.physical.hair ?? "";
    el.physicalMarks.value = state.biography.physical.distinguishingMarks ?? "";
    el.questionBestFriend.value = state.biography.questions.bestFriend ?? "";
    el.questionFavoriteFood.value = state.biography.questions.favoriteFood ?? "";
    el.questionPrejudices.value = state.biography.questions.prejudices ?? "";
    el.questionAristocracy.value = state.biography.questions.aristocracy ?? "";
    el.questionFavoriteMemory.value = state.biography.questions.favoriteMemory ?? "";
    el.questionOneWish.value = state.biography.questions.oneWish ?? "";
    el.questionGreatestFear.value = state.biography.questions.greatestFear ?? "";
    el.questionNotes.value = state.biography.questions.notes ?? "";
    el.otherActiveCharacters.value = state.biography.otherActiveCharacters ?? 0;
    el.equipmentRequest.value = state.equipmentRequest ?? "";
  }

  function renderDynamic() {
    ensureInitialPath();
    const replay = core.replayCharacter(state, rules);
    ensureReputationEntries(replay);
    renderKinVariants();
    renderIdentityLore();
    renderAge();
    renderAttributes();
    renderSkills(replay);
    renderTalents(replay);
    renderSpells(replay);
    renderLanguages(replay);
    renderLanguageLore();
    renderProgress(replay);
    renderReputationEntries();
    renderRumors();
    renderGmRequests();
    renderAssets();
    persist();
    updateValidation();
  }

  function renderKinVariants() {
    const kin = index.kin.get(state.identity.kinId);
    const variants = kin?.variants ?? [];
    el.kinVariantWrap.hidden = variants.length === 0;
    setOptions(el.kinVariant, variants.map(entry => [entry.id, entry.name]));
    if (variants.length) {
      if (!variants.some(entry => entry.id === state.identity.kinVariantId)) state.identity.kinVariantId = variants[0].id;
      el.kinVariant.value = state.identity.kinVariantId;
    }
    const variant = variants.find(entry => entry.id === state.identity.kinVariantId);
    el.kinFocusWrap.hidden = !variant?.selectableFocus;
    if (variant?.selectableFocus) el.kinFocus.value = state.identity.kinFocus ?? "strength";
  }

  function renderAge() {
    const age = core.calculateAge(state.identity.birthDate, rules.campaignDate, rules);
    const kin = index.kin.get(state.identity.kinId);
    const category = core.ageCategoryFor(kin, age);
    const categoryName = rules.ageCategories[category]?.name ?? "не определён";
    el.ageSummary.textContent = `Возраст на ${formatDate(rules.campaignDate)}: ${age ?? "?"}. Категория: ${categoryName}. Допустимый диапазон: ${kin?.minimumAge ?? "?"}–${kin?.maximumAge ?? "?"}.`;
  }

  function renderAttributes() {
    const age = core.calculateAge(state.identity.birthDate, rules.campaignDate, rules);
    const category = core.ageCategoryFor(index.kin.get(state.identity.kinId), age);
    const target = rules.ageCategories[category]?.attributePoints ?? 0;
    const total = ATTRIBUTES.reduce((sum, [id]) => sum + (Number(state.attributes[id]) || 0), 0);
    el.attributeSummary.textContent = `Распределено ${total} из ${target}.`;
    el.attributeSummary.classList.toggle("error", total !== target);
    el.attributes.innerHTML = "";
    for (const [id, label] of ATTRIBUTES) {
      const maximum = core.attributeMaximum(id, state, rules);
      const card = document.createElement("div");
      card.className = "stat-card";
      card.innerHTML = `<label>${label}<input type="number" min="2" max="${maximum}" step="1" value="${state.attributes[id] ?? 2}" data-attribute="${id}"></label><small>Максимум: ${maximum}</small>`;
      card.querySelector("input").addEventListener("input", event => {
        state.attributes[id] = Number(event.target.value);
        renderDynamic();
      });
      el.attributes.append(card);
    }
  }

  function renderSkills(replay) {
    const profession = index.professions.get(state.identity.professionId);
    const age = core.calculateAge(state.identity.birthDate, rules.campaignDate, rules);
    const category = core.ageCategoryFor(index.kin.get(state.identity.kinId), age);
    const target = rules.ageCategories[category]?.skillPoints ?? 0;
    const spent = rules.skills.reduce((sum, skill) => sum + core.startingSkillCost(Number(state.skills[skill.id]?.startingRank ?? 0)), 0);
    el.skillSummary.textContent = `Стартовые очки: ${spent} из ${target}. Итоговые ранги повышаются только через журнал Base XP.`;
    el.skillSummary.classList.toggle("error", spent !== target);
    el.skillsBody.innerHTML = "";
    for (const skill of rules.skills) {
      const classSkill = profession?.skills.includes(skill.id);
      const row = document.createElement("tr");
      if (classSkill) row.className = "class-skill";
      const entry = state.skills[skill.id];
      const finalRank = replay.final.skills[skill.id] ?? entry.startingRank;
      const simulation = finalRank < 5 ? core.simulateXpTransaction(state, rules, { type: "skill", skillId: skill.id, toRank: finalRank + 1 }) : { valid: false };
      const undoPosition = lastXpTransactionIndex(tx => tx.type === "skill" && tx.skillId === skill.id);
      const undoResult = undoPosition >= 0 ? xpTransactionResult(replay, undoPosition) : null;
      row.innerHTML = `<td>${escapeHtml(skill.name)}</td><td>${skill.attribute.toUpperCase()}</td><td><input data-skill="${escapeHtml(skill.id)}" type="number" min="0" max="4" value="${entry.startingRank}"></td><td><strong>${finalRank}</strong></td><td><span class="row-actions xp-inline-actions"><button type="button" data-undo-xp class="xp-undo" ${undoPosition < 0 ? "disabled" : ""}>${undoResult ? `−1 · вернуть ${undoResult.cost} XP` : "−1"}</button><button type="button" data-buy-xp ${!simulation.valid ? "disabled" : ""}>${simulation.valid ? `+1 · ${simulation.cost} XP` : "+1 Rank"}</button></span></td>`;
      row.querySelector("input").addEventListener("input", event => {
        entry.startingRank = Number(event.target.value);
        rebaseSkillXpTransactions(skill.id);
        renderDynamic();
      });
      const skillButton = row.querySelector("[data-buy-xp]");
      const skillUndoButton = row.querySelector("[data-undo-xp]");
      skillButton.title = simulation.issue?.message ?? "";
      skillUndoButton.title = undoPosition >= 0 ? "Отменить последнее повышение этого навыка за Base XP." : "Этот навык не повышался за Base XP.";
      skillButton.addEventListener("click", () => addXpTransaction({ type: "skill", skillId: skill.id, toRank: finalRank + 1 }));
      skillUndoButton.addEventListener("click", () => removeXpTransactionAt(undoPosition, `повышения навыка ${skill.name}`));
      el.skillsBody.append(row);
    }
  }

  function renderTalents(replay) {
    const kin = index.kin.get(state.identity.kinId);
    const kinTalent = index.talents.get(kin?.talentCatalogId);
    const kinRank = replay.state.talents.get(kin?.talentCatalogId) ?? 1;
    const kinTx = { type: "talent", catalogId: kin?.talentCatalogId, toRank: kinRank + 1 };
    const kinSimulation = kinRank < 5 ? core.simulateXpTransaction(state, rules, kinTx) : { valid: false };
    const kinUndoPosition = lastXpTransactionIndex(tx => tx.type === "talent" && tx.catalogId === kin?.talentCatalogId);
    const kinUndoResult = kinUndoPosition >= 0 ? xpTransactionResult(replay, kinUndoPosition) : null;
    el.kinTalent.innerHTML = `<span class="catalog-hover" tabindex="0">${escapeHtml(kinTalent?.name ?? "Не найден")} · Rank ${kinRank}</span><span></span><span class="row-actions xp-inline-actions"><button type="button" data-undo-xp class="xp-undo" ${kinUndoPosition < 0 ? "disabled" : ""}>${kinUndoResult ? `−1 · вернуть ${kinUndoResult.cost} XP` : "−1"}</button><button type="button" data-buy-xp ${!kinSimulation.valid ? "disabled" : ""}>${kinSimulation.valid ? `+1 за ${kinSimulation.cost} XP` : "+1 за XP"}</button></span>`;
    const kinButton = el.kinTalent.querySelector("[data-buy-xp]");
    const kinUndoButton = el.kinTalent.querySelector("[data-undo-xp]");
    if (kinButton) {
      kinButton.title = kinSimulation.issue?.message ?? "";
      kinButton.addEventListener("click", () => addXpTalent(kin?.talentCatalogId));
    }
    if (kinUndoButton) {
      kinUndoButton.title = kinUndoPosition >= 0 ? "Отменить последнее повышение расового таланта за Base XP." : "Расовый талант не повышался за Base XP.";
      kinUndoButton.addEventListener("click", () => removeXpTransactionAt(kinUndoPosition, "повышения расового таланта"));
    }
    attachCatalogTooltip(el.kinTalent.querySelector(".catalog-hover"), kinTalent, `Расовый талант · Rank ${kinRank}`);

    const allowedIds = availableProfessionPaths(state.identity.professionId);
    setOptions(el.initialPath, allowedIds.map(id => [id, index.talents.get(id)?.name ?? id]));
    el.initialPath.value = state.creation.initialPathCatalogId;

    el.ageTalentSummary.textContent = `Потрачено ${replay.ageTalents.spent} из ${replay.ageTalents.total}. Магический Path стоит 2 очка за ранг, остальные покупки — 1.`;
    el.ageTalentSummary.classList.toggle("error", replay.ageTalents.spent !== replay.ageTalents.total);
    el.undoAgeTalent.disabled = state.creation.ageTalentLedger.length === 0;
    el.ageTalentLedger.innerHTML = replay.ageTalents.records.length
      ? replay.ageTalents.records.map(record => `<div class="selection-row"><span>${escapeHtml(record.name)}: Rank ${record.fromRank} → ${record.toRank}</span><span>${record.cost} очк.</span><span></span></div>`).join("")
      : '<div class="readonly-card">Возрастные очки ещё не потрачены.</div>';

    el.paths.innerHTML = "";
    const pathCatalogId = state.creation.initialPathCatalogId;
    const pathTalent = index.talents.get(pathCatalogId);
    if (pathTalent) {
      const rank = replay.state.talents.get(pathCatalogId) ?? 1;
      const row = document.createElement("div");
      row.className = "selection-row talent-row";
      const ageTx = { type: "talent", catalogId: pathCatalogId, toRank: rank + 1 };
      const ageSimulation = rank < 5 ? core.simulateAgeTalentTransaction(state, rules, ageTx) : { valid: false };
      const xpTx = { type: "talent", catalogId: pathCatalogId, toRank: rank + 1 };
      const xpSimulation = rank < 5 ? core.simulateXpTransaction(state, rules, xpTx) : { valid: false };
      const xpUndoPosition = lastXpTransactionIndex(tx => tx.type === "talent" && tx.catalogId === pathCatalogId);
      const xpUndoResult = xpUndoPosition >= 0 ? xpTransactionResult(replay, xpUndoPosition) : null;
      row.innerHTML = `<span class="catalog-hover" tabindex="0">${escapeHtml(pathTalent.name)} · первый Path${pathTalent.magical ? " · магический" : ""}</span><strong>Rank ${rank}</strong><span class="row-actions"><button type="button" data-age ${!ageSimulation.valid ? "disabled" : ""}>${ageSimulation.valid ? `+ за ${ageSimulation.record.cost} возраст.` : "+ возраст"}</button><button type="button" data-undo-xp class="xp-undo" ${xpUndoPosition < 0 ? "disabled" : ""}>${xpUndoResult ? `−1 · вернуть ${xpUndoResult.cost} XP` : "− XP"}</button><button type="button" data-xp ${!xpSimulation.valid ? "disabled" : ""}>${xpSimulation.valid ? `+1 за ${xpSimulation.cost} XP` : "+ XP"}</button></span>`;
      const ageButton = row.querySelector("[data-age]");
      const xpUndoButton = row.querySelector("[data-undo-xp]");
      const xpButton = row.querySelector("[data-xp]");
      ageButton.title = ageSimulation.issue?.message ?? "";
      xpUndoButton.title = xpUndoPosition >= 0 ? "Отменить последнее повышение этого Path за Base XP." : "Этот Path не повышался за Base XP.";
      xpButton.title = xpSimulation.issue?.message ?? "";
      ageButton.addEventListener("click", () => addAgeTalent(pathCatalogId));
      xpUndoButton.addEventListener("click", () => removeXpTransactionAt(xpUndoPosition, `повышения ${pathTalent.name}`));
      xpButton.addEventListener("click", () => addXpTalent(pathCatalogId));
      attachCatalogTooltip(row.querySelector(".catalog-hover"), pathTalent, `Professional Path · Rank ${rank}`);
      el.paths.append(row);
      if (pathTalent.magical && rank < 5 && xpSimulation.issue?.code === "XP_MAGIC_PATH_PREREQUISITE") {
        renderMagicPrerequisitePicker(el.paths, pathTalent, rank + 1);
      }
    } else {
      el.paths.innerHTML = '<div class="readonly-card">Первый Path не выбран.</div>';
    }

    renderGeneralTalentCatalog(replay);

    el.generalTalents.innerHTML = "";
    const general = replay.final.talents
      .map(selection => ({ selection, talent: index.talents.get(selection.catalogId) }))
      .filter(entry => entry.talent?.type === "general")
      .sort((a, b) => a.talent.name.localeCompare(b.talent.name, "ru"));
    if (!general.length) el.generalTalents.innerHTML = '<div class="readonly-card">Общие таланты не выбраны.</div>';
    for (const { selection, talent } of general) {
      const row = document.createElement("div");
      row.className = "selection-row talent-row";
      const ageTx = { type: "talent", catalogId: selection.catalogId, toRank: selection.rank + 1 };
      const ageSimulation = selection.rank < 5 ? core.simulateAgeTalentTransaction(state, rules, ageTx) : { valid: false };
      const xpTx = { type: "talent", catalogId: selection.catalogId, toRank: selection.rank + 1 };
      const xpSimulation = selection.rank < 5 ? core.simulateXpTransaction(state, rules, xpTx) : { valid: false };
      const xpUndoPosition = lastXpTransactionIndex(tx => tx.type === "talent" && tx.catalogId === selection.catalogId);
      const xpUndoResult = xpUndoPosition >= 0 ? xpTransactionResult(replay, xpUndoPosition) : null;
      row.innerHTML = `<span class="catalog-hover" tabindex="0">${escapeHtml(talent.name)}</span><strong>Rank ${selection.rank}</strong><span class="row-actions"><button type="button" data-age ${!ageSimulation.valid ? "disabled" : ""}>${ageSimulation.valid ? `+ за ${ageSimulation.record.cost} возраст.` : "+ возраст"}</button><button type="button" data-undo-xp class="xp-undo" ${xpUndoPosition < 0 ? "disabled" : ""}>${xpUndoResult ? `−1 · вернуть ${xpUndoResult.cost} XP` : "− XP"}</button><button type="button" data-xp ${!xpSimulation.valid ? "disabled" : ""}>${xpSimulation.valid ? `+1 за ${xpSimulation.cost} XP` : "+ XP"}</button></span>`;
      const ageButton = row.querySelector("[data-age]");
      const xpUndoButton = row.querySelector("[data-undo-xp]");
      const xpButton = row.querySelector("[data-xp]");
      ageButton.title = ageSimulation.issue?.message ?? "";
      xpUndoButton.title = xpUndoPosition >= 0 ? "Отменить последнее повышение этого таланта за Base XP." : "Этот талант не повышался за Base XP.";
      xpButton.title = xpSimulation.issue?.message ?? "";
      ageButton.addEventListener("click", () => addAgeTalent(selection.catalogId));
      xpUndoButton.addEventListener("click", () => removeXpTransactionAt(xpUndoPosition, `повышения таланта ${talent.name}`));
      xpButton.addEventListener("click", () => addXpTalent(selection.catalogId));
      attachCatalogTooltip(row.querySelector(".catalog-hover"), talent, `General Talent · Rank ${selection.rank}`);
      el.generalTalents.append(row);
    }
  }

  function renderMagicPrerequisitePicker(container, pathTalent, targetRank) {
    const discipline = rules.spellDisciplineMap[pathTalent.disciplineKey];
    const known = new Set(core.replayCharacter(state, rules).final.spells.map(entry => entry.catalogId));
    const hiddenDisciplines = new Set(rules.builderSettings?.hiddenSpellDisciplines ?? []);
    const candidates = rules.catalogs.spells.items
      .filter(spell => spell.discipline === discipline && spell.rank === targetRank && !known.has(spell.catalogId) && !hiddenDisciplines.has(spell.discipline))
      .map(spell => ({ spell, simulation: core.simulateXpTransaction(state, rules, { type: "spell", catalogId: spell.catalogId }) }))
      .filter(entry => entry.simulation.valid)
      .sort((a, b) => a.spell.name.localeCompare(b.spell.name, "ru"));
    const box = document.createElement("div");
    box.className = "magic-prerequisite-picker";
    box.innerHTML = `<strong>Для повышения до Rank ${targetRank} сначала изучите заклинание ${escapeHtml(discipline)} Rank ${targetRank}.</strong>`;
    if (!candidates.length) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Открыть вкладку заклинаний";
      button.addEventListener("click", () => setWizardStep("spells"));
      box.append(button);
      container.append(box);
      return;
    }
    const select = document.createElement("select");
    for (const { spell, simulation } of candidates) {
      const option = document.createElement("option");
      option.value = spell.catalogId;
      option.textContent = `${spell.name} · ${simulation.cost} XP`;
      select.append(option);
    }
    const buy = document.createElement("button");
    buy.type = "button";
    buy.textContent = "Изучить и остаться в талантах";
    buy.addEventListener("click", () => addXpTransaction({ type: "spell", catalogId: select.value }));
    box.append(select, buy);
    container.append(box);
  }

  function renderGeneralTalentCatalog(replay) {
    el.generalTalentCatalog.innerHTML = "";
    const fragment = document.createDocumentFragment();
    const hiddenTalents = new Set(rules.builderSettings?.hiddenTalentCatalogIds ?? []);
    const talents = rules.catalogs.talents.items
      .filter(item => item.type === "general" && !hiddenTalents.has(item.catalogId))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));

    for (const talent of talents) {
      const current = replay.state.talents.get(talent.catalogId) ?? 0;
      const tile = document.createElement("div");
      tile.className = `catalog-item${current ? " selected" : ""}`;
      const undoPosition = lastXpTransactionIndex(tx => tx.type === "talent" && tx.catalogId === talent.catalogId);
      tile.innerHTML = `<span class="catalog-item-name" tabindex="0">${escapeHtml(talent.name)}</span><span class="catalog-actions"><button class="catalog-add xp-undo" data-undo-xp type="button" aria-label="Отменить покупку ${escapeHtml(talent.name)} за Base XP" ${undoPosition < 0 ? "disabled" : ""}>−</button><button class="catalog-add" data-buy-xp type="button" aria-label="Добавить ${escapeHtml(talent.name)}" ${current >= 5 ? "disabled" : ""}>+</button></span>`;
      const name = tile.querySelector(".catalog-item-name");
      const undoButton = tile.querySelector("[data-undo-xp]");
      const button = tile.querySelector("[data-buy-xp]");
      undoButton.title = undoPosition >= 0 ? "Отменить последнее повышение этого таланта за Base XP." : "Этот талант не покупался за Base XP.";
      button.title = current >= 5 ? "Достигнут Rank 5." : "Добавить или повысить талант.";
      undoButton.addEventListener("click", () => removeXpTransactionAt(undoPosition, `повышения таланта ${talent.name}`));
      button.addEventListener("click", () => openTalentPurchaseMenu(button, talent, current));
      attachCatalogTooltip(name, talent, `General Talent${current ? ` · текущий Rank ${current}` : ""}`);
      fragment.append(tile);
    }
    el.generalTalentCatalog.append(fragment);
  }

  function openTalentPurchaseMenu(anchor, talent, current) {
    const ageSimulation = core.simulateAgeTalentTransaction(state, rules, { type: "talent", catalogId: talent.catalogId, toRank: current + 1 });
    const xpSimulation = core.simulateXpTransaction(state, rules, { type: "talent", catalogId: talent.catalogId, toRank: current + 1 });
    const options = [];
    if (ageSimulation.valid) options.push({
      label: `За возрастные очки · ${ageSimulation.record.cost}`,
      action: () => addAgeTalent(talent.catalogId)
    });
    if (xpSimulation.valid) options.push({
      label: `За Base XP · ${xpSimulation.cost} XP`,
      action: () => addXpTalent(talent.catalogId)
    });
    if (!options.length) {
      alert(ageSimulation.issue?.message ?? xpSimulation.issue?.message ?? "Покупка недоступна.");
      return;
    }
    openPurchaseMenu(anchor, `${talent.name}: Rank ${current} → ${current + 1}`, options);
  }

  function creationOnlyReplay() {
    const clone = cloneValue(state);
    clone.experience.ledger = [];
    return core.replayCharacter(clone, rules);
  }

  function addAgeTalent(catalogId) {
    if (!catalogId) return;
    const replay = creationOnlyReplay();
    const current = replay.state.talents.get(catalogId) ?? 0;
    const tx = { id: uid(), type: "talent", catalogId, toRank: current + 1 };
    const result = core.simulateAgeTalentTransaction(state, rules, tx);
    if (!result.valid) return alert(result.issue?.message ?? "Покупка недоступна.");
    state.creation.ageTalentLedger.push(tx);
    renderDynamic();
  }

  function addXpTalent(catalogId) {
    if (!catalogId) return;
    const replay = core.replayCharacter(state, rules);
    const current = replay.state.talents.get(catalogId) ?? 0;
    addXpTransaction({ type: "talent", catalogId, toRank: current + 1 });
  }

  function addXpTransaction(transaction) {
    if (!transaction.catalogId && ["talent", "spell"].includes(transaction.type)) return;
    const tx = { id: uid(), ...transaction };
    const result = core.simulateXpTransaction(state, rules, tx);
    if (!result.valid) return alert(result.issue?.message ?? "Покупка недоступна.");
    state.experience.ledger.push(tx);
    ensureReputationEntries();
    renderDynamic();
  }

  function lastXpTransactionIndex(predicate) {
    const ledger = state.experience.ledger ?? [];
    for (let position = ledger.length - 1; position >= 0; position -= 1) {
      if (predicate(ledger[position], position)) return position;
    }
    return -1;
  }

  function xpTransactionResult(replay, position) {
    return replay.final.transactionResults.find(entry => entry.position === position) ?? null;
  }

  function removeXpTransactionAt(position, label = "покупки") {
    if (!Number.isInteger(position) || position < 0 || position >= (state.experience.ledger?.length ?? 0)) return;
    const snapshot = progressionSnapshot();
    snapshot.xpLedger.splice(position, 1);
    reconcileProgression(snapshot, `отмены ${label}`);
    ensureReputationEntries();
    renderDynamic();
  }

  function undoLatestXpTransaction(predicate, label = "покупки") {
    const position = lastXpTransactionIndex(predicate);
    if (position < 0) return;
    removeXpTransactionAt(position, label);
  }

  function renderSpells(replay) {
    const hiddenDisciplines = new Set(rules.builderSettings?.hiddenSpellDisciplines ?? []);
    const disciplines = new Set([
      ...replay.startingSpells.allowedDisciplines,
      ...core.allowedSpellDisciplines(state, rules, replay.state.talents)
    ].filter(value => !hiddenDisciplines.has(value)));

    const counts = new Map();
    for (const selection of replay.final.spells) {
      const spell = index.spells.get(selection.catalogId);
      if (spell) counts.set(spell.rank, (counts.get(spell.rank) ?? 0) + 1);
    }
    const startingText = replay.startingSpells.initialPath?.magical
      ? `Бесплатные стартовые: ${replay.startingSpells.actualTotal}/${replay.startingSpells.maximumTotal}.`
      : "Стартовых заклинаний нет.";
    el.spellSummary.textContent = `${startingText} Общий лимит с покупками: ${[1,2,3,4,5,6].map(rank => `R${rank} ${counts.get(rank) ?? 0}/${rules.spellLimitPerRank}`).join(" · ")}`;
    el.spellSummary.classList.toggle("error", replay.startingSpells.issues.length > 0);

    renderSpellCatalog(replay, disciplines, counts);

    el.spells.innerHTML = "";
    if (!replay.final.spells.length) el.spells.innerHTML = '<div class="readonly-card">Заклинания не выбраны.</div>';
    for (const selection of replay.final.spells) {
      const spell = index.spells.get(selection.catalogId);
      const row = document.createElement("div");
      row.className = "selection-row";
      const xpUndoPosition = selection.source === "xp"
        ? lastXpTransactionIndex(tx => tx.type === "spell" && tx.catalogId === selection.catalogId)
        : -1;
      const buttonLabel = selection.source === "starting" ? "Удалить" : "Отменить покупку XP";
      row.innerHTML = `<span class="catalog-hover" tabindex="0">${escapeHtml(spell?.name ?? selection.catalogId)}<br><small>${escapeHtml(spell?.discipline ?? "?")} · ${selection.source === "starting" ? "стартовое" : "куплено за XP"}</small></span><span>Rank ${spell?.rank ?? "?"}</span><button type="button" class="${selection.source === "xp" ? "xp-undo" : ""}">${buttonLabel}</button>`;
      row.querySelector("button")?.addEventListener("click", () => {
        if (selection.source === "starting") {
          state.creation.startingSpells = state.creation.startingSpells.filter(id => id !== selection.catalogId);
          renderDynamic();
          return;
        }
        removeXpTransactionAt(xpUndoPosition, `покупки заклинания ${spell?.name ?? selection.catalogId}`);
      });
      attachCatalogTooltip(row.querySelector(".catalog-hover"), spell, `${spell?.discipline ?? "Заклинание"} · Rank ${spell?.rank ?? "?"}`);
      el.spells.append(row);
    }
  }

  function renderSpellCatalog(replay, disciplines, counts) {
    el.spellCatalog.innerHTML = "";
    if (!replay.startingSpells.initialPath?.magical || !disciplines.size) {
      el.spellCatalog.innerHTML = '<div class="readonly-card">Выбранный Professional Path не открывает магию.</div>';
      return;
    }

    const selected = new Map(replay.final.spells.map(entry => [entry.catalogId, entry]));
    const disciplineOrder = [rules.spellDisciplineMap.general, ...replay.startingSpells.allowedDisciplines]
      .filter((value, position, values) => value && values.indexOf(value) === position);
    for (const value of [...disciplines].sort((a, b) => a.localeCompare(b, "ru"))) {
      if (!disciplineOrder.includes(value)) disciplineOrder.push(value);
    }

    for (let rank = 1; rank <= 6; rank += 1) {
      const rankSpells = rules.catalogs.spells.items
        .filter(item => item.rank === rank && disciplines.has(item.discipline))
        .sort((a, b) => (disciplineOrder.indexOf(a.discipline) - disciplineOrder.indexOf(b.discipline)) || a.name.localeCompare(b.name, "ru"));
      if (!rankSpells.length) continue;

      const section = document.createElement("section");
      section.className = "spell-rank-section";
      const freeLimit = rank <= replay.startingSpells.initialRank ? startingSpellLimit(rank) : 0;
      const startingAtRank = state.creation.startingSpells.filter(id => index.spells.get(id)?.rank === rank).length;
      section.innerHTML = `<header class="spell-rank-header"><h3>Rank ${rank}</h3><span class="spell-rank-count ${(counts.get(rank) ?? 0) >= rules.spellLimitPerRank ? "full" : ""}">${counts.get(rank) ?? 0}/${rules.spellLimitPerRank}${freeLimit ? ` · бесплатные ${startingAtRank}/${freeLimit}` : ""}</span></header>`;

      for (const discipline of disciplineOrder) {
        const schoolSpells = rankSpells.filter(item => item.discipline === discipline);
        if (!schoolSpells.length) continue;
        const school = document.createElement("div");
        school.className = "spell-school-block";
        school.innerHTML = `<h4>${escapeHtml(discipline)}</h4><div class="catalog-grid catalog-grid-three"></div>`;
        const grid = school.querySelector(".catalog-grid");

        for (const spell of schoolSpells) {
          const selection = selected.get(spell.catalogId);
          const startingAllowed = !selection
            && replay.startingSpells.allowedDisciplines.includes(spell.discipline)
            && spell.rank <= replay.startingSpells.initialRank
            && startingAtRank < freeLimit;
          const potentialXp = !selection
            && spell.rank <= replay.startingSpells.initialRank + 1
            && (counts.get(spell.rank) ?? 0) < rules.spellLimitPerRank;
          const tile = document.createElement("div");
          tile.className = `catalog-item spell-catalog-item${selection ? " selected" : ""}`;
          const icon = selection ? "−" : "+";
          const disabled = !selection && (!startingAllowed && !potentialXp);
          const actionLabel = selection?.source === "starting" ? "Убрать" : selection ? "Отменить покупку" : "Добавить";
          tile.innerHTML = `<span class="catalog-item-name" tabindex="0">${escapeHtml(spell.name)}</span><button class="catalog-add ${selection?.source === "xp" ? "xp-undo" : ""}" type="button" aria-label="${actionLabel} ${escapeHtml(spell.name)}" ${disabled ? "disabled" : ""}>${icon}</button>`;
          const name = tile.querySelector(".catalog-item-name");
          const button = tile.querySelector(".catalog-add");
          if (selection?.source === "starting") {
            button.title = "Убрать из стартовых заклинаний.";
            button.addEventListener("click", () => {
              state.creation.startingSpells = state.creation.startingSpells.filter(id => id !== spell.catalogId);
              renderDynamic();
            });
          } else if (selection) {
            const xpUndoPosition = lastXpTransactionIndex(tx => tx.type === "spell" && tx.catalogId === spell.catalogId);
            button.title = "Отменить покупку этого заклинания за Base XP.";
            button.addEventListener("click", () => removeXpTransactionAt(xpUndoPosition, `покупки заклинания ${spell.name}`));
          } else {
            button.title = (!startingAllowed && !potentialXp)
              ? `Заклинание этого ранга недоступно или лимит Rank ${spell.rank} уже заполнен.`
              : "Выбрать источник получения заклинания.";
            button.addEventListener("click", () => openSpellPurchaseMenu(button, spell, startingAllowed));
          }
          attachCatalogTooltip(name, spell, `${spell.discipline} · Rank ${spell.rank}`);
          grid.append(tile);
        }
        section.append(school);
      }
      el.spellCatalog.append(section);
    }
  }

  function openSpellPurchaseMenu(anchor, spell, startingAllowed) {
    const xpSimulation = core.simulateXpTransaction(state, rules, { type: "spell", catalogId: spell.catalogId });
    const options = [];
    if (startingAllowed) options.push({
      label: "Выбрать стартовым · бесплатно",
      action: () => addStartingSpell(spell.catalogId)
    });
    if (xpSimulation.valid) options.push({
      label: `Купить за Base XP · ${xpSimulation.cost} XP`,
      action: () => addXpTransaction({ type: "spell", catalogId: spell.catalogId })
    });
    if (!options.length) {
      alert(xpSimulation.issue?.message ?? "Заклинание сейчас недоступно.");
      return;
    }
    openPurchaseMenu(anchor, `${spell.name} · Rank ${spell.rank}`, options);
  }

  function addStartingSpell(catalogId) {
    if (!catalogId) return;
    const replay = core.replayCharacter(state, rules);
    const spell = index.spells.get(catalogId);
    const initialPath = replay.startingSpells.initialPath;
    if (!initialPath?.magical) return alert("Выбранный первый Path не даёт стартовых заклинаний.");
    if (!replay.startingSpells.allowedDisciplines.includes(spell?.discipline)) return alert("Это заклинание недоступно как стартовое.");
    if (!spell || spell.rank > replay.startingSpells.initialRank) return alert(`Доступны стартовые заклинания не выше Rank ${replay.startingSpells.initialRank}.`);
    if (state.creation.startingSpells.includes(catalogId)) return;
    const sameRank = state.creation.startingSpells.filter(id => index.spells.get(id)?.rank === spell.rank).length;
    const freeLimit = startingSpellLimit(spell.rank);
    if (sameRank >= freeLimit) return alert(`На Rank ${spell.rank} уже выбрано максимально доступное число бесплатных заклинаний: ${freeLimit}.`);
    state.creation.startingSpells.push(catalogId);
    renderDynamic();
  }

  function renderLanguages(replay) {
    const budget = core.languageBudget(state);
    const spent = core.totalLanguageCost(state, rules);
    el.languageSummary.textContent = `Потрачено ${spent} из ${budget} очков. Родной язык оплачивается доплатой между уровнями.`;
    el.languageSummary.classList.toggle("error", spent > budget);
    refreshLanguageLevels();
    el.languages.innerHTML = "";
    for (const selection of state.languages) {
      const language = index.languages.get(selection.languageId);
      const cost = core.languageSelectionCost(selection, state, rules);
      const row = document.createElement("div");
      row.className = "selection-row";
      row.innerHTML = `<span>${escapeHtml(language?.name ?? selection.languageId)}${selection.native ? " · родной" : ""}</span><span>${LEVEL_NAMES[selection.level] ?? selection.level} · ${cost} очк.</span><button type="button">Удалить</button>`;
      row.querySelector("button").addEventListener("click", () => { state.languages = state.languages.filter(entry => entry !== selection); renderDynamic(); });
      el.languages.append(row);
    }
  }

  function refreshLanguageLevels() {
    const language = index.languages.get(el.languageSelect.value);
    const levels = Object.keys(language?.levels ?? {});
    setOptions(el.languageLevel, levels.map(level => [level, `${LEVEL_NAMES[level] ?? level} (${language.levels[level]})`]));
    const allowedNative = core.allowedNativeLanguages(state, rules);
    el.languageNative.disabled = !allowedNative.includes(el.languageSelect.value);
    if (el.languageNative.disabled) el.languageNative.checked = false;
  }

  function maybeRollLanguageDiscount(languageId, level) {
    const language = index.languages.get(languageId);
    const rule = language?.randomDiscount;
    if (!rule || rule.level !== level) return;
    const existing = state.languageRolls.find(entry => entry.languageId === languageId && entry.level === level);
    if (existing) return;
    const result = crypto.getRandomValues(new Uint32Array(1))[0] % 6 + 1;
    state.languageRolls.push({ languageId, level, formula: rule.formula, result });
    alert(`Проверка стоимости языка «${language.name}»: ${rule.formula} = ${result}.`);
  }

  function renderProgress(replay) {
    el.reputationTotal.value = replay.final.reputation;
    el.baseXp.value = state.experience.baseTotal;
    el.baseXpAllowance.textContent = `На развитие доступно 20%: ${replay.final.xpBudget} XP.`;
    el.xpBudget.value = replay.final.xpBudget;
    el.spentXp.value = replay.final.xpSpent;
    el.remainingXp.value = replay.final.xpRemaining;
    el.undoXp.disabled = state.experience.ledger.length === 0;
    const reputationSimulation = core.simulateXpTransaction(state, rules, { type: "reputation", amount: 1 });
    el.buyReputation.disabled = !reputationSimulation.valid;
    el.buyReputation.textContent = reputationSimulation.valid ? `Купить +1 Reputation за ${reputationSimulation.cost} XP` : "Купить +1 Reputation";
    el.buyReputation.title = reputationSimulation.issue?.message ?? "";
    const reputationUndoPosition = lastXpTransactionIndex(tx => tx.type === "reputation");
    const reputationUndoResult = reputationUndoPosition >= 0 ? xpTransactionResult(replay, reputationUndoPosition) : null;
    el.undoReputation.disabled = reputationUndoPosition < 0;
    el.undoReputation.textContent = reputationUndoResult ? `Вернуть 1 Reputation · +${reputationUndoResult.cost} XP` : "Вернуть купленную Reputation";
    el.undoReputation.title = reputationUndoPosition >= 0 ? "Отменить последнюю покупку Reputation за Base XP." : "Reputation за Base XP не покупалась.";

    el.xpLedger.innerHTML = "";
    if (!replay.final.transactionResults.length) {
      el.xpLedger.innerHTML = '<div class="readonly-card">Base XP ещё не потрачен.</div>';
    } else {
      replay.final.transactionResults.forEach((entry, i) => {
        const detail = entry.breakdown
          ? `база ${entry.breakdown.base} + таланты ${entry.breakdown.surcharge}, ×${entry.breakdown.multiplier}`
          : "";
        const row = document.createElement("div");
        row.className = "selection-row ledger-row";
        row.innerHTML = `<span>${i + 1}. ${escapeHtml(entry.label)}${detail ? `<br><small>${escapeHtml(detail)}</small>` : ""}</span><strong>${entry.cost} XP</strong><span>Σ ${entry.cumulativeAfter}</span><button type="button" class="xp-undo">Отменить</button>`;
        row.querySelector("button").addEventListener("click", () => removeXpTransactionAt(entry.position, entry.label));
        el.xpLedger.append(row);
      });
    }
  }

  function renderReputationEntries() {
    el.reputationEntries.innerHTML = "";
    const replay = core.replayCharacter(state, rules);
    const target = Math.max(0, Number(replay.final.reputation) || 0);
    const assigned = state.reputation.entries.reduce((sum, entry) => sum + Math.max(0, Math.floor(Number(entry.amount) || 0)), 0);
    const canSplit = state.reputation.entries.some(entry => Math.max(1, Math.floor(Number(entry.amount) || 1)) > 1);
    el.addReputationEntry.disabled = assigned >= target && !canSplit;
    el.addReputationEntry.title = assigned < target
      ? `Осталось распределить: ${target - assigned}.`
      : canSplit ? "Разделить одну из сгруппированных записей." : "Все пункты репутации уже распределены по отдельным записям.";

    state.reputation.entries.forEach((entry, position) => {
      const row = document.createElement("div");
      row.className = "reputation-entry-row";
      row.innerHTML = `
        <input data-field="amount" type="number" min="1" step="1" inputmode="numeric" aria-label="Количество" title="Количество пунктов Reputation в этой записи">
        <input data-field="description" type="text" placeholder="Почему получена" aria-label="Почему получена">
        <input data-field="location" type="text" placeholder="Где получена" aria-label="Где получена">
        <button type="button" class="danger" aria-label="Удалить запись" title="Удалить запись">×</button>
      `;
      const amount = row.querySelector('[data-field="amount"]');
      const description = row.querySelector('[data-field="description"]');
      const location = row.querySelector('[data-field="location"]');
      amount.value = String(Math.max(1, Math.floor(Number(entry.amount) || 1)));
      description.value = entry.description ?? "";
      location.value = entry.location ?? "";
      amount.addEventListener("input", () => {
        entry.amount = Math.max(1, Math.floor(Number(amount.value) || 1));
        persist();
        updateValidation();
      });
      description.addEventListener("input", () => { entry.description = description.value; persist(); updateValidation(); });
      location.addEventListener("input", () => { entry.location = location.value; persist(); updateValidation(); });
      row.querySelector("button").addEventListener("click", () => {
        state.reputation.entries.splice(position, 1);
        renderReputationEntries();
        persist();
        updateValidation();
      });
      el.reputationEntries.append(row);
    });
  }

  function renderRumors() {
    const fixedRumors = rules.builderSettings?.rumorCountMode === "fixed";
    const target = fixedRumors
      ? Math.max(0, Number(rules.builderSettings.requiredRumorCount ?? 0) || 0)
      : Math.max(0, Number(state.biography.otherActiveCharacters ?? 0) || 0);
    el.otherActiveCharacters.disabled = fixedRumors;
    el.otherActiveCharacters.title = fixedRumors ? `Количество слухов задано ГМом: ${target}.` : "";
    el.addRumor.disabled = state.biography.rumors.length >= 20;
    el.rumors.innerHTML = `<div class="summary-line ${state.biography.rumors.length === target ? "" : "error"}">Подготовлено ${state.biography.rumors.length} из ${target} слухов.</div>`;
    state.biography.rumors.forEach((rumor, position) => {
      const row = document.createElement("div");
      row.className = "narrative-row rumor-row";
      row.innerHTML = `
        <span class="row-index">${position + 1}</span>
        <select aria-label="Истинность слуха">${Object.entries(RUMOR_TRUTH_NAMES).map(([value, label]) => `<option value="${value}" ${rumor.truth === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select>
        <textarea rows="2" placeholder="Текст слуха"></textarea>
        <button type="button" aria-label="Удалить слух">Удалить</button>
      `;
      const select = row.querySelector("select");
      const textarea = row.querySelector("textarea");
      textarea.value = rumor.text ?? "";
      select.addEventListener("change", () => { rumor.truth = select.value; persist(); updateValidation(); });
      textarea.addEventListener("input", () => { rumor.text = textarea.value; persist(); updateValidation(); });
      row.querySelector("button").addEventListener("click", () => {
        state.biography.rumors.splice(position, 1);
        renderRumors(); persist(); updateValidation();
      });
      el.rumors.append(row);
    });
  }

  function renderGmRequests() {
    el.gmRequests.innerHTML = state.gmRequests.length ? "" : '<div class="readonly-card">Запросов ГМу нет.</div>';
    state.gmRequests.forEach((request, position) => {
      const row = document.createElement("div");
      row.className = "narrative-row gm-request-row";
      row.innerHTML = `
        <select aria-label="Категория запроса">${Object.entries(GM_REQUEST_NAMES).map(([value, label]) => `<option value="${value}" ${request.category === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select>
        <textarea rows="3" placeholder="Описание запроса"></textarea>
        <button type="button" aria-label="Удалить запрос">Удалить</button>
      `;
      const select = row.querySelector("select");
      const textarea = row.querySelector("textarea");
      textarea.value = request.description ?? "";
      select.addEventListener("change", () => { request.category = select.value; persist(); updateValidation(); });
      textarea.addEventListener("input", () => { request.description = textarea.value; persist(); updateValidation(); });
      row.querySelector("button").addEventListener("click", () => {
        state.gmRequests.splice(position, 1);
        renderGmRequests(); persist(); updateValidation();
      });
      el.gmRequests.append(row);
    });
  }

  function updateValidation(renderUi = true) {
    state.rulesVersion = rules.rulesVersion;
    state.rulesHash = rules.packageHash;
    const validation = core.validateCharacter(state, rules);
    const assetWarnings = [];
    for (const kind of ["portrait", "token"]) {
      if (state.assets?.[kind] && !assetFiles[kind]) {
        assetWarnings.push({ code: "ASSET_MISSING", message: `${kind === "portrait" ? "Портрет" : "Токен"} указан в черновике, но файл изображения не восстановлен.`, path: "assets" });
      }
    }
    validation.warnings = [...validation.warnings, ...assetWarnings];
    const errors = validation.errors;
    const valid = validation.valid;
    if (renderUi) {
      el.exportCharacter.disabled = !valid;
      el.validationState.innerHTML = `
        <p class="${valid ? "validation-good" : "validation-bad"}">${valid ? "Файл готов к экспорту." : `Найдено ошибок: ${errors.length}.`}</p>
        ${renderIssues(errors, "errors", "Ошибки")}
        ${renderIssues(validation.warnings, "warnings", "Предупреждения")}
      `;
      renderReviewSummary(validation);
      renderWizard(validation);
    }
    return validation;
  }

  function renderIssues(issues, className, title) {
    if (!issues.length) return "";
    return `<div class="issue-block ${className}"><h3>${title}</h3><ul>${issues.map(issue => `<li><button type="button" class="issue-link" data-issue-path="${escapeHtml(issue.path || "")}"><strong>${escapeHtml(issue.code)}</strong>: ${escapeHtml(issue.message)}<span>Перейти</span></button></li>`).join("")}</ul></div>`;
  }

  async function downloadCharacter(requireValid) {
    const validation = updateValidation();
    if (requireValid && !validation.valid) return;
    state.createdAt = new Date().toISOString();
    state.rulesVersion = rules.rulesVersion;
    state.rulesHash = rules.packageHash;
    state.formatVersion = 7;

    const entries = [];
    const manifestAssets = {};
    for (const kind of ["portrait", "token"]) {
      const file = assetFiles[kind];
      if (!file) {
        if (state.assets[kind]) state.assets[kind] = null;
        continue;
      }
      const metadata = state.assets[kind];
      if (!metadata?.path) continue;
      entries.push({ name: metadata.path, data: new Uint8Array(await file.arrayBuffer()) });
      manifestAssets[kind] = metadata.path;
    }

    const manifest = {
      format: "air-islands-character-package",
      packageVersion: 3,
      character: "character.json",
      rules: "rules.json",
      assets: manifestAssets,
      createdAt: state.createdAt,
      rulesVersion: state.rulesVersion,
      rulesHash: state.rulesHash
    };
    entries.unshift(
      { name: "manifest.json", data: `${JSON.stringify(manifest, null, 2)}\n` },
      { name: "character.json", data: `${JSON.stringify(state, null, 2)}\n` },
      { name: "rules.json", data: `${JSON.stringify(rules)}\n` }
    );

    const packageBytes = zip.createZip(entries);
    const filename = `${safeFilename(state.identity.name || "character")}${requireValid ? "" : "-draft"}.flchar`;
    const blob = new Blob([packageBytes], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function loadDraftFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let parsed;
      let entries = null;
      if (zip.isZip(bytes)) {
        entries = zip.readZip(bytes);
        const characterBytes = entries.get("character.json");
        if (!characterBytes) throw new Error("В контейнере отсутствует character.json.");
        parsed = JSON.parse(zip.decodeText(characterBytes));
      } else {
        parsed = JSON.parse(zip.decodeText(bytes));
      }
      if (parsed.format !== "air-islands-character") throw new Error("Неизвестный формат файла.");
      const originalVersion = parsed.formatVersion;
      state = migrateCharacter(parsed);
      ensureCharacterShape();
      if (entries) await replaceAssetsFromPackage(entries, state);
      else {
        assetFiles = { portrait: null, token: null };
        state.assets = { portrait: null, token: null };
        await Promise.all([deleteStoredAsset("portrait"), deleteStoredAsset("token")]);
      }
      syncStaticFields();
      renderDynamic();
      if (originalVersion !== 7) alert("Файл предыдущей версии перенесён в формат v7. Прежние описания происхождения Reputation сохранены и преобразованы в структурированные записи.");
    } catch (error) {
      console.error(error);
      alert(`Не удалось открыть файл: ${error.message}`);
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key);
    } catch {
      // Некоторые браузеры ограничивают localStorage для file://. Экспорт файла продолжает работать.
    }
  }

  function loadLocalDraft() {
    try {
      const direct = localStorage.getItem(STORAGE_KEY);
      if (direct) return JSON.parse(direct);
      for (const key of LEGACY_STORAGE_KEYS) {
        const value = localStorage.getItem(key);
        if (value) return JSON.parse(value);
      }
      return null;
    } catch {
      return null;
    }
  }

  function attachCatalogTooltip(target, entry, meta = "") {
    if (!target || !entry) return;
    target.classList.add("has-catalog-tooltip");
    target.addEventListener("mouseenter", () => showCatalogTooltip(entry, meta, target));
    target.addEventListener("focus", () => showCatalogTooltip(entry, meta, target));
    target.addEventListener("mouseleave", scheduleTooltipHide);
    target.addEventListener("blur", scheduleTooltipHide);
    target.addEventListener("wheel", event => {
      if (el.catalogTooltip.hidden || activeTooltipTarget !== target) return;
      const maxScroll = Math.max(0, el.catalogTooltip.scrollHeight - el.catalogTooltip.clientHeight);
      if (!maxScroll) return;
      const previous = el.catalogTooltip.scrollTop;
      el.catalogTooltip.scrollTop = Math.max(0, Math.min(maxScroll, previous + event.deltaY));
      if (el.catalogTooltip.scrollTop !== previous) {
        event.preventDefault();
        event.stopPropagation();
        cancelTooltipHide();
      }
    }, { passive: false });
  }

  function catalogDescription(entry) {
    return String(entry?.snapshot?.system?.description ?? "").trim();
  }

  function sanitizeCatalogHtml(html) {
    const template = document.createElement("template");
    const normalized = String(html ?? "")
      .replace(/@UUID\[[^\]]+\]\{([^}]+)\}/gu, "$1")
      .replace(/@JournalEntry\[[^\]]+\]/gu, "связанная запись");
    template.innerHTML = normalized;
    for (const node of template.content.querySelectorAll("script, style, iframe, object, embed, link, meta, img, video, audio")) node.remove();
    for (const node of template.content.querySelectorAll("*")) {
      for (const attribute of [...node.attributes]) node.removeAttribute(attribute.name);
      if (node.tagName === "A") {
        const replacement = document.createElement("span");
        replacement.append(...node.childNodes);
        node.replaceWith(replacement);
      }
    }
    return template.innerHTML;
  }

  function showCatalogTooltip(entry, meta, target) {
    cancelTooltipHide();
    activeTooltipTarget = target;
    const system = entry.snapshot?.system ?? {};
    const facts = [];
    if (entry.rank) facts.push(`Rank ${entry.rank}`);
    if (entry.discipline) facts.push(entry.discipline);
    if (system.spellType) facts.push(String(system.spellType).replace(/^SPELL\./u, ""));
    if (system.range) facts.push(`Дистанция: ${system.range}`);
    if (system.duration) facts.push(`Длительность: ${system.duration}`);
    if (system.ingredient) facts.push(`Ингредиент: ${system.ingredient}`);
    const description = sanitizeCatalogHtml(catalogDescription(entry));
    el.catalogTooltip.innerHTML = `
      <header><strong>${escapeHtml(entry.name ?? "Без названия")}</strong>${meta ? `<span>${escapeHtml(meta)}</span>` : ""}</header>
      ${facts.length ? `<div class="catalog-tooltip-facts">${facts.map(value => `<span>${escapeHtml(value)}</span>`).join("")}</div>` : ""}
      <div class="catalog-tooltip-description">${description || "<p>Описание отсутствует.</p>"}</div>
    `;
    el.catalogTooltip.hidden = false;
    el.catalogTooltip.scrollTop = 0;
    positionCatalogTooltip(target);
  }

  function positionCatalogTooltip(target) {
    if (!target || el.catalogTooltip.hidden) return;
    const rect = target.getBoundingClientRect();
    const gap = 4;
    const margin = 10;
    el.catalogTooltip.style.left = `${margin}px`;
    el.catalogTooltip.style.top = `${margin}px`;
    const tooltipRect = el.catalogTooltip.getBoundingClientRect();
    let side = "right";
    let left = rect.right + gap;
    if (left + tooltipRect.width > window.innerWidth - margin) {
      side = "left";
      left = rect.left - tooltipRect.width - gap;
    }
    left = Math.max(margin, Math.min(left, window.innerWidth - tooltipRect.width - margin));
    el.catalogTooltip.dataset.side = side;
    let top = rect.top;
    if (top + tooltipRect.height > window.innerHeight - margin) top = window.innerHeight - tooltipRect.height - margin;
    top = Math.max(margin, top);
    el.catalogTooltip.style.left = `${left}px`;
    el.catalogTooltip.style.top = `${top}px`;
  }

  function cancelTooltipHide() {
    if (tooltipHideTimer) clearTimeout(tooltipHideTimer);
    tooltipHideTimer = null;
  }

  function scheduleTooltipHide() {
    cancelTooltipHide();
    tooltipHideTimer = setTimeout(hideCatalogTooltip, 420);
  }

  function hideCatalogTooltip() {
    cancelTooltipHide();
    activeTooltipTarget = null;
    el.catalogTooltip.hidden = true;
    delete el.catalogTooltip.dataset.side;
  }

  function openPurchaseMenu(anchor, title, options) {
    closePurchaseMenu();
    hideCatalogTooltip();
    el.purchaseMenu.innerHTML = `<strong>${escapeHtml(title)}</strong><div class="purchase-menu-actions"></div>`;
    const actions = el.purchaseMenu.querySelector(".purchase-menu-actions");
    for (const option of options) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = option.label;
      button.addEventListener("click", () => {
        closePurchaseMenu();
        option.action();
      });
      actions.append(button);
    }
    el.purchaseMenu.hidden = false;
    const rect = anchor.getBoundingClientRect();
    const menuRect = el.purchaseMenu.getBoundingClientRect();
    const margin = 8;
    let left = rect.right - menuRect.width;
    left = Math.max(margin, Math.min(left, window.innerWidth - menuRect.width - margin));
    let top = rect.bottom + 6;
    if (top + menuRect.height > window.innerHeight - margin) top = rect.top - menuRect.height - 6;
    top = Math.max(margin, top);
    el.purchaseMenu.style.left = `${left}px`;
    el.purchaseMenu.style.top = `${top}px`;
    el.purchaseMenu.querySelector("button")?.focus();

    const onOutside = event => {
      if (el.purchaseMenu.contains(event.target) || anchor.contains(event.target)) return;
      closePurchaseMenu();
    };
    const onKey = event => {
      if (event.key === "Escape") closePurchaseMenu();
    };
    document.addEventListener("pointerdown", onOutside, true);
    document.addEventListener("keydown", onKey, true);
    purchaseMenuCleanup = () => {
      document.removeEventListener("pointerdown", onOutside, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }

  function closePurchaseMenu() {
    purchaseMenuCleanup?.();
    purchaseMenuCleanup = null;
    el.purchaseMenu.hidden = true;
    el.purchaseMenu.innerHTML = "";
  }

  function setOptions(select, options) {
    const current = select.value;
    select.innerHTML = options.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("");
    if (options.some(([value]) => value === current)) select.value = current;
  }

  function formatDate(date) {
    const month = index.months.get(date.month)?.name ?? date.month;
    return `${date.day} ${month}, ${date.year} П.П.`;
  }

  function uid() {
    return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function safeFilename(value) {
    return String(value).trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/\s+/g, "_").slice(0, 100) || "character";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  }


  async function resolveInitialRules() {
    const cached = await loadActiveCachedRules().catch(error => {
      console.warn("Не удалось прочитать кэш правил.", error);
      return null;
    });
    if (cached) return { ...cached, source: "cache", remotePending: true };

    try {
      return await fetchRemoteRulesPackage();
    } catch (remoteError) {
      const embedded = globalThis.AIR_ISLANDS_RULES;
      if (embedded) {
        validateRulesObject(embedded);
        return {
          rules: clonePlain(embedded),
          source: "embedded",
          checkedAt: new Date().toISOString(),
          error: remoteError,
          remotePending: true,
          canRestore: false
        };
      }
      throw new Error(`Не удалось загрузить правила с GitHub и локальный резерв отсутствует: ${remoteError.message}`);
    }
  }

  async function fetchRemoteRulesPackage() {
    const configured = String(appConfig.rulesManifestUrl ?? "").trim();
    if (!configured) throw new Error("URL манифеста правил не настроен.");
    if (globalThis.location?.protocol === "file:") throw new Error("Автоматическая загрузка недоступна для file://. Используется локальный резерв.");

    const manifestUrl = new URL(configured, globalThis.location?.href ?? "http://localhost/").href;
    const manifestResponse = await fetchWithTimeout(manifestUrl, { cache: "no-store" });
    if (!manifestResponse.ok) throw new Error(`Манифест правил: HTTP ${manifestResponse.status}.`);
    const manifest = normalizeRemoteManifest(await manifestResponse.json(), manifestUrl);

    const cachedState = await readRulesCacheState();
    const cachedRecord = cachedState?.activeHash ? await readCachedRulesRecord(cachedState.activeHash) : null;
    if (cachedRecord?.packageSha256 === manifest.packageSha256) {
      const rules = parseRulesPackageBytes(cachedRecord.bytes);
      return {
        rules,
        manifest,
        packageSha256: cachedRecord.packageSha256,
        source: "cache-current",
        checkedAt: new Date().toISOString(),
        canRestore: Boolean(cachedState.previousHash)
      };
    }

    const packageResponse = await fetchWithTimeout(manifest.packageUrl, { cache: "no-store" });
    if (!packageResponse.ok) throw new Error(`Пакет правил: HTTP ${packageResponse.status}.`);
    const bytes = new Uint8Array(await packageResponse.arrayBuffer());
    const packageSha256 = await sha256Hex(bytes);
    if (packageSha256 !== manifest.packageSha256) throw new Error("Контрольная сумма загруженного пакета правил не совпадает с манифестом.");
    if (manifest.packageSize != null && Number(manifest.packageSize) !== bytes.length) throw new Error("Размер загруженного пакета правил не совпадает с манифестом.");

    const rules = parseRulesPackageBytes(bytes);
    if (manifest.rulesPackageHash && rules.packageHash !== manifest.rulesPackageHash) {
      throw new Error("Внутренняя версия пакета правил не совпадает с манифестом.");
    }
    const cache = await activateCachedRulesRecord({
      packageSha256,
      bytes,
      manifest,
      rulesVersion: rules.rulesVersion,
      rulesPackageHash: rules.packageHash,
      savedAt: new Date().toISOString()
    });
    return {
      rules,
      manifest,
      packageSha256,
      source: "remote",
      checkedAt: new Date().toISOString(),
      canRestore: Boolean(cache.previousHash)
    };
  }

  function normalizeRemoteManifest(value, manifestUrl) {
    if (value?.format !== "air-islands-rules-manifest" || Number(value?.formatVersion) !== 1) {
      throw new Error("GitHub вернул неизвестный формат манифеста правил.");
    }
    const minimumBuilderVersion = String(value.minimumBuilderVersion ?? "0.0.0");
    if (compareVersions(BUILDER_VERSION, minimumBuilderVersion) < 0) {
      throw new Error(`Правила требуют конструктор ${minimumBuilderVersion} или новее. Откройте актуальную страницу конструктора.`);
    }
    const packagePath = String(value.package ?? value.packageUrl ?? "").trim();
    if (!packagePath) throw new Error("В манифесте не указан файл пакета правил.");
    const packageSha256 = String(value.packageSha256 ?? value.sha256 ?? "").toLowerCase();
    if (!/^[a-f0-9]{64}$/u.test(packageSha256)) throw new Error("В манифесте указана неверная контрольная сумма пакета.");
    return {
      ...value,
      minimumBuilderVersion,
      packageSha256,
      packageUrl: new URL(packagePath, manifestUrl).href
    };
  }

  function parseRulesPackageBytes(value) {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    let rules;
    if (zip.isZip(bytes)) {
      const entries = zip.readZip(bytes);
      const rulesBytes = entries.get("rules.json") ?? entries.get("air-islands-rules.json");
      if (!rulesBytes) throw new Error("В пакете отсутствует rules.json.");
      rules = JSON.parse(zip.decodeText(rulesBytes));
    } else {
      rules = JSON.parse(zip.decodeText(bytes));
    }
    validateRulesObject(rules);
    return rules;
  }

  function validateRulesObject(rules) {
    if (rules?.format !== "air-islands-rules") throw new Error("Неизвестный формат пакета правил.");
    if (!rules.packageHash || !rules.rulesVersion) throw new Error("В пакете правил отсутствуют версия или контрольный хеш.");
    if (!Array.isArray(rules.kin) || !Array.isArray(rules.professions) || !Array.isArray(rules.skills)) throw new Error("Пакет правил не содержит обязательные справочники.");
    if (!Array.isArray(rules.catalogs?.talents?.items) || !Array.isArray(rules.catalogs?.spells?.items)) throw new Error("Пакет правил не содержит каталоги талантов или заклинаний.");
    core.indexRules(rules);
  }

  async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1000, Number(appConfig.remoteCheckTimeoutMs) || 8000));
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("Истекло время ожидания ответа GitHub.");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  function compareVersions(left, right) {
    const parse = value => String(value ?? "0").split(/[.+-]/u).slice(0, 3).map(part => Number.parseInt(part, 10) || 0);
    const a = parse(left);
    const b = parse(right);
    for (let i = 0; i < 3; i += 1) {
      if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
    }
    return 0;
  }

  async function sha256Hex(value) {
    if (!globalThis.crypto?.subtle?.digest) throw new Error("Браузер не поддерживает проверку SHA-256.");
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    return [...digest].map(byte => byte.toString(16).padStart(2, "0")).join("");
  }

  function clonePlain(value) {
    return typeof globalThis.structuredClone === "function" ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value));
  }

  function openRulesDb() {
    if (!globalThis.indexedDB) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(RULES_DB_NAME, RULES_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(RULES_PACKAGE_STORE)) db.createObjectStore(RULES_PACKAGE_STORE, { keyPath: "packageSha256" });
        if (!db.objectStoreNames.contains(RULES_STATE_STORE)) db.createObjectStore(RULES_STATE_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function readRulesCacheState() {
    const db = await openRulesDb();
    if (!db) return null;
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(RULES_STATE_STORE, "readonly");
        const request = tx.objectStore(RULES_STATE_STORE).get(RULES_STATE_KEY);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  }

  async function readCachedRulesRecord(packageSha256) {
    if (!packageSha256) return null;
    const db = await openRulesDb();
    if (!db) return null;
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(RULES_PACKAGE_STORE, "readonly");
        const request = tx.objectStore(RULES_PACKAGE_STORE).get(packageSha256);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  }

  async function activateCachedRulesRecord(record) {
    const db = await openRulesDb();
    if (!db) return { activeHash: record.packageSha256, previousHash: null };
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction([RULES_PACKAGE_STORE, RULES_STATE_STORE], "readwrite");
        const packages = tx.objectStore(RULES_PACKAGE_STORE);
        const stateStore = tx.objectStore(RULES_STATE_STORE);
        const getState = stateStore.get(RULES_STATE_KEY);
        getState.onsuccess = () => {
          const previousState = getState.result ?? {};
          const nextState = {
            activeHash: record.packageSha256,
            previousHash: previousState.activeHash && previousState.activeHash !== record.packageSha256
              ? previousState.activeHash
              : previousState.previousHash ?? null,
            updatedAt: new Date().toISOString()
          };
          packages.put({ ...record, bytes: record.bytes instanceof Uint8Array ? record.bytes : new Uint8Array(record.bytes) });
          stateStore.put(nextState, RULES_STATE_KEY);
          tx.oncomplete = () => resolve(nextState);
          tx.onerror = () => reject(tx.error);
        };
        getState.onerror = () => reject(getState.error);
      });
    } finally {
      db.close();
    }
  }

  async function loadActiveCachedRules() {
    const state = await readRulesCacheState();
    if (!state?.activeHash) return null;
    const record = await readCachedRulesRecord(state.activeHash);
    if (!record?.bytes) return null;
    return {
      rules: parseRulesPackageBytes(record.bytes),
      manifest: record.manifest ?? null,
      packageSha256: record.packageSha256,
      source: "cache",
      checkedAt: record.savedAt ?? state.updatedAt ?? null,
      canRestore: Boolean(state.previousHash)
    };
  }

  async function restorePreviousCachedRules() {
    const db = await openRulesDb();
    if (!db) return null;
    let nextState = null;
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(RULES_STATE_STORE, "readwrite");
        const store = tx.objectStore(RULES_STATE_STORE);
        const request = store.get(RULES_STATE_KEY);
        request.onsuccess = () => {
          const current = request.result ?? {};
          if (!current.previousHash) { resolve(); return; }
          nextState = {
            activeHash: current.previousHash,
            previousHash: current.activeHash ?? null,
            updatedAt: new Date().toISOString()
          };
          store.put(nextState, RULES_STATE_KEY);
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
    if (!nextState?.activeHash) return null;
    const record = await readCachedRulesRecord(nextState.activeHash);
    if (!record?.bytes) return null;
    return {
      rules: parseRulesPackageBytes(record.bytes),
      manifest: record.manifest ?? null,
      packageSha256: record.packageSha256,
      source: "previous",
      checkedAt: new Date().toISOString(),
      canRestore: Boolean(nextState.previousHash)
    };
  }

  function renderBootstrapFailure(error) {
    console.error(error);
    const message = String(error?.message ?? error ?? "Неизвестная ошибка");
    document.body.innerHTML = `<main class="bootstrap-error"><h1>Конструктор не запущен</h1><p>${escapeBootstrapHtml(message)}</p><p>Проверьте подключение к интернету и перезагрузите страницу. Локальная версия может использовать встроенный резервный пакет правил.</p></main>`;
  }

  function escapeBootstrapHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

})();
