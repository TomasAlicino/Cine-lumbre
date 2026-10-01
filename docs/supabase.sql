-- ═══════════════════════════════════════════════════════════════════════════
-- Cine Lumbre — esquema de Supabase
-- Correr COMPLETO en Supabase → SQL Editor. Se puede volver a correr: borra y
-- recrea todas las tablas (se pierden los datos cargados).
--
-- Antes: en Authentication → Providers → Email, desactivar "Confirm email".
-- Después: ver el final del archivo para dar rol admin/empleado.
-- ═══════════════════════════════════════════════════════════════════════════

-- La versión anterior guardaba todo en una sola tabla JSON
drop table if exists public.lumbre_datos cascade;

drop table if exists public.actividad, public.notificaciones, public.alertas, public.resenas,
  public.canjes, public.bloqueos, public.butacas_vendidas, public.pedidos, public.recompensas,
  public.cupones, public.combos, public.productos, public.categorias, public.funciones,
  public.salas, public.peliculas, public.configuracion, public.perfiles cascade;

-- ─────────────────────────────── Tablas ───────────────────────────────

-- Datos del registro. El id es el mismo que el del usuario de Supabase Auth.
create table public.perfiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  email            text not null,
  nombre           text not null,
  apellido         text not null,
  fecha_nacimiento date not null,
  tipo_sangre      text not null,
  color_ojos       text not null,
  dias_vacaciones  int  not null default 0,
  rol              text not null default 'cliente' check (rol in ('cliente', 'empleado', 'admin')),
  puntos           int  not null default 0 check (puntos >= 0),
  credito          numeric(12, 2) not null default 0 check (credito >= 0),
  creado_en        timestamptz not null default now()
);

create table public.peliculas (
  id                  bigint generated always as identity primary key,
  titulo              text not null,
  sinopsis            text not null,
  duracion_min        int  not null check (duracion_min > 0),
  imagen_url          text,
  generos             text[] not null default '{}',   -- una película puede tener varios géneros
  clasificacion       text not null default 'ATP' check (clasificacion in ('ATP', '+13', '+18')),
  estado              text not null default 'cartelera' check (estado in ('cartelera', 'proximamente', 'inactiva')),
  destacada           boolean not null default false,  -- aparece en la página principal
  fecha_estreno       date not null default current_date,
  preventa_habilitada boolean not null default false,
  preventa_precio     numeric(12, 2) not null default 0,
  preventa_dias_antes int not null default 7
);

create table public.salas (
  id                     bigint generated always as identity primary key,
  nombre                 text not null,
  activa                 boolean not null default true,
  butacas_deshabilitadas text[] not null default '{}'
);

create table public.funciones (
  id          bigint generated always as identity primary key,
  pelicula_id bigint not null references public.peliculas (id) on delete cascade,
  sala_id     bigint not null references public.salas (id),
  inicio      timestamptz not null,
  fin         timestamptz not null,
  formato     text not null check (formato in ('2D', '3D', '4D', '5D')),
  idioma      text not null check (idioma in ('castellano', 'subtitulada')),
  precio      numeric(12, 2) not null,
  precio_vip  numeric(12, 2) not null
);

create table public.categorias (
  id     bigint generated always as identity primary key,
  nombre text not null
);

create table public.productos (
  id           bigint generated always as identity primary key,
  nombre       text not null,
  categoria_id bigint not null references public.categorias (id),
  precio       numeric(12, 2) not null,
  activo       boolean not null default true
);

-- items: [{ "producto_id": 1, "cantidad": 1 }, ...]  (el combo incluye además una entrada)
create table public.combos (
  id          bigint generated always as identity primary key,
  nombre      text not null,
  descripcion text not null default '',
  precio      numeric(12, 2) not null,
  items       jsonb not null default '[]',
  destacado   boolean not null default false,
  activo      boolean not null default true
);

create table public.cupones (
  id              bigint generated always as identity primary key,
  codigo          text not null unique,
  porcentaje      int  not null check (porcentaje between 1 and 100),
  solo_mayores_de int,                                  -- ej: 50 → solo clientes de más de 50 años
  activo          boolean not null default true
);

