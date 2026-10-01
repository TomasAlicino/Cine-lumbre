import { Component, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, Observable, map, switchMap } from 'rxjs';
import { FilaFacturacion, Ranking, ReportesService } from '../../core/services/reportes.service';
import { aISOFecha, formatearFechaAR, inicioSemana, parsearFechaAR, sumarDias } from '../../core/utils/fechas';
import { MascaraFechaDirective } from '../../shared/directives/directivas';
import { PesosPipe } from '../../shared/pipes/pipes';

interface Rango { desde: string; hasta: string }
type Periodo = 'semana' | 'mes';

@Component({
  selector: 'app-tablero',
  imports: [AsyncPipe, FormsModule, PesosPipe, MascaraFechaDirective],
  template: `
    <header class="cabecera-pagina">
      <div><h1>Reportes</h1><p>Facturación, entradas vendidas, películas más vistas y producto estrella del candy.</p></div>
    </header>

    <section class="panel">
      <div class="barra">
        <div class="chips">
          <button type="button" class="chip" [class.activo]="atajo === 7" (click)="ultimosDias(7)">Últimos 7 días</button>
          <button type="button" class="chip" [class.activo]="atajo === 30" (click)="ultimosDias(30)">Últimos 30 días</button>
          <button type="button" class="chip" [class.activo]="atajo === 'mes'" (click)="esteMes()">Este mes</button>
        </div>
        <div class="rango">
          <label>Desde <input [(ngModel)]="desdeTxt" appMascaraFecha="dd/mm/aaaa" inputmode="numeric" placeholder="dd/mm/aaaa" /></label>
          <label>Hasta <input [(ngModel)]="hastaTxt" appMascaraFecha="dd/mm/aaaa" inputmode="numeric" placeholder="dd/mm/aaaa" /></label>
          <button type="button" class="btn btn-chico" (click)="aplicarRango()">Aplicar</button>
        </div>
      </div>
      @if (errorRango) { <p class="aviso error">{{ errorRango }}</p> }

      @if (filas$ | async; as filas) {
        <div class="kpis">
          <div><span>Facturación</span><strong>{{ total(filas, 'facturacion') | pesos }}</strong></div>
          <div><span>Entradas vendidas</span><strong>{{ total(filas, 'entradas') }}</strong></div>
          <div><span>Compras</span><strong>{{ total(filas, 'pedidos') }}</strong></div>
          <div><span>Ticket promedio</span><strong>{{ (total(filas, 'pedidos') ? total(filas, 'facturacion') / total(filas, 'pedidos') : 0) | pesos }}</strong></div>
        </div>
        <div class="titulo-fila">
          <h2>Facturación por día</h2>
          <div class="acciones">
            <button type="button" class="btn btn-chico" (click)="exportarPdf(filas)">Exportar PDF</button>
            <button type="button" class="btn btn-chico" (click)="reportes.exportarExcel(filas)">Exportar Excel</button>
          </div>
        </div>
        <div class="tabla-scroll alto">
          <table class="tabla">
            <thead><tr><th>Fecha</th><th class="num">Compras</th><th class="num">Entradas</th><th class="num">Facturación</th></tr></thead>
            <tbody>
              @for (f of filas; track f.fecha) {
                <tr [class.cero]="!f.pedidos"><td>{{ dia(f.fecha) }}</td><td class="num">{{ f.pedidos }}</td><td class="num">{{ f.entradas }}</td><td class="num">{{ f.facturacion | pesos }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    <div class="dos">
      <section class="panel">
        <div class="titulo-fila">
          <h2>Películas más vistas</h2>
          <div class="chips">
            <button type="button" class="chip" [class.activo]="periodo === 'semana'" (click)="cambiarPeriodo('semana')">Semana</button>
            <button type="button" class="chip" [class.activo]="periodo === 'mes'" (click)="cambiarPeriodo('mes')">Mes</button>
          </div>
        </div>
        <div class="nav-periodo">
          <button type="button" class="btn btn-chico" (click)="moverPeriodo(-1)" aria-label="Período anterior">‹</button>
          <strong>{{ etiquetaPeriodo }}</strong>
          <button type="button" class="btn btn-chico" (click)="moverPeriodo(1)" aria-label="Período siguiente">›</button>
        </div>
        @if (vistas$ | async; as vistas) {
          <div class="barras" role="img" [attr.aria-label]="'Gráfico de películas más vistas: ' + descripcion(vistas)">
            @for (v of vistas.slice(0, 8); track v.id; let i = $index) {
              <div class="barra-fila">
                <span class="nombre">{{ v.nombre }}</span>
                <div class="pista"><div class="relleno" [class.primera]="i === 0" [style.width.%]="(v.cantidad / vistas[0].cantidad) * 100"></div></div>
                <span class="valor">{{ v.cantidad }}</span>
              </div>
            } @empty {
              <p class="suave">No hubo funciones con entradas vendidas en este período.</p>
            }
          </div>
        }
      </section>

      <section class="panel">
        <h2>Candy bar</h2>
        @if (productos$ | async; as productos) {
          @if (productos[0]; as top) {
            <div class="estrella">
              <span>Producto más vendido del período</span>
              <strong>{{ top.nombre }}</strong>
              <em>{{ top.cantidad }} unidades</em>
            </div>
            <ol class="ranking">
              @for (p of productos.slice(1, 6); track p.id) { <li><span>{{ p.nombre }}</span><span>{{ p.cantidad }}</span></li> }
            </ol>
          } @else {
            <p class="suave">Sin ventas de candy en el rango elegido.</p>
          }
        }
        <p class="suave chico">Incluye productos sueltos, dentro de combos y canjeados con puntos. Usa el rango de fechas de arriba.</p>
      </section>
    </div>
  `,
  styles: `
    :host { display: grid; gap: 20px; }
    h2 { margin: 0; font-size: var(--t-xl); }
    .barra { display: flex; flex-wrap: wrap; gap: 14px; justify-content: space-between; align-items: flex-end; margin-bottom: 18px; }
    .rango { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
    .rango label { display: flex; flex-direction: column; font-size: var(--t-xs); color: var(--humo); gap: 4px; }
    .rango input { width: 140px; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 22px; }
    .kpis div { padding: 14px 16px; border-radius: var(--r-m); background: var(--noche); border: 1px solid var(--linea); display: flex; flex-direction: column; }
    .kpis span { font-size: var(--t-xs); color: var(--humo); }
    .kpis strong { font: 800 var(--t-2xl) / 1.1 var(--f-display); color: var(--laton); }
    .titulo-fila { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
    .acciones { display: flex; gap: 8px; }
    .alto { max-height: 380px; overflow-y: auto; }
    tr.cero td { color: var(--humo); }
    .dos { display: grid; grid-template-columns: 1.4fr 1fr; gap: 20px; }
    .nav-periodo { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .nav-periodo strong { min-width: 190px; text-align: center; }
    .barras { display: flex; flex-direction: column; gap: 10px; }
    .barra-fila { display: grid; grid-template-columns: 150px 1fr 40px; gap: 10px; align-items: center; font-size: var(--t-s); }
    .nombre { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pista { height: 22px; background: var(--noche); border-radius: 3px; overflow: hidden; }
    .relleno { height: 100%; background: var(--acceso); border-radius: 3px; transition: width .4s ease; }
    .relleno.primera { background: var(--laton); }
    .valor { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; }
    .estrella { display: flex; flex-direction: column; padding: 18px; margin: 14px 0; border-radius: var(--r-m); background: var(--pantalla); color: var(--noche); }
    .estrella span { font-size: var(--t-xs); font-weight: 600; color: #5a6380; }
    .estrella strong { font: 900 var(--t-3xl) / 1 var(--f-display); text-transform: uppercase; margin: 4px 0; }
    .estrella em { font-style: normal; color: var(--terciopelo); font-weight: 700; }
    .ranking { padding-left: 20px; margin: 0 0 12px; }
    .ranking li { padding: 4px 0; }
    .ranking li span:last-child { float: right; color: var(--humo); }
    @media (max-width: 900px) { .dos { grid-template-columns: 1fr; } .barra-fila { grid-template-columns: 110px 1fr 36px; } }
  `,
})
export class TableroComponent implements OnInit {
  readonly reportes = inject(ReportesService);
  private readonly rango$ = new BehaviorSubject<Rango>(this.calcularUltimos(30));
  private readonly periodo$ = new BehaviorSubject<{ desde: Date; hasta: Date }>(this.calcularPeriodo('semana', new Date()));

