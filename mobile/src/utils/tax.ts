export function calculateTaxFromGross(grossAmount: number, taxRatePercentage: number = 21.00): {
  gross: number;
  net: number;
  tax: number;
  taxRate: number;
} {
  const gross = Math.round(grossAmount * 100) / 100;
  if (taxRatePercentage <= 0) {
    return { gross, net: gross, tax: 0, taxRate: 0 };
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
