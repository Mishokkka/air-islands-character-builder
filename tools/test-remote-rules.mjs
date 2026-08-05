import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";
import { TextEncoder, TextDecoder } from "node:util";
import { createZip } from "../shared/zip.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const appRoot = path.join(root, "offline-app");
const rules = JSON.parse(fs.readFileSync(path.join(root, "data/generated/air-islands-rules.json"), "utf8"));
const packageBytes = createZip([
  { name: "manifest.json", data: JSON.stringify({ format: "air-islands-rules-package", formatVersion: 1, rules: "rules.json" }) },
  { name: "rules.json", data: JSON.stringify(rules) }
]);
const packageSha256 = crypto.createHash("sha256").update(packageBytes).digest("hex");
const manifest = {
  format: "air-islands-rules-manifest",
  formatVersion: 1,
  rulesVersion: rules.rulesVersion,
  minimumBuilderVersion: "1.2.0",
  package: "current.flrules",
  packageSha256,
  packageSize: packageBytes.length,
  rulesPackageHash: rules.packageHash,
  publishedAt: new Date().toISOString()
};

const contentTypes = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = http.createServer((request, response) => {
  if (request.url === "/rules/manifest.json") {
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end(JSON.stringify(manifest));
    return;
  }
  if (request.url === "/rules/current.flrules") {
    response.writeHead(200, { "Content-Type": "application/zip", "Cache-Control": "no-store" }).end(packageBytes);
    return;
  }
  const relative = request.url === "/" ? "index.html" : request.url.replace(/^\//u, "");
  const file = path.resolve(appRoot, relative);
  if (!file.startsWith(appRoot) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return response.writeHead(404).end();
  let content = fs.readFileSync(file);
  if (relative === "index.html") content = Buffer.from(content.toString("utf8").replace(/^\s*<script src="rules\.bundle\.js"><\/script>\s*$/mu, ""));
  response.writeHead(200, { "Content-Type": contentTypes[path.extname(file)] ?? "application/octet-stream" }).end(content);
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
      window.AbortController = globalThis.AbortController;
      window.fetch = (input, init) => fetch(new URL(String(input), window.location.href), init);
      Object.defineProperty(window, "crypto", { configurable: true, value: globalThis.crypto });
      window.alert = () => undefined;
      window.confirm = () => true;
      window.URL.createObjectURL = () => "blob:test";
      window.URL.revokeObjectURL = () => undefined;
    }
  });
  await new Promise(resolve => setTimeout(resolve, 800));
  if (errors.length) throw errors[0];
  const status = dom.window.document.querySelector("#rulesStatusText")?.textContent ?? "";
  if (!status.includes(rules.rulesVersion) || !status.includes("GitHub")) throw new Error(`Удалённые правила не были загружены: ${status}`);
  if (dom.window.document.querySelectorAll("#generalTalentCatalog .catalog-item").length < 70) throw new Error("Каталог не построен из удалённого пакета правил.");
  if (dom.window.AIR_ISLANDS_RULES) throw new Error("Тестовая веб-страница неожиданно использует встроенный rules.bundle.js.");
  console.log("Remote GitHub rules loading test passed.");
} finally {
  server.close();
}
