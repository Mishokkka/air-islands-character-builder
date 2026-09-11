import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const runtime = fs.readFileSync(path.join(root, "shared/mortar-runtime-core.mjs"), "utf8");
const postImportPath = path.join(root, "foundry-module/scripts/mortar-post-import.mjs");
const postImport = fs.readFileSync(postImportPath, "utf8");
const moduleManifest = JSON.parse(fs.readFileSync(path.join(root, "foundry-module/module.json"), "utf8"));
const buildBrowser = fs.readFileSync(path.join(root, "tools/build-browser.mjs"), "utf8");

assert.equal(moduleManifest.version, "1.5.1");
assert.ok(moduleManifest.esmodules.includes("scripts/mortar-post-import.mjs"), "Foundry должен загружать Mortar post-import finalizer");

assert.match(runtime, /killerRoll = null/u, "Builder export не должен фиксировать бросок Reputation «Убийца»");
assert.match(runtime, /defectRoll = null/u, "Builder export не должен фиксировать бросок дефекта");
assert.match(runtime, /killer: "1D2"/u);
assert.match(runtime, /defect: "1D100"/u);
assert.match(buildBrowser, /entryPoints: \[path\.join\(root, "shared\/mortar-runtime-core\.mjs"\)\]/u, "Browser/Foundry build должен использовать runtime wrapper");
assert.match(buildBrowser, /foundry-module\/scripts\/mortar-core\.mjs/u, "Foundry build должен сохранять Mortar rule engine отдельным модулем");

assert.match(postImport, /const inFlight = new Map\(\)/u, "Finalizer должен иметь actor-keyed in-flight guard");
assert.match(postImport, /rerunRequested/u, "Hook-вызовы во время finalization должны коалесцироваться");
assert.match(postImport, /new Roll\("1d2"\)/u, "Reputation «Убийца» должна бросаться в Foundry на D2");
assert.match(postImport, /new Roll\("1d100"\)/u, "Дефект должен бросаться в Foundry на D100");
assert.match(postImport, /"Дефекты мортаров"/u, "Finalizer должен уметь использовать таблицу дефектов мира");
assert.match(postImport, /builderRole === "mortar-body"/u, "Fallback Mechanical Body должен браться из bundled rules, а не из дублированного текста");
assert.match(postImport, /existingNames\.has\("Механическое Тело"\)/u, "Missing Mechanical Body должен восстанавливаться после импорта");

const callbacks = new Map();
globalThis.Hooks = {
  once(name, fn) { callbacks.set(`once:${name}`, fn); },
  on(name, fn) { callbacks.set(`on:${name}`, fn); }
};

const rollTotals = { "1d2": [1], "1d100": [73] };
const rollCalls = [];
globalThis.Roll = class MockRoll {
  constructor(formula) {
    this.formula = formula;
    this.total = null;
  }
  async evaluate() {
    rollCalls.push(this.formula);
    this.total = rollTotals[this.formula]?.shift();
    if (this.total == null) throw new Error(`Unexpected extra roll ${this.formula}`);
    return this;
  }
  async toMessage() {
    return this;
  }
};

globalThis.ChatMessage = {
  getSpeaker: ({ actor }) => ({ actor: actor.id })
};

const tableDraws = [];
const table = {
  name: "Дефекты мортаров",
  async draw(options) {
    tableDraws.push(options.roll.total);
  }
};

globalThis.game = {
  user: { isGM: true },
  tables: [table]
};

globalThis.foundry = {
  utils: {
    deepClone: value => structuredClone(value)
  }
};

globalThis.fetch = async () => ({
  ok: true,
  async json() {
    return {
      catalogs: {
        talents: {
          items: [{
            builderRole: "mortar-body",
            snapshot: {
              _id: "body-template",
              name: "Механическое Тело",
              type: "talent",
              system: { rank: "1", type: "general", description: "<p>body</p>" },
              flags: {}
            }
          }]
        }
      }
    };
  }
});

function setPath(target, dotted, value) {
  const parts = dotted.split(".");
  let cursor = target;
  for (const part of parts.slice(0, -1)) cursor = cursor[part] ??= {};
  cursor[parts.at(-1)] = structuredClone(value);
}

const actor = {
  id: "mortar-1",
  uuid: "Actor.mortar-1",
  documentName: "Actor",
  items: [],
  flags: {
    "air-islands-character-importer": {
      profile: { identity: { kinId: "mortar" } }
    },
    "fbl-quick-access": {
      reputationEntries: []
    }
  },
  system: {
    bio: {
      reputation: { value: 0 }
    }
  },
  async createEmbeddedDocuments(type, data) {
    assert.equal(type, "Item");
    const created = data.map(source => ({ ...structuredClone(source), parent: actor }));
    actor.items.push(...created);
    for (const item of created) callbacks.get("on:createItem")?.(item);
    return created;
  },
  async update(changes) {
    for (const [key, value] of Object.entries(changes)) setPath(actor, key, value);
    callbacks.get("on:updateActor")?.(actor);
    await new Promise(resolve => setTimeout(resolve, 5));
    return actor;
  }
};

await import(`${pathToFileURL(postImportPath).href}?runtime-test=${Date.now()}`);
callbacks.get("once:ready")?.();
assert.equal(typeof callbacks.get("on:createActor"), "function");

callbacks.get("on:createActor")(actor);
callbacks.get("on:updateActor")(actor);
await new Promise(resolve => setTimeout(resolve, 850));

assert.deepEqual(
  new Set(actor.items.map(item => item.name)),
  new Set(["Механическое Тело", "Врожденный доспех мортара", "Обычные запчасти", "Точные запчасти"]),
  "Finalizer должен создать полный стартовый набор ровно по одному экземпляру"
);
assert.equal(actor.items.length, 4);
assert.deepEqual(rollCalls, ["1d2", "1d100"], "Перекрывающиеся hooks не должны повторять D2/D100");
assert.deepEqual(tableDraws, [73], "D100 должен один раз использоваться для draw таблицы дефектов");
assert.equal(actor.system.bio.reputation.value, 1);
assert.equal(actor.flags["fbl-quick-access"].reputationEntries[0]?.id, "mortar-killer");
assert.equal(actor.flags["air-islands-character-importer"].mortarPostCreation.completed, true);
assert.equal(actor.flags["air-islands-character-importer"].mortarPostCreation.killerRoll, 1);
assert.equal(actor.flags["air-islands-character-importer"].mortarPostCreation.defectRoll, 73);

callbacks.get("on:updateActor")(actor);
callbacks.get("on:createItem")?.({ parent: actor });
await new Promise(resolve => setTimeout(resolve, 400));

assert.equal(actor.items.length, 4, "Повторные hooks не должны дублировать starter items");
assert.deepEqual(rollCalls, ["1d2", "1d100"], "После completed повторные hooks не должны перебрасывать post-creation rolls");
assert.deepEqual(tableDraws, [73]);

console.log("Mortar Foundry post-import runtime checks passed.");
