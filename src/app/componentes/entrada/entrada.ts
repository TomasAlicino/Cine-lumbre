import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { PedidoCompleto } from '../../models/models';
import { AuthService } from '../../services/auth-service';
import { ComprasService } from '../../services/compras-service';
import { EntradaPdfService } from '../../services/entrada-pdf-service';
import { ToastService } from '../../services/toast-service';
import { tipoDeButaca } from '../../utils/sala-layout';
import { DiaPipe, HoraPipe, PesosPipe } from '../../pipes/pipes';

/** Entrada digital: datos de la función, QR y descarga en PDF. */
@Component({
  selector: 'app-entrada',
  imports: [RouterLink, PesosPipe, DiaPipe, HoraPipe],
  templateUrl: './entrada.html',
  styleUrl: './entrada.scss',
})
export class Entrada implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private compras = inject(ComprasService);
  private pdf = inject(EntradaPdfService);
  private toast = inject(ToastService);
  private sub?: Subscription;

  cargando = signal(true);
  pedido = signal<PedidoCompleto | null>(null);
  qr = signal('');
  descargando = signal(false);

  /** Lo que se retira en el candy (la entrada canjeada con puntos no es un producto). */
  candy = computed(() => (this.pedido()?.items ?? []).filter((i) => i.tipo !== 'canje-entrada'));

  cancelada = computed(() => this.pedido()?.estado === 'cancelada');

  ngOnInit() {
    this.sub = this.route.paramMap.subscribe((params) => {
      this.cargar(params.get('codigo') ?? '');
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  async cargar(codigo: string) {
    this.cargando.set(true);
    try {
      // porCodigo distingue compras anónimas según haya sesión: se espera a que se lea
      await this.auth.esperarSesion();
      const pedido = await this.compras.porCodigo(codigo);
      this.pedido.set(pedido);
      if (pedido) this.qr.set(await this.pdf.qrDataUrl(pedido.codigo));
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }

  tipo(butaca: string) {
    return tipoDeButaca(butaca);
  }

  async descargar() {
    const p = this.pedido();
    if (!p) return;
    this.descargando.set(true);
    try {
      await this.pdf.descargar(p);
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.descargando.set(false);
    }
  }
}
