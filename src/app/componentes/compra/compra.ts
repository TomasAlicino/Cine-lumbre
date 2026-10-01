import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Categoria, Combo, Producto, Recompensa } from '../../models/models';
import { AuthService } from '../../services/auth-service';
import { ButacasService, EstadoButacas } from '../../services/butacas-service';
import { CandyService } from '../../services/candy-service';
import { ComprasService, DatosCompra, SolicitudCompra } from '../../services/compras-service';
import { ConfiguracionService } from '../../services/configuracion-service';
import { CuponesService, ResultadoCupon } from '../../services/cupones-service';
import { FidelizacionService } from '../../services/fidelizacion-service';
import { FuncionesService } from '../../services/funciones-service';
import { ToastService } from '../../services/toast-service';
import { ConCambiosPendientes } from '../../guards/auth-guard';
import { ButacaDef, MAPA_BUTACAS } from '../../utils/sala-layout';
import { edadMinima, precioButaca } from '../../utils/negocio';
import { edad } from '../../utils/fechas';
import { tarjetaValida, vencimientoValido } from '../../utils/validadores';
import { MapaButacas } from '../mapa-butacas/mapa-butacas';
import { DiaPipe, DuracionPipe, HoraPipe, PesosPipe, TipoButacaPipe } from '../../pipes/pipes';
import { MascaraFechaDirective } from '../../directivas/directivas';

const MAX_BUTACAS = 10;
const SEGUNDOS_REFRESCO = 4;

/**
 * Compra por pasos: 1) butacas, 2) candy y combos, 3) descuentos y pago.
 * Todo lo elegido está en signals y el total sale de un computed (ComprasService.cotizar),
 * así cada clic recalcula el resumen sin pedirle nada a la base.
 */
@Component({
  selector: 'app-compra',
  imports: [FormsModule, ReactiveFormsModule, RouterLink, MapaButacas, PesosPipe, TipoButacaPipe, DuracionPipe, DiaPipe, HoraPipe, MascaraFechaDirective],
  templateUrl: './compra.html',
  styleUrl: './compra.scss',
})
export class Compra implements OnInit, OnDestroy, ConCambiosPendientes {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private butacas = inject(ButacasService);
  private candy = inject(CandyService);
  private compras = inject(ComprasService);
  private configuracion = inject(ConfiguracionService);
  private cupones = inject(CuponesService);
  private fidelizacion = inject(FidelizacionService);
  private funciones = inject(FuncionesService);
  private toast = inject(ToastService);

  private sub?: Subscription;
  private intervalo?: ReturnType<typeof setInterval>;
  private funcionId = 0;
  private comprado = false;

  readonly usuario = this.auth.usuario;
  readonly maxButacas = MAX_BUTACAS;

  cargando = signal(true);
  datos = signal<DatosCompra | null>(null);
  categorias = signal<Categoria[]>([]);
  estado = signal<EstadoButacas | null>(null);
  paso = signal<1 | 2 | 3>(1);

  // Lo que va eligiendo el cliente
  seleccionadas = signal<string[]>([]);
  productosElegidos = signal<Record<number, number>>({});
  combosElegidos = signal<Record<number, number>>({});
  recompensasElegidas = signal<number[]>([]);
  codigoCupon = signal('');
  resultadoCupon = signal<ResultadoCupon | null>(null);
  usarBienvenida = signal(true);
  usarCredito = signal(false);
  validandoCupon = signal(false);
  comprando = signal(false);

  solicitud = computed<SolicitudCompra>(() => ({
    butacas: this.seleccionadas(),
    productos: this.productosElegidos(),
    combos: this.combosElegidos(),
    cupon: this.resultadoCupon()?.cupon ?? null,
    usarBienvenida: this.usarBienvenida(),
    recompensas: this.recompensasElegidas(),
    usarCredito: this.usarCredito(),
  }));

  cotizacion = computed(() => {
    const d = this.datos();
    return d ? this.compras.cotizar(this.solicitud(), d) : null;
  });

  /** Butacas elegidas con su tipo y precio, para el resumen (así el cliente ve si es VIP antes de pagar). */
  butacasElegidas = computed(() => {
    const d = this.datos();
    if (!d) return [];
    return this.seleccionadas().map((id) => {
      const def = MAPA_BUTACAS.get(id)!;
      return { id, tipo: def.tipo, precio: precioButaca(d.funcion, d.funcion.peliculas, def.tipo) };
    });
  });

  cantidadVip = computed(() => this.butacasElegidas().filter((b) => b.tipo === 'vip').length);

  recargoVip = computed(() => {
    const f = this.datos()?.funcion;
    return f ? Math.max(0, f.precio_vip - f.precio) : 0;
  });

