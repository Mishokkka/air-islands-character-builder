import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "offline-app/mortar-ui.js"), "utf8");
const html = fs.readFileSync(path.join(root, "offline-app/index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "offline-app/styles.css"), "utf8");

assert.match(html, /id="birthYearLabel">Год рождения</u, "У подписи года должен быть отдельный узел для переключения на год пробуждения");
assert.match(source, /Год пробуждения/u, "Для мортара отсутствует подпись года пробуждения");
assert.match(source, /kin === "human" && variant === "gvirl"/u, "Фокус гвирла должен показываться только человеку-гвирлу");
assert.match(styles, /\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/u, "CSS не должен переопределять hidden у условных полей и каталогов");
assert.match(source, /section\.id = "mortarProtocolSection"/u, "Для протоколов мортара отсутствует отдельная секция");
assert.match(source, /id="mortarProtocolCatalog"/u, "Operational Protocols не отделены от General Talents");
assert.match(source, /id="mortarCalibrationRank3"/u);
assert.match(source, /id="mortarCalibrationRank4"/u);
assert.match(source, /id="mortarCalibrationRank5"/u);
assert.match(source, /const MORTAR_BODY_TALENT = "Механическое Тело"/u, "Механическое Тело должно отдельно отслеживаться Mortar UI");
assert.match(source, /name === MORTAR_BODY_TALENT \|\| OPERATIONAL_PROTOCOLS/u, "Механическое Тело не должно попадать в обычный каталог General Talents других рас");
assert.match(source, /if \(name === MORTAR_BODY_TALENT\) \{\s*tile\.hidden = true;/u, "Механическое Тело должно показываться собственной карточкой, а не дублироваться в General Talents мортара");
assert.match(source, /function mechanicalBodyDescription\(\)/u, "Описание Механического Тела должно браться из канонических правил");
assert.match(source, /globalThis\.AIR_ISLANDS_RULES\?\.catalogs\?\.talents\?\.items\?\.find\(item => item\.builderRole === "mortar-body"\)/u, "Mortar UI должен находить каноническую запись Механического Тела по builderRole");
assert.match(source, /entry\?\.snapshot\?\.system\?\.description/u, "Карточка Механического Тела должна использовать канонический system.description");
assert.match(source, /id="mortarBodyDescription"/u, "Для канонического описания Механического Тела нужен отдельный контейнер");
assert.match(source, /syncMechanicalBodyDescription\(active\)/u, "Каноническое описание Механического Тела должно синхронизироваться при refresh");
assert.doesNotMatch(source, /Постоянные свойства механического организма:/u, "Mortar UI не должен содержать вторую сокращённую копию правил Механического Тела");
assert.match(source, /observer\.disconnect\(\)/u, "DOM-перестановки Mortar UI должны временно отключать MutationObserver");
assert.match(source, /OPERATIONAL_PROTOCOLS/u);
assert.doesNotMatch(source, /Recovery Protocol Rank \[345\]: \+1[^\n]*General Talents/u);

console.log("Mortar UI contract checks passed.");
