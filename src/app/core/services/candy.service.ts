import { Injectable, inject } from '@angular/core';
import { Observable, map, of, throwError } from 'rxjs';
import { Categoria, Combo, Producto } from '../models/models';
import { DbService } from './db.service';
import { ActividadService } from './actividad.service';

@Injectable({ providedIn: 'root' })
export class CandyService {
  private readonly db = inject(DbService);
  private readonly actividad = inject(ActividadService);

  readonly categorias$: Observable<Categoria[]> = this.db.lista$('categorias').pipe(map((l) => [...l].sort((a, b) => a.nombre.localeCompare(b.nombre))));
  readonly productos$: Observable<Producto[]> = this.db.lista$('productos').pipe(map((l) => [...l].sort((a, b) => a.nombre.localeCompare(b.nombre))));
  readonly productosActivos$ = this.productos$.pipe(map((l) => l.filter((p) => p.activo)));
  readonly combos$: Observable<Combo[]> = this.db.lista$('combos');
  readonly combosActivos$ = this.combos$.pipe(
    map((l) => l.filter((c) => c.activo).sort((a, b) => Number(b.destacado) - Number(a.destacado))),
  );

  guardarCategoria(datos: Omit<Categoria, 'id'> & { id?: string }): Observable<Categoria> {
    const c = datos.id ? this.db.actualizar('categorias', datos.id, datos) : this.db.insertar('categorias', datos);
    this.actividad.registrar(datos.id ? 'Editó categoría' : 'Creó categoría', c.nombre);
    return of(c);
  }

  eliminarCategoria(id: string): Observable<void> {
    if (this.db.foto('productos').some((p) => p.categoriaId === id)) {
      return throwError(() => new Error('La categoría tiene productos. Movelos a otra categoría antes de borrarla.'));
    }
    const c = this.db.porId('categorias', id);
    this.db.eliminar('categorias', id);
    this.actividad.registrar('Eliminó categoría', c?.nombre ?? id);
    return of(void 0);
  }

  guardarProducto(datos: Omit<Producto, 'id'> & { id?: string }): Observable<Producto> {
    if (datos.id) {
      const anterior = this.db.porId('productos', datos.id);
      const p = this.db.actualizar('productos', datos.id, datos);
      if (anterior && anterior.precio !== p.precio) {
        this.actividad.registrar('Modificó precio de producto', `${p.nombre}: $${anterior.precio} → $${p.precio}`);
      } else {
        this.actividad.registrar('Editó producto', p.nombre);
      }
      return of(p);
    }
    const p = this.db.insertar('productos', datos);
    this.actividad.registrar('Creó producto', `${p.nombre} ($${p.precio})`);
    return of(p);
  }

  eliminarProducto(id: string): Observable<void> {
    if (this.db.foto('combos').some((c) => c.items.some((i) => i.productoId === id))) {
      return throwError(() => new Error('El producto forma parte de un combo. Quitalo del combo o desactivalo.'));
    }
    const p = this.db.porId('productos', id);
    this.db.eliminar('productos', id);
    this.actividad.registrar('Eliminó producto', p?.nombre ?? id);
    return of(void 0);
  }

  guardarCombo(datos: Omit<Combo, 'id'> & { id?: string }): Observable<Combo> {
    if (datos.id) {
      const anterior = this.db.porId('combos', datos.id);
      const c = this.db.actualizar('combos', datos.id, datos);
      if (anterior && anterior.precio !== c.precio) {
        this.actividad.registrar('Modificó precio de combo', `${c.nombre}: $${anterior.precio} → $${c.precio}`);
      } else {
        this.actividad.registrar('Editó combo', c.nombre);
      }
      return of(c);
    }
    const c = this.db.insertar('combos', datos);
    this.actividad.registrar('Creó combo', `${c.nombre} ($${c.precio})`);
    return of(c);
  }

  eliminarCombo(id: string): Observable<void> {
    const c = this.db.porId('combos', id);
    this.db.eliminar('combos', id);
    this.actividad.registrar('Eliminó combo', c?.nombre ?? id);
    return of(void 0);
  }

  nombreProducto(id: string): string {
    return this.db.porId('productos', id)?.nombre ?? 'Producto';
  }
}
