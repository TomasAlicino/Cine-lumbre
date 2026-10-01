import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet, Routes } from '@angular/router';
import { Observable, combineLatest, filter, map, switchMap } from 'rxjs';
import { Canje, Funcion, Pedido, Pelicula, Recompensa, Resena, Sala, Usuario } from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { DbService } from '../../core/services/db.service';
import { ReservasService } from '../../core/services/reservas.service';
import { EntradaPdfService } from '../../core/services/entrada-pdf.service';
import { FidelizacionService } from '../../core/services/fidelizacion.service';
import { ResenasService } from '../../core/services/resenas.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfiguracionService } from '../../core/services/configuracion.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { edad } from '../../core/utils/fechas';
import { EstrellasComponent } from '../../shared/components/estrellas.component';
import { FechaARPipe, PesosPipe } from '../../shared/pipes/pipes';
import { ImagenRespaldoDirective } from '../../shared/directives/directivas';

const usuarioLogueado$ = (auth: AuthService) => auth.usuario$.pipe(filter((u): u is Usuario => !!u));

// ─────────────────────────────── Layout ───────────────────────────────

@Component({
  selector: 'app-cuenta-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AsyncPipe, PesosPipe],
  template: `
    <div class="contenedor pagina">
      @if (auth.usuario$ | async; as u) {
        <header class="cabecera-pagina">
          <div>
            <h1>Hola, {{ u.nombre }}</h1>
            <p>Tus entradas, tu historial y tus beneficios.</p>
          </div>
          <div class="saldos">
            <div><span>Puntos</span><strong>{{ u.puntos.toLocaleString('es-AR') }}</strong></div>
            <div><span>Crédito</span><strong>{{ u.credito | pesos }}</strong></div>
          </div>
        </header>
      }
      <nav class="pestanas" aria-label="Secciones de mi cuenta">
        <a routerLink="perfil" routerLinkActive="activa">Perfil</a>
        <a routerLink="compras" routerLinkActive="activa">Mis compras</a>
        <a routerLink="mis-peliculas" routerLinkActive="activa">Mis películas</a>
        <a routerLink="puntos" routerLinkActive="activa">Puntos y canjes</a>
      </nav>
      <router-outlet />
    </div>
  `,
  styles: `
    .saldos { display: flex; gap: 12px; }
    .saldos div { display: flex; flex-direction: column; padding: 10px 18px; border: 1px solid var(--linea); border-radius: var(--r-m); background: var(--noche-2); min-width: 120px; }
    .saldos span { font-size: var(--t-xs); color: var(--humo); }
    .saldos strong { font: 800 var(--t-2xl) / 1.1 var(--f-display); color: var(--laton); }
    .pestanas { display: flex; gap: 4px; border-bottom: 1px solid var(--linea); margin-bottom: 28px; overflow-x: auto; }
    .pestanas a { padding: 12px 16px; color: var(--humo); text-decoration: none; font-weight: 600; white-space: nowrap; border-bottom: 3px solid transparent; }
    .pestanas a:hover { color: var(--pantalla); }
    .pestanas a.activa { color: var(--pantalla); border-bottom-color: var(--laton); }
  `,
})
export class CuentaLayoutComponent {
  readonly auth = inject(AuthService);
}

// ─────────────────────────────── Perfil ───────────────────────────────

