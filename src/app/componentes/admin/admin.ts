import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth-service';

/** Layout del panel de administración: menú lateral y cada sección en el router-outlet. */
@Component({
  selector: 'app-admin',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class Admin {
  auth = inject(AuthService);

  secciones = [
    { ruta: '/admin/tablero', nombre: 'Tablero y reportes' },
    { ruta: '/admin/peliculas', nombre: 'Películas' },
    { ruta: '/admin/funciones', nombre: 'Funciones' },
    { ruta: '/admin/salas', nombre: 'Salas y butacas' },
    { ruta: '/admin/candy', nombre: 'Candy bar y combos' },
    { ruta: '/admin/cupones', nombre: 'Cupones' },
    { ruta: '/admin/fidelizacion', nombre: 'Fidelización' },
    { ruta: '/admin/usuarios', nombre: 'Usuarios' },
    { ruta: '/admin/actividad', nombre: 'Log de actividad' },
    { ruta: '/admin/configuracion', nombre: 'Configuración' },
  ];
}
