import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const runtime = fs.readFileSync(path.join(root, "shared/mortar-runtime-core.mjs"), "utf8");
const postImport = fs.readFileSync(path.join(root, "foundry-module/scripts/mortar-post-import.mjs"), "utf8");
const moduleManifest = JSON.parse(fs.readFileSync(path.join(root, "foundry-module/module.json"), "utf8"));
const buildBrowser = fs.readFileSync(path.join(root, "tools/build-browser.mjs"), "utf8");

assert.equal(moduleManifest.version, "1.5.1");
assert.ok(moduleManifest.esmodules.includes("scripts/mortar-post-import.mjs"), "Foundry должен загружать Mortar post-import finalizer");

assert.match(runtime, /killerRoll = null/u, "Builder export не должен фиксировать бросок Reputation «Убийца»");
assert.match(runtime, /defectRoll = null/u, "Builder export не должен фиксировать бросок дефекта");
assert.match(runtime, /POST_CREATION_CODES = new Set\(\["MORTAR_KILLER_ROLL", "MORTAR_DEFECT_ROLL"\]\)/u);
assert.match(runtime, /killer: "1D2"/u);
assert.match(runtime, /defect: "1D100"/u);
assert.match(buildBrowser, /entryPoints: \[path\.join\(root, "shared\/mortar-runtime-core\.mjs"\)\]/u, "Browser/Foundry build должен использовать runtime wrapper");
assert.match(buildBrowser, /foundry-module\/scripts\/mortar-core\.mjs/u, "Foundry build должен сохранять Mortar rule engine отдельным модулем");

assert.match(postImport, /new Roll\("1d2"\)/u, "Reputation «Убийца» должна бросаться в Foundry на D2");
assert.match(postImport, /new Roll\("1d100"\)/u, "Дефект должен бросаться в Foundry на D100");
assert.match(postImport, /"Дефекты мортаров"/u, "Finalizer должен уметь использовать таблицу дефектов мира");
assert.match(postImport, /builderRole === "mortar-body"/u, "Fallback Mechanical Body должен браться из bundled rules, а не из дублированного текста");
assert.match(postImport, /existingNames\.has\("Механическое Тело"\)/u, "Missing Mechanical Body должен восстанавливаться после импорта");

assert.match(postImport, /name: "Врожденный доспех мортара"/u);
assert.match(postImport, /bonus: \{ value: 2, max: 2 \}/u, "Врожденный доспех должен иметь Armor Rating 2");
assert.match(postImport, /name: "Обычные запчасти"/u);
assert.match(postImport, /die: 10/u, "Обычные запчасти должны начинаться с D10");
assert.match(postImport, /name: "Точные запчасти"/u);
assert.match(postImport, /die: 8/u, "Точные запчасти должны начинаться с D8");
assert.match(postImport, /if \(existingNames\.has\(spec\.item\.name\)\) continue/u, "Starter Items не должны дублироваться при повторном hook-вызове");
assert.match(postImport, /mortarPostCreation\?\.completed === true/u, "Post-creation rolls не должны повторяться при обычных последующих обновлениях Actor");

console.log("Mortar Foundry post-import contract checks passed.");
