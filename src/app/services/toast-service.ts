import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  texto: string;
  tipo: 'ok' | 'error' | 'info';
}

/** Avisos flotantes. El componente Toasts muestra la lista. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private siguienteId = 0;
  readonly toasts = signal<Toast[]>([]);

  ok(texto: string) {
    this.mostrar(texto, 'ok');
  }

  error(texto: string) {
    this.mostrar(texto, 'error', 6000);
  }

  info(texto: string) {
    this.mostrar(texto, 'info');
  }

  cerrar(id: number) {
    this.toasts.update((lista) => lista.filter((t) => t.id !== id));
  }

  private mostrar(texto: string, tipo: Toast['tipo'], ms = 3800) {
    const toast = { id: ++this.siguienteId, texto, tipo };
    this.toasts.update((lista) => [...lista, toast]);
    setTimeout(() => this.cerrar(toast.id), ms);
  }
}
