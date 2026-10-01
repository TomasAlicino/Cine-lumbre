import { Component, HostListener, Input, OnChanges, OnDestroy, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, Subscription, combineLatest, interval, map } from 'rxjs';
import { Combo, Funcion, Pelicula, Producto, Recompensa, Sala, Usuario } from '../../core/models/models';
import { DbService } from '../../core/services/db.service';
import { AuthService } from '../../core/services/auth.service';
import { CandyService } from '../../core/services/candy.service';
import { FidelizacionService } from '../../core/services/fidelizacion.service';
import { ConfiguracionService } from '../../core/services/configuracion.service';
import { Cotizacion, EstadoButacas, ReservasService, SolicitudCompra } from '../../core/services/reservas.service';
import { ToastService } from '../../core/services/toast.service';
import { ConCambiosPendientes } from '../../core/guards/auth.guards';
import { ButacaDef, MAPA_BUTACAS } from '../../core/utils/sala-layout';
import { edadMinima, precioButaca } from '../../core/utils/negocio';
import { edad } from '../../core/utils/fechas';
import { tarjetaValida, vencimientoValido } from '../../core/utils/validadores';
import { MapaButacasComponent } from '../../shared/components/mapa-butacas.component';
import { PesosPipe, TipoButacaPipe, DuracionPipe } from '../../shared/pipes/pipes';
import { MascaraFechaDirective } from '../../shared/directives/directivas';

const MAX_BUTACAS = 10;

interface Contexto {
  funcion: Funcion;
  pelicula: Pelicula;
  sala: Sala;
}

