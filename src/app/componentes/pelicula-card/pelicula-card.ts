import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ImagenRespaldoDirective } from '../../directivas/directivas';
import { Pelicula } from '../../models/models';
import { DuracionPipe, FechaARPipe } from '../../pipes/pipes';
import { Promedio } from '../../services/resenas-service';

/** Tarjeta de película para la cartelera y Próximamente. */
@Component({
  selector: 'app-pelicula-card',
  imports: [RouterLink, DuracionPipe, FechaARPipe, ImagenRespaldoDirective],
  templateUrl: './pelicula-card.html',
  styleUrl: './pelicula-card.scss',
})
export class PeliculaCard {
  pelicula = input.required<Pelicula>();
  promedio = input<Promedio | undefined>(undefined);
  modo = input<'cartelera' | 'proximamente'>('cartelera');
  preventa = input(false);
  mostrarAlerta = input(false);
  alertaActiva = input(false);
  alternarAlerta = output<number>();
}
