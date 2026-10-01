import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PeliculasService } from '../../core/services/peliculas.service';
import { ResenasService } from '../../core/services/resenas.service';
import { GENEROS, Pelicula } from '../../core/models/models';
import { PeliculaCardComponent } from '../../shared/components/pelicula-card.component';
import { BuscarPeliculasPipe } from '../../shared/pipes/pipes';
import { estadoVenta } from '../../core/utils/negocio';

@Component({
  selector: 'app-cartelera',
  imports: [AsyncPipe, FormsModule, PeliculaCardComponent, BuscarPeliculasPipe],
  template: `
    <div class="contenedor pagina">
      <div class="cabecera-pagina">
        <div>
          <h1>Cartelera</h1>
          <p>Todas las películas con entradas a la venta.</p>
        </div>
      </div>

      <div class="filtros">
        <div class="campo buscador">
          <label for="buscar">Buscar por título</label>
          <input id="buscar" type="search" [(ngModel)]="texto" placeholder="Ej: marea, faro, robot…" autocomplete="off" />
        </div>
        <div class="campo">
          <span class="etiqueta-campo" id="lbl-generos">Géneros</span>
          <div class="chips" role="group" aria-labelledby="lbl-generos">
            @for (g of generos; track g) {
              <button type="button" class="chip" [class.activo]="elegidos.includes(g)" [attr.aria-pressed]="elegidos.includes(g)" (click)="alternar(g)">{{ g }}</button>
            }
            @if (elegidos.length || texto) {
              <button type="button" class="btn-texto chico" (click)="limpiar()">Limpiar filtros</button>
            }
          </div>
        </div>
      </div>

      @let lista = (peliculas.enVenta$ | async | buscarPeliculas: texto : elegidos);
      <p class="suave chico" aria-live="polite">{{ lista.length }} {{ lista.length === 1 ? 'película' : 'películas' }}</p>
      <div class="grilla">
        @for (p of lista; track p.id) {
          <app-pelicula-card [pelicula]="p" [promedio]="(resenas.promedios$ | async)?.get(p.id)" [preventa]="enPreventa(p)" />
        } @empty {
          <div class="vacio">
            <p>No hay películas que coincidan con esa búsqueda.</p>
            <button type="button" class="btn" (click)="limpiar()">Limpiar filtros</button>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .filtros { display: grid; gap: 20px; padding: 20px; margin-bottom: 20px; background: var(--noche-2); border: 1px solid var(--linea); border-radius: var(--r-m); }
    .buscador { max-width: 480px; }
    .grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 32px 20px; margin-top: 12px; }
    .vacio { grid-column: 1 / -1; }
  `,
})
export class CarteleraComponent {
  readonly peliculas = inject(PeliculasService);
  readonly resenas = inject(ResenasService);
  readonly generos = GENEROS;
  texto = '';
  elegidos: string[] = [];

  alternar(g: string) {
    this.elegidos = this.elegidos.includes(g) ? this.elegidos.filter((x) => x !== g) : [...this.elegidos, g];
  }

  limpiar() {
    this.texto = '';
    this.elegidos = [];
  }

  enPreventa(p: Pelicula) {
    return estadoVenta(p).preventa;
  }
}
