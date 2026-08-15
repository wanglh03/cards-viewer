import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = path.join(root, "dist");
const assetOrigin = "https://cards-cdn.gtbro.vip";
const jsonProxyUrls = new Map([
  ["/json/issuer-info.json", `${assetOrigin}/json/issuer-info.json`],
  ["/json/issuer-mydata.json", `${assetOrigin}/json/issuer-mydata.json`],
  ["/json/mydata.json", `${assetOrigin}/json/mydata.json`],
  ["/json/myissuers.json", `${assetOrigin}/json/myissuers.json`],
  ["/json/bin-overlays.json", `${assetOrigin}/json/bin-overlays.json`],
  ["/issuer-info.json", `${assetOrigin}/json/issuer-info.json`],
]);
const issuerLogoProxyPrefix = "/proxy/issuer-logo/";
const requestedPort = Number(process.env.PORT || 8787);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const environment = { ...process.env };
const pathEnvironmentKey =
  Object.keys(environment).find((key) => key.toLowerCase() === "path") ||
  "PATH";
environment[pathEnvironmentKey] =
  `${path.dirname(process.execPath)}${path.delimiter}${environment[pathEnvironmentKey] || ""}`;
Object.keys(environment).forEach((key) => {
  if (key !== pathEnvironmentKey && key.toLowerCase() === "path")
    delete environment[key];
});
const buildProcess = spawn(
  process.execPath,
  [fileURLToPath(new URL("./build.mjs", import.meta.url)), "--watch"],
  { cwd: root, stdio: "inherit", env: environment },
);

function safeDistPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const filePath = path.resolve(dist, relative);
  return filePath === dist || filePath.startsWith(`${dist}${path.sep}`)
    ? filePath
    : null;
}

async function serveStatic(request, response, filePath) {
  try {
    const file = await stat(filePath);
    if (!file.isFile()) throw new Error("Not a file");
    response.writeHead(200, {
      "cache-control": "no-cache",
      "content-length": file.size,
      "content-type":
        mimeTypes[path.extname(filePath).toLowerCase()] ||
        "application/octet-stream",
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not Found");
  }
}

const server = http.createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { allow: "GET, HEAD" });
    response.end("Method Not Allowed");
    return;
  }

  const url = new URL(
    request.url || "/",
    `http://${request.headers.host || "localhost"}`,
  );
  const jsonProxyUrl = jsonProxyUrls.get(url.pathname);
  if (jsonProxyUrl) {
    try {
      const upstream = await fetch(jsonProxyUrl);
      const body = await upstream.arrayBuffer();
      response.writeHead(upstream.status, {
        "cache-control": "no-cache",
        "content-length": body.byteLength,
        "content-type": upstream.headers.get("content-type") || "application/json",
      });
      if (request.method === "HEAD") response.end();
      else response.end(Buffer.from(body));
    } catch {
      response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      response.end("Issuer info unavailable");
    }
    return;
  }
  if (url.pathname.startsWith(issuerLogoProxyPrefix)) {
    const logoPath = url.pathname.slice(issuerLogoProxyPrefix.length);
    if (!logoPath || logoPath.includes("..")) {
      response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      response.end("Bad Request");
      return;
    }
    try {
      const upstream = await fetch(
        `${assetOrigin}/issuers/logo/${logoPath}${url.search}`,
      );
      const body = await upstream.arrayBuffer();
      response.writeHead(upstream.status, {
        "cache-control": "public, max-age=86400",
        "content-length": body.byteLength,
        "content-type": upstream.headers.get("content-type") || "image/*",
      });
      if (request.method === "HEAD") response.end();
      else response.end(Buffer.from(body));
    } catch {
      response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      response.end("Issuer logo unavailable");
    }
    return;
  }
  const filePath = /^\/s\/[^/]+\/?$/.test(url.pathname)
    ? path.join(dist, "s", "index.html")
    : safeDistPath(url.pathname);
  if (!filePath) {
    response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    response.end("Bad Request");
    return;
  }
  await serveStatic(request, response, filePath);
});

async function listen(port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve(server.address().port);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "127.0.0.1");
  });
}

function openBrowser(url) {
  if (process.env.OPEN_BROWSER?.toLowerCase() === "false") return;

  const command = process.platform === "win32"
    ? "cmd.exe"
    : process.platform === "darwin"
      ? "open"
      : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const browserProcess = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  browserProcess.unref();
}

async function openBrowserWhenReady(url) {
  if (process.env.OPEN_BROWSER?.toLowerCase() === "false") return;
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.ok) {
        openBrowser(url);
        return;
      }
    } catch {
      // The initial build may still be preparing the page.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  openBrowser(url);
}

let port = requestedPort;
while (true) {
  try {
    port = await listen(port);
    break;
  } catch (error) {
    if (error.code !== "EADDRINUSE" || port >= requestedPort + 10) throw error;
    port += 1;
  }
}

const localUrl = `http://127.0.0.1:${port}`;
console.log(`Local site: ${localUrl}`);
console.log(`Cloud assets: ${assetOrigin}`);
await openBrowserWhenReady(localUrl);

let closing = false;
function close() {
  if (closing) return;
  closing = true;
  server.close();
  if (!buildProcess.killed) buildProcess.kill();
}

process.on("SIGINT", close);
process.on("SIGTERM", close);
buildProcess.on("exit", (code) => {
  if (code && !closing) {
    console.error(`Build watcher exited with code ${code}`);
    close();
    process.exit(code);
  }
});
