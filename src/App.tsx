import { FormEvent, Fragment, useCallback, useEffect, useMemo, useState } from "react";

type Vista =
  | "principal"
  | "soporte"
  | "libro-diario"
  | "libro-mayor"
  | "balance"
  | "estado-resultados"
  | "socios"
  | "tributario"
  | "auditoria";

type ItemCuadro = {
  tipo: "titulo" | "cuenta" | "subtotal" | "total" | "vacio";
  etiqueta: string;
  monto?: number;
};

type LineaFormulario = {
  linea: string;
  concepto: string;
  monto: number;
  soporte: string;
};

type EstadoControl = "ok" | "aviso" | "critico";

type ControlCumplimiento = {
  estado: EstadoControl;
  titulo: string;
  detalle: string;
};

type HallazgoAuditoria = {
  estado: EstadoControl;
  titulo: string;
  detalle: string;
  recomendacion: string;
  cantidad?: number;
};

type ResumenAuditoriaInteligente = {
  score: number;
  estadoGeneral: EstadoControl;
  totalRegistros: number;
  montoObservado: number;
  porcentajeDocumentado: number;
  cantidadAjustados: number;
  registrosSinDocumento: number;
  hallazgos: HallazgoAuditoria[];
  fortalezas: string[];
  recomendaciones: string[];
  resumenNarrativo: string;
};

type PreguntaAuditoriaCopiloto = {
  id: string;
  pregunta: string;
  detalle: string;
  accion: "edit-doc" | "view-history";
  accionLabel: string;
  asientoId: number;
};

type MemoriaPatronAuditoria = {
  clave: string;
  titulo: string;
  detalle: string;
  veces: number;
  maximo: number;
  ultimaCantidad: number;
  updatedAt: string;
};

type MemoriaAuditoriaEmpresa = {
  empresaId: number;
  ultimaHuella: string;
  patrones: MemoriaPatronAuditoria[];
};

type CasoAuditoriaCopiloto = {
  id: string;
  prioridad: number;
  estado: EstadoControl;
  titulo: string;
  detalle: string;
  asientoId: number;
  monto: number;
  accionPrincipal: string;
  accionSecundaria: string;
};

type TareaCierreAuditoria = {
  id: string;
  estado: EstadoControl;
  titulo: string;
  detalle: string;
};

type CatalogoAnual = {
  f29: Record<string, string>;
  f22: Record<string, string>;
};

const CATALOGO_TRIBUTARIO_ANUAL: Record<string, CatalogoAnual> = {
  "2026": {
    f29: {
      "F29-IVA-DB": "F29-L01",
      "F29-IVA-CR": "F29-L02",
      "F29-IVA-NETO": "F29-L03",
      "F29-RET-HON": "F29-L04",
      "F29-PPM": "F29-L05"
    },
    f22: {
      "F22-RES-ING": "F22-L01",
      "F22-RES-GAS": "F22-L02",
      "F22-RLI": "F22-L03",
      "F22-IDPC": "F22-L04",
      "F22-BASE-GC": "F22-L05"
    }
  },
  "2027": {
    f29: {
      "F29-IVA-DB": "F29-L01",
      "F29-IVA-CR": "F29-L02",
      "F29-IVA-NETO": "F29-L03",
      "F29-RET-HON": "F29-L04",
      "F29-PPM": "F29-L05"
    },
    f22: {
      "F22-RES-ING": "F22-L01",
      "F22-RES-GAS": "F22-L02",
      "F22-RLI": "F22-L03",
      "F22-IDPC": "F22-L04",
      "F22-BASE-GC": "F22-L05"
    }
  }
};

