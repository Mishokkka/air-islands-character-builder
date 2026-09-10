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

  const mortarOnlyTalent = name => [
    "Combat Protocol",
    "Bulwark Protocol",
    "Reconnaissance Protocol",
    "Engineering Protocol",
    "Mobility Protocol"
  ].includes(name) || /^Recovery Protocol Rank [345]: \+1 /u.test(name);

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
    setHidden(document.querySelector(".birth-date-row"), active);
    setHidden(document.getElementById("ageSummary"), active);
  }

  function syncTalentSections(active) {
    const panel = document.getElementById("talentsPanel");
    if (!panel) return;
    const initial = document.getElementById("initialPath")?.closest("label");
    const firstHeading = heading(panel, "Первый Professional Path");
    const ageHeading = heading(panel, "Возрастные очки талантов");
    const pathHeading = heading(panel, "Professional Path");
    const paths = document.getElementById("paths");
    const pathHelp = pathHeading?.nextElementSibling?.matches(".panel-help") ? pathHeading.nextElementSibling : null;
    for (const element of [firstHeading, initial, ageHeading, document.getElementById("ageTalentSummary"), document.getElementById("ageTalentLedger"), document.getElementById("undoAgeTalent"), pathHeading, pathHelp, paths]) setHidden(element, active);

    let note = document.getElementById("mortarTalentHelp");
    if (!note) {
      note = document.createElement("p");
      note.id = "mortarTalentHelp";
      note.className = "panel-help mortar-note";
      note.textContent = "Operational Protocols находятся в каталоге ниже. Первый Operational Protocol Rank 1 после Recovery Protocol Rank 2 бесплатный. На Recovery Protocol Ranks 3, 4 и 5 выберите соответствующий бесплатный пункт +1 Attribute.";
      const catalog = document.getElementById("generalTalentCatalog");
      catalog?.before(note);
    }
    setHidden(note, !active);

    for (const tile of panel.querySelectorAll("#generalTalentCatalog .catalog-item")) {
      const name = tile.querySelector(".catalog-item-name")?.textContent.trim() ?? "";
      if (mortarOnlyTalent(name)) setHidden(tile, !active);
    }
    for (const row of panel.querySelectorAll("#generalTalents .selection-row")) {
      const name = row.querySelector(".catalog-hover")?.textContent.trim() ?? "";
      if (mortarOnlyTalent(name)) setHidden(row, !active);
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
    ensureStyle();
    const active = isMortar();
    syncRollCard(active);
    syncProfession(active);
    syncAge(active);
    syncTalentSections(active);
    syncSkills(active);
    syncDerived(active);
    syncSpells(active);
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
    document.getElementById("resetDraft")?.addEventListener("click", () => setTimeout(queueRefresh, 0));
    new MutationObserver(queueRefresh).observe(document.body, { childList: true, subtree: true, characterData: true });
    queueRefresh();
  });
})();
