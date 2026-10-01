import { Component, input, output } from '@angular/core';
import { EstadoButacas } from '../../services/butacas-service';
import { ButacaDef, LAYOUT_SALA } from '../../utils/sala-layout';

type EstadoVisual = 'libre' | 'vendida' | 'ajena' | 'elegida' | 'fuera';

/**
 * Mapa de la sala visto desde arriba: pantalla adelante, VIP atrás y la fila accesible en el medio.
 * - modo "compra": el cliente elige butacas (ve las vendidas y las que otra persona está eligiendo).
 * - modo "admin": el administrador marca butacas fuera de servicio.
 * El padre decide qué hacer con cada clic (output butacaClick).
 */
@Component({
  selector: 'app-mapa-butacas',
  templateUrl: './mapa-butacas.html',
  styleUrl: './mapa-butacas.scss',
})
export class MapaButacas {
  readonly layout = LAYOUT_SALA;
  estado = input<EstadoButacas | null>(null);
  seleccionadas = input<string[]>([]);
  fueraDeServicio = input<string[]>([]);
  modo = input<'compra' | 'admin'>('compra');
  butacaClick = output<ButacaDef>();

  estadoDe(b: ButacaDef): EstadoVisual {
    if (this.fueraDeServicio().includes(b.id)) return 'fuera';
    if (this.modo() === 'admin') return 'libre';
    if (this.seleccionadas().includes(b.id)) return 'elegida';
    if (this.estado()?.vendidas.includes(b.id)) return 'vendida';
    if (this.estado()?.ajenas.includes(b.id)) return 'ajena';
    return 'libre';
  }

  clickeable(b: ButacaDef): boolean {
    const e = this.estadoDe(b);
    return this.modo() === 'admin' || e === 'libre' || e === 'elegida';
  }

  descripcion(b: ButacaDef): string {
    const tipo = b.tipo === 'vip' ? ', VIP' : b.tipo === 'accesible' ? ', accesible' : '';
    const estados: Record<EstadoVisual, string> = {
      libre: 'libre',
      vendida: 'vendida',
      ajena: 'la está eligiendo otra persona',
      elegida: 'elegida',
      fuera: 'fuera de servicio',
    };
    return `Fila ${b.fila}, butaca ${b.numero}${tipo}, ${estados[this.estadoDe(b)]}`;
  }
}
