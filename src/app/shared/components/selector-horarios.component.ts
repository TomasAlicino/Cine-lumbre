import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Selector de horarios sin scroll: se toca la hora y después los minutos.
 * Reemplaza al típico desplegable larguísimo de horas (pedido del cliente).
 */
@Component({
  selector: 'app-selector-horarios',
  template: `
    <div class="selector">
      <div class="paso">
        <span class="etiqueta-campo">Hora</span>
        <div class="grilla horas">
          @for (h of horas; track h) {
            <button type="button" class="celda" [class.activa]="hora === h" [attr.aria-pressed]="hora === h" (click)="hora = h">{{ h }}</button>
          }
        </div>
      </div>
      <div class="paso">
        <span class="etiqueta-campo">Minutos</span>
        <div class="grilla minutos">
          @for (m of minutos; track m) {
            <button type="button" class="celda" [disabled]="hora === null" (click)="agregar(m)">:{{ m }}</button>
          }
        </div>
      </div>
      @if (valores.length) {
        <div class="elegidos" aria-live="polite">
          @for (v of valores; track v) {
            <span class="elegido">{{ v }} h <button type="button" (click)="quitar(v)" [attr.aria-label]="'Quitar ' + v">×</button></span>
          }
        </div>
      } @else {
        <p class="ayuda">Tocá una hora y después los minutos para agregar un horario. Podés agregar varios.</p>
      }
    </div>
  `,
  styles: `
    .selector { display: flex; flex-direction: column; gap: 12px; }
    .paso { display: flex; flex-direction: column; gap: 6px; }
    .etiqueta-campo { font-size: var(--t-xs); color: var(--humo); font-weight: 600; }
    .grilla { display: grid; gap: 6px; }
    .horas { grid-template-columns: repeat(auto-fill, minmax(46px, 1fr)); }
    .minutos { grid-template-columns: repeat(6, minmax(46px, 1fr)); }
    .celda { min-height: 38px; border: 1px solid var(--linea); border-radius: var(--r-s); background: var(--noche); color: var(--pantalla); font: 600 var(--t-s) / 1 var(--f-texto); font-variant-numeric: tabular-nums; cursor: pointer; }
    .celda:hover:not(:disabled) { border-color: var(--humo); }
    .celda.activa { background: var(--pantalla); color: var(--noche); border-color: var(--pantalla); }
    .celda:disabled { opacity: .35; cursor: not-allowed; }
    .elegidos { display: flex; flex-wrap: wrap; gap: 8px; }
    .elegido { display: inline-flex; align-items: center; gap: 6px; padding: 4px 6px 4px 12px; border-radius: 999px; background: var(--laton); color: var(--noche); font-weight: 700; font-size: var(--t-s); font-variant-numeric: tabular-nums; }
    .elegido button { border: 0; background: rgba(20,27,46,.15); color: var(--noche); width: 22px; height: 22px; border-radius: 50%; cursor: pointer; line-height: 1; }
    .ayuda { font-size: var(--t-xs); color: var(--humo); margin: 0; }
  `,
})
export class SelectorHorariosComponent {
  @Input() valores: string[] = [];
  @Input() multiple = true;
  @Output() valoresChange = new EventEmitter<string[]>();

  readonly horas = Array.from({ length: 14 }, (_, i) => String(i + 10).padStart(2, '0')); // 10 a 23
  readonly minutos = ['00', '10', '20', '30', '40', '50'];
  hora: string | null = null;

  agregar(min: string) {
    if (this.hora === null) return;
    const v = `${this.hora}:${min}`;
    const nuevos = this.multiple ? [...new Set([...this.valores, v])].sort() : [v];
    this.valores = nuevos;
    this.valoresChange.emit(nuevos);
  }

  quitar(v: string) {
    this.valores = this.valores.filter((x) => x !== v);
    this.valoresChange.emit(this.valores);
  }
}