  /** Solo productos activos agrupados por categoría (se ocultan las categorías vacías). */
  categoriasConProductos = computed(() => {
    const productos = this.datos()?.productos ?? [];
    return this.categorias()
      .map((c) => ({ ...c, productos: productos.filter((p) => p.categoria_id === c.id) }))
      .filter((c) => c.productos.length);
  });

  totalCombos = computed(() => Object.values(this.combosElegidos()).reduce((a, n) => a + n, 0));

  puntosDisponibles = computed(() => (this.usuario()?.puntos ?? 0) - (this.cotizacion()?.puntosUsados ?? 0));

  edadRequerida = computed(() => {
    const d = this.datos();
    return d ? edadMinima(d.funcion.peliculas.clasificacion) : 0;
  });

  bloqueadoPorEdad = computed(() => {
    const u = this.usuario();
    return !!u && this.edadRequerida() > 0 && edad(u.fecha_nacimiento) < this.edadRequerida();
  });

  formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    declaraAdulto: [false],
    numero: ['', [Validators.required, tarjetaValida]],
    vencimiento: ['', [Validators.required, vencimientoValido]],
    cvv: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]],
  });

  ngOnInit() {
    this.sub = this.route.paramMap.subscribe((params) => {
      this.funcionId = Number(params.get('funcionId'));
      this.cargar();
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    clearInterval(this.intervalo);
  }

  async cargar() {
    this.cargando.set(true);
    clearInterval(this.intervalo);
    try {
      // La ruta no tiene guard: hay que esperar a que se lea la sesión para saber si hay usuario
      await this.auth.esperarSesion();
      const u = this.auth.usuario();
      const [funcion, productos, combos, categorias, recompensas, config, primeraCompra] = await Promise.all([
        this.funciones.porId(this.funcionId),
        this.candy.productos(true),
        this.candy.combos(true),
        this.candy.categorias(),
        this.fidelizacion.recompensas(true),
        this.configuracion.cargar(),
        u ? this.compras.esPrimeraCompra(u.id) : Promise.resolve(false),
      ]);
      if (!funcion) {
        this.datos.set(null);
        return;
      }
      this.categorias.set(categorias);
      this.datos.set({ funcion, productos, combos, recompensas, usuario: u, primeraCompra, porcentajeBienvenida: config.porcentaje_primera_compra });
      if (u) this.formulario.patchValue({ nombre: `${u.nombre} ${u.apellido}`, email: u.email });

      // Si esta pestaña ya tenía butacas bloqueadas (por ejemplo, al recargar), se recuperan
      const estado = await this.butacas.estado(this.funcionId);
      this.estado.set(estado);
      this.seleccionadas.set(estado.mias);

      // "Tiempo real": se vuelve a consultar el estado de las butacas cada pocos segundos
      this.intervalo = setInterval(() => this.refrescarEstado(), SEGUNDOS_REFRESCO * 1000);
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }

  private async refrescarEstado() {
    try {
      const e = await this.butacas.estado(this.funcionId);
      this.estado.set(e);
      if (this.comprando() || this.comprado) return;
      // Si se venció el bloqueo y otra persona tomó (o compró) una butaca mía, se saca de la selección
      const perdidas = this.seleccionadas().filter((id) => e.vendidas.includes(id) || e.ajenas.includes(id));
      if (perdidas.length) {
        this.seleccionadas.update((lista) => lista.filter((id) => !perdidas.includes(id)));
        this.ajustarCombos();
        this.toast.error(`Se venció tu reserva de ${perdidas.join(', ')} y la tomó otra persona. Elegí otra.`);
      }
    } catch (e) {
      // Sin toast: se repite cada 4 segundos y llenaría la pantalla de avisos
      console.error(e);
    }
  }

  // ───────── Guard de salida ─────────

  tieneCambiosPendientes(): boolean {
    return this.seleccionadas().length > 0 && !this.comprado;
  }

  alSalir(): void {
    clearInterval(this.intervalo);
    if (!this.comprado) this.butacas.liberarTodas(this.funcionId);
  }

  // ───────── Paso 1: butacas ─────────

  async alternarButaca(b: ButacaDef) {
    try {
      if (this.seleccionadas().includes(b.id)) {
        this.seleccionadas.update((lista) => lista.filter((id) => id !== b.id));
        this.ajustarCombos();
        await this.butacas.liberar(this.funcionId, b.id);
        return;
      }
      if (this.seleccionadas().length >= MAX_BUTACAS) {
        this.toast.info(`Podés elegir hasta ${MAX_BUTACAS} butacas por compra.`);
        return;
      }
      const ok = await this.butacas.bloquear(this.funcionId, b.id);
      if (!ok) {
        this.toast.error(`La butaca ${b.id} la está eligiendo otra persona.`);
        await this.refrescarEstado();
        return;
      }
      this.seleccionadas.update((lista) => [...lista, b.id]);
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }

  irAPaso(p: 1 | 2 | 3) {
    if (p > 1 && !this.seleccionadas().length) {
      this.toast.info('Elegí al menos una butaca para seguir.');
      return;
    }
    // Al avanzar se renuevan los 10 minutos de reserva
    this.butacas.renovar(this.funcionId);
    this.paso.set(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ───────── Paso 2: candy ─────────

  cantidadProducto(id: number): number {
    return this.productosElegidos()[id] ?? 0;
  }

  cantidadCombo(id: number): number {
    return this.combosElegidos()[id] ?? 0;
  }

  cambiarProducto(p: Producto, delta: number) {
    this.productosElegidos.update((r) => ({ ...r, [p.id]: Math.max(0, (r[p.id] ?? 0) + delta) }));
  }

  cambiarCombo(c: Combo, delta: number) {
    if (delta > 0 && this.totalCombos() >= this.seleccionadas().length) {
      this.toast.info('Cada combo incluye una entrada: sumá otra butaca para agregar otro combo.');
      return;
    }
    this.combosElegidos.update((r) => ({ ...r, [c.id]: Math.max(0, (r[c.id] ?? 0) + delta) }));
  }

  /** Si se sacan butacas, no puede haber más combos que entradas. */
  private ajustarCombos() {
    let sobrantes = this.totalCombos() - this.seleccionadas().length;
    if (sobrantes <= 0) return;
    const nuevos = { ...this.combosElegidos() };
    for (const id of Object.keys(nuevos)) {
      while (sobrantes > 0 && nuevos[Number(id)] > 0) {
        nuevos[Number(id)]--;
        sobrantes--;
      }
    }
    this.combosElegidos.set(nuevos);
  }

  nombreProducto(id: number): string {
    return this.datos()?.productos.find((p) => p.id === id)?.nombre ?? '';
  }

  // ───────── Paso 3: descuentos y pago ─────────

  async aplicarCupon() {
    const codigo = this.codigoCupon().trim();
    if (!codigo) return;
    this.validandoCupon.set(true);
    try {
      const resultado = await this.cupones.validar(codigo, this.auth.usuario());
      this.resultadoCupon.set(resultado);
      if (resultado.cupon) this.toast.ok(`Cupón ${resultado.cupon.codigo} aplicado.`);
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.validandoCupon.set(false);
    }
  }

  quitarCupon() {
    this.resultadoCupon.set(null);
    this.codigoCupon.set('');
  }

  canjear(r: Recompensa) {
    this.recompensasElegidas.update((lista) => [...lista, r.id]);
  }

  quitarCanje(indice: number) {
    this.recompensasElegidas.update((lista) => lista.filter((_, i) => i !== indice));
  }

  nombreRecompensa(id: number): string {
    return this.datos()?.recompensas.find((r) => r.id === id)?.nombre ?? '';
  }

  /** Si el total es 0 (todo con puntos, cupón o crédito) no se pide tarjeta. */
  private pedirTarjeta(pedir: boolean) {
    const c = this.formulario.controls;
    if (pedir) {
      c.numero.setValidators([Validators.required, tarjetaValida]);
      c.vencimiento.setValidators([Validators.required, vencimientoValido]);
      c.cvv.setValidators([Validators.required, Validators.pattern(/^\d{3,4}$/)]);
    } else {
      c.numero.clearValidators();
      c.vencimiento.clearValidators();
      c.cvv.clearValidators();
    }
    c.numero.updateValueAndValidity();
    c.vencimiento.updateValueAndValidity();
    c.cvv.updateValueAndValidity();
  }

  async confirmar() {
    const d = this.datos();
    const cot = this.cotizacion();
    if (!d || !cot) return;
    if (cot.errores.length) {
      this.toast.error(cot.errores[0]);
      return;
    }
    this.pedirTarjeta(cot.total > 0);
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid) {
      this.toast.error('Revisá los datos marcados en rojo.');
      return;
    }
    // Sin cuenta no sabemos la edad: el comprador declara que asiste un adulto
    const { nombre, email, declaraAdulto } = this.formulario.getRawValue();
    if (!this.usuario() && cot.requiereAdulto && !declaraAdulto) {
      this.toast.error(`Confirmá que sos mayor de ${this.edadRequerida()} o que asiste un adulto.`);
      return;
    }

    this.comprando.set(true);
    try {
      // Pago simulado: acá se integraría la pasarela de pago
      const pedido = await this.compras.comprar(this.solicitud(), d, { nombre: nombre.trim(), email: email.trim() });
      this.comprado = true;
      clearInterval(this.intervalo);
      this.toast.ok('¡Compra confirmada! Ya tenés tu entrada.');
      this.router.navigate(['/entrada', pedido.codigo]);
    } catch (e) {
      this.toast.error((e as Error).message);
      await this.refrescarEstado();
    } finally {
      this.comprando.set(false);
    }
  }
}
