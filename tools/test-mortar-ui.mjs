import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "offline-app/mortar-ui.js"), "utf8");
const html = fs.readFileSync(path.join(root, "offline-app/index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "offline-app/styles.css"), "utf8");
const sw = fs.readFileSync(path.join(root, "offline-app/sw.js"), "utf8");
const config = fs.readFileSync(path.join(root, "offline-app/config.js"), "utf8");

assert.match(html, /id="birthYearLabel">Год рождения</u, "У подписи года должен быть отдельный узел для переключения на год пробуждения");
assert.match(source, /Год пробуждения/u, "Для мортара отсутствует подпись года пробуждения");

assert.match(source, /const visible = kin === "human" && variant === "gvirl"/u, "Фокус гвирла должен показываться только человеку-гвирлу");
assert.match(source, /wrapper\.hidden = !visible/u, "Фокус гвирла должен удаляться из layout через hidden");
assert.match(source, /wrapper\.style\.setProperty\("display", "none", "important"\)/u, "Скрытие фокуса гвирла должно быть устойчиво к конфликтующим CSS display-правилам");
assert.match(source, /select\.disabled = !visible/u, "Скрытый фокус гвирла не должен оставаться активным form control");
assert.match(styles, /\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/u, "CSS не должен переопределять hidden у условных полей и каталогов");

assert.match(source, /section\.id = "mortarSystemsSection"/u, "Для мортара должна существовать отдельная секция систем");
assert.match(source, /Системы мортара/u);
assert.match(source, /id="mortarBodySlot"/u, "Механическое Тело должно иметь отдельный слот");
assert.match(source, /id="mortarRecoverySlot"/u, "Recovery Protocol должен иметь отдельный слот");
assert.match(source, /id="mortarRecoveryTrack"/u, "Recovery Protocol должен иметь визуальную шкалу рангов");
assert.match(source, /id="mortarProtocolCatalog"/u, "Operational Protocols должны иметь отдельный каталог");
assert.match(source, /Recovery Ranks 3, 4 и 5 добавляют по 1 свободному очку Attribute/u, "UI должен описывать Recovery attribute gains как общий пул, а не talents");
assert.match(source, /attributePointsTotal/u, "UI должен использовать динамический общий пул Attributes");
assert.match(source, /attributeBonusPoints/u, "UI должен показывать бонусные очки Recovery");
assert.doesNotMatch(source, /mortarCalibrationRank[345]/u, "Recovery attribute gains больше не должны иметь отдельные calibration controls");
assert.doesNotMatch(source, /CALIBRATION_PATTERN/u, "Calibration pseudo-talents должны быть полностью удалены из Mortar UI");

assert.match(source, /setHidden\(element, active\)/u, "Legacy Profession/Race creation controls должны скрываться в Mortar mode");
assert.match(source, /Мортар не получает бесплатный General Talent при создании/u, "General Talents должны быть явно отделены от стартовых систем мортара");
assert.match(source, /protocolCatalog\.append\(tile\)/u, "Operational Protocol cards должны физически переноситься из generic catalog в собственный каталог");
assert.match(source, /if \(isMortarOnlyTalent\(tileTalentName\(tile\)\)\) tile\.remove\(\)/u, "Mortar-only entries не должны оставаться в General Talent catalog");
assert.match(source, /OPERATIONAL_PROTOCOL_SET\.has\(name\)[\s\S]*row\.remove\(\)/u, "Выбранные Operational Protocols не должны дублироваться в General Talents");
assert.match(source, /bodySlot\.replaceChildren\(row\)/u, "Механическое Тело должно выводиться отдельно от General Talents");
assert.match(source, /row\.querySelector\("\.row-actions"\)\?\.setAttribute\("hidden", ""\)/u, "У постоянного Механического Тела не должно быть controls покупки/повышения");
assert.match(source, /observer\.disconnect\(\)/u, "DOM-перестановки Mortar UI должны временно отключать MutationObserver");

assert.match(sw, /CACHE_NAME = "air-islands-character-builder-1\.5\.0"/u, "Service Worker cache должен быть обновлён вместе с UI");
assert.match(sw, /NETWORK_FIRST_SHELL/u, "JS/CSS shell должен обновляться network-first, чтобы старый Mortar UI не застревал в кэше");
assert.match(sw, /NETWORK_FIRST_SHELL\.test\(url\.pathname\)/u, "Network-first правило должно реально применяться к shell assets");
assert.match(config, /builderVersion: "1\.5\.0"/u, "Offline builder должен объявлять версию 1.5.0");

console.log("Mortar UI contract checks passed.");
