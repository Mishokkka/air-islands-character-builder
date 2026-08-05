import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createZip } from "../shared/zip.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist/pages");
const appDir = path.join(root, "offline-app");
const rules = JSON.parse(fs.readFileSync(path.join(root, "data/generated/air-islands-rules.json"), "utf8"));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(path.join(output, "rules"), { recursive: true });

for (const filename of ["app.js", "core.bundle.js", "zip.bundle.js", "styles.css", "sw.js"]) {
  fs.copyFileSync(path.join(appDir, filename), path.join(output, filename));
}

let indexHtml = fs.readFileSync(path.join(appDir, "index.html"), "utf8");
indexHtml = indexHtml.replace(/^\s*<script src="rules\.bundle\.js"><\/script>\s*$/mu, "");
fs.writeFileSync(path.join(output, "index.html"), indexHtml, "utf8");
fs.writeFileSync(path.join(output, "404.html"), indexHtml, "utf8");
fs.writeFileSync(path.join(output, ".nojekyll"), "", "utf8");
fs.writeFileSync(path.join(output, "config.js"), `globalThis.AIR_ISLANDS_CONFIG = ${JSON.stringify({
  builderVersion: packageJson.version,
  rulesManifestUrl: "./rules/manifest.json",
  remoteCheckTimeoutMs: 8000
}, null, 2)};\n`, "utf8");

const innerManifest = {
  format: "air-islands-rules-package",
  formatVersion: 1,
  rules: "rules.json",
  rulesVersion: rules.rulesVersion,
  rulesPackageHash: rules.packageHash,
  generatedAt: rules.generatedAt
};
const packageBytes = createZip([
  { name: "manifest.json", data: `${JSON.stringify(innerManifest, null, 2)}\n` },
  { name: "rules.json", data: `${JSON.stringify(rules)}\n` }
]);
const packageSha256 = crypto.createHash("sha256").update(packageBytes).digest("hex");
const safeVersion = String(rules.rulesVersion).replace(/[^a-zA-Z0-9._-]+/gu, "-");
const filename = `air-islands-rules-${safeVersion}-${packageSha256.slice(0, 8)}.flrules`;
fs.writeFileSync(path.join(output, "rules", filename), packageBytes);

const manifest = {
  format: "air-islands-rules-manifest",
  formatVersion: 1,
  rulesVersion: rules.rulesVersion,
  minimumBuilderVersion: rules.minimumBuilderVersion ?? "1.2.0",
  package: filename,
  packageSha256,
  packageSize: packageBytes.length,
  rulesPackageHash: rules.packageHash,
  publishedAt: rules.generatedAt ?? new Date().toISOString()
};
fs.writeFileSync(path.join(output, "rules/manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(output, "version.json"), `${JSON.stringify({ builderVersion: packageJson.version, rulesVersion: rules.rulesVersion, rulesPackageHash: rules.packageHash }, null, 2)}\n`, "utf8");

console.log(`GitHub Pages site generated at ${output}`);
console.log(`Rules package: ${filename}`);
