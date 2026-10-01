import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FechaARPipe, PesosPipe } from '../../pipes/pipes';
import { AuthService } from '../../services/auth-service';
import { ComprasService } from '../../services/compras-service';
import { ConfiguracionService } from '../../services/configuracion-service';
import { NotificacionesService } from '../../services/notificaciones-service';
import { ToastService } from '../../services/toast-service';

/** Datos del registro, crédito, puntos y notificaciones del usuario. */
@Component({
  selector: 'app-mi-perfil',
  imports: [RouterLink, FechaARPipe, PesosPipe],
  templateUrl: './mi-perfil.html',
  styleUrl: './mi-perfil.scss',
})
export class MiPerfil implements OnInit {
  private compras = inject(ComprasService);
  private toast = inject(ToastService);
  auth = inject(AuthService);
  config = inject(ConfiguracionService);
  notis = inject(NotificacionesService);

  bienvenida = signal(false);

  async ngOnInit() {
    const u = this.auth.usuario();
    if (!u) return;
    try {
      this.bienvenida.set(await this.compras.esPrimeraCompra(u.id));
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }

  async marcarLeidas() {
    try {
      await this.notis.marcarTodasLeidas();
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }
}
