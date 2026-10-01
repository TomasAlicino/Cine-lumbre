import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PedidoCompleto } from '../../models/models';
import { DiaPipe, HoraPipe, PesosPipe } from '../../pipes/pipes';
import { AuthService } from '../../services/auth-service';
import { ComprasService } from '../../services/compras-service';
import { ConfiguracionService } from '../../services/configuracion-service';
import { EntradaPdfService } from '../../services/entrada-pdf-service';
import { ToastService } from '../../services/toast-service';

@Component({
  selector: 'app-mis-compras',
  imports: [RouterLink, PesosPipe, DiaPipe, HoraPipe],
  templateUrl: './mis-compras.html',
  styleUrl: './mis-compras.scss',
})
export class MisCompras implements OnInit {
  private auth = inject(AuthService);
  private compras = inject(ComprasService);
  private pdf = inject(EntradaPdfService);
  private toast = inject(ToastService);
  config = inject(ConfiguracionService);

  pedidos = signal<PedidoCompleto[]>([]);
  cargando = signal(true);

  ngOnInit() {
    this.cargar();
  }

  async cargar() {
    const u = this.auth.usuario();
    if (!u) return;
    this.cargando.set(true);
    try {
      this.pedidos.set(await this.compras.pedidosDe(u.id));
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }

  puedeCancelar(p: PedidoCompleto): boolean {
    return this.compras.puedeCancelar(p, this.config.config().horas_limite_cancelacion);
  }

  /** La función ya terminó. */
  pasada(p: PedidoCompleto): boolean {
    return new Date(p.funciones.fin) < new Date();
  }

  resumenItems(p: PedidoCompleto): string {
    return p.items.map((i) => `${i.cantidad}× ${i.nombre}`).join(', ');
  }

  async descargar(p: PedidoCompleto) {
    try {
      await this.pdf.descargar(p);
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }

  async cancelar(p: PedidoCompleto) {
    const mensaje =
      `¿Cancelar la compra de "${p.funciones.peliculas.titulo}"?\n\n` +
      'No se devuelve dinero: el importe queda como crédito en tu cuenta para usar en otra compra, ' +
      'y las butacas se liberan.';
    if (!confirm(mensaje)) return;
    try {
      const credito = await this.compras.cancelar(p, this.config.config().horas_limite_cancelacion);
      await this.cargar();
      this.toast.ok(`Compra cancelada. Sumaste $ ${credito.toLocaleString('es-AR')} de crédito.`);
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }
}
