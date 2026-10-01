import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

/** Tabla única donde se guardan todas las colecciones (ver docs/supabase.sql). */
export const TABLA_DATOS = 'lumbre_datos';

/**
 * Cliente único de Supabase para toda la app.
 * `activo` es false cuando environment no tiene URL/clave: en ese caso la app usa localStorage.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly activo = !!environment.supabaseUrl && !!environment.supabasePublishableKey;
  readonly cliente: SupabaseClient | null = this.activo
    ? createClient(environment.supabaseUrl, environment.supabasePublishableKey)
    : null;

  /** Cliente garantizado (solo llamar cuando `activo` es true). */
  get sb(): SupabaseClient {
    if (!this.cliente) throw new Error('Supabase no está configurado (src/environments/environment.ts).');
    return this.cliente;
  }
}
