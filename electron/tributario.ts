export type TipoOperacionExtendida =
  | "COMPRA_MERCADERIAS"
  | "VENTA_MERCADERIAS"
  | "GASTO_SERVICIOS"
  | "HONORARIOS"
  | "CAPITAL_INICIAL";

export type CategoriaOperacion =
  | "COMPRA_GENERAL"
  | "VENTA_GENERAL"
  | "GASTO_GENERAL"
  | "SUELDOS"
  | "ARRIENDO"
  | "SERVICIOS_BASICOS"
  | "HONORARIOS"
  | "CAPITAL_INICIAL";

export type GiroEmpresa =
  | "COMERCIO_ABARROTES"
  | "TRANSPORTE_PERSONAS"
  | "TRANSPORTE_CARGA"
  | "AGRICULTURA"
  | "ARRIENDO_INMOBILIARIO"
  | "CONSTRUCCION"
  | "MANUFACTURA"
  | "SERVICIOS_PROFESIONALES"
  | "GENERICO";

export type ModoIva = "NO_APLICA" | "IVA_INCLUIDO" | "MAS_IVA";

export type TipoDocumentoTributario =
  | "FACTURA"
  | "FACTURA_EXENTA"
  | "BOLETA"
  | "BOLETA_EXENTA"
  | "BOLETA_HONORARIOS"
  | "SIN_DOCUMENTO"
  | "DESCONOCIDO";

function round2(value: number): number {
  return Number(value.toFixed(2));
}

