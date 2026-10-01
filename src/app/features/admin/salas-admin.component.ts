import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Sala } from '../../core/models/models';
import { SalasService } from '../../core/services/salas.service';
import { ToastService } from '../../core/services/toast.service';
import { ButacaDef, TOTAL_BUTACAS } from '../../core/utils/sala-layout';
import { MapaButacasComponent } from '../../shared/components/mapa-butacas.component';

@Component({
  selector: 'app-salas-admin',
  imports: [AsyncPipe, FormsModule, MapaButacasComponent],
  template: `
    <header class="cabecera-pagina">
      <div><h1>Salas</h1><p>Todas las salas tienen la misma distribución. Acá podés activarlas, renombrarlas y marcar butacas fuera de servicio.</p></div>
      <button type="button" class="btn btn-primario" (click)="nueva()">Nueva sala</button>
    </header>

    <div class="layout">
      <aside class="panel lista">
        @for (s of salas.salas$ | async; track s.id) {
          <button type="button" class="sala" [class.activa]="sel?.id === s.id" (click)="elegir(s)">
            <strong>{{ s.nombre }}</strong>
            <span class="chico">{{ s.activa ? 'Activa' : 'Inactiva' }} · {{ total - s.butacasDeshabilitadas.length }} butacas</span>
          </button>
        } @empty {
          <p class="suave">No hay salas.</p>
        }
      </aside>

      @if (sel) {
        <section class="panel">
          <div class="form-grilla">
            <div class="campo">
              <label for="nombre">Nombre</label>
              <input id="nombre" [(ngModel)]="sel.nombre" maxlength="30" />
            </div>
            <label class="check campo"><input type="checkbox" [(ngModel)]="sel.activa" /> Sala activa (se usa en la asignación automática)</label>
          </div>
          <p class="suave chico ayuda">Tocá una butaca para ponerla o sacarla de servicio (rotas, en reparación, etc.). Las que estén fuera de servicio no se venden. Fuera de servicio: {{ sel.butacasDeshabilitadas.length }}.</p>
          <app-mapa-butacas modo="admin" [fueraDeServicio]="sel.butacasDeshabilitadas" (butacaClick)="alternar($event)" />
          <div class="pie">
            <button type="button" class="btn btn-primario" (click)="guardar()">Guardar</button>
            @if (sel.id) { <button type="button" class="btn btn-peligro" (click)="eliminar()">Eliminar sala</button> }
            @if (sel.butacasDeshabilitadas.length) { <button type="button" class="btn-texto" (click)="sel.butacasDeshabilitadas = []">Habilitar todas</button> }
          </div>
        </section>
      } @else {
        <div class="vacio"><p>Elegí una sala para editarla.</p></div>
      }
    </div>
  `,
  styles: `
    .layout { display: grid; grid-template-columns: 240px 1fr; gap: 20px; align-items: start; }
    .lista { display: flex; flex-direction: column; gap: 6px; padding: 12px; }
    .sala { display: flex; flex-direction: column; align-items: flex-start; padding: 10px 12px; border-radius: var(--r-s); border: 1px solid transparent; background: transparent; color: var(--pantalla); cursor: pointer; font: inherit; text-align: left; }
    .sala span { color: var(--humo); }
    .sala:hover { background: var(--noche-3); }
    .sala.activa { border-color: var(--laton); background: var(--noche-3); }
    .ayuda { margin: 16px 0; }
    .pie { display: flex; gap: 10px; align-items: center; margin-top: 18px; flex-wrap: wrap; }
    @media (max-width: 820px) { .layout { grid-template-columns: 1fr; } .lista { flex-direction: row; overflow-x: auto; } .sala { min-width: 140px; } }
  `,
})
export class SalasAdminComponent {
  readonly salas = inject(SalasService);
  private readonly toast = inject(ToastService);
  readonly total = TOTAL_BUTACAS;
  sel: (Omit<Sala, 'id'> & { id?: string }) | null = null;

  elegir(s: Sala) {
    this.sel = { ...s, butacasDeshabilitadas: [...s.butacasDeshabilitadas] };
  }

  nueva() {
    this.sel = { nombre: '', activa: true, butacasDeshabilitadas: [] };
  }

  alternar(b: ButacaDef) {
    if (!this.sel) return;
    const l = this.sel.butacasDeshabilitadas;
    this.sel.butacasDeshabilitadas = l.includes(b.id) ? l.filter((x) => x !== b.id) : [...l, b.id];
  }

  guardar() {
    if (!this.sel || !this.sel.nombre.trim()) {
      this.toast.error('Poné un nombre a la sala.');
      return;
    }
    this.salas.guardar({ ...this.sel, nombre: this.sel.nombre.trim() }).subscribe((s) => {
      this.toast.ok(`${s.nombre} guardada.`);
      this.elegir(s);
    });
  }

  eliminar() {
    if (!this.sel?.id || !confirm(`¿Eliminar ${this.sel.nombre}?`)) return;
    this.salas.eliminar(this.sel.id).subscribe({
      next: () => { this.toast.ok('Sala eliminada.'); this.sel = null; },
      error: (e: Error) => this.toast.error(e.message),
    });
  }
}
