import { Injectable, inject } from '@angular/core';
import { Pelicula } from '../models/models';
import { desdeISOFecha, sumarMinutos } from '../utils/fechas';
import { estadoVenta } from '../utils/negocio';
import { ActividadService } from './actividad-service';
import { SupabaseService } from './supabase-service';

export type DatosPelicula = Omit<Pelicula, 'id'>;

const BUCKET = 'posters';

@Injectable({ providedIn: 'root' })
export class PeliculasService {
  private supabase = inject(SupabaseService).cliente;
  private actividad = inject(ActividadService);

  async listar(): Promise<Pelicula[]> {
    const { data, error } = await this.supabase.from('peliculas').select('*').order('titulo', { ascending: true });
    if (error) throw new Error(error.message);
    return data as Pelicula[];
  }

  async porId(id: number): Promise<Pelicula | null> {
    const { data, error } = await this.supabase.from('peliculas').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data as Pelicula | null;
  }

  /** Películas con la venta abierta (incluye las que están en preventa). */
  enVenta(peliculas: Pelicula[]): Pelicula[] {
    return peliculas.filter((p) => estadoVenta(p).abierta);
  }

  /** Estrenos que todavía no se estrenaron (pueden estar en preventa). */
  proximamente(peliculas: Pelicula[]): Pelicula[] {
    const hoy = new Date();
    return peliculas
      .filter((p) => p.estado !== 'inactiva' && desdeISOFecha(p.fecha_estreno) > hoy)
      .sort((a, b) => a.fecha_estreno.localeCompare(b.fecha_estreno));
  }

  /** Entradas vendidas por película (butacas_vendidas → su función → la película). */
  async ventasPorPelicula(): Promise<Map<number, number>> {
    const { data, error } = await this.supabase.from('butacas_vendidas').select('funciones(pelicula_id)');
    if (error) throw new Error(error.message);
    const ventas = new Map<number, number>();
    for (const fila of data as unknown as { funciones: { pelicula_id: number } | null }[]) {
      const id = fila.funciones?.pelicula_id;
      if (id) ventas.set(id, (ventas.get(id) ?? 0) + 1);
    }
    return ventas;
  }

  /**
   * Las 3 más vendidas entre las que tienen la venta abierta.
   * Si empatan (por ejemplo, sin ventas todavía) van primero los estrenos más nuevos.
   */
  async top3(peliculas: Pelicula[]): Promise<Pelicula[]> {
    const ventas = await this.ventasPorPelicula();
    return this.enVenta(peliculas)
      .sort(
        (a, b) =>
          (ventas.get(b.id) ?? 0) - (ventas.get(a.id) ?? 0) || b.fecha_estreno.localeCompare(a.fecha_estreno),
      )
      .slice(0, 3);
  }

  /** Sube el póster al bucket "posters" de Storage y devuelve la URL pública. */
  async subirPoster(archivo: File): Promise<string> {
    const nombre = `${Date.now()}_${archivo.name.replace(/[^\w.-]/g, '_')}`;
    const { error } = await this.supabase.storage.from(BUCKET).upload(nombre, archivo);
    if (error) throw new Error('No se pudo subir el póster: ' + error.message);
    const { data } = this.supabase.storage.from(BUCKET).getPublicUrl(nombre);
    return data.publicUrl;
  }

  async crear(datos: DatosPelicula, poster: File | null): Promise<Pelicula> {
    if (poster) datos = { ...datos, imagen_url: await this.subirPoster(poster) };
    const { data, error } = await this.supabase.from('peliculas').insert(datos).select().single();
    if (error) throw new Error(error.message);
    await this.actividad.registrar('Creó película', datos.titulo);
    return data as Pelicula;
  }

  async actualizar(anterior: Pelicula, datos: DatosPelicula, poster: File | null): Promise<Pelicula> {
    if (poster) datos = { ...datos, imagen_url: await this.subirPoster(poster) };
    const { data, error } = await this.supabase.from('peliculas').update(datos).eq('id', anterior.id).select().single();
    if (error) throw new Error(error.message);
    if (poster) await this.borrarPoster(anterior.imagen_url);

    // Si cambió la duración, el fin de las funciones futuras también cambia
    if (datos.duracion_min !== anterior.duracion_min) await this.recalcularFines(anterior.id, datos.duracion_min);

    await this.actividad.registrar('Editó película', datos.titulo);
    if (datos.preventa_precio !== anterior.preventa_precio) {
      await this.actividad.registrar('Modificó precio de preventa', `${datos.titulo}: $${anterior.preventa_precio} → $${datos.preventa_precio}`);
    }
    return data as Pelicula;
  }

  async eliminar(p: Pelicula): Promise<void> {
    const { error } = await this.supabase.from('peliculas').delete().eq('id', p.id);
    // 23503 = la clave foránea de pedidos impide borrar funciones con entradas vendidas
    if (error?.code === '23503') throw new Error('La película tiene entradas vendidas. Marcala como inactiva en lugar de borrarla.');
    if (error) throw new Error(error.message);
    await this.borrarPoster(p.imagen_url);
    await this.actividad.registrar('Eliminó película', p.titulo);
  }

  private async recalcularFines(peliculaId: number, duracion: number): Promise<void> {
    const { data, error } = await this.supabase
      .from('funciones')
      .select('id, inicio')
      .eq('pelicula_id', peliculaId)
      .gte('inicio', new Date().toISOString());
    if (error) throw new Error(error.message);
    for (const f of data as { id: number; inicio: string }[]) {
      const fin = sumarMinutos(new Date(f.inicio), duracion).toISOString();
      const { error: e } = await this.supabase.from('funciones').update({ fin }).eq('id', f.id);
      if (e) throw new Error(e.message);
    }
  }

  /** Solo borra imágenes que estén en Storage (los pósters de ejemplo están en /public). */
  private async borrarPoster(url: string | null): Promise<void> {
    if (!url || !url.includes(`/storage/v1/object/public/${BUCKET}/`)) return;
    const nombre = url.split('/').pop()!;
    const { error } = await this.supabase.storage.from(BUCKET).remove([nombre]);
    if (error) console.error('No se pudo borrar el póster anterior', error);
  }
}
