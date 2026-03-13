import { describe, expect, it } from "vitest";
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
  type GiroEmpresa
} from "./tributario";

// ── Helpers ────────────────────────────────────────────────────────────────────
function interpretarCompleto(textoRaw: string) {
  const texto = normalizarTextoOperacion(textoRaw);
  const tipoOperacion = detectarTipoOperacionExtendida(texto);
  const categoriaOperacion = detectarCategoriaOperacion(texto, tipoOperacion);
  const tipoDocumento = detectarDocumentoTributario(texto);
  const aplicaIva = tipoOperacionAplicaIva(tipoOperacion) && documentoAplicaIva(tipoDocumento);
  const modoIva = detectarModoIva(texto, aplicaIva);
  const montoBase = extraerMontoDesdeTexto(texto);
  const desglose = calcularDesgloseMontos(montoBase, aplicaIva, modoIva);
  return { tipoOperacion, categoriaOperacion, tipoDocumento, aplicaIva, modoIva, ...desglose };
}

// ── Compras ────────────────────────────────────────────────────────────────────
describe("Compra de mercadería con factura", () => {
  it("detecta compra con factura afecta IVA incluido", () => {
    const r = interpretarCompleto("se compraron mercaderías por 119000 con factura");
    expect(r.tipoOperacion).toBe("COMPRA_MERCADERIAS");
    expect(r.categoriaOperacion).toBe("COMPRA_GENERAL");
    expect(r.tipoDocumento).toBe("FACTURA");
    expect(r.aplicaIva).toBe(true);
    expect(r.modoIva).toBe("IVA_INCLUIDO");
    expect(r.montoNeto).toBe(100000);
    expect(r.montoIva).toBe(19000);
    expect(r.montoTotal).toBe(119000);
  });

  it("detecta compra con factura más IVA separado", () => {
    const r = interpretarCompleto("compra de insumos 100000 mas iva con factura");
    expect(r.tipoDocumento).toBe("FACTURA");
    expect(r.modoIva).toBe("MAS_IVA");
    expect(r.montoNeto).toBe(100000);
    expect(r.montoIva).toBe(19000);
    expect(r.montoTotal).toBe(119000);
  });

  it("detecta compra con factura exenta sin IVA", () => {
    const r = interpretarCompleto("compra de insumos 50000 factura exenta");
    expect(r.tipoDocumento).toBe("FACTURA_EXENTA");
    expect(r.aplicaIva).toBe(false);
    expect(r.montoIva).toBe(0);
    expect(r.montoTotal).toBe(50000);
  });
});

// ── Ventas ─────────────────────────────────────────────────────────────────────
describe("Ventas", () => {
  it("detecta venta con boleta afecta", () => {
    const r = interpretarCompleto("se vendio servicio por 250000 con boleta");
    expect(r.tipoOperacion).toBe("VENTA_MERCADERIAS");
    expect(r.categoriaOperacion).toBe("VENTA_GENERAL");
    expect(r.tipoDocumento).toBe("BOLETA");
    expect(r.aplicaIva).toBe(true);
    expect(r.montoNeto).toBeCloseTo(210084.03, 2);
    expect(r.montoIva).toBeCloseTo(39915.97, 2);
    expect(r.montoTotal).toBe(250000);
  });

  it("detecta venta con factura afecta", () => {
    const r = interpretarCompleto("ingreso por venta 500000 con factura");
    expect(r.tipoDocumento).toBe("FACTURA");
    expect(r.tipoOperacion).toBe("VENTA_MERCADERIAS");
  });

  it("detecta ingresos por traslados de pasajeros como venta", () => {
    const r = interpretarCompleto("ingresos por traslados de pasajeros 8000000");
    expect(r.tipoOperacion).toBe("VENTA_MERCADERIAS");
    expect(r.categoriaOperacion).toBe("VENTA_GENERAL");
    expect(r.montoTotal).toBe(8000000);
  });

  it("detecta venta sin documento", () => {
    const r = interpretarCompleto("venta directa 30000 sin documento");
    expect(r.tipoDocumento).toBe("SIN_DOCUMENTO");
    expect(r.aplicaIva).toBe(false);
    expect(r.montoTotal).toBe(30000);
  });
});

// ── Gastos específicos ──────────────────────────────────────────────────────────
describe("Gastos específicos", () => {
  it("detecta sueldos sin IVA sin documento", () => {
    const r = interpretarCompleto("se cancelaron sueldos del personal 9000000");
    expect(r.tipoOperacion).toBe("GASTO_SERVICIOS");
    expect(r.categoriaOperacion).toBe("SUELDOS");
    // categoria SUELDOS → SIN_DOCUMENTO en db.ts (ajuste de contexto), pero el raw detecta DESCONOCIDO
    // en la integración pura sin ajuste, el documento sería DESCONOCIDO
    expect(r.aplicaIva).toBe(false);
    expect(r.montoBase).toBe(9000000);
    expect(r.montoTotal).toBe(9000000);
  });

  it("detecta arriendo desconocido pero sin mención IVA", () => {
    const r = interpretarCompleto("pago de arriendo local 700000");
    expect(r.categoriaOperacion).toBe("ARRIENDO");
    expect(r.tipoDocumento).toBe("DESCONOCIDO");
    // porque el texto no menciona "factura" ni "boleta"
  });

  it("detecta servicios básicos: luz, agua, internet", () => {
    const r = interpretarCompleto("pago de internet y luz 45000");
    expect(r.categoriaOperacion).toBe("SERVICIOS_BASICOS");
  });
});

