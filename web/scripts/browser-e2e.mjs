import { createServer } from "node:http";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";
import { spawn } from "node:child_process";
import { inflateSync } from "node:zlib";
import { createServer as createPortProbe } from "node:net";
import { multiSelectionGeometry } from "../domain/selection.mjs";
import { documentCenter, documentToScreenPoint } from "../domain/canvas-space.mjs";

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
const browserDiagnostics = [];
let nextId = 1;

const cdp = (method, params = {}) => new Promise((resolveCdp, rejectCdp) => {
  const id = nextId++;
  pending.set(id, { resolve: resolveCdp, reject: rejectCdp });
  ws.send(JSON.stringify({ id, method, params }));
});

ws.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  if (!message.id) {
    if (message.method === "Runtime.exceptionThrown") {
      const details = message.params?.exceptionDetails;
      browserDiagnostics.push({kind:"exception",text:details?.text||"",description:details?.exception?.description||"",url:details?.url||"",line:details?.lineNumber});
    } else if (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error") {
      browserDiagnostics.push({kind:"console.error",args:(message.params.args||[]).map(arg=>arg.value??arg.description??arg.type).join(" ")});
    } else if (message.method === "Log.entryAdded" && message.params?.entry?.level === "error") {
      const entry=message.params.entry;
      browserDiagnostics.push({kind:"browser.log",text:entry.text||"",url:entry.url||"",line:entry.lineNumber});
    }
    return;
  }
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

// Subscribe before reloading so syntax/runtime failures during module startup are not lost.
await cdp("Runtime.enable");
await cdp("Log.enable");
await cdp("Page.enable");
await cdp("Page.addScriptToEvaluateOnNewDocument", {source:
  'window.addEventListener("error", event => console.error("ANIMEART_WINDOW_ERROR", event.message, event.filename, event.lineno, event.colno));' +
  'window.addEventListener("unhandledrejection", event => console.error("ANIMEART_UNHANDLED_REJECTION", event.reason?.stack || String(event.reason)));'
});
await cdp("Page.navigate", {url: `http://${HOST}:${PORT}/index.html`});

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
  throw new Error(`Timed out waiting for: ${expression}; url=${await evaluate("location.href").catch(() => "unavailable")}; title=${await evaluate("document.title").catch(() => "unavailable")}; readyState=${await evaluate("document.readyState").catch(() => "unavailable")}; canvasCount=${await evaluate("document.querySelectorAll(\"canvas\").length").catch(() => "unavailable")}; status=${JSON.stringify(await evaluate("document.querySelector('#status')?.textContent || 'missing'").catch(() => "unavailable"))}; storageRecovery=${JSON.stringify(await evaluate("({hidden:document.querySelector('#storage-recovery-notice')?.hidden,text:document.querySelector('#storage-recovery-notice')?.textContent})").catch(() => "unavailable"))}; savedVersion=${JSON.stringify(await evaluate("JSON.parse(localStorage.getItem('animeart-web-document') || '{}').version ?? null").catch(() => "unavailable"))}; console=${JSON.stringify(browserDiagnostics.slice(-20))}`);
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

const clickMoreGoal = async goal => {
  // The secondary catalog is a bottom sheet on phones and a modal on desktop.
  // Check the dialog itself so the helper works at either viewport width.
  const open = await evaluate('document.querySelector("#toolbox-dialog")?.open === true');
  if (!open) {
    const mobile = await evaluate('window.matchMedia("(max-width: 920px)").matches');
    await click(mobile ? '.mobile-touch-dock [data-touch-action="more"]' : '#toolbox-open');
    await waitFor('document.querySelector("#toolbox-dialog")?.open === true');
  }
  await click('[data-edit-goal="' + goal + '"]');
};

const openDesignLibrary = async () => {
  const open = await evaluate('document.querySelector("#toolbox-dialog")?.open === true');
  if (!open) {
    const mobile = await evaluate('window.matchMedia("(max-width: 920px)").matches');
    await click(mobile ? '.mobile-touch-dock [data-touch-action="more"]' : '#toolbox-open');
    await waitFor('document.querySelector("#toolbox-dialog")?.open === true');
  }
  await click("#quick-open-design-library");
  await waitFor('document.querySelector("#design-library-dialog")?.open === true');
};

const openMultiPageManager = async () => {
  const open = await evaluate('document.querySelector("#toolbox-dialog")?.open === true');
  if (!open) {
    const mobile = await evaluate('window.matchMedia("(max-width: 920px)").matches');
    await click(mobile ? '.mobile-touch-dock [data-touch-action="more"]' : '#toolbox-open');
    await waitFor('document.querySelector("#toolbox-dialog")?.open === true');
  }
  await click("#quick-open-page-manager");
  await waitFor('document.querySelector("#multi-page-dialog")?.open === true');
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


const wheelCanvasZoom = async (direction, steps = 1) => {
  const point = await evaluate('(() => { const r=document.querySelector("#canvas").getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()');
  const deltaY = direction === "in" ? -120 : 120;
  for (let index = 0; index < steps; index += 1) {
    await cdp("Input.dispatchMouseEvent", { type: "mouseWheel", x: point.x, y: point.y, deltaX: 0, deltaY });
    await sleep(70);
  }
  await sleep(120);
};

const panCanvasByTouch = async (deltaX, deltaY) => {
  const center = await evaluate('(() => { const r=document.querySelector("#canvas").getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()');
  const points = [
    { id: 1, x: center.x - 38, y: center.y - 8, radiusX: 3, radiusY: 3, force: 1 },
    { id: 2, x: center.x + 38, y: center.y - 8, radiusX: 3, radiusY: 3, force: 1 }
  ];
  await cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points });
  await sleep(70);
  await cdp("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: points.map(point => ({ ...point, x: point.x + deltaX, y: point.y + deltaY }))
  });
  await sleep(120);
  await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp("Emulation.setTouchEmulationEnabled", { enabled: false });
  await sleep(140);
};

const readFrameMetrics = async () => evaluate('(() => { const f=window.__ANIMEART_DOCUMENT_FRAME_DIAGNOSTICS__,d=JSON.parse(localStorage.getItem("animeart-web-document")||"{}"),r=document.querySelector("#canvas").getBoundingClientRect(); if(!f?.topLeft||!f?.topRight||!f?.bottomLeft||!d.width||!d.height)return null; return {documentWidth:d.width,documentHeight:d.height,left:f.topLeft.x,top:f.topLeft.y,right:f.topRight.x,bottom:f.bottomLeft.y,canvasLeft:r.left,canvasTop:r.top,canvasWidth:r.width,canvasHeight:r.height}; })()');

const documentPointToClientPoint = (frame, x, y) => ({
  x: frame.canvasLeft + frame.left + x / frame.documentWidth * (frame.right - frame.left),
  y: frame.canvasTop + frame.top + y / frame.documentHeight * (frame.bottom - frame.top)
});

const clientPointToDocumentPoint = (frame, point) => ({
  x: (point.x - frame.canvasLeft - frame.left) / (frame.right - frame.left) * frame.documentWidth,
  y: (point.y - frame.canvasTop - frame.top) / (frame.bottom - frame.top) * frame.documentHeight
});

