import { Injectable, inject } from '@angular/core';
import { Perfil, Rol } from '../models/models';
import { ActividadService } from './actividad-service';
import { SupabaseService } from './supabase-service';

/** Administración de usuarios (solo admin). */
@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private supabase = inject(SupabaseService).cliente;
  private actividad = inject(ActividadService);

  async listar(): Promise<Perfil[]> {
    const { data, error } = await this.supabase.from('perfiles').select('*').order('apellido');
    if (error) throw new Error(error.message);
    return data as Perfil[];
  }

  async cambiarRol(u: Perfil, rol: Rol): Promise<void> {
    const { error } = await this.supabase.from('perfiles').update({ rol }).eq('id', u.id);
    if (error) throw new Error(error.message);
    await this.actividad.registrar('Cambió rol de usuario', `${u.email}: ${u.rol} → ${rol}`);
  }
}
