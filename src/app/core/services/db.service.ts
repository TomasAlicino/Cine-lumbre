import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom, from, map, of, tap } from 'rxjs';
import { COLECCIONES, Colecciones, NombreColeccion } from '../models/models';
import { nuevoId } from '../utils/ids';
import { SupabaseService, TABLA_DATOS } from './supabase.service';
import { ToastService } from './toast.service';

type Semilla = Partial<{ [K in NombreColeccion]: Colecciones[K][] }>;
type ConId = { id: string };
interface FilaRemota { coleccion: NombreColeccion; id: string; data: ConId }

/**
 * Capa de persistencia. Todos los servicios de dominio leen y escriben SOLO a través de esta clase.
 *
 * - Con Supabase configurado (environment.ts): las colecciones viven en la tabla `lumbre_datos`
 *   y los cambios de otros usuarios llegan por Supabase Realtime (butacas en tiempo real).
 * - Sin Supabase: guarda en localStorage y sincroniza pestañas con BroadcastChannel.
 *
 * En ambos casos cada colección se expone como un BehaviorSubject: las lecturas son síncronas
 * (`foto`) u observables (`lista$`) y las escrituras actualizan la UI al instante (optimistic update).
 */
@Injectable({ providedIn: 'root' })
export class DbService {
  private readonly http = inject(HttpClient);
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);
  private readonly prefijo = 'lumbre:';
  private readonly sujetos = new Map<NombreColeccion, BehaviorSubject<unknown[]>>();
  private readonly canal: BroadcastChannel | null =
    !this.supabase.activo && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('lumbre-db') : null;

  constructor() {
    for (const c of COLECCIONES) this.sujetos.set(c, new BehaviorSubject<unknown[]>(this.supabase.activo ? [] : this.leer(c)));
    this.canal?.addEventListener('message', (e: MessageEvent<NombreColeccion | '*'>) => {
      if (e.data === '*') COLECCIONES.forEach((c) => this.sujeto(c).next(this.leer(c)));
      else this.sujeto(e.data).next(this.leer(e.data));
    });
  }

  get remoto(): boolean {
    return this.supabase.activo;
  }

  /** Carga inicial. Si la base está vacía la siembra con data/seed.json (por HTTP). Devuelve true si sembró. */
  inicializar(): Observable<boolean> {
    if (this.remoto) return from(this.inicializarRemoto());
    if (localStorage.getItem(this.prefijo + 'sembrado')) return of(false);
    return this.http.get<Semilla>('data/seed.json').pipe(
      tap((semilla) => {
        for (const c of COLECCIONES) this.guardar(c, (semilla[c] as unknown[]) ?? [], false);
        localStorage.setItem(this.prefijo + 'sembrado', new Date().toISOString());
        this.canal?.postMessage('*');
      }),
      map(() => true),
    );
  }

  reiniciar(): Observable<boolean> {
    if (this.remoto) {
      return from(
        (async () => {
          const { error } = await this.supabase.sb.from(TABLA_DATOS).delete().neq('id', '');
          if (error) throw error;
          COLECCIONES.forEach((c) => this.sujeto(c).next([]));
          return firstValueFrom(this.inicializar());
        })(),
      );
    }
    for (const c of COLECCIONES) localStorage.removeItem(this.prefijo + c);
    localStorage.removeItem(this.prefijo + 'sembrado');
    return this.inicializar();
  }

  lista$<K extends NombreColeccion>(c: K): Observable<Colecciones[K][]> {
    return this.sujeto(c).asObservable() as Observable<Colecciones[K][]>;
  }

  foto<K extends NombreColeccion>(c: K): Colecciones[K][] {
    return this.sujeto(c).value as Colecciones[K][];
  }

  porId<K extends NombreColeccion>(c: K, id: string): Colecciones[K] | undefined {
    return this.foto(c).find((x) => (x as ConId).id === id);
  }

  insertar<K extends NombreColeccion>(c: K, dato: Omit<Colecciones[K], 'id'> & { id?: string }): Colecciones[K] {
    const nuevo = { ...dato, id: dato.id ?? nuevoId() } as Colecciones[K];
    this.guardar(c, [...this.foto(c), nuevo]);
    return nuevo;
  }

  insertarVarios<K extends NombreColeccion>(c: K, datos: (Omit<Colecciones[K], 'id'> & { id?: string })[]): Colecciones[K][] {
    const nuevos = datos.map((d) => ({ ...d, id: d.id ?? nuevoId() }) as Colecciones[K]);
    this.guardar(c, [...this.foto(c), ...nuevos]);
    return nuevos;
  }

  actualizar<K extends NombreColeccion>(c: K, id: string, cambios: Partial<Colecciones[K]>): Colecciones[K] {
    let actualizado: Colecciones[K] | undefined;
    const lista = this.foto(c).map((x) => {
      if ((x as ConId).id !== id) return x;
      actualizado = { ...x, ...cambios, id };
      return actualizado;
    });
    if (!actualizado) throw new Error(`No existe ${c}/${id}`);
    this.guardar(c, lista);
    return actualizado;
  }

  reemplazarTodo<K extends NombreColeccion>(c: K, lista: Colecciones[K][]): void {
    this.guardar(c, lista);
  }

  eliminar(c: NombreColeccion, id: string): void {
    this.guardar(c, this.foto(c).filter((x) => (x as ConId).id !== id));
  }

  eliminarDonde<K extends NombreColeccion>(c: K, predicado: (x: Colecciones[K]) => boolean): void {
    this.guardar(c, this.foto(c).filter((x) => !predicado(x)));
  }

  // ─────────────────────────────── Supabase ───────────────────────────────

  private async inicializarRemoto(): Promise<boolean> {
    const filas = await this.traerTodo();
    let sembro = false;
    if (!filas.length) {
      const semilla = await firstValueFrom(this.http.get<Semilla>('data/seed.json'));
      for (const c of COLECCIONES) this.guardar(c, (semilla[c] as unknown[]) ?? []);
      sembro = true;
    } else {
      for (const c of COLECCIONES) this.sujeto(c).next(filas.filter((f) => f.coleccion === c).map((f) => f.data));
    }
    this.escucharCambios();
    return sembro;
  }

  /** Supabase devuelve como máximo 1000 filas por consulta: se pagina con range(). */
  private async traerTodo(): Promise<FilaRemota[]> {
    const todas: FilaRemota[] = [];
    const pagina = 1000;
    for (let desde = 0; ; desde += pagina) {
      const { data, error } = await this.supabase.sb.from(TABLA_DATOS).select('coleccion,id,data').range(desde, desde + pagina - 1);
      if (error) throw error;
      todas.push(...(data as FilaRemota[]));
      if (!data || data.length < pagina) return todas;
    }
  }

  /** Realtime: aplica en memoria los cambios que hacen otros usuarios (ej. butacas bloqueadas). */
  private escucharCambios(): void {
    this.supabase.sb
      .channel('lumbre-datos')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLA_DATOS }, (payload) => {
        const fila = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Partial<FilaRemota>;
        if (!fila.coleccion || !this.sujetos.has(fila.coleccion)) return;
        const actual = this.foto(fila.coleccion) as ConId[];
        const sinFila = actual.filter((x) => x.id !== fila.id);
        if (payload.eventType === 'DELETE') {
          if (sinFila.length !== actual.length) this.sujeto(fila.coleccion).next(sinFila);
          return;
        }
        const previa = actual.find((x) => x.id === fila.id);
        if (previa && JSON.stringify(previa) === JSON.stringify(fila.data)) return; // eco de un cambio propio
        const lista = previa ? actual.map((x) => (x.id === fila.id ? fila.data! : x)) : [...actual, fila.data!];
        this.sujeto(fila.coleccion).next(lista);
      })
      .subscribe();
  }

  /** Envía a Supabase solo la diferencia entre la lista anterior y la nueva. */
  private async sincronizar(c: NombreColeccion, anterior: ConId[], nueva: ConId[]): Promise<void> {
    const previos = new Map(anterior.map((x) => [x.id, JSON.stringify(x)]));
    const cambiados = nueva.filter((x) => previos.get(x.id) !== JSON.stringify(x));
    const idsNuevos = new Set(nueva.map((x) => x.id));
    const borrados = anterior.filter((x) => !idsNuevos.has(x.id)).map((x) => x.id);
    try {
      if (cambiados.length) {
        const { error } = await this.supabase.sb.from(TABLA_DATOS).upsert(cambiados.map((data) => ({ coleccion: c, id: data.id, data })));
        if (error) throw error;
      }
      if (borrados.length) {
        const { error } = await this.supabase.sb.from(TABLA_DATOS).delete().eq('coleccion', c).in('id', borrados);
        if (error) throw error;
      }
    } catch (e) {
      console.error(`Supabase (${c})`, e);
      this.toast.error('No se pudo guardar en el servidor. Revisá tu conexión.');
    }
  }

  // ─────────────────────────────── Común ───────────────────────────────

  private sujeto(c: NombreColeccion): BehaviorSubject<unknown[]> {
    return this.sujetos.get(c)!;
  }

  private leer(c: NombreColeccion): unknown[] {
    try {
      return JSON.parse(localStorage.getItem(this.prefijo + c) ?? '[]');
    } catch {
      return [];
    }
  }

  private guardar(c: NombreColeccion, lista: unknown[], avisar = true): void {
    const anterior = this.foto(c) as ConId[];
    this.sujeto(c).next(lista);
    if (this.remoto) {
      void this.sincronizar(c, anterior, lista as ConId[]);
      return;
    }
    localStorage.setItem(this.prefijo + c, JSON.stringify(lista));
    if (avisar) this.canal?.postMessage(c);
  }
}
