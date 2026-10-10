import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createServer as createPortProbe } from "node:net";

const ROOT = resolve(process.env.ANIMEART_E2E_ROOT || "dist");
const PORT = Number(process.env.ANIMEART_E2E_PORT || 4173);
const HOST = "127.0.0.1";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

if (!existsSync(join(ROOT, "index.html"))) {
  throw new Error("E2E build output is missing dist/index.html");
}

const server = createServer((request, response) => {
  const requestPath = decodeURIComponent((request.url || "/").split("?")[0]);
  const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const filePath = resolve(ROOT, normalize(relative));
  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const body = readFileSync(filePath);
    response.writeHead(200, { "content-type": mime[extname(filePath)] || "application/octet-stream", "cache-control": "no-store" });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((resolveServer, reject) => {
  server.once("error", reject);
  server.listen(PORT, HOST, resolveServer);
});

const profile = await mkdtemp(join(tmpdir(), "animeart-web-e2e-"));
const chromeCandidates = [
  process.env.CHROME_BIN,
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser"
].filter(Boolean);
const chrome = chromeCandidates.find(existsSync);
if (!chrome) throw new Error("No Chromium/Chrome executable found");

const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms));

const devToolsPort = await new Promise((resolvePort, rejectPort) => {
  const probe = createPortProbe();
  probe.listen(0, HOST, () => {
    const address = probe.address();
    const port = typeof address === "object" && address ? address.port : 0;
    probe.close(() => resolvePort(port));
  });
  probe.once("error", rejectPort);
});

const browser = spawn(chrome, [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  `--remote-debugging-port=${devToolsPort}`,
  "--remote-allow-origins=*",
  `--user-data-dir=${profile}`,
  `http://${HOST}:${PORT}/index.html`
], { stdio: ["ignore", "ignore", "pipe"] });

async function waitForDevTools() {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${devToolsPort}/json/list`);
      const pages = await response.json();
      const page = pages.find(item => item.type === "page" && item.url.includes(`http://${HOST}:${PORT}`));
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(100);
  }
  throw new Error("Chromium DevTools endpoint did not become ready");
}

const wsUrl = await waitForDevTools();
const ws = new WebSocket(wsUrl);
const pending = new Map();
let nextId = 1;

const cdp = (method, params = {}) => new Promise((resolveCdp, rejectCdp) => {
  const id = nextId++;
  pending.set(id, { resolve: resolveCdp, reject: rejectCdp });
  ws.send(JSON.stringify({ id, method, params }));
});

ws.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  if (message.error) waiter.reject(new Error(message.error.message));
  else waiter.resolve(message.result);
});

await new Promise((resolveWs, rejectWs) => {
  ws.addEventListener("open", resolveWs, { once: true });
  ws.addEventListener("error", rejectWs, { once: true });
});

const evaluate = async (expression) => {
  const result = await cdp("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime evaluation failed");
  }
  return result.result?.value;
};

const waitFor = async (expression, timeout = 10000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await evaluate(expression);
    if (value) return value;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
  console.log(`PASS: ${message}`);
};

