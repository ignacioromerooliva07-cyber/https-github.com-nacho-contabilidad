import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import https from "node:https";
import { autoUpdater } from "electron-updater";
import type { ProgressInfo, UpdateInfo } from "electron-updater";
import {
  createSocioEmpresa,
  createCuentaContable,
  createEmpresa,
  checkpointDatabase,
  deleteSocioEmpresa,
  deleteEmpresa,
  generarBalanceComprobacionCSV,
  generarLibroDiarioCSV,
  getAsientoDetalles,
  getAsientoDocumentoEditable,
  getHistorialCambiosAsiento,
  getBalanceComprobacion,
  getDatabasePath,
  getEmpresaActivaId,
  getFallbackPath,
  getLibroDiario,
  getLibroMayor,
  getStorageMode,
  initializeDatabase,
  listCuentasContables,
  listEmpresas,
  listAsientos,
  listRegistrosAuditoria,
  listSociosEmpresa,
  registrarOperacionAutomatica,
  registrarOperacionDesdeTexto,
  interpretarTextoOperacion,
  confirmarYRegistrarDesdeInterpretacion,
  seedPlanCuentasChile,
  setEmpresaActiva,
  updateSocioEmpresa,
  updateAsientoDocumento,
  updateEmpresa,
  updateNombreCuentaContable
} from "./db";

const isDev = !app.isPackaged;
const INDICADORES_CACHE_MS = 15 * 60 * 1000;
const INDICADORES_CACHE_FILE = "indicadores-cache.json";

type IndicadoresData = {
  dolar: number | null;
  euro: number | null;
  uf: number | null;
  utm: number | null;
  ipc: number | null;
  tpm: number | null;
  fecha: string;
  fuente: string;
};

type IndicadoresEstado = "en-vivo" | "cache-memoria" | "cache-disco" | "sin-conexion";

type IndicadoresResponse = IndicadoresData & {
  estado: IndicadoresEstado;
};

type SoporteMantenimiento = {
  appName: string;
  version: string;
  isPackaged: boolean;
  storageMode: "sqlite" | "fallback";
  userDataPath: string;
  databasePath: string;
  fallbackPath: string;
  autoUpdateEnabled: boolean;
  updateProvider: "generic" | "github" | "disabled";
  updateFeedUrl: string | null;
};

type EstadoActualizacion =
  | "disabled"
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "error";

type EstadoUpdateRuntime = {
  enabled: boolean;
  provider: "generic" | "github" | "disabled";
  feedUrl: string | null;
  status: EstadoActualizacion;
  currentVersion: string;
  latestVersion: string | null;
  downloadPercent: number | null;
  releaseNotes: string[];
  lastCheckedAt: string | null;
  lastError: string | null;
};

let indicadoresCache:
  | {
      fetchedAt: number;
      data: IndicadoresData;
    }
  | null = null;

let mainWindow: BrowserWindow | null = null;
let updaterConfigured = false;
let updateInterval: NodeJS.Timeout | null = null;
const updateFeedUrl = (process.env.CONTABILIDAD_UPDATE_URL ?? process.env.AUTO_UPDATE_URL ?? "").trim() || null;
const updateGithubOwner = (process.env.CONTABILIDAD_GH_OWNER ?? "ignacioromerooliva07-cyber").trim() || null;
const updateGithubRepo = (process.env.CONTABILIDAD_GH_REPO ?? "https-github.com-nacho-contabilidad").trim() || null;

function resolveUpdateProvider(): {
  provider: "generic" | "github" | "disabled";
  enabled: boolean;
  feedUrl: string | null;
} {
  if (!app.isPackaged) {
    return { provider: "disabled", enabled: false, feedUrl: null };
  }

  if (updateGithubOwner && updateGithubRepo) {
    return {
      provider: "github",
      enabled: true,
      feedUrl: `https://github.com/${updateGithubOwner}/${updateGithubRepo}/releases`
    };
  }

  if (updateFeedUrl) {
    return { provider: "generic", enabled: true, feedUrl: updateFeedUrl };
  }

  return { provider: "disabled", enabled: false, feedUrl: null };
}

const resolvedUpdateProvider = resolveUpdateProvider();

const updateState: EstadoUpdateRuntime = {
  enabled: resolvedUpdateProvider.enabled,
  provider: resolvedUpdateProvider.provider,
  feedUrl: resolvedUpdateProvider.feedUrl,
  status: "disabled",
  currentVersion: app.getVersion(),
  latestVersion: null,
  downloadPercent: null,
  releaseNotes: [],
  lastCheckedAt: null,
  lastError: null
};

function emitUpdateState(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("update:status", { ...updateState });
}

