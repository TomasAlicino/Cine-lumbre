import { Component, NgZone, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Funcion, Pedido, Pelicula } from '../../core/models/models';
import { DbService } from '../../core/services/db.service';
import { ReservasService } from '../../core/services/reservas.service';
import { tipoDeButaca } from '../../core/utils/sala-layout';
import { AutofocoDirective } from '../../shared/directives/directivas';

type Modo = 'sala' | 'candy';

interface Resultado {
  ok: boolean;
  titulo: string;
  detalle: string;
  pedido?: Pedido;
  funcion?: Funcion;
  pelicula?: Pelicula;
}

/**
 * Pantalla para empleados: valida el QR con la cámara (html5-qrcode) o tipeando el código.
 * El mismo QR sirve una vez para la sala y otra vez para el candy bar.
 */
@Component({
  selector: 'app-validador',
  imports: [FormsModule, AutofocoDirective],
  template: `
    <div class="contenedor pagina">
      <header class="cabecera-pagina">
        <div>
          <h1>Validar entradas</h1>
          <p>Elegí dónde estás, escaneá el QR o escribí el código. Cada QR se usa una sola vez en la sala y una sola vez en el candy.</p>
        </div>
      </header>

      <div class="modos" role="radiogroup" aria-label="Puesto de validación">
        <button type="button" role="radio" [attr.aria-checked]="modo === 'sala'" [class.activo]="modo === 'sala'" (click)="cambiarModo('sala')">
          <strong>Puerta de sala</strong><span>Ingreso a la función</span>
        </button>
        <button type="button" role="radio" [attr.aria-checked]="modo === 'candy'" [class.activo]="modo === 'candy'" (click)="cambiarModo('candy')">
          <strong>Candy bar</strong><span>Entrega de productos</span>
        </button>
      </div>

      <div class="grilla">
        <section class="panel">
          <h2>Cámara</h2>
          <div id="lector-qr" class="lector" [class.activo]="camaraActiva"></div>
          @if (errorCamara) { <p class="aviso error">{{ errorCamara }}</p> }
          @if (camaraActiva) {
            <button type="button" class="btn btn-bloque" (click)="detenerCamara()">Apagar cámara</button>
          } @else {
            <button type="button" class="btn btn-primario btn-bloque" (click)="iniciarCamara()">Encender cámara</button>
          }
        </section>

        <section class="panel">
          <h2>Código manual</h2>
          <form (ngSubmit)="validar(codigo)">
            <label class="solo-lector" for="codigo">Código de la entrada</label>
            <input id="codigo" name="codigo" [(ngModel)]="codigo" (ngModelChange)="codigo = formatear($event)" placeholder="LMB-XXXX-XXXX" autocomplete="off" spellcheck="false" appAutofoco class="codigo" />
            <button class="btn btn-primario btn-bloque" type="submit" [disabled]="codigo.length < 6">Validar</button>
          </form>

          @if (resultado; as r) {
            <div class="resultado" [class.ok]="r.ok" role="status" aria-live="assertive">
              <span class="icono" aria-hidden="true">{{ r.ok ? '✓' : '✕' }}</span>
              <div>
                <strong>{{ r.titulo }}</strong>
                <p>{{ r.detalle }}</p>
                @if (r.pedido && r.funcion && r.pelicula) {
                  <dl>
                    <div><dt>Película</dt><dd>{{ r.pelicula.titulo }} ({{ r.pelicula.clasificacion }})</dd></div>
                    <div><dt>Función</dt><dd>{{ hora(r.funcion.inicio) }} · {{ nombreSala(r.funcion.salaId) }}</dd></div>
                    @if (modo === 'sala') {
                      <div><dt>Butacas</dt><dd>{{ butacas(r.pedido) }}</dd></div>
                    } @else {
                      <div><dt>Entregar</dt><dd>{{ items(r.pedido) }}</dd></div>
                    }
                    <div><dt>Titular</dt><dd>{{ r.pedido.comprador.nombre }}</dd></div>
                  </dl>
                  @if (r.pedido.requiereAdulto && modo === 'sala') { <p class="adulto">Película {{ r.pelicula.clasificacion }}: controlar que asista un adulto.</p> }
                }
              </div>
            </div>
          }
        </section>
      </div>

      @if (historial.length) {
        <section class="historial">
          <h2>Últimas validaciones de este turno</h2>
          <ul>
            @for (h of historial; track $index) {
              <li [class.ok]="h.ok"><span>{{ h.hora }}</span> {{ h.codigo }} — {{ h.titulo }}</li>
            }
          </ul>
        </section>
      }
    </div>
  `,
  styles: `
    .modos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .modos button { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 16px 20px; border: 2px solid var(--linea); border-radius: var(--r-m); background: var(--noche-2); color: var(--pantalla); cursor: pointer; text-align: left; font: inherit; }
    .modos button strong { font: 800 var(--t-xl) / 1.1 var(--f-display); text-transform: uppercase; letter-spacing: .02em; }
    .modos button span { color: var(--humo); font-size: var(--t-s); }
    .modos button.activo { border-color: var(--laton); background: var(--noche-3); }
    .modos button.activo strong { color: var(--laton); }
    .grilla { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
    h2 { margin: 0 0 14px; font-size: var(--t-xl); }
    .lector { min-height: 60px; border-radius: var(--r-s); overflow: hidden; margin-bottom: 12px; background: var(--noche); }
    .lector.activo { min-height: 260px; }
    form { display: flex; flex-direction: column; gap: 10px; }
    .codigo { font: 700 var(--t-xl) / 1 ui-monospace, Menlo, monospace !important; letter-spacing: .08em; text-transform: uppercase; text-align: center; }
    .resultado { display: flex; gap: 14px; margin-top: 18px; padding: 16px; border-radius: var(--r-m); background: rgba(179, 48, 63, .18); border: 2px solid var(--terciopelo); }
    .resultado.ok { background: rgba(95, 191, 143, .14); border-color: var(--ok); }
    .icono { flex: none; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: var(--terciopelo); color: #fff; font-size: 24px; font-weight: 800; }
    .resultado.ok .icono { background: var(--ok); color: var(--noche); }
    .resultado strong { font: 800 var(--t-xl) / 1.1 var(--f-display); }
    .resultado p { margin: 4px 0 10px; }
    dl { display: grid; gap: 6px; margin: 0; }
    dl div { display: flex; gap: 10px; }
    dt { color: var(--humo); min-width: 70px; font-size: var(--t-s); }
    dd { margin: 0; font-weight: 600; }
    .adulto { margin-top: 10px !important; padding: 8px 12px; background: var(--terciopelo); color: #fff; font-weight: 700; border-radius: var(--r-s); }
    .historial { margin-top: 28px; }
    .historial ul { list-style: none; padding: 0; margin: 0; font-size: var(--t-s); }
    .historial li { padding: 8px 0; border-bottom: 1px solid var(--linea); color: var(--terciopelo-claro); }
    .historial li.ok { color: var(--ok); }
    .historial li span { color: var(--humo); margin-right: 8px; font-variant-numeric: tabular-nums; }
    @media (max-width: 560px) { .modos { grid-template-columns: 1fr; } }
  `,
})
export class ValidadorComponent implements OnDestroy {
  private readonly reservas = inject(ReservasService);
  private readonly db = inject(DbService);
  private readonly zona = inject(NgZone);

