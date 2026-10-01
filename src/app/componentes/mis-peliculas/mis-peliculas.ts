import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Pelicula, Resena } from '../../models/models';
import { Estrellas } from '../estrellas/estrellas';
import { ImagenRespaldoDirective } from '../../directivas/directivas';
import { FechaARPipe } from '../../pipes/pipes';
import { AuthService } from '../../services/auth-service';
import { ComprasService } from '../../services/compras-service';
import { ResenasService } from '../../services/resenas-service';
import { ToastService } from '../../services/toast-service';

/** Una película vista, con la última función a la que fue y su calificación. */
interface Vista {
  pelicula: Pelicula;
  fecha: string;
  resena: Resena | undefined;
}

@Component({
  selector: 'app-mis-peliculas',
  imports: [RouterLink, Estrellas, ImagenRespaldoDirective, FechaARPipe],
  templateUrl: './mis-peliculas.html',
  styleUrl: './mis-peliculas.scss',
})
export class MisPeliculas implements OnInit {
  private auth = inject(AuthService);
  private compras = inject(ComprasService);
  private resenas = inject(ResenasService);
  private toast = inject(ToastService);

  vistas = signal<Vista[]>([]);
  cargando = signal(true);

  ngOnInit() {
    this.cargar();
  }

  async cargar() {
    const u = this.auth.usuario();
    if (!u) return;
    this.cargando.set(true);
    try {
      const [pedidos, resenas] = await Promise.all([this.compras.pedidosDe(u.id), this.resenas.deUsuario(u.id)]);
      const ahora = new Date();

      // Una sola entrada por película: se queda con la función más reciente
      const porPelicula = new Map<number, Vista>();
      for (const p of pedidos) {
        const f = p.funciones;
        const vio = p.estado === 'pagada' && (new Date(f.inicio) <= ahora || !!p.entrada_validada_en);
        if (!vio) continue;
        const previa = porPelicula.get(f.pelicula_id);
        if (!previa || f.inicio > previa.fecha) {
          porPelicula.set(f.pelicula_id, {
            pelicula: f.peliculas,
            fecha: f.inicio,
            resena: resenas.find((r) => r.pelicula_id === f.pelicula_id),
          });
        }
      }
      const lista = [...porPelicula.values()].sort((a, b) => b.fecha.localeCompare(a.fecha));
      this.vistas.set(lista);
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }
}
