import { app } from "electron";
import path from "node:path";
import fs from "node:fs";
import {
  calcularDesgloseMontos,
  detectarCategoriaOperacion,
  detectarDocumentoTributario,
  detectarModoIva,
  detectarTipoOperacionExtendida,
  documentoAplicaIva,
  extraerMontoDesdeTexto,
  normalizarTextoOperacion,
  tipoOperacionAplicaIva,
  giroAplicaIvaEnVentas,
  operacionEsTipicaDelGiro,
  type CategoriaOperacion,
  type ModoIva,
  type TipoDocumentoTributario,
  type TipoOperacionExtendida,
  type GiroEmpresa
} from "./tributario";
export type { CategoriaOperacion, ModoIva, TipoDocumentoTributario, TipoOperacionExtendida, GiroEmpresa } from "./tributario";

type SqliteDatabase = {
  pragma: (sql: string) => void;
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    all: (...params: unknown[]) => unknown[];
    get: (...params: unknown[]) => unknown;
    run: (...params: unknown[]) => { lastInsertRowid?: number | bigint };
  };
};

let db: SqliteDatabase | null = null;
let sqliteUnavailable = false;

type EmpresaStorage = EmpresaRecord[];
let fallbackEmpresas: EmpresaStorage = [];
let fallbackLastId = 0;
let fallbackEmpresaActivaId: number | null = null;

type CuentaStorage = CuentaContableRecord[];
let fallbackCuentas: CuentaStorage = [];
let fallbackLastCuentaId = 0;

type AsientoStorage = AsientoRecord[];
let fallbackAsientos: AsientoStorage = [];
let fallbackLastAsientoId = 0;

type AsientoDetalleStorage = AsientoDetalleRecord[];
let fallbackAsientoDetalles: AsientoDetalleStorage = [];
let fallbackLastAsientoDetalleId = 0;

type EventoTributarioStorage = EventoTributarioRecord[];
let fallbackEventosTributarios: EventoTributarioStorage = [];
let fallbackLastEventoTributarioId = 0;

type AuditoriaStorage = RegistroInterpretacionRecord[];
let fallbackAuditoria: AuditoriaStorage = [];
let fallbackLastAuditoriaId = 0;

type SocioStorage = SocioRecord[];
let fallbackSocios: SocioStorage = [];
let fallbackLastSocioId = 0;

export interface EmpresaRecord {
  id: number;
  nombre: string;
  rut: string | null;
  moneda: string;
  giro: string | null;
  created_at: string;
}

export interface CuentaContableRecord {
  id: number;
  empresa_id: number;
  codigo: string;
  nombre: string;
  tipo: string;
  naturaleza: string;
  activa: number;
}

export interface AsientoDetalleInput {
  cuentaId: number;
  debe: number;
  haber: number;
  detalle?: string;
}

export interface AsientoRecord {
  id: number;
  empresa_id: number;
  fecha: string;
  descripcion: string;
  referencia: string | null;
  total_debe: number;
  total_haber: number;
  created_at: string;
  revision_count?: number;
}

export interface AsientoDetalleRecord {
  id: number;
  asiento_id: number;
  cuenta_id: number;
  debe: number;
  haber: number;
  detalle: string | null;
}

export interface EventoTributarioRecord {
  id: number;
  empresa_id: number;
  fecha: string;
  tipo: string;
  base_imponible: number;
  tasa: number;
  impuesto: number;
  descripcion: string;
  created_at: string;
}

export interface RegistroInterpretacionRecord {
  id: number;
  empresa_id: number;
  fecha_registro: string;
  fecha_operacion: string;
  texto_original: string;
  categoria_operacion: string;
  tipo_documento: string;
  modo_iva: string;
  monto_base: number;
  monto_neto: number;
  monto_iva: number;
  monto_total: number;
  asiento_id: number | null;
  created_at: string;
}

export interface SocioRecord {
  id: number;
  empresa_id: number;
  nombre: string;
  aporte_inicial: number;
  participacion: number;
  created_at: string;
}

export interface AsientoDocumentoEditable {
  asientoId: number;
  fecha: string;
  descripcion: string;
  textoOriginal: string;
  categoriaOperacion: string;
  tipoDocumentoActual: string;
  opcionesDocumento: Array<{ valor: TipoDocumentoTributario; etiqueta: string; descripcion: string }>;
}

export interface AsientoHistorialCambio {
  id: number;
  fecha_registro: string;
  fecha_operacion: string;
  tipo_documento: string;
  modo_iva: string;
  monto_total: number;
  created_at: string;
}

export interface AsientoDetalleConCuenta {
  id: number;
  asiento_id: number;
  cuenta_id: number;
  cuenta_codigo: string;
  cuenta_nombre: string;
  debe: number;
  haber: number;
  detalle: string | null;
}

export interface FilaLibroDiario {
  asientoId: number;
  fecha: string;
  descripcion: string;
  referencia: string | null;
  lineas: AsientoDetalleConCuenta[];
}

export interface FilaLibroMayor {
  asientoId: number;
  fecha: string;
  descripcion: string;
  debe: number;
  haber: number;
  saldo: number;
  detalle: string | null;
}

export interface FilaBalanceComprobacion {
  cuentaId: number;
  codigo: string;
  nombre: string;
  tipo: string;
  naturaleza: string;
  totalDebe: number;
  totalHaber: number;
  saldoDeudor: number;
  saldoAcreedor: number;
}

export interface OperacionAutomaticaInput {
  empresaId: number;
  fecha: string;
  tipo: "COMPRA_MERCADERIAS" | "VENTA_MERCADERIAS" | "GASTO_SERVICIOS";
  montoTotal: number;
  incluyeIva: boolean;
  medioPago: "CAJA" | "BANCO" | "PROVEEDOR" | "CLIENTE";
  descripcion?: string;
}



export interface InterpretacionTexto {
  tipoOperacion: TipoOperacionExtendida;
  categoriaOperacion: CategoriaOperacion;
  tipoDocumento: TipoDocumentoTributario;
  modoIva: ModoIva;
  montoBase: number;
  montoNeto: number;
  montoIva: number;
  montoTotal: number;
  medioPago: "CAJA" | "BANCO" | "PROVEEDOR" | "CLIENTE";
  textoOriginal: string;
  aplicaIva: boolean;
  resumenTributario: string;
}

export interface ResultadoInterpretacion {
  empresaId: number;
  fecha: string;
  interpretacion: InterpretacionTexto;
  necesitaConfirmacion: boolean;
  pregunta: string;
  opcionesDocumento: Array<{ valor: TipoDocumentoTributario; etiqueta: string; descripcion: string }>;
}

export interface OperacionDesdeTextoInput {
  empresaId: number;
  fecha: string;
  texto: string;
  asumirIvaSiNoSeIndica?: boolean;
}

export interface OperacionTextoResultado {
  asiento: AsientoRecord;
  interpretacion: {
    tipo: "COMPRA_MERCADERIAS" | "VENTA_MERCADERIAS" | "GASTO_SERVICIOS";
    montoTotal: number;
    incluyeIva: boolean;
    medioPago: "CAJA" | "BANCO" | "PROVEEDOR" | "CLIENTE";
    textoNormalizado: string;
  };
}

const PLAN_BASE_CHILE: Array<{
  codigo: string;
  nombre: string;
  tipo: string;
  naturaleza: string;
}> = [
  { codigo: "1.1.1.01", nombre: "Caja", tipo: "ACTIVO", naturaleza: "DEUDORA" },
  { codigo: "1.1.1.02", nombre: "Banco Estado", tipo: "ACTIVO", naturaleza: "DEUDORA" },
  { codigo: "1.1.2.01", nombre: "Clientes", tipo: "ACTIVO", naturaleza: "DEUDORA" },
  { codigo: "1.1.3.01", nombre: "Inventario", tipo: "ACTIVO", naturaleza: "DEUDORA" },
  { codigo: "2.1.1.01", nombre: "Proveedores", tipo: "PASIVO", naturaleza: "ACREEDORA" },
  { codigo: "2.1.2.01", nombre: "IVA Debito Fiscal", tipo: "PASIVO", naturaleza: "ACREEDORA" },
  { codigo: "2.1.2.02", nombre: "IVA Credito Fiscal", tipo: "ACTIVO", naturaleza: "DEUDORA" },
  { codigo: "3.1.1.01", nombre: "Capital", tipo: "PATRIMONIO", naturaleza: "ACREEDORA" },
  { codigo: "4.1.1.01", nombre: "Ingresos por Ventas", tipo: "INGRESO", naturaleza: "ACREEDORA" },
  { codigo: "4.1.2.01", nombre: "Ingresos por Servicios", tipo: "INGRESO", naturaleza: "ACREEDORA" },
  { codigo: "5.1.1.01", nombre: "Gastos Administrativos", tipo: "GASTO", naturaleza: "DEUDORA" },
  { codigo: "5.1.1.02", nombre: "Honorarios Pagados", tipo: "GASTO", naturaleza: "DEUDORA" },
  { codigo: "5.1.1.03", nombre: "Sueldos y Salarios", tipo: "GASTO", naturaleza: "DEUDORA" },
  { codigo: "5.1.2.01", nombre: "Gastos de Arriendo", tipo: "GASTO", naturaleza: "DEUDORA" },
  { codigo: "5.1.2.02", nombre: "Gastos de Servicios Basicos", tipo: "GASTO", naturaleza: "DEUDORA" },
  { codigo: "2.1.2.03", nombre: "Retencion de Honorarios por Pagar", tipo: "PASIVO", naturaleza: "ACREEDORA" }
];

export function getDatabasePath(): string {
  const dataDir = app.getPath("userData");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, "contabilidad.db");
}

export function getFallbackPath(): string {
  return path.join(app.getPath("userData"), "contabilidad-fallback.json");
}

export function getStorageMode(): "sqlite" | "fallback" {
  return sqliteUnavailable || !db ? "fallback" : "sqlite";
}

export function checkpointDatabase(): void {
  if (sqliteUnavailable || !db) return;
  db.pragma("wal_checkpoint(TRUNCATE)");
}

function loadFallback(): void {
  const fallbackPath = getFallbackPath();
  if (!fs.existsSync(fallbackPath)) {
    fallbackEmpresas = [];
    fallbackLastId = 0;
    return;
  }

  try {
    const raw = fs.readFileSync(fallbackPath, "utf8");
    const data = JSON.parse(raw) as {
      empresas?: Array<EmpresaRecord & { cuit?: string | null }>;
      empresaActivaId?: number | null;
      cuentas?: CuentaContableRecord[];
      asientos?: AsientoRecord[];
      asientoDetalles?: AsientoDetalleRecord[];
      eventosTributarios?: EventoTributarioRecord[];
      auditoria?: RegistroInterpretacionRecord[];
      socios?: SocioRecord[];
    };

    const empresas = Array.isArray(data.empresas) ? data.empresas : [];
    fallbackEmpresas = empresas.map((item) => ({
      id: item.id,
      nombre: item.nombre,
      rut: item.rut ?? item.cuit ?? null,
      moneda: item.moneda ?? "CLP",
      giro: item.giro ?? null,
      created_at: item.created_at
    }));

    fallbackEmpresaActivaId = typeof data.empresaActivaId === "number" ? data.empresaActivaId : null;
    fallbackCuentas = Array.isArray(data.cuentas) ? data.cuentas : [];
    fallbackAsientos = Array.isArray(data.asientos) ? data.asientos : [];
    fallbackAsientoDetalles = Array.isArray(data.asientoDetalles) ? data.asientoDetalles : [];
    fallbackEventosTributarios = Array.isArray(data.eventosTributarios) ? data.eventosTributarios : [];
    fallbackAuditoria = Array.isArray(data.auditoria) ? data.auditoria : [];
    fallbackSocios = Array.isArray(data.socios) ? data.socios : [];
    fallbackLastId = fallbackEmpresas.reduce((max, item) => Math.max(max, item.id), 0);
    fallbackLastCuentaId = fallbackCuentas.reduce((max, item) => Math.max(max, item.id), 0);
    fallbackLastAsientoId = fallbackAsientos.reduce((max, item) => Math.max(max, item.id), 0);
    fallbackLastAsientoDetalleId = fallbackAsientoDetalles.reduce((max, item) => Math.max(max, item.id), 0);
    fallbackLastEventoTributarioId = fallbackEventosTributarios.reduce(
      (max, item) => Math.max(max, item.id),
      0
    );
    fallbackLastAuditoriaId = fallbackAuditoria.reduce((max, item) => Math.max(max, item.id), 0);
    fallbackLastSocioId = fallbackSocios.reduce((max, item) => Math.max(max, item.id), 0);
  } catch {
    fallbackEmpresas = [];
    fallbackLastId = 0;
    fallbackEmpresaActivaId = null;
    fallbackCuentas = [];
    fallbackLastCuentaId = 0;
    fallbackAsientos = [];
    fallbackAsientoDetalles = [];
    fallbackEventosTributarios = [];
    fallbackAuditoria = [];
    fallbackSocios = [];
    fallbackLastAsientoId = 0;
    fallbackLastAsientoDetalleId = 0;
    fallbackLastEventoTributarioId = 0;
    fallbackLastAuditoriaId = 0;
    fallbackLastSocioId = 0;
  }
}

