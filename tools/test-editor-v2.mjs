import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";
import { TextEncoder, TextDecoder } from "node:util";
import * as core from "../shared/mortar-runtime-core.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rules = JSON.parse(fs.readFileSync(path.join(root, "data/generated/air-islands-rules.json"), "utf8"));
const sample = JSON.parse(fs.readFileSync(path.join(root, "samples/test-character.json"), "utf8"));
const mortar = structuredClone(sample);
mortar.identity.kinId = "mortar";
mortar.identity.professionId = "";
mortar.creation = { initialPathCatalogId: null, ageTalentLedger: [], startingSpells: [], mortar: { killerRoll: 1, defectRoll: 11 } };
mortar.experience.ledger = [];
mortar.reputation.entries = [{ id: "mortar-killer", amount: 1, description: "Убийца", location: "" }];
const before = JSON.stringify(mortar);
core.replayCharacter(mortar, rules);
core.validateCharacter(mortar, rules);
core.attributeMaximum("strength", mortar, rules);
core.simulateXpTransaction(mortar, rules, { type: "skill", skillId: "move", toRank: 1 });
core.characterToActorData(mortar, rules, { allowInvalid: true });
assert.equal(JSON.stringify(mortar), before, "Read/simulate/export operations must not mutate the source character");
assert.equal(core.replayCharacter(mortar, rules).final.reputation, 0, "Post-creation reputation is excluded from the builder calculation");
const appRoot = path.join(root, "offline-app");
const server = http.createServer((request, response) => {
  const file = path.resolve(appRoot, "." + new URL(request.url, "http://localhost").pathname);
  if (!file.startsWith(appRoot + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return response.writeHead(404).end();
  response.setHeader("Content-Type", path.extname(file) === ".js" ? "text/javascript" : path.extname(file) === ".css" ? "text/css" : "text/html; charset=utf-8");
  fs.createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let dom;
const errors = [];
try {
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => errors.push(error));
  virtualConsole.on("error", (error) => errors.push(error));
  dom = await JSDOM.fromURL(`http://127.0.0.1:${server.address().port}/index.html`, {
    resources: "usable",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.TextEncoder = TextEncoder;
      window.TextDecoder = TextDecoder;
      window.URL.createObjectURL = () => "blob:test";
      window.URL.revokeObjectURL = () => {
      };
      window.HTMLElement.prototype.scrollIntoView = () => {
      };
      window.HTMLDialogElement.prototype.showModal = function() {
        this.open = true;
      };
      window.HTMLDialogElement.prototype.close = function() {
        this.open = false;
      };
      window.localStorage.setItem("air-islands-character-builder:draft:v7", JSON.stringify(sample));
    }
  });
  await new Promise((resolve) => dom.window.addEventListener("load", () => setTimeout(resolve, 150), { once: true }));
  const w = dom.window, $ = (id) => w.document.getElementById(id), pause = () => new Promise((r) => setTimeout(r, 30));
  const change = (id, value, type = "input") => {
    $(id).value = value;
    $(id).dispatchEvent(new w.Event(type, { bubbles: true }));
  };
  const state = () => JSON.parse(w.localStorage.getItem("air-islands-character-builder:draft:v7"));
  assert.equal($("exportCharacter").disabled, false);
  const field = w.document.querySelector("#attributes input");
  field.focus();
  field.value = String(Number(field.value) - 1);
  field.dispatchEvent(new w.Event("input", { bubbles: true }));
  assert.equal(field.isConnected, true);
  assert.equal(w.document.activeElement, field);
  $("undoEdit").click();
  await pause();
  assert.equal($("exportCharacter").disabled, false);
  change("baseXp", "500");
  const general = rules.catalogs.talents.items.find((t) => t.name === "Alchemist");
  const tile = [...w.document.querySelectorAll("#generalTalentCatalog .catalog-item")].find((t) => t.dataset.catalogId === general.catalogId);
  tile.querySelector(".catalog-item-name").click();
  assert.equal($("catalogDetail").hidden, false);
  const remaining = core.replayCharacter(state(), rules).final.xpRemaining;
  [...$("detailActions").querySelectorAll("button")].find((b) => b.textContent.includes("XP") && !b.textContent.includes("Отменить")).click();
  assert.equal(core.replayCharacter(state(), rules).final.xpRemaining, remaining - 5);
  assert.equal($("catalogDetail").hidden, false, "Purchasing retains the description");
  $("closeDetail").click();
  $("undoEdit").click();
  await pause();
  assert.equal(core.replayCharacter(state(), rules).final.xpRemaining, remaining);
  $("redoEdit").click();
  await pause();
  assert.equal(core.replayCharacter(state(), rules).final.xpRemaining, remaining - 5);
  change("talentSearch", "Alchemist");
  assert.equal([...$("generalTalentCatalog").children].filter((n) => !n.hidden).length, 1);
  change("talentSearch", "not-a-talent");
  assert.equal($("talentEmpty").hidden, false);
  change("talentSearch", "");
  const beforeRace = JSON.stringify(state());
  change("kin", "mortar", "change");
  assert.equal($("editorDialog").open, true);
  assert.equal(state().identity.kinId, "human", "Pending dialog must not commit");
  $("dialogCancel").click();
  await pause();
  assert.equal(JSON.stringify(state()), beforeRace);
  change("kin", "mortar", "change");
  $("dialogAccept").click();
  await pause();
  assert.equal(state().identity.kinId, "mortar");
  assert.equal($("profession").disabled, true);
  assert.equal($("mortarProtocolCatalog").children.length, 6);
  assert.ok($("mortarFoundryNote").textContent.includes("D100"));
  assert.equal(w.document.querySelector(".wizard-step[data-step=spells]").hidden, true);
  assert.ok($("generalTalentCatalog").children.length > 70);
  let mutations = 0;
  const observer = new w.MutationObserver((changes) => mutations += changes.length);
  observer.observe(w.document.body, { subtree: true, childList: true, characterData: true });
  await new Promise((resolve) => setTimeout(resolve, 100));
  observer.disconnect();
  assert.equal(mutations, 0);
  $("undoEdit").click();
  await pause();
  assert.equal(state().identity.kinId, "human");
  assert.equal($("profession").disabled, false);
  assert.equal($("mortarSystems").hidden, true);
  const oldSet = w.Storage.prototype.setItem;
  w.Storage.prototype.setItem = () => {
    throw new Error("QuotaExceeded");
  };
  change("name", "Новый");
  assert.ok($("saveStatus").textContent.includes("Не удалось сохранить"));
  assert.equal($("saveDraft").disabled, false);
  w.Storage.prototype.setItem = oldSet;
  assert.deepEqual(errors, []);
  console.log("Editor 2.0: pure runtime, focus, catalog purchases, undo/redo, race preview/cancel, Mortar idle and storage failures passed.");
} finally {
  dom?.window.close();
  server.closeAllConnections();
  server.close();
}
