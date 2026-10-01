import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Pelicula } from '../../core/models/models';
import { Promedio } from '../../core/services/resenas.service';
import { DuracionPipe, FechaARPipe } from '../pipes/pipes';
import { ImagenRespaldoDirective } from '../directives/directivas';

@Component({
  selector: 'app-pelicula-card',
  imports: [RouterLink, DuracionPipe, FechaARPipe, ImagenRespaldoDirective],
  template: `
    <article class="card">
      <a [routerLink]="['/pelicula', pelicula.id]" class="poster" [attr.aria-label]="'Ver ' + pelicula.titulo">
        <img [src]="pelicula.imagenUrl" [alt]="'Póster de ' + pelicula.titulo" loading="lazy" appImagenRespaldo />
        <span class="clasif" [class.adulto]="pelicula.clasificacion !== 'ATP'">{{ pelicula.clasificacion }}</span>
        @if (preventa) {
          <span class="preventa">Preventa</span>
        }
      </a>
      <div class="info">
        <h3><a [routerLink]="['/pelicula', pelicula.id]">{{ pelicula.titulo }}</a></h3>
        <p class="meta">
          @if (modo === 'proximamente') {
            Estrena el {{ pelicula.fechaEstreno | fechaAR }}
          } @else {
            {{ pelicula.duracionMin | duracion }}
            @if (promedio) {
              <span class="nota" [attr.aria-label]="'Puntaje ' + promedio.promedio.toFixed(1) + ' de 5'">★ {{ promedio.promedio.toFixed(1) }}</span>
            }
          }
        </p>
        <p class="generos">{{ pelicula.generos.join(', ') }}</p>
        @if (modo === 'proximamente' && mostrarAlerta) {
          <button type="button" class="btn btn-chico" [class.btn-primario]="alertaActiva" (click)="alternarAlerta.emit(pelicula.id)">
            {{ alertaActiva ? 'Te avisamos cuando salga' : 'Avisarme cuando salga a la venta' }}
          </button>
        }
      </div>
    </article>
  `,
  styles: `
    .card { display: flex; flex-direction: column; gap: 12px; }
    .poster { position: relative; display: block; aspect-ratio: 2 / 3; border-radius: var(--r-s); overflow: hidden; background: var(--noche-3); }
    .poster img { width: 100%; height: 100%; object-fit: cover; }
    .poster:focus-visible { outline-offset: 3px; }
    .clasif, .preventa { position: absolute; top: 8px; padding: 2px 7px; font: 700 var(--t-xs) / 1.4 var(--f-texto); border-radius: var(--r-s); }
    .clasif { left: 8px; background: var(--pantalla); color: var(--noche); }
    .clasif.adulto { background: var(--terciopelo); color: #fff; }
    .preventa { right: 8px; background: var(--laton); color: var(--noche); }
    h3 { font-size: var(--t-l); margin: 0 0 4px; }
    h3 a { color: var(--pantalla); text-decoration: none; }
    h3 a:hover { color: var(--laton); }
    .meta { margin: 0; font-size: var(--t-s); color: var(--humo); display: flex; gap: 10px; }
    .nota { color: var(--laton); font-weight: 600; }
    .generos { margin: 2px 0 10px; font-size: var(--t-xs); color: var(--humo); }
  `,
})
export class PeliculaCardComponent {
  @Input({ required: true }) pelicula!: Pelicula;
  @Input() promedio?: Promedio;
  @Input() modo: 'cartelera' | 'proximamente' = 'cartelera';
  @Input() preventa = false;
  @Input() mostrarAlerta = false;
  @Input() alertaActiva = false;
  @Output() alternarAlerta = new EventEmitter<string>();
}