create table public.recompensas (
  id           bigint generated always as identity primary key,
  nombre       text not null,
  tipo         text not null check (tipo in ('entrada', 'producto')),
  producto_id  bigint references public.productos (id),
  costo_puntos int  not null check (costo_puntos > 0),
  activa       boolean not null default true
);

-- El código del QR es la clave del pedido (así una compra anónima se puede buscar por código).
create table public.pedidos (
  codigo               text primary key,
  usuario_id           uuid references public.perfiles (id),
  comprador_nombre     text not null,
  comprador_email      text not null,
  funcion_id           bigint not null references public.funciones (id),
  butacas              text[] not null,
  items                jsonb not null default '[]',
  subtotal             numeric(12, 2) not null,
  descuento            numeric(12, 2) not null default 0,
  cupon_codigo         text,
  credito_usado        numeric(12, 2) not null default 0,
  puntos_usados        int not null default 0,
  puntos_ganados       int not null default 0,
  total                numeric(12, 2) not null,
  estado               text not null default 'pagada' check (estado in ('pagada', 'cancelada')),
  requiere_adulto      boolean not null default false,
  es_preventa          boolean not null default false,
  entrada_validada_en  timestamptz,
  entrada_validada_por text,
  candy_entregado_en   timestamptz,
  candy_entregado_por  text,
  creado_en            timestamptz not null default now()
);

-- Una fila por butaca vendida. La clave primaria (funcion_id, butaca) hace IMPOSIBLE
-- vender dos veces la misma butaca: la segunda compra falla. La llena un trigger.
create table public.butacas_vendidas (
  funcion_id    bigint not null references public.funciones (id) on delete cascade,
  butaca        text   not null,
  pedido_codigo text   not null references public.pedidos (codigo) on delete cascade,
  primary key (funcion_id, butaca)
);

-- Butacas que alguien está eligiendo en este momento (se vencen solas a los 10 minutos).
create table public.bloqueos (
  funcion_id bigint not null references public.funciones (id) on delete cascade,
  butaca     text   not null,
  sesion_id  text   not null,
  expira     timestamptz not null,
  primary key (funcion_id, butaca)
);

create table public.canjes (
  id            bigint generated always as identity primary key,
  usuario_id    uuid   not null references public.perfiles (id) on delete cascade,
  recompensa_id bigint references public.recompensas (id) on delete set null,
  nombre        text   not null,
  puntos        int    not null,
  pedido_codigo text   references public.pedidos (codigo) on delete set null,
  fecha         timestamptz not null default now()
);

create table public.resenas (
  id          bigint generated always as identity primary key,
  pelicula_id bigint not null references public.peliculas (id) on delete cascade,
  usuario_id  uuid   not null references public.perfiles (id) on delete cascade,
  autor       text   not null,
  estrellas   int    not null check (estrellas between 1 and 5),
  comentario  text   not null default '' check (char_length(comentario) <= 280),
  fecha       timestamptz not null default now(),
  unique (pelicula_id, usuario_id)                        -- una reseña por persona y película
);

create table public.alertas (
  id          bigint generated always as identity primary key,
  usuario_id  uuid   not null references public.perfiles (id) on delete cascade,
  pelicula_id bigint not null references public.peliculas (id) on delete cascade,
  notificada  boolean not null default false
);

create table public.notificaciones (
  id         bigint generated always as identity primary key,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  mensaje    text not null,
  enlace     text,
  leida      boolean not null default false,
  fecha      timestamptz not null default now()
);

create table public.actividad (
  id             bigint generated always as identity primary key,
  fecha          timestamptz not null default now(),
  usuario_id     uuid,
  usuario_nombre text not null,
  accion         text not null,
  detalle        text not null default ''
);

-- Una sola fila (id = 1) con los valores que el admin puede cambiar.
create table public.configuracion (
  id                        int primary key default 1 check (id = 1),
  porcentaje_primera_compra int not null default 20,
  minutos_limpieza          int not null default 30,
  horas_limite_cancelacion  int not null default 2
);

-- ─────────────────────────────── Funciones auxiliares ───────────────────────────────

-- Rol del usuario logueado (null si es anónimo). "security definer" permite leer perfiles
-- sin pasar por las políticas de abajo (si no, las políticas se llamarían a sí mismas).
create or replace function public.rol_actual() returns text
language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid()
$$;