function normalizeReleaseNotes(info: UpdateInfo): string[] {
  const source = info.releaseNotes;
  if (!source) return [];
  if (typeof source === "string") {
    return source
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 12);
  }

  return source
    .flatMap((item) => {
      const value = typeof item.note === "string" ? item.note : "";
      return value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    })
    .slice(0, 12);
}

function setUpdateState(patch: Partial<EstadoUpdateRuntime>): void {
  Object.assign(updateState, patch);
  emitUpdateState();
}

async function checkForAppUpdates(reason: "startup" | "manual" | "scheduled"): Promise<{ ok: boolean; message: string }> {
  if (!updateState.enabled) {
    return {
      ok: false,
      message: "Auto-actualizacion deshabilitada. Define CONTABILIDAD_UPDATE_URL para habilitarla."
    };
  }

  try {
    setUpdateState({
      status: "checking",
      lastCheckedAt: new Date().toISOString(),
      lastError: null,
      downloadPercent: null
    });
    await autoUpdater.checkForUpdates();
    return {
      ok: true,
      message: reason === "manual" ? "Buscando actualizaciones..." : "Verificacion de actualizaciones iniciada."
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Error desconocido al buscar actualizaciones.";
    setUpdateState({ status: "error", lastError: detail });
    return { ok: false, message: detail };
  }
}

function configureAutoUpdates(): void {
  const providerConfig = resolveUpdateProvider();
  const enabled = providerConfig.enabled;

  if (!enabled) {
    setUpdateState({
      enabled: false,
      provider: providerConfig.provider,
      feedUrl: providerConfig.feedUrl,
      status: "disabled",
      lastError: app.isPackaged
        ? "Define CONTABILIDAD_UPDATE_URL o CONTABILIDAD_GH_OWNER/CONTABILIDAD_GH_REPO para activar actualizaciones automaticas."
        : "Auto-actualizacion deshabilitada en desarrollo."
    });
    return;
  }

  if (updaterConfigured) return;
  updaterConfigured = true;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  if (providerConfig.provider === "github") {
    autoUpdater.setFeedURL({
      provider: "github",
      owner: updateGithubOwner!,
      repo: updateGithubRepo!
    });
  } else {
    autoUpdater.setFeedURL({ provider: "generic", url: providerConfig.feedUrl! });
  }

  setUpdateState({
    enabled: true,
    provider: providerConfig.provider,
    feedUrl: providerConfig.feedUrl,
    status: "idle",
    lastError: null
  });

  autoUpdater.on("checking-for-update", () => {
    setUpdateState({ status: "checking", lastCheckedAt: new Date().toISOString(), lastError: null });
  });

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    setUpdateState({
      status: "available",
      latestVersion: info.version ?? null,
      releaseNotes: normalizeReleaseNotes(info),
      downloadPercent: 0,
      lastError: null
    });
  });

  autoUpdater.on("update-not-available", () => {
    setUpdateState({
      status: "idle",
      latestVersion: app.getVersion(),
      releaseNotes: [],
      downloadPercent: null,
      lastError: null
    });
  });

  autoUpdater.on("download-progress", (progress: ProgressInfo) => {
    setUpdateState({ status: "downloading", downloadPercent: progress.percent });
  });

  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    setUpdateState({
      status: "downloaded",
      latestVersion: info.version ?? updateState.latestVersion,
      releaseNotes: normalizeReleaseNotes(info),
      downloadPercent: 100,
      lastError: null
    });
  });

  autoUpdater.on("error", (error: Error) => {
    setUpdateState({ status: "error", lastError: error.message });
  });

  void checkForAppUpdates("startup");
  updateInterval = setInterval(() => {
    void checkForAppUpdates("scheduled");
  }, 4 * 60 * 60 * 1000);
}

function getIndicadoresCachePath(): string {
  return path.join(app.getPath("userData"), INDICADORES_CACHE_FILE);
}

