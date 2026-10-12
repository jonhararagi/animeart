import { createServer } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIRECTORY, "..");
const CONFIGURED_ROOT = process.env.ANIMEART_WEB_ROOT
  ? resolve(process.env.ANIMEART_WEB_ROOT)
  : DEFAULT_ROOT;
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 4173);

const MIME_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8",
  ".base64": "text/plain; charset=utf-8"
});

if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) {
  throw new RangeError("PORT must be an integer between 0 and 65535");
}

const ROOT = await realpath(CONFIGURED_ROOT);

function isInsideRoot(candidate) {
  const pathFromRoot = relative(ROOT, candidate);
  return pathFromRoot === "" ||
    (pathFromRoot !== ".." && !pathFromRoot.startsWith(".." + sep) && !isAbsolute(pathFromRoot));
}

function send(response, status, message, headers = {}) {
  const body = Buffer.from(message);
  response.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "content-length": body.length,
    "x-content-type-options": "nosniff",
    "cache-control": "no-store",
    ...headers
  });
  response.end(response.req?.method === "HEAD" ? undefined : body);
}

const server = createServer(async (request, response) => {
  response.req = request;
  if (request.method !== "GET" && request.method !== "HEAD") {
    send(response, 405, "Method not allowed", { allow: "GET, HEAD" });
    return;
  }

  let decodedPath;
  try {
    const rawPath = (request.url || "/").split("?", 1)[0];
    decodedPath = decodeURIComponent(rawPath).replaceAll("\\", "/");
  } catch {
    send(response, 400, "Malformed URL path");
    return;
  }

  if (decodedPath.includes("\u0000") || decodedPath.split("/").some(segment => segment === "..")) {
    send(response, 403, "Path traversal is not allowed");
    return;
  }

  const relativePath = decodedPath.replace(/^\/+/, "");
  const requestedPath = resolve(ROOT, relativePath || "index.html");
  if (!isInsideRoot(requestedPath)) {
    send(response, 403, "Path is outside the static root");
    return;
  }

  try {
    const actualPath = await realpath(requestedPath);
    const actualRelativePath = relative(ROOT, actualPath);
    if (actualRelativePath === ".." || actualRelativePath.startsWith(".." + sep) || resolve(actualPath) !== ROOT && !actualPath.startsWith(ROOT + sep)) {
      send(response, 403, "Path is outside the static root");
      return;
    }

    const data = await readFile(actualPath);
    const type = MIME_TYPES[extname(actualPath).toLowerCase()] || "application/octet-stream";
    response.writeHead(200, {
      "content-type": type,
      "content-length": data.length,
      "x-content-type-options": "nosniff",
      "cache-control": "no-store"
    });
    response.end(request.method === "HEAD" ? undefined : data);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR" || error?.code === "EISDIR") {
      send(response, 404, "File not found");
      return;
    }
    console.error("[AnimeArt dev server]", error);
    send(response, 500, "Internal server error");
  }
});

server.listen(PORT, HOST, () => {
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : PORT;
  console.log("AnimeArt Web editor: http://" + HOST + ":" + port + "/");
  console.log("Serving: " + ROOT);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
