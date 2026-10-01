import { Injectable, inject } from '@angular/core';
import { Observable, combineLatest, map, of, throwError, timer } from 'rxjs';
import { Funcion, ItemPedido, Pedido, Pelicula, Usuario, Validacion } from '../models/models';
import { DbService } from './db.service';
import { AuthService } from './auth.service';
import { CuponesService } from './cupones.service';
import { ConfiguracionService } from './configuracion.service';
import { ActividadService } from './actividad.service';
import { MAPA_BUTACAS } from '../utils/sala-layout';
import { edadMinima, estadoVenta, precioButaca, redondear } from '../utils/negocio';
import { edad, sumarMinutos } from '../utils/fechas';
import { nuevoCodigoEntrada, nuevoId } from '../utils/ids';

export interface EstadoButacas {
  vendidas: Set<string>;
  enCompraAjena: Set<string>; // otra persona las está seleccionando ahora
  mias: Set<string>;
}

export interface SolicitudCompra {
  funcionId: string;
  butacas: string[];
  productos: Record<string, number>;
  combos: Record<string, number>;
  cuponCodigo: string;
  usarBienvenida: boolean;
  recompensas: string[]; // ids, puede repetirse
  usarCredito: boolean;
}

export interface LineaCotizacion {
  concepto: string;
  detalle: string;
  importe: number;
}

export interface Cotizacion {
  lineas: LineaCotizacion[];
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
  items: ItemPedido[];
  errores: string[];
  bienvenidaDisponible: boolean;
}

const MINUTOS_BLOQUEO = 10;
export const CODIGO_BIENVENIDA = 'BIENVENIDA';

@Injectable({ providedIn: 'root' })
export class ReservasService {
  private readonly db = inject(DbService);
  private readonly auth = inject(AuthService);
  private readonly cupones = inject(CuponesService);
  private readonly config = inject(ConfiguracionService);
  private readonly actividad = inject(ActividadService);

  /** Identifica la pestaña actual para distinguir "mis" butacas bloqueadas de las de otras compras. */
  readonly sesionId: string = (() => {
    const guardado = sessionStorage.getItem('lumbre:sesion-compra');
    if (guardado) return guardado;
    const id = nuevoId();
    sessionStorage.setItem('lumbre:sesion-compra', id);
    return id;
  })();

  // ───────────────────────── Butacas en tiempo real ─────────────────────────

  estadoButacas$(funcionId: string): Observable<EstadoButacas> {
    return combineLatest([this.db.lista$('pedidos'), this.db.lista$('bloqueos'), timer(0, 15_000)]).pipe(
      map(([pedidos, bloqueos]) => {
        const ahora = new Date().toISOString();
        const vendidas = new Set(pedidos.filter((p) => p.funcionId === funcionId && p.estado === 'pagada').flatMap((p) => p.butacas));
        const vigentes = bloqueos.filter((b) => b.funcionId === funcionId && b.expira > ahora);
        return {
          vendidas,
          enCompraAjena: new Set(vigentes.filter((b) => b.sesionId !== this.sesionId).map((b) => b.butaca)),
          mias: new Set(vigentes.filter((b) => b.sesionId === this.sesionId).map((b) => b.butaca)),
        };
      }),
    );
  }

  /** Reserva temporal de una butaca mientras el cliente completa la compra. */
  bloquear(funcionId: string, butaca: string): Observable<boolean> {
    this.limpiarVencidos();
    const ahora = new Date().toISOString();
    const vendida = this.db.foto('pedidos').some((p) => p.funcionId === funcionId && p.estado === 'pagada' && p.butacas.includes(butaca));
    const tomada = this.db.foto('bloqueos').some((b) => b.funcionId === funcionId && b.butaca === butaca && b.expira > ahora && b.sesionId !== this.sesionId);
    if (vendida || tomada) return of(false);
    this.db.eliminarDonde('bloqueos', (b) => b.funcionId === funcionId && b.butaca === butaca);
    this.db.insertar('bloqueos', {
      funcionId,
      butaca,
      sesionId: this.sesionId,
      expira: sumarMinutos(new Date(), MINUTOS_BLOQUEO).toISOString(),
    });
    return of(true);
  }

