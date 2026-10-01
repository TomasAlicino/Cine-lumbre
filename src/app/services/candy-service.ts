import { Injectable, inject } from '@angular/core';
import { Categoria, Combo, Producto } from '../models/models';
import { ActividadService } from './actividad-service';
import { SupabaseService } from './supabase-service';

/** Candy bar: categorías, productos y combos (entrada + productos a precio fijo). */
@Injectable({ providedIn: 'root' })
export class CandyService {
  private supabase = inject(SupabaseService).cliente;
  private actividad = inject(ActividadService);

  // ─────────── Categorías ───────────

  async categorias(): Promise<Categoria[]> {
    const { data, error } = await this.supabase.from('categorias').select('*').order('nombre');
    if (error) throw new Error(error.message);
    return data as Categoria[];
  }

  async guardarCategoria(nombre: string, id?: number): Promise<void> {
    const { error } = id
      ? await this.supabase.from('categorias').update({ nombre }).eq('id', id)
      : await this.supabase.from('categorias').insert({ nombre });
    if (error) throw new Error(error.message);
    await this.actividad.registrar(id ? 'Editó categoría' : 'Creó categoría', nombre);
  }

  async eliminarCategoria(c: Categoria): Promise<void> {
    const { error } = await this.supabase.from('categorias').delete().eq('id', c.id);
    if (error?.code === '23503') throw new Error('La categoría tiene productos. Movelos a otra categoría antes de borrarla.');
    if (error) throw new Error(error.message);
    await this.actividad.registrar('Eliminó categoría', c.nombre);
  }

  // ─────────── Productos ───────────

  async productos(soloActivos = false): Promise<Producto[]> {
    let consulta = this.supabase.from('productos').select('*').order('nombre');
    if (soloActivos) consulta = consulta.eq('activo', true);
    const { data, error } = await consulta;
    if (error) throw new Error(error.message);
    return data as Producto[];
  }

  async guardarProducto(datos: Omit<Producto, 'id'>, anterior?: Producto): Promise<void> {
    const { error } = anterior
      ? await this.supabase.from('productos').update(datos).eq('id', anterior.id)
      : await this.supabase.from('productos').insert(datos);
    if (error) throw new Error(error.message);
    if (!anterior) await this.actividad.registrar('Creó producto', `${datos.nombre} ($${datos.precio})`);
    else if (anterior.precio !== datos.precio) await this.actividad.registrar('Modificó precio de producto', `${datos.nombre}: $${anterior.precio} → $${datos.precio}`);
    else await this.actividad.registrar('Editó producto', datos.nombre);
  }

  async eliminarProducto(p: Producto): Promise<void> {
    const combos = await this.combos();
    if (combos.some((c) => c.items.some((i) => i.producto_id === p.id))) {
      throw new Error('El producto forma parte de un combo. Quitalo del combo o desactivalo.');
    }
    const { error } = await this.supabase.from('productos').delete().eq('id', p.id);
    if (error?.code === '23503') throw new Error('El producto es una recompensa del programa de puntos. Desactivalo en lugar de borrarlo.');
    if (error) throw new Error(error.message);
    await this.actividad.registrar('Eliminó producto', p.nombre);
  }

  // ─────────── Combos ───────────

  /** Los destacados primero (se muestran resaltados en la compra). */
  async combos(soloActivos = false): Promise<Combo[]> {
    let consulta = this.supabase.from('combos').select('*').order('destacado', { ascending: false }).order('nombre');
    if (soloActivos) consulta = consulta.eq('activo', true);
    const { data, error } = await consulta;
    if (error) throw new Error(error.message);
    return data as Combo[];
  }

  async guardarCombo(datos: Omit<Combo, 'id'>, anterior?: Combo): Promise<void> {
    const { error } = anterior
      ? await this.supabase.from('combos').update(datos).eq('id', anterior.id)
      : await this.supabase.from('combos').insert(datos);
    if (error) throw new Error(error.message);
    if (!anterior) await this.actividad.registrar('Creó combo', `${datos.nombre} ($${datos.precio})`);
    else if (anterior.precio !== datos.precio) await this.actividad.registrar('Modificó precio de combo', `${datos.nombre}: $${anterior.precio} → $${datos.precio}`);
    else await this.actividad.registrar('Editó combo', datos.nombre);
  }

  async eliminarCombo(c: Combo): Promise<void> {
    const { error } = await this.supabase.from('combos').delete().eq('id', c.id);
    if (error) throw new Error(error.message);
    await this.actividad.registrar('Eliminó combo', c.nombre);
  }
}
