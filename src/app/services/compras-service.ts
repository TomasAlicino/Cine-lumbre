import { Injectable, inject, signal } from '@angular/core';
import { Combo, Cupon, FuncionCompleta, ItemPedido, Pedido, PedidoCompleto, Perfil, Producto, Recompensa } from '../models/models';
import { edad, sumarMinutos } from '../utils/fechas';
import { nuevoCodigoEntrada } from '../utils/ids';
import { edadMinima, estadoVenta, precioButaca, redondear } from '../utils/negocio';
import { MAPA_BUTACAS } from '../utils/sala-layout';
import { AuthService } from './auth-service';
import { ButacasService } from './butacas-service';
import { CuponesService } from './cupones-service';
import { SupabaseService } from './supabase-service';

export const CODIGO_BIENVENIDA = 'BIENVENIDA';

/** Todo lo que se carga una vez al abrir la compra y se usa para calcular el total. */
export interface DatosCompra {
  funcion: FuncionCompleta;
  productos: Producto[];
  combos: Combo[];
  recompensas: Recompensa[];
  usuario: Perfil | null;
  primeraCompra: boolean;
  porcentajeBienvenida: number;
}

/** Lo que el cliente fue eligiendo en la pantalla. */
export interface SolicitudCompra {
  butacas: string[];
  productos: Record<number, number>; // id de producto → cantidad
  combos: Record<number, number>; // id de combo → cantidad
  cupon: Cupon | null; // cupón ya validado con CuponesService.validar
  usarBienvenida: boolean;
  recompensas: number[]; // ids de recompensas (se pueden repetir)
  usarCredito: boolean;
}

export interface LineaCotizacion {
  concepto: string;
  detalle: string;
  importe: number;
}

export interface Cotizacion {
  lineas: LineaCotizacion[];
  items: ItemPedido[];
  subtotal: number;
  porcentajeDescuento: number;
  descuento: number;
  cuponAplicado: string | null;
  avisoCupon: string | null;
  creditoUsado: number;
  puntosUsados: number;
  total: number;
  puntosGanados: number;
  esPreventa: boolean;
  requiereAdulto: boolean;
  errores: string[];
}

const SELECT_COMPLETO = '*, funciones(*, peliculas(*), salas(*))';

@Injectable({ providedIn: 'root' })
export class ComprasService {
  private supabase = inject(SupabaseService).cliente;
  private auth = inject(AuthService);
  private butacas = inject(ButacasService);
  private cupones = inject(CuponesService);

  /** Última compra de esta pestaña: una compra anónima no se puede volver a leer de la base. */
  readonly ultimoPedido = signal<PedidoCompleto | null>(null);

  /** Primera compra = no tiene compras pagadas (si canceló la primera, conserva el cupón). */
  async esPrimeraCompra(usuarioId: string): Promise<boolean> {
    const { data, error } = await this.supabase.from('pedidos').select('codigo').eq('usuario_id', usuarioId).eq('estado', 'pagada').limit(1);
    if (error) throw new Error(error.message);
    return data.length === 0;
  }

