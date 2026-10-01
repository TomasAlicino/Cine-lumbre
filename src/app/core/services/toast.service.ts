import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Toast {
  id: number;
  texto: string;
  tipo: 'ok' | 'error' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private seq = 0;
  private readonly _toasts = new BehaviorSubject<Toast[]>([]);
  readonly toasts$ = this._toasts.asObservable();

  ok(texto: string) { this.mostrar(texto, 'ok'); }
  error(texto: string) { this.mostrar(texto, 'error', 6000); }
  info(texto: string) { this.mostrar(texto, 'info'); }

  cerrar(id: number) {
    this._toasts.next(this._toasts.value.filter((t) => t.id !== id));
  }

  private mostrar(texto: string, tipo: Toast['tipo'], ms = 3800) {
    const t = { id: ++this.seq, texto, tipo };
    this._toasts.next([...this._toasts.value, t]);
    setTimeout(() => this.cerrar(t.id), ms);
  }
}
