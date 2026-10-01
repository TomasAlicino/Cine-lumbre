import { Routes } from '@angular/router';
import { authGuard, invitadoGuard, rolGuard, salidaCompraGuard } from './core/guards/auth.guards';

/** Todas las pantallas se cargan con lazy loading (loadComponent / loadChildren). */
export const routes: Routes = [
  { path: '', title: 'Cine Lumbre', loadComponent: () => import('./features/public/inicio.component').then((m) => m.InicioComponent) },
  { path: 'cartelera', title: 'Cartelera · Cine Lumbre', loadComponent: () => import('./features/public/cartelera.component').then((m) => m.CarteleraComponent) },
  { path: 'proximamente', title: 'Próximamente · Cine Lumbre', loadComponent: () => import('./features/public/proximamente.component').then((m) => m.ProximamenteComponent) },
  { path: 'pelicula/:id', title: 'Película · Cine Lumbre', loadComponent: () => import('./features/public/pelicula-detalle.component').then((m) => m.PeliculaDetalleComponent) },
  {
    path: 'comprar/:funcionId',
    title: 'Comprar entradas · Cine Lumbre',
    canDeactivate: [salidaCompraGuard],
    loadComponent: () => import('./features/booking/compra.component').then((m) => m.CompraComponent),
  },
  { path: 'entrada/:pedidoId', title: 'Tu entrada · Cine Lumbre', loadComponent: () => import('./features/booking/entrada.component').then((m) => m.EntradaComponent) },
  { path: '', canActivate: [invitadoGuard], loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES) },
  { path: 'mi-cuenta', canActivate: [authGuard], loadChildren: () => import('./features/account/cuenta.routes').then((m) => m.CUENTA_ROUTES) },
  {
    path: 'validar',
    canActivate: [rolGuard('empleado', 'admin')],
    // Área de empleados como NgModule con su propio routing module (lazy loading de módulo)
    loadChildren: () => import('./features/staff/staff.module').then((m) => m.StaffModule),
  },
  { path: 'admin', canActivate: [rolGuard('admin')], loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES) },
  { path: '**', title: 'No encontrado · Cine Lumbre', loadComponent: () => import('./features/public/no-encontrado.component').then((m) => m.NoEncontradoComponent) },
];
