import { Component, Input, OnChanges, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, combineLatest, map } from 'rxjs';
import { Funcion, Pelicula, Resena, Sala } from '../../core/models/models';
import { PeliculasService } from '../../core/services/peliculas.service';
import { FuncionesService } from '../../core/services/funciones.service';
import { ResenasService, Promedio } from '../../core/services/resenas.service';
import { SalasService } from '../../core/services/salas.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { ToastService } from '../../core/services/toast.service';
import { EstadoVenta, edadMinima, estadoVenta } from '../../core/utils/negocio';
import { aISOFecha, edad } from '../../core/utils/fechas';
import { EstrellasComponent } from '../../shared/components/estrellas.component';
import { ClasificacionPipe, DuracionPipe, FechaARPipe, PesosPipe } from '../../shared/pipes/pipes';
import { ImagenRespaldoDirective } from '../../shared/directives/directivas';

interface DiaFunciones {
  fecha: string;
  etiqueta: string;
  sub: string;
  funciones: Funcion[];
}

interface Vista {
  pelicula: Pelicula;
  venta: EstadoVenta;
  dias: DiaFunciones[];
  salas: Map<string, Sala>;
  resenas: Resena[];
  promedio: Promedio | undefined;
  miResena: Resena | undefined;
  logueado: boolean;
  bloqueadaPorEdad: boolean;
}

