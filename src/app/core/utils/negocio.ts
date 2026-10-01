import { Clasificacion, Funcion, Pelicula, TipoButaca } from '../models/models';
import { desdeISOFecha, sumarDias } from './fechas';

export interface EstadoVenta {
  abierta: boolean;
  preventa: boolean;
  abreEl: Date | null;
}

/** Regla de preventa: la venta abre N días antes del estreno con precio especial; al estrenar vuelve al precio normal. */
export function estadoVenta(p: Pelicula, ahora: Date = new Date()): EstadoVenta {
  if (p.estado === 'inactiva') return { abierta: false, preventa: false, abreEl: null };
  const estreno = desdeISOFecha(p.fechaEstreno);
  if (ahora >= estreno) return { abierta: true, preventa: false, abreEl: null };
  if (p.preventa.habilitada) {
    const abre = sumarDias(estreno, -p.preventa.diasAntes);
    if (ahora >= abre) return { abierta: true, preventa: true, abreEl: abre };
    return { abierta: false, preventa: false, abreEl: abre };
  }
  return { abierta: false, preventa: false, abreEl: estreno };
}

/** Precio de una butaca: base normal (o preventa) + recargo VIP si corresponde. */
export function precioButaca(f: Funcion, p: Pelicula, tipo: TipoButaca, ahora: Date = new Date()): number {
  const base = estadoVenta(p, ahora).preventa ? p.preventa.precio : f.precio;
  const recargoVip = Math.max(0, f.precioVip - f.precio);
  return tipo === 'vip' ? base + recargoVip : base;
}

export function edadMinima(c: Clasificacion): number {
  return c === '+18' ? 18 : c === '+13' ? 13 : 0;
}

export function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}
