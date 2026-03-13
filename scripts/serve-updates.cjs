const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const port = Number(process.env.UPDATE_SERVER_PORT || 5507);
const root = path.join(process.cwd(), "updates");

const contentTypeByExt = {
  ".yml": "text/yaml; charset=utf-8",
  ".exe": "application/octet-stream",
  ".blockmap": "application/octet-stream",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

function safeResolve(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = path.normalize(cleanPath).replace(/^([\\/])+/, "");
  const abs = path.join(root, normalized);
  if (!abs.startsWith(root)) return null;
  return abs;
}

if (!fs.existsSync(root)) {
  fs.mkdirSync(root, { recursive: true });
}

const server = http.createServer((req, res) => {
  const target = safeResolve(req.url || "/");
  if (!target) {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  let filePath = target;
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = contentTypeByExt[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[updates] Servidor local activo en http://127.0.0.1:${port}`);
  console.log(`[updates] Publica artefactos en ${path.join(root, "windows")}`);
});
