import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

await build({
  entryPoints: [path.join(root, "shared/core.mjs")],
  bundle: true,
  format: "iife",
  globalName: "AirIslandsCore",
  outfile: path.join(root, "offline-app/core.bundle.js")
});

await build({
  entryPoints: [path.join(root, "shared/zip.mjs")],
  bundle: true,
  format: "iife",
  globalName: "AirIslandsZip",
  outfile: path.join(root, "offline-app/zip.bundle.js")
});

fs.copyFileSync(
  path.join(root, "data/generated/rules.bundle.js"),
  path.join(root, "offline-app/rules.bundle.js")
);
fs.copyFileSync(
  path.join(root, "shared/core.mjs"),
  path.join(root, "foundry-module/scripts/core.mjs")
);
fs.copyFileSync(
  path.join(root, "shared/zip.mjs"),
  path.join(root, "foundry-module/scripts/zip.mjs")
);

console.log("Offline browser bundles and Foundry shared modules generated.");
