# Cine Lumbre 🎬

Sistema de venta de entradas para un cine de un solo edificio con varias salas: cartelera, compra con
selección de butacas en tiempo real, candy bar, cupones, puntos de fidelización, validación de QR
para empleados y panel de administración con reportes.

**TP 1 — Programación IV (UTN FRA, 2026)**

- 🌐 **Demo:** https://cine-lumbre.web.app
- 📄 **Requerimientos:** [docs/REQUERIMIENTOS.md](docs/REQUERIMIENTOS.md)
- 🗄️ **Esquema Supabase:** [docs/supabase.sql](docs/supabase.sql)

### Cuentas de prueba

| Rol | Mail | Contraseña | Para probar |
|---|---|---|---|
| Admin | admin@lumbre.com | admin123 | panel de administración y reportes |
| Empleado | empleado@lumbre.com | empleado123 | validar QR (sala y candy) |
| Cliente | cliente@lumbre.com | cliente123 | compras, puntos, crédito, reseñas |
| Cliente de 68 años | mayor@lumbre.com | mayor123 | cupón para mayores de 50 |
| Cliente de 13 años | joven@lumbre.com | joven123 | restricción de edad (+13 sí, +18 no) |

Cupones de prueba: `LUMBRE10` (10%) y `DORADOS50` (30%, solo para mayores de 50).
Tarjeta de prueba: `4111 1111 1111 1111`, vencimiento futuro, CVV `123`.

---

## Correr en local

Solo hace falta **Node.js 20.19 o superior** (Angular viene con el proyecto y se instala con `npm install`).

```bash
npm install
npm start            # http://localhost:4200
```

---

## Arquitectura

```
src/app
├── componentes/        una carpeta por componente: x.ts + x.html + x.scss
│   ├── inicio, cartelera, proximamente, pelicula-detalle, no-encontrado
│   ├── compra, entrada, validador
│   ├── login, registro, mi-cuenta (+ mi-perfil, mis-compras, mis-peliculas, mis-puntos)
│   ├── admin (+ admin-tablero, admin-peliculas, admin-funciones, admin-salas, admin-candy,
│   │         admin-cupones, admin-recompensas, admin-usuarios, admin-actividad, admin-configuracion)
│   └── compartidos: mapa-butacas, estrellas, pelicula-card, selector-dias, selector-horarios, toasts
├── modulos/staff/      StaffModule + StaffRoutingModule (área de empleados como NgModule)
├── services/           un servicio por tabla/tema; todos usan el cliente de SupabaseService
├── models/             una interfaz por tabla (campos = columnas)
├── guards/             authGuard, rolGuard, invitadoGuard, salidaCompraGuard
├── pipes/              pesos, duracion, fechaAR, hora, dia, clasificacion, tipoButaca, buscarPeliculas
├── directivas/         *appSiRol, appMascaraFecha, appImagenRespaldo, appAutofoco
└── utils/              funciones puras: layout de sala, preventa y precios, fechas, validadores
```

### Flujo de datos

```
Componente (signals) ──► Servicio (async/await) ──► Supabase
   ngOnInit: cargar()        from('tabla').select/insert/update/delete
   try / catch → toast       if (error) throw new Error(...)
                                         │
                       Postgres: claves foráneas, RLS por rol, triggers
```

- Cada componente guarda su estado en **signals** y carga sus datos en `ngOnInit` con `async/await`,
  igual que en la clase de Supabase Storage.
- Cada **servicio** consulta solo lo que necesita (`select`, `eq`, `gte`, `in`, `order`) y lanza un
  `Error` con un mensaje en castellano que el componente muestra en un toast.
- Las **reglas de negocio** que tienen que cumplirse siempre (no vender dos veces una butaca, mover
  puntos y crédito) están en la base. Las demás (preventa, recargo VIP, edad, solapamiento de
  funciones) están en servicios y en `utils/`.

---

## Temas de la cursada y dónde se usan