function saveFallback(): void {
  const fallbackPath = getFallbackPath();
  fs.writeFileSync(
    fallbackPath,
    JSON.stringify(
      {
        empresas: fallbackEmpresas,
        empresaActivaId: fallbackEmpresaActivaId,
        cuentas: fallbackCuentas,
        asientos: fallbackAsientos,
        asientoDetalles: fallbackAsientoDetalles,
        eventosTributarios: fallbackEventosTributarios,
        auditoria: fallbackAuditoria,
        socios: fallbackSocios
      },
      null,
      2
    ),
    "utf8"
  );
}

export function initializeDatabase(): void {
  if (db) {
    return;
  }

  try {
    const betterSqlite3 = require("better-sqlite3") as (new (file: string) => SqliteDatabase);
    db = new betterSqlite3(getDatabasePath());
  } catch {
    sqliteUnavailable = true;
    loadFallback();
    return;
  }

  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS Empresa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      cuit TEXT,
      moneda TEXT NOT NULL DEFAULT 'CLP',
      giro TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS AppConfig (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS CuentaContable (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id INTEGER NOT NULL,
      codigo TEXT NOT NULL,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL,
      naturaleza TEXT NOT NULL,
      activa INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (empresa_id) REFERENCES Empresa(id),
      UNIQUE (empresa_id, codigo)
    );

    CREATE TABLE IF NOT EXISTS Asiento (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      referencia TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (empresa_id) REFERENCES Empresa(id)
    );

    CREATE TABLE IF NOT EXISTS AsientoDetalle (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asiento_id INTEGER NOT NULL,
      cuenta_id INTEGER NOT NULL,
      debe REAL NOT NULL DEFAULT 0,
      haber REAL NOT NULL DEFAULT 0,
      detalle TEXT,
      FOREIGN KEY (asiento_id) REFERENCES Asiento(id),
      FOREIGN KEY (cuenta_id) REFERENCES CuentaContable(id)
    );

    CREATE TABLE IF NOT EXISTS Comprobante (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      numero TEXT NOT NULL,
      fecha TEXT NOT NULL,
      tercero TEXT,
      total REAL NOT NULL,
      moneda TEXT NOT NULL DEFAULT 'CLP',
      estado TEXT NOT NULL DEFAULT 'borrador',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (empresa_id) REFERENCES Empresa(id)
    );

    CREATE TABLE IF NOT EXISTS EventoTributario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      tipo TEXT NOT NULL,
      base_imponible REAL NOT NULL,
      tasa REAL NOT NULL,
      impuesto REAL NOT NULL,
      descripcion TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (empresa_id) REFERENCES Empresa(id)
    );

    CREATE TABLE IF NOT EXISTS RegistroInterpretacion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id INTEGER NOT NULL,
      fecha_registro TEXT NOT NULL,
      fecha_operacion TEXT NOT NULL,
      texto_original TEXT NOT NULL,
      categoria_operacion TEXT NOT NULL,
      tipo_documento TEXT NOT NULL,
      modo_iva TEXT NOT NULL,
      monto_base REAL NOT NULL,
      monto_neto REAL NOT NULL,
      monto_iva REAL NOT NULL,
      monto_total REAL NOT NULL,
      asiento_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (empresa_id) REFERENCES Empresa(id)
    );

    CREATE TABLE IF NOT EXISTS SocioEmpresa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      aporte_inicial REAL NOT NULL DEFAULT 0,
      participacion REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (empresa_id) REFERENCES Empresa(id)
    );
  `);

  try {
    db.exec("ALTER TABLE Empresa ADD COLUMN giro TEXT");
  } catch {
    // Ignora error cuando la columna ya existe.
  }
}

function getDb(): SqliteDatabase {
  if (!db) {
    throw new Error("La base de datos no esta inicializada.");
  }
  return db;
}

export function listEmpresas(): EmpresaRecord[] {
  if (sqliteUnavailable || !db) {
    return [...fallbackEmpresas].sort((a, b) => (a.id < b.id ? 1 : -1));
  }

  const query = getDb().prepare(
    `SELECT id, nombre, cuit AS rut, moneda, giro, created_at
     FROM Empresa
     ORDER BY created_at DESC, id DESC`
  );

  return query.all() as EmpresaRecord[];
}

function getEmpresaById(id: number): EmpresaRecord | null {
  if (!id) {
    return null;
  }

  if (sqliteUnavailable || !db) {
    return fallbackEmpresas.find((item) => item.id === id) ?? null;
  }

  const query = getDb().prepare(
    `SELECT id, nombre, cuit AS rut, moneda, giro, created_at
     FROM Empresa
     WHERE id = ?`
  );

  return (query.get(id) as EmpresaRecord | undefined) ?? null;
}

export function getEmpresaActivaId(): number | null {
  if (sqliteUnavailable || !db) {
    return fallbackEmpresaActivaId;
  }

  const query = getDb().prepare("SELECT value FROM AppConfig WHERE key = 'empresa_activa_id'");
  const row = query.get() as { value?: string } | undefined;
  if (!row?.value) {
    return null;
  }

  const parsed = Number(row.value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function setEmpresaActiva(id: number | null): { ok: boolean } {
  if (sqliteUnavailable || !db) {
    fallbackEmpresaActivaId = id;
    saveFallback();
    return { ok: true };
  }

  if (id === null) {
    const del = getDb().prepare("DELETE FROM AppConfig WHERE key = 'empresa_activa_id'");
    del.run();
    return { ok: true };
  }

  const empresaExiste = getDb().prepare("SELECT id FROM Empresa WHERE id = ?").get(id) as
    | { id: number }
    | undefined;
  if (!empresaExiste) {
    throw new Error("La empresa seleccionada no existe.");
  }

  const upsert = getDb().prepare(
    `INSERT INTO AppConfig (key, value)
     VALUES ('empresa_activa_id', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );
  upsert.run(String(id));
  return { ok: true };
}

export function createEmpresa(input: {
  nombre: string;
  rut?: string | null;
  cuit?: string | null;
  moneda?: string;
  giro?: string | null;
}): EmpresaRecord {
  const nombre = input.nombre.trim();
  if (!nombre) {
    throw new Error("El nombre de la empresa es obligatorio.");
  }

  const rut = input.rut?.trim() || input.cuit?.trim() || null;
  const moneda = input.moneda?.trim() || "CLP";
  const giro = input.giro?.trim() || null;

  if (sqliteUnavailable || !db) {
    fallbackLastId += 1;
    const empresa: EmpresaRecord = {
      id: fallbackLastId,
      nombre,
      rut,
      moneda,
      giro,
      created_at: new Date().toISOString()
    };
    fallbackEmpresas.push(empresa);
    if (fallbackEmpresaActivaId === null) {
      fallbackEmpresaActivaId = empresa.id;
    }
    saveFallback();
    return empresa;
  }

  const insert = getDb().prepare(
     `INSERT INTO Empresa (nombre, cuit, moneda, giro)
      VALUES (?, ?, ?, ?)`
  );

    const result = insert.run(nombre, rut, moneda, giro);
  const id = Number(result.lastInsertRowid);

  const getOne = getDb().prepare(
    `SELECT id, nombre, cuit AS rut, moneda, giro, created_at
     FROM Empresa
     WHERE id = ?`
  );

  const empresa = getOne.get(id) as EmpresaRecord | undefined;
  if (!empresa) {
    throw new Error("No se pudo recuperar la empresa creada.");
  }

  if (getEmpresaActivaId() === null) {
    setEmpresaActiva(empresa.id);
  }

  return empresa;
}

export function updateEmpresa(input: {
  id: number;
  nombre: string;
  rut?: string | null;
  cuit?: string | null;
  moneda?: string;
  giro?: string | null;
}): EmpresaRecord {
  const id = Number(input.id);
  const nombre = input.nombre.trim();
  const rut = input.rut?.trim() || input.cuit?.trim() || null;
  const moneda = input.moneda?.trim() || "CLP";
  const giro = input.giro?.trim() || null;

  if (!id) {
    throw new Error("Empresa no valida.");
  }
  if (!nombre) {
    throw new Error("El nombre de la empresa es obligatorio.");
  }

  if (sqliteUnavailable || !db) {
    const index = fallbackEmpresas.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error("La empresa no existe.");
    }

    fallbackEmpresas[index] = {
      ...fallbackEmpresas[index],
      nombre,
      rut,
      moneda,
      giro
    };
    saveFallback();
    return fallbackEmpresas[index];
  }

  const update = getDb().prepare(
    "UPDATE Empresa SET nombre = ?, cuit = ?, moneda = ?, giro = ? WHERE id = ?"
  );
  update.run(nombre, rut, moneda, giro, id);

  const getOne = getDb().prepare(
    `SELECT id, nombre, cuit AS rut, moneda, giro, created_at
     FROM Empresa
     WHERE id = ?`
  );
  const empresa = getOne.get(id) as EmpresaRecord | undefined;
  if (!empresa) {
    throw new Error("La empresa no existe.");
  }
  return empresa;
}

export function deleteEmpresa(id: number): void {
  if (sqliteUnavailable || !db) {
    fallbackEmpresas = fallbackEmpresas.filter((item) => item.id !== id);
    fallbackCuentas = fallbackCuentas.filter((item) => item.empresa_id !== id);
    const asientosIds = fallbackAsientos.filter((item) => item.empresa_id === id).map((item) => item.id);
    fallbackAsientos = fallbackAsientos.filter((item) => item.empresa_id !== id);
    fallbackAsientoDetalles = fallbackAsientoDetalles.filter(
      (item) => !asientosIds.includes(item.asiento_id)
    );
    fallbackEventosTributarios = fallbackEventosTributarios.filter((item) => item.empresa_id !== id);
    fallbackAuditoria = fallbackAuditoria.filter((item) => item.empresa_id !== id);
    fallbackSocios = fallbackSocios.filter((item) => item.empresa_id !== id);
    if (fallbackEmpresaActivaId === id) {
      fallbackEmpresaActivaId = fallbackEmpresas.length > 0 ? fallbackEmpresas[0].id : null;
    }
    saveFallback();
    return;
  }

  const deleteCuentas = getDb().prepare("DELETE FROM CuentaContable WHERE empresa_id = ?");
  const deleteEventos = getDb().prepare("DELETE FROM EventoTributario WHERE empresa_id = ?");
  const deleteAuditoria = getDb().prepare("DELETE FROM RegistroInterpretacion WHERE empresa_id = ?");
  const deleteSocios = getDb().prepare("DELETE FROM SocioEmpresa WHERE empresa_id = ?");
  const deleteDetalles = getDb().prepare(
    `DELETE FROM AsientoDetalle
     WHERE asiento_id IN (SELECT id FROM Asiento WHERE empresa_id = ?)`
  );
  const deleteAsientos = getDb().prepare("DELETE FROM Asiento WHERE empresa_id = ?");
  deleteCuentas.run(id);
  deleteEventos.run(id);
  deleteAuditoria.run(id);
  deleteSocios.run(id);
  deleteDetalles.run(id);
  deleteAsientos.run(id);

  const stmt = getDb().prepare("DELETE FROM Empresa WHERE id = ?");
  stmt.run(id);

  const activa = getEmpresaActivaId();
  if (activa === id) {
    const siguiente = getDb().prepare("SELECT id FROM Empresa ORDER BY id ASC LIMIT 1").get() as
      | { id: number }
      | undefined;
    setEmpresaActiva(siguiente ? siguiente.id : null);
  }
}

export function listSociosEmpresa(empresaId: number): SocioRecord[] {
  if (!empresaId) {
    return [];
  }

  if (sqliteUnavailable || !db) {
    return fallbackSocios
      .filter((item) => item.empresa_id === empresaId)
      .sort((a, b) => (a.id > b.id ? 1 : -1));
  }

  const query = getDb().prepare(
    `SELECT id, empresa_id, nombre, aporte_inicial, participacion, created_at
     FROM SocioEmpresa
     WHERE empresa_id = ?
     ORDER BY created_at ASC, id ASC`
  );

  return query.all(empresaId) as SocioRecord[];
}

