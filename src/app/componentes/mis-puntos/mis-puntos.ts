import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Canje, Recompensa } from '../../models/models';
import { FechaARPipe } from '../../pipes/pipes';
import { AuthService } from '../../services/auth-service';
import { FidelizacionService } from '../../services/fidelizacion-service';
import { ToastService } from '../../services/toast-service';

@Component({
  selector: 'app-mis-puntos',
  imports: [RouterLink, FechaARPipe],
  templateUrl: './mis-puntos.html',
  styleUrl: './mis-puntos.scss',
})
export class MisPuntos implements OnInit {
  private fidelizacion = inject(FidelizacionService);
  private toast = inject(ToastService);
  auth = inject(AuthService);

  recompensas = signal<Recompensa[]>([]);
  canjes = signal<Canje[]>([]);
  cargando = signal(true);

  ngOnInit() {
    this.cargar();
  }

  async cargar() {
    const u = this.auth.usuario();
    if (!u) return;
    this.cargando.set(true);
    try {
      const [recompensas, canjes] = await Promise.all([this.fidelizacion.recompensas(true), this.fidelizacion.canjesDe(u.id)]);
      this.recompensas.set(recompensas);
      this.canjes.set(canjes);
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }

  puntos(): number {
    return this.auth.usuario()?.puntos ?? 0;
  }
}
