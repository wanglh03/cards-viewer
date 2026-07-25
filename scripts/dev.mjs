import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = path.join(root, "dist");
const dataOrigin =
  process.env.CARDS_VIEWER_DATA_ORIGIN?.trim() || "https://cards.gtbro.vip";
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
environment.CARDS_VIEWER_DATA_ORIGIN = dataOrigin;
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
  const filePath = safeDistPath(url.pathname);
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

console.log(`Local site: http://127.0.0.1:${port}`);
console.log(`Cloud data: ${dataOrigin}`);

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
