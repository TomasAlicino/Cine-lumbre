import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { RegistroActividad } from '../models/models';
import { DbService } from './db.service';
import { AuthService } from './auth.service';

/** Log de actividad del panel de administración (quién hizo qué y cuándo). */
@Injectable({ providedIn: 'root' })
export class ActividadService {
  private readonly db = inject(DbService);
  private readonly auth = inject(AuthService);

  readonly registros$: Observable<RegistroActividad[]> = this.db
    .lista$('actividad')
    .pipe(map((l) => [...l].sort((a, b) => b.fecha.localeCompare(a.fecha))));

  registrar(accion: string, detalle: string): void {
    const u = this.auth.usuario;
    this.db.insertar('actividad', {
      fecha: new Date().toISOString(),
      usuarioId: u?.id ?? 'sistema',
      usuarioNombre: u ? `${u.nombre} ${u.apellido}` : 'Sistema',
      accion,
      detalle,
    });
  }
}