  modo: Modo = 'sala';
  codigo = '';
  resultado: Resultado | null = null;
  historial: { hora: string; codigo: string; titulo: string; ok: boolean }[] = [];
  camaraActiva = false;
  errorCamara = '';
  private lector: { stop: () => Promise<void>; clear: () => void } | null = null;
  private ultimoLeido = { codigo: '', momento: 0 };

  cambiarModo(m: Modo) {
    this.modo = m;
    this.resultado = null;
  }

  /** Agrega los guiones mientras se escribe: LMBXXXXXXXX → LMB-XXXX-XXXX */
  formatear(valor: string): string {
    const limpio = valor.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
    const partes = [limpio.slice(0, 3), limpio.slice(3, 7), limpio.slice(7, 11)].filter(Boolean);
    return partes.join('-');
  }

  validar(codigo: string) {
    const limpio = this.formatear(codigo);
    if (!limpio) return;
    this.reservas.validar(limpio, this.modo).subscribe({
      next: ({ pedido, funcion, pelicula }) => {
        this.mostrar({
          ok: true,
          titulo: this.modo === 'sala' ? 'Puede ingresar' : 'Entregar productos',
          detalle: this.modo === 'sala' ? `${pedido.butacas.length} ${pedido.butacas.length === 1 ? 'persona' : 'personas'}.` : 'El candy queda marcado como retirado.',
          pedido,
          funcion,
          pelicula,
        }, limpio);
      },
      error: (e: Error) => {
        const encontrado = this.reservas.buscarPorCodigo(limpio);
        this.mostrar({ ok: false, titulo: 'No válido', detalle: e.message, ...(encontrado ?? {}) }, limpio);
      },
    });
    this.codigo = '';
  }

  private mostrar(r: Resultado, codigo: string) {
    this.resultado = r;
    this.historial = [{ hora: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }), codigo, titulo: `${this.modo === 'sala' ? 'Sala' : 'Candy'}: ${r.titulo}`, ok: r.ok }, ...this.historial].slice(0, 12);
    navigator.vibrate?.(r.ok ? 80 : [60, 60, 60]);
  }

  async iniciarCamara() {
    this.errorCamara = '';
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      this.camaraActiva = true;
      const lector = new Html5Qrcode('lector-qr');
      this.lector = lector;
      await lector.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (texto) => this.zona.run(() => this.alLeer(texto)),
        () => undefined,
      );
    } catch (e) {
      this.camaraActiva = false;
      this.lector = null;
      this.errorCamara = 'No pudimos usar la cámara (permiso denegado o sin cámara). Usá el código manual.';
      console.warn(e);
    }
  }

  private alLeer(texto: string) {
    const ahora = Date.now();
    // Evita validar dos veces el mismo QR mientras sigue frente a la cámara.
    if (texto === this.ultimoLeido.codigo && ahora - this.ultimoLeido.momento < 4000) return;
    this.ultimoLeido = { codigo: texto, momento: ahora };
    this.validar(texto);
  }

  async detenerCamara() {
    try {
      await this.lector?.stop();
      this.lector?.clear();
    } catch {
      /* ya estaba detenida */
    }
    this.lector = null;
    this.camaraActiva = false;
  }

  ngOnDestroy() {
    this.detenerCamara();
  }

  nombreSala(id: string) {
    return this.db.porId('salas', id)?.nombre ?? '—';
  }

  hora(iso: string) {
    return new Date(iso).toLocaleString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  butacas(p: Pedido) {
    return p.butacas.map((b) => (tipoDeButaca(b) === 'vip' ? `${b} (VIP)` : tipoDeButaca(b) === 'accesible' ? `${b} (accesible)` : b)).join(', ');
  }

  items(p: Pedido) {
    return p.items.length ? p.items.map((i) => `${i.cantidad}× ${i.nombre}`).join(', ') : 'Sin productos';
  }
}
