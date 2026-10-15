import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";
import { spawn } from "node:child_process";
import { inflateSync } from "node:zlib";
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

const readServiceWorkerDiagnostics = async () => evaluate(`(async () => {
  const root = document.documentElement;
  const registration = await navigator.serviceWorker?.getRegistration().catch(() => null);
  return {
    serviceWorkerActive: root.dataset.serviceWorkerActive ?? null,
    cacheReady: root.dataset.cacheReady ?? null,
    status: document.querySelector("#status")?.textContent ?? null,
    cacheMissing: root.dataset.cacheMissing ?? null,
    controllerState: navigator.serviceWorker?.controller?.state ?? null,
    registrationState: registration?.active?.state
      ?? registration?.waiting?.state
      ?? registration?.installing?.state
      ?? null
  };
})()`);

const waitForServiceWorkerReadiness = async (timeout = 15000) => {
  const deadline = Date.now() + timeout;
  let diagnostics;
  while (Date.now() < deadline) {
    diagnostics = await readServiceWorkerDiagnostics();
    if (diagnostics.serviceWorkerActive === "true" && diagnostics.cacheReady === "true") {
      return diagnostics;
    }
    await sleep(100);
  }
  diagnostics = await readServiceWorkerDiagnostics();
  throw new Error(`Timed out waiting for Service Worker and offline cache readiness: ${JSON.stringify(diagnostics)}`);
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
  console.log(`PASS: ${message}`);
};

const screenshotDir = join(ROOT, "e2e-artifacts");
await mkdir(screenshotDir, { recursive: true });
const saveScreenshot = async filename => {
  const result = await cdp("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false
  });
  if (!result?.data) throw new Error("Chromium did not return screenshot data");
  await writeFile(join(screenshotDir, filename), Buffer.from(result.data, "base64"));
  console.log(`E2E_SCREENSHOT: ${join("dist", "e2e-artifacts", filename)}`);
};