function readIndicadoresCacheFromDisk(): IndicadoresData | null {
  try {
    const cachePath = getIndicadoresCachePath();
    if (!fs.existsSync(cachePath)) return null;
    const raw = fs.readFileSync(cachePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<IndicadoresData>;
    if (typeof parsed.fecha !== "string" || typeof parsed.fuente !== "string") return null;
    return {
      dolar: typeof parsed.dolar === "number" ? parsed.dolar : null,
      euro: typeof parsed.euro === "number" ? parsed.euro : null,
      uf: typeof parsed.uf === "number" ? parsed.uf : null,
      utm: typeof parsed.utm === "number" ? parsed.utm : null,
      ipc: typeof parsed.ipc === "number" ? parsed.ipc : null,
      tpm: typeof parsed.tpm === "number" ? parsed.tpm : null,
      fecha: parsed.fecha,
      fuente: parsed.fuente
    };
  } catch {
    return null;
  }
}

function writeIndicadoresCacheToDisk(data: IndicadoresData): void {
  try {
    fs.writeFileSync(getIndicadoresCachePath(), JSON.stringify(data, null, 2), "utf8");
  } catch {
    // cache persistente opcional; si falla no debe romper la app
  }
}

function withEstado(data: IndicadoresData, estado: IndicadoresEstado): IndicadoresResponse {
  return { ...data, estado };
}

function requestJson(url: string): Promise<Record<string, { valor?: number; fecha?: string } | string>> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "Contabilidad-Desktop/0.1.0",
          Accept: "application/json"
        }
      },
      (res) => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode ?? "sin-codigo"}`));
          res.resume();
          return;
        }

        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(raw) as Record<string, { valor?: number; fecha?: string } | string>);
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error("Tiempo de espera agotado al consultar indicadores."));
    });
  });
}

function requestText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "Contabilidad-Desktop/0.1.0",
          Accept: "text/html,application/xhtml+xml"
        }
      },
      (res) => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode ?? "sin-codigo"}`));
          res.resume();
          return;
        }
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => resolve(raw));
      }
    );
    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error("Tiempo de espera agotado al consultar SII."));
    });
  });
}

