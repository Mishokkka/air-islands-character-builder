import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { readZip, decodeText } from "../shared/zip.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pages = path.join(root, "dist/pages");
const manifest = JSON.parse(fs.readFileSync(path.join(pages, "rules/manifest.json"), "utf8"));
const packageBytes = new Uint8Array(fs.readFileSync(path.join(pages, "rules", manifest.package)));
const actualSha = crypto.createHash("sha256").update(packageBytes).digest("hex");
if (actualSha !== manifest.packageSha256) throw new Error("SHA-256 опубликованного .flrules не совпадает с манифестом.");
if (packageBytes.length !== manifest.packageSize) throw new Error("Размер опубликованного .flrules не совпадает с манифестом.");
const entries = readZip(packageBytes);
const rules = JSON.parse(decodeText(entries.get("rules.json")));
if (rules.packageHash !== manifest.rulesPackageHash) throw new Error("Внутренний packageHash опубликованных правил не совпадает с манифестом.");
const index = fs.readFileSync(path.join(pages, "index.html"), "utf8");
if (index.includes('src="rules.bundle.js"')) throw new Error("GitHub Pages всё ещё использует встроенный rules.bundle.js.");
for (const file of ["app.js", "core.bundle.js", "zip.bundle.js", "styles.css", "config.js", "sw.js", ".nojekyll"]) {
  if (!fs.existsSync(path.join(pages, file))) throw new Error(`В GitHub Pages отсутствует ${file}.`);
}
console.log("GitHub Pages output checks passed.");