const selectorCenter = async selector => {
  const rect = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const details = el.closest("details"); if (details && !details.open) details.open = true; el.scrollIntoView({ block: "center", inline: "center" }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width, height: r.height }; })()`);
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

const inspectPngAlpha = bytes => {
  if (bytes.toString("hex", 0, 8) !== "89504e470d0a1a0a") throw new Error("Export is not a PNG");
  let offset = 8, width = 0, height = 0, bitDepth = 0, colorType = 0;
  const imageData = [];
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === "IDAT") imageData.push(data);
    else if (type === "IEND") break;
    offset += 12 + length;
  }
  if (bitDepth !== 8 || colorType !== 6 || width < 1 || height < 1) {
    throw new Error("PNG export must be 8-bit RGBA to preserve transparency");
  }
  const raw = inflateSync(Buffer.concat(imageData));
  const stride = width * 4, previous = Buffer.alloc(stride);
  let cursor = 0, foundTransparentPixel = false;
  const paeth = (a,b,c) => {
    const p=a+b-c, pa=Math.abs(p-a), pb=Math.abs(p-b), pc=Math.abs(p-c);
    return pa<=pb&&pa<=pc?a:pb<=pc?b:c;
  };
  for (let y=0; y<height; y++) {
    const filter=raw[cursor++], row=Buffer.from(raw.subarray(cursor,cursor+stride)); cursor+=stride;
    for (let i=0; i<stride; i++) {
      const left=i>=4?row[i-4]:0, up=previous[i]||0, upperLeft=i>=4?previous[i-4]:0;
      if (filter===1) row[i]=(row[i]+left)&255;
      else if (filter===2) row[i]=(row[i]+up)&255;
      else if (filter===3) row[i]=(row[i]+Math.floor((left+up)/2))&255;
      else if (filter===4) row[i]=(row[i]+paeth(left,up,upperLeft))&255;
      else if (filter!==0) throw new Error("Unsupported PNG filter " + filter);
    }
    for (let i=3; i<stride; i+=4) if (row[i] < 255) { foundTransparentPixel=true; break; }
    row.copy(previous);
    if (foundTransparentPixel) break;
  }
  return { width, height, bitDepth, colorType, foundTransparentPixel };
};



try {
  const downloadDir = join(profile, "downloads");
  await mkdir(downloadDir, { recursive: true });
  await cdp("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir });
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await waitFor(`document.readyState === "complete"`);
  await waitFor(`document.querySelector("#canvas") !== null`);
  await waitForServiceWorkerReadiness();

  assert(await evaluate("document.title") === "AnimeArt Studio | Image Editor", "real browser loaded the AnimeArt Studio entrypoint");
  const canvas = await selectorCenter("#canvas");
  assert(canvas.width > 0 && canvas.height > 0, "canvas exists and has usable layout dimensions");
  assert(await evaluate(`getComputedStyle(document.querySelector("#canvas")).visibility !== "hidden" && getComputedStyle(document.querySelector("#canvas")).display !== "none"`), "canvas is visible");
  assert((await evaluate('document.querySelector("#status").textContent'))?.includes("CANVAS READY"), "editor reports canvas/service-worker readiness");
  assert(await evaluate('document.querySelector("#canvas-import-images").getBoundingClientRect().width > 0 && document.querySelector("#canvas-open-asset-library").getBoundingClientRect().width > 0'), "image import and reusable library remain visible next to the canvas without scrolling");
  assert(await evaluate('document.querySelector(".canvas-view-menu").open === false'), "transparency and canvas-background controls stay tucked inside the collapsed View menu");

  assert(await evaluate('document.querySelectorAll("#layers li").length === 1'), "initial editor state contains one drawing layer");
  await saveScreenshot("animeart-studio-initial.png");

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
  const dragStartScreen = await evaluate('(() => { const canvas = document.querySelector("#canvas"); const rect = canvas.getBoundingClientRect(); const doc = JSON.parse(localStorage.getItem("animeart-web-document")); const ids = ' + JSON.stringify(selectedLayerIds) + '; const points = doc.layers.filter(layer => ids.includes(layer.id)).flatMap(layer => layer.strokes.flatMap(stroke => stroke.points)); if (!points.length) return null; const minX = Math.min(...points.map(point => point.x)); const maxX = Math.max(...points.map(point => point.x)); const minY = Math.min(...points.map(point => point.y)); const maxY = Math.max(...points.map(point => point.y)); const point = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }; const fitScale = Math.min(rect.width / doc.width, rect.height / doc.height); return { x: rect.left + rect.width / 2 + (point.x - doc.width / 2) * fitScale, y: rect.top + rect.height / 2 + (point.y - doc.height / 2) * fitScale }; })()');
  assert(Boolean(dragStartScreen), "multi-selection has a group-bounds interior hit point away from corner handles");
  await mouseDrag(dragStartScreen, { x: dragStartScreen.x + 50, y: dragStartScreen.y });
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
  await click('[aria-label="Select e2e-fixture"]');
  await evaluate('(() => { const slider = document.querySelector("#adjustment-brightness"); slider.value = "125"; slider.dispatchEvent(new Event("input", { bubbles: true })); slider.dispatchEvent(new Event("change", { bubbles: true })); })()');
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.some(layer => layer.name === "e2e-fixture" && layer.adjustments?.brightness === 125)', 10000);
  assert(await evaluate('document.querySelector("#adjustment-brightness").value === "125"'), "real browser previews a non-destructive image adjustment");
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.some(layer => layer.name === "e2e-fixture" && layer.adjustments?.brightness === 125)'), "real browser persists the image adjustment in the existing project document");

  assert(await evaluate('document.querySelector("#selection-mini-panel").hidden === false'), "selecting an image exposes its floating layer-action panel");
  await click("#selection-mini-lock");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.find(layer => layer.name === "e2e-fixture")?.locked === true', 10000);
  await click("#selection-mini-lock");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.find(layer => layer.name === "e2e-fixture")?.locked === false', 10000);
  const imageOrderBefore = await evaluate('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.findIndex(layer => layer.name === "e2e-fixture")');
  await click("#selection-mini-back");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.findIndex(layer => layer.name === "e2e-fixture") < ' + imageOrderBefore, 10000);
  await click("#selection-mini-front");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.findIndex(layer => layer.name === "e2e-fixture") === ' + imageOrderBefore, 10000);




  // AA-UX-DELETE-001: exercise the visible X against two distinct image-layer IDs.
  const importNamedFixture = async name => {
    const addedBefore = (await readLayerSummary()).length;
    const accepted = await evaluate('(() => { const bytes = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="), char => char.charCodeAt(0)); const file = new File([bytes], ' + JSON.stringify(name + ".png") + ', { type: "image/png" }); const transfer = new DataTransfer(); transfer.items.add(file); const input = document.querySelector("#image-file-input"); input.files = transfer.files; input.dispatchEvent(new Event("change", { bubbles: true })); return true; })()');
    assert(accepted === true, "real browser accepted image fixture " + name);
    await waitFor("JSON.parse(localStorage.getItem(\"animeart-web-document\") || \"{}\").layers?.length === " + (addedBefore + 1), 10000);
    return (await readDocument()).layers.at(-1);
  };
  const deleteFirst = await importNamedFixture("delete-first");
  const keepSecond = await importNamedFixture("keep-second");
  assert(deleteFirst.id !== keepSecond.id, "two imported images have distinct stable layer IDs");
  await click('[aria-label="Select delete-first"]');
  assert(await evaluate('document.querySelector("#selection-indicator").textContent.includes("Imagen seleccionada: delete-first")'), "selected image is identified by a visible label, not only a blue outline");
  assert(await evaluate('!document.querySelector("#remove-selected-image").hidden'), "the X control is visible for the selected image");
  await click("#remove-selected-image");
  let afterX = await readDocument();
  assert(!afterX.layers.some(layer => layer.id === deleteFirst.id), "pressing the X removes the exact selected image ID");
  assert(afterX.layers.some(layer => layer.id === keepSecond.id && layer.image?.source), "the second image remains intact after the first is removed");
  await click("#undo");
  const afterUndo = await readDocument();
  assert(afterUndo.layers.some(layer => layer.id === deleteFirst.id && layer.image?.source), "Undo restores the removed first image with its original ID");
  assert(afterUndo.layers.some(layer => layer.id === keepSecond.id && layer.image?.source), "Undo leaves the second image intact");
  await click("#export-transparent-png");
  await waitFor('document.querySelector("#status").textContent.includes("PNG exported")', 10000);
  let pngPath = join(downloadDir, "animeart.png");
  for (let attempt=0; attempt<60 && !existsSync(pngPath); attempt++) await sleep(100);
  assert(existsSync(pngPath), "real browser exports the composition as a downloadable PNG");
  const alphaReport = inspectPngAlpha(await (await import("node:fs/promises")).readFile(pngPath));
  console.log("AA_UX_DELETE_PNG_ALPHA", JSON.stringify(alphaReport));
  assert(alphaReport.foundTransparentPixel, "exported PNG contains actual alpha<255 pixels, not an opaque checkerboard background");

  const layersBeforeSample = (await readLayerSummary()).length;
  await click("#add-sample-character");
  await waitFor("JSON.parse(localStorage.getItem(\"animeart-web-document\") || \"{}\").layers?.length === " + (layersBeforeSample + 1), 15000);
  const cc0Sample = (await readDocument()).layers.at(-1);
  assert(cc0Sample?.contentType === "image" && cc0Sample?.name === "battleworn_knight", "real browser imports the bundled CC0 character as a native image layer");
  assert(cc0Sample?.image?.width === 944 && cc0Sample?.image?.height === 944, "real browser decodes the verified CC0 PNG dimensions");
  assert(cc0Sample?.image?.source?.startsWith("data:image/png;base64,"), "CC0 sample is embedded locally instead of uploaded to a server");
  const initialSampleTransform = JSON.stringify(cc0Sample.transform);
  const sampleCanvasCenter = await selectorCenter("#canvas");
  await mouseStroke([
    { x: sampleCanvasCenter.x - 24, y: sampleCanvasCenter.y - 12 },
    { x: sampleCanvasCenter.x + 8, y: sampleCanvasCenter.y + 4 },
    { x: sampleCanvasCenter.x + 36, y: sampleCanvasCenter.y + 18 }
  ]);
  const movedSample = (await readDocument()).layers.find(layer => layer.name === "battleworn_knight");
  assert(JSON.stringify(movedSample?.transform) !== initialSampleTransform, "default Select/Move tool drags an imported image directly on the canvas");
  await click("#undo");
  await waitFor("JSON.stringify(JSON.parse(localStorage.getItem(\"animeart-web-document\")).layers.find(layer => layer.name === \"battleworn_knight\").transform) === " + JSON.stringify(initialSampleTransform), 10000);
  await saveScreenshot("animeart-studio-cc0-sample.png");
  assert(await evaluate('document.querySelector("#flip-image-horizontal").disabled === false && document.querySelector("#flip-image-vertical").disabled === false'), "image flip controls activate for an unlocked image layer");
  await click("#flip-image-horizontal");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.some(layer => layer.name === "battleworn_knight" && layer.image?.flipX === true)', 10000);
  await click("#undo");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.some(layer => layer.name === "battleworn_knight" && layer.image?.flipX === false)', 10000);
  await click("#redo");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.some(layer => layer.name === "battleworn_knight" && layer.image?.flipX === true)', 10000);

  // Exercise actual raster edits, history, flips and aspect preservation in Chromium.
  const beforeCropDocument = await readDocument();
  const beforeCropSample = beforeCropDocument.layers.find(layer => layer.name === "battleworn_knight");
  await click("#crop-resize-image");
  await waitFor('document.querySelector("#image-edit-dialog").open === true');
  assert(await evaluate('document.querySelector("#image-edit-title").textContent === "Recortar o cambiar tamaño"'), "crop dialog presents its primary actions in Spanish");
  await waitFor('document.querySelector("#crop-preview").width > 1', 15000);
  assert(await evaluate('document.querySelector("#image-crop-width").value === "944" && document.querySelector("#image-crop-height").value === "944"'), "crop dialog reads the selected image dimensions");
  assert(await evaluate('document.querySelector("#crop-preview").height > 1'), "crop dialog renders an actual image preview");
  const cropPreviewBounds = await evaluate('(() => { const r = document.querySelector("#crop-preview").getBoundingClientRect(); return { left:r.left, top:r.top, width:r.width, height:r.height }; })()');
  await mouseDrag(
    { x: cropPreviewBounds.left + cropPreviewBounds.width * 0.15, y: cropPreviewBounds.top + cropPreviewBounds.height * 0.15 },
    { x: cropPreviewBounds.left + cropPreviewBounds.width * 0.42, y: cropPreviewBounds.top + cropPreviewBounds.height * 0.35 }
  );
  let drawnCrop = await evaluate('(() => ({ x:Number(document.querySelector("#image-crop-x").value), y:Number(document.querySelector("#image-crop-y").value), width:Number(document.querySelector("#image-crop-width").value), height:Number(document.querySelector("#image-crop-height").value) }))()');
  assert(drawnCrop.width > 1 && drawnCrop.height > 1 && drawnCrop.x >= 0 && drawnCrop.y >= 0, "dragging the preview creates a real pixel crop selection");

  const moveCropStart = await evaluate('(() => { const r=document.querySelector("#crop-preview").getBoundingClientRect(); const x=Number(document.querySelector("#image-crop-x").value); const y=Number(document.querySelector("#image-crop-y").value); const w=Number(document.querySelector("#image-crop-width").value); const h=Number(document.querySelector("#image-crop-height").value); return { x:r.left+(x+w*0.5)/944*r.width, y:r.top+(y+h*0.5)/944*r.height }; })()');
  await mouseDrag(moveCropStart, { x: moveCropStart.x + 8, y: moveCropStart.y + 6 });
  const movedCrop = await evaluate('(() => ({ x:Number(document.querySelector("#image-crop-x").value), y:Number(document.querySelector("#image-crop-y").value), width:Number(document.querySelector("#image-crop-width").value), height:Number(document.querySelector("#image-crop-height").value) }))()');
  assert(movedCrop.x > drawnCrop.x && movedCrop.y > drawnCrop.y && movedCrop.width === drawnCrop.width && movedCrop.height === drawnCrop.height, "dragging inside the crop frame moves it without changing its size");

  const resizeCropStart = await evaluate('(() => { const r=document.querySelector("#crop-preview").getBoundingClientRect(); const x=Number(document.querySelector("#image-crop-x").value); const y=Number(document.querySelector("#image-crop-y").value); const w=Number(document.querySelector("#image-crop-width").value); const h=Number(document.querySelector("#image-crop-height").value); return { x:r.left+(x+w)/944*r.width, y:r.top+(y+h)/944*r.height }; })()');
  await mouseDrag(resizeCropStart, { x: resizeCropStart.x + 8, y: resizeCropStart.y + 8 });
  const resizedCrop = await evaluate('(() => ({ x:Number(document.querySelector("#image-crop-x").value), y:Number(document.querySelector("#image-crop-y").value), width:Number(document.querySelector("#image-crop-width").value), height:Number(document.querySelector("#image-crop-height").value) }))()');
  assert(resizedCrop.width > movedCrop.width && resizedCrop.height > movedCrop.height, "dragging the lower-right crop handle resizes the existing frame");

  await click("#crop-reset-selection");
  assert(await evaluate('document.querySelector("#image-crop-x").value === "0" && document.querySelector("#image-crop-y").value === "0" && document.querySelector("#image-crop-width").value === "944" && document.querySelector("#image-crop-height").value === "944"'), "small X resets the crop frame to the complete image");
  await mouseDrag(
    { x: cropPreviewBounds.left + cropPreviewBounds.width * 0.15, y: cropPreviewBounds.top + cropPreviewBounds.height * 0.15 },
    { x: cropPreviewBounds.left + cropPreviewBounds.width * 0.42, y: cropPreviewBounds.top + cropPreviewBounds.height * 0.35 }
  );
  drawnCrop = await evaluate('(() => ({ x:Number(document.querySelector("#image-crop-x").value), y:Number(document.querySelector("#image-crop-y").value), width:Number(document.querySelector("#image-crop-width").value), height:Number(document.querySelector("#image-crop-height").value) }))()');
  assert(drawnCrop.width > 1 && drawnCrop.height > 1 && drawnCrop.x >= 0 && drawnCrop.y >= 0, "a fresh crop can be drawn after resetting the full-image frame");
  await evaluate('(() => { const ratio = document.querySelector("#image-crop-aspect"); ratio.value = "0.8"; ratio.dispatchEvent(new Event("change", { bubbles: true })); })()');
  assert(await evaluate('document.querySelector("#image-crop-width").value === "755" && document.querySelector("#image-crop-height").value === "944" && document.querySelector("#image-crop-x").value === "94"'), "4:5 aspect preset computes a centered crop within image bounds");
  await evaluate('(() => { const ratio = document.querySelector("#image-crop-aspect"); ratio.value = ""; ratio.dispatchEvent(new Event("change", { bubbles: true })); })()');
  await saveScreenshot("animeart-studio-crop-preview.png");
  await evaluate('(() => { for (const [id,value] of [["#image-crop-x","5"],["#image-crop-y","7"],["#image-crop-width","400"],["#image-crop-height","500"]]) { const input=document.querySelector(id); input.value=value; input.dispatchEvent(new Event("input",{bubbles:true})); } })()');
  await click("#apply-image-edit");
  await waitFor('document.querySelector("#status").textContent === "Image cropped"', 15000);
  let croppedSample = (await readDocument()).layers.find(layer => layer.name === "battleworn_knight");
  assert(croppedSample?.image?.width === 400 && croppedSample?.image?.height === 500, "real browser crop changes image pixels to the exact crop dimensions");
  assert(croppedSample?.image?.flipX === true, "real browser crop retains the image mirror setting");
  assert(Math.abs(croppedSample?.transform?.x - (beforeCropSample.transform.x + 5 * beforeCropSample.transform.scale)) < 0.001 && Math.abs(croppedSample?.transform?.y - (beforeCropSample.transform.y + 7 * beforeCropSample.transform.scale)) < 0.001, "real browser crop compensates the image transform for the crop origin at the fitted and centered image transform");
  await click("#undo");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.some(layer => layer.name === "battleworn_knight" && layer.image?.width === 944 && layer.image?.height === 944)', 10000);
  await click("#redo");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.some(layer => layer.name === "battleworn_knight" && layer.image?.width === 400 && layer.image?.height === 500)', 10000);
  await click("#undo");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.some(layer => layer.name === "battleworn_knight" && layer.image?.width === 944 && layer.image?.height === 944)', 10000);

  const beforeResizeDocument = await readDocument();
  const beforeResizeSample = beforeResizeDocument.layers.find(layer => layer.name === "battleworn_knight");
  await click("#crop-resize-image");
  await waitFor('document.querySelector("#image-edit-dialog").open === true');
  await click('input[name="image-edit-mode"][value="resize"]');
  await evaluate('(() => { document.querySelector("#image-resize-width").value = "472"; document.querySelector("#image-resize-width").dispatchEvent(new Event("input", { bubbles: true })); })()');
  await click("#apply-image-edit");
  await waitFor('document.querySelector("#status").textContent === "Image resized"', 15000);
  const resizedSample = (await readDocument()).layers.find(layer => layer.name === "battleworn_knight");
  assert(resizedSample?.image?.width === 472 && resizedSample?.image?.height === 472, "real browser resize re-samples the image while preserving its selected aspect ratio");
  const expectedResizeScale = beforeResizeSample.transform.scale * 2;
  assert(Math.abs(resizedSample?.transform?.scale - expectedResizeScale) < 0.001, "real browser resize keeps the image's displayed size when aspect ratio is locked");
  const expectedResizeX = beforeResizeSample.transform.x + (expectedResizeScale - beforeResizeSample.transform.scale) * beforeResizeDocument.width / 2;
  const expectedResizeY = beforeResizeSample.transform.y + (expectedResizeScale - beforeResizeSample.transform.scale) * beforeResizeDocument.height / 2;
  assert(Math.abs(resizedSample?.transform?.x - expectedResizeX) < 0.001 && Math.abs(resizedSample?.transform?.y - expectedResizeY) < 0.001, "real browser resize preserves the image layer position in document space");
  await click("#undo");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.some(layer => layer.name === "battleworn_knight" && layer.image?.width === 944)', 10000);

  const sourceBeforeRecolorLength = await evaluate('(() => { const source=JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.find(layer => layer.name === "battleworn_knight").image.source; window.__animeArtOriginalRecolorSource=source; return source.length; })()');
  assert(sourceBeforeRecolorLength > 100, "source image is embedded in the current local project");
  await click("#recolor-image");
  await waitFor('document.querySelector("#recolor-dialog").open === true');
  await click("#sample-recolor-source");
  const sampledSourceColor = await evaluate('(() => { const c=document.querySelector("#recolor-preview"),r=c.getBoundingClientRect(),d=c.getContext("2d").getImageData(0,0,c.width,c.height).data; let i=0; while(i<d.length&&d[i+3]===0)i+=4; if(i>=d.length)throw new Error("sample character contains no opaque pixels"); const p=i/4,x=p%c.width,y=Math.floor(p/c.width); c.dispatchEvent(new MouseEvent("click",{bubbles:true,clientX:r.left+(x+.5)*r.width/c.width,clientY:r.top+(y+.5)*r.height/c.height})); return document.querySelector("#recolor-source-color").value; })()');
  assert(/^#[0-9a-f]{6}$/i.test(sampledSourceColor), "real browser samples an actual opaque pixel for selective recolor");
  await click("#apply-recolor");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.find(layer => layer.name === "battleworn_knight").image.source !== window.__animeArtOriginalRecolorSource', 15000);
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.find(layer => layer.name === "battleworn_knight").image.width === 944'), "real browser applies selective recolor without changing image dimensions");
  await click("#undo");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.find(layer => layer.name === "battleworn_knight").image.source === window.__animeArtOriginalRecolorSource', 10000);
  await click("#redo");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.find(layer => layer.name === "battleworn_knight").image.source !== window.__animeArtOriginalRecolorSource', 10000);
  await saveScreenshot("animeart-studio-selective-recolor.png");

  await evaluate('window.__animeArtTextDrawCount = 0; const originalFillText = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function(...args) { window.__animeArtTextDrawCount += 1; return originalFillText.apply(this, args); };');
  await click("#add-text-layer");
  const textLayerAfterCreate = (await readDocument()).layers.at(-1);
  assert(textLayerAfterCreate?.contentType === "text" && textLayerAfterCreate.text?.value === "Your text", "real browser creates an editable text layer");
  const textLayerId = textLayerAfterCreate.id;
  await evaluate('(() => { const el = document.querySelector("#text-content"); el.value = "AnimeArt Studio"; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); })()');
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.some(layer => layer.id === ' + JSON.stringify(textLayerId) + ' && layer.contentType === "text" && layer.text?.value === "AnimeArt Studio")', 10000);
  assert(await evaluate('document.querySelector("#text-font-family").value === "Arial"'), "real browser exposes the selected text layer font controls");
  assert(await evaluate('window.__animeArtTextDrawCount > 0'), "real browser Canvas renderer paints editable text");
  await saveScreenshot("animeart-studio-text-layer.png");
  // The text editor is a modal; close it before using the workspace history controls.
  await click("#close-text-edit");
  await click("#undo");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.find(layer => layer.id === ' + JSON.stringify(textLayerId) + ')?.text?.value === "Your text"', 10000);
  await click("#redo");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.find(layer => layer.id === ' + JSON.stringify(textLayerId) + ')?.text?.value === "AnimeArt Studio"', 10000);

  await evaluate('window.__animeArtStrokeTextCount = 0; const originalStrokeText = CanvasRenderingContext2D.prototype.strokeText; CanvasRenderingContext2D.prototype.strokeText = function(...args) { window.__animeArtStrokeTextCount += 1; return originalStrokeText.apply(this, args); };');
  await click("#add-meme-text");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.filter(layer => layer.name === "Meme Top" || layer.name === "Meme Bottom").length === 2', 10000);
  const memeLayers = (await readDocument()).layers.filter(layer => layer.name === "Meme Top" || layer.name === "Meme Bottom");
  assert(memeLayers.length === 2 && memeLayers.every(layer => layer.contentType === "text" && layer.text?.fontFamily === "Impact" && layer.text?.outlineWidth > 0), "real browser creates two editable outlined meme caption layers");
  assert(await evaluate('window.__animeArtStrokeTextCount > 0'), "real browser draws caption outlines through Canvas strokeText");
  await saveScreenshot("animeart-studio-meme-captions.png");

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

  const corruptPayload = '{"version":999,';
  await evaluate("localStorage.setItem(\"animeart-web-document\", " + JSON.stringify(corruptPayload) + ")");
  await cdp("Page.reload", { ignoreCache: true });
  await waitFor('document.readyState === "complete"');
  await waitFor('document.querySelector("#storage-recovery-notice").hidden === false');
  assert(await evaluate('localStorage.getItem("animeart-web-document") === ' + JSON.stringify(corruptPayload)), "corrupt project payload is preserved at startup");
  assert((await evaluate('document.querySelector("#storage-recovery-notice").textContent')).includes("could not be opened"), "invalid project produces explicit recovery status");

  await click("#new-document");
  await waitFor('document.querySelector("#project-dialog").open === true');
  await evaluate('(() => { document.querySelector("#document-width").value = "640"; document.querySelector("#document-height").value = "480"; })()');
  await click('#project-form button[type="submit"]');
  await waitFor('document.querySelector("#status").textContent === "New document created"');
  await click('.toolbar [data-tool="brush"]');
  const recoveryCanvas = await selectorCenter("#canvas");
  await mouseStroke([
    { x: recoveryCanvas.x - 40, y: recoveryCanvas.y - 20 },
    { x: recoveryCanvas.x, y: recoveryCanvas.y },
    { x: recoveryCanvas.x + 40, y: recoveryCanvas.y + 20 }
  ]);
  assert(await evaluate('localStorage.getItem("animeart-web-document") === ' + JSON.stringify(corruptPayload)), "drawing in a new document cannot overwrite the protected payload");
  await click("#save");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").width === 640 && JSON.parse(localStorage.getItem("animeart-web-document") || "{}").height === 480');
  const explicitlySaved = await readDocument();
  assert(explicitlySaved.width === 640 && explicitlySaved.height === 480, "explicit Save replaces invalid payload with the chosen new document");
  assert(explicitlySaved.layers[0].strokes.length === 1, "explicitly saved replacement preserves current drawing");
  assert(await evaluate('document.querySelector("#storage-recovery-notice").hidden === true'), "explicit successful save clears recovery warning");
  await cdp("Page.reload", { ignoreCache: true });
  await waitFor('document.readyState === "complete"');
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").width === 640');
  assert((await readDocument()).layers[0].strokes.length === 1, "replacement project recovers after a subsequent reload");

  const incompatiblePayload = JSON.stringify({
    version: 999,
    width: 640,
    height: 480,
    layers: [{
      id: "incompatible-version-layer",
      name: "Layer",
      visible: true,
      locked: false,
      opacity: 1,
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      contentType: "drawing",
      strokes: []
    }]
  });
  await evaluate("localStorage.setItem(\"animeart-web-document\", " + JSON.stringify(incompatiblePayload) + ")");
  await cdp("Page.reload", { ignoreCache: true });
  await waitFor('document.readyState === "complete"');
  await waitFor('document.querySelector("#storage-recovery-notice").hidden === false');
  assert(await evaluate('localStorage.getItem("animeart-web-document") === ' + JSON.stringify(incompatiblePayload)), "unsupported document version remains intact until explicit save");
  await click("#save");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").version === 2 && JSON.parse(localStorage.getItem("animeart-web-document") || "{}").width === 640 && JSON.parse(localStorage.getItem("animeart-web-document") || "{}").height === 480');
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").version === 2'), "explicit Save replaces the incompatible version with a supported document");
  await cdp("Page.reload", { ignoreCache: true });
  await waitFor('document.readyState === "complete"');
  await waitForServiceWorkerReadiness();
  await waitFor('document.querySelector("#storage-recovery-notice").hidden === true');
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").version === 2'), "explicitly saved supported document remains recoverable");


  // Poster composition and shape-mask interactions use the real browser UI.
  const beforeMaskImport = (await readDocument()).layers.length;
  await evaluate('(() => { const bytes=Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="),c=>c.charCodeAt(0)); const file=new File([bytes],"shape-mask-fixture.png",{type:"image/png"}); const dt=new DataTransfer();dt.items.add(file);const input=document.querySelector("#image-file-input");input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers?.length === ' + (beforeMaskImport + 1), 10000);
  await click('[aria-label="Select shape-mask-fixture"]');
  await waitFor('document.querySelector("#image-mask-panel").hidden === false');
  await evaluate('(() => { const select=document.querySelector("#image-mask");select.value="heart";select.dispatchEvent(new Event("change",{bubbles:true})); })()');
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.some(layer=>layer.name==="shape-mask-fixture"&&layer.image?.mask==="heart")');
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.some(layer=>layer.name==="shape-mask-fixture"&&layer.image?.mask==="heart")'), "shape mask is applied and persisted to the selected image layer");
  await click("#undo");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.some(layer=>layer.name==="shape-mask-fixture"&&layer.image?.mask==="none")');
  await click("#redo");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.some(layer=>layer.name==="shape-mask-fixture"&&layer.image?.mask==="heart")');
  assert(await evaluate('document.querySelector("#image-mask").value==="heart"'), "shape mask participates in undo and redo");

  await evaluate("window.confirm = () => true");
  await click("#poster-templates");
  await waitFor('document.querySelector("#poster-template-dialog").open === true');
  await evaluate('(() => { document.querySelector("#poster-template-style").value="comic";document.querySelector("#poster-background-color").value="#ffffff";document.querySelector("#poster-accent-color").value="#ff2b6d";document.querySelector("#poster-title-value").value="E2E COMIC";document.querySelector("#poster-subtitle-value").value="SATURDAY · 20:00"; })()');
  await click('#poster-template-form button[type="submit"]');
  await waitFor('document.querySelector("#poster-template-dialog").open === false');
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").width === 1080 && JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers?.length === 3');
  const posterDocument = await readDocument();
  assert(posterDocument.width===1080&&posterDocument.height===1350, "poster template creates a 1080×1350 poster canvas");
  assert(posterDocument.layers.length===3&&posterDocument.layers[0].name==="Poster background", "poster template creates a background layer and editable text layers");
  assert(posterDocument.layers[0].image?.source?.startsWith("data:image/svg+xml;charset=utf-8,"), "poster background is a local editable image layer, not a remote asset");
  assert(posterDocument.layers[1].text?.value==="E2E COMIC"&&posterDocument.layers[1].text?.outlineWidth>0, "comic poster headline is editable and includes a real text outline");
  assert(posterDocument.layers[2].text?.value==="SATURDAY · 20:00", "poster subtitle remains editable");
  await saveScreenshot("animeart-studio-poster-template.png");

  // Real-browser Magic Eraser regression: preview is cancelable, apply preserves source, and Restore paints original pixels back.
  const beforeMagicLayerCount = (await readDocument()).layers.length;
  await evaluate('(async () => { const source=document.createElement("canvas");source.width=64;source.height=64;const context=source.getContext("2d");context.fillStyle="#ffffff";context.fillRect(0,0,64,64);context.fillStyle="#d21e23";context.fillRect(2,2,10,10);const blob=await new Promise(resolve=>source.toBlob(resolve,"image/png"));const file=new File([blob],"magic-tap-fixture.png",{type:"image/png"});const transfer=new DataTransfer();transfer.items.add(file);const input=document.querySelector("#image-file-input");input.files=transfer.files;input.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers?.length === ' + (beforeMagicLayerCount + 1), 10000);
  await click('[aria-label="Select magic-tap-fixture"]');
  const magicOriginalSource = await evaluate('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(item=>item.name==="magic-tap-fixture").image.source');
  await click('[data-tool="magic-eraser"]');
  await click("#canvas");
  await waitFor('document.querySelector("#magic-eraser-preview-dialog").open === true', 10000);
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(item=>item.name==="magic-tap-fixture").image.source === '+JSON.stringify(magicOriginalSource)), "opening the Magic Eraser preview does not mutate the original layer");
  const previewAlpha = await evaluate('(() => { const c=document.querySelector("#magic-eraser-after-preview"),d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;return {alpha:d[(Math.floor(c.height/2)*c.width+Math.floor(c.width/2))*4+3],width:c.width,height:c.height}; })()');
  assert(previewAlpha.alpha===0, "Magic Eraser preview shows the tapped connected background as transparent");
  await click("#magic-eraser-cancel");
  await waitFor('document.querySelector("#magic-eraser-preview-dialog").open === false');
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(item=>item.name==="magic-tap-fixture").image.source === '+JSON.stringify(magicOriginalSource)), "canceling the Magic Eraser preview keeps the original source untouched");
  await click("#canvas");
  await waitFor('document.querySelector("#magic-eraser-preview-dialog").open === true', 10000);
  await click("#magic-eraser-apply");
  await waitFor('document.querySelector("#magic-eraser-preview-dialog").open === false');
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(item=>item.name==="magic-tap-fixture")?.image?.source !== '+JSON.stringify(magicOriginalSource), 10000);
  const magicAfterApply = await evaluate('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(item=>item.name==="magic-tap-fixture").image');
  assert(magicAfterApply.restoreSource===magicOriginalSource, "applying Magic Eraser stores the original image source for the Restore brush");
  const magicPixels = await evaluate('(() => { const layer=JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(item=>item.name==="magic-tap-fixture");return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{const canvas=document.createElement("canvas");canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const context=canvas.getContext("2d",{willReadFrequently:true});context.drawImage(image,0,0);const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;resolve({width:canvas.width,height:canvas.height,backgroundAlpha:pixels[(32*canvas.width+32)*4+3],subjectAlpha:pixels[(4*canvas.width+4)*4+3]});};image.onerror=()=>reject(new Error("Magic Eraser result did not decode"));image.src=layer.image.source;});})()');
  assert(magicPixels.width===64&&magicPixels.height===64, "Magic Eraser keeps source dimensions");
  assert(magicPixels.backgroundAlpha===0, "applied Magic Eraser makes the tapped connected background transparent");
  assert(magicPixels.subjectAlpha===255, "Magic Eraser protects the differently colored subject");
  await click('[data-tool="restore-brush"]');
  await click("#canvas");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(item=>item.name==="magic-tap-fixture").image.source !== '+JSON.stringify(magicAfterApply.source), 10000);
  const restoredCenter = await evaluate('(() => { const layer=JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(item=>item.name==="magic-tap-fixture");return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{const c=document.createElement("canvas");c.width=image.naturalWidth;c.height=image.naturalHeight;const x=c.getContext("2d");x.drawImage(image,0,0);resolve({alpha:x.getImageData(32,32,1,1).data[3],restoreSource:layer.image.restoreSource});};image.onerror=()=>reject(new Error("restored image did not decode"));image.src=layer.image.source;});})()');
  assert(restoredCenter.alpha===255&&restoredCenter.restoreSource===magicOriginalSource, "Restore brush restores original pixels and keeps its source backup");
  await click("#undo");
  const undoRestoredCenter = await evaluate('(() => { const layer=JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(item=>item.name==="magic-tap-fixture");return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{const c=document.createElement("canvas");c.width=image.naturalWidth;c.height=image.naturalHeight;const x=c.getContext("2d");x.drawImage(image,0,0);resolve(x.getImageData(32,32,1,1).data[3]);};image.onerror=()=>reject(new Error("undo image did not decode"));image.src=layer.image.source;});})()');
  assert(undoRestoredCenter===0, "Undo reverts a Restore brush stroke");
  // Local background-processing profiles are saved, reapplied and deleted in the real editor.
  await click("#remove-background");
  await waitFor('document.querySelector("#background-removal-dialog").open === true');
  await evaluate('(() => { const select=document.querySelector("#background-removal-profile");select.value="photo";select.dispatchEvent(new Event("change",{bubbles:true})); })()');
  await waitFor('document.querySelector("#background-removal-tolerance").value === "28"');
  await evaluate('document.querySelector("#background-removal-profile-name").value="E2E profile"');
  await click("#save-background-profile");
  await waitFor('JSON.parse(localStorage.getItem("animeart.background-removal-profiles.v1")||"[]").some(profile=>profile.id==="custom-e2e-profile")');
  await evaluate('(() => { const select=document.querySelector("#background-removal-profile");select.value="anime-ink";select.dispatchEvent(new Event("change",{bubbles:true}));select.value="custom-e2e-profile";select.dispatchEvent(new Event("change",{bubbles:true})); })()');
  await waitFor('document.querySelector("#background-removal-tolerance").value === "28"');
  assert(await evaluate('document.querySelector("#background-removal-profile-name").value === "E2E profile"'), "saved profile restores its editable name and parameters");
  await click("#delete-background-profile");
  await waitFor('!JSON.parse(localStorage.getItem("animeart.background-removal-profiles.v1")||"[]").some(profile=>profile.id==="custom-e2e-profile")');
  await click("#cancel-background-removal");
  await waitFor('document.querySelector("#background-removal-dialog").open === false');


  // T064: prove explicit-write failures preserve the protected payload and can be retried.
  const quotaPayload = JSON.stringify({
    version: 999, width: 320, height: 240,
    layers: [{ id: "quota-protected", name: "Protected", visible: true, locked: false, opacity: 1,
      transform: { x: 0, y: 0, scale: 1, rotation: 0 }, contentType: "drawing", strokes: [] }]
  });
  await evaluate("localStorage.setItem(\"animeart-web-document\", " + JSON.stringify(quotaPayload) + ")");
  await cdp("Page.reload", { ignoreCache: true });
  await waitFor('document.readyState === "complete"');
  await waitFor('document.querySelector("#storage-recovery-notice").hidden === false');
  await click("#new-document");
  await waitFor('document.querySelector("#project-dialog").open === true');
  await evaluate('(() => { document.querySelector("#document-width").value = "320"; document.querySelector("#document-height").value = "240"; })()');
  await click('#project-form button[type="submit"]');
  await waitFor('document.querySelector("#status").textContent === "New document created"');
  await evaluate("(() => { window.__t064OriginalSetItem = Storage.prototype.setItem; window.__t064FailWrites = true; Storage.prototype.setItem = function(key, value) { if (window.__t064FailWrites && key === 'animeart-web-document') throw new DOMException('Quota exceeded by T064 test', 'QuotaExceededError'); return window.__t064OriginalSetItem.call(this, key, value); }; })()");
  await click("#save");
  await waitFor('document.querySelector("#status").textContent.includes("could not be saved")');
  assert(await evaluate('localStorage.getItem("animeart-web-document") === ' + JSON.stringify(quotaPayload)), "QuotaExceededError during explicit Save preserves the exact protected payload");
  assert(await evaluate('document.querySelector("#storage-recovery-notice").hidden === false'), "failed explicit Save keeps recovery warning visible");
  assert(!(await evaluate('document.querySelector("#status").textContent')).includes("Saved locally"), "failed explicit Save never reports a false success");
  assert(await evaluate('document.querySelector("#undo").disabled === true'), "failed Save does not invent a history operation");

  // T064-R2: independently exercise a generic write exception with an empty message.
  await evaluate("(() => { Storage.prototype.setItem = function(key, value) { if (key === 'animeart-web-document') throw new Error(''); return window.__t064OriginalSetItem.call(this, key, value); }; })()");
  await click("#save");
  await waitFor('document.querySelector("#status").textContent === "Project could not be saved in localStorage; the current document was not changed"');
  assert(await evaluate('localStorage.getItem("animeart-web-document") === ' + JSON.stringify(quotaPayload)), "generic empty-message write exception preserves the exact protected payload");
  assert(await evaluate('document.querySelector("#storage-recovery-notice").hidden === false'), "generic write exception keeps the recovery warning visible");
  assert(await evaluate('document.querySelector("#status").textContent === "Project could not be saved in localStorage; the current document was not changed"'), "generic write exception surfaces the persistence-layer error message");
  assert(!(await evaluate('document.querySelector("#status").textContent')).includes("Saved locally"), "generic write exception never reports a false success");
  await evaluate("(() => { Storage.prototype.setItem = window.__t064OriginalSetItem; window.__t064FailWrites = false; })()");
  assert(await evaluate('Storage.prototype.setItem === window.__t064OriginalSetItem'), "generic write fault restores the original Storage.prototype.setItem method");

  await click("#add-layer");
  await waitFor('document.querySelector("#status").textContent === "Saved project is protected. Choose Save to replace it explicitly."');
  assert(await evaluate('localStorage.getItem("animeart-web-document") === ' + JSON.stringify(quotaPayload)), "layer creation during recovery cannot overwrite the protected payload");
  assert(await evaluate('document.querySelector("#undo").disabled === false'), "layer mutation remains available in memory and records history while recovery is pending");
  await click("#undo");
  assert(await evaluate('localStorage.getItem("animeart-web-document") === ' + JSON.stringify(quotaPayload)), "Undo during recovery leaves the protected payload unchanged");
  await click("#redo");
  assert(await evaluate('localStorage.getItem("animeart-web-document") === ' + JSON.stringify(quotaPayload)), "Redo during recovery leaves the protected payload unchanged");
  const pendingSelectedLayerId = await evaluate('document.querySelector("#layers li[data-selected=true]").dataset.layerId');
  await click(layerToggleSelector(pendingSelectedLayerId, 1));
  await waitFor('document.querySelector("#status").textContent === "Saved project is protected. Choose Save to replace it explicitly."');
  assert(await evaluate('localStorage.getItem("animeart-web-document") === ' + JSON.stringify(quotaPayload)), "layer visibility change during recovery leaves the protected payload unchanged");
  assert(await evaluate('document.querySelector("#storage-recovery-notice").hidden === false'), "layer property change keeps the recovery warning visible");
  await click('[data-tool="brush"]');
  const pendingCanvas = await selectorCenter("#canvas");
  await mouseStroke([
    { x: pendingCanvas.x - 35, y: pendingCanvas.y - 10 },
    { x: pendingCanvas.x, y: pendingCanvas.y + 5 },
    { x: pendingCanvas.x + 35, y: pendingCanvas.y + 20 }
  ]);
  assert(await evaluate('localStorage.getItem("animeart-web-document") === ' + JSON.stringify(quotaPayload)), "drawing during recovery leaves the protected payload unchanged");
  assert(await evaluate('document.querySelector("#storage-recovery-notice").hidden === false'), "warning remains visible after in-memory drawing");
  const pendingLayerCount = await evaluate('document.querySelectorAll("#layers li").length');
  await evaluate("(() => { const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='), char => char.charCodeAt(0)); const file = new File([bytes], 'protected-import.png', { type: 'image/png' }); const transfer = new DataTransfer(); transfer.items.add(file); const input = document.querySelector('#image-file-input'); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await waitFor('document.querySelector("#status").textContent.includes("protected")', 10000);
  assert(await evaluate('localStorage.getItem("animeart-web-document") === ' + JSON.stringify(quotaPayload)), "image import during recovery cannot overwrite the protected payload");
  assert(await evaluate('document.querySelectorAll("#layers li").length === ' + pendingLayerCount), "rejected image import does not report success or commit a layer");
  assert(await evaluate('document.querySelector("#storage-recovery-notice").hidden === false'), "warning remains visible after rejected image import");
  await click("#save");
  await waitFor('document.querySelector("#status").textContent === "Saved locally"');
  assert(await evaluate('document.querySelector("#storage-recovery-notice").hidden === true'), "successful retry clears the recovery warning only after storage succeeds");
  const quotaRecoverySaved = await readDocument();
  assert(quotaRecoverySaved.version === 2 && quotaRecoverySaved.layers.length === pendingLayerCount, "successful retry stores the selected in-memory replacement document");
  await cdp("Page.reload", { ignoreCache: true });
  await waitFor('document.readyState === "complete"');
  await waitFor('document.querySelector("#storage-recovery-notice").hidden === true');
  assert(JSON.stringify(await readDocument()) === JSON.stringify(quotaRecoverySaved), "document saved after successful retry survives reload");

  // T064: supported current documents and the explicitly supported legacy format use the real loader.
  const validFixtureDocument = await readDocument();
  validFixtureDocument.layers[0].name = "T064 Valid Restore";
  const validFixture = JSON.stringify(validFixtureDocument);
  await evaluate("localStorage.setItem(\"animeart-web-document\", " + JSON.stringify(validFixture) + ")");
  await cdp("Page.reload", { ignoreCache: true });
  await waitFor('document.readyState === "complete"');
  await waitFor('Array.from(document.querySelectorAll("#layers .layer-select")).some(el => el.textContent.includes("T064 Valid Restore"))');
  assert(await evaluate('document.querySelector("#storage-recovery-notice").hidden === true'), "valid current-version project restores without entering recovery mode");
  assert(await evaluate('localStorage.getItem("animeart-web-document") === ' + JSON.stringify(validFixture)), "valid current-version payload remains byte-for-byte stable during restoration");

  const legacyFixture = JSON.stringify({
    version: 1, width: 320, height: 240,
    layers: [{ id: "t064-legacy-layer", name: "Legacy Sketch" }],
    strokes: [{ layerIndex: 0, tool: "brush", size: 5, color: "#111318", opacity: 1,
      points: [{ x: 12, y: 14 }, { x: 42, y: 45 }, { x: 72, y: 66 }] }]
  });
  await evaluate("localStorage.setItem(\"animeart-web-document\", " + JSON.stringify(legacyFixture) + ")");
  await cdp("Page.reload", { ignoreCache: true });
  await waitFor('document.readyState === "complete"');
  await waitFor('document.querySelector("#layers .layer-select").textContent.includes("Legacy Sketch")');
  assert(await evaluate('document.querySelector("#storage-recovery-notice").hidden === true'), "supported legacy project restores without recovery warning");
  assert(await evaluate('document.querySelector("#layers .layer-select").textContent.includes("Legacy Sketch")'), "legacy migration preserves the named layer through the real UI");
  await click("#save");
  await waitFor('document.querySelector("#status").textContent === "Saved locally"');
  const migratedLegacy = await readDocument();
  assert(migratedLegacy.version === 2, "explicit save serializes supported legacy project into the current version");
  assert(migratedLegacy.layers[0].name === "Legacy Sketch", "legacy migration preserves layer metadata");
  assert(migratedLegacy.layers[0].strokes.length === 1, "legacy migration preserves the original stroke");
  assert(migratedLegacy.layers[0].strokes[0].points.length === 3, "legacy migration preserves all legacy stroke points");

  // T064: inject a deterministic getItem failure before load(), then prove edits cannot auto-save.
  const readFailurePayload = '{"version":999,"sentinel":"read-failure-protected"}';
  await evaluate("localStorage.setItem(\"animeart-web-document\", " + JSON.stringify(readFailurePayload) + ")");
  await cdp("Page.enable");
  await cdp("Runtime.enable");
  const preload = await cdp("Page.addScriptToEvaluateOnNewDocument", { source: "(() => { window.__t064ReadFaultInstalled = true; const originalGetItem = Storage.prototype.getItem; let armed = true; Storage.prototype.getItem = function(key) { if (armed && key === 'animeart-web-document') { armed = false; throw new DOMException('T064 injected read failure', 'SecurityError'); } return originalGetItem.call(this, key); }; })();" });
  await cdp("Page.reload", { ignoreCache: true });
  await waitFor('document.readyState === "complete"');
  await waitFor('window.__t064ReadFaultInstalled === true');
  await waitFor('document.querySelector("#storage-recovery-notice").hidden === false');
  await cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier: preload.identifier });
  await waitForServiceWorkerReadiness();
  assert(await evaluate('!["Recovered local project", "Saved locally"].includes(document.querySelector("#status").textContent)'), "read failure never reports successful recovery or save");
  assert((await evaluate('document.querySelector("#storage-recovery-notice").textContent')).includes("could not be read"), "read failure displays the explicit storage-unavailable warning");
  assert(await evaluate('localStorage.getItem("animeart-web-document") === ' + JSON.stringify(readFailurePayload)), "payload is exactly preserved after deterministic startup read failure");
  await click("#add-layer");
  assert(await evaluate('localStorage.getItem("animeart-web-document") === ' + JSON.stringify(readFailurePayload)), "automatic writes remain paused after startup read failure");
  assert(await evaluate('document.querySelector("#storage-recovery-notice").hidden === false'), "startup read failure remains in protected recovery state");

  assert(await evaluate('document.documentElement.dataset.serviceWorkerActive === "true"'), "real browser service worker is active");

  // Mobile regression: use Chromium's real touch input path, not synthetic MouseEvents.
  await cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  const touchCanvas = await selectorCenter("#canvas");
  const touchStart = [
    { id: 1, x: touchCanvas.x - 42, y: touchCanvas.y - 8 },
    { id: 2, x: touchCanvas.x + 42, y: touchCanvas.y + 8 }
  ];
  await cdp("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: touchStart.map(point => ({ ...point, radiusX: 3, radiusY: 3, force: 1 }))
  });
  await cdp("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { id: 1, x: touchCanvas.x - 78, y: touchCanvas.y + 2, radiusX: 3, radiusY: 3, force: 1 },
      { id: 2, x: touchCanvas.x + 98, y: touchCanvas.y + 28, radiusX: 3, radiusY: 3, force: 1 }
    ]
  });
  assert((await evaluate('document.querySelector("#status").textContent')).startsWith("Touch zoom "),
    "two-finger touchscreen input updates the real editor viewport zoom");
  await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp("Emulation.setTouchEmulationEnabled", { enabled: false });
  assert(await evaluate('document.documentElement.dataset.cacheReady === "true"'), "real browser service worker cache contains the required offline shell");
  // AA-MOBILE-UX-002: exercise the real phone-sized viewport and the dedicated task sheet.
  await cdp("Emulation.setDeviceMetricsOverride", { width: 393, height: 873, deviceScaleFactor: 2.75, mobile: true });
  await cdp("Page.reload", { ignoreCache: true });
  await waitFor('document.readyState === "complete"');
  await waitFor('document.querySelector("#canvas") !== null');
  await waitForServiceWorkerReadiness();
  assert(await evaluate('window.innerWidth <= 920'), "Xiaomi-sized mobile E2E runs at a 393 CSS-pixel viewport");
  assert(await evaluate('document.querySelector("#storage-recovery-notice").hidden || document.querySelector("#storage-recovery-notice").textContent.includes("No se pudo abrir el proyecto guardado")'), "mobile recovery warning is localized in Spanish");
  assert(await evaluate('document.querySelector("#storage-recovery-notice").hidden || document.querySelector("#storage-recovery-notice").getBoundingClientRect().height <= 112'), "mobile recovery warning stays compact and preserves canvas space");
  assert(await evaluate('getComputedStyle(document.querySelector(".workspace")).gridTemplateColumns.split(" ").length === 1'), "mobile workspace uses a single canvas column instead of the desktop sidebars");
  assert(await evaluate('document.querySelector(".mobile-touch-dock").getBoundingClientRect().height >= 48'), "mobile quick-action dock has a usable touch target area");
  assert(await evaluate('Array.from(document.querySelectorAll(".mobile-touch-dock button")).every(el => { const r = el.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })'), "Xiaomi-sized quick-action buttons meet the 44px touch-target floor");
  assert(await evaluate('document.querySelectorAll(".mobile-touch-dock [data-touch-action]").length >= 6'), "mobile quick-action dock exposes direct editing actions");
  await saveScreenshot("animeart-studio-mobile-initial.png");
  await click('.mobile-touch-dock [data-touch-action="more"]');
  await waitFor('document.body.classList.contains("mobile-tools-open")');
  assert(await evaluate('getComputedStyle(document.querySelector(".easy-edit-grid")).display === "grid"'), "mobile More action opens the dedicated task-card panel");
  assert(await evaluate('getComputedStyle(document.querySelector(".easy-edit-grid")).gridTemplateColumns.split(" ").length === 2'), "mobile task cards use two columns");
  assert(await evaluate('document.querySelector(".easy-edit-heading").getBoundingClientRect().height > 0'), "mobile task sheet shows its own heading");
  assert(await evaluate('document.querySelector(".toolbar > :not(.easy-edit-panel)") === null || Array.from(document.querySelectorAll(".toolbar > :not(.easy-edit-panel)")).every(el => getComputedStyle(el).display === "none")'), "mobile task sheet hides desktop-only toolbar sections");
  await saveScreenshot("animeart-studio-mobile-tools.png");
  await click('.mobile-touch-dock [data-touch-action="more"]');
  await waitFor('!document.body.classList.contains("mobile-tools-open")');
  assert(await evaluate('document.querySelector(".canvas-wrap").getBoundingClientRect().height > 0'), "closing the mobile task sheet returns usable space to the canvas");
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