  liberar(funcionId: string, butaca: string): void {
    this.db.eliminarDonde('bloqueos', (b) => b.funcionId === funcionId && b.butaca === butaca && b.sesionId === this.sesionId);
  }

  liberarTodas(funcionId?: string): void {
    this.db.eliminarDonde('bloqueos', (b) => b.sesionId === this.sesionId && (!funcionId || b.funcionId === funcionId));
  }

  /** Renueva el vencimiento de mis bloqueos (se llama al avanzar de paso). */
  renovarBloqueos(funcionId: string): void {
    const expira = sumarMinutos(new Date(), MINUTOS_BLOQUEO).toISOString();
    for (const b of this.db.foto('bloqueos')) {
      if (b.funcionId === funcionId && b.sesionId === this.sesionId) this.db.actualizar('bloqueos', b.id, { expira });
    }
  }

  limpiarVencidos(): void {
    const ahora = new Date().toISOString();
    if (this.db.foto('bloqueos').some((b) => b.expira <= ahora)) this.db.eliminarDonde('bloqueos', (b) => b.expira <= ahora);
  }

  // ───────────────────────── Cotización ─────────────────────────

  esPrimeraCompra(usuario: Usuario | null): boolean {
    return !!usuario && !this.db.foto('pedidos').some((p) => p.usuarioId === usuario.id);
  }

