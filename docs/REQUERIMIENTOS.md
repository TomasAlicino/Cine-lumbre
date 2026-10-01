# Cine Lumbre — Documento de requerimientos

Resumen de todo lo pedido por el cliente en el intercambio de mails (01/01 al 10/03), ordenado por área.
Cada requerimiento tiene un código para referenciarlo en la defensa y su estado en la aplicación.

**Estado:** ✅ implementado · ⏸ fuera de alcance (el cliente no lo aprobó)

---

## 1. Cartelera y películas

| Código | Requerimiento | Origen | Estado |
|---|---|---|---|
| PEL-01 | Toda película tiene nombre, duración, imagen y sinopsis | 01/01 | ✅ |
| PEL-02 | Cada película puede tener **varios géneros** | 16/01 | ✅ |
| PEL-03 | El admin elige qué películas aparecen en la página principal (destacadas) | 01/01 | ✅ |
| PEL-04 | La página principal muestra primero las **3 películas más vendidas** | 16/01 | ✅ |
| PEL-05 | El listado de películas tiene buscador por texto y **filtro por género** | 16/01 | ✅ |
| PEL-06 | Clasificación por edad: ATP, +13, +18 | 12/02 | ✅ |
| PEL-07 | Sección **Próximamente** con los estrenos de las próximas semanas | 08/03 | ✅ |
| PEL-08 | El usuario puede activar una **alerta** y recibe una notificación cuando se abre la venta | 08/03 | ✅ |
| PEL-09 | **Preventa** configurable por película: abre 7 días antes del estreno con precio especial; al estrenar vuelve al precio normal | 08/03 | ✅ |

## 2. Funciones y salas

| Código | Requerimiento | Origen | Estado |
|---|---|---|---|
| FUN-01 | El admin define horarios, formato (2D/3D/4D/5D) e idioma (castellano/subtitulada) | 01/01 | ✅ |
| FUN-02 | Entre funciones de la misma sala deben pasar **30 minutos** desde el fin de la anterior (duración + limpieza) | 01/01 | ✅ |
| FUN-03 | Programación por días de la semana y horarios (ej. lunes, martes y viernes a las 18 h) | 06/02 | ✅ |
| FUN-04 | **Asignación automática de sala**: el sistema elige una sala libre; nunca dos funciones solapadas en la misma sala | 06/02 | ✅ |
| SAL-01 | Un edificio con varias salas, todas con la misma distribución | 01/01 | ✅ |
| SAL-02 | 20 filas (A–T) en 3 bloques de 4, 20 y 4 butacas | 01/01 | ✅ |
| SAL-03 | Las filas J y K se reemplazan por **una fila accesible** de 2, 10 y 2 butacas, resaltada distinto | 12/02 | ✅ |
| SAL-04 | Filas R, S y T son **VIP**: precio mayor, color distinto, aviso claro antes de pagar | 10/03 | ✅ |
| SAL-05 | El admin controla la distribución (marcar butacas fuera de servicio) | 06/02 | ✅ |
| SAL-06 | Mapa del cine indicando la sala de la entrada | 30/01 | ⏸ "No tenemos luz verde aún" |

## 3. Compra de entradas

| Código | Requerimiento | Origen | Estado |
|---|---|---|---|
| COM-01 | Se puede comprar **sin registrarse** (anónimo) | 01/01 | ✅ |
| COM-02 | Se genera un **PDF** con los datos de la entrada y un **QR** | 01/01 | ✅ |
| COM-03 | Butacas en **tiempo real**: se ven las ocupadas o tomadas por otra compra en curso | 12/02 | ✅ |
| COM-04 | Menores de 13/18 años no pueden comprar películas con esa restricción | 12/02 | ✅ |
| COM-05 | Entradas de películas restringidas aclaran que **debe asistir un adulto** | 12/02 | ✅ |
| COM-06 | Las reseñas y el promedio se ven antes de comprar | 16/01 | ✅ |
| COM-07 | Cancelación hasta **2 horas antes** de la función: se devuelve como **crédito** en la cuenta | 10/03 | ✅ |
| COM-08 | El crédito se ve en el perfil y se combina con otros medios de pago | 10/03 | ✅ |

## 4. Candy bar

| Código | Requerimiento | Origen | Estado |
|---|---|---|---|
| CAN-01 | El admin crea productos y los agrupa en **categorías** | 30/01 | ✅ |
| CAN-02 | El candy se compra junto con la entrada y se retira con **el mismo QR** | 30/01 | ✅ |
| CAN-03 | **Combos** entrada + pochoclo + bebida a precio fijo configurable, destacados en la compra | 03/03 | ✅ |

