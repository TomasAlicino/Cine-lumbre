/**
 * Modelos de Cine Lumbre. Cada interfaz es una tabla de Supabase (docs/supabase.sql)
 * y los nombres de los campos son los de las columnas.
 */

export type Rol = 'cliente' | 'empleado' | 'admin';
export type Clasificacion = 'ATP' | '+13' | '+18';
export type EstadoPelicula = 'cartelera' | 'proximamente' | 'inactiva';
export type Formato = '2D' | '3D' | '4D' | '5D';
export type Idioma = 'castellano' | 'subtitulada';
export type TipoButaca = 'normal' | 'accesible' | 'vip';

export interface Perfil {
  id: string; // mismo id que el usuario de Supabase Auth
  email: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento: string; // yyyy-mm-dd
  tipo_sangre: string;
  color_ojos: string;
  dias_vacaciones: number;
  rol: Rol;
  puntos: number;
  credito: number;
  creado_en: string;
}

export interface Pelicula {
  id: number;
  titulo: string;
  sinopsis: string;
  duracion_min: number;
  imagen_url: string | null;
  generos: string[];
  clasificacion: Clasificacion;
  estado: EstadoPelicula;
  destacada: boolean;
  fecha_estreno: string; // yyyy-mm-dd
  preventa_habilitada: boolean;
  preventa_precio: number;
  preventa_dias_antes: number;
}

export interface Sala {
  id: number;
  nombre: string;
  activa: boolean;
  butacas_deshabilitadas: string[];
}

export interface Funcion {
  id: number;
  pelicula_id: number;
  sala_id: number;
  inicio: string; // ISO
  fin: string; // ISO (inicio + duración)
  formato: Formato;
  idioma: Idioma;
  precio: number;
  precio_vip: number;
}

/** Función con su película y su sala (select('*, peliculas(*), salas(*)')). */
export interface FuncionCompleta extends Funcion {
  peliculas: Pelicula;
  salas: Sala;
}

export type TipoItem = 'producto' | 'combo' | 'canje-entrada' | 'canje-producto';

export interface ItemPedido {
  tipo: TipoItem;
  ref_id: number;
  nombre: string;
  cantidad: number;
  precio_unit: number;
}

export interface Pedido {
  codigo: string; // también es el contenido del QR
  usuario_id: string | null;
  comprador_nombre: string;
  comprador_email: string;
  funcion_id: number;
  butacas: string[];
  items: ItemPedido[];
  subtotal: number;
  descuento: number;
  cupon_codigo: string | null;
  credito_usado: number;
  puntos_usados: number;
  puntos_ganados: number;
  total: number; // lo cobrado con otros medios de pago
  estado: 'pagada' | 'cancelada';
  requiere_adulto: boolean;
  es_preventa: boolean;
  entrada_validada_en: string | null;
  entrada_validada_por: string | null;
  candy_entregado_en: string | null;
  candy_entregado_por: string | null;
  creado_en: string;
}

/** Pedido con su función, película y sala. */
export interface PedidoCompleto extends Pedido {
  funciones: FuncionCompleta;
}

export interface Bloqueo {
  funcion_id: number;
  butaca: string;
  sesion_id: string;
  expira: string;
}

export interface Categoria {
  id: number;
  nombre: string;
}

export interface Producto {
  id: number;
  nombre: string;
  categoria_id: number;
  precio: number;
  activo: boolean;
}

export interface ItemCombo {
  producto_id: number;
  cantidad: number;
}

export interface Combo {
  id: number;
  nombre: string;
  descripcion: string;
  precio: number; // incluye una entrada
  items: ItemCombo[];
  destacado: boolean;
  activo: boolean;
}

export interface Cupon {
  id: number;
  codigo: string;
  porcentaje: number;
  solo_mayores_de: number | null;
  activo: boolean;
}

export interface Recompensa {
  id: number;
  nombre: string;
  tipo: 'entrada' | 'producto';
  producto_id: number | null;
  costo_puntos: number;
  activa: boolean;
}

export interface Canje {
  id: number;
  usuario_id: string;
  recompensa_id: number | null;
  nombre: string;
  puntos: number;
  pedido_codigo: string | null;
  fecha: string;
}

export interface Resena {
  id: number;
  pelicula_id: number;
  usuario_id: string;
  autor: string;
  estrellas: number;
  comentario: string;
  fecha: string;
}

export interface Alerta {
  id: number;
  usuario_id: string;
  pelicula_id: number;
  notificada: boolean;
}

export interface Notificacion {
  id: number;
  usuario_id: string;
  mensaje: string;
  enlace: string | null;
  leida: boolean;
  fecha: string;
}

export interface Actividad {
  id: number;
  fecha: string;
  usuario_id: string | null;
  usuario_nombre: string;
  accion: string;
  detalle: string;
}

export interface Configuracion {
  id: number; // siempre 1
  porcentaje_primera_compra: number;
  minutos_limpieza: number;
  horas_limite_cancelacion: number;
}

export const GENEROS = [
  'Acción', 'Animación', 'Aventura', 'Ciencia ficción', 'Comedia', 'Documental',
  'Drama', 'Fantasía', 'Musical', 'Romance', 'Suspenso', 'Terror',
];

export const TIPOS_SANGRE = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'];
export const COLORES_OJOS = ['Marrón', 'Negro', 'Verde', 'Azul', 'Gris', 'Miel'];
export const FORMATOS: Formato[] = ['2D', '3D', '4D', '5D'];
