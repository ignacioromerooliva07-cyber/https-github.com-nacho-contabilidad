const { spawnSync } = require("node:child_process");

function fail(message) {
  console.error(`\n[github-release] ${message}\n`);
  process.exit(1);
}

const owner = (process.env.CONTABILIDAD_GH_OWNER || process.env.GH_OWNER || "").trim();
const repo = (process.env.CONTABILIDAD_GH_REPO || process.env.GH_REPO || process.env.GITHUB_REPOSITORY?.split("/")[1] || "").trim();
const token = (process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "").trim();

if (!owner) {
  fail("Falta CONTABILIDAD_GH_OWNER (o GH_OWNER).");
}

if (!repo) {
  fail("Falta CONTABILIDAD_GH_REPO (o GH_REPO / GITHUB_REPOSITORY).");
}

if (!token) {
  fail("Falta GH_TOKEN o GITHUB_TOKEN para publicar en GitHub Releases.");
}

const command = process.platform === "win32" ? "electron-builder.cmd" : "electron-builder";
const args = [
  "--win",
  "nsis",
  "--publish",
  "always",
  `--config.publish.provider=github`,
  `--config.publish.owner=${owner}`,
  `--config.publish.repo=${repo}`
];

console.log(`[github-release] Publicando release en ${owner}/${repo}...`);
const result = spawnSync(command, args, {
  stdio: "inherit",
  shell: true,
  env: process.env
});

if (result.status !== 0) {
  fail("La publicacion en GitHub Releases fallo.");
}

console.log("\n[github-release] Publicacion completada correctamente.\n");