| Tema | Dónde |
|---|---|
| **Componentes y signals** | Todos los componentes: `signal`, `computed`, `.set()`, `.update()` |
| **Input / Output / model** | `MapaButacas` (`input estado`, `output butacaClick`), `Estrellas` (`model valor` → `[(valor)]`), `PeliculaCard` (`output alternarAlerta`), `SelectorDias` y `SelectorHorarios` (`model valores`) |
| **Rutas** | `app.routes.ts`, rutas hijas en `mi-cuenta` y `admin`, `paramMap` en detalle, compra y entrada |
| **Lazy loading** | Todas las pantallas con `loadComponent`; el área de empleados con `loadChildren` |
| **Módulos** | `StaffModule` + `StaffRoutingModule` (`RouterModule.forChild`), con `Validador` declarado (`standalone: false`) |
| **Servicios** | `services/`, `providedIn: 'root'`, inyectados con `inject()` |
| **HTTP y Observables** | `TmdbService` con `HttpClient` contra la API pública [TMDB](https://www.themoviedb.org) (lista *public-apis*): en Admin → Películas se busca una película y se completa el formulario; `subscribe({ next, error })` y `unsubscribe` en `ngOnDestroy` |
| **Formularios** | Reactive Forms con `FormBuilder` y `Validators` (más validadores propios en `utils/validadores.ts`) en ingreso, registro, perfil, compra y todo el admin; `ngModel` en buscadores |
| **Supabase** | Auth (`signUp`, `signInWithPassword`, `signOut`, `getUser`), tablas con `select/insert/update/delete`, **Storage** para los pósters (`upload`, `getPublicUrl`, `remove`) |
| **Guards** | `authGuard`, `rolGuard('admin')`, `invitadoGuard` (CanActivate) y `salidaCompraGuard` (CanDeactivate: confirma y libera las butacas al salir a mitad de compra) |
| **Pipes** | 8 pipes propios en `pipes/pipes.ts` |
| **Directivas** | `*appSiRol` (estructural: `TemplateRef` + `ViewContainerRef`), `appMascaraFecha`, `appImagenRespaldo` y `appAutofoco` (de atributo, con `@HostListener`) |
| **Firebase Hosting** | `firebase.json` (rewrite a `index.html` para las rutas de Angular) |
| **PWA** | `@angular/service-worker`, `ngsw-config.json` (también cachea los pósters de TMDB), `manifest.webmanifest`, íconos |

---

## Decisiones técnicas

**Una tabla por entidad en Supabase.** `peliculas`, `funciones`, `salas`, `pedidos`, `productos`,
etc., con claves foráneas: no se puede borrar una función con entradas vendidas (la base devuelve el
error `23503` y el servicio lo traduce a un mensaje). Los géneros son un `text[]`, porque una película
puede tener varios.

**Películas desde TMDB.** Las películas se guardan en Supabase, porque el cine decide qué proyecta, con qué funciones y precios. TMDB solo se usa para cargarlas: el admin busca el título y se completan sinopsis, duración, géneros, clasificación, estreno y póster. Los datos iniciales son películas reales tomadas de TMDB (`docs/reiniciar-datos.sql` vuelve a dejarlas limpias).

**Un solo cliente de Supabase.** En clase cada servicio creaba su cliente con `createClient`. Acá hay
más de quince servicios, y varios clientes en la misma página se pisan la sesión. Por eso
`SupabaseService` crea uno y los demás lo inyectan.

**Seguridad con Row Level Security.** La clave publishable viaja en el front, así que los permisos
están en la base: el catálogo lo lee cualquiera y solo lo escribe el admin; cada cliente ve solo sus
compras, canjes y notificaciones; empleados y admin validan QR. Un trigger impide que un cliente se
cambie el rol, los puntos o el crédito.

**Butacas: sin ventas dobles.** La tabla `butacas_vendidas` tiene clave primaria
`(funcion_id, butaca)`. Al guardar un pedido, un trigger inserta sus butacas: si alguna ya estaba
vendida, falla toda la compra y no se guarda nada. El mismo trigger suma los puntos (1 por peso) y
descuenta el crédito usado. Al cancelar, otro trigger libera las butacas y devuelve el importe como
crédito.

**Butacas "en tiempo real" consultando cada 4 segundos.** Al tocar una butaca se inserta un
*bloqueo* que vence a los 10 minutos (también con clave primaria, así dos personas no bloquean la
misma). La pantalla de compra vuelve a consultar vendidas y bloqueadas cada 4 segundos con
`setInterval`. Es más simple que Realtime, que no se vio en la cursada, y alcanza para ver lo que
eligen los demás casi al instante.

**QR de un solo uso, por mostrador.** El QR contiene el código del pedido (`LMB-XXXX-XXXX`, también
se puede tipear). La entrada y el candy se validan por separado. La actualización se hace con
`.is('entrada_validada_en', null)`: si dos empleados escanean a la vez, solo uno lo logra.

**Compra anónima.** El código del pedido es su clave, así el pedido se puede crear sin cuenta. Como
un anónimo no tiene permiso para leer pedidos, la entrada recién comprada queda en memoria
(`ComprasService.ultimoPedido`) para mostrar el QR y descargar el PDF.

**Layout de sala como dato derivado.** Todas las salas son iguales, así que el layout (A–T, fila JK
accesible con 2/10/2 butacas, R–T VIP) se calcula en `sala-layout.ts`. Cada sala solo guarda sus
butacas fuera de servicio.

**Asignación automática de sala.** `FuncionesService.programar` recorre días × horarios y, para cada
función, busca una sala sin solapamiento considerando la duración más 30 min de limpieza
(configurable). Entre las libres elige la menos usada del día. Si no hay sala, o el horario es
anterior al estreno, lo informa como conflicto en vez de crear una función inválida.

**Fechas y horas sin calendarios** (pedido del 28/02). Las fechas se escriben con la máscara
`dd/mm/aaaa` de `appMascaraFecha`. Los días de la semana son chips, y los horarios se arman con una
grilla de hora + minutos: dos clics, sin listas largas.

**PDF y Excel en el cliente.** `jspdf` + `qrcode` generan la entrada, y `xlsx` exporta el reporte
(facturación, películas más vistas y candy más vendido).

**Estilo visual.** Paleta propia de "palacio de cine" (azul noche de telón, latón de marquesina,
terciopelo de butaca) con tipografías Big Shoulders Display + Figtree. Diseño responsive y foco
visible en todos los controles.
