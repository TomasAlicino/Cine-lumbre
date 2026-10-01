import { Injectable, inject } from '@angular/core';
import { PedidoCompleto } from '../models/models';
import { sumarMinutos } from '../utils/fechas';
import { ActividadService } from './actividad-service';
import { AuthService } from './auth-service';
import { SupabaseService } from './supabase-service';

export type ModoValidacion = 'sala' | 'candy';

const SELECT_COMPLETO = '*, funciones(*, peliculas(*), salas(*))';

/** Validación de QR por empleados: una vez usado para la sala (o para el candy) deja de servir. */
@Injectable({ providedIn: 'root' })
export class ValidacionService {
  private supabase = inject(SupabaseService).cliente;
  private auth = inject(AuthService);
  private actividad = inject(ActividadService);

  async buscar(codigo: string): Promise<PedidoCompleto | null> {
    const { data, error } = await this.supabase.from('pedidos').select(SELECT_COMPLETO).eq('codigo', codigo.trim().toUpperCase()).maybeSingle();
    if (error) throw new Error(error.message);
    return data as PedidoCompleto | null;
  }

  /** El pedido tiene algo para retirar en el candy (la entrada canjeada con puntos no cuenta). */
  tieneCandy(p: PedidoCompleto): boolean {
    return p.items.some((i) => i.tipo !== 'canje-entrada');
  }

  async validar(codigo: string, modo: ModoValidacion): Promise<PedidoCompleto> {
    const u = this.auth.usuario();
    if (!u) throw new Error('Tu sesión venció. Volvé a ingresar.');
    const pedido = await this.buscar(codigo);
    if (!pedido) throw new Error('Código inexistente. Revisá que esté bien escrito.');
    if (pedido.estado === 'cancelada') throw new Error('Esta compra fue cancelada: el QR no es válido.');

    const f = pedido.funciones;
    const ahora = new Date();
    const empleado = `${u.nombre} ${u.apellido}`;

    if (modo === 'sala') {
      if (pedido.entrada_validada_en) throw new Error(`El QR ya se usó para ingresar el ${new Date(pedido.entrada_validada_en).toLocaleString('es-AR')}.`);
      if (ahora > new Date(f.fin)) throw new Error('La función ya terminó.');
      if (ahora < sumarMinutos(new Date(f.inicio), -120)) throw new Error(`Todavía no se puede ingresar: la función es el ${new Date(f.inicio).toLocaleString('es-AR')}.`);
    } else {
      if (!this.tieneCandy(pedido)) throw new Error('Esta compra no incluye productos del candy.');
      if (pedido.candy_entregado_en) throw new Error(`El candy ya se entregó el ${new Date(pedido.candy_entregado_en).toLocaleString('es-AR')}.`);
    }

    // Se actualiza solo si el campo sigue vacío: si dos empleados escanean a la vez, gana uno solo
    const campoFecha = modo === 'sala' ? 'entrada_validada_en' : 'candy_entregado_en';
    const campoPor = modo === 'sala' ? 'entrada_validada_por' : 'candy_entregado_por';
    const { data, error } = await this.supabase
      .from('pedidos')
      .update({ [campoFecha]: ahora.toISOString(), [campoPor]: empleado })
      .eq('codigo', pedido.codigo)
      .is(campoFecha, null)
      .select(SELECT_COMPLETO);
    if (error) throw new Error(error.message);
    if (!data.length) throw new Error('Este QR se acaba de usar en otro puesto.');

    const detalle =
      modo === 'sala'
        ? `${pedido.codigo} · ${f.peliculas.titulo} · ${pedido.butacas.join(', ')}`
        : `${pedido.codigo} · ${pedido.items.filter((i) => i.tipo !== 'canje-entrada').map((i) => `${i.cantidad}× ${i.nombre}`).join(', ')}`;
    await this.actividad.registrar(modo === 'sala' ? 'Validó QR de entrada' : 'Validó QR de candy', detalle);
    return data[0] as PedidoCompleto;
  }
}
