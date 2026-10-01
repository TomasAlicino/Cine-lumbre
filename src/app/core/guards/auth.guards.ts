import { inject } from '@angular/core';
import { CanActivateFn, CanDeactivateFn, Router } from '@angular/router';
import { Rol } from '../models/models';
import { AuthService } from '../services/auth.service';

/** Requiere sesión iniciada; si no, manda al login y vuelve después. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  return auth.usuario ? true : inject(Router).createUrlTree(['/ingresar'], { queryParams: { volver: state.url } });
};

/** Requiere uno de los roles indicados. */
export function rolGuard(...roles: Rol[]): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.usuario) return router.createUrlTree(['/ingresar'], { queryParams: { volver: state.url } });
    return auth.tieneRol(...roles) ? true : router.createUrlTree(['/']);
  };
}

/** Evita entrar a login/registro con la sesión ya iniciada. */
export const invitadoGuard: CanActivateFn = () => {
  return inject(AuthService).usuario ? inject(Router).createUrlTree(['/']) : true;
};

export interface ConCambiosPendientes {
  tieneCambiosPendientes(): boolean;
  alSalir(): void;
}

/** Pregunta antes de abandonar una compra con butacas elegidas y libera los bloqueos. */
export const salidaCompraGuard: CanDeactivateFn<ConCambiosPendientes> = (componente) => {
  if (!componente.tieneCambiosPendientes()) {
    componente.alSalir();
    return true;
  }
  const salir = confirm('Tenés butacas elegidas. Si salís, se liberan para otras personas. ¿Querés salir?');
  if (salir) componente.alSalir();
  return salir;
};
