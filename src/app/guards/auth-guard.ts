import { inject } from '@angular/core';
import { CanActivateFn, CanDeactivateFn, Router } from '@angular/router';
import { Rol } from '../models/models';
import { AuthService } from '../services/auth-service';

/**
 * Guards funcionales. Son async porque al abrir la app primero hay que esperar
 * a que Supabase lea la sesión guardada (auth.esperarSesion()).
 */

/** Requiere sesión iniciada; si no, manda al login y después vuelve. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.esperarSesion();
  return auth.usuario() ? true : router.createUrlTree(['/ingresar'], { queryParams: { volver: state.url } });
};

/** Requiere alguno de los roles indicados. */
export function rolGuard(...roles: Rol[]): CanActivateFn {
  return async (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    await auth.esperarSesion();
    if (!auth.usuario()) return router.createUrlTree(['/ingresar'], { queryParams: { volver: state.url } });
    return auth.tieneRol(...roles) ? true : router.createUrlTree(['/']);
  };
}

/** No deja entrar a login/registro con la sesión ya iniciada. */
export const invitadoGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.esperarSesion();
  return auth.usuario() ? router.createUrlTree(['/']) : true;
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
