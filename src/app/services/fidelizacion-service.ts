import { Injectable, inject } from '@angular/core';
import { Canje, Recompensa } from '../models/models';
import { ActividadService } from './actividad-service';
import { SupabaseService } from './supabase-service';

/** Programa de puntos: 1 punto por cada peso pagado, canjeables por entradas o productos. */
@Injectable({ providedIn: 'root' })
export class FidelizacionService {
  private supabase = inject(SupabaseService).cliente;
  private actividad = inject(ActividadService);

  async recompensas(soloActivas = false): Promise<Recompensa[]> {
    let consulta = this.supabase.from('recompensas').select('*').order('costo_puntos');
    if (soloActivas) consulta = consulta.eq('activa', true);
    const { data, error } = await consulta;
    if (error) throw new Error(error.message);
    return data as Recompensa[];
  }

  async canjesDe(usuarioId: string): Promise<Canje[]> {
    const { data, error } = await this.supabase.from('canjes').select('*').eq('usuario_id', usuarioId).order('fecha', { ascending: false });
    if (error) throw new Error(error.message);
    return data as Canje[];
  }

  async guardar(datos: Omit<Recompensa, 'id'>, anterior?: Recompensa): Promise<void> {
    const { error } = anterior
      ? await this.supabase.from('recompensas').update(datos).eq('id', anterior.id)
      : await this.supabase.from('recompensas').insert(datos);
    if (error) throw new Error(error.message);
    if (!anterior) await this.actividad.registrar('Creó recompensa', `${datos.nombre} (${datos.costo_puntos} puntos)`);
    else if (anterior.costo_puntos !== datos.costo_puntos) await this.actividad.registrar('Modificó recompensa', `${datos.nombre}: ${anterior.costo_puntos} → ${datos.costo_puntos} puntos`);
    else await this.actividad.registrar('Editó recompensa', datos.nombre);
  }

  async eliminar(r: Recompensa): Promise<void> {
    const { error } = await this.supabase.from('recompensas').delete().eq('id', r.id);
    if (error) throw new Error(error.message);
    await this.actividad.registrar('Eliminó recompensa', r.nombre);
  }
}
