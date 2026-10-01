import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PesosPipe } from '../../pipes/pipes';
import { AuthService } from '../../services/auth-service';

/** Layout de "Mi cuenta": menú lateral y las rutas hijas (perfil, compras, películas, puntos). */
@Component({
  selector: 'app-mi-cuenta',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, PesosPipe],
  templateUrl: './mi-cuenta.html',
  styleUrl: './mi-cuenta.scss',
})
export class MiCuenta {
  auth = inject(AuthService);
}
