import { TipoButaca } from '../models/models';

/**
 * Distribución fija de todas las salas:
 * - 20 filas (A–T) con 3 bloques de 4, 20 y 4 butacas.
 * - Las filas J y K se quitaron y se reemplazaron por UNA fila accesible "JK" con 2, 10 y 2 butacas.
 * - Las filas R, S y T son VIP.
 */
export interface ButacaDef {
  id: string; // ej: "F12" o "JK3"
  fila: string;
  numero: number;
  bloque: 0 | 1 | 2;
  tipo: TipoButaca;
}

export interface FilaDef {
  etiqueta: string;
  tipo: TipoButaca;
  bloques: ButacaDef[][];
}

const LETRAS = 'ABCDEFGHIJKLMNOPQRST'.split('');
const FILAS_VIP = ['R', 'S', 'T'];
const BLOQUES_NORMALES = [4, 20, 4];
const BLOQUES_ACCESIBLES = [2, 10, 2];

function crearFila(etiqueta: string, tipo: TipoButaca, tamanios: number[]): FilaDef {
  let numero = 1;
  const bloques = tamanios.map((cantidad, b) =>
    Array.from({ length: cantidad }, () => {
      const n = numero++;
      return { id: `${etiqueta}${n}`, fila: etiqueta, numero: n, bloque: b as 0 | 1 | 2, tipo };
    }),
  );
  return { etiqueta, tipo, bloques };
}

export function construirLayout(): FilaDef[] {
  const filas: FilaDef[] = [];
  for (const letra of LETRAS) {
    if (letra === 'J') {
      filas.push(crearFila('JK', 'accesible', BLOQUES_ACCESIBLES));
      continue;
    }
    if (letra === 'K') continue;
    filas.push(crearFila(letra, FILAS_VIP.includes(letra) ? 'vip' : 'normal', BLOQUES_NORMALES));
  }
  return filas;
}

export const LAYOUT_SALA: FilaDef[] = construirLayout();

export const MAPA_BUTACAS: Map<string, ButacaDef> = new Map(
  LAYOUT_SALA.flatMap((f) => f.bloques.flat()).map((b) => [b.id, b]),
);

export const TOTAL_BUTACAS = MAPA_BUTACAS.size;

export function tipoDeButaca(id: string): TipoButaca {
  return MAPA_BUTACAS.get(id)?.tipo ?? 'normal';
}
