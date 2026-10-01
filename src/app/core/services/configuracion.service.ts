import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Configuracion } from '../models/models';
import { DbService } from './db.service';
import { ActividadService } from './actividad.service';

const POR_DEFECTO: Configuracion = {
  id: 'global',
  porcentajePrimeraCompra: 20,
  minutosLimpieza: 30,
  horasLimiteCancelacion: 2,
};

@Injectable({ providedIn: 'root' })
export class ConfiguracionService {
  private readonly db = inject(DbService);
  private readonly actividad = inject(ActividadService);

  readonly config$: Observable<Configuracion> = this.db
    .lista$('configuracion')
    .pipe(map((l) => l.find((c) => c.id === 'global') ?? POR_DEFECTO));

  get config(): Configuracion {
    return this.db.porId('configuracion', 'global') ?? POR_DEFECTO;
  }

  guardar(cambios: Partial<Configuracion>): void {
    const anterior = this.config;
    if (this.db.porId('configuracion', 'global')) this.db.actualizar('configuracion', 'global', cambios);
    else this.db.insertar('configuracion', { ...POR_DEFECTO, ...cambios, id: 'global' });
    if (cambios.porcentajePrimeraCompra !== undefined && cambios.porcentajePrimeraCompra !== anterior.porcentajePrimeraCompra) {
      this.actividad.registrar('Modificó cupón de bienvenida', `${anterior.porcentajePrimeraCompra}% → ${cambios.porcentajePrimeraCompra}%`);
    }
  }
}
