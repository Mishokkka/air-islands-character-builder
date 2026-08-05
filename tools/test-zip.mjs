import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createZip, readZip, decodeText, isZip, crc32 } from "../shared/zip.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const bytes = createZip([
  { name: "character.json", data: '{"name":"Люсьен"}\n' },
  { name: "assets/портрет.webp", data: new Uint8Array([1, 2, 3, 4, 5]) }
], { date: new Date("2026-07-12T12:00:00Z") });
assert.equal(isZip(bytes), true);
const entries = readZip(bytes);
assert.equal(JSON.parse(decodeText(entries.get("character.json"))).name, "Люсьен");
assert.deepEqual([...entries.get("assets/портрет.webp")], [1, 2, 3, 4, 5]);
assert.equal(crc32(new Uint8Array([1, 2, 3, 4, 5])), 0x470b99f4);

const sample = new Uint8Array(fs.readFileSync(path.join(root, "samples/test-character.flchar")));
assert.equal(isZip(sample), true);
const sampleEntries = readZip(sample);
const character = JSON.parse(decodeText(sampleEntries.get("character.json")));
assert.equal(character.formatVersion, 7);
assert.equal(character.format, "air-islands-character");
assert.ok(sampleEntries.has("rules.json"));
const embeddedRules = JSON.parse(decodeText(sampleEntries.get("rules.json")));
assert.equal(character.rulesHash, embeddedRules.packageHash);

console.log("ZIP container tests passed.");
