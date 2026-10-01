import { Injectable, inject } from '@angular/core';
import { Sala } from '../models/models';
import { ActividadService } from './actividad-service';
import { SupabaseService } from './supabase-service';

@Injectable({ providedIn: 'root' })
export class SalasService {
  private supabase = inject(SupabaseService).cliente;
  private actividad = inject(ActividadService);

  async listar(): Promise<Sala[]> {
    const { data, error } = await this.supabase.from('salas').select('*').order('id', { ascending: true });
    if (error) throw new Error(error.message);
    return data as Sala[];
  }

  async crear(nombre: string): Promise<Sala> {
    const { data, error } = await this.supabase.from('salas').insert({ nombre }).select().single();
    if (error) throw new Error(error.message);
    await this.actividad.registrar('Creó sala', nombre);
    return data as Sala;
  }

  /** No deja sacar de servicio butacas que ya están vendidas en funciones futuras de la sala. */
  async actualizar(anterior: Sala, cambios: Pick<Sala, 'nombre' | 'activa' | 'butacas_deshabilitadas'>): Promise<Sala> {
    const nuevasFuera = cambios.butacas_deshabilitadas.filter((b) => !anterior.butacas_deshabilitadas.includes(b));
    if (nuevasFuera.length) {
      const vendidas = await this.vendidasEnFuncionesFuturas(anterior.id, nuevasFuera);
      if (vendidas.length) {
        throw new Error(`Las butacas ${vendidas.join(', ')} ya están vendidas en funciones próximas. Esperá a que pasen esas funciones.`);
      }
    }
    if (!cambios.activa && anterior.activa && (await this.tieneFuncionesFuturas(anterior.id))) {
      throw new Error('La sala tiene funciones programadas. Eliminalas o esperá a que pasen antes de desactivarla.');
    }

    const { data, error } = await this.supabase.from('salas').update(cambios).eq('id', anterior.id).select().single();
    if (error) throw new Error(error.message);
    await this.actividad.registrar('Editó sala', `${cambios.nombre} (${cambios.butacas_deshabilitadas.length} butacas fuera de servicio)`);
    return data as Sala;
  }

  async eliminar(s: Sala): Promise<void> {
    if (await this.tieneFuncionesFuturas(s.id)) {
      throw new Error('La sala tiene funciones programadas. Desactivala o eliminá esas funciones primero.');
    }
    const { error } = await this.supabase.from('salas').delete().eq('id', s.id);
    if (error?.code === '23503') throw new Error('La sala tiene funciones en el historial. Desactivala en lugar de borrarla.');
    if (error) throw new Error(error.message);
    await this.actividad.registrar('Eliminó sala', s.nombre);
  }

  private async idsFuncionesFuturas(salaId: number): Promise<number[]> {
    const { data, error } = await this.supabase
      .from('funciones')
      .select('id')
      .eq('sala_id', salaId)
      .gt('fin', new Date().toISOString());
    if (error) throw new Error(error.message);
    return (data as { id: number }[]).map((f) => f.id);
  }

  private async tieneFuncionesFuturas(salaId: number): Promise<boolean> {
    return (await this.idsFuncionesFuturas(salaId)).length > 0;
  }

  private async vendidasEnFuncionesFuturas(salaId: number, butacas: string[]): Promise<string[]> {
    const ids = await this.idsFuncionesFuturas(salaId);
    if (!ids.length) return [];
    const { data, error } = await this.supabase.from('butacas_vendidas').select('butaca').in('funcion_id', ids).in('butaca', butacas);
    if (error) throw new Error(error.message);
    return [...new Set((data as { butaca: string }[]).map((b) => b.butaca))];
  }
}
