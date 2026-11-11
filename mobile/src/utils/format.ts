/**
 * Formateador de moneda oficial para la República Argentina (ARS).
 * Ejemplo: $ 2.200,00
 */
export const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPrice(amount: number): string {
  if (isNaN(amount)) return '$ 0,00';
  return currencyFormatter.format(amount);
}

/**
 * Formateador de fecha y hora local argentina
 */
export function formatDateTime(dateString: string): string {
  try {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return dateString;
  }
}

/**
 * Formateador solo de hora para tickets y KDS de barra (ej: 10:50)
 */
export function formatTimeOnly(dateString: string): string {
  try {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return dateString;
  }
}

export type ReportDateRange = 'today' | '7days' | '30days' | 'year' | 'all';

export const REPORT_DATE_RANGE_OPTIONS: ReadonlyArray<{ key: ReportDateRange; label: string }> = [
  { key: 'today', label: 'Hoy' },
  { key: '7days', label: 'Últimos 7 días' },
  { key: '30days', label: 'Últimos 30 días' },
  { key: 'year', label: 'Último año' },
  { key: 'all', label: 'General' },
];

function formatArtYyyyMmDd(shiftedArtUtcDate: Date): string {
  const y = shiftedArtUtcDate.getUTCFullYear();
  const m = String(shiftedArtUtcDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shiftedArtUtcDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calcula los límites `from` y `to` (YYYY-MM-DD en horario Argentina UTC-3)
 * según el filtro seleccionado para métricas y reportes.
 */
export function getReportDateBounds(range: ReportDateRange): { from?: string; to?: string } {
  if (range === 'all') {
    return {};
  }

  // Argentina opera en UTC-3 fijo; usamos fecha UTC desplazada -3h para consistencia con business_date
  const ART_OFFSET_MS = 3 * 60 * 60 * 1000;
  const toArtDate = new Date(Date.now() - ART_OFFSET_MS);
  const fromArtDate = new Date(toArtDate.getTime());

  if (range === '7days') {
    fromArtDate.setUTCDate(fromArtDate.getUTCDate() - 7);
  } else if (range === '30days') {
    fromArtDate.setUTCDate(fromArtDate.getUTCDate() - 30);
  } else if (range === 'year') {
    fromArtDate.setUTCFullYear(fromArtDate.getUTCFullYear() - 1);
  }

  return {
    from: formatArtYyyyMmDd(fromArtDate),
    to: formatArtYyyyMmDd(toArtDate),
  };
}