const selectorCenter = async selector => {
  const rect = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; el.scrollIntoView({ block: "center", inline: "center" }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width, height: r.height }; })()`);
  if (!rect) throw new Error(`Selector not found: ${selector}`);
  return rect;
};

const click = async (selector, modifiers = 0) => {
  const point = await selectorCenter(selector);
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1, modifiers });
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1, modifiers });
  await sleep(120);
};

const mouseDrag = async (start, end, modifiers = 0) => {
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: start.x, y: start.y });
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: start.x, y: start.y, button: "left", buttons: 1, clickCount: 1, modifiers });
  const steps = 8;
  for (let index = 1; index <= steps; index += 1) {
    const progress = index / steps;
    await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: start.x + (end.x - start.x) * progress, y: start.y + (end.y - start.y) * progress, button: "left", buttons: 1, modifiers });
  }
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: end.x, y: end.y, button: "left", buttons: 0, clickCount: 1, modifiers });
  await sleep(180);
};
const mouseStroke = async points => {
  const first = points[0];
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: first.x, y: first.y });
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: first.x, y: first.y, button: "left", buttons: 1, clickCount: 1 });
  for (const point of points.slice(1)) {
    await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y, button: "left", buttons: 1 });
  }
  const last = points.at(-1);
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: last.x, y: last.y, button: "left", buttons: 0, clickCount: 1 });
  await sleep(180);
};

const readDocument = async () => JSON.parse(await evaluate(`localStorage.getItem("animeart-web-document")`));
const readLayerSummary = async () => evaluate(`JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers?.map(layer => ({ id: layer.id, name: layer.name, contentType: layer.contentType, visible: layer.visible, locked: layer.locked, isReference: layer.isReference, transform: layer.transform, strokes: layer.strokes?.length || 0 })) || []`);
const layerSelector = layerId => "#layers li[data-layer-id=\"" + layerId + "\"]";
const layerButtonSelector = layerId => layerSelector(layerId) + " .layer-select";
const layerToggleSelector = (layerId, index) => layerSelector(layerId) + " .layer-controls .layer-toggle:nth-of-type(" + index + ")";


try {
  const downloadDir = join(profile, "downloads");
  await mkdir(downloadDir, { recursive: true });
  await cdp("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir });
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await waitFor(`document.readyState === "complete"`);
  await waitFor(`document.querySelector("#canvas") !== null`);
  await waitFor(`document.documentElement.dataset.serviceWorkerActive === "true"`, 15000);

  assert(await evaluate("document.title") === "AnimeArt Web", "real browser loaded the AnimeArt Web entrypoint");
  const canvas = await selectorCenter("#canvas");
  assert(canvas.width > 0 && canvas.height > 0, "canvas exists and has usable layout dimensions");
  assert(await evaluate(`getComputedStyle(document.querySelector("#canvas")).visibility !== "hidden" && getComputedStyle(document.querySelector("#canvas")).display !== "none"`), "canvas is visible");
  assert((await evaluate('document.querySelector("#status").textContent'))?.includes("CANVAS READY"), "editor reports canvas/service-worker readiness");

  assert(await evaluate('document.querySelectorAll("#layers li").length === 1'), "initial editor state contains one drawing layer");

  await click("#new-document");
  await waitFor('document.querySelector("#project-dialog").open === true');
  await evaluate('(() => { document.querySelector("#document-width").value = "800"; document.querySelector("#document-height").value = "600"; document.querySelector("#document-width").dispatchEvent(new Event("input", { bubbles: true })); document.querySelector("#document-height").dispatchEvent(new Event("input", { bubbles: true })); })()');
  await click('#project-form button[type="submit"]');
  await waitFor('document.querySelector("#status").textContent === "New document created"');
  assert(await evaluate('document.querySelector("#document-width").value === "800" && document.querySelector("#document-height").value === "600"'), "real browser new-document flow accepts exportable document dimensions");

  await click('[data-tool="brush"]');
  const c = await selectorCenter("#canvas");
  await mouseStroke([
    { x: c.x - 100, y: c.y - 50 },
    { x: c.x - 20, y: c.y },
    { x: c.x + 80, y: c.y + 60 }
  ]);
  let documentState = await readDocument();
  assert(documentState.layers[0].strokes.length === 1, "real pointer input creates a stroke");
  assert(documentState.layers[0].strokes[0].points.length >= 3, "stroke contains the real pointer path");

  await click("#add-layer");
  documentState = await readDocument();
  assert(documentState.layers.length === 2, "real layer control creates a second layer");
  const secondLayerId = documentState.layers.at(-1).id;
  await click('[data-tool="brush"]');
  await mouseStroke([
    { x: c.x + 120, y: c.y - 80 },
    { x: c.x + 160, y: c.y - 20 },
    { x: c.x + 200, y: c.y + 40 }
  ]);
  documentState = await readDocument();
  assert(documentState.layers.find(layer => layer.id === secondLayerId)?.strokes.length === 1, "second layer accepts real pointer drawing");

  const initialLayerId = documentState.layers[0].id;
  await click('[data-tool="select"]');
  await click(layerButtonSelector(initialLayerId));
  await click(layerButtonSelector(secondLayerId), 8);
  const selectedLayerIds = await evaluate("Array.from(document.querySelectorAll('#layers li[data-selected=true]')).map(el => el.dataset.layerId)");
  assert(selectedLayerIds.length === 2, "real shift-click selects multiple layers");

  const beforeMulti = await readDocument();
  const multiBefore = selectedLayerIds.map(id => ({ id, x: beforeMulti.layers.find(layer => layer.id === id).transform.x }));
  const dragLayer = beforeMulti.layers.find(layer => layer.id === multiBefore[0].id);
  const dragPoint = dragLayer?.strokes?.[0]?.points?.[0];
  assert(Boolean(dragPoint), "multi-selection has a real drawable hit point");
  const canvasRect = await evaluate('(() => { const r = document.querySelector("#canvas").getBoundingClientRect(); return { left: r.left, top: r.top }; })()');
  await mouseDrag({ x: canvasRect.left + dragPoint.x, y: canvasRect.top + dragPoint.y }, { x: canvasRect.left + dragPoint.x + 50, y: canvasRect.top + dragPoint.y });
  const afterMulti = await readDocument();
  const multiDeltas = multiBefore.map(item => ({
    id: item.id,
    deltaX: afterMulti.layers.find(candidate => candidate.id === item.id).transform.x - item.x
  }));
  console.log("MULTI_SELECTION_DELTAS", JSON.stringify(multiDeltas));
  assert(multiDeltas.every(item => Number.isFinite(item.deltaX) && item.deltaX !== 0), "real multi-selection move changes every selected layer");
  assert(new Set(multiDeltas.map(item => item.deltaX)).size === 1, "real multi-selection move applies one shared translation to all selected layers");
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers?.every(layer => Number.isFinite(layer.transform.x))'), "real multi-selection move persists the committed document state");

  const lifecycleLayerId = multiBefore[0].id;
  await click(layerToggleSelector(lifecycleLayerId, 1));
  let lifecycle = await readLayerSummary();
  assert(lifecycle.find(layer => layer.id === lifecycleLayerId)?.visible === false, "real layer visibility control hides the layer");
  await click(layerToggleSelector(lifecycleLayerId, 1));
  lifecycle = await readLayerSummary();
  assert(lifecycle.find(layer => layer.id === lifecycleLayerId)?.visible === true, "real layer visibility control shows the layer");

  await click(layerToggleSelector(lifecycleLayerId, 2));
  lifecycle = await readLayerSummary();
  assert(lifecycle.find(layer => layer.id === lifecycleLayerId)?.locked === true, "real layer lock control locks the layer");
  await click(layerToggleSelector(lifecycleLayerId, 2));
  lifecycle = await readLayerSummary();
  assert(lifecycle.find(layer => layer.id === lifecycleLayerId)?.locked === false, "real layer lock control unlocks the layer");

  const lifecycleCountBeforeDuplicate = lifecycle.length;
  const lifecycleIdsBeforeDuplicate = new Set(lifecycle.map(layer => layer.id));
  await click(layerSelector(lifecycleLayerId) + ' .layer-action[title="Duplicate layer"]');
  lifecycle = await readLayerSummary();
  assert(lifecycle.length === lifecycleCountBeforeDuplicate + 1, "real layer duplicate creates a new layer");
  const duplicateId = lifecycle.find(layer => !lifecycleIdsBeforeDuplicate.has(layer.id))?.id;
  assert(Boolean(duplicateId), "real layer duplicate has a distinct document id");
  await click(layerSelector(duplicateId) + ' .layer-action[title="Delete layer"]');
  lifecycle = await readLayerSummary();
  assert(lifecycle.length === lifecycleCountBeforeDuplicate, "real layer delete removes the duplicated layer");

  const imageLayerCountBefore = lifecycle.length;
  const imported = await evaluate('(() => { const bytes = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="), char => char.charCodeAt(0)); const file = new File([bytes], "e2e-fixture.png", { type: "image/png" }); const transfer = new DataTransfer(); transfer.items.add(file); const input = document.querySelector("#image-file-input"); input.files = transfer.files; input.dispatchEvent(new Event("change", { bubbles: true })); return true; })()');
  assert(imported === true, "real browser file input accepted an image file");
  await waitFor("JSON.parse(localStorage.getItem(\"animeart-web-document\") || \"{}\").layers?.length === " + (imageLayerCountBefore + 1), 10000);
  const afterImport = await readLayerSummary();
  const importedLayer = afterImport.at(-1);
  assert(importedLayer?.contentType === "image", "real browser image import creates an image layer");
  assert(importedLayer?.name === "e2e-fixture", "real browser image import preserves the image layer name");

  await click("#export-png");
  await waitFor('document.querySelector("#status").textContent !== "Exporting PNG…"', 10000);
  const exportStatus = await evaluate('document.querySelector("#status").textContent');
  assert(exportStatus === "PNG exported", "real browser PNG export completes successfully: " + exportStatus);
  const downloadedPng = join(downloadDir, "animeart.png");
  const downloadDeadline = Date.now() + 10000;
  while (Date.now() < downloadDeadline && !statSync(downloadedPng, { throwIfNoEntry: false })) await sleep(100);
  const pngStat = statSync(downloadedPng, { throwIfNoEntry: false });
  assert(Boolean(pngStat && pngStat.size > 0), "real browser PNG export produces a non-empty downloaded PNG file");

  const persistedBeforeReload = JSON.stringify(await readDocument());
  await cdp("Page.reload", { ignoreCache: true });
  await waitFor('document.readyState === "complete"');
  await waitFor("JSON.stringify(JSON.parse(localStorage.getItem(\"animeart-web-document\"))) === " + JSON.stringify(persistedBeforeReload), 10000);
  const recovered = await readDocument();
  assert(JSON.stringify(recovered) === persistedBeforeReload, "reload recovers the expanded editor document exactly");
  assert(await evaluate('document.querySelector("#layers li:first-child").dataset.selected === "true"'), "reloaded editor restores a valid selected layer");

  const corruptPayload = "{\\"version\\":999,";
  await evaluate("localStorage.setItem(\\"animeart-web-document\\", " + JSON.stringify(corruptPayload) + ")");
  await cdp("Page.reload", { ignoreCache: true });
  await waitFor('document.readyState === "complete"');
  await waitFor('document.querySelector("#storage-recovery-notice").hidden === false');
  assert(await evaluate('localStorage.getItem("animeart-web-document") === ' + JSON.stringify(corruptPayload)), "corrupt project payload is preserved at startup");
  assert((await evaluate('document.querySelector("#status").textContent')).includes("could not be recovered"), "invalid project produces explicit recovery status");

  await click("#new-document");
  await waitFor('document.querySelector("#project-dialog").open === true');
  await evaluate('(() => { document.querySelector("#document-width").value = "640"; document.querySelector("#document-height").value = "480"; })()');
  await click('#project-form button[type="submit"]');
  await waitFor('document.querySelector("#status").textContent === "New document created"');
  const recoveryCanvas = await selectorCenter("#canvas");
  await mouseStroke([
    { x: recoveryCanvas.x - 40, y: recoveryCanvas.y - 20 },
    { x: recoveryCanvas.x, y: recoveryCanvas.y },
    { x: recoveryCanvas.x + 40, y: recoveryCanvas.y + 20 }
  ]);
  assert(await evaluate('localStorage.getItem("animeart-web-document") === ' + JSON.stringify(corruptPayload)), "drawing in a new document cannot overwrite the protected payload");
  await click("#save");
  await waitFor('document.querySelector("#status").textContent === "Saved locally"');
  const explicitlySaved = await readDocument();
  assert(explicitlySaved.width === 640 && explicitlySaved.height === 480, "explicit Save replaces invalid payload with the chosen new document");
  assert(explicitlySaved.layers[0].strokes.length === 1, "explicitly saved replacement preserves current drawing");
  assert(await evaluate('document.querySelector("#storage-recovery-notice").hidden === true'), "explicit successful save clears recovery warning");
  await cdp("Page.reload", { ignoreCache: true });
  await waitFor('document.readyState === "complete"');
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").width === 640');
  assert((await readDocument()).layers[0].strokes.length === 1, "replacement project recovers after a subsequent reload");

  assert(await evaluate('document.documentElement.dataset.serviceWorkerActive === "true"'), "real browser service worker is active");
  assert(await evaluate('document.documentElement.dataset.cacheReady === "true"'), "real browser service worker cache contains the required offline shell");
  console.log("ANIMEART_REAL_WEB_E2E: PASS");
} finally {
  try { ws.close(); } catch {}
  if (!browser.killed) {
    browser.kill("SIGTERM");
    await new Promise(resolveExit => browser.once("exit", resolveExit));
  }
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  await new Promise(resolveClose => server.close(resolveClose));
}
