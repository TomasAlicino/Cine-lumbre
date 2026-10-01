/**
 * Datos del proyecto de Supabase (Project Settings → API).
 * La clave publishable puede estar en el front: lo que protege los datos son las
 * políticas de Row Level Security definidas en docs/supabase.sql.
 */
export const environment = {
  production: false,
  supabaseUrl: 'https://ilqxtpnosjdjxypcenyr.supabase.co',
  supabaseKey: 'sb_publishable_m-xmNXV0V40sJDblzgiizA_d2O3LrgW',
  // The Movie Database (themoviedb.org → Settings → API): clave de solo lectura de datos públicos
  tmdbKey: '4da812e042f4552928920c303d313593',
};
