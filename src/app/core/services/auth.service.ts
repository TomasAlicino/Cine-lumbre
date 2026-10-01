import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, from, map, switchMap, throwError, of, distinctUntilChanged } from 'rxjs';
import { Rol, Usuario } from '../models/models';
import { DbService } from './db.service';
import { SupabaseService } from './supabase.service';
import { edad } from '../utils/fechas';

export type DatosRegistro = Omit<Usuario, 'id' | 'passwordHash' | 'rol' | 'puntos' | 'credito' | 'creadoEn'> & { password: string };

/**
 * Autenticación.
 * - Con Supabase: supabase.auth.signInWithPassword / signUp / signOut. El perfil (datos del registro,
 *   rol, puntos y crédito) vive en la colección "usuarios" con el mismo id que auth.users.
 * - Sin Supabase: contraseñas con hash SHA-256 en localStorage (modo demo).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly db = inject(DbService);
  private readonly supabase = inject(SupabaseService);
  private readonly claveSesion = 'lumbre:sesion';
  private readonly sesionId$ = new BehaviorSubject<string | null>(localStorage.getItem(this.claveSesion));

  /** Usuario actual, siempre actualizado (puntos, crédito, etc.). */
  readonly usuario$: Observable<Usuario | null> = combineLatest([this.sesionId$, this.db.lista$('usuarios')]).pipe(
    map(([id, usuarios]) => usuarios.find((u) => u.id === id) ?? null),
    distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
  );

  readonly logueado$ = this.usuario$.pipe(map((u) => !!u));

  get usuario(): Usuario | null {
    const id = this.sesionId$.value;
    return id ? (this.db.porId('usuarios', id) ?? null) : null;
  }

  tieneRol(...roles: Rol[]): boolean {
    const u = this.usuario;
    return !!u && roles.includes(u.rol);
  }

  edadActual(): number | null {
    return this.usuario ? edad(this.usuario.fechaNacimiento) : null;
  }

  login(email: string, password: string): Observable<Usuario> {
    if (this.supabase.activo) return from(this.loginSupabase(email.trim().toLowerCase(), password));
    return from(this.hash(password)).pipe(
      switchMap((hash) => {
        const u = this.db.foto('usuarios').find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
        if (!u || u.passwordHash !== hash) return throwError(() => new Error('El mail o la contraseña no coinciden.'));
        this.iniciarSesion(u.id);
        return of(u);
      }),
    );
  }

  registrar(datos: DatosRegistro): Observable<Usuario> {
    const email = datos.email.trim().toLowerCase();
    if (this.db.foto('usuarios').some((u) => u.email.toLowerCase() === email)) {
      return throwError(() => new Error('Ya existe una cuenta con ese mail. Ingresá o usá otro.'));
    }
    if (this.supabase.activo) return from(this.registrarSupabase({ ...datos, email }));
    return from(this.hash(datos.password)).pipe(
      map((passwordHash) => {
        const { password: _omitida, ...perfil } = datos;
        const u = this.db.insertar('usuarios', {
          ...perfil,
          email,
          passwordHash,
          rol: 'cliente',
          puntos: 0,
          credito: 0,
          creadoEn: new Date().toISOString(),
        });
        this.iniciarSesion(u.id);
        return u;
      }),
    );
  }

  logout(): void {
    if (this.supabase.activo) void this.supabase.sb.auth.signOut();
    localStorage.removeItem(this.claveSesion);
    this.sesionId$.next(null);
  }

  private async loginSupabase(email: string, password: string): Promise<Usuario> {
    const auth = this.supabase.sb.auth;
    let { data, error } = await auth.signInWithPassword({ email, password });
    const perfil = this.db.foto('usuarios').find((u) => u.email.toLowerCase() === email);
    // Cuentas de la semilla (admin, empleado, clientes demo): se crean en Supabase Auth en su primer ingreso.
    if (error && perfil?.passwordHash && perfil.passwordHash === (await this.hash(password))) {
      const alta = await auth.signUp({ email, password });
      if (alta.error) throw new Error(this.traducir(alta.error.message));
      ({ data, error } = await auth.signInWithPassword({ email, password }));
    }
    if (error || !data.user) throw new Error(this.traducir(error?.message));
    if (!perfil) throw new Error('Tu cuenta no tiene perfil en el cine. Registrate de nuevo.');
    this.iniciarSesion(perfil.id);
    return perfil;
  }

  private async registrarSupabase(datos: DatosRegistro): Promise<Usuario> {
    const { data, error } = await this.supabase.sb.auth.signUp({ email: datos.email, password: datos.password });
    if (error || !data.user) throw new Error(this.traducir(error?.message));
    const { password: _omitida, ...perfil } = datos;
    const u = this.db.insertar('usuarios', {
      ...perfil,
      id: data.user.id,
      passwordHash: '',
      rol: 'cliente',
      puntos: 0,
      credito: 0,
      creadoEn: new Date().toISOString(),
    });
    this.iniciarSesion(u.id);
    return u;
  }

  private traducir(mensaje = ''): string {
    if (/invalid login/i.test(mensaje)) return 'El mail o la contraseña no coinciden.';
    if (/not confirmed/i.test(mensaje)) return 'Confirmá tu mail desde el enlace que te enviamos (o desactivá "Confirm email" en Supabase).';
    if (/already registered/i.test(mensaje)) return 'Ya existe una cuenta con ese mail.';
    if (/password/i.test(mensaje)) return 'La contraseña debe tener al menos 6 caracteres.';
    return mensaje || 'No se pudo completar la operación.';
  }

  private iniciarSesion(id: string) {
    localStorage.setItem(this.claveSesion, id);
    this.sesionId$.next(id);
  }

  private async hash(texto: string): Promise<string> {
    const datos = new TextEncoder().encode('lumbre|' + texto);
    const buf = await crypto.subtle.digest('SHA-256', datos);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}
