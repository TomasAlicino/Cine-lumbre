import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Estrellas } from '../estrellas/estrellas';
import { ImagenRespaldoDirective } from '../../directivas/directivas';
import { FuncionCompleta, Pelicula, Resena } from '../../models/models';
import { ClasificacionPipe, DiaPipe, DuracionPipe, FechaARPipe, HoraPipe, PesosPipe } from '../../pipes/pipes';
import { AuthService } from '../../services/auth-service';
import { FeriadosService } from '../../services/feriados-service';
import { FuncionesService } from '../../services/funciones-service';
import { NotificacionesService } from '../../services/notificaciones-service';
import { PeliculasService } from '../../services/peliculas-service';
import { Promedio, ResenasService } from '../../services/resenas-service';
import { ToastService } from '../../services/toast-service';
import { aISOFecha, sumarDias } from '../../utils/fechas';
import { EstadoVenta, edadMinima, estadoVenta } from '../../utils/negocio';

/** Funciones de un mismo día (una pestaña). */
interface DiaFunciones {
  fecha: string; // yyyy-mm-dd
  etiqueta: string; // "Hoy", "Mañana", "vie"
  sub: string; // "3 oct"
  funciones: FuncionCompleta[];
}

@Component({
  selector: 'app-pelicula-detalle',
  imports: [
    FormsModule,
    RouterLink,
    Estrellas,
    ImagenRespaldoDirective,
    ClasificacionPipe,
    DiaPipe,
    DuracionPipe,
    FechaARPipe,
    HoraPipe,
    PesosPipe,
  ],
  templateUrl: './pelicula-detalle.html',
  styleUrl: './pelicula-detalle.scss',
})
export class PeliculaDetalle implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private peliculas = inject(PeliculasService);
  private funcionesSrv = inject(FuncionesService);
  private resenasSrv = inject(ResenasService);
  private feriadosSrv = inject(FeriadosService);
  private toast = inject(ToastService);
  auth = inject(AuthService);
  notificaciones = inject(NotificacionesService);

  private sub?: Subscription;
  private subsFeriados: Subscription[] = [];
  private idActual = 0;

  cargando = signal(true);
  pelicula = signal<Pelicula | null>(null);
  funciones = signal<FuncionCompleta[]>([]);
  resenas = signal<Resena[]>([]);
  promedio = signal<Promedio | undefined>(undefined);
  diaElegido = signal<string | null>(null);
  /** Feriados: fecha yyyy-mm-dd → nombre del feriado. */
  feriados = signal(new Map<string, string>());

  // Formulario de reseña
  estrellas = signal(0);
  comentario = signal('');
  guardando = signal(false);

  venta = computed<EstadoVenta>(() => {
    const p = this.pelicula();
    return p ? estadoVenta(p) : { abierta: false, preventa: false, abreEl: null };
  });

  minima = computed(() => {
    const p = this.pelicula();
    return p ? edadMinima(p.clasificacion) : 0;
  });

  /** Una cuenta menor a la edad mínima no puede comprar (si no hay sesión, se controla al comprar). */
  bloqueadaPorEdad = computed(() => {
    const edad = this.auth.edad();
    return edad !== null && edad < this.minima();
  });

  dias = computed(() => this.agruparPorDia(this.funciones()));

  diaActivo = computed(() => {
    const dias = this.dias();
    return dias.find((d) => d.fecha === this.diaElegido()) ?? dias[0];
  });

  miResena = computed(() => {
    const u = this.auth.usuario();
    return u ? this.resenas().find((r) => r.usuario_id === u.id) : undefined;
  });

  ngOnInit() {
    // El mismo componente se reutiliza al pasar de una película a otra, por eso se escucha paramMap
    this.sub = this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      this.reiniciar();
      if (!id) {
        this.router.navigateByUrl('/cartelera');
        return;
      }
      this.cargar(id);
    });
    this.cargarFeriados();
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.subsFeriados.forEach((s) => s.unsubscribe());
  }

  /** Deja todo como recién entrado, para que no quede nada de la película anterior. */
  private reiniciar() {
    this.cargando.set(true);
    this.pelicula.set(null);
    this.funciones.set([]);
    this.resenas.set([]);
    this.promedio.set(undefined);
    this.diaElegido.set(null);
    this.estrellas.set(0);
    this.comentario.set('');
    this.guardando.set(false);
  }

  private async cargar(id: number) {
    this.idActual = id;
    try {
      const [pelicula, funciones, resenas, promedios] = await Promise.all([
        this.peliculas.porId(id),
        this.funcionesSrv.proximasDe(id),
        this.resenasSrv.dePelicula(id),
        this.resenasSrv.promedios(),
      ]);
      // Si mientras tanto se cambió de película, esta respuesta ya no sirve
      if (id !== this.idActual) return;
      if (!pelicula) {
        this.toast.info('No encontramos esa película.');
        this.router.navigateByUrl('/cartelera');
        return;
      }
      this.pelicula.set(pelicula);
      this.funciones.set(funciones);
      this.resenas.set(resenas);
      this.promedio.set(promedios.get(id));
      this.completarMiResena();
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      if (id === this.idActual) this.cargando.set(false);
    }
  }

  /**
   * Las funciones se programan con pocas semanas de anticipación, así que alcanza con
   * los feriados de este año y del siguiente (por las funciones de diciembre a enero).
   * Si la API falla, simplemente no se marcan los feriados.
   */
  private cargarFeriados() {
    const anio = new Date().getFullYear();
    for (const a of [anio, anio + 1]) {
      const s = this.feriadosSrv.traerFeriados(a).subscribe({
        next: (lista) =>
          this.feriados.update((mapa) => {
            const nuevo = new Map(mapa);
            lista.forEach((f) => nuevo.set(f.date, f.localName));
            return nuevo;
          }),
        error: (e) => console.error('No se pudieron traer los feriados', e),
      });
      this.subsFeriados.push(s);
    }
  }

  /** Si la persona ya opinó, el formulario arranca con su reseña. */
  private completarMiResena() {
    const mia = this.miResena();
    if (mia) {
      this.estrellas.set(mia.estrellas);
      this.comentario.set(mia.comentario);
    }
  }

  private agruparPorDia(funciones: FuncionCompleta[]): DiaFunciones[] {
    const dias: DiaFunciones[] = [];
    const hoy = aISOFecha(new Date());
    const manana = aISOFecha(sumarDias(new Date(), 1));
    for (const f of funciones) {
      const d = new Date(f.inicio);
      const fecha = aISOFecha(d);
      let dia = dias.find((x) => x.fecha === fecha);
      if (!dia) {
        const etiqueta =
          fecha === hoy ? 'Hoy' : fecha === manana ? 'Mañana' : d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '');
        const sub = d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '');
        dia = { fecha, etiqueta, sub, funciones: [] };
        dias.push(dia);
      }
      dia.funciones.push(f);
    }
    return dias.slice(0, 14);
  }

  async alternarAlerta(id: number) {
    try {
      const activa = await this.notificaciones.alternarAlerta(id);
      this.toast.ok(activa ? 'Te avisamos cuando salgan las entradas.' : 'Alerta desactivada.');
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }

  async guardarResena(peliculaId: number) {
    this.guardando.set(true);
    try {
      await this.resenasSrv.guardar(peliculaId, this.estrellas(), this.comentario());
      this.toast.ok('Reseña publicada. ¡Gracias!');
      // Se recargan la lista y el promedio para que se vea la reseña nueva
      const [resenas, promedios] = await Promise.all([this.resenasSrv.dePelicula(peliculaId), this.resenasSrv.promedios()]);
      if (peliculaId !== this.idActual) return;
      this.resenas.set(resenas);
      this.promedio.set(promedios.get(peliculaId));
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.guardando.set(false);
    }
  }
}
