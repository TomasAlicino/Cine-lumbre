import { Injectable, inject } from '@angular/core';
import { Formato, Funcion, FuncionCompleta, Idioma, Sala } from '../models/models';
import { aISOFecha, combinarFechaHora, desdeISOFecha, formatearFechaAR, mismoDia, sumarDias, sumarMinutos } from '../utils/fechas';
import { ActividadService } from './actividad-service';
import { ConfiguracionService } from './configuracion-service';
import { SupabaseService } from './supabase-service';

export interface ProgramacionFunciones {
  pelicula_id: number;
  desde: string; // yyyy-mm-dd
  hasta: string; // yyyy-mm-dd
  dias: number[]; // 0 = domingo … 6 = sábado
  horarios: string[]; // "HH:mm"
  formato: Formato;
  idioma: Idioma;
  precio: number;
  precio_vip: number;
}

export interface ResultadoProgramacion {
  creadas: number;
  conflictos: { fecha: string; hora: string; motivo: string }[];
}

type FuncionNueva = Omit<Funcion, 'id'>;

@Injectable({ providedIn: 'root' })
export class FuncionesService {
  private supabase = inject(SupabaseService).cliente;
  private actividad = inject(ActividadService);
  private config = inject(ConfiguracionService);

  /** Funciones que todavía no empezaron de una película, con su sala. */
  async proximasDe(peliculaId: number): Promise<FuncionCompleta[]> {
    const { data, error } = await this.supabase
      .from('funciones')
      .select('*, peliculas(*), salas(*)')
      .eq('pelicula_id', peliculaId)
      .gt('inicio', new Date().toISOString())
      .order('inicio', { ascending: true });
    if (error) throw new Error(error.message);
    return data as FuncionCompleta[];
  }

  async porId(id: number): Promise<FuncionCompleta | null> {
    const { data, error } = await this.supabase.from('funciones').select('*, peliculas(*), salas(*)').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data as FuncionCompleta | null;
  }

  /** Funciones que empiezan entre dos fechas (para el panel de admin). */
  async entre(desde: Date, hasta: Date): Promise<FuncionCompleta[]> {
    const { data, error } = await this.supabase
      .from('funciones')
      .select('*, peliculas(*), salas(*)')
      .gte('inicio', desde.toISOString())
      .lt('inicio', hasta.toISOString())
      .order('inicio', { ascending: true });
    if (error) throw new Error(error.message);
    return data as FuncionCompleta[];
  }

