import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const readJson = file => JSON.parse(fs.readFileSync(file, "utf8"));
const readJsonIfExists = file => fs.existsSync(file) ? readJson(file) : null;
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const baseRules = readJson(path.join(root, "data/base-rules.json"));
const talentsSource = readJson(path.join(root, "data/source/Talents.json"));
const spellsSource = readJson(path.join(root, "data/source/Spells.json"));
const previousRules = readJsonIfExists(path.join(root, "data/generated/air-islands-rules.json"));

function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function cleanSnapshot(source) {
  const snapshot = structuredClone(source);
  for (const key of ["_id", "folder", "sort", "_stats", "ownership"]) delete snapshot[key];
  if (snapshot.flags) {
    delete snapshot.flags["scene-packer"];
    if (!Object.keys(snapshot.flags).length) delete snapshot.flags;
  }
  return snapshot;
}

function normalizedTalentName(name, type) {
  if (type === "kin") return name.replace(/\s*(?:\(1\)|\[1\])\s*$/u, "").trim();
  if (name === "(F) Path of the Enemy (Alternate)") return "(F) Path of the Enemy";
  if (name.includes("Path of the Bullet")) return "(F) Path of the Bullet";
  if (name === "Physican") return "Physician";
  return name;
}

function normalizedKeyText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, " ");
}

function talentStableKey(name, type) {
  return `${type}:${normalizedKeyText(normalizedTalentName(name, type))}`;
}

function spellStableKey(name, discipline, rank) {
  return `${normalizedKeyText(discipline)}:${Number(rank) || 0}:${normalizedKeyText(name)}`;
}

const previousTalentIds = new Map(
  (previousRules?.catalogs?.talents?.items ?? []).map(entry => [talentStableKey(entry.name ?? entry.sourceName, entry.type ?? "general"), entry.catalogId])
);
const previousSpellIds = new Map(
  (previousRules?.catalogs?.spells?.items ?? []).map(entry => [spellStableKey(entry.name, entry.discipline, entry.rank), entry.catalogId])
);

function pathKey(name) {
  const stripped = name
    .replace(/^\([^)]*\)\s*/u, "")
    .replace(/\s*\(Alternate\)\s*$/iu, "")
    .replace(/\s*\(Arrow\)\s*$/iu, "")
    .replace(/^Path\s+Of\s+/iu, "Path of ")
    .replace(/^Path\s+of\s+the\s+/iu, "")
    .replace(/^Path\s+of\s+/iu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `path-of-${stripped}`;
}

function professionAccess(name) {
  if (name.startsWith("(S/D)")) return ["sorcerer", "druid"];
  if (name.includes("Path of the Bullet")) return ["fighter"];
  const prefix = name.match(/^\(([^)]+)\)/u)?.[1];
  return {
    C: ["champion"],
    D: ["druid"],
    F: ["fighter"],
    H: ["hunter"],
    M: ["minstrel"],
    P: ["peddler"],
    R: ["rider"],
    Rg: ["rogue"],
    S: ["sorcerer"],
    MH: ["monster-hunter"]
  }[prefix] ?? [];
}

function spellPathKeyForDiscipline(discipline) {
  const entry = Object.entries(baseRules.spellDisciplineMap).find(([, value]) => value === discipline);
  return entry?.[0] ?? null;
}

const excludedTalentNames = new Set(["(F) Path of the Enemy"]);
const talents = talentsSource.items
  .filter(item => !excludedTalentNames.has(item.name))
  .map(item => {
    const type = item.system?.type ?? "general";
    const snapshot = cleanSnapshot(item);
    snapshot.name = normalizedTalentName(item.name, type);
    const entry = {
      catalogId: previousTalentIds.get(talentStableKey(snapshot.name, type)) ?? `talent:${talentsSource.package}:${item._id}`,
      sourceUuid: `Compendium.${talentsSource.package}.Item.${item._id}`,
      sourceId: item._id,
      sourceName: item.name,
      name: snapshot.name,
      type,
      image: item.img,
      maximumRank: 5,
      snapshot,
      hash: hash(snapshot)
    };
    if (type === "profession") {
      entry.pathKey = pathKey(item.name);
      entry.professions = professionAccess(item.name);
      entry.magical = entry.professions.some(id => id === "druid" || id === "sorcerer");
      entry.disciplineKey = entry.pathKey.replace(/^path-of-/u, "");
    }
    return entry;
  });

const kinBySourceName = new Map(talents.filter(item => item.type === "kin").map(item => [item.sourceName, item.catalogId]));
for (const kin of baseRules.kin) {
  kin.talentCatalogId = kinBySourceName.get(kin.talentSourceName) ?? null;
}

const spells = spellsSource.items.map(item => {
  const snapshot = cleanSnapshot(item);
  const discipline = item.flags?.["spell-compendium-builder"]?.discipline ?? "Unknown";
  const rank = Number.parseInt(item.system?.rank, 10) || 0;
  return {
    catalogId: previousSpellIds.get(spellStableKey(item.name, discipline, rank)) ?? `spell:${spellsSource.package}:${item._id}`,
    sourceUuid: `Compendium.${spellsSource.package}.Item.${item._id}`,
    sourceId: item._id,
    name: item.name,
    image: item.img,
    rank,
    discipline,
    disciplineKey: spellPathKeyForDiscipline(discipline),
    spellType: item.system?.spellType ?? "SPELL.SPELL",
    snapshot,
    hash: hash(snapshot)
  };
});

const professionPaths = {};
for (const profession of baseRules.professions) professionPaths[profession.id] = [];
for (const talent of talents.filter(item => item.type === "profession")) {
  for (const profession of talent.professions) professionPaths[profession]?.push(talent.catalogId);
}
for (const ids of Object.values(professionPaths)) ids.sort();

const hashPayload = {
  ...baseRules,
  catalogs: {
    talents: {
      package: talentsSource.package,
      metadata: talentsSource.metadata,
      items: talents
    },
    spells: {
      package: spellsSource.package,
      metadata: spellsSource.metadata,
      items: spells
    }
  },
  professionPaths,
  sourceHashes: {
    talents: hash(talentsSource),
    spells: hash(spellsSource)
  }
};
const output = {
  ...hashPayload,
  generatedAt: new Date().toISOString(),
  packageHash: hash(hashPayload)
};

const generatedDir = path.join(root, "data/generated");
writeJson(path.join(generatedDir, "air-islands-rules.json"), output);
fs.writeFileSync(
  path.join(generatedDir, "rules.bundle.js"),
  `globalThis.AIR_ISLANDS_RULES = ${JSON.stringify(output)};\n`,
  "utf8"
);

const foundryDataDir = path.join(root, "foundry-module/data");
writeJson(path.join(foundryDataDir, "air-islands-rules.json"), output);

console.log(`Generated ${talents.length} talents and ${spells.length} spells.`);
console.log(`Package hash: ${output.packageHash}`);
