import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";
import { TextEncoder, TextDecoder } from "node:util";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "../offline-app");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8"
};

const server = http.createServer((request, response) => {
  const relative = request.url === "/" ? "index.html" : request.url.replace(/^\//u, "");
  const file = path.resolve(appRoot, relative);
  if (!file.startsWith(appRoot) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404).end("Not found");
    return;
  }
  response.writeHead(200, { "Content-Type": contentTypes[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(response);
});

await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const virtualConsole = new VirtualConsole();
const errors = [];
virtualConsole.on("jsdomError", error => errors.push(error));
virtualConsole.on("error", error => errors.push(error));

try {
  const dom = await JSDOM.fromURL(`http://127.0.0.1:${port}/index.html`, {
    resources: "usable",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.TextEncoder = TextEncoder;
      window.TextDecoder = TextDecoder;
      window.alert = () => undefined;
      window.confirm = () => true;
      window.URL.createObjectURL = () => "blob:test";
      window.URL.revokeObjectURL = () => undefined;
    }
  });
  await new Promise(resolve => dom.window.addEventListener("load", () => setTimeout(resolve, 250), { once: true }));

  if (errors.length) throw errors[0];
  if (dom.window.document.querySelectorAll(".panel").length < 8) throw new Error("Основные панели приложения не отрисованы.");
  if (!dom.window.document.querySelector("#validationState")?.textContent.includes("Найдено ошибок")) {
    throw new Error("Проверка персонажа не запустилась.");
  }
  if (dom.window.document.querySelectorAll("#wizardSteps .wizard-step").length !== 8) {
    throw new Error("Последовательный мастер не создал восемь этапов.");
  }
  if (!dom.window.document.querySelector("#loadRulesPackage")) {
    throw new Error("В шапке отсутствует загрузка экспортированного пакета .flrules.");
  }
  if (dom.window.document.querySelectorAll("#identityLore .lore-card").length < 3) {
    throw new Error("Контекстные карточки расы, профессии, происхождения и веры не отрисованы.");
  }
  if (dom.window.document.querySelectorAll("#generalTalentCatalog .catalog-item").length < 70) {
    throw new Error("Каталог General Talents не вывел полный список талантов.");
  }
  if (dom.window.document.querySelectorAll("#paths .talent-row").length !== 1) {
    throw new Error("Редактор должен показывать только один выбранный Professional Path.");
  }
  const headerDraftButton = dom.window.document.querySelector("#saveDraft");
  const headerStyle = dom.window.getComputedStyle(headerDraftButton);
  if (headerStyle.color === dom.window.getComputedStyle(dom.window.document.querySelector(".app-header")).color) {
    throw new Error("Кнопки шапки наследуют светлый цвет текста и остаются нечитаемыми.");
  }
  const firstTalentName = dom.window.document.querySelector("#generalTalentCatalog .catalog-item-name");
  firstTalentName?.dispatchEvent(new dom.window.MouseEvent("mouseenter", { bubbles: false }));
  await new Promise(resolve => setTimeout(resolve, 10));
  const tooltip = dom.window.document.querySelector("#catalogTooltip");
  if (tooltip?.hidden || !tooltip.textContent.trim()) {
    throw new Error("Тултип таланта не показал полное описание по наведению.");
  }
  Object.defineProperty(tooltip, "scrollHeight", { configurable: true, value: 900 });
  Object.defineProperty(tooltip, "clientHeight", { configurable: true, value: 240 });
  tooltip.scrollTop = 0;
  const tooltipWheel = new dom.window.WheelEvent("wheel", { deltaY: 180, cancelable: true });
  firstTalentName?.dispatchEvent(tooltipWheel);
  if (tooltip.scrollTop !== 180 || !tooltipWheel.defaultPrevented) {
    throw new Error("Колесо мыши над названием не прокручивает открытый длинный тултип.");
  }
  tooltip.dispatchEvent(new dom.window.Event("scroll", { bubbles: false }));
  if (tooltip.hidden) {
    throw new Error("Прокрутка содержимого тултипа закрывает сам тултип.");
  }
  firstTalentName?.dispatchEvent(new dom.window.MouseEvent("mouseleave", { bubbles: false }));
  tooltip.dispatchEvent(new dom.window.MouseEvent("mouseenter", { bubbles: false }));
  await new Promise(resolve => setTimeout(resolve, 460));
  if (tooltip.hidden) {
    throw new Error("Тултип закрывается при переводе курсора с названия на само описание.");
  }
  if (dom.window.document.querySelector("#identityPanel")?.hidden || dom.window.document.querySelector("#assetsPanel")?.hidden) {
    throw new Error("Первый этап мастера не отображает основу и изображения.");
  }
  if (!dom.window.document.querySelector("#identityPanel #baseXp") || dom.window.document.querySelector("#progressPanel #baseXp")) {
    throw new Error("Поле текущего Base XP не перенесено на первую страницу.");
  }
  const birthDateRow = dom.window.document.querySelector(".birth-date-row");
  if (!birthDateRow || birthDateRow.querySelectorAll(":scope > label").length !== 3) {
    throw new Error("Год, трилуние и день рождения не собраны в одну строку из трёх равных полей.");
  }
  if (!dom.window.document.querySelector("#baseXp")?.closest("label")?.querySelector(":scope > .label-line .field-help")) {
    throw new Error("Значок справки Base XP не стоит в одной строке с заголовком поля.");
  }
  if (dom.window.document.querySelector("#provisionalDate")) {
    throw new Error("В редакторе осталась удалённая служебная плашка даты.");
  }
  if (!dom.window.document.querySelector("#rulesStatus") || !dom.window.document.querySelector("#checkRulesUpdate") || !dom.window.document.querySelector("#restorePreviousRules")) {
    throw new Error("В шапке отсутствует компактный статус удалённых правил и управление обновлениями.");
  }
  const reputationRow = dom.window.document.querySelector("#reputationEntries .reputation-entry-row");
  if (!reputationRow
    || !reputationRow.querySelector('[data-field="amount"]')
    || !reputationRow.querySelector('[data-field="description"]')
    || !reputationRow.querySelector('[data-field="location"]')) {
    throw new Error("Reputation не переведена на поля количества, причины и места получения.");
  }
  dom.window.document.querySelector("#wizardNext")?.click();
  await new Promise(resolve => setTimeout(resolve, 20));
  if (dom.window.document.querySelector("#attributesPanel")?.hidden) {
    throw new Error("Кнопка «Далее» не открыла этап характеристик.");
  }

  for (let i = 0; i < 2; i += 1) {
    const initialPathRow = [...dom.window.document.querySelectorAll("#paths .talent-row")].find(row => row.textContent.includes("первый Path"));
    const ageButton = initialPathRow?.querySelector("[data-age]");
    if (!ageButton) throw new Error("Не найдена кнопка возрастного повышения первого Path.");
    ageButton.click();
  }
  await new Promise(resolve => setTimeout(resolve, 50));
  const ageText = dom.window.document.querySelector("#ageTalentSummary")?.textContent ?? "";
  if (!ageText.includes("2 из 2")) {
    throw new Error("Возрастной журнал не применил две покупки.");
  }
  const firstAttribute = dom.window.document.querySelector("#attributes input[data-attribute]");
  const ageLedgerBeforeAttributeChange = dom.window.document.querySelector("#ageTalentLedger")?.textContent ?? "";
  firstAttribute.value = String(Math.max(2, Number(firstAttribute.value) - 1));
  firstAttribute.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 30));
  const ageLedgerAfterAttributeChange = dom.window.document.querySelector("#ageTalentLedger")?.textContent ?? "";
  if (!ageLedgerBeforeAttributeChange || ageLedgerAfterAttributeChange !== ageLedgerBeforeAttributeChange) {
    throw new Error("Изменение характеристики обнулило выбранные таланты.");
  }

  const baseXp = dom.window.document.querySelector("#baseXp");
  baseXp.value = "100";
  baseXp.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  if (dom.window.document.querySelector("#xpBudget")?.value !== "20") {
    throw new Error("Редактор не рассчитал 20% Base XP с округлением вверх.");
  }
  const firstSkillRow = dom.window.document.querySelector("#skillsBody tr");
  const skillBuy = firstSkillRow?.querySelector("[data-buy-xp]");
  skillBuy?.click();
  await new Promise(resolve => setTimeout(resolve, 50));
  if (!dom.window.document.querySelector("#xpLedger")?.textContent.includes("XP")) {
    throw new Error("Покупка навыка не попала в журнал Base XP.");
  }
  const inlineSkillUndo = dom.window.document.querySelector("#skillsBody tr [data-undo-xp]");
  if (!inlineSkillUndo || inlineSkillUndo.disabled) {
    throw new Error("Покупку навыка нельзя отменить в той же строке, где она была сделана.");
  }
  inlineSkillUndo.click();
  await new Promise(resolve => setTimeout(resolve, 50));
  if (!dom.window.document.querySelector("#xpLedger")?.textContent.includes("ещё не потрачен")) {
    throw new Error("Встроенная отмена покупки навыка не вернула XP.");
  }
  dom.window.document.querySelector("#skillsBody tr [data-buy-xp]")?.click();
  await new Promise(resolve => setTimeout(resolve, 50));
  if (!dom.window.document.querySelector("#xpLedger .ledger-row .xp-undo")) {
    throw new Error("У отдельных записей журнала Base XP нет кнопки отмены.");
  }
  const firstStartingSkill = dom.window.document.querySelector("#skillsBody input[data-skill]");
  firstStartingSkill.value = "1";
  firstStartingSkill.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 30));
  if (!dom.window.document.querySelector("#xpLedger")?.textContent.includes("XP")) {
    throw new Error("Изменение стартового навыка удалило журнал талантов и заклинаний вместо пересчёта.");
  }

  const biographyStep = [...dom.window.document.querySelectorAll("#wizardSteps .wizard-step")].find(button => button.dataset.step === "biography");
  biographyStep?.click();
  await new Promise(resolve => setTimeout(resolve, 20));
  const partySize = dom.window.document.querySelector("#otherActiveCharacters");
  const publicNote = dom.window.document.querySelector("#bioPublicNote");
  if (!publicNote) throw new Error("Не добавлено отдельное поле публичной заметки для Note листа.");
  if (!publicNote.closest("label")?.textContent.includes("То, что о вас наверняка знают")) throw new Error("Для Note отсутствует требуемое описание.");
  publicNote.value = "Меня знают как молчаливого стражника.";
  publicNote.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  partySize.value = "2";
  partySize.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  dom.window.document.querySelector("#addRumor")?.click();
  dom.window.document.querySelector("#addRumor")?.click();
  await new Promise(resolve => setTimeout(resolve, 20));
  if (dom.window.document.querySelectorAll("#rumors .rumor-row").length !== 2) {
    throw new Error("Редактор слухов не создал две записи.");
  }
  const requestText = dom.window.document.querySelector("#gmRequestDescription");
  requestText.value = "Тестовый запрос";
  dom.window.document.querySelector("#addGmRequest")?.click();
  await new Promise(resolve => setTimeout(resolve, 20));
  if (dom.window.document.querySelectorAll("#gmRequests .gm-request-row").length !== 1) {
    throw new Error("Редактор запросов ГМу не создал запись.");
  }

  if (dom.window.document.querySelector("#applyConceptHelper") || dom.window.document.querySelector(".concept-helper")) {
    throw new Error("Удалённый помощник концепции всё ещё присутствует в интерфейсе.");
  }

  const reviewStep = [...dom.window.document.querySelectorAll("#wizardSteps .wizard-step")].find(button => button.dataset.step === "review");
  reviewStep?.click();
  await new Promise(resolve => setTimeout(resolve, 20));
  const reviewText = dom.window.document.querySelector("#reviewSheet")?.textContent ?? "";
  if (!reviewText.includes("Reputation") || !reviewText.includes("Ответы о персонаже") || !reviewText.includes("Пожелания по снаряжению")) {
    throw new Error("Итоговый лист не содержит полную анкету персонажа.");
  }
  if (dom.window.document.querySelector("#printSummary") || dom.window.document.querySelector("#downloadHtmlSummary") || dom.window.document.querySelector("#downloadTextSummary")) {
    throw new Error("В итоговой проверке остались лишние экспорты PDF/HTML/TXT.");
  }
  const issueLink = dom.window.document.querySelector("#validationState [data-issue-path]");
  if (!issueLink) throw new Error("Ошибки проверки не стали кликабельными.");
  issueLink.click();
  await new Promise(resolve => setTimeout(resolve, 20));

  const profession = dom.window.document.querySelector("#profession");
  if (!profession.querySelector('option[value="monster-hunter"]')) {
    throw new Error("Профессия Monster Hunter не появилась в браузерном редакторе.");
  }
  profession.value = "monster-hunter";
  profession.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 40));
  const monsterHunterPathNames = [...dom.window.document.querySelectorAll("#initialPath option")].map(option => option.textContent.trim());
  if (!["(MH) Path of the Dossier", "(MH) Path of the Arsenal", "(MH) Path of the Slayer"].every(name => monsterHunterPathNames.includes(name))) {
    throw new Error("В браузерном редакторе отсутствуют Professional Paths Monster Hunter.");
  }

  profession.value = "sorcerer";
  profession.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 80));
  if (dom.window.document.querySelectorAll("#spellCatalog .spell-rank-section").length < 5) {
    throw new Error("Каталог заклинаний не сгруппирован по рангам.");
  }
  if (dom.window.document.querySelectorAll("#spellCatalog .spell-catalog-item").length < 40) {
    throw new Error("Каталог заклинаний не вывел все заклинания доступных школ.");
  }
  const firstSpellName = dom.window.document.querySelector("#spellCatalog .catalog-item-name");
  firstSpellName?.dispatchEvent(new dom.window.MouseEvent("mouseenter", { bubbles: false }));
  await new Promise(resolve => setTimeout(resolve, 10));
  if (tooltip?.hidden || !tooltip.textContent.includes("Rank")) {
    throw new Error("Тултип заклинания не показал описание и ранг.");
  }
  const appSource = fs.readFileSync(path.join(appRoot, "app.js"), "utf8");
  if (!appSource.includes("Изучить и остаться в талантах")) throw new Error("На вкладке талантов нет встроенной покупки обязательного заклинания.");
  if (appSource.includes("Для отмены используйте журнал Base XP")) throw new Error("Заклинания всё ещё требуют перехода в отдельный журнал для отмены покупки.");
  if (!appSource.includes("Отменить покупку XP")) throw new Error("У купленных заклинаний нет встроенной отмены покупки.");
  console.log("Offline app smoke test passed.");
} finally {
  server.close();
}
