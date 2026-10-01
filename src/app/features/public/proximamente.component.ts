import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { PeliculasService } from '../../core/services/peliculas.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { PeliculaCardComponent } from '../../shared/components/pelicula-card.component';
import { Pelicula } from '../../core/models/models';
import { estadoVenta } from '../../core/utils/negocio';

@Component({
  selector: 'app-proximamente',
  imports: [AsyncPipe, PeliculaCardComponent],
  template: `
    <div class="contenedor pagina">
      <div class="cabecera-pagina">
        <div>
          <h1>Próximamente</h1>
          <p>Estrenos de las próximas semanas. Activá una alerta y te avisamos cuando se puedan comprar entradas.</p>
        </div>
      </div>
      @let alertas = notificaciones.misAlertas$ | async;
      <div class="grilla">
        @for (p of peliculas.proximamente$ | async; track p.id) {
          <app-pelicula-card [pelicula]="p" modo="proximamente" [mostrarAlerta]="true" [preventa]="enPreventa(p)"
            [alertaActiva]="!!alertas?.has(p.id)" (alternarAlerta)="alternar($event)" />
        } @empty {
          <div class="vacio"><p>No hay estrenos anunciados por ahora.</p></div>
        }
      </div>
    </div>
  `,
  styles: `.grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 32px 20px; } .vacio { grid-column: 1 / -1; }`,
})
export class ProximamenteComponent {
  readonly peliculas = inject(PeliculasService);
  readonly notificaciones = inject(NotificacionesService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  enPreventa(p: Pelicula) {
    return estadoVenta(p).preventa;
  }

  alternar(id: string) {
    if (!this.auth.usuario) {
      this.toast.info('Ingresá a tu cuenta para activar alertas.');
      this.router.navigate(['/ingresar'], { queryParams: { volver: '/proximamente' } });
      return;
    }
    this.notificaciones.alternarAlerta(id).subscribe((activa) =>
      this.toast.ok(activa ? 'Alerta activada. Te avisamos cuando salgan las entradas.' : 'Alerta desactivada.'),
    );
  }
}
