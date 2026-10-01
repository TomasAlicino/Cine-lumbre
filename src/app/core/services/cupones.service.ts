import { Injectable, inject } from '@angular/core';
import { Observable, map, of, throwError } from 'rxjs';
import { Cupon, Usuario } from '../models/models';
import { DbService } from './db.service';
import { ActividadService } from './actividad.service';
import { edad } from '../utils/fechas';

@Injectable({ providedIn: 'root' })
export class CuponesService {
  private readonly db = inject(DbService);
  private readonly actividad = inject(ActividadService);

  readonly cupones$: Observable<Cupon[]> = this.db.lista$('cupones').pipe(map((l) => [...l].sort((a, b) => a.codigo.localeCompare(b.codigo))));

  guardar(datos: Omit<Cupon, 'id'> & { id?: string }): Observable<Cupon> {
    const codigo = datos.codigo.trim().toUpperCase();
    if (this.db.foto('cupones').some((c) => c.codigo === codigo && c.id !== datos.id)) {
      return throwError(() => new Error(`Ya existe un cupón con el código ${codigo}.`));
    }
    if (datos.id) {
      const anterior = this.db.porId('cupones', datos.id);
      const c = this.db.actualizar('cupones', datos.id, { ...datos, codigo });
      this.actividad.registrar('Editó cupón', anterior && anterior.porcentaje !== c.porcentaje ? `${codigo}: ${anterior.porcentaje}% → ${c.porcentaje}%` : codigo);
      return of(c);
    }
    const c = this.db.insertar('cupones', { ...datos, codigo });
    this.actividad.registrar('Creó cupón', `${codigo} (${c.porcentaje}%)`);
    return of(c);
  }

  eliminar(id: string): Observable<void> {
    const c = this.db.porId('cupones', id);
    this.db.eliminar('cupones', id);
    this.actividad.registrar('Eliminó cupón', c?.codigo ?? id);
    return of(void 0);
  }

  /** Devuelve el cupón si aplica al usuario, o un mensaje de error. */
  validar(codigo: string, usuario: Usuario | null): { cupon: Cupon | null; error: string | null } {
    const c = this.db.foto('cupones').find((x) => x.codigo === codigo.trim().toUpperCase());
    if (!c || !c.activo) return { cupon: null, error: 'Ese cupón no existe o ya no está vigente.' };
    if (c.soloMayoresDe !== null) {
      if (!usuario) return { cupon: null, error: `Este cupón es para clientes registrados de más de ${c.soloMayoresDe} años. Ingresá a tu cuenta para usarlo.` };
      if (edad(usuario.fechaNacimiento) <= c.soloMayoresDe) return { cupon: null, error: `Este cupón es solo para clientes de más de ${c.soloMayoresDe} años.` };
    }
    return { cupon: c, error: null };
  }

  registrarUso(id: string) {
    const c = this.db.porId('cupones', id);
    if (c) this.db.actualizar('cupones', id, { usos: c.usos + 1 });
  }
}