-- Un cliente puede editar su perfil, pero no cambiarse el rol, los puntos ni el crédito.
-- Esos campos solo los cambia un admin o los triggers de pedidos (pg_trigger_depth() > 1).
-- Desde el SQL Editor (auth.uid() es null) se puede todo.
create or replace function public.proteger_perfil() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and pg_trigger_depth() = 1 and coalesce(public.rol_actual(), '') <> 'admin'
     and (new.rol, new.puntos, new.credito) is distinct from (old.rol, old.puntos, old.credito) then
    raise exception 'No podés modificar el rol, los puntos ni el crédito.';
  end if;
  return new;
end $$;

create trigger perfiles_proteger before update on public.perfiles
  for each row execute function public.proteger_perfil();

-- Al crear un pedido: ocupa las butacas y mueve puntos y crédito del cliente.
-- Si una butaca ya estaba vendida, o el cliente no tiene puntos/crédito suficientes
-- (checks de perfiles), falla TODA la compra y no se guarda nada.
create or replace function public.pedido_creado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.butacas_vendidas (funcion_id, butaca, pedido_codigo)
  select new.funcion_id, b, new.codigo from unnest(new.butacas) as b;

  if new.usuario_id is not null then
    update public.perfiles
       set puntos  = puntos - new.puntos_usados + new.puntos_ganados,
           credito = credito - new.credito_usado
     where id = new.usuario_id;
  end if;
  return new;
end $$;

create trigger pedidos_creado after insert on public.pedidos
  for each row execute function public.pedido_creado();

-- Al cancelar: libera las butacas, devuelve el importe como crédito y revierte los puntos.
create or replace function public.pedido_cancelado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.butacas_vendidas where pedido_codigo = new.codigo;

  if new.usuario_id is not null then
    update public.perfiles
       set credito = credito + new.total + new.credito_usado,
           puntos  = greatest(0, puntos - new.puntos_ganados) + new.puntos_usados
     where id = new.usuario_id;
  end if;
  return new;
end $$;

create trigger pedidos_cancelado after update on public.pedidos
  for each row when (old.estado = 'pagada' and new.estado = 'cancelada')
  execute function public.pedido_cancelado();

-- ─────────────────────────────── Row Level Security ───────────────────────────────
-- La clave publishable está en el código del front, así que estas políticas son las que
-- deciden quién puede leer o escribir cada tabla.

alter table public.perfiles         enable row level security;
alter table public.peliculas        enable row level security;
alter table public.salas            enable row level security;
alter table public.funciones        enable row level security;
alter table public.categorias       enable row level security;
alter table public.productos        enable row level security;
alter table public.combos           enable row level security;
alter table public.cupones          enable row level security;
alter table public.recompensas      enable row level security;
alter table public.configuracion    enable row level security;
alter table public.pedidos          enable row level security;
alter table public.butacas_vendidas enable row level security;
alter table public.bloqueos         enable row level security;
alter table public.canjes           enable row level security;
alter table public.resenas          enable row level security;
alter table public.alertas          enable row level security;
alter table public.notificaciones   enable row level security;
alter table public.actividad        enable row level security;

-- Perfiles: cada uno ve y edita el suyo; empleados y admin ven todos; el admin edita todos.
create policy "perfil propio o staff" on public.perfiles for select
  using (id = auth.uid() or public.rol_actual() in ('empleado', 'admin'));
create policy "alta del propio perfil" on public.perfiles for insert
  with check (id = auth.uid() and rol = 'cliente' and puntos = 0 and credito = 0);
create policy "editar perfil propio o admin" on public.perfiles for update
  using (id = auth.uid() or public.rol_actual() = 'admin');

-- Catálogo: lo lee cualquiera (también sin cuenta) y solo lo modifica el admin.
create policy "lectura publica" on public.peliculas     for select using (true);
create policy "lectura publica" on public.salas         for select using (true);
create policy "lectura publica" on public.funciones     for select using (true);
create policy "lectura publica" on public.categorias    for select using (true);
create policy "lectura publica" on public.productos     for select using (true);
create policy "lectura publica" on public.combos        for select using (true);
create policy "lectura publica" on public.cupones       for select using (true);
create policy "lectura publica" on public.recompensas   for select using (true);
create policy "lectura publica" on public.configuracion for select using (true);

