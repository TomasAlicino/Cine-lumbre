import { Injectable, inject } from '@angular/core';
import { Observable, auditTime, combineLatest, map, of, switchMap, timer } from 'rxjs';
import { Notificacion } from '../models/models';
import { DbService } from './db.service';
import { AuthService } from './auth.service';
import { estadoVenta } from '../utils/negocio';

/**
 * Alertas de "Próximamente": el usuario activa una alerta y, cuando la película tiene venta
 * abierta y funciones programadas, se genera una notificación (y una notificación del navegador si dio permiso).
 */
@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private readonly db = inject(DbService);
  private readonly auth = inject(AuthService);

  readonly mias$: Observable<Notificacion[]> = combineLatest([this.auth.usuario$, this.db.lista$('notificaciones')]).pipe(
    map(([u, l]) => (u ? l.filter((n) => n.usuarioId === u.id).sort((a, b) => b.fecha.localeCompare(a.fecha)) : [])),
  );

  readonly noLeidas$ = this.mias$.pipe(map((l) => l.filter((n) => !n.leida).length));

  readonly misAlertas$: Observable<Set<string>> = combineLatest([this.auth.usuario$, this.db.lista$('alertas')]).pipe(
    map(([u, l]) => new Set(u ? l.filter((a) => a.usuarioId === u.id && !a.notificada).map((a) => a.peliculaId) : [])),
  );

  /** Se llama una vez al iniciar la app. */
  iniciarVigilancia(): void {
    combineLatest([this.db.lista$('alertas'), this.db.lista$('funciones'), this.db.lista$('peliculas'), timer(0, 60_000)])
      .pipe(auditTime(500))
      .subscribe(() => this.revisarAlertas());
  }

  alternarAlerta(peliculaId: string): Observable<boolean> {
    const u = this.auth.usuario;
    if (!u) return of(false);
    const existente = this.db.foto('alertas').find((a) => a.usuarioId === u.id && a.peliculaId === peliculaId && !a.notificada);
    if (existente) {
      this.db.eliminar('alertas', existente.id);
      return of(false);
    }
    this.db.insertar('alertas', { usuarioId: u.id, peliculaId, notificada: false });
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission();
    return of(true);
  }

  marcarTodasLeidas(): void {
    const u = this.auth.usuario;
    if (!u) return;
    for (const n of this.db.foto('notificaciones')) {
      if (n.usuarioId === u.id && !n.leida) this.db.actualizar('notificaciones', n.id, { leida: true });
    }
  }

  private revisarAlertas(): void {
    const ahora = new Date();
    for (const a of this.db.foto('alertas').filter((x) => !x.notificada)) {
      const p = this.db.porId('peliculas', a.peliculaId);
      if (!p) continue;
      const venta = estadoVenta(p, ahora);
      const tieneFunciones = this.db.foto('funciones').some((f) => f.peliculaId === p.id && new Date(f.inicio) > ahora);
      if (!venta.abierta || !tieneFunciones) continue;
      this.db.actualizar('alertas', a.id, { notificada: true });
      const mensaje = venta.preventa
        ? `Ya podés comprar entradas en preventa para ${p.titulo}.`
        : `Ya están a la venta las entradas para ${p.titulo}.`;
      this.db.insertar('notificaciones', { usuarioId: a.usuarioId, mensaje, enlace: `/pelicula/${p.id}`, leida: false, fecha: ahora.toISOString() });
      if (this.auth.usuario?.id === a.usuarioId && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('Cine Lumbre', { body: mensaje, icon: 'icons/icon-192x192.png' });
      }
    }
  }
}
