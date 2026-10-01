import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DIAS_SEMANA } from '../../core/utils/fechas';

@Component({
  selector: 'app-selector-dias',
  template: `
    <div class="chips" role="group" aria-label="Días de la semana">
      @for (d of dias; track d.valor) {
        <button type="button" class="chip" [class.activo]="valores.includes(d.valor)" [attr.aria-pressed]="valores.includes(d.valor)"
          [attr.aria-label]="d.largo" (click)="alternar(d.valor)">{{ d.corto }}</button>
      }
      <button type="button" class="btn-texto chico" (click)="todos()">Todos</button>
    </div>
  `,
})
export class SelectorDiasComponent {
  readonly dias = DIAS_SEMANA;
  @Input() valores: number[] = [];
  @Output() valoresChange = new EventEmitter<number[]>();

  alternar(v: number) {
    this.valores = this.valores.includes(v) ? this.valores.filter((x) => x !== v) : [...this.valores, v];
    this.valoresChange.emit(this.valores);
  }

  todos() {
    this.valores = this.dias.map((d) => d.valor);
    this.valoresChange.emit(this.valores);
  }
}
