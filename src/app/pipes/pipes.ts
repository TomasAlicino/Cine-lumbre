import { Pipe, PipeTransform } from '@angular/core';
import { Clasificacion, Pelicula, TipoButaca } from '../models/models';
import { formatearFechaAR } from '../utils/fechas';

/** 125 → "2 h 05 min" */
@Pipe({ name: 'duracion' })
export class DuracionPipe implements PipeTransform {
  transform(minutos: number | null | undefined): string {
    if (!minutos) return '';
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
  }
}

/** 6500 → "$ 6.500" (pesos argentinos, sin decimales si no hacen falta). */
@Pipe({ name: 'pesos' })
export class PesosPipe implements PipeTransform {
  transform(valor: number | null | undefined): string {
    const n = valor ?? 0;
    const decimales = Number.isInteger(n) ? 0 : 2;
    return '$ ' + n.toLocaleString('es-AR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  }
}

/** "+13" → "Mayores de 13" */
@Pipe({ name: 'clasificacion' })
export class ClasificacionPipe implements PipeTransform {
  transform(c: Clasificacion): string {
    return c === 'ATP' ? 'Apta todo público' : c === '+13' ? 'Mayores de 13' : 'Mayores de 18';
  }
}

/** "2026-03-05" (o un ISO con hora) → "05/03/2026" */
@Pipe({ name: 'fechaAR' })
export class FechaARPipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    if (!iso) return '';
    // Con hora: se pasa a fecha local (un ISO en UTC puede caer en otro día)
    return iso.length > 10 ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : formatearFechaAR(iso);
  }
}

/** ISO → "19:30" */
@Pipe({ name: 'hora' })
export class HoraPipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    return iso ? new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '';
  }
}

/** ISO → "viernes 3 de octubre" (o "vie 3 oct" con formato corto) */
@Pipe({ name: 'dia' })
export class DiaPipe implements PipeTransform {
  transform(iso: string | Date | null | undefined, formato: 'largo' | 'corto' = 'largo'): string {
    if (!iso) return '';
    const d = new Date(iso);
    return formato === 'largo'
      ? d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
      : d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
  }
}

@Pipe({ name: 'tipoButaca' })
export class TipoButacaPipe implements PipeTransform {
  transform(t: TipoButaca): string {
    return t === 'vip' ? 'VIP' : t === 'accesible' ? 'Accesible' : 'Estándar';
  }
}

/** Filtra películas por texto (título o sinopsis) y por géneros: alcanza con tener alguno de los elegidos. */
@Pipe({ name: 'buscarPeliculas' })
export class BuscarPeliculasPipe implements PipeTransform {
  transform(pelis: Pelicula[], texto: string, generos: string[]): Pelicula[] {
    const t = normalizar(texto);
    return pelis.filter(
      (p) =>
        (!t || normalizar(p.titulo).includes(t) || normalizar(p.sinopsis).includes(t)) &&
        (!generos.length || generos.some((g) => p.generos.includes(g))),
    );
  }
}

/** Sin tildes y en minúsculas, para buscar "accion" y encontrar "Acción". */
function normalizar(s: string): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
