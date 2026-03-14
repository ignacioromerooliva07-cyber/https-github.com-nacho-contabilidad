import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import https from "node:https";
import os from "node:os";
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
  currentUser: string;
  creatorMode: boolean;
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
  | "installing"
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

type CopilotChatRole = "user" | "assistant";

type CopilotChatMessage = {
  role: CopilotChatRole;
  content: string;
};

type CopilotAskInput = {
  message: string;
  empresaId?: number | null;
  history?: CopilotChatMessage[];
};

type CopilotAskResult = {
  answer: string;
  suggestedActions: string[];
  confidence: "alta" | "media";
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
const currentUser = (process.env.USERNAME ?? os.userInfo().username ?? "").trim();
const creatorMode = ["nacho"].includes(currentUser.toLowerCase());

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
      message: reason === "manual"
        ? "Buscando actualizaciones. Si hay una nueva version, la app la descargara y la aplicara automaticamente tras una cuenta regresiva corta."
        : "Verificacion de actualizaciones iniciada."
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

function formatCopilotMoney(value: number): string {
  return value.toLocaleString("es-CL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

async function buildCopilotHealthCheck(empresaId: number): Promise<string> {
  const empresas = listEmpresas();
  const empresa = empresas.find((item) => item.id === empresaId);
  if (!empresa) {
    return "No encuentro la empresa activa. Selecciona una empresa y vuelve a intentar el chequeo.";
  }

  const asientos = listAsientos(empresaId);
  const auditoria = listRegistrosAuditoria(empresaId);
  const balance = getBalanceComprobacion(empresaId);
  const socios = listSociosEmpresa(empresaId);

  const totalDebe = asientos.reduce((sum, asiento) => sum + asiento.total_debe, 0);
  const totalHaber = asientos.reduce((sum, asiento) => sum + asiento.total_haber, 0);
  const descuadre = Math.abs(totalDebe - totalHaber);

  const docsCorrectos = auditoria.filter(
    (item) => item.tipo_documento !== "SIN_DOCUMENTO" && item.tipo_documento !== "DESCONOCIDO"
  ).length;
  const totalAuditables = auditoria.length;
  const porcentajeDocumentado = totalAuditables === 0 ? 100 : (docsCorrectos / totalAuditables) * 100;
  const pendientesDocumento = auditoria.filter(
    (item) => item.tipo_documento === "SIN_DOCUMENTO" || item.tipo_documento === "DESCONOCIDO"
  ).length;

  const totalParticipacion = socios.reduce((sum, socio) => sum + socio.participacion, 0);
  const diferenciaSocios = Math.abs(totalParticipacion - 100);

  const saldoDeudorTotal = balance.reduce((sum, row) => sum + row.saldoDeudor, 0);
  const saldoAcreedorTotal = balance.reduce((sum, row) => sum + row.saldoAcreedor, 0);
  const diferenciaBalance = Math.abs(saldoDeudorTotal - saldoAcreedorTotal);

  const semaforo =
    descuadre <= 1 && diferenciaBalance <= 1 && porcentajeDocumentado >= 90 && diferenciaSocios <= 0.5
      ? "OK"
      : porcentajeDocumentado >= 70 && descuadre <= 50
        ? "AVISO"
        : "CRITICO";

  return [
    `Diagnostico Copilot IA para ${empresa.nombre} (${empresa.rut ?? "RUT no informado"})`,
    `Semaforo general: ${semaforo}`,
    `- Asientos: ${asientos.length} registro(s). Descuadre acumulado Debe/Haber: $${formatCopilotMoney(descuadre)}.`,
    `- Balance: diferencia de saldos deudor/acreedor: $${formatCopilotMoney(diferenciaBalance)}.`,
    `- Soporte documental: ${porcentajeDocumentado.toFixed(1)}% documentado (${pendientesDocumento} pendiente/s).`,
    `- Socios: ${socios.length} registro(s), participacion total ${totalParticipacion.toFixed(2)}%.`,
    "",
    "Recomendaciones inmediatas:",
    descuadre > 1 ? "1) Revisar asientos con diferencia Debe/Haber antes de cerrar periodo." : "1) Partida doble dentro de rango aceptable.",
    porcentajeDocumentado < 90
      ? "2) Completar tipo de documento en operaciones SIN_DOCUMENTO o DESCONOCIDO para reducir riesgo tributario."
      : "2) Cobertura documental saludable para fiscalizacion.",
    diferenciaSocios > 0.5
      ? "3) Ajustar participaciones de socios para que el total sea 100%."
      : "3) Participacion societaria consistente."
  ].join("\n");
}

function buildCopilotContext(empresaId: number | null): {
  hasEmpresa: boolean;
  empresaNombre: string;
  asientos: number;
  auditoria: number;
  cuentas: number;
  socios: number;
  etapa: "sin-empresa" | "sin-datos" | "en-carga" | "con-control";
} {
  if (typeof empresaId !== "number") {
    return {
      hasEmpresa: false,
      empresaNombre: "",
      asientos: 0,
      auditoria: 0,
      cuentas: 0,
      socios: 0,
      etapa: "sin-empresa"
    };
  }

  const empresas = listEmpresas();
  const empresa = empresas.find((item) => item.id === empresaId);
  const asientos = listAsientos(empresaId).length;
  const auditoria = listRegistrosAuditoria(empresaId).length;
  const cuentas = listCuentasContables(empresaId).length;
  const socios = listSociosEmpresa(empresaId).length;

  let etapa: "sin-empresa" | "sin-datos" | "en-carga" | "con-control" = "sin-datos";
  if (asientos === 0 && auditoria === 0) {
    etapa = "sin-datos";
  } else if (asientos > 0 && auditoria < 15) {
    etapa = "en-carga";
  } else {
    etapa = "con-control";
  }

  return {
    hasEmpresa: true,
    empresaNombre: empresa?.nombre ?? "Empresa activa",
    asientos,
    auditoria,
    cuentas,
    socios,
    etapa
  };
}

async function askCopilotIa(input: CopilotAskInput): Promise<CopilotAskResult> {
  const questionRaw = input.message ?? "";
  const question = questionRaw.trim();
  if (!question) {
    return {
      answer: "Escribe tu consulta y te respondo con criterio contable, NIIF y tributario chileno.",
      suggestedActions: ["Pregunta por IVA, depreciacion de activos, inmobiliaria SII o cierre mensual."],
      confidence: "alta"
    };
  }

  const lower = question.toLowerCase();
  const empresaId = typeof input.empresaId === "number" ? input.empresaId : getEmpresaActivaId();
  const contexto = buildCopilotContext(empresaId);

  if (/^(hola|buenas|buen dia|buen día|hello|holi|que tal|cómo estás|como estas)/.test(lower)) {
    return {
      answer: [
        `Hola. Soy Copilot IA y te acompaño como apoyo contable dentro de ${contexto.hasEmpresa ? contexto.empresaNombre : "la app"}.`,
        contexto.hasEmpresa
          ? `Ahora mismo veo ${contexto.asientos} asiento(s) y ${contexto.auditoria} registro(s) de auditoría.`
          : "Cuando selecciones una empresa, podré responder con contexto real.",
        "Si quieres, puedo revisar un caso puntual, ayudarte a registrar un asiento o revisar si todo se ve consistente."
      ].join("\n"),
      suggestedActions: ["Revisar si todo está correcto", "Consultar depreciacion o inmobiliaria SII"],
      confidence: "alta"
    };
  }

  if (!contexto.hasEmpresa) {
    return {
      answer: [
        "Antes de recomendarte acciones, necesito contexto de una empresa activa.",
        "Selecciona una empresa en Principal y vuelve a preguntar.",
        "Asi las recomendaciones se basan en tus datos reales y no en supuestos."
      ].join("\n"),
      suggestedActions: ["Seleccionar empresa activa", "Cargar plan base Chile"],
      confidence: "alta"
    };
  }

  if (contexto.etapa === "sin-datos" && !/(niif|ifrs|iva|f29|f22|factura|boleta|honorario|depreci|activo fijo|vida util|inmobili|arriendo|bienes raices|sii)/.test(lower)) {
    return {
      answer: [
        `Todavia no hay registros suficientes en ${contexto.empresaNombre} para un diagnostico profundo.`,
        "No te voy a recomendar controles avanzados sin datos reales.",
        "Primero registra operaciones y luego te doy una verificacion completa con hallazgos concretos."
      ].join("\n"),
      suggestedActions: [
        "Registrar primera operacion desde texto libre",
        "Cargar plan base Chile si aun no existe",
        "Volver a ejecutar 'Verificar todo'"
      ],
      confidence: "alta"
    };
  }

  const wantsCheck = /(verifica|verificar|revisa|revisar|chequea|chequear|todo bien|salud contable|diagnostico)/.test(lower);
  if (wantsCheck && empresaId) {
    const health = await buildCopilotHealthCheck(empresaId);
    return {
      answer: `${health}\n\nContexto actual: ${contexto.asientos} asiento(s), ${contexto.auditoria} registro(s) de auditoria, ${contexto.cuentas} cuenta(s), ${contexto.socios} socio(s).\n\nNota: este analisis es de apoyo operativo y no reemplaza asesoria legal/tributaria formal.`,
      suggestedActions: [
        contexto.auditoria > 0
          ? "Abre Auditoria para corregir documentos pendientes."
          : "Aun no hay auditoria suficiente; registra operaciones para activar controles.",
        contexto.asientos > 0
          ? "Valida Balance y Libro Diario antes de declarar."
          : "Registra asientos iniciales para evaluar cuadratura y cierre.",
        "Genera un respaldo antes de aplicar ajustes."
      ],
      confidence: "alta"
    };
  }

  if (empresaId && /(venta|vendi|vendio|compra|compre|compro|gasto|pague|pague|honorario|capital inicial|aporte)/.test(lower)) {
    try {
      const interpretacion = interpretarTextoOperacion({
        empresaId,
        fecha: new Date().toISOString().slice(0, 10),
        texto: question
      });

      const docLabel = {
        FACTURA: "factura afecta",
        FACTURA_EXENTA: "factura exenta",
        BOLETA: "boleta afecta",
        BOLETA_EXENTA: "boleta exenta",
        BOLETA_HONORARIOS: "boleta de honorarios",
        SIN_DOCUMENTO: "sin documento",
        DESCONOCIDO: "documento por confirmar"
      }[interpretacion.interpretacion.tipoDocumento];

      const base = [
        `Te lo explico como lo registraría: detecté una operación de tipo ${interpretacion.interpretacion.categoriaOperacion.replace(/_/g, " ").toLowerCase()}.`,
        `Documento estimado: ${docLabel}.`,
        `Monto total: $${interpretacion.interpretacion.montoTotal.toLocaleString("es-CL")}.`,
        `Tratamiento: ${interpretacion.interpretacion.resumenTributario}`
      ];

      if (interpretacion.interpretacion.componentesCapital?.length) {
        base.push(
          `Además detecté ${interpretacion.interpretacion.componentesCapital.length} componente(s) de capital inicial, así que no lo dejaría todo mezclado en una sola línea.`
        );
      }

      if (interpretacion.necesitaConfirmacion) {
        base.push(`Antes de registrarlo, te preguntaría esto: ${interpretacion.pregunta}`);
      }

      return {
        answer: base.join("\n"),
        suggestedActions: [
          interpretacion.necesitaConfirmacion ? "Confirmar el documento tributario" : "Registrar la operación con esa lógica",
          "Revisar el asiento propuesto"
        ],
        confidence: "alta"
      };
    } catch {
      // Si no se logra interpretar bien, caemos a respuesta general más abajo.
    }
  }

  // ── Checklist de cierre mensual ──────────────────────────────────────────
  if (/(checklist|lista de cierre|plan de cierre|cierre mensual|cierre del mes|paso a paso.*cierre|pasos.*cierre|cerrar.*mes)/.test(lower)) {
    const pasos = [
      "1. Asegúrate de que todos los comprobantes y documentos del período estén ingresados.",
      "2. Cuadra Débito Fiscal vs. Crédito Fiscal del IVA: el saldo es lo que se declara o recupera.",
      "3. Verifica que Debe = Haber en cada asiento (cuadratura total del período).",
      "4. Concilia saldo bancario con libro de caja/banco usando el extracto del mes.",
      "5. Provisiona remuneraciones, vacaciones y cotizaciones pendientes si corresponde.",
      "6. Revisa cuentas por cobrar y pagar: saldos negativos raros indican asientos mal ingresados.",
      "7. Deprecia activos fijos en uso (método lineal o el que definiste al activarlos).",
      "8. Genera Balance de Comprobación desde la app y verifica cuadratura total.",
      "9. Revisa la Auditoría interna: corrige documentos observados antes de declarar.",
      "10. Respalda la base de datos y exporta o imprime los estados del período."
    ];

    const notas: string[] = [];
    if (contexto.asientos === 0) {
      notas.push("Nota: aún no hay asientos registrados en este período. El checklist aplica cuando hay movimientos reales.");
    } else {
      notas.push(`En ${contexto.empresaNombre} veo ${contexto.asientos} asiento(s) y ${contexto.cuentas} cuenta(s) activas. Ese es el universo de este cierre.`);
    }
    if (contexto.auditoria > 0) {
      notas.push(`Hay ${contexto.auditoria} registro(s) pendiente(s) en Auditoría — no cierres sin resolver el paso 9.`);
    }

    return {
      answer: [
        `Checklist de cierre mensual — ${contexto.empresaNombre}:`,
        "",
        ...pasos,
        "",
        notas.join("\n"),
        "",
        "Tip docente: hacer el cierre en orden, sin saltarse pasos aunque el mes sea pequeño, es exactamente lo que te exige cualquier auditor externo en una revisión real."
      ].join("\n"),
      suggestedActions: [
        "Revisar Auditoría ahora",
        "Ver Balance de Comprobación",
        "Explicarme el paso 7 (depreciación)"
      ],
      confidence: "alta"
    };
  }

  // ── Balance General / análisis patrimonial ───────────────────────────────
  if (/(balance general|situacion financiera|activo corriente|activo fijo|pasivo corriente|patrimonio neto|ecuacion contable|activo.*pasivo|pasivo.*patrimonio)/.test(lower)) {
    const lineas = [
      "El Balance General (o Estado de Situación Financiera en NIIF) muestra la foto del negocio en un momento:",
      "  Activo = Pasivo + Patrimonio  →  esta ecuación siempre debe cuadrar.",
      "",
      "Activo Corriente: caja, banco, clientes a cobrar (se espera cobrar en menos de 12 meses).",
      "Activo No Corriente: activos fijos, intangibles, inversiones de largo plazo.",
      "Pasivo Corriente: proveedores, IVA por pagar, deudas a menos de 12 meses.",
      "Pasivo No Corriente: préstamos de largo plazo, leasing.",
      "Patrimonio: capital + utilidades retenidas ± resultados del ejercicio.",
      "",
      "Si el Balance no cuadra: revisa asientos mal categorizados o cuentas sin contrapartida."
    ];

    if (contexto.asientos > 0) {
      lineas.push(`\nEn ${contexto.empresaNombre} hay ${contexto.asientos} asiento(s) registrados. Revisa la pestaña Balance para ver la estructura actual.`);
    } else {
      lineas.push("\nAún no hay asientos para generar un balance. Registra operaciones y el balance se construye solo.");
    }

    return {
      answer: lineas.join("\n"),
      suggestedActions: [
        "Ver Balance en la app",
        "Pedir checklist de cierre",
        "Explicar Activo Corriente con ejemplos"
      ],
      confidence: "alta"
    };
  }

  if (/(niif|ifrs|norma internacional|estado financiero)/.test(lower)) {
    return {
      answer: [
        "Guía NIIF (resumen práctico para PYMES Chile):",
        "- NIIF para PYMES: políticas contables consistentes, revelaciones claras y evidencia de estimaciones.",
        "- Devengo: reconoce ingresos y gastos cuando ocurren, no solo cuando se pagan/cobran.",
        "- Materialidad: prioriza partidas con impacto real en la decisión del usuario de los estados financieros.",
        "- Presentación mínima: Balance, Estado de Resultados y notas con trazabilidad documental.",
        "",
        "Tip docente: el criterio de devengo es el que más lleva a errores en primer año. Si tienes dudas de cuándo reconocer un ingreso o gasto, pregúntame con el caso concreto.",
        "",
        "¿Quieres que esto lo traduzca a un checklist de cierre mensual para tu empresa activa?"
      ].join("\n"),
      suggestedActions: ["Pedir checklist de cierre mensual", "Consultar devengo con un ejemplo"],
      confidence: "media"
    };
  }

  if (/(iva|f29|debito fiscal|credito fiscal|boleta|factura|honorario|retencion)/.test(lower)) {
    return {
      answer: [
        "Resumen tributario Chile (orientativo):",
        "- F29: Débito Fiscal (ventas afectas) − Crédito Fiscal (compras con factura válida) = IVA a pagar o recuperar.",
        "- Factura afecta: genera IVA de 19% en el asiento.",
        "- Factura/boleta exenta: no genera débito de IVA; va directo al ingreso.",
        "- Boleta de honorarios: implica retención y se declara por separado del IVA.",
        "- Sin documento: la operación queda sin respaldo válido → riesgo de observación en fiscalización.",
        "",
        "Tip docente: el error más frecuente es mezclar crédito fiscal de compras sin factura. SII no acepta IVA sin respaldo físico o electrónico válido.",
        "",
        "Si me das el caso concreto (monto, tipo de documento, medio de pago), te propongo el asiento y te digo cómo impacta el F29."
      ].join("\n"),
      suggestedActions: [
        "Pedir asiento propuesto con caso concreto",
        "Pedir checklist de cierre tributario",
        "Explicar Débito vs. Crédito Fiscal"
      ],
      confidence: "media"
    };
  }

  if (/(asiento|debe|haber|partida doble|libro diario|libro mayor)/.test(lower)) {
    return {
      answer: [
        "Criterio contable operativo:",
        "- Todo asiento debe cuadrar: Debe = Haber (sin excepción).",
        "- Libro Diario: registra la cronología de operaciones.",
        "- Libro Mayor: concentra movimientos por cuenta; desde ahí se construye el Balance.",
        "- Partida doble: cada operación afecta al menos dos cuentas en sentidos opuestos.",
        "",
        contexto.asientos > 0
          ? `En ${contexto.empresaNombre} ya tienes ${contexto.asientos} asiento(s). Si quieres, reviso si la estructura general tiene algún descuadre o cuenta fuera de lugar.`
          : "Aún no hay asientos. Puedo guiarte con el primer registro o con un caso completo de capital inicial."
      ].join("\n"),
      suggestedActions: contexto.asientos > 0
        ? ["Revisar si todo está correcto", "Pedir checklist de cierre"]
        : ["Registrar primer asiento", "Ver ejemplo de capital inicial"],
      confidence: "alta"
    };
  }

  if (/(depreci|depreciacion|depreciación|activo fijo|vida util|vida útil|valor residual|lineal|amortizacion|amortización)/.test(lower)) {
    return {
      answer: [
        "Guía práctica de depreciación (enfoque PYME Chile):",
        "- Base depreciable = costo del activo − valor residual estimado.",
        "- Método lineal mensual: depreciación mensual = base depreciable / vida útil en meses.",
        "- Reconocimiento: gasto por depreciación (resultado) contra depreciación acumulada (activo contra-cuenta).",
        "- Inicia cuando el activo está disponible para su uso, no necesariamente cuando se paga.",
        "",
        "Asiento tipo mensual:",
        "  Debe: Gasto Depreciación",
        "  Haber: Depreciación Acumulada",
        "",
        "Tip docente: separa contablemente terreno y construcción. Normalmente el terreno no se deprecia; la construcción sí, según vida útil técnica y política contable.",
        "",
        "Fuentes para validar criterio vigente: normativa SII aplicable al régimen tributario + política contable NIIF para PYMES documentada por la empresa."
      ].join("\n"),
      suggestedActions: [
        "Crear plantilla de activos fijos",
        "Mostrar ejemplo numérico de depreciación mensual",
        "Explicar diferencia entre depreciación contable y tributaria"
      ],
      confidence: "alta"
    };
  }

  if (/(inmobili|arriendo|inmueble|bienes raices|bienes raíces|dfl-?2|contribuciones|portal inmobiliario|sii inmobiliaria)/.test(lower)) {
    return {
      answer: [
        "Marco base para actividad inmobiliaria en Chile (resumen operativo):",
        "- Distingue venta, arriendo exento, arriendo afecto y servicios complementarios: no todo tiene el mismo tratamiento en IVA/F29.",
        "- Para control interno, separa por proyecto o inmueble: ingresos, costos directos, gastos comunes, contribuciones y mantención.",
        "- Terreno y construcción deben gestionarse por separado para depreciación y presentación financiera.",
        "- Mantén respaldo documental estricto (contratos, facturas, boletas, roles, comprobantes de contribuciones y gastos de administración).",
        "",
        "Ruta recomendada de fuentes para mantener la app al día:",
        "1) Portal oficial del SII (normativa y circulares vigentes).",
        "2) Publicaciones técnicas de contadores/chile (análisis práctico).",
        "3) Diario Financiero para contexto económico y cambios del mercado inmobiliario.",
        "",
        "Si quieres, te armo un checklist inmobiliario mensual (IVA, contratos, contribuciones, depreciación, respaldo) para usar dentro de la empresa activa."
      ].join("\n"),
      suggestedActions: [
        "Pedir checklist inmobiliario mensual",
        "Explicar IVA en arriendo inmobiliario",
        "Definir estructura contable por inmueble"
      ],
      confidence: "media"
    };
  }

  return {
    answer: [
      "Puedo conversar contigo de forma más libre, no solo por parámetros cerrados.",
      "Si me cuentas el caso como se lo contarías a una contadora, intento interpretarlo con tu contexto real.",
      "Si el caso trae monto, documento y medio de pago, además te puedo adelantar cómo quedaría el asiento y qué riesgo tributario veo."
    ].join("\n"),
    suggestedActions: ["Revisar si todo esta correcto", "Consultar depreciacion", "Consultar inmobiliaria SII"],
    confidence: "media"
  };
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
    currentUser,
    creatorMode,
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

    setUpdateState({ status: "installing", lastError: null, downloadPercent: 100 });

    setTimeout(() => {
      autoUpdater.quitAndInstall(true, true);
    }, 500);

    return { ok: true, message: "Aplicando actualizacion. La aplicacion se cerrara y volvera a abrir automaticamente." };
  });

  ipcMain.handle("copilot:ask", async (_, input: CopilotAskInput) => {
    return askCopilotIa(input);
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