@Component({
  selector: 'app-perfil',
  imports: [AsyncPipe, RouterLink, FechaARPipe, PesosPipe],
  template: `
    @if (vista$ | async; as v) {
      <div class="grilla">
        <section class="panel">
          <h2>Mis datos</h2>
          <dl>
            <div><dt>Nombre</dt><dd>{{ v.u.nombre }} {{ v.u.apellido }}</dd></div>
            <div><dt>Mail</dt><dd>{{ v.u.email }}</dd></div>
            <div><dt>Nacimiento</dt><dd>{{ v.u.fechaNacimiento | fechaAR }} ({{ v.edad }} años)</dd></div>
            <div><dt>Tipo de sangre</dt><dd>{{ v.u.tipoSangre }}</dd></div>
            <div><dt>Color de ojos</dt><dd>{{ v.u.colorOjos }}</dd></div>
            <div><dt>Vacaciones</dt><dd>{{ v.u.diasVacaciones }} días por año</dd></div>
            <div><dt>Miembro desde</dt><dd>{{ v.u.creadoEn.slice(0, 10) | fechaAR }}</dd></div>
          </dl>
        </section>
        <section class="panel">
          <h2>Beneficios</h2>
          @if (v.bienvenida) {
            <p class="aviso ok">Tenés disponible tu cupón de bienvenida del <strong>{{ v.porcentaje }}%</strong>. Se aplica solo en tu primera compra.</p>
          }
          <p><strong>{{ v.u.credito | pesos }}</strong> de crédito en tu cuenta. Se usa junto con la tarjeta al pagar.</p>
          <p><strong>{{ v.u.puntos.toLocaleString('es-AR') }} puntos</strong> — sumás 1 punto por cada peso que pagás. <a routerLink="../puntos">Ver recompensas</a></p>
          @if (v.edad > 50) { <p class="suave chico">Por tener más de 50 años podés usar los cupones exclusivos para mayores.</p> }
        </section>
        <section class="panel ancho">
          <div class="titulo-fila">
            <h2>Notificaciones</h2>
            @if (v.notis.length) { <button type="button" class="btn btn-chico" (click)="notis.marcarTodasLeidas()">Marcar todas como leídas</button> }
          </div>
          @for (n of v.notis; track n.id) {
            <p class="noti" [class.nueva]="!n.leida">
              <span>{{ n.mensaje }}</span>
              @if (n.enlace) { <a [routerLink]="n.enlace">Ver</a> }
              <small>{{ n.fecha.slice(0, 10) | fechaAR }}</small>
            </p>
          } @empty {
            <p class="suave">No tenés notificaciones. Activá alertas en <a routerLink="/proximamente">Próximamente</a>.</p>
          }
        </section>
      </div>
    }
  `,
  styles: `
    .grilla { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
    .ancho { grid-column: 1 / -1; }
    h2 { margin: 0 0 14px; font-size: var(--t-xl); }
    dl { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 20px; margin: 0; }
    dt { font-size: var(--t-xs); color: var(--humo); }
    dd { margin: 0; font-weight: 600; }
    .titulo-fila { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    .noti { display: flex; gap: 12px; align-items: baseline; padding: 10px 0; margin: 0; border-bottom: 1px solid var(--linea); max-width: none; }
    .noti span { flex: 1; }
    .noti small { color: var(--humo); }
    .noti.nueva span::before { content: '●'; color: var(--laton); margin-right: 8px; }
  `,
})
export class PerfilComponent {
  private readonly auth = inject(AuthService);
  private readonly reservas = inject(ReservasService);
  private readonly config = inject(ConfiguracionService);
  readonly notis = inject(NotificacionesService);

  readonly vista$ = combineLatest([usuarioLogueado$(this.auth), this.config.config$, this.notis.mias$, inject(DbService).lista$('pedidos')]).pipe(
    map(([u, c, notis]) => ({
      u,
      edad: edad(u.fechaNacimiento),
      porcentaje: c.porcentajePrimeraCompra,
      bienvenida: this.reservas.esPrimeraCompra(u),
      notis,
    })),
  );
}

// ─────────────────────────────── Compras ───────────────────────────────

interface FilaCompra {
  pedido: Pedido;
  funcion: Funcion | undefined;
  pelicula: Pelicula | undefined;
  sala: Sala | undefined;
  cancelable: boolean;
  pasada: boolean;
}

