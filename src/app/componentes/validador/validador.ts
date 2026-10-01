import { Component, OnDestroy, inject, signal } from '@angular/core';
import { Html5Qrcode } from 'html5-qrcode';
import { ItemPedido, PedidoCompleto } from '../../models/models';
import { ModoValidacion, ValidacionService } from '../../services/validacion-service';
import { tipoDeButaca } from '../../utils/sala-layout';

interface Resultado {
  ok: boolean;
  titulo: string;
  detalle: string;
  pedido: PedidoCompleto | null;
}

interface Registro {
  hora: string;
  codigo: string;
  titulo: string;
  ok: boolean;
}

/**
 * Pantalla para empleados: valida el QR con la cámara (librería html5-qrcode) o tipeando el código.
 * El mismo QR sirve una vez para la sala y otra vez para el candy bar.
 * No es standalone: está declarado en StaffModule.
 */
@Component({
  selector: 'app-validador',
  standalone: false,
  templateUrl: './validador.html',
  styleUrl: './validador.scss',
})
export class Validador implements OnDestroy {
  private validacion = inject(ValidacionService);

  modo = signal<ModoValidacion>('sala');
  codigo = signal('');
  validando = signal(false);
  resultado = signal<Resultado | null>(null);
  historial = signal<Registro[]>([]);
  camaraActiva = signal(false);
  errorCamara = signal('');

  private lector: Html5Qrcode | null = null;
  private ultimoLeido = { codigo: '', momento: 0 };

  cambiarModo(m: ModoValidacion) {
    this.modo.set(m);
    this.resultado.set(null);
  }

  /** Agrega los guiones mientras se escribe: LMBXXXXXXXX → LMB-XXXX-XXXX */
  formatear(valor: string): string {
    const limpio = valor.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
    return [limpio.slice(0, 3), limpio.slice(3, 7), limpio.slice(7, 11)].filter(Boolean).join('-');
  }

  async validar(texto: string) {
    const codigo = this.formatear(texto);
    if (!codigo || this.validando()) return;
    const modo = this.modo();
    this.validando.set(true);
    try {
      const pedido = await this.validacion.validar(codigo, modo);
      const personas = pedido.butacas.length;
      this.mostrar(
        {
          ok: true,
          titulo: modo === 'sala' ? 'Puede ingresar' : 'Entregar productos',
          detalle: modo === 'sala' ? `${personas} ${personas === 1 ? 'persona' : 'personas'}.` : 'El candy queda marcado como retirado.',
          pedido,
        },
        codigo,
      );
    } catch (e) {
      this.mostrar({ ok: false, titulo: 'No válido', detalle: (e as Error).message, pedido: null }, codigo);
    } finally {
      this.validando.set(false);
      this.codigo.set('');
    }
  }

  private mostrar(r: Resultado, codigo: string) {
    this.resultado.set(r);
    const registro: Registro = {
      hora: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
      codigo,
      titulo: `${this.modo() === 'sala' ? 'Sala' : 'Candy'}: ${r.titulo}`,
      ok: r.ok,
    };
    this.historial.update((lista) => [registro, ...lista].slice(0, 12));
  }

  async iniciarCamara() {
    this.errorCamara.set('');
    // Primero se muestra el recuadro: la librería necesita que el div exista y tenga tamaño
    this.camaraActiva.set(true);
    try {
      this.lector = new Html5Qrcode('lector-qr');
      await this.lector.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (texto) => this.alLeer(texto),
        () => undefined, // se llama en cada cuadro sin QR: se ignora
      );
    } catch (e) {
      console.warn(e);
      this.camaraActiva.set(false);
      this.lector = null;
      this.errorCamara.set('No pudimos usar la cámara (permiso denegado o sin cámara). Usá el código manual.');
    }
  }

  private alLeer(texto: string) {
    const ahora = Date.now();
    // Evita validar dos veces el mismo QR mientras sigue frente a la cámara
    if (texto === this.ultimoLeido.codigo && ahora - this.ultimoLeido.momento < 4000) return;
    this.ultimoLeido = { codigo: texto, momento: ahora };
    this.validar(texto);
  }

  async detenerCamara() {
    try {
      if (this.lector?.isScanning) await this.lector.stop();
      this.lector?.clear();
    } catch {
      // ya estaba detenida
    }
    this.lector = null;
    this.camaraActiva.set(false);
  }

  ngOnDestroy() {
    this.detenerCamara();
  }

  butacas(p: PedidoCompleto): string {
    return p.butacas
      .map((b) => (tipoDeButaca(b) === 'vip' ? `${b} (VIP)` : tipoDeButaca(b) === 'accesible' ? `${b} (accesible)` : b))
      .join(', ');
  }

  /** Lo que hay que entregar en el candy (la entrada canjeada con puntos no cuenta). */
  candy(p: PedidoCompleto): ItemPedido[] {
    return p.items.filter((i) => i.tipo !== 'canje-entrada');
  }

  textoCandy(p: PedidoCompleto): string {
    const items = this.candy(p);
    return items.length ? items.map((i) => `${i.cantidad}× ${i.nombre}`).join(', ') : 'Sin productos';
  }
}
