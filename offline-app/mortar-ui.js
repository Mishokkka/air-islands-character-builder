(() => {
  "use strict";

  const uiState = globalThis.AIR_ISLANDS_MORTAR_UI_STATE ??= {
    characterId: null,
    killerRoll: null,
    defectRoll: null,
    derived: null
  };
  let syncingProfession = false;
  let refreshQueued = false;
  let observer = null;
  let catalogRenderMarker = null;
  const observerOptions = { childList: true, subtree: true, characterData: true };

  const OPERATIONAL_PROTOCOLS = new Set([
    "Combat Protocol",
    "Bulwark Protocol",
    "Reconnaissance Protocol",
    "Engineering Protocol",
    "Mobility Protocol"
  ]);
  const CALIBRATION_PATTERN = /^Recovery Protocol Rank ([345]): \+1 /u;
  const mortarOnlyTalent = name => OPERATIONAL_PROTOCOLS.has(name) || CALIBRATION_PATTERN.test(name);

  const randomD6 = () => crypto.getRandomValues(new Uint32Array(1))[0] % 6 + 1;
  const isMortar = () => document.getElementById("kin")?.value === "mortar";

  function triggerBuilderRefresh() {
    const name = document.getElementById("name");
    name?.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function setHidden(element, hidden) {
    if (element && element.hidden !== hidden) element.hidden = hidden;
  }

  function heading(panel, text) {
    return [...(panel?.querySelectorAll("h3") ?? [])].find(node => node.textContent.trim() === text) ?? null;
  }

  function ensureStyle() {
    if (document.getElementById("mortar-builder-style")) return;
    const style = document.createElement("style");
    style.id = "mortar-builder-style";
    style.textContent = `
      .mortar-creation-card { margin-top: .75rem; padding: .85rem; border: 1px solid color-mix(in srgb, currentColor 22%, transparent); border-radius: 8px; }
      .mortar-creation-card h3 { margin-top: 0; }
      .mortar-roll-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; }
      .mortar-roll { display: grid; grid-template-columns: 1fr auto; gap: .5rem; align-items: end; }
      .mortar-roll output { display: block; min-height: 2.2rem; padding: .45rem .6rem; border: 1px solid color-mix(in srgb, currentColor 18%, transparent); border-radius: 5px; font-weight: 700; }
      .mortar-note { margin: .65rem 0 0; opacity: .82; }
      .mortar-derived-summary { margin-top: .45rem; }
      .mortar-protocol-section { margin: .35rem 0 1.2rem; }
      .mortar-protocol-section > h3 { margin-top: 1rem; }
      .mortar-body-talent { display: grid; gap: .45rem; }
      .mortar-body-title { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .5rem 1rem; align-items: baseline; }
      .mortar-body-title span { opacity: .72; font-size: .9em; }
      .mortar-body-talent p { margin: 0; opacity: .9; }
      .mortar-calibration-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .75rem; margin-top: .65rem; }
      .mortar-calibration-tier { min-width: 0; padding: .65rem; border: 1px solid color-mix(in srgb, currentColor 16%, transparent); border-radius: 7px; }
      .mortar-calibration-tier h4 { margin: 0 0 .55rem; }
      .mortar-calibration-tier .catalog-grid { grid-template-columns: 1fr; }
      .mortar-protocol-section .catalog-grid { margin-top: .55rem; }
      @media (max-width: 900px) { .mortar-calibration-grid { grid-template-columns: 1fr; } }
      @media (max-width: 720px) { .mortar-roll-grid { grid-template-columns: 1fr; } }
    `;
    document.head.append(style);
  }

  function ensureCreationCard() {
    const panel = document.getElementById("identityPanel");
    if (!panel) return null;
    let card = document.getElementById("mortarCreationCard");
    if (!card) {
      card = document.createElement("section");
      card.id = "mortarCreationCard";
      card.className = "mortar-creation-card";
      card.innerHTML = `
        <h3>Пробуждение мортара</h3>
        <div class="mortar-roll-grid">
          <div class="mortar-roll">
            <label>Reputation «Убийца»<output id="mortarKillerResult">Не бросалось</output></label>
            <button id="mortarKillerRoll" type="button">Бросить D2</button>
          </div>
          <div class="mortar-roll">
            <label>Дефект<output id="mortarDefectResult">Не бросалось</output></label>
            <button id="mortarDefectRoll" type="button">Бросить D66</button>
          </div>
        </div>
        <p class="mortar-note">D2 = 1 даёт стартовую Reputation 1 «Убийца», D2 = 2 не даёт её. Таблица эффектов дефектов в документе расы не приведена, поэтому конструктор фиксирует обязательный D66, а конкретный дефект определяется по отдельной таблице.</p>
        <p class="mortar-note">Стартовые запчасти: обычные 1D10, точные 1D8.</p>`;
      document.getElementById("ageSummary")?.after(card);
      card.querySelector("#mortarKillerRoll")?.addEventListener("click", () => {
        if (uiState.killerRoll) return;
        uiState.killerRoll = randomD6() <= 3 ? 1 : 2;
        refresh();
        triggerBuilderRefresh();
      });
      card.querySelector("#mortarDefectRoll")?.addEventListener("click", () => {
        if (uiState.defectRoll) return;
        uiState.defectRoll = randomD6() * 10 + randomD6();
        refresh();
        triggerBuilderRefresh();
      });
    }
    return card;
  }

  function ensureProtocolSection() {
    const panel = document.getElementById("talentsPanel");
    const kinTalent = document.getElementById("kinTalent");
    if (!panel || !kinTalent) return null;

    let anchor = document.getElementById("mortarKinTalentAnchor");
    if (!anchor) {
      anchor = document.createElement("span");
      anchor.id = "mortarKinTalentAnchor";
      anchor.hidden = true;
      kinTalent.before(anchor);
    }

    let section = document.getElementById("mortarProtocolSection");
    if (!section) {
      section = document.createElement("section");
      section.id = "mortarProtocolSection";
      section.className = "mortar-protocol-section";
      section.hidden = true;
      section.innerHTML = `
        <h3>Механическое Тело</h3>
        <div id="mortarBodyTalent" class="readonly-card mortar-body-talent">
          <div class="mortar-body-title"><strong>Механическое Тело</strong><span>Бесплатно · без рангов</span></div>
          <p>Постоянные свойства механического организма: не нужны пища, вода, сон и дыхание; иммунитет к болезням; Armor Rating корпуса 2; режущий Damage уменьшается на 1 до брони, но не ниже 1.</p>
          <p>REST, SLEEP и HEALING не восстанавливают физические повреждения мортара. Для восстановления используются REBOOT, MAINTENANCE и правила ремонта.</p>
        </div>

        <h3>Recovery Protocol</h3>
        <p class="panel-help mortar-note">Основной протокол мортара. Rank 1 получен при пробуждении. Повышения покупаются за Base XP; Ranks 3–5 требуют выбрать повышение Attribute.</p>
        <div id="mortarRecoverySlot"></div>

        <h3>Operational Protocols</h3>
        <p class="panel-help mortar-note">Первый Operational Protocol Rank 1 открывается на Recovery Protocol Rank 2 и выдаётся бесплатно. Следующий протокол можно открыть начиная с Recovery Rank 3, только после развития предыдущего Operational Protocol до Rank 3.</p>
        <div id="mortarProtocolCatalog" class="catalog-grid catalog-grid-three" aria-label="Operational Protocols"></div>

        <h3>Калибровка Recovery Protocol</h3>
        <p class="panel-help mortar-note">На Recovery Protocol Ranks 3, 4 и 5 выберите ровно один Attribute, который увеличится на 1. Каждый выбор бесплатный и не является отдельным талантом персонажа.</p>
        <div class="mortar-calibration-grid">
          <section class="mortar-calibration-tier"><h4>Recovery Rank 3 · +1 Attribute</h4><div id="mortarCalibrationRank3" class="catalog-grid"></div></section>
          <section class="mortar-calibration-tier"><h4>Recovery Rank 4 · +1 Attribute</h4><div id="mortarCalibrationRank4" class="catalog-grid"></div></section>
          <section class="mortar-calibration-tier"><h4>Recovery Rank 5 · +1 Attribute</h4><div id="mortarCalibrationRank5" class="catalog-grid"></div></section>
        </div>

        <h3>Выбранные Operational Protocols</h3>
        <div id="mortarProtocolSelections" class="selection-list"></div>`;
      anchor.after(section);
    }
    return section;
  }

  function syncRollCard(active) {
    const card = ensureCreationCard();
    if (!card) return;
    setHidden(card, !active);
    if (!active) return;
    const killer = card.querySelector("#mortarKillerResult");
    const defect = card.querySelector("#mortarDefectResult");
    const killerText = uiState.killerRoll === 1 ? "1 → Reputation 1 «Убийца»" : uiState.killerRoll === 2 ? "2 → без Reputation" : "Не бросалось";
    const defectText = uiState.defectRoll ? String(uiState.defectRoll) : "Не бросалось";
    if (killer.textContent !== killerText) killer.textContent = killerText;
    if (defect.textContent !== defectText) defect.textContent = defectText;
    card.querySelector("#mortarKillerRoll").disabled = Boolean(uiState.killerRoll);
    card.querySelector("#mortarDefectRoll").disabled = Boolean(uiState.defectRoll);
  }

  function syncProfession(active) {
    const select = document.getElementById("profession");
    const label = select?.closest("label");
    if (!select || !label || syncingProfession) return;
    if (active) {
      let empty = [...select.options].find(option => option.value === "");
      if (!empty) {
        empty = new Option("Нет (мортар)", "");
        select.prepend(empty);
      }
      if (select.value !== "") {
        syncingProfession = true;
        select.value = "";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        syncingProfession = false;
      }
      select.disabled = true;
      setHidden(label, true);
    } else {
      setHidden(label, false);
      select.disabled = false;
      const empty = [...select.options].find(option => option.value === "");
      if (select.value === "") {
        empty?.remove();
        const next = select.options[0]?.value;
        if (next) {
          syncingProfession = true;
          select.value = next;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          syncingProfession = false;
        }
      } else empty?.remove();
    }
  }

  function syncAge(active) {
    const row = document.querySelector(".birth-date-row");
    const yearLabel = document.getElementById("birthYearLabel");
    setHidden(row, false);
    setHidden(document.getElementById("ageSummary"), active);
    if (yearLabel) yearLabel.textContent = active ? "Год пробуждения" : "Год рождения";
    if (row) row.setAttribute("aria-label", active ? "Дата пробуждения" : "Дата рождения");
  }

  function syncGvirlFocus() {
    const kin = document.getElementById("kin")?.value;
    const variant = document.getElementById("kinVariant")?.value;
    setHidden(document.getElementById("kinFocusWrap"), !(kin === "human" && variant === "gvirl"));
  }

  function moveMortarCatalogEntries(active) {
    const generalCatalog = document.getElementById("generalTalentCatalog");
    const protocolCatalog = document.getElementById("mortarProtocolCatalog");
    const generalSelections = document.getElementById("generalTalents");
    const protocolSelections = document.getElementById("mortarProtocolSelections");
    if (!generalCatalog || !protocolCatalog || !generalSelections || !protocolSelections) return;

    const currentMarker = generalCatalog.firstElementChild;
    const rebuiltByApp = currentMarker !== catalogRenderMarker;
    if (rebuiltByApp) {
      protocolCatalog.replaceChildren();
      protocolSelections.replaceChildren();
      for (const tier of [3, 4, 5]) document.getElementById(`mortarCalibrationRank${tier}`)?.replaceChildren();
    }

    if (!active) {
      for (const tile of generalCatalog.querySelectorAll(".catalog-item")) {
        const name = tile.querySelector(".catalog-item-name")?.textContent.trim() ?? "";
        if (mortarOnlyTalent(name)) setHidden(tile, true);
      }
      for (const row of generalSelections.querySelectorAll(":scope > .selection-row")) {
        const name = row.querySelector(".catalog-hover")?.textContent.trim() ?? "";
        if (mortarOnlyTalent(name)) setHidden(row, true);
      }
      catalogRenderMarker = generalCatalog.firstElementChild;
      return;
    }

    for (const tile of [...generalCatalog.querySelectorAll(":scope > .catalog-item")]) {
      const name = tile.querySelector(".catalog-item-name")?.textContent.trim() ?? "";
      if (OPERATIONAL_PROTOCOLS.has(name)) {
        tile.hidden = false;
        protocolCatalog.append(tile);
        continue;
      }
      const tier = Number(name.match(CALIBRATION_PATTERN)?.[1] ?? 0);
      if (tier) {
        tile.hidden = false;
        document.getElementById(`mortarCalibrationRank${tier}`)?.append(tile);
      }
    }

    for (const row of [...generalSelections.querySelectorAll(":scope > .selection-row")]) {
      const name = row.querySelector(".catalog-hover")?.textContent.trim() ?? "";
      if (OPERATIONAL_PROTOCOLS.has(name)) protocolSelections.append(row);
    }

    for (const placeholder of [...generalSelections.querySelectorAll(":scope > .readonly-card")]) placeholder.remove();
    const ordinaryRows = generalSelections.querySelectorAll(":scope > .selection-row");
    if (!ordinaryRows.length) {
      const placeholder = document.createElement("div");
      placeholder.className = "readonly-card mortar-general-placeholder";
      placeholder.textContent = "Обычные General Talents не выбраны.";
      generalSelections.append(placeholder);
    }

    if (!protocolSelections.querySelector(".selection-row") && !protocolSelections.querySelector(".readonly-card")) {
      const placeholder = document.createElement("div");
      placeholder.className = "readonly-card";
      placeholder.textContent = "Operational Protocol пока не выбран.";
      protocolSelections.append(placeholder);
    }
    catalogRenderMarker = generalCatalog.firstElementChild;
  }

  function constrainProtocolControls() {
    const recoveryRank = Number(uiState.derived?.recoveryRank ?? 1);
    const known = Array.isArray(uiState.derived?.operationalProtocols) ? uiState.derived.operationalProtocols : [];
    const lastKnown = known.at(-1) ?? null;

    for (const tile of document.querySelectorAll("#mortarProtocolCatalog .catalog-item")) {
      const name = tile.querySelector(".catalog-item-name")?.textContent.trim() ?? "";
      const current = known.find(entry => entry.name === name)?.rank ?? 0;
      const add = tile.querySelector("[data-buy-xp]");
      if (!add) continue;
      let blocked = current >= 5;
      let reason = current >= 5 ? "Достигнут Rank 5." : "";
      if (!current && recoveryRank < 2) {
        blocked = true;
        reason = "Первый Operational Protocol открывается на Recovery Protocol Rank 2.";
      } else if (!current && known.length && (recoveryRank < 3 || Number(lastKnown?.rank ?? 0) < 3)) {
        blocked = true;
        reason = recoveryRank < 3
          ? "Дополнительные Operational Protocols открываются с Recovery Protocol Rank 3."
          : `Сначала развейте ${lastKnown?.name ?? "предыдущий Operational Protocol"} до Rank 3.`;
      }
      add.disabled = blocked;
      add.title = reason || (known.length ? "Повысить Operational Protocol." : "Выбрать первый Operational Protocol Rank 1 бесплатно.");
    }

    for (const tier of [3, 4, 5]) {
      const container = document.getElementById(`mortarCalibrationRank${tier}`);
      if (!container) continue;
      const tiles = [...container.querySelectorAll(".catalog-item")];
      const chosen = tiles.some(tile => tile.classList.contains("selected"));
      for (const tile of tiles) {
        const add = tile.querySelector("[data-buy-xp]");
        if (!add) continue;
        const selected = tile.classList.contains("selected");
        const blocked = recoveryRank < tier || chosen || selected;
        add.disabled = blocked;
        add.title = recoveryRank < tier
          ? `Выбор откроется на Recovery Protocol Rank ${tier}.`
          : chosen
            ? "Повышение Attribute для этого ранга Recovery Protocol уже выбрано."
            : `Бесплатно повысить выбранный Attribute на 1 за Recovery Protocol Rank ${tier}.`;
      }
    }
  }

  function syncTalentSections(active) {
    const panel = document.getElementById("talentsPanel");
    const section = ensureProtocolSection();
    if (!panel || !section) return;
    const kinTalent = document.getElementById("kinTalent");
    const anchor = document.getElementById("mortarKinTalentAnchor");
    const recoverySlot = document.getElementById("mortarRecoverySlot");
    const kinHeading = heading(panel, "Расовый талант");
    const initial = document.getElementById("initialPath")?.closest("label");
    const firstHeading = heading(panel, "Первый Professional Path");
    const ageHeading = heading(panel, "Возрастные очки талантов");
    const pathHeading = heading(panel, "Professional Path");
    const paths = document.getElementById("paths");
    const pathHelp = pathHeading?.nextElementSibling?.matches(".panel-help") ? pathHeading.nextElementSibling : null;

    setHidden(kinHeading, active);
    for (const element of [firstHeading, initial, ageHeading, document.getElementById("ageTalentSummary"), document.getElementById("ageTalentLedger"), document.getElementById("undoAgeTalent"), pathHeading, pathHelp, paths]) setHidden(element, active);
    setHidden(section, !active);

    if (active) {
      if (kinTalent && recoverySlot && kinTalent.parentElement !== recoverySlot) recoverySlot.append(kinTalent);
    } else if (kinTalent && anchor && kinTalent.previousElementSibling !== anchor) {
      anchor.after(kinTalent);
    }

    moveMortarCatalogEntries(active);
    if (active) constrainProtocolControls();
  }

  function syncSkills(active) {
    for (const input of document.querySelectorAll("#skillsBody input[data-skill]")) {
      input.max = active ? "2" : "4";
      if (active) input.title = "Стартовый максимум любого навыка мортара: 2.";
      else if (input.title === "Стартовый максимум любого навыка мортара: 2.") input.removeAttribute("title");
    }
  }

  function syncDerived(active) {
    const panel = document.getElementById("attributesPanel");
    if (!panel) return;
    let summary = document.getElementById("mortarDerivedSummary");
    if (!summary) {
      summary = document.createElement("div");
      summary.id = "mortarDerivedSummary";
      summary.className = "summary-line mortar-derived-summary";
      document.getElementById("attributeSummary")?.after(summary);
    }
    setHidden(summary, !active);
    if (!active) return;
    const derived = uiState.derived;
    if (!derived) {
      if (summary.textContent !== "Итоговые Attributes будут показаны после проверки прогрессии.") summary.textContent = "Итоговые Attributes будут показаны после проверки прогрессии.";
      return;
    }
    const a = derived.finalAttributes ?? {};
    const maxOverload = Number(a.wits ?? 0) * 2 + (Number(derived.recoveryRank) >= 5 ? 2 : 0);
    const text = `После Recovery Protocol: STR ${a.strength ?? 0}, AGI ${a.agility ?? 0}, WITS ${a.wits ?? 0}, EMP ${a.empathy ?? 0}. Recovery Rank ${derived.recoveryRank}. MAX OVERLOAD ${maxOverload}.`;
    if (summary.textContent !== text) summary.textContent = text;
  }

  function syncSpells(active) {
    const panel = document.getElementById("spellsPanel");
    if (!panel) return;
    panel.classList.toggle("mortar-no-spells", active);
    if (active) {
      const summary = document.getElementById("spellSummary");
      const text = "Мортар не имеет Professional Path и не получает стартовых заклинаний через конструктор.";
      if (summary && summary.textContent !== text) summary.textContent = text;
    }
  }

  function refresh() {
    const observing = Boolean(observer);
    if (observing) observer.disconnect();
    try {
      ensureStyle();
      const active = isMortar();
      syncRollCard(active);
      syncProfession(active);
      syncAge(active);
      syncTalentSections(active);
      syncSkills(active);
      syncDerived(active);
      syncSpells(active);
      syncGvirlFocus();
    } finally {
      if (observing) observer.observe(document.body, observerOptions);
    }
  }

  function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      refresh();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    ensureStyle();
    document.getElementById("kin")?.addEventListener("change", queueRefresh);
    document.getElementById("kinVariant")?.addEventListener("change", queueRefresh);
    document.getElementById("resetDraft")?.addEventListener("click", () => setTimeout(queueRefresh, 0));
    observer = new MutationObserver(queueRefresh);
    observer.observe(document.body, observerOptions);
    queueRefresh();
  });
})();
