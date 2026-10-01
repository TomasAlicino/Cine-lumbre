import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { Rol, Usuario } from '../models/models';
import { DbService } from './db.service';
import { ActividadService } from './actividad.service';

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly db = inject(DbService);
  private readonly actividad = inject(ActividadService);

  readonly usuarios$: Observable<Usuario[]> = this.db.lista$('usuarios').pipe(map((l) => [...l].sort((a, b) => a.apellido.localeCompare(b.apellido))));

  cambiarRol(id: string, rol: Rol): Observable<Usuario> {
    const u = this.db.actualizar('usuarios', id, { rol });
    this.actividad.registrar('Cambió rol de usuario', `${u.email} → ${rol}`);
    return of(u);
  }
}
