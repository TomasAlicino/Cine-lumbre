export function nuevoId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Código legible para el QR, sin caracteres ambiguos (0/O, 1/I). */
export function nuevoCodigoEntrada(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const parte = () => Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join('');
  return `LMB-${parte()}-${parte()}`;
}
