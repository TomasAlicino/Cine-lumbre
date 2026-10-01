import { Component, model, signal } from '@angular/core';

/**
 * Selector de horarios sin scroll: se toca la hora y después los minutos.
 * Reemplaza al desplegable larguísimo de horas (pedido del cliente).
 * Uso: <app-selector-horarios [(valores)]="horarios" />
 */
@Component({
  selector: 'app-selector-horarios',
  templateUrl: './selector-horarios.html',
  styleUrl: './selector-horarios.scss',
})
export class SelectorHorarios {
  valores = model<string[]>([]);

  readonly horas = Array.from({ length: 14 }, (_, i) => String(i + 10).padStart(2, '0')); // 10 a 23
  readonly minutos = ['00', '10', '20', '30', '40', '50'];
  hora = signal<string | null>(null);

  agregar(min: string) {
    const h = this.hora();
    if (h === null) return;
    const v = `${h}:${min}`;
    this.valores.update((l) => [...new Set([...l, v])].sort());
  }

  quitar(v: string) {
    this.valores.update((l) => l.filter((x) => x !== v));
  }
}
