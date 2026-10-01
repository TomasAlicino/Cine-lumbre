import { Injectable, inject } from '@angular/core';
import { Observable, map, of, throwError } from 'rxjs';
import { Resena } from '../models/models';
import { DbService } from './db.service';
import { AuthService } from './auth.service';

export interface Promedio {
  promedio: number;
  cantidad: number;
}

@Injectable({ providedIn: 'root' })
export class ResenasService {
  private readonly db = inject(DbService);
  private readonly auth = inject(AuthService);

  dePelicula$(peliculaId: string): Observable<Resena[]> {
    return this.db.lista$('resenas').pipe(map((l) => l.filter((r) => r.peliculaId === peliculaId).sort((a, b) => b.fecha.localeCompare(a.fecha))));
  }

  readonly promedios$: Observable<Map<string, Promedio>> = this.db.lista$('resenas').pipe(
    map((l) => {
      const acc = new Map<string, { suma: number; cantidad: number }>();
      for (const r of l) {
        const a = acc.get(r.peliculaId) ?? { suma: 0, cantidad: 0 };
        acc.set(r.peliculaId, { suma: a.suma + r.estrellas, cantidad: a.cantidad + 1 });
      }
      return new Map([...acc].map(([id, a]) => [id, { promedio: a.suma / a.cantidad, cantidad: a.cantidad }]));
    }),
  );

  deUsuario$(usuarioId: string): Observable<Resena[]> {
    return this.db.lista$('resenas').pipe(map((l) => l.filter((r) => r.usuarioId === usuarioId)));
  }

  /** Una reseña por usuario y película: si ya existe, se actualiza. */
  guardar(peliculaId: string, estrellas: number, comentario: string): Observable<Resena> {
    const u = this.auth.usuario;
    if (!u) return throwError(() => new Error('Ingresá a tu cuenta para dejar una reseña.'));
    if (estrellas < 1 || estrellas > 5) return throwError(() => new Error('Elegí entre 1 y 5 estrellas.'));
    const existente = this.db.foto('resenas').find((r) => r.peliculaId === peliculaId && r.usuarioId === u.id);
    const datos = {
      peliculaId,
      usuarioId: u.id,
      autor: `${u.nombre} ${u.apellido.charAt(0)}.`,
      estrellas,
      comentario: comentario.trim().slice(0, 280),
      fecha: new Date().toISOString(),
    };
    return of(existente ? this.db.actualizar('resenas', existente.id, datos) : this.db.insertar('resenas', datos));
  }

  eliminar(id: string): Observable<void> {
    this.db.eliminar('resenas', id);
    return of(void 0);
  }
}
