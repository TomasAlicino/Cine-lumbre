# Cine Lumbre 🎬

Sistema de venta de entradas para un cine de un solo edificio con varias salas: cartelera, compra con
selección de butacas en tiempo real, candy bar, cupones, puntos de fidelización, validación de QR
para empleados y panel de administración con reportes.

**TP 1 — Programación IV (UTN FRA, 2026)**

- 🌐 **Demo:** `https://<tu-proyecto>.web.app` *(completar después del deploy)*
- 📄 **Requerimientos:** [docs/REQUERIMIENTOS.md](docs/REQUERIMIENTOS.md)
- 🗄️ **Esquema Supabase:** [docs/supabase.sql](docs/supabase.sql)

### Cuentas de prueba

| Rol | Mail | Contraseña |
|---|---|---|
| Admin | admin@lumbre.com | admin123 |
| Empleado | empleado@lumbre.com | empleado123 |
| Cliente (1200 puntos) | cliente@lumbre.com | cliente123 |
| Cliente mayor de 50 | mayor@lumbre.com | mayor123 |
| Cliente menor (13 años) | joven@lumbre.com | joven123 |

La pantalla de ingreso tiene accesos rápidos para admin, empleado y cliente. Cupones de prueba:
`LUMBRE10` (10%) y `DORADOS50` (30%, solo para mayores de 50).

---

## Puesta en marcha

Requiere **Node.js 20.19+ o 22.12+** (Angular 21).

```bash
npm install
npm start            # http://localhost:4200
npm run build        # genera dist/cine-lumbre/browser
```

### Configurar Supabase

1. Crear un proyecto en Supabase y correr [docs/supabase.sql](docs/supabase.sql) en el **SQL Editor**.
2. En **Authentication → Providers → Email**, desactivar *Confirm email* (las cuentas demo se dan
   de alta solas en su primer ingreso).
3. Completar [src/environments/environment.ts](src/environments/environment.ts) con
   `supabaseUrl` y `supabasePublishableKey` (Project Settings → API → *publishable key*).
   **No** usar la contraseña de la base ni la `service_role` key: el archivo se publica en el navegador.
4. La primera vez que la app encuentra la tabla vacía la siembra con `public/data/seed.json`.

Si `environment.ts` no tiene la clave, la app corre en **modo local** (localStorage + BroadcastChannel
entre pestañas). Sirve para probar sin backend.

### Deploy en Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # usar el firebase.json existente, carpeta pública: dist/cine-lumbre/browser
npm run build
firebase deploy
```

`firebase.json` ya tiene el *rewrite* a `index.html` (necesario para las rutas de Angular), el
`no-cache` del service worker y caché larga para los bundles con hash.

---

## Arquitectura

```
src/app
├── core/                       ← sin UI: lógica y datos
│   ├── models/                 interfaces de dominio (una por colección)
│   ├── services/               un servicio por dominio + DbService + SupabaseService
│   ├── guards/                 authGuard, rolGuard, invitadoGuard, salidaCompraGuard
│   └── utils/                  reglas puras: layout de sala, preventa, precios, fechas
├── shared/                     reutilizable entre pantallas
│   ├── components/             mapa de butacas, estrellas, tarjeta de película, selectores
│   ├── directives/             appSiRol, appMascaraFecha, appImagenRespaldo, appAutofoco
│   └── pipes/                  pesos, duracion, fechaAR, clasificacion, tipoButaca, buscarPeliculas, estrellas
└── features/                   una carpeta por área, todas con lazy loading
    ├── public/                 inicio, cartelera, próximamente, detalle de película
    ├── booking/                compra (butacas → candy → pago) y entrada con QR
    ├── auth/                   ingreso y registro
    ├── account/                perfil, compras, mis películas, puntos
    ├── staff/                  StaffModule (NgModule): validador de QR
    └── admin/                  layout + 10 secciones
```

### Flujo de datos

```
Componente ──► Servicio de dominio (ReservasService, FuncionesService, …)
                   │  reglas de negocio y validaciones
                   ▼
               DbService ── BehaviorSubject por colección ──► Observables a la UI (async pipe)
                   │
                   ├─ Supabase configurado → tabla lumbre_datos + Realtime
                   └─ sin configurar       → localStorage + BroadcastChannel
