import { Routes } from '@angular/router';
import { authGuard, invitadoGuard, rolGuard, salidaCompraGuard } from './guards/auth-guard';

/** Todas las pantallas se cargan con lazy loading (loadComponent / loadChildren). */
export const routes: Routes = [
  { path: '', title: 'Cine Lumbre', loadComponent: () => import('./componentes/inicio/inicio').then((m) => m.Inicio) },
  { path: 'cartelera', title: 'Cartelera · Cine Lumbre', loadComponent: () => import('./componentes/cartelera/cartelera').then((m) => m.Cartelera) },
  { path: 'proximamente', title: 'Próximamente · Cine Lumbre', loadComponent: () => import('./componentes/proximamente/proximamente').then((m) => m.Proximamente) },
  { path: 'pelicula/:id', title: 'Película · Cine Lumbre', loadComponent: () => import('./componentes/pelicula-detalle/pelicula-detalle').then((m) => m.PeliculaDetalle) },
  {
    path: 'comprar/:funcionId',
    title: 'Comprar entradas · Cine Lumbre',
    canDeactivate: [salidaCompraGuard],
    loadComponent: () => import('./componentes/compra/compra').then((m) => m.Compra),
  },
  { path: 'entrada/:codigo', title: 'Tu entrada · Cine Lumbre', loadComponent: () => import('./componentes/entrada/entrada').then((m) => m.Entrada) },
  { path: 'ingresar', title: 'Ingresar · Cine Lumbre', canActivate: [invitadoGuard], loadComponent: () => import('./componentes/login/login').then((m) => m.Login) },
  { path: 'registro', title: 'Registro · Cine Lumbre', canActivate: [invitadoGuard], loadComponent: () => import('./componentes/registro/registro').then((m) => m.Registro) },
  {
    path: 'mi-cuenta',
    canActivate: [authGuard],
    loadComponent: () => import('./componentes/mi-cuenta/mi-cuenta').then((m) => m.MiCuenta),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'perfil' },
      { path: 'perfil', title: 'Mi perfil · Cine Lumbre', loadComponent: () => import('./componentes/mi-perfil/mi-perfil').then((m) => m.MiPerfil) },
      { path: 'compras', title: 'Mis compras · Cine Lumbre', loadComponent: () => import('./componentes/mis-compras/mis-compras').then((m) => m.MisCompras) },
      { path: 'mis-peliculas', title: 'Mis películas · Cine Lumbre', loadComponent: () => import('./componentes/mis-peliculas/mis-peliculas').then((m) => m.MisPeliculas) },
      { path: 'puntos', title: 'Mis puntos · Cine Lumbre', loadComponent: () => import('./componentes/mis-puntos/mis-puntos').then((m) => m.MisPuntos) },
    ],
  },
  {
    path: 'validar',
    canActivate: [rolGuard('empleado', 'admin')],
    // Área de empleados como NgModule con su propio routing module (lazy loading de módulo)
    loadChildren: () => import('./modulos/staff/staff-module').then((m) => m.StaffModule),
  },
  {
    path: 'admin',
    canActivate: [rolGuard('admin')],
    loadComponent: () => import('./componentes/admin/admin').then((m) => m.Admin),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tablero' },
      { path: 'tablero', title: 'Tablero · Admin', loadComponent: () => import('./componentes/admin-tablero/admin-tablero').then((m) => m.AdminTablero) },
      { path: 'peliculas', title: 'Películas · Admin', loadComponent: () => import('./componentes/admin-peliculas/admin-peliculas').then((m) => m.AdminPeliculas) },
      { path: 'funciones', title: 'Funciones · Admin', loadComponent: () => import('./componentes/admin-funciones/admin-funciones').then((m) => m.AdminFunciones) },
      { path: 'salas', title: 'Salas · Admin', loadComponent: () => import('./componentes/admin-salas/admin-salas').then((m) => m.AdminSalas) },
      { path: 'candy', title: 'Candy bar · Admin', loadComponent: () => import('./componentes/admin-candy/admin-candy').then((m) => m.AdminCandy) },
      { path: 'cupones', title: 'Cupones · Admin', loadComponent: () => import('./componentes/admin-cupones/admin-cupones').then((m) => m.AdminCupones) },
      { path: 'fidelizacion', title: 'Fidelización · Admin', loadComponent: () => import('./componentes/admin-recompensas/admin-recompensas').then((m) => m.AdminRecompensas) },
      { path: 'usuarios', title: 'Usuarios · Admin', loadComponent: () => import('./componentes/admin-usuarios/admin-usuarios').then((m) => m.AdminUsuarios) },
      { path: 'actividad', title: 'Actividad · Admin', loadComponent: () => import('./componentes/admin-actividad/admin-actividad').then((m) => m.AdminActividad) },
      { path: 'configuracion', title: 'Configuración · Admin', loadComponent: () => import('./componentes/admin-configuracion/admin-configuracion').then((m) => m.AdminConfiguracion) },
    ],
  },
  { path: '**', title: 'No encontrado · Cine Lumbre', loadComponent: () => import('./componentes/no-encontrado/no-encontrado').then((m) => m.NoEncontrado) },
];
