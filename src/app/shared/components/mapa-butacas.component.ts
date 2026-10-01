import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButacaDef, LAYOUT_SALA } from '../../core/utils/sala-layout';
import { EstadoButacas } from '../../core/services/reservas.service';

type EstadoVisual = 'libre' | 'vendida' | 'ajena' | 'elegida' | 'fuera';

/**
 * Mapa de la sala visto desde arriba: pantalla adelante, VIP atrás, fila accesible en el medio.
 * - modo "compra": el cliente elige butacas (se ven en tiempo real las vendidas y las que otro está eligiendo).
 * - modo "admin": el administrador marca butacas fuera de servicio.
 */
@Component({
  selector: 'app-mapa-butacas',
  template: `
    <div class="sala" [class.admin]="modo === 'admin'">
      <div class="pantalla" aria-hidden="true"><span>Pantalla</span></div>
      <div class="scroll" tabindex="0" aria-label="Mapa de butacas, desplazable horizontalmente">
        <div class="filas" role="grid">
          @for (fila of layout; track fila.etiqueta) {
            <div class="fila" [class]="'fila ' + fila.tipo" role="row">
              <span class="rotulo" aria-hidden="true">{{ fila.etiqueta }}</span>
              @for (bloque of fila.bloques; track $index) {
                <div class="bloque" [class.centro]="$index === 1">
                  @for (b of bloque; track b.id) {
                    @let est = estadoDe(b);
                    <button type="button" role="gridcell" class="butaca" [class]="'butaca ' + b.tipo + ' ' + est"
                      [disabled]="!clickeable(est)" [attr.aria-pressed]="est === 'elegida'"
                      [attr.aria-label]="descripcion(b, est)" [title]="b.id" (click)="butacaClick.emit(b)">
                      <span aria-hidden="true">{{ b.numero }}</span>
                    </button>
                  }
                </div>
              }
              <span class="rotulo" aria-hidden="true">{{ fila.etiqueta }}</span>
            </div>
          }
        </div>
      </div>
      <ul class="leyenda">
        @if (modo === 'compra') {
          <li><i class="butaca normal libre"></i>Libre</li>
          <li><i class="butaca normal elegida"></i>Tu elección</li>
          <li><i class="butaca normal vendida"></i>Vendida</li>
          <li><i class="butaca normal ajena"></i>Otra persona la está eligiendo</li>
        } @else {
          <li><i class="butaca normal libre"></i>En servicio</li>
          <li><i class="butaca normal fuera"></i>Fuera de servicio</li>
        }
        <li><i class="butaca accesible libre"></i>Accesible (fila JK)</li>
        <li><i class="butaca vip libre"></i>VIP (filas R, S y T)</li>
      </ul>
    </div>
  `,
  styles: `
    :host { display: block; }
    .sala { position: relative; }
    .pantalla { position: relative; height: 56px; margin: 0 6% 10px; }
    .pantalla::before { content: ''; position: absolute; inset: 0 0 auto; height: 14px; border-radius: 50% / 100% 100% 0 0; border-top: 3px solid var(--pantalla); box-shadow: 0 -6px 26px rgba(243, 239, 228, 0.35); }
    .pantalla::after { content: ''; position: absolute; left: 4%; right: 4%; top: 10px; height: 46px; background: radial-gradient(60% 100% at 50% 0, rgba(243, 239, 228, 0.12), transparent 70%); }
    .pantalla span { position: absolute; top: 18px; left: 0; right: 0; text-align: center; font: 700 var(--t-s) / 1 var(--f-display); letter-spacing: 0.3em; color: var(--humo); }
    .scroll { overflow-x: auto; padding-bottom: 8px; }
    .scroll:focus-visible { outline: 2px solid var(--laton); }
    .filas { display: flex; flex-direction: column; gap: 5px; width: max-content; margin: 0 auto; padding: 0 4px; }
    .fila { display: flex; align-items: center; justify-content: center; gap: 18px; }
    .fila.accesible { margin-block: 12px; }
    .fila.vip:first-of-type, .fila.vip { }
    .rotulo { width: 24px; text-align: center; font: 700 var(--t-s) / 1 var(--f-display); color: var(--humo); }
    .bloque { display: flex; gap: 4px; justify-content: center; }
    .fila.accesible .bloque { gap: 12px; }
    .bloque:not(.centro) { width: calc(4 * 24px + 3 * 4px); }
    .fila.accesible .bloque:not(.centro) { width: calc(4 * 24px + 3 * 4px); }
    .bloque.centro { width: calc(20 * 24px + 19 * 4px); }

    .butaca { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: 1.5px solid var(--humo); border-radius: 7px 7px 3px 3px; background: transparent; color: transparent; font: 600 10px / 1 var(--f-texto); cursor: pointer; transition: background-color .12s, transform .12s; }
    .fila.accesible .butaca { width: 30px; }
    .butaca:hover:not(:disabled) { color: var(--pantalla); transform: translateY(-2px); }
    .butaca.accesible { border-color: var(--acceso); }
    .butaca.vip { border-color: var(--terciopelo-claro); background: rgba(179, 48, 63, 0.18); }
    .butaca.elegida { background: var(--laton); border-color: var(--laton); color: var(--noche); }
    .butaca.vendida { background: var(--noche-3); border-color: var(--noche-3); cursor: not-allowed; }
    .butaca.ajena { border-style: dashed; background: repeating-linear-gradient(45deg, transparent 0 3px, rgba(154, 163, 191, 0.35) 3px 5px); cursor: not-allowed; }
    .butaca.fuera { visibility: hidden; }
    .admin .butaca.fuera { visibility: visible; border-color: var(--noche-3); background: transparent; opacity: .5; }
    .admin .butaca.fuera::after { content: '×'; color: var(--humo); font-size: 14px; }
    .admin .butaca { cursor: pointer; }

    .leyenda { list-style: none; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 20px; margin: 18px 0 0; padding: 0; font-size: var(--t-xs); color: var(--humo); }
    .leyenda li { display: flex; align-items: center; gap: 8px; }
    .leyenda i { display: inline-block; width: 16px; height: 16px; cursor: default; }
    .leyenda i.fuera { visibility: visible; opacity: .5; border-color: var(--noche-3); }
  `,
})
export class MapaButacasComponent {
  readonly layout = LAYOUT_SALA;
  @Input() estado: EstadoButacas | null = null;
  @Input() seleccionadas: string[] = [];
  @Input() fueraDeServicio: string[] = [];
  @Input() modo: 'compra' | 'admin' = 'compra';
  @Output() butacaClick = new EventEmitter<ButacaDef>();

  estadoDe(b: ButacaDef): EstadoVisual {
    if (this.fueraDeServicio.includes(b.id)) return 'fuera';
    if (this.modo === 'admin') return 'libre';
    if (this.seleccionadas.includes(b.id)) return 'elegida';
    if (this.estado?.vendidas.has(b.id)) return 'vendida';
    if (this.estado?.enCompraAjena.has(b.id)) return 'ajena';
    return 'libre';
  }

  clickeable(e: EstadoVisual): boolean {
    return this.modo === 'admin' || e === 'libre' || e === 'elegida';
  }

  descripcion(b: ButacaDef, e: EstadoVisual): string {
    const tipo = b.tipo === 'vip' ? ', VIP' : b.tipo === 'accesible' ? ', accesible' : '';
    const estados: Record<EstadoVisual, string> = {
      libre: 'libre', vendida: 'vendida', ajena: 'la está eligiendo otra persona', elegida: 'elegida', fuera: 'fuera de servicio',
    };
    return `Fila ${b.fila}, butaca ${b.numero}${tipo}, ${estados[e]}`;
  }
}