create policy "admin escribe" on public.peliculas     for all using (public.rol_actual() = 'admin') with check (public.rol_actual() = 'admin');
create policy "admin escribe" on public.salas         for all using (public.rol_actual() = 'admin') with check (public.rol_actual() = 'admin');
create policy "admin escribe" on public.funciones     for all using (public.rol_actual() = 'admin') with check (public.rol_actual() = 'admin');
create policy "admin escribe" on public.categorias    for all using (public.rol_actual() = 'admin') with check (public.rol_actual() = 'admin');
create policy "admin escribe" on public.productos     for all using (public.rol_actual() = 'admin') with check (public.rol_actual() = 'admin');
create policy "admin escribe" on public.combos        for all using (public.rol_actual() = 'admin') with check (public.rol_actual() = 'admin');
create policy "admin escribe" on public.cupones       for all using (public.rol_actual() = 'admin') with check (public.rol_actual() = 'admin');
create policy "admin escribe" on public.recompensas   for all using (public.rol_actual() = 'admin') with check (public.rol_actual() = 'admin');
create policy "admin escribe" on public.configuracion for all using (public.rol_actual() = 'admin') with check (public.rol_actual() = 'admin');

-- Pedidos: cualquiera puede comprar (también anónimo); cada cliente ve y cancela los suyos;
-- empleados y admin ven todos y los validan.
create policy "comprar" on public.pedidos for insert
  with check ((usuario_id is null or usuario_id = auth.uid()) and estado = 'pagada'
              and entrada_validada_en is null and candy_entregado_en is null);
create policy "ver pedidos propios o staff" on public.pedidos for select
  using (usuario_id = auth.uid() or public.rol_actual() in ('empleado', 'admin'));
create policy "cancelar propio o validar staff" on public.pedidos for update
  using (usuario_id = auth.uid() or public.rol_actual() in ('empleado', 'admin'));

-- Butacas vendidas: todos ven cuáles están ocupadas. Solo las escriben los triggers.
create policy "lectura publica" on public.butacas_vendidas for select using (true);

-- Bloqueos temporales: cualquiera que esté comprando puede crearlos y liberarlos.
create policy "bloqueos libres" on public.bloqueos for all using (true) with check (true);

-- Canjes: cada cliente ve y registra los suyos; el admin ve todos.
create policy "ver canjes propios o admin" on public.canjes for select
  using (usuario_id = auth.uid() or public.rol_actual() = 'admin');
create policy "registrar canje propio" on public.canjes for insert
  with check (usuario_id = auth.uid());

-- Reseñas: las lee cualquiera; cada uno escribe solo la suya.
create policy "lectura publica" on public.resenas for select using (true);
create policy "resena propia" on public.resenas for insert with check (usuario_id = auth.uid());
create policy "editar resena propia" on public.resenas for update using (usuario_id = auth.uid());
create policy "borrar resena propia" on public.resenas for delete using (usuario_id = auth.uid());

-- Alertas y notificaciones: solo las propias.
create policy "alertas propias" on public.alertas for all
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "notificaciones propias" on public.notificaciones for all
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Log de actividad: lo escriben empleados y admin; solo el admin lo lee.
create policy "staff registra" on public.actividad for insert
  with check (public.rol_actual() in ('empleado', 'admin'));
create policy "admin lee" on public.actividad for select
  using (public.rol_actual() = 'admin');

-- ─────────────────────────────── Storage (pósters) ───────────────────────────────
-- Bucket público: las imágenes se ven con getPublicUrl. Solo el admin sube o borra.

insert into storage.buckets (id, name, public) values ('posters', 'posters', true)
on conflict (id) do nothing;

drop policy if exists "admin sube posters" on storage.objects;
create policy "admin sube posters" on storage.objects for insert
  with check (bucket_id = 'posters' and public.rol_actual() = 'admin');

drop policy if exists "admin borra posters" on storage.objects;
create policy "admin borra posters" on storage.objects for delete
  using (bucket_id = 'posters' and public.rol_actual() = 'admin');

-- ─────────────────────────────── Datos iniciales ───────────────────────────────

insert into public.configuracion (id) values (1);

