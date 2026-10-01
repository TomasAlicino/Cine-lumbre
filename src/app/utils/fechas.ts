/** Utilidades de fechas (siempre en hora local del cine). */

export function aISOFecha(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Convierte "yyyy-mm-dd" a Date local (evita el corrimiento UTC). */
export function desdeISOFecha(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function combinarFechaHora(isoFecha: string, hhmm: string): Date {
  const d = desdeISOFecha(isoFecha);
  const [h, min] = hhmm.split(':').map(Number);
  d.setHours(h, min, 0, 0);
  return d;
}

export function sumarDias(d: Date, dias: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + dias);
  return r;
}

export function sumarMinutos(d: Date, min: number): Date {
  return new Date(d.getTime() + min * 60_000);
}

export function mismoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function edad(fechaNacimiento: string, ref: Date = new Date()): number {
  const n = desdeISOFecha(fechaNacimiento);
  let e = ref.getFullYear() - n.getFullYear();
  const m = ref.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < n.getDate())) e--;
  return e;
}

/** "dd/mm/aaaa" → "yyyy-mm-dd" (o null si es inválida). */
export function parsearFechaAR(texto: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto ?? '');
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(+yyyy, +mm - 1, +dd);
  if (d.getFullYear() !== +yyyy || d.getMonth() !== +mm - 1 || d.getDate() !== +dd) return null;
  return aISOFecha(d);
}

export function formatearFechaAR(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Lunes de la semana de d. */
export function inicioSemana(d: Date): Date {
  const r = new Date(d);
  const dia = (r.getDay() + 6) % 7;
  r.setDate(r.getDate() - dia);
  r.setHours(0, 0, 0, 0);
  return r;
}

export const DIAS_SEMANA = [
  { valor: 1, corto: 'Lun', largo: 'Lunes' },
  { valor: 2, corto: 'Mar', largo: 'Martes' },
  { valor: 3, corto: 'Mié', largo: 'Miércoles' },
  { valor: 4, corto: 'Jue', largo: 'Jueves' },
  { valor: 5, corto: 'Vie', largo: 'Viernes' },
  { valor: 6, corto: 'Sáb', largo: 'Sábado' },
  { valor: 0, corto: 'Dom', largo: 'Domingo' },
];
