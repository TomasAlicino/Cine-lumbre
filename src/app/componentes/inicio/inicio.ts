import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PeliculaCard } from '../pelicula-card/pelicula-card';
import { ImagenRespaldoDirective } from '../../directivas/directivas';
import { Pelicula } from '../../models/models';
import { DuracionPipe, FechaARPipe } from '../../pipes/pipes';
import { PeliculasService } from '../../services/peliculas-service';
import { Promedio, ResenasService } from '../../services/resenas-service';
import { ToastService } from '../../services/toast-service';
import { estadoVenta } from '../../utils/negocio';

@Component({
  selector: 'app-inicio',
  imports: [RouterLink, PeliculaCard, DuracionPipe, FechaARPipe, ImagenRespaldoDirective],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
})
export class Inicio implements OnInit {
  private peliculas = inject(PeliculasService);
  private resenas = inject(ResenasService);
  private toast = inject(ToastService);

  cargando = signal(true);
  top = signal<Pelicula[]>([]);
  destacadas = signal<Pelicula[]>([]);
  proximas = signal<Pelicula[]>([]);
  promedios = signal(new Map<number, Promedio>());

  async ngOnInit() {
    try {
      // Se traen las películas una sola vez y de esa lista salen todas las secciones
      const lista = await this.peliculas.listar();
      const top = await this.peliculas.top3(lista);
      this.top.set(top);
      this.destacadas.set(this.peliculas.enVenta(lista).filter((p) => p.destacada && !top.some((t) => t.id === p.id)));
      this.proximas.set(this.peliculas.proximamente(lista).slice(0, 4));
      this.promedios.set(await this.resenas.promedios());
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }

  enPreventa(p: Pelicula): boolean {
    return estadoVenta(p).preventa;
  }
}
