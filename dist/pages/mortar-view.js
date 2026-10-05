globalThis.AirIslandsMortarView = {
  render({ state, rules, replay, index, core, buy, undo, describe, tooltip, escapeHtml: esc }) {
    const active = state.identity.kinId === "mortar";
    document.querySelectorAll("[data-organic-talents]").forEach((node) => node.hidden = active);
    const root = document.getElementById("mortarSystems");
    root.hidden = !active;
    document.getElementById("mortarFoundryNote").hidden = !active;
    document.getElementById("profession").closest("label").hidden = active;
    document.getElementById("profession").disabled = active;
    document.getElementById("birthYearLabel").textContent = active ? "Год пробуждения" : "Год рождения";
    document.getElementById("ageSummary").hidden = active;
    if (!active) {
      root.replaceChildren();
      return;
    }
    const system = replay.mortar;
    const talents = rules.catalogs.talents.items.filter((t) => t.builderRole?.startsWith("mortar-"));
    const recovery = talents.find((t) => t.builderRole === "mortar-recovery");
    const body = talents.find((t) => t.builderRole === "mortar-body");
    const operational = talents.filter((t) => t.builderRole === "mortar-operational");
    const known = operational.filter((t) => replay.state.talents.has(t.catalogId));
    root.innerHTML = `<div class="mortar-heading"><div><span class="eyebrow">Механическое тело</span><h3>Системы мортара</h3></div><span class="status-pill">Operational ${known.length} / ${operational.length}</span></div>
      <div class="mortar-core"><div id="mortarBodyCard" class="system-card"><strong>${esc(body?.name || "Механическое Тело")}</strong><p>Получено при пробуждении · ранг 1</p></div><div id="mortarRecoveryCard" class="system-card"></div></div>
      <div class="recovery-track">${[1, 2, 3, 4, 5].map((rank) => `<span class="${rank <= system.recoveryRank ? "reached" : ""}"><strong>R${rank}</strong><small>${["Overclock", "Первый Protocol", "+1 характеристика", "+1 характеристика", "+1 · Redline"][rank - 1]}</small></span>`).join("")}</div>
      <p class="panel-help">Характеристики: ${system.attributePointsSpent} / ${system.attributePointsTotal} (${system.attributeBonusPoints} от Recovery). Максимум одной: ${system.attributeMaximum}.</p>
      <h3>Operational Protocols</h3><div id="mortarProtocolCatalog" class="catalog-grid catalog-grid-three"></div>`;
    if (body) {
      const name = root.querySelector("#mortarBodyCard strong");
      name.tabIndex = 0;
      tooltip(name, body, "Получено при пробуждении");
      name.onclick = () => describe(body.catalogId, name);
    }
    function card(talent, container) {
      if (!talent) return;
      const rank = replay.state.talents.get(talent.catalogId) ?? 0;
      const result = core.simulateXpTransaction(state, rules, { type: "talent", catalogId: talent.catalogId, toRank: rank + 1 });
      const position = state.experience.ledger.findLastIndex((tx) => tx.catalogId === talent.catalogId);
      const row = document.createElement("div");
      row.className = "catalog-item" + (rank ? " selected" : "");
      row.dataset.catalogId = talent.catalogId;
      row.innerHTML = `<button type="button" class="catalog-item-name">${esc(talent.name)} <small>${rank ? "R" + rank : "Не открыт"}</small></button><span class="catalog-actions"><button type="button" class="catalog-add xp-undo" ${position < 0 ? "disabled" : ""} aria-label="Отменить ${esc(talent.name)}">−</button><button type="button" class="catalog-add" ${!result.valid ? "disabled" : ""} aria-label="Повысить ${esc(talent.name)}">+</button></span><small class="catalog-cost">${result.valid ? result.cost ? result.cost + " XP" : "Первый ранг бесплатно" : esc(result.issue?.message || "Максимальный ранг")}</small>`;
      const name = row.querySelector(".catalog-item-name");
      tooltip(name, talent, `Ранг ${rank}`);
      name.onclick = () => describe(talent.catalogId, name);
      row.querySelector(".xp-undo").onclick = () => undo(position, talent.name);
      row.querySelector(".catalog-add:last-child").onclick = () => buy(talent.catalogId);
      container.append(row);
    }
    card(recovery, root.querySelector("#mortarRecoveryCard"));
    for (const talent of operational) card(talent, root.querySelector("#mortarProtocolCatalog"));
  }
};