export function createSocioEmpresa(input: {
  empresaId: number;
  nombre: string;
  aporteInicial?: number;
  participacion?: number;
}): SocioRecord {
  const empresaId = Number(input.empresaId);
  const nombre = input.nombre.trim();
  const aporteInicial = Number(input.aporteInicial ?? 0);
  const participacion = Number(input.participacion ?? 0);

  if (!empresaId) {
    throw new Error("Debes seleccionar una empresa activa.");
  }
  if (!nombre) {
    throw new Error("El nombre del socio/accionista es obligatorio.");
  }
  if (aporteInicial < 0 || participacion < 0) {
    throw new Error("Aporte inicial y participacion deben ser positivos.");
  }

  if (sqliteUnavailable || !db) {
    fallbackLastSocioId += 1;
    const socio: SocioRecord = {
      id: fallbackLastSocioId,
      empresa_id: empresaId,
      nombre,
      aporte_inicial: aporteInicial,
      participacion,
      created_at: new Date().toISOString()
    };
    fallbackSocios.push(socio);
    saveFallback();
    return socio;
  }

  const empresaExiste = getDb().prepare("SELECT id FROM Empresa WHERE id = ?").get(empresaId) as
    | { id: number }
    | undefined;
  if (!empresaExiste) {
    throw new Error("La empresa seleccionada no existe.");
  }

  const insert = getDb().prepare(
    `INSERT INTO SocioEmpresa (empresa_id, nombre, aporte_inicial, participacion)
     VALUES (?, ?, ?, ?)`
  );
  const result = insert.run(empresaId, nombre, aporteInicial, participacion);
  const id = Number(result.lastInsertRowid);

  const query = getDb().prepare(
    `SELECT id, empresa_id, nombre, aporte_inicial, participacion, created_at
     FROM SocioEmpresa
     WHERE id = ?`
  );
  const socio = query.get(id) as SocioRecord | undefined;
  if (!socio) {
    throw new Error("No se pudo recuperar el socio/accionista creado.");
  }
  return socio;
}

export function updateSocioEmpresa(input: {
  id: number;
  nombre: string;
  aporteInicial?: number;
  participacion?: number;
}): SocioRecord {
  const socioId = Number(input.id);
  const nombre = input.nombre.trim();
  const aporteInicial = Number(input.aporteInicial ?? 0);
  const participacion = Number(input.participacion ?? 0);

  if (!socioId) {
    throw new Error("Socio/accionista no valido.");
  }
  if (!nombre) {
    throw new Error("El nombre del socio/accionista es obligatorio.");
  }
  if (aporteInicial < 0 || participacion < 0) {
    throw new Error("Aporte inicial y participacion deben ser positivos.");
  }

  if (sqliteUnavailable || !db) {
    const index = fallbackSocios.findIndex((item) => item.id === socioId);
    if (index === -1) {
      throw new Error("El socio/accionista no existe.");
    }

    fallbackSocios[index] = {
      ...fallbackSocios[index],
      nombre,
      aporte_inicial: aporteInicial,
      participacion
    };
    saveFallback();
    return fallbackSocios[index];
  }

  const update = getDb().prepare(
    `UPDATE SocioEmpresa
     SET nombre = ?, aporte_inicial = ?, participacion = ?
     WHERE id = ?`
  );
  update.run(nombre, aporteInicial, participacion, socioId);

  const query = getDb().prepare(
    `SELECT id, empresa_id, nombre, aporte_inicial, participacion, created_at
     FROM SocioEmpresa
     WHERE id = ?`
  );
  const socio = query.get(socioId) as SocioRecord | undefined;
  if (!socio) {
    throw new Error("El socio/accionista no existe.");
  }
  return socio;
}

export function deleteSocioEmpresa(id: number): { ok: boolean } {
  const socioId = Number(id);
  if (!socioId) {
    throw new Error("Socio/accionista no valido.");
  }

  if (sqliteUnavailable || !db) {
    fallbackSocios = fallbackSocios.filter((item) => item.id !== socioId);
    saveFallback();
    return { ok: true };
  }

  const stmt = getDb().prepare("DELETE FROM SocioEmpresa WHERE id = ?");
  stmt.run(socioId);
  return { ok: true };
}

export function listCuentasContables(empresaId: number): CuentaContableRecord[] {
  if (sqliteUnavailable || !db) {
    return fallbackCuentas
      .filter((item) => item.empresa_id === empresaId)
      .sort((a, b) => (a.codigo > b.codigo ? 1 : -1));
  }

  const query = getDb().prepare(
    `SELECT id, empresa_id, codigo, nombre, tipo, naturaleza, activa
     FROM CuentaContable
     WHERE empresa_id = ?
     ORDER BY codigo ASC`
  );
  return query.all(empresaId) as CuentaContableRecord[];
}

export function createCuentaContable(input: {
  empresaId: number;
  codigo: string;
  nombre: string;
  tipo: string;
  naturaleza: string;
}): CuentaContableRecord {
  const empresaId = Number(input.empresaId);
  const codigo = input.codigo.trim();
  const nombre = input.nombre.trim();
  const tipo = input.tipo.trim().toUpperCase();
  const naturaleza = input.naturaleza.trim().toUpperCase();

  if (!empresaId) {
    throw new Error("Debes seleccionar una empresa activa.");
  }
  if (!codigo || !nombre || !tipo || !naturaleza) {
    throw new Error("Todos los campos de cuenta son obligatorios.");
  }

  if (sqliteUnavailable || !db) {
    const existe = fallbackCuentas.find(
      (item) => item.empresa_id === empresaId && item.codigo === codigo
    );
    if (existe) {
      throw new Error("Ya existe una cuenta con ese codigo.");
    }

    fallbackLastCuentaId += 1;
    const cuenta: CuentaContableRecord = {
      id: fallbackLastCuentaId,
      empresa_id: empresaId,
      codigo,
      nombre,
      tipo,
      naturaleza,
      activa: 1
    };
    fallbackCuentas.push(cuenta);
    saveFallback();
    return cuenta;
  }

  const insert = getDb().prepare(
    `INSERT INTO CuentaContable (empresa_id, codigo, nombre, tipo, naturaleza, activa)
     VALUES (?, ?, ?, ?, ?, 1)`
  );
  insert.run(empresaId, codigo, nombre, tipo, naturaleza);

  const getOne = getDb().prepare(
    `SELECT id, empresa_id, codigo, nombre, tipo, naturaleza, activa
     FROM CuentaContable
     WHERE empresa_id = ? AND codigo = ?`
  );
  const cuenta = getOne.get(empresaId, codigo) as CuentaContableRecord | undefined;
  if (!cuenta) {
    throw new Error("No se pudo recuperar la cuenta creada.");
  }
  return cuenta;
}

export function updateNombreCuentaContable(input: {
  cuentaId: number;
  nombre: string;
}): CuentaContableRecord {
  const cuentaId = Number(input.cuentaId);
  const nombre = input.nombre.trim();

  if (!cuentaId) {
    throw new Error("Cuenta no valida.");
  }
  if (!nombre) {
    throw new Error("El nombre de la cuenta es obligatorio.");
  }

  if (sqliteUnavailable || !db) {
    const index = fallbackCuentas.findIndex((item) => item.id === cuentaId);
    if (index === -1) {
      throw new Error("La cuenta no existe.");
    }

    fallbackCuentas[index] = {
      ...fallbackCuentas[index],
      nombre
    };
    saveFallback();
    return fallbackCuentas[index];
  }

  const update = getDb().prepare("UPDATE CuentaContable SET nombre = ? WHERE id = ?");
  update.run(nombre, cuentaId);

  const getOne = getDb().prepare(
    `SELECT id, empresa_id, codigo, nombre, tipo, naturaleza, activa
     FROM CuentaContable
     WHERE id = ?`
  );
  const cuenta = getOne.get(cuentaId) as CuentaContableRecord | undefined;
  if (!cuenta) {
    throw new Error("La cuenta no existe.");
  }

  return cuenta;
}

export function seedPlanCuentasChile(empresaId: number): { creadas: number } {
  let creadas = 0;
  for (const cuenta of PLAN_BASE_CHILE) {
    try {
      createCuentaContable({
        empresaId,
        codigo: cuenta.codigo,
        nombre: cuenta.nombre,
        tipo: cuenta.tipo,
        naturaleza: cuenta.naturaleza
      });
      creadas += 1;
    } catch {
      // Ignora cuentas ya existentes para que el seed sea idempotente.
    }
  }

  return { creadas };
}

function getCuentaPorCodigo(empresaId: number, codigo: string): CuentaContableRecord | undefined {
  if (sqliteUnavailable || !db) {
    return fallbackCuentas.find((item) => item.empresa_id === empresaId && item.codigo === codigo);
  }

  const query = getDb().prepare(
    `SELECT id, empresa_id, codigo, nombre, tipo, naturaleza, activa
     FROM CuentaContable
     WHERE empresa_id = ? AND codigo = ?`
  );
  return query.get(empresaId, codigo) as CuentaContableRecord | undefined;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}



function detectarCategoriaServicioExento(textoNormalizado: string, giroNormalizado: string): string | null {
  const base = `${textoNormalizado} ${giroNormalizado}`.trim();

  if (/(sociedad de profesionales|servicios profesionales exentos|estudio profesional|consulta profesional)/.test(base)) {
    return "sociedad_profesionales";
  }

  if (/(consulta medica|atencion medica|prestacion medica|medico|medica|clinica|hospital|odontolog|psicolog|kinesiolog|fonoaudiolog|terapia ocupacional|nutricion)/.test(base)) {
    return "salud";
  }

  if (/(colegio|escuela|jardin infantil|universidad|instituto profesional|liceo|arancel|matricula escolar|servicio educacional|educacion)/.test(base)) {
    return "educacion";
  }

  if (/(museo|biblioteca|teatro|orquesta|ballet|actividad cultural|servicio cultural|espectaculo cultural)/.test(base)) {
    return "cultural";
  }

  return null;
}

function descripcionCategoriaServicioExento(categoria: string | null): string {
  switch (categoria) {
    case "sociedad_profesionales":
      return "servicio profesional o sociedad de profesionales";
    case "salud":
      return "prestacion de salud";
    case "educacion":
      return "servicio educacional";
    case "cultural":
      return "actividad cultural";
    default:
      return "servicio posiblemente exento";
  }
}

function ajustarDocumentoSegunContextoServicio(input: {
  tipoOperacion: TipoOperacionExtendida;
  categoriaOperacion: CategoriaOperacion;
  tipoDocumento: TipoDocumentoTributario;
  textoNormalizado: string;
  giroNormalizado: string;
}): {
  tipoDocumento: TipoDocumentoTributario;
  notaContexto: string | null;
} {
  const { tipoOperacion, categoriaOperacion, tipoDocumento, textoNormalizado, giroNormalizado } = input;

  if (categoriaOperacion === "SUELDOS") {
    return {
      tipoDocumento: "SIN_DOCUMENTO",
      notaContexto: "Se detectaron remuneraciones; normalmente se respaldan con liquidacion y no con factura o boleta."
    };
  }

  if (categoriaOperacion === "ARRIENDO" && tipoDocumento === "DESCONOCIDO") {
    const mencionaIva = /(mas iva|\+ ?iva|iva incluido|incluye iva|con iva)/.test(textoNormalizado);
    return mencionaIva
      ? {
          tipoDocumento: "FACTURA",
          notaContexto: "Se detecto arriendo con mencion de IVA; se asume documento afecto a IVA."
        }
      : {
          tipoDocumento: "FACTURA_EXENTA",
          notaContexto: "Se detecto arriendo y no se menciono IVA; se asume documento exento/no afecto por defecto."
        };
  }

  if (tipoOperacion !== "GASTO_SERVICIOS") {
    return { tipoDocumento, notaContexto: null };
  }

  const categoria = detectarCategoriaServicioExento(textoNormalizado, giroNormalizado);
  if (!categoria) {
    return { tipoDocumento, notaContexto: null };
  }

  const descripcion = descripcionCategoriaServicioExento(categoria);

  if (tipoDocumento === "FACTURA") {
    return {
      tipoDocumento: "FACTURA_EXENTA",
      notaContexto: `Se detecto ${descripcion}; por regla general el sistema la interpreta como factura exenta o no afecta.`
    };
  }

  if (tipoDocumento === "BOLETA") {
    return {
      tipoDocumento: "BOLETA_EXENTA",
      notaContexto: `Se detecto ${descripcion}; por regla general el sistema la interpreta como boleta exenta o no afecta.`
    };
  }

  if (tipoDocumento === "DESCONOCIDO") {
    return {
      tipoDocumento,
      notaContexto: `Se detecto ${descripcion}; revisa si corresponde documento exento o no afecto.`
    };
  }

  return { tipoDocumento, notaContexto: null };
}