function limpiarHtml(valor: string): string {
  return valor
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumeroCL(valor: string): number | null {
  const limpio = valor.replace(/\./g, "").replace(/,/g, ".").replace(/[^0-9.-]/g, "").trim();
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

function parseTableRows(html: string): string[][] {
  const rows: string[][] = [];
  const rowMatches = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  for (const rowMatch of rowMatches) {
    const rowHtml = rowMatch[1];
    const cells = Array.from(rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((m) => limpiarHtml(m[1]));
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

function getMesNombreActual(): string {
  return new Date().toLocaleDateString("es-CL", { month: "long" }).toLowerCase();
}

function extraerUtmIpcDesdeSii(html: string): { utm: number | null; ipc: number | null } {
  const mesActual = getMesNombreActual();
  const rows = parseTableRows(html);

  let utmMesActual: number | null = null;
  let utmUltimoDisponible: number | null = null;
  let ipcUltimoDisponible: number | null = null;

  for (const row of rows) {
    if (row.length < 4) continue;
    const mes = row[0].toLowerCase();
    const utm = parseNumeroCL(row[1]);
    const ipc = parseNumeroCL(row[3]);

    if (utm !== null) utmUltimoDisponible = utm;
    if (ipc !== null) ipcUltimoDisponible = ipc;

    if (mes.includes(mesActual) && utm !== null) {
      utmMesActual = utm;
    }
  }

  return {
    utm: utmMesActual ?? utmUltimoDisponible,
    ipc: ipcUltimoDisponible
  };
}

async function getSiiUtmIpc(): Promise<{ utm: number | null; ipc: number | null; fuente: string }> {
  const year = new Date().getFullYear();
  const years = [year, year - 1];

  for (const y of years) {
    try {
      const html = await requestText(`https://www.sii.cl/valores_y_fechas/utm/utm${y}.htm`);
      const parsed = extraerUtmIpcDesdeSii(html);
      if (parsed.utm !== null || parsed.ipc !== null) {
        return { ...parsed, fuente: `sii.cl/utm${y}` };
      }
    } catch {
      // Intenta el siguiente año candidato
    }
  }

  throw new Error("No fue posible obtener UTM/IPC desde SII.");
}

async function getIndicadoresEconomicos() {
  if (indicadoresCache && Date.now() - indicadoresCache.fetchedAt < INDICADORES_CACHE_MS) {
    return withEstado(indicadoresCache.data, "cache-memoria");
  }

  try {
    const [mindicadorResult, siiResult] = await Promise.allSettled([
      requestJson("https://mindicador.cl/api"),
      getSiiUtmIpc()
    ]);

    const json = mindicadorResult.status === "fulfilled" ? mindicadorResult.value : null;
    const sii = siiResult.status === "fulfilled" ? siiResult.value : null;

    const nowIso = new Date().toISOString();
    const fechaMindicador = json && typeof json.fecha === "string" ? json.fecha : null;
    const fecha = fechaMindicador ?? nowIso;

    if (!json && !sii) {
      throw new Error("No fue posible obtener indicadores desde fuentes externas.");
    }

    const data: IndicadoresData = {
      dolar: json && typeof json.dolar === "object" && typeof json.dolar?.valor === "number" ? json.dolar.valor : null,
      euro: json && typeof json.euro === "object" && typeof json.euro?.valor === "number" ? json.euro.valor : null,
      uf: json && typeof json.uf === "object" && typeof json.uf?.valor === "number" ? json.uf.valor : null,
      utm: sii?.utm ?? (json && typeof json.utm === "object" && typeof json.utm?.valor === "number" ? json.utm.valor : null),
      ipc: sii?.ipc ?? (json && typeof json.ipc === "object" && typeof json.ipc?.valor === "number" ? json.ipc.valor : null),
      tpm: json && typeof json.tpm === "object" && typeof json.tpm?.valor === "number" ? json.tpm.valor : null,
      fecha,
      fuente:
        sii && json
          ? "SII(UTM/IPC) + mindicador.cl"
          : sii
            ? `SII(${sii.fuente})`
            : "mindicador.cl"
    };

    indicadoresCache = {
      fetchedAt: Date.now(),
      data
    };
    writeIndicadoresCacheToDisk(data);

    return withEstado(data, "en-vivo");
  } catch {
    if (indicadoresCache) {
      return withEstado(indicadoresCache.data, "cache-memoria");
    }

    const diskData = readIndicadoresCacheFromDisk();
    if (diskData) {
      indicadoresCache = {
        fetchedAt: Date.now(),
        data: diskData
      };
      return withEstado(diskData, "cache-disco");
    }

    return withEstado(
      {
        dolar: null,
        euro: null,
        uf: null,
        utm: null,
        ipc: null,
        tpm: null,
        fecha: new Date().toISOString(),
        fuente: "sin-conexion"
      },
      "sin-conexion"
    );
  }
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  if (isDev) {
    window.loadURL("http://localhost:5173");
    window.webContents.openDevTools();
  } else {
    window.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow = window;
  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });
}

function getSoporteMantenimiento(): SoporteMantenimiento {
  return {
    appName: app.getName(),
    version: app.getVersion(),
    isPackaged: app.isPackaged,
    storageMode: getStorageMode(),
    userDataPath: app.getPath("userData"),
    databasePath: getDatabasePath(),
    fallbackPath: getFallbackPath(),
    autoUpdateEnabled: updateState.enabled,
    updateProvider: updateState.provider,
    updateFeedUrl: updateState.feedUrl
  };
}

async function crearRespaldoMantenimiento(): Promise<{ ok: boolean; filePath?: string; storageMode: "sqlite" | "fallback" }> {
  const storageMode = getStorageMode();
  const extension = storageMode === "sqlite" ? "db" : "json";
  const sourcePath = storageMode === "sqlite" ? getDatabasePath() : getFallbackPath();

  if (storageMode === "sqlite") {
    checkpointDatabase();
  }

  const result = await dialog.showSaveDialog({
    title: "Guardar respaldo contable",
    defaultPath: `contabilidad-backup-${new Date().toISOString().slice(0, 10)}.${extension}`,
    filters: [{ name: storageMode === "sqlite" ? "Base SQLite" : "JSON", extensions: [extension] }]
  });

  if (result.canceled || !result.filePath) {
    return { ok: false, storageMode };
  }

  if (!fs.existsSync(sourcePath)) {
    throw new Error("No existe un archivo de datos para respaldar todavia.");
  }

  fs.copyFileSync(sourcePath, result.filePath);
  return { ok: true, filePath: result.filePath, storageMode };
}

app.whenReady().then(() => {
  initializeDatabase();

  ipcMain.on("app:get-info-sync", (event) => {
    event.returnValue = getSoporteMantenimiento();
  });

  ipcMain.handle("empresa:list", () => {
    return listEmpresas();
  });

  ipcMain.handle("empresa:create", (_, input) => {
    return createEmpresa(input);
  });

  ipcMain.handle("empresa:delete", (_, id: number) => {
    deleteEmpresa(id);
    return { ok: true };
  });

  ipcMain.handle("empresa:update", (_, input) => {
    return updateEmpresa(input);
  });

  ipcMain.handle("empresa:get-activa", () => {
    return getEmpresaActivaId();
  });

  ipcMain.handle("empresa:set-activa", (_, id: number | null) => {
    return setEmpresaActiva(id);
  });

  ipcMain.handle("socio:list", (_, empresaId: number) => {
    return listSociosEmpresa(empresaId);
  });

  ipcMain.handle("socio:create", (_, input) => {
    return createSocioEmpresa(input);
  });

  ipcMain.handle("socio:update", (_, input) => {
    return updateSocioEmpresa(input);
  });

  ipcMain.handle("socio:delete", (_, id: number) => {
    return deleteSocioEmpresa(id);
  });

  ipcMain.handle("cuenta:list", (_, empresaId: number) => {
    return listCuentasContables(empresaId);
  });

  ipcMain.handle("cuenta:create", (_, input) => {
    return createCuentaContable(input);
  });

  ipcMain.handle("cuenta:update-nombre", (_, input) => {
    return updateNombreCuentaContable(input);
  });

  ipcMain.handle("cuenta:seed-chile", (_, empresaId: number) => {
    return seedPlanCuentasChile(empresaId);
  });

  ipcMain.handle("asiento:list", (_, empresaId: number) => {
    return listAsientos(empresaId);
  });

  ipcMain.handle("operacion:auto", (_, input) => {
    return registrarOperacionAutomatica(input);
  });

  ipcMain.handle("operacion:auto-texto", (_, input) => {
    return registrarOperacionDesdeTexto(input);
  });

  ipcMain.handle("operacion:interpretar", (_, input) => {
    return interpretarTextoOperacion(input);
  });

  ipcMain.handle("operacion:confirmar-texto", (_, input) => {
    return confirmarYRegistrarDesdeInterpretacion(input);
  });

  ipcMain.handle("auditoria:list", (_, empresaId: number) => {
    return listRegistrosAuditoria(empresaId);
  });

  ipcMain.handle("asiento:detalles", (_, asientoId: number) => {
    return getAsientoDetalles(asientoId);
  });

  ipcMain.handle("asiento:get-documento-editable", (_, asientoId: number) => {
    return getAsientoDocumentoEditable(asientoId);
  });

  ipcMain.handle("asiento:get-historial", (_, asientoId: number) => {
    return getHistorialCambiosAsiento(asientoId);
  });

  ipcMain.handle("asiento:update-documento", (_, input) => {
    return updateAsientoDocumento(input);
  });

  ipcMain.handle("libro:diario", (_, input: { empresaId: number; fechaDesde?: string; fechaHasta?: string }) => {
    return getLibroDiario(input.empresaId, input.fechaDesde, input.fechaHasta);
  });

  ipcMain.handle("libro:mayor", (_, input: { empresaId: number; cuentaId: number }) => {
    return getLibroMayor(input.empresaId, input.cuentaId);
  });

  ipcMain.handle("balance:comprobacion", (_, empresaId: number) => {
    return getBalanceComprobacion(empresaId);
  });

  ipcMain.handle("indicadores:economicos", async () => {
    return getIndicadoresEconomicos();
  });

  ipcMain.handle("app:create-backup", async () => {
    return crearRespaldoMantenimiento();
  });

  ipcMain.handle("app:open-data-folder", async () => {
    const error = await shell.openPath(app.getPath("userData"));
    return { ok: error.length === 0, error };
  });

  ipcMain.handle("app:update-state", () => {
    return { ...updateState };
  });

  ipcMain.handle("app:update-check", () => {
    return checkForAppUpdates("manual");
  });

  ipcMain.handle("app:update-install", () => {
    if (updateState.status !== "downloaded") {
      return { ok: false, message: "Aun no hay una actualizacion descargada para instalar." };
    }

    setTimeout(() => {
      autoUpdater.quitAndInstall();
    }, 500);

    return { ok: true, message: "Instalando actualizacion. La aplicacion se reiniciara." };
  });

  ipcMain.handle("exportar:csv-libro-diario", async (_, input: { empresaId: number; fechaDesde?: string; fechaHasta?: string }) => {
    const csv = generarLibroDiarioCSV(input.empresaId, input.fechaDesde, input.fechaHasta);
    const result = await dialog.showSaveDialog({
      title: "Guardar Libro Diario",
      defaultPath: `libro-diario-${new Date().toISOString().slice(0, 10)}.csv`,
      filters: [{ name: "CSV", extensions: ["csv"] }]
    });
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, "\uFEFF" + csv, "utf8");
      return { ok: true, filePath: result.filePath };
    }
    return { ok: false };
  });

  ipcMain.handle("exportar:csv-balance", async (_, empresaId: number) => {
    const csv = generarBalanceComprobacionCSV(empresaId);
    const result = await dialog.showSaveDialog({
      title: "Guardar Balance de Comprobacion",
      defaultPath: `balance-comprobacion-${new Date().toISOString().slice(0, 10)}.csv`,
      filters: [{ name: "CSV", extensions: ["csv"] }]
    });
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, "\uFEFF" + csv, "utf8");
      return { ok: true, filePath: result.filePath };
    }
    return { ok: false };
  });

  createWindow();
  configureAutoUpdates();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }
    app.quit();
  }
});
