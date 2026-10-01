import { Component, HostListener, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './core/services/auth.service';
import { NotificacionesService } from './core/services/notificaciones.service';
import { ToastsComponent } from './shared/components/toasts.component';
import { SiRolDirective } from './shared/directives/directivas';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AsyncPipe, ToastsComponent, SiRolDirective],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly auth = inject(AuthService);
  readonly notificaciones = inject(NotificacionesService);
  private readonly router = inject(Router);
  menuAbierto = false;
  panelAvisos = false;

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.menuAbierto = false;
      this.panelAvisos = false;
    });
  }

  @HostListener('document:keydown.escape')
  cerrarTodo() {
    this.menuAbierto = false;
    this.panelAvisos = false;
  }

  abrirAvisos() {
    this.panelAvisos = !this.panelAvisos;
    if (this.panelAvisos) setTimeout(() => this.notificaciones.marcarTodasLeidas(), 1500);
  }

  salir() {
    this.auth.logout();
    this.router.navigateByUrl('/');
  }
}