export function normalizarTextoOperacion(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function extraerMontoDesdeTexto(texto: string): number {
  const matches = texto.match(/\d{1,3}(?:[.\s]\d{3})+|\d+(?:[.,]\d+)?/g) || [];
  const montos = matches
    .map((raw) => {
      const normalizado = raw.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
      const monto = Number(normalizado);
      return Number.isFinite(monto) ? monto : 0;
    })
    .filter((monto) => monto > 0);

  if (montos.length === 0) {
    throw new Error("No pude detectar un monto en el texto.");
  }
  return round2(Math.max(...montos));
}

export function detectarTipoOperacionExtendida(textoNormalizado: string): TipoOperacionExtendida {
  if (/(capital inicial|capital de apertura|aporte inicial|aporte de capital|inicio de capital|inversion inicial|inversion de apertura|aportes|apertura empresa|inicio empresa|inicio de actividades|constitucion de empresa|empresa nueva|aporte de socio|aporte de dueno|aportes de socios|vehiculo inicial|activo inicial|\binicial\b.*(aporte|capital|empresa|socio|dueno|vehiculo|activo)|(?:aporte|capital|empresa|socio|dueno|vehiculo|activo).*\binicial\b)/.test(textoNormalizado)) {
    return "CAPITAL_INICIAL";
  }
  if (/\n/.test(textoNormalizado) && /(banco|caja|computador|computadores|mobiliario|vehiculo|vehiculos|auto|camioneta|mueble|muebles|equipo)/.test(textoNormalizado)) {
    return "CAPITAL_INICIAL";
  }
  if (/(boleta de honorario|honorario)/.test(textoNormalizado)) {
    return "HONORARIOS";
  }
  if (/(venta|vendi|vendio|se vendieron|cobro por venta|ingreso por venta|ingresos por venta|ingresos? por (traslado|traslados|pasaje|pasajes|pasajero|pasajeros|transporte|servicio)|cobro por (traslado|traslados|pasaje|pasajes|pasajero|pasajeros|transporte|servicio)|servicio de transporte|emiti factura|emitio boleta)/.test(textoNormalizado)) {
    return "VENTA_MERCADERIAS";
  }
  if (/(compra|compraron|compro|adquiri|adquirio|mercaderi|inventario|insumo|stock|existencia|materia prima)/.test(textoNormalizado)) {
    return "COMPRA_MERCADERIAS";
  }
  if (/(gasto|pago de |servicio|arriendo|luz|agua|internet|telefono|gas|mantencion|reparacion|limpieza|seguro|transporte|combustible|sueldo|remuneracion)/.test(textoNormalizado)) {
    return "GASTO_SERVICIOS";
  }
  throw new Error("No pude clasificar la operacion. Usa palabras como: compra, venta, gasto, servicio, capital inicial, honorarios.");
}

export function detectarDocumentoTributario(textoNormalizado: string): TipoDocumentoTributario {
  if (/(boleta de honorario|honorario)/.test(textoNormalizado)) {
    return "BOLETA_HONORARIOS";
  }
  if (/(sin factura|sin boleta|sin documento|sin respaldo|informal|venta directa)/.test(textoNormalizado)) {
    return "SIN_DOCUMENTO";
  }
  if (/(factura exenta|factura no afecta|factura no gravada|exento con factura|exenta con factura)/.test(textoNormalizado)) {
    return "FACTURA_EXENTA";
  }
  if (/(boleta exenta|boleta no afecta|boleta no gravada|exento con boleta|exenta con boleta)/.test(textoNormalizado)) {
    return "BOLETA_EXENTA";
  }
  if (/(boleta electronica|boleta de venta|boleta de compra|con boleta|boleta)/.test(textoNormalizado)) {
    return "BOLETA";
  }
  if (/(factura electronica|con factura|factura)/.test(textoNormalizado)) {
    return "FACTURA";
  }
  return "DESCONOCIDO";
}

export function documentoAplicaIva(tipoDocumento: TipoDocumentoTributario): boolean {
  return tipoDocumento === "FACTURA" || tipoDocumento === "BOLETA";
}

export function tipoOperacionAplicaIva(tipoOperacion: TipoOperacionExtendida): boolean {
  return tipoOperacion !== "CAPITAL_INICIAL";
}

export function detectarCategoriaOperacion(
  textoNormalizado: string,
  tipoOperacion: TipoOperacionExtendida
): CategoriaOperacion {
  if (tipoOperacion === "CAPITAL_INICIAL") {
    return "CAPITAL_INICIAL";
  }

  if (tipoOperacion === "HONORARIOS") {
    return "HONORARIOS";
  }

  if (tipoOperacion === "COMPRA_MERCADERIAS") {
    return "COMPRA_GENERAL";
  }

  if (tipoOperacion === "VENTA_MERCADERIAS") {
    return "VENTA_GENERAL";
  }

  if (/(sueldo|sueldos|remuneracion|remuneraciones|nomina|planilla|liquidacion de sueldo|pago de personal)/.test(textoNormalizado)) {
    return "SUELDOS";
  }

  if (/(arriendo|alquiler|renta local|canon de arriendo)/.test(textoNormalizado)) {
    return "ARRIENDO";
  }

  if (/(luz|agua|internet|telefono|gas|electricidad|servicio basico|servicios basicos)/.test(textoNormalizado)) {
    return "SERVICIOS_BASICOS";
  }

  return "GASTO_GENERAL";
}

export function detectarModoIva(textoNormalizado: string, aplicaIva: boolean): ModoIva {
  if (!aplicaIva) {
    return "NO_APLICA";
  }

  if (/(mas iva|\+ ?iva|iva aparte|mas el iva|neto mas iva|valor neto)/.test(textoNormalizado)) {
    return "MAS_IVA";
  }

  if (/(iva incluido|incluye iva|con iva incluido|iva incl\.?|total con iva)/.test(textoNormalizado)) {
    return "IVA_INCLUIDO";
  }

  return "IVA_INCLUIDO";
}

export function calcularDesgloseMontos(
  montoBase: number,
  aplicaIva: boolean,
  modoIva: ModoIva
): { montoBase: number; montoNeto: number; montoIva: number; montoTotal: number } {
  if (!aplicaIva || modoIva === "NO_APLICA") {
    return {
      montoBase,
      montoNeto: montoBase,
      montoIva: 0,
      montoTotal: montoBase
    };
  }

  if (modoIva === "MAS_IVA") {
    const montoNeto = round2(montoBase);
    const montoIva = round2(montoNeto * 0.19);
    const montoTotal = round2(montoNeto + montoIva);
    return { montoBase, montoNeto, montoIva, montoTotal };
  }

  const montoTotal = round2(montoBase);
  const montoNeto = round2(montoTotal / 1.19);
  const montoIva = round2(montoTotal - montoNeto);
  return { montoBase, montoNeto, montoIva, montoTotal };
}

// ────────────────────────────────────────────────────────────────────────
// Funciones específicas por GIRO EMPRESARIAL
// ────────────────────────────────────────────────────────────────────────

export function giroAplicaIvaEnVentas(giro: GiroEmpresa): boolean {
  // Giros exentos de IVA en sus operaciones típicas
  const girosExentos: GiroEmpresa[] = ["TRANSPORTE_PERSONAS"];
  return !girosExentos.includes(giro);
}

export function operacionEsTipicaDelGiro(giro: GiroEmpresa, textoNormalizado: string, tipoOperacion: TipoOperacionExtendida): boolean {
  if (tipoOperacion !== "VENTA_MERCADERIAS") {
    return true; // No validar gastos/compras por ahora
  }

  switch (giro) {
    case "COMERCIO_ABARROTES":
      return /(venta|abarr|alimento|viveres|mercader)/.test(textoNormalizado);
    case "TRANSPORTE_PERSONAS":
      return /(transporte|flete|pasaje|viaje|traslado)/.test(textoNormalizado) && !/carga/.test(textoNormalizado);
    case "TRANSPORTE_CARGA":
      return /(flete|carga|transporte|envio)/.test(textoNormalizado);
    case "AGRICULTURA":
      return /(venta de|cosecha|producto agricola|fruta|verdura|grano)/.test(textoNormalizado);
    case "ARRIENDO_INMOBILIARIO":
      return /(alquiler|canon|arriendo|renta|inmueble)/.test(textoNormalizado);
    case "CONSTRUCCION":
      return /(obra|contrato construccion|proyecto|edificacion)/.test(textoNormalizado);
    case "MANUFACTURA":
      return /(venta de|producto|manufactura|fabricado)/.test(textoNormalizado);
    case "SERVICIOS_PROFESIONALES":
      return /(servicio|consultor|asesor|honorario)/.test(textoNormalizado);
    case "GENERICO":
      return true;
  }
}

export function describirGiro(giro: GiroEmpresa): string {
  const descripciones: Record<GiroEmpresa, string> = {
    COMERCIO_ABARROTES: "Comercio de abarrotes",
    TRANSPORTE_PERSONAS: "Transporte de personas",
    TRANSPORTE_CARGA: "Transporte de carga",
    AGRICULTURA: "Agricultura",
    ARRIENDO_INMOBILIARIO: "Arriendo inmobiliario",
    CONSTRUCCION: "Construcción",
    MANUFACTURA: "Manufactura e industria",
    SERVICIOS_PROFESIONALES: "Servicios profesionales",
    GENERICO: "Actividad económica genérica"
  };
  return descripciones[giro] || "Desconocido";
}

export function getCuentasEspecificasPorGiro(giro: GiroEmpresa): Record<string, string> {
  switch (giro) {
    case "COMERCIO_ABARROTES":
      return {
        inventarioEspecifico: "1.1.3.02", // Inventario abarrotes (crear o usar genérico)
        costosVentas: "5.1.1.01"
      };
    case "TRANSPORTE_PERSONAS":
      return {
        flota: "1.2.1.01",
        combustible: "5.1.2.03",
        mantenimiento: "5.1.2.04"
      };
    case "TRANSPORTE_CARGA":
      return {
        flota: "1.2.1.01",
        combustible: "5.1.2.03",
        mantenimiento: "5.1.2.04"
      };
    case "AGRICULTURA":
      return {
        terrenos: "1.2.1.02",
        cosechas: "1.1.3.03",
        semillas: "5.1.1.04",
        fertilizantes: "5.1.1.05"
      };
    case "ARRIENDO_INMOBILIARIO":
      return {
        propiedades: "1.2.1.02",
        depreciacion: "5.3.1.01"
      };
    case "CONSTRUCCION":
      return {
        obrasEnCurso: "1.1.2.01",
        materiales: "5.1.1.06",
        subcontratos: "5.1.1.07"
      };
    case "MANUFACTURA":
      return {
        materiaPrima: "1.1.3.04",
        productosEnProceso: "1.1.3.05",
        productosTerminados: "1.1.3.06"
      };
    default:
      return {};
  }
}
