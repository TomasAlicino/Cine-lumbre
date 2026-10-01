-- Cine Lumbre — esquema de Supabase
-- Correr una vez en Supabase → SQL Editor.
--
-- Todas las colecciones de la app (películas, funciones, pedidos, bloqueos de butacas, etc.)
-- se guardan en una tabla documental: una fila por registro, con el JSON en "data".
-- La app la siembra sola con public/data/seed.json la primera vez que la encuentra vacía.

create table if not exists public.lumbre_datos (
  coleccion   text        not null,
  id          text        not null,
  data        jsonb       not null,
  actualizado timestamptz not null default now(),
  primary key (coleccion, id)
);

create index if not exists lumbre_datos_coleccion_idx on public.lumbre_datos (coleccion);

-- Mantiene "actualizado" al día en cada UPDATE
create or replace function public.lumbre_tocar() returns trigger language plpgsql as $$
begin
  new.actualizado := now();
  return new;
end $$;

drop trigger if exists lumbre_datos_tocar on public.lumbre_datos;
create trigger lumbre_datos_tocar before update on public.lumbre_datos
  for each row execute function public.lumbre_tocar();

-- Row Level Security: lectura pública (cartelera, butacas ocupadas) y escritura con la clave publishable.
-- Para un entorno productivo real, restringir las escrituras de colecciones de admin a usuarios con rol admin.
alter table public.lumbre_datos enable row level security;

drop policy if exists "lumbre lectura" on public.lumbre_datos;
create policy "lumbre lectura" on public.lumbre_datos for select using (true);

drop policy if exists "lumbre escritura" on public.lumbre_datos;
create policy "lumbre escritura" on public.lumbre_datos for all using (true) with check (true);

-- Realtime: la selección de butacas escucha los cambios de esta tabla
do $$
begin
  alter publication supabase_realtime add table public.lumbre_datos;
exception when duplicate_object then null;
end $$;
