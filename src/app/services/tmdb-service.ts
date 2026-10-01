import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { Clasificacion, GENEROS } from '../models/models';

/** Resultado de la búsqueda de TMDB (solo los campos que usamos). */
export interface PeliculaTmdb {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date: string; // yyyy-mm-dd
}

interface DetalleTmdb extends PeliculaTmdb {
  runtime: number | null;
  genres: { name: string }[];
  release_dates: { results: { iso_3166_1: string; release_dates: { certification: string }[] }[] };
}

/** Datos listos para completar el formulario de película. */
export interface DatosTmdb {
  titulo: string;
  sinopsis: string;
  duracion_min: number;
  imagen_url: string | null;
  generos: string[];
  clasificacion: Clasificacion;
  fecha_estreno: string;
}

/** Los géneros de TMDB que no tenemos con el mismo nombre. */
const EQUIVALENCIAS: Record<string, string> = {
  Suspense: 'Suspenso',
  Misterio: 'Suspenso',
  Crimen: 'Suspenso',
  Música: 'Musical',
  'Ciencia Ficción': 'Ciencia ficción',
};

/**
 * The Movie Database (TMDB, de la lista public-apis) por HTTP: el admin busca una película
 * y se completa el formulario con título, sinopsis, duración, géneros, póster y clasificación.
 */
@Injectable({ providedIn: 'root' })
export class TmdbService {
  private http = inject(HttpClient);
  private url = 'https://api.themoviedb.org/3';
  private imagenes = 'https://image.tmdb.org/t/p/w500';

  /** Parámetros comunes: la clave y los textos en castellano de Argentina. */
  private parametros(extra: Record<string, string> = {}) {
    return { api_key: environment.tmdbKey, language: 'es-AR', ...extra };
  }

  buscar(texto: string): Observable<PeliculaTmdb[]> {
    return this.http
      .get<{ results: PeliculaTmdb[] }>(`${this.url}/search/movie`, { params: this.parametros({ query: texto, region: 'AR' }) })
      .pipe(map((r) => r.results.slice(0, 8)));
  }

  urlPoster(path: string | null): string | null {
    return path ? this.imagenes + path : null;
  }

  /** Detalle de una película convertido a nuestro modelo. */
  detalle(id: number): Observable<DatosTmdb> {
    return this.http
      .get<DetalleTmdb>(`${this.url}/movie/${id}`, { params: this.parametros({ append_to_response: 'release_dates' }) })
      .pipe(
        map((d) => ({
          titulo: d.title,
          sinopsis: d.overview,
          duracion_min: d.runtime || 110,
          imagen_url: this.urlPoster(d.poster_path),
          generos: [...new Set(d.genres.map((g) => EQUIVALENCIAS[g.name] ?? g.name).filter((g) => GENEROS.includes(g)))],
          clasificacion: this.clasificacion(d),
          fecha_estreno: d.release_date,
        })),
      );
  }

  /** Usa la calificación de Argentina (o la de EE.UU.) y la lleva a ATP / +13 / +18. */
  private clasificacion(d: DetalleTmdb): Clasificacion {
    const de = (pais: string) =>
      d.release_dates.results.find((r) => r.iso_3166_1 === pais)?.release_dates.map((x) => x.certification).find((c) => c) ?? '';
    const ar = de('AR');
    if (ar) {
      const edad = Number(ar.replace(/\D/g, ''));
      return edad >= 16 ? '+18' : edad >= 13 ? '+13' : 'ATP';
    }
    const us = de('US');
    if (us === 'R' || us === 'NC-17') return '+18';
    if (us === 'PG-13') return '+13';
    return 'ATP';
  }
}
