import { Injectable, inject } from '@angular/core';
import { Observable, combineLatest, map } from 'rxjs';
import { DbService } from './db.service';
import { aISOFecha, desdeISOFecha, formatearFechaAR, sumarDias } from '../utils/fechas';

export interface FilaFacturacion {
  fecha: string; // yyyy-mm-dd
  pedidos: number;
  entradas: number;
  facturacion: number;
}

export interface Ranking {
  id: string;
  nombre: string;
  cantidad: number;
}

@Injectable({ providedIn: 'root' })
export class ReportesService {
  private readonly db = inject(DbService);

  /** Facturación diaria (según la fecha de compra) de pedidos no cancelados. */
  facturacion$(desde: string, hasta: string): Observable<FilaFacturacion[]> {
    return this.db.lista$('pedidos').pipe(
      map((pedidos) => {
        const filas = new Map<string, FilaFacturacion>();
        for (let d = desdeISOFecha(desde); d <= desdeISOFecha(hasta); d = sumarDias(d, 1)) {
          const f = aISOFecha(d);
          filas.set(f, { fecha: f, pedidos: 0, entradas: 0, facturacion: 0 });
        }
        for (const p of pedidos) {
          if (p.estado !== 'pagada') continue;
          const fila = filas.get(aISOFecha(new Date(p.creadoEn)));
          if (!fila) continue;
          fila.pedidos++;
          fila.entradas += p.butacas.length;
          fila.facturacion += p.total + p.creditoUsado;
        }
        return [...filas.values()];
      }),
    );
  }

  /** Películas más vistas (entradas de funciones dentro del período). */
  peliculasMasVistas$(desde: Date, hasta: Date): Observable<Ranking[]> {
    return combineLatest([this.db.lista$('pedidos'), this.db.lista$('funciones'), this.db.lista$('peliculas')]).pipe(
      map(([pedidos, funciones, pelis]) => {
        const fun = new Map(funciones.map((f) => [f.id, f]));
        const conteo = new Map<string, number>();
        for (const p of pedidos) {
          if (p.estado !== 'pagada') continue;
          const f = fun.get(p.funcionId);
          if (!f) continue;
          const inicio = new Date(f.inicio);
          if (inicio < desde || inicio >= hasta) continue;
          conteo.set(f.peliculaId, (conteo.get(f.peliculaId) ?? 0) + p.butacas.length);
        }
        return [...conteo]
          .map(([id, cantidad]) => ({ id, cantidad, nombre: pelis.find((x) => x.id === id)?.titulo ?? '—' }))
          .sort((a, b) => b.cantidad - a.cantidad);
      }),
    );
  }

  /** Productos del candy más vendidos (sueltos, dentro de combos y canjeados). */
  productosMasVendidos$(desde: Date, hasta: Date): Observable<Ranking[]> {
    return combineLatest([this.db.lista$('pedidos'), this.db.lista$('productos'), this.db.lista$('combos')]).pipe(
      map(([pedidos, productos, combos]) => {
        const conteo = new Map<string, number>();
        const sumar = (id: string, n: number) => conteo.set(id, (conteo.get(id) ?? 0) + n);
        for (const p of pedidos) {
          const fecha = new Date(p.creadoEn);
          if (p.estado !== 'pagada' || fecha < desde || fecha >= hasta) continue;
          for (const i of p.items) {
            if (i.tipo === 'producto') sumar(i.refId, i.cantidad);
            if (i.tipo === 'recompensa' && productos.some((x) => x.id === i.refId)) sumar(i.refId, i.cantidad);
            if (i.tipo === 'combo') {
              const c = combos.find((x) => x.id === i.refId);
              c?.items.forEach((ci) => sumar(ci.productoId, ci.cantidad * i.cantidad));
            }
          }
        }
        return [...conteo]
          .map(([id, cantidad]) => ({ id, cantidad, nombre: productos.find((x) => x.id === id)?.nombre ?? '—' }))
          .sort((a, b) => b.cantidad - a.cantidad);
      }),
    );
  }

  async exportarPdf(filas: FilaFacturacion[], titulo: string): Promise<void> {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Cine Lumbre', 14, 18);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(titulo, 14, 26);
    let y = 38;
    const cols = [14, 60, 100, 140];
    doc.setFont('helvetica', 'bold');
    ['Fecha', 'Compras', 'Entradas', 'Facturación'].forEach((t, i) => doc.text(t, cols[i], y));
    doc.setFont('helvetica', 'normal');
    doc.line(14, y + 2, 196, y + 2);
    y += 9;
    for (const f of filas) {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(formatearFechaAR(f.fecha), cols[0], y);
      doc.text(String(f.pedidos), cols[1], y);
      doc.text(String(f.entradas), cols[2], y);
      doc.text(this.pesos(f.facturacion), cols[3], y);
      y += 7;
    }
    doc.line(14, y - 4, 196, y - 4);
    doc.setFont('helvetica', 'bold');
    doc.text('Total', cols[0], y + 2);
    doc.text(String(filas.reduce((a, f) => a + f.pedidos, 0)), cols[1], y + 2);
    doc.text(String(filas.reduce((a, f) => a + f.entradas, 0)), cols[2], y + 2);
    doc.text(this.pesos(filas.reduce((a, f) => a + f.facturacion, 0)), cols[3], y + 2);
    doc.save(`facturacion-${filas[0]?.fecha ?? ''}.pdf`);
  }

  async exportarExcel(filas: FilaFacturacion[]): Promise<void> {
    const XLSX = await import('xlsx');
    const datos = filas.map((f) => ({ Fecha: formatearFechaAR(f.fecha), Compras: f.pedidos, Entradas: f.entradas, Facturación: f.facturacion }));
    datos.push({
      Fecha: 'Total',
      Compras: filas.reduce((a, f) => a + f.pedidos, 0),
      Entradas: filas.reduce((a, f) => a + f.entradas, 0),
      Facturación: filas.reduce((a, f) => a + f.facturacion, 0),
    });
    const hoja = XLSX.utils.json_to_sheet(datos);
    hoja['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 }];
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Facturación');
    XLSX.writeFile(libro, `facturacion-${filas[0]?.fecha ?? ''}.xlsx`);
  }

  private pesos(n: number): string {
    return '$ ' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
