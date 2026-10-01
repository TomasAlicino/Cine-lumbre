import { Injectable, inject } from '@angular/core';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { Combo, ItemPedido, Pedido, Producto } from '../models/models';
import { aISOFecha, desdeISOFecha, formatearFechaAR, sumarDias } from '../utils/fechas';
import { SupabaseService } from './supabase-service';

export interface FilaFacturacion {
  fecha: string; // yyyy-mm-dd
  pedidos: number;
  entradas: number;
  facturacion: number;
}

export interface Ranking {
  id: number;
  nombre: string;
  cantidad: number;
}

/** Reportes del admin: facturación diaria, películas más vistas y productos más vendidos. */
@Injectable({ providedIn: 'root' })
export class ReportesService {
  private supabase = inject(SupabaseService).cliente;

  /** Facturación por día de compra (sin las compras canceladas). */
  async facturacion(desde: string, hasta: string): Promise<FilaFacturacion[]> {
    const { data, error } = await this.supabase
      .from('pedidos')
      .select('creado_en, butacas, total, credito_usado')
      .eq('estado', 'pagada')
      .gte('creado_en', desdeISOFecha(desde).toISOString())
      .lt('creado_en', sumarDias(desdeISOFecha(hasta), 1).toISOString());
    if (error) throw new Error(error.message);

    const filas = new Map<string, FilaFacturacion>();
    for (let d = desdeISOFecha(desde); d <= desdeISOFecha(hasta); d = sumarDias(d, 1)) {
      filas.set(aISOFecha(d), { fecha: aISOFecha(d), pedidos: 0, entradas: 0, facturacion: 0 });
    }
    for (const p of data as Pick<Pedido, 'creado_en' | 'butacas' | 'total' | 'credito_usado'>[]) {
      const fila = filas.get(aISOFecha(new Date(p.creado_en)));
      if (!fila) continue;
      fila.pedidos++;
      fila.entradas += p.butacas.length;
      fila.facturacion += p.total + p.credito_usado;
    }
    return [...filas.values()];
  }

  /** Entradas vendidas por película para funciones dentro del período. */
  async peliculasMasVistas(desde: Date, hasta: Date): Promise<Ranking[]> {
    const { data: funciones, error } = await this.supabase
      .from('funciones')
      .select('id, pelicula_id, peliculas(titulo)')
      .gte('inicio', desde.toISOString())
      .lt('inicio', hasta.toISOString());
    if (error) throw new Error(error.message);
    const lista = funciones as unknown as { id: number; pelicula_id: number; peliculas: { titulo: string } }[];
    if (!lista.length) return [];

    const { data: vendidas, error: e2 } = await this.supabase.from('butacas_vendidas').select('funcion_id').in('funcion_id', lista.map((f) => f.id));
    if (e2) throw new Error(e2.message);

    const conteo = new Map<number, Ranking>();
    for (const v of vendidas as { funcion_id: number }[]) {
      const f = lista.find((x) => x.id === v.funcion_id)!;
      const r = conteo.get(f.pelicula_id) ?? { id: f.pelicula_id, nombre: f.peliculas.titulo, cantidad: 0 };
      r.cantidad++;
      conteo.set(f.pelicula_id, r);
    }
    return [...conteo.values()].sort((a, b) => b.cantidad - a.cantidad);
  }

  /** Productos del candy más vendidos: sueltos, dentro de combos y canjeados con puntos. */
  async productosMasVendidos(desde: Date, hasta: Date): Promise<Ranking[]> {
    const [pedidos, productos, combos] = await Promise.all([
      this.supabase.from('pedidos').select('items').eq('estado', 'pagada').gte('creado_en', desde.toISOString()).lt('creado_en', hasta.toISOString()),
      this.supabase.from('productos').select('*'),
      this.supabase.from('combos').select('*'),
    ]);
    const error = pedidos.error ?? productos.error ?? combos.error;
    if (error) throw new Error(error.message);

    const conteo = new Map<number, number>();
    const sumar = (id: number, n: number) => conteo.set(id, (conteo.get(id) ?? 0) + n);
    for (const p of pedidos.data as { items: ItemPedido[] }[]) {
      for (const i of p.items) {
        if (i.tipo === 'producto' || i.tipo === 'canje-producto') sumar(i.ref_id, i.cantidad);
        if (i.tipo === 'combo') {
          const combo = (combos.data as Combo[]).find((c) => c.id === i.ref_id);
          combo?.items.forEach((ci) => sumar(ci.producto_id, ci.cantidad * i.cantidad));
        }
      }
    }
    return [...conteo]
      .map(([id, cantidad]) => ({ id, cantidad, nombre: (productos.data as Producto[]).find((x) => x.id === id)?.nombre ?? '—' }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }

  // ─────────────────────────────── Exportar ───────────────────────────────

  exportarPdf(titulo: string, filas: FilaFacturacion[], peliculas: Ranking[], productos: Ranking[]): void {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Cine Lumbre', 14, 18);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(titulo, 14, 26);

    let y = 38;
    const tabla = (encabezados: string[], columnas: number[], datos: string[][], total?: string[]) => {
      doc.setFont('helvetica', 'bold');
      encabezados.forEach((t, i) => doc.text(t, columnas[i], y));
      doc.line(14, y + 2, 196, y + 2);
      doc.setFont('helvetica', 'normal');
      y += 9;
      for (const fila of datos) {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        fila.forEach((t, i) => doc.text(t, columnas[i], y));
        y += 7;
      }
      if (total) {
        doc.line(14, y - 4, 196, y - 4);
        doc.setFont('helvetica', 'bold');
        total.forEach((t, i) => doc.text(t, columnas[i], y + 2));
        y += 8;
      }
      y += 8;
    };

    tabla(
      ['Fecha', 'Compras', 'Entradas', 'Facturación'],
      [14, 60, 100, 140],
      filas.map((f) => [formatearFechaAR(f.fecha), String(f.pedidos), String(f.entradas), this.pesos(f.facturacion)]),
      ['Total', String(this.suma(filas, 'pedidos')), String(this.suma(filas, 'entradas')), this.pesos(this.suma(filas, 'facturacion'))],
    );
    tabla(['Película más vista', 'Entradas'], [14, 140], peliculas.map((r) => [r.nombre, String(r.cantidad)]));
    tabla(['Producto del candy', 'Unidades'], [14, 140], productos.map((r) => [r.nombre, String(r.cantidad)]));
    doc.save(`reporte-${filas[0]?.fecha ?? ''}.pdf`);
  }

  exportarExcel(filas: FilaFacturacion[], peliculas: Ranking[], productos: Ranking[]): void {
    const facturacion = filas.map((f) => ({ Fecha: formatearFechaAR(f.fecha), Compras: f.pedidos, Entradas: f.entradas, Facturación: f.facturacion }));
    facturacion.push({ Fecha: 'Total', Compras: this.suma(filas, 'pedidos'), Entradas: this.suma(filas, 'entradas'), Facturación: this.suma(filas, 'facturacion') });

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(facturacion), 'Facturación');
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(peliculas.map((r) => ({ Película: r.nombre, Entradas: r.cantidad }))), 'Películas');
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(productos.map((r) => ({ Producto: r.nombre, Unidades: r.cantidad }))), 'Candy');
    XLSX.writeFile(libro, `reporte-${filas[0]?.fecha ?? ''}.xlsx`);
  }

  private suma(filas: FilaFacturacion[], campo: 'pedidos' | 'entradas' | 'facturacion'): number {
    return filas.reduce((a, f) => a + f[campo], 0);
  }

  private pesos(n: number): string {
    return '$ ' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
