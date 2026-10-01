import { Injectable, inject, signal } from '@angular/core';
import { Perfil, Rol } from '../models/models';
import { edad } from '../utils/fechas';
import { SupabaseService } from './supabase-service';

export type DatosRegistro = Pick<
  Perfil,
  'email' | 'nombre' | 'apellido' | 'fecha_nacimiento' | 'tipo_sangre' | 'color_ojos' | 'dias_vacaciones'
> & { password: string };

/**
 * Autenticación con Supabase Auth (signUp / signInWithPassword / signOut / getUser).
 * Los datos del registro, el rol, los puntos y el crédito están en la tabla "perfiles".
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabase = inject(SupabaseService).cliente;

  /** Perfil del usuario logueado (null si es anónimo). */
  readonly usuario = signal<Perfil | null>(null);

  /** Se resuelve cuando terminó de leerse la sesión guardada (los guards la esperan). */
  private sesionCargada: Promise<void> = this.cargarSesion();

  /** true mientras esta pestaña está ingresando, registrándose o saliendo. */
  private cambiandoSesion = false;

  constructor() {
    // Todas las pestañas comparten la sesión de Supabase. Si en otra pestaña se ingresa con otra
    // cuenta o se sale, esta recarga la página para no seguir mostrando (y usando) al usuario anterior.
    this.supabase.auth.onAuthStateChange((_evento, sesion) => {
      const id = sesion?.user.id ?? null;
      if (this.cambiandoSesion || id === (this.usuario()?.id ?? null)) return;
      this.sesionCargada.then(() => {
        if (!this.cambiandoSesion && id !== (this.usuario()?.id ?? null)) window.location.reload();
      });
    });
  }

  esperarSesion(): Promise<void> {
    return this.sesionCargada;
  }

  tieneRol(...roles: Rol[]): boolean {
    const u = this.usuario();
    return !!u && roles.includes(u.rol);
  }

  edad(): number | null {
    const u = this.usuario();
    return u ? edad(u.fecha_nacimiento) : null;
  }

  login(email: string, password: string): Promise<Perfil> {
    return this.mientrasCambia(() => this.ingresar(email, password));
  }

  registrar(datos: DatosRegistro): Promise<Perfil> {
    return this.mientrasCambia(() => this.crearCuenta(datos));
  }

  logout(): Promise<void> {
    return this.mientrasCambia(async () => {
      await this.supabase.auth.signOut();
      this.usuario.set(null);
    });
  }

  private async ingresar(email: string, password: string): Promise<Perfil> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw new Error(this.traducir(error.message));
    const perfil = await this.traerPerfil(data.user.id);
    if (!perfil) {
      await this.supabase.auth.signOut();
      throw new Error('Tu cuenta no tiene perfil en el cine. Registrate de nuevo.');
    }
    this.usuario.set(perfil);
    return perfil;
  }

  private async crearCuenta(datos: DatosRegistro): Promise<Perfil> {
    const email = datos.email.trim().toLowerCase();
    const { data, error } = await this.supabase.auth.signUp({ email, password: datos.password });
    if (error) throw new Error(this.traducir(error.message));
    if (!data.user || !data.session) {
      throw new Error('Confirmá tu mail desde el enlace que te enviamos (o desactivá "Confirm email" en Supabase).');
    }

    const { password: _omitida, ...perfil } = datos;
    const { data: creado, error: errorPerfil } = await this.supabase
      .from('perfiles')
      .insert({ ...perfil, email, id: data.user.id })
      .select()
      .single();
    if (errorPerfil) throw new Error('No se pudo guardar tu perfil: ' + errorPerfil.message);

    this.usuario.set(creado as Perfil);
    return creado as Perfil;
  }

  /** Marca que el cambio de sesión es de esta pestaña (así no se recarga sola). */
  private async mientrasCambia<T>(accion: () => Promise<T>): Promise<T> {
    this.cambiandoSesion = true;
    try {
      return await accion();
    } finally {
      this.cambiandoSesion = false;
    }
  }

  /** Vuelve a leer el perfil (después de comprar o cancelar cambian los puntos y el crédito). */
  async recargarPerfil(): Promise<void> {
    const u = this.usuario();
    if (u) this.usuario.set(await this.traerPerfil(u.id));
  }

  /** La sesión la guarda supabase-js; getUser() la valida contra el servidor. */
  private async cargarSesion(): Promise<void> {
    try {
      const { data } = await this.supabase.auth.getUser();
      if (!data.user) return;
      const perfil = await this.traerPerfil(data.user.id);
      if (perfil) this.usuario.set(perfil);
      else await this.mientrasCambia(() => this.supabase.auth.signOut()); // cuenta sin perfil: se cierra la sesión
    } catch (e) {
      console.error('No se pudo leer la sesión', e);
    }
  }

  private async traerPerfil(id: string): Promise<Perfil | null> {
    const { data, error } = await this.supabase.from('perfiles').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data as Perfil | null;
  }

  private traducir(mensaje = ''): string {
    if (/invalid login/i.test(mensaje)) return 'El mail o la contraseña no coinciden.';
    if (/not confirmed/i.test(mensaje)) return 'Confirmá tu mail desde el enlace que te enviamos (o desactivá "Confirm email" en Supabase).';
    if (/already registered/i.test(mensaje)) return 'Ya existe una cuenta con ese mail. Ingresá o usá otro.';
    if (/password/i.test(mensaje)) return 'La contraseña debe tener al menos 6 caracteres.';
    return mensaje || 'No se pudo completar la operación.';
  }
}
