import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { DbService } from './db.service';
import { FuncionesService } from './funciones.service';
import { Formato, Idioma, Pelicula } from '../models/models';
import { aISOFecha, desdeISOFecha, sumarDias } from '../utils/fechas';
import { LAYOUT_SALA } from '../utils/sala-layout';
import { nuevoCodigoEntrada } from '../utils/ids';

type PeliculaSemilla = Pelicula & { _offsetEstreno?: number };

/**
 * Datos de demostración: ajusta fechas relativas a hoy, programa funciones y genera ventas
 * pasadas para que el panel de reportes tenga información. Al conectar Supabase se puede borrar.
 */
@Injectable({ providedIn: 'root' })
export class DemoService {
  private readonly db = inject(DbService);
  private readonly funciones = inject(FuncionesService);

  preparar(): Observable<void> {
    return this.db.inicializar().pipe(
      map((recienSembrado) => {
        if (recienSembrado) this.sembrar();
        else this.completarFuncionesFuturas();
      }),
    );
  }

  /** Borra todo y vuelve a cargar los datos de demostración (desde Configuración del admin). */
  reiniciar(): Observable<void> {
    return this.db.reiniciar().pipe(map(() => this.sembrar()));
  }

  private sembrar(): void {
    const hoy = new Date();
    const pelis = (this.db.foto('peliculas') as PeliculaSemilla[]).map(({ _offsetEstreno, ...p }) =>
      _offsetEstreno === undefined ? p : { ...p, fechaEstreno: aISOFecha(sumarDias(hoy, _offsetEstreno)) },
    );
    this.db.reemplazarTodo('peliculas', pelis);
    this.programar(sumarDias(hoy, -30), sumarDias(hoy, -1), true);
    this.programar(hoy, sumarDias(hoy, 14), false);
    this.generarVentasPasadas();
  }

  private completarFuncionesFuturas(): void {
    const hayFuturas = this.db.foto('funciones').some((f) => new Date(f.inicio) > new Date());
    if (!hayFuturas && this.db.foto('peliculas').length) this.programar(new Date(), sumarDias(new Date(), 14), false);
  }

  private programar(desde: Date, hasta: Date, pasado: boolean): void {
    const horarios = [['14:00', '19:30'], ['15:10', '20:40'], ['16:20', '22:00'], ['13:30', '18:10'], ['17:00', '21:45'], ['14:40', '23:00']];
    const formatos: Formato[] = ['2D', '3D', '2D', '4D', '2D', '5D'];
    const idiomas: Idioma[] = ['subtitulada', 'castellano'];
    const pelis = this.db.foto('peliculas').filter((p) => p.estado !== 'inactiva');
    pelis.forEach((p, i) => {
      // Las funciones arrancan el día del estreno (la preventa vende funciones posteriores al estreno)
      const estreno = desdeISOFecha(p.fechaEstreno);
      const desdeReal = estreno > desde ? estreno : desde;
      if (desdeReal > hasta) return;
      this.funciones.programar(
        {
          peliculaId: p.id,
          desde: aISOFecha(desdeReal),
          hasta: aISOFecha(hasta),
          dias: [0, 1, 2, 3, 4, 5, 6],
          horarios: horarios[i % horarios.length],
          formato: formatos[i % formatos.length],
          idioma: idiomas[i % 2],
          precio: 6500 + (i % 3) * 500,
          precioVip: 9500 + (i % 3) * 500,
        },
        { permitirPasado: pasado, silencioso: true },
      );
    });
  }

  private generarVentasPasadas(): void {
    const clientes = this.db.foto('usuarios').filter((u) => u.rol === 'cliente');
    const productos = this.db.foto('productos');
    const asientos = LAYOUT_SALA.flatMap((f) => f.bloques[1]).map((b) => b.id);
    const pasadas = this.db.foto('funciones').filter((f) => new Date(f.inicio) < new Date());
    const pedidos = [];
    let semilla = 7;
    const azar = () => (semilla = (semilla * 9301 + 49297) % 233280) / 233280;
    for (const f of pasadas) {
      const cantidad = Math.floor(azar() * 5);
      const usados = new Set<string>();
      for (let i = 0; i < cantidad; i++) {
        const n = 1 + Math.floor(azar() * 3);
        const butacas: string[] = [];
        while (butacas.length < n) {
          const b = asientos[Math.floor(azar() * asientos.length)];
          if (!usados.has(b)) { usados.add(b); butacas.push(b); }
        }
        const prod = productos[Math.floor(azar() * productos.length)];
        const conCandy = azar() > 0.45 && prod;
        const total = butacas.length * f.precio + (conCandy ? prod.precio * n : 0);
        const cliente = azar() > 0.5 ? clientes[Math.floor(azar() * clientes.length)] : undefined;
        const creado = new Date(new Date(f.inicio).getTime() - (1 + azar() * 20) * 3_600_000);
        pedidos.push({
          codigo: nuevoCodigoEntrada(),
          usuarioId: cliente?.id ?? null,
          comprador: cliente ? { nombre: `${cliente.nombre} ${cliente.apellido}`, email: cliente.email } : { nombre: 'Cliente mostrador', email: 'anonimo@demo.com' },
          funcionId: f.id,
          butacas,
          items: conCandy ? [{ tipo: 'producto' as const, refId: prod.id, nombre: prod.nombre, cantidad: n, precioUnit: prod.precio }] : [],
          subtotal: total,
          descuento: 0,
          cuponCodigo: null,
          creditoUsado: 0,
          puntosUsados: 0,
          puntosGanados: 0,
          total,
          estado: 'pagada' as const,
          requiereAdulto: false,
          esPreventa: false,
          entradaValidada: { fecha: f.inicio, porId: 'demo', porNombre: 'Demo' },
          candyEntregado: conCandy ? { fecha: f.inicio, porId: 'demo', porNombre: 'Demo' } : null,
          creadoEn: creado.toISOString(),
        });
      }
    }
    this.db.insertarVarios('pedidos', pedidos);
  }
}