export default function App(): JSX.Element {
  const [ahora, setAhora] = useState(() => new Date());
  const [indicadores, setIndicadores] = useState<IndicadoresEconomicos | null>(null);
  const [indicadoresError, setIndicadoresError] = useState<string | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaActivaId, setEmpresaActivaId] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [rut, setRut] = useState("");
  const [moneda, setMoneda] = useState("CLP");
  const [giro, setGiro] = useState("");
  const [giroPersonalizado, setGiroPersonalizado] = useState("");
  const [cuentas, setCuentas] = useState<CuentaContable[]>([]);
  const [asientos, setAsientos] = useState<Asiento[]>([]);
  const [codigoCuenta, setCodigoCuenta] = useState("");
  const [nombreCuenta, setNombreCuenta] = useState("");
  const [tipoCuenta, setTipoCuenta] = useState("ACTIVO");
  const [naturalezaCuenta, setNaturalezaCuenta] = useState("DEUDORA");
  const [fechaOperacion, setFechaOperacion] = useState(() => new Date().toISOString().slice(0, 10));
  const [textoOperacion, setTextoOperacion] = useState("");
  const [pendienteConfirmacion, setPendienteConfirmacion] = useState<OperacionPendiente | null>(null);
  const [analizando, setAnalizando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [nombreEmpresaActiva, setNombreEmpresaActiva] = useState("");
  const [rutEmpresaActiva, setRutEmpresaActiva] = useState("");
  const [monedaEmpresaActiva, setMonedaEmpresaActiva] = useState("CLP");
  const [giroEmpresaActiva, setGiroEmpresaActiva] = useState("");
  const [giroPersonalizadoActiva, setGiroPersonalizadoActiva] = useState("");
  const [guardandoEmpresaActiva, setGuardandoEmpresaActiva] = useState(false);
  const [guardandoCuenta, setGuardandoCuenta] = useState(false);
  const [editandoCuentaId, setEditandoCuentaId] = useState<number | null>(null);
  const [editandoNombreCuenta, setEditandoNombreCuenta] = useState("");
  const [guardandoEdicionCuenta, setGuardandoEdicionCuenta] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [mensajeInfo, setMensajeInfo] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>("principal");
  const [auditoria, setAuditoria] = useState<RegistroAuditoria[]>([]);
  const [libroDiario, setLibroDiario] = useState<FilaLibroDiario[]>([]);
  const [libroMayor, setLibroMayor] = useState<FilaLibroMayor[]>([]);
  const [balance, setBalance] = useState<FilaBalanceComprobacion[]>([]);
  const [vistaBalance, setVistaBalance] = useState<"general" | "comprobacion">("general");
  const [regimenTributario, setRegimenTributario] = useState<"14D3" | "14D8" | "SEMI">("14D3");
  const [tasaPpm, setTasaPpm] = useState(1);
  const [periodoMes, setPeriodoMes] = useState(() => String(new Date().getMonth() + 1));
  const [periodoAnio, setPeriodoAnio] = useState(() => String(new Date().getFullYear()));
  const [revisorTributario, setRevisorTributario] = useState("");
  const [fechaRevisionTributaria, setFechaRevisionTributaria] = useState(() => new Date().toISOString().slice(0, 10));
  const [confirmacionRevision, setConfirmacionRevision] = useState(false);
  const [participacionSocio, setParticipacionSocio] = useState(100);
  const [sociosEmpresaActiva, setSociosEmpresaActiva] = useState<SocioEmpresa[]>([]);
  const [nombreSocio, setNombreSocio] = useState("");
  const [aporteSocio, setAporteSocio] = useState("");
  const [participacionNuevoSocio, setParticipacionNuevoSocio] = useState("");
  const [editandoSocioId, setEditandoSocioId] = useState<number | null>(null);
  const [editandoNombreSocio, setEditandoNombreSocio] = useState("");
  const [editandoAporteSocio, setEditandoAporteSocio] = useState("");
  const [editandoParticipacionSocio, setEditandoParticipacionSocio] = useState("");
  const [indiceSocioGlobal, setIndiceSocioGlobal] = useState(0);
  const [otrosIngresosGlobal, setOtrosIngresosGlobal] = useState(0);
  const [cuentaMayorId, setCuentaMayorId] = useState<number | null>(null);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [cargandoReporte, setCargandoReporte] = useState(false);
  const [asientoAbierto, setAsientoAbierto] = useState<number | null>(null);
  const [asientoLineas, setAsientoLineas] = useState<Record<number, AsientoDetalleConCuenta[]>>({});
  const [edicionAsientoDocumento, setEdicionAsientoDocumento] = useState<AsientoDocumentoEditable | null>(null);
  const [tipoDocumentoEdicion, setTipoDocumentoEdicion] = useState("");
  const [guardandoDocumentoAsiento, setGuardandoDocumentoAsiento] = useState(false);
  const [historialAsientoAbierto, setHistorialAsientoAbierto] = useState<number | null>(null);
  const [historialAsientos, setHistorialAsientos] = useState<Record<number, AsientoHistorialCambio[]>>({});
  const [cargandoHistorialAsientoId, setCargandoHistorialAsientoId] = useState<number | null>(null);
  const [memoriaAuditoriaEmpresa, setMemoriaAuditoriaEmpresa] = useState<MemoriaAuditoriaEmpresa | null>(null);
  const [supportInfo, setSupportInfo] = useState<SupportInfo | null>(null);
  const [creandoRespaldo, setCreandoRespaldo] = useState(false);
  const [abriendoCarpetaDatos, setAbriendoCarpetaDatos] = useState(false);
  const [updateState, setUpdateState] = useState<AppUpdateState | null>(null);
  const [buscandoActualizacion, setBuscandoActualizacion] = useState(false);
  const [instalandoActualizacion, setInstalandoActualizacion] = useState(false);

  const empresaActiva = useMemo(
    () => empresas.find((empresa) => empresa.id === empresaActivaId) ?? null,
    [empresas, empresaActivaId]
  );

  const totalAportesSocios = useMemo(
    () => sociosEmpresaActiva.reduce((sum, socio) => sum + socio.aporte_inicial, 0),
    [sociosEmpresaActiva]
  );

  const totalParticipacionSocios = useMemo(
    () => sociosEmpresaActiva.reduce((sum, socio) => sum + socio.participacion, 0),
    [sociosEmpresaActiva]
  );

  const socioSeleccionadoGlobal = useMemo(() => {
    if (sociosEmpresaActiva.length === 0) return null;
    return sociosEmpresaActiva[indiceSocioGlobal] ?? sociosEmpresaActiva[0];
  }, [sociosEmpresaActiva, indiceSocioGlobal]);

  const participacionGlobalAplicada = socioSeleccionadoGlobal
    ? socioSeleccionadoGlobal.participacion
    : participacionSocio;

  const giroActivoTexto = empresaActiva?.giro || "sin giro definido";

  const fechaHoraActual = useMemo(() => {
    const fecha = ahora.toLocaleDateString("es-CL", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
    const hora = ahora.toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    return { fecha, hora };
  }, [ahora]);

  const fuenteIndicadoresLegible = useMemo(() => {
    if (!indicadores?.fuente) return "Sin fuente";
    const fuente = indicadores.fuente;

    if (fuente.includes("SII(UTM/IPC) + mindicador.cl")) {
      return "UTM/IPC: SII | UF/Divisas/TPM: Banco Central";
    }
    if (fuente.startsWith("SII(")) {
      return "Fuente oficial SII (UTM/IPC)";
    }
    if (fuente.includes("mindicador.cl")) {
      return "Banco Central de Chile";
    }
    if (fuente.includes("sin-conexion")) {
      return "Sin conexion";
    }

    return fuente;
  }, [indicadores]);

  const fmtMonto = (n: number): string =>
    n.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtMontoContable = (n: number): string =>
    n < 0 ? `(${fmtMonto(Math.abs(n))})` : fmtMonto(n);

  const labelDocumentoDesdeReferencia = (referencia: string | null): string => {
    if (!referencia) return "Sin documento";
    const match = referencia.match(/DOC:([^|]+)/);
    const valor = match?.[1] ?? "SIN_DOCUMENTO";
    return {
      FACTURA: "Factura",
      FACTURA_EXENTA: "Factura exenta",
      BOLETA: "Boleta",
      BOLETA_EXENTA: "Boleta exenta",
      BOLETA_HONORARIOS: "Boleta de honorarios",
      SIN_DOCUMENTO: "Sin documento"
    }[valor] ?? valor;
  };

  const labelModoIva = (modoIva: string): string => {
    return {
      IVA_INCLUIDO: "IVA incluido",
      MAS_IVA: "Mas IVA",
      NO_APLICA: "No aplica"
    }[modoIva] ?? modoIva;
  };

  const fmtFechaHistorial = (valor: string): string => {
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return valor;
    return fecha.toLocaleString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const labelStorageMode = useMemo(() => {
    if (!supportInfo) return "Sin detectar";
    return supportInfo.storageMode === "sqlite" ? "SQLite" : "JSON fallback";
  }, [supportInfo]);

  const estadoUpdateLabel = useMemo(() => {
    if (!updateState) return "Sin datos";
    return {
      disabled: "Deshabilitada",
      idle: "Al dia",
      checking: "Buscando...",
      available: "Disponible",
      downloading: "Descargando...",
      downloaded: "Lista para instalar",
      error: "Error"
    }[updateState.status];
  }, [updateState]);

  const mostrarAvisoUpdateSuperior = useMemo(() => {
    if (!updateState) return false;
    if (!updateState.latestVersion || updateState.latestVersion === updateState.currentVersion) return false;
    return (
      updateState.status === "available"
      || updateState.status === "downloading"
      || updateState.status === "downloaded"
    );
  }, [updateState]);

  const textoAvisoUpdateSuperior = useMemo(() => {
    if (!updateState || !mostrarAvisoUpdateSuperior) return "";

    if (updateState.status === "downloading") {
      const percent = typeof updateState.downloadPercent === "number"
        ? ` (${updateState.downloadPercent.toFixed(1)}%)`
        : "";
      return `Nueva version ${updateState.latestVersion} en descarga${percent}`;
    }

    if (updateState.status === "downloaded") {
      return `Nueva version ${updateState.latestVersion} lista para instalar`;
    }

    return `Hay una nueva version ${updateState.latestVersion} disponible para descargar`;
  }, [updateState, mostrarAvisoUpdateSuperior]);

  const balanceGeneral = useMemo(() => {
    if (balance.length === 0) return null;

    const saldoActivo = (f: FilaBalanceComprobacion) => f.saldoDeudor - f.saldoAcreedor;
    const saldoPasivo = (f: FilaBalanceComprobacion) => f.saldoAcreedor - f.saldoDeudor;

    const ac = balance.filter((f) => f.codigo.startsWith("1.1"));
    const anc = balance.filter((f) => f.codigo.startsWith("1.2"));
    const pc = balance.filter((f) => f.codigo.startsWith("2.1"));
    const pnc = balance.filter((f) => f.codigo.startsWith("2.2"));
    const pat = balance.filter((f) => f.codigo.startsWith("3."));
    const ingresos = balance.filter((f) => f.codigo.startsWith("4."));
    const gastos = balance.filter((f) => f.codigo.startsWith("5.") || f.codigo.startsWith("6."));

    const totalAC = ac.reduce((s, f) => s + saldoActivo(f), 0);
    const totalANC = anc.reduce((s, f) => s + saldoActivo(f), 0);
    const totalPC = pc.reduce((s, f) => s + saldoPasivo(f), 0);
    const totalPNC = pnc.reduce((s, f) => s + saldoPasivo(f), 0);
    const totalPat = pat.reduce((s, f) => s + saldoPasivo(f), 0);
    const totalIngr = ingresos.reduce((s, f) => s + f.saldoAcreedor, 0);
    const totalGast = gastos.reduce((s, f) => s + f.saldoDeudor, 0);
    const utilidad = totalIngr - totalGast;

    const patrimonioConResultado = [
      ...pat,
      {
        cuentaId: -1,
        codigo: "3.9.9.99",
        nombre: "Resultado del ejercicio (PyG)",
        tipo: "PATRIMONIO",
        naturaleza: "ACREEDORA",
        totalDebe: 0,
        totalHaber: 0,
        saldoDeudor: utilidad < 0 ? Math.abs(utilidad) : 0,
        saldoAcreedor: utilidad >= 0 ? utilidad : 0
      }
    ] satisfies FilaBalanceComprobacion[];

    const construirBloque = (
      titulo: string,
      filas: FilaBalanceComprobacion[],
      fnSaldo: (fila: FilaBalanceComprobacion) => number,
      subtotal: string
    ): ItemCuadro[] => {
      const cuentas: ItemCuadro[] = filas.map((f) => ({
        tipo: "cuenta",
        etiqueta: `- ${f.nombre}`,
        monto: fnSaldo(f)
      }));
      const cuentaSinMovimiento: ItemCuadro = { tipo: "cuenta", etiqueta: "- Sin movimientos", monto: 0 };
      const total = filas.reduce((sum, f) => sum + fnSaldo(f), 0);
      return [
        { tipo: "titulo", etiqueta: titulo } as ItemCuadro,
        ...(cuentas.length > 0 ? cuentas : [cuentaSinMovimiento]),
        { tipo: "subtotal", etiqueta: subtotal, monto: total } as ItemCuadro
      ];
    };

    const izquierda = [
      ...construirBloque("ACTIVO NO CORRIENTE", anc, saldoActivo, "ACTIVO NO CORRIENTE"),
      ...construirBloque("ACTIVO CORRIENTE", ac, saldoActivo, "ACTIVO CORRIENTE"),
      { tipo: "total", etiqueta: "TOTAL ACTIVO", monto: totalAC + totalANC }
    ] satisfies ItemCuadro[];

    const derecha = [
      ...construirBloque("PATRIMONIO NETO", patrimonioConResultado, saldoPasivo, "PATRIMONIO NETO"),
      ...construirBloque("PASIVO NO CORRIENTE", pnc, saldoPasivo, "PASIVO NO CORRIENTE"),
      ...construirBloque("PASIVO CORRIENTE", pc, saldoPasivo, "PASIVO CORRIENTE"),
      { tipo: "total", etiqueta: "TOTAL PN Y PASIVO", monto: totalPC + totalPNC + totalPat + utilidad }
    ] satisfies ItemCuadro[];

    const max = Math.max(izquierda.length, derecha.length);
    const filasCuadro = Array.from({ length: max }, (_, i) => ({
      izquierda: izquierda[i] ?? ({ tipo: "vacio", etiqueta: "" } satisfies ItemCuadro),
      derecha: derecha[i] ?? ({ tipo: "vacio", etiqueta: "" } satisfies ItemCuadro)
    }));

    return {
      ac,
      anc,
      pc,
      pnc,
      pat,
      ingresos,
      gastos,
      totalAC, totalANC, totalPC, totalPNC, totalPat, utilidad,
      totalActivo: totalAC + totalANC,
      totalPasivoPat: totalPC + totalPNC + totalPat + utilidad,
      filasCuadro
    };
  }, [balance]);

  const estadoResultados = useMemo(() => {
    if (!balanceGeneral) return null;
    const totalIngresos = balanceGeneral.ingresos.reduce((sum, fila) => sum + (fila.saldoAcreedor - fila.saldoDeudor), 0);
    const totalGastos = balanceGeneral.gastos.reduce((sum, fila) => sum + (fila.saldoDeudor - fila.saldoAcreedor), 0);
    return {
      totalIngresos,
      totalGastos,
      resultadoAntesImpuesto: totalIngresos - totalGastos
    };
  }, [balanceGeneral]);

  const resumenTributario = useMemo(() => {
    if (!balanceGeneral || !estadoResultados) return null;

    const buscarSaldo = (codigo: string): number => {
      const fila = balance.find((f) => f.codigo === codigo);
      return fila ? fila.saldoAcreedor - fila.saldoDeudor : 0;
    };

    const ivaDebito = buscarSaldo("2.1.2.01");
    const ivaCredito = Math.abs(buscarSaldo("2.1.2.02"));
    const retHonorarios = buscarSaldo("2.1.2.03");
    const ivaPagar = ivaDebito - ivaCredito;
    const rentaLiquida = Math.max(0, estadoResultados.resultadoAntesImpuesto);
    const tasaIdpc = regimenTributario === "14D3" ? 25 : regimenTributario === "SEMI" ? 27 : 0;
    const idpcEstimado = rentaLiquida * (tasaIdpc / 100);
    const ppmEstimado = Math.max(0, estadoResultados.totalIngresos) * (tasaPpm / 100);
    const baseGlobal = (rentaLiquida * (participacionGlobalAplicada / 100)) + otrosIngresosGlobal;

    return {
      ivaDebito,
      ivaCredito,
      retHonorarios,
      ivaPagar,
      rentaLiquida,
      tasaIdpc,
      idpcEstimado,
      ppmEstimado,
      baseGlobal
    };
  }, [
    balance,
    balanceGeneral,
    estadoResultados,
    otrosIngresosGlobal,
    participacionGlobalAplicada,
    tasaPpm,
    regimenTributario
  ]);

  const catalogoOficialDisponible = Boolean(CATALOGO_TRIBUTARIO_ANUAL[periodoAnio]);

  const catalogoAnual = useMemo<CatalogoAnual>(() => {
    return CATALOGO_TRIBUTARIO_ANUAL[periodoAnio] ?? CATALOGO_TRIBUTARIO_ANUAL["2026"];
  }, [periodoAnio]);

  const lineasPreF29 = useMemo((): LineaFormulario[] => {
    if (!resumenTributario) return [];
    return [
      {
        linea: catalogoAnual.f29["F29-IVA-DB"] ?? "F29-IVA-DB",
        concepto: "IVA debito fiscal ventas",
        monto: resumenTributario.ivaDebito,
        soporte: "Cuenta 2.1.2.01 IVA Debito Fiscal"
      },
      {
        linea: catalogoAnual.f29["F29-IVA-CR"] ?? "F29-IVA-CR",
        concepto: "IVA credito fiscal compras",
        monto: resumenTributario.ivaCredito,
        soporte: "Cuenta 2.1.2.02 IVA Credito Fiscal"
      },
      {
        linea: catalogoAnual.f29["F29-IVA-NETO"] ?? "F29-IVA-NETO",
        concepto: "IVA neto pagar o remanente",
        monto: resumenTributario.ivaPagar,
        soporte: "IVA debito menos IVA credito"
      },
      {
        linea: catalogoAnual.f29["F29-RET-HON"] ?? "F29-RET-HON",
        concepto: "Retencion boletas de honorarios",
        monto: resumenTributario.retHonorarios,
        soporte: "Cuenta 2.1.2.03 Retencion Honorarios"
      },
      {
        linea: catalogoAnual.f29["F29-PPM"] ?? "F29-PPM",
        concepto: "PPM estimado sobre ingresos",
        monto: resumenTributario.ppmEstimado,
        soporte: `Ingresos x tasa PPM ${tasaPpm.toFixed(2)}%`
      }
    ];
  }, [resumenTributario, tasaPpm, catalogoAnual]);

  const lineasPreF22 = useMemo((): LineaFormulario[] => {
    if (!resumenTributario || !estadoResultados) return [];
    return [
      {
        linea: catalogoAnual.f22["F22-RES-ING"] ?? "F22-RES-ING",
        concepto: "Ingresos tributarios del periodo",
        monto: estadoResultados.totalIngresos,
        soporte: "Cuentas grupo 4"
      },
      {
        linea: catalogoAnual.f22["F22-RES-GAS"] ?? "F22-RES-GAS",
        concepto: "Costos y gastos del periodo",
        monto: estadoResultados.totalGastos,
        soporte: "Cuentas grupos 5 y 6"
      },
      {
        linea: catalogoAnual.f22["F22-RLI"] ?? "F22-RLI",
        concepto: "Renta liquida imponible estimada",
        monto: resumenTributario.rentaLiquida,
        soporte: "Resultado antes de impuesto ajustado a no negativo"
      },
      {
        linea: catalogoAnual.f22["F22-IDPC"] ?? "F22-IDPC",
        concepto: "IDPC estimado segun regimen",
        monto: resumenTributario.idpcEstimado,
        soporte: `Regimen ${regimenTributario} con tasa ${resumenTributario.tasaIdpc.toFixed(2)}%`
      },
      {
        linea: catalogoAnual.f22["F22-BASE-GC"] ?? "F22-BASE-GC",
        concepto: "Base Global Complementario estimada",
        monto: resumenTributario.baseGlobal,
        soporte: "Participacion socio + otros ingresos anuales"
      }
    ];
  }, [resumenTributario, estadoResultados, regimenTributario, catalogoAnual]);

  const controlesCumplimiento = useMemo((): ControlCumplimiento[] => {
    const controles: ControlCumplimiento[] = [];

    if (!empresaActivaId) {
      controles.push({
        estado: "critico",
        titulo: "Empresa activa",
        detalle: "Debes seleccionar una empresa activa para preparar declaraciones."
      });
      return controles;
    }

    controles.push({
      estado: balance.length > 0 ? "ok" : "critico",
      titulo: "Movimientos contables",
      detalle: balance.length > 0 ? "Existen movimientos para calcular pre-formularios." : "No hay movimientos contables para el periodo seleccionado."
    });

    controles.push({
      estado: catalogoOficialDisponible ? "ok" : "critico",
      titulo: "Catalogo anual de lineas",
      detalle: catalogoOficialDisponible
        ? `Catalogo oficial cargado para ${periodoAnio}.`
        : `No existe catalogo oficial cargado para ${periodoAnio}. Debes validarlo antes de declarar.`
    });

    if (balanceGeneral) {
      const diferenciaCuadre = Math.abs(balanceGeneral.totalActivo - balanceGeneral.totalPasivoPat);
      controles.push({
        estado: diferenciaCuadre < 1 ? "ok" : "critico",
        titulo: "Cuadre Balance",
        detalle: diferenciaCuadre < 1 ? "El balance se encuentra cuadrado." : `Existe descuadre de ${fmtMonto(diferenciaCuadre)} entre activo y pasivo+patrimonio.`
      });
    }

    if (resumenTributario) {
      controles.push({
        estado: resumenTributario.ivaDebito > 0 || resumenTributario.ivaCredito > 0 ? "ok" : "aviso",
        titulo: "Base IVA F29",
        detalle: resumenTributario.ivaDebito > 0 || resumenTributario.ivaCredito > 0
          ? "Se detectan saldos para confeccionar IVA mensual."
          : "No se detectan saldos de IVA. Si no hubo movimiento, declarar igualmente en cero."
      });

      controles.push({
        estado: resumenTributario.retHonorarios >= 0 ? "ok" : "aviso",
        titulo: "Retenciones honorarios",
        detalle: "Revisar boletas de honorarios emitidas/recibidas y su retencion vigente en el periodo."
      });

      if (sociosEmpresaActiva.length === 0) {
        controles.push({
          estado: "aviso",
          titulo: "Dueños y participaciones",
          detalle: "No hay socios cargados. Configura dueños y porcentaje para una base global mas precisa."
        });
      } else {
        const diferencia = Math.abs(100 - totalParticipacionSocios);
        controles.push({
          estado: diferencia < 0.01 ? "ok" : "critico",
          titulo: "Distribucion de participacion",
          detalle:
            diferencia < 0.01
              ? "La participacion de dueños suma 100%."
              : `La participacion de dueños suma ${fmtMonto(totalParticipacionSocios)}%. Debe totalizar 100%.`
        });
      }
    }

    controles.push({
      estado: "aviso",
      titulo: "DJ y Operacion Renta",
      detalle: "Verificar DJ obligatorias (1887, 1879, 1847, 1947, 1948) antes de cerrar F22."
    });

    return controles;
  }, [
    empresaActivaId,
    balance.length,
    balanceGeneral,
    resumenTributario,
    fmtMonto,
    catalogoOficialDisponible,
    periodoAnio,
    sociosEmpresaActiva,
    totalParticipacionSocios
  ]);

  const resumenControles = useMemo(() => {
    const ok = controlesCumplimiento.filter((c) => c.estado === "ok").length;
    const aviso = controlesCumplimiento.filter((c) => c.estado === "aviso").length;
    const critico = controlesCumplimiento.filter((c) => c.estado === "critico").length;
    return { ok, aviso, critico };
  }, [controlesCumplimiento]);

  const tieneControlesCriticos = resumenControles.critico > 0;
  const firmaRevisionCompleta =
    revisorTributario.trim().length > 2 &&
    Boolean(fechaRevisionTributaria) &&
    confirmacionRevision;

  const auditoriaInteligente = useMemo<ResumenAuditoriaInteligente | null>(() => {
    if (!empresaActivaId || auditoria.length === 0) return null;

    const totalRegistros = auditoria.length;
    const montoObservado = auditoria.reduce((sum, item) => sum + item.monto_total, 0);
    const registrosConDocumento = auditoria.filter(
      (item) => item.tipo_documento !== "SIN_DOCUMENTO" && item.tipo_documento !== "DESCONOCIDO"
    ).length;
    const registrosSinDocumento = auditoria.filter((item) => item.tipo_documento === "SIN_DOCUMENTO").length;
    const registrosDesconocidos = auditoria.filter((item) => item.tipo_documento === "DESCONOCIDO").length;
    const porcentajeDocumentado = totalRegistros > 0 ? (registrosConDocumento / totalRegistros) * 100 : 0;
    const asientosAjustados = asientos.filter((item) => (item.revision_count ?? 0) > 1);
    const cantidadAjustados = asientosAjustados.length;
    const ventasSinDocumento = auditoria.filter(
      (item) => item.tipo_documento === "SIN_DOCUMENTO" && item.categoria_operacion === "VENTA_GENERAL"
    );
    const gastosSinDocumento = auditoria.filter(
      (item) => item.tipo_documento === "SIN_DOCUMENTO" && item.categoria_operacion !== "VENTA_GENERAL"
    );
    const montosRedondos = auditoria.filter((item) => item.monto_total > 0 && item.monto_total % 100000 === 0).length;
    const porcentajeMontosRedondos = totalRegistros > 0 ? (montosRedondos / totalRegistros) * 100 : 0;

    const montosPorFecha = auditoria.reduce<Record<string, number>>((acc, item) => {
      acc[item.fecha_operacion] = (acc[item.fecha_operacion] ?? 0) + item.monto_total;
      return acc;
    }, {});
    const fechaMayorConcentracion = Object.entries(montosPorFecha).sort((a, b) => b[1] - a[1])[0] ?? null;
    const porcentajeMayorConcentracion = fechaMayorConcentracion && montoObservado > 0
      ? (fechaMayorConcentracion[1] / montoObservado) * 100
      : 0;

    const hallazgos: HallazgoAuditoria[] = [];
    let penalizacion = 0;

    if (ventasSinDocumento.length > 0) {
      penalizacion += Math.min(36, ventasSinDocumento.length * 14);
      hallazgos.push({
        estado: "critico",
        titulo: "Ingresos sin documento tributario",
        detalle: `Se detectaron ${ventasSinDocumento.length} ingresos o ventas sin documento, lo que expone a diferencias de IVA y trazabilidad comercial.`,
        recomendacion: "Regulariza respaldo de ventas y revisa si corresponde emitir boleta o factura según el giro y el cliente.",
        cantidad: ventasSinDocumento.length
      });
    }

    if (gastosSinDocumento.length > 0) {
      penalizacion += Math.min(20, gastosSinDocumento.length * 6);
      hallazgos.push({
        estado: gastosSinDocumento.length >= 3 ? "critico" : "aviso",
        titulo: "Gastos registrados sin respaldo suficiente",
        detalle: `Hay ${gastosSinDocumento.length} egresos sin documento tributario. Eso puede impedir sustentar gasto aceptado o crédito fiscal.`,
        recomendacion: "Solicita respaldo mínimo por gasto, separa desembolsos personales y confirma si alguno debía registrarse como aporte o préstamo.",
        cantidad: gastosSinDocumento.length
      });
    }

    if (registrosDesconocidos > 0) {
      penalizacion += Math.min(18, registrosDesconocidos * 9);
      hallazgos.push({
        estado: "critico",
        titulo: "Operaciones con documento no definido",
        detalle: `Existen ${registrosDesconocidos} registros con documento desconocido, señal de clasificación incompleta o flujo no cerrado.`,
        recomendacion: "Revisa esas operaciones antes del cierre mensual para evitar bases tributarias mal calculadas.",
        cantidad: registrosDesconocidos
      });
    }

    if (cantidadAjustados > 0) {
      penalizacion += Math.min(18, cantidadAjustados * 5);
      hallazgos.push({
        estado: cantidadAjustados >= 3 ? "aviso" : "ok",
        titulo: "Asientos corregidos después del registro",
        detalle: `Se ajustaron ${cantidadAjustados} asientos ya emitidos. No es malo por sí mismo, pero sí marca puntos del flujo donde el documento original llega tarde o mal clasificado.`,
        recomendacion: "Usa el historial de ajustes para identificar qué proveedor, vendedor o proceso está generando más correcciones.",
        cantidad: cantidadAjustados
      });
    }

    if (porcentajeMayorConcentracion >= 45 && fechaMayorConcentracion) {
      penalizacion += 10;
      hallazgos.push({
        estado: "aviso",
        titulo: "Alta concentración operativa en un solo día",
        detalle: `El ${fechaMayorConcentracion[0]} concentra ${porcentajeMayorConcentracion.toFixed(1)}% del monto auditado del periodo.`,
        recomendacion: "Confirma si corresponde a una operación real relevante o si hubo carga masiva atrasada que convenga distribuir por fecha efectiva."
      });
    }

    if (porcentajeMontosRedondos >= 60 && totalRegistros >= 6) {
      penalizacion += 8;
      hallazgos.push({
        estado: "aviso",
        titulo: "Predominio de montos demasiado redondos",
        detalle: `${porcentajeMontosRedondos.toFixed(0)}% de los registros tienen montos redondos al 100.000. Puede ser normal, pero también puede indicar estimación manual en vez de documento exacto.`,
        recomendacion: "Contrasta montos relevantes contra respaldo real, especialmente ventas y gastos sin IVA explícito."
      });
    }

    if (sociosEmpresaActiva.length === 0 && totalRegistros >= 4) {
      penalizacion += 10;
      hallazgos.push({
        estado: "aviso",
        titulo: "Empresa operando sin dueños configurados",
        detalle: "Hay movimiento contable, pero no existe estructura de socios o accionistas cargada para repartir utilidades y revisar aportes de capital.",
        recomendacion: "Completa la pestaña Socios para mejorar revisión patrimonial, F22 y análisis de aportes versus retiros."
      });
    }

    const score = Math.max(0, Math.round(100 - penalizacion));
    const estadoGeneral: EstadoControl = score >= 85 ? "ok" : score >= 65 ? "aviso" : "critico";

    const fortalezas: string[] = [];
    if (porcentajeDocumentado >= 85) {
      fortalezas.push(`Buen nivel de respaldo: ${porcentajeDocumentado.toFixed(1)}% de las operaciones quedó con documento definido.`);
    }
    if (cantidadAjustados === 0) {
      fortalezas.push("No se observan asientos corregidos después del registro inicial en el periodo analizado.");
    }
    if (sociosEmpresaActiva.length > 0) {
      fortalezas.push("La empresa sí tiene estructura societaria cargada, lo que mejora control patrimonial y simulación tributaria.");
    }
    if (fortalezas.length === 0) {
      fortalezas.push("La base de auditoría ya tiene suficiente historial para detectar patrones y construir controles más finos.");
    }

    const recomendaciones = hallazgos
      .filter((item) => item.estado !== "ok")
      .slice(0, 4)
      .map((item) => item.recomendacion);

    if (recomendaciones.length === 0) {
      recomendaciones.push("Mantén el flujo actual y usa esta pestaña como revisión previa antes de F29 y cierre mensual.");
    }

    const resumenNarrativo =
      estadoGeneral === "critico"
        ? `La revisión automática ve riesgo alto. El foco está en ${ventasSinDocumento.length > 0 ? "ventas sin documento" : "debilidades de clasificación y soporte"}. Antes de declarar o cerrar el mes, conviene normalizar respaldo y revisar los registros ajustados.`
        : estadoGeneral === "aviso"
          ? "La empresa muestra una operación razonable, pero aún con alertas que pueden transformarse en contingencias si el volumen crece. El mayor valor está en corregir soporte y consistencia documental ahora."
          : "La revisión automática ve una operación ordenada para el volumen actual. Aun así, sigue monitoreando ajustes, concentración de fechas y calidad de respaldo para no perder control al escalar.";

    hallazgos.sort((a, b) => {
      const peso = { critico: 3, aviso: 2, ok: 1 };
      return peso[b.estado] - peso[a.estado];
    });

    return {
      score,
      estadoGeneral,
      totalRegistros,
      montoObservado,
      porcentajeDocumentado,
      cantidadAjustados,
      registrosSinDocumento,
      hallazgos,
      fortalezas,
      recomendaciones,
      resumenNarrativo
    };
  }, [auditoria, asientos, empresaActivaId, sociosEmpresaActiva]);

  const preguntasAuditoriaCopiloto = useMemo<PreguntaAuditoriaCopiloto[]>(() => {
    if (!empresaActivaId || auditoria.length === 0) return [];

    const preguntas: PreguntaAuditoriaCopiloto[] = [];
    const vistos = new Set<string>();

    const agregarPregunta = (pregunta: PreguntaAuditoriaCopiloto | null) => {
      if (!pregunta) return;
      const clave = `${pregunta.accion}-${pregunta.asientoId}`;
      if (vistos.has(clave)) return;
      vistos.add(clave);
      preguntas.push(pregunta);
    };

    const pendienteDocumento = auditoria
      .filter(
        (item) =>
          item.asiento_id !== null &&
          (item.tipo_documento === "DESCONOCIDO" || item.tipo_documento === "SIN_DOCUMENTO")
      )
      .sort((a, b) => b.monto_total - a.monto_total)[0];

    agregarPregunta(
      pendienteDocumento && pendienteDocumento.asiento_id !== null
        ? {
            id: `pendiente-${pendienteDocumento.id}`,
            pregunta: "¿Quieres corregir ahora el documento más riesgoso?",
            detalle: `${pendienteDocumento.categoria_operacion} por ${fmtMontoContable(pendienteDocumento.monto_total)} quedó como ${pendienteDocumento.tipo_documento}.`,
            accion: "edit-doc",
            accionLabel: "Abrir corrección",
            asientoId: pendienteDocumento.asiento_id
          }
        : null
    );

    const ventaSinDocumento = auditoria
      .filter(
        (item) => item.asiento_id !== null && item.tipo_documento === "SIN_DOCUMENTO" && item.categoria_operacion === "VENTA_GENERAL"
      )
      .sort((a, b) => b.monto_total - a.monto_total)[0];

    agregarPregunta(
      ventaSinDocumento && ventaSinDocumento.asiento_id !== null
        ? {
            id: `venta-${ventaSinDocumento.id}`,
            pregunta: "¿Revisamos la venta sin documento de mayor monto?",
            detalle: `La operación por ${fmtMontoContable(ventaSinDocumento.monto_total)} podría requerir boleta o factura para cerrar bien IVA e ingresos.`,
            accion: "edit-doc",
            accionLabel: "Revisar venta",
            asientoId: ventaSinDocumento.asiento_id
          }
        : null
    );

    const asientoMasAjustado = asientos
      .filter((item) => (item.revision_count ?? 0) > 1)
      .sort((a, b) => (b.revision_count ?? 0) - (a.revision_count ?? 0))[0];

    agregarPregunta(
      asientoMasAjustado
        ? {
            id: `ajustado-${asientoMasAjustado.id}`,
            pregunta: "¿Quieres abrir el historial del asiento más corregido?",
            detalle: `El asiento #${asientoMasAjustado.id} acumula ${asientoMasAjustado.revision_count} versiones y puede mostrar dónde se está rompiendo el flujo documental.`,
            accion: "view-history",
            accionLabel: "Ver historial",
            asientoId: asientoMasAjustado.id
          }
        : null
    );

    return preguntas.slice(0, 3);
  }, [auditoria, asientos, empresaActivaId, fmtMontoContable]);

  const colaCasosAuditoria = useMemo<CasoAuditoriaCopiloto[]>(() => {
    if (!empresaActivaId || auditoria.length === 0) return [];

    const casos: CasoAuditoriaCopiloto[] = [];
    const asientosPorId = new Map(asientos.map((item) => [item.id, item]));

    auditoria.forEach((item) => {
      if (!item.asiento_id) return;
      const asiento = asientosPorId.get(item.asiento_id);
      const revisiones = asiento?.revision_count ?? 0;

      if (item.tipo_documento === "DESCONOCIDO") {
        casos.push({
          id: `caso-doc-${item.id}`,
          prioridad: 100 + item.monto_total,
          estado: "critico",
          titulo: "Documento sin definir",
          detalle: `${item.categoria_operacion} por ${fmtMontoContable(item.monto_total)} aún está como documento desconocido.`,
          asientoId: item.asiento_id,
          monto: item.monto_total,
          accionPrincipal: "Corregir ahora",
          accionSecundaria: "Ver historial"
        });
      } else if (item.tipo_documento === "SIN_DOCUMENTO") {
        casos.push({
          id: `caso-sin-doc-${item.id}`,
          prioridad: (item.categoria_operacion === "VENTA_GENERAL" ? 95 : 75) + item.monto_total,
          estado: item.categoria_operacion === "VENTA_GENERAL" ? "critico" : "aviso",
          titulo: item.categoria_operacion === "VENTA_GENERAL" ? "Venta sin respaldo" : "Egreso sin respaldo",
          detalle: `${item.categoria_operacion} por ${fmtMontoContable(item.monto_total)} quedó sin documento tributario.`,
          asientoId: item.asiento_id,
          monto: item.monto_total,
          accionPrincipal: "Revisar documento",
          accionSecundaria: "Ver historial"
        });
      } else if (revisiones > 1) {
        casos.push({
          id: `caso-ajuste-${item.id}`,
          prioridad: 55 + revisiones * 10 + item.monto_total / 1000000,
          estado: revisiones >= 3 ? "aviso" : "ok",
          titulo: "Asiento con múltiples correcciones",
          detalle: `El asiento #${item.asiento_id} ya acumula ${revisiones} versiones y conviene revisar el origen del error.`,
          asientoId: item.asiento_id,
          monto: item.monto_total,
          accionPrincipal: "Ver historial",
          accionSecundaria: "Corregir documento"
        });
      }
    });

    return casos
      .sort((a, b) => b.prioridad - a.prioridad)
      .filter((item, index, arr) => arr.findIndex((other) => other.asientoId === item.asientoId && other.titulo === item.titulo) === index)
      .slice(0, 8);
  }, [auditoria, asientos, empresaActivaId, fmtMontoContable]);

  const checklistCierreAuditoria = useMemo<TareaCierreAuditoria[]>(() => {
    if (!empresaActivaId) return [];

    return [
      {
        id: "docs",
        estado: auditoriaInteligente && auditoriaInteligente.porcentajeDocumentado >= 90 ? "ok" : auditoriaInteligente && auditoriaInteligente.porcentajeDocumentado >= 70 ? "aviso" : "critico",
        titulo: "Respaldos documentales",
        detalle: auditoriaInteligente
          ? `${auditoriaInteligente.porcentajeDocumentado.toFixed(1)}% de operaciones con documento definido.`
          : "Sin datos suficientes."
      },
      {
        id: "ajustes",
        estado: (auditoriaInteligente?.cantidadAjustados ?? 0) === 0 ? "ok" : (auditoriaInteligente?.cantidadAjustados ?? 0) <= 2 ? "aviso" : "critico",
        titulo: "Correcciones posteriores",
        detalle: auditoriaInteligente
          ? `${auditoriaInteligente.cantidadAjustados} asiento(s) requirieron ajuste después del registro inicial.`
          : "Sin datos suficientes."
      },
      {
        id: "socios",
        estado: sociosEmpresaActiva.length > 0 ? "ok" : "aviso",
        titulo: "Estructura societaria",
        detalle: sociosEmpresaActiva.length > 0
          ? `Hay ${sociosEmpresaActiva.length} socio(s) cargado(s) para soportar revisión patrimonial.`
          : "Falta cargar dueños o accionistas para un cierre patrimonial más robusto."
      },
      {
        id: "firma",
        estado: firmaRevisionCompleta ? "ok" : "aviso",
        titulo: "Firma de revisión",
        detalle: firmaRevisionCompleta
          ? `Revisión firmada por ${revisorTributario} el ${fechaRevisionTributaria}.`
          : "Aún no existe firma completa de revisión del periodo."
      }
    ];
  }, [auditoriaInteligente, empresaActivaId, fechaRevisionTributaria, firmaRevisionCompleta, revisorTributario, sociosEmpresaActiva.length]);

  useEffect(() => {
    if (!empresaActivaId) {
      setMemoriaAuditoriaEmpresa(null);
      return;
    }

    try {
      const raw = window.localStorage.getItem(`contabilidad:audit-memory:${empresaActivaId}`);
      setMemoriaAuditoriaEmpresa(raw ? (JSON.parse(raw) as MemoriaAuditoriaEmpresa) : null);
    } catch {
      setMemoriaAuditoriaEmpresa(null);
    }
  }, [empresaActivaId]);

  useEffect(() => {
    if (!empresaActivaId || auditoria.length === 0) return;

    const patronesActuales = [
      {
        clave: "ventas-sin-documento",
        titulo: "Ventas sin documento",
        detalle: "La empresa sigue generando ingresos sin respaldo tributario suficiente.",
        cantidad: auditoria.filter((item) => item.tipo_documento === "SIN_DOCUMENTO" && item.categoria_operacion === "VENTA_GENERAL").length
      },
      {
        clave: "gastos-sin-respaldo",
        titulo: "Gastos sin respaldo",
        detalle: "Persisten egresos sin documento tributario o sin soporte claro.",
        cantidad: auditoria.filter((item) => item.tipo_documento === "SIN_DOCUMENTO" && item.categoria_operacion !== "VENTA_GENERAL").length
      },
      {
        clave: "documento-desconocido",
        titulo: "Clasificación documental incompleta",
        detalle: "Se repiten operaciones que quedan con documento pendiente de definir.",
        cantidad: auditoria.filter((item) => item.tipo_documento === "DESCONOCIDO").length
      },
      {
        clave: "asientos-ajustados",
        titulo: "Asientos corregidos",
        detalle: "La empresa vuelve a requerir correcciones posteriores al registro inicial.",
        cantidad: asientos.filter((item) => (item.revision_count ?? 0) > 1).length
      }
    ].filter((item) => item.cantidad > 0);

    const huella = patronesActuales.map((item) => `${item.clave}:${item.cantidad}`).join("|");
    const storageKey = `contabilidad:audit-memory:${empresaActivaId}`;

    try {
      const raw = window.localStorage.getItem(storageKey);
      const previa = raw ? (JSON.parse(raw) as MemoriaAuditoriaEmpresa) : null;
      if (previa?.ultimaHuella === huella) {
        setMemoriaAuditoriaEmpresa(previa);
        return;
      }

      const mapa = new Map<string, MemoriaPatronAuditoria>();
      (previa?.patrones ?? []).forEach((patron) => {
        mapa.set(patron.clave, patron);
      });

      const nowIso = new Date().toISOString();
      patronesActuales.forEach((patron) => {
        const previo = mapa.get(patron.clave);
        mapa.set(patron.clave, {
          clave: patron.clave,
          titulo: patron.titulo,
          detalle: patron.detalle,
          veces: (previo?.veces ?? 0) + 1,
          maximo: Math.max(previo?.maximo ?? 0, patron.cantidad),
          ultimaCantidad: patron.cantidad,
          updatedAt: nowIso
        });
      });

      const memoriaNueva: MemoriaAuditoriaEmpresa = {
        empresaId: empresaActivaId,
        ultimaHuella: huella,
        patrones: Array.from(mapa.values())
          .sort((a, b) => {
            if (b.veces !== a.veces) return b.veces - a.veces;
            return b.maximo - a.maximo;
          })
          .slice(0, 8)
      };

      window.localStorage.setItem(storageKey, JSON.stringify(memoriaNueva));
      setMemoriaAuditoriaEmpresa(memoriaNueva);
    } catch {
      // Si localStorage falla, el copiloto sigue operando solo con el periodo actual.
    }
  }, [auditoria, asientos, empresaActivaId]);

  function normalizarRut(valor: string): string {
    const limpio = valor.replace(/\./g, "").replace(/\s/g, "").toUpperCase();
    const partes = limpio.split("-");
    if (partes.length !== 2) {
      return "";
    }
    const cuerpo = partes[0].replace(/[^0-9]/g, "");
    const dv = partes[1].replace(/[^0-9K]/g, "");
    if (!cuerpo || dv.length !== 1) {
      return "";
    }
    return `${cuerpo}-${dv}`;
  }

  async function cargarEmpresas(): Promise<void> {
    try {
      setCargando(true);
      setMensajeError(null);
      const [data, activa] = await Promise.all([
        window.contabilidadApi.listEmpresas(),
        window.contabilidadApi.getEmpresaActiva()
      ]);
      setEmpresas(data);
      const activaExiste = typeof activa === "number" && data.some((item) => item.id === activa);
      setEmpresaActivaId(activaExiste ? activa : null);
    } catch {
      setMensajeError("No se pudo cargar el listado de empresas.");
    } finally {
      setCargando(false);
    }
  }

  async function cargarCuentas(empresaId: number | null): Promise<void> {
    if (!empresaId) {
      setCuentas([]);
      return;
    }

    try {
      const data = await window.contabilidadApi.listCuentas(empresaId);
      setCuentas(data);
    } catch {
      setMensajeError("No se pudo cargar el plan de cuentas.");
    }
  }

  async function cargarAsientos(empresaId: number | null): Promise<void> {
    if (!empresaId) {
      setAsientos([]);
      return;
    }

    try {
      const data = await window.contabilidadApi.listAsientos(empresaId);
      setAsientos(data);
    } catch {
      setMensajeError("No se pudo cargar el libro de asientos.");
    }
  }

  async function cargarSocios(empresaId: number | null): Promise<void> {
    if (!empresaId) {
      setSociosEmpresaActiva([]);
      return;
    }

    try {
      const data = await window.contabilidadApi.listSocios(empresaId);
      setSociosEmpresaActiva(data);
    } catch {
      setMensajeError("No se pudo cargar la estructura de socios/accionistas.");
    }
  }

  function obtenerGiroFinal(): string {
    return giro === "OTROS" ? giroPersonalizado : giro;
  }

  function obtenerGiroFinalActiva(): string {
    return giroEmpresaActiva === "OTROS" ? giroPersonalizadoActiva : giroEmpresaActiva;
  }

  async function cargarSoporte(): Promise<void> {
    try {
      const info = await window.contabilidadApi.getSupportInfo();
      setSupportInfo(info);
    } catch {
      setSupportInfo(null);
    }
  }

  async function cargarEstadoUpdate(): Promise<void> {
    try {
      const estado = await window.contabilidadApi.getUpdateState();
      setUpdateState(estado);
    } catch {
      setUpdateState(null);
    }
  }

  async function onCrearRespaldo(): Promise<void> {
    try {
      setCreandoRespaldo(true);
      setMensajeError(null);
      setMensajeInfo(null);
      const resultado = await window.contabilidadApi.createBackup();
      if (!resultado.ok) return;
      setMensajeInfo(
        `Respaldo ${resultado.storageMode === "sqlite" ? "SQLite" : "JSON"} generado en ${resultado.filePath}.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el respaldo.";
      setMensajeError(message);
    } finally {
      setCreandoRespaldo(false);
    }
  }

  async function onAbrirCarpetaDatos(): Promise<void> {
    try {
      setAbriendoCarpetaDatos(true);
      setMensajeError(null);
      const resultado = await window.contabilidadApi.openDataFolder();
      if (!resultado.ok) {
        throw new Error(resultado.error || "No se pudo abrir la carpeta de datos.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo abrir la carpeta de datos.";
      setMensajeError(message);
    } finally {
      setAbriendoCarpetaDatos(false);
    }
  }

  async function onBuscarActualizacionesAhora(): Promise<void> {
    try {
      setBuscandoActualizacion(true);
      setMensajeError(null);
      const result = await window.contabilidadApi.checkForUpdatesNow();
      if (result.ok) {
        setMensajeInfo(result.message);
      } else {
        setMensajeError(result.message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo verificar actualizaciones.";
      setMensajeError(message);
    } finally {
      setBuscandoActualizacion(false);
    }
  }

  async function onInstalarActualizacionDescargada(): Promise<void> {
    try {
      setInstalandoActualizacion(true);
      setMensajeError(null);
      const result = await window.contabilidadApi.installDownloadedUpdate();
      if (result.ok) {
        setMensajeInfo(result.message);
      } else {
        setMensajeError(result.message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo aplicar la actualizacion.";
      setMensajeError(message);
    } finally {
      setInstalandoActualizacion(false);
    }
  }

  useEffect(() => {
    void cargarEmpresas();
    void cargarSoporte();
    void cargarEstadoUpdate();

    const unsubscribe = window.contabilidadApi.onUpdateStatus((state) => {
      setUpdateState(state);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setAhora(new Date());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function cargarIndicadores(): Promise<void> {
      try {
        const data = await window.contabilidadApi.getIndicadoresEconomicos();
        if (!isMounted) return;
        setIndicadores(data);
        setIndicadoresError(
          data.estado === "sin-conexion"
            ? "Indicadores no disponibles en este momento. Se mostraran cuando vuelva la conexion."
            : null
        );
      } catch {
        if (!isMounted) return;
        setIndicadoresError("No se pudieron actualizar los indicadores economicos.");
      }
    }

    void cargarIndicadores();
    const intervalId = window.setInterval(() => {
      void cargarIndicadores();
    }, 15 * 60 * 1000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    void cargarCuentas(empresaActivaId);
    void cargarAsientos(empresaActivaId);
    void cargarSocios(empresaActivaId);
  }, [empresaActivaId]);

  useEffect(() => {
    setEdicionAsientoDocumento(null);
    setTipoDocumentoEdicion("");
  }, [empresaActivaId]);

  useEffect(() => {
    if (!empresaActiva) {
      setNombreEmpresaActiva("");
      setRutEmpresaActiva("");
      setMonedaEmpresaActiva("CLP");
      setGiroEmpresaActiva("");
      return;
    }

    setNombreEmpresaActiva(empresaActiva.nombre);
    setRutEmpresaActiva(empresaActiva.rut ?? "");
    setMonedaEmpresaActiva(empresaActiva.moneda);
    setGiroEmpresaActiva(empresaActiva.giro ?? "");
  }, [empresaActiva]);

  useEffect(() => {
    setIndiceSocioGlobal(0);
  }, [empresaActivaId, sociosEmpresaActiva.length]);

  async function onAgregarSocio(): Promise<void> {
    if (!empresaActivaId) {
      setMensajeError("Debes seleccionar una empresa activa para registrar socios.");
      return;
    }
    const nombreLimpio = nombreSocio.trim();
    if (!nombreLimpio) {
      setMensajeError("Ingresa el nombre del dueño/socio.");
      return;
    }

    const aporteInicial = aporteSocio.trim() === "" ? 0 : Number(aporteSocio);
    const participacion = participacionNuevoSocio.trim() === "" ? 0 : Number(participacionNuevoSocio);

    if (!Number.isFinite(aporteInicial) || !Number.isFinite(participacion)) {
      setMensajeError("Aporte y participacion deben ser numeros validos.");
      return;
    }

    if (aporteInicial < 0 || participacion < 0) {
      setMensajeError("Aporte y participacion deben ser valores positivos.");
      return;
    }

    try {
      setMensajeError(null);
      setMensajeInfo(null);
      await window.contabilidadApi.createSocio({
        empresaId: empresaActivaId,
        nombre: nombreLimpio,
        aporteInicial,
        participacion
      });
      await cargarSocios(empresaActivaId);
      setNombreSocio("");
      setAporteSocio("");
      setParticipacionNuevoSocio("");
      setMensajeInfo("Socio/accionista agregado correctamente.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo agregar el socio/accionista.";
      setMensajeError(message);
    }
  }

  async function onEliminarSocio(socioId: number): Promise<void> {
    if (!empresaActivaId) return;
    try {
      setMensajeError(null);
      setMensajeInfo(null);
      await window.contabilidadApi.deleteSocio(socioId);
      await cargarSocios(empresaActivaId);
      setIndiceSocioGlobal(0);
      setMensajeInfo("Socio/accionista eliminado correctamente.");
    } catch {
      setMensajeError("No se pudo eliminar el socio/accionista.");
    }
  }

  function onIniciarEdicionSocio(socio: SocioEmpresa): void {
    setEditandoSocioId(socio.id);
    setEditandoNombreSocio(socio.nombre);
    setEditandoAporteSocio(String(socio.aporte_inicial));
    setEditandoParticipacionSocio(String(socio.participacion));
    setMensajeError(null);
    setMensajeInfo(null);
  }

  function onCancelarEdicionSocio(): void {
    setEditandoSocioId(null);
    setEditandoNombreSocio("");
    setEditandoAporteSocio("");
    setEditandoParticipacionSocio("");
  }

  async function onGuardarEdicionSocio(): Promise<void> {
    if (!empresaActivaId || !editandoSocioId) return;

    const aporteInicial = editandoAporteSocio.trim() === "" ? 0 : Number(editandoAporteSocio);
    const participacion = editandoParticipacionSocio.trim() === "" ? 0 : Number(editandoParticipacionSocio);

    if (!Number.isFinite(aporteInicial) || !Number.isFinite(participacion)) {
      setMensajeError("Aporte y participacion deben ser numeros validos.");
      return;
    }

    if (aporteInicial < 0 || participacion < 0) {
      setMensajeError("Aporte y participacion deben ser valores positivos.");
      return;
    }

    try {
      setMensajeError(null);
      setMensajeInfo(null);
      await window.contabilidadApi.updateSocio({
        id: editandoSocioId,
        nombre: editandoNombreSocio,
        aporteInicial,
        participacion
      });
      await cargarSocios(empresaActivaId);
      onCancelarEdicionSocio();
      setMensajeInfo("Socio/accionista actualizado correctamente.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar el socio/accionista.";
      setMensajeError(message);
    }
  }


  async function onCrearEmpresa(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const nombreLimpio = nombre.trim();

    if (!nombreLimpio) {
      setMensajeError("Ingresa un nombre de empresa.");
      return;
    }

    const rutNormalizado = rut.trim() ? normalizarRut(rut) : "";
    if (rut.trim() && !rutNormalizado) {
      setMensajeError("El RUT debe tener formato valido. Ejemplo: 76123456-7");
      return;
    }

    const giroFinal = obtenerGiroFinal();
    if (!giroFinal) {
      setMensajeError("Selecciona un giro o ingresa uno personalizado.");
      return;
    }

    try {
      setGuardando(true);
      setMensajeError(null);
      setMensajeInfo(null);
      await window.contabilidadApi.createEmpresa({
        nombre: nombreLimpio,
        rut: rutNormalizado || null,
        cuit: rutNormalizado || null,
        moneda,
        giro: giroFinal
      });
      setNombre("");
      setRut("");
      setGiro("");
      setGiroPersonalizado("");
      await cargarEmpresas();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear la empresa.";
      setMensajeError(message);
    } finally {
      setGuardando(false);
    }
  }

  async function onEliminarEmpresa(id: number): Promise<void> {
    try {
      setMensajeError(null);
      setMensajeInfo(null);
      await window.contabilidadApi.deleteEmpresa(id);
      await cargarEmpresas();
    } catch {
      setMensajeError("No se pudo eliminar la empresa.");
    }
  }

  async function onSeleccionarEmpresaActiva(id: number): Promise<void> {
    try {
      setMensajeError(null);
      setMensajeInfo(null);
      await window.contabilidadApi.setEmpresaActiva(id);
      setEmpresaActivaId(id);
    } catch {
      setMensajeError("No se pudo seleccionar la empresa activa.");
    }
  }

  async function onSeedPlanBase(): Promise<void> {
    if (!empresaActivaId) {
      setMensajeError("Debes seleccionar una empresa activa.");
      return;
    }

    try {
      setMensajeError(null);
      const resultado = await window.contabilidadApi.seedPlanCuentasChile(empresaActivaId);
      setMensajeInfo(`Plan base aplicado. Cuentas creadas: ${resultado.creadas}`);
      await cargarCuentas(empresaActivaId);
    } catch {
      setMensajeError("No se pudo cargar el plan base chileno.");
    }
  }

  async function onGuardarEmpresaActiva(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!empresaActivaId) {
      setMensajeError("Debes seleccionar una empresa activa.");
      return;
    }

    const nombreLimpio = nombreEmpresaActiva.trim();
    if (!nombreLimpio) {
      setMensajeError("El nombre de la empresa es obligatorio.");
      return;
    }

    const rutNormalizado = rutEmpresaActiva.trim() ? normalizarRut(rutEmpresaActiva) : "";
    if (rutEmpresaActiva.trim() && !rutNormalizado) {
      setMensajeError("El RUT debe tener formato valido. Ejemplo: 76123456-7");
      return;
    }

    const giroFinal = obtenerGiroFinalActiva();
    if (!giroFinal) {
      setMensajeError("Selecciona un giro o ingresa uno personalizado.");
      return;
    }

    try {
      setGuardandoEmpresaActiva(true);
      setMensajeError(null);
      setMensajeInfo(null);
      await window.contabilidadApi.updateEmpresa({
        id: empresaActivaId,
        nombre: nombreLimpio,
        rut: rutNormalizado || null,
        cuit: rutNormalizado || null,
        moneda: monedaEmpresaActiva,
        giro: giroFinal
      });
      await cargarEmpresas();
      setMensajeInfo("Empresa actualizada correctamente.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar la empresa.";
      setMensajeError(message);
    } finally {
      setGuardandoEmpresaActiva(false);
    }
  }

  async function onCrearCuenta(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!empresaActivaId) {
      setMensajeError("Debes seleccionar una empresa activa.");
      return;
    }

    if (!codigoCuenta.trim() || !nombreCuenta.trim()) {
      setMensajeError("Codigo y nombre de cuenta son obligatorios.");
      return;
    }

    try {
      setGuardandoCuenta(true);
      setMensajeError(null);
      setMensajeInfo(null);
      await window.contabilidadApi.createCuenta({
        empresaId: empresaActivaId,
        codigo: codigoCuenta.trim(),
        nombre: nombreCuenta.trim(),
        tipo: tipoCuenta,
        naturaleza: naturalezaCuenta
      });
      setCodigoCuenta("");
      setNombreCuenta("");
      await cargarCuentas(empresaActivaId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear la cuenta.";
      setMensajeError(message);
    } finally {
      setGuardandoCuenta(false);
    }
  }

  function iniciarEdicionCuenta(cuenta: CuentaContable): void {
    setEditandoCuentaId(cuenta.id);
    setEditandoNombreCuenta(cuenta.nombre);
    setMensajeError(null);
    setMensajeInfo(null);
  }

  function cancelarEdicionCuenta(): void {
    setEditandoCuentaId(null);
    setEditandoNombreCuenta("");
  }

  async function guardarEdicionCuenta(cuentaId: number): Promise<void> {
    const nombre = editandoNombreCuenta.trim();
    if (!nombre) {
      setMensajeError("El nombre de la cuenta es obligatorio.");
      return;
    }

    try {
      setGuardandoEdicionCuenta(true);
      setMensajeError(null);
      setMensajeInfo(null);
      await window.contabilidadApi.updateNombreCuenta({ cuentaId, nombre });
      if (empresaActivaId) {
        await cargarCuentas(empresaActivaId);
      }
      setEditandoCuentaId(null);
      setEditandoNombreCuenta("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo editar la cuenta.";
      setMensajeError(message);
    } finally {
      setGuardandoEdicionCuenta(false);
    }
  }

  async function onAnalizarOperacion(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!empresaActivaId) {
      setMensajeError("Debes seleccionar una empresa activa.");
      return;
    }
    const texto = textoOperacion.trim();
    if (!texto) {
      setMensajeError("Escribe la operacion para poder interpretarla.");
      return;
    }
    try {
      setAnalizando(true);
      setMensajeError(null);
      setMensajeInfo(null);
      const resultado = await window.contabilidadApi.interpretarOperacion({
        empresaId: empresaActivaId,
        fecha: fechaOperacion,
        texto
      });
      setPendienteConfirmacion(resultado);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo analizar la operacion.";
      setMensajeError(message);
    } finally {
      setAnalizando(false);
    }
  }

  async function onConfirmarRegistro(tipoDocOverride?: string): Promise<void> {
    if (!pendienteConfirmacion || !empresaActivaId) return;
    const interpretacion: InterpretacionTexto = tipoDocOverride
      ? { ...pendienteConfirmacion.interpretacion, tipoDocumento: tipoDocOverride as InterpretacionTexto["tipoDocumento"] }
      : pendienteConfirmacion.interpretacion;
    if (interpretacion.tipoDocumento === "DESCONOCIDO") {
      setMensajeError("Debes indicar el tipo de documento antes de confirmar.");
      return;
    }
    try {
      setConfirmando(true);
      setMensajeError(null);
      setMensajeInfo(null);
      const asiento = await window.contabilidadApi.confirmarOperacion({
        empresaId: empresaActivaId,
        fecha: pendienteConfirmacion.fecha,
        interpretacion
      });
      setPendienteConfirmacion(null);
      setTextoOperacion("");
      await cargarAsientos(empresaActivaId);
      setMensajeInfo(`Asiento #${asiento.id} registrado correctamente.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo registrar la operacion.";
      setMensajeError(message);
    } finally {
      setConfirmando(false);
    }
  }

  const cargarVistaActual = useCallback(async (): Promise<void> => {
    if (!empresaActivaId) {
      setAuditoria([]);
      setLibroDiario([]);
      setLibroMayor([]);
      setBalance([]);
      return;
    }

    try {
      setCargandoReporte(true);
      if (vista === "auditoria") {
        const data = await window.contabilidadApi.listAuditoria(empresaActivaId);
        setAuditoria(data);
      }
      if (vista === "libro-diario") {
        const data = await window.contabilidadApi.getLibroDiario({
          empresaId: empresaActivaId,
          fechaDesde: fechaDesde || undefined,
          fechaHasta: fechaHasta || undefined
        });
        setLibroDiario(data);
      }
      if (vista === "libro-mayor") {
        if (!cuentaMayorId) {
          setLibroMayor([]);
        } else {
          const data = await window.contabilidadApi.getLibroMayor({
            empresaId: empresaActivaId,
            cuentaId: cuentaMayorId
          });
          setLibroMayor(data);
        }
      }
      if (vista === "balance" || vista === "estado-resultados" || vista === "tributario") {
        const data = await window.contabilidadApi.getBalanceComprobacion(empresaActivaId);
        setBalance(data);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo cargar la vista seleccionada.";
      setMensajeError(message);
    } finally {
      setCargandoReporte(false);
    }
  }, [cuentaMayorId, empresaActivaId, fechaDesde, fechaHasta, vista]);

  useEffect(() => {
    void cargarVistaActual();
  }, [cargarVistaActual]);

  async function onAbrirAsiento(asientoId: number): Promise<void> {
    if (asientoAbierto === asientoId) {
      setAsientoAbierto(null);
      return;
    }
    if (asientoLineas[asientoId]) {
      setAsientoAbierto(asientoId);
      return;
    }
    try {
      const lineas = await window.contabilidadApi.getAsientoDetalles(asientoId);
      setAsientoLineas((prev) => ({ ...prev, [asientoId]: lineas }));
      setAsientoAbierto(asientoId);
    } catch {
      setMensajeError("No se pudieron cargar las lineas del asiento.");
    }
  }

  async function onEditarDocumentoAsiento(asientoId: number): Promise<void> {
    try {
      setMensajeError(null);
      setMensajeInfo(null);
      const data = await window.contabilidadApi.getAsientoDocumentoEditable(asientoId);
      setEdicionAsientoDocumento(data);
      setTipoDocumentoEdicion(data.tipoDocumentoActual);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo abrir la edición del documento.";
      setMensajeError(message);
    }
  }

  function onCancelarEdicionDocumentoAsiento(): void {
    setEdicionAsientoDocumento(null);
    setTipoDocumentoEdicion("");
  }

  async function onToggleHistorialAsiento(asientoId: number): Promise<void> {
    if (historialAsientoAbierto === asientoId) {
      setHistorialAsientoAbierto(null);
      return;
    }

    if (historialAsientos[asientoId]) {
      setHistorialAsientoAbierto(asientoId);
      return;
    }

    try {
      setCargandoHistorialAsientoId(asientoId);
      setMensajeError(null);
      const data = await window.contabilidadApi.getAsientoHistorial(asientoId);
      setHistorialAsientos((prev) => ({ ...prev, [asientoId]: data }));
      setHistorialAsientoAbierto(asientoId);
    } catch {
      setMensajeError("No se pudo cargar el historial del asiento.");
    } finally {
      setCargandoHistorialAsientoId(null);
    }
  }

  async function onGuardarDocumentoAsiento(): Promise<void> {
    if (!edicionAsientoDocumento || !empresaActivaId) return;
    if (!tipoDocumentoEdicion) {
      setMensajeError("Debes seleccionar un tipo de documento.");
      return;
    }

    try {
      setGuardandoDocumentoAsiento(true);
      setMensajeError(null);
      setMensajeInfo(null);
      const asiento = await window.contabilidadApi.updateAsientoDocumento({
        asientoId: edicionAsientoDocumento.asientoId,
        tipoDocumento: tipoDocumentoEdicion
      });
      await cargarAsientos(empresaActivaId);
      const auditoriaActualizada = await window.contabilidadApi.listAuditoria(empresaActivaId);
      setAuditoria(auditoriaActualizada);
      if (asientoLineas[asiento.id]) {
        const lineas = await window.contabilidadApi.getAsientoDetalles(asiento.id);
        setAsientoLineas((prev) => ({ ...prev, [asiento.id]: lineas }));
      }
      try {
        const historialActualizado = await window.contabilidadApi.getAsientoHistorial(asiento.id);
        setHistorialAsientos((prev) => ({ ...prev, [asiento.id]: historialActualizado }));
        setHistorialAsientoAbierto(asiento.id);
      } catch {
        // La actualizacion principal ya fue exitosa; el historial puede volver a cargarse despues.
      }
      setEdicionAsientoDocumento(null);
      setTipoDocumentoEdicion("");
      setMensajeInfo(`Asiento #${asiento.id} actualizado con nuevo documento.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar el documento del asiento.";
      setMensajeError(message);
    } finally {
      setGuardandoDocumentoAsiento(false);
    }
  }

  async function onResponderPreguntaAuditoria(pregunta: PreguntaAuditoriaCopiloto): Promise<void> {
    if (pregunta.accion === "edit-doc") {
      await onEditarDocumentoAsiento(pregunta.asientoId);
      return;
    }

    await onToggleHistorialAsiento(pregunta.asientoId);
  }

  async function onExportarLibroDiario(): Promise<void> {
    if (!empresaActivaId) return;
    const resultado = await window.contabilidadApi.exportarCSVLibroDiario({
      empresaId: empresaActivaId,
      fechaDesde: fechaDesde || undefined,
      fechaHasta: fechaHasta || undefined
    });
    setMensajeInfo(
      resultado.ok
        ? `Libro diario exportado correctamente${resultado.filePath ? `: ${resultado.filePath}` : ""}.`
        : "Exportacion cancelada."
    );
  }

  async function onExportarBalance(): Promise<void> {
    if (!empresaActivaId) return;
    const resultado = await window.contabilidadApi.exportarCSVBalance(empresaActivaId);
    setMensajeInfo(
      resultado.ok
        ? `Balance exportado correctamente${resultado.filePath ? `: ${resultado.filePath}` : ""}.`
        : "Exportacion cancelada."
    );
  }

  function onMarcarListoParaDeclarar(): void {
    if (tieneControlesCriticos) {
      setMensajeError("No se puede marcar como listo para declarar: existen controles criticos pendientes.");
      return;
    }
    if (!firmaRevisionCompleta) {
      setMensajeError("Debes completar la firma de revision tributaria antes de marcar listo para declarar.");
      return;
    }
    setMensajeError(null);
    setMensajeInfo("Periodo marcado como listo para declarar en SII con revision registrada.");
  }

  function onImprimirReporteTributario(): void {
    if (!resumenTributario) {
      setMensajeError("No hay datos tributarios para imprimir.");
      return;
    }
    const nombreEmpresa = empresaActiva?.nombre ?? "Empresa sin nombre";
    const periodo = `${periodoMes.padStart(2, "0")}/${periodoAnio}`;
    const renderFilas = (filas: LineaFormulario[]) => filas
      .map((f) => `<tr><td>${f.linea}</td><td>${f.concepto}<br><small>${f.soporte}</small></td><td style=\"text-align:right\">${fmtMontoContable(f.monto)}</td></tr>`)
      .join("");

    const html = `
      <html>
        <head>
          <title>Reporte Tributario ${periodo}</title>
          <style>
            body { font-family: Segoe UI, Arial, sans-serif; padding: 18px; color: #1a1a1a; }
            h1, h2 { margin: 0 0 8px; }
            .meta { margin-bottom: 14px; color: #444; }
            table { width: 100%; border-collapse: collapse; margin: 8px 0 18px; }
            th, td { border: 1px solid #a8b3bf; padding: 6px; font-size: 12px; }
            th { background: #e9f1f7; text-align: left; }
            .warn { padding: 8px; background: #fff8e7; border: 1px solid #e5c76e; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>Pre-Declaracion Tributaria</h1>
          <div class=\"meta\"><strong>Empresa:</strong> ${nombreEmpresa} | <strong>Periodo:</strong> ${periodo} | <strong>Regimen:</strong> ${regimenTributario}</div>
          <div class=\"meta\"><strong>Revision:</strong> ${revisorTributario || "Sin revisor"} | <strong>Fecha:</strong> ${fechaRevisionTributaria || "Sin fecha"} | <strong>Confirmada:</strong> ${confirmacionRevision ? "Si" : "No"}</div>
          <h2>Pre-F29</h2>
          <table>
            <thead><tr><th>Linea</th><th>Concepto y soporte</th><th>Monto</th></tr></thead>
            <tbody>${renderFilas(lineasPreF29)}</tbody>
          </table>
          <h2>Pre-F22 + Global Complementario</h2>
          <table>
            <thead><tr><th>Linea</th><th>Concepto y soporte</th><th>Monto</th></tr></thead>
            <tbody>${renderFilas(lineasPreF22)}</tbody>
          </table>
          <div class=\"warn\">Documento de apoyo para carga manual en SII. Verificar lineas oficiales vigentes y criterios de declaracion antes del envio final.</div>
        </body>
      </html>
    `;

    const win = window.open("", "_blank", "width=1000,height=760");
    if (!win) {
      setMensajeError("No se pudo abrir la ventana de impresion. Revisa bloqueador de ventanas emergentes.");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <main className="layout">
      <header className="hero">
        <p className="eyebrow">Sistema contable multiempresa</p>
        <div className="hero-top-row">
          <div>
            <h1>Contabilidad</h1>
            <p>
              Crea y administra contribuyentes en Chile sobre los que luego cargaras
              plan de cuentas, asientos y reportes.
            </p>
          </div>
          <div className="hero-side-tools">
            <div className="hero-clock-card">
              <span>Fecha actual</span>
              <strong>{fechaHoraActual.fecha}</strong>
              <strong>{fechaHoraActual.hora}</strong>
            </div>
            <button
              type="button"
              className="support-logo-button"
              onClick={() => setVista("soporte")}
              title="Abrir centro de soporte"
              aria-label="Abrir centro de soporte"
            >
              <span className="support-logo-mark">S</span>
              <span className="support-logo-label">Soporte</span>
            </button>
          </div>
        </div>
      </header>

      {mostrarAvisoUpdateSuperior ? (
        <section className="update-top-banner" role="status" aria-live="polite">
          <div className="update-top-banner-text">
            <strong>Actualizacion disponible</strong>
            <span>{textoAvisoUpdateSuperior}</span>
          </div>
          <div className="update-top-banner-actions">
            <button type="button" className="btn-secundario" onClick={() => setVista("soporte")}>
              Ver detalles
            </button>
            {updateState?.status === "downloaded" ? (
              <button
                type="button"
                onClick={() => void onInstalarActualizacionDescargada()}
                disabled={instalandoActualizacion}
              >
                {instalandoActualizacion ? "Instalando..." : "Instalar ahora"}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="indicadores-barra">
        <div className="indicadores-header">
          <strong>Indicadores profesionales</strong>
          <div className="indicadores-meta">
            <span>
              {indicadores?.fecha
                ? `Fuente ${fuenteIndicadoresLegible} · referencia ${new Date(indicadores.fecha).toLocaleDateString("es-CL")}`
                : "Esperando actualizacion"}
            </span>
            {indicadores ? (
              <strong className={`indicadores-estado estado-${indicadores.estado}`}>
                {{
                  "en-vivo": "En vivo",
                  "cache-memoria": "Cache memoria",
                  "cache-disco": "Cache disco",
                  "sin-conexion": "Sin conexion"
                }[indicadores.estado]}
              </strong>
            ) : null}
          </div>
        </div>
        <div className="indicadores-grid">
          {[
            { label: "UF", value: indicadores?.uf },
            { label: "UTM", value: indicadores?.utm },
            { label: "Dolar", value: indicadores?.dolar },
            { label: "Euro", value: indicadores?.euro },
            { label: "IPC", value: indicadores?.ipc, suffix: "%" },
            { label: "TPM", value: indicadores?.tpm, suffix: "%" }
          ].map((item) => (
            <article key={item.label} className="indicador-card">
              <span>{item.label}</span>
              <strong>
                {typeof item.value === "number"
                  ? `${fmtMonto(item.value)}${item.suffix ?? ""}`
                  : "Sin dato"}
              </strong>
            </article>
          ))}
        </div>
        {indicadoresError ? <p className="hint-line indicadores-error">{indicadoresError}</p> : null}
      </section>

      <section className="tabs-bar">
        {[
          { id: "principal", label: "Principal" },
          { id: "auditoria", label: "Auditoria" },
          { id: "libro-diario", label: "Libro diario" },
          { id: "libro-mayor", label: "Libro mayor" },
          { id: "balance", label: "Balance" },
          { id: "estado-resultados", label: "Estado de resultados" },
          { id: "socios", label: "Socios" },
          { id: "tributario", label: "Tributario" }
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            className={vista === item.id ? "tab-button tab-button-active" : "tab-button btn-secundario"}
            onClick={() => setVista(item.id as Vista)}
          >
            {item.label}
          </button>
        ))}
      </section>

      {vista === "principal" ? (
        <>
      <section className="empresa-layout">
        <article className="card">
          <h2>Nueva empresa</h2>
          <form className="empresa-form" onSubmit={(event) => void onCrearEmpresa(event)}>
            <label>
              Nombre
              <input value={nombre} onChange={(event) => setNombre(event.target.value)} placeholder="Ej: Mi Pyme SRL" />
            </label>
            <label>
              RUT
              <input value={rut} onChange={(event) => setRut(event.target.value)} placeholder="Ej: 76123456-7" />
            </label>
            <label>
              Moneda
              <select value={moneda} onChange={(event) => setMoneda(event.target.value)}>
                <option value="CLP">CLP</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </label>
            <label>
              Giro
              <select value={giro} onChange={(event) => setGiro(event.target.value)}>
                <option value="">-- Selecciona un giro --</option>
                <option value="COMERCIO_ABARROTES">Comercio de abarrotes</option>
                <option value="TRANSPORTE_PERSONAS">Transporte de personas</option>
                <option value="TRANSPORTE_CARGA">Transporte de carga</option>
                <option value="AGRICULTURA">Agricultura</option>
                <option value="ARRIENDO_INMOBILIARIO">Arriendo inmobiliario</option>
                <option value="CONSTRUCCION">Construcción</option>
                <option value="MANUFACTURA">Manufactura e industria</option>
                <option value="SERVICIOS_PROFESIONALES">Servicios profesionales</option>
                <option value="GENERICO">Actividad genérica</option>
                <option value="OTROS">Otros (personalizado)</option>
              </select>
            </label>
            {giro === "OTROS" ? (
              <label>
                ¿Cuál es tu giro?
                <input 
                  value={giroPersonalizado} 
                  onChange={(event) => setGiroPersonalizado(event.target.value)} 
                  placeholder="Ej: Consultoria en tecnologia"
                />
              </label>
            ) : null}
            <button type="submit" disabled={guardando}>{guardando ? "Guardando..." : "Guardar empresa"}</button>
          </form>
        </article>

        <article className="card">
          <h2>Empresas</h2>
          {cargando ? <p>Cargando empresas...</p> : null}
          {!cargando && empresas.length === 0 ? <p>Aun no hay empresas cargadas.</p> : null}
          <ul className="empresa-lista">
            {empresas.map((empresa) => (
              <li key={empresa.id} className={empresaActivaId === empresa.id ? "empresa-activa-item" : undefined}>
                <div>
                  <strong>{empresa.nombre}</strong>
                  <span>
                    {empresa.moneda}
                    {empresa.rut ? ` | RUT ${empresa.rut}` : ""}
                    {empresa.giro ? ` | Giro: ${empresa.giro}` : ""}
                  </span>
                </div>
                <div className="acciones-inline">
                  <button type="button" className="btn-secundario" onClick={() => void onEliminarEmpresa(empresa.id)}>Eliminar</button>
                  <button
                    type="button"
                    className={empresaActivaId === empresa.id ? "btn-activa" : "btn-secundario"}
                    onClick={() => void onSeleccionarEmpresaActiva(empresa.id)}
                  >
                    {empresaActivaId === empresa.id ? "Activa" : "Seleccionar"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="empresa-layout">
        <article className="card">
          <h2>Empresa activa</h2>
          {!empresaActiva ? <p>Selecciona una empresa para trabajar el plan de cuentas.</p> : null}
          {empresaActiva ? (
            <form className="empresa-form" onSubmit={(event) => void onGuardarEmpresaActiva(event)}>
              <label>
                Nombre
                <input value={nombreEmpresaActiva} onChange={(event) => setNombreEmpresaActiva(event.target.value)} />
              </label>
              <label>
                RUT
                <input value={rutEmpresaActiva} onChange={(event) => setRutEmpresaActiva(event.target.value)} />
              </label>
              <label>
                Moneda
                <select value={monedaEmpresaActiva} onChange={(event) => setMonedaEmpresaActiva(event.target.value)}>
                  <option value="CLP">CLP</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </label>
              <label>
                Giro
                <select value={giroEmpresaActiva} onChange={(event) => setGiroEmpresaActiva(event.target.value)}>
                  <option value="">-- Selecciona un giro --</option>
                  <option value="COMERCIO_ABARROTES">Comercio de abarrotes</option>
                  <option value="TRANSPORTE_PERSONAS">Transporte de personas</option>
                  <option value="TRANSPORTE_CARGA">Transporte de carga</option>
                  <option value="AGRICULTURA">Agricultura</option>
                  <option value="ARRIENDO_INMOBILIARIO">Arriendo inmobiliario</option>
                  <option value="CONSTRUCCION">Construcción</option>
                  <option value="MANUFACTURA">Manufactura e industria</option>
                  <option value="SERVICIOS_PROFESIONALES">Servicios profesionales</option>
                  <option value="GENERICO">Actividad genérica</option>
                  <option value="OTROS">Otros (personalizado)</option>
                </select>
              </label>
              {giroEmpresaActiva === "OTROS" ? (
                <label>
                  ¿Cuál es tu giro?
                  <input 
                    value={giroPersonalizadoActiva} 
                    onChange={(event) => setGiroPersonalizadoActiva(event.target.value)} 
                    placeholder="Ej: Consultoria en tecnologia"
                  />
                </label>
              ) : null}
              <button type="submit" disabled={guardandoEmpresaActiva}>{guardandoEmpresaActiva ? "Guardando..." : "Actualizar empresa"}</button>
            </form>
          ) : null}
        </article>

        <article className="card">
          <h2>Nueva cuenta contable</h2>
          <form className="empresa-form" onSubmit={(event) => void onCrearCuenta(event)}>
            <label>
              Codigo
              <input value={codigoCuenta} onChange={(event) => setCodigoCuenta(event.target.value)} placeholder="Ej: 1.1.1.01" />
            </label>
            <label>
              Nombre
              <input value={nombreCuenta} onChange={(event) => setNombreCuenta(event.target.value)} placeholder="Ej: Caja" />
            </label>
            <label>
              Tipo
              <select value={tipoCuenta} onChange={(event) => setTipoCuenta(event.target.value)}>
                <option value="ACTIVO">ACTIVO</option>
                <option value="PASIVO">PASIVO</option>
                <option value="PATRIMONIO">PATRIMONIO</option>
                <option value="INGRESO">INGRESO</option>
                <option value="GASTO">GASTO</option>
              </select>
            </label>
            <label>
              Naturaleza
              <select value={naturalezaCuenta} onChange={(event) => setNaturalezaCuenta(event.target.value)}>
                <option value="DEUDORA">DEUDORA</option>
                <option value="ACREEDORA">ACREEDORA</option>
              </select>
            </label>
            <button type="submit" disabled={guardandoCuenta || !empresaActivaId}>{guardandoCuenta ? "Guardando..." : "Guardar cuenta"}</button>
          </form>
        </article>
      </section>
        </>
      ) : null}

      {vista !== "principal" ? (
        <section className="card empresa-contexto-card">
          <div className="card-header-row">
            <div>
              <h2>Empresa en uso</h2>
              <p>Confirma aquí con qué contribuyente estás trabajando antes de registrar o revisar información.</p>
            </div>
            <button type="button" className="btn-secundario" onClick={() => setVista("principal")}>Cambiar en Principal</button>
          </div>
          {!empresaActiva ? (
            <p>No hay empresa activa seleccionada. Ve a Principal para escoger la empresa con la que quieres operar.</p>
          ) : (
            <div className="empresa-contexto-grid">
              <div className="empresa-contexto-item">
                <span>Nombre</span>
                <strong>{empresaActiva.nombre}</strong>
              </div>
              <div className="empresa-contexto-item">
                <span>RUT</span>
                <strong>{empresaActiva.rut || "No informado"}</strong>
              </div>
              <div className="empresa-contexto-item">
                <span>Moneda</span>
                <strong>{empresaActiva.moneda}</strong>
              </div>
              <div className="empresa-contexto-item">
                <span>Giro</span>
                <strong>{empresaActiva.giro || "No informado"}</strong>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {vista === "soporte" ? (
        <section className="card soporte-centro-card">
          <div className="card-header-row">
            <div>
              <h2>Centro de soporte</h2>
              <p>Diagnostico rapido del sistema y pasos recomendados para resolver problemas comunes.</p>
            </div>
            <button type="button" className="btn-secundario" onClick={() => setVista("principal")}>Volver a Principal</button>
          </div>

          <div className="soporte-centro-grid">
            <article className="soporte-centro-item">
              <h3>Estado actual</h3>
              <ul>
                <li><strong>Version:</strong> {supportInfo?.version ?? "Sin dato"}</li>
                <li><strong>Modo:</strong> {supportInfo?.isPackaged ? "Instalada" : "Desarrollo"}</li>
                <li><strong>Almacenamiento:</strong> {labelStorageMode}</li>
              </ul>
              <p className="hint-line">Ruta de datos: {supportInfo?.userDataPath ?? "No disponible"}</p>
            </article>

            <article className="soporte-centro-item">
              <h3>Problemas detectados</h3>
              <ul>
                {indicadoresError ? <li>{indicadoresError}</li> : null}
                {supportInfo?.storageMode === "fallback" ? (
                  <li>La app esta trabajando en modo JSON fallback; revisa permisos y disponibilidad de SQLite.</li>
                ) : null}
                {updateState?.status === "error" && updateState.lastError ? (
                  <li>Error de actualizacion: {updateState.lastError}</li>
                ) : null}
                {updateState?.status === "disabled" ? (
                  <li>Auto-actualizacion deshabilitada. Debes definir una URL de updates para activar descargas automaticas.</li>
                ) : null}
                {!supportInfo ? <li>No se pudo leer informacion de soporte del sistema.</li> : null}
                {!indicadoresError && supportInfo?.storageMode !== "fallback" && updateState?.status !== "error" ? (
                  <li>No se detectan alertas criticas por ahora.</li>
                ) : null}
              </ul>
            </article>

            <article className="soporte-centro-item">
              <h3>Actualizaciones de la app</h3>
              <p className={`update-pill update-pill-${updateState?.status ?? "disabled"}`}>
                Estado: {estadoUpdateLabel}
              </p>
              <ul>
                <li><strong>Version actual:</strong> {updateState?.currentVersion ?? supportInfo?.version ?? "Sin dato"}</li>
                <li><strong>Proveedor:</strong> {updateState?.provider ?? supportInfo?.updateProvider ?? "disabled"}</li>
                <li><strong>Version objetivo:</strong> {updateState?.latestVersion ?? "Sin detectar"}</li>
                <li>
                  <strong>Ultima verificacion:</strong>{" "}
                  {updateState?.lastCheckedAt
                    ? new Date(updateState.lastCheckedAt).toLocaleString("es-CL")
                    : "Sin registro"}
                </li>
                {typeof updateState?.downloadPercent === "number" ? (
                  <li><strong>Descarga:</strong> {updateState.downloadPercent.toFixed(1)}%</li>
                ) : null}
              </ul>
              <div className="soporte-actions">
                <button type="button" onClick={() => void onBuscarActualizacionesAhora()} disabled={buscandoActualizacion}>
                  {buscandoActualizacion ? "Buscando..." : "Buscar ahora"}
                </button>
                <button
                  type="button"
                  className="btn-secundario"
                  onClick={() => void onInstalarActualizacionDescargada()}
                  disabled={instalandoActualizacion || updateState?.status !== "downloaded"}
                >
                  {instalandoActualizacion ? "Instalando..." : "Instalar y reiniciar"}
                </button>
              </div>
              {updateState?.releaseNotes?.length ? (
                <div className="soporte-release-notes">
                  <strong>Novedades detectadas</strong>
                  <ul>
                    {updateState.releaseNotes.map((note, idx) => (
                      <li key={`${idx}-${note.slice(0, 20)}`}>{note}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="hint-line">No hay notas de version disponibles por ahora.</p>
              )}
            </article>

            <article className="soporte-centro-item">
              <h3>Ayuda y soluciones</h3>
              <ol>
                <li>Si la app abre en gris, reinstala desde el ultimo instalador y vuelve a abrir desde Inicio.</li>
                <li>Si no puedes guardar, abre la carpeta de datos y verifica permisos de escritura.</li>
                <li>Antes de actualizar, crea siempre un respaldo para proteger la base.</li>
              </ol>
              <div className="soporte-actions">
                <button type="button" onClick={onCrearRespaldo} disabled={creandoRespaldo}>
                  {creandoRespaldo ? "Generando respaldo..." : "Crear respaldo"}
                </button>
                <button
                  type="button"
                  className="btn-secundario"
                  onClick={onAbrirCarpetaDatos}
                  disabled={abriendoCarpetaDatos}
                >
                  {abriendoCarpetaDatos ? "Abriendo..." : "Abrir carpeta de datos"}
                </button>
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {vista === "principal" ? (
        <>
          <section className="card">
            <h2>Plan de cuentas</h2>
            <button type="button" onClick={() => void onSeedPlanBase()} disabled={!empresaActivaId} style={{ marginBottom: "1rem" }}>Cargar plan base Chile</button>
            {empresaActivaId && cuentas.length === 0 ? <p>No hay cuentas cargadas para la empresa activa.</p> : null}
            {!empresaActivaId ? <p>Selecciona una empresa para ver sus cuentas.</p> : null}
            {cuentas.length > 0 ? (
              <table className="tabla-cuentas">
                <thead>
                  <tr>
                    <th>Codigo</th>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th>Naturaleza</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cuentas.map((cuenta) => (
                    <tr key={cuenta.id}>
                      <td>{cuenta.codigo}</td>
                      <td>
                        {editandoCuentaId === cuenta.id ? (
                          <input className="input-inline" value={editandoNombreCuenta} onChange={(event) => setEditandoNombreCuenta(event.target.value)} />
                        ) : cuenta.nombre}
                      </td>
                      <td>{cuenta.tipo}</td>
                      <td>{cuenta.naturaleza}</td>
                      <td>
                        {editandoCuentaId === cuenta.id ? (
                          <div className="acciones-inline">
                            <button type="button" className="btn-secundario" disabled={guardandoEdicionCuenta} onClick={() => void guardarEdicionCuenta(cuenta.id)}>Guardar</button>
                            <button type="button" className="btn-secundario" disabled={guardandoEdicionCuenta} onClick={cancelarEdicionCuenta}>Cancelar</button>
                          </div>
                        ) : (
                          <button type="button" className="btn-secundario" onClick={() => iniciarEdicionCuenta(cuenta)}>Editar</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </section>

          <section className="empresa-layout">
            <article className="card">
              <h2>Registro automatico</h2>
              <p className="hint-line">Giro activo: {giroActivoTexto}. Describe la operacion y el sistema la interpreta segun reglas tributarias de Chile.</p>
              <form className="empresa-form" onSubmit={(event) => void onAnalizarOperacion(event)}>
                <label>
                  Fecha
                  <input type="date" value={fechaOperacion} onChange={(event) => setFechaOperacion(event.target.value)} />
                </label>
                <label>
                  Describe la operacion
                  <textarea
                    value={textoOperacion}
                    onChange={(event) => setTextoOperacion(event.target.value)}
                    placeholder="Ej: se compraron mercaderias por 159999 con factura / se vendio por 250000 con boleta / honorarios por 300000"
                    rows={4}
                  />
                </label>
                <p className="hint-line">Palabras clave: compra, venta, gasto, honorarios • factura, boleta, sin factura • caja, banco, proveedor</p>
                <button type="submit" disabled={!empresaActivaId || analizando}>{analizando ? "Analizando..." : "Analizar operacion"}</button>
              </form>
            </article>

            {pendienteConfirmacion ? (
              <article className="card preview-card">
                <h2>Confirmar operacion</h2>
                <div className="preview-filas">
                  <div className="preview-fila"><span>Tipo</span><strong>{{ COMPRA_GENERAL: "Compra de mercaderias", VENTA_GENERAL: "Venta", GASTO_GENERAL: "Gasto general", SUELDOS: "Sueldos y remuneraciones", ARRIENDO: "Arriendo", SERVICIOS_BASICOS: "Servicios basicos", HONORARIOS: "Honorarios", CAPITAL_INICIAL: "Capital inicial" }[pendienteConfirmacion.interpretacion.categoriaOperacion] ?? pendienteConfirmacion.interpretacion.categoriaOperacion}</strong></div>
                  <div className="preview-fila"><span>Modo IVA</span><strong>{{ NO_APLICA: "No aplica", IVA_INCLUIDO: "IVA incluido", MAS_IVA: "Mas IVA" }[pendienteConfirmacion.interpretacion.modoIva] ?? pendienteConfirmacion.interpretacion.modoIva}</strong></div>
                  <div className="preview-fila"><span>Monto base</span><strong>$ {pendienteConfirmacion.interpretacion.montoBase.toLocaleString("es-CL")}</strong></div>
                  <div className="preview-fila"><span>Monto neto</span><strong>$ {pendienteConfirmacion.interpretacion.montoNeto.toLocaleString("es-CL")}</strong></div>
                  <div className="preview-fila"><span>IVA</span><strong>$ {pendienteConfirmacion.interpretacion.montoIva.toLocaleString("es-CL")}</strong></div>
                  <div className="preview-fila"><span>Monto total</span><strong>$ {pendienteConfirmacion.interpretacion.montoTotal.toLocaleString("es-CL")}</strong></div>
                  <div className="preview-fila"><span>Contrapartida</span><strong>{{ CAJA: "Caja", BANCO: "Banco", PROVEEDOR: "Proveedor", CLIENTE: "Cliente" }[pendienteConfirmacion.interpretacion.medioPago] ?? pendienteConfirmacion.interpretacion.medioPago}</strong></div>
                  <div className="preview-fila"><span>Documento</span><strong className={pendienteConfirmacion.interpretacion.tipoDocumento === "DESCONOCIDO" ? "badge-alerta" : "badge-ok"}>{{ FACTURA: "Factura", FACTURA_EXENTA: "Factura exenta", BOLETA: "Boleta", BOLETA_EXENTA: "Boleta exenta", BOLETA_HONORARIOS: "Boleta de honorarios", SIN_DOCUMENTO: "Sin documento", DESCONOCIDO: "Por confirmar" }[pendienteConfirmacion.interpretacion.tipoDocumento] ?? pendienteConfirmacion.interpretacion.tipoDocumento}</strong></div>
                  <div className="preview-fila preview-fila-detalle"><span>Tratamiento tributario</span><strong>{pendienteConfirmacion.interpretacion.resumenTributario}</strong></div>
                </div>
                {pendienteConfirmacion.necesitaConfirmacion ? (
                  <div className="confirmacion-pregunta">
                    <p><strong>{pendienteConfirmacion.pregunta}</strong></p>
                    <div className="opciones-documento">
                      {pendienteConfirmacion.opcionesDocumento.map((op) => (
                        <button key={op.valor} className="btn-opcion-doc" type="button" disabled={confirmando} onClick={() => void onConfirmarRegistro(op.valor)}>
                          <strong>{op.etiqueta}</strong>
                          <small>{op.descripcion}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="acciones-confirmacion">
                    <button type="button" onClick={() => void onConfirmarRegistro()} disabled={confirmando}>{confirmando ? "Registrando..." : "Confirmar y registrar"}</button>
                  </div>
                )}
                <button type="button" className="btn-secundario" style={{ marginTop: "0.75rem" }} onClick={() => setPendienteConfirmacion(null)}>Cancelar</button>
              </article>
            ) : (
              <article className="card">
                <h2>Asientos recientes</h2>
                {!empresaActivaId ? <p>Selecciona una empresa para ver asientos.</p> : null}
                {empresaActivaId && asientos.length === 0 ? <p>Aun no hay asientos registrados.</p> : null}
                {edicionAsientoDocumento ? (
                  <div className="asiento-edit-box">
                    <div className="asiento-edit-header">
                      <div>
                        <strong>Editar documento del asiento #{edicionAsientoDocumento.asientoId}</strong>
                        <p>{edicionAsientoDocumento.descripcion}</p>
                      </div>
                    </div>
                    <label className="tributario-control">
                      Tipo de documento tributario
                      <select value={tipoDocumentoEdicion} onChange={(event) => setTipoDocumentoEdicion(event.target.value)}>
                        {edicionAsientoDocumento.opcionesDocumento.map((op) => (
                          <option key={op.valor} value={op.valor}>
                            {op.etiqueta}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="hint-line" style={{ marginTop: "0.45rem" }}>
                      Al guardar, el sistema recalcula el asiento y su tratamiento tributario con el nuevo documento.
                    </p>
                    <div className="acciones-confirmacion">
                      <button type="button" onClick={() => void onGuardarDocumentoAsiento()} disabled={guardandoDocumentoAsiento}>
                        {guardandoDocumentoAsiento ? "Actualizando..." : "Guardar cambio"}
                      </button>
                      <button type="button" className="btn-secundario" onClick={onCancelarEdicionDocumentoAsiento} disabled={guardandoDocumentoAsiento}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : null}
                {asientos.length > 0 ? (
                  <table className="tabla-cuentas">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Fecha</th>
                        <th>Descripcion</th>
                        <th>Documento</th>
                        <th>Debe</th>
                        <th>Haber</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asientos.map((asiento) => {
                        const revisionCount = asiento.revision_count ?? 0;
                        const historial = historialAsientos[asiento.id] ?? [];
                        const historialVisible = historialAsientoAbierto === asiento.id;

                        return (
                          <Fragment key={asiento.id}>
                            <tr>
                              <td>{asiento.id}</td>
                              <td>{asiento.fecha}</td>
                              <td>{asiento.descripcion}</td>
                              <td>
                                <div className="asiento-documento-cell">
                                  <span>{labelDocumentoDesdeReferencia(asiento.referencia)}</span>
                                  {revisionCount > 1 ? <span className="asiento-ajustado-badge">Ajustado</span> : null}
                                </div>
                              </td>
                              <td>{asiento.total_debe.toFixed(2)}</td>
                              <td>{asiento.total_haber.toFixed(2)}</td>
                              <td>
                                <div className="asiento-acciones-cell">
                                  <button type="button" className="btn-secundario" onClick={() => void onEditarDocumentoAsiento(asiento.id)}>
                                    Editar doc
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-secundario"
                                    onClick={() => void onToggleHistorialAsiento(asiento.id)}
                                    disabled={revisionCount === 0}
                                  >
                                    {historialVisible ? "Ocultar historial" : "Ver historial"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {historialVisible ? (
                              <tr className="asiento-historial-row">
                                <td colSpan={7}>
                                  <div className="asiento-historial-box">
                                    <strong>Historial tributario del asiento #{asiento.id}</strong>
                                    {cargandoHistorialAsientoId === asiento.id ? <p className="hint-line">Cargando historial...</p> : null}
                                    {cargandoHistorialAsientoId !== asiento.id && historial.length === 0 ? (
                                      <p className="hint-line">No hay revisiones registradas para este asiento.</p>
                                    ) : null}
                                    {cargandoHistorialAsientoId !== asiento.id && historial.length > 0 ? (
                                      <div className="asiento-historial-list">
                                        {historial.map((item, index) => (
                                          <div key={item.id} className="asiento-historial-item">
                                            <div className="asiento-historial-item-top">
                                              <span className="asiento-historial-version">
                                                {index === 0 ? "Version actual" : `Revision ${historial.length - index}`}
                                              </span>
                                              <span>{fmtFechaHistorial(item.created_at)}</span>
                                            </div>
                                            <div className="asiento-historial-item-grid">
                                              <span>
                                                Documento
                                                <strong>{labelDocumentoDesdeReferencia(`DOC:${item.tipo_documento}`)}</strong>
                                              </span>
                                              <span>
                                                IVA
                                                <strong>{labelModoIva(item.modo_iva)}</strong>
                                              </span>
                                              <span>
                                                Fecha operacion
                                                <strong>{item.fecha_operacion}</strong>
                                              </span>
                                              <span>
                                                Total
                                                <strong>{fmtMonto(item.monto_total)}</strong>
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                ) : null}
              </article>
            )}
          </section>
        </>
      ) : null}

      {vista === "auditoria" ? (
        <section className="card">
          <div className="card-header-row">
            <div>
              <h2>Auditoría inteligente</h2>
              <p>Copiloto local que analiza lo registrado y te entrega riesgos, observaciones y consejos operativos en tiempo real.</p>
            </div>
          </div>
          {!empresaActivaId ? <p>Selecciona una empresa para ver el historial.</p> : null}
          {cargandoReporte ? <p>Cargando auditoria...</p> : null}
          {!cargandoReporte && auditoria.length === 0 && empresaActivaId ? <p>No hay registros aun.</p> : null}
          {auditoriaInteligente ? (
            <div className="auditoria-ai-layout">
              <article className={`auditoria-ai-hero auditoria-ai-hero-${auditoriaInteligente.estadoGeneral}`}>
                <div className="auditoria-ai-score-wrap">
                  <div className="auditoria-ai-score-ring">
                    <strong>{auditoriaInteligente.score}</strong>
                    <span>/100</span>
                  </div>
                  <div>
                    <p className="eyebrow">Radar IA de auditoría</p>
                    <h3>
                      {auditoriaInteligente.estadoGeneral === "critico"
                        ? "Riesgo alto"
                        : auditoriaInteligente.estadoGeneral === "aviso"
                          ? "Riesgo medio"
                          : "Riesgo controlado"}
                    </h3>
                    <p>{auditoriaInteligente.resumenNarrativo}</p>
                  </div>
                </div>

                <div className="auditoria-ai-kpis">
                  <div className="auditoria-ai-kpi">
                    <span>Operaciones auditadas</span>
                    <strong>{auditoriaInteligente.totalRegistros}</strong>
                  </div>
                  <div className="auditoria-ai-kpi">
                    <span>Monto observado</span>
                    <strong>{fmtMontoContable(auditoriaInteligente.montoObservado)}</strong>
                  </div>
                  <div className="auditoria-ai-kpi">
                    <span>Documentación definida</span>
                    <strong>{auditoriaInteligente.porcentajeDocumentado.toFixed(1)}%</strong>
                  </div>
                  <div className="auditoria-ai-kpi">
                    <span>Asientos ajustados</span>
                    <strong>{auditoriaInteligente.cantidadAjustados}</strong>
                  </div>
                </div>
              </article>

              {preguntasAuditoriaCopiloto.length > 0 ? (
                <article className="auditoria-ai-card">
                  <h3>Preguntas del copiloto</h3>
                  <div className="auditoria-ai-questions">
                    {preguntasAuditoriaCopiloto.map((pregunta) => (
                      <div key={pregunta.id} className="auditoria-ai-question">
                        <div>
                          <strong>{pregunta.pregunta}</strong>
                          <p>{pregunta.detalle}</p>
                        </div>
                        <button type="button" onClick={() => void onResponderPreguntaAuditoria(pregunta)}>
                          {pregunta.accionLabel}
                        </button>
                      </div>
                    ))}
                  </div>
                </article>
              ) : null}

              <div className="auditoria-ai-grid">
                <article className="auditoria-ai-card">
                  <h3>Bandeja priorizada del auditor</h3>
                  {colaCasosAuditoria.length === 0 ? (
                    <p>No hay casos urgentes abiertos. El copiloto no ve incidencias listas para trabajar ahora.</p>
                  ) : (
                    <div className="auditoria-ai-case-list">
                      {colaCasosAuditoria.map((caso, index) => (
                        <div key={caso.id} className="auditoria-ai-case-item">
                          <div className="auditoria-ai-case-top">
                            <span className={`auditoria-ai-pill auditoria-ai-pill-${caso.estado}`}>
                              {caso.estado === "critico" ? "Prioridad alta" : caso.estado === "aviso" ? "Prioridad media" : "Seguimiento"}
                            </span>
                            <small>Caso #{index + 1}</small>
                          </div>
                          <strong>{caso.titulo}</strong>
                          <p>{caso.detalle}</p>
                          <div className="auditoria-ai-case-meta">
                            <span>Asiento #{caso.asientoId}</span>
                            <span>Monto {fmtMontoContable(caso.monto)}</span>
                          </div>
                          <div className="asiento-acciones-cell" style={{ marginTop: "0.7rem" }}>
                            <button
                              type="button"
                              onClick={() => void onResponderPreguntaAuditoria({
                                id: `case-primary-${caso.id}`,
                                pregunta: caso.titulo,
                                detalle: caso.detalle,
                                accion: caso.accionPrincipal.toLowerCase().includes("historial") ? "view-history" : "edit-doc",
                                accionLabel: caso.accionPrincipal,
                                asientoId: caso.asientoId
                              })}
                            >
                              {caso.accionPrincipal}
                            </button>
                            <button
                              type="button"
                              className="btn-secundario"
                              onClick={() => void onResponderPreguntaAuditoria({
                                id: `case-secondary-${caso.id}`,
                                pregunta: caso.titulo,
                                detalle: caso.detalle,
                                accion: caso.accionSecundaria.toLowerCase().includes("historial") ? "view-history" : "edit-doc",
                                accionLabel: caso.accionSecundaria,
                                asientoId: caso.asientoId
                              })}
                            >
                              {caso.accionSecundaria}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>

                <article className="auditoria-ai-card">
                  <h3>Plan de cierre del auditor</h3>
                  <div className="auditoria-ai-checklist">
                    {checklistCierreAuditoria.map((item) => (
                      <div key={item.id} className={`auditoria-ai-check-item auditoria-ai-check-item-${item.estado}`}>
                        <div className="auditoria-ai-check-top">
                          <strong>{item.titulo}</strong>
                          <span className={`auditoria-ai-pill auditoria-ai-pill-${item.estado}`}>
                            {item.estado === "critico" ? "Bloquea" : item.estado === "aviso" ? "Pendiente" : "Listo"}
                          </span>
                        </div>
                        <p>{item.detalle}</p>
                      </div>
                    ))}
                  </div>

                  <h3 style={{ marginTop: "1rem" }}>Tendencias históricas</h3>
                  {memoriaAuditoriaEmpresa && memoriaAuditoriaEmpresa.patrones.length > 0 ? (
                    <div className="auditoria-ai-trend-list">
                      {memoriaAuditoriaEmpresa.patrones.slice(0, 4).map((patron) => {
                        const estado: EstadoControl = patron.veces >= 4 || patron.maximo >= 4 ? "critico" : patron.veces >= 2 ? "aviso" : "ok";
                        return (
                          <div key={`trend-${patron.clave}`} className="auditoria-ai-trend-item">
                            <div className="auditoria-ai-check-top">
                              <strong>{patron.titulo}</strong>
                              <span className={`auditoria-ai-pill auditoria-ai-pill-${estado}`}>
                                {estado === "critico" ? "Recurrente" : estado === "aviso" ? "En seguimiento" : "Aislado"}
                              </span>
                            </div>
                            <p>{patron.detalle}</p>
                            <div className="auditoria-ai-case-meta">
                              <span>Apariciones {patron.veces}</span>
                              <span>Máximo {patron.maximo}</span>
                              <span>Actual {patron.ultimaCantidad}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="hint-line">Todavía no hay suficiente historial para identificar tendencias sostenidas.</p>
                  )}
                </article>
              </div>

              <div className="auditoria-ai-grid">
                <article className="auditoria-ai-card">
                  <h3>Hallazgos prioritarios</h3>
                  {auditoriaInteligente.hallazgos.length === 0 ? (
                    <p>No se detectaron hallazgos relevantes en esta revisión.</p>
                  ) : (
                    <div className="auditoria-ai-findings">
                      {auditoriaInteligente.hallazgos.map((hallazgo, index) => (
                        <div key={`${hallazgo.titulo}-${index}`} className="auditoria-ai-finding">
                          <div className="auditoria-ai-finding-top">
                            <span className={`auditoria-ai-pill auditoria-ai-pill-${hallazgo.estado}`}>
                              {hallazgo.estado === "critico" ? "Crítico" : hallazgo.estado === "aviso" ? "Atención" : "Controlado"}
                            </span>
                            {typeof hallazgo.cantidad === "number" ? <small>{hallazgo.cantidad} caso(s)</small> : null}
                          </div>
                          <strong>{hallazgo.titulo}</strong>
                          <p>{hallazgo.detalle}</p>
                          <div className="auditoria-ai-reco-box">
                            <span>Qué haría ahora</span>
                            <strong>{hallazgo.recomendacion}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>

                <article className="auditoria-ai-card">
                  <h3>Consejos del copiloto</h3>
                  <ul className="auditoria-ai-lista">
                    {auditoriaInteligente.recomendaciones.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>

                  <h3 style={{ marginTop: "1rem" }}>Señales positivas</h3>
                  <ul className="auditoria-ai-lista auditoria-ai-lista-fortaleza">
                    {auditoriaInteligente.fortalezas.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>

                  <h3 style={{ marginTop: "1rem" }}>Memoria de esta empresa</h3>
                  {memoriaAuditoriaEmpresa && memoriaAuditoriaEmpresa.patrones.length > 0 ? (
                    <div className="auditoria-ai-memory-list">
                      {memoriaAuditoriaEmpresa.patrones.slice(0, 4).map((patron) => (
                        <div key={patron.clave} className="auditoria-ai-memory-item">
                          <strong>{patron.titulo}</strong>
                          <p>{patron.detalle}</p>
                          <span>
                            Detectado {patron.veces} vez/veces. Máximo observado: {patron.maximo}. Última lectura: {patron.ultimaCantidad}.
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="hint-line">Aún no hay memoria suficiente para esta empresa. Se irá formando con cada revisión y corrección.</p>
                  )}

                  <div className="auditoria-ai-mini-metrics">
                    <div>
                      <span>Sin documento</span>
                      <strong>{auditoriaInteligente.registrosSinDocumento}</strong>
                    </div>
                    <div>
                      <span>Registros con respaldo</span>
                      <strong>{Math.max(0, auditoriaInteligente.totalRegistros - auditoriaInteligente.registrosSinDocumento)}</strong>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          ) : null}
          {edicionAsientoDocumento ? (
            <div className="asiento-edit-box" style={{ marginTop: "1rem" }}>
              <div className="asiento-edit-header">
                <div>
                  <strong>Editar documento del asiento #{edicionAsientoDocumento.asientoId}</strong>
                  <p>{edicionAsientoDocumento.descripcion}</p>
                </div>
              </div>
              <label className="tributario-control">
                Tipo de documento tributario
                <select value={tipoDocumentoEdicion} onChange={(event) => setTipoDocumentoEdicion(event.target.value)}>
                  {edicionAsientoDocumento.opcionesDocumento.map((op) => (
                    <option key={op.valor} value={op.valor}>
                      {op.etiqueta}
                    </option>
                  ))}
                </select>
              </label>
              <p className="hint-line" style={{ marginTop: "0.45rem" }}>
                Esta corrección queda trazada en el historial del asiento y actualiza la revisión automática de auditoría.
              </p>
              <div className="acciones-confirmacion">
                <button type="button" onClick={() => void onGuardarDocumentoAsiento()} disabled={guardandoDocumentoAsiento}>
                  {guardandoDocumentoAsiento ? "Actualizando..." : "Guardar cambio"}
                </button>
                <button type="button" className="btn-secundario" onClick={onCancelarEdicionDocumentoAsiento} disabled={guardandoDocumentoAsiento}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}
          {historialAsientoAbierto ? (
            <div className="asiento-historial-box" style={{ marginTop: "1rem", border: "1px solid #d2e0eb", borderRadius: "12px", padding: "0.9rem", background: "#fbfdff" }}>
              <strong>Historial tributario del asiento #{historialAsientoAbierto}</strong>
              {cargandoHistorialAsientoId === historialAsientoAbierto ? <p className="hint-line">Cargando historial...</p> : null}
              {cargandoHistorialAsientoId !== historialAsientoAbierto && (historialAsientos[historialAsientoAbierto] ?? []).length === 0 ? (
                <p className="hint-line">No hay revisiones registradas para este asiento.</p>
              ) : null}
              {cargandoHistorialAsientoId !== historialAsientoAbierto && (historialAsientos[historialAsientoAbierto] ?? []).length > 0 ? (
                <div className="asiento-historial-list">
                  {(historialAsientos[historialAsientoAbierto] ?? []).map((item, index) => (
                    <div key={item.id} className="asiento-historial-item">
                      <div className="asiento-historial-item-top">
                        <span className="asiento-historial-version">
                          {index === 0 ? "Version actual" : `Revision ${(historialAsientos[historialAsientoAbierto] ?? []).length - index}`}
                        </span>
                        <span>{fmtFechaHistorial(item.created_at)}</span>
                      </div>
                      <div className="asiento-historial-item-grid">
                        <span>
                          Documento
                          <strong>{labelDocumentoDesdeReferencia(`DOC:${item.tipo_documento}`)}</strong>
                        </span>
                        <span>
                          IVA
                          <strong>{labelModoIva(item.modo_iva)}</strong>
                        </span>
                        <span>
                          Fecha operacion
                          <strong>{item.fecha_operacion}</strong>
                        </span>
                        <span>
                          Total
                          <strong>{fmtMonto(item.monto_total)}</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {auditoria.length > 0 ? (
            <div className="auditoria-ai-table-wrap">
              <h3>Registro detallado para revisión</h3>
              <table className="tabla-cuentas">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Texto</th>
                    <th>Categoria</th>
                    <th>Documento</th>
                    <th>Modo IVA</th>
                    <th>Total</th>
                    <th>Asiento</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {auditoria.map((item) => (
                    <tr key={item.id}>
                      <td>{item.fecha_operacion}</td>
                      <td>{item.texto_original}</td>
                      <td>{item.categoria_operacion}</td>
                      <td>
                        <span
                          className={`auditoria-ai-pill ${
                            item.tipo_documento === "SIN_DOCUMENTO" || item.tipo_documento === "DESCONOCIDO"
                              ? "auditoria-ai-pill-critico"
                              : "auditoria-ai-pill-ok"
                          }`}
                        >
                          {item.tipo_documento}
                        </span>
                      </td>
                      <td>{item.modo_iva}</td>
                      <td>$ {item.monto_total.toLocaleString("es-CL")}</td>
                      <td>{item.asiento_id ?? "-"}</td>
                      <td>
                        {item.asiento_id ? (
                          <div className="asiento-acciones-cell">
                            <button type="button" className="btn-secundario" onClick={() => void onEditarDocumentoAsiento(item.asiento_id!)}>
                              Corregir doc
                            </button>
                            <button type="button" className="btn-secundario" onClick={() => void onToggleHistorialAsiento(item.asiento_id!)}>
                              Ver historial
                            </button>
                          </div>
                        ) : (
                          <span className="hint-line">Sin acción</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {vista === "libro-diario" ? (
        <section className="card">
          <div className="card-header-row">
            <div>
              <h2>Libro diario</h2>
              <p>Asientos con detalle de lineas y filtros por fecha.</p>
            </div>
            <button type="button" onClick={() => void onExportarLibroDiario()} disabled={!empresaActivaId}>Exportar CSV</button>
          </div>
          <div className="filtros-row">
            <label>
              Desde
              <input type="date" value={fechaDesde} onChange={(event) => setFechaDesde(event.target.value)} />
            </label>
            <label>
              Hasta
              <input type="date" value={fechaHasta} onChange={(event) => setFechaHasta(event.target.value)} />
            </label>
            <button type="button" className="btn-secundario" onClick={() => void cargarVistaActual()}>Aplicar</button>
          </div>
          {!empresaActivaId ? <p>Selecciona una empresa para ver el libro diario.</p> : null}
          {cargandoReporte ? <p>Cargando libro diario...</p> : null}
          {!cargandoReporte && libroDiario.length === 0 && empresaActivaId ? <p>No hay asientos en el rango seleccionado.</p> : null}
          <div className="diario-lista">
            {libroDiario.map((fila) => (
              <article key={fila.asientoId} className="diario-item">
                <button type="button" className="diario-toggle" onClick={() => void onAbrirAsiento(fila.asientoId)}>
                  <strong>Asiento #{fila.asientoId}</strong>
                  <span>{fila.fecha} | {fila.descripcion}</span>
                </button>
                {asientoAbierto === fila.asientoId ? (
                  <table className="tabla-cuentas tabla-interna">
                    <thead>
                      <tr>
                        <th>Codigo</th>
                        <th>Cuenta</th>
                        <th>Debe</th>
                        <th>Haber</th>
                        <th>Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(asientoLineas[fila.asientoId] ?? fila.lineas).map((linea) => (
                        <tr key={linea.id}>
                          <td>{linea.cuenta_codigo}</td>
                          <td>{linea.cuenta_nombre}</td>
                          <td>{linea.debe.toFixed(2)}</td>
                          <td>{linea.haber.toFixed(2)}</td>
                          <td>{linea.detalle}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {vista === "libro-mayor" ? (
        <section className="card">
          <h2>Libro mayor</h2>
          <div className="filtros-row">
            <label>
              Cuenta
              <select value={cuentaMayorId ?? ""} onChange={(event) => setCuentaMayorId(event.target.value ? Number(event.target.value) : null)}>
                <option value="">Selecciona una cuenta</option>
                {cuentas.map((cuenta) => (
                  <option key={cuenta.id} value={cuenta.id}>{cuenta.codigo} | {cuenta.nombre}</option>
                ))}
              </select>
            </label>
            <button type="button" className="btn-secundario" onClick={() => void cargarVistaActual()} disabled={!cuentaMayorId}>Ver mayor</button>
          </div>
          {!empresaActivaId ? <p>Selecciona una empresa para ver el libro mayor.</p> : null}
          {cargandoReporte ? <p>Cargando libro mayor...</p> : null}
          {!cargandoReporte && libroMayor.length === 0 && cuentaMayorId ? <p>No hay movimientos para la cuenta seleccionada.</p> : null}
          {libroMayor.length > 0 ? (
            <table className="tabla-cuentas">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Asiento</th>
                  <th>Descripcion</th>
                  <th>Debe</th>
                  <th>Haber</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {libroMayor.map((fila) => (
                  <tr key={`${fila.asientoId}-${fila.detalle ?? "sin-detalle"}-${fila.saldo}`}>
                    <td>{fila.fecha}</td>
                    <td>{fila.asientoId}</td>
                    <td>{fila.descripcion}</td>
                    <td>{fila.debe.toFixed(2)}</td>
                    <td>{fila.haber.toFixed(2)}</td>
                    <td>{fila.saldo.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}

      {vista === "balance" ? (
        <section className="card">
          <div className="card-header-row">
            <div>
              <h2>Balance de Situacion</h2>
              <p>Vista estructurada tipo estado financiero (Activo vs PN y Pasivo).</p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button
                type="button"
                className={vistaBalance === "general" ? "tab-button tab-button-active" : "tab-button btn-secundario"}
                onClick={() => setVistaBalance("general")}
              >Estado financiero</button>
              <button
                type="button"
                className={vistaBalance === "comprobacion" ? "tab-button tab-button-active" : "tab-button btn-secundario"}
                onClick={() => setVistaBalance("comprobacion")}
              >Comprobacion</button>
              <button type="button" onClick={() => void onExportarBalance()} disabled={!empresaActivaId}>Exportar CSV</button>
            </div>
          </div>

          {!empresaActivaId ? <p>Selecciona una empresa para ver el balance.</p> : null}
          {cargandoReporte ? <p>Cargando balance...</p> : null}
          {!cargandoReporte && balance.length === 0 && empresaActivaId ? (
            <p>No hay movimientos para construir el balance. Registra operaciones primero.</p>
          ) : null}

          {vistaBalance === "general" && balanceGeneral ? (
            <div className="balance-cuadro-wrap">
              <div className="balance-cuadro-title">Balance de Situacion {empresaActiva?.nombre ? `- ${empresaActiva.nombre}` : ""}</div>
              <table className="balance-cuadro">
                <thead>
                  <tr>
                    <th>ACTIVO</th>
                    <th>Importe</th>
                    <th>PN Y PASIVO</th>
                    <th>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {balanceGeneral.filasCuadro.map((fila, idx) => (
                    <tr key={`fila-balance-${idx}`}>
                      <td className={`bc-cell bc-${fila.izquierda.tipo}`}>{fila.izquierda.etiqueta}</td>
                      <td className={`bc-monto bc-${fila.izquierda.tipo}`}>
                        {fila.izquierda.monto !== undefined ? fmtMontoContable(fila.izquierda.monto) : ""}
                      </td>
                      <td className={`bc-cell bc-${fila.derecha.tipo}`}>{fila.derecha.etiqueta}</td>
                      <td className={`bc-monto bc-${fila.derecha.tipo}`}>
                        {fila.derecha.monto !== undefined ? fmtMontoContable(fila.derecha.monto) : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="hint-line" style={{ marginTop: "0.6rem" }}>
                Nota: los importes son referenciales segun los saldos registrados en el sistema al momento de consulta.
              </p>
            </div>
          ) : null}

          {vistaBalance === "comprobacion" && balance.length > 0 ? (
            <table className="tabla-cuentas">
              <thead>
                <tr>
                  <th>Codigo</th>
                  <th>Cuenta</th>
                  <th>Debe</th>
                  <th>Haber</th>
                  <th>Saldo deudor</th>
                  <th>Saldo acreedor</th>
                </tr>
              </thead>
              <tbody>
                {balance.map((fila) => (
                  <tr key={fila.cuentaId}>
                    <td>{fila.codigo}</td>
                    <td>{fila.nombre}</td>
                    <td>{fila.totalDebe.toFixed(2)}</td>
                    <td>{fila.totalHaber.toFixed(2)}</td>
                    <td>{fila.saldoDeudor.toFixed(2)}</td>
                    <td>{fila.saldoAcreedor.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}

      {vista === "estado-resultados" ? (
        <section className="card">
          <div className="card-header-row">
            <div>
              <h2>Estado de Resultados</h2>
              <p>Resumen de ingresos, gastos y resultado del periodo.</p>
            </div>
          </div>
          {!empresaActivaId ? <p>Selecciona una empresa para ver el estado de resultados.</p> : null}
          {cargandoReporte ? <p>Cargando estado de resultados...</p> : null}
          {!cargandoReporte && !estadoResultados && empresaActivaId ? <p>No hay informacion suficiente para calcular resultados.</p> : null}
          {estadoResultados ? (
            <div className="resultado-wrap">
              <table className="resultado-tabla">
                <tbody>
                  <tr>
                    <td>Ingresos del periodo</td>
                    <td>{fmtMontoContable(estadoResultados.totalIngresos)}</td>
                  </tr>
                  <tr>
                    <td>Gastos y costos del periodo</td>
                    <td>{fmtMontoContable(estadoResultados.totalGastos)}</td>
                  </tr>
                  <tr className="resultado-final">
                    <td>Resultado del ejercicio</td>
                    <td>{fmtMontoContable(estadoResultados.resultadoAntesImpuesto)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {vista === "tributario" ? (
        <section className="card">
          <div className="card-header-row">
            <div>
              <h2>Panel Tributario Chile 2026</h2>
              <p>Preparacion asistida de pre-declaraciones para cargar en SII con respaldo trazable.</p>
            </div>
            <div className="tributario-acciones">
              <button type="button" className="btn-secundario" onClick={onImprimirReporteTributario} disabled={!resumenTributario}>Imprimir respaldo</button>
              <button type="button" onClick={onMarcarListoParaDeclarar} disabled={!resumenTributario || !firmaRevisionCompleta}>Marcar listo para declarar</button>
            </div>
          </div>

          {!empresaActivaId ? <p>Selecciona una empresa para usar el panel tributario.</p> : null}
          {cargandoReporte ? <p>Cargando datos tributarios...</p> : null}
          {!cargandoReporte && !resumenTributario && empresaActivaId ? <p>No hay informacion tributaria suficiente aun.</p> : null}

          {resumenTributario ? (
            <div className="tributario-grid">
              <article className="tributario-card">
                <h3>Configuracion tributaria base</h3>
                <label className="tributario-control">
                  Periodo tributario
                  <div className="tributario-periodo-row">
                    <select value={periodoMes} onChange={(event) => setPeriodoMes(event.target.value)}>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => (
                        <option key={mes} value={String(mes)}>{String(mes).padStart(2, "0")}</option>
                      ))}
                    </select>
                    <input type="number" min={2020} max={2100} value={periodoAnio} onChange={(event) => setPeriodoAnio(event.target.value)} />
                  </div>
                </label>
                <label className="tributario-control">
                  Regimen tributario
                  <select value={regimenTributario} onChange={(event) => setRegimenTributario(event.target.value as "14D3" | "14D8" | "SEMI")}>
                    <option value="14D3">Pro Pyme General (14D3) - IDPC 25%</option>
                    <option value="14D8">Pro Pyme Transparente (14D8) - sin IDPC empresa</option>
                    <option value="SEMI">Semi integrado - IDPC 27%</option>
                  </select>
                </label>
                <label className="tributario-control">
                  Tasa PPM estimada (%)
                  <input type="number" min={0} step={0.1} value={tasaPpm} onChange={(event) => setTasaPpm(Number(event.target.value) || 0)} />
                </label>
                <div className="tributario-fila tributario-total">
                  <span>Estado controles</span>
                  <strong>{resumenControles.ok} OK | {resumenControles.aviso} Aviso | {resumenControles.critico} Critico</strong>
                </div>
                <p className={tieneControlesCriticos ? "tributario-alerta tributario-alerta-critica" : "tributario-alerta tributario-alerta-ok"}>
                  {tieneControlesCriticos
                    ? "Hay observaciones criticas. No declarar hasta resolverlas."
                    : "Sin bloqueos criticos. Periodo habilitado para revision final y declaracion."}
                </p>
                <div className="tributario-firma-box">
                  <h4>Firma de revision obligatoria</h4>
                  <label className="tributario-control">
                    Revisor responsable
                    <input value={revisorTributario} onChange={(event) => setRevisorTributario(event.target.value)} placeholder="Nombre del contador revisor" />
                  </label>
                  <label className="tributario-control">
                    Fecha de revision
                    <input type="date" value={fechaRevisionTributaria} onChange={(event) => setFechaRevisionTributaria(event.target.value)} />
                  </label>
                  <label className="tributario-check">
                    <input type="checkbox" checked={confirmacionRevision} onChange={(event) => setConfirmacionRevision(event.target.checked)} />
                    Confirmo que revise lineas, soportes y cumplimiento antes de declarar.
                  </label>
                </div>
              </article>

              <article className="tributario-card">
                <h3>Pre-Formulario 29 ({periodoMes.padStart(2, "0")}/{periodoAnio})</h3>
                <table className="tributario-tabla-lineas">
                  <thead>
                    <tr>
                      <th>Linea</th>
                      <th>Concepto</th>
                      <th>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineasPreF29.map((l) => (
                      <tr key={l.linea}>
                        <td>{l.linea}</td>
                        <td>
                          <strong>{l.concepto}</strong>
                          <div className="tributario-soporte">{l.soporte}</div>
                        </td>
                        <td>{fmtMontoContable(l.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="hint-line">Catalogo anual aplicado: {periodoAnio}. Valores para carga manual en SII y revision previa.</p>
              </article>

              <article className="tributario-card">
                <h3>Pre-Operacion Renta F22 + Global Complementario</h3>
                <div className="socios-resumen-box">
                  <div className="tributario-fila">
                    <span>Dueños registrados</span>
                    <strong>{sociosEmpresaActiva.length}</strong>
                  </div>
                  <div className="tributario-fila">
                    <span>Total aportes iniciales</span>
                    <strong>{fmtMontoContable(totalAportesSocios)}</strong>
                  </div>
                  <div className="tributario-fila">
                    <span>Participacion total informada</span>
                    <strong>{fmtMontoContable(totalParticipacionSocios)}%</strong>
                  </div>
                  <p className="hint-line" style={{ marginTop: "0.4rem" }}>
                    La administracion detallada de dueños y aportes ahora esta en la pestaña Socios.
                  </p>
                </div>

                {sociosEmpresaActiva.length > 0 ? (
                  <label className="tributario-control">
                    Socio o accionista para simulacion de Global Complementario
                    <select
                      value={String(indiceSocioGlobal)}
                      onChange={(event) => setIndiceSocioGlobal(Number(event.target.value) || 0)}
                    >
                      {sociosEmpresaActiva.map((socio, idx) => (
                        <option key={`${socio.nombre}-opt-${idx}`} value={String(idx)}>
                          {socio.nombre} ({fmtMontoContable(socio.participacion)}%)
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="tributario-control">
                    Participacion del socio en utilidad (%)
                    <input type="number" min={0} max={100} step={1} value={participacionSocio} onChange={(event) => setParticipacionSocio(Number(event.target.value) || 0)} />
                  </label>
                )}
                <label className="tributario-control">
                  Otros ingresos anuales del contribuyente (CLP)
                  <input type="number" min={0} step={1000} value={otrosIngresosGlobal} onChange={(event) => setOtrosIngresosGlobal(Number(event.target.value) || 0)} />
                </label>
                <p className="hint-line" style={{ marginTop: "0.35rem" }}>
                  Base Global aplicada con {sociosEmpresaActiva.length > 0 && socioSeleccionadoGlobal
                    ? `${socioSeleccionadoGlobal.nombre} (${fmtMontoContable(participacionGlobalAplicada)}%)`
                    : `participacion manual (${fmtMontoContable(participacionGlobalAplicada)}%)`}.
                </p>
                <table className="tributario-tabla-lineas" style={{ marginTop: "0.6rem" }}>
                  <thead>
                    <tr>
                      <th>Linea</th>
                      <th>Concepto</th>
                      <th>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineasPreF22.map((l) => (
                      <tr key={l.linea}>
                        <td>{l.linea}</td>
                        <td>
                          <strong>{l.concepto}</strong>
                          <div className="tributario-soporte">{l.soporte}</div>
                        </td>
                        <td>{fmtMontoContable(l.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="hint-line">F22 y Global Complementario se tratan de forma integrada segun perfil del contribuyente.</p>
              </article>

              <article className="tributario-card">
                <h3>Estado de cumplimiento del periodo</h3>
                <ul className="tributario-lista-estado">
                  {controlesCumplimiento.map((item, idx) => (
                    <li key={`control-${idx}`} className={`estado-${item.estado}`}>
                      <div className="estado-titulo">{item.titulo}</div>
                      <div className="estado-detalle">{item.detalle}</div>
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          ) : null}

          <p className="hint-line" style={{ marginTop: "0.8rem" }}>
            Importante: este panel es de apoyo operacional. La declaracion final debe revisarse con la normativa vigente del SII y validarse por contador.
          </p>
        </section>
      ) : null}

      {vista === "socios" ? (
        <section className="card">
          <div className="card-header-row">
            <div>
              <h2>Socios y Aportes</h2>
              <p>Administra multiples socios o accionistas, su capital inicial aportado y su porcentaje de participacion.</p>
            </div>
          </div>

          {!empresaActivaId ? <p>Selecciona una empresa para administrar socios.</p> : null}

          {empresaActivaId ? (
            <div className="socios-grid">
              <article className="tributario-card">
                <h3>Alta de socio o accionista</h3>
                <div className="socios-box" style={{ marginTop: 0 }}>
                  <div className="socios-form-grid">
                    <label className="socios-field socios-field-wide">
                      Nombre socio/accionista
                      <input
                        value={nombreSocio}
                        onChange={(event) => setNombreSocio(event.target.value)}
                        placeholder="Ej: Ignacio Romero"
                      />
                    </label>
                    <label className="socios-field">
                      Aporte inicial (CLP)
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={aporteSocio}
                        onChange={(event) => setAporteSocio(event.target.value)}
                        placeholder="Ej: 5000000"
                      />
                    </label>
                    <label className="socios-field">
                      Participacion (%)
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={participacionNuevoSocio}
                        onChange={(event) => setParticipacionNuevoSocio(event.target.value)}
                        placeholder="Ej: 40"
                      />
                    </label>
                  </div>
                  <div className="socios-form-actions">
                    <button type="button" className="btn-principal" onClick={() => void onAgregarSocio()}>
                      Agregar socio
                    </button>
                  </div>
                  <p className="hint-line" style={{ marginTop: "0.5rem" }}>
                    Puedes cargar una empresa que ya parte con varios accionistas o seguir agregando nuevos socios en el tiempo.
                  </p>
                </div>
              </article>

              <article className="tributario-card">
                <h3>Estructura societaria actual</h3>
                {sociosEmpresaActiva.length > 0 ? (
                  <table className="tributario-tabla-lineas socios-tabla">
                    <thead>
                      <tr>
                        <th>Socio/Accionista</th>
                        <th>Aporte inicial</th>
                        <th>% participacion</th>
                        <th>Accion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sociosEmpresaActiva.map((socio) => (
                        <tr key={socio.id}>
                          <td>
                            {editandoSocioId === socio.id ? (
                              <input
                                value={editandoNombreSocio}
                                onChange={(event) => setEditandoNombreSocio(event.target.value)}
                                placeholder="Nombre socio/accionista"
                              />
                            ) : (
                              socio.nombre
                            )}
                          </td>
                          <td>
                            {editandoSocioId === socio.id ? (
                              <input
                                type="number"
                                min={0}
                                step={1000}
                                value={editandoAporteSocio}
                                onChange={(event) => setEditandoAporteSocio(event.target.value)}
                              />
                            ) : (
                              fmtMontoContable(socio.aporte_inicial)
                            )}
                          </td>
                          <td>
                            {editandoSocioId === socio.id ? (
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.1}
                                value={editandoParticipacionSocio}
                                onChange={(event) => setEditandoParticipacionSocio(event.target.value)}
                              />
                            ) : (
                              `${fmtMontoContable(socio.participacion)}%`
                            )}
                          </td>
                          <td>
                            <div className="socios-acciones-celda">
                              {editandoSocioId === socio.id ? (
                                <>
                                  <button type="button" className="btn-principal" onClick={() => void onGuardarEdicionSocio()}>
                                    Guardar
                                  </button>
                                  <button type="button" className="btn-secundario" onClick={onCancelarEdicionSocio}>
                                    Cancelar
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button type="button" className="btn-secundario" onClick={() => onIniciarEdicionSocio(socio)}>
                                    Editar
                                  </button>
                                  <button type="button" className="btn-secundario" onClick={() => void onEliminarSocio(socio.id)}>
                                    Quitar
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>No hay socios cargados todavia.</p>
                )}

                <div className="socios-kpis">
                  <div className="socios-kpi">
                    <span>Total aportes</span>
                    <strong>{fmtMontoContable(totalAportesSocios)}</strong>
                  </div>
                  <div className="socios-kpi">
                    <span>Total participacion</span>
                    <strong>{fmtMontoContable(totalParticipacionSocios)}%</strong>
                  </div>
                  <div className="socios-kpi">
                    <span>Estado distribucion</span>
                    <strong>{Math.abs(100 - totalParticipacionSocios) < 0.01 ? "Cuadrada" : "Revisar"}</strong>
                  </div>
                </div>
              </article>
            </div>
          ) : null}
        </section>
      ) : null}

      {mensajeError ? <p className="error-box">{mensajeError}</p> : null}
      {mensajeInfo ? <p className="info-box">{mensajeInfo}</p> : null}
    </main>
  );
}
