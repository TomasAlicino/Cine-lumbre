import { Injectable, inject } from '@angular/core';
import { Cupon, Perfil } from '../models/models';
import { edad } from '../utils/fechas';
import { ActividadService } from './actividad-service';
import { SupabaseService } from './supabase-service';

export interface ResultadoCupon {
  cupon: Cupon | null;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class CuponesService {
  private supabase = inject(SupabaseService).cliente;
  private actividad = inject(ActividadService);

  async listar(): Promise<Cupon[]> {
    const { data, error } = await this.supabase.from('cupones').select('*').order('codigo');
    if (error) throw new Error(error.message);
    return data as Cupon[];
  }

  /** Cantidad de compras pagadas con cada cupón (las canceladas no cuentan). Solo lo ve el admin. */
  async usos(): Promise<Map<string, number>> {
    const { data, error } = await this.supabase.from('pedidos').select('cupon_codigo').eq('estado', 'pagada').not('cupon_codigo', 'is', null);
    if (error) throw new Error(error.message);
    const usos = new Map<string, number>();
    for (const p of data as { cupon_codigo: string }[]) usos.set(p.cupon_codigo, (usos.get(p.cupon_codigo) ?? 0) + 1);
    return usos;
  }

  async guardar(datos: Omit<Cupon, 'id'>, anterior?: Cupon): Promise<void> {
    const cupon = { ...datos, codigo: datos.codigo.trim().toUpperCase() };
    const { error } = anterior
      ? await this.supabase.from('cupones').update(cupon).eq('id', anterior.id)
      : await this.supabase.from('cupones').insert(cupon);
    // 23505 = viola el "unique" del código
    if (error?.code === '23505') throw new Error(`Ya existe un cupón con el código ${cupon.codigo}.`);
    if (error) throw new Error(error.message);

    if (!anterior) await this.actividad.registrar('Creó cupón', `${cupon.codigo} (${cupon.porcentaje}%)`);
    else if (anterior.porcentaje !== cupon.porcentaje) await this.actividad.registrar('Modificó cupón', `${cupon.codigo}: ${anterior.porcentaje}% → ${cupon.porcentaje}%`);
    else await this.actividad.registrar('Editó cupón', cupon.codigo);
  }

  async eliminar(c: Cupon): Promise<void> {
    const { error } = await this.supabase.from('cupones').delete().eq('id', c.id);
    if (error) throw new Error(error.message);
    await this.actividad.registrar('Eliminó cupón', c.codigo);
  }

  /** Busca el cupón y revisa si aplica al usuario (los de "+50" piden cuenta y edad). */
  async validar(codigo: string, usuario: Perfil | null): Promise<ResultadoCupon> {
    const { data, error } = await this.supabase.from('cupones').select('*').eq('codigo', codigo.trim().toUpperCase()).maybeSingle();
    if (error) throw new Error(error.message);
    const c = data as Cupon | null;
    if (!c || !c.activo) return { cupon: null, error: 'Ese cupón no existe o ya no está vigente.' };
    if (c.solo_mayores_de !== null) {
      if (!usuario) return { cupon: null, error: `Este cupón es para clientes registrados de más de ${c.solo_mayores_de} años. Ingresá a tu cuenta para usarlo.` };
      if (edad(usuario.fecha_nacimiento) <= c.solo_mayores_de) return { cupon: null, error: `Este cupón es solo para clientes de más de ${c.solo_mayores_de} años.` };
    }
    return { cupon: c, error: null };
  }
}