@Component({
  selector: 'app-compra',
  imports: [AsyncPipe, FormsModule, ReactiveFormsModule, RouterLink, MapaButacasComponent, PesosPipe, TipoButacaPipe, DuracionPipe, MascaraFechaDirective],
  templateUrl: './compra.component.html',
  styleUrl: './compra.component.scss',
})
export class CompraComponent implements OnInit, OnChanges, OnDestroy, ConCambiosPendientes {
  private readonly db = inject(DbService);
  private readonly auth = inject(AuthService);
  private readonly reservas = inject(ReservasService);
  private readonly candy = inject(CandyService);
  private readonly fidelizacion = inject(FidelizacionService);
  private readonly config = inject(ConfiguracionService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  @Input() funcionId = '';

  ctx$!: Observable<Contexto | null>;
  estado$!: Observable<EstadoButacas>;
  readonly combos$ = this.candy.combosActivos$;
  readonly categorias$ = combineLatest([this.candy.categorias$, this.candy.productosActivos$]).pipe(
    map(([cats, prods]) => cats.map((c) => ({ ...c, productos: prods.filter((p) => p.categoriaId === c.id) })).filter((c) => c.productos.length)),
  );
  readonly recompensas$ = this.fidelizacion.recompensasActivas$;
  readonly usuario$ = this.auth.usuario$;
  readonly config$ = this.config.config$;

  paso: 1 | 2 | 3 = 1;
  seleccionadas: string[] = [];
  productos: Record<string, number> = {};
  combos: Record<string, number> = {};
  recompensas: string[] = [];
  cuponCodigo = '';
  cuponIngresado = '';
  usarBienvenida = true;
  usarCredito = false;
  cot: Cotizacion | null = null;
  comprando = false;
  comprado = false;
  minutosRestantes = 10;
  private vence = Date.now() + 10 * 60_000;
  private subs = new Subscription();

  readonly comprador = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    declaraAdulto: [false],
  });

  readonly pago = this.fb.nonNullable.group({
    titular: ['', Validators.required],
    numero: ['', [Validators.required, tarjetaValida]],
    vencimiento: ['', [Validators.required, vencimientoValido]],
    cvv: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]],
  });

  ngOnInit() {
    this.subs.add(
      this.auth.usuario$.subscribe((u) => {
        if (u && !this.comprador.controls.nombre.value) {
          this.comprador.patchValue({ nombre: `${u.nombre} ${u.apellido}`, email: u.email });
        }
        this.recalcular();
      }),
    );
    this.subs.add(
      interval(15_000).subscribe(() => {
        this.minutosRestantes = Math.max(0, Math.ceil((this.vence - Date.now()) / 60_000));
        if (this.minutosRestantes === 0 && this.seleccionadas.length && !this.comprado) {
          this.reservas.liberarTodas(this.funcionId);
          this.seleccionadas = [];
          this.paso = 1;
          this.recalcular();
          this.toast.error('Se venció el tiempo de reserva y liberamos las butacas. Elegilas de nuevo.');
        }
      }),
    );
  }

  ngOnChanges() {
    this.ctx$ = combineLatest([this.db.lista$('funciones'), this.db.lista$('peliculas'), this.db.lista$('salas')]).pipe(
      map(([fs, ps, ss]) => {
        const funcion = fs.find((f) => f.id === this.funcionId);
        const pelicula = funcion && ps.find((p) => p.id === funcion.peliculaId);
        const sala = funcion && ss.find((s) => s.id === funcion.salaId);
        return funcion && pelicula && sala ? { funcion, pelicula, sala } : null;
      }),
    );
    this.estado$ = this.reservas.estadoButacas$(this.funcionId);
    // Recupera butacas que esta misma pestaña ya tenía bloqueadas (por ejemplo, tras recargar)
    const ahora = new Date().toISOString();
    this.seleccionadas = this.db
      .foto('bloqueos')
      .filter((b) => b.funcionId === this.funcionId && b.sesionId === this.reservas.sesionId && b.expira > ahora)
      .map((b) => b.butaca);
    this.recalcular();
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }

  @HostListener('window:beforeunload')
  alCerrarPestania() {
    if (!this.comprado) this.reservas.liberarTodas(this.funcionId);
  }

  tieneCambiosPendientes(): boolean {
    return this.seleccionadas.length > 0 && !this.comprado;
  }

  alSalir(): void {
    if (!this.comprado) this.reservas.liberarTodas(this.funcionId);
  }

  // ───────── Paso 1: butacas ─────────

  alternarButaca(b: ButacaDef) {
    if (this.seleccionadas.includes(b.id)) {
      this.reservas.liberar(this.funcionId, b.id);
      this.seleccionadas = this.seleccionadas.filter((x) => x !== b.id);
      this.ajustarCombos();
      this.recalcular();
      return;
    }
    if (this.seleccionadas.length >= MAX_BUTACAS) {
      this.toast.info(`Podés elegir hasta ${MAX_BUTACAS} butacas por compra.`);
      return;
    }
    this.reservas.bloquear(this.funcionId, b.id).subscribe((ok) => {
      if (!ok) {
        this.toast.error(`La butaca ${b.id} la acaba de tomar otra persona.`);
        return;
      }
      this.seleccionadas = [...this.seleccionadas, b.id];
      this.vence = Date.now() + 10 * 60_000;
      this.minutosRestantes = 10;
      this.recalcular();
    });
  }

  butaca(id: string) {
    return MAPA_BUTACAS.get(id)!;
  }

  precio(ctx: Contexto, id: string) {
    return precioButaca(ctx.funcion, ctx.pelicula, this.butaca(id).tipo);
  }

  get cantidadVip() {
    return this.seleccionadas.filter((id) => this.butaca(id).tipo === 'vip').length;
  }

  // ───────── Paso 2: candy ─────────

  cambiarProducto(p: Producto, delta: number) {
    this.productos = { ...this.productos, [p.id]: Math.max(0, (this.productos[p.id] ?? 0) + delta) };
    this.recalcular();
  }

  cambiarCombo(c: Combo, delta: number) {
    const total = Object.values(this.combos).reduce((a, n) => a + n, 0);
    if (delta > 0 && total >= this.seleccionadas.length) {
      this.toast.info('Cada combo incluye una entrada: sumá otra butaca para agregar otro combo.');
      return;
    }
    this.combos = { ...this.combos, [c.id]: Math.max(0, (this.combos[c.id] ?? 0) + delta) };
    this.recalcular();
  }

  private ajustarCombos() {
    let sobrantes = Object.values(this.combos).reduce((a, n) => a + n, 0) - this.seleccionadas.length;
    for (const id of Object.keys(this.combos)) {
      while (sobrantes > 0 && this.combos[id] > 0) {
        this.combos[id]--;
        sobrantes--;
      }
    }
  }

  nombreProducto(id: string) {
    return this.candy.nombreProducto(id);
  }

  // ───────── Paso 3: descuentos y pago ─────────

  aplicarCupon() {
    this.cuponCodigo = this.cuponIngresado.trim();
    this.recalcular();
    if (this.cot?.cuponAplicado && this.cot.cuponAplicado === this.cuponCodigo.toUpperCase()) this.toast.ok(`Cupón ${this.cot.cuponAplicado} aplicado.`);
  }

  quitarCupon() {
    this.cuponCodigo = '';
    this.cuponIngresado = '';
    this.recalcular();
  }

  puntosDisponibles(u: Usuario | null) {
    const usados = this.recompensas.reduce((a, id) => a + (this.db.porId('recompensas', id)?.costoPuntos ?? 0), 0);
    return (u?.puntos ?? 0) - usados;
  }

  canjear(r: Recompensa) {
    this.recompensas = [...this.recompensas, r.id];
    this.recalcular();
  }

  quitarCanje(i: number) {
    this.recompensas = this.recompensas.filter((_, idx) => idx !== i);
    this.recalcular();
  }

  nombreRecompensa(id: string) {
    return this.db.porId('recompensas', id)?.nombre ?? '';
  }

  requiereDeclaracion(ctx: Contexto, u: Usuario | null) {
    return !u && edadMinima(ctx.pelicula.clasificacion) > 0;
  }

  bloqueadoPorEdad(ctx: Contexto, u: Usuario | null) {
    const min = edadMinima(ctx.pelicula.clasificacion);
    return !!u && min > 0 && edad(u.fechaNacimiento) < min;
  }

  irAPaso(p: 1 | 2 | 3) {
    if (p > 1 && !this.seleccionadas.length) {
      this.toast.info('Elegí al menos una butaca para seguir.');
      return;
    }
    this.reservas.renovarBloqueos(this.funcionId);
    this.vence = Date.now() + 10 * 60_000;
    this.minutosRestantes = 10;
    this.paso = p;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private solicitud(): SolicitudCompra {
    return {
      funcionId: this.funcionId,
      butacas: this.seleccionadas,
      productos: this.productos,
      combos: this.combos,
      cuponCodigo: this.cuponCodigo,
      usarBienvenida: this.usarBienvenida,
      recompensas: this.recompensas,
      usarCredito: this.usarCredito,
    };
  }

  recalcular() {
    if (this.funcionId) this.cot = this.reservas.cotizar(this.solicitud());
  }

  confirmar(ctx: Contexto, u: Usuario | null) {
    this.comprador.markAllAsTouched();
    if (this.comprador.invalid) {
      this.toast.error('Completá tu nombre y un mail válido para recibir la entrada.');
      return;
    }
    if (this.requiereDeclaracion(ctx, u) && !this.comprador.controls.declaraAdulto.value) {
      this.toast.error(`Confirmá que sos mayor de ${edadMinima(ctx.pelicula.clasificacion)} o que asiste un adulto.`);
      return;
    }
    if (this.cot && this.cot.total > 0) {
      this.pago.markAllAsTouched();
      if (this.pago.invalid) {
        this.toast.error('Revisá los datos de la tarjeta.');
        return;
      }
    }
    this.comprando = true;
    const { nombre, email } = this.comprador.getRawValue();
    // Pago simulado: acá se integraría la pasarela (Mercado Pago, etc.)
    setTimeout(() => {
      this.reservas.comprar(this.solicitud(), { nombre, email }).subscribe({
        next: (pedido) => {
          this.comprado = true;
          this.toast.ok('¡Compra confirmada! Ya tenés tu entrada.');
          this.router.navigate(['/entrada', pedido.id]);
        },
        error: (e: Error) => {
          this.comprando = false;
          this.toast.error(e.message);
        },
      });
    }, 700);
  }

  hora(iso: string) {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }

  fecha(iso: string) {
    return new Date(iso).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
}
