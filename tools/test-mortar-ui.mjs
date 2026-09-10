import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "offline-app/mortar-ui.js"), "utf8");
const html = fs.readFileSync(path.join(root, "offline-app/index.html"), "utf8");

assert.match(html, /id="birthYearLabel">Год рождения</u, "У подписи года должен быть отдельный узел для переключения на год пробуждения");
assert.match(source, /Год пробуждения/u, "Для мортара отсутствует подпись года пробуждения");
assert.match(source, /kin === "human" && variant === "gvirl"/u, "Фокус гвирла должен показываться только человеку-гвирлу");
assert.match(source, /section\.id = "mortarProtocolSection"/u, "Для протоколов мортара отсутствует отдельная секция");
assert.match(source, /id="mortarProtocolCatalog"/u, "Operational Protocols не отделены от General Talents");
assert.match(source, /id="mortarCalibrationRank3"/u);
assert.match(source, /id="mortarCalibrationRank4"/u);
assert.match(source, /id="mortarCalibrationRank5"/u);
assert.match(source, /Механическое Тело/u, "В интерфейсе мортара отсутствует отдельный талант Механическое Тело");
assert.match(source, /observer\.disconnect\(\)/u, "DOM-перестановки Mortar UI должны временно отключать MutationObserver");
assert.match(source, /OPERATIONAL_PROTOCOLS/u);
assert.doesNotMatch(source, /Recovery Protocol Rank \[345\]: \+1[^\n]*General Talents/u);

console.log("Mortar UI contract checks passed.");
