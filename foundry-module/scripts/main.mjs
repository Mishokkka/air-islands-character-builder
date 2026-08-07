import { validateCharacter, characterToActorData, characterToQuickAccessBiographyProfile, normalizeReputationEntries } from "./core.mjs";
import { isZip, readZip, decodeText, createZip } from "./zip.mjs";
import { applyQuickAccessImport } from "./quick-access-bridge.mjs";

const MODULE_ID = "air-islands-character-importer";
const CONFIG_KEY = "campaign-config";
const cloneValue = value => typeof globalThis.structuredClone === "function" ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value));
let bundledRules = null;
let cachedRules = null;

function rootElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  return null;
}

function foundryGeneration() {
  const explicit = Number(game?.release?.generation);
  if (Number.isFinite(explicit)) return explicit;
  return Number.parseInt(String(game?.version ?? "13"), 10) || 13;
}

class ModuleToolsApplication extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-module-tools`,
    classes: ["aicb-module-tools-application"],
    tag: "div",
    window: { title: "Air Islands Character Importer" },
    position: { width: 520, height: "auto" }
  };

  async _renderHTML() {
    return `
      <div class="aicb-module-tools">
        <p>Управление импортом персонажей и пакетом правил конструктора.</p>
        <div class="aicb-module-tools-grid">
          <button type="button" data-aicb-tool="import"><i class="fa-solid fa-file-import"></i><span><strong>Импорт персонажа</strong><small>Проверить и импортировать файл .flchar.</small></span></button>
          <button type="button" data-aicb-tool="settings"><i class="fa-solid fa-sliders"></i><span><strong>Настройки конструктора</strong><small>Расы, профессии, Path, заклинания и ограничения кампании.</small></span></button>
          <button type="button" data-aicb-tool="export"><i class="fa-solid fa-file-export"></i><span><strong>Экспорт .flrules</strong><small>Собрать пакет правил из текущих настроек и компендиумов.</small></span></button>
        </div>
      </div>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const actions = { import: openImporter, settings: openCampaignSettings, export: exportRulesPackage };
    for (const button of this.element.querySelectorAll("[data-aicb-tool]")) {
      button.addEventListener("click", async () => {
        const action = actions[button.dataset.aicbTool];
        if (!action) return;
        button.disabled = true;
        try {
          await this.close();
          await action();
        } catch (error) {
          console.error(`${MODULE_ID} | module tool failed`, error);
          ui.notifications.error(`Не удалось выполнить действие: ${error.message}`);
        }
      });
    }
  }
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, CONFIG_KEY, {
    name: "Настройки конструктора персонажей",
    hint: "Параметры экспортируемого пакета правил Воздушных Островов.",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });
  game.settings.registerMenu(MODULE_ID, "module-tools", {
    name: "Инструменты конструктора персонажей",
    label: "Открыть инструменты",
    hint: "Импорт персонажей, настройка конструктора и экспорт пакета .flrules.",
    icon: "fa-solid fa-user-gear",
    type: ModuleToolsApplication,
    restricted: true
  });
  console.log(`${MODULE_ID} | init | Foundry generation ${foundryGeneration()}`);
});

Hooks.once("ready", () => {
  const module = game.modules.get(MODULE_ID);
  if (module) {
    module.api = {
      openImporter,
      openCampaignSettings,
      exportRulesPackage,
      loadRules,
      validate: async character => validateCharacter(character, await loadRules())
    };
  }
});

