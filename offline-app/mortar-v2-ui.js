(() => {
  "use strict";

  const COMMAND_PROTOCOL = "Command Protocol";
  const OPERATIONAL_TOTAL = 6;
  let refreshQueued = false;
  let observer = null;

  function ensureOverrides() {
    if (document.getElementById("mortar-v2-overrides")) return;
    const style = document.createElement("style");
    style.id = "mortar-v2-overrides";
    style.textContent = `
      #mortarCreationCard { display: none !important; }
      .wizard-steps { display: grid !important; grid-template-columns: 1fr !important; gap: .25rem !important; }
      .wizard-step, .wizard-step[hidden] { display: grid !important; visibility: visible !important; opacity: 1 !important; }
      #mortarSystemBadges,
      #mortarOperationalSummary { display: none !important; }
      .mortar-foundry-note {
        margin: .65rem 0 0;
        padding: .7rem .8rem;
        border: 1px solid color-mix(in srgb, var(--accent) 42%, var(--border));
        border-radius: 5px;
        background: color-mix(in srgb, var(--accent) 7%, var(--paper-3));
        font-size: .86rem;
        line-height: 1.45;
      }
      .mortar-foundry-note strong { display: block; margin-bottom: .2rem; }
    `;
    document.head.append(style);
  }

  function syncWizardSteps() {
    for (const button of document.querySelectorAll("#wizardSteps .wizard-step")) {
      button.hidden = false;
      button.removeAttribute("aria-hidden");
    }
  }

  function syncMortarPostCreationNotice() {
    const active = document.getElementById("kin")?.value === "mortar";
    let note = document.getElementById("mortarFoundryNote");
    if (!note) {
      note = document.createElement("div");
      note.id = "mortarFoundryNote";
      note.className = "mortar-foundry-note";
      note.innerHTML = `<strong>После создания персонажа</strong>Reputation «Убийца» не определяется в билдере. После импорта в Foundry выполняется обязательный D2: результат 1 даёт Reputation 1 «Убийца», результат 2 не даёт дополнительной Reputation. Затем выполняется обязательный D100 по таблице дефектов; результат не выбирается игроком.`;
      document.getElementById("ageSummary")?.after(note);
    }
    note.hidden = !active;

    const legacyCard = document.getElementById("mortarCreationCard");
    if (legacyCard) {
      legacyCard.hidden = true;
      legacyCard.setAttribute("aria-hidden", "true");
    }

    if (active) {
      const state = globalThis.AIR_ISLANDS_MORTAR_UI_STATE;
      if (state) {
        state.killerRoll = null;
        state.defectRoll = null;
      }
    }
  }

  function tileTalentName(tile) {
    return tile?.querySelector(".catalog-item-name")?.textContent.trim() ?? "";
  }

  function rowTalentName(row) {
    return row?.querySelector(".catalog-hover")?.textContent.trim() ?? "";
  }

  function syncCommandProtocol() {
    const active = document.getElementById("kin")?.value === "mortar";
    if (!active) return;

    const generalCatalog = document.getElementById("generalTalentCatalog");
    const protocolCatalog = document.getElementById("mortarProtocolCatalog");
    if (generalCatalog && protocolCatalog) {
      const commandTile = [...generalCatalog.querySelectorAll(":scope > .catalog-item")]
        .find(tile => tileTalentName(tile) === COMMAND_PROTOCOL);
      if (commandTile) {
        commandTile.hidden = false;
        commandTile.classList.add("mortar-protocol-card");
        protocolCatalog.append(commandTile);
      }
    }

    const generalSelections = document.getElementById("generalTalents");
    if (generalSelections) {
      for (const row of generalSelections.querySelectorAll(":scope > .selection-row")) {
        if (rowTalentName(row) === COMMAND_PROTOCOL) row.remove();
      }
    }
  }

  function ensureCorrectedSummaries() {
    const systemsHeader = document.querySelector("#mortarSystemsSection .mortar-systems-header");
    if (systemsHeader && !document.getElementById("mortarSystemBadgesV2")) {
      const badges = document.createElement("div");
      badges.id = "mortarSystemBadgesV2";
      badges.className = "mortar-system-badges";
      systemsHeader.append(badges);
    }

    const operationalHeader = document.querySelector("#mortarSystemsSection .mortar-operational-panel > header");
    if (operationalHeader && !document.getElementById("mortarOperationalSummaryV2")) {
      const summary = document.createElement("span");
      summary.id = "mortarOperationalSummaryV2";
      summary.className = "mortar-note";
      operationalHeader.append(summary);
    }
  }

  function syncCorrectedSummaries() {
    const active = document.getElementById("kin")?.value === "mortar";
    if (!active) return;
    ensureCorrectedSummaries();

    const derived = globalThis.AIR_ISLANDS_MORTAR_UI_STATE?.derived;
    if (!derived) return;
    const operations = Array.isArray(derived.operationalProtocols) ? derived.operationalProtocols : [];
    const badges = document.getElementById("mortarSystemBadgesV2");
    const summary = document.getElementById("mortarOperationalSummaryV2");
    if (badges) {
      badges.innerHTML = `
        <span class="mortar-system-badge">Recovery R${Number(derived.recoveryRank) || 1}</span>
        <span class="mortar-system-badge">Operational ${operations.length}/${OPERATIONAL_TOTAL}</span>
        <span class="mortar-system-badge">XP ${Number(derived.xpRemaining) || 0}</span>`;
    }
    if (summary) {
      summary.textContent = operations.length
        ? `Открыто ${operations.length} из ${OPERATIONAL_TOTAL} · ${operations.map(entry => `${entry.name.replace(" Protocol", "")} R${entry.rank}`).join(" · ")}`
        : "Operational Protocol ещё не открыт";
    }
  }

  function refresh() {
    const observing = Boolean(observer);
    if (observing) observer.disconnect();
    try {
      ensureOverrides();
      syncWizardSteps();
      syncMortarPostCreationNotice();
      syncCommandProtocol();
      syncCorrectedSummaries();
    } finally {
      if (observing) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
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

  function install() {
    refresh();
    document.getElementById("kin")?.addEventListener("change", queueRefresh);
    observer = new MutationObserver(queueRefresh);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