## 5. Usuarios, cupones y fidelización

| Código | Requerimiento | Origen | Estado |
|---|---|---|---|
| USR-01 | Registro con mail, nombre, apellido, fecha de nacimiento, tipo de sangre, color de ojos y días de vacaciones por año | 01/01 | ✅ |
| USR-02 | Cupón de **bienvenida** en la primera compra, con porcentaje configurable (20% inicial) | 01/01 · 30/01 | ✅ |
| USR-03 | Cupones exclusivos para **mayores de 50 años** | 30/01 | ✅ |
| USR-04 | Reseñas: estrellas + comentario corto por película; **promedio** visible | 16/01 | ✅ |
| FID-01 | Usuarios registrados suman **1 punto por cada peso** pagado | 03/03 | ✅ |
| FID-02 | Puntos canjeables por entradas o productos; el admin configura el costo de cada recompensa | 03/03 | ✅ |
| FID-03 | El perfil muestra los puntos y el historial de canjes; los puntos no se transfieren | 03/03 | ✅ |
| FID-04 | **Mis películas**: historial visual con pósters, fechas y calificación propia | 08/03 | ✅ |

## 6. Empleados

| Código | Requerimiento | Origen | Estado |
|---|---|---|---|
| EMP-01 | Usuario empleado que escanea QR para validar entradas y entregas del candy | 06/02 | ✅ |
| EMP-02 | Ingreso **manual del código** si el lector no funciona | 06/02 | ✅ |
| EMP-03 | Una vez validada la entrada o entregado el candy, ese QR **deja de funcionar** para esa parte | 06/02 | ✅ |

## 7. Administración y reportes

| Código | Requerimiento | Origen | Estado |
|---|---|---|---|
| ADM-01 | Usuario admin que controla salas, funciones, butacas, productos, etc. | 06/02 | ✅ |
| ADM-02 | Reporte de **facturación por día** y entradas vendidas | 28/02 | ✅ |
| ADM-03 | Exportar el reporte a **PDF y Excel** | 10/03 | ✅ |
| ADM-04 | Gráfico de películas **más vistas por semana y por mes** | 10/03 | ✅ |
| ADM-05 | Producto del candy **más vendido** | 10/03 | ✅ |
| ADM-06 | **Log de actividad**: quién creó funciones, cambió precios, validó QR, con fecha y hora | 10/03 | ✅ |

## 8. Usabilidad y calidad

| Código | Requerimiento | Origen | Estado |
|---|---|---|---|
| UX-01 | Interfaces fáciles para clientes y empleados | 28/02 | ✅ |
| UX-02 | **Sin calendarios desplegables** para fechas ni listas largas para horas: fechas con máscara dd/mm/aaaa y atajos, días como chips, horarios con selector rápido | 28/02 | ✅ |
| UX-03 | Evitar el scroll excesivo | 28/02 | ✅ |
| TEC-01 | Estilo visual propio | Consigna | ✅ |
| TEC-02 | Integración con **Supabase** (datos, auth, realtime) | Consigna | ✅ |
| TEC-03 | **PWA** instalable con funcionamiento offline del shell | Consigna | ✅ |
| TEC-04 | Aplicación **desplegada** (Firebase Hosting) | Consigna | ✅ config lista |

---

## Decisiones ante ambigüedades

- **"Más de 50 años"** se toma literal: edad ≥ 51 al día de la compra.
- **Fila accesible**: J y K se fusionan en una sola fila "JK" con 14 butacas (2 + 10 + 2).
- **Recargo VIP**: diferencia entre `precioVip` y `precio` de la función; durante la preventa se suma al precio de preventa.
- **Cupón de bienvenida**: se ofrece sin código en la primera compra de un usuario registrado. Se aplica un solo cupón por compra: si el usuario ingresa otro código, se usa ese y se le avisa.
- **Compra anónima de películas +13/+18**: no se puede verificar la edad, así que se permite y la entrada lleva la leyenda de que debe asistir un adulto.
- **Cancelación**: devuelve como crédito lo pagado con dinero y con crédito. Los puntos ganados se descuentan y los puntos canjeados se devuelven.
- **QR único por compra** con dos estados independientes: entrada validada y candy entregado.
- **Datos personales**: se piden porque el cliente los pidió explícitamente. Ninguno es obligatorio para comprar como anónimo.
