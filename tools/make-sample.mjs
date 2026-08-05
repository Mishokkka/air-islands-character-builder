import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createZip } from "../shared/zip.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const rules = JSON.parse(fs.readFileSync(path.join(root, "data/generated/air-islands-rules.json"), "utf8"));
const talentBySourceName = new Map(rules.catalogs.talents.items.map(item => [item.sourceName, item]));
const general = rules.catalogs.talents.items.find(item => item.type === "general" && item.name === "Brawler")
  ?? rules.catalogs.talents.items.find(item => item.type === "general");
const initialPath = talentBySourceName.get("(F) Path of the Blade")
  ?? rules.catalogs.talents.items.find(item => item.type === "profession" && item.professions.includes("fighter"));

const skills = Object.fromEntries(rules.skills.map(skill => [skill.id, { startingRank: 0 }]));
Object.assign(skills, {
  might: { startingRank: 2 },
  endurance: { startingRank: 2 },
  melee: { startingRank: 3 },
  crafting: { startingRank: 2 },
  move: { startingRank: 2 }
});

const character = {
  format: "air-islands-character",
  formatVersion: 7,
  rulesVersion: rules.rulesVersion,
  rulesHash: rules.packageHash,
  characterId: "sample-character-1.0.5",
  createdAt: new Date().toISOString(),
  identity: {
    name: "Тестовый персонаж",
    kinId: "human",
    kinVariantId: "gvirl",
    kinFocus: "strength",
    professionId: "fighter",
    originId: "sirosten",
    originDetail: "Никерий",
    citizenship: "Сиростьен",
    religionId: "steel-faith",
    religionDetail: "Светское отношение к вере",
    birthDate: { year: 852, month: "hladohod", day: 1 }
  },
  attributes: { strength: 4, agility: 4, wits: 3, empathy: 3 },
  skills,
  creation: {
    initialPathCatalogId: initialPath.catalogId,
    ageTalentLedger: [
      { id: "age-brawler-1", type: "talent", catalogId: general.catalogId, toRank: 1 },
      { id: "age-brawler-2", type: "talent", catalogId: general.catalogId, toRank: 2 }
    ],
    startingSpells: []
  },
  languages: [
    { languageId: "damian", level: "basic", native: true },
    { languageId: "flech", level: "basic", native: false }
  ],
  languageRolls: [],
  reputation: {
    entries: [
      { id: "rep-city-guard", amount: 1, description: "Известен как надёжный участник городской стражи.", location: "Никерий" }
    ]
  },
  experience: {
    baseTotal: 125,
    ledger: [
      { id: "xp-brawler-3", type: "talent", catalogId: general.catalogId, toRank: 3 },
      { id: "xp-move-3", type: "skill", skillId: "move", toRank: 3 }
    ]
  },
  biography: {
    concept: "Бывший городской стражник, который ищет новую цель.",
    appearance: "Высокий человек в поношенном дорожном плаще.",
    background: "Родился в Сиростьене и несколько лет служил в городской страже.",
    family: "Поддерживает связь с младшей сестрой.",
    pride: "Я не бросаю тех, за кого отвечаю.",
    darkSecret: "Однажды скрыл преступление своего командира.",
    publicNote: "Сдержанный бывший стражник с короткой речью, прямой осанкой и привычкой внимательно осматривать двери и окна.",
    motivation: "Хочет исправить последствия своей старой ошибки.",
    partyConnections: "Готов защищать группу и выполнять тяжёлую работу.",
    physical: {
      height: "184 см", weight: "82 кг", skin: "Светлая", eyes: "Серые",
      hair: "Тёмные, коротко остриженные", distinguishingMarks: "Шрам у левого виска"
    },
    questions: {
      bestFriend: "Старый напарник из городской стражи.",
      favoriteFood: "Густое мясное рагу, которое готовила мать.",
      prejudices: "Не доверяет людям, которые прикрываются чином.",
      aristocracy: "Считает титулы обязанностью, а не правом.",
      favoriteMemory: "Первое самостоятельно раскрытое дело.",
      oneWish: "Вернуть доброе имя своей семье.",
      greatestFear: "Снова промолчать, когда нужно действовать.",
      notes: "Говорит коротко и редко повышает голос."
    },
    otherActiveCharacters: 2,
    rumors: [
      { id: "rumor-true", text: "Он однажды спас целый караван.", truth: "true" },
      { id: "rumor-false", text: "Он продал товарища за серебро.", truth: "false" }
    ]
  },
  equipmentRequest: "Старая сабля, плотный плащ и памятный жетон стражи.",
  gmRequests: [
    { id: "request-background", category: "unusual-background", description: "Проверить, может ли бывшая служба дать знакомого в городской страже." }
  ],
  assets: { portrait: null, token: null }
};

const characterJson = `${JSON.stringify(character, null, 2)}\n`;
fs.writeFileSync(path.join(root, "samples/test-character.json"), characterJson, "utf8");
const manifest = {
  format: "air-islands-character-package",
  packageVersion: 3,
  character: "character.json",
  rules: "rules.json",
  assets: {},
  createdAt: character.createdAt,
  rulesVersion: character.rulesVersion,
  rulesHash: character.rulesHash
};
const packageBytes = createZip([
  { name: "manifest.json", data: `${JSON.stringify(manifest, null, 2)}\n` },
  { name: "character.json", data: characterJson },
  { name: "rules.json", data: `${JSON.stringify(rules)}\n` }
]);
fs.writeFileSync(path.join(root, "samples/test-character.flchar"), packageBytes);