  /** Calcula precios, descuentos, puntos y crédito. Es la única fuente de verdad del total. */
  cotizar(s: SolicitudCompra, usuario: Usuario | null = this.auth.usuario): Cotizacion {
    const errores: string[] = [];
    const lineas: LineaCotizacion[] = [];
    const items: ItemPedido[] = [];
    const funcion = this.db.porId('funciones', s.funcionId);
    const peli = funcion ? this.db.porId('peliculas', funcion.peliculaId) : undefined;
    const vacia: Cotizacion = {
      lineas, subtotal: 0, porcentajeDescuento: 0, descuento: 0, cuponAplicado: null, avisoCupon: null, creditoUsado: 0,
      puntosUsados: 0, total: 0, puntosGanados: 0, esPreventa: false, requiereAdulto: false, items, errores, bienvenidaDisponible: false,
    };
    if (!funcion || !peli) return { ...vacia, errores: ['La función ya no existe.'] };

    const venta = estadoVenta(peli);
    const butacas = s.butacas.map((id) => MAPA_BUTACAS.get(id)!).filter(Boolean);
    const precios = butacas.map((b) => ({ butaca: b, precio: precioButaca(funcion, peli, b.tipo) }));
    const precioBase = precioButaca(funcion, peli, 'normal');

    // Combos: cada combo incluye una entrada. Si esa butaca es VIP, se suma el recargo.
    const combos = Object.entries(s.combos).filter(([, c]) => c > 0);
    const cantCombos = combos.reduce((a, [, c]) => a + c, 0);
    if (cantCombos > butacas.length) errores.push('Cada combo incluye una entrada: elegí tantas butacas como combos.');

    // Ordenamos las butacas de mayor a menor precio: las recompensas de entrada cubren las más caras.
    const pendientes = [...precios].sort((a, b) => b.precio - a.precio);

    // Recompensas
    const recompensas = s.recompensas.map((id) => this.db.porId('recompensas', id)).filter((r) => !!r && r.activa);
    const puntosUsados = recompensas.reduce((a, r) => a + r!.costoPuntos, 0);
    if (recompensas.length && !usuario) errores.push('Ingresá a tu cuenta para canjear puntos.');
    if (usuario && puntosUsados > usuario.puntos) errores.push(`Te faltan ${puntosUsados - usuario.puntos} puntos para esos canjes.`);
    const entradasGratis = recompensas.filter((r) => r!.tipo === 'entrada');
    if (entradasGratis.length > pendientes.length - Math.min(cantCombos, pendientes.length)) {
      errores.push('Tenés más entradas gratis que butacas sin combo.');
    }
    for (const r of entradasGratis) {
      const cubierta = pendientes.shift();
      if (!cubierta) break;
      lineas.push({ concepto: 'Entrada canjeada', detalle: `${cubierta.butaca.id} · ${r!.costoPuntos} puntos`, importe: 0 });
      items.push({ tipo: 'recompensa', refId: r!.id, nombre: `${r!.nombre} (${cubierta.butaca.id})`, cantidad: 1, precioUnit: 0 });
    }
    for (const r of recompensas.filter((x) => x!.tipo === 'producto')) {
      lineas.push({ concepto: r!.nombre, detalle: `Canje · ${r!.costoPuntos} puntos`, importe: 0 });
      items.push({ tipo: 'recompensa', refId: r!.productoId ?? r!.id, nombre: r!.nombre, cantidad: 1, precioUnit: 0 });
    }

    // Combos consumen las siguientes butacas (las más baratas primero, para no cobrar recargos innecesarios)
    pendientes.sort((a, b) => a.precio - b.precio);
    for (const [comboId, cantidad] of combos) {
      const combo = this.db.porId('combos', comboId);
      if (!combo) continue;
      for (let i = 0; i < cantidad; i++) {
        const b = pendientes.shift();
        const recargo = b ? Math.max(0, b.precio - precioBase) : 0;
        lineas.push({ concepto: combo.nombre, detalle: b ? `Incluye entrada ${b.butaca.id}${recargo ? ' (VIP)' : ''}` : 'Sin butaca asignada', importe: combo.precio + recargo });
      }
      items.push({ tipo: 'combo', refId: combo.id, nombre: combo.nombre, cantidad, precioUnit: combo.precio });
    }

    // Entradas restantes
    for (const { butaca, precio } of pendientes) {
      const etiqueta = butaca.tipo === 'vip' ? 'Entrada VIP' : butaca.tipo === 'accesible' ? 'Entrada accesible' : 'Entrada';
      lineas.push({ concepto: etiqueta, detalle: `Butaca ${butaca.id}${venta.preventa ? ' · preventa' : ''}`, importe: precio });
    }

    // Productos sueltos del candy
    for (const [productoId, cantidad] of Object.entries(s.productos)) {
      if (cantidad <= 0) continue;
      const p = this.db.porId('productos', productoId);
      if (!p) continue;
      lineas.push({ concepto: p.nombre, detalle: `${cantidad} × $${p.precio}`, importe: p.precio * cantidad });
      items.push({ tipo: 'producto', refId: p.id, nombre: p.nombre, cantidad, precioUnit: p.precio });
    }

    const subtotal = redondear(lineas.reduce((a, l) => a + l.importe, 0));

    // Cupones: uno solo por compra.
    let porcentaje = 0;
    let cuponAplicado: string | null = null;
    let avisoCupon: string | null = null;
    const bienvenidaDisponible = this.esPrimeraCompra(usuario);
    if (s.cuponCodigo.trim()) {
      const { cupon, error } = this.cupones.validar(s.cuponCodigo, usuario);
      if (cupon) {
        porcentaje = cupon.porcentaje;
        cuponAplicado = cupon.codigo;
        if (s.usarBienvenida && bienvenidaDisponible) avisoCupon = 'Se aplica un solo cupón por compra: usamos el que ingresaste.';
      } else avisoCupon = error;
    }
    if (!cuponAplicado && s.usarBienvenida && bienvenidaDisponible) {
      porcentaje = this.config.config.porcentajePrimeraCompra;
      cuponAplicado = CODIGO_BIENVENIDA;
    }
    const descuento = redondear((subtotal * porcentaje) / 100);
    const conDescuento = redondear(subtotal - descuento);
    const creditoUsado = s.usarCredito && usuario ? Math.min(usuario.credito, conDescuento) : 0;
    const total = redondear(conDescuento - creditoUsado);

    // Restricción de edad
    const minima = edadMinima(peli.clasificacion);
    if (minima && usuario && edad(usuario.fechaNacimiento) < minima) {
      errores.push(`Esta película es ${peli.clasificacion}: tu cuenta no puede comprar entradas para ella.`);
    }
    if (!venta.abierta) errores.push('La venta de esta película todavía no está abierta.');
    if (new Date(funcion.inicio) <= new Date()) errores.push('La función ya comenzó.');
    if (!butacas.length) errores.push('Elegí al menos una butaca.');

    return {
      lineas,
      subtotal,
      porcentajeDescuento: porcentaje,
      descuento,
      cuponAplicado,
      avisoCupon,
      creditoUsado,
      puntosUsados,
      total,
      puntosGanados: usuario ? Math.floor(total) : 0,
      esPreventa: venta.preventa,
      requiereAdulto: minima > 0,
      items,
      errores,
      bienvenidaDisponible,
    };
  }

