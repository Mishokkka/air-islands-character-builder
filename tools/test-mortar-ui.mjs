import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "offline-app/mortar-ui.js"), "utf8");
const postCreationUi = fs.readFileSync(path.join(root, "offline-app/mortar-v2-ui.js"), "utf8");
const html = fs.readFileSync(path.join(root, "offline-app/index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "offline-app/styles.css"), "utf8");
const sw = fs.readFileSync(path.join(root, "offline-app/sw.js"), "utf8");
const config = fs.readFileSync(path.join(root, "offline-app/config.js"), "utf8");

assert.match(html, /id="birthYearLabel">Год рождения/u, "У подписи года должен быть отдельный узел для переключения на год пробуждения");
assert.match(source, /Год пробуждения/u, "Для мортара отсутствует подпись года пробуждения");

assert.match(source, /const visible = kin === "human" && variant === "gvirl"/u, "Фокус гвирла должен показываться только человеку-гвирлу");
assert.match(source, /wrapper\.hidden = !visible/u);
assert.match(source, /select\.disabled = !visible/u);
assert.match(styles, /\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/u);

assert.match(source, /section\.id = "mortarSystemsSection"/u, "Для мортара должна существовать отдельная секция систем");
assert.match(source, /id="mortarBodySlot"/u);
assert.match(source, /id="mortarRecoverySlot"/u);
assert.match(source, /id="mortarRecoveryTrack"/u);
assert.match(source, /id="mortarProtocolCatalog"/u);
assert.match(source, /Recovery Ranks 3, 4 и 5 добавляют по 1 свободному очку Attribute/u);
assert.doesNotMatch(source, /mortarCalibrationRank[345]/u);
assert.doesNotMatch(source, /CALIBRATION_PATTERN/u);

assert.match(source, /protocolCatalog\.append\(tile\)/u);
assert.match(source, /bodySlot\.replaceChildren\(row\)/u);
assert.match(source, /observer\.disconnect\(\)/u);

assert.match(postCreationUi, /#mortarCreationCard \{ display: none !important; \}/u, "Старые builder-time rolls должны быть полностью скрыты");
assert.match(postCreationUi, /\.wizard-steps \{ display: grid !important; grid-template-columns: 1fr !important/u, "Все этапы должны постоянно отображаться вертикальным списком");
assert.match(postCreationUi, /Reputation «Убийца» не определяется в билдере/u);
assert.match(postCreationUi, /обязательный D2/u);
assert.match(postCreationUi, /обязательный D100/u);
assert.match(postCreationUi, /результат не выбирается игроком/u);
assert.match(postCreationUi, /COMMAND_PROTOCOL = "Command Protocol"/u, "Command Protocol должен отдельно переноситься в Operational catalog");
assert.match(postCreationUi, /OPERATIONAL_TOTAL = 6/u, "UI должен учитывать шесть Operational Protocols");
assert.match(postCreationUi, /tileTalentName\(tile\) === COMMAND_PROTOCOL/u);
assert.match(postCreationUi, /protocolCatalog\.append\(commandTile\)/u);
assert.match(postCreationUi, /rowTalentName\(row\) === COMMAND_PROTOCOL/u);
assert.match(postCreationUi, /Operational \$\{operations\.length\}\/\$\{OPERATIONAL_TOTAL\}/u);
assert.match(postCreationUi, /Открыто \$\{operations\.length\} из \$\{OPERATIONAL_TOTAL\}/u);
assert.match(postCreationUi, /state\.killerRoll = null/u);
assert.match(postCreationUi, /state\.defectRoll = null/u);
assert.match(postCreationUi, /document\.readyState === "loading"/u);

assert.match(sw, /CACHE_NAME = "air-islands-character-builder-1\.5\.1"/u);
assert.match(sw, /"\.\/mortar-v2-ui\.js"/u);
assert.match(sw, /NETWORK_FIRST_SHELL/u);
assert.match(config, /builderVersion: "1\.5\.1"/u);
assert.match(config, /mortarV2Ui\.src = "\.\/mortar-v2-ui\.js"/u);

console.log("Mortar UI contract checks passed.");
