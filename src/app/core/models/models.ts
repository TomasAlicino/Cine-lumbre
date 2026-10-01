/** Modelos de dominio de Cine Lumbre. Cada interfaz equivale a una tabla en Supabase. */

export type Rol = 'cliente' | 'empleado' | 'admin';
export type Clasificacion = 'ATP' | '+13' | '+18';
export type EstadoPelicula = 'cartelera' | 'proximamente' | 'inactiva';
export type Formato = '2D' | '3D' | '4D' | '5D';
export type Idioma = 'castellano' | 'subtitulada';
export type TipoButaca = 'normal' | 'accesible' | 'vip';

export interface Usuario {
  id: string;
  email: string;
  passwordHash: string; // solo modo local; con Supabase Auth se elimina
  nombre: string;
  apellido: string;
  fechaNacimiento: string; // ISO yyyy-mm-dd
  tipoSangre: string;
  colorOjos: string;
  diasVacaciones: number;
  rol: Rol;
  puntos: number;
  credito: number;
  creadoEn: string;
}

export interface Preventa {
  habilitada: boolean;
  precio: number;
  diasAntes: number; // por defecto 7
}

export interface Pelicula {
  id: string;
  titulo: string;
  sinopsis: string;
  duracionMin: number;
  imagenUrl: string;
  generos: string[];
  clasificacion: Clasificacion;
  estado: EstadoPelicula;
  destacada: boolean; // aparece en la página principal
  fechaEstreno: string; // ISO yyyy-mm-dd
  preventa: Preventa;
}

export interface Sala {
  id: string;
  nombre: string;
  activa: boolean;
  butacasDeshabilitadas: string[];
}

export interface Funcion {
  id: string;
  peliculaId: string;
  salaId: string;
  inicio: string; // ISO datetime
  fin: string; // ISO datetime (inicio + duración)
  formato: Formato;
  idioma: Idioma;
  precio: number;
  precioVip: number;
}

export interface ItemPedido {
  tipo: 'producto' | 'combo' | 'recompensa';
  refId: string;
  nombre: string;
  cantidad: number;
  precioUnit: number;
}

export interface Validacion {
  fecha: string;
  porId: string;
  porNombre: string;
}

export interface Pedido {
  id: string;
  codigo: string;
  usuarioId: string | null;
  comprador: { nombre: string; email: string };
  funcionId: string;
  butacas: string[];
  items: ItemPedido[];
  subtotal: number;
  descuento: number;
  cuponCodigo: string | null;
  creditoUsado: number;
  puntosUsados: number;
  puntosGanados: number;
  total: number; // lo cobrado con otros medios de pago
  estado: 'pagada' | 'cancelada';
  requiereAdulto: boolean;
  esPreventa: boolean;
  entradaValidada: Validacion | null;
  candyEntregado: Validacion | null;
  creadoEn: string;
}

export interface Bloqueo {
  id: string;
  funcionId: string;
  butaca: string;
  sesionId: string;
  expira: string;
}

export interface Categoria {
  id: string;
  nombre: string;
}

export interface Producto {
  id: string;
  nombre: string;
  categoriaId: string;
  precio: number;
  activo: boolean;
}

export interface Combo {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number; // incluye una entrada
  items: { productoId: string; cantidad: number }[];
  destacado: boolean;
  activo: boolean;
}

export interface Cupon {
  id: string;
  codigo: string;
  porcentaje: number;
  soloMayoresDe: number | null; // ej: 50 → solo usuarios con más de 50 años
  activo: boolean;
  usos: number;
}

export interface Recompensa {
  id: string;
  nombre: string;
  tipo: 'entrada' | 'producto';
  productoId: string | null;
  costoPuntos: number;
  activa: boolean;
}

export interface Canje {
  id: string;
  usuarioId: string;
  recompensaId: string;
  nombre: string;
  puntos: number;
  pedidoId: string;
  fecha: string;
}

export interface Resena {
  id: string;
  peliculaId: string;
  usuarioId: string;
  autor: string;
  estrellas: number;
  comentario: string;
  fecha: string;
}

export interface Alerta {
  id: string;
  usuarioId: string;
  peliculaId: string;
  notificada: boolean;
}

export interface Notificacion {
  id: string;
  usuarioId: string;
  mensaje: string;
  enlace: string | null;
  leida: boolean;
  fecha: string;
}

export interface RegistroActividad {
  id: string;
  fecha: string;
  usuarioId: string;
  usuarioNombre: string;
  accion: string;
  detalle: string;
}

export interface Configuracion {
  id: string; // siempre 'global'
  porcentajePrimeraCompra: number;
  minutosLimpieza: number;
  horasLimiteCancelacion: number;
}

export interface Colecciones {
  usuarios: Usuario;
  peliculas: Pelicula;
  salas: Sala;
  funciones: Funcion;
  pedidos: Pedido;
  bloqueos: Bloqueo;
  categorias: Categoria;
  productos: Producto;
  combos: Combo;
  cupones: Cupon;
  recompensas: Recompensa;
  canjes: Canje;
  resenas: Resena;
  alertas: Alerta;
  notificaciones: Notificacion;
  actividad: RegistroActividad;
  configuracion: Configuracion;
}

export type NombreColeccion = keyof Colecciones;

export const COLECCIONES: NombreColeccion[] = [
  'usuarios', 'peliculas', 'salas', 'funciones', 'pedidos', 'bloqueos', 'categorias',
  'productos', 'combos', 'cupones', 'recompensas', 'canjes', 'resenas', 'alertas',
  'notificaciones', 'actividad', 'configuracion',
];

export const GENEROS = [
  'Acción', 'Animación', 'Aventura', 'Ciencia ficción', 'Comedia', 'Documental',
  'Drama', 'Fantasía', 'Musical', 'Romance', 'Suspenso', 'Terror',
];

export const TIPOS_SANGRE = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'];
export const COLORES_OJOS = ['Marrón', 'Negro', 'Verde', 'Azul', 'Gris', 'Miel'];
export const FORMATOS: Formato[] = ['2D', '3D', '4D', '5D'];
