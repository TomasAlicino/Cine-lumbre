import { Component, EventEmitter, Input, Output } from '@angular/core';

/** Calificación con estrellas. Solo lectura o editable (Input/Output). */
@Component({
  selector: 'app-estrellas',
  template: `
    <div class="estrellas" [class.editable]="editable" role="radiogroup" [attr.aria-label]="etiqueta">
      @for (n of [1, 2, 3, 4, 5]; track n) {
        @if (editable) {
          <button type="button" role="radio" [attr.aria-checked]="valor === n" [attr.aria-label]="n + (n === 1 ? ' estrella' : ' estrellas')"
            [class.llena]="n <= (hover || valor)" (mouseenter)="hover = n" (mouseleave)="hover = 0" (click)="elegir(n)">★</button>
        } @else {
          <span [class.llena]="n <= redondeado" aria-hidden="true">★</span>
        }
      }
    </div>
  `,
  styles: `
    .estrellas { display: inline-flex; gap: 2px; color: var(--linea); line-height: 1; }
    span { font-size: 1rem; }
    button { background: none; border: 0; padding: 2px; font-size: 1.8rem; color: var(--linea); cursor: pointer; line-height: 1; }
    .llena { color: var(--laton); }
  `,
})
export class EstrellasComponent {
  @Input() valor = 0;
  @Input() editable = false;
  @Input() etiqueta = 'Calificación';
  @Output() valorChange = new EventEmitter<number>();
  hover = 0;

  get redondeado() {
    return Math.round(this.valor);
  }

  elegir(n: number) {
    this.valor = n;
    this.valorChange.emit(n);
  }
}