  /**
   * Calcula precios, descuentos, puntos y crédito. Es la única fuente del total.
   * No consulta la base: trabaja con los datos ya cargados, así se puede recalcular en cada clic.
   */
  cotizar(s: SolicitudCompra, d: DatosCompra): Cotizacion {
    const errores: string[] = [];
    const lineas: LineaCotizacion[] = [];
    const items: ItemPedido[] = [];
    const { funcion, usuario } = d;
    const peli = funcion.peliculas;
    const venta = estadoVenta(peli);

    const butacas = s.butacas.map((id) => MAPA_BUTACAS.get(id)!).filter(Boolean);
    const precios = butacas.map((b) => ({ butaca: b, precio: precioButaca(funcion, peli, b.tipo) }));
    const precioBase = precioButaca(funcion, peli, 'normal');

    // Cada combo incluye una entrada
    const combos = Object.entries(s.combos).filter(([, cant]) => cant > 0);
    const cantCombos = combos.reduce((a, [, cant]) => a + cant, 0);
    if (cantCombos > butacas.length) errores.push('Cada combo incluye una entrada: elegí tantas butacas como combos.');

    // ── Canjes de puntos ──
    const recompensas = s.recompensas.map((id) => d.recompensas.find((r) => r.id === id)).filter((r): r is Recompensa => !!r);
    const puntosUsados = recompensas.reduce((a, r) => a + r.costo_puntos, 0);
    if (recompensas.length && !usuario) errores.push('Ingresá a tu cuenta para canjear puntos.');
    if (usuario && puntosUsados > usuario.puntos) errores.push(`Te faltan ${puntosUsados - usuario.puntos} puntos para esos canjes.`);

    // La entrada gratis cubre una butaca común (si la butaca es VIP, se paga el recargo)
    const pendientes = [...precios].sort((a, b) => a.precio - b.precio);
    const entradasGratis = recompensas.filter((r) => r.tipo === 'entrada');
    if (entradasGratis.length > pendientes.length - Math.min(cantCombos, pendientes.length)) {
      errores.push('Tenés más entradas gratis que butacas sin combo.');
    }
    for (const r of entradasGratis) {
      const cubierta = pendientes.shift();
      if (!cubierta) break;
      const recargo = Math.max(0, cubierta.precio - precioBase);
      lineas.push({ concepto: 'Entrada canjeada', detalle: `${cubierta.butaca.id} · ${r.costo_puntos} puntos${recargo ? ' + recargo VIP' : ''}`, importe: recargo });
      items.push({ tipo: 'canje-entrada', ref_id: r.id, nombre: `${r.nombre} (${cubierta.butaca.id})`, cantidad: 1, precio_unit: recargo });
    }
    for (const r of recompensas.filter((x) => x.tipo === 'producto')) {
      lineas.push({ concepto: r.nombre, detalle: `Canje · ${r.costo_puntos} puntos`, importe: 0 });
      items.push({ tipo: 'canje-producto', ref_id: r.producto_id ?? r.id, nombre: r.nombre, cantidad: 1, precio_unit: 0 });
    }

    // ── Combos: usan las butacas más baratas que quedan (para no cobrar recargos de más) ──
    for (const [comboId, cantidad] of combos) {
      const combo = d.combos.find((c) => c.id === Number(comboId));
      if (!combo) continue;
      for (let i = 0; i < cantidad; i++) {
        const b = pendientes.shift();
        const recargo = b ? Math.max(0, b.precio - precioBase) : 0;
        lineas.push({ concepto: combo.nombre, detalle: b ? `Incluye entrada ${b.butaca.id}${recargo ? ' (VIP)' : ''}` : 'Sin butaca asignada', importe: combo.precio + recargo });
      }
      items.push({ tipo: 'combo', ref_id: combo.id, nombre: combo.nombre, cantidad, precio_unit: combo.precio });
    }

    // ── Entradas que quedan ──
    for (const { butaca, precio } of pendientes) {
      const etiqueta = butaca.tipo === 'vip' ? 'Entrada VIP' : butaca.tipo === 'accesible' ? 'Entrada accesible' : 'Entrada';
      lineas.push({ concepto: etiqueta, detalle: `Butaca ${butaca.id}${venta.preventa ? ' · preventa' : ''}`, importe: precio });
    }

    // ── Productos sueltos del candy ──
    for (const [productoId, cantidad] of Object.entries(s.productos)) {
      const p = d.productos.find((x) => x.id === Number(productoId));
      if (!p || cantidad <= 0) continue;
      lineas.push({ concepto: p.nombre, detalle: `${cantidad} × $${p.precio}`, importe: p.precio * cantidad });
      items.push({ tipo: 'producto', ref_id: p.id, nombre: p.nombre, cantidad, precio_unit: p.precio });
    }

    const subtotal = redondear(lineas.reduce((a, l) => a + l.importe, 0));

    // ── Cupones: uno solo por compra ──
    let porcentaje = 0;
    let cuponAplicado: string | null = null;
    let avisoCupon: string | null = null;
    const bienvenida = s.usarBienvenida && d.primeraCompra;
    if (s.cupon) {
      porcentaje = s.cupon.porcentaje;
      cuponAplicado = s.cupon.codigo;
      if (bienvenida) avisoCupon = 'Se aplica un solo cupón por compra: usamos el que ingresaste.';
    } else if (bienvenida) {
      porcentaje = d.porcentajeBienvenida;
      cuponAplicado = CODIGO_BIENVENIDA;
    }
    const descuento = redondear((subtotal * porcentaje) / 100);
    const conDescuento = redondear(subtotal - descuento);
    const creditoUsado = s.usarCredito && usuario ? Math.min(usuario.credito, conDescuento) : 0;
    const total = redondear(conDescuento - creditoUsado);

    // ── Reglas de venta ──
    const minima = edadMinima(peli.clasificacion);
    if (minima && usuario && edad(usuario.fecha_nacimiento) < minima) {
      errores.push(`Esta película es ${peli.clasificacion}: tu cuenta no puede comprar entradas para ella.`);
    }
    if (!venta.abierta) errores.push('La venta de esta película todavía no está abierta.');
    if (new Date(funcion.inicio) <= new Date()) errores.push('La función ya comenzó.');
    if (!butacas.length) errores.push('Elegí al menos una butaca.');

    return {
      lineas,
      items,
      subtotal,
      porcentajeDescuento: porcentaje,
      descuento,
      cuponAplicado,
      avisoCupon,
      creditoUsado,
      puntosUsados,
      total,
      puntosGanados: usuario ? Math.floor(total) : 0, // 1 punto por peso pagado
      esPreventa: venta.preventa,
      requiereAdulto: minima > 0,
      errores,
    };
  }

