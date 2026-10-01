import { Injectable, inject } from '@angular/core';
import { Bloqueo } from '../models/models';
import { sumarMinutos } from '../utils/fechas';
import { nuevaSesion } from '../utils/ids';
import { SupabaseService } from './supabase-service';

export interface EstadoButacas {
  vendidas: string[];
  ajenas: string[]; // otra persona las está eligiendo ahora
  mias: string[];
}

const MINUTOS_BLOQUEO = 10;

/**
 * Butacas de una función. Mientras el cliente elige, cada butaca queda "bloqueada" 10 minutos
 * en la tabla bloqueos para que el resto la vea ocupada. La pantalla de compra consulta el
 * estado cada pocos segundos, así se ve lo que hacen los demás casi en tiempo real.
 */
@Injectable({ providedIn: 'root' })
export class ButacasService {
  private supabase = inject(SupabaseService).cliente;

  /** Identifica esta pestaña para distinguir mis bloqueos de los de otras personas. */
  readonly sesion: string = sessionStorage.getItem('lumbre:sesion-compra') ?? this.guardarSesion();

  async estado(funcionId: number): Promise<EstadoButacas> {
    const ahora = new Date().toISOString();
    const [vendidas, bloqueos] = await Promise.all([
      this.supabase.from('butacas_vendidas').select('butaca').eq('funcion_id', funcionId),
      this.supabase.from('bloqueos').select('*').eq('funcion_id', funcionId).gt('expira', ahora),
    ]);
    if (vendidas.error || bloqueos.error) throw new Error((vendidas.error ?? bloqueos.error)!.message);
    const vigentes = bloqueos.data as Bloqueo[];
    return {
      vendidas: (vendidas.data as { butaca: string }[]).map((b) => b.butaca),
      ajenas: vigentes.filter((b) => b.sesion_id !== this.sesion).map((b) => b.butaca),
      mias: vigentes.filter((b) => b.sesion_id === this.sesion).map((b) => b.butaca),
    };
  }

  /** Intenta reservar la butaca. Devuelve false si ya la tiene otra persona. */
  async bloquear(funcionId: number, butaca: string): Promise<boolean> {
    // Un bloqueo vencido ya no vale: se borra para poder tomar la butaca
    await this.supabase.from('bloqueos').delete().eq('funcion_id', funcionId).eq('butaca', butaca).lt('expira', new Date().toISOString());

    const { data: vendida } = await this.supabase.from('butacas_vendidas').select('butaca').eq('funcion_id', funcionId).eq('butaca', butaca).maybeSingle();
    if (vendida) return false;

    // La clave primaria (funcion_id, butaca) hace que falle si otra persona la bloqueó primero
    const { error } = await this.supabase.from('bloqueos').insert({
      funcion_id: funcionId,
      butaca,
      sesion_id: this.sesion,
      expira: sumarMinutos(new Date(), MINUTOS_BLOQUEO).toISOString(),
    });
    return !error;
  }

  async liberar(funcionId: number, butaca: string): Promise<void> {
    await this.supabase.from('bloqueos').delete().eq('funcion_id', funcionId).eq('butaca', butaca).eq('sesion_id', this.sesion);
  }

  async liberarTodas(funcionId: number): Promise<void> {
    await this.supabase.from('bloqueos').delete().eq('funcion_id', funcionId).eq('sesion_id', this.sesion);
  }

  /** Extiende el vencimiento de mis bloqueos (al avanzar de paso en la compra). */
  async renovar(funcionId: number): Promise<void> {
    const expira = sumarMinutos(new Date(), MINUTOS_BLOQUEO).toISOString();
    await this.supabase.from('bloqueos').update({ expira }).eq('funcion_id', funcionId).eq('sesion_id', this.sesion);
  }

  private guardarSesion(): string {
    const id = nuevaSesion();
    sessionStorage.setItem('lumbre:sesion-compra', id);
    return id;
  }
}
