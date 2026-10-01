import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Toasts } from './componentes/toasts/toasts';
import { SiRolDirective } from './directivas/directivas';
import { FechaARPipe } from './pipes/pipes';
import { AuthService } from './services/auth-service';
import { ConfiguracionService } from './services/configuracion-service';
import { NotificacionesService } from './services/notificaciones-service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Toasts, SiRolDirective, FechaARPipe],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  auth = inject(AuthService);
  notificaciones = inject(NotificacionesService);
  private config = inject(ConfiguracionService);
  private router = inject(Router);

  menuAbierto = signal(false);
  panelAvisos = signal(false);

  async ngOnInit() {
    try {
      await this.config.cargar();
      await this.auth.esperarSesion();
      await this.notificaciones.cargar();
    } catch (e) {
      // Sin conexión la app igual abre (PWA); cada pantalla avisa si no puede cargar sus datos
      console.error('No se pudieron cargar los datos iniciales', e);
    }
  }

  @HostListener('document:keydown.escape')
  cerrarTodo() {
    this.menuAbierto.set(false);
    this.panelAvisos.set(false);
  }

  alternarAvisos() {
    this.panelAvisos.update((v) => !v);
    if (this.panelAvisos()) setTimeout(() => this.notificaciones.marcarTodasLeidas(), 1500);
  }

  async salir() {
    await this.auth.logout();
    await this.notificaciones.cargar();
    this.cerrarTodo();
    this.router.navigateByUrl('/');
  }
}