function resumirTratamientoTributario(
  tipoOperacion: TipoOperacionExtendida,
  tipoDocumento: TipoDocumentoTributario,
  notaContexto?: string | null
): { aplicaIva: boolean; resumenTributario: string } {
  const contexto = notaContexto ? ` ${notaContexto}` : "";

  if (tipoDocumento === "BOLETA_HONORARIOS") {
    return {
      aplicaIva: false,
      resumenTributario: `Boleta de honorarios: no lleva IVA y se registra con retencion de 10.75%.${contexto}`
    };
  }

  if (tipoDocumento === "FACTURA_EXENTA" || tipoDocumento === "BOLETA_EXENTA") {
    return {
      aplicaIva: false,
      resumenTributario: `Documento exento o no afecto a IVA. El monto se registra completo, sin debito ni credito fiscal.${contexto}`
    };
  }

  if (tipoDocumento === "SIN_DOCUMENTO") {
    return {
      aplicaIva: false,
      resumenTributario: `Operacion sin documento tributario. No genera IVA fiscal y el respaldo debe revisarse manualmente.${contexto}`
    };
  }

  if (tipoDocumento === "FACTURA") {
    return {
      aplicaIva: true,
      resumenTributario:
        tipoOperacion === "GASTO_SERVICIOS"
          ? `Factura afecta IVA. Para servicios, el documento puede generar credito fiscal si la prestacion esta afecta y vinculada al giro.${contexto}`
          : `Factura afecta IVA. El sistema separa neto e IVA 19%.${contexto}`
    };
  }

  if (tipoDocumento === "BOLETA") {
    return {
      aplicaIva: true,
      resumenTributario:
        tipoOperacion === "VENTA_MERCADERIAS"
          ? `Boleta afecta IVA. El sistema separa neto e IVA debito fiscal incluido en el total.${contexto}`
          : `Boleta afecta IVA para el emisor, pero el comprador no usa credito fiscal; el gasto o compra se registra por el total.${contexto}`
    };
  }

  return {
    aplicaIva: false,
    resumenTributario: `Documento pendiente de clasificar tributariamente.${contexto}`
  };
}



function describirCategoriaOperacion(categoriaOperacion: CategoriaOperacion): string {
  switch (categoriaOperacion) {
    case "SUELDOS":
      return "Sueldos y remuneraciones";
    case "ARRIENDO":
      return "Arriendo";
    case "SERVICIOS_BASICOS":
      return "Servicios basicos";
    case "HONORARIOS":
      return "Honorarios";
    case "COMPRA_GENERAL":
      return "Compra de mercaderias";
    case "VENTA_GENERAL":
      return "Venta";
    default:
      return "Gasto general";
  }
}

function detectarMedioPagoExtendido(
  textoNormalizado: string,
  tipo: TipoOperacionExtendida,
  categoriaOperacion: CategoriaOperacion
): "CAJA" | "BANCO" | "PROVEEDOR" | "CLIENTE" {
  if (/(caja|efectivo|al contado en caja|pago en caja)/.test(textoNormalizado)) return "CAJA";
  if (/(banco|transferencia|deposito bancario|cheque|tarjeta)/.test(textoNormalizado)) return "BANCO";
  if (tipo === "VENTA_MERCADERIAS") return "CLIENTE";
  if (tipo === "HONORARIOS") return "BANCO";
  if (categoriaOperacion === "SUELDOS") return "BANCO";
  return "PROVEEDOR";
}

function inferirTipoOperacionDesdeCategoria(categoriaOperacion: string): TipoOperacionExtendida {
  if (categoriaOperacion === "COMPRA_GENERAL") return "COMPRA_MERCADERIAS";
  if (categoriaOperacion === "VENTA_GENERAL") return "VENTA_MERCADERIAS";
  if (categoriaOperacion === "HONORARIOS") return "HONORARIOS";
  if (categoriaOperacion === "CAPITAL_INICIAL") return "CAPITAL_INICIAL";
  return "GASTO_SERVICIOS";
}

function getOpcionesDocumentoPorTipo(
  tipoOperacion: TipoOperacionExtendida
): Array<{ valor: TipoDocumentoTributario; etiqueta: string; descripcion: string }> {
  if (tipoOperacion === "HONORARIOS") {
    return [
      {
        valor: "BOLETA_HONORARIOS",
        etiqueta: "Boleta de honorarios",
        descripcion: "Sin IVA. Retencion 10.75%. Para trabajadores independientes."
      }
    ];
  }

  if (tipoOperacion === "VENTA_MERCADERIAS") {
    return [
      { valor: "FACTURA", etiqueta: "Factura afecta", descripcion: "Afecta IVA 19%. El sistema separa neto e IVA debito." },
      { valor: "FACTURA_EXENTA", etiqueta: "Factura exenta o no afecta", descripcion: "No genera IVA debito. El ingreso se registra por el total." },
      { valor: "BOLETA", etiqueta: "Boleta afecta", descripcion: "Afecta IVA 19%. Para consumidor final." },
      { valor: "BOLETA_EXENTA", etiqueta: "Boleta exenta o no afecta", descripcion: "No genera IVA debito." },
      { valor: "SIN_DOCUMENTO", etiqueta: "Sin documento tributario", descripcion: "Sin IVA. No genera debito fiscal. Ingreso no documentado." }
    ];
  }

  if (tipoOperacion === "CAPITAL_INICIAL") {
    return [
      { valor: "SIN_DOCUMENTO", etiqueta: "Sin documento tributario", descripcion: "Aporte de capital o inicio de actividades sin IVA." }
    ];
  }

  return [
    { valor: "FACTURA", etiqueta: "Factura afecta", descripcion: "Afecta IVA 19%. Si corresponde, permite separar IVA credito fiscal." },
    { valor: "FACTURA_EXENTA", etiqueta: "Factura exenta o no afecta", descripcion: "No lleva IVA. El gasto o compra se registra completo." },
    { valor: "BOLETA", etiqueta: "Boleta afecta", descripcion: "Puede venir con IVA para el emisor, pero el comprador registra el total sin credito fiscal." },
    { valor: "BOLETA_EXENTA", etiqueta: "Boleta exenta o no afecta", descripcion: "No lleva IVA recuperable; se registra el total." },
    { valor: "SIN_DOCUMENTO", etiqueta: "Sin documento tributario", descripcion: "Sin IVA recuperable. Puede ser gasto fuera del giro." }
  ];
}

export function interpretarTextoOperacion(input: {
  empresaId: number;
  fecha: string;
  texto: string;
}): ResultadoInterpretacion {
  const empresaId = Number(input.empresaId);
  const fecha = (input.fecha || "").trim();
  const texto = (input.texto || "").trim();

  if (!empresaId) throw new Error("Debes seleccionar una empresa activa.");
  if (!fecha) throw new Error("Debes indicar una fecha para registrar la operacion.");
  if (!texto) throw new Error("Escribe la operacion para poder interpretarla.");

  const textoNormalizado = normalizarTextoOperacion(texto);
  const empresa = getEmpresaById(empresaId);
  const giroNormalizado = normalizarTextoOperacion(empresa?.giro || "");
  const tipoOperacion = detectarTipoOperacionExtendida(textoNormalizado);
  const categoriaOperacion = detectarCategoriaOperacion(textoNormalizado, tipoOperacion);
  const tipoDocumentoDetectado = detectarDocumentoTributario(textoNormalizado);
  const montoBase = extraerMontoDesdeTexto(textoNormalizado);
  const ajusteDocumento = ajustarDocumentoSegunContextoServicio({
    tipoOperacion,
    categoriaOperacion,
    tipoDocumento: tipoDocumentoDetectado,
    textoNormalizado,
    giroNormalizado
  });
  const tipoDocumento = ajusteDocumento.tipoDocumento;
  const tratamientoTributario = resumirTratamientoTributario(
    tipoOperacion,
    tipoDocumento,
    ajusteDocumento.notaContexto
  );
  const modoIva = detectarModoIva(textoNormalizado, tratamientoTributario.aplicaIva);
  const desgloseMontos = calcularDesgloseMontos(montoBase, tratamientoTributario.aplicaIva, modoIva);
  const medioPago = detectarMedioPagoExtendido(textoNormalizado, tipoOperacion, categoriaOperacion);

  // CAPITAL_INICIAL nunca necesita confirmación: asigna SIN_DOCUMENTO automáticamente
  const necesitaConfirmacion = tipoOperacion === "CAPITAL_INICIAL" ? false : tipoDocumento === "DESCONOCIDO";
  const tipoDocumentoFinal = tipoOperacion === "CAPITAL_INICIAL" ? "SIN_DOCUMENTO" : tipoDocumento;

  const opcionesDocumento: Array<{ valor: TipoDocumentoTributario; etiqueta: string; descripcion: string }> =
    tipoOperacion === "CAPITAL_INICIAL"
      ? [] // CAPITAL_INICIAL no necesita opciones
      : tipoOperacion === "HONORARIOS"
        ? [
            { valor: "BOLETA_HONORARIOS", etiqueta: "Boleta de honorarios", descripcion: "Sin IVA. Retencion 10.75%. Para trabajadores independientes." }
          ]
        : tipoOperacion === "VENTA_MERCADERIAS"
          ? [
              { valor: "FACTURA", etiqueta: "Factura afecta", descripcion: "Afecta IVA 19%. El sistema separa neto e IVA debito." },
              { valor: "FACTURA_EXENTA", etiqueta: "Factura exenta o no afecta", descripcion: "No genera IVA debito. El ingreso se registra por el total." },
              { valor: "BOLETA", etiqueta: "Boleta afecta", descripcion: "Afecta IVA 19%. Para consumidor final." },
              { valor: "BOLETA_EXENTA", etiqueta: "Boleta exenta o no afecta", descripcion: "No genera IVA debito." },
              { valor: "SIN_DOCUMENTO", etiqueta: "Sin documento tributario", descripcion: "Sin IVA. No genera debito fiscal. Ingreso no documentado." }
            ]
          : [
              { valor: "FACTURA", etiqueta: "Factura afecta", descripcion: "Afecta IVA 19%. Si corresponde, permite separar IVA credito fiscal." },
              { valor: "FACTURA_EXENTA", etiqueta: "Factura exenta o no afecta", descripcion: "No lleva IVA. El gasto o compra se registra completo." },
              { valor: "BOLETA", etiqueta: "Boleta afecta", descripcion: "Puede venir con IVA para el emisor, pero el comprador registra el total sin credito fiscal." },
              { valor: "BOLETA_EXENTA", etiqueta: "Boleta exenta o no afecta", descripcion: "No lleva IVA recuperable; se registra el total." },
              { valor: "SIN_DOCUMENTO", etiqueta: "Sin documento tributario", descripcion: "Sin IVA recuperable. Puede ser gasto fuera del giro." }
            ];

  const verboOp = tipoOperacion === "COMPRA_MERCADERIAS" ? "compro" : tipoOperacion === "VENTA_MERCADERIAS" ? "vendio" : "pago";
  const pregunta = necesitaConfirmacion
    ? `Se ${verboOp} por $${desgloseMontos.montoTotal.toFixed(0)}. ¿Tiene documento tributario?`
    : "";

  return {
    empresaId,
    fecha,
    interpretacion: {
      tipoOperacion,
      categoriaOperacion,
      tipoDocumento: tipoDocumentoFinal,
      modoIva,
      montoBase: desgloseMontos.montoBase,
      montoNeto: desgloseMontos.montoNeto,
      montoIva: desgloseMontos.montoIva,
      montoTotal: desgloseMontos.montoTotal,
      medioPago,
      textoOriginal: texto,
      aplicaIva: tratamientoTributario.aplicaIva,
      resumenTributario: `${tratamientoTributario.resumenTributario} Desglose: neto $${desgloseMontos.montoNeto.toFixed(0)}, IVA $${desgloseMontos.montoIva.toFixed(0)}, total $${desgloseMontos.montoTotal.toFixed(0)}.`
    },
    necesitaConfirmacion,
    pregunta,
    opcionesDocumento
  };
}