  atajo: number | 'mes' | null = 30;
  desdeTxt = '';
  hastaTxt = '';
  errorRango = '';
  periodo: Periodo = 'semana';
  referencia = new Date();
  etiquetaPeriodo = '';

  readonly filas$: Observable<FilaFacturacion[]> = this.rango$.pipe(switchMap((r) => this.reportes.facturacion$(r.desde, r.hasta)), map((l) => [...l].reverse()));
  readonly productos$: Observable<Ranking[]> = this.rango$.pipe(switchMap((r) => this.reportes.productosMasVendidos$(new Date(r.desde + 'T00:00:00'), sumarDias(new Date(r.hasta + 'T00:00:00'), 1))));
  readonly vistas$: Observable<Ranking[]> = this.periodo$.pipe(switchMap((p) => this.reportes.peliculasMasVistas$(p.desde, p.hasta)));

  ngOnInit() {
    this.sincronizarTextos();
    this.actualizarEtiqueta();
  }

  private calcularUltimos(dias: number): Rango {
    const hoy = new Date();
    return { desde: aISOFecha(sumarDias(hoy, -(dias - 1))), hasta: aISOFecha(hoy) };
  }

  private sincronizarTextos() {
    const r = this.rango$.value;
    this.desdeTxt = formatearFechaAR(r.desde);
    this.hastaTxt = formatearFechaAR(r.hasta);
    this.errorRango = '';
  }

