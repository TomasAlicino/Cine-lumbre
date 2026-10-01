import { Injectable, inject } from '@angular/core';
import { Observable, map, of, throwError } from 'rxjs';
import { Sala } from '../models/models';
import { DbService } from './db.service';
import { ActividadService } from './actividad.service';

@Injectable({ providedIn: 'root' })
export class SalasService {
  private readonly db = inject(DbService);
  private readonly actividad = inject(ActividadService);

  readonly salas$: Observable<Sala[]> = this.db
    .lista$('salas')
    .pipe(map((l) => [...l].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }))));

  porId$(id: string) {
    return this.db.lista$('salas').pipe(map((l) => l.find((s) => s.id === id)));
  }

  guardar(datos: Omit<Sala, 'id'> & { id?: string }): Observable<Sala> {
    if (datos.id) {
      const s = this.db.actualizar('salas', datos.id, datos);
      this.actividad.registrar('Editó sala', `${s.nombre} (${s.butacasDeshabilitadas.length} butacas fuera de servicio)`);
      return of(s);
    }
    const s = this.db.insertar('salas', datos);
    this.actividad.registrar('Creó sala', s.nombre);
    return of(s);
  }

  eliminar(id: string): Observable<void> {
    const futuras = this.db.foto('funciones').some((f) => f.salaId === id && new Date(f.fin) > new Date());
    if (futuras) return throwError(() => new Error('La sala tiene funciones programadas. Desactivala o eliminá esas funciones primero.'));
    const s = this.db.porId('salas', id);
    this.db.eliminar('salas', id);
    this.actividad.registrar('Eliminó sala', s?.nombre ?? id);
    return of(void 0);
  }
}
