import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const SERVER_SCRIPT = join(ROOT, "scripts", "serve.mjs");

async function reservePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const address = probe.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise(resolve => probe.close(resolve));
  return port;
}

async function startServer() {
  const port = await reservePort();
  const child = spawn(process.execPath, [SERVER_SCRIPT], {
    cwd: ROOT,
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), ANIMEART_WEB_ROOT: ROOT },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { output += chunk; });
  const baseUrl = "http://127.0.0.1:" + port;
  const deadline = Date.now() + 5000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("Dev server exited during startup: " + output);
    try {
      const response = await fetch(baseUrl + "/");
      if (response.status === 200) return { child, baseUrl, output: () => output };
    } catch {}
    await delay(40);
  }

  child.kill();
  throw new Error("Dev server failed to start: " + output);
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  const exited = once(child, "exit");
  child.kill();
  await Promise.race([exited, delay(1500)]);
}

test("dev server serves the editor shell and required asset MIME types", async () => {
  const { child, baseUrl } = await startServer();
  try {
    const html = await fetch(baseUrl + "/");
    assert.equal(html.status, 200);
    assert.match(await html.text(), /KapiArt Studio \| Crea arte anime con ternura/);

    const css = await fetch(baseUrl + "/styles.css");
    assert.equal(css.status, 200);
    assert.match(css.headers.get("content-type"), /text\/css/);

    const app = await fetch(baseUrl + "/app.js");
    assert.equal(app.status, 200);
    assert.match(app.headers.get("content-type"), /javascript/);

    const asset = await fetch(baseUrl + "/assets/cc0-detailed-anime-character.png.base64");
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get("content-type"), /text\/plain/);
  } finally {
    await stopServer(child);
  }
});

test("dev server supports HEAD and rejects unsafe paths and write methods", async () => {
  const { child, baseUrl } = await startServer();
  try {
    const head = await fetch(baseUrl + "/index.html", { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");

    const post = await fetch(baseUrl + "/", { method: "POST" });
    assert.equal(post.status, 405);
    assert.match(post.headers.get("allow") || "", /GET.*HEAD/);

    const traversal = await fetch(baseUrl + "/..%2fpackage.json");
    assert.ok([400, 403, 404].includes(traversal.status));
    assert.notEqual(traversal.status, 200);

    const missing = await fetch(baseUrl + "/does-not-exist");
    assert.equal(missing.status, 404);
  } finally {
    await stopServer(child);
  }
});

test("development server stays outside the production static build", async () => {
  const buildScript = await readFile(join(ROOT, "scripts", "build.mjs"), "utf8");
  const packageJson = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
  const html = await readFile(join(ROOT, "index.html"), "utf8");
  assert.match(packageJson.scripts.dev, /scripts\/serve\.mjs/);
  assert.match(packageJson.scripts.start, /scripts\/serve\.mjs/);
  assert.match(buildScript, /"scripts"/);
  assert.match(buildScript, /"test"/);
  assert.match(html, /app\.js/);
});
