import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Routes } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

// ─────────────────────────────── Layout ───────────────────────────────

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AsyncPipe],
  template: `
    <div class="contenedor pagina admin">
      <aside class="lateral" aria-label="Secciones de administración">
        <p class="rotulo">Administración</p>
        @if (auth.usuario$ | async; as u) { <p class="suave chico quien">{{ u.nombre }} {{ u.apellido }}</p> }
        <nav>
          @for (s of secciones; track s.ruta) {
            <a [routerLink]="s.ruta" routerLinkActive="activa">{{ s.nombre }}</a>
          }
        </nav>
      </aside>
      <section class="cuerpo">
        <router-outlet />
      </section>
    </div>
  `,
  styles: `
    .admin { display: grid; grid-template-columns: 220px 1fr; gap: 32px; align-items: start; }
    .lateral { position: sticky; top: 88px; border: 1px solid var(--linea); border-radius: var(--r-m); background: var(--noche-2); padding: 16px; }
    .rotulo { font: 800 var(--t-l) / 1 var(--f-display); color: var(--laton); margin: 0 0 4px; text-transform: uppercase; letter-spacing: .04em; }
    .quien { margin: 0 0 12px; }
    nav { display: flex; flex-direction: column; gap: 2px; }
    nav a { padding: 8px 12px; border-radius: var(--r-s); color: var(--humo); text-decoration: none; font-weight: 600; border-left: 3px solid transparent; }
    nav a:hover { color: var(--pantalla); background: var(--noche-3); }
    nav a.activa { color: var(--pantalla); background: var(--noche-3); border-left-color: var(--laton); }
    .cuerpo { min-width: 0; }
    @media (max-width: 860px) {
      .admin { grid-template-columns: 1fr; gap: 16px; }
      .lateral { position: static; padding: 10px; }
      .quien { display: none; }
      nav { flex-direction: row; overflow-x: auto; }
      nav a { white-space: nowrap; border-left: 0; border-bottom: 3px solid transparent; }
      nav a.activa { border-bottom-color: var(--laton); }
    }
  `,
})
export class AdminLayoutComponent {
  readonly auth = inject(AuthService);
  readonly secciones = [
    { ruta: 'tablero', nombre: 'Tablero y reportes' },
    { ruta: 'peliculas', nombre: 'Películas' },
    { ruta: 'funciones', nombre: 'Funciones' },
    { ruta: 'salas', nombre: 'Salas y butacas' },
    { ruta: 'candy', nombre: 'Candy bar y combos' },
    { ruta: 'cupones', nombre: 'Cupones' },
    { ruta: 'fidelizacion', nombre: 'Fidelización' },
    { ruta: 'usuarios', nombre: 'Usuarios' },
    { ruta: 'actividad', nombre: 'Log de actividad' },
    { ruta: 'configuracion', nombre: 'Configuración' },
  ];
}

/** Cada sección se carga con lazy loading: el bundle del admin solo lo descarga quien entra. */
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tablero' },
      { path: 'tablero', title: 'Tablero · Admin', loadComponent: () => import('./tablero.component').then((m) => m.TableroComponent) },
      { path: 'peliculas', title: 'Películas · Admin', loadComponent: () => import('./peliculas-admin.component').then((m) => m.PeliculasAdminComponent) },
      { path: 'funciones', title: 'Funciones · Admin', loadComponent: () => import('./funciones-admin.component').then((m) => m.FuncionesAdminComponent) },
      { path: 'salas', title: 'Salas · Admin', loadComponent: () => import('./salas-admin.component').then((m) => m.SalasAdminComponent) },
      { path: 'candy', title: 'Candy bar · Admin', loadComponent: () => import('./candy-admin.component').then((m) => m.CandyAdminComponent) },
      { path: 'cupones', title: 'Cupones · Admin', loadComponent: () => import('./gestion-admin.components').then((m) => m.CuponesAdminComponent) },
      { path: 'fidelizacion', title: 'Fidelización · Admin', loadComponent: () => import('./gestion-admin.components').then((m) => m.RecompensasAdminComponent) },
      { path: 'usuarios', title: 'Usuarios · Admin', loadComponent: () => import('./gestion-admin.components').then((m) => m.UsuariosAdminComponent) },
      { path: 'actividad', title: 'Actividad · Admin', loadComponent: () => import('./gestion-admin.components').then((m) => m.ActividadAdminComponent) },
      { path: 'configuracion', title: 'Configuración · Admin', loadComponent: () => import('./gestion-admin.components').then((m) => m.ConfiguracionAdminComponent) },
    ],
  },
];