  // ───────────────────────── Compra ─────────────────────────

  comprar(s: SolicitudCompra, comprador: { nombre: string; email: string }): Observable<Pedido> {
    const usuario = this.auth.usuario;
    const cot = this.cotizar(s, usuario);
    if (cot.errores.length) return throwError(() => new Error(cot.errores[0]));

    const funcion = this.db.porId('funciones', s.funcionId)!;
    const sala = this.db.porId('salas', funcion.salaId);
    const ahora = new Date().toISOString();
    const vendidas = new Set(this.db.foto('pedidos').filter((p) => p.funcionId === funcion.id && p.estado === 'pagada').flatMap((p) => p.butacas));
    const ajenas = new Set(
      this.db.foto('bloqueos').filter((b) => b.funcionId === funcion.id && b.expira > ahora && b.sesionId !== this.sesionId).map((b) => b.butaca),
    );
    const conflicto = s.butacas.find((b) => vendidas.has(b) || ajenas.has(b) || sala?.butacasDeshabilitadas.includes(b));
    if (conflicto) return throwError(() => new Error(`La butaca ${conflicto} ya no está disponible. Elegí otra.`));

    // Con Supabase esto debería ser una función RPC transaccional (o una Edge Function).
    const pedido = this.db.insertar('pedidos', {
      codigo: this.codigoUnico(),
      usuarioId: usuario?.id ?? null,
      comprador,
      funcionId: funcion.id,
      butacas: [...s.butacas].sort(),
      items: cot.items,
      subtotal: cot.subtotal,
      descuento: cot.descuento,
      cuponCodigo: cot.cuponAplicado,
      creditoUsado: cot.creditoUsado,
      puntosUsados: cot.puntosUsados,
      puntosGanados: cot.puntosGanados,
      total: cot.total,
      estado: 'pagada',
      requiereAdulto: cot.requiereAdulto,
      esPreventa: cot.esPreventa,
      entradaValidada: null,
      candyEntregado: null,
      creadoEn: ahora,
    });

    if (usuario) {
      this.db.actualizar('usuarios', usuario.id, {
        puntos: usuario.puntos - cot.puntosUsados + cot.puntosGanados,
        credito: redondear(usuario.credito - cot.creditoUsado),
      });
      for (const rid of s.recompensas) {
        const r = this.db.porId('recompensas', rid);
        if (r) this.db.insertar('canjes', { usuarioId: usuario.id, recompensaId: r.id, nombre: r.nombre, puntos: r.costoPuntos, pedidoId: pedido.id, fecha: ahora });
      }
    }
    if (cot.cuponAplicado && cot.cuponAplicado !== CODIGO_BIENVENIDA) {
      const c = this.db.foto('cupones').find((x) => x.codigo === cot.cuponAplicado);
      if (c) this.cupones.registrarUso(c.id);
    }
    this.liberarTodas(funcion.id);
    return of(pedido);
  }

  private codigoUnico(): string {
    const existentes = new Set(this.db.foto('pedidos').map((p) => p.codigo));
    let c = nuevoCodigoEntrada();
    while (existentes.has(c)) c = nuevoCodigoEntrada();
    return c;
  }

  // ───────────────────────── Pedidos del cliente ─────────────────────────

