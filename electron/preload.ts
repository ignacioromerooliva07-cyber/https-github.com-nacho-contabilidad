import { contextBridge, ipcRenderer } from "electron";

const appInfo = ipcRenderer.sendSync("app:get-info-sync") as {
  appName: string;
  version: string;
  currentUser: string;
  creatorMode: boolean;
  isPackaged: boolean;
  storageMode: "sqlite" | "fallback";
  userDataPath: string;
  databasePath: string;
  fallbackPath: string;
};

contextBridge.exposeInMainWorld("appInfo", {
  appName: appInfo.appName,
  version: appInfo.version,
  currentUser: appInfo.currentUser,
  creatorMode: appInfo.creatorMode
});

contextBridge.exposeInMainWorld("contabilidadApi", {
  listEmpresas: () => ipcRenderer.invoke("empresa:list"),
  createEmpresa: (input: {
    nombre: string;
    rut?: string | null;
    cuit?: string | null;
    moneda?: string;
    giro?: string | null;
  }) =>
    ipcRenderer.invoke("empresa:create", input),
  updateEmpresa: (input: {
    id: number;
    nombre: string;
    rut?: string | null;
    cuit?: string | null;
    moneda?: string;
    giro?: string | null;
  }) => ipcRenderer.invoke("empresa:update", input),
  deleteEmpresa: (id: number) => ipcRenderer.invoke("empresa:delete", id),
  getEmpresaActiva: () => ipcRenderer.invoke("empresa:get-activa"),
  setEmpresaActiva: (id: number | null) => ipcRenderer.invoke("empresa:set-activa", id),
  listSocios: (empresaId: number) => ipcRenderer.invoke("socio:list", empresaId),
  createSocio: (input: {
    empresaId: number;
    nombre: string;
    aporteInicial?: number;
    participacion?: number;
  }) => ipcRenderer.invoke("socio:create", input),
  updateSocio: (input: {
    id: number;
    nombre: string;
    aporteInicial?: number;
    participacion?: number;
  }) => ipcRenderer.invoke("socio:update", input),
  deleteSocio: (id: number) => ipcRenderer.invoke("socio:delete", id),
  listCuentas: (empresaId: number) => ipcRenderer.invoke("cuenta:list", empresaId),
  createCuenta: (input: {
    empresaId: number;
    codigo: string;
    nombre: string;
    tipo: string;
    naturaleza: string;
  }) => ipcRenderer.invoke("cuenta:create", input),
  updateNombreCuenta: (input: { cuentaId: number; nombre: string }) =>
    ipcRenderer.invoke("cuenta:update-nombre", input),
  seedPlanCuentasChile: (empresaId: number) => ipcRenderer.invoke("cuenta:seed-chile", empresaId),
  listAsientos: (empresaId: number) => ipcRenderer.invoke("asiento:list", empresaId),
  registrarOperacionAutomatica: (input: {
    empresaId: number;
    fecha: string;
    tipo: "COMPRA_MERCADERIAS" | "VENTA_MERCADERIAS" | "GASTO_SERVICIOS";
    montoTotal: number;
    incluyeIva: boolean;
    medioPago: "CAJA" | "BANCO" | "PROVEEDOR" | "CLIENTE";
    descripcion?: string;
  }) => ipcRenderer.invoke("operacion:auto", input),
  registrarOperacionDesdeTexto: (input: {
    empresaId: number;
    fecha: string;
    texto: string;
    asumirIvaSiNoSeIndica?: boolean;
  }) => ipcRenderer.invoke("operacion:auto-texto", input),
  interpretarOperacion: (input: {
    empresaId: number;
    fecha: string;
    texto: string;
  }) => ipcRenderer.invoke("operacion:interpretar", input),
  confirmarOperacion: (input: {
    empresaId: number;
    fecha: string;
    interpretacion: {
      tipoOperacion: string;
      tipoDocumento: string;
      montoTotal: number;
      medioPago: string;
      textoOriginal: string;
    };
  }) => ipcRenderer.invoke("operacion:confirmar-texto", input),
  listAuditoria: (empresaId: number) => ipcRenderer.invoke("auditoria:list", empresaId),
  getAsientoDetalles: (asientoId: number) => ipcRenderer.invoke("asiento:detalles", asientoId),
  getAsientoDocumentoEditable: (asientoId: number) => ipcRenderer.invoke("asiento:get-documento-editable", asientoId),
  getAsientoHistorial: (asientoId: number) => ipcRenderer.invoke("asiento:get-historial", asientoId),
  updateAsientoDocumento: (input: { asientoId: number; tipoDocumento: string }) =>
    ipcRenderer.invoke("asiento:update-documento", input),
  getLibroDiario: (input: { empresaId: number; fechaDesde?: string; fechaHasta?: string }) =>
    ipcRenderer.invoke("libro:diario", input),
  getLibroMayor: (input: { empresaId: number; cuentaId: number }) =>
    ipcRenderer.invoke("libro:mayor", input),
  getBalanceComprobacion: (empresaId: number) => ipcRenderer.invoke("balance:comprobacion", empresaId),
  getIndicadoresEconomicos: () => ipcRenderer.invoke("indicadores:economicos"),
  getSupportInfo: () => Promise.resolve(appInfo),
  getUpdateState: () => ipcRenderer.invoke("app:update-state"),
  checkForUpdatesNow: () => ipcRenderer.invoke("app:update-check"),
  installDownloadedUpdate: () => ipcRenderer.invoke("app:update-install"),
  askCopilotIa: (input: {
    message: string;
    empresaId?: number | null;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  }) => ipcRenderer.invoke("copilot:ask", input),
  onUpdateStatus: (callback: (state: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload);
    ipcRenderer.on("update:status", listener);
    return () => {
      ipcRenderer.removeListener("update:status", listener);
    };
  },
  createBackup: () => ipcRenderer.invoke("app:create-backup"),
  openDataFolder: () => ipcRenderer.invoke("app:open-data-folder"),
  exportarCSVLibroDiario: (input: { empresaId: number; fechaDesde?: string; fechaHasta?: string }) =>
    ipcRenderer.invoke("exportar:csv-libro-diario", input),
  exportarCSVBalance: (empresaId: number) => ipcRenderer.invoke("exportar:csv-balance", empresaId)
});
