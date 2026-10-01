import { Component, computed, input, model, signal } from '@angular/core';

/**
 * Calificación con estrellas. Solo lectura o editable.
 * Editable se usa con two-way binding: <app-estrellas [editable]="true" [(valor)]="estrellas" />
 */
@Component({
  selector: 'app-estrellas',
  templateUrl: './estrellas.html',
  styleUrl: './estrellas.scss',
})
export class Estrellas {
  valor = model(0);
  editable = input(false);
  etiqueta = input('Calificación');

  readonly numeros = [1, 2, 3, 4, 5];
  hover = signal(0);
  redondeado = computed(() => Math.round(this.valor()));

  elegir(n: number) {
    this.valor.set(n);
  }
}