  pedidosDe$(usuarioId: string): Observable<Pedido[]> {
    return this.db.lista$('pedidos').pipe(map((l) => l.filter((p) => p.usuarioId === usuarioId).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))));
  }

  pedidoPorId$(id: string): Observable<Pedido | undefined> {
    return this.db.lista$('pedidos').pipe(map((l) => l.find((p) => p.id === id)));
  }

  puedeCancelar(p: Pedido, f: Funcion | undefined): boolean {
    if (!f || p.estado !== 'pagada' || !p.usuarioId || p.entradaValidada || p.candyEntregado) return false;
    const limite = sumarMinutos(new Date(f.inicio), -this.config.config.horasLimiteCancelacion * 60);
    return new Date() <= limite;
  }

  /** Cancela y devuelve el importe como crédito en la cuenta (no se reintegra dinero). */
  cancelar(pedidoId: string): Observable<number> {
    const p = this.db.porId('pedidos', pedidoId);
    const f = p ? this.db.porId('funciones', p.funcionId) : undefined;
    const u = this.auth.usuario;
    if (!p || !u || p.usuarioId !== u.id) return throwError(() => new Error('No encontramos esa compra en tu cuenta.'));
    if (!this.puedeCancelar(p, f)) {
      return throwError(() => new Error(`Solo se puede cancelar hasta ${this.config.config.horasLimiteCancelacion} horas antes de la función y si no se usó el QR.`));
    }
    const credito = redondear(p.total + p.creditoUsado);
    this.db.actualizar('pedidos', p.id, { estado: 'cancelada' });
    this.db.actualizar('usuarios', u.id, {
      credito: redondear(u.credito + credito),
      puntos: Math.max(0, u.puntos - p.puntosGanados) + p.puntosUsados,
    });
    this.db.eliminarDonde('canjes', (c) => c.pedidoId === p.id);
    return of(credito);
  }

  // ───────────────────────── Validación (empleados) ─────────────────────────

  buscarPorCodigo(codigo: string): { pedido: Pedido; funcion: Funcion; pelicula: Pelicula } | null {
    const pedido = this.db.foto('pedidos').find((p) => p.codigo === codigo.trim().toUpperCase());
    if (!pedido) return null;
    const funcion = this.db.porId('funciones', pedido.funcionId);
    const pelicula = funcion ? this.db.porId('peliculas', funcion.peliculaId) : undefined;
    return funcion && pelicula ? { pedido, funcion, pelicula } : null;
  }

  /** Una vez validada la entrada (o entregado el candy) el QR deja de servir para ese uso. */
  validar(codigo: string, modo: 'sala' | 'candy'): Observable<{ pedido: Pedido; funcion: Funcion; pelicula: Pelicula }> {
    const encontrado = this.buscarPorCodigo(codigo);
    const u = this.auth.usuario;
    if (!encontrado) return throwError(() => new Error('Código inexistente. Revisá que esté bien escrito.'));
    if (!u) return throwError(() => new Error('Sesión vencida.'));
    const { pedido, funcion, pelicula } = encontrado;
    if (pedido.estado === 'cancelada') return throwError(() => new Error('Esta compra fue cancelada: el QR no es válido.'));
    const validacion: Validacion = { fecha: new Date().toISOString(), porId: u.id, porNombre: `${u.nombre} ${u.apellido}` };

    if (modo === 'sala') {
      if (pedido.entradaValidada) {
        return throwError(() => new Error(`El QR ya se usó para ingresar el ${new Date(pedido.entradaValidada!.fecha).toLocaleString('es-AR')}.`));
      }
      if (new Date() > new Date(funcion.fin)) return throwError(() => new Error('La función ya terminó.'));
      if (new Date() < sumarMinutos(new Date(funcion.inicio), -120)) {
        return throwError(() => new Error(`Todavía no se puede ingresar: la función es el ${new Date(funcion.inicio).toLocaleString('es-AR')}.`));
      }
      const actualizado = this.db.actualizar('pedidos', pedido.id, { entradaValidada: validacion });
      this.actividad.registrar('Validó QR de entrada', `${pedido.codigo} · ${pelicula.titulo} · ${pedido.butacas.join(', ')}`);
      return of({ pedido: actualizado, funcion, pelicula });
    }

    if (!pedido.items.length) return throwError(() => new Error('Esta compra no incluye productos del candy.'));
    if (pedido.candyEntregado) {
      return throwError(() => new Error(`El candy ya se entregó el ${new Date(pedido.candyEntregado!.fecha).toLocaleString('es-AR')}.`));
    }
    const actualizado = this.db.actualizar('pedidos', pedido.id, { candyEntregado: validacion });
    this.actividad.registrar('Validó QR de candy', `${pedido.codigo} · ${pedido.items.map((i) => `${i.cantidad}× ${i.nombre}`).join(', ')}`);
    return of({ pedido: actualizado, funcion, pelicula });
  }
}
