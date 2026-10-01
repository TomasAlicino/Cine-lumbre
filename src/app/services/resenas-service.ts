import { Injectable, inject } from '@angular/core';
import { Resena } from '../models/models';
import { AuthService } from './auth-service';
import { SupabaseService } from './supabase-service';

export interface Promedio {
  promedio: number;
  cantidad: number;
}

@Injectable({ providedIn: 'root' })
export class ResenasService {
  private supabase = inject(SupabaseService).cliente;
  private auth = inject(AuthService);

  async dePelicula(peliculaId: number): Promise<Resena[]> {
    const { data, error } = await this.supabase.from('resenas').select('*').eq('pelicula_id', peliculaId).order('fecha', { ascending: false });
    if (error) throw new Error(error.message);
    return data as Resena[];
  }

  async deUsuario(usuarioId: string): Promise<Resena[]> {
    const { data, error } = await this.supabase.from('resenas').select('*').eq('usuario_id', usuarioId);
    if (error) throw new Error(error.message);
    return data as Resena[];
  }

  /** Puntaje promedio y cantidad de reseñas de cada película. */
  async promedios(): Promise<Map<number, Promedio>> {
    const { data, error } = await this.supabase.from('resenas').select('pelicula_id, estrellas');
    if (error) throw new Error(error.message);
    const sumas = new Map<number, { suma: number; cantidad: number }>();
    for (const r of data as { pelicula_id: number; estrellas: number }[]) {
      const s = sumas.get(r.pelicula_id) ?? { suma: 0, cantidad: 0 };
      sumas.set(r.pelicula_id, { suma: s.suma + r.estrellas, cantidad: s.cantidad + 1 });
    }
    const promedios = new Map<number, Promedio>();
    sumas.forEach((s, id) => promedios.set(id, { promedio: s.suma / s.cantidad, cantidad: s.cantidad }));
    return promedios;
  }

  /** Una reseña por persona y película: si ya existe se actualiza. */
  async guardar(peliculaId: number, estrellas: number, comentario: string): Promise<void> {
    const u = this.auth.usuario();
    if (!u) throw new Error('Ingresá a tu cuenta para dejar una reseña.');
    if (estrellas < 1 || estrellas > 5) throw new Error('Elegí entre 1 y 5 estrellas.');

    const datos = {
      pelicula_id: peliculaId,
      usuario_id: u.id,
      autor: `${u.nombre} ${u.apellido.charAt(0)}.`,
      estrellas,
      comentario: comentario.trim().slice(0, 280),
      fecha: new Date().toISOString(),
    };
    const { data: existente } = await this.supabase.from('resenas').select('id').eq('pelicula_id', peliculaId).eq('usuario_id', u.id).maybeSingle();
    const { error } = existente
      ? await this.supabase.from('resenas').update(datos).eq('id', existente.id)
      : await this.supabase.from('resenas').insert(datos);
    if (error) throw new Error(error.message);
  }
}
