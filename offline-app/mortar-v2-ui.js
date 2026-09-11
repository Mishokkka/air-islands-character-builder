(() => {
  "use strict";

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
      note.innerHTML = `<strong>После создания персонажа</strong>Reputation «Убийца» не определяется в билдере. После импорта в Foundry выполняется D2: результат 1 даёт +1 Reputation «Убийца». Дефект также определяется уже в Foundry броском D100 по таблице дефектов мортаров.`;
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

  function refresh() {
    ensureOverrides();
    syncWizardSteps();
    syncMortarPostCreationNotice();
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
    refresh();
    document.getElementById("kin")?.addEventListener("change", queueRefresh);
    observer = new MutationObserver(queueRefresh);
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
