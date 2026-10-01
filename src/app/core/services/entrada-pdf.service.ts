import { Injectable, inject } from '@angular/core';
import { DbService } from './db.service';
import { Pedido } from '../models/models';
import { tipoDeButaca } from '../utils/sala-layout';

/** Genera el QR y el PDF de la entrada. El QR contiene solo el código del pedido. */
@Injectable({ providedIn: 'root' })
export class EntradaPdfService {
  private readonly db = inject(DbService);

  async qrDataUrl(codigo: string): Promise<string> {
    const QR = await import('qrcode');
    return QR.toDataURL(codigo, { margin: 1, width: 320, errorCorrectionLevel: 'M', color: { dark: '#141b2e', light: '#ffffff' } });
  }

  async descargar(pedido: Pedido): Promise<void> {
    const f = this.db.porId('funciones', pedido.funcionId);
    const p = f ? this.db.porId('peliculas', f.peliculaId) : undefined;
    const sala = f ? this.db.porId('salas', f.salaId) : undefined;
    if (!f || !p) return;
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: [100, 190] });
    const qr = await this.qrDataUrl(pedido.codigo);
    const inicio = new Date(f.inicio);

    doc.setFillColor(20, 27, 46);
    doc.rect(0, 0, 100, 30, 'F');
    doc.setTextColor(224, 178, 92);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('CINE LUMBRE', 8, 13);
    doc.setTextColor(243, 239, 228);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Entrada digital · presentá este QR en la sala y en el candy', 8, 21);

    doc.setTextColor(20, 27, 46);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(doc.splitTextToSize(p.titulo, 84), 8, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    let y = 56;
    const fila = (etiqueta: string, valor: string) => {
      doc.setTextColor(110, 118, 140);
      doc.text(etiqueta, 8, y);
      doc.setTextColor(20, 27, 46);
      doc.text(doc.splitTextToSize(valor, 58), 34, y);
      y += 6 * Math.max(1, doc.splitTextToSize(valor, 58).length);
    };
    fila('Fecha', inicio.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }));
    fila('Hora', inicio.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + ' h');
    fila('Sala', sala?.nombre ?? '—');
    fila('Formato', `${f.formato} · ${f.idioma === 'castellano' ? 'Castellano' : 'Subtitulada'}`);
    fila('Butacas', pedido.butacas.map((b) => `${b}${tipoDeButaca(b) === 'vip' ? ' VIP' : tipoDeButaca(b) === 'accesible' ? ' (accesible)' : ''}`).join(', '));
    if (pedido.items.length) fila('Candy', pedido.items.map((i) => `${i.cantidad}× ${i.nombre}`).join(', '));
    fila('Titular', pedido.comprador.nombre);
    fila('Total', '$ ' + (pedido.total + pedido.creditoUsado).toLocaleString('es-AR'));

    if (pedido.requiereAdulto) {
      doc.setFillColor(179, 48, 63);
      doc.rect(8, y, 84, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`Película ${p.clasificacion}: debe asistir un adulto.`, 11, y + 7.5);
      y += 16;
    }

    doc.addImage(qr, 'PNG', 25, y + 2, 50, 50);
    doc.setTextColor(20, 27, 46);
    doc.setFont('courier', 'bold');
    doc.setFontSize(13);
    doc.text(pedido.codigo, 50, y + 60, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(110, 118, 140);
    doc.text('El QR se invalida al ingresar a la sala y al retirar el candy.', 50, y + 66, { align: 'center' });
    doc.save(`entrada-${pedido.codigo}.pdf`);
  }
}
