import { Injectable, inject } from '@angular/core';
import { Actividad } from '../models/models';
import { AuthService } from './auth-service';
import { SupabaseService } from './supabase-service';

/** Log de actividad del panel de administración: quién hizo qué y cuándo. */
@Injectable({ providedIn: 'root' })
export class ActividadService {
  private supabase = inject(SupabaseService).cliente;
  private auth = inject(AuthService);

  async listar(): Promise<Actividad[]> {
    const { data, error } = await this.supabase.from('actividad').select('*').order('fecha', { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    return data as Actividad[];
  }

  /** Si falla el registro no se corta la operación principal: solo queda en la consola. */
  async registrar(accion: string, detalle: string): Promise<void> {
    const u = this.auth.usuario();
    const { error } = await this.supabase.from('actividad').insert({
      usuario_id: u?.id ?? null,
      usuario_nombre: u ? `${u.nombre} ${u.apellido}` : 'Sistema',
      accion,
      detalle,
    });
    if (error) console.error('No se pudo registrar la actividad', error);
  }
}
