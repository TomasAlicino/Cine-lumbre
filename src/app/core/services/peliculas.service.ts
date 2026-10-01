import { Injectable, inject } from '@angular/core';
import { Observable, combineLatest, map, of, throwError } from 'rxjs';
import { Pelicula } from '../models/models';
import { DbService } from './db.service';
import { ActividadService } from './actividad.service';
import { estadoVenta } from '../utils/negocio';
import { desdeISOFecha } from '../utils/fechas';

@Injectable({ providedIn: 'root' })
export class PeliculasService {
  private readonly db = inject(DbService);
  private readonly actividad = inject(ActividadService);

  readonly peliculas$: Observable<Pelicula[]> = this.db
    .lista$('peliculas')
    .pipe(map((l) => [...l].sort((a, b) => a.titulo.localeCompare(b.titulo))));

  /** Películas con venta abierta (incluye preventa). */
  readonly enVenta$ = this.peliculas$.pipe(map((l) => l.filter((p) => estadoVenta(p).abierta)));

  readonly cartelera$ = this.peliculas$.pipe(
    map((l) => l.filter((p) => p.estado === 'cartelera' && desdeISOFecha(p.fechaEstreno) <= new Date())),
  );

  readonly proximamente$ = this.peliculas$.pipe(
    map((l) =>
      l
        .filter((p) => p.estado !== 'inactiva' && desdeISOFecha(p.fechaEstreno) > new Date())
        .sort((a, b) => a.fechaEstreno.localeCompare(b.fechaEstreno)),
    ),
  );

  /** Entradas vendidas por película (pedidos pagados). */
  readonly ventasPorPelicula$: Observable<Map<string, number>> = combineLatest([
    this.db.lista$('pedidos'),
    this.db.lista$('funciones'),
  ]).pipe(
    map(([pedidos, funciones]) => {
      const peliDeFuncion = new Map(funciones.map((f) => [f.id, f.peliculaId]));
      const ventas = new Map<string, number>();
      for (const p of pedidos) {
        if (p.estado !== 'pagada') continue;
        const peli = peliDeFuncion.get(p.funcionId);
        if (peli) ventas.set(peli, (ventas.get(peli) ?? 0) + p.butacas.length);
      }
      return ventas;
    }),
  );

  /** Las 3 más vendidas entre las que tienen venta abierta. */
  readonly top3$ = combineLatest([this.enVenta$, this.ventasPorPelicula$]).pipe(
    map(([pelis, ventas]) =>
      [...pelis].sort((a, b) => (ventas.get(b.id) ?? 0) - (ventas.get(a.id) ?? 0)).slice(0, 3),
    ),
  );

  porId$(id: string): Observable<Pelicula | undefined> {
    return this.db.lista$('peliculas').pipe(map((l) => l.find((p) => p.id === id)));
  }

  guardar(datos: Omit<Pelicula, 'id'> & { id?: string }): Observable<Pelicula> {
    if (datos.id) {
      const anterior = this.db.porId('peliculas', datos.id);
      const p = this.db.actualizar('peliculas', datos.id, datos);
      this.actividad.registrar('Editó película', p.titulo);
      if (anterior && anterior.preventa.precio !== p.preventa.precio) {
        this.actividad.registrar('Modificó precio de preventa', `${p.titulo}: $${anterior.preventa.precio} → $${p.preventa.precio}`);
      }
      return of(p);
    }
    const p = this.db.insertar('peliculas', datos);
    this.actividad.registrar('Creó película', p.titulo);
    return of(p);
  }

  eliminar(id: string): Observable<void> {
    const funciones = this.db.foto('funciones').filter((f) => f.peliculaId === id).map((f) => f.id);
    if (this.db.foto('pedidos').some((p) => funciones.includes(p.funcionId))) {
      return throwError(() => new Error('La película tiene entradas vendidas. Marcala como inactiva en lugar de borrarla.'));
    }
    const p = this.db.porId('peliculas', id);
    this.db.eliminarDonde('funciones', (f) => f.peliculaId === id);
    this.db.eliminar('peliculas', id);
    this.actividad.registrar('Eliminó película', p?.titulo ?? id);
    return of(void 0);
  }
}
