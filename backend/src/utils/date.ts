/**
 * Obtiene la fecha comercial actual en zona horaria America/Argentina/Buenos_Aires
 * Formato: YYYY-MM-DD
 */
export function getArgentinaBusinessDate(date: Date = new Date()): string {
  // Obtenemos año, mes y día en la zona horaria argentina
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // Retorna formato ISO YYYY-MM-DD
}
