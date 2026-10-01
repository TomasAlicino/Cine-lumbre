import { Component, model } from '@angular/core';
import { DIAS_SEMANA } from '../../utils/fechas';

/** Botones de días de la semana. Uso: <app-selector-dias [(valores)]="dias" /> */
@Component({
  selector: 'app-selector-dias',
  templateUrl: './selector-dias.html',
})
export class SelectorDias {
  readonly dias = DIAS_SEMANA;
  valores = model<number[]>([]);

  alternar(v: number) {
    this.valores.update((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]));
  }

  todos() {
    this.valores.set(this.dias.map((d) => d.valor));
  }
}