@Component({
  selector: 'app-mis-compras',
  imports: [AsyncPipe, RouterLink, PesosPipe],
  template: `
    @if (filas$ | async; as filas) {
      <p class="suave chico">Podés cancelar una compra hasta {{ horas }} horas antes de la función: el importe vuelve como crédito en tu cuenta.</p>
      <div class="lista">
        @for (f of filas; track f.pedido.id) {
          <article class="compra" [class.cancelada]="f.pedido.estado === 'cancelada'" [class.pasada]="f.pasada">
            <div class="fecha">
              @if (f.funcion) {
                <span class="dia">{{ dia(f.funcion.inicio) }}</span>
                <span class="hora">{{ hora(f.funcion.inicio) }}</span>
              }
            </div>
            <div class="info">
              <h3>{{ f.pelicula?.titulo ?? 'Película eliminada' }}</h3>
              <p class="suave chico">
                {{ f.sala?.nombre }} · {{ f.funcion?.formato }} · Butacas {{ f.pedido.butacas.join(', ') }}
                @if (f.pedido.items.length) { · Candy: {{ resumenItems(f.pedido) }} }
              </p>
              <p class="chico">
                <code>{{ f.pedido.codigo }}</code> · {{ f.pedido.total + f.pedido.creditoUsado | pesos }}
                @if (f.pedido.estado === 'cancelada') { <span class="etiqueta roja">Cancelada</span> }
                @else if (f.pedido.entradaValidada) { <span class="etiqueta ok">Usada</span> }
                @else if (f.pasada) { <span class="etiqueta">Vencida</span> }
                @else { <span class="etiqueta laton">Vigente</span> }
              </p>
            </div>
            <div class="acciones">
              <a class="btn btn-chico" [routerLink]="['/entrada', f.pedido.id]">Ver entrada</a>
              @if (f.pedido.estado === 'pagada') {
                <button type="button" class="btn btn-chico" (click)="pdf.descargar(f.pedido)">PDF</button>
              }
              @if (f.cancelable) {
                <button type="button" class="btn btn-chico btn-peligro" (click)="cancelar(f)">Cancelar</button>
              }
            </div>
          </article>
        } @empty {
          <div class="vacio"><p>Todavía no compraste entradas.</p><a routerLink="/cartelera" class="btn btn-primario">Ver cartelera</a></div>
        }
      </div>
    }
  `,
  styles: `
    .lista { display: flex; flex-direction: column; gap: 12px; }
    .compra { display: grid; grid-template-columns: 110px 1fr auto; gap: 18px; align-items: center; padding: 16px; background: var(--noche-2); border: 1px solid var(--linea); border-radius: var(--r-m); }
    .compra.cancelada, .compra.pasada { opacity: .6; }
    .fecha { display: flex; flex-direction: column; border-right: 2px dashed var(--linea); padding-right: 14px; }
    .dia { font-size: var(--t-xs); color: var(--humo); text-transform: capitalize; }
    .hora { font: 800 var(--t-2xl) / 1 var(--f-display); color: var(--laton); }
    h3 { margin: 0 0 4px; font-size: var(--t-l); }
    .info p { margin: 2px 0; max-width: none; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    code { font-family: ui-monospace, Menlo, monospace; }
    .acciones { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
    @media (max-width: 720px) { .compra { grid-template-columns: 1fr; } .fecha { border-right: 0; flex-direction: row; gap: 10px; align-items: baseline; } .acciones { justify-content: flex-start; } }
  `,
})
export class MisComprasComponent {
  private readonly auth = inject(AuthService);
  private readonly db = inject(DbService);
  private readonly reservas = inject(ReservasService);
  private readonly toast = inject(ToastService);
  readonly pdf = inject(EntradaPdfService);
  readonly horas = inject(ConfiguracionService).config.horasLimiteCancelacion;

  readonly filas$: Observable<FilaCompra[]> = usuarioLogueado$(this.auth).pipe(
    switchMap((u) => combineLatest([this.reservas.pedidosDe$(u.id), this.db.lista$('funciones'), this.db.lista$('peliculas'), this.db.lista$('salas')])),
    map(([pedidos, funciones, pelis, salas]) =>
      pedidos.map((pedido) => {
        const funcion = funciones.find((f) => f.id === pedido.funcionId);
        return {
          pedido,
          funcion,
          pelicula: funcion && pelis.find((p) => p.id === funcion.peliculaId),
          sala: funcion && salas.find((s) => s.id === funcion.salaId),
          cancelable: this.reservas.puedeCancelar(pedido, funcion),
          pasada: !!funcion && new Date(funcion.fin) < new Date(),
        };
      }),
    ),
  );

  resumenItems(p: Pedido) {
    return p.items.map((i) => `${i.cantidad}× ${i.nombre}`).join(', ');
  }

  cancelar(f: FilaCompra) {
    if (!confirm(`¿Cancelar la compra de "${f.pelicula?.titulo}"? El importe se acredita en tu cuenta y las butacas se liberan.`)) return;
    this.reservas.cancelar(f.pedido.id).subscribe({
      next: (credito) => this.toast.ok(`Compra cancelada. Sumaste ${credito.toLocaleString('es-AR')} pesos de crédito.`),
      error: (e: Error) => this.toast.error(e.message),
    });
  }

  dia(iso: string) {
    return new Date(iso).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  }

  hora(iso: string) {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }
}

// ─────────────────────────────── Mis películas ───────────────────────────────

interface Vista {
  pelicula: Pelicula;
  fecha: string;
  resena: Resena | undefined;
}

