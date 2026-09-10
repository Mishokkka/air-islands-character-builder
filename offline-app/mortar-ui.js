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

  const MORTAR_BODY_TALENT = "Механическое Тело";
  const OPERATIONAL_PROTOCOLS = [
    "Combat Protocol",
    "Bulwark Protocol",
    "Reconnaissance Protocol",
    "Engineering Protocol",
    "Mobility Protocol"
  ];
  const OPERATIONAL_PROTOCOL_SET = new Set(OPERATIONAL_PROTOCOLS);
  const isMortarOnlyTalent = name => name === MORTAR_BODY_TALENT || OPERATIONAL_PROTOCOL_SET.has(name);

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
      .mortar-creation-card {
        margin-top: .75rem;
        padding: .85rem;
        border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
        border-radius: 8px;
        background: color-mix(in srgb, var(--paper-3) 78%, var(--paper-2));
      }
      .mortar-creation-card h3 { margin-top: 0; }
      .mortar-roll-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; }
      .mortar-roll { display: grid; grid-template-columns: 1fr auto; gap: .5rem; align-items: end; }
      .mortar-roll output {
        display: block;
        min-height: 2.2rem;
        padding: .45rem .6rem;
        border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
        border-radius: 5px;
        background: var(--paper-3);
        font-weight: 700;
      }
      .mortar-note { margin: .55rem 0 0; color: var(--muted); font-size: .88rem; line-height: 1.45; }
      .mortar-derived-summary { margin-top: .45rem; }

      .mortar-systems-section { display: grid; gap: .85rem; margin: .35rem 0 1.15rem; }
      .mortar-systems-header {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: .65rem 1rem;
        align-items: end;
        padding: .75rem .85rem;
        border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--border));
        border-radius: 7px;
        background: color-mix(in srgb, var(--paper-2) 72%, var(--paper-3));
      }
      .mortar-systems-header h3 { margin: 0; font-size: 1.06rem; }
      .mortar-systems-header p { margin: .2rem 0 0; color: var(--muted); font-size: .84rem; }
      .mortar-system-badges { display: flex; flex-wrap: wrap; gap: .35rem; justify-content: flex-end; }
      .mortar-system-badge,
      .mortar-fixed-badge,
      .mortar-protocol-rank {
        display: inline-flex;
        align-items: center;
        min-height: 24px;
        padding: .18rem .48rem;
        border: 1px solid color-mix(in srgb, currentColor 24%, transparent);
        border-radius: 999px;
        background: var(--paper-3);
        font-size: .76rem;
        font-weight: 700;
        white-space: nowrap;
      }
      .mortar-core-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; }
      .mortar-system-card {
        min-width: 0;
        padding: .75rem;
        border: 1px solid #c3bbad;
        border-radius: 7px;
        background: var(--paper-3);
      }
      .mortar-system-card > header {
        display: flex;
        justify-content: space-between;
        gap: .5rem 1rem;
        align-items: baseline;
        margin-bottom: .55rem;
      }
      .mortar-system-card > header h4 { margin: 0; font-size: .94rem; }
      .mortar-system-card > header span { color: var(--muted); font-size: .78rem; }
      .mortar-body-slot .selection-row,
      .mortar-recovery-slot .readonly-card {
        grid-template-columns: minmax(0, 1fr) auto;
        min-height: 46px;
        border-color: color-mix(in srgb, var(--accent) 32%, #c3bbad);
      }
      .mortar-body-slot .row-actions { display: none !important; }
      .mortar-body-slot .selection-row > strong { display: none; }
      .mortar-body-slot .catalog-hover,
      .mortar-recovery-slot .catalog-hover { font-weight: 700; }

      .mortar-recovery-track { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: .28rem; margin-top: .65rem; }
      .mortar-rank-step {
        min-width: 0;
        padding: .42rem .35rem;
        border: 1px solid #c3bbad;
        border-radius: 5px;
        background: var(--paper-2);
        text-align: center;
      }
      .mortar-rank-step strong { display: block; font-size: .78rem; }
      .mortar-rank-step small { display: block; margin-top: .12rem; color: var(--muted); font-size: .67rem; line-height: 1.2; }
      .mortar-rank-step.reached { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, var(--paper-3)); }
      .mortar-rank-step.current { outline: 2px solid color-mix(in srgb, var(--accent) 35%, transparent); outline-offset: 1px; }

      .mortar-attribute-budget {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: .45rem 1rem;
        align-items: center;
        padding: .65rem .75rem;
        border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
        border-radius: 6px;
        background: color-mix(in srgb, var(--accent) 7%, var(--paper-3));
      }
      .mortar-attribute-budget strong { font-size: .88rem; }
      .mortar-attribute-budget span { font-size: .84rem; }
      .mortar-attribute-budget small { grid-column: 1 / -1; color: var(--muted); line-height: 1.35; }
      .mortar-attribute-budget.is-unspent { border-color: var(--warning); background: color-mix(in srgb, var(--warning) 10%, var(--paper-3)); }

      .mortar-operational-panel {
        padding: .75rem;
        border: 1px solid #c3bbad;
        border-radius: 7px;
        background: var(--paper-3);
      }
      .mortar-operational-panel > header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .45rem 1rem; align-items: baseline; }
      .mortar-operational-panel h4 { margin: 0; font-size: .96rem; }
      .mortar-protocol-catalog { margin-top: .65rem; }
      .mortar-protocol-card {
        grid-template-columns: minmax(0, 1fr) auto auto;
        align-items: center;
        gap: .45rem;
        min-height: 48px;
      }
      .mortar-protocol-card .catalog-item-name { font-weight: 700; }
      .mortar-protocol-card.locked { opacity: .72; }
      .mortar-protocol-card.known { border-color: color-mix(in srgb, var(--accent) 52%, var(--border)); }

      #talentsPanel.mortar-mode > h2 { margin-bottom: .75rem; }
      #talentsPanel.mortar-mode #generalTalentCatalog,
      #talentsPanel.mortar-mode #generalTalents { margin-top: .4rem; }
      #talentsPanel.mortar-mode .mortar-general-help { margin-top: -.2rem; }

      @media (max-width: 900px) {
        .mortar-core-grid { grid-template-columns: 1fr; }
        .mortar-recovery-track { grid-template-columns: repeat(5, minmax(70px, 1fr)); overflow-x: auto; padding-bottom: .25rem; }
      }
      @media (max-width: 720px) {
        .mortar-roll-grid { grid-template-columns: 1fr; }
        .mortar-system-badges { justify-content: flex-start; }
        .mortar-attribute-budget { grid-template-columns: 1fr; }
        .mortar-attribute-budget small { grid-column: auto; }
      }
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
        <p class="mortar-note">D2 = 1 даёт стартовую Reputation 1 «Убийца», D2 = 2 не даёт её. Обязательный D66 фиксирует результат броска дефекта.</p>
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

  function recoveryTrackHtml() {
    const labels = [
      [1, "Overclock"],
      [2, "1-й Operational"],
      [3, "+1 Attribute"],
      [4, "+1 Attribute"],
      [5, "+1 Attribute · Redline"]
    ];
    return labels.map(([rank, label]) => `<div class="mortar-rank-step" data-mortar-rank="${rank}"><strong>Rank ${rank}</strong><small>${label}</small></div>`).join("");
  }

  function ensureSystemsSection() {
    const panel = document.getElementById("talentsPanel");
    const kinTalent = document.getElementById("kinTalent");
    const title = panel?.querySelector(":scope > h2");
    if (!panel || !kinTalent || !title) return null;

    let anchor = document.getElementById("mortarKinTalentAnchor");
    if (!anchor) {
      anchor = document.createElement("span");
      anchor.id = "mortarKinTalentAnchor";
      anchor.hidden = true;
      kinTalent.before(anchor);
    }

    let section = document.getElementById("mortarSystemsSection");
    if (!section) {
      section = document.createElement("section");
      section.id = "mortarSystemsSection";
      section.className = "mortar-systems-section";
      section.hidden = true;
      section.innerHTML = `
        <header class="mortar-systems-header">
          <div>
            <h3>Системы мортара</h3>
            <p>Механическое Тело, Recovery Protocol и Operational Protocols заменяют обычную связку расового таланта и Professional Path.</p>
          </div>
          <div id="mortarSystemBadges" class="mortar-system-badges"></div>
        </header>

        <div class="mortar-core-grid">
          <article class="mortar-system-card">
            <header><h4>Механическое Тело</h4><span>постоянная система</span></header>
            <div id="mortarBodySlot" class="mortar-body-slot"></div>
            <p class="mortar-note">Бесплатно, всегда активно и не имеет рангов. Наведите на название для полного текста правил корпуса, ремонта и OVERLOAD.</p>
          </article>

          <article class="mortar-system-card">
            <header><h4>Recovery Protocol</h4><span>основная система</span></header>
            <div id="mortarRecoverySlot" class="mortar-recovery-slot"></div>
            <div id="mortarRecoveryTrack" class="mortar-recovery-track">${recoveryTrackHtml()}</div>
          </article>
        </div>

        <div id="mortarAttributeBudget" class="mortar-attribute-budget"></div>

        <article class="mortar-operational-panel">
          <header>
            <h4>Operational Protocols</h4>
            <span id="mortarOperationalSummary" class="mortar-note"></span>
          </header>
          <p class="mortar-note">Первый Operational Protocol Rank 1 открывается бесплатно на Recovery Rank 2. Новые системы после этого можно открывать с Recovery Rank 3, когда предыдущая открытая система достигла Rank 3.</p>
          <div id="mortarProtocolCatalog" class="catalog-grid catalog-grid-three mortar-protocol-catalog" aria-label="Operational Protocols"></div>
        </article>`;
      title.after(section);
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
    const wrapper = document.getElementById("kinFocusWrap");
    const select = document.getElementById("kinFocus");
    const visible = kin === "human" && variant === "gvirl";
    if (wrapper) {
      wrapper.hidden = !visible;
      if (visible) wrapper.style.removeProperty("display");
      else wrapper.style.setProperty("display", "none", "important");
      wrapper.setAttribute("aria-hidden", visible ? "false" : "true");
    }
    if (select) select.disabled = !visible;
  }

  function syncLegacyTalentControls(active) {
    const panel = document.getElementById("talentsPanel");
    if (!panel) return;
    panel.classList.toggle("mortar-mode", active);
    const title = panel.querySelector(":scope > h2");
    if (title) title.textContent = active ? "Системы и таланты" : "Таланты";

    const kinHeading = heading(panel, "Расовый талант");
    const firstHeading = heading(panel, "Первый Professional Path");
    const ageHeading = heading(panel, "Возрастные очки талантов");
    const pathHeading = heading(panel, "Professional Path");
    const initial = document.getElementById("initialPath")?.closest("label");
    const paths = document.getElementById("paths");
    const pathHelp = pathHeading?.nextElementSibling?.matches(".panel-help") ? pathHeading.nextElementSibling : null;
    for (const element of [kinHeading, firstHeading, initial, ageHeading, document.getElementById("ageTalentSummary"), document.getElementById("ageTalentLedger"), document.getElementById("undoAgeTalent"), pathHeading, pathHelp, paths]) {
      setHidden(element, active);
    }

    const generalCatalog = document.getElementById("generalTalentCatalog");
    const generalHelp = generalCatalog?.previousElementSibling?.matches(".panel-help") ? generalCatalog.previousElementSibling : null;
    if (generalHelp) {
      generalHelp.classList.toggle("mortar-general-help", active);
      generalHelp.textContent = active
        ? "General Talents являются отдельной системой. Мортар не получает бесплатный General Talent при создании: они приобретаются только за доступный Base XP."
        : "Наведите на название, чтобы прочитать полное описание всех рангов. Нажмите «+», чтобы выбрать источник покупки.";
    }
  }

  function rowTalentName(row) {
    return row?.querySelector(".catalog-hover")?.textContent.trim() ?? "";
  }

  function tileTalentName(tile) {
    return tile?.querySelector(".catalog-item-name")?.textContent.trim() ?? "";
  }

  function prepareBodyRow(row) {
    row.classList.add("mortar-body-row");
    row.querySelector(".row-actions")?.setAttribute("hidden", "");
    row.querySelector(":scope > strong")?.setAttribute("hidden", "");
    if (!row.querySelector(".mortar-fixed-badge")) {
      const badge = document.createElement("span");
      badge.className = "mortar-fixed-badge";
      badge.textContent = "Всегда · Rank 1";
      row.append(badge);
    }
  }

  function moveMortarTalentEntries(active) {
    const generalCatalog = document.getElementById("generalTalentCatalog");
    const generalSelections = document.getElementById("generalTalents");
    const bodySlot = document.getElementById("mortarBodySlot");
    const protocolCatalog = document.getElementById("mortarProtocolCatalog");
    if (!generalCatalog || !generalSelections || !bodySlot || !protocolCatalog) return;

    const currentMarker = generalCatalog.firstElementChild;
    const rebuiltByApp = currentMarker !== catalogRenderMarker;
    if (rebuiltByApp) {
      bodySlot.replaceChildren();
      protocolCatalog.replaceChildren();
    }

    const tiles = [...generalCatalog.querySelectorAll(":scope > .catalog-item")];
    if (active) {
      for (const protocolName of OPERATIONAL_PROTOCOLS) {
        const tile = tiles.find(candidate => tileTalentName(candidate) === protocolName);
        if (!tile) continue;
        tile.hidden = false;
        tile.classList.add("mortar-protocol-card");
        protocolCatalog.append(tile);
      }
    }
    for (const tile of [...generalCatalog.querySelectorAll(":scope > .catalog-item")]) {
      if (isMortarOnlyTalent(tileTalentName(tile))) tile.remove();
    }

    for (const row of [...generalSelections.querySelectorAll(":scope > .selection-row")]) {
      const name = rowTalentName(row);
      if (name === MORTAR_BODY_TALENT) {
        if (active) {
          prepareBodyRow(row);
          bodySlot.replaceChildren(row);
        } else row.remove();
      } else if (OPERATIONAL_PROTOCOL_SET.has(name)) {
        row.remove();
      }
    }

    for (const placeholder of [...generalSelections.querySelectorAll(":scope > .readonly-card")]) placeholder.remove();
    const ordinaryRows = [...generalSelections.querySelectorAll(":scope > .selection-row")].filter(row => !isMortarOnlyTalent(rowTalentName(row)));
    if (active && !ordinaryRows.length) {
      const placeholder = document.createElement("div");
      placeholder.className = "readonly-card mortar-general-placeholder";
      placeholder.textContent = "General Talents за Base XP пока не выбраны.";
      generalSelections.append(placeholder);
    } else if (!active && !ordinaryRows.length) {
      const placeholder = document.createElement("div");
      placeholder.className = "readonly-card";
      placeholder.textContent = "Общие таланты не выбраны.";
      generalSelections.append(placeholder);
    }

    catalogRenderMarker = generalCatalog.firstElementChild;
  }

  function decorateProtocolCards() {
    const known = new Map((uiState.derived?.operationalProtocols ?? []).map(entry => [entry.name, Number(entry.rank) || 0]));
    for (const tile of document.querySelectorAll("#mortarProtocolCatalog .catalog-item")) {
      const name = tileTalentName(tile);
      const rank = known.get(name) ?? 0;
      let badge = tile.querySelector(".mortar-protocol-rank");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "mortar-protocol-rank";
        tile.querySelector(".catalog-actions")?.before(badge);
      }
      badge.textContent = rank ? `Rank ${rank}` : "Не открыт";
      tile.classList.toggle("known", rank > 0);
    }
  }

  function constrainProtocolControls() {
    const recoveryRank = Number(uiState.derived?.recoveryRank ?? 1);
    const known = Array.isArray(uiState.derived?.operationalProtocols) ? uiState.derived.operationalProtocols : [];
    const lastKnown = known.at(-1) ?? null;

    for (const tile of document.querySelectorAll("#mortarProtocolCatalog .catalog-item")) {
      const name = tileTalentName(tile);
      const current = Number(known.find(entry => entry.name === name)?.rank ?? 0);
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
      add.title = reason || (!current && !known.length ? "Выбрать первый Operational Protocol Rank 1 бесплатно." : "Добавить или повысить Operational Protocol.");
      tile.classList.toggle("locked", blocked && current < 5);
    }
  }

  function syncRecoveryPresentation() {
    const recoveryRank = Number(uiState.derived?.recoveryRank ?? 1);
    for (const step of document.querySelectorAll("#mortarRecoveryTrack [data-mortar-rank]")) {
      const rank = Number(step.dataset.mortarRank);
      step.classList.toggle("reached", rank <= recoveryRank);
      step.classList.toggle("current", rank === recoveryRank);
    }
    const recoverySlot = document.getElementById("mortarRecoverySlot");
    const recoveryCard = recoverySlot?.querySelector("#kinTalent");
    if (recoveryCard) recoveryCard.classList.add("mortar-recovery-row");
  }

  function syncMortarSummary() {
    const derived = uiState.derived;
    const badges = document.getElementById("mortarSystemBadges");
    const operationSummary = document.getElementById("mortarOperationalSummary");
    const budget = document.getElementById("mortarAttributeBudget");
    if (!badges || !operationSummary || !budget) return;

    const recoveryRank = Number(derived?.recoveryRank ?? 1);
    const operations = Array.isArray(derived?.operationalProtocols) ? derived.operationalProtocols : [];
    const bonus = Number(derived?.attributeBonusPoints ?? Math.max(0, recoveryRank - 2));
    const total = Number(derived?.attributePointsTotal ?? 13 + bonus);
    const spent = Number(derived?.attributePointsSpent ?? total - bonus);
    const remaining = total - spent;
    const maximum = Number(derived?.attributeMaximum ?? Math.min(8, 6 + bonus));
    const xpRemaining = Number(derived?.xpRemaining ?? 0);

    badges.innerHTML = `
      <span class="mortar-system-badge">Recovery R${recoveryRank}</span>
      <span class="mortar-system-badge">Operational ${operations.length}/5</span>
      <span class="mortar-system-badge">XP ${xpRemaining}</span>`;
    operationSummary.textContent = operations.length
      ? `Открыто ${operations.length} из 5 · ${operations.map(entry => `${entry.name.replace(" Protocol", "")} R${entry.rank}`).join(" · ")}`
      : "Operational Protocol ещё не открыт";
    budget.classList.toggle("is-unspent", remaining !== 0);
    budget.innerHTML = `
      <strong>Пул Attributes: 13 базовых${bonus ? ` + ${bonus} от Recovery` : ""} = ${total}</strong>
      <span>Распределено ${spent}/${total}${remaining > 0 ? ` · осталось ${remaining}` : remaining < 0 ? ` · превышение ${Math.abs(remaining)}` : ""}</span>
      <small>Recovery Ranks 3, 4 и 5 добавляют по 1 свободному очку Attribute. Текущий максимум одного Attribute: ${maximum}; абсолютный максимум после Recovery: 8.</small>`;
  }

  function syncAttributeBudget(active) {
    if (!active) return;
    const derived = uiState.derived;
    const summary = document.getElementById("attributeSummary");
    if (!summary) return;
    const bonus = Number(derived?.attributeBonusPoints ?? 0);
    const total = Number(derived?.attributePointsTotal ?? 13 + bonus);
    const spent = Number(derived?.attributePointsSpent ?? [...document.querySelectorAll("#attributes input[data-attribute]")].reduce((sum, input) => sum + (Number(input.value) || 0), 0));
    const remaining = total - spent;
    summary.textContent = `Распределено ${spent} из ${total}${bonus ? ` (13 базовых + ${bonus} от Recovery Protocol)` : ""}.${remaining > 0 ? ` Осталось: ${remaining}.` : remaining < 0 ? ` Превышение: ${Math.abs(remaining)}.` : ""}`;
    summary.classList.toggle("error", remaining !== 0);
  }

  function syncTalentSections(active) {
    const panel = document.getElementById("talentsPanel");
    const section = ensureSystemsSection();
    if (!panel || !section) return;
    const kinTalent = document.getElementById("kinTalent");
    const anchor = document.getElementById("mortarKinTalentAnchor");
    const recoverySlot = document.getElementById("mortarRecoverySlot");

    syncLegacyTalentControls(active);
    setHidden(section, !active);
    if (active) {
      if (kinTalent && recoverySlot && kinTalent.parentElement !== recoverySlot) recoverySlot.append(kinTalent);
    } else if (kinTalent && anchor && kinTalent.previousElementSibling !== anchor) {
      anchor.after(kinTalent);
    }

    moveMortarTalentEntries(active);
    if (active) {
      syncRecoveryPresentation();
      decorateProtocolCards();
      constrainProtocolControls();
      syncMortarSummary();
    }
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
      summary.textContent = "Итоговые Attributes будут показаны после проверки прогрессии.";
      return;
    }
    const a = derived.finalAttributes ?? {};
    const maxOverload = Number(a.wits ?? 0) * 2 + (Number(derived.recoveryRank) >= 5 ? 2 : 0);
    summary.textContent = `Итог: STR ${a.strength ?? 0}, AGI ${a.agility ?? 0}, WITS ${a.wits ?? 0}, EMP ${a.empathy ?? 0}. Recovery Rank ${derived.recoveryRank}. MAX OVERLOAD ${maxOverload}.`;
  }

  function syncSpells(active) {
    const panel = document.getElementById("spellsPanel");
    if (!panel) return;
    panel.classList.toggle("mortar-no-spells", active);
    if (active) {
      const summary = document.getElementById("spellSummary");
      if (summary) summary.textContent = "Мортар не имеет Professional Path и не получает стартовых заклинаний через конструктор.";
    }
  }

  function refresh() {
    const observing = Boolean(observer);
    if (observing) observer.disconnect();
    try {
      ensureStyle();
      const active = isMortar();
      syncGvirlFocus();
      syncRollCard(active);
      syncProfession(active);
      syncAge(active);
      syncTalentSections(active);
      syncSkills(active);
      syncAttributeBudget(active);
      syncDerived(active);
      syncSpells(active);
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