@Component({
  selector: 'app-pelicula-detalle',
  imports: [AsyncPipe, FormsModule, RouterLink, EstrellasComponent, DuracionPipe, FechaARPipe, PesosPipe, ClasificacionPipe, ImagenRespaldoDirective],
  template: `
    @if (vista$ | async; as v) {
      <div class="contenedor pagina">
        <div class="ficha">
          <img class="poster" [src]="v.pelicula.imagenUrl" [alt]="'Póster de ' + v.pelicula.titulo" appImagenRespaldo />
          <div class="texto">
            <h1>{{ v.pelicula.titulo }}</h1>
            <div class="datos">
              <span class="etiqueta" [class.roja]="v.pelicula.clasificacion !== 'ATP'">{{ v.pelicula.clasificacion | clasificacion }}</span>
              <span>{{ v.pelicula.duracionMin | duracion }}</span>
              <span>{{ v.pelicula.generos.join(', ') }}</span>
            </div>
            @if (v.promedio) {
              <p class="puntaje"><app-estrellas [valor]="v.promedio.promedio" /> <strong>{{ v.promedio.promedio.toFixed(1) }}</strong> <span class="suave chico">({{ v.promedio.cantidad }} {{ v.promedio.cantidad === 1 ? 'reseña' : 'reseñas' }})</span></p>
            }
            <p class="sinopsis">{{ v.pelicula.sinopsis }}</p>
            @if (v.venta.preventa) {
              <p class="aviso">Preventa abierta hasta el estreno ({{ v.pelicula.fechaEstreno | fechaAR }}): entradas a {{ v.pelicula.preventa.precio | pesos }}.</p>
            }
            @if (v.pelicula.clasificacion !== 'ATP') {
              <p class="aviso error">Película {{ v.pelicula.clasificacion }}. Las cuentas de menores de {{ minima(v.pelicula) }} años no pueden comprar entradas y en la entrada consta que debe asistir un adulto.</p>
            }
          </div>
        </div>

        <section id="funciones" class="bloque">
          <h2>Funciones</h2>
          @if (!v.venta.abierta) {
            <div class="vacio">
              <p>La venta abre el {{ v.venta.abreEl ? fecha(v.venta.abreEl) : 'día del estreno' }}.</p>
              @if (v.logueado) {
                <button type="button" class="btn btn-primario" (click)="alternarAlerta(v.pelicula.id)">{{ (alertas$ | async)?.has(v.pelicula.id) ? 'Alerta activada' : 'Avisarme cuando salga a la venta' }}</button>
              } @else {
                <a class="btn" routerLink="/ingresar" [queryParams]="{ volver: '/pelicula/' + v.pelicula.id }">Ingresá para activar una alerta</a>
              }
            </div>
          } @else if (v.bloqueadaPorEdad) {
            <div class="vacio"><p>Tu cuenta no puede comprar entradas para una película {{ v.pelicula.clasificacion }}.</p></div>
          } @else if (!v.dias.length) {
            <div class="vacio"><p>No hay funciones programadas por ahora.</p></div>
          } @else {
            @let dia = diaActivo(v.dias);
            <div class="dias" role="tablist" aria-label="Día de la función">
              @for (d of v.dias; track d.fecha) {
                <button type="button" role="tab" class="dia" [class.activo]="d.fecha === dia.fecha" [attr.aria-selected]="d.fecha === dia.fecha" (click)="diaElegido = d.fecha">
                  <span>{{ d.etiqueta }}</span>
                  <small>{{ d.sub }}</small>
                </button>
              }
            </div>
            <div class="horarios" role="tabpanel">
              @for (f of dia.funciones; track f.id) {
                <a class="horario" [routerLink]="['/comprar', f.id]">
                  <strong>{{ hora(f.inicio) }}</strong>
                  <span>{{ f.formato }} · {{ f.idioma === 'castellano' ? 'Castellano' : 'Subtitulada' }}</span>
                  <small>{{ v.salas.get(f.salaId)?.nombre }} · desde {{ (v.venta.preventa ? v.pelicula.preventa.precio : f.precio) | pesos }}</small>
                </a>
              }
            </div>
          }
        </section>

        <section class="bloque resenas">
          <h2>Reseñas</h2>
          @if (v.logueado) {
            <form class="panel form-resena" (ngSubmit)="guardarResena(v.pelicula.id)">
              <h3>{{ v.miResena ? 'Tu reseña' : 'Contanos qué te pareció' }}</h3>
              <app-estrellas [editable]="true" [valor]="estrellas" (valorChange)="estrellas = $event" etiqueta="Tu calificación" />
              <div class="campo">
                <label for="comentario">Comentario corto</label>
                <textarea id="comentario" name="comentario" [(ngModel)]="comentario" maxlength="280" placeholder="Sin spoilers, por favor"></textarea>
                <span class="ayuda">{{ comentario.length }}/280</span>
              </div>
              <button type="submit" class="btn btn-primario" [disabled]="!estrellas">{{ v.miResena ? 'Actualizar reseña' : 'Publicar reseña' }}</button>
            </form>
          } @else {
            <p class="suave"><a routerLink="/ingresar" [queryParams]="{ volver: '/pelicula/' + v.pelicula.id }">Ingresá</a> para calificar esta película.</p>
          }
          <ul class="lista-resenas">
            @for (r of v.resenas; track r.id) {
              <li>
                <div class="cabeza"><strong>{{ r.autor }}</strong> <app-estrellas [valor]="r.estrellas" /> <span class="suave chico">{{ r.fecha | fechaAR }}</span></div>
                @if (r.comentario) { <p>{{ r.comentario }}</p> }
              </li>
            } @empty {
              <li class="suave">Todavía no hay reseñas. Sé la primera persona en opinar.</li>
            }
          </ul>
        </section>
      </div>
    } @else {
      <div class="contenedor pagina"><p class="suave">Buscando la película…</p></div>
    }
  `,
  styles: `
    .ficha { display: grid; grid-template-columns: minmax(180px, 300px) 1fr; gap: clamp(20px, 4vw, 48px); align-items: start; }
    .poster { width: 100%; aspect-ratio: 2 / 3; object-fit: cover; border-radius: var(--r-s); box-shadow: 0 24px 50px rgba(0,0,0,.4); }
    h1 { font-size: clamp(2.4rem, 6vw, var(--t-4xl)); margin-bottom: 14px; }
    .datos { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; color: var(--humo); font-size: var(--t-s); margin-bottom: 16px; }
    .puntaje { display: flex; align-items: center; gap: 8px; }
    .sinopsis { font-size: var(--t-l); line-height: 1.5; }
    .aviso { margin-top: 12px; }
    .bloque { margin-top: 56px; }
    .dias { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; margin-bottom: 16px; }
    .dia { flex: none; min-width: 84px; padding: 10px 12px; border: 1px solid var(--linea); border-radius: var(--r-s); background: transparent; color: var(--pantalla); cursor: pointer; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; font-family: inherit; }
    .dia span { font: 700 var(--t-l) / 1 var(--f-display); }
    .dia small { color: var(--humo); font-size: var(--t-xs); }
    .dia.activo { background: var(--pantalla); color: var(--noche); border-color: var(--pantalla); }
    .dia.activo small { color: var(--noche-3); }
    .horarios { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
    .horario { display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; border: 1px solid var(--linea); border-left: 3px solid var(--laton); border-radius: var(--r-s); background: var(--noche-2); color: var(--pantalla); text-decoration: none; }
    .horario:hover { border-color: var(--laton); color: var(--pantalla); }
    .horario strong { font: 700 var(--t-2xl) / 1 var(--f-display); color: var(--laton); font-variant-numeric: tabular-nums; }
    .horario span { font-size: var(--t-s); }
    .horario small { color: var(--humo); font-size: var(--t-xs); }
    .form-resena { display: grid; gap: 12px; max-width: 560px; margin-bottom: 28px; }
    .form-resena h3 { margin: 0; }
    .form-resena .btn { justify-self: start; }
    .lista-resenas { list-style: none; padding: 0; margin: 0; max-width: 720px; }
    .lista-resenas li { padding: 16px 0; border-bottom: 1px solid var(--linea); }
    .lista-resenas p { margin: 6px 0 0; }
    .cabeza { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
    @media (max-width: 640px) { .ficha { grid-template-columns: 1fr; } .poster { max-width: 220px; } }
  `,
})
export class PeliculaDetalleComponent implements OnChanges {
  private readonly peliculas = inject(PeliculasService);
  private readonly funciones = inject(FuncionesService);
  private readonly resenasSrv = inject(ResenasService);
  private readonly salas = inject(SalasService);
  private readonly auth = inject(AuthService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** Parámetro de ruta (withComponentInputBinding). */
  @Input() id = '';

  vista$!: Observable<Vista | null>;
  readonly alertas$ = this.notificaciones.misAlertas$;
  diaElegido: string | null = null;
  estrellas = 0;
  comentario = '';

  ngOnChanges() {
    this.diaElegido = null;
    this.vista$ = combineLatest([
      this.peliculas.porId$(this.id),
      this.funciones.proximasDe$(this.id),
      this.salas.salas$,
      this.resenasSrv.dePelicula$(this.id),
      this.resenasSrv.promedios$,
      this.auth.usuario$,
    ]).pipe(
      map(([pelicula, funciones, salas, resenas, promedios, usuario]) => {
        if (!pelicula) {
          this.router.navigateByUrl('/cartelera');
          return null;
        }
        const miResena = usuario ? resenas.find((r) => r.usuarioId === usuario.id) : undefined;
        if (miResena && !this.estrellas) {
          this.estrellas = miResena.estrellas;
          this.comentario = miResena.comentario;
        }
        const minima = edadMinima(pelicula.clasificacion);
        return {
          pelicula,
          venta: estadoVenta(pelicula),
          dias: this.agruparPorDia(funciones),
          salas: new Map(salas.map((s) => [s.id, s])),
          resenas,
          promedio: promedios.get(pelicula.id),
          miResena,
          logueado: !!usuario,
          bloqueadaPorEdad: !!usuario && minima > 0 && edad(usuario.fechaNacimiento) < minima,
        };
      }),
    );
  }

  private agruparPorDia(funciones: Funcion[]): DiaFunciones[] {
    const dias = new Map<string, DiaFunciones>();
    const hoy = aISOFecha(new Date());
    const manana = aISOFecha(new Date(Date.now() + 86_400_000));
    for (const f of funciones) {
      const d = new Date(f.inicio);
      const clave = aISOFecha(d);
      if (!dias.has(clave)) {
        const etiqueta = clave === hoy ? 'Hoy' : clave === manana ? 'Mañana' : d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '');
        dias.set(clave, { fecha: clave, etiqueta, sub: d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', ''), funciones: [] });
      }
      dias.get(clave)!.funciones.push(f);
    }
    return [...dias.values()].slice(0, 14);
  }

  diaActivo(dias: DiaFunciones[]): DiaFunciones {
    return dias.find((d) => d.fecha === this.diaElegido) ?? dias[0];
  }

  hora(iso: string) {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }

  fecha(d: Date) {
    return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  minima(p: Pelicula) {
    return edadMinima(p.clasificacion);
  }

  alternarAlerta(id: string) {
    this.notificaciones.alternarAlerta(id).subscribe((a) => this.toast.ok(a ? 'Te avisamos cuando salgan las entradas.' : 'Alerta desactivada.'));
  }

  guardarResena(peliculaId: string) {
    this.resenasSrv.guardar(peliculaId, this.estrellas, this.comentario).subscribe({
      next: () => this.toast.ok('Reseña publicada. ¡Gracias!'),
      error: (e: Error) => this.toast.error(e.message),
    });
  }
}
