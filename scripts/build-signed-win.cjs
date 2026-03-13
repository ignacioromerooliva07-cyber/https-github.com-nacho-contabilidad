const { spawnSync } = require("node:child_process");

function fail(message) {
  console.error(`\n[code-signing] ${message}\n`);
  process.exit(1);
}

const cscLink = process.env.CSC_LINK;
const cscPassword = process.env.CSC_KEY_PASSWORD;

if (!cscLink) {
  fail(
    "Falta CSC_LINK. Debe apuntar al certificado .pfx (ruta local o URL segura).\n" +
      "Ejemplo PowerShell: $env:CSC_LINK='C:/certs/contabilidad-signing.pfx'"
  );
}

if (!cscPassword) {
  fail(
    "Falta CSC_KEY_PASSWORD. Define la clave del certificado antes de ejecutar el build firmado.\n" +
      "Ejemplo PowerShell: $env:CSC_KEY_PASSWORD='tu-clave-segura'"
  );
}

const command = process.platform === "win32" ? "electron-builder.cmd" : "electron-builder";
const args = [
  "--win",
  "nsis",
  "--config.forceCodeSigning=true",
  "--config.win.signAndEditExecutable=true"
];

console.log("[code-signing] Iniciando build firmado para Windows...");
const result = spawnSync(command, args, {
  stdio: "inherit",
  shell: true,
  env: process.env
});

if (result.status !== 0) {
  fail("El build firmado fallo. Revisa certificado, clave y salida de electron-builder.");
}

console.log("\n[code-signing] Build firmado completado correctamente.\n");