  /**
   * Guarda el pedido. El trigger de la base ocupa las butacas y mueve puntos y crédito:
   * si alguna butaca ya se vendió, la compra entera falla y no se cobra nada.
   */
  async comprar(s: SolicitudCompra, d: DatosCompra, comprador: { nombre: string; email: string }): Promise<PedidoCompleto> {
    const usuario = this.auth.usuario();
    const datos = { ...d, usuario };

    // El cupón se vuelve a validar por si cambió desde que se aplicó
    if (s.cupon) {
      const { cupon, error } = await this.cupones.validar(s.cupon.codigo, usuario);
      if (!cupon) throw new Error(error ?? 'El cupón ya no es válido.');
    }
    const cot = this.cotizar(s, datos);
    if (cot.errores.length) throw new Error(cot.errores[0]);

    const fuera = s.butacas.find((b) => d.funcion.salas.butacas_deshabilitadas.includes(b));
    if (fuera) throw new Error(`La butaca ${fuera} está fuera de servicio. Elegí otra.`);

    const pedido: Pedido = {
      codigo: nuevoCodigoEntrada(),
      usuario_id: usuario?.id ?? null,
      comprador_nombre: comprador.nombre,
      comprador_email: comprador.email,
      funcion_id: d.funcion.id,
      butacas: [...s.butacas].sort(),
      items: cot.items,
      subtotal: cot.subtotal,
      descuento: cot.descuento,
      cupon_codigo: cot.cuponAplicado,
      credito_usado: cot.creditoUsado,
      puntos_usados: cot.puntosUsados,
      puntos_ganados: cot.puntosGanados,
      total: cot.total,
      estado: 'pagada',
      requiere_adulto: cot.requiereAdulto,
      es_preventa: cot.esPreventa,
      entrada_validada_en: null,
      entrada_validada_por: null,
      candy_entregado_en: null,
      candy_entregado_por: null,
      creado_en: new Date().toISOString(),
    };

    // Sin .select(): una compra anónima no tiene permiso para leer pedidos
    const { error } = await this.supabase.from('pedidos').insert(pedido);
    if (error?.message.includes('butacas_vendidas')) throw new Error('Alguna de las butacas se vendió recién. Elegí otras.');
    if (error?.code === '23514') throw new Error('No te alcanzan los puntos o el crédito para esta compra.');
    if (error) throw new Error(error.message);

    if (usuario) {
      const canjes = s.recompensas
        .map((id) => d.recompensas.find((r) => r.id === id))
        .filter((r): r is Recompensa => !!r)
        .map((r) => ({ usuario_id: usuario.id, recompensa_id: r.id, nombre: r.nombre, puntos: r.costo_puntos, pedido_codigo: pedido.codigo }));
      if (canjes.length) {
        const { error: e } = await this.supabase.from('canjes').insert(canjes);
        if (e) console.error('No se pudo registrar el canje', e);
      }
      await this.auth.recargarPerfil();
    }
    await this.butacas.liberarTodas(d.funcion.id);

    const completo: PedidoCompleto = { ...pedido, funciones: d.funcion };
    this.ultimoPedido.set(completo);
    return completo;
  }

  async pedidosDe(usuarioId: string): Promise<PedidoCompleto[]> {
    const { data, error } = await this.supabase.from('pedidos').select(SELECT_COMPLETO).eq('usuario_id', usuarioId).order('creado_en', { ascending: false });
    if (error) throw new Error(error.message);
    return data as PedidoCompleto[];
  }

  async porCodigo(codigo: string): Promise<PedidoCompleto | null> {
    const ultimo = this.ultimoPedido();
    if (ultimo?.codigo === codigo && !this.auth.usuario()) return ultimo;
    const { data, error } = await this.supabase.from('pedidos').select(SELECT_COMPLETO).eq('codigo', codigo).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as PedidoCompleto | null) ?? (ultimo?.codigo === codigo ? ultimo : null);
  }

  puedeCancelar(p: PedidoCompleto, horasLimite: number): boolean {
    if (p.estado !== 'pagada' || !p.usuario_id || p.entrada_validada_en || p.candy_entregado_en) return false;
    const limite = sumarMinutos(new Date(p.funciones.inicio), -horasLimite * 60);
    return new Date() <= limite;
  }

  /**
   * Cancela la compra. No se devuelve dinero: el trigger de la base acredita el importe
   * como crédito, revierte los puntos y libera las butacas. El historial de canjes queda.
   */
  async cancelar(p: PedidoCompleto, horasLimite: number): Promise<number> {
    if (!this.puedeCancelar(p, horasLimite)) {
      throw new Error(`Solo se puede cancelar hasta ${horasLimite} horas antes de la función y si no se usó el QR.`);
    }
    const { error } = await this.supabase.from('pedidos').update({ estado: 'cancelada' }).eq('codigo', p.codigo);
    if (error) throw new Error(error.message);
    await this.auth.recargarPerfil();
    return redondear(p.total + p.credito_usado);
  }
}
