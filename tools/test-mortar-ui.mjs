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
assert.match(source, /Механическое Тело/u, "В интерфейсе мортара отсутствует отдельный талант Механическое Тело");
assert.match(source, /REBOOT занимает Quarter Day, заменяет сон, восстанавливает WITS как сон, 1 EMPATHY, полностью снимает OVERLOAD/u, "Описание REBOOT в UI должно совпадать с правилами Механического Тела");
assert.match(source, /MAINTENANCE занимает Quarter Day \(6 часов\)\. Во время него можно выполнять ремонт/u, "MAINTENANCE должен быть описан как период, во время которого выполняется ремонт");
assert.match(source, /ремонтирующий совершает CRAFTING roll и одновременно бросает Resource Die запчастей/u, "UI должен объяснять базовую проверку ремонта мортара");
assert.match(source, /Обычный ремонт восстанавливает потерянные STR или AGI по 1 пункту за каждый успех/u, "UI должен объяснять восстановление STR и AGI во время ремонта");
assert.match(source, /Завершённое MAINTENANCE дополнительно снимает 1D6 OVERLOAD/u, "Снятие 1D6 OVERLOAD должно быть обозначено как дополнительный бонус MAINTENANCE");
assert.match(source, /observer\.disconnect\(\)/u, "DOM-перестановки Mortar UI должны временно отключать MutationObserver");
assert.match(source, /OPERATIONAL_PROTOCOLS/u);
assert.doesNotMatch(source, /Recovery Protocol Rank \[345\]: \+1[^\n]*General Talents/u);

console.log("Mortar UI contract checks passed.");
