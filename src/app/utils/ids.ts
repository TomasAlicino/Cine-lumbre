const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin caracteres ambiguos (0/O, 1/I)

function bloque(largo: number): string {
  return Array.from({ length: largo }, () => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join('');
}

/** Código legible del pedido. Es lo que contiene el QR y lo que el empleado puede tipear a mano. */
export function nuevoCodigoEntrada(): string {
  return `LMB-${bloque(4)}-${bloque(4)}`;
}

/** Identificador de la pestaña que está comprando (para distinguir mis bloqueos de los ajenos). */
export function nuevaSesion(): string {
  return bloque(12);
}