const readDocument = async () => JSON.parse(await evaluate(`localStorage.getItem("animeart-web-document")`));
const readLayerSummary = async () => evaluate(`JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers?.map(layer => ({ id: layer.id, name: layer.name, contentType: layer.contentType, visible: layer.visible, locked: layer.locked, isReference: layer.isReference, transform: layer.transform, image: layer.image ? { width: layer.image.width, height: layer.image.height, mime: /^data:([^;,]+)/.exec(layer.image.source || "")?.[1] || null } : null, strokes: layer.strokes?.length || 0 })) || []`);
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
  try {
    await waitFor(`document.querySelector("#canvas") !== null`, 12000);
  } catch (error) {
    const startup = await evaluate(`(() => ({
      url: location.href,
      title: document.title,
      readyState: document.readyState,
      bodyText: (document.body?.innerText || "").slice(0, 1200),
      bodyHtml: (document.body?.innerHTML || "").slice(0, 1800),
      canvasCount: document.querySelectorAll("canvas").length,
      scriptSources: Array.from(document.scripts, script => script.src || "inline"),
      serviceWorkerController: navigator.serviceWorker?.controller?.scriptURL || null
    }))()`).catch(e => ({ diagnosticError: String(e) }));
    console.error("ANIMEART_STARTUP_FAILURE " + JSON.stringify({ startup, browserDiagnostics }));
    throw error;
  }
  try {
    await waitForServiceWorkerReadiness();
  } catch (error) {
    console.error("ANIMEART_BROWSER_DIAGNOSTICS " + JSON.stringify(browserDiagnostics));
    throw error;
  }

  assert(await evaluate("document.title") === "KapiArt Studio | Crea arte anime con ternura", "real browser loaded the KapiArt entrypoint");
  const canvas = await selectorCenter("#canvas");
  assert(canvas.width > 0 && canvas.height > 0, "canvas exists and has usable layout dimensions");
  assert(await evaluate(`getComputedStyle(document.querySelector("#canvas")).visibility !== "hidden" && getComputedStyle(document.querySelector("#canvas")).display !== "none"`), "canvas is visible");
  assert(await evaluate('document.documentElement.dataset.serviceWorkerActive === "true" && document.documentElement.dataset.cacheReady === "true"'), "service worker is active and the offline shell cache is ready");
  assert(await evaluate('document.querySelector("#canvas-import-images").getBoundingClientRect().width > 0 && document.querySelector("#canvas-open-asset-library").getBoundingClientRect().width > 0'), "image import and reusable library remain visible next to the canvas without scrolling");
  assert(await evaluate('document.querySelector(".canvas-view-menu").open === false'), "transparency and canvas-background controls stay tucked inside the collapsed View menu");

  assert(await evaluate('document.querySelectorAll("#layers li").length === 1'), "initial editor state contains one drawing layer");
  await saveScreenshot("animeart-studio-initial.png");

  await evaluate('document.querySelector("#new-document").click()');
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
  const secondCanvasCenter = await selectorCenter("#canvas");
  await mouseStroke([
    { x: secondCanvasCenter.x - 180, y: secondCanvasCenter.y - 125 },
    { x: secondCanvasCenter.x, y: secondCanvasCenter.y },
    { x: secondCanvasCenter.x + 180, y: secondCanvasCenter.y + 125 }
  ]);
  documentState = await readDocument();
  assert(documentState.layers.find(layer => layer.id === secondLayerId)?.strokes.length === 1, "second layer accepts real pointer drawing");

  // Keep the live pointer-drawing assertions above, then seed a known-size geometry
  // for the separate multi-selection drag test. This prevents browser scroll/layout
  // changes from making a real stroke only a few CSS pixels wide.
  const multiGeometryFixture = structuredClone(await readDocument());
  multiGeometryFixture.width = 800;
  multiGeometryFixture.height = 600;
  const firstMultiLayer = multiGeometryFixture.layers.find(layer => layer.id === documentState.layers[0].id);
  const secondMultiLayer = multiGeometryFixture.layers.find(layer => layer.id === secondLayerId);
  if (!firstMultiLayer || !secondMultiLayer) throw new Error("Could not prepare deterministic multi-selection layers");
  firstMultiLayer.transform = { x: 0, y: 0, scale: 1, rotation: 0 };
  secondMultiLayer.transform = { x: 0, y: 0, scale: 1, rotation: 0 };
  firstMultiLayer.strokes = [{
    ...(firstMultiLayer.strokes[0] || {}),
    tool: "brush", size: 12, color: "#12e0f6", opacity: 1,
    points: [{ x: 100, y: 120 }, { x: 220, y: 170 }, { x: 320, y: 260 }]
  }];
  secondMultiLayer.strokes = [{
    ...(secondMultiLayer.strokes[0] || {}),
    tool: "brush", size: 12, color: "#ff4fd8", opacity: 1,
    points: [{ x: 460, y: 300 }, { x: 560, y: 390 }, { x: 700, y: 460 }]
  }];
  await evaluate("localStorage.setItem('animeart-web-document', " + JSON.stringify(JSON.stringify(multiGeometryFixture)) + ")");
  await cdp("Page.reload", { ignoreCache: true });
  await waitFor('document.readyState === "complete"');
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers?.length === 2');
  await waitForServiceWorkerReadiness();
  documentState = await readDocument();

  const initialLayerId = documentState.layers[0].id;
  await click('[data-tool="select"]');
  await click(layerButtonSelector(initialLayerId));
  await click(layerButtonSelector(secondLayerId), 8);
  const selectedLayerIds = await evaluate("Array.from(document.querySelectorAll('#layers li[data-selected=true]')).map(el => el.dataset.layerId)");
  assert(selectedLayerIds.length === 2, "real shift-click selects multiple layers");

  const beforeMulti = await readDocument();
  const multiBefore = selectedLayerIds.map(id => ({ id, x: beforeMulti.layers.find(layer => layer.id === id).transform.x }));
  const selectedModels = beforeMulti.layers.filter(layer => selectedLayerIds.includes(layer.id));
  const groupGeometry = multiSelectionGeometry(selectedModels, documentCenter(beforeMulti));
  assert(Boolean(groupGeometry), "multi-selection computes bounds from the selected layer geometry");
  const canvasMetrics = await evaluate('(() => { const rect = document.querySelector("#canvas").getBoundingClientRect(); return {left:rect.left,top:rect.top,width:rect.width,height:rect.height}; })()');
  const screenSize = { width: canvasMetrics.width, height: canvasMetrics.height };
  const testViewport = { zoom: 1, panX: 0, panY: 0 };
  const groupCornersOnScreen = groupGeometry.corners.map(point => documentToScreenPoint(point, beforeMulti, testViewport, screenSize));
  const boundsOnScreen = {
    width: Math.max(...groupCornersOnScreen.map(point => point.x)) - Math.min(...groupCornersOnScreen.map(point => point.x)),
    height: Math.max(...groupCornersOnScreen.map(point => point.y)) - Math.min(...groupCornersOnScreen.map(point => point.y))
  };
  assert(boundsOnScreen.width > 60 && boundsOnScreen.height > 60,
    "multi-selection E2E fixture has a draggable interior larger than the touch handles: " + JSON.stringify(boundsOnScreen));
  const groupCenterOnScreen = documentToScreenPoint(groupGeometry.center, beforeMulti, testViewport, screenSize);
  const dragStartScreen = { x: canvasMetrics.left + groupCenterOnScreen.x, y: canvasMetrics.top + groupCenterOnScreen.y };
  await evaluate("window.__ANIMEART_E2E_DIAGNOSTICS__ = true");

  // AA-MULTI-TOUCH-ANCHOR-001: a stationary pointer must not move a selected group
  // if responsive layout changes the canvas bounding rectangle mid-gesture.
  const multiTransformsBeforeReflow = await evaluate('JSON.stringify(JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.filter(layer=>'+
    JSON.stringify(selectedLayerIds)+'.includes(layer.id)).map(layer=>({id:layer.id,transform:layer.transform})))');
  await cdp("Input.dispatchMouseEvent", { type:"mouseMoved", x:dragStartScreen.x, y:dragStartScreen.y });
  await cdp("Input.dispatchMouseEvent", { type:"mousePressed", x:dragStartScreen.x, y:dragStartScreen.y, button:"left", buttons:1, clickCount:1 });
  await evaluate('document.querySelector("#canvas").style.transform = "translateY(44px)"');
  await cdp("Input.dispatchMouseEvent", { type:"mouseReleased", x:dragStartScreen.x, y:dragStartScreen.y, button:"left", buttons:0, clickCount:1 });
  await evaluate('(() => { const canvas=document.querySelector("#canvas"); canvas.style.transform=""; window.dispatchEvent(new Event("resize")); })()');
  const multiTransformsAfterReflow = await evaluate('JSON.stringify(JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.filter(layer=>'+
    JSON.stringify(selectedLayerIds)+'.includes(layer.id)).map(layer=>({id:layer.id,transform:layer.transform})))');
  assert(multiTransformsAfterReflow === multiTransformsBeforeReflow,
    "stationary multi-selection gesture does not move selected layers when the canvas rectangle changes");

  await mouseDrag(dragStartScreen, { x: dragStartScreen.x + 50, y: dragStartScreen.y });
  console.log("MULTI_SELECTION_INTERACTION_DIAGNOSTICS", JSON.stringify(browserDiagnostics.filter(item => /AA_MULTI_POINTER/.test(item.args || ""))));
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
  await click(layerSelector(lifecycleLayerId) + ' .layer-action[title="Duplicar capa"]');
  lifecycle = await readLayerSummary();
  assert(lifecycle.length === lifecycleCountBeforeDuplicate + 1, "real layer duplicate creates a new layer");
  const duplicateId = lifecycle.find(layer => !lifecycleIdsBeforeDuplicate.has(layer.id))?.id;
  assert(Boolean(duplicateId), "real layer duplicate has a distinct document id");
  await click(layerSelector(duplicateId) + ' .layer-action[title="Eliminar capa"]');
  lifecycle = await readLayerSummary();
  assert(lifecycle.length === lifecycleCountBeforeDuplicate, "real layer delete removes the duplicated layer");

  const imageLayerCountBefore = lifecycle.length;
  const imported = await evaluate('(async () => { const source=document.createElement("canvas"); source.width=640; source.height=480; const context=source.getContext("2d",{willReadFrequently:true}); context.fillStyle="#ff4fd8"; context.fillRect(48,56,320,240); const blob=await new Promise(resolve=>source.toBlob(resolve,"image/png")); if(!blob||blob.type!=="image/png"||blob.size===0) return {accepted:false,type:blob?.type||null,size:blob?.size||0}; const file=new File([blob],"e2e-fixture.png",{type:"image/png"}); const transfer=new DataTransfer(); transfer.items.add(file); const input=document.querySelector("#image-file-input"); input.files=transfer.files; input.dispatchEvent(new Event("change",{bubbles:true})); return {accepted:true,type:blob.type,size:blob.size,width:source.width,height:source.height,transparentAlpha:context.getImageData(0,0,1,1).data[3],subjectAlpha:context.getImageData(60,80,1,1).data[3]}; })()');
  assert(imported?.accepted === true && imported.type === "image/png" && imported.size > 0, "real browser file input accepted a genuine PNG Blob with transparent pixels");
  assert(imported.width === 640 && imported.height === 480 && imported.transparentAlpha === 0 && imported.subjectAlpha === 255, "PNG fixture has representative dimensions, transparent background and opaque image content");
  await waitFor("JSON.parse(localStorage.getItem(\"animeart-web-document\") || \"{}\").layers?.length === " + (imageLayerCountBefore + 1), 10000);
  const afterImport = await readLayerSummary();
  const importedLayer = afterImport.at(-1);
  assert(importedLayer?.contentType === "image", "real browser image import creates an image layer");
  assert(importedLayer?.name === "e2e-fixture", "real browser image import preserves the image layer name");
  assert(importedLayer?.image?.width === 640 && importedLayer?.image?.height === 480 && importedLayer?.image?.mime === "image/png", "PNG import preserves decoded dimensions and PNG MIME type");
  const importedPngPixels = await evaluate('(() => { const layer=JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(item=>item.name==="e2e-fixture"); if(!layer?.image?.source) return Promise.resolve({decodeError:true}); return new Promise(resolve=>{ const image=new Image(); image.onload=()=>{ const sample=document.createElement("canvas"); sample.width=image.naturalWidth; sample.height=image.naturalHeight; const context=sample.getContext("2d",{willReadFrequently:true}); context.drawImage(image,0,0); resolve({width:sample.width,height:sample.height,transparentAlpha:context.getImageData(0,0,1,1).data[3],subjectAlpha:context.getImageData(60,80,1,1).data[3]}); }; image.onerror=()=>resolve({decodeError:true}); image.src=layer.image.source; }); })()');
  assert(importedPngPixels.width === 640 && importedPngPixels.height === 480 && importedPngPixels.transparentAlpha === 0 && importedPngPixels.subjectAlpha === 255, "persisted PNG decodes with real transparency and retained subject pixels");
  await click('[aria-label="Seleccionar capa e2e-fixture"]');
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

  // AA-TOUCH-OVERLAP-001: a selected lower sticker remains the drag target even
  // when another same-sized image is directly above it. Layer switching remains
  // explicit through the Layers list instead of relying on the topmost hit test.
  const documentBeforeOverlapTest = await readDocument();
  const sourceOverlapImage = documentBeforeOverlapTest.layers.find(layer => layer.name === "e2e-fixture" && layer.contentType === "image");
  assert(Boolean(sourceOverlapImage?.image?.source), "overlap-drag fixture reuses a genuine imported image layer");
  const overlapFixture = structuredClone(documentBeforeOverlapTest);
  const makeOverlapLayer = (id, name) => ({
    ...structuredClone(sourceOverlapImage),
    id,
    name,
    visible: true,
    locked: false,
    opacity: 1,
    isBackground: false,
    isReference: false,
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    adjustments: { brightness: 100, contrast: 100, saturation: 100, hue: 0, temperature: 0, tint: 0, blur: 0 },
    strokes: []
  });
  const overlapBottom = makeOverlapLayer("e2e-overlap-bottom", "e2e-overlap-bottom");
  const overlapTop = makeOverlapLayer("e2e-overlap-top", "e2e-overlap-top");
  overlapFixture.layers = [overlapBottom, overlapTop];
  overlapFixture.width = 800;
  overlapFixture.height = 600;
  await evaluate("localStorage.setItem('animeart-web-document', " + JSON.stringify(JSON.stringify(overlapFixture)) + ")");
  await cdp("Page.reload", { ignoreCache: true });
  await waitFor('document.readyState === "complete"');
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers?.length === 2');
  await waitForServiceWorkerReadiness();
  await evaluate("window.__ANIMEART_E2E_DIAGNOSTICS__ = true; window.dispatchEvent(new Event('resize'))");
  await waitFor("window.__ANIMEART_DOCUMENT_FRAME_DIAGNOSTICS__?.topLeft?.x !== undefined");
  await click(layerButtonSelector("e2e-overlap-bottom"));
  assert(await evaluate('document.querySelector("#selection-indicator").textContent.includes("e2e-overlap-bottom")'),
    "overlap E2E selects the intended lower image through the Layers list");
  const basicOverlapBefore = await readDocument();
  const bottomTransformBefore = structuredClone(basicOverlapBefore.layers.find(layer => layer.id === "e2e-overlap-bottom").transform);
  const topTransformBefore = structuredClone(basicOverlapBefore.layers.find(layer => layer.id === "e2e-overlap-top").transform);
  const overlapFrame = await readFrameMetrics();
  const overlapDragStart = documentPointToClientPoint(overlapFrame, 400, 300);
  await mouseDrag(overlapDragStart, { x: overlapDragStart.x + 54, y: overlapDragStart.y + 36 });
  const basicOverlapAfter = await readDocument();
  const bottomTransformAfter = basicOverlapAfter.layers.find(layer => layer.id === "e2e-overlap-bottom").transform;
  const topTransformAfter = basicOverlapAfter.layers.find(layer => layer.id === "e2e-overlap-top").transform;
  assert(bottomTransformAfter.x !== bottomTransformBefore.x || bottomTransformAfter.y !== bottomTransformBefore.y,
    "dragging within the overlap moves the currently selected lower image");
  assert(JSON.stringify(topTransformAfter) === JSON.stringify(topTransformBefore),
    "overlap drag leaves the top image in place instead of stealing the gesture");
  await evaluate("localStorage.setItem('animeart-web-document', " + JSON.stringify(JSON.stringify(documentBeforeOverlapTest)) + ")");
  await cdp("Page.reload", { ignoreCache: true });
  await waitFor('document.readyState === "complete"');
  await waitForServiceWorkerReadiness();
  await evaluate("window.__ANIMEART_E2E_DIAGNOSTICS__ = true; window.dispatchEvent(new Event('resize'))");

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
  await click('[aria-label="Seleccionar capa delete-first"]');
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

  // Exercise actual raster edits, history, flips, shape masks and aspect preservation in Chromium.
  const shapeMaskCheck = await evaluate('(async () => { const sourceCanvas=document.createElement("canvas"); sourceCanvas.width=100; sourceCanvas.height=100; const sourceContext=sourceCanvas.getContext("2d"); sourceContext.fillStyle="#ed4baf"; sourceContext.fillRect(0,0,100,100); const { cropImageSource }=await import("/domain/image-processing.mjs"); const masked=await cropImageSource(sourceCanvas.toDataURL("image/png"),{x:0,y:0,width:100,height:100},{shape:"circle"}); const resultImage=new Image(); resultImage.src=masked.source; await resultImage.decode(); const resultCanvas=document.createElement("canvas"); resultCanvas.width=masked.width; resultCanvas.height=masked.height; const resultContext=resultCanvas.getContext("2d",{willReadFrequently:true}); resultContext.drawImage(resultImage,0,0); const data=resultContext.getImageData(0,0,100,100).data; return {width:masked.width,height:masked.height,cornerAlpha:data[3],centerAlpha:data[(50*100+50)*4+3]}; })()');
  assert(shapeMaskCheck?.width===100 && shapeMaskCheck?.height===100 && shapeMaskCheck.cornerAlpha===0 && shapeMaskCheck.centerAlpha>240, "shape crop makes pixels outside the circle truly transparent while retaining the center");
  const beforeCropDocument = await readDocument();
  const beforeCropSample = beforeCropDocument.layers.find(layer => layer.name === "battleworn_knight");
  await click("#crop-resize-image");
  await waitFor('document.querySelector("#image-edit-dialog").open === true');
  assert(await evaluate('document.querySelector("#image-edit-title").textContent.includes("Símbolo de recorte") && document.querySelector("#apply-image-edit").textContent.includes("Recortar") && document.querySelector("#close-image-edit").textContent.includes("✕")'), "crop dialog presents a clear crop action and X cancel control in Spanish");
  assert(await evaluate('document.querySelector("#image-crop-shape")?.value==="rectangle" && [...document.querySelector("#image-crop-shape").options].some(option=>option.value==="circle")'), "pixel crop offers a separate shape selector beginning with Rectangle");
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

  // Every exit path discards a manipulated pixel-crop preview without touching the document.
  const imageCropCancelBaseline = await readDocument();
  const editPixelCropFrame = async () => evaluate('(() => { for (const [id,value] of [["#image-crop-x","5"],["#image-crop-y","7"],["#image-crop-width","400"],["#image-crop-height","500"]]) { const input=document.querySelector(id); input.value=value; input.dispatchEvent(new Event("input",{bubbles:true})); } return {x:document.querySelector("#image-crop-x").value,y:document.querySelector("#image-crop-y").value,width:document.querySelector("#image-crop-width").value,height:document.querySelector("#image-crop-height").value}; })()');
  const assertPixelCropReset = async (reason) => {
    const reset = await evaluate('(() => ({x:document.querySelector("#image-crop-x").value,y:document.querySelector("#image-crop-y").value,width:document.querySelector("#image-crop-width").value,height:document.querySelector("#image-crop-height").value,shape:document.querySelector("#image-crop-shape").value}))()');
    assert(reset.x === "0" && reset.y === "0" && reset.width === "944" && reset.height === "944" && reset.shape === "rectangle",
      reason + " reopens from the unchanged source image, not the discarded crop: " + JSON.stringify(reset));
  };
  await editPixelCropFrame();
  await click("#cancel-image-edit");
  await waitFor('document.querySelector("#image-edit-dialog").open === false');
  assert(JSON.stringify(await readDocument()) === JSON.stringify(imageCropCancelBaseline),
    "Cancel discards the manipulated image-crop frame without changing document pixels, layer data, or transform");
  await click("#crop-resize-image");
  await waitFor('document.querySelector("#image-edit-dialog").open === true');
  await assertPixelCropReset("Cancel");
  await editPixelCropFrame();
  await click("#close-image-edit");
  await waitFor('document.querySelector("#image-edit-dialog").open === false');
  assert(JSON.stringify(await readDocument()) === JSON.stringify(imageCropCancelBaseline),
    "X discards the manipulated image-crop frame without persisting any image edit");
  await click("#crop-resize-image");
  await waitFor('document.querySelector("#image-edit-dialog").open === true');
  await assertPixelCropReset("X");
  await editPixelCropFrame();
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await waitFor('document.querySelector("#image-edit-dialog").open === false');
  assert(JSON.stringify(await readDocument()) === JSON.stringify(imageCropCancelBaseline),
    "Escape discards the manipulated image-crop frame without persisting any image edit");
  await click("#crop-resize-image");
  await waitFor('document.querySelector("#image-edit-dialog").open === true');
  await assertPixelCropReset("Escape");

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

  await click("#crop-resize-image");
  await waitFor('document.querySelector("#image-edit-dialog").open === true');
  await evaluate('(() => { const shape=document.querySelector("#image-crop-shape"); shape.value="circle"; shape.dispatchEvent(new Event("change",{bubbles:true})); for (const [id,value] of [["#image-crop-x","272"],["#image-crop-y","272"],["#image-crop-width","400"],["#image-crop-height","400"]]) { const input=document.querySelector(id); input.value=value; input.dispatchEvent(new Event("input",{bubbles:true})); } })()');
  await click("#apply-image-edit");
  await waitFor('document.querySelector("#status").textContent === "Image cropped"',15000);
  const roundCropLayer=(await readDocument()).layers.find(layer=>layer.name==="battleworn_knight");
  assert(roundCropLayer?.image?.width===400 && roundCropLayer?.image?.height===400, "circle crop keeps exact pixel dimensions");
  const realCropAlpha=await evaluate('(async()=>{const layer=JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(item=>item.name==="battleworn_knight");const image=new Image();image.src=layer.image.source;await image.decode();const c=document.createElement("canvas");c.width=image.naturalWidth;c.height=image.naturalHeight;const x=c.getContext("2d",{willReadFrequently:true});x.drawImage(image,0,0);const d=x.getImageData(0,0,c.width,c.height).data;return {corner:d[3],center:d[(Math.floor(c.height/2)*c.width+Math.floor(c.width/2))*4+3],width:c.width,height:c.height};})()');
  assert(realCropAlpha?.corner===0 && realCropAlpha.center>0, "applying a circular crop stores alpha transparency outside the selected geometry");
  await click("#undo");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.some(layer => layer.name === "battleworn_knight" && layer.image?.width === 944 && layer.image?.height === 944)',10000);

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
  await click("#recolor-rectangle-toggle");
  const rectangleDiagnostics = await evaluate('(() => { const c=document.querySelector("#recolor-preview"),r=c.getBoundingClientRect(),cs=getComputedStyle(c),d=c.getContext("2d").getImageData(0,0,c.width,c.height).data,n=v=>parseFloat(v)||0,bl=n(cs.borderLeftWidth),br=n(cs.borderRightWidth),bt=n(cs.borderTopWidth),bb=n(cs.borderBottomWidth),pl=n(cs.paddingLeft),pr=n(cs.paddingRight),pt=n(cs.paddingTop),pb=n(cs.paddingBottom),left=r.left+bl+pl,top=r.top+bt+pt,bw=r.width-bl-br-pl-pr,bh=r.height-bt-bb-pt-pb,scale=Math.min(bw/c.width,bh/c.height),dw=c.width*scale,dh=c.height*scale,dl=left+(bw-dw)/2,dt=top+(bh-dh)/2,mx=Math.max(2,Math.ceil(c.width*.05)),my=Math.max(2,Math.ceil(c.height*.05)); let x1=-1,y1=-1; find: for(let yy=my;yy<c.height-my;yy++){for(let xx=mx;xx<c.width-mx;xx++){if(d[(yy*c.width+xx)*4+3]>0){x1=xx;y1=yy;break find;}}} if(x1<0)throw new Error("no interior opaque pixel for rectangle E2E"); const x2=Math.min(c.width-mx-1,x1+18),y2=Math.min(c.height-my-1,y1+18),client=(x,y)=>({clientX:dl+(x+.5)*scale,clientY:dt+(y+.5)*scale}),send=(type,p)=>c.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:43,pointerType:"mouse",isPrimary:true,...client(p.x,p.y)})); send("pointerdown",{x:x1,y:y1});send("pointermove",{x:x2,y:y2});send("pointerup",{x:x2,y:y2}); const status=document.querySelector("#recolor-selection-status")?.textContent||""; return {status,count:parseInt(status.replace(/[^0-9]/g,""),10)||0,x1,y1,x2,y2}; })()');
  assert(rectangleDiagnostics.count > 0, "dragging a rectangle selects visible anime pixels: " + JSON.stringify(rectangleDiagnostics));
  await click("#recolor-wand-clear");
  await click("#sample-recolor-source");
  const sampleDiagnostics = await evaluate('(async () => { const c=document.querySelector("#recolor-preview"),image=new Image(); image.src=window.__animeArtOriginalRecolorSource; await image.decode(); await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))); const r=c.getBoundingClientRect(),cs=getComputedStyle(c),n=v=>parseFloat(v)||0,bl=n(cs.borderLeftWidth),br=n(cs.borderRightWidth),bt=n(cs.borderTopWidth),bb=n(cs.borderBottomWidth),pl=n(cs.paddingLeft),pr=n(cs.paddingRight),pt=n(cs.paddingTop),pb=n(cs.paddingBottom),left=r.left+bl+pl,top=r.top+bt+pt,bw=r.width-bl-br-pl-pr,bh=r.height-bt-bb-pt-pb,scale=Math.min(bw/c.width,bh/c.height),dw=c.width*scale,dh=c.height*scale,dl=left+(bw-dw)/2,dt=top+(bh-dh)/2; const sourceCanvas=document.createElement("canvas");sourceCanvas.width=c.width;sourceCanvas.height=c.height;const sourceContext=sourceCanvas.getContext("2d",{willReadFrequently:true});sourceContext.drawImage(image,0,0,c.width,c.height);const source=sourceContext.getImageData(0,0,c.width,c.height).data;let i=-1,x=0,y=0;const mx=Math.max(2,Math.ceil(c.width*.05)),my=Math.max(2,Math.ceil(c.height*.05));for(let yy=my;yy<c.height-my&&i<0;yy++){for(let xx=mx;xx<c.width-mx;xx++){const q=(yy*c.width+xx)*4;if(source[q+3]===255){i=q;x=xx;y=yy;break;}}}if(i<0)throw new Error("original character has no fully opaque interior pixel away from the bitmap edge");const expected="#" + [source[i],source[i+1],source[i+2]].map(v=>v.toString(16).padStart(2,"0")).join("");window.__ANIMEART_RECOLOR_SAMPLE_DIAGNOSTICS__=null;c.dispatchEvent(new MouseEvent("click",{bubbles:true,clientX:dl+(x+.5)*scale,clientY:dt+(y+.5)*scale}));const sample=window.__ANIMEART_RECOLOR_SAMPLE_DIAGNOSTICS__||null,mappedOffset=sample?((sample.y*c.width+sample.x)*4):-1,mappedExpected=mappedOffset>=0?"#"+[source[mappedOffset],source[mappedOffset+1],source[mappedOffset+2]].map(v=>v.toString(16).padStart(2,"0")).join(""):null;return {expected, mappedExpected,actual:document.querySelector("#recolor-source-color").value,status:document.querySelector("#recolor-status")?.textContent,applyDisabled:document.querySelector("#apply-recolor").disabled,x,y,scale,bw,bh,sample}; })()');
  assert(sampleDiagnostics.sample && Math.abs(sampleDiagnostics.sample.x-sampleDiagnostics.x)<=1 && Math.abs(sampleDiagnostics.sample.y-sampleDiagnostics.y)<=1 && sampleDiagnostics.actual.toLowerCase() === sampleDiagnostics.mappedExpected.toLowerCase(), "sample source tap maps within one source pixel and returns that exact source color: " + JSON.stringify(sampleDiagnostics));
  const sampledSourceColor = sampleDiagnostics.actual;
  assert(/^#[0-9a-f]{6}$/i.test(sampledSourceColor), "real browser samples an actual opaque pixel for selective recolor");
  await evaluate('(() => { const input=document.querySelector("#recolor-temperature"); input.value="25"; input.dispatchEvent(new Event("input",{bubbles:true})); return input.value; })()');
  await waitFor('document.querySelector("#recolor-temperature-value").textContent === "25"', 3000);
  await waitFor('document.querySelector("#apply-recolor").disabled === false', 15000);
  await waitFor('document.querySelector("#recolor-status").textContent.includes("Vista previa lista")', 15000);
  const pixelWorkerDiagnostics = await evaluate("window.__ANIMEART_IMAGE_PROCESSING_DIAGNOSTICS__");
  assert(pixelWorkerDiagnostics?.workerCreated === true && pixelWorkerDiagnostics.workerOperations > 0 && pixelWorkerDiagnostics.fallbackOperations === 0 && pixelWorkerDiagnostics.lastOperation === "replace-color-range", "real browser sends selective recolor through the dedicated worker instead of the UI-thread fallback: " + JSON.stringify(pixelWorkerDiagnostics));
  await click("#apply-recolor");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.some(layer => layer.name.startsWith("Efecto de color · battleworn_knight"))', 15000);
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.find(layer => layer.name === "battleworn_knight").image.source === window.__animeArtOriginalRecolorSource'), "recolor creates a separate effect layer and keeps the original image source unchanged");
  await click("#erase-color-effect");
  assert(await evaluate('document.querySelector(\'[data-tool="eraser"]\').classList.contains("active")'), "dedicated effect eraser activates the existing alpha eraser on the effect layer");
  await click("#undo");
  await waitFor('!JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.some(layer => layer.name.startsWith("Efecto de color · battleworn_knight"))', 10000);
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.find(layer => layer.name === "battleworn_knight").image.source === window.__animeArtOriginalRecolorSource'), "undo removes the effect layer without changing the original");
  await click("#redo");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.some(layer => layer.name.startsWith("Efecto de color · battleworn_knight"))', 10000);
  await saveScreenshot("animeart-studio-selective-recolor.png");

  const backgroundCandidate = await evaluate('(() => { const layer=JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.find(layer => layer.name === "battleworn_knight"); return layer ? { id:layer.id, name:layer.name } : null; })()');
  assert(Boolean(backgroundCandidate), "background fixture is the selected character image");
  await click("#selection-mini-background");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers[0]?.id === ' + JSON.stringify(backgroundCandidate.id) + ' && JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.find(layer => layer.id === ' + JSON.stringify(backgroundCandidate.id) + ')?.isBackground === true');
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.find(layer => layer.id === ' + JSON.stringify(backgroundCandidate.id) + ')?.locked === true'), "set as background fixes the image at the bottom and locks it against accidental movement");
  await click("#selection-mini-background");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.find(layer => layer.id === ' + JSON.stringify(backgroundCandidate.id) + ')?.isBackground !== true && JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.find(layer => layer.id === ' + JSON.stringify(backgroundCandidate.id) + ')?.locked === false');
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.find(layer => layer.id === ' + JSON.stringify(backgroundCandidate.id) + ')?.name === "battleworn_knight"'), "unpinning restores a moveable image without changing its name");
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.at(-1)?.id === ' + JSON.stringify(backgroundCandidate.id)), "unpinning also restores the image to the top of the normal layer stack");

  const censorBefore = await evaluate('(() => { const layer=JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.find(layer => layer.id === ' + JSON.stringify(backgroundCandidate.id) + '); window.__animeArtCensorBefore=layer.image.source; return { width:layer.image.width, height:layer.image.height, flipX:layer.image.flipX }; })()');
  await clickMoreGoal("censor");
  await waitFor('document.querySelector("#censor-light-dialog").open === true', 10000);
  assert(await evaluate('document.querySelector("#censor-dialog-image-name").textContent.includes("battleworn_knight")'), "censor-light dialog explicitly targets the selected image");
  const censorBounds = await selectorCenter("#censor-image-preview");
  await mouseStroke([
    { x:censorBounds.x-censorBounds.width*0.18, y:censorBounds.y },
    { x:censorBounds.x, y:censorBounds.y },
    { x:censorBounds.x+censorBounds.width*0.18, y:censorBounds.y+censorBounds.height*0.03 }
  ]);
  await waitFor('document.querySelector("#censor-dialog-undo").disabled === false', 5000);
  await click("#censor-dialog-undo");
  await waitFor('document.querySelector("#censor-dialog-undo").disabled === true', 5000);
  await mouseStroke([
    { x:censorBounds.x-censorBounds.width*0.18, y:censorBounds.y+censorBounds.height*0.05 },
    { x:censorBounds.x, y:censorBounds.y+censorBounds.height*0.05 },
    { x:censorBounds.x+censorBounds.width*0.18, y:censorBounds.y+censorBounds.height*0.08 }
  ]);
  await waitFor('document.querySelector("#censor-dialog-undo").disabled === false', 5000);
  await click("#censor-dialog-apply");
  await waitFor('document.querySelector("#censor-light-dialog").open === false', 15000);
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.find(layer => layer.id === ' + JSON.stringify(backgroundCandidate.id) + ')?.image?.source !== window.__animeArtCensorBefore', 15000);
  const censoredImage = await evaluate('(() => { const layer=JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.find(layer => layer.id === ' + JSON.stringify(backgroundCandidate.id) + '); return { source:layer.image.source, width:layer.image.width, height:layer.image.height, flipX:layer.image.flipX }; })()');
  assert(censoredImage.width === censorBefore.width && censoredImage.height === censorBefore.height && censoredImage.flipX === false, "apply edits only the image pixels while retaining dimensions and baking the visual flip safely");
  await click("#undo");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.find(layer => layer.id === ' + JSON.stringify(backgroundCandidate.id) + ')?.image?.source === window.__animeArtCensorBefore', 10000);
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.find(layer => layer.id === ' + JSON.stringify(backgroundCandidate.id) + ')?.image?.flipX === true'), "Undo restores the original flipped image and its exact source");

  await evaluate('window.__animeArtTextDrawCount = 0; const originalFillText = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function(...args) { window.__animeArtTextDrawCount += 1; return originalFillText.apply(this, args); };');
  await click("#add-text-layer");
  const textLayerAfterCreate = (await readDocument()).layers.at(-1);
  assert(textLayerAfterCreate?.contentType === "text" && textLayerAfterCreate.text?.value === "Escribe aquí", "real browser creates an editable text layer");
  const textLayerId = textLayerAfterCreate.id;
  await evaluate('(() => { const el = document.querySelector("#text-content"); el.value = "AnimeArt Studio"; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); })()');
  assert(await evaluate('(() => { const layer=JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.id===' + JSON.stringify(textLayerId) + '); return layer?.text?.value==="Escribe aquí" && document.querySelector("#text-content").value==="AnimeArt Studio"; })()'),
    "typing updates the live preview while the saved text remains unchanged until Apply");
  assert(await evaluate('document.querySelector("#text-font-family").value === "Arial"'), "real browser exposes the selected text layer font controls");
  assert(await evaluate('window.__animeArtTextDrawCount > 0'), "real browser Canvas renderer paints editable text");
  await saveScreenshot("animeart-studio-text-layer.png");
  assert(await evaluate('document.querySelector("#apply-text-layer").getBoundingClientRect().height >= 44'), "text editor offers a visible Apply action");
  assert(await evaluate('document.querySelector("#delete-text-layer").getBoundingClientRect().height >= 44'), "text editor offers a visible Delete action");
  assert(await evaluate('document.querySelector("#cancel-text-layer").getBoundingClientRect().height >= 44'), "text editor offers a visible Cancel action");
  await click("#apply-text-layer");
  await waitFor('document.querySelector("#text-edit-dialog").open === false');
  assert((await readDocument()).layers.some(layer => layer.id === textLayerId && layer.text?.value === "AnimeArt Studio"), "Apply keeps the selected text as an editable canvas layer");
  await click("#undo");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.find(layer => layer.id === ' + JSON.stringify(textLayerId) + ')?.text?.value === "Escribe aquí"', 10000);
  await click("#redo");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.find(layer => layer.id === ' + JSON.stringify(textLayerId) + ')?.text?.value === "AnimeArt Studio"', 10000);

  // AA-TEXT-CLOSE-PRESERVES-EDITS-001: closing the editor commits a pending live style preview.
  await evaluate('document.querySelector("#selection-mini-edit-text").click()');
  await waitFor('document.querySelector("#text-edit-dialog").open === true', 10000);
  const pendingTextStyle = await evaluate('(() => { const documentModel=JSON.parse(localStorage.getItem("animeart-web-document")||"{}"); const layer=documentModel.layers.find(item=>item.id===' + JSON.stringify(textLayerId) + '); const input=document.querySelector("#text-font-size"); const before=layer.text.fontSize; const next=Math.min(240,before+13); input.value=String(next); input.dispatchEvent(new Event("input",{bubbles:true})); return {layerId:layer.id,before,next}; })()');
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.id===' + JSON.stringify(textLayerId) + ')?.text?.fontSize === ' + JSON.stringify(pendingTextStyle.before)),
    "live text styling remains a preview until the editor is closed or applied");
  await click("#close-text-edit");
  await waitFor('document.querySelector("#text-edit-dialog").open === false', 10000);
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.id===' + JSON.stringify(textLayerId) + ')?.text?.fontSize === ' + JSON.stringify(pendingTextStyle.before), 10000);
  assert((await readDocument()).layers.some(layer => layer.id === textLayerId && layer.text?.fontSize === pendingTextStyle.before),
    "closing an existing text editor with X discards its pending preview");
  await evaluate('document.querySelector("#selection-mini-edit-text").click()');
  await waitFor('document.querySelector("#text-edit-dialog").open === true', 10000);
  assert(await evaluate('Number(document.querySelector("#text-font-size").value) === ' + JSON.stringify(pendingTextStyle.before)),
    "reopening the editor restores the last committed font size after X cancellation");
  await evaluate('(() => { const input=document.querySelector("#text-font-size"); input.value=String(' + JSON.stringify(pendingTextStyle.next) + '); input.dispatchEvent(new Event("input",{bubbles:true})); })()');
  await click("#apply-text-layer");
  await waitFor('document.querySelector("#text-edit-dialog").open === false', 10000);
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.id===' + JSON.stringify(textLayerId) + ')?.text?.fontSize === ' + JSON.stringify(pendingTextStyle.next), 10000);

  // Explicit Cancel and native Escape discard the same pending preview as X.
  await evaluate('document.querySelector("#selection-mini-edit-text").click()');
  await waitFor('document.querySelector("#text-edit-dialog").open === true', 10000);
  await evaluate('(() => { const input=document.querySelector("#text-font-size"); input.value=String(' + JSON.stringify(Math.min(240,Math.max(8,1))) + '); input.dispatchEvent(new Event("input",{bubbles:true})); })()');
  await click("#cancel-text-layer");
  await waitFor('document.querySelector("#text-edit-dialog").open === false', 10000);
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.id===' + JSON.stringify(textLayerId) + ')?.text?.fontSize === ' + JSON.stringify(pendingTextStyle.next)),
    "Cancel discards the pending font-size preview");
  await evaluate('document.querySelector("#selection-mini-edit-text").click()');
  await waitFor('document.querySelector("#text-edit-dialog").open === true', 10000);
  await evaluate('(() => { const input=document.querySelector("#text-font-size"); input.value=String(' + JSON.stringify(Math.min(240,pendingTextStyle.next+11)) + '); input.dispatchEvent(new Event("input",{bubbles:true})); })()');
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await waitFor('document.querySelector("#text-edit-dialog").open === false', 10000);
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.id===' + JSON.stringify(textLayerId) + ')?.text?.fontSize === ' + JSON.stringify(pendingTextStyle.next)),
    "Escape discards the pending font-size preview");

  // Typography v2: letter spacing and line height persist, and custom styles are reusable.
  await evaluate('window.prompt=()=> "E2E Manga Tracking"');
  await evaluate('document.querySelector("#selection-mini-edit-text").click()');
  await waitFor('document.querySelector("#text-edit-dialog").open === true', 10000);
  await evaluate('(() => { const track=document.querySelector("#text-letter-spacing"); track.value="4"; track.dispatchEvent(new Event("input",{bubbles:true})); track.dispatchEvent(new Event("change",{bubbles:true})); const leading=document.querySelector("#text-line-height"); leading.value="1.65"; leading.dispatchEvent(new Event("input",{bubbles:true})); leading.dispatchEvent(new Event("change",{bubbles:true})); })()');
  assert(await evaluate('(() => { const layer=JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.id===' + JSON.stringify(textLayerId) + '); return layer?.text?.letterSpacing===0 && layer?.text?.lineHeight===1.2; })()'),
    "tracking and line-height controls remain previews before Apply");
  await click("#save-text-style");
  await waitFor('document.querySelector("#saved-text-styles [data-saved-text-style-apply]")?.textContent==="E2E Manga Tracking"', 10000);
  const savedReusableTextStyle = await evaluate('JSON.parse(localStorage.getItem("kapiart-saved-text-styles-v1")||"[]")[0]?.style');
  assert(savedReusableTextStyle?.letterSpacing===4 && savedReusableTextStyle?.lineHeight===1.65,
    "saving a reusable typography style captures both current preview values: " + JSON.stringify(savedReusableTextStyle));
  await evaluate('(() => { const track=document.querySelector("#text-letter-spacing"); track.value="-2"; track.dispatchEvent(new Event("input",{bubbles:true})); track.dispatchEvent(new Event("change",{bubbles:true})); const leading=document.querySelector("#text-line-height"); leading.value="1"; leading.dispatchEvent(new Event("input",{bubbles:true})); leading.dispatchEvent(new Event("change",{bubbles:true})); })()');
  assert(await evaluate('(() => { const layer=JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.id===' + JSON.stringify(textLayerId) + '); return layer?.text?.letterSpacing===0 && layer?.text?.lineHeight===1.2; })()'),
    "changing tracking again still leaves the saved document untouched");
  await click('#saved-text-styles [data-saved-text-style-apply]');
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.id===' + JSON.stringify(textLayerId) + ')?.text?.letterSpacing===0'),
    "choosing a reusable style remains a preview until Apply");
  await click("#apply-text-layer");
  await waitFor('document.querySelector("#text-edit-dialog").open === false', 10000);
  const reusableTextCommitDiagnostics = await evaluate('(() => { const doc=JSON.parse(localStorage.getItem("animeart-web-document")||"{}"); const layer=doc.layers.find(item=>item.id===' + JSON.stringify(textLayerId) + '); return {text:layer?.text, savedStyles:JSON.parse(localStorage.getItem("kapiart-saved-text-styles-v1")||"[]").map(item=>({name:item.name,style:item.style})), controls:{letterSpacing:document.querySelector("#text-letter-spacing")?.value,lineHeight:document.querySelector("#text-line-height")?.value},status:document.querySelector("#status")?.textContent}; })()');
  assert(reusableTextCommitDiagnostics.text?.letterSpacing===4 && reusableTextCommitDiagnostics.text?.lineHeight===1.65,
    "Apply commits the selected reusable typography values: " + JSON.stringify(reusableTextCommitDiagnostics));
  assert(await evaluate('(() => { const layer=JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.id===' + JSON.stringify(textLayerId) + '); return layer?.text?.value==="AnimeArt Studio" && layer.text.letterSpacing===4 && layer.text.lineHeight===1.65; })()'),
    "Apply commits the selected reusable style without replacing text content");
  await waitFor('document.querySelector("#text-edit-dialog").open === false', 10000);

  await click("#add-text-layer");
  const disposableText = (await readDocument()).layers.at(-1);
  assert(disposableText?.contentType === "text", "temporary text fixture is a normal editable layer");
  await click("#delete-text-layer");
  await waitFor('document.querySelector("#text-edit-dialog").open === false');
  await waitFor('!JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.some(layer => layer.id === ' + JSON.stringify(disposableText.id) + ')', 10000);
  assert(!(await readDocument()).layers.some(layer => layer.id === disposableText.id), "Delete text removes the exact selected text layer");

  await click("#add-text-layer");
  const cancelledText = (await readDocument()).layers.at(-1);
  assert(cancelledText?.contentType === "text", "new text starts as a provisional editable layer");
  await click("#close-text-edit");
  await waitFor('document.querySelector("#text-edit-dialog").open === false');
  await waitFor('!JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.some(layer => layer.id === ' + JSON.stringify(cancelledText.id) + ')', 10000);
  assert(!(await readDocument()).layers.some(layer => layer.id === cancelledText.id), "X cancels creation and removes the provisional text layer");

  // Anime character composer: select one real SVG trait for each category and create aligned editable layers.
  const characterVariantsBefore = (await readDocument()).layers.filter(layer => layer.name.startsWith("Personaje anime V")).length;
  await click("#toolbox-open");
  await waitFor('document.querySelector("#toolbox-dialog")?.open === true');
  await click("#quick-open-creative-studio");
  await waitFor('document.querySelector("#creative-studio-dialog")?.open === true');
  await click('[data-creative-tab="traits"]');
  await click('[data-creative-action="select-trait"][data-item-id="eyes-round-glossy"]');
  await click('[data-creative-action="select-trait"][data-item-id="hair-twin-tails"]');
  await click('[data-creative-action="select-trait"][data-item-id="face-angular-defined"]');  await evaluate('(() => { const filter=document.querySelector("#creative-trait-part"); filter.value="expression"; filter.dispatchEvent(new Event("change",{bubbles:true})); })()');
  await click('[data-creative-action="select-trait"][data-item-id="expression-surprised"]');
  await evaluate('(() => { const filter=document.querySelector("#creative-trait-part"); filter.value="all"; filter.dispatchEvent(new Event("change",{bubbles:true})); })()');
  await waitFor('document.querySelector("#creative-trait-create-character")?.disabled === false');
  await evaluate('(() => { for (const [id,value] of [["creative-trait-hair-color","#bb5533"],["creative-trait-eye-color","#0099cc"],["creative-trait-skin-color","#f0c2b0"],["creative-trait-line-color","#332211"]]) { const input=document.querySelector("#"+id); input.value=value; input.dispatchEvent(new Event("input",{bubbles:true})); input.dispatchEvent(new Event("change",{bubbles:true})); } })()');
  await click("#creative-trait-create-character");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.filter(layer => layer.name.startsWith("Personaje anime V")).length === ' + (characterVariantsBefore + 5), 10000);
  const composedCharacterLayers = (await readDocument()).layers.filter(layer => layer.name.startsWith("Personaje anime V")).slice(-5);
  assert(composedCharacterLayers.length === 5 && composedCharacterLayers.every(layer => layer.contentType === "image" && layer.isReference !== true && layer.image?.source?.startsWith("data:image/svg+xml")), "character composer creates five actual SVG image layers including a separate expression layer rather than a flattened preview");
  assert(new Set(composedCharacterLayers.map(layer => JSON.stringify(layer.transform))).size === 1, "character parts begin aligned with the same transform and remain independently editable");
  assert(composedCharacterLayers.some(layer => layer.name.includes("Cabello base")) && composedCharacterLayers.some(layer => layer.name.includes("Rostro")) && composedCharacterLayers.some(layer => layer.name.includes("Flequillo")) && composedCharacterLayers.some(layer => layer.name.includes("Ojos")) && composedCharacterLayers.some(layer => layer.name.includes("Expresión")), "the five layers preserve all character parts, including the expression, by name");
  assert(composedCharacterLayers.every(layer => layer.characterComposition?.componentIds?.expression === "expression-surprised"), "the selected expression ID is saved in every editable character-part record");
  assert(await evaluate('document.querySelector("#creative-character-status").textContent.includes("creado en cinco capas")'), "character composer reports a successful five-layer editable character");
  await evaluate('(() => { const input=document.querySelector("#creative-trait-hair-color"); input.value="#4D2E5F"; input.dispatchEvent(new Event("input",{bubbles:true})); input.dispatchEvent(new Event("change",{bubbles:true})); })()');
  await click("#creative-trait-create-character");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.filter(layer => layer.name.startsWith("Personaje anime V")).length === ' + (characterVariantsBefore + 10), 10000);
  const secondVariantLayers = (await readDocument()).layers.filter(layer => layer.name.startsWith("Personaje anime V")).slice(-5);
  assert(secondVariantLayers.every(layer => layer.name.startsWith("Personaje anime V2 ·") && layer.contentType === "image"), "the selected traits can generate a second separately named character variant");
  assert(new Set(secondVariantLayers.map(layer => JSON.stringify(layer.transform))).size === 1 && JSON.stringify(secondVariantLayers[0].transform) !== JSON.stringify(composedCharacterLayers[0].transform), "the second character variant occupies a different comparison slot");
  assert(await evaluate('document.querySelector("#creative-character-status").textContent.includes("V2 creado en cinco capas")'), "second variant reports its own version status");
  await click("#creative-studio-close");
  await waitFor('document.querySelector("#creative-studio-dialog")?.open === false');
  await click("#undo");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.filter(layer => layer.name.startsWith("Personaje anime V")).length === ' + (characterVariantsBefore + 5), 10000);
  assert((await readDocument()).layers.filter(layer => layer.name.startsWith("Personaje anime V1 ·" )).length === 5, "undo removes only the newest character variant and preserves its predecessor");
  await click("#redo");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.filter(layer => layer.name.startsWith("Personaje anime V")).length === ' + (characterVariantsBefore + 10), 10000);
  await evaluate('window.__animeArtStrokeTextCount = 0; const originalStrokeText = CanvasRenderingContext2D.prototype.strokeText; CanvasRenderingContext2D.prototype.strokeText = function(...args) { window.__animeArtStrokeTextCount += 1; return originalStrokeText.apply(this, args); };');
  await click("#add-meme-text");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.filter(layer => layer.name === "Meme Top" || layer.name === "Meme Bottom").length === 2', 10000);
  const memeLayers = (await readDocument()).layers.filter(layer => layer.name === "Meme Top" || layer.name === "Meme Bottom");
  assert(memeLayers.length === 2 && memeLayers.every(layer => layer.contentType === "text" && layer.text?.fontFamily === "Impact" && layer.text?.outlineWidth > 0), "real browser creates two editable outlined meme caption layers");
  assert(await evaluate('window.__animeArtStrokeTextCount > 0'), "real browser draws caption outlines through Canvas strokeText");
  await saveScreenshot("animeart-studio-meme-captions.png");

  const exportDocumentSize = await evaluate('(()=>{const d=JSON.parse(localStorage.getItem("animeart-web-document")||"{}");return {width:d.width,height:d.height};})()');
  const pngFilesBeforeHdExport = Object.fromEntries(readdirSync(downloadDir).filter(name => /^animeart(?: \(\d+\))?\.png$/.test(name)).map(name => [name, statSync(join(downloadDir,name)).mtimeMs]));
  await evaluate('(()=>{const select=document.querySelector("#export-resolution");select.value="hd";select.dispatchEvent(new Event("change",{bubbles:true}));})()');
  assert(await evaluate('document.querySelector("#export-resolution").value==="hd" && document.querySelector("#mobile-export-resolution").value==="hd"'), "Normal/HD selector synchronizes desktop settings and mobile dock");
  await click("#export-png");
  await waitFor('document.querySelector("#status").textContent !== "Exporting PNG…"', 10000);
  const exportStatus = await evaluate('document.querySelector("#status").textContent');
  assert(exportStatus === "PNG exported", "real browser PNG export completes successfully: " + exportStatus);
  const downloadedPng = join(downloadDir, "animeart.png");
  const downloadDeadline = Date.now() + 10000;
  while (Date.now() < downloadDeadline && !statSync(downloadedPng, { throwIfNoEntry: false })) await sleep(100);
  const pngStat = statSync(downloadedPng, { throwIfNoEntry: false });
  assert(Boolean(pngStat && pngStat.size > 0), "real browser PNG export produces a non-empty downloaded PNG file");
  const hdDownloadDeadline = Date.now() + 10000;
  let hdPngPath = null;
  while (Date.now() < hdDownloadDeadline) {
    const changedPngs = readdirSync(downloadDir)
      .filter(name => /^animeart(?: \(\d+\))?\.png$/.test(name))
      .map(name => ({ path: join(downloadDir,name), mtimeMs: statSync(join(downloadDir,name)).mtimeMs, size: statSync(join(downloadDir,name)).size }))
      .filter(file => file.size > 0 && (!Object.hasOwn(pngFilesBeforeHdExport, file.path.split(/[\\/]/).pop()) || file.mtimeMs > pngFilesBeforeHdExport[file.path.split(/[\\/]/).pop()]));
    if (changedPngs.length) {
      changedPngs.sort((left,right) => right.mtimeMs-left.mtimeMs);
      hdPngPath = changedPngs[0].path;
      break;
    }
    await sleep(100);
  }
  assert(Boolean(hdPngPath), "HD export produces or updates a PNG download rather than leaving only the older file");
  const hdPng = readFileSync(hdPngPath);
  const hdWidth = hdPng.readUInt32BE(16), hdHeight = hdPng.readUInt32BE(20);
  const expectedHdScale = Math.max(1,Math.min(2,Math.sqrt(16_000_000/(exportDocumentSize.width*exportDocumentSize.height))));
  assert(hdWidth===Math.round(exportDocumentSize.width*expectedHdScale) && hdHeight===Math.round(exportDocumentSize.height*expectedHdScale), "HD export uses selected output dimensions without changing the editable document canvas");

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
  assert((await evaluate('document.querySelector("#storage-recovery-notice").textContent')).includes("No se pudo abrir el proyecto guardado"), "invalid project produces explicit recovery status in Spanish");

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
  await click("#new-document");
  await waitFor('document.querySelector("#project-dialog").open === true');
  await evaluate('(() => { document.querySelector("#document-width").value = "640"; document.querySelector("#document-height").value = "480"; })()');
  await click('#project-form button[type="submit"]');
  await waitFor('document.querySelector("#status").textContent === "New document created"');
  assert(await evaluate('localStorage.getItem("animeart-web-document") === ' + JSON.stringify(incompatiblePayload)), "creating a replacement document cannot overwrite the unsupported source before explicit Save");
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
  await click('[aria-label="Seleccionar capa shape-mask-fixture"]');
  await waitFor('document.querySelector("#image-mask-panel").hidden === false');
  await evaluate('(() => { const select=document.querySelector("#image-mask");select.value="heart";select.dispatchEvent(new Event("change",{bubbles:true})); })()');
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.some(layer=>layer.name==="shape-mask-fixture"&&layer.image?.mask==="heart")');
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.some(layer=>layer.name==="shape-mask-fixture"&&layer.image?.mask==="heart")'), "shape mask is applied and persisted to the selected image layer");
  await click("#undo");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.some(layer=>layer.name==="shape-mask-fixture"&&layer.image?.mask==="none")');
  await click("#redo");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers.some(layer=>layer.name==="shape-mask-fixture"&&layer.image?.mask==="heart")');
  assert(await evaluate('document.querySelector("#image-mask").value==="heart"'), "shape mask participates in undo and redo");

  // AA-CREATIVE-STUDIO-001: use real gallery UI, add editable assets and verify Undo.
  const creativeBaselineIds = (await readDocument()).layers.map(layer => layer.id);
  await clickMoreGoal("creative-studio");
  await waitFor('document.querySelector("#creative-studio-dialog")?.open === true');
  assert(await evaluate('document.querySelectorAll("[data-creative-tab]").length === 6'), "creative studio exposes Covers, Stickers, Words, Style Packs and Anime Traits tabs");
  await click('[data-creative-tab="stickers"]');
  await click('[data-creative-action="add-sticker"][data-item-id="sakura-bloom"]');
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.some(layer=>layer.name==="Sticker · Flor de sakura"&&layer.contentType==="image")');
  const creativeSticker=(await readDocument()).layers.find(layer=>layer.name==="Sticker · Flor de sakura");
  assert(creativeSticker.image?.source?.startsWith("data:image/svg+xml;charset=utf-8,")&&creativeSticker.image.width===256,"sakura sticker is a local vector image layer that can be transformed independently");

  // AA-OVERLAP-DRAG-001: keep the already selected lower sticker as the drag target.
  await click('[data-creative-action="add-sticker"][data-item-id="sakura-bloom"]');
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.filter(layer=>layer.name==="Sticker · Flor de sakura"&&layer.contentType==="image").length===2');
  const overlappingStickers = (await readDocument()).layers.filter(layer=>layer.name==="Sticker · Flor de sakura"&&layer.contentType==="image");
  const lowerSticker = overlappingStickers[0];
  const upperSticker = overlappingStickers[1];
  assert(lowerSticker.id!==upperSticker.id, "duplicated sticker creates an independent editable layer");
  await click("#creative-studio-close");
  await waitFor('document.querySelector("#creative-studio-dialog").open===false');
  await click(layerButtonSelector(lowerSticker.id));
  const sakuraOverlapTransformsBefore = (await readDocument()).layers.filter(layer=>layer.name==="Sticker · Flor de sakura"&&layer.contentType==="image").map(layer=>({id:layer.id,transform:{...layer.transform}}));
  const overlapCanvasCenter = await selectorCenter("#canvas");
  await mouseDrag(overlapCanvasCenter, {x:overlapCanvasCenter.x+46,y:overlapCanvasCenter.y+28});
  const sakuraOverlapTransformsAfter = (await readDocument()).layers.filter(layer=>layer.name==="Sticker · Flor de sakura"&&layer.contentType==="image").map(layer=>({id:layer.id,transform:{...layer.transform}}));
  const sakuraLowerBefore = sakuraOverlapTransformsBefore.find(layer=>layer.id===lowerSticker.id);
  const sakuraUpperBefore = sakuraOverlapTransformsBefore.find(layer=>layer.id===upperSticker.id);
  const sakuraLowerAfter = sakuraOverlapTransformsAfter.find(layer=>layer.id===lowerSticker.id);
  const sakuraUpperAfter = sakuraOverlapTransformsAfter.find(layer=>layer.id===upperSticker.id);
  assert(sakuraLowerAfter.transform.x!==sakuraLowerBefore.transform.x||sakuraLowerAfter.transform.y!==sakuraLowerBefore.transform.y,
    "dragging at an overlap moves the already selected sticker underneath instead of stealing the gesture");
  assert(sakuraUpperAfter.transform.x===sakuraUpperBefore.transform.x&&sakuraUpperAfter.transform.y===sakuraUpperBefore.transform.y,
    "the upper overlapping sticker stays in place when the lower selected layer is dragged");
  await click(layerButtonSelector(upperSticker.id));
  assert(await evaluate('document.querySelector("#selection-indicator").textContent.includes("Sticker · Flor de sakura")'),
    "the layer list remains the explicit way to select a different overlapping sticker");
  // Restore the test fixture after verifying the drag. Undo history can group
  // the two rapid sticker insertions, so accept either zero or one remaining.
  await click("#undo");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.filter(layer=>layer.name==="Sticker · Flor de sakura"&&layer.contentType==="image").length===2');
  await click("#undo");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.filter(layer=>layer.name==="Sticker · Flor de sakura"&&layer.contentType==="image").length<=1');
  // Layer controls require the studio to be closed, so reopen it before the next creative-studio step.
  await clickMoreGoal("creative-studio");
  await waitFor('document.querySelector("#creative-studio-dialog")?.open === true');
  await click('[data-creative-tab="words"]');
  await evaluate('document.querySelector("#creative-custom-word").value="SAKURA!!"');
  await click('[data-creative-action="add-word"][data-item-id="cyber-idol"]');
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.some(layer=>layer.name==="Título · Neon idol"&&layer.contentType==="text"&&layer.text.value==="SAKURA!!")');
  const creativeWord=(await readDocument()).layers.find(layer=>layer.name==="Título · Neon idol");
  assert(creativeWord.text?.outlineWidth>0&&creativeWord.text?.shadowBlur>0,"anime word art remains editable text with actual outline and shadow styling");
  await click('[data-creative-tab="packs"]');
  await click('[data-creative-action="apply-pack"][data-item-id="galaxy-idol"]');
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.filter(layer=>layer.name.startsWith("Conjunto · Idol galáctica")).length===3');
  const packLayers=(await readDocument()).layers.filter(layer=>layer.name.startsWith("Conjunto · Idol galáctica"));
  assert(packLayers.some(layer=>layer.contentType==="text")&&packLayers.some(layer=>layer.contentType==="image"),"a style pack adds separately editable title, subtitle and sticker layers");
  await click("#creative-studio-close");
  await waitFor('document.querySelector("#creative-studio-dialog").open===false');
  await clickMoreGoal("undo");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.filter(layer=>layer.name.startsWith("Conjunto · Idol galáctica")).length===0');
  await clickMoreGoal("undo");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.some(layer=>layer.name==="Título · Neon idol")===false');
  // Remove any remaining test stickers without assuming the history records
  // rapid insertions separately or together. Stop once the baseline is restored.
  for (let undoIndex = 0; undoIndex < 2; undoIndex += 1) {
    const remainingSakuraCount = await evaluate('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.filter(layer=>layer.name==="Sticker · Flor de sakura"&&layer.contentType==="image").length');
    if (remainingSakuraCount === 0) break;
    await clickMoreGoal("undo");
    await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.filter(layer=>layer.name==="Sticker · Flor de sakura"&&layer.contentType==="image").length < ' + remainingSakuraCount);
  }
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.some(layer=>layer.name==="Sticker · Flor de sakura")===false');
  assert(JSON.stringify((await readDocument()).layers.map(layer=>layer.id))===JSON.stringify(creativeBaselineIds),"Undo removes the style pack, title, and sticker test fixture while preserving baseline layers");

  await evaluate("window.confirm = () => true");
  await clickMoreGoal("creative-studio");
  await waitFor('document.querySelector("#creative-studio-dialog")?.open===true');
  await click('[data-creative-action="select-template"][data-item-id="galactic-dream"]');
  await evaluate('document.querySelector("#creative-cover-title").value="E2E GALAXY"; document.querySelector("#creative-cover-size").value="portrait";');
  await click("#creative-create-cover");
  await waitFor('document.querySelector("#creative-studio-dialog").open===false');
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").width===1080&&JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers?.length===3');
  const catalogCover=await readDocument();
  assert(catalogCover.layers[0].image?.source?.startsWith("data:image/svg+xml;charset=utf-8,")&&catalogCover.layers[0].image.source.includes("radialGradient"),"galactic cover uses original offline vector art, not a remote thumbnail");
  assert(catalogCover.layers[1].text?.value==="E2E GALAXY"&&catalogCover.layers[2].text?.value==="COSMIC STORY · VOL. 01","cover title and subtitle remain separate editable text layers");

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
  await click('[aria-label="Seleccionar capa magic-tap-fixture"]');
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
  // Background removal must show the unmodified image first and only compute a cutout after explicit preview.
  await evaluate('(async () => { const source=document.createElement("canvas");source.width=128;source.height=128;const context=source.getContext("2d");context.fillStyle="#ffffff";context.fillRect(0,0,128,128);context.fillStyle="#d21e23";context.fillRect(8,8,24,24);const blob=await new Promise(resolve=>source.toBlob(resolve,"image/png"));const file=new File([blob],"background-removal-preview-fixture.png",{type:"image/png"});const transfer=new DataTransfer();transfer.items.add(file);const input=document.querySelector("#image-file-input");input.files=transfer.files;input.dispatchEvent(new Event("change",{bubbles:true}));return blob.size;})()');
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.some(layer=>layer.name==="background-removal-preview-fixture")',10000);
  const backgroundPreviewSourceBefore = await evaluate('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="background-removal-preview-fixture").image.source');
  await click("#remove-background");
  await waitFor('document.querySelector("#background-removal-dialog").open === true');
  const originalBackgroundPreviewAlpha = await evaluate('document.querySelector("#background-removal-preview").getContext("2d",{willReadFrequently:true}).getImageData(64,64,1,1).data[3]');
  assert(originalBackgroundPreviewAlpha===255, "opening Remove Background displays the untouched original pixels, not a pre-removed background");
  assert(await evaluate('document.querySelector("#apply-background-removal").disabled === true'), "Apply remains disabled until removal preview or a manual erase stroke is explicitly requested");
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="background-removal-preview-fixture").image.source === '+JSON.stringify(backgroundPreviewSourceBefore)), "opening Remove Background does not mutate the selected image");
  const zoomWidthBefore = await evaluate('document.querySelector("#background-removal-preview").getBoundingClientRect().width');
  await click("#background-removal-zoom-in");
  await waitFor('document.querySelector("#background-removal-preview").getBoundingClientRect().width > ' + JSON.stringify(zoomWidthBefore * 1.4), 5000);
  assert(await evaluate('document.querySelector(".background-removal-preview-wrap").classList.contains("is-zoomed")'), "zoom controls switch the preview to a pannable enlarged image");
  for (let step = 0; step < 5; step++) await click("#background-removal-zoom-in");
  await waitFor('document.querySelector(".background-removal-preview-wrap").scrollWidth > document.querySelector(".background-removal-preview-wrap").clientWidth', 5000);
  const previewPanStart = await selectorCenter("#background-removal-preview");
  const panBefore = await evaluate('({x:document.querySelector(".background-removal-preview-wrap").scrollLeft,y:document.querySelector(".background-removal-preview-wrap").scrollTop})');
  await mouseDrag(previewPanStart, {x:previewPanStart.x-36,y:previewPanStart.y-28});
  await waitFor('document.querySelector(".background-removal-preview-wrap").scrollLeft !== ' + JSON.stringify(panBefore.x) + ' || document.querySelector(".background-removal-preview-wrap").scrollTop !== ' + JSON.stringify(panBefore.y), 5000);
  await click("#background-removal-zoom-fit");
  await waitFor('!document.querySelector(".background-removal-preview-wrap").classList.contains("is-zoomed")');
  await click("#preview-background-removal");
  await waitFor('document.querySelector("#background-removal-preview").getContext("2d",{willReadFrequently:true}).getImageData(64,64,1,1).data[3] === 0', 10000);
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="background-removal-preview-fixture").image.source === '+JSON.stringify(backgroundPreviewSourceBefore)), "preview generates transparent pixels without changing the document before Apply");
  assert(await evaluate('document.querySelector("#apply-background-removal").disabled === false'), "Apply becomes available only after the explicit background-removal preview");
  // Local background-processing profiles are saved, reapplied and deleted in the real editor.
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
  await evaluate("(async () => { const source = document.createElement('canvas'); source.width = 4; source.height = 4; const sourceContext = source.getContext('2d'); sourceContext.fillStyle = '#00eaff'; sourceContext.fillRect(0, 0, 4, 4); const blob = await new Promise(resolve => source.toBlob(resolve, 'image/png')); if (!blob || !blob.size) throw new Error('Could not create valid PNG fixture'); const file = new File([blob], 'protected-import.png', { type: 'image/png' }); const transfer = new DataTransfer(); transfer.items.add(file); const input = document.querySelector('#image-file-input'); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await waitFor('/(protected|protegido)/i.test(document.querySelector("#status").textContent)', 10000);
  assert(await evaluate('localStorage.getItem("animeart-web-document") === ' + JSON.stringify(quotaPayload)), "image import during recovery cannot overwrite the protected payload");
  assert(await evaluate('document.querySelectorAll("#layers li").length === ' + pendingLayerCount), "rejected image import does not report success or commit a layer");
  assert(await evaluate('document.querySelector("#storage-recovery-notice").hidden === false'), "warning remains visible after rejected image import");
  await click("#save");
  // The service-worker diagnostic may update #status asynchronously after a successful
  // save. Assert the durable recovery state transition here, not a transient status string.
  await waitFor('document.querySelector("#storage-recovery-notice").hidden === true');
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
  await waitFor('document.querySelector("#status").textContent === "Guardado localmente"');
  const migratedLegacy = await readDocument();
  assert(migratedLegacy.version === 2, "explicit save serializes supported legacy project into the current version");
  assert(migratedLegacy.layers[0].name === "Legacy Sketch", "legacy migration preserves layer metadata");
  assert(migratedLegacy.layers[0].strokes.length === 1, "legacy migration preserves the original stroke");
  assert(migratedLegacy.layers[0].strokes[0].points.length === 3, "legacy migration preserves all legacy stroke points");

  // AA-MOBILE-REDESIGN-004: exercise a genuine JPEG Blob through the same device file-input path.
  const jpegLayerCountBefore = (await readLayerSummary()).length;
  const jpegImport = await evaluate(`(async () => {
    const diagnostics = window.__animeArtJpegImportDiagnostics = {
      changeObserved: false, files: [], messages: [],
      layersBefore: JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers?.length ?? 0
    };
    const status = document.querySelector("#status");
    const feedback = document.querySelector("#mobile-feedback");
    const observer = new MutationObserver(() => diagnostics.messages.push({
      status: status?.textContent || "", feedback: feedback?.textContent || ""
    }));
    if (status) observer.observe(status, { childList: true, subtree: true, characterData: true });
    if (feedback) observer.observe(feedback, { childList: true, subtree: true, characterData: true });
    const source = document.createElement("canvas");
    source.width = 1280;
    source.height = 960;
    const context = source.getContext("2d");
    context.fillStyle = "#142033";
    context.fillRect(0, 0, source.width, source.height);
    const gradient = context.createLinearGradient(0, 0, source.width, source.height);
    gradient.addColorStop(0, "#ff4fd8");
    gradient.addColorStop(1, "#12657b");
    context.fillStyle = gradient;
    context.fillRect(40, 40, source.width - 80, source.height - 80);
    context.fillStyle = "#f8e7ff";
    context.fillRect(160, 150, 240, 180);
    const blob = await new Promise(resolve => source.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob || blob.type !== "image/jpeg" || blob.size === 0) {
      return { type: blob?.type || null, size: blob?.size || 0, immediate: diagnostics };
    }
    const file = new File([blob], "e2e-fixture-jpeg.jpg", { type: "image/jpeg" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const input = document.querySelector("#image-file-input");
    document.addEventListener("change", event => {
      if (event.target !== input) return;
      diagnostics.changeObserved = true;
      diagnostics.files = Array.from(input.files || []).map(selectedFile => ({
        name: selectedFile.name, type: selectedFile.type, size: selectedFile.size
      }));
    }, { capture: true, once: true });
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    const raw = localStorage.getItem("animeart-web-document");
    diagnostics.immediateStatus = status?.textContent || "";
    diagnostics.immediateFeedback = feedback?.textContent || "";
    diagnostics.layersImmediatelyAfterChange = JSON.parse(raw || "{}").layers?.length ?? 0;
    diagnostics.storedCharactersImmediatelyAfterChange = raw?.length ?? 0;
    return { type: blob.type, size: blob.size, width: source.width, height: source.height, immediate: diagnostics };
  })()`);
  console.log("JPEG_FIXTURE_RESULT: " + JSON.stringify(jpegImport));
  assert(jpegImport.type === "image/jpeg" && jpegImport.size > 0 && jpegImport.width === 1280 && jpegImport.height === 960, "browser generated a representative 1280×960 JPEG fixture for import: " + JSON.stringify({ type: jpegImport.type, size: jpegImport.size, width: jpegImport.width, height: jpegImport.height, immediate: jpegImport.immediate }));
  assert(jpegImport.immediate?.changeObserved === true, "JPEG change event reached the file-input listener path");
  assert(jpegImport.immediate?.files?.[0]?.name === "e2e-fixture-jpeg.jpg" &&
    jpegImport.immediate?.files?.[0]?.type === "image/jpeg" &&
    jpegImport.immediate?.files?.[0]?.size === jpegImport.size,
    "JPEG listener captures filename, MIME type and non-empty size immediately after change");

  let jpegPersistenceFailure = null;
  try {
    await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers?.length === ' + (jpegLayerCountBefore + 1), 10000);
  } catch (error) {
    jpegPersistenceFailure = error.message;
  }
  const jpegFinalDiagnostics = await evaluate(`(() => {
    const raw = localStorage.getItem("animeart-web-document");
    let saved = null;
    try {
      const stored = JSON.parse(raw || "{}");
      saved = { layerCount: stored.layers?.length ?? null, layers: Array.isArray(stored.layers)
        ? stored.layers.map(layer => ({ name: layer.name, contentType: layer.contentType,
            width: layer.image?.width ?? null, height: layer.image?.height ?? null })) : [] };
    } catch (error) { saved = { parseError: error?.name || "Error" }; }
    return { status: document.querySelector("#status")?.textContent || "",
      feedback: document.querySelector("#mobile-feedback")?.textContent || "",
      diagnostics: window.__animeArtJpegImportDiagnostics || null,
      storedCharacters: raw?.length ?? 0, saved };
  })()`);
  if (jpegPersistenceFailure) {
    throw new Error("JPEG import did not persist a new image layer; diagnostics=" +
      JSON.stringify(jpegFinalDiagnostics) + "; waitFailure=" + jpegPersistenceFailure);
  }
  const jpegLayer = (await readLayerSummary()).at(-1);
  assert(jpegLayer?.contentType === "image", "real JPEG import creates an image layer");
  assert(jpegLayer?.name === "e2e-fixture-jpeg", "real JPEG import preserves the filename as its layer name");
  assert(jpegLayer?.image?.width === 1280 && jpegLayer?.image?.height === 960 && jpegLayer?.image?.mime === "image/jpeg",
    "real JPEG import persists decoded dimensions and original JPEG MIME data");
  assert(await evaluate('document.querySelector("#selection-mini-layer-name").textContent.includes("e2e-fixture-jpeg")'),
    "real JPEG import selects the new image layer");
  assert(await evaluate('document.querySelector("#mobile-feedback").textContent.includes("Imagen añadida al lienzo")'),
    "successful JPEG import reports localized success feedback");

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
  assert((await evaluate('document.querySelector("#storage-recovery-notice").textContent')).includes("No se pudo leer el almacenamiento local"), "read failure displays the localized storage-unavailable warning");
  assert(await evaluate('localStorage.getItem("animeart-web-document") === ' + JSON.stringify(readFailurePayload)), "payload is exactly preserved after deterministic startup read failure");
  await click("#add-layer");
  assert(await evaluate('localStorage.getItem("animeart-web-document") === ' + JSON.stringify(readFailurePayload)), "automatic writes remain paused after startup read failure");
  assert(await evaluate('document.querySelector("#storage-recovery-notice").hidden === false'), "startup read failure remains in protected recovery state");

  assert(await evaluate('document.documentElement.dataset.serviceWorkerActive === "true"'), "real browser service worker is active");

  // The fault-injection test intentionally leaves an unreadable local document behind.
  // Clear only that test fixture before gesture checks and visual screenshots.
  await evaluate('localStorage.removeItem("animeart-web-document")');
  await cdp("Page.reload", { ignoreCache: true });
  await waitFor('document.readyState === "complete"');
  await waitFor('document.querySelector("#storage-recovery-notice")?.hidden === true', 10000);
  await waitForServiceWorkerReadiness();
  await click("#new-document");
  await waitFor('document.querySelector("#project-dialog")?.open === true', 10000);
  await evaluate('document.querySelector("#document-width").value = "640"; document.querySelector("#document-height").value = "480"; document.querySelector("#project-form").requestSubmit();');
  await waitFor('!document.querySelector("#project-dialog")?.open', 10000);
  await click("#save");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").width === 640 && JSON.parse(localStorage.getItem("animeart-web-document") || "{}").height === 480', 10000);
  assert(await evaluate('document.querySelector("#status").textContent === "Guardado localmente"'),
    "a real 640×480 transparent document is created and persisted before mobile visual tests");

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
  assert(await evaluate('window.innerWidth === 393 && window.innerHeight === 873'), "Xiaomi-sized mobile E2E runs at a 393 × 873 CSS-pixel viewport");
  assert(await evaluate('(() => { const header=document.querySelector(".topbar"); const style=getComputedStyle(header); const r=header.getBoundingClientRect(); const workspace=document.querySelector(".workspace").getBoundingClientRect(); return style.display!=="none" && style.visibility!=="hidden" && Number(style.opacity)>0 && r.height>=48 && r.width>=innerWidth*.95 && r.top>=0 && r.bottom<=innerHeight && r.bottom<=workspace.top+1; })()'), "mobile header is actually visible inside the viewport and does not overlap the workspace");
  assert(await evaluate('(() => { const brand=document.querySelector(".topbar .brand"); const style=getComputedStyle(brand); const r=brand.getBoundingClientRect(); return style.display!=="none" && style.visibility!=="hidden" && Number(style.opacity)>0 && r.width>=60 && r.height>=24; })()'), "AnimeArt branding is visible in the mobile header");
  assert(await evaluate('(() => { const actions=document.querySelector(".mobile-top-actions"); const style=getComputedStyle(actions); return style.display!=="none" && style.visibility!=="hidden" && Array.from(actions.querySelectorAll("button")).every(el => { const r=el.getBoundingClientRect(); const s=getComputedStyle(el); return s.display!=="none" && s.visibility!=="hidden" && r.width>=44 && r.height>=44; }); })()'), "mobile header actions are visible and meet the 44px touch-target floor");
  assert(await evaluate('document.querySelectorAll(".mobile-touch-dock [data-touch-action]").length === 6'), "mobile dock keeps six primary actions and avoids duplicating secondary tools");
  await click('.mobile-touch-dock [data-touch-action="more"]');
  await waitFor('document.body.classList.contains("mobile-tools-open")');
  assert(await evaluate('(()=>{const s=document.querySelector("#mobile-export-resolution");const r=s.getBoundingClientRect();const p=getComputedStyle(s.parentElement);return Boolean(s&&p.display!=="none"&&r.width>=55&&r.height>=30&&r.bottom<=innerHeight);})()'), "Normal/HD settings are touch-usable inside More, not repeated on the dock");
  await click('.mobile-touch-dock [data-touch-action="more"]');
  await waitFor('!document.body.classList.contains("mobile-tools-open")');
  assert(await evaluate('document.querySelector("#storage-recovery-notice").hidden === true'), "mobile editor starts without stale storage-recovery warning");
  await evaluate('window.__ANIMEART_E2E_DIAGNOSTICS__ = true; window.dispatchEvent(new Event("resize"));');
  await waitFor('Boolean(window.__ANIMEART_DOCUMENT_FRAME_DIAGNOSTICS__?.topLeft && window.__ANIMEART_DOCUMENT_FRAME_DIAGNOSTICS__?.bottomRight)');
  const transparencyCheck = await evaluate('(() => { const doc=JSON.parse(localStorage.getItem("animeart-web-document")||"{}"); const c=document.querySelector("#canvas"); const r=c.getBoundingClientRect(); const f=window.__ANIMEART_DOCUMENT_FRAME_DIAGNOSTICS__; if(!f?.topLeft||!f?.topRight||!f?.bottomLeft||!f?.bottomRight||!r.width||!r.height)return {ok:false,reason:"document-frame diagnostics unavailable"}; const left=Math.min(f.topLeft.x,f.bottomLeft.x); const right=Math.max(f.topRight.x,f.bottomRight.x); const top=Math.min(f.topLeft.y,f.topRight.y); const bottom=Math.max(f.bottomLeft.y,f.bottomRight.y); const visibleLeft=Math.max(2,left); const visibleRight=Math.min(r.width-2,right); const visibleTop=Math.max(2,top); const visibleBottom=Math.min(r.height-2,bottom); const visibleWidth=visibleRight-visibleLeft; const visibleHeight=visibleBottom-visibleTop; if(visibleWidth<12||visibleHeight<12)return {ok:false,reason:"page has no safe visible sample",frame:{left,right,top,bottom},canvas:{width:r.width,height:r.height}}; const cssX=visibleLeft+visibleWidth*.37; const cssY=visibleTop+visibleHeight*.37; const x=Math.max(0,Math.min(c.width-1,Math.floor(cssX*c.width/r.width))); const y=Math.max(0,Math.min(c.height-1,Math.floor(cssY*c.height/r.height))); const alpha=c.getContext("2d",{willReadFrequently:true}).getImageData(x,y,1,1).data[3]; const hasImage=doc.layers.some(layer=>layer.contentType==="image"&&layer.image?.source); return {ok:!hasImage&&alpha===0,alpha,hasImage,sample:{cssX,cssY,x,y},frame:{left,right,top,bottom},canvas:{width:c.width,height:c.height,cssWidth:r.width,cssHeight:r.height}}; })()');
  assert(transparencyCheck.ok,
    "new documents start as a transparent empty canvas; the checkerboard is view-only, not a background image layer: " + JSON.stringify(transparencyCheck));
  assert(await evaluate('document.querySelector(".canvas-wrap").getBoundingClientRect().height >= 600 && document.querySelector("#canvas").getBoundingClientRect().height >= 500'), "the canvas is the dominant workspace, not a small panel");
  assert(await evaluate('getComputedStyle(document.querySelector(".workspace")).gridTemplateColumns.split(" ").length === 1'), "mobile workspace uses a single canvas column instead of the desktop sidebars");
  assert(await evaluate('document.querySelector(".mobile-touch-dock").getBoundingClientRect().height >= 54'), "compact primary dock retains a usable touch target area");
  assert(await evaluate('Array.from(document.querySelectorAll(".mobile-touch-dock button")).every(el => { const r = el.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })'), "Xiaomi-sized quick-action buttons meet the 44px touch-target floor");
  assert(await evaluate('getComputedStyle(document.querySelector(".mobile-touch-dock")).overflowX === "auto" && document.querySelectorAll(".mobile-touch-dock [data-touch-action]").length === 6'), "the compact dock fits six common actions instead of scrolling through every tool");
  assert(await evaluate('document.querySelectorAll(".mobile-touch-dock [data-touch-action]").length === 6'), "rotation and flip remain available in More, not as permanent dock buttons");
  await evaluate('document.querySelector(".mobile-touch-dock").scrollLeft = 0');
  assert(await evaluate('(() => { const dock=document.querySelector(".mobile-touch-dock").getBoundingClientRect(); const add=document.querySelector(".mobile-touch-dock [data-touch-action=import-image]").getBoundingClientRect(); return add.left >= dock.left && add.right <= dock.right; })()'), "the primary Add image action is visible without horizontal scrolling");
  assert(await evaluate('document.querySelector("#selection-mini-panel").hidden === true'), "empty canvas does not show a useless layer-action panel");

  // AA-EDITOR-TOOLS-AUDIT-001: the prominent mobile Draw action must work on an empty canvas.
  await click('.mobile-touch-dock [data-touch-action="paint"]');
  await waitFor('document.querySelector(".toolbar .tool[data-tool=brush]")?.classList.contains("active") && document.querySelector("#mobile-context-heading")?.hidden === false');
  assert(await evaluate('(() => { const panel=document.querySelector(".toolbar"),canvas=document.querySelector("#canvas"); const p=panel.getBoundingClientRect(),c=canvas.getBoundingClientRect(),s=getComputedStyle(panel),x=c.left+c.width/2,y=Math.min(c.top+c.height/2,p.top-12); return s.display!=="none"&&p.height>0&&y>c.top+10&&document.elementFromPoint(x,y)===canvas; })()'),
    "mobile drawing controls are visible in a compact sheet while the canvas remains the touch target above them");
  const blankDrawCenter = await selectorCenter("#canvas");
  await mouseDrag(
    { x: blankDrawCenter.x - 42, y: blankDrawCenter.y + 8 },
    { x: blankDrawCenter.x + 42, y: blankDrawCenter.y + 8 }
  );
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.some(layer=>layer.contentType==="drawing"&&layer.strokes?.some(stroke=>stroke.points?.length>=2))', 10000);
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.some(layer=>layer.contentType==="drawing"&&layer.strokes?.some(stroke=>stroke.points?.length>=2))'),
    "mobile Draw creates an editable stroke on a transparent layer without an imported image");
  await click('.mobile-touch-dock [data-touch-action="tool"][data-tool="select"]');
  await click('.mobile-top-actions [data-mobile-top-action="undo"]');
  await waitFor('!JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.some(layer=>layer.contentType==="drawing"&&layer.strokes?.length)', 10000);

  // Give the zoom/pan coordinate test a real artboard; the startup placeholder can be 0×0.
  await evaluate('document.querySelector("#project-dialog").showModal()');
  await waitFor('document.querySelector("#project-dialog").open === true');
  await evaluate('(() => { window.confirm = () => true; document.querySelector("#document-width").value = "640"; document.querySelector("#document-height").value = "480"; document.querySelector("#document-width").dispatchEvent(new Event("input",{bubbles:true})); document.querySelector("#document-height").dispatchEvent(new Event("input",{bubbles:true})); })()');
  await click('#project-form button[type="submit"]');
  await waitFor('document.querySelector("#project-dialog").open === false');
  // Creating a document updates editor state; an explicit Save persists this new size.
  await evaluate('document.querySelector("#save").click()');
  await waitFor('document.querySelector("#status").textContent === "Guardado localmente"');
  await waitFor('(() => { const d=JSON.parse(localStorage.getItem("animeart-web-document")||"{}"); return d.width===640 && d.height===480; })()');
  assert(await evaluate('(() => { const d=JSON.parse(localStorage.getItem("animeart-web-document")||"{}"); return d.width===640 && d.height===480; })()'),
    "zoom/pan regression saves a real 640×480 document instead of relying on a zero-sized startup placeholder");

  // AA-EXTERNAL-BUGFIX-RESEARCH-001: drawing coordinates must remain correct after viewport zoom + touch pan.
  await click('.mobile-touch-dock [data-touch-action="paint"]');
  await waitFor('document.querySelector(".toolbar .tool[data-tool=brush]")?.classList.contains("active")');
  await click("#mobile-context-close");
  await waitFor('document.querySelector("#mobile-context-heading").hidden === true');
  await evaluate('window.__ANIMEART_E2E_DIAGNOSTICS__ = true');
  const diagnosticsWarmupPoint = await evaluate('(() => { const r=document.querySelector("#canvas").getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()');
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: diagnosticsWarmupPoint.x, y: diagnosticsWarmupPoint.y });
  await waitFor('Boolean(window.__ANIMEART_DOCUMENT_FRAME_DIAGNOSTICS__?.topLeft)');
  const drawViewportBaseline = await readFrameMetrics();
  await wheelCanvasZoom("in", 2);
  const drawViewportZoomed = await readFrameMetrics();
  assert(drawViewportZoomed.right - drawViewportZoomed.left > (drawViewportBaseline.right - drawViewportBaseline.left) * 1.1,
    "canvas zoom visibly expands the page before the drawing-coordinate regression");
  await panCanvasByTouch(20, 14);
  const drawViewportPanned = await readFrameMetrics();
  assert(Math.hypot(drawViewportPanned.left - drawViewportZoomed.left, drawViewportPanned.top - drawViewportZoomed.top) > 10,
    "two-finger touch pans the zoomed editor viewport while Draw remains selected");

  const drawBeforeZoomPan = await readDocument();
  const drawingLayerBeforeZoomPan = drawBeforeZoomPan.layers.find(layer => layer.contentType === "drawing");
  if (!drawingLayerBeforeZoomPan) throw new Error("Drawing layer is missing from the zoom/pan regression fixture");
  const oldStrokeCount = drawingLayerBeforeZoomPan.strokes.length;
  const docStart = { x: drawBeforeZoomPan.width / 2 - 26, y: drawBeforeZoomPan.height / 2 + 8 };
  const docEnd = { x: drawBeforeZoomPan.width / 2 + 26, y: drawBeforeZoomPan.height / 2 + 8 };
  const drawStart = documentPointToClientPoint(drawViewportPanned, docStart.x, docStart.y);
  const drawEnd = documentPointToClientPoint(drawViewportPanned, docEnd.x, docEnd.y);
  const expectedDrawStart = clientPointToDocumentPoint(drawViewportPanned, drawStart);
  const expectedDrawEnd = clientPointToDocumentPoint(drawViewportPanned, drawEnd);
  await mouseDrag(drawStart, drawEnd);
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.contentType==="drawing")?.strokes?.length > ' + oldStrokeCount, 10000);
  const drawnAfterZoomPan = await readDocument();
  const actualDrawStroke = drawnAfterZoomPan.layers.find(layer => layer.id === drawingLayerBeforeZoomPan.id)?.strokes.at(-1);
  assert(actualDrawStroke?.points?.length >= 2, "drawing still creates a real editable stroke after zoom and touch pan");
  const firstDrawPoint = actualDrawStroke.points[0], lastDrawPoint = actualDrawStroke.points.at(-1);
  assert(Math.hypot(firstDrawPoint.x - expectedDrawStart.x, firstDrawPoint.y - expectedDrawStart.y) < 4 &&
    Math.hypot(lastDrawPoint.x - expectedDrawEnd.x, lastDrawPoint.y - expectedDrawEnd.y) < 4,
    "stored drawing points map back to document coordinates after zoom/pan instead of drifting: " + JSON.stringify({expectedDrawStart,expectedDrawEnd,firstDrawPoint,lastDrawPoint}));
  const drawViewportCanvasPixel = await evaluate('(() => { const canvas=document.querySelector("#canvas"),r=canvas.getBoundingClientRect(),p=' + JSON.stringify({x:(drawStart.x+drawEnd.x)/2,y:(drawStart.y+drawEnd.y)/2}) + ',x=Math.max(0,Math.min(canvas.width-1,Math.round((p.x-r.left)*canvas.width/r.width))),y=Math.max(0,Math.min(canvas.height-1,Math.round((p.y-r.top)*canvas.height/r.height))); return Array.from(canvas.getContext("2d",{willReadFrequently:true}).getImageData(x,y,1,1).data); })()');
  assert(drawViewportCanvasPixel[3] > 0, "the zoomed and panned drawing stroke produces actual rendered pixels");
  await click('.mobile-touch-dock [data-touch-action="tool"][data-tool="select"]');
  await click('.mobile-top-actions [data-mobile-top-action="undo"]');
  await waitFor('!JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.some(layer=>layer.contentType==="drawing"&&layer.strokes?.length)', 10000);

  // AA-BRUSH-SYMMETRY-001: the canvas stores two editable paths mirrored around the document centre.
  await click('.mobile-touch-dock [data-touch-action="paint"]');
  await waitFor('document.querySelector("#brush-symmetry-mobile")?.getClientRects().length > 0 && getComputedStyle(document.querySelector("#brush-symmetry-mobile")).display !== "none"');
  await click(".brush-symmetry-mobile-control");
  await waitFor('document.querySelector("#brush-symmetry-mobile").checked === true && document.querySelector("#brush-symmetry").checked === true');
  await click("#mobile-context-close");
  await waitFor('document.querySelector("#mobile-context-heading").hidden === true');
  const symmetryBefore = await readDocument();
  const symmetryLayerBefore = symmetryBefore.layers.find(layer => layer.contentType === "drawing");
  if (!symmetryLayerBefore) throw new Error("Symmetry E2E requires a drawing layer");
  const symmetryStartDoc = { x: symmetryBefore.width / 2 - 90, y: symmetryBefore.height / 2 + 40 };
  const symmetryEndDoc = { x: symmetryBefore.width / 2 - 45, y: symmetryBefore.height / 2 + 75 };
  // Refresh the editor's render diagnostics after mobile layout changes. Hiding a fixed sheet
  // does not guarantee a resize callback, so the last frame can otherwise describe the old layout.
  await evaluate('window.dispatchEvent(new Event("resize"))');
  await sleep(80);
  const symmetryFrame = await readFrameMetrics();
  const symmetryStartClient = documentPointToClientPoint(symmetryFrame, symmetryStartDoc.x, symmetryStartDoc.y);
  const symmetryEndClient = documentPointToClientPoint(symmetryFrame, symmetryEndDoc.x, symmetryEndDoc.y);
  await mouseDrag(symmetryStartClient, symmetryEndClient);
  await waitFor('(() => { const d=JSON.parse(localStorage.getItem("animeart-web-document")||"{}"); const l=d.layers.find(layer=>layer.id===' + JSON.stringify(symmetryLayerBefore.id) + '); return l?.strokes?.length >= ' + (symmetryLayerBefore.strokes.length + 2) + '; })()', 10000);
  const symmetryAfter = await readDocument();
  const symmetryLayerAfter = symmetryAfter.layers.find(layer => layer.id === symmetryLayerBefore.id);
  const mirroredPair = symmetryLayerAfter.strokes.slice(-2);
  assert(mirroredPair.length === 2 && mirroredPair[0].points.length >= 2 &&
    mirroredPair[0].points.length === mirroredPair[1].points.length &&
    mirroredPair[0].points.every((point,index) =>
      Math.abs(point.x + mirroredPair[1].points[index].x - symmetryAfter.width) < 0.001 &&
      Math.abs(point.y - mirroredPair[1].points[index].y) < 0.001),
    "symmetry drawing stores paired editable strokes whose coordinates mirror across the document centre");
  const leftDoc = {x:symmetryBefore.width/2-67.5,y:symmetryBefore.height/2+57.5};
  const rightDoc = {x:symmetryBefore.width-leftDoc.x,y:leftDoc.y};
  const strokeCenter = stroke => stroke.points.reduce((center,point) => ({
    x:center.x+Number(point.x)/stroke.points.length,
    y:center.y+Number(point.y)/stroke.points.length
  }),{x:0,y:0});
  const centers = mirroredPair.map(strokeCenter);
  const leftCenter = centers.find(point => point.x < symmetryAfter.width/2);
  const rightCenter = centers.find(point => point.x > symmetryAfter.width/2);
  assert(Boolean(leftCenter&&rightCenter) &&
    Math.hypot(leftCenter.x-leftDoc.x,leftCenter.y-leftDoc.y)<12 &&
    Math.hypot(rightCenter.x-rightDoc.x,rightCenter.y-rightDoc.y)<12,
    "pointer coordinates place both editable stroke paths in their intended document regions: " + JSON.stringify({leftCenter,rightCenter,leftDoc,rightDoc,centers,symmetryFrame}));
  const layerTransform = symmetryLayerAfter.transform || {};
  const layerCenter = {x:symmetryAfter.width/2,y:symmetryAfter.height/2};
  const layerScale = Number(layerTransform.scale)>0 ? Number(layerTransform.scale) : 1;
  const layerRotation = (Number(layerTransform.rotation)||0)*Math.PI/180;
  const renderPointForLayer = point => {
    const dx=(point.x-layerCenter.x)*layerScale,dy=(point.y-layerCenter.y)*layerScale;
    return {
      x:layerCenter.x+dx*Math.cos(layerRotation)-dy*Math.sin(layerRotation)+(Number(layerTransform.x)||0),
      y:layerCenter.y+dx*Math.sin(layerRotation)+dy*Math.cos(layerRotation)+(Number(layerTransform.y)||0)
    };
  };
  const renderedCenters = [leftCenter,rightCenter].map(point => renderPointForLayer(point));
  // Creating the selection handles can resize the mobile workspace after the initial frame read.
  // Force a real canvas resize/redraw and then sample against the exact frame that painted the pixels.
  await evaluate('window.dispatchEvent(new Event("resize"))');
  await sleep(100);
  const renderedSymmetryFrame = await readFrameMetrics();
  assert(Boolean(renderedSymmetryFrame) &&
    renderedSymmetryFrame.canvasWidth > 0 && renderedSymmetryFrame.canvasHeight > 0,
    "canvas frame diagnostics are refreshed after the mirrored strokes are rendered");
  const pixelTargets = renderedCenters.map(point => documentPointToClientPoint(renderedSymmetryFrame,point.x,point.y));
  const symmetryPixelEvidence = await evaluate('(() => { const c=document.querySelector("#canvas"),r=c.getBoundingClientRect(),p=' + JSON.stringify(pixelTargets) + ',ctx=c.getContext("2d",{willReadFrequently:true}),radius=Math.max(2,Math.ceil(8*c.height/r.height)); return p.map(v=>{const x=Math.max(0,Math.min(c.width-1,Math.round((v.x-r.left)*c.width/r.width))),y=Math.max(0,Math.min(c.height-1,Math.round((v.y-r.top)*c.height/r.height))),left=Math.max(0,x-radius),top=Math.max(0,y-radius),right=Math.min(c.width,x+radius+1),bottom=Math.min(c.height,y+radius+1),data=ctx.getImageData(left,top,right-left,bottom-top).data;let maxAlpha=0;for(let i=3;i<data.length;i+=4)maxAlpha=Math.max(maxAlpha,data[i]);return {maxAlpha,radius};}); })()');
  assert(symmetryPixelEvidence.every(evidence => evidence.maxAlpha > 0),
    "the real canvas renders visible pixels along both stored mirrored stroke paths after the selected layer transform: " + JSON.stringify({symmetryPixelEvidence,pixelTargets,renderedCenters,layerTransform,leftCenter,rightCenter,leftDoc,rightDoc,symmetryFrame,renderedSymmetryFrame}));
  await click('.mobile-touch-dock [data-touch-action="tool"][data-tool="select"]');
  await click('.mobile-top-actions [data-mobile-top-action="undo"]');
  await waitFor('!JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.some(layer=>layer.id===' + JSON.stringify(symmetryLayerBefore.id) + '&&layer.strokes?.length)', 10000);
  await click('.mobile-touch-dock [data-touch-action="paint"]');
  await waitFor('document.querySelector("#brush-symmetry-mobile")?.getClientRects().length > 0');
  await click(".brush-symmetry-mobile-control");
  await waitFor('document.querySelector("#brush-symmetry-mobile").checked === false && document.querySelector("#brush-symmetry").checked === false');
  await click("#mobile-context-close");
  await waitFor('document.querySelector("#mobile-context-heading").hidden === true');

  // Return to the original viewport so later mobile assertions start from a stable baseline.
  await panCanvasByTouch(-20, -14);
  await wheelCanvasZoom("out", 2);
  const drawViewportRestored = await readFrameMetrics();
  assert(Math.abs(drawViewportRestored.left - drawViewportBaseline.left) < 4 &&
    Math.abs(drawViewportRestored.top - drawViewportBaseline.top) < 4 &&
    Math.abs((drawViewportRestored.right - drawViewportRestored.left) - (drawViewportBaseline.right - drawViewportBaseline.left)) < 4,
    "undoing the touch pan and zoom restores the original viewport before the remaining editor tests");

  await saveScreenshot("animeart-studio-mobile-home.png");
  assert(await evaluate('document.querySelector(".mobile-touch-dock [data-touch-action=import-image]")?.textContent.includes("Añadir")'), "mobile has a visible Add image action");
  assert(await evaluate('document.querySelector("#quick-open-asset-library")?.textContent.includes("Mis imágenes")'), "reusable Gallery is available inside More instead of occupying a permanent dock slot");
  assert(await evaluate('Boolean(document.querySelector("[data-edit-goal=delete-selected]"))'), "Delete selected object remains available from More");
  assert(await evaluate('document.querySelector("[data-edit-goal=undo]")?.textContent.includes("Deshacer") && document.querySelector("[data-edit-goal=redo]")?.textContent.includes("Rehacer")'), "Undo and Redo remain discoverable in More");
  assert(await evaluate('document.querySelector("#selection-mini-panel").hidden === true'), "no selected-object panel is shown for an empty canvas");
  const projectBeforePickerAttempt = await evaluate('localStorage.getItem("animeart-web-document")');
  const layerCountBeforePickerAttempt = (await readLayerSummary()).length;
  await evaluate('(() => { const input = document.querySelector("#image-file-input"); window.__animeArtPickerOpenCount = 0; window.__animeArtOriginalPickerClick = input.click.bind(input); input.click = () => { window.__animeArtPickerOpenCount += 1; }; })()');
  await click('.mobile-touch-dock [data-touch-action="import-image"]');
  assert(await evaluate('window.__animeArtPickerOpenCount === 1'), "Add image requests the native device image picker");
  await evaluate('document.querySelector("#image-file-input").dispatchEvent(new Event("cancel", { bubbles: true }))');
  assert(await evaluate('localStorage.getItem("animeart-web-document") === ' + JSON.stringify(projectBeforePickerAttempt)),
    "simulated picker cancellation leaves the saved project byte-for-byte unchanged");
  assert((await readLayerSummary()).length === layerCountBeforePickerAttempt,
    "simulated picker cancellation does not add or remove a layer");
  await evaluate('(() => { const input = document.querySelector("#image-file-input"); input.click = window.__animeArtOriginalPickerClick; })()');
  await click('.mobile-touch-dock [data-touch-action="more"]');
  await waitFor('document.body.classList.contains("mobile-tools-open")');
  const libraryFixture = await evaluate(`(async () => {
    const dbName = "animeart-local-asset-library";
    const storeName = "assets";
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName, { keyPath: "id" });
      }
    };
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not prepare asset library fixture"));
    });
    const readRequest = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
    const original = await new Promise((resolve, reject) => {
      readRequest.onsuccess = () => resolve(readRequest.result || []);
      readRequest.onerror = () => reject(readRequest.error || new Error("Could not back up asset library fixture"));
    });
    window.__ANIMEART_E2E_ASSET_LIBRARY_BACKUP = original;
    const canvas = document.createElement("canvas");
    canvas.width = 640; canvas.height = 640;
    const context = canvas.getContext("2d");
    const gradient = context.createLinearGradient(0, 0, 640, 640);
    gradient.addColorStop(0, "#c084fc"); gradient.addColorStop(1, "#0ea5e9");
    context.fillStyle = gradient; context.fillRect(0, 0, 640, 640);
    for (let y=0; y<640; y+=16) { context.fillStyle = y % 32 ? "rgba(255,255,255,.2)" : "rgba(0,0,0,.12)"; context.fillRect(0,y,640,8); }
    const imageBlob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    if (!imageBlob) throw new Error("Could not generate an asset library thumbnail fixture");
    const timestamp = "2026-10-21T00:00:00.000Z";
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.clear();
    for (let i = 0; i < 40; i++) {
      store.put({
        id: "e2e_asset_" + String(i).padStart(4, "0"),
        name: "Fixture " + String(i).padStart(2, "0"),
        category: "sticker", tags: [], visualTraits: [],
        originType: "unknown", verificationStatus: "unknown",
        creator: "", sourceUrl: "", license: "", attribution: "", provenanceNotes: "",
        contentHash: "", favorite: false, mimeType: imageBlob.type, size: imageBlob.size,
        createdAt: timestamp, updatedAt: timestamp, imageBlob
      });
    }
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("Could not seed asset library fixture"));
      tx.onabort = () => reject(tx.error || new Error("Asset library fixture transaction aborted"));
    });
    db.close();
    return { count: 40, backupCount: original.length };
  })()`);
  assert(libraryFixture?.count === 40, "real IndexedDB fixture seeds 40 visual library resources");
  await click("#quick-open-asset-library");
  await waitFor('document.querySelector("#asset-library-dialog")?.open === true');
  await waitFor('document.querySelectorAll("#asset-library-grid .asset-card").length === 36');
  const binaryStoreState = await evaluate(`(async () => {
    const request = indexedDB.open("animeart-local-asset-library");
    const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const tx = db.transaction(["assets", "asset-blobs"], "readonly");
    const metadataRequest = tx.objectStore("assets").getAll();
    const blobsRequest = tx.objectStore("asset-blobs").getAll();
    const [metadata, blobs] = await Promise.all([
      new Promise((resolve, reject) => { metadataRequest.onsuccess = () => resolve(metadataRequest.result || []); metadataRequest.onerror = () => reject(metadataRequest.error); }),
      new Promise((resolve, reject) => { blobsRequest.onsuccess = () => resolve(blobsRequest.result || []); blobsRequest.onerror = () => reject(blobsRequest.error); })
    ]);
    const result = { version: db.version, metadataCount: metadata.length, blobCount: blobs.length, inlineBlobs: metadata.filter(asset => asset.imageBlob instanceof Blob).length };
    db.close();
    return result;
  })()`);
  assert(binaryStoreState?.version === 2 && binaryStoreState.metadataCount === 40 && binaryStoreState.blobCount === 40 && binaryStoreState.inlineBlobs === 0, "schema migration moves image binaries into a separate IndexedDB store without losing any of the 40 images");
  await waitFor('Array.from(document.querySelectorAll("#asset-library-grid img")).some(image => image.src.startsWith("blob:") && image.naturalWidth > 0)');
  assert(true, "asset library loads an actual image preview on demand from the binary store");
  await waitFor('(async () => { const req=indexedDB.open("animeart-local-asset-library"); const db=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);}); const tx=db.transaction("asset-blobs","readonly"); const read=tx.objectStore("asset-blobs").getAll(); const records=await new Promise((resolve,reject)=>{read.onsuccess=()=>resolve(read.result||[]);read.onerror=()=>reject(read.error);}); const found=records.some(record=>record.thumbnailBlob instanceof Blob); db.close(); return found; })()');
  const thumbnailDimensions = await evaluate('(async () => { const req=indexedDB.open("animeart-local-asset-library"); const db=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);}); const tx=db.transaction("asset-blobs","readonly"); const read=tx.objectStore("asset-blobs").getAll(); const records=await new Promise((resolve,reject)=>{read.onsuccess=()=>resolve(read.result||[]);read.onerror=()=>reject(read.error);}); const record=records.find(item=>item.thumbnailBlob instanceof Blob); if(!record){db.close();return null;} const bitmap=await createImageBitmap(record.thumbnailBlob); const result={width:bitmap.width,height:bitmap.height,originalSize:record.imageBlob.size,previewSize:record.thumbnailBlob.size}; bitmap.close(); db.close(); return result; })()');
  assert(thumbnailDimensions && Math.max(thumbnailDimensions.width, thumbnailDimensions.height) <= 512 && Math.max(thumbnailDimensions.width, thumbnailDimensions.height) < 640, "large source images get a persistent, downscaled thumbnail of at most 512 pixels while the original blob remains available");
  assert(await evaluate('document.querySelector(".asset-library-load-more")?.hidden === false && document.querySelector(".asset-library-load-more")?.textContent.includes("4 restantes")'),
    "visual library initially renders 36 cards and exposes four remaining resources");
  await click(".asset-library-load-more");
  await waitFor('document.querySelectorAll("#asset-library-grid .asset-card").length === 40');
  assert(await evaluate('document.querySelector(".asset-library-load-more")?.hidden === true'),
    "Load more reveals all 40 cards and hides its action at the end");
  await evaluate('(() => { const input=document.querySelector("#asset-library-search"); input.value="Fixture 39"; input.dispatchEvent(new Event("input",{bubbles:true})); return input.value; })()');
  await waitFor('document.querySelectorAll("#asset-library-grid .asset-card").length === 1');
  assert(await evaluate('document.querySelector(".asset-library-load-more")?.hidden === true'),
    "search filters the visible library and hides Load more when one result remains");
  await evaluate('(() => { const input=document.querySelector("#asset-library-search"); input.value=""; input.dispatchEvent(new Event("input",{bubbles:true})); return input.value; })()');
  await waitFor('document.querySelectorAll("#asset-library-grid .asset-card").length === 36');
  assert(await evaluate('document.querySelector(".asset-library-load-more")?.hidden === false'),
    "clearing search resets to the first page instead of preserving a large render count");
  const restoredLibraryCount = await evaluate(`(async () => {
    const dbName = "animeart-local-asset-library";
    const storeName = "assets";
    const request = indexedDB.open(dbName);
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not restore asset library fixture"));
    });
    const tx = db.transaction([storeName, "asset-blobs"], "readwrite");
    const store = tx.objectStore(storeName);
    const blobs = tx.objectStore("asset-blobs");
    store.clear();
    blobs.clear();
    const original = window.__ANIMEART_E2E_ASSET_LIBRARY_BACKUP || [];
    for (const asset of original) {
      const metadata = { ...asset };
      const imageBlob = metadata.imageBlob;
      delete metadata.imageBlob;
      store.put(metadata);
      if (imageBlob instanceof Blob) blobs.put({ id: metadata.id, imageBlob });
    }
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("Could not restore asset library state"));
      tx.onabort = () => reject(tx.error || new Error("Asset library restore transaction aborted"));
    });
    db.close();
    delete window.__ANIMEART_E2E_ASSET_LIBRARY_BACKUP;
    return original.length;
  })()`);
  assert(restoredLibraryCount === libraryFixture.backupCount, "E2E restores the library's original local records after pagination testing");
  await click("#close-asset-library");
  await waitFor('document.querySelector("#asset-library-dialog")?.open === false');
  await click('.mobile-touch-dock [data-touch-action="more"]');
  await waitFor('!document.body.classList.contains("mobile-tools-open")');
  await evaluate('document.querySelector(".mobile-touch-dock").scrollLeft = 0');
  await saveScreenshot("animeart-studio-mobile-initial.png");
  // Enable handle-position evidence before importing, so the actual redraw records the visible geometry.
  await evaluate('window.__ANIMEART_E2E_DIAGNOSTICS__ = true');

  // Import a real PNG Blob through the mobile file input and capture the resulting editor state.
  const mobileLayerCountBefore = (await readLayerSummary()).length;
  const mobilePng = await evaluate(`(async () => {
    const source = document.createElement("canvas");
    source.width = 640;
    source.height = 480;
    const context = source.getContext("2d", { willReadFrequently: true });
    context.fillStyle = "#12e0f6";
    context.fillRect(40, 40, source.width - 80, source.height - 80);
    const blob = await new Promise(resolve => source.toBlob(resolve, "image/png"));
    if (!blob || blob.type !== "image/png" || blob.size === 0) {
      return { type: blob?.type || null, size: blob?.size || 0, changeObserved: false, files: [] };
    }
    const file = new File([blob], "e2e-mobile-import.png", { type: "image/png" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const input = document.querySelector("#image-file-input");
    window.__animeArtMobilePngChange = { observed: false, files: [] };
    document.addEventListener("change", event => {
      if (event.target !== input) return;
      window.__animeArtMobilePngChange.observed = true;
      window.__animeArtMobilePngChange.files = Array.from(input.files || []).map(selectedFile => ({
        name: selectedFile.name, type: selectedFile.type, size: selectedFile.size
      }));
    }, { capture: true, once: true });
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return {
      type: blob.type, size: blob.size, width: source.width, height: source.height,
      transparentAlpha: context.getImageData(0, 0, 1, 1).data[3],
      subjectAlpha: context.getImageData(60, 60, 1, 1).data[3],
      changeObserved: window.__animeArtMobilePngChange.observed,
      files: window.__animeArtMobilePngChange.files,
      immediateStatus: document.querySelector("#status")?.textContent || ""
    };
  })()`);
  assert(mobilePng.type === "image/png" && mobilePng.size > 0 && mobilePng.width === 640 && mobilePng.height === 480,
    "mobile E2E creates a representative 640×480 PNG fixture");
  assert(mobilePng.transparentAlpha === 0 && mobilePng.subjectAlpha === 255,
    "mobile PNG fixture contains both transparent background and opaque image pixels");
  assert(mobilePng.changeObserved && mobilePng.files?.[0]?.name === "e2e-mobile-import.png" &&
    mobilePng.files?.[0]?.type === "image/png" && mobilePng.files?.[0]?.size === mobilePng.size,
    "mobile file-input change captures PNG filename, MIME type and byte size");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers?.some(layer => layer.name === "e2e-mobile-import" && layer.contentType === "image")', 10000);
  const mobilePngLayer = (await readLayerSummary()).find(layer => layer.name === "e2e-mobile-import");
  assert(mobilePngLayer?.visible === true && mobilePngLayer?.image?.width === 640 &&
    mobilePngLayer?.image?.height === 480 && mobilePngLayer?.image?.mime === "image/png",
    "mobile PNG import persists a visible 640×480 image layer with decoded dimensions");
  const persistedMobilePngPixels = await evaluate('(() => { const layer=JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(item=>item.name==="e2e-mobile-import"); if(!layer?.image?.source)return {decodeError:true}; return new Promise(resolve=>{const image=new Image();image.onload=()=>{const sample=document.createElement("canvas");sample.width=image.naturalWidth;sample.height=image.naturalHeight;const context=sample.getContext("2d",{willReadFrequently:true});context.drawImage(image,0,0);resolve({width:sample.width,height:sample.height,transparentAlpha:context.getImageData(0,0,1,1).data[3],subjectAlpha:context.getImageData(60,60,1,1).data[3]});};image.onerror=()=>resolve({decodeError:true});image.src=layer.image.source;});})()');
  assert(persistedMobilePngPixels.width === 640 && persistedMobilePngPixels.height === 480 &&
    persistedMobilePngPixels.transparentAlpha === 0 && persistedMobilePngPixels.subjectAlpha === 255,
    "mobile PNG persists with genuine transparency and the expected opaque subject pixels");
  assert(await evaluate('document.querySelector("#selection-mini-layer-name").textContent.includes("e2e-mobile-import")'),
    "mobile PNG import selects the new image layer");
  await waitFor('document.querySelector("#mobile-feedback")?.textContent.includes("Imagen añadida al lienzo")', 10000);
  await waitFor('(() => { const c = document.querySelector("#canvas"); const p = c.getContext("2d").getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data; return p[2] > 160 && p[1] > 120 && p[0] < 100 && p[3] > 0; })()', 10000);
  assert(await evaluate('document.querySelector("#mobile-feedback").textContent.includes("Imagen añadida al lienzo")'),
    "mobile image import produces localized success feedback");
  await waitFor('document.querySelector("#selection-mini-panel").hidden === false', 10000);
  assert(await evaluate('(() => { const canvas=document.querySelector("#canvas").getBoundingClientRect(); const panel=document.querySelector("#selection-mini-panel").getBoundingClientRect(); return panel.height >= 44 && panel.top >= canvas.bottom - 2 && panel.bottom <= window.innerHeight; })()'),
    "selected-object actions sit in a separate touch row below the canvas instead of floating over artwork");
  assert(await evaluate('getComputedStyle(document.querySelector("#remove-selected-image")).display === "none"'),
    "mobile uses the canvas X selection handle instead of a second floating delete control");
  await waitFor('document.querySelector("#mobile-feedback").hidden === true', 5000);

  // AA-IMAGE-TOUCH-ANCHOR-001: a stationary finger must not move the image if selection/layout changes the canvas rect.
  const transformBeforeStationaryTouch = await evaluate('JSON.stringify(JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import")?.transform)');
  const stationaryTouchPoint = await evaluate('(() => { const c=document.querySelector("#canvas"),r=c.getBoundingClientRect(),d=window.__ANIMEART_SELECTION_HANDLE_DIAGNOSTICS__; if(!d?.center) throw new Error("Selected image center diagnostics unavailable"); return {x:r.left+d.center.x,y:r.top+d.center.y}; })()');
  await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 73, x: stationaryTouchPoint.x, y: stationaryTouchPoint.y, radiusX: 4, radiusY: 4, force: 1 }] });
  await evaluate('document.querySelector("#canvas").style.transform = "translateY(44px)"');
  await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await evaluate('(() => { const c=document.querySelector("#canvas"); c.style.transform=""; window.dispatchEvent(new Event("resize")); })()');
  await waitFor('JSON.stringify(JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import")?.transform) === ' + JSON.stringify(transformBeforeStationaryTouch), 10000);
  assert(await evaluate('JSON.stringify(JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import")?.transform) === ' + JSON.stringify(transformBeforeStationaryTouch)),
    "canvas layout shifts during a stationary touch without changing the image transform");

  // AA-EXTERNAL-BUGFIX-RESEARCH-002: the pixel eraser must target the same document point after zoom + pan.
  // A previous mobile selection row can change canvas height without updating the test's frame snapshot.
  await evaluate('window.dispatchEvent(new Event("resize"))');
  await sleep(100);
  const eraseViewportBaseline = await readFrameMetrics();
  await wheelCanvasZoom("in", 2);
  const eraseViewportZoomed = await readFrameMetrics();
  assert(eraseViewportZoomed.right - eraseViewportZoomed.left > (eraseViewportBaseline.right - eraseViewportBaseline.left) * 1.1,
    "pixel-eraser regression zooms the real editor viewport");
  await panCanvasByTouch(18, 12);
  const eraseViewportPanned = await readFrameMetrics();
  assert(Math.hypot(eraseViewportPanned.left - eraseViewportZoomed.left, eraseViewportPanned.top - eraseViewportZoomed.top) > 8,
    "pixel-eraser regression pans the zoomed viewport using two-finger touch");

  // The main-canvas pixel eraser exposes a live route before changing image pixels.
  const sourceBeforeBrushErase = await evaluate('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import")?.image?.source');
  await evaluate('(() => { const input=document.querySelector("#brush-size"); input.value="48"; input.dispatchEvent(new Event("input",{bubbles:true})); })()');
  // Earlier mobile tests leave a transparent drawing layer selected. Open the real More > Capas
  // workflow, select the imported raster, then reopen the eraser tool.
  const eraseImageLayerId = await evaluate('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import"&&layer.contentType==="image")?.id');
  assert(Boolean(eraseImageLayerId), "pixel-eraser fixture retains its imported image layer");
  await clickMoreGoal("layers");
  await waitFor('document.body.classList.contains("mobile-layers-open")');
  await click(layerButtonSelector(eraseImageLayerId));
  await waitFor('document.querySelector("#layers li[data-selected=true]")?.dataset.layerId === ' + JSON.stringify(eraseImageLayerId));
  // Returning to the eraser sheet closes the layer drawer through the same mobile action router.
  await clickMoreGoal("eraser");
  await waitFor('!document.body.classList.contains("mobile-layers-open")');
  await waitFor('document.querySelector(".toolbar .tool[data-tool=eraser]")?.classList.contains("active") && document.querySelector("#mobile-context-heading")?.hidden === false');
  // Refresh selection geometry after returning from the drawer to the canvas tool sheet.
  await evaluate('window.dispatchEvent(new Event("resize"))');
  await sleep(100);
  await waitFor('Boolean(window.__ANIMEART_SELECTION_HANDLE_DIAGNOSTICS__?.center)');
  const erasePreviewSetup = await evaluate('(() => { const canvas=document.querySelector("#canvas"),r=canvas.getBoundingClientRect(),d=window.__ANIMEART_SELECTION_HANDLE_DIAGNOSTICS__; if(!d?.center)throw new Error("selected image screen coordinates are unavailable"); const center={x:r.left+d.center.x,y:r.top+d.center.y}; const sample={x:center.x-7,y:center.y+3}; const px=Math.max(0,Math.min(canvas.width-1,Math.round((sample.x-r.left)*canvas.width/r.width))),py=Math.max(0,Math.min(canvas.height-1,Math.round((sample.y-r.top)*canvas.height/r.height))); return {center,start:{x:center.x-56,y:center.y},end:{x:center.x+42,y:center.y},sample,before:Array.from(canvas.getContext("2d",{willReadFrequently:true}).getImageData(px,py,1,1).data)}; })()');
  await cdp("Input.dispatchMouseEvent",{type:"mouseMoved",x:erasePreviewSetup.start.x,y:erasePreviewSetup.start.y});
  await cdp("Input.dispatchMouseEvent",{type:"mousePressed",x:erasePreviewSetup.start.x,y:erasePreviewSetup.start.y,button:"left",buttons:1,clickCount:1});
  await cdp("Input.dispatchMouseEvent",{type:"mouseMoved",x:erasePreviewSetup.end.x,y:erasePreviewSetup.end.y,button:"left",buttons:1});
  await sleep(140);
  const brushPreviewPixels = await evaluate('(() => { const canvas=document.querySelector("#canvas"),r=canvas.getBoundingClientRect(),p=' + JSON.stringify(erasePreviewSetup.sample) + ',px=Math.max(0,Math.min(canvas.width-1,Math.round((p.x-r.left)*canvas.width/r.width))),py=Math.max(0,Math.min(canvas.height-1,Math.round((p.y-r.top)*canvas.height/r.height))); return {pixel:Array.from(canvas.getContext("2d",{willReadFrequently:true}).getImageData(px,py,1,1).data),diagnostics:window.__ANIMEART_PIXEL_EDIT_PREVIEW_DIAGNOSTICS__}; })()');
  assert(brushPreviewPixels.diagnostics?.mode === "erase" && brushPreviewPixels.diagnostics.pointCount >= 2,
    "main-canvas erasing exposes a live path preview while the pointer is down: " + JSON.stringify({
      brushPreviewPixels, erasePreviewSetup,
      activeTool: await evaluate('document.querySelector(".toolbar .tool.active")?.dataset.tool || null'),
      selectedLayer: await evaluate('(() => { const d=JSON.parse(localStorage.getItem("animeart-web-document")||"{}"); const id=document.querySelector("#layers li[data-selected=true]")?.dataset.layerId; const l=d.layers?.find(x=>x.id===id); return l?{id:l.id,name:l.name,type:l.contentType,locked:l.locked,visible:l.visible,transform:l.transform}:null; })()'),
      selection: await evaluate('window.__ANIMEART_SELECTION_HANDLE_DIAGNOSTICS__ || null'),
      pixelPreview: await evaluate('window.__ANIMEART_PIXEL_EDIT_PREVIEW_DIAGNOSTICS__ || null'),
      pointerEvents: await evaluate('({activeElement:document.activeElement?.id||document.activeElement?.tagName,canvasRect:(()=>{const r=document.querySelector("#canvas").getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height}})(),pointerCapture:Array.from(document.querySelector("#canvas").getAttributeNames()).filter(n=>n.includes("pointer"))})')
    }));
  assert(brushPreviewPixels.pixel[0] > erasePreviewSetup.before[0] + 70 && brushPreviewPixels.pixel[1] < erasePreviewSetup.before[1] - 30,
    "the eraser preview paints a visible high-contrast overlay before changing source pixels: " + JSON.stringify({before:erasePreviewSetup.before,after:brushPreviewPixels.pixel}));
  await cdp("Input.dispatchMouseEvent",{type:"mouseReleased",x:erasePreviewSetup.end.x,y:erasePreviewSetup.end.y,button:"left",buttons:0,clickCount:1});
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import")?.image?.source !== ' + JSON.stringify(sourceBeforeBrushErase), 15000);
  const eraseAlphaEvidence = await evaluate('((async () => { const layer=JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(item=>item.name==="e2e-mobile-import"); if(!layer?.image?.source)return {decodeError:true}; const image=new Image(); image.src=layer.image.source; await image.decode(); const sample=document.createElement("canvas"); sample.width=image.naturalWidth; sample.height=image.naturalHeight; const context=sample.getContext("2d",{willReadFrequently:true}); context.drawImage(image,0,0); const pixels=context.getImageData(0,0,sample.width,sample.height).data; const alpha=(x,y)=>pixels[(y*sample.width+x)*4+3]; return {width:sample.width,height:sample.height,centerAlpha:alpha(Math.floor(sample.width/2),Math.floor(sample.height/2)),untouchedAlpha:alpha(100,100)}; })())');
  assert(eraseAlphaEvidence.centerAlpha === 0 && eraseAlphaEvidence.untouchedAlpha === 255,
    "zoomed/panned pixel erasing makes the intended center transparent without erasing a distant unaffected pixel: " + JSON.stringify(eraseAlphaEvidence));
  await click('.mobile-top-actions [data-mobile-top-action="undo"]');
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import")?.image?.source === ' + JSON.stringify(sourceBeforeBrushErase), 10000);
  await evaluate('(() => { const input=document.querySelector("#brush-size"); input.value="5"; input.dispatchEvent(new Event("input",{bubbles:true})); })()');
  await click('.mobile-touch-dock [data-touch-action="tool"][data-tool="select"]');
  await waitFor('document.querySelector(".toolbar .tool[data-tool=select]")?.classList.contains("active")');
  await panCanvasByTouch(-18, -12);
  await wheelCanvasZoom("out", 2);
  await evaluate('window.dispatchEvent(new Event("resize"))');
  await sleep(100);
  const eraseViewportRestored = await readFrameMetrics();
  const normalizedView = frame => ({
    scaleX: (frame.right - frame.left) / frame.documentWidth,
    scaleY: (frame.bottom - frame.top) / frame.documentHeight,
    panX: (frame.left + frame.right) / 2 - frame.canvasWidth / 2,
    panY: (frame.top + frame.bottom) / 2 - frame.canvasHeight / 2
  });
  const eraseViewBefore = normalizedView(eraseViewportBaseline);
  const eraseViewAfter = normalizedView(eraseViewportRestored);
  assert(Math.abs(eraseViewAfter.scaleX - eraseViewBefore.scaleX) < 0.01 &&
    Math.abs(eraseViewAfter.scaleY - eraseViewBefore.scaleY) < 0.01 &&
    Math.abs(eraseViewAfter.panX - eraseViewBefore.panX) < 4 &&
    Math.abs(eraseViewAfter.panY - eraseViewBefore.panY) < 4,
    "pixel eraser undo restores zoom and pan independently of responsive canvas height: " + JSON.stringify({eraseViewBefore,eraseViewAfter,eraseViewportBaseline,eraseViewportRestored}));

  await evaluate('document.querySelector(".mobile-touch-dock").scrollLeft = 0');
  await saveScreenshot("animeart-studio-mobile-imported-image.png");
  console.log("MOBILE_IMPORTED_IMAGE_DIAGNOSTICS: " + JSON.stringify(await evaluate('(() => { const raw=localStorage.getItem("animeart-web-document"); const saved=JSON.parse(raw || "{}"); const layer=saved.layers?.find(entry=>entry.name==="e2e-mobile-import"); return { status:document.querySelector("#status")?.textContent||"", feedback:document.querySelector("#mobile-feedback")?.textContent||"", storedCharacters:raw?.length||0, layer:layer ? {name:layer.name,contentType:layer.contentType,width:layer.image?.width,height:layer.image?.height,mime:(/^data:([^;,]+)/.exec(layer.image?.source||"")||[])[1]||null,transform:layer.transform} : null }; })()')));

  // Move the exact image introduced through the mobile file input, then verify history.
  const importedTransformBeforeMove = JSON.stringify(mobilePngLayer.transform);
  const importedCanvasCenter = await selectorCenter("#canvas");
  await mouseStroke([
    { x: importedCanvasCenter.x, y: importedCanvasCenter.y },
    { x: importedCanvasCenter.x + 24, y: importedCanvasCenter.y + 18 }
  ]);
  await waitFor('JSON.stringify(JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers?.find(layer => layer.name === "e2e-mobile-import")?.transform) !== ' + JSON.stringify(importedTransformBeforeMove), 10000);
  const mobilePngMoved = (await readLayerSummary()).find(layer => layer.name === "e2e-mobile-import");
  assert(JSON.stringify(mobilePngMoved?.transform) !== importedTransformBeforeMove,
    "the image imported through the mobile file input can be dragged on the canvas");
  const importedTransformAfterMove = JSON.stringify(mobilePngMoved.transform);
  await evaluate('document.querySelector(".mobile-touch-dock").scrollLeft = 0');
  await evaluate('window.__ANIMEART_E2E_DIAGNOSTICS__ = true');
  await waitFor('Boolean(window.__ANIMEART_SELECTION_HANDLE_DIAGNOSTICS__?.closeHandle && window.__ANIMEART_SELECTION_HANDLE_DIAGNOSTICS__?.resizeHandle)');
  const visibleHandles = await evaluate('(() => { const d=window.__ANIMEART_SELECTION_HANDLE_DIAGNOSTICS__; const size=d.canvasSize; const r=document.querySelector("#canvas").getBoundingClientRect(); return { kind:d.kind, width:size.width,height:size.height,close:d.closeHandle,resize:d.resizeHandle,canvas:{left:r.left,top:r.top,width:r.width,height:r.height} }; })()');
  const handlesInsideCanvas = [visibleHandles.close, visibleHandles.resize].every(point =>
    point.x >= 20 && point.x <= visibleHandles.width - 20 &&
    point.y >= 20 && point.y <= visibleHandles.height - 20);
  assert(handlesInsideCanvas, "selected-image X and resize handles remain fully visible inside the canvas edges: " + JSON.stringify(visibleHandles));
  await saveScreenshot("animeart-studio-mobile-imported-image-moved.png");

  // Drag the bottom-right resize handle after its visual position has been clamped to the canvas.
  // The editor must compensate for the difference between the displayed handle and the real corner.
  const scaleBeforeEdgeDrag = mobilePngMoved.transform.scale;
  const resizeAt = { x: visibleHandles.canvas.left + visibleHandles.resize.x, y: visibleHandles.canvas.top + visibleHandles.resize.y };
  const resizeTarget = { x: resizeAt.x - 18, y: resizeAt.y - 18 };
  await mouseDrag(resizeAt, resizeTarget);
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers?.find(layer => layer.name === "e2e-mobile-import")?.transform.scale !== ' + JSON.stringify(scaleBeforeEdgeDrag), 10000);
  const mobilePngResized = (await readLayerSummary()).find(layer => layer.name === "e2e-mobile-import");
  assert(Number.isFinite(mobilePngResized?.transform?.scale) && Math.abs(mobilePngResized.transform.scale - scaleBeforeEdgeDrag) > 0.001,
    "dragging the visible bottom-right handle really changes image scale when its corner extends beyond the canvas");
  const importedTransformAfterResize = JSON.stringify(mobilePngResized.transform);
  const resizedHandleSnapshot = JSON.stringify(visibleHandles.resize);
  await waitFor('JSON.stringify(window.__ANIMEART_SELECTION_HANDLE_DIAGNOSTICS__?.resizeHandle) !== ' + JSON.stringify(resizedHandleSnapshot), 10000);
  const visibleHandlesAfterResize = await evaluate('(() => { const d=window.__ANIMEART_SELECTION_HANDLE_DIAGNOSTICS__; const size=d.canvasSize; const r=document.querySelector("#canvas").getBoundingClientRect(); return { width:size.width,height:size.height,close:d.closeHandle,resize:d.resizeHandle,canvas:{left:r.left,top:r.top,width:r.width,height:r.height} }; })()');
  assert([visibleHandlesAfterResize.close, visibleHandlesAfterResize.resize].every(point =>
    point.x >= 20 && point.x <= visibleHandlesAfterResize.width - 20 &&
    point.y >= 20 && point.y <= visibleHandlesAfterResize.height - 20),
    "selection handles remain visible after edge resizing");
  await saveScreenshot("animeart-studio-mobile-imported-image-resized.png");

  // The X-delete/Undo regression runs after the transform history sequence below.

  // Undo/Redo must remain accessible from the mobile dock when the selection overlay is closed.
  await clickMoreGoal("undo");
  await waitFor('JSON.stringify(JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers?.find(layer => layer.name === "e2e-mobile-import")?.transform) === ' + JSON.stringify(importedTransformAfterMove), 10000);
  assert((await readLayerSummary()).some(layer => layer.name === "e2e-mobile-import"),
    "Undo reverses edge resizing and preserves the moved image");
  await clickMoreGoal("redo");
  await waitFor('JSON.stringify(JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers?.find(layer => layer.name === "e2e-mobile-import")?.transform) === ' + JSON.stringify(importedTransformAfterResize), 10000);
  assert((await readLayerSummary()).some(layer => layer.name === "e2e-mobile-import"),
    "Redo reapplies edge resizing");
  await clickMoreGoal("undo");
  await waitFor('JSON.stringify(JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers?.find(layer => layer.name === "e2e-mobile-import")?.transform) === ' + JSON.stringify(importedTransformAfterMove), 10000);
  await clickMoreGoal("undo");
  await waitFor('JSON.stringify(JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers?.find(layer => layer.name === "e2e-mobile-import")?.transform) === ' + JSON.stringify(importedTransformBeforeMove), 10000);
  assert((await readLayerSummary()).some(layer => layer.name === "e2e-mobile-import"),
    "mobile Undo restores the image transform from before moving and resizing");
  await clickMoreGoal("redo");
  await waitFor('JSON.stringify(JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers?.find(layer => layer.name === "e2e-mobile-import")?.transform) === ' + JSON.stringify(importedTransformAfterMove), 10000);
  assert((await readLayerSummary()).some(layer => layer.name === "e2e-mobile-import"),
    "mobile Redo restores the image move");
  await clickMoreGoal("redo");
  await waitFor('JSON.stringify(JSON.parse(localStorage.getItem("animeart-web-document") || "{}").layers?.find(layer => layer.name === "e2e-mobile-import")?.transform) === ' + JSON.stringify(importedTransformAfterResize), 10000);
  assert((await readLayerSummary()).some(layer => layer.name === "e2e-mobile-import"),
    "mobile Redo restores the edge resize after restoring the move");

  // AA-IMAGE-X-DELETE-001: the visible X is an image delete action, not a selection-close action.
  await waitFor('Boolean(window.__ANIMEART_SELECTION_HANDLE_DIAGNOSTICS__?.closeHandle)');
  const closeAtAfterHistory = await evaluate('(() => { const r=document.querySelector("#canvas").getBoundingClientRect(), d=window.__ANIMEART_SELECTION_HANDLE_DIAGNOSTICS__; return {x:r.left+d.closeHandle.x,y:r.top+d.closeHandle.y}; })()');
  await mouseStroke([closeAtAfterHistory, closeAtAfterHistory]);
  await waitFor('!JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.some(layer=>layer.name==="e2e-mobile-import")', 10000);
  assert(await evaluate('!JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.some(layer=>layer.name==="e2e-mobile-import")'),
    "the canvas X removes the selected mobile image");
  await click('.mobile-top-actions [data-mobile-top-action="undo"]');
  await waitFor('JSON.stringify(JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import")?.transform) === ' + JSON.stringify(importedTransformAfterResize), 10000);
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.some(layer=>layer.name==="e2e-mobile-import")'),
    "mobile Undo restores the image removed with the canvas X and preserves its transform");

  // Undo keeps document contents but selection is UI state, so reselect the restored image through Layers.
  await clickMoreGoal("layers");
  await waitFor('document.body.classList.contains("mobile-layers-open")');
  await click('[aria-label="Seleccionar capa e2e-mobile-import"]');
  await waitFor('document.querySelector("#selection-indicator").textContent.includes("Imagen seleccionada: e2e-mobile-import")');
  await evaluate('document.body.classList.remove("mobile-layers-open")');
  await waitFor('!document.body.classList.contains("mobile-layers-open")');

  // AA-CANVAS-FREE-MOVE-UX-001: use the explicit margin action instead of relying on hidden wheel zoom.
  const transformBeforeMarginAction = await evaluate('JSON.stringify(JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import").transform)');
  await click("#selection-mini-margin");
  await waitFor('(() => { const f=window.__ANIMEART_DOCUMENT_FRAME_DIAGNOSTICS__; const r=document.querySelector("#canvas").getBoundingClientRect(); return f && f.topLeft.x > 8 && f.topLeft.y > 8 && f.topRight.x < r.width - 8 && f.bottomLeft.y < r.height - 8; })()');
  const pasteboardMargins = await evaluate('(() => { const f=window.__ANIMEART_DOCUMENT_FRAME_DIAGNOSTICS__; const r=document.querySelector("#canvas").getBoundingClientRect(); return {left:f?.topLeft?.x,right:f?.topRight?.x,top:f?.topLeft?.y,bottom:f?.bottomLeft?.y,canvasWidth:r.width,canvasHeight:r.height}; })()');
  assert(pasteboardMargins.left > 8 && pasteboardMargins.top > 8 &&
    pasteboardMargins.right < pasteboardMargins.canvasWidth - 8 &&
    pasteboardMargins.bottom < pasteboardMargins.canvasHeight - 8,
    "Ver margen exposes usable pasteboard on all four sides: " + JSON.stringify(pasteboardMargins));
  assert(await evaluate('JSON.stringify(JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import").transform) === ' + JSON.stringify(transformBeforeMarginAction)),
    "Ver margen changes only the viewport and leaves layer transforms untouched");
  assert(await evaluate('document.querySelector("[data-frame-boundary-mode=free]").getAttribute("aria-pressed") === "true"'),
    "Ver margen explicitly enables free movement");

  // Free-movement boundary checks require deterministic, unsnapped deltas.
  // Keep the magnet contract separate: snapping is covered by its own tests.
  assert(await evaluate('document.querySelector("#magnetic-snapping-toggle")?.getAttribute("aria-pressed") === "true"'),
    "magnetic snapping starts enabled before the isolated free-movement scenario");
  await evaluate('document.querySelector("#magnetic-snapping-toggle")?.click()');
  await waitFor('document.querySelector("#magnetic-snapping-toggle")?.getAttribute("aria-pressed") === "false"');
  assert(await evaluate('document.querySelector("#magnetic-snapping-toggle")?.getAttribute("aria-pressed") === "false"'),
    "free-movement E2E disables magnetic corrections explicitly");

  // AA-CANVAS-FREE-MOVE-001: layer content may cross all four document edges.
  // Each move is reversed from the transformed object's actual center, so the
  // test verifies the boundary crossing without polluting the following steps.
  for (const edge of ["top", "right", "bottom", "left"]) {
    const geometryBeforeEdge = await evaluate('(() => { const r=document.querySelector("#canvas").getBoundingClientRect(); const d=window.__ANIMEART_SELECTION_HANDLE_DIAGNOSTICS__; return {canvas:{left:r.left,top:r.top,width:r.width,height:r.height},center:{x:r.left+d.center.x,y:r.top+d.center.y}}; })()');
    const edgeTarget = await evaluate('(() => { const r=document.querySelector("#canvas").getBoundingClientRect(); const p=22; return {top:{x:r.left+r.width/2,y:r.top+p},right:{x:r.right-p,y:r.top+r.height/2},bottom:{x:r.left+r.width/2,y:r.bottom-p},left:{x:r.left+p,y:r.top+r.height/2}}; })()').then(points => points[edge]);
    const transformBeforeEdge = await evaluate('JSON.stringify(JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import").transform)');
    await mouseDrag(geometryBeforeEdge.center, edgeTarget);
    await waitFor('JSON.stringify(JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import").transform) !== ' + JSON.stringify(transformBeforeEdge), 10000);
    const boundsAfterEdge = await evaluate('(() => { const d=JSON.parse(localStorage.getItem("animeart-web-document")||"{}"); const l=d.layers.find(item=>item.name==="e2e-mobile-import"); const t=l.transform,p={x:d.width/2,y:d.height/2},w=l.image.width,h=l.image.height,a=(t.rotation||0)*Math.PI/180,s=t.scale; const pts=[[0,0],[w,0],[w,h],[0,h]].map(([x,y])=>{const dx=(x-p.x)*s,dy=(y-p.y)*s;return{x:dx*Math.cos(a)-dy*Math.sin(a)+p.x+t.x,y:dx*Math.sin(a)+dy*Math.cos(a)+p.y+t.y};}); return {width:d.width,height:d.height,minX:Math.min(...pts.map(v=>v.x)),maxX:Math.max(...pts.map(v=>v.x)),minY:Math.min(...pts.map(v=>v.y)),maxY:Math.max(...pts.map(v=>v.y))}; })()');
    const crossed = edge === "top" ? boundsAfterEdge.minY < 0
      : edge === "right" ? boundsAfterEdge.maxX > boundsAfterEdge.width
      : edge === "bottom" ? boundsAfterEdge.maxY > boundsAfterEdge.height
      : boundsAfterEdge.minX < 0;
    assert(crossed, "dragging an image across the " + edge + " edge leaves content outside the document frame: " + JSON.stringify(boundsAfterEdge));

    const visibleOutsideEdge = await evaluate('(() => { const edge=' + JSON.stringify(edge) + '; const doc=JSON.parse(localStorage.getItem("animeart-web-document")||"{}"); const layer=doc.layers.find(item=>item.name==="e2e-mobile-import"); const frame=window.__ANIMEART_DOCUMENT_FRAME_DIAGNOSTICS__; const canvas=document.querySelector("#canvas"); const rect=canvas.getBoundingClientRect(); if(!layer?.image||!frame?.topLeft||!frame?.topRight||!frame?.bottomLeft||!frame?.bottomRight)return {visible:false,edge,reason:"frame diagnostics unavailable"}; const sx=(frame.topRight.x-frame.topLeft.x)/doc.width; const sy=(frame.bottomLeft.y-frame.topLeft.y)/doc.height; const t=layer.transform,p={x:doc.width/2,y:doc.height/2},scale=t.scale||1,angle=(t.rotation||0)*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle),context=canvas.getContext("2d",{willReadFrequently:true}); const step=Math.max(2,Math.floor((edge==="top"||edge==="bottom"?layer.image.height:layer.image.width)/160)); for(let scan=0;scan<=(edge==="top"||edge==="bottom"?layer.image.height:layer.image.width);scan+=step){const x=edge==="top"||edge==="bottom"?Math.min(doc.width/2,layer.image.width-1):scan,y=edge==="top"||edge==="bottom"?scan:Math.min(doc.height/2,layer.image.height-1),dx=(x-p.x)*scale,dy=(y-p.y)*scale,world={x:dx*cos-dy*sin+p.x+t.x,y:dx*sin+dy*cos+p.y+t.y},screen={x:frame.topLeft.x+world.x*sx,y:frame.topLeft.y+world.y*sy}; const beyond=edge==="top"?screen.y<frame.topLeft.y-2:edge==="right"?screen.x>frame.topRight.x+2:edge==="bottom"?screen.y>frame.bottomLeft.y+2:screen.x<frame.topLeft.x-2; if(!beyond||screen.x<2||screen.x>=rect.width-2||screen.y<2||screen.y>=rect.height-2)continue; const px=Math.max(0,Math.min(canvas.width-1,Math.round(screen.x*canvas.width/rect.width))),py=Math.max(0,Math.min(canvas.height-1,Math.round(screen.y*canvas.height/rect.height))),alpha=context.getImageData(px,py,1,1).data[3]; if(alpha>0)return {visible:true,edge,sourcePoint:{x,y},screen,alpha,frame};} return {visible:false,edge,canvas:{width:rect.width,height:rect.height},layerTransform:t,frame}; })()');
    assert(visibleOutsideEdge.visible,
      "the image's real opaque pixels render beyond the " + edge + " document edge inside the workspace, not merely outside it in saved coordinates: " + JSON.stringify(visibleOutsideEdge));

    const geometryAfterEdge = await evaluate('(() => { const r=document.querySelector("#canvas").getBoundingClientRect(); const d=window.__ANIMEART_SELECTION_HANDLE_DIAGNOSTICS__; return {center:{x:r.left+d.center.x,y:r.top+d.center.y}}; })()');
    await mouseDrag(geometryAfterEdge.center, geometryBeforeEdge.center);
    await waitFor('(() => { const l=JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import"); return Math.abs(l.transform.x-JSON.parse(' + JSON.stringify(transformBeforeEdge) + ').x)<0.05 && Math.abs(l.transform.y-JSON.parse(' + JSON.stringify(transformBeforeEdge) + ').y)<0.05; })()', 10000);
  }

  // A selected layer may also move completely beyond the viewport. Its recovery
  // grip stays clamped to the visible edge and can drag it back into the canvas.
  const transformBeforeOffscreenRecovery = await evaluate('JSON.stringify(JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import").transform)');
  const bottomOffscreenStart = await evaluate('(() => { const r=document.querySelector("#canvas").getBoundingClientRect(); const d=window.__ANIMEART_SELECTION_HANDLE_DIAGNOSTICS__; return {x:r.left+d.center.x,y:r.top+d.center.y}; })()');
  const bottomOffscreenEnd = await evaluate('(() => { const r=document.querySelector("#canvas").getBoundingClientRect(); return {x:r.left+r.width/2,y:Math.min(innerHeight-26,r.bottom+80)}; })()');
  const canvasBeforeOffscreenDrag = await evaluate('document.querySelector("#canvas").getBoundingClientRect().bottom');
  assert(bottomOffscreenEnd.y > canvasBeforeOffscreenDrag + 1,
    "full off-canvas recovery E2E fixture has room below the visible canvas");
  await mouseDrag(bottomOffscreenStart, bottomOffscreenEnd);
  await waitFor('Boolean(window.__ANIMEART_SELECTION_HANDLE_DIAGNOSTICS__?.moveHandle)', 10000);
  const transformAfterOffscreenMove = await evaluate('JSON.stringify(JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import").transform)');
  const offscreenHandle = await evaluate('(() => { const r=document.querySelector("#canvas").getBoundingClientRect(); const d=window.__ANIMEART_SELECTION_HANDLE_DIAGNOSTICS__; return {move:{x:r.left+d.moveHandle.x,y:r.top+d.moveHandle.y},center:{x:r.left+r.width/2,y:r.top+r.height/2},canvas:{left:r.left,top:r.top,width:r.width,height:r.height}}; })()');
  assert(offscreenHandle.move.x >= offscreenHandle.canvas.left + 20 &&
    offscreenHandle.move.x <= offscreenHandle.canvas.left + offscreenHandle.canvas.width - 20 &&
    offscreenHandle.move.y >= offscreenHandle.canvas.top + 20 &&
    offscreenHandle.move.y <= offscreenHandle.canvas.top + offscreenHandle.canvas.height - 20,
    "an off-screen selected image exposes a move grip inside the canvas bounds");
  // Export while the selected image is still outside the document bounds.
  // The file must retain document dimensions and export must not silently restore/mutate the layer.
  const offscreenPngPath = join(downloadDir, "animeart.png");
  const offscreenPngFs = await import("node:fs/promises");
  try { await offscreenPngFs.unlink(offscreenPngPath); } catch {}
  const transformBeforeOffscreenExport = await evaluate('JSON.stringify(JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import").transform)');
  const documentSizeBeforeOffscreenExport = await evaluate('({width:JSON.parse(localStorage.getItem("animeart-web-document")||"{}").width,height:JSON.parse(localStorage.getItem("animeart-web-document")||"{}").height})');
  await evaluate('(() => { const select=document.querySelector("#mobile-export-format"); select.value="png"; select.dispatchEvent(new Event("change",{bubbles:true})); })()');
  await clickMoreGoal("export");
  await waitFor('document.querySelector("#status").textContent.includes("PNG exported")', 15000);
  for (let attempt = 0; attempt < 100 && !existsSync(offscreenPngPath); attempt++) await sleep(100);
  assert(existsSync(offscreenPngPath), "PNG export succeeds while selected image is outside the document frame");
  const offscreenPngReport = inspectPngAlpha(await offscreenPngFs.readFile(offscreenPngPath));
  assert(offscreenPngReport.width === documentSizeBeforeOffscreenExport.width &&
    offscreenPngReport.height === documentSizeBeforeOffscreenExport.height,
    "off-canvas PNG export is clipped to the exact document dimensions: " + JSON.stringify(offscreenPngReport));
  const transformAfterOffscreenExport = await evaluate('JSON.stringify(JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import").transform)');
  assert(transformAfterOffscreenExport === transformBeforeOffscreenExport,
    "exporting an off-canvas image leaves its current transform unchanged");
  if (await evaluate('document.body.classList.contains("mobile-tools-open")')) {
    await click('.mobile-touch-dock [data-touch-action="more"]');
    await waitFor('!document.body.classList.contains("mobile-tools-open")');
  }
  await mouseDrag(offscreenHandle.move, offscreenHandle.center);
  await waitFor('Boolean(window.__ANIMEART_SELECTION_HANDLE_DIAGNOSTICS__?.moveHandle) === false', 10000);
  const recoveredOffscreenTransform = await evaluate('JSON.stringify(JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import").transform)');
  assert(recoveredOffscreenTransform !== transformBeforeOffscreenRecovery,
    "dragging the visible recovery grip brings the off-screen image back while retaining its selection");
  await clickMoreGoal("undo");
  await waitFor('JSON.stringify(JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import").transform) === ' + JSON.stringify(transformAfterOffscreenMove), 10000);
  await clickMoreGoal("undo");
  // Retain the pre-test transform after backing out the recovery and off-screen move.
  await waitFor('JSON.stringify(JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import").transform) === ' + JSON.stringify(transformBeforeOffscreenRecovery), 10000);
  await evaluate('document.querySelector("#magnetic-snapping-toggle")?.click()');
  await waitFor('document.querySelector("#magnetic-snapping-toggle")?.getAttribute("aria-pressed") === "true"');
  assert(await evaluate('document.querySelector("#magnetic-snapping-toggle")?.getAttribute("aria-pressed") === "true"'),
    "magnetic snapping is restored after the isolated free-movement scenario");

  // AA-MOBILE-REDESIGN-004: verify that mobile rotation and flip controls mutate the selected image and can be restored.
  await clickMoreGoal("layers");
  await waitFor('document.body.classList.contains("mobile-layers-open")');
  const selectedImportedRow = await evaluate('(() => { const doc=JSON.parse(localStorage.getItem("animeart-web-document")||"{}"); const layer=doc.layers?.find(item=>item.name==="e2e-mobile-import"); const row=layer ? document.querySelector("#layers li[data-layer-id=\\\"" + layer.id + "\\\"] button.layer-select") : null; row?.click(); return Boolean(row); })()');
  assert(selectedImportedRow, "mobile layer list can select the exact imported image for transform tests");
  const mobileLayerId = await evaluate('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import")?.id');
  const mobileLayerTouchTargets = await evaluate('(() => { const row=[...document.querySelectorAll("#layers li")].find(item=>item.dataset.layerId === ' + JSON.stringify(mobileLayerId) + '); if(!row)return {found:false,targets:[]}; return {found:true,targets:[...row.querySelectorAll(".layer-controls .layer-toggle,.layer-lifecycle .layer-action")].map(el=>{const r=el.getBoundingClientRect();return {label:el.getAttribute("aria-label")||el.title||el.textContent.trim(),width:r.width,height:r.height,disabled:el.disabled};})}; })()');
  assert(mobileLayerTouchTargets.found && mobileLayerTouchTargets.targets.length >= 6 &&
    mobileLayerTouchTargets.targets.every(target=>target.width >= 44 && target.height >= 44),
    "mobile layer visibility, lock and lifecycle actions have finger-sized targets: " + JSON.stringify(mobileLayerTouchTargets));
  const mobileOrderBefore = await evaluate('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.findIndex(layer=>layer.id===' + JSON.stringify(mobileLayerId) + ')');
  assert(mobileOrderBefore > 0, "mobile stacking fixture has a layer below the selected image");
  await click(layerSelector(mobileLayerId) + ' .layer-action[title="Bajar capa un nivel"]');
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.findIndex(layer=>layer.id===' + JSON.stringify(mobileLayerId) + ') === ' + JSON.stringify(mobileOrderBefore - 1), 10000);
  await click(layerSelector(mobileLayerId) + ' .layer-action[title="Subir capa un nivel"]');
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.findIndex(layer=>layer.id===' + JSON.stringify(mobileLayerId) + ') === ' + JSON.stringify(mobileOrderBefore), 10000);
  assert(true, "mobile layer drawer moves a real layer backward and forward in stack order through its touch actions");
  await waitFor('document.querySelector("#selection-mini-panel").hidden === false');
  const mobileTransformBeforeButtonRotate = await evaluate('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import").transform.rotation');
  await clickMoreGoal("rotate-right");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import").transform.rotation === ' + JSON.stringify(mobileTransformBeforeButtonRotate + 5), 10000);
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import").transform.rotation === ' + JSON.stringify(mobileTransformBeforeButtonRotate + 5)),
    "mobile Rotate + really turns the selected image by five degrees");
  await clickMoreGoal("rotate-left");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import").transform.rotation === ' + JSON.stringify(mobileTransformBeforeButtonRotate), 10000);
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import").transform.rotation === ' + JSON.stringify(mobileTransformBeforeButtonRotate)),
    "mobile Rotate − restores the prior rotation through the same history-aware operation");

  for (const [action, field] of [["flip-horizontal", "flipX"], ["flip-vertical", "flipY"]]) {
    const before = await evaluate('Boolean(JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import").image.' + field + ')');
    await clickMoreGoal(action);
    await waitFor('Boolean(JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import").image.' + field + ') === ' + JSON.stringify(!before), 10000);
    assert(await evaluate('Boolean(JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import").image.' + field + ') === ' + JSON.stringify(!before)),
      "mobile " + (field === "flipX" ? "horizontal" : "vertical") + " flip changes the saved image transform");
    await clickMoreGoal(action);
    await waitFor('Boolean(JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import").image.' + field + ') === ' + JSON.stringify(before), 10000);
  }

  // The rotation handle itself must respond to a real pointer drag, not just the +/- buttons.
  await evaluate('document.body.classList.remove("mobile-layers-open")');
  await waitFor('!document.body.classList.contains("mobile-layers-open")');
  // The sheet has a CSS closing transition. Wait for the canvas position to settle before reading screen-space handles.
  await sleep(400);
  await evaluate('window.dispatchEvent(new Event("resize")); window.__ANIMEART_E2E_DIAGNOSTICS__ = true');
  await waitFor('Boolean(window.__ANIMEART_SELECTION_HANDLE_DIAGNOSTICS__?.rotationHandle && window.__ANIMEART_SELECTION_HANDLE_DIAGNOSTICS__?.center)');
  await sleep(100);
  const rotationGestureGeometry = await evaluate('(() => { const d=window.__ANIMEART_SELECTION_HANDLE_DIAGNOSTICS__; const canvas=document.querySelector("#canvas"); const r=canvas.getBoundingClientRect(); const start={x:r.left+d.rotationHandle.x,y:r.top+d.rotationHandle.y}; const pivot={x:r.left+r.width/2,y:r.top+r.height/2}; const vx=start.x-pivot.x, vy=start.y-pivot.y, angle=20*Math.PI/180; return {start,target:{x:pivot.x+vx*Math.cos(angle)-vy*Math.sin(angle),y:pivot.y+vx*Math.sin(angle)+vy*Math.cos(angle)}}; })()');
  const rotationBeforeGesture = await evaluate('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import").transform.rotation');
  await evaluate('window.__ANIMEART_LAST_SELECTION_POINTER__ = null');
  await mouseDrag(rotationGestureGeometry.start, rotationGestureGeometry.target);
  const rotationPointerDiagnostics = await evaluate('window.__ANIMEART_LAST_SELECTION_POINTER__ || null');
  assert(rotationPointerDiagnostics?.hit === "rotate",
    "pointer starts on the actual rotation handle (diagnostics: " + JSON.stringify(rotationPointerDiagnostics) + ")");
  await waitFor('Math.abs(JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import").transform.rotation - ' + JSON.stringify(rotationBeforeGesture) + ') > 5', 10000);
  const rotationAfterGesture = await evaluate('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import").transform.rotation');
  assert(Math.abs(rotationAfterGesture - rotationBeforeGesture) > 5, "dragging the visible mobile rotation handle changes the selected image angle");
  await clickMoreGoal("undo");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import").transform.rotation === ' + JSON.stringify(rotationBeforeGesture), 10000);
  await clickMoreGoal("redo");
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import").transform.rotation === ' + JSON.stringify(rotationAfterGesture), 10000);
  assert(true, "mobile rotation-handle drag participates in Undo/Redo history");

  await click('.mobile-touch-dock [data-touch-action="more"]');
  await waitFor('document.body.classList.contains("mobile-tools-open")');
  assert(await evaluate('(() => { const wrap=document.querySelector(".mobile-output-options"); const select=document.querySelector("#mobile-export-format"); const r=select.getBoundingClientRect(); const s=getComputedStyle(wrap); return Boolean(select && s.display!=="none" && s.visibility!=="hidden" && r.width>=60 && r.height>=30 && r.bottom<=innerHeight); })()'),
    "mobile export format picker stays visible and touch-usable inside More at a 393px viewport");

  // Export a real JPEG via the mobile dock and decode the downloaded file, not only a mocked Blob.
  const expectedJpegSize = await evaluate('({width:JSON.parse(localStorage.getItem("animeart-web-document")||"{}").width,height:JSON.parse(localStorage.getItem("animeart-web-document")||"{}").height})');
  await evaluate('(() => { const select=document.querySelector("#mobile-export-format"); select.value="jpeg"; select.dispatchEvent(new Event("change",{bubbles:true})); })()');
  await clickMoreGoal("export");
  await waitFor('document.querySelector("#status").textContent === "JPEG exported"', 15000);
  const jpegPath = join(downloadDir, "animeart.jpeg");
  for (let attempt = 0; attempt < 100 && !existsSync(jpegPath); attempt++) await sleep(100);
  assert(existsSync(jpegPath), "mobile dock exports JPEG to a downloadable file");
  const jpegBytes = await (await import("node:fs/promises")).readFile(jpegPath);
  assert(jpegBytes.length > 4 && jpegBytes[0] === 0xff && jpegBytes[1] === 0xd8 &&
    jpegBytes[jpegBytes.length - 2] === 0xff && jpegBytes[jpegBytes.length - 1] === 0xd9,
    "downloaded JPEG has valid SOI/EOI signatures");
  const decodedJpeg = await evaluate('new Promise(resolve => { const image=new Image(); image.onload=()=>resolve({width:image.naturalWidth,height:image.naturalHeight,ok:true}); image.onerror=()=>resolve({ok:false}); image.src="data:image/jpeg;base64,' + jpegBytes.toString("base64") + '"; })');
  assert(decodedJpeg.ok && decodedJpeg.width === expectedJpegSize.width && decodedJpeg.height === expectedJpegSize.height,
    "downloaded JPEG decodes successfully at the exact document dimensions");
  await click('.mobile-touch-dock [data-touch-action="more"]');
  await waitFor('document.body.classList.contains("mobile-tools-open")');
  await evaluate('(() => { const select=document.querySelector("#mobile-export-format"); select.value="png"; select.dispatchEvent(new Event("change",{bubbles:true})); })()');
  await click('.mobile-touch-dock [data-touch-action="more"]');
  await waitFor('!document.body.classList.contains("mobile-tools-open")');


  await click('.mobile-touch-dock [data-touch-action="more"]');
  await waitFor('document.body.classList.contains("mobile-tools-open")');
  assert(await evaluate('getComputedStyle(document.querySelector(".easy-edit-grid")).display === "grid"'), "mobile More action opens the dedicated toolbox catalog");
  assert(await evaluate('getComputedStyle(document.querySelector(".easy-edit-grid")).gridTemplateColumns.split(" ").length === 2'), "mobile toolbox actions use two columns");
  assert(await evaluate('document.querySelector("#toolbox-title").getBoundingClientRect().height > 0'), "mobile toolbox shows its own heading");
  assert(await evaluate('getComputedStyle(document.querySelector(".asset-quick-actions")).display !== "none"'), "mobile toolbox exposes image import and library actions");
  assert(await evaluate('getComputedStyle(document.querySelector(".toolbar")).display === "none"'), "mobile toolbox hides the underlying toolbar");
  await saveScreenshot("animeart-studio-mobile-tools.png");
  await click('.mobile-touch-dock [data-touch-action="more"]');
  await waitFor('!document.body.classList.contains("mobile-tools-open")');
  assert(await evaluate('document.querySelector(".canvas-wrap").getBoundingClientRect().height > 0'), "closing the mobile toolbox returns usable space to the canvas");

  await click('.mobile-touch-dock [data-touch-action="more"]');
  await waitFor('document.body.classList.contains("mobile-tools-open")');
  const layerCountBeforeShape = await evaluate('document.querySelectorAll("#layers li").length');
  await click('[data-edit-goal="shapes"]');
  await waitFor('document.querySelector("#shape-maker-dialog")?.open === true');
  assert(await evaluate('(() => { const r=document.querySelector("#shape-maker-dialog").getBoundingClientRect(); return r.width>=innerWidth-2 && r.height>=innerHeight-2; })()'), "large shape editor fills the mobile viewport");
  await evaluate('(() => { document.querySelector("#shape-maker-kind").value="star"; document.querySelector("#shape-maker-fill").value="#ff4fd8"; document.querySelector("#shape-maker-shadow-blur").value="12"; document.querySelector("#shape-maker-fill").dispatchEvent(new Event("input",{bubbles:true})); document.querySelector("#shape-maker-shadow-blur").dispatchEvent(new Event("input",{bubbles:true})); })()');
  assert(await evaluate('document.querySelector("#shape-maker-preview").src.startsWith("data:image/svg+xml")'), "shape style window previews an SVG figure locally");
  await click("#shape-maker-apply");
  await waitFor('document.querySelector("#shape-maker-dialog")?.open === false');
  assert(await evaluate('document.querySelectorAll("#layers li").length === ' + (layerCountBeforeShape + 1)), "confirming Formas creates one selectable layer");
  assert(await evaluate('document.querySelector("#selection-mini-layer-name").textContent.includes("Forma")'), "new shape becomes the selected editable object");

  await click('.mobile-touch-dock [data-touch-action="more"]');
  await waitFor('document.body.classList.contains("mobile-tools-open")');
  await click('[data-edit-goal="object-style"]');
  await waitFor('document.querySelector("#shape-maker-dialog")?.open === true');
  assert(await evaluate('document.querySelector("#shape-maker-apply").textContent.includes("Aplicar cambios")'), "selected vector shape opens its contextual edit window");
  await click("#shape-maker-cancel");
  await waitFor('document.querySelector("#shape-maker-dialog")?.open === false');
  assert(await evaluate('document.querySelector(".canvas-wrap").getBoundingClientRect().height > 0'), "closing a shape window returns to the canvas without applying cancelled edits");

  // AA-TOOL-STUDIOS-001: paint/erase have dedicated full-screen previews and never mutate before Apply.
  await evaluate('(() => { const button=[...document.querySelectorAll("#layers button")].find(b=>(b.getAttribute("aria-label")||"").includes("e2e-mobile-import")); if(!button) throw new Error("e2e-mobile-import layer is missing"); button.click(); return true; })()');
  const sourceBeforePaintStudio = await evaluate('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import")?.image?.source');
  await click('.mobile-touch-dock [data-touch-action="more"]');
  await waitFor('document.body.classList.contains("mobile-tools-open")');
  await click('[data-edit-goal="paint"]');
  await waitFor('document.querySelector("#censor-light-dialog")?.open === true');
  assert(await evaluate('(() => { const r=document.querySelector("#censor-light-dialog").getBoundingClientRect(); return document.querySelector("#censor-dialog-title").textContent.includes("Pintar píxeles") && r.width >= innerWidth - 2 && r.height >= innerHeight - 2; })()'),
    "Paint opens a focused full-screen pixel studio with the real image preview");
  await evaluate('(() => { const c=document.querySelector("#censor-image-preview"); const r=c.getBoundingClientRect(); const opts={bubbles:true,cancelable:true,pointerId:71,pointerType:"touch",clientX:r.left+r.width*.35,clientY:r.top+r.height*.42}; c.dispatchEvent(new PointerEvent("pointerdown",opts)); c.dispatchEvent(new PointerEvent("pointermove",{...opts,clientX:opts.clientX+Math.max(8,r.width*.08),clientY:opts.clientY+Math.max(8,r.height*.06)})); c.dispatchEvent(new PointerEvent("pointerup",opts)); })()');
  assert(await evaluate('document.querySelector("#censor-dialog-undo").disabled === false'), "Paint studio captures a reversible preview stroke");
  await click("#censor-dialog-cancel");
  await waitFor('document.querySelector("#censor-light-dialog").open === false');
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import")?.image?.source === ' + JSON.stringify(sourceBeforePaintStudio)),
    "cancelling Paint leaves the persisted image byte-for-byte unchanged");

  await click('.mobile-touch-dock [data-touch-action="more"]');
  await waitFor('document.body.classList.contains("mobile-tools-open")');
  await click('[data-edit-goal="erase"]');
  await waitFor('document.querySelector("#censor-light-dialog")?.open === true');
  assert(await evaluate('document.querySelector("#censor-dialog-title").textContent.includes("Borrar píxeles") && document.querySelector("#censor-dialog-glow").closest("label").hidden'),
    "Erase opens its own focused studio with irrelevant glow settings removed");
  await evaluate('(() => { const c=document.querySelector("#censor-image-preview"); const r=c.getBoundingClientRect(); const opts={bubbles:true,cancelable:true,pointerId:72,pointerType:"touch",clientX:r.left+r.width*.55,clientY:r.top+r.height*.52}; c.dispatchEvent(new PointerEvent("pointerdown",opts)); c.dispatchEvent(new PointerEvent("pointermove",{...opts,clientX:opts.clientX+Math.max(8,r.width*.06),clientY:opts.clientY+Math.max(8,r.height*.05)})); c.dispatchEvent(new PointerEvent("pointerup",opts)); })()');
  assert(await evaluate('document.querySelector("#censor-dialog-undo").disabled === false'), "Erase studio captures a reversible transparent preview stroke");
  await click("#censor-dialog-undo");
  assert(await evaluate('document.querySelector("#censor-dialog-undo").disabled === true'), "Erase undo removes the last preview stroke");
  await click("#censor-dialog-cancel");
  await waitFor('document.querySelector("#censor-light-dialog").open === false');
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.name==="e2e-mobile-import")?.image?.source === ' + JSON.stringify(sourceBeforePaintStudio)),
    "cancelling Erase leaves persisted pixels untouched");

  // Cropping offers two distinct scopes: image pixels or the full layered composition.
  await click('.mobile-touch-dock [data-touch-action="more"]');
  await waitFor('document.body.classList.contains("mobile-tools-open")');
  await click('[data-edit-goal="crop"]');
  await waitFor('document.querySelector("#crop-mode-dialog")?.open === true');
  assert(await evaluate('(() => { const d=document.querySelector("#crop-mode-dialog").getBoundingClientRect(); return d.width>=innerWidth-2 && d.height>=innerHeight-2 && document.querySelector("#crop-selected-image").getBoundingClientRect().height>0 && document.querySelector("#crop-whole-canvas").getBoundingClientRect().height>0; })()'),
    "crop chooser offers single-image crop and whole-composition crop separately");
  await click("#crop-selected-image");
  await waitFor('document.querySelector("#image-edit-dialog")?.open === true');
  assert(await evaluate('(() => { const d=document.querySelector("#image-edit-dialog").getBoundingClientRect(); return (document.querySelector("#image-edit-title").textContent.includes("recorte") || document.querySelector("#image-edit-title").textContent.includes("Recorte")) && d.width>=innerWidth-2 && d.height>=innerHeight-2; })()'),
    "single-image crop opens the original per-image pixel crop workspace");
  await click("#cancel-image-edit");
  await waitFor('document.querySelector("#image-edit-dialog").open === false');

  await click('.mobile-touch-dock [data-touch-action="more"]');
  await waitFor('document.body.classList.contains("mobile-tools-open")');
  await click('[data-edit-goal="crop"]');
  await waitFor('document.querySelector("#crop-mode-dialog")?.open === true');
  const beforeCompositionCrop = await readDocument();
  await click("#crop-whole-canvas");
  await waitFor('document.querySelector("#canvas-crop-dialog")?.open === true', 15000);
  assert(await evaluate('(() => { const d=document.querySelector("#canvas-crop-dialog").getBoundingClientRect(); return document.querySelector("#canvas-crop-preview").width>0 && document.querySelector("#canvas-crop-preview").height>0 && document.querySelector("#canvas-crop-preview").getBoundingClientRect().width>100 && d.width>=innerWidth-2 && d.height>=innerHeight-2; })()'),
    "composition crop preview shows the whole layered document, not only the selected image");
  await saveScreenshot("animeart-mobile-canvas-crop.png");
  const requestedCompositionCrop = {
    x: 10, y: 10,
    width: beforeCompositionCrop.width - 20,
    height: beforeCompositionCrop.height - 20
  };
  const setCompositionCropPreview = async () => {
    await evaluate('(() => { const values=' + JSON.stringify(requestedCompositionCrop) + '; for (const [key,value] of Object.entries(values)) { const input=document.querySelector("#canvas-crop-"+key); input.value=String(value); input.dispatchEvent(new Event("change",{bubbles:true})); } })()');
    assert(await evaluate('document.querySelector("#apply-canvas-crop").disabled === false'), "numeric crop fields enable Apply for a valid smaller composition frame");
  };
  const assertCompositionCropDiscarded = async (reason) => {
    assert(JSON.stringify(await readDocument()) === JSON.stringify(beforeCompositionCrop),
      reason + " discards the composition frame without changing document dimensions, layers, or transforms");
  };
  const reopenCompositionCrop = async () => {
    await click('.mobile-touch-dock [data-touch-action="more"]');
    await waitFor('document.body.classList.contains("mobile-tools-open")');
    await click('[data-edit-goal="crop"]');
    await waitFor('document.querySelector("#crop-mode-dialog")?.open === true');
    await click("#crop-whole-canvas");
    await waitFor('document.querySelector("#canvas-crop-dialog")?.open === true', 15000);
  };

  await setCompositionCropPreview();
  await click("#cancel-canvas-crop");
  await waitFor('document.querySelector("#canvas-crop-dialog").open === false');
  await assertCompositionCropDiscarded("Cancel");
  await reopenCompositionCrop();
  const compositionFrameAfterCancel = await evaluate('(() => ({x:Number(document.querySelector("#canvas-crop-x").value),y:Number(document.querySelector("#canvas-crop-y").value),width:Number(document.querySelector("#canvas-crop-width").value),height:Number(document.querySelector("#canvas-crop-height").value)}))()');
  assert(compositionFrameAfterCancel.x === Math.round(beforeCompositionCrop.width * 0.06) &&
    compositionFrameAfterCancel.y === Math.round(beforeCompositionCrop.height * 0.06),
    "reopening after Cancel restores the fresh default composition frame instead of the discarded preview");
  await setCompositionCropPreview();
  await click("#close-canvas-crop");
  await waitFor('document.querySelector("#canvas-crop-dialog").open === false');
  await assertCompositionCropDiscarded("X");
  await reopenCompositionCrop();
  await setCompositionCropPreview();
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await waitFor('document.querySelector("#canvas-crop-dialog").open === false');
  await assertCompositionCropDiscarded("Escape");
  await reopenCompositionCrop();
  await setCompositionCropPreview();
  await click("#apply-canvas-crop");
  await waitFor('document.querySelector("#canvas-crop-dialog").open === false');
  const afterCompositionCrop = await readDocument();
  assert(afterCompositionCrop.width === requestedCompositionCrop.width &&
    afterCompositionCrop.height === requestedCompositionCrop.height &&
    afterCompositionCrop.layers.length === beforeCompositionCrop.layers.length &&
    afterCompositionCrop.layers.every((layer,index)=>layer.id===beforeCompositionCrop.layers[index].id),
    "applying canvas crop changes the document frame but preserves every editable layer");

  // Reset pan/zoom so the layer inserted at the document centre has a known touch target.
  await cdp("Page.reload", { ignoreCache: true });
  await waitFor('document.readyState === "complete"');
  await waitFor('document.querySelector("#canvas") !== null');
  await waitForServiceWorkerReadiness();
  // AA-TYPOGRAPHY-CANVA-001: the text modal must work while the mobile layers drawer is hidden.
  assert(await evaluate('document.querySelector("#text-edit-dialog").parentElement === document.body'),
    "text editor is mounted outside the mobile-hidden layers panel");
  assert(await evaluate('getComputedStyle(document.querySelector(".layers")).display === "none"'),
    "mobile typography regression runs while the layers panel is actually hidden");
  // Reproduce the reported trap: the user was drawing before switching to text.
  await evaluate('document.querySelectorAll(".toolbar .tool[data-tool]").forEach(button => { if (button.dataset.tool === "brush") button.click(); })');
  await evaluate('document.querySelector("#text-edit-dialog").showModal = undefined');
  await click('.mobile-touch-dock [data-touch-action="add-text"]');
  await waitFor('document.querySelector("#text-edit-dialog")?.open === true');
  const mobileTextDialogDiagnostics = await evaluate('(() => { const d=document.querySelector("#text-edit-dialog"); const bounds=d.getBoundingClientRect(); const t=document.querySelector("#text-content"); const r=t.getBoundingClientRect(); const buttons=[...document.querySelectorAll(".toolbar .tool[data-tool]")]; const select=buttons.find(button=>button.dataset.tool==="select"); const brush=buttons.find(button=>button.dataset.tool==="brush"); return {parentIsBody:d.parentElement===document.body,open:d.open,fallback:d.dataset.openFallback||null,position:getComputedStyle(d).position,top:bounds.top,left:bounds.left,width:bounds.width,height:bounds.height,viewportWidth:innerWidth,viewportHeight:innerHeight,clientWidth:document.documentElement.clientWidth,clientHeight:document.documentElement.clientHeight,textWidth:r.width,textHeight:r.height,textDisabled:t.disabled,selectPressed:select?.getAttribute("aria-pressed"),brushPressed:brush?.getAttribute("aria-pressed")}; })()');
  assert(mobileTextDialogDiagnostics.parentIsBody && mobileTextDialogDiagnostics.open && mobileTextDialogDiagnostics.position==="fixed" && mobileTextDialogDiagnostics.top<=1 && mobileTextDialogDiagnostics.left<=1 && mobileTextDialogDiagnostics.width>=mobileTextDialogDiagnostics.clientWidth-2 && mobileTextDialogDiagnostics.height>=mobileTextDialogDiagnostics.clientHeight-2 && mobileTextDialogDiagnostics.textWidth>160 && mobileTextDialogDiagnostics.textHeight>=60 && !mobileTextDialogDiagnostics.textDisabled && mobileTextDialogDiagnostics.selectPressed==="true" && mobileTextDialogDiagnostics.brushPressed==="false",
    "mobile Text fills the available app viewport, remains editable, and switches away from brush mode: " + JSON.stringify(mobileTextDialogDiagnostics));
  const mobileTypographyLayer = (await readDocument()).layers.at(-1);
  assert(mobileTypographyLayer?.contentType === "text", "mobile typography creates a normal editable text layer");
  await evaluate('(() => { const el=document.querySelector("#text-content"); el.value="TÍTULO DE PRUEBA"; el.dispatchEvent(new Event("input",{bubbles:true})); el.dispatchEvent(new Event("change",{bubbles:true})); })()');
  await click('[data-text-style-preset="title"]');
  assert(await evaluate('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.id===' + JSON.stringify(mobileTypographyLayer.id) + ')?.text?.value==="Escribe aquí"'),
    "mobile typography preset keeps persisted text unchanged until Apply");
  assert(await evaluate('document.querySelector("#text-dialog-title").textContent.includes("Diseña tu texto")'),
    "typography dialog presents the title-first text workflow");
  await click("#apply-text-layer");
  await waitFor('document.querySelector("#text-edit-dialog").open === false');
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.some(layer=>layer.id===' + JSON.stringify(mobileTypographyLayer.id) + ' && layer.text?.value==="TÍTULO DE PRUEBA" && layer.text?.fontSize===76)',10000);
  assert(await evaluate('(() => { const b=document.querySelector(".mobile-touch-dock [data-touch-action=add-text]"); const r=b.getBoundingClientRect(); const s=getComputedStyle(b); return s.display!=="none" && s.visibility!=="hidden" && r.width>=44 && r.height>=44 && b.getAttribute("aria-label")==="Editar texto seleccionado" && b.querySelector("span:last-child")?.textContent==="Editar texto"; })()'),
    "the persistent mobile dock changes from Add Text to a touch-sized Edit Text action for a selected text layer");
  await click('.mobile-touch-dock [data-touch-action="add-text"]');
  await waitFor('document.querySelector("#text-edit-dialog").open === true');
  await evaluate('(() => { const el=document.querySelector("#text-content"); el.value="SUBTÍTULO EDITADO"; el.dispatchEvent(new Event("input",{bubbles:true})); el.dispatchEvent(new Event("change",{bubbles:true})); })()');
  await click("#apply-text-layer");
  await waitFor('document.querySelector("#text-edit-dialog").open === false');
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.some(layer=>layer.id===' + JSON.stringify(mobileTypographyLayer.id) + ' && layer.text?.value==="SUBTÍTULO EDITADO")',10000);
  assert(true, "existing text can be reopened, changed and persisted from the mobile canvas selection");

  const beforeTextMove = await evaluate('(() => { const d=JSON.parse(localStorage.getItem("animeart-web-document")||"{}"); const l=d.layers.find(layer=>layer.id===' + JSON.stringify(mobileTypographyLayer.id) + '); return {x:l.transform.x,y:l.transform.y,strokeCount:(l.strokes||[]).length}; })()');
  const mobileTextDragStart = await selectorCenter("#canvas");
  await cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, x: mobileTextDragStart.x, y: mobileTextDragStart.y, radiusX: 4, radiusY: 4, force: 1 }] });
  for (let step = 1; step <= 6; step++) {
    await cdp("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ id: 1, x: mobileTextDragStart.x + 36 * step / 6, y: mobileTextDragStart.y + 24 * step / 6, radiusX: 4, radiusY: 4, force: 1 }]
    });
    await sleep(30);
  }
  await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp("Emulation.setTouchEmulationEnabled", { enabled: false });
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.id===' + JSON.stringify(mobileTypographyLayer.id) + ')?.transform.x !== ' + JSON.stringify(beforeTextMove.x),10000);
  const afterTextMove = await evaluate('(() => { const l=JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.id===' + JSON.stringify(mobileTypographyLayer.id) + '); return {x:l.transform.x,y:l.transform.y}; })()');
  assert(Number.isFinite(afterTextMove.x) && Number.isFinite(afterTextMove.y) &&
    (afterTextMove.x !== beforeTextMove.x || afterTextMove.y !== beforeTextMove.y),
    "dragging selected text on the mobile touch path commits a bounded transform without killing the editor");
  const strokesAfterTextDrag = await evaluate('(() => { const l=JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(layer=>layer.id===' + JSON.stringify(mobileTypographyLayer.id) + '); return (l?.strokes||[]).length; })()');
  assert(strokesAfterTextDrag === beforeTextMove.strokeCount,
    "dragging text never adds brush strokes to the text layer");

  // A tap without movement should reopen the editor; the text must remain editable after the drag.
  const tapX = mobileTextDragStart.x + 36;
  const tapY = mobileTextDragStart.y + 24;
  await cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, x: tapX, y: tapY, radiusX: 4, radiusY: 4, force: 1 }] });
  await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp("Emulation.setTouchEmulationEnabled", { enabled: false });
  await waitFor('document.querySelector("#text-edit-dialog")?.open === true', 10000);
  assert(await evaluate('document.querySelector("#text-content")?.value === "SUBTÍTULO EDITADO"'),
    "tapping the moved text opens the editor with its current text, not a blank/new layer");
  await evaluate('(() => { const el=document.querySelector("#text-content"); el.value="TÍTULO FINAL"; el.dispatchEvent(new Event("input",{bubbles:true})); el.dispatchEvent(new Event("change",{bubbles:true})); })()');
  await click("#apply-text-layer");
  await waitFor('document.querySelector("#text-edit-dialog").open === false');
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.some(layer=>layer.id===' + JSON.stringify(mobileTypographyLayer.id) + ' && layer.text?.value==="TÍTULO FINAL")',10000);
  assert(await evaluate('document.readyState === "complete" && document.querySelector("#canvas") && document.querySelector("#selection-mini-edit-text")'),
    "editor remains responsive after moving, reopening, editing, and saving a text layer");
  await saveScreenshot("animeart-mobile-typography.png");


  // AA-GUIDED-STICKER-REAL-FLOW-001: import a real in-memory PNG, remove
  // its white background with the local processor, then export a transparent PNG.
  await evaluate('window.confirm = () => true');
  await evaluate('(() => { const text=document.querySelector("#text-edit-dialog"); if(text?.open) text.close(); const guide=document.querySelector("#guided-editing-dialog"); if(guide?.open) guide.close(); const toolbox=document.querySelector("#toolbox-dialog"); if(toolbox?.open) toolbox.close(); document.querySelector("#new-document").click(); })()');
  await waitFor('document.querySelector("#project-dialog")?.open === true');
  await click('#project-form button[type="submit"]');
  await waitFor('document.querySelector("#project-dialog")?.open === false');
  await waitFor('document.querySelector("#status")?.textContent === "New document created"');
  assert(await evaluate('Array.isArray(JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers)'),
    "guided sticker E2E starts from a fresh saved document");

  await evaluate('(() => { const toolbox=document.querySelector("#toolbox-dialog"); if(!toolbox.open) toolbox.showModal(); })()');
  await waitFor('document.querySelector("#toolbox-dialog")?.open === true');
  assert(await evaluate('(() => { const button=document.querySelector("#guided-editing-open-mobile"); const r=button.getBoundingClientRect(); const s=getComputedStyle(button); return Boolean(button&&s.display!=="none"&&r.width>=44&&r.height>=44&&r.bottom<=innerHeight); })()'),
    "three-step learning is reachable from the mobile toolbox with a touch-sized action");
  await click("#guided-editing-open-mobile");
  await waitFor('document.querySelector("#guided-editing-dialog")?.open === true');
  await evaluate('(() => { const toggle=document.querySelector("#editing-help-enabled"); toggle.checked=true; toggle.dispatchEvent(new Event("change",{bubbles:true})); })()');
  assert(await evaluate('document.querySelectorAll("#guided-flow-select option").length === 8 && document.querySelectorAll("#guided-step-list li").length === 3'),
    "guided editor exposes eight real three-step routes");
  assert(await evaluate('document.querySelector("#guided-mascot-tip")?.hidden === false && document.querySelector("#guided-mascot-tip img")?.getAttribute("src") === "./assets/kapiart-mascot.png"'),
    "the guide uses KapiArt’s official bundled mascot when help is enabled");
  await evaluate('(() => { const toggle=document.querySelector("#editing-help-enabled"); toggle.checked=false; toggle.dispatchEvent(new Event("change",{bubbles:true})); })()');
  assert(await evaluate('document.querySelector("#guided-mascot-tip")?.hidden === true'),
    "disabling editing help hides the mascot card");
  await evaluate('(() => { const toggle=document.querySelector("#editing-help-enabled"); toggle.checked=true; toggle.dispatchEvent(new Event("change",{bubbles:true})); })()');
  await evaluate('(() => { const select=document.querySelector("#guided-flow-select"); select.value="sticker-anime"; select.dispatchEvent(new Event("change",{bubbles:true})); })()');
  await waitFor('document.querySelector("#guided-step-title")?.textContent === "Prepara el personaje"');

  await evaluate('(() => { const input=document.querySelector("#image-file-input"); window.__kapiartGuidedOriginalPickerClick=input.click.bind(input); input.click=()=>{ const source=document.createElement("canvas"); source.width=64; source.height=64; const ctx=source.getContext("2d"); ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,64,64); ctx.fillStyle="#f2a2a0"; ctx.fillRect(12,12,40,40); ctx.fillStyle="#241a19"; ctx.fillRect(24,24,16,16); const encoded=source.toDataURL("image/png").split(",")[1]; const bytes=Uint8Array.from(atob(encoded),character=>character.charCodeAt(0)); const file=new File([bytes],"guided-sticker-fixture.png",{type:"image/png"}); const transfer=new DataTransfer(); transfer.items.add(file); input.files=transfer.files; input.dispatchEvent(new Event("change",{bubbles:true})); }; })()');
  await click("#guided-step-action");
  await waitFor('document.querySelector("#guided-editing-dialog")?.open === false');
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.some(layer=>layer.contentType==="image" && layer.name?.includes("guided-sticker-fixture") && layer.image?.source)', 15000);
  const guidedStickerOriginal = (await readDocument()).layers.find(layer => layer?.contentType === "image" && layer.name?.includes("guided-sticker-fixture"));
  assert(guidedStickerOriginal?.contentType === "image" && guidedStickerOriginal.image?.source,
    "guided sticker preparation imports a real PNG as an editable image layer");
  await evaluate('(() => { const input=document.querySelector("#image-file-input"); input.click=window.__kapiartGuidedOriginalPickerClick; })()');
  await clickMoreGoal("layers");
  await waitFor('document.body.classList.contains("mobile-layers-open")');
  await click('[aria-label="Seleccionar capa guided-sticker-fixture"]');
  await waitFor('document.querySelector("#selection-indicator").textContent.includes("Imagen seleccionada: guided-sticker-fixture")');
  await evaluate('document.body.classList.remove("mobile-layers-open")');
  await waitFor('!document.body.classList.contains("mobile-layers-open")');
  await evaluate('(() => { const toolbox=document.querySelector("#toolbox-dialog"); if(!toolbox.open) toolbox.showModal(); document.querySelector("#guided-editing-open-mobile").click(); })()');
  await waitFor('document.querySelector("#guided-editing-dialog")?.open === true');
  await click("#guided-step-complete");
  await waitFor('document.querySelector("#guided-step-title")?.textContent === "Separa la silueta"');

  await click("#guided-step-action");
  await waitFor('document.querySelector("#background-removal-dialog")?.open === true');
  assert(await evaluate('document.querySelector("#background-removal-preview")?.getBoundingClientRect().width > 0'),
    "the sticker guide opens the actual local background-removal preview");
  await click("#background-auto-detect");
  await waitFor('document.querySelector("#background-removal-status")?.textContent.includes("Vista previa del borrado") && document.querySelector("#apply-background-removal")?.disabled === false', 15000);
  const previewStatusBeforeApply = await evaluate('document.querySelector("#background-removal-status")?.textContent || ""');
  await evaluate('document.querySelector("#apply-background-removal").click()');
  try {
    await waitFor('document.querySelector("#background-removal-dialog")?.open === false || document.querySelector("#background-removal-status")?.textContent !== ' + JSON.stringify(previewStatusBeforeApply), 15000);
  } catch (error) {
    const applyDiagnostics = await evaluate('(() => { const saved=JSON.parse(localStorage.getItem("animeart-web-document")||"{}"); const dialog=document.querySelector("#background-removal-dialog"); const status=document.querySelector("#background-removal-status"); const button=document.querySelector("#apply-background-removal"); const selected=document.querySelector("#selection-indicator")?.textContent || ""; return {dialogOpen:dialog?.open,status:status?.textContent,buttonDisabled:button?.disabled,selected,fixtureLayer:saved.layers?.find(layer=>layer.name==="guided-sticker-fixture")?.id}; })()');
    throw new Error(error.message + "; applyDiagnostics=" + JSON.stringify(applyDiagnostics));
  }
  assert(await evaluate('document.querySelector("#background-removal-dialog")?.open === false'),
    "applying the inspected background-removal preview closes the tool after committing; status=" + await evaluate('document.querySelector("#background-removal-status")?.textContent || ""'));
  await waitFor("JSON.parse(localStorage.getItem(\"animeart-web-document\")||\"{}\").layers.some(layer=>layer.id===" + JSON.stringify(guidedStickerOriginal.id) + " && layer.image?.source!==" + JSON.stringify(guidedStickerOriginal.image.source) + ")", 15000);
  const guidedStickerProcessed = (await readDocument()).layers.find(layer => layer.id === guidedStickerOriginal.id);
  assert(guidedStickerProcessed?.contentType === "image" && guidedStickerProcessed.image?.source !== guidedStickerOriginal.image.source,
    "guided sticker background removal changes the selected image source and preserves its layer");
  await evaluate('(() => { window.__kapiAlphaInspection={pending:true}; const saved=JSON.parse(localStorage.getItem("animeart-web-document")||"{}"); const source=saved.layers.find(layer=>layer.id===' + JSON.stringify(guidedStickerOriginal.id) + ')?.image?.source; const image=new Image(); image.onload=()=>{ try { const canvas=document.createElement("canvas"); canvas.width=image.naturalWidth; canvas.height=image.naturalHeight; const context=canvas.getContext("2d",{willReadFrequently:true}); context.drawImage(image,0,0); const pixels=context.getImageData(0,0,canvas.width,canvas.height).data; window.__kapiAlphaInspection={width:canvas.width,height:canvas.height,cornerAlpha:pixels[3],centerAlpha:pixels[(Math.floor(canvas.height/2)*canvas.width+Math.floor(canvas.width/2))*4+3],sourceType:source?.slice(0,30)}; } catch(error) { window.__kapiAlphaInspection={error:error.message}; } }; image.onerror=()=>{ window.__kapiAlphaInspection={error:"processed image failed to decode",sourceType:source?.slice(0,30)}; }; image.src=source || ""; })()');
  await waitFor('window.__kapiAlphaInspection && window.__kapiAlphaInspection.pending !== true', 5000);
  const processedAlpha = await evaluate('window.__kapiAlphaInspection');
  assert(processedAlpha.width === 64 && processedAlpha.height === 64 && processedAlpha.cornerAlpha < 32 && processedAlpha.centerAlpha > 200,
    "guided sticker background removal persists transparent background pixels and opaque subject pixels in the actual edited image: " + JSON.stringify(processedAlpha));

  await evaluate('(() => { const toolbox=document.querySelector("#toolbox-dialog"); if(!toolbox.open) toolbox.showModal(); document.querySelector("#guided-editing-open-mobile").click(); })()');
  await waitFor('document.querySelector("#guided-editing-dialog")?.open === true');
  await click("#guided-step-complete");
  await waitFor('document.querySelector("#guided-step-title")?.textContent === "Comprueba y exporta"');
  const pngFilesBeforeGuidedExport = Object.fromEntries(readdirSync(downloadDir)
    .filter(name => /^animeart(?: \(\d+\))?\.png$/.test(name))
    .map(name => [name, statSync(join(downloadDir, name)).mtimeMs]));
  await click("#guided-step-action");
  await waitFor('document.querySelector("#status").textContent === "PNG exported"', 15000);
  let guidedExportPath = null;
  for (let attempt=0; attempt<100 && !guidedExportPath; attempt++) {
    const newOrChangedPngs = readdirSync(downloadDir)
      .filter(name => /^animeart(?: \(\d+\))?\.png$/.test(name))
      .map(name => ({path:join(downloadDir,name),name,mtimeMs:statSync(join(downloadDir,name)).mtimeMs,size:statSync(join(downloadDir,name)).size}))
      .filter(file => file.size > 0 && (!Object.hasOwn(pngFilesBeforeGuidedExport,file.name) || file.mtimeMs > pngFilesBeforeGuidedExport[file.name]));
    if (newOrChangedPngs.length) {
      newOrChangedPngs.sort((left,right) => right.mtimeMs-left.mtimeMs);
      guidedExportPath = newOrChangedPngs[0].path;
    } else {
      await sleep(100);
    }
  }
  assert(Boolean(guidedExportPath && existsSync(guidedExportPath)),
    "the guided sticker finish action downloads a non-empty PNG file");
  const guidedExportAlpha = inspectPngAlpha(await (await import("node:fs/promises")).readFile(guidedExportPath));
  assert(guidedExportAlpha.foundTransparentPixel,
    "the sticker guide exports a PNG with actual transparent pixels");
  assert((await readDocument()).layers.some(layer => layer.id === guidedStickerOriginal.id && layer.contentType === "image"),
    "exporting from the guide leaves the editable sticker layer in the project");
  await evaluate('(() => { const toolbox=document.querySelector("#toolbox-dialog"); if(!toolbox.open) toolbox.showModal(); document.querySelector("#guided-editing-open-mobile").click(); })()');
  await waitFor('document.querySelector("#guided-editing-dialog")?.open === true');
  await click("#guided-step-complete");
  const completedStickerGuide = await evaluate('JSON.parse(localStorage.getItem("kapiart-guided-editing-progress-v1")||"{}").progressByFlow?.["sticker-anime"]||null');
  assert(completedStickerGuide?.completedStepIds?.length === 3,
    "the guide records all three confirmed steps after the real import, cutout, and PNG export");


  await evaluate('document.querySelectorAll("dialog[open]").forEach(dialog=>dialog.close())');
  await clickMoreGoal("creative-studio");
  await waitFor('document.querySelector("#creative-studio-dialog")?.open === true');
  await click('[data-creative-action="select-template"][data-item-id="youtube-anime-thumb"]');
  await waitFor('document.querySelector("#creative-cover-size")?.value === "banner"');
  assert(await evaluate('document.querySelector("#creative-cover-size")?.value === "banner"'),
    "selecting a widescreen template also chooses its suggested banner format");
  await click("#creative-studio-x");

  await evaluate('window.confirm=()=>true; window.prompt=(message,defaultValue)=>message.startsWith("Nombre de la copia")?(defaultValue||"Copia E2E"):"Nombre renombrado E2E";');
  await openDesignLibrary();
  await evaluate('document.querySelector("#design-library-name").value="KapiArt E2E workflow"');
  await click("#design-library-save-current");
  await waitFor('document.querySelector("#design-library-status")?.textContent.includes("Diseño guardado localmente")',15000);
  await waitFor('document.querySelectorAll("#design-library-list .design-library-card").length===1',10000);
  const savedDesignCard = await evaluate('(() => { const card=document.querySelector("#design-library-list .design-library-card"); return {name:card?.querySelector(".design-library-copy strong")?.textContent,meta:card?.querySelector(".design-library-copy small")?.textContent,hasPreview:Boolean(card?.querySelector(".design-library-visual img"))}; })()');
  assert(savedDesignCard.name==="KapiArt E2E workflow" && /px/.test(savedDesignCard.meta||""),
    "Mis diseños saves an editable project and shows its dimensions");
  assert(savedDesignCard.hasPreview,
    "Mis diseños stores and displays a locally rendered thumbnail when canvas encoding is available");

  await click("#design-library-list button[data-design-action=\"duplicate\"]");
  await waitFor('document.querySelectorAll("#design-library-list .design-library-card").length===2',10000);
  await click("#design-library-list button[data-design-action=\"rename\"]");
  await waitFor('Array.from(document.querySelectorAll("#design-library-list .design-library-copy strong")).some(node=>node.textContent==="Nombre renombrado E2E")');
  await click("#design-library-list button[data-design-action=\"open\"]");
  await waitFor('document.querySelector("#design-library-dialog")?.open !== true');
  assert(await evaluate('document.querySelector("#status")?.textContent.startsWith("Diseño abierto:")'),
    "opening a library entry restores the editable project and closes the dialog");

  await openDesignLibrary();
  await click("#design-library-list button[data-design-action=\"delete\"]");
  await waitFor('document.querySelectorAll("#design-library-list .design-library-card").length===1',10000);
  assert(await evaluate('document.querySelectorAll("#design-library-list .design-library-card").length===1'),
    "deleting a library entry keeps the other project intact");
  await click("#design-library-close");
  await waitFor('document.querySelector("#design-library-dialog")?.open !== true');

  await clickMoreGoal("creative-studio");
  await waitFor('document.querySelector("#creative-studio-dialog")?.open === true');
  assert(await evaluate('document.querySelectorAll("[data-creative-tab]").length===6'),
    "creative studio exposes a dedicated Elements library tab");
  await click('[data-creative-tab="elements"]');
  await evaluate('(() => { const q=document.querySelector("#creative-catalog-search"); q.value=""; q.dispatchEvent(new Event("input",{bubbles:true})); const category=document.querySelector("#creative-element-category"); category.value="Globos y diálogo"; category.dispatchEvent(new Event("change",{bubbles:true})); })()');
  await waitFor('document.querySelectorAll("#creative-catalog-grid [data-creative-action=\\\"add-element\\\"]").length===3');
  assert(await evaluate('Array.from(document.querySelectorAll("#creative-catalog-grid [data-creative-action=\\\"add-element\\\"]")).some(button=>button.dataset.itemId==="bubble-rounded")'),
    "element library filters original speech bubbles by collection");
  await click('#creative-catalog-grid [data-element-favorite="bubble-rounded"]');
  await waitFor('JSON.parse(localStorage.getItem("kapiart-creative-element-favorites-v1")||"[]").includes("bubble-rounded")');
  await click("#creative-element-favorites-only");
  await waitFor('document.querySelectorAll("#creative-catalog-grid [data-creative-action=\\\"add-element\\\"]").length===1');
  assert(await evaluate('document.querySelector("#creative-catalog-grid [data-creative-action=\\\"add-element\\\"]")?.dataset.itemId==="bubble-rounded"'),
    "the favorites-only filter keeps the saved element and hides other elements");
  await click('#creative-catalog-grid [data-creative-action="add-element"][data-item-id="bubble-rounded"]');
  await waitFor('JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.some(layer=>layer.name==="Elemento · Globo suave"&&layer.contentType==="image"&&layer.image?.source.startsWith("data:image/svg+xml"))',10000);
  const addedElement = await evaluate('(() => { const layer=JSON.parse(localStorage.getItem("animeart-web-document")||"{}").layers.find(item=>item.name==="Elemento · Globo suave"); return {type:layer?.contentType,source:layer?.image?.source,scale:layer?.transform?.scale}; })()');
  assert(addedElement.type==="image" && addedElement.source.startsWith("data:image/svg+xml") && addedElement.scale>0,
    "adding an element creates its own movable local SVG layer instead of flattening it");
  await click("#creative-studio-close");
  await waitFor('document.querySelector("#creative-studio-dialog")?.open === false');

  const mobileViewport = await evaluate('window.matchMedia("(max-width: 920px)").matches');
  if (mobileViewport) {
    const mobileLayersOpen = await evaluate('document.body.classList.contains("mobile-layers-open")');
    if (!mobileLayersOpen) await clickMoreGoal("layers");
    await waitFor('document.body.classList.contains("mobile-layers-open")');
  }
  const alignLayerId = await evaluate('(() => { const d=JSON.parse(localStorage.getItem("animeart-web-document")||"{}"); const layer=(d.layers||[]).find(item=>!item.locked); return layer?.id||null; })()');
  assert(alignLayerId, "a mutable layer is available to the alignment controls");
  await click('#layers li[data-layer-id="' + alignLayerId + '"] .layer-select');
  await click('[data-layer-align="center-x"]');
  await waitFor('(/alinead|deshacer/i).test(document.querySelector("#layer-alignment-status")?.textContent||"")');
  assert(await evaluate('(/alinead|deshacer/i).test(document.querySelector("#layer-alignment-status")?.textContent||"")'),
    "the visible layer panel applies canvas alignment and reports a recoverable action");

  const resizeToolboxOpen = await evaluate('document.querySelector("#toolbox-dialog")?.open === true');
  if (!resizeToolboxOpen) {
    const resizeMobileViewport = await evaluate('window.matchMedia("(max-width: 920px)").matches');
    await click(resizeMobileViewport ? '.mobile-touch-dock [data-touch-action="more"]' : '#toolbox-open');
    await waitFor('document.querySelector("#toolbox-dialog")?.open === true');
  }
  await click("#quick-open-design-resize");
  await waitFor('document.querySelector("#design-resize-dialog")?.open === true');
  const resizeBefore = await evaluate('(() => { const d=JSON.parse(localStorage.getItem("animeart-web-document")||"{}"); return {width:d.width,height:d.height,ids:(d.layers||[]).map(layer=>layer.id),layers:d.layers||[]}; })()');
  assert(resizeBefore.width > 0 && resizeBefore.height > 0 && resizeBefore.ids.length > 0,
    "format adaptation starts from an existing editable composition");
  await evaluate(`(() => {
    document.querySelector("#design-resize-width").value="1080";
    document.querySelector("#design-resize-height").value="1920";
    const fit=document.querySelector('input[name="design-resize-mode"][value="fit"]');
    fit.checked=true;
    document.querySelector("#design-resize-preset").value="story";
    document.querySelector("#design-resize-preset").dispatchEvent(new Event("change",{bubbles:true}));
    return true;
  })()`);
  await click("#design-resize-apply");
  await waitFor('(() => { const d=JSON.parse(localStorage.getItem("animeart-web-document")||"{}"); return d.width===1080 && d.height===1920; })()',10000);
  const resizeAfter = await evaluate('(() => { const d=JSON.parse(localStorage.getItem("animeart-web-document")||"{}"); return {width:d.width,height:d.height,ids:(d.layers||[]).map(layer=>layer.id),layers:d.layers||[]}; })()');
  assert(resizeAfter.width===1080 && resizeAfter.height===1920 && resizeAfter.ids.length===resizeBefore.ids.length &&
    resizeAfter.ids.every((id,index)=>id===resizeBefore.ids[index]),
    "format adaptation preserves every layer ID and stack order without flattening");
  assert(resizeAfter.layers.some(layer=>layer.contentType==="text"&&typeof layer.text?.value==="string") ||
    resizeBefore.layers.every(layer=>layer.contentType!=="text"),
    "editable text content is preserved when the canvas format changes");
  const resizeUndoSelector = await evaluate('window.matchMedia("(max-width: 920px)").matches ? ".mobile-top-actions [data-mobile-top-action=\\\"undo\\\"]" : "#undo"');
  await waitFor('document.querySelector(' + JSON.stringify(resizeUndoSelector) + ')?.disabled === false',10000);
  await click(resizeUndoSelector);
  await waitFor('(() => { const d=JSON.parse(localStorage.getItem("animeart-web-document")||"{}"); return d.width===' + resizeBefore.width + ' && d.height===' + resizeBefore.height + '; })()',10000);
  assert(await evaluate('(() => { const d=JSON.parse(localStorage.getItem("animeart-web-document")||"{}"); return d.width===' + resizeBefore.width + ' && d.height===' + resizeBefore.height + '; })()'),
    "canvas format changes are undoable through the existing document history");

  await openMultiPageManager();
  await evaluate('document.querySelector("#multi-page-project-name").value="KapiArt Multi E2E"');
  await click("#multi-page-create-project");
  await waitFor('document.querySelector("#multi-page-active-name")?.textContent==="KapiArt Multi E2E"',15000);
  await waitFor('document.querySelectorAll("#multi-page-page-list .multi-page-page-card").length===1');
  assert(await evaluate('document.querySelector("#multi-page-active-name")?.textContent==="KapiArt Multi E2E"'),
    "a multipage project starts from the current editable canvas");

  await click("#multi-page-duplicate-page");
  await waitFor('document.querySelectorAll("#multi-page-page-list .multi-page-page-card").length===2',10000);
  const duplicatePageInfo = await evaluate('(() => ({active:document.querySelector("#multi-page-active-page")?.textContent,options:document.querySelectorAll("#multi-page-copy-target option").length}))()');
  assert(/Página 2 de 2/.test(duplicatePageInfo.active||"") && duplicatePageInfo.options===1,
    "duplicating a page keeps two independently addressable pages");

  const layerCountBeforeCopy = await evaluate('Number(document.querySelector("#multi-page-page-list .multi-page-page-info small")?.textContent.match(/(\\d+) capas/)?.[1]||0)');
  await click("#multi-page-copy-layer");
  await waitFor('document.querySelector("#multi-page-status")?.textContent.includes("Capa copiada a")',10000);
  const copyFeedback = await evaluate('document.querySelector("#multi-page-status")?.textContent||""');
  assert(copyFeedback.includes("Se conservó editable"),
    "copying a layer between pages preserves independent editable content");
  const layerCountAfterCopy = await evaluate('Number(document.querySelector("#multi-page-page-list .multi-page-page-info small")?.textContent.match(/(\\d+) capas/)?.[1]||0)');
  assert(layerCountAfterCopy===layerCountBeforeCopy+1,
    "copying a layer adds one independent editable layer to the target page");


  await click("#multi-page-add-blank");
  await waitFor('document.querySelectorAll("#multi-page-page-list .multi-page-page-card").length===3',10000);
  await click('#multi-page-page-list .multi-page-page-card:last-child button[data-multi-page-action="rename"]');
  await waitFor('Array.from(document.querySelectorAll("#multi-page-page-list .multi-page-page-info strong")).some(node=>node.textContent==="Nombre renombrado E2E")');
  await click('#multi-page-page-list .multi-page-page-card:last-child button[data-multi-page-action="up"]');
  await waitFor('document.querySelectorAll("#multi-page-page-list .multi-page-page-card").length===3');
  const activeAfterReorder = await evaluate('document.querySelector("#multi-page-active-page")?.textContent||""');
  assert(/2 de 3/.test(activeAfterReorder),
    "pages can be renamed and reordered without losing the active page");

  await click("#multi-page-export-pdf");
  await waitFor('document.querySelector("#multi-page-status")?.textContent.includes("PDF exportado correctamente")',30000);
  assert(await evaluate('document.querySelector("#multi-page-status")?.textContent.includes("PDF exportado correctamente")'),
    "the multipage project exports all rendered pages into a single PDF");
  await click('#multi-page-page-list button[data-multi-page-action="open"][data-page-id]:not(:disabled)');
  await waitFor('document.querySelector("#multi-page-status")?.textContent.startsWith("Página abierta:")',10000);
  await click("#multi-page-save-page");
  await waitFor('document.querySelector("#multi-page-status")?.textContent.includes("Página guardada")',10000);
  const pageCountBeforeDelete = await evaluate('document.querySelectorAll("#multi-page-page-list .multi-page-page-card").length');
  await click('#multi-page-page-list button[data-multi-page-action="delete"][data-page-id]');
  await waitFor('document.querySelectorAll("#multi-page-page-list .multi-page-page-card").length===2',10000);
  const pageCountAfterDelete = await evaluate('document.querySelectorAll("#multi-page-page-list .multi-page-page-card").length');
  assert(pageCountBeforeDelete===3 && pageCountAfterDelete===2,
    "the project supports deleting one page while preserving the other editable pages");
  await click("#multi-page-close");
  await waitFor('document.querySelector("#multi-page-dialog")?.open !== true');


  const groupingMobileViewport = await evaluate('window.matchMedia("(max-width: 920px)").matches');
  if (groupingMobileViewport && !(await evaluate('document.body.classList.contains("mobile-layers-open")'))) {
    await clickMoreGoal("layers");
    await waitFor('document.body.classList.contains("mobile-layers-open")');
  }
  await evaluate(`(() => {
    const documentModel = JSON.parse(localStorage.getItem("animeart-web-document") || "{}");
    const current = documentModel.layers?.length || 0;
    if (current < 2) document.querySelector("#add-layer")?.click();
    return true;
  })()`);
  await waitFor('document.querySelectorAll("#layers .layer-select").length >= 2',10000);
  const selectedTwoLayers = await evaluate(`(() => {
    const buttons = [...document.querySelectorAll("#layers .layer-select")];
    if (buttons.length < 2) return false;
    buttons[0].click();
    buttons[1].dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
    return document.querySelectorAll('#layers li[data-selected="true"]').length >= 2;
  })()`);
  assert(selectedTwoLayers, "the layer list supports selecting multiple editable objects");
  await waitFor('document.querySelector("#layer-group-selection")?.disabled === false');
  await click("#layer-group-selection");
  await waitFor(`(() => {
    const doc = JSON.parse(localStorage.getItem("animeart-web-document") || "{}");
    const grouped = (doc.layers || []).filter(layer => layer.groupId);
    return grouped.length >= 2 && new Set(grouped.map(layer => layer.groupId)).size === 1;
  })()`,10000);
  const groupSnapshot = await evaluate(`(() => {
    const doc = JSON.parse(localStorage.getItem("animeart-web-document") || "{}");
    const grouped = (doc.layers || []).filter(layer => layer.groupId);
    return { count: grouped.length, groupId: grouped[0]?.groupId, editable: grouped.every(layer => ["drawing","image","text"].includes(layer.contentType)) };
  })()`);
  assert(groupSnapshot.count >= 2 && Boolean(groupSnapshot.groupId) && groupSnapshot.editable,
    "grouping persists membership metadata without flattening the layers");

  await evaluate(`(() => {
    const first = document.querySelector("#layers .layer-select");
    first?.click();
    return true;
  })()`);
  await waitFor('document.querySelectorAll("#layers li[data-selected]").length >= 2');
  const allGroupMembersSelected = await evaluate('document.querySelectorAll("#layers li[data-selected]").length === ' + groupSnapshot.count);
  assert(allGroupMembersSelected, "selecting one grouped object selects the group as a unit");

  await click("#layer-ungroup-selection");
  await waitFor(`(() => {
    const doc = JSON.parse(localStorage.getItem("animeart-web-document") || "{}");
    return !(doc.layers || []).some(layer => layer.groupId);
  })()`,10000);
  const ungroupedSnapshot = await evaluate(`(() => {
    const doc = JSON.parse(localStorage.getItem("animeart-web-document") || "{}");
    return { total: doc.layers?.length || 0, grouped: (doc.layers || []).filter(layer => layer.groupId).length };
  })()`);
  assert(ungroupedSnapshot.grouped === 0,
    "ungrouping removes persisted group membership while keeping every layer editable");

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
