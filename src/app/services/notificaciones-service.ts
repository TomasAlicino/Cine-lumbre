import { Injectable, inject, signal } from '@angular/core';
import { Alerta, Notificacion, Pelicula } from '../models/models';
import { estadoVenta } from '../utils/negocio';
import { AuthService } from './auth-service';
import { SupabaseService } from './supabase-service';

/**
 * Alertas de "Próximamente": el usuario activa una alerta y, cuando la película ya tiene
 * venta abierta y funciones programadas, se le genera una notificación (la campanita).
 * Se revisa al iniciar la app y al ingresar, solo para el usuario logueado.
 */
@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private supabase = inject(SupabaseService).cliente;
  private auth = inject(AuthService);

  readonly mias = signal<Notificacion[]>([]);
  /** Ids de las películas con alerta activa. */
  readonly alertas = signal<number[]>([]);

  noLeidas(): number {
    return this.mias().filter((n) => !n.leida).length;
  }

  tieneAlerta(peliculaId: number): boolean {
    return this.alertas().includes(peliculaId);
  }

  /** Revisa las alertas pendientes y carga las notificaciones del usuario logueado. */
  async cargar(): Promise<void> {
    const u = this.auth.usuario();
    if (!u) {
      this.mias.set([]);
      this.alertas.set([]);
      return;
    }
    await this.revisarAlertas(u.id);
    const { data, error } = await this.supabase.from('notificaciones').select('*').eq('usuario_id', u.id).order('fecha', { ascending: false });
    if (error) throw new Error(error.message);
    this.mias.set(data as Notificacion[]);
  }

  /** Activa o desactiva la alerta. Devuelve true si quedó activa. */
  async alternarAlerta(peliculaId: number): Promise<boolean> {
    const u = this.auth.usuario();
    if (!u) throw new Error('Ingresá a tu cuenta para activar alertas.');
    if (this.tieneAlerta(peliculaId)) {
      const { error } = await this.supabase.from('alertas').delete().eq('usuario_id', u.id).eq('pelicula_id', peliculaId).eq('notificada', false);
      if (error) throw new Error(error.message);
      this.alertas.update((l) => l.filter((id) => id !== peliculaId));
      return false;
    }
    const { error } = await this.supabase.from('alertas').insert({ usuario_id: u.id, pelicula_id: peliculaId });
    if (error) throw new Error(error.message);
    this.alertas.update((l) => [...l, peliculaId]);
    return true;
  }

  async marcarTodasLeidas(): Promise<void> {
    const u = this.auth.usuario();
    if (!u || !this.noLeidas()) return;
    const { error } = await this.supabase.from('notificaciones').update({ leida: true }).eq('usuario_id', u.id).eq('leida', false);
    if (error) throw new Error(error.message);
    this.mias.update((l) => l.map((n) => ({ ...n, leida: true })));
  }

  private async revisarAlertas(usuarioId: string): Promise<void> {
    const { data, error } = await this.supabase.from('alertas').select('*, peliculas(*)').eq('usuario_id', usuarioId).eq('notificada', false);
    if (error) throw new Error(error.message);
    const pendientes = data as (Alerta & { peliculas: Pelicula })[];
    const ahora = new Date();
    const siguenActivas: number[] = [];

    for (const a of pendientes) {
      const venta = estadoVenta(a.peliculas, ahora);
      const { data: funciones } = await this.supabase.from('funciones').select('id').eq('pelicula_id', a.pelicula_id).gt('inicio', ahora.toISOString()).limit(1);
      if (!venta.abierta || !funciones?.length) {
        siguenActivas.push(a.pelicula_id);
        continue;
      }
      const mensaje = venta.preventa
        ? `Ya podés comprar entradas en preventa para ${a.peliculas.titulo}.`
        : `Ya están a la venta las entradas para ${a.peliculas.titulo}.`;
      await this.supabase.from('alertas').update({ notificada: true }).eq('id', a.id);
      await this.supabase.from('notificaciones').insert({ usuario_id: usuarioId, mensaje, enlace: `/pelicula/${a.pelicula_id}` });
    }
    this.alertas.set(siguenActivas);
  }
}
