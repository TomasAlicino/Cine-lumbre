-- ═══════════════════════════════════════════════════════════════════════════
-- Cine Lumbre — reiniciar los datos de prueba (correr en Supabase → SQL Editor)
-- Borra funciones, compras, reseñas, alertas, avisos y el log, y vuelve a cargar
-- las películas. Las cuentas y sus roles se conservan (puntos y crédito vuelven a 0).
-- Después: Admin → Funciones para programar la cartelera.
-- ═══════════════════════════════════════════════════════════════════════════

truncate public.peliculas, public.funciones, public.pedidos, public.butacas_vendidas, public.bloqueos,
  public.canjes, public.resenas, public.alertas, public.notificaciones, public.actividad restart identity cascade;

update public.perfiles set puntos = 0, credito = 0;

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
