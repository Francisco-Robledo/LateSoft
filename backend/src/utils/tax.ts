/**
 * Calcula el desglose de IVA a partir de un precio final bruto según las reglas de Argentina.
 * Fórmula: neto = round(bruto / (1 + tasa / 100), 2)
 *          iva  = round(bruto - neto, 2)
 */
export function calculateTaxFromGross(grossAmount: number, taxRatePercentage: number = 21.00): {
  gross: number;
  net: number;
  tax: number;
  taxRate: number;
} {
  const gross = Math.round(grossAmount * 100) / 100;
  if (taxRatePercentage <= 0) {
    return {
      gross,
      net: gross,
      tax: 0.00,
      taxRate: 0.00,
    };
  }

  const net = Math.round((gross / (1 + taxRatePercentage / 100)) * 100) / 100;
  const tax = Math.round((gross - net) * 100) / 100;

  return {
    gross,
    net,
    tax,
    taxRate: taxRatePercentage,
  };
}

/**
 * Formateador de moneda para pesos argentinos (es-AR).
 */
export const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatArs(amount: number): string {
  return currencyFormatter.format(amount);
}
