globalThis.AirIslandsEditorUI = /* @__PURE__ */ (() => {
  const $ = (id) => document.getElementById(id);
  const copy = (value) => typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  const clone = (value) => value?.character ? { character: copy(value.character), files: { ...value.files } } : copy(value);
  function createHistory(initial) {
    let entries = [clone(initial)], position = 0, group = "", timestamp = 0;
    return {
      record(value, key = "") {
        if (JSON.stringify(value) === JSON.stringify(entries[position])) return;
        entries.splice(position + 1);
        if (key && key === group && Date.now() - timestamp < 900 && position > 0) entries[position] = clone(value);
        else {
          entries.push(clone(value));
          position++;
        }
        if (entries.length > 60) {
          entries.shift();
          position--;
        }
        group = key;
        timestamp = Date.now();
      },
      undo() {
        group = "";
        return position > 0 ? clone(entries[--position]) : null;
      },
      redo() {
        group = "";
        return position < entries.length - 1 ? clone(entries[++position]) : null;
      },
      reset(value) {
        entries = [clone(value)];
        position = 0;
        group = "";
      },
      get canUndo() {
        return position > 0;
      },
      get canRedo() {
        return position < entries.length - 1;
      }
    };
  }
  function create({ navigate, undo, redo, catalog, spellCatalog }) {
    let detailId = null, detailType = null, returnTarget = null;
    const drawer = $("catalogDetail");
    const dialog = $("editorDialog");
    const narrowScreen = window.matchMedia?.("(max-width: 720px)");
    const sizeFoundation = () => {
      $("foundationDetails").open = !(narrowScreen?.matches ?? window.innerWidth <= 720);
    };
    sizeFoundation();
    narrowScreen?.addEventListener("change", sizeFoundation);
    const notify = (message) => {
      $("editorNotice").textContent = message;
      $("editorNotice").hidden = !message;
    };
    $("dismissNotice").onclick = () => notify("");
    $("undoEdit").onclick = undo;
    $("redoEdit").onclick = redo;
    $("mobileStep").onchange = (event) => navigate(event.target.value);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeDetail();
        $("catalogTooltip").hidden = true;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.target.matches("input,textarea,select,[contenteditable]")) {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      }
    });
    $("talentSearch").oninput = filterCatalogs;
    $("talentFilter").onchange = filterCatalogs;
    $("spellSearch").oninput = filterCatalogs;
    $("spellFilter").onchange = filterCatalogs;
    $("spellRank").onchange = filterCatalogs;
    $("closeDetail").onclick = closeDetail;
    $("detailBackdrop").onclick = closeDetail;
    drawer.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      const nodes = [...drawer.querySelectorAll('button:not(:disabled),select,summary,a[href],[tabindex="0"]')].filter((node) => !node.hidden);
      if (event.shiftKey && document.activeElement === nodes[0]) {
        event.preventDefault();
        nodes.at(-1)?.focus();
      }
      if (!event.shiftKey && document.activeElement === nodes.at(-1)) {
        event.preventDefault();
        nodes[0]?.focus();
      }
    });
    document.querySelectorAll(".bio-section").forEach((section) => {
      const title = section.querySelector("h3");
      const details = document.createElement("details");
      details.className = "bio-group";
      details.open = !document.querySelector(".bio-group");
      const summary = document.createElement("summary");
      summary.textContent = title.textContent;
      title.remove();
      details.append(summary);
      while (section.firstChild) details.append(section.firstChild);
      section.append(details);
    });
    document.querySelectorAll(".file-button").forEach((label) => {
      label.tabIndex = 0;
      label.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          label.querySelector("input")?.click();
        }
      });
    });
    function filterCatalogs() {
      const talentSearch = $("talentSearch").value.toLocaleLowerCase().trim();
      const talentFilter = $("talentFilter").value;
      let visible = 0, total = 0;
      for (const tile of document.querySelectorAll("#generalTalentCatalog .catalog-item")) {
        total++;
        const matches = tile.dataset.name?.includes(talentSearch) && (talentFilter === "all" || talentFilter === "selected" && tile.dataset.selected === "true" || talentFilter === "available" && tile.dataset.available === "true");
        tile.hidden = !matches;
        if (matches) visible++;
      }
      $("talentCount").textContent = `${visible} / ${total}`;
      $("talentEmpty").hidden = visible > 0;
      const query = $("spellSearch").value.toLocaleLowerCase().trim();
      let spells = 0;
      for (const tile of document.querySelectorAll("#spellCatalog .catalog-item")) {
        const matches = tile.dataset.name?.includes(query) && ($("spellFilter").value !== "selected" || tile.classList.contains("selected")) && (!$("spellRank").value || tile.dataset.rank === $("spellRank").value);
        tile.hidden = !matches;
        if (matches) spells++;
      }
      for (const group of document.querySelectorAll(".spell-school-block,.spell-rank-section")) {
        group.hidden = ![...group.querySelectorAll(".catalog-item")].some((tile) => !tile.hidden);
      }
      $("spellEmpty").hidden = spells > 0 || !document.querySelector("#spellCatalog .catalog-item");
    }
    function refreshDetail() {
      if (!detailId) return;
      const model = (detailType === "spell" ? spellCatalog : catalog)(detailId);
      if (!model) {
        closeDetail();
        return;
      }
      $("detailName").textContent = model.name;
      $("detailMeta").textContent = model.meta;
      if ($("detailDescription").innerHTML !== model.description) $("detailDescription").innerHTML = model.description;
      $("detailReason").textContent = model.reason || "";
      const focusedAction = drawer.contains(document.activeElement) ? document.activeElement.dataset.action : null;
      $("detailActions").replaceChildren(...model.actions.map((action, i) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.action = String(i);
        button.textContent = action.label;
        button.disabled = action.disabled || false;
        button.className = action.primary ? "primary" : "";
        button.onclick = () => {
          action.run();
          refreshDetail();
        };
        return button;
      }));
      if (focusedAction) $("detailActions").querySelector(`[data-action="${focusedAction}"]`)?.focus();
    }
    function openDetail(id, type, trigger) {
      detailId = id;
      detailType = type;
      returnTarget = trigger;
      refreshDetail();
      $("catalogTooltip").hidden = true;
      drawer.hidden = false;
      $("detailBackdrop").hidden = false;
      document.body.classList.add("detail-open");
      $("closeDetail").focus();
    }
    function closeDetail() {
      if (drawer.hidden) return;
      const id = detailId;
      drawer.hidden = true;
      $("detailBackdrop").hidden = true;
      document.body.classList.remove("detail-open");
      detailId = null;
      const replacement = [...document.querySelectorAll("[data-catalog-id]")].find((node) => node.dataset.catalogId === id && !node.hidden);
      (returnTarget?.isConnected ? returnTarget : replacement?.querySelector(".catalog-item-name"))?.focus();
    }
    function confirmChange(title, messages) {
      return new Promise((resolve) => {
        $("dialogTitle").textContent = title;
        $("dialogBody").replaceChildren(...messages.map((message) => {
          const p = document.createElement("p");
          p.textContent = message;
          return p;
        }));
        const done = (accepted) => {
          dialog.close();
          resolve(accepted);
        };
        $("dialogAccept").onclick = () => done(true);
        $("dialogCancel").onclick = () => done(false);
        dialog.oncancel = (event) => {
          event.preventDefault();
          done(false);
        };
        dialog.showModal();
        $("dialogCancel").focus();
      });
    }
    return {
      notify,
      confirmChange,
      openDetail,
      closeDetail,
      filterCatalogs,
      refreshDetail,
      saved(ok) {
        $("saveStatus").textContent = ok ? "Сохранено на устройстве" : "Не удалось сохранить — скачайте черновик";
        $("saveStatus").classList.toggle("save-failed", !ok);
      },
      update({ state, steps, currentStep, replay, history, rules }) {
        const kin = rules.kin.find((k) => k.id === state.identity.kinId);
        const profession = rules.professions.find((p) => p.id === state.identity.professionId);
        $("characterName").textContent = state.identity.name || "Новый персонаж";
        $("characterMeta").textContent = [kin?.name, state.identity.kinId === "mortar" ? "Пробуждённый" : profession?.name].filter(Boolean).join(" · ");
        $("characterInitial").textContent = (state.identity.name || "?").slice(0, 1).toLocaleUpperCase();
        $("undoEdit").disabled = !history.canUndo;
        $("redoEdit").disabled = !history.canRedo;
        $("mobileStep").replaceChildren(...steps.map((step) => {
          const option = new Option(step.label, step.id);
          option.selected = step.id === currentStep;
          return option;
        }));
        $("pageEyebrow").textContent = "Досье пилигрима";
        $("pageTitle").textContent = steps.find((step) => step.id === currentStep)?.label || "Персонаж";
        $("activeResources").textContent = currentStep === "attributes" ? `Характеристики: ${Object.values(state.attributes).reduce((a, b) => a + Number(b || 0), 0)} / ${replay.categoryRules?.attributePoints ?? "—"}` : currentStep === "talents" ? `${state.identity.kinId === "mortar" ? "Recovery " + replay.mortar.recoveryRank : "Возрастные очки: " + replay.ageTalents.remaining + " осталось"} · Опыт на развитие: ${replay.final.xpRemaining} / ${replay.final.xpBudget} XP` : `Опыт на развитие: ${replay.final.xpRemaining} / ${replay.final.xpBudget} XP`;
        filterCatalogs();
        refreshDetail();
        const required = new Set(rules.builderSettings?.requiredBiographyFields ?? []);
        document.querySelectorAll("#biographyPanel textarea").forEach((field) => {
          const key = { bioConcept: "concept", bioAppearance: "appearance", bioBackground: "background", bioFamily: "family", bioPride: "pride", bioDarkSecret: "darkSecret", bioMotivation: "motivation", bioConnections: "partyConnections" }[field.id];
          if (key) {
            field.setAttribute("aria-required", String(required.has(key)));
            field.closest("label")?.classList.toggle("required-field", required.has(key));
          }
        });
      }
    };
  }
  return { create, createHistory };
})();
