import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { Canje, Recompensa } from '../models/models';
import { DbService } from './db.service';
import { ActividadService } from './actividad.service';

/** Programa de puntos: 1 punto por cada peso pagado, canjeables por entradas o productos. */
@Injectable({ providedIn: 'root' })
export class FidelizacionService {
  private readonly db = inject(DbService);
  private readonly actividad = inject(ActividadService);

  readonly recompensas$: Observable<Recompensa[]> = this.db.lista$('recompensas').pipe(map((l) => [...l].sort((a, b) => a.costoPuntos - b.costoPuntos)));
  readonly recompensasActivas$ = this.recompensas$.pipe(map((l) => l.filter((r) => r.activa)));

  canjesDe$(usuarioId: string): Observable<Canje[]> {
    return this.db.lista$('canjes').pipe(map((l) => l.filter((c) => c.usuarioId === usuarioId).sort((a, b) => b.fecha.localeCompare(a.fecha))));
  }

  guardar(datos: Omit<Recompensa, 'id'> & { id?: string }): Observable<Recompensa> {
    if (datos.id) {
      const anterior = this.db.porId('recompensas', datos.id);
      const r = this.db.actualizar('recompensas', datos.id, datos);
      this.actividad.registrar(
        'Editó recompensa',
        anterior && anterior.costoPuntos !== r.costoPuntos ? `${r.nombre}: ${anterior.costoPuntos} → ${r.costoPuntos} puntos` : r.nombre,
      );
      return of(r);
    }
    const r = this.db.insertar('recompensas', datos);
    this.actividad.registrar('Creó recompensa', `${r.nombre} (${r.costoPuntos} puntos)`);
    return of(r);
  }

  eliminar(id: string): Observable<void> {
    const r = this.db.porId('recompensas', id);
    this.db.eliminar('recompensas', id);
    this.actividad.registrar('Eliminó recompensa', r?.nombre ?? id);
    return of(void 0);
  }
}