export function confirmarYRegistrarDesdeInterpretacion(input: {
  empresaId: number;
  fecha: string;
  interpretacion: InterpretacionTexto;
}): AsientoRecord {
  const empresaId = Number(input.empresaId);
  const fecha = (input.fecha || "").trim();
  const {
    tipoOperacion,
    categoriaOperacion,
    tipoDocumento,
    modoIva,
    montoBase,
    medioPago,
    textoOriginal
  } = input.interpretacion;

  if (!empresaId) throw new Error("Debes seleccionar una empresa activa.");
  if (tipoDocumento === "DESCONOCIDO") throw new Error("Debes indicar el tipo de documento antes de registrar.");

  const cuentaCaja       = getCuentaPorCodigo(empresaId, "1.1.1.01");
  const cuentaBanco      = getCuentaPorCodigo(empresaId, "1.1.1.02");
  const cuentaClientes   = getCuentaPorCodigo(empresaId, "1.1.2.01");
  const cuentaInventario = getCuentaPorCodigo(empresaId, "1.1.3.01");
  const cuentaProveedor  = getCuentaPorCodigo(empresaId, "2.1.1.01");
  const cuentaIvaDebito  = getCuentaPorCodigo(empresaId, "2.1.2.01");
  const cuentaIvaCredito = getCuentaPorCodigo(empresaId, "2.1.2.02");
  const cuentaRetencion  = getCuentaPorCodigo(empresaId, "2.1.2.03");
  const cuentaGastos     = getCuentaPorCodigo(empresaId, "5.1.1.01");
  const cuentaHonorarios = getCuentaPorCodigo(empresaId, "5.1.1.02") || cuentaGastos;
  const cuentaSueldos    = getCuentaPorCodigo(empresaId, "5.1.1.03") || cuentaGastos;
  const cuentaArriendo   = getCuentaPorCodigo(empresaId, "5.1.2.01") || cuentaGastos;
  const cuentaServicios  = getCuentaPorCodigo(empresaId, "5.1.2.02") || cuentaGastos;
  const cuentaIngresos   = getCuentaPorCodigo(empresaId, "4.1.1.01");

  const cuentaContrapartida =
    medioPago === "CAJA" ? cuentaCaja :
    medioPago === "BANCO" ? cuentaBanco :
    medioPago === "CLIENTE" ? cuentaClientes :
    cuentaProveedor;

  if (!cuentaContrapartida) {
    throw new Error("Falta cuenta de contrapartida. Carga el plan base Chile primero.");
  }

  const aplicaIvaConfirmado = tipoOperacionAplicaIva(tipoOperacion) && documentoAplicaIva(tipoDocumento);
  const modoIvaConfirmado: ModoIva = aplicaIvaConfirmado
    ? (modoIva === "NO_APLICA" ? "IVA_INCLUIDO" : modoIva)
    : "NO_APLICA";
  const desglose = calcularDesgloseMontos(montoBase, aplicaIvaConfirmado, modoIvaConfirmado);
  const montoNeto = desglose.montoNeto;
  const montoIva = desglose.montoIva;
  const montoTotal = desglose.montoTotal;

  const detalles: AsientoDetalleInput[] = [];
  const cuentaGastoEspecifica =
    categoriaOperacion === "SUELDOS" ? cuentaSueldos :
    categoriaOperacion === "ARRIENDO" ? cuentaArriendo :
    categoriaOperacion === "SERVICIOS_BASICOS" ? cuentaServicios :
    cuentaGastos;

  if (tipoOperacion === "COMPRA_MERCADERIAS") {
    if (!cuentaInventario) throw new Error("Falta cuenta Inventario (1.1.3.01). Carga el plan base Chile.");
    if (tipoDocumento === "FACTURA" && cuentaIvaCredito) {
      detalles.push({ cuentaId: cuentaInventario.id, debe: montoNeto, haber: 0, detalle: "Compra segun factura (neto)" });
      detalles.push({ cuentaId: cuentaIvaCredito.id,  debe: montoIva,  haber: 0, detalle: "IVA credito fiscal 19%" });
    } else {
      detalles.push({ cuentaId: cuentaInventario.id, debe: montoTotal, haber: 0, detalle: tipoDocumento === "BOLETA" ? "Compra con boleta (sin credito IVA)" : "Compra sin documento (sin credito IVA)" });
    }
    detalles.push({ cuentaId: cuentaContrapartida.id, debe: 0, haber: montoTotal, detalle: medioPago === "PROVEEDOR" ? "Proveedor por pagar" : "Pago realizado" });

  } else if (tipoOperacion === "VENTA_MERCADERIAS") {
    if (!cuentaIngresos) throw new Error("Falta cuenta Ingresos por Ventas (4.1.1.01). Carga el plan base Chile.");
    if ((tipoDocumento === "FACTURA" || tipoDocumento === "BOLETA") && cuentaIvaDebito) {
      detalles.push({ cuentaId: cuentaContrapartida.id, debe: montoTotal, haber: 0,   detalle: medioPago === "CLIENTE" ? "Cliente por cobrar" : "Cobro recibido" });
      detalles.push({ cuentaId: cuentaIngresos.id,       debe: 0,         haber: montoNeto, detalle: "Venta (neto)" });
      detalles.push({ cuentaId: cuentaIvaDebito.id,      debe: 0,         haber: montoIva,  detalle: tipoDocumento === "FACTURA" ? "IVA debito fiscal 19% (factura)" : "IVA debito fiscal 19% (boleta)" });
    } else {
      detalles.push({ cuentaId: cuentaContrapartida.id, debe: montoTotal, haber: 0,           detalle: "Cobro recibido" });
      detalles.push({ cuentaId: cuentaIngresos.id,       debe: 0,         haber: montoTotal,  detalle: "Venta sin documento" });
    }

  } else if (tipoOperacion === "GASTO_SERVICIOS") {
    if (!cuentaGastoEspecifica) throw new Error("Falta cuenta de gasto. Carga el plan base Chile.");
    if (tipoDocumento === "FACTURA" && cuentaIvaCredito) {
      detalles.push({ cuentaId: cuentaGastoEspecifica.id, debe: montoNeto, haber: 0, detalle: `${describirCategoriaOperacion(categoriaOperacion)} segun factura (neto)` });
      detalles.push({ cuentaId: cuentaIvaCredito.id,     debe: montoIva,  haber: 0, detalle: "IVA credito fiscal 19%" });
    } else {
      detalles.push({ cuentaId: cuentaGastoEspecifica.id, debe: montoTotal, haber: 0, detalle: `${describirCategoriaOperacion(categoriaOperacion)}${tipoDocumento === "BOLETA" ? " con boleta" : ""}` });
    }
    detalles.push({ cuentaId: cuentaContrapartida.id, debe: 0, haber: montoTotal, detalle: medioPago === "PROVEEDOR" ? "Proveedor por pagar" : "Pago realizado" });

  } else if (tipoOperacion === "HONORARIOS") {
    if (!cuentaHonorarios) throw new Error("Falta cuenta de honorarios. Carga el plan base Chile.");
    const montoRetencion = round2(montoTotal * 0.1075);
    const montoLiquido   = round2(montoTotal - montoRetencion);
    detalles.push({ cuentaId: cuentaHonorarios.id, debe: montoTotal, haber: 0, detalle: "Honorarios brutos (boleta de honorarios)" });
    if (cuentaRetencion) {
      detalles.push({ cuentaId: cuentaRetencion.id,       debe: 0, haber: montoRetencion, detalle: "Retencion PPM 10.75% por pagar al SII" });
      detalles.push({ cuentaId: cuentaContrapartida.id,   debe: 0, haber: montoLiquido,   detalle: "Pago liquido al profesional" });
    } else {
      detalles.push({ cuentaId: cuentaContrapartida.id, debe: 0, haber: montoTotal, detalle: "Pago honorarios" });
    }

  } else if (tipoOperacion === "CAPITAL_INICIAL") {
    const cuentaCapital = getCuentaPorCodigo(empresaId, "3.1.1.01");
    if (!cuentaCapital) throw new Error("Falta cuenta de Capital (3.1.1.01). Carga el plan base Chile.");
    detalles.push({ cuentaId: cuentaCapital.id, debe: 0, haber: montoTotal, detalle: "Aporte de capital inicial" });
    detalles.push({ cuentaId: cuentaContrapartida.id, debe: montoTotal, haber: 0, detalle: "Ingreso de capital" });

  } else {
    throw new Error("Tipo de operacion no soportado.");
  }

  const asientoCreado = createAsiento({
    empresaId,
    fecha,
    descripcion: textoOriginal || `Registro: ${tipoOperacion}`,
    referencia: `DOC:${tipoDocumento}|OP:${tipoOperacion}`,
    detalles
  });

  registrarAuditoria({
    empresaId,
    fechaOperacion: fecha,
    textoOriginal: textoOriginal || "",
    categoriaOperacion,
    tipoDocumento,
    modoIva: modoIvaConfirmado,
    montoBase,
    montoNeto: desglose.montoNeto,
    montoIva: desglose.montoIva,
    montoTotal: desglose.montoTotal,
    asientoId: asientoCreado.id
  });

  return asientoCreado;
}

export function registrarOperacionDesdeTexto(input: OperacionDesdeTextoInput): OperacionTextoResultado {
  const empresaId = Number(input.empresaId);
  const fecha = (input.fecha || "").trim();
  const texto = (input.texto || "").trim();

  if (!empresaId || !fecha || !texto) {
    throw new Error("Datos insuficientes para registrar la operacion.");
  }

  const resultado = interpretarTextoOperacion({ empresaId, fecha, texto });
  if (resultado.necesitaConfirmacion) {
    throw new Error(resultado.pregunta + " Usa el flujo de confirmacion para especificar el documento.");
  }

  const asiento = confirmarYRegistrarDesdeInterpretacion({ empresaId, fecha, interpretacion: resultado.interpretacion });
  const textoNorm = normalizarTextoOperacion(texto);

  return {
    asiento,
    interpretacion: {
      tipo: resultado.interpretacion.tipoOperacion as "COMPRA_MERCADERIAS" | "VENTA_MERCADERIAS" | "GASTO_SERVICIOS",
      montoTotal: resultado.interpretacion.montoTotal,
      incluyeIva: resultado.interpretacion.aplicaIva,
      medioPago: resultado.interpretacion.medioPago,
      textoNormalizado: textoNorm
    }
  };
}

