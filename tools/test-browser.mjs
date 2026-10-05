import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createZip } from "../shared/zip.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, ".test-artifacts");
fs.mkdirSync(output, { recursive: true });
const browser = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
let nextManifest = null, nextPackage = null;
const server = http.createServer((req, res) => {
  if (nextManifest && req.url === "/dist/pages/rules/manifest.json") return res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end(JSON.stringify(nextManifest));
  if (nextPackage && req.url === "/dist/pages/rules/test-update.flrules") return res.writeHead(200, { "Content-Type": "application/zip", "Cache-Control": "no-store" }).end(nextPackage);
  let file = path.resolve(root, "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
  res.setHeader("Content-Type", { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" }[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const proc = spawn(browser, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${path.join(output, "chrome-profile")}`, "about:blank"], { windowsHide: true });
let socket;
try {
  const endpoint = await new Promise((resolve, reject) => {
    let buffer = "";
    const timeout = setTimeout(() => reject(Error("Chrome startup timeout")), 2e4);
    proc.on("error", reject);
    proc.stderr.on("data", (data) => {
      buffer += data;
      const m = buffer.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (m) {
        clearTimeout(timeout);
        resolve(m[1]);
      }
    });
  });
  const targets = await fetch(`http://${new URL(endpoint).host}/json`).then((r) => r.json());
  socket = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => socket.addEventListener("open", r, { once: true }));
  let id = 0;
  const pending = /* @__PURE__ */ new Map(), errors = [];
  socket.addEventListener("message", (event) => {
    const m = JSON.parse(event.data);
    if (pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id;
    const timeout = setTimeout(() => {
      pending.delete(key);
      reject(Error(`CDP timeout: ${method}`));
    }, 2e4);
    pending.set(key, (m) => {
      clearTimeout(timeout);
      m.error ? reject(Error(JSON.stringify(m.error))) : resolve(m.result);
    });
    socket.send(JSON.stringify({ id: key, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result?.value;
  };
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const viewport = (width, height = 1e3) => call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 800 });
  const shot = async (name) => {
    const result = await call("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(output, name + ".png"), Buffer.from(result.data, "base64"));
  };
  await call("Runtime.enable");
  await call("Page.enable");
  await viewport(1440);
  await call("Page.navigate", { url: base + "/offline-app/index.html" });
  await pause(800);
  const sample = JSON.parse(fs.readFileSync(path.join(root, "samples/test-character.json"), "utf8"));
  await evaluate(`localStorage.setItem('air-islands-character-builder:draft:v7',${JSON.stringify(JSON.stringify(sample))});localStorage.removeItem('air-islands-character-builder:step:v7')`);
  await call("Page.reload");
  await pause(1e3);
  assert.equal(await evaluate('document.querySelector("#exportCharacter").disabled'), false, "Sample must remain exportable");
  await evaluate(`window.exportedPackage=null;window.originalObjectURL=URL.createObjectURL;URL.createObjectURL=blob=>{if(blob.type==='application/zip')window.exportedPackage=blob;return window.originalObjectURL(blob)};HTMLAnchorElement.prototype.click=function(){};document.querySelector('#exportCharacter').click()`);
  await pause(100);
  const exported = await evaluate(`(async()=>{const bytes=new Uint8Array(await window.exportedPackage.arrayBuffer());const entries=AirIslandsZip.readZip(bytes);const character=JSON.parse(AirIslandsZip.decodeText(entries.get('character.json')));const rules=JSON.parse(AirIslandsZip.decodeText(entries.get('rules.json')));return {manifest:JSON.parse(AirIslandsZip.decodeText(entries.get('manifest.json'))),character,valid:AirIslandsCore.validateCharacter(character,rules).valid,actor:AirIslandsCore.characterToActorData(character,rules).actorData.name};})()`);
  assert.equal(exported.manifest.packageVersion, 3);
  assert.equal(exported.character.formatVersion, 8);
  assert.equal(exported.character.characterId, sample.characterId);
  assert.deepEqual(exported.character.experience.ledger, sample.experience.ledger);
  assert.equal(exported.valid, true);
  assert.equal(exported.actor, sample.identity.name);
  await shot("identity-desktop");
  await evaluate('document.querySelector(".wizard-step[data-step=attributes]").click()');
  const focus = await evaluate(`(()=>{const f=document.querySelector('#attributes input');f.focus();f.value=String(Number(f.value)-1);f.dispatchEvent(new Event('input',{bubbles:true}));return {connected:f.isConnected,focused:document.activeElement===f}})()`);
  assert.deepEqual(focus, { connected: true, focused: true });
  await evaluate('document.querySelector("#undoEdit").click()');
  assert.equal(await evaluate('document.querySelector("#exportCharacter").disabled'), false, "Undo must recover validity");
  await evaluate('document.querySelector(".wizard-step[data-step=talents]").click()');
  await pause(100);
  const columns = await evaluate('getComputedStyle(document.querySelector("#generalTalentCatalog")).gridTemplateColumns.split(" ").length');
  assert.equal(columns, 3);
  await shot("talents-desktop");
  assert.equal(await evaluate(`(()=>{const name=document.querySelector('#generalTalentCatalog .catalog-item-name');name.dispatchEvent(new MouseEvent('mouseenter'));return !document.querySelector('#catalogTooltip').hidden&&document.querySelector('#catalogTooltip').textContent.length>100})()`), true);
  await shot("talent-tooltip");
  await evaluate('document.querySelector("#generalTalentCatalog .catalog-item-name").click()');
  assert.equal(await evaluate('document.querySelector("#catalogDetail").hidden'), false);
  await shot("talent-detail");
  await evaluate('document.querySelector("#closeDetail").click();document.querySelector("#talentSearch").value="zzzz-no-match";document.querySelector("#talentSearch").dispatchEvent(new Event("input"))');
  assert.equal(await evaluate('document.querySelector("#talentEmpty").hidden'), false);
  await evaluate('document.querySelector("#talentSearch").value="";document.querySelector("#talentSearch").dispatchEvent(new Event("input"))');
  for (const width of [390, 320, 768]) {
    await viewport(width, 844);
    await pause(70);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, `Overflow at ${width}`);
    assert.equal(await evaluate('document.querySelector("#foundationDetails").open'), width > 720);
    if (width === 390) await shot("talents-mobile");
  }
  await viewport(1440);
  await evaluate(`document.querySelector('.wizard-step[data-step=identity]').click();document.querySelector('#kin').value='mortar';document.querySelector('#kin').dispatchEvent(new Event('change',{bubbles:true}));`);
  await pause(80);
  if (await evaluate('document.querySelector("#editorDialog").open')) await evaluate('document.querySelector("#dialogAccept").click()');
  await pause(150);
  assert.equal(await evaluate('document.querySelector("#profession").disabled'), true);
  assert.equal(await evaluate('document.querySelectorAll("#mortarProtocolCatalog .catalog-item").length'), 6);
  const mutations = await evaluate("new Promise(resolve=>{let n=0;const o=new MutationObserver(x=>n+=x.length);o.observe(document.body,{childList:true,subtree:true,characterData:true});setTimeout(()=>{o.disconnect();resolve(n)},500)})");
  assert.equal(mutations, 0, "Idle Mortar must not mutate DOM");
  await evaluate('document.querySelector(".wizard-step[data-step=talents]").click()');
  await pause(70);
  await shot("mortar-desktop");
  await call("Page.navigate", { url: base + "/dist/pages/index.html" });
  await pause(1200);
  await evaluate("navigator.serviceWorker.ready");
  await pause(150);
  assert.equal(await evaluate('document.querySelectorAll(".wizard-step").length'), 8);
  await call("Network.enable");
  await call("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await call("Page.reload");
  await pause(900);
  assert.equal(await evaluate('document.querySelectorAll("#generalTalentCatalog .catalog-item").length > 70'), true, "Cached Pages must boot offline");
  await call("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  const cachedHash = () => evaluate(`new Promise((resolve,reject)=>{const request=indexedDB.open('air-islands-character-builder-rules');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;const read=db.transaction('state').objectStore('state').get('current');read.onsuccess=()=>{resolve(read.result.activeHash);db.close()};read.onerror=()=>reject(read.error)}})`);
  const previousHash = await cachedHash();
  const nextRules = JSON.parse(fs.readFileSync(path.join(root, "data/generated/air-islands-rules.json"), "utf8"));
  nextRules.packageHash = "test-update";
  nextRules.rulesVersion = "test-update";
  nextPackage = createZip([{ name: "rules.json", data: JSON.stringify(nextRules) }]);
  nextManifest = { format: "air-islands-rules-manifest", formatVersion: 1, rulesVersion: nextRules.rulesVersion, minimumBuilderVersion: "2.0.0", package: "test-update.flrules", packageSha256: crypto.createHash("sha256").update(nextPackage).digest("hex"), packageSize: nextPackage.length, rulesPackageHash: nextRules.packageHash };
  await call("Page.reload");
  await pause(1e3);
  assert.equal(await evaluate('document.querySelector("#editorDialog").open'), true);
  await evaluate('document.querySelector("#dialogCancel").click()');
  await pause(100);
  assert.equal(await cachedHash(), previousHash, "Declining must not activate downloaded rules");
  await call("Page.reload");
  await pause(1e3);
  assert.equal(await cachedHash(), previousHash, "Reload must retain the declined rules decision");
  assert.equal(await evaluate('document.querySelector("#editorDialog").open'), true);
  await evaluate('document.querySelector("#dialogAccept").click()');
  await pause(300);
  assert.equal(await cachedHash(), nextManifest.packageSha256, "Accepting must activate the package");
  await call("Page.navigate", { url: pathToFileURL(path.join(root, "offline-app/index.html")).href });
  await pause(800);
  assert.equal(await evaluate('document.querySelectorAll("#generalTalentCatalog .catalog-item").length > 70'), true, "Standalone file must boot without a server");
  assert.deepEqual(errors, [], "No uncaught browser errors");
  console.log(JSON.stringify({ focus, columns, mortarIdleMutations: mutations, exportRoundTrip: true, offlinePages: true, rulesUpdateDecision: true, standaloneFile: true, viewports: [1440, 390, 320, 768], screenshots: output }));
} finally {
  socket?.close();
  proc.kill();
  server.closeAllConnections();
  server.close();
}
