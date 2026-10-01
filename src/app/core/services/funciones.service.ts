import { Injectable, inject } from '@angular/core';
import { Observable, map, of, throwError } from 'rxjs';
import { Formato, Funcion, Idioma, Sala } from '../models/models';
import { DbService } from './db.service';
import { ActividadService } from './actividad.service';
import { ConfiguracionService } from './configuracion.service';
import { aISOFecha, combinarFechaHora, desdeISOFecha, formatearFechaAR, mismoDia, sumarDias, sumarMinutos } from '../utils/fechas';

export interface ProgramacionFunciones {
  peliculaId: string;
  desde: string; // yyyy-mm-dd
  hasta: string; // yyyy-mm-dd
  dias: number[]; // 0=domingo … 6=sábado
  horarios: string[]; // "HH:mm"
  formato: Formato;
  idioma: Idioma;
  precio: number;
  precioVip: number;
}

export interface ResultadoProgramacion {
  creadas: Funcion[];
  conflictos: { fecha: string; hora: string; motivo: string }[];
}

@Injectable({ providedIn: 'root' })
export class FuncionesService {
  private readonly db = inject(DbService);
  private readonly actividad = inject(ActividadService);
  private readonly config = inject(ConfiguracionService);

  readonly funciones$: Observable<Funcion[]> = this.db
    .lista$('funciones')
    .pipe(map((l) => [...l].sort((a, b) => a.inicio.localeCompare(b.inicio))));

  /** Funciones futuras de una película, ordenadas. */
  proximasDe$(peliculaId: string): Observable<Funcion[]> {
    return this.funciones$.pipe(map((l) => l.filter((f) => f.peliculaId === peliculaId && new Date(f.inicio) > new Date())));
  }

  porId$(id: string): Observable<Funcion | undefined> {
    return this.db.lista$('funciones').pipe(map((l) => l.find((f) => f.id === id)));
  }

  /**
   * Genera las funciones para cada día/horario del rango y les asigna sala automáticamente.
   * Regla: nunca dos funciones en la misma sala a la vez, y siempre deben pasar
   * `minutosLimpieza` (30) entre el fin de una función y el inicio de la siguiente.
   */
  programar(req: ProgramacionFunciones, opciones: { permitirPasado?: boolean; silencioso?: boolean } = {}): ResultadoProgramacion {
    const peli = this.db.porId('peliculas', req.peliculaId);
    if (!peli) throw new Error('Película inexistente');
    const resultado: ResultadoProgramacion = { creadas: [], conflictos: [] };
    const fin = desdeISOFecha(req.hasta);
    const horarios = [...req.horarios].sort();

    for (let d = desdeISOFecha(req.desde); d <= fin; d = sumarDias(d, 1)) {
      if (!req.dias.includes(d.getDay())) continue;
      for (const hora of horarios) {
        const fecha = aISOFecha(d);
        const inicio = combinarFechaHora(fecha, hora);
        if (!opciones.permitirPasado && inicio < new Date()) {
          resultado.conflictos.push({ fecha, hora, motivo: 'El horario ya pasó' });
          continue;
        }
        const finFuncion = sumarMinutos(inicio, peli.duracionMin);
        const sala = this.buscarSalaLibre(inicio, finFuncion);
        if (!sala) {
          resultado.conflictos.push({ fecha, hora, motivo: 'No hay salas libres en ese horario' });
          continue;
        }
        const f = this.db.insertar('funciones', {
          peliculaId: peli.id,
          salaId: sala.id,
          inicio: inicio.toISOString(),
          fin: finFuncion.toISOString(),
          formato: req.formato,
          idioma: req.idioma,
          precio: req.precio,
          precioVip: req.precioVip,
        });
        resultado.creadas.push(f);
      }
    }
    if (!opciones.silencioso && resultado.creadas.length) {
      this.actividad.registrar(
        'Creó funciones',
        `${peli.titulo}: ${resultado.creadas.length} funciones del ${formatearFechaAR(req.desde)} al ${formatearFechaAR(req.hasta)} (${horarios.join(', ')})`,
      );
    }
    return resultado;
  }

  /** Busca una sala activa sin superposición. Entre las libres elige la menos usada ese día (reparte la carga). */
  buscarSalaLibre(inicio: Date, fin: Date, ignorarFuncionId?: string): Sala | null {
    const limpieza = this.config.config.minutosLimpieza;
    const funciones = this.db.foto('funciones').filter((f) => f.id !== ignorarFuncionId);
    const libres = this.db
      .foto('salas')
      .filter((s) => s.activa)
      .filter((s) =>
        funciones
          .filter((f) => f.salaId === s.id)
          .every((f) => {
            const fi = new Date(f.inicio);
            const ff = new Date(f.fin);
            // libre si la nueva empieza 30' después de que termina la otra, o termina 30' antes de que empiece
            return inicio >= sumarMinutos(ff, limpieza) || sumarMinutos(fin, limpieza) <= fi;
          }),
      );
    if (!libres.length) return null;
    const usoDelDia = (s: Sala) => funciones.filter((f) => f.salaId === s.id && mismoDia(new Date(f.inicio), inicio)).length;
    return libres.sort((a, b) => usoDelDia(a) - usoDelDia(b) || a.nombre.localeCompare(b.nombre, 'es', { numeric: true }))[0];
  }

  actualizarPrecios(id: string, precio: number, precioVip: number): Observable<Funcion> {
    const anterior = this.db.porId('funciones', id);
    if (!anterior) return throwError(() => new Error('Función inexistente'));
    const f = this.db.actualizar('funciones', id, { precio, precioVip });
    const peli = this.db.porId('peliculas', f.peliculaId);
    this.actividad.registrar(
      'Modificó precio de función',
      `${peli?.titulo} ${new Date(f.inicio).toLocaleString('es-AR')}: $${anterior.precio}/$${anterior.precioVip} VIP → $${precio}/$${precioVip} VIP`,
    );
    return of(f);
  }

  eliminar(id: string): Observable<void> {
    if (this.db.foto('pedidos').some((p) => p.funcionId === id && p.estado === 'pagada')) {
      return throwError(() => new Error('La función ya tiene entradas vendidas y no se puede eliminar.'));
    }
    const f = this.db.porId('funciones', id);
    const peli = f ? this.db.porId('peliculas', f.peliculaId) : undefined;
    this.db.eliminar('funciones', id);
    this.actividad.registrar('Eliminó función', `${peli?.titulo ?? ''} ${f ? new Date(f.inicio).toLocaleString('es-AR') : id}`);
    return of(void 0);
  }
}
