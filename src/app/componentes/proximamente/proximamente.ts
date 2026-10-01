import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PeliculaCard } from '../pelicula-card/pelicula-card';
import { Pelicula } from '../../models/models';
import { AuthService } from '../../services/auth-service';
import { NotificacionesService } from '../../services/notificaciones-service';
import { PeliculasService } from '../../services/peliculas-service';
import { ToastService } from '../../services/toast-service';
import { estadoVenta } from '../../utils/negocio';

@Component({
  selector: 'app-proximamente',
  imports: [PeliculaCard],
  templateUrl: './proximamente.html',
  styleUrl: './proximamente.scss',
})
export class Proximamente implements OnInit {
  private peliculas = inject(PeliculasService);
  notificaciones = inject(NotificacionesService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);

  cargando = signal(true);
  proximas = signal<Pelicula[]>([]);

  async ngOnInit() {
    try {
      const lista = await this.peliculas.listar();
      this.proximas.set(this.peliculas.proximamente(lista));
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }

  enPreventa(p: Pelicula): boolean {
    return estadoVenta(p).preventa;
  }

  async alternar(id: number) {
    if (!this.auth.usuario()) {
      this.toast.info('Ingresá a tu cuenta para activar alertas.');
      this.router.navigate(['/ingresar'], { queryParams: { volver: '/proximamente' } });
      return;
    }
    try {
      const activa = await this.notificaciones.alternarAlerta(id);
      this.toast.ok(activa ? 'Alerta activada. Te avisamos cuando salgan las entradas.' : 'Alerta desactivada.');
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }
}