@Component({
  selector: 'app-mis-peliculas',
  imports: [AsyncPipe, RouterLink, FormsModule, EstrellasComponent, FechaARPipe, ImagenRespaldoDirective],
  template: `
    @if (vistas$ | async; as vistas) {
      <p class="suave chico">Todo lo que viste en Cine Lumbre (funciones ya pasadas y no canceladas). Calificá cada película: tu calificación también suma al promedio que ven los demás.</p>
      <div class="pared">
        @for (v of vistas; track v.pelicula.id) {
          <article class="recuerdo">
            <a [routerLink]="['/pelicula', v.pelicula.id]"><img [src]="v.pelicula.imagenUrl" [alt]="'Póster de ' + v.pelicula.titulo" appImagenRespaldo loading="lazy" /></a>
            <div class="datos">
              <h3>{{ v.pelicula.titulo }}</h3>
              <span class="suave chico">Vista el {{ v.fecha | fechaAR }}</span>
              <app-estrellas [valor]="v.resena?.estrellas ?? 0" [editable]="true" etiqueta="Tu calificación" (valorChange)="calificar(v, $event)" />
              @if (editando === v.pelicula.id) {
                <textarea [(ngModel)]="comentario" maxlength="280" rows="3" placeholder="Un comentario corto (opcional)"></textarea>
                <div class="fila">
                  <button type="button" class="btn btn-chico btn-primario" (click)="guardarComentario(v)">Guardar</button>
                  <button type="button" class="btn btn-chico" (click)="editando = null">Cancelar</button>
                </div>
              } @else {
                @if (v.resena?.comentario) { <p class="coment">"{{ v.resena?.comentario }}"</p> }
                <button type="button" class="btn-texto chico" (click)="editar(v)">{{ v.resena?.comentario ? 'Editar comentario' : 'Agregar comentario' }}</button>
              }
            </div>
          </article>
        } @empty {
          <div class="vacio"><p>Cuando veas tu primera película acá va a aparecer su póster.</p><a routerLink="/cartelera" class="btn btn-primario">Elegir una</a></div>
        }
      </div>
    }
  `,
  styles: `
    .pared { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 22px; }
    .vacio { grid-column: 1 / -1; }
    .recuerdo { background: var(--noche-2); border: 1px solid var(--linea); border-radius: var(--r-m); overflow: hidden; display: flex; flex-direction: column; }
    .recuerdo img { aspect-ratio: 2 / 3; object-fit: cover; width: 100%; }
    .datos { padding: 12px 14px 16px; display: flex; flex-direction: column; gap: 6px; }
    h3 { margin: 0; font-size: var(--t-l); line-height: 1.1; }
    .coment { margin: 0; font-size: var(--t-s); font-style: italic; color: var(--humo); }
    .fila { display: flex; gap: 6px; }
    .btn-texto { align-self: flex-start; }
  `,
})
export class MisPeliculasComponent {
  private readonly auth = inject(AuthService);
  private readonly db = inject(DbService);
  private readonly resenas = inject(ResenasService);
  private readonly toast = inject(ToastService);

  editando: string | null = null;
  comentario = '';

  readonly vistas$: Observable<Vista[]> = usuarioLogueado$(this.auth).pipe(
    switchMap((u) => combineLatest([this.db.lista$('pedidos'), this.db.lista$('funciones'), this.db.lista$('peliculas'), this.resenas.deUsuario$(u.id)]).pipe(
      map(([pedidos, funciones, pelis, resenas]) => {
        const ultimas = new Map<string, string>();
        const ahora = new Date().toISOString();
        for (const p of pedidos) {
          if (p.usuarioId !== u.id || p.estado !== 'pagada') continue;
          const f = funciones.find((x) => x.id === p.funcionId);
          if (!f || f.inicio > ahora) continue;
          const previa = ultimas.get(f.peliculaId);
          if (!previa || f.inicio > previa) ultimas.set(f.peliculaId, f.inicio);
        }
        return [...ultimas]
          .map(([id, fecha]) => ({ pelicula: pelis.find((x) => x.id === id)!, fecha: fecha.slice(0, 10), resena: resenas.find((r) => r.peliculaId === id) }))
          .filter((v) => !!v.pelicula)
          .sort((a, b) => b.fecha.localeCompare(a.fecha));
      }),
    )),
  );

