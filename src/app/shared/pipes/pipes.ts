import { Pipe, PipeTransform } from '@angular/core';
import { Clasificacion, Pelicula, TipoButaca } from '../../core/models/models';
import { formatearFechaAR } from '../../core/utils/fechas';

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

@Pipe({ name: 'clasificacion' })
export class ClasificacionPipe implements PipeTransform {
  transform(c: Clasificacion): string {
    return c === 'ATP' ? 'Apta todo público' : c === '+13' ? 'Mayores de 13' : 'Mayores de 18';
  }
}

/** "2026-03-05" → "05/03/2026" */
@Pipe({ name: 'fechaAR' })
export class FechaARPipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    return iso ? formatearFechaAR(iso) : '';
  }
}

@Pipe({ name: 'tipoButaca' })
export class TipoButacaPipe implements PipeTransform {
  transform(t: TipoButaca): string {
    return t === 'vip' ? 'VIP' : t === 'accesible' ? 'Accesible' : 'Estándar';
  }
}

/** Filtra películas por texto (título/sinopsis) y por géneros (debe tener todos los elegidos). */
@Pipe({ name: 'buscarPeliculas' })
export class BuscarPeliculasPipe implements PipeTransform {
  transform(pelis: Pelicula[] | null, texto: string, generos: string[]): Pelicula[] {
    if (!pelis) return [];
    const t = normalizar(texto);
    return pelis.filter(
      (p) =>
        (!t || normalizar(p.titulo).includes(t) || normalizar(p.sinopsis).includes(t)) &&
        generos.every((g) => p.generos.includes(g)),
    );
  }
}

/** Estrellas en texto: 3.6 → "★★★★☆" */
@Pipe({ name: 'estrellas' })
export class EstrellasPipe implements PipeTransform {
  transform(valor: number | null | undefined): string {
    const n = Math.round(valor ?? 0);
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }
}

function normalizar(s: string): string {
  return (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export const PIPES = [DuracionPipe, PesosPipe, ClasificacionPipe, FechaARPipe, TipoButacaPipe, BuscarPeliculasPipe, EstrellasPipe] as const;