insert into public.salas (nombre) values ('Sala 1'), ('Sala 2'), ('Sala 3'), ('Sala 4'), ('Sala 5');

-- Películas reales tomadas de TMDB (The Movie Database). Las fechas de estreno son relativas
-- al día en que se corre el script, para que siempre haya cartelera, preventa y próximos estrenos.
insert into public.peliculas
  (titulo, sinopsis, duracion_min, imagen_url, generos, clasificacion, estado, destacada, fecha_estreno, preventa_habilitada, preventa_precio)
values
  ('Verity. La sombra de un engaño',
   'Lowen Ashleigh es contratada como escritora fantasma por Jeremy Crawford para escribir las novelas de su esposa Verity, autora de bestsellers, impedida tras un accidente. Lowen descubre las inquietantes verdades de Verity mientras reside en casa de los Crawford para trabajar.',
   117, 'https://image.tmdb.org/t/p/w500/dGSsPovyUW5XVekXcy7F2GyhTEh.jpg', '{Suspenso}', '+13', 'cartelera', true, current_date - 1, false, 5200),
  ('La isla olvidada',
   'Dos amigas se quedan varadas en el místico mundo de Nakali, donde su único escape podría costarles su vida compartida de recuerdos.',
   109, 'https://image.tmdb.org/t/p/w500/vpTdXFoZGzwnCWzkVYU7JH8teAZ.jpg', '{Animación,Aventura,Fantasía,Comedia}', 'ATP', 'cartelera', true, current_date - 21, false, 5200),
  ('Resident Evil',
   'Película basada en la saga de videojuegos de Capcom del mismo nombre. En una reinvención totalmente nueva, el mensajero médico Bryan se ve inmerso en una carrera de acción sin descanso por la supervivencia, mientras el caos se desata a su alrededor.',
   93, 'https://image.tmdb.org/t/p/w500/3d8D5tZXiPUE2VmRjnrTNzFORBa.jpg', '{Terror,"Ciencia ficción",Aventura}', '+18', 'cartelera', true, current_date - 15, false, 5200),
  ('Coyote vs. Acme',
   'Después de que todos los productos fabricados por ACME Corporation le salgan mal a Wile E. Coyote, en su persecución del Correcaminos, contrata a un abogado humano igualmente desafortunado para demandar a la empresa. Cuando el abogado de Wile E. descubre que el intimidante jefe de su antiguo bufete es el director general de ACME, se une a Wile E. para ganar el juicio contra él.',
   103, 'https://image.tmdb.org/t/p/w500/vWFz9spZFBkJvForuYrKK2ntOLB.jpg', '{Comedia,Aventura}', 'ATP', 'cartelera', false, current_date - 45, false, 5200),
  ('Fall 2: Deadpoint',
   'Tras la muerte de su intrépida hermana Shiloh, Jax emprende una peligrosa escalada con una vieja amiga para honrar su memoria. Mientras caminan sobre la cuerda floja por los peligrosos tablones del monte Kwan, en Tailandia, un aterrador desprendimiento de rocas las deja varadas a 1.500 metros de altura. En medio de vértigos, verdades oscuras y giros crueles, Jax debe enfrentarse a sus miedos más profundos para luchar por la supervivencia.',
   98, 'https://image.tmdb.org/t/p/w500/7ODJFeX9gp4QfK6aFItw4CCrPfr.jpg', '{Suspenso}', '+13', 'cartelera', false, current_date - 30, false, 5200),
  ('Prácticamente magia 2',
   'Las hermanas Owens deben enfrentarse a la oscura maldición que amenaza con desintegrar a su familia de una vez por todas.',
   130, 'https://image.tmdb.org/t/p/w500/cQjtzBXcTMzHqvo7zmpJvcBFRdC.jpg', '{Romance,Fantasía,Comedia}', 'ATP', 'cartelera', false, current_date - 22, false, 5200),
  ('El Precio de la Red',
   'Explora las prácticas internas de Facebook, la difusión de información falsa, el impacto en la salud mental de los adolescentes y la conexión con los eventos del 6 de enero en el Capitolio.',
   112, 'https://image.tmdb.org/t/p/w500/zYPSQPc76qWfJNF9gbmyCOJk0hV.jpg', '{Drama,Suspenso}', '+13', 'proximamente', false, current_date + 6, true, 5200),
  ('Whalefall',
   'Tras la muerte de su padre, Jay Gardiner se sumerge en la costa central de California en busca de sus restos, pero es tragado por una ballena. Atrapado en su interior con solo una hora de oxígeno restante, Jay se da cuenta de que las lecciones que su padre le enseñó pueden ser la clave para escapar.',
   106, 'https://image.tmdb.org/t/p/w500/vjTYUTgh9nO88i6HZ4YPRhiFL05.jpg', '{Suspenso}', '+13', 'proximamente', false, current_date + 13, true, 5200),
  ('Klara y el Sol',
   'Una niña robot, creada con el propósito de prevenir la soledad, se propone salvar a una familia de humanos con el corazón roto.',
   116, 'https://image.tmdb.org/t/p/w500/xqovj2p6HRsgHxN81qYAYF4StgM.jpg', '{"Ciencia ficción",Drama,Comedia}', 'ATP', 'proximamente', false, current_date + 20, false, 5200);