  calificar(v: Vista, estrellas: number) {
    this.resenas.guardar(v.pelicula.id, estrellas, v.resena?.comentario ?? '').subscribe({
      next: () => this.toast.ok(`Calificaste "${v.pelicula.titulo}" con ${estrellas} ${estrellas === 1 ? 'estrella' : 'estrellas'}.`),
      error: (e: Error) => this.toast.error(e.message),
    });
  }

  editar(v: Vista) {
    this.editando = v.pelicula.id;
    this.comentario = v.resena?.comentario ?? '';
  }

  guardarComentario(v: Vista) {
    const estrellas = v.resena?.estrellas ?? 0;
    if (!estrellas) {
      this.toast.error('Primero elegí las estrellas.');
      return;
    }
    this.resenas.guardar(v.pelicula.id, estrellas, this.comentario).subscribe(() => {
      this.editando = null;
      this.toast.ok('Comentario guardado.');
    });
  }
}

// ─────────────────────────────── Puntos ───────────────────────────────

@Component({
  selector: 'app-puntos',
  imports: [AsyncPipe, RouterLink, FechaARPipe],
  template: `
    @if (vista$ | async; as v) {
      <section class="panel">
        <h2>Recompensas</h2>
        <p class="suave chico">Los puntos se canjean al comprar: elegí la recompensa en el último paso de la compra. Son personales y no se pueden transferir.</p>
        <div class="recompensas">
          @for (r of v.recompensas; track r.id) {
            <div class="recompensa" [class.alcanza]="v.u.puntos >= r.costoPuntos">
              <strong>{{ r.nombre }}</strong>
              <span class="costo">{{ r.costoPuntos.toLocaleString('es-AR') }} pts</span>
              @if (v.u.puntos >= r.costoPuntos) { <span class="etiqueta ok">Te alcanza</span> }
              @else { <span class="suave chico">Te faltan {{ (r.costoPuntos - v.u.puntos).toLocaleString('es-AR') }}</span> }
            </div>
          }
        </div>
        <a routerLink="/cartelera" class="btn btn-primario">Comprar y canjear</a>
      </section>
      <section class="panel">
        <h2>Historial de canjes</h2>
        <div class="tabla-scroll">
          <table class="tabla">
            <thead><tr><th>Fecha</th><th>Recompensa</th><th class="num">Puntos</th><th></th></tr></thead>
            <tbody>
              @for (c of v.canjes; track c.id) {
                <tr><td>{{ c.fecha.slice(0, 10) | fechaAR }}</td><td>{{ c.nombre }}</td><td class="num">−{{ c.puntos.toLocaleString('es-AR') }}</td><td><a [routerLink]="['/entrada', c.pedidoId]">Ver compra</a></td></tr>
              } @empty {
                <tr><td colspan="4" class="suave">Todavía no canjeaste puntos.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }
  `,
  styles: `
    :host { display: grid; gap: 20px; }
    h2 { margin: 0 0 8px; font-size: var(--t-xl); }
    .recompensas { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; margin: 16px 0 20px; }
    .recompensa { display: flex; flex-direction: column; gap: 4px; padding: 14px; border: 1px solid var(--linea); border-radius: var(--r-m); align-items: flex-start; }
    .recompensa.alcanza { border-color: var(--laton); }
    .costo { font: 800 var(--t-xl) / 1 var(--f-display); color: var(--laton); }
  `,
})
export class PuntosComponent {
  private readonly auth = inject(AuthService);
  private readonly fide = inject(FidelizacionService);

  readonly vista$: Observable<{ u: Usuario; recompensas: Recompensa[]; canjes: Canje[] }> = usuarioLogueado$(this.auth).pipe(
    switchMap((u) => combineLatest([this.fide.recompensasActivas$, this.fide.canjesDe$(u.id)]).pipe(map(([recompensas, canjes]) => ({ u, recompensas, canjes })))),
  );
}

export const CUENTA_ROUTES: Routes = [
  {
    path: '',
    component: CuentaLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'perfil' },
      { path: 'perfil', component: PerfilComponent, title: 'Mi perfil · Cine Lumbre' },
      { path: 'compras', component: MisComprasComponent, title: 'Mis compras · Cine Lumbre' },
      { path: 'mis-peliculas', component: MisPeliculasComponent, title: 'Mis películas · Cine Lumbre' },
      { path: 'puntos', component: PuntosComponent, title: 'Mis puntos · Cine Lumbre' },
    ],
  },
];