async function loadBundledRules() {
  if (bundledRules) return cloneValue(bundledRules);
  const response = await fetch(`modules/${MODULE_ID}/data/air-islands-rules.json`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Не удалось загрузить пакет правил: HTTP ${response.status}`);
  bundledRules = await response.json();
  return cloneValue(bundledRules);
}

async function loadRules({ refresh = false } = {}) {
  if (cachedRules && !refresh) return cachedRules;
  cachedRules = await buildRuntimeRules({ refreshCatalogs: true });
  return cachedRules;
}

function defaultConfig(rules) {
  const base = rules.builderSettings ?? {};
  return {
    configVersion: 2,
    campaignTitle: base.campaignTitle ?? "Воздушные Острова",
    introText: base.introText ?? "",
    campaignDate: cloneValue(rules.campaignDate),
    enabledKin: cloneValue(base.enabledKin ?? rules.kin.map(entry => entry.id)),
    enabledProfessions: cloneValue(base.enabledProfessions ?? rules.professions.map(entry => entry.id)),
    enabledPathCatalogIds: cloneValue(base.enabledPathCatalogIds ?? []),
    hiddenTalentCatalogIds: cloneValue(base.hiddenTalentCatalogIds ?? []),
    hiddenSpellDisciplines: cloneValue(base.hiddenSpellDisciplines ?? []),
    maximumBaseXp: base.maximumBaseXp ?? null,
    rumorCountMode: base.rumorCountMode ?? "party-size",
    requiredRumorCount: Number(base.requiredRumorCount ?? 0),
    requiredBiographyFields: cloneValue(base.requiredBiographyFields ?? []),
    allowedImageTypes: cloneValue(base.allowedImageTypes ?? ["image/png", "image/webp", "image/jpeg"]),
    maxAssetSizeMb: Number(base.maxAssetSizeMb ?? 12)
  };
}

async function currentConfig(rules = null) {
  const source = rules ?? await loadBundledRules();
  const defaults = defaultConfig(source);
  const stored = cloneValue(game.settings.get(MODULE_ID, CONFIG_KEY) ?? {});
  const storedDate = stored.campaignDate ?? {};
  const usesPreviousBundledDate = Number(storedDate.year) === 881
    && storedDate.month === "hladohod"
    && Number(storedDate.day) === 1;
  let migrated = false;
  if (usesPreviousBundledDate) {
    stored.campaignDate = cloneValue(defaults.campaignDate);
    migrated = true;
  }
  if (Number(stored.configVersion ?? 0) < 2) {
    const previousProfessionIds = defaults.enabledProfessions.filter(id => id !== "monster-hunter");
    if (Array.isArray(stored.enabledProfessions)
      && !stored.enabledProfessions.includes("monster-hunter")
      && previousProfessionIds.every(id => stored.enabledProfessions.includes(id))) {
      stored.enabledProfessions.push("monster-hunter");
    }
    if (Array.isArray(stored.enabledPathCatalogIds) && stored.enabledPathCatalogIds.length) {
      const monsterHunterPaths = source.catalogs.talents.items
        .filter(entry => entry.type === "profession" && entry.professions?.includes("monster-hunter"))
        .map(entry => entry.catalogId);
      for (const catalogId of monsterHunterPaths) {
        if (!stored.enabledPathCatalogIds.includes(catalogId)) stored.enabledPathCatalogIds.push(catalogId);
      }
    }
    stored.configVersion = 2;
    migrated = true;
  }
  if (migrated) await game.settings.set(MODULE_ID, CONFIG_KEY, stored);
  return {
    ...defaults,
    ...stored,
    campaignDate: { ...defaults.campaignDate, ...(stored.campaignDate ?? {}) }
  };
}

async function buildRuntimeRules({ refreshCatalogs = true } = {}) {
  const rules = await loadBundledRules();
  const config = await currentConfig(rules);
  rules.campaignDate = cloneValue(config.campaignDate);
  rules.builderSettings = {
    ...rules.builderSettings,
    campaignTitle: config.campaignTitle,
    introText: config.introText,
    enabledKin: config.enabledKin,
    enabledProfessions: config.enabledProfessions,
    enabledPathCatalogIds: config.enabledPathCatalogIds,
    hiddenTalentCatalogIds: config.hiddenTalentCatalogIds,
    hiddenSpellDisciplines: config.hiddenSpellDisciplines,
    maximumBaseXp: config.maximumBaseXp,
    rumorCountMode: config.rumorCountMode,
    requiredRumorCount: config.requiredRumorCount,
    requiredBiographyFields: config.requiredBiographyFields,
    allowedImageTypes: config.allowedImageTypes,
    maxAssetSizeMb: config.maxAssetSizeMb
  };
  if (refreshCatalogs) await refreshCatalogsFromWorld(rules);
  rules.generatedAt = new Date().toISOString();
  rules.packageHash = await hashRules(rules);
  return rules;
}

async function refreshCatalogsFromWorld(rules) {
  for (const key of ["talents", "spells"]) {
    const catalog = rules.catalogs?.[key];
    if (!catalog?.package) continue;
    const pack = game.packs.get(catalog.package);
    if (!pack) continue;
    let documents = [];
    try { documents = await pack.getDocuments(); }
    catch (error) {
      console.warn(`${MODULE_ID} | could not refresh ${catalog.package}`, error);
      continue;
    }
    const byId = new Map(documents.map(document => [document.id, document]));
    for (const entry of catalog.items) {
      const document = byId.get(entry.sourceId);
      if (!document) continue;
      const snapshot = cleanSnapshot(document.toObject());
      snapshot.name = entry.name;
      entry.snapshot = snapshot;
      entry.image = snapshot.img;
      entry.hash = await sha256(JSON.stringify(snapshot));
    }
  }
}

function cleanSnapshot(source) {
  const snapshot = cloneValue(source);
  for (const key of ["_id", "folder", "sort", "_stats", "ownership"]) delete snapshot[key];
  if (snapshot.flags) {
    delete snapshot.flags["scene-packer"];
    if (!Object.keys(snapshot.flags).length) delete snapshot.flags;
  }
  return snapshot;
}

async function hashRules(rules) {
  const payload = cloneValue(rules);
  delete payload.packageHash;
  delete payload.generatedAt;
  return sha256(JSON.stringify(payload));
}

async function sha256(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function openCampaignSettings() {
  if (!game.user.isGM) return ui.notifications.warn("Настройки доступны только ГМу.");
  const rules = await loadBundledRules();
  const config = await currentConfig(rules);
  const { DialogV2 } = foundry.applications.api;
  const disciplines = [...new Set(rules.catalogs.spells.items.map(entry => entry.discipline))].sort((a, b) => a.localeCompare(b, "ru"));
  const generalTalents = rules.catalogs.talents.items.filter(entry => entry.type === "general").sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const paths = rules.catalogs.talents.items.filter(entry => entry.type === "profession").sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const checked = (list, value, defaultWhenEmpty = false) => (list.includes(value) || (defaultWhenEmpty && !list.length)) ? "checked" : "";
  const content = `
    <div class="aicb-settings">
      <section><h3>Кампания</h3>
        <label>Название<input name="campaignTitle" value="${escapeHtml(config.campaignTitle)}"></label>
        <label>Вступление<textarea name="introText" rows="3">${escapeHtml(config.introText)}</textarea></label>
        <div class="aicb-settings-grid"><label>Год<input name="dateYear" type="number" value="${Number(config.campaignDate.year)}"></label><label>Трилуние<select name="dateMonth">${rules.calendar.months.map(month => `<option value="${month.id}" ${month.id === config.campaignDate.month ? "selected" : ""}>${escapeHtml(month.name)}</option>`).join("")}</select></label><label>День<input name="dateDay" type="number" min="1" max="${rules.calendar.daysPerMonth}" value="${Number(config.campaignDate.day)}"></label></div>
      </section>
      <section><h3>Ограничения</h3>
        <div class="aicb-settings-grid"><label>Максимум текущего Base XP<input name="maximumBaseXp" type="number" min="0" value="${config.maximumBaseXp ?? ""}" placeholder="Без лимита"></label><label>Слухи<select name="rumorCountMode"><option value="party-size" ${config.rumorCountMode === "party-size" ? "selected" : ""}>По числу других персонажей</option><option value="fixed" ${config.rumorCountMode === "fixed" ? "selected" : ""}>Фиксированное число</option></select></label><label>Фиксированное число<input name="requiredRumorCount" type="number" min="0" max="20" value="${config.requiredRumorCount}"></label><label>Макс. изображение, МБ<input name="maxAssetSizeMb" type="number" min="1" max="50" value="${config.maxAssetSizeMb}"></label></div>
      </section>
      <details open><summary>Доступные расы</summary><div class="aicb-check-grid">${rules.kin.map(entry => `<label><input type="checkbox" name="enabledKin" value="${entry.id}" ${checked(config.enabledKin, entry.id)}> ${escapeHtml(entry.name)}</label>`).join("")}</div></details>
      <details open><summary>Доступные профессии</summary><div class="aicb-check-grid">${rules.professions.map(entry => `<label><input type="checkbox" name="enabledProfessions" value="${entry.id}" ${checked(config.enabledProfessions, entry.id)}> ${escapeHtml(entry.name)}</label>`).join("")}</div></details>
      <details><summary>Доступные Professional Path</summary><div class="aicb-filter"><input type="search" data-filter-list="paths" placeholder="Поиск Path"></div><div class="aicb-check-list" data-filter-target="paths">${paths.map(entry => `<label><input type="checkbox" name="enabledPathCatalogIds" value="${entry.catalogId}" ${checked(config.enabledPathCatalogIds, entry.catalogId, true)}> ${escapeHtml(entry.name)}</label>`).join("")}</div></details>
      <details><summary>Скрытые General Talents</summary><div class="aicb-filter"><input type="search" data-filter-list="talents" placeholder="Поиск таланта"></div><div class="aicb-check-list" data-filter-target="talents">${generalTalents.map(entry => `<label><input type="checkbox" name="hiddenTalentCatalogIds" value="${entry.catalogId}" ${checked(config.hiddenTalentCatalogIds, entry.catalogId)}> ${escapeHtml(entry.name)}</label>`).join("")}</div></details>
      <details><summary>Скрытые школы магии</summary><div class="aicb-check-grid">${disciplines.map(value => `<label><input type="checkbox" name="hiddenSpellDisciplines" value="${escapeHtml(value)}" ${checked(config.hiddenSpellDisciplines, value)}> ${escapeHtml(value)}</label>`).join("")}</div></details>
      <details><summary>Обязательные поля биографии</summary><div class="aicb-check-grid">${Object.entries({concept:"Концепт",appearance:"Внешность",background:"Предыстория",family:"Семья",pride:"Гордость",darkSecret:"Тёмный секрет",motivation:"Мотивация",partyConnections:"Связь с группой"}).map(([value,label]) => `<label><input type="checkbox" name="requiredBiographyFields" value="${value}" ${checked(config.requiredBiographyFields, value)}> ${label}</label>`).join("")}</div></details>
      <details><summary>Форматы изображений</summary><div class="aicb-check-grid">${[["image/png","PNG"],["image/webp","WebP"],["image/jpeg","JPEG"]].map(([value,label]) => `<label><input type="checkbox" name="allowedImageTypes" value="${value}" ${checked(config.allowedImageTypes, value)}> ${label}</label>`).join("")}</div></details>
    </div>`;
  let saved;
  try {
    const dialogHeight = Math.max(520, Math.min(780, window.innerHeight - 80));
    const prompt = DialogV2.prompt({
      window: { title: "Настройки конструктора" }, content,
      ok: {
        label: "Сохранить", icon: "fa-solid fa-floppy-disk",
        callback: (_event, button) => readSettingsForm(button.form, rules)
      },
      rejectClose: false, modal: true, position: { width: 760, height: dialogHeight }
    });
    setTimeout(() => bindSettingsFilters(document.querySelector(".aicb-settings")?.closest(".application") ?? document), 0);
    saved = await prompt;
  } catch { return; }
  if (!saved) return;
  await game.settings.set(MODULE_ID, CONFIG_KEY, saved);
  cachedRules = null;
  ui.notifications.info("Настройки конструктора сохранены.");
}

function bindSettingsFilters(root) {
  const element = rootElement(root) ?? root;
  if (!element?.querySelectorAll) return;
  for (const input of element.querySelectorAll("[data-filter-list]")) {
    input.addEventListener("input", () => {
      const target = element.querySelector(`[data-filter-target="${CSS.escape(input.dataset.filterList)}"]`);
      const query = input.value.trim().toLocaleLowerCase("ru");
      for (const label of target?.querySelectorAll("label") ?? []) label.hidden = query && !label.textContent.toLocaleLowerCase("ru").includes(query);
    });
  }
}

function readSettingsForm(form, rules) {
  const data = new FormData(form);
  const list = name => data.getAll(name).map(String);
  const maxXpRaw = String(data.get("maximumBaseXp") ?? "").trim();
  const enabledPaths = list("enabledPathCatalogIds");
  const allPaths = rules.catalogs.talents.items.filter(entry => entry.type === "profession").map(entry => entry.catalogId);
  return {
    configVersion: 2,
    campaignTitle: String(data.get("campaignTitle") ?? "Воздушные Острова").trim(),
    introText: String(data.get("introText") ?? "").trim(),
    campaignDate: { year: Number(data.get("dateYear")), month: String(data.get("dateMonth")), day: Number(data.get("dateDay")), provisional: false },
    enabledKin: list("enabledKin"), enabledProfessions: list("enabledProfessions"),
    enabledPathCatalogIds: enabledPaths.length === allPaths.length ? [] : enabledPaths,
    hiddenTalentCatalogIds: list("hiddenTalentCatalogIds"), hiddenSpellDisciplines: list("hiddenSpellDisciplines"),
    maximumBaseXp: maxXpRaw === "" ? null : Math.max(0, Number(maxXpRaw)),
    rumorCountMode: String(data.get("rumorCountMode") ?? "party-size"),
    requiredRumorCount: Math.max(0, Number(data.get("requiredRumorCount") ?? 0)),
    requiredBiographyFields: list("requiredBiographyFields"),
    allowedImageTypes: list("allowedImageTypes"),
    maxAssetSizeMb: Math.max(1, Number(data.get("maxAssetSizeMb") ?? 12))
  };
}

export async function exportRulesPackage() {
  if (!game.user.isGM) return ui.notifications.warn("Экспорт правил доступен только ГМу.");
  try {
    const rules = await loadRules({ refresh: true });
    const manifest = {
      format: "air-islands-rules-package", packageVersion: 1, rules: "rules.json",
      rulesVersion: rules.rulesVersion, rulesHash: rules.packageHash, generatedAt: rules.generatedAt,
      foundryVersion: game.version, systemId: game.system.id, systemVersion: game.system.version
    };
    const bytes = createZip([
      { name: "manifest.json", data: `${JSON.stringify(manifest, null, 2)}\n` },
      { name: "rules.json", data: `${JSON.stringify(rules, null, 2)}\n` }
    ]);
    downloadBlob(new Blob([bytes], { type: "application/zip" }), `${slugify(rules.builderSettings?.campaignTitle || "air-islands")}-${rules.rulesVersion}.flrules`);
    ui.notifications.info("Пакет правил .flrules экспортирован.");
  } catch (error) {
    console.error(`${MODULE_ID} | rules export failed`, error);
    ui.notifications.error(`Не удалось экспортировать правила: ${error.message}`);
  }
}

async function renderActorSheet(actor) {
  const sheet = actor?.sheet;
  if (!sheet) return;
  if (foundryGeneration() >= 14) await sheet.render({ force: true });
  else sheet.render(true);
}

export async function openImporter() {
  if (!game.user.isGM) return ui.notifications.warn("Импорт персонажей доступен только ГМу.");
  const { DialogV2 } = foundry.applications.api;
  let selectedFile;
  try {
    selectedFile = await DialogV2.prompt({
      window: { title: "Импорт персонажа" },
      content: `<div class="aicb-file-dialog"><p>Выберите <code>.flchar</code>. Импортёр проверит правила, источники Items, изображения и совпадения с существующими Actor.</p><input type="file" name="characterFile" accept=".flchar,.json,application/json,application/zip" required></div>`,
      ok: { label: "Проверить", icon: "fa-solid fa-magnifying-glass", callback: (_event, button) => button.form.elements.characterFile.files?.[0] ?? null },
      rejectClose: false, modal: true
    });
  } catch { return; }
  if (!selectedFile) return;

  let packageData;
  try { packageData = await readCharacterFile(selectedFile); }
  catch (error) {
    console.error(`${MODULE_ID} | invalid character package`, error);
    return ui.notifications.error(`Не удалось прочитать персонажа: ${error.message}`);
  }

  const currentRules = await loadRules({ refresh: true });
  const rules = packageData.packageRules ?? currentRules;
  const validation = validateCharacter(packageData.character, rules);
  const preflight = await preflightCharacter(packageData, validation, rules, currentRules);
  const decision = await previewCharacter(packageData, validation, rules, preflight);
  if (!decision) return;
  if (!validation.valid) {
    const confirmed = await confirmForcedImport(validation, decision);
    if (!confirmed) return;
    decision.force = true;
  }
  if (decision.mode === "overwrite") {
    const confirmed = await confirmExistingActorOverwrite(decision.actor, packageData.character);
    if (!confirmed) return;
  }

  try {
    const actor = await importCharacterActor(packageData, rules, decision);
    const actionText = decision.mode === "create" ? `Персонаж «${actor.name}» создан.` : `Персонаж «${actor.name}» обновлён.`;
    if (decision.force) ui.notifications.warn(`${actionText} Принудительный импорт: ошибок ${validation.errors.length}.`);
    else ui.notifications.info(actionText);
    await renderActorSheet(actor);
  } catch (error) {
    console.error(`${MODULE_ID} | import failed`, error);
    ui.notifications.error(`Не удалось импортировать персонажа: ${error.message}`);
  }
}

async function readCharacterFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let character;
  let packageRules = null;
  const assets = new Map();
  let manifest = null;
  if (isZip(bytes)) {
    const entries = readZip(bytes);
    const characterBytes = entries.get("character.json");
    if (!characterBytes) throw new Error("В контейнере отсутствует character.json.");
    character = JSON.parse(decodeText(characterBytes));
    const manifestBytes = entries.get("manifest.json");
    if (manifestBytes) manifest = JSON.parse(decodeText(manifestBytes));
    const rulesPath = manifest?.rules ?? "rules.json";
    const rulesBytes = entries.get(rulesPath);
    if (rulesBytes) {
      packageRules = JSON.parse(decodeText(rulesBytes));
      if (packageRules?.format !== "air-islands-rules") throw new Error("В .flchar вложен неизвестный формат правил.");
      const actualRulesHash = await hashRules(packageRules);
      if (actualRulesHash !== packageRules.packageHash) throw new Error("Контрольная сумма вложенного пакета правил не совпадает.");
      if (character.rulesHash && character.rulesHash !== packageRules.packageHash) throw new Error("Персонаж и вложенный пакет правил относятся к разным версиям.");
    }
    for (const kind of ["portrait", "token"]) {
      const metadata = character.assets?.[kind];
      const path = metadata?.path ?? manifest?.assets?.[kind];
      if (!path) continue;
      const assetBytes = entries.get(path);
      if (!assetBytes) throw new Error(`В контейнере отсутствует файл ${path}.`);
      await verifyAsset(kind, metadata, assetBytes);
      assets.set(kind, { metadata: metadata ?? {}, bytes: assetBytes, path });
    }
  } else character = JSON.parse(decodeText(bytes));
  if (character?.format !== "air-islands-character") throw new Error("Неизвестный формат файла персонажа.");
  return { character, packageRules, assets, manifest, sourceName: file.name };
}

async function verifyAsset(kind, metadata, bytes) {
  if (metadata?.size && Number(metadata.size) !== bytes.length) throw new Error(`Размер файла ${kind} не совпадает с метаданными.`);
  if (!metadata?.sha256 || metadata.sha256.length !== 64 || !crypto.subtle?.digest) return;
  const actual = await sha256(bytes);
  if (actual !== metadata.sha256) throw new Error(`Контрольная сумма файла ${kind} не совпадает.`);
}

async function preflightCharacter(packageData, validation, rules, currentRules = rules) {
  const character = packageData.character;
  const duplicateById = character.characterId
    ? game.actors.find(actor => actor.getFlag(MODULE_ID, "characterId") === character.characterId || actor.getFlag(MODULE_ID, "profile")?.characterId === character.characterId)
    : null;
  const sameName = game.actors.filter(actor => actor.name === character.identity?.name && actor !== duplicateById);
  const existingActors = game.actors
    .filter(actor => actor.type === "character")
    .sort((left, right) => left.name.localeCompare(right.name, "ru", { sensitivity: "base" }));
  const catalog = new Map([
    ...rules.catalogs.talents.items.map(entry => [entry.catalogId, entry]),
    ...rules.catalogs.spells.items.map(entry => [entry.catalogId, entry])
  ]);
  const selected = [
    ...validation.derived.finalTalents.map(entry => entry.catalogId),
    ...validation.derived.finalSpells.map(entry => entry.catalogId)
  ];
  const items = [];
  for (const catalogId of selected) {
    const entry = catalog.get(catalogId);
    if (!entry) { items.push({ catalogId, name: catalogId, status: "missing-catalog" }); continue; }
    let document = null;
    try { document = await fromUuid(entry.sourceUuid); } catch { document = null; }
    if (!document) {
      items.push({ catalogId, name: entry.name, status: "snapshot", note: "Источник не найден; будет использован снимок из пакета правил." });
      continue;
    }
    const currentDescription = String(document.system?.description ?? "");
    const packageDescription = String(entry.snapshot?.system?.description ?? "");
    const changed = currentDescription !== packageDescription;
    items.push({ catalogId, name: entry.name, status: changed ? "changed" : "current", note: changed ? "Описание в текущем компендиуме отличается; будет использована текущая версия мира." : "Найдено в текущем компендиуме." });
  }
  const plannedAssetPath = `worlds/${game.world.id}/air-islands-character-assets/${slugify(character.identity?.name || "character")}-…`;
  return {
    rulesMatch: character.rulesHash === currentRules.packageHash,
    packageRulesUsed: Boolean(packageData.packageRules),
    duplicateById,
    sameName,
    existingActors,
    items,
    plannedAssetPath,
    snapshotCount: items.filter(entry => entry.status === "snapshot").length,
    changedCount: items.filter(entry => entry.status === "changed").length
  };
}

async function previewCharacter(packageData, validation, rules, preflight) {
  const { character, assets } = packageData;
  const { DialogV2 } = foundry.applications.api;
  const errors = renderIssues(validation.errors, "errors");
  const warnings = renderIssues(validation.warnings, "warnings");
  const month = rules.calendar.months.find(entry => entry.id === character.identity?.birthDate?.month)?.name ?? "?";
  const talentNames = validation.derived.finalTalents.map(entry => `${escapeHtml(rules.catalogs.talents.items.find(item => item.catalogId === entry.catalogId)?.name ?? entry.catalogId)} R${entry.rank}`).join("<br>");
  const spellNames = validation.derived.finalSpells.map(entry => escapeHtml(rules.catalogs.spells.items.find(item => item.catalogId === entry.catalogId)?.name ?? entry.catalogId)).join("<br>");
  const ledger = validation.derived.xpLedger.length ? `<ol>${validation.derived.xpLedger.map(entry => `<li>${escapeHtml(entry.label)}: <strong>${entry.cost} XP</strong></li>`).join("")}</ol>` : "<p>Покупок нет.</p>";
  const assetUrls = {};
  for (const [kind, asset] of assets) assetUrls[kind] = URL.createObjectURL(new Blob([asset.bytes], { type: asset.metadata.mimeType || "image/webp" }));
  const assetPreview = assets.size ? `<section class="aicb-assets-preview">${assetUrls.portrait ? `<figure><img src="${assetUrls.portrait}" alt="Портрет"><figcaption>Портрет</figcaption></figure>` : ""}${assetUrls.token ? `<figure class="token"><img src="${assetUrls.token}" alt="Токен"><figcaption>Токен</figcaption></figure>` : ""}</section>` : '<p class="aicb-no-assets">Изображения не вложены.</p>';
  const itemStatus = preflight.items.length ? `<table class="aicb-source-table"><thead><tr><th>Item</th><th>Статус</th></tr></thead><tbody>${preflight.items.map(entry => `<tr class="status-${entry.status}"><td>${escapeHtml(entry.name)}</td><td>${escapeHtml(entry.note ?? entry.status)}</td></tr>`).join("")}</tbody></table>` : "<p>Вложенных Items нет.</p>";
  const duplicateText = preflight.duplicateById
    ? `<p class="aicb-warning"><i class="fa-solid fa-rotate"></i> Найден ранее импортированный Actor: <strong>${escapeHtml(preflight.duplicateById.name)}</strong>. Его можно обновить без удаления вручную добавленных предметов.</p>`
    : preflight.sameName.length ? `<p class="aicb-warning">Найдены Actor с тем же именем: ${preflight.sameName.map(actor => escapeHtml(actor.name)).join(", ")}. Они не будут изменены без явного выбора.</p>` : "";
  const rulesState = preflight.rulesMatch
    ? '<span class="aicb-status-good">совпадает с текущими правилами мира</span>'
    : preflight.packageRulesUsed
      ? '<span class="aicb-status-warning">отличается; используются проверенные правила из .flchar</span>'
      : '<span class="aicb-status-warning">отличается от текущих правил мира</span>';
  const summary = `<div class="aicb-preview"><section class="aicb-summary"><h2>${escapeHtml(character.identity?.name ?? "Без имени")}</h2><dl><dt>Раса</dt><dd>${escapeHtml(rules.kin.find(entry => entry.id === character.identity?.kinId)?.name ?? "?")}</dd><dt>Профессия</dt><dd>${escapeHtml(rules.professions.find(entry => entry.id === character.identity?.professionId)?.name ?? "?")}</dd><dt>Возраст</dt><dd>${validation.derived.age ?? "?"}</dd><dt>Дата рождения</dt><dd>${character.identity?.birthDate?.day ?? "?"} ${escapeHtml(month)}, ${character.identity?.birthDate?.year ?? "?"} П.П.</dd><dt>Base XP</dt><dd>${character.experience?.baseTotal ?? 0} текущего → ${validation.derived.xpBudget} доступно; ${validation.derived.xpSpent} потрачено, ${validation.derived.xpRemaining} осталось</dd><dt>Правила</dt><dd>${rulesState}</dd><dt>Изображения</dt><dd>${assets.size ? `будут загружены в ${escapeHtml(preflight.plannedAssetPath)}` : "нет"}</dd></dl></section>${assetPreview}${duplicateText}<details open><summary><strong>Источники талантов и заклинаний</strong></summary>${itemStatus}</details><details><summary><strong>Таланты</strong></summary><p>${talentNames || "Нет"}</p></details><details><summary><strong>Заклинания</strong></summary><p>${spellNames || "Нет"}</p></details><details><summary><strong>Журнал Base XP</strong></summary>${ledger}</details>${errors}${warnings}</div>`;

  const actorOptions = preflight.existingActors.map(actor => {
    const folder = actor.folder?.name ? `${actor.folder.name} / ` : "";
    const selected = actor === preflight.duplicateById || (!preflight.duplicateById && actor === preflight.sameName[0]) ? "selected" : "";
    return `<option value="${escapeHtml(actor.id)}" ${selected}>${escapeHtml(folder + actor.name)}</option>`;
  }).join("");
  const actionOptions = [
    `<option value="create">Создать нового Actor</option>`,
    preflight.duplicateById ? `<option value="replace">Обновить ранее импортированного «${escapeHtml(preflight.duplicateById.name)}» и сохранить прочие предметы</option>` : "",
    preflight.existingActors.length ? `<option value="overwrite">Очистить и заменить выбранного существующего персонажа</option>` : ""
  ].join("");
  const targetSelector = preflight.existingActors.length ? `<div class="aicb-existing-target" data-aicb-existing-target hidden><label>Существующий персонаж<select name="targetActorId">${actorOptions}</select></label><p><i class="fa-solid fa-triangle-exclamation"></i> У выбранного Actor будут удалены все Items, Active Effects, старые системные данные и flags. Папка и права доступа сохранятся.</p></div>` : "";
  const invalidNotice = validation.valid ? "" : `<p class="aicb-force-notice"><i class="fa-solid fa-triangle-exclamation"></i> Найдено ошибок: <strong>${validation.errors.length}</strong>. Импорт доступен, но потребует отдельного подтверждения. Невоспроизводимые покупки и неизвестные Items будут пропущены.</p>`;
  const content = `<div class="aicb-import-dialog">${summary}${invalidNotice}<div class="aicb-import-action"><label>Действие<select name="mode">${actionOptions}</select></label>${targetSelector}</div></div>`;

  try {
    const dialogHeight = Math.max(420, Math.min(720, window.innerHeight - 96));
    const dialogWidth = Math.max(560, Math.min(860, window.innerWidth - 64));
    const prompt = DialogV2.prompt({
      window: { title: "Проверка персонажа" },
      content,
      ok: {
        label: validation.valid ? "Выполнить импорт" : "Продолжить к импорту",
        icon: "fa-solid fa-user-plus",
        callback: (_event, button) => {
          const mode = String(button.form.elements.mode.value);
          let actor = null;
          if (mode === "replace") actor = preflight.duplicateById;
          if (mode === "overwrite") actor = game.actors.get(String(button.form.elements.targetActorId?.value ?? ""));
          if (mode !== "create" && !actor) {
            ui.notifications.warn("Не удалось определить Actor для замены.");
            return null;
          }
          return { mode, actor, force: false };
        }
      },
      rejectClose: false,
      modal: true,
      position: { width: dialogWidth, height: dialogHeight }
    });
    setTimeout(() => {
      const dialogs = document.querySelectorAll(".aicb-import-dialog");
      const dialog = dialogs[dialogs.length - 1];
      const application = dialog?.closest(".application") ?? document;
      configureImportDialogLayout(application);
      bindImportAction(application);
    }, 0);
    return await prompt;
  } finally { for (const url of Object.values(assetUrls)) URL.revokeObjectURL(url); }
}

function configureImportDialogLayout(root) {
  const application = rootElement(root) ?? root;
  if (!application?.querySelector) return;
  application.classList?.add("aicb-import-application");

  const windowContent = application.querySelector(".window-content");
  const form = windowContent?.matches?.("form") ? windowContent : (windowContent?.querySelector("form") ?? application.querySelector("form"));
  const dialogContent = form?.querySelector(".dialog-content") ?? application.querySelector(".dialog-content");
  const footer = form?.querySelector(".form-footer, footer") ?? application.querySelector(".form-footer");
  const dialog = application.querySelector(".aicb-import-dialog");

  if (windowContent) {
    windowContent.style.minHeight = "0";
    windowContent.style.overflow = "hidden";
  }
  if (form) {
    form.style.display = "flex";
    form.style.flexDirection = "column";
    form.style.minHeight = "0";
    form.style.height = "100%";
    form.style.overflow = "hidden";
  }
  if (dialogContent) {
    dialogContent.style.flex = "1 1 auto";
    dialogContent.style.minHeight = "0";
    dialogContent.style.overflow = "hidden";
  }
  if (dialog) {
    dialog.style.minHeight = "0";
    dialog.style.height = "100%";
    dialog.style.overflowY = "auto";
    dialog.style.overflowX = "hidden";
  }
  if (footer) footer.style.flex = "0 0 auto";
}

function bindImportAction(root) {
  const element = rootElement(root) ?? root;
  const mode = element?.querySelector?.('.aicb-import-action select[name="mode"]');
  const target = element?.querySelector?.("[data-aicb-existing-target]");
  if (!mode || !target) return;
  const update = () => {
    const enabled = mode.value === "overwrite";
    target.hidden = !enabled;
    const select = target.querySelector('select[name="targetActorId"]');
    if (select) select.disabled = !enabled;
  };
  mode.addEventListener("change", update);
  update();
}

async function confirmForcedImport(validation, decision) {
  const { DialogV2 } = foundry.applications.api;
  const target = decision.mode !== "create" && decision.actor
    ? `существующий Actor «${escapeHtml(decision.actor.name)}» будет ${decision.mode === "overwrite" ? "полностью очищен и заменён" : "обновлён"}`
    : "будет создан новый Actor";
  const examples = validation.errors.slice(0, 8).map(issue => `<li><strong>${escapeHtml(issue.code)}</strong>: ${escapeHtml(issue.message)}</li>`).join("");
  const remaining = Math.max(0, validation.errors.length - 8);
  return DialogV2.confirm({
    window: { title: "Принудительный импорт" },
    content: `<div class="aicb-force-confirm"><p><strong>Персонаж не прошёл проверку.</strong> При продолжении ${target}.</p><p>Импортёр перенесёт исходные характеристики и все корректно воспроизводимые навыки, таланты и заклинания. Ошибочные операции, неизвестные записи и недоступные Items могут быть пропущены.</p><ul>${examples}</ul>${remaining ? `<p>И ещё ошибок: ${remaining}.</p>` : ""}<p>Полный отчёт будет сохранён во flags Actor.</p></div>`,
    yes: { label: "Импортировать несмотря на ошибки", icon: "fa-solid fa-triangle-exclamation" },
    no: { label: "Отмена", icon: "fa-solid fa-xmark" },
    rejectClose: false, modal: true, position: { width: 640 }
  });
}


async function confirmExistingActorOverwrite(actor, character) {
  if (!actor) return false;
  const { DialogV2 } = foundry.applications.api;
  const incomingName = String(character.identity?.name ?? "Без имени");
  return DialogV2.confirm({
    window: { title: "Очистить существующего персонажа" },
    content: `<div class="aicb-overwrite-confirm"><p><strong>Actor «${escapeHtml(actor.name)}» будет полностью очищен.</strong></p><p>Будут удалены все его Items и Active Effects, а системные данные, изображение, прототип токена и flags будут заменены данными персонажа «${escapeHtml(incomingName)}».</p><p>Папка Actor и права доступа сохранятся. Это действие нельзя отменить средствами импортёра.</p></div>`,
    yes: { label: "Очистить и заменить", icon: "fa-solid fa-eraser" },
    no: { label: "Отмена", icon: "fa-solid fa-xmark" },
    rejectClose: false,
    modal: true,
    position: { width: 620 }
  });
}

async function importCharacterActor(packageData, rules, decision) {
  const { character, assets } = packageData;
  const { actorData, items, validation } = characterToActorData(character, rules, { foundryGeneration: foundryGeneration(), allowInvalid: decision.force === true });
  const uploaded = await uploadCharacterAssets(character, assets);
  if (uploaded.portrait) actorData.img = uploaded.portrait;
  if (uploaded.token || uploaded.portrait) actorData.prototypeToken.texture.src = uploaded.token || uploaded.portrait;
  actorData.flags[MODULE_ID].assets = uploaded;
  actorData.flags[MODULE_ID].characterId = character.characterId ?? null;
  tagImportedItems(items, validation);

  let actor;
  if (decision.mode === "overwrite" && decision.actor) {
    actor = await overwriteExistingActor(decision.actor, actorData, items);
  } else if (decision.mode === "replace" && decision.actor) {
    actor = decision.actor;
    await actor.update(actorData);
    const managed = actor.items.filter(item => item.getFlag(MODULE_ID, "catalogId"));
    if (managed.length) await actor.deleteEmbeddedDocuments("Item", managed.map(item => item.id));
    if (items.length) await actor.createEmbeddedDocuments("Item", items);
  } else {
    actor = await Actor.implementation.create(actorData);
    if (!actor) throw new Error("Foundry не создал Actor.");
    try {
      if (items.length) await actor.createEmbeddedDocuments("Item", items);
    } catch (error) {
      await actor.delete().catch(() => undefined);
      throw error;
    }
  }

  await applyQuickAccessIntegration(actor, character, rules);
  return actor;
}

async function applyQuickAccessIntegration(actor, character, rules) {
  if (!actor) return;

  const reputationEntries = normalizeReputationEntries(character.reputation).map((entry, position) => ({
    id: entry.id || `rep-${position + 1}`,
    amount: entry.amount,
    description: entry.description,
    location: entry.location
  }));
  const kinCatalogId = rules.kin?.find(entry => entry.id === character.identity?.kinId)?.talentCatalogId ?? null;
  const professionalCatalogId = character.creation?.initialPathCatalogId ?? null;
  const importedItems = [...(actor.items ?? [])];
  const findImportedItem = catalogId => importedItems.find(item => item.getFlag?.(MODULE_ID, "catalogId") === catalogId);
  const kinTalent = findImportedItem(kinCatalogId);
  const professionalTalent = findImportedItem(professionalCatalogId);
  const selection = {
    kinTalentId: kinTalent?.id ?? null,
    professionalTalentId: professionalTalent?.id ?? null
  };
  const biographyProfile = characterToQuickAccessBiographyProfile(character, rules);

  const quickAccess = game.modules.get("fbl-quick-access")?.api;
  await applyQuickAccessImport({
    actor,
    quickAccess,
    reputationEntries,
    selection,
    biographyProfile
  });
}

async function overwriteExistingActor(actor, actorData, items) {
  const backup = actorCoreSnapshot(actor);
  const oldItemIds = actor.items.map(item => item.id);
  const oldEffectIds = actor.effects.map(effect => effect.id);
  let createdItems = [];
  try {
    await actor.update(buildFullReplacementUpdate(actor, actorData));
    if (items.length) createdItems = await actor.createEmbeddedDocuments("Item", items);
    if (oldItemIds.length) await actor.deleteEmbeddedDocuments("Item", oldItemIds);
    if (oldEffectIds.length) await actor.deleteEmbeddedDocuments("ActiveEffect", oldEffectIds);
    return actor;
  } catch (error) {
    if (createdItems.length) {
      await actor.deleteEmbeddedDocuments("Item", createdItems.map(item => item.id)).catch(() => undefined);
    }
    await actor.update(buildFullReplacementUpdate(actor, backup, { restorePrototypeToken: true })).catch(rollbackError => {
      console.error(`${MODULE_ID} | overwrite rollback failed`, rollbackError);
    });
    throw error;
  }
}

function actorCoreSnapshot(actor) {
  const source = actor.toObject();
  return {
    name: source.name,
    type: source.type,
    img: source.img,
    system: cloneValue(source.system ?? {}),
    flags: cloneValue(source.flags ?? {}),
    prototypeToken: cloneValue(source.prototypeToken ?? {})
  };
}

function buildFullReplacementUpdate(actor, actorData, { restorePrototypeToken = false } = {}) {
  const current = actorCoreSnapshot(actor);
  const desired = {
    name: actorData.name,
    type: actorData.type,
    img: actorData.img,
    system: cloneValue(actorData.system ?? {}),
    flags: cloneValue(actorData.flags ?? {})
  };
  const update = flattenUpdateObject(desired);
  collectDeletionUpdates(current.system, desired.system, "system", update);
  collectDeletionUpdates(current.flags, desired.flags, "flags", update);

  // PrototypeToken is a strict DataModel. Deleting fields omitted by the
  // portable character format turns required schema values into undefined
  // on Foundry V13 (and can do the same for generation-specific fields on
  // V14). Submit one complete, schema-safe token source instead.
  update.prototypeToken = restorePrototypeToken
    ? stripUndefinedDeep(cloneValue(actorData.prototypeToken ?? current.prototypeToken ?? {}))
    : buildCleanPrototypeToken(current.prototypeToken, actorData.prototypeToken);
  return update;
}

function buildCleanPrototypeToken(currentToken, incomingToken) {
  const current = cloneValue(currentToken ?? {});
  const incoming = cloneValue(incomingToken ?? {});
  const currentTexture = cloneValue(current.texture ?? {});
  const incomingTexture = cloneValue(incoming.texture ?? {});
  const generation = foundryGeneration();

  const texture = {
    ...currentTexture,
    src: incomingTexture.src ?? currentTexture.src ?? "systems/forbidden-lands/assets/fbl-character.webp",
    anchorX: Number.isFinite(Number(incomingTexture.anchorX)) ? Number(incomingTexture.anchorX) : 0.5,
    anchorY: Number.isFinite(Number(incomingTexture.anchorY)) ? Number(incomingTexture.anchorY) : 0.5,
    fit: incomingTexture.fit ?? "contain",
    scaleX: Number.isFinite(Number(incomingTexture.scaleX)) ? Number(incomingTexture.scaleX) : 1,
    scaleY: Number.isFinite(Number(incomingTexture.scaleY)) ? Number(incomingTexture.scaleY) : 1,
    tint: incomingTexture.tint ?? "#ffffff",
    alphaThreshold: Number.isFinite(Number(incomingTexture.alphaThreshold)) ? Number(incomingTexture.alphaThreshold) : 0.75
  };
  if (generation < 14) {
    texture.offsetX = 0;
    texture.offsetY = 0;
    texture.rotation = 0;
  } else {
    delete texture.offsetX;
    delete texture.offsetY;
    delete texture.rotation;
  }

  const token = {
    ...current,
    ...incoming,
    name: incoming.name ?? current.name ?? "",
    displayName: Number.isFinite(Number(incoming.displayName)) ? Number(incoming.displayName) : 20,
    actorLink: incoming.actorLink ?? true,
    width: Number.isFinite(Number(incoming.width)) ? Number(incoming.width) : 1,
    height: Number.isFinite(Number(incoming.height)) ? Number(incoming.height) : 1,
    texture,
    lockRotation: incoming.lockRotation ?? true,
    rotation: Number.isFinite(Number(incoming.rotation)) ? Number(incoming.rotation) : 0,
    alpha: Number.isFinite(Number(incoming.alpha)) ? Number(incoming.alpha) : 1,
    disposition: Number.isFinite(Number(incoming.disposition)) ? Number(incoming.disposition) : 1,
    displayBars: Number.isFinite(Number(incoming.displayBars)) ? Number(incoming.displayBars) : 0,
    bar1: { attribute: incoming.bar1?.attribute ?? "attribute.strength" },
    bar2: { attribute: incoming.bar2?.attribute ?? "bio.willpower" },
    light: resetTokenLight(current.light),
    sight: resetTokenSight(current.sight),
    detectionModes: [],
    occludable: { ...(cloneValue(current.occludable ?? {})), radius: 0 },
    ring: resetTokenRing(current.ring),
    turnMarker: resetTurnMarker(current.turnMarker),
    movementAction: null,
    flags: {},
    randomImg: false,
    appendNumber: false,
    prependAdjective: false
  };
  return stripUndefinedDeep(token);
}

function resetTokenLight(currentLight) {
  return {
    ...(cloneValue(currentLight ?? {})),
    negative: false,
    priority: 0,
    alpha: 0.5,
    angle: 360,
    bright: 0,
    color: null,
    coloration: 1,
    dim: 0,
    attenuation: 0.5,
    luminosity: 0.5,
    saturation: 0,
    contrast: 0,
    shadows: 0,
    animation: { ...(cloneValue(currentLight?.animation ?? {})), type: null, speed: 5, intensity: 5, reverse: false },
    darkness: { ...(cloneValue(currentLight?.darkness ?? {})), min: 0, max: 1 }
  };
}

function resetTokenSight(currentSight) {
  return {
    ...(cloneValue(currentSight ?? {})),
    enabled: false,
    range: 0,
    angle: 360,
    visionMode: "basic",
    color: null,
    attenuation: 0.1,
    brightness: 0,
    saturation: 0,
    contrast: 0
  };
}

function resetTokenRing(currentRing) {
  return {
    ...(cloneValue(currentRing ?? {})),
    enabled: false,
    colors: { ...(cloneValue(currentRing?.colors ?? {})), ring: null, background: null },
    effects: 1,
    subject: { ...(cloneValue(currentRing?.subject ?? {})), scale: 1, texture: null }
  };
}

function resetTurnMarker(currentTurnMarker) {
  return {
    ...(cloneValue(currentTurnMarker ?? {})),
    mode: 1,
    animation: null,
    src: null,
    disposition: false
  };
}

function stripUndefinedDeep(value) {
  if (Array.isArray(value)) return value.map(stripUndefinedDeep).filter(entry => entry !== undefined);
  if (!isPlainObject(value)) return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (child === undefined) continue;
    result[key] = stripUndefinedDeep(child);
  }
  return result;
}

function flattenUpdateObject(value, prefix = "", result = {}) {
  if (!isPlainObject(value)) {
    if (prefix) result[prefix] = cloneValue(value);
    return result;
  }
  const entries = Object.entries(value);
  if (!entries.length && prefix) {
    result[prefix] = {};
    return result;
  }
  for (const [key, child] of entries) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(child)) flattenUpdateObject(child, path, result);
    else result[path] = cloneValue(child);
  }
  return result;
}

function collectDeletionUpdates(current, desired, prefix, result) {
  if (!isPlainObject(current)) return;
  const desiredObject = isPlainObject(desired) ? desired : {};
  for (const [key, child] of Object.entries(current)) {
    if (!Object.hasOwn(desiredObject, key)) {
      result[`${prefix}.-=${key}`] = null;
      continue;
    }
    if (isPlainObject(child) && isPlainObject(desiredObject[key])) {
      collectDeletionUpdates(child, desiredObject[key], `${prefix}.${key}`, result);
    }
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function tagImportedItems(items, validation) {
  const ids = [
    ...validation.derived.finalTalents.map(entry => ({ catalogId: entry.catalogId, kind: "talent" })),
    ...validation.derived.finalSpells.map(entry => ({ catalogId: entry.catalogId, kind: "spell" }))
  ];
  items.forEach((item, position) => {
    item.flags ??= {};
    item.flags[MODULE_ID] = { catalogId: ids[position]?.catalogId ?? null, kind: ids[position]?.kind ?? null };
  });
}

async function uploadCharacterAssets(character, assets) {
  if (!assets.size) return {};
  const FilePickerBase = foundry.applications.apps.FilePicker;
  const FilePickerClass = FilePickerBase.implementation ?? FilePickerBase;
  const basePath = `worlds/${game.world.id}/air-islands-character-assets`;
  await ensureDirectory(FilePickerClass, basePath);
  const characterPath = `${basePath}/${slugify(character.identity?.name || "character")}-${Date.now().toString(36)}`;
  await FilePickerClass.createDirectory("data", characterPath);
  const uploaded = {};
  for (const kind of ["portrait", "token"]) {
    const asset = assets.get(kind);
    if (!asset) continue;
    const metadata = asset.metadata ?? {};
    const extension = metadata.mimeType === "image/png" ? "png" : metadata.mimeType === "image/jpeg" ? "jpg" : "webp";
    const filename = `${kind}.${extension}`;
    const file = new File([asset.bytes], filename, { type: metadata.mimeType || "image/webp" });
    const response = await FilePickerClass.upload("data", characterPath, file, { overwrite: true }, { notify: false });
    uploaded[kind] = response.path ?? `${characterPath}/${filename}`;
  }
  return uploaded;
}

async function ensureDirectory(FilePickerClass, path) {
  try { await FilePickerClass.browse("data", path); }
  catch { await FilePickerClass.createDirectory("data", path); }
}

function renderIssues(issues, type) {
  if (!issues?.length) return "";
  const title = type === "errors" ? "Ошибки" : "Предупреждения";
  return `<section class="aicb-issues aicb-${type}"><h3>${title}</h3><ul>${issues.map(issue => `<li><strong>${escapeHtml(issue.code)}</strong>: ${escapeHtml(issue.message)}</li>`).join("")}</ul></section>`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slugify(value) {
  return String(value).normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "character";
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
