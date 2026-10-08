import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";
import { spawn } from "node:child_process";

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

const browser = spawn(chrome, [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--remote-debugging-port=0",
  "--remote-allow-origins=*",
  `--user-data-dir=${profile}`,
  `http://${HOST}:${PORT}/index.html`
], { stdio: ["ignore", "ignore", "pipe"] });

const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms));

const devToolsPort = await new Promise((resolvePort, rejectPort) => {
  let stderr = "";
  const timeout = setTimeout(() => rejectPort(new Error(`Chromium DevTools endpoint did not become ready. stderr: ${stderr}`)), 30000);
  browser.stderr.on("data", chunk => {
    stderr += chunk.toString();
    const match = stderr.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
    if (match) {
      clearTimeout(timeout);
      resolvePort(Number(match[1]));
    }
  });
  browser.once("exit", code => {
    clearTimeout(timeout);
    rejectPort(new Error(`Chromium exited before DevTools became ready (code ${code}). stderr: ${stderr}`));
  });
});

async function waitForDevTools() {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${devToolsPort}/json/list`);
      const pages = await response.json();
      const page = pages.find(item => item.type === "page" && item.url.includes(`http://${HOST}:${PORT}`));
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(100);
  }
  throw new Error("Chromium page DevTools endpoint did not become ready");
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
  const rect = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width, height: r.height }; })()`);
  if (!rect) throw new Error(`Selector not found: ${selector}`);
  return rect;
};

const click = async selector => {
  const point = await selectorCenter(selector);
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await sleep(120);
};

const canvasPoint = async (xRatio, yRatio) => {
  const rect = await selectorCenter("#canvas");
  return { x: rect.x + (xRatio - 0.5) * rect.width, y: rect.y + (yRatio - 0.5) * rect.height };
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

try {
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

  await click('[data-tool="brush"]');
  const c = await selectorCenter("#canvas");
  await mouseStroke([
    { x: c.x - 100, y: c.y - 50 },
    { x: c.x - 20, y: c.y },
    { x: c.x + 80, y: c.y + 60 }
  ]);
  const drawn = await readDocument();
  assert(drawn.layers[0].strokes.length === 1, "real pointer input creates a stroke");
  assert(drawn.layers[0].strokes[0].points.length >= 3, "stroke contains the real pointer path");

  await click("#add-layer");
  let afterLayer = await readDocument();
  assert(afterLayer.layers.length === 2, "real layer control creates a second layer");

  await click("#layers li:first-child .layer-select");
  assert(await evaluate('document.querySelector("#layers li:first-child").dataset.selected === "true"'), "real layer selection updates the editor selection");

  const beforeTransform = await readDocument();
  const selectedId = beforeTransform.layers.at(-1).id;
  const beforeX = beforeTransform.layers.find(layer => layer.id === selectedId).transform.x;
  await click('[data-transform="right"]');
  const afterTransform = await readDocument();
  const afterX = afterTransform.layers.find(layer => layer.id === selectedId).transform.x;
  assert(afterX === beforeX + 10, "real transform control moves the selected layer through the existing domain operation");

  await click("#undo");
  const afterUndo = await readDocument();
  assert(afterUndo.layers.find(layer => layer.id === selectedId).transform.x === beforeX, "real Undo restores the pre-transform document state");

  await click("#redo");
  const afterRedo = await readDocument();
  assert(afterRedo.layers.find(layer => layer.id === selectedId).transform.x === beforeX + 10, "real Redo reapplies the transform");

  const persistedBeforeReload = JSON.stringify(afterRedo);
  await cdp("Page.reload", { ignoreCache: true });
  await waitFor(`document.readyState === "complete"`);
  await waitFor(`JSON.stringify(JSON.parse(localStorage.getItem("animeart-web-document"))) === ${JSON.stringify(persistedBeforeReload)}`, 10000);
  const recovered = await readDocument();
  assert(JSON.stringify(recovered) === persistedBeforeReload, "reload recovers the persisted document exactly");
  assert(await evaluate('document.querySelector("#layers li:first-child").dataset.selected === "true"'), "reloaded editor restores a valid selected layer");

  console.log("ANIMEART_REAL_WEB_E2E: PASS");
} finally {
  ws.close();
  browser.kill("SIGTERM");
  await rm(profile, { recursive: true, force: true });
  server.close();
}
