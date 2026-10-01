import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PeliculaCard } from '../pelicula-card/pelicula-card';
import { GENEROS, Pelicula } from '../../models/models';
import { BuscarPeliculasPipe } from '../../pipes/pipes';
import { PeliculasService } from '../../services/peliculas-service';
import { Promedio, ResenasService } from '../../services/resenas-service';
import { ToastService } from '../../services/toast-service';
import { estadoVenta } from '../../utils/negocio';

@Component({
  selector: 'app-cartelera',
  imports: [FormsModule, PeliculaCard, BuscarPeliculasPipe],
  templateUrl: './cartelera.html',
  styleUrl: './cartelera.scss',
})
export class Cartelera implements OnInit {
  private peliculas = inject(PeliculasService);
  private resenas = inject(ResenasService);
  private toast = inject(ToastService);

  readonly generos = GENEROS;
  cargando = signal(true);
  enVenta = signal<Pelicula[]>([]);
  promedios = signal(new Map<number, Promedio>());

  // Filtros
  texto = signal('');
  elegidos = signal<string[]>([]);

  async ngOnInit() {
    try {
      const lista = await this.peliculas.listar();
      this.enVenta.set(this.peliculas.enVenta(lista));
      this.promedios.set(await this.resenas.promedios());
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }

  alternar(g: string) {
    this.elegidos.update((l) => (l.includes(g) ? l.filter((x) => x !== g) : [...l, g]));
  }

  limpiar() {
    this.texto.set('');
    this.elegidos.set([]);
  }

  enPreventa(p: Pelicula): boolean {
    return estadoVenta(p).preventa;
  }
}