export function registrarOperacionAutomatica(input: OperacionAutomaticaInput): AsientoRecord {
  const empresaId = Number(input.empresaId);
  const fecha = (input.fecha || "").trim();
  const montoTotal = Number(input.montoTotal || 0);
  const incluyeIva = Boolean(input.incluyeIva);
  const tipo = input.tipo;
  const medioPago = input.medioPago;
  const descripcionBase =
    input.descripcion?.trim() || `Registro automatico: ${tipo.replace(/_/g, " ").toLowerCase()}`;

  if (!empresaId) {
    throw new Error("Debes seleccionar una empresa activa.");
  }
  if (!fecha) {
    throw new Error("Debes indicar una fecha para registrar la operacion.");
  }
  if (!Number.isFinite(montoTotal) || montoTotal <= 0) {
    throw new Error("Debes indicar un monto total valido.");
  }

  const cuentaInventario = getCuentaPorCodigo(empresaId, "1.1.3.01");
  const cuentaClientes = getCuentaPorCodigo(empresaId, "1.1.2.01");
  const cuentaIngresos = getCuentaPorCodigo(empresaId, "4.1.1.01");
  const cuentaGastos = getCuentaPorCodigo(empresaId, "5.1.1.01");
  const cuentaIvaDebito = getCuentaPorCodigo(empresaId, "2.1.2.01");
  const cuentaIvaCredito = getCuentaPorCodigo(empresaId, "2.1.2.02");

  const cuentaCaja = getCuentaPorCodigo(empresaId, "1.1.1.01");
  const cuentaBanco = getCuentaPorCodigo(empresaId, "1.1.1.02");
  const cuentaProveedor = getCuentaPorCodigo(empresaId, "2.1.1.01");

  const getCuentaContrapartida = (): CuentaContableRecord | undefined => {
    if (medioPago === "CAJA") {
      return cuentaCaja;
    }
    if (medioPago === "BANCO") {
      return cuentaBanco;
    }
    if (medioPago === "PROVEEDOR") {
      return cuentaProveedor;
    }
    return cuentaClientes;
  };

  const cuentaContrapartida = getCuentaContrapartida();
  if (!cuentaContrapartida) {
    throw new Error("Falta la cuenta de contrapartida para esta operacion automatica.");
  }

  if (tipo === "COMPRA_MERCADERIAS" && medioPago === "CLIENTE") {
    throw new Error("Para compras usa Caja, Banco o Proveedor como contrapartida.");
  }
  if (tipo === "VENTA_MERCADERIAS" && medioPago === "PROVEEDOR") {
    throw new Error("Para ventas usa Caja, Banco o Cliente como contrapartida.");
  }
  if (tipo === "GASTO_SERVICIOS" && medioPago === "CLIENTE") {
    throw new Error("Para gastos usa Caja, Banco o Proveedor como contrapartida.");
  }

  let neto = montoTotal;
  let iva = 0;
  if (incluyeIva) {
    neto = round2(montoTotal / 1.19);
    iva = round2(montoTotal - neto);
  }

  const detalles: AsientoDetalleInput[] = [];

  if (tipo === "COMPRA_MERCADERIAS") {
    if (!cuentaInventario) {
      throw new Error("Falta la cuenta Inventario (1.1.3.01). Carga el plan base Chile.");
    }
    if (incluyeIva && !cuentaIvaCredito) {
      throw new Error("Falta la cuenta IVA Credito Fiscal (2.1.2.02). Carga el plan base Chile.");
    }

    detalles.push({
      cuentaId: cuentaInventario.id,
      debe: round2(neto),
      haber: 0,
      detalle: "Compra de mercaderias"
    });

    if (incluyeIva && iva > 0 && cuentaIvaCredito) {
      detalles.push({
        cuentaId: cuentaIvaCredito.id,
        debe: iva,
        haber: 0,
        detalle: "IVA credito fiscal"
      });
    }

    detalles.push({
      cuentaId: cuentaContrapartida.id,
      debe: 0,
      haber: round2(montoTotal),
      detalle: medioPago === "PROVEEDOR" ? "Registro contra proveedor" : "Salida por pago"
    });
  } else if (tipo === "VENTA_MERCADERIAS") {
    if (!cuentaIngresos) {
      throw new Error("Falta la cuenta Ingresos por Ventas (4.1.1.01). Carga el plan base Chile.");
    }
    if (incluyeIva && !cuentaIvaDebito) {
      throw new Error("Falta la cuenta IVA Debito Fiscal (2.1.2.01). Carga el plan base Chile.");
    }

    detalles.push({
      cuentaId: cuentaContrapartida.id,
      debe: round2(montoTotal),
      haber: 0,
      detalle: medioPago === "CLIENTE" ? "Registro contra cliente" : "Ingreso por cobro"
    });

    detalles.push({
      cuentaId: cuentaIngresos.id,
      debe: 0,
      haber: round2(neto),
      detalle: "Venta de mercaderias"
    });

    if (incluyeIva && iva > 0 && cuentaIvaDebito) {
      detalles.push({
        cuentaId: cuentaIvaDebito.id,
        debe: 0,
        haber: iva,
        detalle: "IVA debito fiscal"
      });
    }
  } else if (tipo === "GASTO_SERVICIOS") {
    if (!cuentaGastos) {
      throw new Error("Falta la cuenta Gastos Administrativos (5.1.1.01). Carga el plan base Chile.");
    }
    if (incluyeIva && !cuentaIvaCredito) {
      throw new Error("Falta la cuenta IVA Credito Fiscal (2.1.2.02). Carga el plan base Chile.");
    }

    detalles.push({
      cuentaId: cuentaGastos.id,
      debe: round2(neto),
      haber: 0,
      detalle: "Gasto por servicios"
    });

    if (incluyeIva && iva > 0 && cuentaIvaCredito) {
      detalles.push({
        cuentaId: cuentaIvaCredito.id,
        debe: iva,
        haber: 0,
        detalle: "IVA credito fiscal"
      });
    }

    detalles.push({
      cuentaId: cuentaContrapartida.id,
      debe: 0,
      haber: round2(montoTotal),
      detalle: medioPago === "PROVEEDOR" ? "Registro contra proveedor" : "Salida por pago"
    });
  } else {
    throw new Error("Tipo de operacion automatica no soportado.");
  }

  return createAsiento({
    empresaId,
    fecha,
    descripcion: descripcionBase,
    referencia: `AUTO:${tipo}`,
    detalles
  });
}

export function listAsientos(empresaId: number): AsientoRecord[] {
  if (sqliteUnavailable || !db) {
    return fallbackAsientos
      .map((item) => ({
        ...item,
        revision_count: fallbackAuditoria.filter((aud) => aud.asiento_id === item.id).length
      }))
      .filter((item) => item.empresa_id === empresaId)
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }

  const query = getDb().prepare(
    `SELECT a.id, a.empresa_id, a.fecha, a.descripcion, a.referencia, a.created_at,
      COALESCE(SUM(ad.debe), 0) AS total_debe,
      COALESCE(SUM(ad.haber), 0) AS total_haber,
      COALESCE(MAX(rc.revision_count), 0) AS revision_count
     FROM Asiento a
     LEFT JOIN AsientoDetalle ad ON ad.asiento_id = a.id
     LEFT JOIN (
       SELECT asiento_id, COUNT(*) AS revision_count
       FROM RegistroInterpretacion
       WHERE asiento_id IS NOT NULL
       GROUP BY asiento_id
     ) rc ON rc.asiento_id = a.id
     WHERE a.empresa_id = ?
     GROUP BY a.id
     ORDER BY a.fecha DESC, a.id DESC`
  );

  return query.all(empresaId) as AsientoRecord[];
}

export function createAsiento(input: {
  empresaId: number;
  fecha: string;
  descripcion: string;
  referencia?: string | null;
  detalles: AsientoDetalleInput[];
}): AsientoRecord {
  const empresaId = Number(input.empresaId);
  const fecha = (input.fecha || "").trim();
  const descripcion = (input.descripcion || "").trim();
  const referencia = input.referencia?.trim() || null;
  const detalles = Array.isArray(input.detalles) ? input.detalles : [];

  if (!empresaId) {
    throw new Error("Debes seleccionar una empresa activa.");
  }
  if (!fecha || !descripcion) {
    throw new Error("Fecha y descripcion son obligatorias.");
  }
  if (detalles.length < 2) {
    throw new Error("El asiento debe tener al menos 2 lineas.");
  }

  let totalDebe = 0;
  let totalHaber = 0;
  for (const linea of detalles) {
    const cuentaId = Number(linea.cuentaId);
    const debe = Number(linea.debe || 0);
    const haber = Number(linea.haber || 0);

    if (!cuentaId) {
      throw new Error("Cada linea debe tener una cuenta contable.");
    }
    if (debe < 0 || haber < 0) {
      throw new Error("Los montos no pueden ser negativos.");
    }
    if ((debe === 0 && haber === 0) || (debe > 0 && haber > 0)) {
      throw new Error("Cada linea debe tener solo debe o solo haber.");
    }

    totalDebe += debe;
    totalHaber += haber;
  }

  totalDebe = Number(totalDebe.toFixed(2));
  totalHaber = Number(totalHaber.toFixed(2));
  if (totalDebe <= 0 || totalHaber <= 0 || totalDebe !== totalHaber) {
    throw new Error("El asiento no cuadra: Debe y Haber deben ser iguales.");
  }

  if (sqliteUnavailable || !db) {
    fallbackLastAsientoId += 1;
    const now = new Date().toISOString();
    const asiento: AsientoRecord = {
      id: fallbackLastAsientoId,
      empresa_id: empresaId,
      fecha,
      descripcion,
      referencia,
      total_debe: totalDebe,
      total_haber: totalHaber,
      created_at: now
    };

    fallbackAsientos.push(asiento);
    for (const linea of detalles) {
      fallbackLastAsientoDetalleId += 1;
      fallbackAsientoDetalles.push({
        id: fallbackLastAsientoDetalleId,
        asiento_id: asiento.id,
        cuenta_id: Number(linea.cuentaId),
        debe: Number(linea.debe || 0),
        haber: Number(linea.haber || 0),
        detalle: linea.detalle?.trim() || null
      });
    }
    saveFallback();
    return asiento;
  }

  const insertAsiento = getDb().prepare(
    `INSERT INTO Asiento (empresa_id, fecha, descripcion, referencia)
     VALUES (?, ?, ?, ?)`
  );
  const result = insertAsiento.run(empresaId, fecha, descripcion, referencia);
  const asientoId = Number(result.lastInsertRowid);

  const insertDetalle = getDb().prepare(
    `INSERT INTO AsientoDetalle (asiento_id, cuenta_id, debe, haber, detalle)
     VALUES (?, ?, ?, ?, ?)`
  );

  for (const linea of detalles) {
    insertDetalle.run(
      asientoId,
      Number(linea.cuentaId),
      Number(linea.debe || 0),
      Number(linea.haber || 0),
      linea.detalle?.trim() || null
    );
  }

  const getOne = getDb().prepare(
    `SELECT a.id, a.empresa_id, a.fecha, a.descripcion, a.referencia, a.created_at,
      COALESCE(SUM(ad.debe), 0) AS total_debe,
      COALESCE(SUM(ad.haber), 0) AS total_haber
     FROM Asiento a
     LEFT JOIN AsientoDetalle ad ON ad.asiento_id = a.id
     WHERE a.id = ?
     GROUP BY a.id`
  );

  const asiento = getOne.get(asientoId) as AsientoRecord | undefined;
  if (!asiento) {
    throw new Error("No se pudo recuperar el asiento creado.");
  }

  return asiento;
}

export function listEventosTributarios(empresaId: number): EventoTributarioRecord[] {
  if (sqliteUnavailable || !db) {
    return fallbackEventosTributarios
      .filter((item) => item.empresa_id === empresaId)
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }

  const query = getDb().prepare(
    `SELECT id, empresa_id, fecha, tipo, base_imponible, tasa, impuesto, descripcion, created_at
     FROM EventoTributario
     WHERE empresa_id = ?
     ORDER BY fecha DESC, id DESC`
  );
  return query.all(empresaId) as EventoTributarioRecord[];
}

