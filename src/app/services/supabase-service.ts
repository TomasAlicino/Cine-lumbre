import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

/**
 * Cliente de Supabase. En clase cada servicio creaba el suyo con createClient; acá hay
 * muchos servicios, así que se crea UNO solo y los demás lo inyectan: varios clientes
 * en la misma página pisan la sesión entre sí (Supabase avisa "Multiple GoTrueClient instances").
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly cliente: SupabaseClient = createClient(environment.supabaseUrl, environment.supabaseKey);
}