  /**
   * Genera las funciones de cada día y horario del rango y les asigna sala automáticamente.
   * Reglas: nunca dos funciones en la misma sala a la vez, siempre pasan `minutos_limpieza` (30)
   * entre una función y la siguiente, y no hay funciones antes del estreno.
   */
  async programar(req: ProgramacionFunciones): Promise<ResultadoProgramacion> {
    const [{ data: peli, error: e1 }, { data: salas, error: e2 }] = await Promise.all([
      this.supabase.from('peliculas').select('*').eq('id', req.pelicula_id).single(),
      this.supabase.from('salas').select('*').eq('activa', true).order('nombre'),
    ]);
    if (e1 || e2) throw new Error((e1 ?? e2)!.message);

    // Funciones existentes alrededor del rango (un día antes y después por las trasnoches)
    const { data: existentes, error: e3 } = await this.supabase
      .from('funciones')
      .select('*')
      .gte('inicio', sumarDias(desdeISOFecha(req.desde), -1).toISOString())
      .lt('inicio', sumarDias(desdeISOFecha(req.hasta), 2).toISOString());
    if (e3) throw new Error(e3.message);

    const ocupadas: FuncionNueva[] = [...(existentes as Funcion[])];
    const nuevas: FuncionNueva[] = [];
    const conflictos: ResultadoProgramacion['conflictos'] = [];
    const estreno = desdeISOFecha(peli.fecha_estreno);
    const horarios = [...req.horarios].sort();

    for (let d = desdeISOFecha(req.desde); d <= desdeISOFecha(req.hasta); d = sumarDias(d, 1)) {
      if (!req.dias.includes(d.getDay())) continue;
      for (const hora of horarios) {
        const fecha = aISOFecha(d);
        const inicio = combinarFechaHora(fecha, hora);
        if (inicio < new Date()) {
          conflictos.push({ fecha, hora, motivo: 'El horario ya pasó' });
          continue;
        }
        if (inicio < estreno) {
          conflictos.push({ fecha, hora, motivo: 'Es antes del estreno' });
          continue;
        }
        const fin = sumarMinutos(inicio, peli.duracion_min);
        const sala = this.buscarSalaLibre(inicio, fin, salas as Sala[], ocupadas);
        if (!sala) {
          conflictos.push({ fecha, hora, motivo: 'No hay salas libres en ese horario' });
          continue;
        }
        const funcion: FuncionNueva = {
          pelicula_id: req.pelicula_id,
          sala_id: sala.id,
          inicio: inicio.toISOString(),
          fin: fin.toISOString(),
          formato: req.formato,
          idioma: req.idioma,
          precio: req.precio,
          precio_vip: req.precio_vip,
        };
        nuevas.push(funcion);
        ocupadas.push(funcion); // las siguientes del mismo lote ya la tienen en cuenta
      }
    }

    if (nuevas.length) {
      const { error } = await this.supabase.from('funciones').insert(nuevas);
      if (error) throw new Error(error.message);
      await this.actividad.registrar(
        'Creó funciones',
        `${peli.titulo}: ${nuevas.length} funciones del ${formatearFechaAR(req.desde)} al ${formatearFechaAR(req.hasta)} (${horarios.join(', ')})`,
      );
    }
    return { creadas: nuevas.length, conflictos };
  }

  /**
   * Devuelve una sala activa sin superposición, o null.
   * Entre las libres elige la que tiene menos funciones ese día (reparte la carga).
   */
  buscarSalaLibre(inicio: Date, fin: Date, salas: Sala[], funciones: FuncionNueva[]): Sala | null {
    const limpieza = this.config.config().minutos_limpieza;
    const libres = salas.filter((s) =>
      funciones
        .filter((f) => f.sala_id === s.id)
        // libre si la nueva empieza 30' después de que termina la otra, o termina 30' antes de que empiece
        .every((f) => inicio >= sumarMinutos(new Date(f.fin), limpieza) || sumarMinutos(fin, limpieza) <= new Date(f.inicio)),
    );
    if (!libres.length) return null;
    const usoDelDia = (s: Sala) => funciones.filter((f) => f.sala_id === s.id && mismoDia(new Date(f.inicio), inicio)).length;
    return libres.sort((a, b) => usoDelDia(a) - usoDelDia(b) || a.nombre.localeCompare(b.nombre, 'es', { numeric: true }))[0];
  }

  async actualizarPrecios(f: FuncionCompleta, precio: number, precioVip: number): Promise<void> {
    const { error } = await this.supabase.from('funciones').update({ precio, precio_vip: precioVip }).eq('id', f.id);
    if (error) throw new Error(error.message);
    await this.actividad.registrar(
      'Modificó precio de función',
      `${f.peliculas.titulo} ${new Date(f.inicio).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23' })}: $${f.precio}/$${f.precio_vip} VIP → $${precio}/$${precioVip} VIP`,
    );
  }

  async eliminar(f: FuncionCompleta): Promise<void> {
    const { error } = await this.supabase.from('funciones').delete().eq('id', f.id);
    if (error?.code === '23503') throw new Error('La función ya tiene entradas vendidas y no se puede eliminar.');
    if (error) throw new Error(error.message);
    await this.actividad.registrar('Eliminó función', `${f.peliculas.titulo} ${new Date(f.inicio).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23' })}`);
  }
}