export function registrarCompraAutoUsoPersonal(input: {
  empresaId: number;
  fecha: string;
  precio: number;
  descripcion?: string;
}): EventoTributarioRecord {
  const empresaId = Number(input.empresaId);
  const fecha = (input.fecha || "").trim();
  const precio = Number(input.precio || 0);
  const tasa = 0.4;
  const impuesto = Number((precio * tasa).toFixed(2));
  const descripcion = (input.descripcion || "Compra de auto de uso personal para duenos").trim();

  if (!empresaId) {
    throw new Error("Debes seleccionar una empresa activa.");
  }
  if (!fecha || !Number.isFinite(precio) || precio <= 0) {
    throw new Error("Debes informar fecha y precio valido.");
  }

  if (sqliteUnavailable || !db) {
    fallbackLastEventoTributarioId += 1;
    const evento: EventoTributarioRecord = {
      id: fallbackLastEventoTributarioId,
      empresa_id: empresaId,
      fecha,
      tipo: "COMPRA_AUTO_USO_PERSONAL_40",
      base_imponible: Number(precio.toFixed(2)),
      tasa,
      impuesto,
      descripcion,
      created_at: new Date().toISOString()
    };
    fallbackEventosTributarios.push(evento);
    saveFallback();
    return evento;
  }

  const insert = getDb().prepare(
    `INSERT INTO EventoTributario (empresa_id, fecha, tipo, base_imponible, tasa, impuesto, descripcion)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const result = insert.run(
    empresaId,
    fecha,
    "COMPRA_AUTO_USO_PERSONAL_40",
    Number(precio.toFixed(2)),
    tasa,
    impuesto,
    descripcion
  );

  const id = Number(result.lastInsertRowid);
  const getOne = getDb().prepare(
    `SELECT id, empresa_id, fecha, tipo, base_imponible, tasa, impuesto, descripcion, created_at
     FROM EventoTributario
     WHERE id = ?`
  );
  const evento = getOne.get(id) as EventoTributarioRecord | undefined;
  if (!evento) {
    throw new Error("No se pudo recuperar el evento tributario.");
  }
  return evento;
}

// ── Auditoría de interpretaciones ────────────────────────────────────────────

function registrarAuditoria(input: {
  empresaId: number;
  fechaOperacion: string;
  textoOriginal: string;
  categoriaOperacion: string;
  tipoDocumento: string;
  modoIva: string;
  montoBase: number;
  montoNeto: number;
  montoIva: number;
  montoTotal: number;
  asientoId: number | null;
}): void {
  const now = new Date().toISOString();
  const fechaRegistro = now.slice(0, 10);

  if (sqliteUnavailable || !db) {
    fallbackLastAuditoriaId += 1;
    fallbackAuditoria.push({
      id: fallbackLastAuditoriaId,
      empresa_id: input.empresaId,
      fecha_registro: fechaRegistro,
      fecha_operacion: input.fechaOperacion,
      texto_original: input.textoOriginal,
      categoria_operacion: input.categoriaOperacion,
      tipo_documento: input.tipoDocumento,
      modo_iva: input.modoIva,
      monto_base: input.montoBase,
      monto_neto: input.montoNeto,
      monto_iva: input.montoIva,
      monto_total: input.montoTotal,
      asiento_id: input.asientoId,
      created_at: now
    });
    saveFallback();
    return;
  }

  const insert = getDb().prepare(`
    INSERT INTO RegistroInterpretacion
      (empresa_id, fecha_registro, fecha_operacion, texto_original, categoria_operacion,
       tipo_documento, modo_iva, monto_base, monto_neto, monto_iva, monto_total, asiento_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insert.run(
    input.empresaId,
    fechaRegistro,
    input.fechaOperacion,
    input.textoOriginal,
    input.categoriaOperacion,
    input.tipoDocumento,
    input.modoIva,
    input.montoBase,
    input.montoNeto,
    input.montoIva,
    input.montoTotal,
    input.asientoId
  );
}

export function listRegistrosAuditoria(empresaId: number): RegistroInterpretacionRecord[] {
  if (sqliteUnavailable || !db) {
    return fallbackAuditoria
      .filter((item) => item.empresa_id === empresaId)
      .sort((a, b) => b.id - a.id)
      .slice(0, 100);
  }

  return getDb().prepare(`
    SELECT id, empresa_id, fecha_registro, fecha_operacion, texto_original,
           categoria_operacion, tipo_documento, modo_iva,
           monto_base, monto_neto, monto_iva, monto_total, asiento_id, created_at
    FROM RegistroInterpretacion
    WHERE empresa_id = ?
    ORDER BY id DESC
    LIMIT 100
  `).all(empresaId) as RegistroInterpretacionRecord[];
}

function getRegistroAuditoriaPorAsiento(asientoId: number): RegistroInterpretacionRecord | null {
  if (sqliteUnavailable || !db) {
    return fallbackAuditoria
      .filter((item) => item.asiento_id === asientoId)
      .sort((a, b) => b.id - a.id)[0] ?? null;
  }

  return (
    getDb().prepare(
      `SELECT id, empresa_id, fecha_registro, fecha_operacion, texto_original,
              categoria_operacion, tipo_documento, modo_iva,
              monto_base, monto_neto, monto_iva, monto_total, asiento_id, created_at
       FROM RegistroInterpretacion
       WHERE asiento_id = ?
       ORDER BY id DESC
       LIMIT 1`
    ).get(asientoId) as RegistroInterpretacionRecord | undefined
  ) ?? null;
}

function updateAsientoExistente(input: {
  asientoId: number;
  descripcion: string;
  referencia: string | null;
  detalles: AsientoDetalleInput[];
}): AsientoRecord {
  const asientoId = Number(input.asientoId);
  const descripcion = input.descripcion.trim();
  const referencia = input.referencia?.trim() || null;
  const detalles = input.detalles;

  let totalDebe = 0;
  let totalHaber = 0;
  for (const linea of detalles) {
    totalDebe += Number(linea.debe || 0);
    totalHaber += Number(linea.haber || 0);
  }

  totalDebe = Number(totalDebe.toFixed(2));
  totalHaber = Number(totalHaber.toFixed(2));
  if (totalDebe <= 0 || totalHaber <= 0 || totalDebe !== totalHaber) {
    throw new Error("El asiento actualizado no cuadra: Debe y Haber deben ser iguales.");
  }

  if (sqliteUnavailable || !db) {
    const index = fallbackAsientos.findIndex((item) => item.id === asientoId);
    if (index === -1) {
      throw new Error("El asiento no existe.");
    }

    fallbackAsientos[index] = {
      ...fallbackAsientos[index],
      descripcion,
      referencia,
      total_debe: totalDebe,
      total_haber: totalHaber
    };
    fallbackAsientoDetalles = fallbackAsientoDetalles.filter((item) => item.asiento_id !== asientoId);
    for (const linea of detalles) {
      fallbackLastAsientoDetalleId += 1;
      fallbackAsientoDetalles.push({
        id: fallbackLastAsientoDetalleId,
        asiento_id: asientoId,
        cuenta_id: Number(linea.cuentaId),
        debe: Number(linea.debe || 0),
        haber: Number(linea.haber || 0),
        detalle: linea.detalle?.trim() || null
      });
    }
    saveFallback();
    return fallbackAsientos[index];
  }

  const updateAsiento = getDb().prepare(
    `UPDATE Asiento
     SET descripcion = ?, referencia = ?
     WHERE id = ?`
  );
  updateAsiento.run(descripcion, referencia, asientoId);

  const deleteDetalles = getDb().prepare("DELETE FROM AsientoDetalle WHERE asiento_id = ?");
  deleteDetalles.run(asientoId);

  const insertDetalle = getDb().prepare(
    `INSERT INTO AsientoDetalle (asiento_id, cuenta_id, debe, haber, detalle)
     VALUES (?, ?, ?, ?, ?)`
  );
  for (const linea of detalles) {
    insertDetalle.run(
      asientoId,
      Number(linea.cuentaId),
      Number(linea.debe || 0),
      Number(linea.haber || 0),
      linea.detalle?.trim() || null
    );
  }

  const getOne = getDb().prepare(
    `SELECT a.id, a.empresa_id, a.fecha, a.descripcion, a.referencia, a.created_at,
      COALESCE(SUM(ad.debe), 0) AS total_debe,
      COALESCE(SUM(ad.haber), 0) AS total_haber
     FROM Asiento a
     LEFT JOIN AsientoDetalle ad ON ad.asiento_id = a.id
     WHERE a.id = ?
     GROUP BY a.id`
  );

  const asiento = getOne.get(asientoId) as AsientoRecord | undefined;
  if (!asiento) {
    throw new Error("No se pudo recuperar el asiento actualizado.");
  }
  return asiento;
}

export function getAsientoDocumentoEditable(asientoId: number): AsientoDocumentoEditable {
  const auditoria = getRegistroAuditoriaPorAsiento(asientoId);
  if (!auditoria) {
    throw new Error("No existe auditoria asociada para editar este asiento.");
  }

  const tipoOperacion = inferirTipoOperacionDesdeCategoria(auditoria.categoria_operacion);
  return {
    asientoId,
    fecha: auditoria.fecha_operacion,
    descripcion: auditoria.texto_original,
    textoOriginal: auditoria.texto_original,
    categoriaOperacion: auditoria.categoria_operacion,
    tipoDocumentoActual: auditoria.tipo_documento,
    opcionesDocumento: getOpcionesDocumentoPorTipo(tipoOperacion)
  };
}

export function getHistorialCambiosAsiento(asientoId: number): AsientoHistorialCambio[] {
  if (sqliteUnavailable || !db) {
    return fallbackAuditoria
      .filter((item) => item.asiento_id === asientoId)
      .sort((a, b) => b.id - a.id)
      .map((item) => ({
        id: item.id,
        fecha_registro: item.fecha_registro,
        fecha_operacion: item.fecha_operacion,
        tipo_documento: item.tipo_documento,
        modo_iva: item.modo_iva,
        monto_total: item.monto_total,
        created_at: item.created_at
      }));
  }

  return getDb().prepare(
    `SELECT id, fecha_registro, fecha_operacion, tipo_documento, modo_iva, monto_total, created_at
     FROM RegistroInterpretacion
     WHERE asiento_id = ?
     ORDER BY id DESC`
  ).all(asientoId) as AsientoHistorialCambio[];
}

export function updateAsientoDocumento(input: {
  asientoId: number;
  tipoDocumento: TipoDocumentoTributario;
}): AsientoRecord {
  const asientoId = Number(input.asientoId);
  const tipoDocumento = input.tipoDocumento;

  if (!asientoId) {
    throw new Error("Asiento no valido.");
  }
  if (tipoDocumento === "DESCONOCIDO") {
    throw new Error("Debes indicar un documento valido.");
  }

  const auditoria = getRegistroAuditoriaPorAsiento(asientoId);
  if (!auditoria) {
    throw new Error("No existe auditoria asociada para editar este asiento.");
  }

  const empresaId = auditoria.empresa_id;
  const fecha = auditoria.fecha_operacion;
  const categoriaOperacion = auditoria.categoria_operacion as CategoriaOperacion;
  const tipoOperacion = inferirTipoOperacionDesdeCategoria(auditoria.categoria_operacion);
  const textoOriginal = auditoria.texto_original;
  const textoNormalizado = normalizarTextoOperacion(textoOriginal);
  const medioPago = detectarMedioPagoExtendido(textoNormalizado, tipoOperacion, categoriaOperacion);
  const montoBase = auditoria.monto_base;
  const modoIva = auditoria.modo_iva as ModoIva;

  const cuentaCaja = getCuentaPorCodigo(empresaId, "1.1.1.01");
  const cuentaBanco = getCuentaPorCodigo(empresaId, "1.1.1.02");
  const cuentaClientes = getCuentaPorCodigo(empresaId, "1.1.2.01");
  const cuentaInventario = getCuentaPorCodigo(empresaId, "1.1.3.01");
  const cuentaProveedor = getCuentaPorCodigo(empresaId, "2.1.1.01");
  const cuentaIvaDebito = getCuentaPorCodigo(empresaId, "2.1.2.01");
  const cuentaIvaCredito = getCuentaPorCodigo(empresaId, "2.1.2.02");
  const cuentaRetencion = getCuentaPorCodigo(empresaId, "2.1.2.03");
  const cuentaGastos = getCuentaPorCodigo(empresaId, "5.1.1.01");
  const cuentaHonorarios = getCuentaPorCodigo(empresaId, "5.1.1.02") || cuentaGastos;
  const cuentaSueldos = getCuentaPorCodigo(empresaId, "5.1.1.03") || cuentaGastos;
  const cuentaArriendo = getCuentaPorCodigo(empresaId, "5.1.2.01") || cuentaGastos;
  const cuentaServicios = getCuentaPorCodigo(empresaId, "5.1.2.02") || cuentaGastos;
  const cuentaIngresos = getCuentaPorCodigo(empresaId, "4.1.1.01");

  const cuentaContrapartida =
    medioPago === "CAJA" ? cuentaCaja :
    medioPago === "BANCO" ? cuentaBanco :
    medioPago === "CLIENTE" ? cuentaClientes :
    cuentaProveedor;

  if (!cuentaContrapartida) {
    throw new Error("Falta cuenta de contrapartida. Carga el plan base Chile primero.");
  }

  const aplicaIvaConfirmado = tipoOperacionAplicaIva(tipoOperacion) && documentoAplicaIva(tipoDocumento);
  const modoIvaConfirmado: ModoIva = aplicaIvaConfirmado
    ? (modoIva === "NO_APLICA" ? "IVA_INCLUIDO" : modoIva)
    : "NO_APLICA";
  const desglose = calcularDesgloseMontos(montoBase, aplicaIvaConfirmado, modoIvaConfirmado);
  const montoNeto = desglose.montoNeto;
  const montoIva = desglose.montoIva;
  const montoTotal = desglose.montoTotal;
  const detalles: AsientoDetalleInput[] = [];
  const cuentaGastoEspecifica =
    categoriaOperacion === "SUELDOS" ? cuentaSueldos :
    categoriaOperacion === "ARRIENDO" ? cuentaArriendo :
    categoriaOperacion === "SERVICIOS_BASICOS" ? cuentaServicios :
    cuentaGastos;

  if (tipoOperacion === "COMPRA_MERCADERIAS") {
    if (!cuentaInventario) throw new Error("Falta cuenta Inventario (1.1.3.01). Carga el plan base Chile.");
    if (tipoDocumento === "FACTURA" && cuentaIvaCredito) {
      detalles.push({ cuentaId: cuentaInventario.id, debe: montoNeto, haber: 0, detalle: "Compra segun factura (neto)" });
      detalles.push({ cuentaId: cuentaIvaCredito.id, debe: montoIva, haber: 0, detalle: "IVA credito fiscal 19%" });
    } else {
      detalles.push({ cuentaId: cuentaInventario.id, debe: montoTotal, haber: 0, detalle: tipoDocumento === "BOLETA" ? "Compra con boleta (sin credito IVA)" : "Compra sin credito IVA recuperable" });
    }
    detalles.push({ cuentaId: cuentaContrapartida.id, debe: 0, haber: montoTotal, detalle: medioPago === "PROVEEDOR" ? "Proveedor por pagar" : "Pago realizado" });
  } else if (tipoOperacion === "VENTA_MERCADERIAS") {
    if (!cuentaIngresos) throw new Error("Falta cuenta Ingresos por Ventas (4.1.1.01). Carga el plan base Chile.");
    if ((tipoDocumento === "FACTURA" || tipoDocumento === "BOLETA") && cuentaIvaDebito) {
      detalles.push({ cuentaId: cuentaContrapartida.id, debe: montoTotal, haber: 0, detalle: medioPago === "CLIENTE" ? "Cliente por cobrar" : "Cobro recibido" });
      detalles.push({ cuentaId: cuentaIngresos.id, debe: 0, haber: montoNeto, detalle: "Venta (neto)" });
      detalles.push({ cuentaId: cuentaIvaDebito.id, debe: 0, haber: montoIva, detalle: tipoDocumento === "FACTURA" ? "IVA debito fiscal 19% (factura)" : "IVA debito fiscal 19% (boleta)" });
    } else {
      detalles.push({ cuentaId: cuentaContrapartida.id, debe: montoTotal, haber: 0, detalle: "Cobro recibido" });
      detalles.push({ cuentaId: cuentaIngresos.id, debe: 0, haber: montoTotal, detalle: tipoDocumento === "SIN_DOCUMENTO" ? "Venta sin documento" : "Venta exenta o no afecta" });
    }
  } else if (tipoOperacion === "GASTO_SERVICIOS") {
    if (!cuentaGastoEspecifica) throw new Error("Falta cuenta de gasto. Carga el plan base Chile.");
    if (tipoDocumento === "FACTURA" && cuentaIvaCredito) {
      detalles.push({ cuentaId: cuentaGastoEspecifica.id, debe: montoNeto, haber: 0, detalle: `${describirCategoriaOperacion(categoriaOperacion)} segun factura (neto)` });
      detalles.push({ cuentaId: cuentaIvaCredito.id, debe: montoIva, haber: 0, detalle: "IVA credito fiscal 19%" });
    } else {
      detalles.push({ cuentaId: cuentaGastoEspecifica.id, debe: montoTotal, haber: 0, detalle: `${describirCategoriaOperacion(categoriaOperacion)}${tipoDocumento === "BOLETA" ? " con boleta" : ""}` });
    }
    detalles.push({ cuentaId: cuentaContrapartida.id, debe: 0, haber: montoTotal, detalle: medioPago === "PROVEEDOR" ? "Proveedor por pagar" : "Pago realizado" });
  } else if (tipoOperacion === "HONORARIOS") {
    if (!cuentaHonorarios) throw new Error("Falta cuenta de honorarios. Carga el plan base Chile.");
    const montoRetencion = round2(montoTotal * 0.1075);
    const montoLiquido = round2(montoTotal - montoRetencion);
    detalles.push({ cuentaId: cuentaHonorarios.id, debe: montoTotal, haber: 0, detalle: "Honorarios brutos (boleta de honorarios)" });
    if (cuentaRetencion) {
      detalles.push({ cuentaId: cuentaRetencion.id, debe: 0, haber: montoRetencion, detalle: "Retencion PPM 10.75% por pagar al SII" });
      detalles.push({ cuentaId: cuentaContrapartida.id, debe: 0, haber: montoLiquido, detalle: "Pago liquido al profesional" });
    } else {
      detalles.push({ cuentaId: cuentaContrapartida.id, debe: 0, haber: montoTotal, detalle: "Pago honorarios" });
    }
  } else if (tipoOperacion === "CAPITAL_INICIAL") {
    const cuentaCapital = getCuentaPorCodigo(empresaId, "3.1.1.01");
    if (!cuentaCapital) throw new Error("Falta cuenta de Capital (3.1.1.01). Carga el plan base Chile.");
    detalles.push({ cuentaId: cuentaCapital.id, debe: 0, haber: montoTotal, detalle: "Aporte de capital inicial" });
    detalles.push({ cuentaId: cuentaContrapartida.id, debe: montoTotal, haber: 0, detalle: "Ingreso de capital" });
  }

  const asientoActualizado = updateAsientoExistente({
    asientoId,
    descripcion: textoOriginal || `Registro: ${tipoOperacion}`,
    referencia: `DOC:${tipoDocumento}|OP:${tipoOperacion}`,
    detalles
  });

  registrarAuditoria({
    empresaId,
    fechaOperacion: fecha,
    textoOriginal,
    categoriaOperacion,
    tipoDocumento,
    modoIva: modoIvaConfirmado,
    montoBase,
    montoNeto: desglose.montoNeto,
    montoIva: desglose.montoIva,
    montoTotal: desglose.montoTotal,
    asientoId
  });

  return asientoActualizado;
}

// ── Libro Diario ──────────────────────────────────────────────────────────────

export function getAsientoDetalles(asientoId: number): AsientoDetalleConCuenta[] {
  if (sqliteUnavailable || !db) {
    const detalles = fallbackAsientoDetalles.filter((d) => d.asiento_id === asientoId);
    return detalles.map((d) => {
      const cuenta = fallbackCuentas.find((c) => c.id === d.cuenta_id);
      return {
        id: d.id,
        asiento_id: d.asiento_id,
        cuenta_id: d.cuenta_id,
        cuenta_codigo: cuenta?.codigo ?? "",
        cuenta_nombre: cuenta?.nombre ?? "Cuenta desconocida",
        debe: d.debe,
        haber: d.haber,
        detalle: d.detalle
      };
    });
  }

  return getDb().prepare(`
    SELECT ad.id, ad.asiento_id, ad.cuenta_id,
           cc.codigo AS cuenta_codigo, cc.nombre AS cuenta_nombre,
           ad.debe, ad.haber, ad.detalle
    FROM AsientoDetalle ad
    JOIN CuentaContable cc ON cc.id = ad.cuenta_id
    WHERE ad.asiento_id = ?
    ORDER BY ad.id ASC
  `).all(asientoId) as AsientoDetalleConCuenta[];
}

export function getLibroDiario(
  empresaId: number,
  fechaDesde?: string,
  fechaHasta?: string
): FilaLibroDiario[] {
  const asientos = listAsientos(empresaId).filter((a) => {
    if (fechaDesde && a.fecha < fechaDesde) return false;
    if (fechaHasta && a.fecha > fechaHasta) return false;
    return true;
  });

  return asientos.map((a) => ({
    asientoId: a.id,
    fecha: a.fecha,
    descripcion: a.descripcion,
    referencia: a.referencia,
    lineas: getAsientoDetalles(a.id)
  }));
}

// ── Libro Mayor ───────────────────────────────────────────────────────────────

export function getLibroMayor(empresaId: number, cuentaId: number): FilaLibroMayor[] {
  if (sqliteUnavailable || !db) {
    const detalles = fallbackAsientoDetalles.filter((d) => d.cuenta_id === cuentaId);
    let saldo = 0;
    return detalles
      .map((d) => {
        const asiento = fallbackAsientos.find((a) => a.id === d.asiento_id);
        saldo = round2(saldo + d.debe - d.haber);
        return {
          asientoId: d.asiento_id,
          fecha: asiento?.fecha ?? "",
          descripcion: asiento?.descripcion ?? "",
          debe: d.debe,
          haber: d.haber,
          saldo,
          detalle: d.detalle
        };
      })
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  }

  const rows = getDb().prepare(`
    SELECT ad.asiento_id, a.fecha, a.descripcion, ad.debe, ad.haber, ad.detalle
    FROM AsientoDetalle ad
    JOIN Asiento a ON a.id = ad.asiento_id
    WHERE ad.cuenta_id = ? AND a.empresa_id = ?
    ORDER BY a.fecha ASC, a.id ASC
  `).all(cuentaId, empresaId) as Array<{
    asiento_id: number;
    fecha: string;
    descripcion: string;
    debe: number;
    haber: number;
    detalle: string | null;
  }>;

  let saldo = 0;
  return rows.map((row) => {
    saldo = round2(saldo + row.debe - row.haber);
    return {
      asientoId: row.asiento_id,
      fecha: row.fecha,
      descripcion: row.descripcion,
      debe: row.debe,
      haber: row.haber,
      saldo,
      detalle: row.detalle
    };
  });
}

// ── Balance de Comprobación ───────────────────────────────────────────────────

export function getBalanceComprobacion(empresaId: number): FilaBalanceComprobacion[] {
  if (sqliteUnavailable || !db) {
    const cuentas = listCuentasContables(empresaId);
    return cuentas
      .map((c) => {
        const detalles = fallbackAsientoDetalles.filter((d) => d.cuenta_id === c.id);
        const totalDebe = round2(detalles.reduce((sum, d) => sum + d.debe, 0));
        const totalHaber = round2(detalles.reduce((sum, d) => sum + d.haber, 0));
        const saldo = round2(totalDebe - totalHaber);
        return {
          cuentaId: c.id,
          codigo: c.codigo,
          nombre: c.nombre,
          tipo: c.tipo,
          naturaleza: c.naturaleza,
          totalDebe,
          totalHaber,
          saldoDeudor: saldo > 0 ? saldo : 0,
          saldoAcreedor: saldo < 0 ? Math.abs(saldo) : 0
        };
      })
      .filter((f) => f.totalDebe > 0 || f.totalHaber > 0);
  }

  const rows = getDb().prepare(`
    SELECT cc.id AS cuentaId, cc.codigo, cc.nombre, cc.tipo, cc.naturaleza,
           COALESCE(SUM(ad.debe), 0) AS totalDebe,
           COALESCE(SUM(ad.haber), 0) AS totalHaber
    FROM CuentaContable cc
    LEFT JOIN AsientoDetalle ad ON ad.cuenta_id = cc.id
    LEFT JOIN Asiento a ON a.id = ad.asiento_id AND a.empresa_id = cc.empresa_id
    WHERE cc.empresa_id = ?
    GROUP BY cc.id
    HAVING totalDebe > 0 OR totalHaber > 0
    ORDER BY cc.codigo ASC
  `).all(empresaId) as Array<{
    cuentaId: number;
    codigo: string;
    nombre: string;
    tipo: string;
    naturaleza: string;
    totalDebe: number;
    totalHaber: number;
  }>;

  return rows.map((r) => {
    const saldo = round2(r.totalDebe - r.totalHaber);
    return {
      ...r,
      saldoDeudor: saldo > 0 ? saldo : 0,
      saldoAcreedor: saldo < 0 ? Math.abs(saldo) : 0
    };
  });
}

// ── Exportación CSV ───────────────────────────────────────────────────────────

export function generarLibroDiarioCSV(
  empresaId: number,
  fechaDesde?: string,
  fechaHasta?: string
): string {
  const filas = getLibroDiario(empresaId, fechaDesde, fechaHasta);
  const lineas: string[] = [
    "Asiento ID,Fecha,Descripcion,Codigo Cuenta,Nombre Cuenta,Debe,Haber,Detalle"
  ];
  for (const fila of filas) {
    for (const linea of fila.lineas) {
      lineas.push(
        [
          fila.asientoId,
          fila.fecha,
          `"${fila.descripcion.replace(/"/g, '""')}"`,
          linea.cuenta_codigo,
          `"${linea.cuenta_nombre.replace(/"/g, '""')}"`,
          linea.debe.toFixed(2),
          linea.haber.toFixed(2),
          `"${(linea.detalle || "").replace(/"/g, '""')}"`
        ].join(",")
      );
    }
  }
  return lineas.join("\n");
}

export function generarBalanceComprobacionCSV(empresaId: number): string {
  const filas = getBalanceComprobacion(empresaId);
  const lineas: string[] = [
    "Codigo,Nombre,Tipo,Naturaleza,Total Debe,Total Haber,Saldo Deudor,Saldo Acreedor"
  ];
  for (const fila of filas) {
    lineas.push(
      [
        fila.codigo,
        `"${fila.nombre.replace(/"/g, '""')}"`,
        fila.tipo,
        fila.naturaleza,
        fila.totalDebe.toFixed(2),
        fila.totalHaber.toFixed(2),
        fila.saldoDeudor.toFixed(2),
        fila.saldoAcreedor.toFixed(2)
      ].join(",")
    );
  }
  return lineas.join("\n");
}
