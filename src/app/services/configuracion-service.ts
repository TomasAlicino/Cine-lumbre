import { Injectable, inject, signal } from '@angular/core';
import { Configuracion } from '../models/models';
import { ActividadService } from './actividad-service';
import { SupabaseService } from './supabase-service';

const POR_DEFECTO: Configuracion = {
  id: 1,
  porcentaje_primera_compra: 20,
  minutos_limpieza: 30,
  horas_limite_cancelacion: 2,
};

/** Valores configurables por el admin (cupón de bienvenida, limpieza entre funciones, cancelación). */
@Injectable({ providedIn: 'root' })
export class ConfiguracionService {
  private supabase = inject(SupabaseService).cliente;
  private actividad = inject(ActividadService);

  readonly config = signal<Configuracion>(POR_DEFECTO);

  async cargar(): Promise<Configuracion> {
    const { data, error } = await this.supabase.from('configuracion').select('*').eq('id', 1).maybeSingle();
    if (error) throw new Error(error.message);
    if (data) this.config.set(data as Configuracion);
    return this.config();
  }

  async guardar(cambios: Omit<Configuracion, 'id'>): Promise<void> {
    const anterior = this.config();
    const { data, error } = await this.supabase.from('configuracion').upsert({ ...cambios, id: 1 }).select().single();
    if (error) throw new Error(error.message);
    this.config.set(data as Configuracion);

    if (cambios.porcentaje_primera_compra !== anterior.porcentaje_primera_compra) {
      await this.actividad.registrar('Modificó cupón de bienvenida', `${anterior.porcentaje_primera_compra}% → ${cambios.porcentaje_primera_compra}%`);
    }
    if (cambios.minutos_limpieza !== anterior.minutos_limpieza || cambios.horas_limite_cancelacion !== anterior.horas_limite_cancelacion) {
      await this.actividad.registrar(
        'Modificó configuración',
        `Limpieza ${cambios.minutos_limpieza} min · cancelación hasta ${cambios.horas_limite_cancelacion} h antes`,
      );
    }
  }
}