```

- Los componentes **no tienen lógica de negocio**: se suscriben a observables con `async` y llaman
  métodos de servicios.
- Las **reglas de negocio** viven en servicios y en funciones puras de `core/utils`: preventa,
  recargo VIP, restricción de edad y solapamiento de funciones.
- **DbService** es el único que conoce el almacenamiento. Pasar de localStorage a Supabase no tocó
  ningún otro servicio de dominio.

---

## Temas de la cursada y dónde se usan

| Tema | Dónde |
|---|---|
| **Componentes, Input & Output** | `MapaButacasComponent` (`@Input estado` / `@Output butacaClick`), `EstrellasComponent` (`[(valor)]` con `valorChange`), `PeliculaCardComponent` (`alternarAlerta`) |
| **Rutas** | `app.routes.ts`, rutas hijas en `mi-cuenta` y `admin`, parámetros enlazados a `@Input` con `withComponentInputBinding()` |
| **Lazy loading** | Todas las pantallas: `loadComponent` / `loadChildren`. El admin y las librerías pesadas (jsPDF, xlsx) se descargan solo cuando se usan |
| **Módulos** | `StaffModule` + `StaffRoutingModule` (`RouterModule.forChild`) cargado con `loadChildren` |
| **Servicios** | `core/services`, inyectados con `inject()`, `providedIn: 'root'` |
| **HTTP** | `HttpClient` carga la semilla `data/seed.json` en el `provideAppInitializer` |
| **Observables (RxJS)** | `BehaviorSubject` por colección, `combineLatest`, `switchMap`, `timer` (expiración de bloqueos de butacas), `async` pipe |
| **Formularios** | Reactivos con validadores propios (`core/utils/validadores.ts`) en ingreso, registro, películas, funciones y compra; template-driven en el validador |
| **Supabase** | `SupabaseService` (`createClient`), Auth (`signInWithPassword` / `signUp` / `signOut`), tabla de datos, **Realtime** para las butacas |
| **Guards** | `authGuard`, `rolGuard('admin')`, `invitadoGuard` (CanActivate) y `salidaCompraGuard` (CanDeactivate: confirma y libera las butacas si salís a mitad de compra) |
| **Pipes** | 7 pipes propios en `shared/pipes/pipes.ts` (ej. `buscarPeliculas` filtra por texto y géneros) |
| **Directivas** | `*appSiRol` (estructural, muestra según el rol), `appMascaraFecha`, `appImagenRespaldo`, `appAutofoco` |
| **Firebase Hosting** | `firebase.json` |
| **PWA** | `@angular/service-worker`, `ngsw-config.json`, `manifest.webmanifest`, íconos de 72 a 512 px |

---

## Decisiones técnicas

**Standalone components + un NgModule.** El proyecto usa componentes standalone, el estándar actual de
Angular. El área de empleados se armó como NgModule con su routing module para aplicar el patrón
visto en clase. Los dos conviven: el módulo importa el componente standalone.

**Una tabla documental en Supabase (`lumbre_datos`).** Cada registro es una fila
`(coleccion, id, data jsonb)`. Ventajas: un solo esquema, una suscripción Realtime para todo y el
modelo de dominio queda tipado en TypeScript (`models.ts`). Contra: no hay claves foráneas ni
consultas SQL por columna. Para el volumen de un cine alcanza, y la integridad la cuidan los
servicios. El siguiente paso natural es una tabla por colección con RLS por rol.

**Escritura optimista.** `DbService` actualiza la UI al instante y después envía a Supabase solo la
diferencia (upsert de lo que cambió, delete de lo que se quitó). Los ecos de Realtime de cambios
propios se ignoran comparando el contenido.

**Butacas en tiempo real.** Al tocar una butaca se crea un *bloqueo* con vencimiento (colección
`bloqueos`). Los demás usuarios lo reciben por Realtime y la ven ocupada. Si la compra se abandona,
el bloqueo vence solo o se libera con el `CanDeactivate`. Antes de confirmar el pago se vuelve a
verificar que ninguna butaca se haya vendido.

**Layout de sala como dato derivado.** Todas las salas son iguales, así que el layout (A–T, fila JK
accesible, R–T VIP) se calcula en `sala-layout.ts` y no se guarda. Cada sala solo guarda sus butacas
fuera de servicio.

**Asignación automática de sala.** `FuncionesService.programar` recorre días × horarios y, para cada
función, busca una sala sin solapamiento considerando `duración + 30 min de limpieza`. Entre las
libres elige la menos usada del día, para repartir la carga. Si no hay sala libre, lo informa en el
resultado en vez de crear una función inválida.

**Fechas y horas sin calendarios** (pedido del 28/02). Las fechas se escriben con máscara `dd/mm/aaaa`
y el rango tiene atajos de 1, 2 y 4 semanas. Los días de la semana son chips y los horarios se arman
con una grilla de hora + minutos: dos clics, sin listas largas.

**QR único por compra.** El QR codifica el código del pedido (`LMB-XXXX-XXXX`). La entrada y el candy
tienen estados de validación independientes: el empleado del candy no "quema" la entrada, ni al
revés. Cada validación queda en el log de actividad.

**PDF y Excel en el cliente.** `jspdf` + `qrcode` generan la entrada, y `xlsx` exporta el reporte.
Se importan dinámicamente, así que no pesan en la carga inicial.

**Autenticación.** Supabase Auth maneja las credenciales. El perfil del negocio (datos del registro,
rol, puntos, crédito) se guarda aparte con el mismo id. En modo local se usa SHA-256 con sal fija,
solo para la demo.

**Estilo visual.** Paleta propia de "palacio de cine" (azul noche de telón, latón de marquesina,
terciopelo de butaca) con tipografías Big Shoulders Display + Figtree. Hay variables CSS en
`styles.scss`, diseño responsive y foco visible en todos los controles.