insert into public.categorias (nombre) values ('Pochoclos'), ('Bebidas'), ('Golosinas'), ('Snacks salados');

insert into public.productos (nombre, categoria_id, precio)
select p.nombre, c.id, p.precio
from (values
  ('Pochoclo chico', 'Pochoclos', 2800), ('Pochoclo mediano', 'Pochoclos', 3600), ('Pochoclo grande', 'Pochoclos', 4400),
  ('Gaseosa 500 ml', 'Bebidas', 2400), ('Agua mineral', 'Bebidas', 1600), ('Gaseosa 1 L', 'Bebidas', 3300),
  ('Chocolate', 'Golosinas', 1900), ('Gomitas', 'Golosinas', 1500),
  ('Nachos con cheddar', 'Snacks salados', 4200), ('Pancho', 'Snacks salados', 3000)
) as p (nombre, categoria, precio)
join public.categorias c on c.nombre = p.categoria;

insert into public.combos (nombre, descripcion, precio, destacado, items) values
  ('Combo Clásico', 'Entrada + pochoclo mediano + gaseosa 500 ml', 11500, true, jsonb_build_array(
    jsonb_build_object('producto_id', (select id from public.productos where nombre = 'Pochoclo mediano'), 'cantidad', 1),
    jsonb_build_object('producto_id', (select id from public.productos where nombre = 'Gaseosa 500 ml'), 'cantidad', 1))),
  ('Combo Pareja', 'Entrada + pochoclo grande + 2 gaseosas', 14900, true, jsonb_build_array(
    jsonb_build_object('producto_id', (select id from public.productos where nombre = 'Pochoclo grande'), 'cantidad', 1),
    jsonb_build_object('producto_id', (select id from public.productos where nombre = 'Gaseosa 500 ml'), 'cantidad', 2))),
  ('Combo Nachos', 'Entrada + nachos con cheddar + gaseosa 1 L', 13200, false, jsonb_build_array(
    jsonb_build_object('producto_id', (select id from public.productos where nombre = 'Nachos con cheddar'), 'cantidad', 1),
    jsonb_build_object('producto_id', (select id from public.productos where nombre = 'Gaseosa 1 L'), 'cantidad', 1)));

insert into public.cupones (codigo, porcentaje, solo_mayores_de) values ('DORADOS50', 30, 50), ('LUMBRE10', 10, null);

insert into public.recompensas (nombre, tipo, producto_id, costo_puntos) values
  ('Entrada gratis', 'entrada', null, 500),
  ('Pochoclo grande', 'producto', (select id from public.productos where nombre = 'Pochoclo grande'), 150),
  ('Gaseosa 500 ml', 'producto', (select id from public.productos where nombre = 'Gaseosa 500 ml'), 90);

-- ─────────────────────────────── Usuarios admin y empleado ───────────────────────────────
-- 1) Registrarse desde la app con admin@lumbre.com y con empleado@lumbre.com.
-- 2) Correr esto para darles el rol:
--
--   update public.perfiles set rol = 'admin'    where email = 'admin@lumbre.com';
--   update public.perfiles set rol = 'empleado' where email = 'empleado@lumbre.com';
--
-- 3) Ingresar como admin → Funciones → programar las funciones de cada película.
