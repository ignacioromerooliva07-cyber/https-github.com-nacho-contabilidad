/// <reference types="vite/client" />

declare global {
  interface Empresa {
    id: number;
    nombre: string;
    rut: string | null;
    moneda: string;
    giro: string | null;
    created_at: string;
  }

  interface CuentaContable {
    id: number;
    empresa_id: number;
    codigo: string;
    nombre: string;
    tipo: string;
    naturaleza: string;
    activa: number;
  }

  interface SocioEmpresa {
    id: number;
    empresa_id: number;
    nombre: string;
    aporte_inicial: number;
    participacion: number;
    created_at: string;
  }

  interface Asiento {
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

  interface OperacionTextoResultado {
    asiento: Asiento;
    interpretacion: {
      tipo: "COMPRA_MERCADERIAS" | "VENTA_MERCADERIAS" | "GASTO_SERVICIOS" | "CAPITAL_INICIAL";
      montoTotal: number;
      incluyeIva: boolean;
      medioPago: "CAJA" | "BANCO" | "PROVEEDOR" | "CLIENTE";
      textoNormalizado: string;
    };
  }

  interface InterpretacionTexto {
    tipoOperacion: "COMPRA_MERCADERIAS" | "VENTA_MERCADERIAS" | "GASTO_SERVICIOS" | "HONORARIOS" | "CAPITAL_INICIAL";
    categoriaOperacion:
      | "COMPRA_GENERAL"
      | "VENTA_GENERAL"
      | "GASTO_GENERAL"
      | "SUELDOS"
      | "ARRIENDO"
      | "SERVICIOS_BASICOS"
      | "HONORARIOS"
      | "CAPITAL_INICIAL";
    tipoDocumento:
      | "FACTURA"
      | "FACTURA_EXENTA"
      | "BOLETA"
      | "BOLETA_EXENTA"
      | "BOLETA_HONORARIOS"
      | "SIN_DOCUMENTO"
      | "DESCONOCIDO";
    modoIva: "NO_APLICA" | "IVA_INCLUIDO" | "MAS_IVA";
    montoBase: number;
    montoNeto: number;
    montoIva: number;
    montoTotal: number;
    medioPago: "CAJA" | "BANCO" | "PROVEEDOR" | "CLIENTE";
    textoOriginal: string;
    aplicaIva: boolean;
    resumenTributario: string;
    mensajeCopilot?: string;
    componentesCapital?: Array<{
      nombre: string;
      monto: number;
      cuentaCodigo: string;
      cuentaNombre: string;
    }>;
  }

  interface OperacionPendiente {
    empresaId: number;
    fecha: string;
    interpretacion: InterpretacionTexto;
    necesitaConfirmacion: boolean;
    pregunta: string;
    opcionesDocumento: Array<{ valor: string; etiqueta: string; descripcion: string }>;
  }

  interface RegistroAuditoria {
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

  interface AsientoDetalleConCuenta {
    id: number;
    asiento_id: number;
    cuenta_id: number;
    cuenta_codigo: string;
    cuenta_nombre: string;
    debe: number;
    haber: number;
    detalle: string | null;
  }

  interface AsientoDocumentoEditable {
    asientoId: number;
    fecha: string;
    descripcion: string;
    textoOriginal: string;
    categoriaOperacion: string;
    tipoDocumentoActual: string;
    opcionesDocumento: Array<{ valor: string; etiqueta: string; descripcion: string }>;
  }

  interface AsientoHistorialCambio {
    id: number;
    fecha_registro: string;
    fecha_operacion: string;
    tipo_documento: string;
    modo_iva: string;
    monto_total: number;
    created_at: string;
  }

  interface FilaLibroDiario {
    asientoId: number;
    fecha: string;
    descripcion: string;
    referencia: string | null;
    lineas: AsientoDetalleConCuenta[];
  }

  interface FilaLibroMayor {
    asientoId: number;
    fecha: string;
    descripcion: string;
    debe: number;
    haber: number;
    saldo: number;
    detalle: string | null;
  }

  interface FilaBalanceComprobacion {
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

  interface IndicadoresEconomicos {
    dolar: number | null;
    euro: number | null;
    uf: number | null;
    utm: number | null;
    ipc: number | null;
    tpm: number | null;
    fecha: string;
    fuente: string;
    estado: "en-vivo" | "cache-memoria" | "cache-disco" | "sin-conexion";
  }

  interface SupportInfo {
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
  }

  interface AppUpdateState {
    enabled: boolean;
    provider: "generic" | "github" | "disabled";
    feedUrl: string | null;
    status: "disabled" | "idle" | "checking" | "available" | "downloading" | "downloaded" | "installing" | "error";
    currentVersion: string;
    latestVersion: string | null;
    downloadPercent: number | null;
    releaseNotes: string[];
    lastCheckedAt: string | null;
    lastError: string | null;
  }

  interface BackupResult {
    ok: boolean;
    filePath?: string;
    storageMode: "sqlite" | "fallback";
  }

  interface CopilotChatMessage {
    role: "user" | "assistant";
    content: string;
    createdAt: string;
  }

  interface CopilotAskResult {
    answer: string;
    suggestedActions: string[];
    confidence: "alta" | "media";
  }

  interface Window {
    appInfo: {
      appName: string;
      version: string;
      currentUser: string;
      creatorMode: boolean;
    };
    contabilidadApi: {
      listEmpresas: () => Promise<Empresa[]>;
      createEmpresa: (input: {
        nombre: string;
        rut?: string | null;
        cuit?: string | null;
        moneda?: string;
        giro?: string | null;
      }) => Promise<Empresa>;
      updateEmpresa: (input: {
        id: number;
        nombre: string;
        rut?: string | null;
        cuit?: string | null;
        moneda?: string;
        giro?: string | null;
      }) => Promise<Empresa>;
      deleteEmpresa: (id: number) => Promise<{ ok: boolean }>;
      getEmpresaActiva: () => Promise<number | null>;
      setEmpresaActiva: (id: number | null) => Promise<{ ok: boolean }>;
      listSocios: (empresaId: number) => Promise<SocioEmpresa[]>;
      createSocio: (input: {
        empresaId: number;
        nombre: string;
        aporteInicial?: number;
        participacion?: number;
      }) => Promise<SocioEmpresa>;
      updateSocio: (input: {
        id: number;
        nombre: string;
        aporteInicial?: number;
        participacion?: number;
      }) => Promise<SocioEmpresa>;
      deleteSocio: (id: number) => Promise<{ ok: boolean }>;
      listCuentas: (empresaId: number) => Promise<CuentaContable[]>;
      createCuenta: (input: {
        empresaId: number;
        codigo: string;
        nombre: string;
        tipo: string;
        naturaleza: string;
      }) => Promise<CuentaContable>;
      updateNombreCuenta: (input: { cuentaId: number; nombre: string }) => Promise<CuentaContable>;
      seedPlanCuentasChile: (empresaId: number) => Promise<{ creadas: number }>;
      listAsientos: (empresaId: number) => Promise<Asiento[]>;
      registrarOperacionAutomatica: (input: {
        empresaId: number;
        fecha: string;
        tipo: "COMPRA_MERCADERIAS" | "VENTA_MERCADERIAS" | "GASTO_SERVICIOS";
        montoTotal: number;
        incluyeIva: boolean;
        medioPago: "CAJA" | "BANCO" | "PROVEEDOR" | "CLIENTE";
        descripcion?: string;
      }) => Promise<Asiento>;
      registrarOperacionDesdeTexto: (input: {
        empresaId: number;
        fecha: string;
        texto: string;
        asumirIvaSiNoSeIndica?: boolean;
      }) => Promise<OperacionTextoResultado>;
      interpretarOperacion: (input: {
        empresaId: number;
        fecha: string;
        texto: string;
      }) => Promise<OperacionPendiente>;
      confirmarOperacion: (input: {
        empresaId: number;
        fecha: string;
        interpretacion: InterpretacionTexto;
      }) => Promise<Asiento>;
      listAuditoria: (empresaId: number) => Promise<RegistroAuditoria[]>;
      getAsientoDetalles: (asientoId: number) => Promise<AsientoDetalleConCuenta[]>;
      getAsientoDocumentoEditable: (asientoId: number) => Promise<AsientoDocumentoEditable>;
      getAsientoHistorial: (asientoId: number) => Promise<AsientoHistorialCambio[]>;
      updateAsientoDocumento: (input: { asientoId: number; tipoDocumento: string }) => Promise<Asiento>;
      getLibroDiario: (input: { empresaId: number; fechaDesde?: string; fechaHasta?: string }) => Promise<FilaLibroDiario[]>;
      getLibroMayor: (input: { empresaId: number; cuentaId: number }) => Promise<FilaLibroMayor[]>;
      getBalanceComprobacion: (empresaId: number) => Promise<FilaBalanceComprobacion[]>;
      getIndicadoresEconomicos: () => Promise<IndicadoresEconomicos>;
      getSupportInfo: () => Promise<SupportInfo>;
      getUpdateState: () => Promise<AppUpdateState>;
      checkForUpdatesNow: () => Promise<{ ok: boolean; message: string }>;
      installDownloadedUpdate: () => Promise<{ ok: boolean; message: string }>;
      askCopilotIa: (input: {
        message: string;
        empresaId?: number | null;
        history?: Array<{ role: "user" | "assistant"; content: string }>;
      }) => Promise<CopilotAskResult>;
      onUpdateStatus: (callback: (state: AppUpdateState) => void) => () => void;
      createBackup: () => Promise<BackupResult>;
      openDataFolder: () => Promise<{ ok: boolean; error?: string }>;
      exportarCSVLibroDiario: (input: { empresaId: number; fechaDesde?: string; fechaHasta?: string }) => Promise<{ ok: boolean; filePath?: string }>;
      exportarCSVBalance: (empresaId: number) => Promise<{ ok: boolean; filePath?: string }>;
    };
  }
}

export {};
