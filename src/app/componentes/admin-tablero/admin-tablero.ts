import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MascaraFechaDirective } from '../../directivas/directivas';
import { PesosPipe } from '../../pipes/pipes';
import { FilaFacturacion, Ranking, ReportesService } from '../../services/reportes-service';
import { ToastService } from '../../services/toast-service';
import { aISOFecha, desdeISOFecha, formatearFechaAR, inicioSemana, parsearFechaAR, sumarDias } from '../../utils/fechas';

interface Rango {
  desde: string; // yyyy-mm-dd
  hasta: string;
}

/** Tablero del admin: facturación por día, películas más vistas y candy más vendido. */
@Component({
  selector: 'app-admin-tablero',
  imports: [FormsModule, PesosPipe, MascaraFechaDirective],
  templateUrl: './admin-tablero.html',
  styleUrl: './admin-tablero.scss',
})
export class AdminTablero implements OnInit {
  private reportes = inject(ReportesService);
  private toast = inject(ToastService);

  // Filtro del período (inputs sueltos: alcanza con ngModel)
  desdeTxt = '';
  hastaTxt = '';
  atajo = signal<number | 'mes' | null>(30);
  errorRango = signal('');
  rango = signal<Rango>(this.ultimos(30));

  cargando = signal(true);
  filas = signal<FilaFacturacion[]>([]);
  productos = signal<Ranking[]>([]);
  peliculasRango = signal<Ranking[]>([]); // se usan en la exportación
  vistasSemana = signal<Ranking[]>([]);
  vistasMes = signal<Ranking[]>([]);

  // Totales del período
  totalFacturacion = computed(() => this.filas().reduce((a, f) => a + f.facturacion, 0));
  totalEntradas = computed(() => this.filas().reduce((a, f) => a + f.entradas, 0));
  totalPedidos = computed(() => this.filas().reduce((a, f) => a + f.pedidos, 0));
  ticketPromedio = computed(() => (this.totalPedidos() ? this.totalFacturacion() / this.totalPedidos() : 0));

  // La barra más alta del gráfico es el día que más se facturó
  maxFacturacion = computed(() => Math.max(1, ...this.filas().map((f) => f.facturacion)));
  // En la tabla se muestran primero los días más recientes
  filasTabla = computed(() => [...this.filas()].reverse());

  semana = this.periodoSemana();
  mes = this.periodoMes();
  etiquetaSemana = `Semana del ${formatearFechaAR(aISOFecha(this.semana.desde)).slice(0, 5)} al ${formatearFechaAR(aISOFecha(sumarDias(this.semana.hasta, -1))).slice(0, 5)}`;
  etiquetaMes = this.mes.desde.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  ngOnInit() {
    this.sincronizarTextos();
    this.cargarRango();
    this.cargarRankingsPeliculas();
  }

  /** Facturación, candy y películas del rango elegido. */
  async cargarRango() {
    this.cargando.set(true);
    const r = this.rango();
    const desde = desdeISOFecha(r.desde);
    const hasta = sumarDias(desdeISOFecha(r.hasta), 1);
    try {
      const [filas, productos, peliculas] = await Promise.all([
        this.reportes.facturacion(r.desde, r.hasta),
        this.reportes.productosMasVendidos(desde, hasta),
        this.reportes.peliculasMasVistas(desde, hasta),
      ]);
      this.filas.set(filas);
      this.productos.set(productos);
      this.peliculasRango.set(peliculas);
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }

  /** Películas más vistas de la semana y del mes actuales. */
  async cargarRankingsPeliculas() {
    try {
      const [semana, mes] = await Promise.all([
        this.reportes.peliculasMasVistas(this.semana.desde, this.semana.hasta),
        this.reportes.peliculasMasVistas(this.mes.desde, this.mes.hasta),
      ]);
      this.vistasSemana.set(semana);
      this.vistasMes.set(mes);
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }

  // ── Selector de período ──

  ultimosDias(n: number) {
    this.atajo.set(n);
    this.cambiarRango(this.ultimos(n));
  }

  esteMes() {
    this.atajo.set('mes');
    const hoy = new Date();
    this.cambiarRango({
      desde: aISOFecha(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
      hasta: aISOFecha(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)),
    });
  }

  aplicarRango() {
    const desde = parsearFechaAR(this.desdeTxt);
    const hasta = parsearFechaAR(this.hastaTxt);
    if (!desde || !hasta) {
      this.errorRango.set('Revisá las fechas (formato dd/mm/aaaa).');
      return;
    }
    if (desde > hasta) {
      this.errorRango.set('La fecha "desde" debe ser anterior a "hasta".');
      return;
    }
    if ((desdeISOFecha(hasta).getTime() - desdeISOFecha(desde).getTime()) / 86_400_000 > 366) {
      this.errorRango.set('El rango máximo es de un año.');
      return;
    }
    this.atajo.set(null);
    this.cambiarRango({ desde, hasta });
  }

  private cambiarRango(r: Rango) {
    this.rango.set(r);
    this.sincronizarTextos();
    this.cargarRango();
  }

  private sincronizarTextos() {
    this.desdeTxt = formatearFechaAR(this.rango().desde);
    this.hastaTxt = formatearFechaAR(this.rango().hasta);
    this.errorRango.set('');
  }

  private ultimos(dias: number): Rango {
    const hoy = new Date();
    return { desde: aISOFecha(sumarDias(hoy, -(dias - 1))), hasta: aISOFecha(hoy) };
  }

  private periodoSemana() {
    const desde = inicioSemana(new Date());
    return { desde, hasta: sumarDias(desde, 7) };
  }

  private periodoMes() {
    const hoy = new Date();
    return { desde: new Date(hoy.getFullYear(), hoy.getMonth(), 1), hasta: new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1) };
  }

  // ── Exportar ──

  exportarPdf() {
    const r = this.rango();
    const titulo = `Facturación del ${formatearFechaAR(r.desde)} al ${formatearFechaAR(r.hasta)}`;
    this.reportes.exportarPdf(titulo, this.filas(), this.peliculasRango(), this.productos());
  }

  exportarExcel() {
    this.reportes.exportarExcel(this.filas(), this.peliculasRango(), this.productos());
  }

  // ── Ayudas para el template ──

  /** Ancho de cada barra en % respecto de la primera (la más vista). */
  porcentaje(valor: number, lista: Ranking[]): number {
    return lista.length ? (valor / lista[0].cantidad) * 100 : 0;
  }

  descripcion(lista: Ranking[]): string {
    return lista.slice(0, 8).map((x) => `${x.nombre} ${x.cantidad}`).join(', ') || 'sin datos';
  }

  dia(iso: string): string {
    return desdeISOFecha(iso).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  diaCorto(iso: string): string {
    return formatearFechaAR(iso).slice(0, 5);
  }
}