// ── Honorarios ─────────────────────────────────────────────────────────────────
describe("Honorarios profesionales", () => {
  it("detecta boleta de honorarios sin IVA", () => {
    const r = interpretarCompleto("pago de honorarios 300000 con boleta de honorarios");
    expect(r.tipoOperacion).toBe("HONORARIOS");
    expect(r.tipoDocumento).toBe("BOLETA_HONORARIOS");
    expect(r.aplicaIva).toBe(false);
    expect(r.montoIva).toBe(0);
    expect(r.montoTotal).toBe(300000);
  });
});

// ── Normalización y extracción de montos ───────────────────────────────────────
describe("Normalización de texto y extracción de montos", () => {
  it("normaliza acentos y mayúsculas", () => {
    expect(normalizarTextoOperacion("Compra de Mercadería")).toBe("compra de mercaderia");
  });

  it("extrae monto con punto separador de miles", () => {
    expect(extraerMontoDesdeTexto("venta de 1.500.000 pesos")).toBe(1500000);
  });

  it("extrae monto simple", () => {
    expect(extraerMontoDesdeTexto("gasto de 45000")).toBe(45000);
  });

  it("lanza error cuando no hay monto", () => {
    expect(() => extraerMontoDesdeTexto("compra sin precio")).toThrow();
  });
});

// ── Capital Inicial ───────────────────────────────────────────────────────────
describe("Apertura de empresa - Capital inicial", () => {
  it("detecta capital inicial simple", () => {
    const r = interpretarCompleto("capital inicial 10000000");
    expect(r.tipoOperacion).toBe("CAPITAL_INICIAL");
    expect(r.categoriaOperacion).toBe("CAPITAL_INICIAL");
    expect(r.tipoDocumento).toBe("DESCONOCIDO");
    expect(r.aplicaIva).toBe(false);
    expect(r.montoIva).toBe(0);
    expect(r.montoTotal).toBe(10000000);
  });

  it("detecta aporte inicial de capital", () => {
    const r = interpretarCompleto("aporte de capital inicial 5000000");
    expect(r.tipoOperacion).toBe("CAPITAL_INICIAL");
    expect(r.categoriaOperacion).toBe("CAPITAL_INICIAL");
    expect(r.aplicaIva).toBe(false);
  });

  it("detecta inversión inicial", () => {
    const r = interpretarCompleto("inversion inicial 2500000");
    expect(r.tipoOperacion).toBe("CAPITAL_INICIAL");
    expect(r.categoriaOperacion).toBe("CAPITAL_INICIAL");
  });

  it("detecta apertura de empresa", () => {
    const r = interpretarCompleto("apertura empresa con capital 15000000");
    expect(r.tipoOperacion).toBe("CAPITAL_INICIAL");
    expect(r.categoriaOperacion).toBe("CAPITAL_INICIAL");
    expect(r.montoTotal).toBe(15000000);
  });

  it("detecta aporte inicial en activo como vehiculo", () => {
    const r = interpretarCompleto("vehiculo inicial bus 8000000");
    expect(r.tipoOperacion).toBe("CAPITAL_INICIAL");
    expect(r.categoriaOperacion).toBe("CAPITAL_INICIAL");
    expect(r.montoTotal).toBe(8000000);
    expect(r.aplicaIva).toBe(false);
  });
});

// ── Giros Empresariales ──────────────────────────────────────────────────
describe("Clasificación por giro empresarial", () => {
  it("transporte de personas: venta exenta de IVA", () => {
    const giro: GiroEmpresa = "TRANSPORTE_PERSONAS";
    expect(giroAplicaIvaEnVentas(giro)).toBe(false);
  });

  it("transporte de carga: venta con IVA", () => {
    const giro: GiroEmpresa = "TRANSPORTE_CARGA";
    expect(giroAplicaIvaEnVentas(giro)).toBe(true);
  });

  it("comercio abarrotes: venta con IVA", () => {
    const giro: GiroEmpresa = "COMERCIO_ABARROTES";
    expect(giroAplicaIvaEnVentas(giro)).toBe(true);
  });

  it("operación típica de comercio abarrotes", () => {
    const giro: GiroEmpresa = "COMERCIO_ABARROTES";
    const texto = "venta de abarrotes";
    const operacion = "VENTA_MERCADERIAS";
    expect(operacionEsTipicaDelGiro(giro, texto, operacion)).toBe(true);
  });

  it("operación típica de transporte personas", () => {
    const giro: GiroEmpresa = "TRANSPORTE_PERSONAS";
    const texto = "transporte de pasajeros";
    const operacion = "VENTA_MERCADERIAS";
    expect(operacionEsTipicaDelGiro(giro, texto, operacion)).toBe(true);
  });

  it("operación típica de agricultura", () => {
    const giro: GiroEmpresa = "AGRICULTURA";
    const texto = "venta de cosecha de trigo";
    const operacion = "VENTA_MERCADERIAS";
    expect(operacionEsTipicaDelGiro(giro, texto, operacion)).toBe(true);
  });
});
