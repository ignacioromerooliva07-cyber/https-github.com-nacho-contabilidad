const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = process.cwd();
const sourceDir = path.join(root, "release-fix");
const targetDir = path.join(root, "updates", "windows");

function fail(message) {
  console.error(`\n[updates] ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(sourceDir)) {
  fail("No existe release-fix. Genera el instalador primero.");
}

const setupFile = fs
  .readdirSync(sourceDir)
  .find((name) => name.startsWith("Contabilidad Desktop-Setup-") && name.endsWith(".exe"));

if (!setupFile) {
  fail("No se encontro el instalador .exe en release-fix.");
}

const blockmapFile = `${setupFile}.blockmap`;
const setupPath = path.join(sourceDir, setupFile);
const blockmapPath = path.join(sourceDir, blockmapFile);

if (!fs.existsSync(blockmapPath)) {
  fail("No se encontro el archivo .blockmap correspondiente al instalador.");
}

fs.mkdirSync(targetDir, { recursive: true });

const setupBuffer = fs.readFileSync(setupPath);
const sha512 = crypto.createHash("sha512").update(setupBuffer).digest("base64");
const size = fs.statSync(setupPath).size;
const versionMatch = setupFile.match(/Setup-(\d+\.\d+\.\d+)\.exe$/);
const version = versionMatch ? versionMatch[1] : "0.0.0";
const releaseDate = new Date().toISOString();

fs.copyFileSync(setupPath, path.join(targetDir, setupFile));
fs.copyFileSync(blockmapPath, path.join(targetDir, blockmapFile));

const latestYml = [
  `version: ${version}`,
  `files:`,
  `  - url: ${setupFile}`,
  `    sha512: ${sha512}`,
  `    size: ${size}`,
  `path: ${setupFile}`,
  `sha512: ${sha512}`,
  `releaseDate: '${releaseDate}'`
].join("\n");

fs.writeFileSync(path.join(targetDir, "latest.yml"), `${latestYml}\n`, "utf8");

console.log("[updates] Publicacion local completada:");
console.log(`[updates] - ${path.join(targetDir, setupFile)}`);
console.log(`[updates] - ${path.join(targetDir, blockmapFile)}`);
console.log(`[updates] - ${path.join(targetDir, "latest.yml")}`);
