import { describe, expect, it } from "vitest";
import {
  calcularDesgloseMontos,
  detectarCategoriaOperacion,
  detectarModoIva,
  type TipoOperacionExtendida
} from "./tributario";

describe("detectarCategoriaOperacion", () => {
  it("clasifica sueldos como categoria SUELDOS", () => {
    const tipo: TipoOperacionExtendida = "GASTO_SERVICIOS";
    expect(detectarCategoriaOperacion("se cancelaron sueldos del personal", tipo)).toBe("SUELDOS");
  });

  it("clasifica arriendo como categoria ARRIENDO", () => {
    const tipo: TipoOperacionExtendida = "GASTO_SERVICIOS";
    expect(detectarCategoriaOperacion("se paga arriendo de local", tipo)).toBe("ARRIENDO");
  });

  it("clasifica servicios basicos", () => {
    const tipo: TipoOperacionExtendida = "GASTO_SERVICIOS";
    expect(detectarCategoriaOperacion("pago de internet y luz", tipo)).toBe("SERVICIOS_BASICOS");
  });
});

describe("detectarModoIva", () => {
  it("detecta MAS_IVA", () => {
    expect(detectarModoIva("compra neto mas iva", true)).toBe("MAS_IVA");
  });

  it("detecta IVA_INCLUIDO", () => {
    expect(detectarModoIva("venta con iva incluido", true)).toBe("IVA_INCLUIDO");
  });

  it("devuelve NO_APLICA cuando no corresponde IVA", () => {
    expect(detectarModoIva("pago de sueldos", false)).toBe("NO_APLICA");
  });
});

describe("calcularDesgloseMontos", () => {
  it("calcula correctamente modo MAS_IVA", () => {
    const resultado = calcularDesgloseMontos(100000, true, "MAS_IVA");
    expect(resultado.montoNeto).toBe(100000);
    expect(resultado.montoIva).toBe(19000);
    expect(resultado.montoTotal).toBe(119000);
  });

  it("calcula correctamente modo IVA_INCLUIDO", () => {
    const resultado = calcularDesgloseMontos(119000, true, "IVA_INCLUIDO");
    expect(resultado.montoNeto).toBe(100000);
    expect(resultado.montoIva).toBe(19000);
    expect(resultado.montoTotal).toBe(119000);
  });

  it("mantiene monto sin IVA cuando no aplica", () => {
    const resultado = calcularDesgloseMontos(9000000, false, "NO_APLICA");
    expect(resultado.montoNeto).toBe(9000000);
    expect(resultado.montoIva).toBe(0);
    expect(resultado.montoTotal).toBe(9000000);
  });
});
