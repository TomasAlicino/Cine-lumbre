import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { PeliculasService } from '../../core/services/peliculas.service';
import { ResenasService } from '../../core/services/resenas.service';
import { PeliculaCardComponent } from '../../shared/components/pelicula-card.component';
import { DuracionPipe, FechaARPipe } from '../../shared/pipes/pipes';
import { ImagenRespaldoDirective } from '../../shared/directives/directivas';
import { estadoVenta } from '../../core/utils/negocio';

@Component({
  selector: 'app-inicio',
  imports: [AsyncPipe, RouterLink, PeliculaCardComponent, DuracionPipe, FechaARPipe, ImagenRespaldoDirective],
  template: `
    @if (vm$ | async; as vm) {
      <section class="marquesina">
        <div class="contenedor">
          <div class="titular">
            <h1>Lo más visto en Lumbre</h1>
            <p>Las tres películas que más entradas vendieron. Elegí función y butaca en menos de un minuto.</p>
          </div>
          <ol class="podio">
            @for (p of vm.top; track p.id; let i = $index) {
              <li class="puesto" [class.primero]="i === 0">
                <a [routerLink]="['/pelicula', p.id]" class="afiche">
                  <img [src]="p.imagenUrl" [alt]="'Póster de ' + p.titulo" appImagenRespaldo />
                  <span class="numeral" aria-hidden="true">{{ i + 1 }}</span>
                </a>
                <div class="datos">
                  <h2><a [routerLink]="['/pelicula', p.id]">{{ p.titulo }}</a></h2>
                  <p class="suave chico">
                    {{ p.duracionMin | duracion }} · {{ p.clasificacion }}
                    @if (vm.promedios.get(p.id); as pr) { · ★ {{ pr.promedio.toFixed(1) }} }
                  </p>
                  <a class="btn btn-primario btn-chico" [routerLink]="['/pelicula', p.id]" fragment="funciones">Ver funciones</a>
                </div>
              </li>
            }
          </ol>
        </div>
      </section>

      <section class="contenedor seccion">
        <div class="cabecera-pagina">
          <div>
            <h2>En cartelera</h2>
            <p>Seleccionadas por el cine para esta semana.</p>
          </div>
          <a routerLink="/cartelera" class="btn">Ver toda la cartelera</a>
        </div>
        <div class="grilla">
          @for (p of vm.destacadas; track p.id) {
            <app-pelicula-card [pelicula]="p" [promedio]="vm.promedios.get(p.id)" [preventa]="enPreventa(p)" />
          } @empty {
            <div class="vacio"><p>Todavía no hay películas destacadas.</p></div>
          }
        </div>
      </section>

      @if (vm.proximas.length) {
        <section class="contenedor seccion">
          <div class="cabecera-pagina">
            <div>
              <h2>Próximamente</h2>
              <p>Activá una alerta y te avisamos cuando salgan las entradas.</p>
            </div>
            <a routerLink="/proximamente" class="btn">Ver estrenos</a>
          </div>
          <ul class="proximas">
            @for (p of vm.proximas; track p.id) {
              <li>
                <a [routerLink]="['/pelicula', p.id]">
                  <strong>{{ p.titulo }}</strong>
                  <span class="suave chico">Estrena el {{ p.fechaEstreno | fechaAR }}</span>
                  @if (p.preventa.habilitada) { <span class="etiqueta laton">Con preventa</span> }
                </a>
              </li>
            }
          </ul>
        </section>
      }
    }
  `,
  styles: `
    .marquesina { padding: 40px 0 56px; border-bottom: 1px solid var(--linea); background: linear-gradient(180deg, var(--noche-2), var(--noche) 85%); }
    .titular { max-width: 640px; margin-bottom: 36px; }
    .titular h1 { font-size: clamp(2.6rem, 7vw, var(--t-4xl)); color: var(--laton); margin-bottom: 12px; }
    .titular p { color: var(--humo); font-size: var(--t-l); line-height: 1.4; }
    .podio { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1.25fr 1fr 1fr; gap: clamp(16px, 3vw, 36px); align-items: end; }
    .puesto { display: flex; flex-direction: column; gap: 16px; }
    .afiche { position: relative; display: block; aspect-ratio: 2 / 3; border-radius: var(--r-s); overflow: visible; }
    .afiche img { width: 100%; height: 100%; object-fit: cover; border-radius: var(--r-s); box-shadow: 0 24px 50px rgba(0,0,0,.45); }
    .numeral { position: absolute; left: -10px; bottom: -28px; font: 900 clamp(5rem, 11vw, 9rem) / .8 var(--f-display); color: var(--noche); -webkit-text-stroke: 3px var(--laton); paint-order: stroke fill; pointer-events: none; }
    .datos { padding-left: clamp(44px, 6vw, 72px); }
    .datos h2 { font-size: var(--t-xl); margin-bottom: 4px; }
    .datos h2 a { color: var(--pantalla); text-decoration: none; }
    .datos p { margin-bottom: 12px; }
    .seccion { padding-block: 48px 8px; }
    .grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 32px 20px; }
    .proximas { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0 24px; }
    .proximas a { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; padding: 14px 0; border-bottom: 1px solid var(--linea); color: var(--pantalla); text-decoration: none; }
    .proximas a:hover strong { color: var(--laton); }
    .proximas strong { font: 700 var(--t-l) / 1.1 var(--f-display); width: 100%; }
    @media (max-width: 720px) {
      .podio { grid-template-columns: 1fr 1fr; }
      .puesto.primero { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr; align-items: end; }
      .puesto.primero .datos { padding-left: 0; }
      .datos { padding-left: 44px; }
    }
  `,
})
export class InicioComponent {
  private readonly peliculas = inject(PeliculasService);
  private readonly resenas = inject(ResenasService);

  readonly vm$ = combineLatest([this.peliculas.top3$, this.peliculas.enVenta$, this.peliculas.proximamente$, this.resenas.promedios$]).pipe(
    map(([top, enVenta, proximas, promedios]) => ({
      top,
      destacadas: enVenta.filter((p) => p.destacada && !top.some((t) => t.id === p.id)),
      proximas: proximas.slice(0, 4),
      promedios,
    })),
  );

  enPreventa(p: Parameters<typeof estadoVenta>[0]) {
    return estadoVenta(p).preventa;
  }
}
