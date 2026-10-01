import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject, Observable, combineLatest, map } from 'rxjs';
import { FORMATOS, Formato, Funcion, Idioma } from '../../core/models/models';
import { DbService } from '../../core/services/db.service';
import { FuncionesService, ResultadoProgramacion } from '../../core/services/funciones.service';
import { PeliculasService } from '../../core/services/peliculas.service';
import { ToastService } from '../../core/services/toast.service';
import { aISOFecha, formatearFechaAR, parsearFechaAR, sumarDias } from '../../core/utils/fechas';
import { fechaARValida } from '../../core/utils/validadores';
import { SelectorDiasComponent } from '../../shared/components/selector-dias.component';
import { SelectorHorariosComponent } from '../../shared/components/selector-horarios.component';
import { MascaraFechaDirective } from '../../shared/directives/directivas';
import { FechaARPipe, PesosPipe } from '../../shared/pipes/pipes';

interface FilaFuncion {
  f: Funcion;
  pelicula: string;
  sala: string;
  vendidas: number;
}

@Component({
  selector: 'app-funciones-admin',
  imports: [AsyncPipe, ReactiveFormsModule, FormsModule, SelectorDiasComponent, SelectorHorariosComponent, MascaraFechaDirective, PesosPipe, FechaARPipe],
  template: `
    <header class="cabecera-pagina">
      <div><h1>Funciones</h1><p>Elegí película, días y horarios: el sistema asigna la sala sola y respeta 30 minutos de limpieza entre funciones.</p></div>
    </header>

    <form class="panel" [formGroup]="form" (ngSubmit)="programar()" novalidate>
      <h2>Programar funciones</h2>
      <div class="form-grilla">
        <div class="campo ancho">
          <label for="peli">Película</label>
          <select id="peli" formControlName="peliculaId">
            <option value="" disabled>Elegí una película</option>
            @for (p of peliculasActivas$ | async; track p.id) { <option [value]="p.id">{{ p.titulo }} ({{ p.duracionMin }} min)</option> }
          </select>
        </div>
        <div class="campo">
          <label for="desde">Desde</label>
          <input id="desde" formControlName="desde" appMascaraFecha="dd/mm/aaaa" inputmode="numeric" placeholder="dd/mm/aaaa" />
        </div>
        <div class="campo">
          <label for="hasta">Hasta</label>
          <input id="hasta" formControlName="hasta" appMascaraFecha="dd/mm/aaaa" inputmode="numeric" placeholder="dd/mm/aaaa" />
        </div>
        <div class="campo">
          <span class="etiqueta-campo">Atajos</span>
          <div class="chips">
            <button type="button" class="chip" (click)="rapido(7)">1 semana</button>
            <button type="button" class="chip" (click)="rapido(14)">2 semanas</button>
            <button type="button" class="chip" (click)="rapido(28)">4 semanas</button>
          </div>
        </div>
        <div class="campo ancho">
          <span class="etiqueta-campo">Días de la semana</span>
          <app-selector-dias [(valores)]="dias" />
        </div>
        <div class="campo ancho">
          <span class="etiqueta-campo">Horarios</span>
          <app-selector-horarios [(valores)]="horarios" />
        </div>
        <div class="campo">
          <span class="etiqueta-campo">Formato</span>
          <div class="chips">
            @for (fo of formatos; track fo) { <button type="button" class="chip" [class.activo]="form.value.formato === fo" (click)="form.controls.formato.setValue(fo)">{{ fo }}</button> }
          </div>
        </div>
        <div class="campo">
          <span class="etiqueta-campo">Idioma</span>
          <div class="chips">
            <button type="button" class="chip" [class.activo]="form.value.idioma === 'castellano'" (click)="form.controls.idioma.setValue('castellano')">Castellano</button>
            <button type="button" class="chip" [class.activo]="form.value.idioma === 'subtitulada'" (click)="form.controls.idioma.setValue('subtitulada')">Subtitulada</button>
          </div>
        </div>
        <div class="campo">
          <label for="precio">Precio entrada</label>
          <input id="precio" type="number" min="0" formControlName="precio" />
        </div>
        <div class="campo">
          <label for="vip">Precio butaca VIP (filas R, S, T)</label>
          <input id="vip" type="number" min="0" formControlName="precioVip" />
        </div>
      </div>
      @if (errorForm) { <p class="aviso error">{{ errorForm }}</p> }
      <div class="pie"><button type="submit" class="btn btn-primario">Crear funciones</button></div>

      @if (resultado; as r) {
        <div class="aviso" [class.ok]="r.creadas.length && !r.conflictos.length" [class.error]="!r.creadas.length">
          <strong>{{ r.creadas.length }} funciones creadas.</strong>
          @if (r.creadas.length) { Salas asignadas: {{ salasUsadas(r) }}. }
          @if (r.conflictos.length) {
            <p>No se pudieron crear {{ r.conflictos.length }}:</p>
            <ul>@for (c of r.conflictos.slice(0, 10); track $index) { <li>{{ c.fecha | fechaAR }} {{ c.hora }} h — {{ c.motivo }}</li> }</ul>
            @if (r.conflictos.length > 10) { <p>…y {{ r.conflictos.length - 10 }} más.</p> }
          }
        </div>
      }
    </form>

    <section class="panel">
      <h2>Agenda</h2>
      <div class="dias-agenda" role="tablist">
        @for (d of diasAgenda; track d.iso) {
          <button type="button" role="tab" [attr.aria-selected]="d.iso === diaSel" [class.activo]="d.iso === diaSel" (click)="elegirDia(d.iso)">
            <span>{{ d.semana }}</span><strong>{{ d.numero }}</strong>
          </button>
        }
      </div>
      @if (agenda$ | async; as filas) {
        <div class="tabla-scroll">
          <table class="tabla">
            <thead><tr><th>Hora</th><th>Película</th><th>Sala</th><th>Formato</th><th class="num">Precio / VIP</th><th class="num">Vendidas</th><th></th></tr></thead>
            <tbody>
              @for (x of filas; track x.f.id) {
                <tr>
                  <td><strong>{{ hora(x.f.inicio) }}</strong>–{{ hora(x.f.fin) }}</td>
                  <td>{{ x.pelicula }}</td>
                  <td>{{ x.sala }}</td>
                  <td>{{ x.f.formato }} · {{ x.f.idioma === 'castellano' ? 'Cast.' : 'Subt.' }}</td>
                  <td class="num">
                    @if (editandoId === x.f.id) {
                      <span class="precios"><input type="number" [(ngModel)]="precioEdit" aria-label="Precio" /><input type="number" [(ngModel)]="vipEdit" aria-label="Precio VIP" /></span>
                    } @else {
                      {{ x.f.precio | pesos }} / {{ x.f.precioVip | pesos }}
                    }
                  </td>
                  <td class="num">{{ x.vendidas }}</td>
                  <td><div class="acciones">
                    @if (editandoId === x.f.id) {
                      <button type="button" class="btn btn-chico btn-primario" (click)="guardarPrecio(x.f)">OK</button>
                      <button type="button" class="btn btn-chico" (click)="editandoId = null">×</button>
                    } @else {
                      <button type="button" class="btn btn-chico" (click)="editarPrecio(x.f)">Precio</button>
                      <button type="button" class="btn btn-chico btn-peligro" (click)="eliminar(x.f)" [disabled]="x.vendidas > 0" [title]="x.vendidas ? 'Tiene entradas vendidas' : 'Eliminar'">Borrar</button>
                    }
                  </div></td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="suave">No hay funciones este día.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    :host { display: grid; gap: 20px; }
    h2 { margin: 0 0 16px; font-size: var(--t-xl); }
    .pie { margin: 20px 0 12px; }
    .aviso ul { margin: 6px 0 0; padding-left: 18px; }
    .aviso p { margin: 6px 0 0; }
    .dias-agenda { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 12px; }
    .dias-agenda button { display: flex; flex-direction: column; align-items: center; min-width: 56px; padding: 8px 6px; border: 1px solid var(--linea); border-radius: var(--r-s); background: transparent; color: var(--pantalla); cursor: pointer; font: inherit; }
    .dias-agenda span { font-size: var(--t-xs); color: var(--humo); text-transform: capitalize; }
    .dias-agenda strong { font: 800 var(--t-xl) / 1 var(--f-display); }
    .dias-agenda .activo { background: var(--laton); border-color: var(--laton); color: var(--noche); }
    .dias-agenda .activo span { color: var(--noche); }
    .precios { display: inline-flex; gap: 4px; }
    .precios input { width: 90px; min-height: 32px; padding: 4px 6px; }
  `,
})
export class FuncionesAdminComponent {
  private readonly db = inject(DbService);
  private readonly funciones = inject(FuncionesService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly formatos = FORMATOS;
  readonly peliculasActivas$ = inject(PeliculasService).peliculas$.pipe(map((l) => l.filter((p) => p.estado !== 'inactiva')));

  dias: number[] = [1, 2, 5];
  horarios: string[] = ['18:00'];
  errorForm = '';
  resultado: ResultadoProgramacion | null = null;

  readonly form = this.fb.nonNullable.group({
    peliculaId: ['', Validators.required],
    desde: [formatearFechaAR(aISOFecha(new Date())), [Validators.required, fechaARValida]],
    hasta: [formatearFechaAR(aISOFecha(sumarDias(new Date(), 13))), [Validators.required, fechaARValida]],
    formato: ['2D' as Formato],
    idioma: ['castellano' as Idioma],
    precio: [7000, [Validators.required, Validators.min(0)]],
    precioVip: [10000, [Validators.required, Validators.min(0)]],
  });

  // ── Agenda ──
  readonly diasAgenda = Array.from({ length: 21 }, (_, i) => {
    const d = sumarDias(new Date(), i - 3);
    return { iso: aISOFecha(d), semana: d.toLocaleDateString('es-AR', { weekday: 'short' }), numero: d.getDate() };
  });
  diaSel = aISOFecha(new Date());
  private readonly dia$ = new BehaviorSubject(this.diaSel);
  editandoId: string | null = null;
  precioEdit = 0;
  vipEdit = 0;

  readonly agenda$: Observable<FilaFuncion[]> = combineLatest([this.dia$, this.funciones.funciones$, this.db.lista$('peliculas'), this.db.lista$('salas'), this.db.lista$('pedidos')]).pipe(
    map(([dia, funciones, pelis, salas, pedidos]) =>
      funciones
        .filter((f) => aISOFecha(new Date(f.inicio)) === dia)
        .map((f) => ({
          f,
          pelicula: pelis.find((p) => p.id === f.peliculaId)?.titulo ?? '—',
          sala: salas.find((s) => s.id === f.salaId)?.nombre ?? '—',
          vendidas: pedidos.filter((p) => p.funcionId === f.id && p.estado === 'pagada').reduce((a, p) => a + p.butacas.length, 0),
        }))
        .sort((a, b) => a.f.inicio.localeCompare(b.f.inicio) || a.sala.localeCompare(b.sala, 'es', { numeric: true })),
    ),
  );

  rapido(dias: number) {
    this.form.patchValue({ desde: formatearFechaAR(aISOFecha(new Date())), hasta: formatearFechaAR(aISOFecha(sumarDias(new Date(), dias - 1))) });
  }

  programar() {
    this.form.markAllAsTouched();
    this.errorForm = '';
    const v = this.form.getRawValue();
    const desde = parsearFechaAR(v.desde);
    const hasta = parsearFechaAR(v.hasta);
    if (!v.peliculaId) { this.errorForm = 'Elegí una película.'; return; }
    if (!desde || !hasta) { this.errorForm = 'Revisá las fechas (dd/mm/aaaa).'; return; }
    if (desde > hasta) { this.errorForm = '"Desde" tiene que ser anterior a "hasta".'; return; }
    if (!this.dias.length) { this.errorForm = 'Elegí al menos un día de la semana.'; return; }
    if (!this.horarios.length) { this.errorForm = 'Agregá al menos un horario.'; return; }
    if (Number(v.precioVip) < Number(v.precio)) { this.errorForm = 'El precio VIP no puede ser menor que el normal.'; return; }
    this.resultado = this.funciones.programar({
      peliculaId: v.peliculaId,
      desde,
      hasta,
      dias: this.dias,
      horarios: this.horarios,
      formato: v.formato,
      idioma: v.idioma,
      precio: Number(v.precio),
      precioVip: Number(v.precioVip),
    });
    if (this.resultado.creadas.length) this.toast.ok(`Se crearon ${this.resultado.creadas.length} funciones.`);
  }

  salasUsadas(r: ResultadoProgramacion) {
    const nombres = new Set(r.creadas.map((f) => this.db.porId('salas', f.salaId)?.nombre ?? '?'));
    return [...nombres].sort((a, b) => a.localeCompare(b, 'es', { numeric: true })).join(', ');
  }

  elegirDia(iso: string) {
    this.diaSel = iso;
    this.dia$.next(iso);
  }

  editarPrecio(f: Funcion) {
    this.editandoId = f.id;
    this.precioEdit = f.precio;
    this.vipEdit = f.precioVip;
  }

  guardarPrecio(f: Funcion) {
    if (this.precioEdit < 0 || this.vipEdit < this.precioEdit) {
      this.toast.error('El VIP debe ser mayor o igual al precio normal.');
      return;
    }
    this.funciones.actualizarPrecios(f.id, Number(this.precioEdit), Number(this.vipEdit)).subscribe(() => {
      this.editandoId = null;
      this.toast.ok('Precio actualizado.');
    });
  }

  eliminar(f: Funcion) {
    if (!confirm('¿Eliminar esta función?')) return;
    this.funciones.eliminar(f.id).subscribe({ next: () => this.toast.ok('Función eliminada.'), error: (e: Error) => this.toast.error(e.message) });
  }

  hora(iso: string) {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }
}