  ultimosDias(n: number) {
    this.atajo = n;
    this.rango$.next(this.calcularUltimos(n));
    this.sincronizarTextos();
  }

  esteMes() {
    this.atajo = 'mes';
    const hoy = new Date();
    this.rango$.next({ desde: aISOFecha(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: aISOFecha(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)) });
    this.sincronizarTextos();
  }

  aplicarRango() {
    const desde = parsearFechaAR(this.desdeTxt);
    const hasta = parsearFechaAR(this.hastaTxt);
    if (!desde || !hasta) { this.errorRango = 'Revisá las fechas (formato dd/mm/aaaa).'; return; }
    if (desde > hasta) { this.errorRango = 'La fecha "desde" debe ser anterior a "hasta".'; return; }
    if ((new Date(hasta).getTime() - new Date(desde).getTime()) / 86_400_000 > 366) { this.errorRango = 'El rango máximo es de un año.'; return; }
    this.atajo = null;
    this.errorRango = '';
    this.rango$.next({ desde, hasta });
  }

  total(filas: FilaFacturacion[], campo: 'facturacion' | 'entradas' | 'pedidos') {
    return filas.reduce((a, f) => a + f[campo], 0);
  }

  exportarPdf(filas: FilaFacturacion[]) {
    const r = this.rango$.value;
    this.reportes.exportarPdf([...filas].reverse(), `Facturación del ${formatearFechaAR(r.desde)} al ${formatearFechaAR(r.hasta)}`);
  }

  // ── Gráfico por semana / mes ──
  private calcularPeriodo(p: Periodo, ref: Date) {
    if (p === 'semana') {
      const desde = inicioSemana(ref);
      return { desde, hasta: sumarDias(desde, 7) };
    }
    return { desde: new Date(ref.getFullYear(), ref.getMonth(), 1), hasta: new Date(ref.getFullYear(), ref.getMonth() + 1, 1) };
  }

  cambiarPeriodo(p: Periodo) {
    this.periodo = p;
    this.referencia = new Date();
    this.emitirPeriodo();
  }

  moverPeriodo(delta: number) {
    const r = this.referencia;
    this.referencia = this.periodo === 'semana' ? sumarDias(r, 7 * delta) : new Date(r.getFullYear(), r.getMonth() + delta, 1);
    this.emitirPeriodo();
  }

  private emitirPeriodo() {
    this.periodo$.next(this.calcularPeriodo(this.periodo, this.referencia));
    this.actualizarEtiqueta();
  }

  private actualizarEtiqueta() {
    const { desde, hasta } = this.periodo$.value;
    this.etiquetaPeriodo = this.periodo === 'semana'
      ? `Semana del ${formatearFechaAR(aISOFecha(desde)).slice(0, 5)} al ${formatearFechaAR(aISOFecha(sumarDias(hasta, -1))).slice(0, 5)}`
      : desde.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  }

  descripcion(v: Ranking[]) {
    return v.slice(0, 8).map((x) => `${x.nombre} ${x.cantidad}`).join(', ') || 'sin datos';
  }

  dia(iso: string) {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
